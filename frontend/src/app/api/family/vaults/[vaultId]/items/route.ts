import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
import { uploadEncryptedFile, generateS3Key } from '@/lib/api/s3';
import { randomUUID } from 'crypto';

/**
 * @route   GET /api/family/vaults/[vaultId]/items
 * @desc    List items in a family vault (read-only for viewers, full access for editors/admins)
 * @access  Private (must be member)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { vaultId } = await params;
    const userId = String(user.id);

    // Verify user is a member
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

    // Get items
    const items = await prisma.familyVaultItem.findMany({
      where: {
        familyVaultId: vaultId,
      },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        updater: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        category: true,
        title: true,
        tags: true,
        s3Key: true,
        iv: true,
        encryptedData: true, // Include encrypted metadata for client-side decryption
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        updatedBy: true,
        creator: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        updater: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    // Convert encryptedData Buffer to base64 string for transmission
    const itemsWithEncryptedMetadata = items.map(item => {
      const { encryptedData, ...rest } = item;
      return {
        ...rest,
        encryptedMetadata: encryptedData && encryptedData.length > 0
          ? encryptedData.toString('base64')
          : null,
      };
    });

    return NextResponse.json({
      items: itemsWithEncryptedMetadata,
      userRole: membership.role,
      canEdit: membership.role === 'admin' || membership.role === 'editor',
      canDelete: membership.role === 'admin',
    });
  } catch (error) {
    console.error('Error fetching vault items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vault items' },
      { status: 500 }
    );
  }
}

/**
 * @route   POST /api/family/vaults/[vaultId]/items
 * @desc    Add item to family vault (Editor/Admin only)
 * @access  Private (Editor/Admin only)
 * 
 * Expected payload:
 * {
 *   category: string,
 *   title: string,
 *   tags: string[],
 *   encryptedBlob: string, // Encrypted file/data (base64) - encrypted with SMK client-side
 *   iv: string,            // Initialization vector (base64)
 *   metadata?: { name: string, type: string, size: number }
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { vaultId } = await params;
    const userId = String(user.id);

    // Verify user is editor or admin
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

    if (membership.role === 'viewer') {
      return NextResponse.json(
        { error: 'Viewers cannot add items' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { category, title, tags = [], encryptedBlob, iv, metadata, encryptedMetadata } = body;

    // Validation
    if (!category || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: category, title' },
        { status: 400 }
      );
    }

    // File is optional - only process if provided
    const hasFile = encryptedBlob && iv;

    // Generate unique item ID
    const itemId = randomUUID();

    let s3Key: string | null = null;

    // Only upload to S3 if file is provided
    if (hasFile) {
      // Generate S3 key for encrypted file
      s3Key = generateS3Key(vaultId, itemId, metadata?.name || 'encrypted-file', 'family');

      // Upload encrypted blob to S3 (server never decrypts)
      await uploadEncryptedFile(encryptedBlob, s3Key);
    }

    // Store metadata in database
    const now = new Date();

    // Store encrypted metadata in encryptedData field (zero-knowledge: server never sees plaintext)
    // encryptedMetadata is a JSON string containing {iv, ciphertext}, we store it as bytes
    const encryptedDataBuffer = encryptedMetadata 
      ? Buffer.from(encryptedMetadata) 
      : Buffer.from('');

    const item = await prisma.familyVaultItem.create({
      data: {
        id: itemId,
        familyVaultId: vaultId,
        category,
        title,
        tags,
        s3Key,
        iv: iv || null, // IV is only required if file is provided
        encryptedData: encryptedDataBuffer, // Encrypted metadata fields (zero-knowledge)
        createdBy: userId,
      },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    // Log family vault item upload with member context
    try {
      await prisma.activityLog.create({
        data: {
          userId,
          // family member id is optional; we can log just userId and familyVaultId
          vaultType: 'family_vault',
          familyVaultId: vaultId,
          vaultItemId: item.id,
          action: 'item_uploaded',
          description: 'Item uploaded to Family Vault',
          ipAddress:
            req.headers.get('x-forwarded-for') ||
            req.headers.get('x-real-ip') ||
            null,
          userAgent: req.headers.get('user-agent') || null,
          metadata: {
            category,
            hasFile: !!s3Key,
            role: membership.role,
          },
          createdAt: now,
        },
      });
    } catch (logError) {
      console.error('Failed to log FamilyVault item upload:', logError);
    }

    return NextResponse.json(
      {
        success: true,
        item,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error adding vault item:', error);
    return NextResponse.json(
      { error: 'Failed to add vault item' },
      { status: 500 }
    );
  }
}


