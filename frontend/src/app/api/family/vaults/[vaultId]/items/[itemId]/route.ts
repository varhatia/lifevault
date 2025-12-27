import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
import { deleteEncryptedFile, uploadEncryptedFile, generateS3Key } from '@/lib/api/s3';

/**
 * @route   PUT /api/family/vaults/[vaultId]/items/[itemId]
 * @desc    Update item in family vault (Editor/Admin only)
 * @access  Private (Editor/Admin only)
 */
export async function PUT(
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

    // Verify user is editor or admin
    const membership = await prisma.familyMember.findFirst({
      where: {
        familyVaultId: vaultId,
        userId: userId,
        isActive: true,
      },
    });

    if (!membership || (membership.role !== 'admin' && membership.role !== 'editor')) {
      return NextResponse.json(
        { error: 'Only admins and editors can update items' },
        { status: 403 }
      );
    }

    // Verify item exists and belongs to this vault
    const existingItem = await prisma.familyVaultItem.findFirst({
      where: {
        id: itemId,
        familyVaultId: vaultId,
      },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { title, tags, encryptedBlob, iv, metadata, encryptedMetadata } = body;

    const updateData: any = {};
    
    // Update title if provided
    if (title !== undefined) {
      updateData.title = title;
    }
    
    // Update tags if provided
    if (tags !== undefined) {
      updateData.tags = tags;
    }

    // Update encrypted metadata if provided (zero-knowledge: server never sees plaintext)
    if (encryptedMetadata !== undefined) {
      updateData.encryptedData = encryptedMetadata 
        ? Buffer.from(encryptedMetadata) 
        : Buffer.from('');
    }

    // Update updatedBy
    updateData.updatedBy = userId;

    // If new file is provided, update the encrypted file
    if (encryptedBlob && iv) {
      // Delete old file if exists
      if (existingItem.s3Key) {
        try {
          await deleteEncryptedFile(existingItem.s3Key);
        } catch (error) {
          console.error('Error deleting old file from S3:', error);
        }
      }

      // Generate new S3 key
      const newS3Key = generateS3Key(
        vaultId,
        itemId,
        metadata?.name || existingItem.title || 'encrypted-file',
        'family'
      );

      // Upload new encrypted file
      await uploadEncryptedFile(encryptedBlob, newS3Key);
      updateData.s3Key = newS3Key;
      updateData.iv = iv;
    }

    // Update item in database
    const updatedItem = await prisma.familyVaultItem.update({
      where: { id: itemId },
      data: updateData,
    });

    // Log item update activity
    try {
      const now = new Date();
      await (prisma as any).activityLog.create({
        data: {
          userId,
          familyMemberId: membership.id,
          vaultType: 'family_vault',
          familyVaultId: vaultId,
          vaultItemId: itemId,
          action: 'item_updated',
          description: 'Family vault item updated',
          ipAddress:
            req.headers.get('x-forwarded-for') ||
            req.headers.get('x-real-ip') ||
            null,
          userAgent: req.headers.get('user-agent') || null,
          metadata: {
            category: updatedItem.category,
            title: updatedItem.title,
            hadFile: !!updatedItem.s3Key,
            updatedByRole: membership.role,
          },
          createdAt: now,
        },
      });
    } catch (logError) {
      console.error('Failed to log family vault item update activity:', logError);
    }

    return NextResponse.json({
      success: true,
      item: {
        id: updatedItem.id,
        category: updatedItem.category,
        title: updatedItem.title,
        tags: updatedItem.tags,
        createdAt: updatedItem.createdAt,
        updatedAt: updatedItem.updatedAt,
      }
    });
  } catch (error) {
    console.error('Error updating item:', error);
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    );
  }
}

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


