import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';

/**
 * @route   POST /api/vaults/my/[vaultId]/recovery-key
 * @desc    Store recovery key encrypted vault key for a member
 * @access  Private (member must be logged in)
 * 
 * Expected payload:
 * {
 *   recoveryKeyEncryptedKey: string, // Vault key encrypted with recovery key (JSON string)
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

    // Check if user is owner or member
    const vault = await prisma.myVault.findUnique({
      where: { id: vaultId },
    });

    if (!vault) {
      return NextResponse.json(
        { error: 'Vault not found' },
        { status: 404 }
      );
    }

    const isOwner = vault.ownerId === userId;
    const membership = await prisma.myVaultMember.findFirst({
      where: {
        myVaultId: vaultId,
        userId: userId,
        isActive: true,
      },
    });

    if (!isOwner && !membership) {
      return NextResponse.json(
        { error: 'You are not a member of this vault' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { recoveryKeyEncryptedKey } = body;

    if (!recoveryKeyEncryptedKey) {
      return NextResponse.json(
        { error: 'Recovery key encrypted key is required' },
        { status: 400 }
      );
    }

    // If user is a member (not owner), update member's recovery key
    if (membership) {
      await prisma.myVaultMember.update({
        where: { id: membership.id },
        data: {
          recoveryKeyEncryptedSMK: recoveryKeyEncryptedKey,
          recoveryKeyGeneratedAt: new Date(),
        },
      });
    } else {
      // If user is owner, update vault's recovery key (stored at vault level)
      await prisma.myVault.update({
        where: { id: vaultId },
        data: {
          recoveryKeyEncryptedVaultKey: recoveryKeyEncryptedKey,
          recoveryKeyGeneratedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Recovery key stored successfully',
    });
  } catch (error) {
    console.error('Error storing recovery key:', error);
    return NextResponse.json(
      { error: 'Failed to store recovery key' },
      { status: 500 }
    );
  }
}

