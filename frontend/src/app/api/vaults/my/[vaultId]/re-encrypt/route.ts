import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
import { downloadEncryptedFile, uploadEncryptedFile } from '@/lib/api/s3';

/**
 * @route   POST /api/vaults/my/[vaultId]/re-encrypt
 * @desc    Re-encrypt all vault items with new vault key (background job)
 * @access  Private
 * 
 * This endpoint is called after recovery key reset to re-encrypt all items.
 * The client provides the new encrypted files, and we update them in S3.
 * 
 * Expected payload:
 * {
 *   items: Array<{
 *     itemId: string,
 *     newEncryptedBlob: string, // Base64 encrypted blob
 *     newIv: string,
 *   }>
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { vaultId } = await params;
    const userId = String(user.id);

    // Verify user owns the vault
    const myVault = await prisma.myVault.findFirst({
      where: { id: vaultId, ownerId: userId },
    });

    if (!myVault) {
      return NextResponse.json(
        { error: 'Vault not found or unauthorized' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { items } = body;

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Items array is required' },
        { status: 400 }
      );
    }

    // Re-encrypt each item
    const results = [];
    for (const item of items) {
      try {
        const { itemId, newEncryptedBlob, newIv } = item;

        // Get existing item
        const vaultItem = await prisma.vaultItem.findFirst({
          where: {
            id: itemId,
            myVaultId: vaultId,
          },
          select: { s3Key: true },
        });

        if (!vaultItem || !vaultItem.s3Key) {
          results.push({ itemId, success: false, error: 'Item not found or no file' });
          continue;
        }

        // Upload new encrypted file (overwrites existing)
        // uploadEncryptedFile expects base64 string, not Blob
        await uploadEncryptedFile(newEncryptedBlob, vaultItem.s3Key);

        // Update IV in database
        await prisma.vaultItem.update({
          where: { id: itemId },
          data: { iv: newIv },
        });

        results.push({ itemId, success: true });
      } catch (error) {
        console.error(`Error re-encrypting item ${item.itemId}:`, error);
        results.push({
          itemId: item.itemId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Vault items re-encrypted successfully',
      results,
    });
  } catch (error) {
    console.error('Error re-encrypting vault:', error);
    return NextResponse.json(
      { error: 'Failed to re-encrypt vault' },
      { status: 500 }
    );
  }
}

