import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
import { deleteEncryptedFile } from '@/lib/api/s3';

/**
 * @route   DELETE /api/family/vaults/[vaultId]/items/[itemId]
 * @desc    Delete item from family vault (Admin only)
 * @access  Private (Admin only)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string; itemId: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { vaultId, itemId } = await params;
    const userId = String(user.id);

    // Verify user is admin or editor (can delete items)
    const membership = await prisma.familyMember.findFirst({
      where: {
        familyVaultId: vaultId,
        userId: userId,
        isActive: true,
      },
    });

    if (!membership || (membership.role !== 'admin' && membership.role !== 'editor')) {
      return NextResponse.json(
        { error: 'Only admins and editors can delete items' },
        { status: 403 }
      );
    }

    // Get item to delete (include metadata for logging)
    const item = await prisma.familyVaultItem.findFirst({
      where: {
        id: itemId,
        familyVaultId: vaultId,
      },
      select: {
        id: true,
        s3Key: true,
        category: true,
        title: true,
        createdBy: true,
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // Delete from S3 if exists
    if (item.s3Key) {
      try {
        await deleteEncryptedFile(item.s3Key);
      } catch (error) {
        console.error('Error deleting file from S3:', error);
        // Continue with DB deletion even if S3 deletion fails
      }
    }

    // Delete from database
    await prisma.familyVaultItem.delete({
      where: { id: itemId },
    });

    // Log item deletion activity (for the user who deleted it)
    try {
      const now = new Date();
      await (prisma as any).activityLog.create({
        data: {
          userId,
          familyMemberId: membership.id,
          vaultType: 'family_vault',
          familyVaultId: vaultId,
          vaultItemId: itemId,
          action: 'item_deleted',
          description: 'Family vault item deleted',
          ipAddress:
            req.headers.get('x-forwarded-for') ||
            req.headers.get('x-real-ip') ||
            null,
          userAgent: req.headers.get('user-agent') || null,
          metadata: {
            category: item.category,
            title: item.title,
            hadFile: !!item.s3Key,
            deletedByRole: membership.role,
            originalCreatorId: item.createdBy,
          },
          createdAt: now,
        },
      });
    } catch (logError) {
      console.error('Failed to log family vault item deletion activity:', logError);
    }

    return NextResponse.json({
      success: true,
      message: 'Item deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting item:', error);
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    );
  }
}


