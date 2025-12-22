import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
import { randomUUID } from 'crypto';

/**
 * @route   GET /api/family/vaults
 * @desc    List family vaults for current user (as owner or member)
 * @access  Private
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = String(user.id);

  // Get vaults where user is owner or member
  const vaults = await prisma.familyVault.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { members: { some: { userId: userId, isActive: true } } },
      ],
    },
    include: {
      owner: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
      members: {
        where: { isActive: true },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
      },
      _count: {
        select: {
          items: true,
          members: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ vaults });
}

/**
 * @route   POST /api/family/vaults
 * @desc    Create a new family vault with Shared Master Key (SMK)
 * @access  Private
 * 
 * Expected payload:
 * {
 *   name: string,
 *   sharedMasterKey: string, // Plaintext SMK (hex string) - will be encrypted with owner's public key
 *   ownerPublicKey: string,  // Owner's RSA public key (PEM format)
 * }
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, sharedMasterKey, ownerPublicKey, encryptedPrivateKey } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Vault name is required' },
        { status: 400 }
      );
    }

    if (!sharedMasterKey) {
      return NextResponse.json(
        { error: 'Shared Master Key (SMK) is required' },
        { status: 400 }
      );
    }

    if (!ownerPublicKey) {
      return NextResponse.json(
        { error: 'Owner public key is required' },
        { status: 400 }
      );
    }

    const userId = String(user.id);

    // Create family vault
    const vault = await prisma.familyVault.create({
      data: {
        name: name.trim(),
        ownerId: userId,
        members: {
          create: {
            userId: userId,
            role: 'admin', // Owner is always admin
            publicKey: ownerPublicKey,
            encryptedSharedMasterKey: sharedMasterKey, // Client encrypts SMK with owner's public key before sending
            encryptedPrivateKey: encryptedPrivateKey || null, // Encrypted RSA private key (for cross-device support)
            acceptedAt: new Date(), // Owner is auto-accepted
            isActive: true,
          },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
              },
            },
          },
        },
        _count: {
          select: {
            items: true,
            members: true,
          },
        },
      },
    });

    // Log FamilyVault creation
    try {
      const now = new Date();
      await (prisma as any).activityLog.create({
        data: {
          userId,
          vaultType: 'family_vault',
          familyVaultId: vault.id,
          action: 'familyvault_created',
          description: 'Family vault created',
          ipAddress:
            req.headers.get('x-forwarded-for') ||
            req.headers.get('x-real-ip') ||
            null,
          userAgent: req.headers.get('user-agent') || null,
          metadata: {
            name: vault.name,
          },
          createdAt: now,
        },
      });
    } catch (logError) {
      console.error('Failed to log FamilyVault creation:', logError);
    }

    return NextResponse.json(
      {
        success: true,
        vault,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating family vault:', error);
    return NextResponse.json(
      { error: 'Failed to create family vault' },
      { status: 500 }
    );
  }
}
