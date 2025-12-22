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
    
    // Verify user owns this vault
    const vault = await prisma.myVault.findFirst({
      where: {
        id: vaultId,
        ownerId: userId,
      },
    });
    
    if (!vault) {
      return NextResponse.json(
        { error: 'Vault not found or access denied' },
        { status: 404 }
      );
    }
    
    const items = await prisma.vaultItem.findMany({
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
        createdAt: true,
        updatedAt: true,
      },
    });
    
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error fetching vault items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vault items' },
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
    
    // Verify user owns this vault
    const vault = await prisma.myVault.findFirst({
      where: {
        id: vaultId,
        ownerId: userId,
      },
    });
    
    if (!vault) {
      return NextResponse.json(
        { error: 'Vault not found or access denied' },
        { status: 404 }
      );
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
    const { category, title, tags = [], encryptedBlob, iv, metadata } = body;
    
    // Validate required fields
    if (!category || !title || !encryptedBlob || !iv) {
      return NextResponse.json(
        { error: 'Missing required fields: category, title, encryptedBlob, iv' },
        { status: 400 }
      );
    }
    
    // Generate unique item ID
    const itemId = randomUUID();
    
    // Generate S3 key for encrypted file
    const s3Key = generateS3Key(
      vaultId,
      itemId,
      metadata?.name || 'encrypted-file',
      'user' // Use 'user' type for MyVault
    );
    
    // Upload encrypted blob to S3 (server never decrypts)
    await uploadEncryptedFile(encryptedBlob, s3Key);
    
    // Store only metadata in database (NO encrypted data in DB)
    const now = new Date();

    const vaultItem = await prisma.vaultItem.create({
      data: {
        id: itemId,
        myVaultId: vaultId,
        category,
        title,
        tags,
        s3Key,
        iv,
        encryptedData: Buffer.from(''), // Empty - data is in S3 only
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
