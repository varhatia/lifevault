import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { downloadEncryptedFile } from '@/lib/api/s3';
import { getUserFromRequest } from '@/lib/api/auth';

/**
 * @route   GET /api/vaults/my/:vaultId/items/:id/download
 * @desc    Download encrypted file from S3
 * @access  Private
 * 
 * Returns encrypted blob - client must decrypt it
 * Server never decrypts the data
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string; id: string }> }
) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { vaultId, id: itemId } = await params;
    
    const userId = String(user.id);
    // Verify user owns the vault
    const myVault = await prisma.myVault.findFirst({
      where: { id: vaultId, ownerId: userId },
    });

    if (!myVault) {
      return NextResponse.json({ error: 'Vault not found or unauthorized' }, { status: 404 });
    }

    // Find item to get S3 key and IV
    // Verify item belongs to this vault
    const item = await prisma.vaultItem.findFirst({
      where: { 
        id: itemId,
        myVaultId: vaultId,
      },
      select: { s3Key: true, category: true, title: true, iv: true },
    });
    
    if (!item || !item.s3Key) {
      return NextResponse.json(
        { error: 'Vault item not found or no file attached' },
        { status: 404 }
      );
    }
    
    if (!item.iv) {
      return NextResponse.json(
        { error: 'IV not found - item may be corrupted' },
        { status: 500 }
      );
    }
    
    // Download encrypted blob from S3 (server never decrypts)
    const encryptedBlob = await downloadEncryptedFile(item.s3Key);
    
    // Extract filename from S3 key (format: type/ownerId/itemId/filename)
    // The filename is the last part of the S3 key
    const s3KeyParts = item.s3Key.split('/');
    const originalFilename = s3KeyParts[s3KeyParts.length - 1] || item.title;
    
    // Use original filename if available, otherwise use title
    // If title doesn't have extension, try to preserve it from S3 key
    let downloadFilename = item.title;
    if (originalFilename && originalFilename !== 'encrypted-file') {
      // If title doesn't have extension but S3 key does, append it
      const originalExt = originalFilename.includes('.') 
        ? originalFilename.substring(originalFilename.lastIndexOf('.'))
        : '';
      const titleExt = item.title.includes('.')
        ? item.title.substring(item.title.lastIndexOf('.'))
        : '';
      
      if (originalExt && !titleExt) {
        downloadFilename = item.title + originalExt;
      } else if (originalFilename !== 'encrypted-file') {
        // Use original filename if it's meaningful
        downloadFilename = originalFilename;
      }
    }

    // Guess MIME type from filename extension
    let mimeType = 'application/octet-stream';
    if (downloadFilename.includes('.')) {
      const ext = downloadFilename.substring(downloadFilename.lastIndexOf('.') + 1).toLowerCase();
      const mimeTypes: Record<string, string> = {
        'pdf': 'application/pdf',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'txt': 'text/plain',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'zip': 'application/zip',
      };
      mimeType = mimeTypes[ext] || 'application/octet-stream';
    }
    
    // Return encrypted data + IV - client will decrypt
    // NOTE: Server never sees plaintext
    // Server only proxies encrypted blob from S3
    return NextResponse.json({
      encryptedBlob,
      iv: item.iv, // IV needed for decryption (not sensitive)
      metadata: {
        category: item.category,
        title: item.title,
        filename: downloadFilename,
        type: mimeType,
      },
      // NOTE: Server never decrypts
      // Client must decrypt using their key + IV
    });
  } catch (error) {
    console.error('Error downloading vault item:', error);
    return NextResponse.json(
      { error: 'Failed to download vault item' },
      { status: 500 }
    );
  }
}

