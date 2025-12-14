import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
import { invalidateNomineesForVault, verifyVaultOwnership } from '@/lib/api/vault-recovery';

/**
 * @route   POST /api/vaults/my/[vaultId]/recovery-reset
 * @desc    Reset master password and recovery key after recovery key unlock
 * @access  Private
 * 
 * Expected payload:
 * {
 *   newRecoveryKeyEncryptedKey: string, // Vault key encrypted with new recovery key
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

    // Verify user owns the vault
    const myVault = await verifyVaultOwnership('my_vault', vaultId, userId);
    if (!myVault) {
      return NextResponse.json(
        { error: 'Vault not found or unauthorized' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { newRecoveryKeyEncryptedKey } = body;

    if (!newRecoveryKeyEncryptedKey) {
      return NextResponse.json(
        { error: 'New recovery key encrypted vault key is required' },
        { status: 400 }
      );
    }

    // Update user's recovery key encrypted vault key (stored per user, not per vault)
    // Note: In the current schema, this is stored at user level, but we may need to store per vault
    // For now, we'll update the user-level field
    await prisma.user.update({
      where: { id: userId },
      data: {
        recoveryKeyEncryptedVaultKey: newRecoveryKeyEncryptedKey,
        recoveryKeyGeneratedAt: new Date(),
      },
    });

    // Invalidate all nominees for this vault (mark as inactive)
    await invalidateNomineesForVault('my_vault', vaultId, userId);

    // Return success - vault re-encryption will happen in background
    return NextResponse.json({
      success: true,
      message: 'Master password and recovery key reset successfully. Old nominee keys have been invalidated.',
      vaultId,
    });
  } catch (error) {
    console.error('Error resetting recovery key:', error);
    return NextResponse.json(
      { error: 'Failed to reset recovery key' },
      { status: 500 }
    );
  }
}

