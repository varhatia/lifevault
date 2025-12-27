import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deleteEncryptedFile } from '@/lib/api/s3';
import { getUserFromRequest } from '@/lib/api/auth';

/**
 * @route   DELETE /api/vaults/my/:vaultId
 * @desc    Delete a MyVault and all its items, nominees, and S3 files
 * @access  Private (owner only)
 */
export async function DELETE(
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
    const vault = await prisma.myVault.findFirst({
      where: { id: vaultId, ownerId: userId },
      include: {
        _count: {
          select: {
            items: true,
            nominees: true,
          },
        },
        items: {
          select: {
            id: true,
            s3Key: true,
          },
        },
      },
    });

    if (!vault) {
      return NextResponse.json(
        { error: 'Vault not found or unauthorized' },
        { status: 404 }
      );
    }

    // Delete all S3 files for items in this vault
    const s3Keys = vault.items
      .map((item) => item.s3Key)
      .filter((key): key is string => key !== null);

    for (const s3Key of s3Keys) {
      try {
        await deleteEncryptedFile(s3Key);
      } catch (error) {
        console.error(`Error deleting S3 file ${s3Key}:`, error);
        // Continue with deletion even if S3 deletion fails
      }
    }

    // Delete the vault (cascades to items and nominees via Prisma)
    await prisma.myVault.delete({
      where: { id: vaultId },
    });

    // Log vault deletion
    try {
      const now = new Date();
      await (prisma as any).activityLog.create({
        data: {
          userId,
          vaultType: 'my_vault',
          myVaultId: vaultId,
          action: 'myvault_deleted',
          description: `Personal vault "${vault.name}" deleted`,
          ipAddress:
            req.headers.get('x-forwarded-for') ||
            req.headers.get('x-real-ip') ||
            null,
          userAgent: req.headers.get('user-agent') || null,
          metadata: {
            vaultName: vault.name,
            itemsCount: vault._count.items,
            nomineesCount: vault._count.nominees,
            s3FilesDeleted: s3Keys.length,
          },
          createdAt: now,
        },
      });
    } catch (logError) {
      console.error('Failed to log vault deletion:', logError);
    }

    return NextResponse.json({
      success: true,
      message: 'Vault deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting vault:', error);
    return NextResponse.json(
      { error: 'Failed to delete vault' },
      { status: 500 }
    );
  }
}

