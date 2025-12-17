import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';

/**
 * @route   PUT /api/vaults/my/[vaultId]/keys
 * @desc    Store verifier and recovery key encrypted vault key for cross-device access
 * @access  Private
 * 
 * Expected payload:
 * {
 *   masterPasswordVerifier?: string, // JSON string of EncryptedPayload
 *   masterPasswordEncryptedVaultKey?: string, // JSON string of EncryptedPayload (encrypted with master password)
 *   recoveryKeyEncryptedVaultKey?: string, // JSON string of EncryptedPayload
 * }
 */
export async function PUT(
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
    const body = await req.json();
    const { masterPasswordVerifier, masterPasswordEncryptedVaultKey, recoveryKeyEncryptedVaultKey } = body;

    // Verify user owns the vault
    const vault = await prisma.myVault.findFirst({
      where: {
        id: vaultId,
        ownerId: userId,
      },
    });

    if (!vault) {
      return NextResponse.json(
        { error: 'Vault not found or unauthorized' },
        { status: 404 }
      );
    }

    // Update vault with verifier and/or encrypted vault keys
    const updateData: any = {};
    if (masterPasswordVerifier !== undefined) {
      updateData.masterPasswordVerifier = masterPasswordVerifier;
    }
    if (masterPasswordEncryptedVaultKey !== undefined) {
      updateData.masterPasswordEncryptedVaultKey = masterPasswordEncryptedVaultKey;
    }
    if (recoveryKeyEncryptedVaultKey !== undefined) {
      updateData.recoveryKeyEncryptedVaultKey = recoveryKeyEncryptedVaultKey;
      updateData.recoveryKeyGeneratedAt = new Date();
    }

    await prisma.myVault.update({
      where: { id: vaultId },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error storing vault keys:', error);
    return NextResponse.json(
      { error: 'Failed to store vault keys' },
      { status: 500 }
    );
  }
}

/**
 * @route   GET /api/vaults/my/[vaultId]/keys
 * @desc    Get verifier and recovery key encrypted vault key for cross-device unlock
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

    // Verify user owns the vault
    const vault = await prisma.myVault.findFirst({
      where: {
        id: vaultId,
        ownerId: userId,
      },
      select: {
        id: true,
        masterPasswordVerifier: true,
        masterPasswordEncryptedVaultKey: true,
        recoveryKeyEncryptedVaultKey: true,
        recoveryKeyGeneratedAt: true,
      },
    });

    if (!vault) {
      return NextResponse.json(
        { error: 'Vault not found or unauthorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      masterPasswordVerifier: vault.masterPasswordVerifier,
      masterPasswordEncryptedVaultKey: vault.masterPasswordEncryptedVaultKey,
      recoveryKeyEncryptedVaultKey: vault.recoveryKeyEncryptedVaultKey,
      recoveryKeyGeneratedAt: vault.recoveryKeyGeneratedAt,
    });
  } catch (error) {
    console.error('Error fetching vault keys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vault keys' },
      { status: 500 }
    );
  }
}

