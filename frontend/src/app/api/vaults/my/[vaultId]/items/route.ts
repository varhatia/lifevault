import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { uploadEncryptedFile, generateS3Key } from '@/lib/api/s3';
import { randomUUID } from 'crypto';
import { getUserFromRequest } from '@/lib/api/auth';

/**
 * @route   GET /api/vaults/my/[vaultId]/items
 * @desc    List items in a specific MyVault
 * @access  Private
 */
export async function GET(
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
    
    // Verify vault exists
    const vault = await prisma.myVault.findFirst({
      where: { id: vaultId },
    });
    
    if (!vault) {
      return NextResponse.json(
        { error: 'Vault not found or access denied' },
        { status: 404 }
      );
    }

    // Check if user is owner or member
    const isOwner = vault.ownerId === userId;
    if (!isOwner) {
      const membership = await prisma.myVaultMember.findFirst({
        where: {
          myVaultId: vaultId,
          userId: userId,
          isActive: true,
        },
      });
      
      if (!membership) {
        return NextResponse.json(
          { error: 'Vault not found or access denied' },
          { status: 404 }
        );
      }
    }
    
    // Fetch items with creator information
    // Use type assertion to work around TypeScript cache issues with Prisma client
    const items = await (prisma.vaultItem.findMany as any)({
      where: { 
        myVaultId: vaultId,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        category: true,
        title: true,
        tags: true,
        s3Key: true,
        iv: true,
        encryptedData: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
      },
    });
    
    // Fetch creators for all items in a single query
    const creatorIds = [...new Set(items.map((item: any) => item.createdBy).filter(Boolean))] as string[];
    let creatorMap = new Map();
    
    if (creatorIds.length > 0) {
      const creators = await prisma.user.findMany({
        where: {
          id: { in: creatorIds },
        },
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      });
      creatorMap = new Map(creators.map(c => [c.id, c]));
    }
    
    // Convert encryptedData Buffer to base64 string for transmission
    // The Buffer contains a JSON string, so we convert it to base64 for transmission
    const itemsWithEncryptedMetadata = items.map((item: any) => {
      const { encryptedData, createdBy, ...rest } = item;
      try {
        return {
          ...rest,
          encryptedMetadata: encryptedData && Buffer.isBuffer(encryptedData) && encryptedData.length > 0
            ? encryptedData.toString('base64')
            : null,
          creator: createdBy ? (creatorMap.get(createdBy) || null) : null, // Get creator from map
        };
      } catch (error) {
        console.error('Error converting encryptedData to base64:', error, item.id);
        return {
          ...rest,
          encryptedMetadata: null,
          creator: createdBy ? (creatorMap.get(createdBy) || null) : null,
        };
      }
    });
    
    return NextResponse.json({ items: itemsWithEncryptedMetadata });
  } catch (error) {
    console.error('Error fetching vault items:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', errorMessage);
    return NextResponse.json(
      { error: `Failed to fetch vault items: ${errorMessage}` },
      { status: 500 }
    );
  }
}

/**
 * @route   POST /api/vaults/my/[vaultId]/items
 * @desc    Create a new vault item in a specific MyVault
 * @access  Private
 * 
 * Expected payload:
 * {
 *   category: string,
 *   title: string,
 *   tags?: string[],
 *   encryptedBlob: string,  // Base64 encoded encrypted file/data
 *   iv: string,             // Initialization vector
 *   metadata?: {            // File metadata (name, type, size)
 *     name: string,
 *     type: string,
 *     size: number
 *   }
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
    
    // Verify vault exists
    const vault = await prisma.myVault.findFirst({
      where: { id: vaultId },
    });
    
    if (!vault) {
      return NextResponse.json(
        { error: 'Vault not found or access denied' },
        { status: 404 }
      );
    }

    // Check if user is owner or member
    const isOwner = vault.ownerId === userId;
    if (!isOwner) {
      const membership = await prisma.myVaultMember.findFirst({
        where: {
          myVaultId: vaultId,
          userId: userId,
          isActive: true,
        },
        select: { role: true },
      });
      
      if (!membership) {
        return NextResponse.json(
          { error: 'Vault not found or access denied' },
          { status: 404 }
        );
      }
      
      // Only admin and editor can create items
      if (!['admin', 'editor'].includes(membership.role)) {
        return NextResponse.json(
          { error: 'You do not have permission to add items to this vault' },
          { status: 403 }
        );
      }
    }
    
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body as JSON:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    const { category, title, tags = [], encryptedBlob, iv, metadata, encryptedMetadata } = body;
    
    // Validate required fields
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
      s3Key = generateS3Key(
        vaultId,
        itemId,
        metadata?.name || 'encrypted-file',
        'user' // Use 'user' type for MyVault
      );
      
      // Upload encrypted blob to S3 (server never decrypts)
      await uploadEncryptedFile(encryptedBlob, s3Key);
    }
    
    // Store only metadata in database (NO encrypted data in DB)
    const now = new Date();

    // Store encrypted metadata in encryptedData field (zero-knowledge: server never sees plaintext)
    // encryptedMetadata is a JSON string containing {iv, ciphertext}, we store it as bytes
    const encryptedDataBuffer = encryptedMetadata 
      ? Buffer.from(encryptedMetadata) 
      : Buffer.from('');

    // Use type assertion to work around TypeScript cache issues with Prisma client
    const vaultItem = await (prisma.vaultItem.create as any)({
      data: {
        id: itemId,
        myVaultId: vaultId,
        category,
        title,
        tags,
        s3Key,
        iv: iv || null, // IV is only required if file is provided
        encryptedData: encryptedDataBuffer, // Encrypted metadata fields (zero-knowledge)
        createdBy: userId, // Track who created the item (owner or member)
      },
    });

    // Log item upload activity (zero-knowledge: reference ids and metadata only)
    try {
      // Cast prisma to any here to avoid type mismatch if generated types are stale
      // Runtime model name is activityLog, matching ActivityLog in schema
      await (prisma as any).activityLog.create({
        data: {
          userId,
          vaultType: 'my_vault',
          myVaultId: vaultId,
          vaultItemId: vaultItem.id,
          action: 'item_uploaded',
          description: 'Item uploaded to My Vault',
          ipAddress:
            req.headers.get('x-forwarded-for') ||
            req.headers.get('x-real-ip') ||
            null,
          userAgent: req.headers.get('user-agent') || null,
          metadata: {
            category,
            hasFile: !!s3Key,
          },
          createdAt: now,
        },
      });
    } catch (logError) {
      console.error('Failed to log MyVault item upload:', logError);
    }
    
    return NextResponse.json({
      id: vaultItem.id,
      category: vaultItem.category,
      title: vaultItem.title,
      tags: vaultItem.tags,
      createdAt: vaultItem.createdAt,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating vault item:', error);
    return NextResponse.json(
      { error: 'Failed to create vault item' },
      { status: 500 }
    );
  }
}
