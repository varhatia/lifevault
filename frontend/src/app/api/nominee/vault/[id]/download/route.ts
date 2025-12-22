import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { downloadEncryptedFile } from '@/lib/api/s3';
import { getNomineeSessionFromRequest } from '@/lib/api/auth';

/**
 * @route   GET /api/nominee/vault/:id/download
 * @desc    Download encrypted file for nominee (read-only)
 * @access  Nominee session (lv_nominee cookie)
 * 
 * Query params:
 * - type: "my_vault" | "family_vault"
 * - vaultId: string (required for family_vault)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getNomineeSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: itemId } = await params;
    const { searchParams } = new URL(req.url);
    const vaultType = searchParams.get('type') || 'my_vault';
    const vaultId = searchParams.get('vaultId');

    // Verify nominee has access
    const whereClause: any = {
      id: session.nomineeId,
      userId: session.userId,
      vaultType: vaultType as 'my_vault' | 'family_vault',
      isActive: true,
    };

    // For family vault, check familyVaultId; for my vault, check myVaultId
    if (vaultType === 'family_vault' && vaultId) {
      whereClause.familyVaultId = vaultId;
    } else if (vaultType === 'my_vault') {
      // For my vault, we can check myVaultId if provided, or just verify the nominee exists
    }

    const nominee = await prisma.nominee.findFirst({
      where: whereClause,
    });

    if (!nominee) {
      return NextResponse.json(
        { error: 'Nominee does not have access to this vault' },
        { status: 403 }
      );
    }

    let item: any = null;

    if (vaultType === 'family_vault' && vaultId) {
      // Find family vault item
      item = await prisma.familyVaultItem.findFirst({
        where: { id: itemId, familyVaultId: vaultId },
        select: { s3Key: true, category: true, title: true, iv: true },
      });
    } else {
      // Find my vault item - verify it belongs to a vault owned by the user
      item = await prisma.vaultItem.findFirst({
        where: { 
          id: itemId,
          myVault: {
            ownerId: session.userId,
          },
        },
        select: { s3Key: true, category: true, title: true, iv: true },
      });
    }

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

    // Log nominee download in owner's activity log
    try {
      const now = new Date();
      await (prisma as any).activityLog.create({
        data: {
          userId: session.userId,
          vaultType,
          myVaultId: vaultType === 'my_vault' ? nominee.myVaultId : null,
          familyVaultId: vaultType === 'family_vault' ? vaultId : null,
          action: 'nominee_item_downloaded',
          description: 'Nominee downloaded vault item',
          ipAddress:
            req.headers.get('x-forwarded-for') ||
            req.headers.get('x-real-ip') ||
            null,
          userAgent: req.headers.get('user-agent') || null,
          metadata: {
            nomineeId: session.nomineeId,
            itemId,
            filename: downloadFilename,
          },
          createdAt: now,
        },
      });
    } catch (logError) {
      console.error('Failed to log nominee item download:', logError);
    }

    // Return encrypted data + IV - client will decrypt
    return NextResponse.json({
      encryptedBlob,
      iv: item.iv,
      metadata: {
        category: item.category,
        title: item.title,
        filename: downloadFilename,
      },
      readOnly: true,
    });
  } catch (error) {
    console.error('Error downloading nominee vault item:', error);
    return NextResponse.json(
      { error: 'Failed to download nominee vault item' },
      { status: 500 }
    );
  }
}


