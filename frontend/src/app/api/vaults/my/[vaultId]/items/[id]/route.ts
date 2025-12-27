import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deleteEncryptedFile, uploadEncryptedFile, generateS3Key } from '@/lib/api/s3';
import { getUserFromRequest } from '@/lib/api/auth';

/**
 * @route   PUT /api/vaults/my/[vaultId]/items/[id]
 * @desc    Update a vault item
 * @access  Private
 */
export async function PUT(
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

    // Verify item belongs to this vault
    const existingItem = await prisma.vaultItem.findFirst({
      where: { 
        id: itemId,
        myVaultId: vaultId,
      },
    });
    
    if (!existingItem) {
      return NextResponse.json(
        { error: 'Vault item not found' },
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
        'user'
      );

      // Upload new encrypted file
      await uploadEncryptedFile(encryptedBlob, newS3Key);
      updateData.s3Key = newS3Key;
      updateData.iv = iv;
    }

    // Update item in database
    const updatedItem = await prisma.vaultItem.update({
      where: { id: itemId },
      data: updateData,
    });

    // Log item update activity
    try {
      const now = new Date();
      await (prisma as any).activityLog.create({
        data: {
          userId,
          vaultType: 'my_vault',
          myVaultId: vaultId,
          vaultItemId: itemId,
          action: 'item_updated',
          description: 'Vault item updated',
          ipAddress:
            req.headers.get('x-forwarded-for') ||
            req.headers.get('x-real-ip') ||
            null,
          userAgent: req.headers.get('user-agent') || null,
          metadata: {
            category: updatedItem.category,
            title: updatedItem.title,
            hadFile: !!updatedItem.s3Key,
          },
          createdAt: now,
        },
      });
    } catch (logError) {
      console.error('Failed to log item update activity:', logError);
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
    console.error('Error updating vault item:', error);
    return NextResponse.json(
      { error: 'Failed to update vault item' },
      { status: 500 }
    );
  }
}

/**
 * @route   DELETE /api/vaults/my/:id
 * @desc    Delete a vault item
 * @access  Private
 */
export async function DELETE(
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

    // Find item to get S3 key and metadata for logging
    // Verify item belongs to this vault
    const item = await prisma.vaultItem.findFirst({
      where: { 
        id: itemId,
        myVaultId: vaultId,
      },
      select: { s3Key: true, id: true, category: true, title: true },
    });
    
    if (!item) {
      return NextResponse.json(
        { error: 'Vault item not found' },
        { status: 404 }
      );
    }
    
    // Delete encrypted file from S3
    if (item.s3Key) {
      try {
        await deleteEncryptedFile(item.s3Key);
      } catch (error) {
        console.error('Error deleting from S3:', error);
        // Continue with DB deletion even if S3 deletion fails
      }
    }
    
    // Delete metadata from database
    await prisma.vaultItem.delete({
      where: { id: itemId },
    });

    // Log item deletion activity
    try {
      const now = new Date();
      await (prisma as any).activityLog.create({
        data: {
          userId,
          vaultType: 'my_vault',
          myVaultId: vaultId,
          vaultItemId: itemId,
          action: 'item_deleted',
          description: 'Vault item deleted',
          ipAddress:
            req.headers.get('x-forwarded-for') ||
            req.headers.get('x-real-ip') ||
            null,
          userAgent: req.headers.get('user-agent') || null,
          metadata: {
            category: item.category,
            title: item.title,
            hadFile: !!item.s3Key,
          },
          createdAt: now,
        },
      });
    } catch (logError) {
      console.error('Failed to log item deletion activity:', logError);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting vault item:', error);
    return NextResponse.json(
      { error: 'Failed to delete vault item' },
      { status: 500 }
    );
  }
}

