import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
import { downloadEncryptedFile } from '@/lib/api/s3';

/**
 * @route   GET /api/family/vaults/[vaultId]/items/[itemId]/download
 * @desc    Download encrypted file from S3 for family vault item
 * @access  Private (must be member of vault)
 * 
 * Returns encrypted blob - client must decrypt it
 * Server never decrypts the data
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string; itemId: string }> }
) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { vaultId, itemId } = await params;
    const userId = String(user.id);

    // Verify user is a member of this vault
    const membership = await prisma.familyMember.findFirst({
      where: {
        familyVaultId: vaultId,
        userId: userId,
        isActive: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'You are not a member of this vault' },
        { status: 403 }
      );
    }

    // Find item to get S3 key and IV
    // Verify item belongs to this vault
    const item = await prisma.familyVaultItem.findFirst({
      where: {
        id: itemId,
        familyVaultId: vaultId,
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
      const originalExt = originalFilename.substring(originalFilename.lastIndexOf('.'));
      if (originalExt && !item.title.includes('.')) {
        downloadFilename = item.title + originalExt;
      } else if (originalFilename !== item.title) {
        downloadFilename = originalFilename;
      }
    }

    // Try to detect MIME type from extension
    const ext = downloadFilename.substring(downloadFilename.lastIndexOf('.')).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain',
    };
    const mimeType = mimeTypes[ext] || 'application/octet-stream';

    const now = new Date();

    // Log family vault item download
    try {
      await prisma.activityLog.create({
        data: {
          userId,
          vaultType: 'family_vault',
          familyVaultId: vaultId,
          vaultItemId: itemId,
          action: 'item_downloaded',
          description: 'Item downloaded from Family Vault',
          ipAddress:
            req.headers.get('x-forwarded-for') ||
            req.headers.get('x-real-ip') ||
            null,
          userAgent: req.headers.get('user-agent') || null,
          metadata: {
            category: item.category,
            filename: downloadFilename,
            role: membership.role,
          },
          createdAt: now,
        },
      });
    } catch (logError) {
      console.error('Failed to log FamilyVault item download:', logError);
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
    console.error('Error downloading family vault item:', error);
    return NextResponse.json(
      { error: 'Failed to download vault item' },
      { status: 500 }
    );
  }
}

