import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
// Removed unused imports - we verify membership directly

/**
 * @route   POST /api/vaults/family/[vaultId]/recovery-reset
 * @desc    Reset master password and recovery key after recovery key unlock for Family Vault
 * @access  Private (Any member can reset their own recovery key)
 * 
 * Expected payload:
 * {
 *   newRecoveryKeyEncryptedKey: string, // SMK encrypted with new recovery key
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

    const body = await req.json();
    const { newRecoveryKeyEncryptedKey, newEncryptedPrivateKey, newPublicKey, newEncryptedSMK } = body;

    if (!newRecoveryKeyEncryptedKey) {
      return NextResponse.json(
        { error: 'New recovery key encrypted key is required' },
        { status: 400 }
      );
    }

    // Find the FamilyMember record for this user and vault
    // Any member (admin, editor, viewer) can reset their own recovery key
    const familyMember = await prisma.familyMember.findUnique({
      where: {
        familyVaultId_userId: {
          familyVaultId: vaultId,
          userId: userId,
        },
      },
      include: {
        familyVault: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!familyMember) {
      return NextResponse.json(
        { error: 'Vault not found or unauthorized. You must be a member of this vault to reset your recovery key.' },
        { status: 404 }
      );
    }

    if (!familyMember.isActive) {
      return NextResponse.json(
        { error: 'Your membership in this vault is not active.' },
        { status: 403 }
      );
    }

    // Update FamilyMember's recovery key encrypted SMK and encrypted private key (per-member, per-vault)
    // This ensures isolation: each member has their own recovery key for each vault
    const updateData: any = {
      recoveryKeyEncryptedSMK: newRecoveryKeyEncryptedKey,
      recoveryKeyGeneratedAt: new Date(),
    };

    // If new encrypted private key is provided, update it (encrypted with new master password)
    if (newEncryptedPrivateKey) {
      updateData.encryptedPrivateKey = newEncryptedPrivateKey;
    }

    // If new public key and encrypted SMK are provided (new RSA key pair generated),
    // update them on the server
    if (newPublicKey && newEncryptedSMK) {
      updateData.publicKey = newPublicKey;
      updateData.encryptedSharedMasterKey = newEncryptedSMK;
    }

    await prisma.familyMember.update({
      where: {
        id: familyMember.id,
      },
      data: updateData,
    });

    // Invalidate only nominees added by this user for this vault (mark as inactive)
    // Each member manages their own nominees, so only invalidate the current user's nominees
    await prisma.nominee.updateMany({
      where: {
        familyVaultId: vaultId,
        userId: userId, // Only invalidate nominees added by this user
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Return success
    return NextResponse.json({
      success: true,
      message: 'Master password and recovery key reset successfully. Old nominee keys have been invalidated.',
      vaultId,
    });
  } catch (error) {
    console.error('Error resetting recovery key for family vault:', error);
    return NextResponse.json(
      { error: 'Failed to reset recovery key' },
      { status: 500 }
    );
  }
}

