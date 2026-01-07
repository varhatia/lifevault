import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';

/**
 * @route   GET /api/account/vaults/security
 * @desc    Get per-vault security information (master password and recovery key tracking)
 * @access  Private
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch all vaults owned by the user
    const vaults = await prisma.myVault.findMany({
      where: {
        ownerId: user.id,
      },
      select: {
        id: true,
        name: true,
        masterPasswordLastChanged: true,
        recoveryKeyGeneratedAt: true,
        createdAt: true,
        masterPasswordVerifier: true,
        recoveryKeyEncryptedVaultKey: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const now = Date.now();

    // Format vault security information
    const vaultsSecurity = vaults.map((vault) => {
      const masterPasswordLastChanged = vault.masterPasswordLastChanged
        ? new Date(vault.masterPasswordLastChanged).getTime()
        : null;
      const recoveryKeyGeneratedAt = vault.recoveryKeyGeneratedAt
        ? new Date(vault.recoveryKeyGeneratedAt).getTime()
        : null;

      const daysSinceMasterPasswordChange = masterPasswordLastChanged
        ? Math.floor((now - masterPasswordLastChanged) / (1000 * 60 * 60 * 24))
        : null;
      const daysSinceRecoveryKeyGeneration = recoveryKeyGeneratedAt
        ? Math.floor((now - recoveryKeyGeneratedAt) / (1000 * 60 * 60 * 24))
        : null;

      return {
        vaultId: vault.id,
        vaultName: vault.name,
        masterPassword: {
          hasVerifier: !!vault.masterPasswordVerifier,
          lastChanged: vault.masterPasswordLastChanged?.toISOString() || null,
          daysSinceChange: daysSinceMasterPasswordChange,
          needsRotation: daysSinceMasterPasswordChange !== null && daysSinceMasterPasswordChange > 180,
        },
        recoveryKey: {
          hasRecoveryKey: !!vault.recoveryKeyEncryptedVaultKey,
          generatedAt: vault.recoveryKeyGeneratedAt?.toISOString() || null,
          daysSinceGeneration: daysSinceRecoveryKeyGeneration,
          needsRotation: daysSinceRecoveryKeyGeneration !== null && daysSinceRecoveryKeyGeneration > 180,
        },
        createdAt: vault.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      vaults: vaultsSecurity,
    });
  } catch (error) {
    console.error('Error fetching vault security:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vault security information' },
      { status: 500 }
    );
  }
}

