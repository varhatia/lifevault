import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { uploadEncryptedFile, generateS3Key } from '@/lib/api/s3';
import { randomUUID } from 'crypto';
import { getUserFromRequest } from '@/lib/api/auth';
import { canUploadFile, SubscriptionPlan, bytesToMB } from '@/lib/plan-limits';

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
      
      // All members can create items (role system removed)
      // Members have full access except adding members/nominees
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
    let fileSizeMB: number | undefined;
    
    // Check storage limits if file is provided
    if (hasFile) {
      const plan = ((user as any).subscriptionPlan || "free") as SubscriptionPlan;
      
      // Calculate current storage usage
      const myVaultIds = await prisma.myVault.findMany({
        where: { ownerId: userId },
        select: { id: true },
      });

      const myVaultItems = await prisma.vaultItem.findMany({
        where: {
          myVaultId: { in: myVaultIds.map(v => v.id) },
          s3Key: { not: null },
        },
        select: { s3Key: true },
      });

      // Calculate encrypted blob size (base64 encoded)
      // Base64 size = (original_size * 4/3) + encryption overhead
      // For simplicity, we'll use the base64 string length to estimate
      const encryptedBlobSizeBytes = Buffer.from(encryptedBlob, 'base64').length;
      fileSizeMB = bytesToMB(encryptedBlobSizeBytes);

      // Get current storage usage from usage API logic
      // For now, we'll fetch current usage
      const usageRes = await fetch(`${req.nextUrl.origin}/api/user/usage`, {
        headers: {
          'Cookie': req.headers.get('cookie') || '',
        },
      });

      let currentStorageMB = 0;
      if (usageRes.ok) {
        const usageData = await usageRes.json();
        currentStorageMB = usageData.usage?.storageUsedMB || 0;
      }

      if (!canUploadFile(plan, currentStorageMB, fileSizeMB)) {
        return NextResponse.json(
          {
            error: 'Storage limit reached',
            limitReached: true,
            limitType: 'storage',
            currentStorageMB,
            fileSizeMB,
            maxAllowedMB: plan === "free" ? 5 : Infinity,
            message: `File size (${fileSizeMB.toFixed(2)} MB) would exceed your storage limit. Free plan includes 5 MB storage. Please upgrade to LivPeace Plus for unlimited storage.`,
          },
          { status: 403 }
        );
      }
    }
    
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

    // Log item upload activity using enhanced audit system
    try {
      const { extractAuditContext, logDataModification, createAuditTimer } = await import('@/lib/api/audit');
      const timer = createAuditTimer();
      
      const auditContext = extractAuditContext(req, userId, {
        vaultType: 'my_vault',
        vaultId: vaultId,
        vaultItemId: vaultItem.id,
      });

      const auditMetadata: Record<string, any> = {
        category,
        hasFile: !!s3Key,
        isOwner: isOwner,
      };

      // Add file size if file was uploaded
      if (fileSizeMB !== undefined) {
        auditMetadata.fileSizeMB = fileSizeMB;
      }

      await logDataModification(
        auditContext,
        'item_uploaded',
        'vault_item',
        vaultItem.id,
        {
          description: 'Item uploaded to My Vault',
          outcome: 'success',
          metadata: {
            ...auditMetadata,
            durationMs: timer.end(),
          },
        }
      );
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
