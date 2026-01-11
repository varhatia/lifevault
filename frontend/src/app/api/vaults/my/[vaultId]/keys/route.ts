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

    // Log vault keys fetch as a vault unlock attempt (via master password)
    try {
      const now = new Date();
      await (prisma as any).activityLog.create({
        data: {
          userId,
          vaultType: 'my_vault',
          myVaultId: vault.id,
          action: 'myvault_unlocked',
          description: 'Vault unlocked via master password - keys fetched',
          ipAddress:
            req.headers.get('x-forwarded-for') ||
            req.headers.get('x-real-ip') ||
            null,
          userAgent: req.headers.get('user-agent') || null,
          metadata: {
            severity: 'info',
            outcome: 'success',
            unlockMethod: 'master_password',
            hasVerifier: !!vault.masterPasswordVerifier,
            hasRecoveryKey: !!vault.recoveryKeyEncryptedVaultKey,
          },
          createdAt: now,
        },
      });
    } catch (logError) {
      console.error('Failed to log MyVault unlock activity:', logError);
    }

    // Update vault with verifier and/or encrypted vault keys
    const updateData: any = {};
    const isMasterPasswordReset = masterPasswordVerifier !== undefined;
    const isRecoveryKeyUpdate = recoveryKeyEncryptedVaultKey !== undefined;
    
    if (masterPasswordVerifier !== undefined) {
      updateData.masterPasswordVerifier = masterPasswordVerifier;
      // Track when master password is changed (verifier update indicates password change)
      updateData.masterPasswordLastChanged = new Date();
    }
    if (masterPasswordEncryptedVaultKey !== undefined) {
      updateData.masterPasswordEncryptedVaultKey = masterPasswordEncryptedVaultKey;
      // If master password encrypted key is updated but verifier wasn't, still track it
      if (masterPasswordVerifier === undefined) {
        updateData.masterPasswordLastChanged = new Date();
      }
    }
    if (recoveryKeyEncryptedVaultKey !== undefined) {
      updateData.recoveryKeyEncryptedVaultKey = recoveryKeyEncryptedVaultKey;
      updateData.recoveryKeyGeneratedAt = new Date();
    }

    await prisma.myVault.update({
      where: { id: vaultId },
      data: updateData,
    });

    // Log master password reset if password was changed (not just recovery key update)
    if (isMasterPasswordReset && !isRecoveryKeyUpdate) {
      try {
        const now = new Date();
        await (prisma as any).activityLog.create({
          data: {
            userId,
            vaultType: 'my_vault',
            myVaultId: vault.id,
            action: 'myvault_master_password_reset',
            description: 'My Vault master password reset',
            ipAddress:
              req.headers.get('x-forwarded-for') ||
              req.headers.get('x-real-ip') ||
              null,
            userAgent: req.headers.get('user-agent') || null,
            metadata: {
              severity: 'critical', // Highly sensitive security operation
              outcome: 'success',
              passwordResetMethod: 'direct', // Direct password reset (not via recovery key)
            },
            createdAt: now,
          },
        });
      } catch (logError) {
        console.error('Failed to log MyVault master password reset activity:', logError);
      }
    }

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

    // Verify user owns the vault or is a member
    const vault = await prisma.myVault.findFirst({
      where: {
        id: vaultId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId: userId, isActive: true } } },
        ],
      },
      select: {
        id: true,
        ownerId: true,
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

    const isOwner = vault.ownerId === userId;
    
    // If user is a member, get their member data
    let memberData = null;
    if (!isOwner) {
      const membership = await prisma.myVaultMember.findFirst({
        where: {
          myVaultId: vaultId,
          userId: userId,
          isActive: true,
        },
        select: {
          id: true,
          encryptedSharedMasterKey: true,
          encryptedPrivateKey: true,
          recoveryKeyEncryptedSMK: true,
          recoveryKeyGeneratedAt: true,
        },
      });
      
      if (!membership) {
        return NextResponse.json(
          { error: 'You are not a member of this vault' },
          { status: 403 }
        );
      }
      
      memberData = membership;
    }

    // Log vault unlock activity (keys fetched for unlock)
    // Determine unlock method based on available keys
    const unlockMethod = vault.recoveryKeyEncryptedVaultKey && !vault.masterPasswordVerifier 
      ? 'recovery_key' 
      : 'master_password';
    
    try {
      const now = new Date();
      await (prisma as any).activityLog.create({
        data: {
          userId,
          vaultType: 'my_vault',
          myVaultId: vault.id,
          action: 'myvault_unlocked',
          description: `Vault unlocked via ${unlockMethod === 'recovery_key' ? 'recovery key' : 'master password'} - keys fetched successfully`,
          ipAddress:
            req.headers.get('x-forwarded-for') ||
            req.headers.get('x-real-ip') ||
            null,
          userAgent: req.headers.get('user-agent') || null,
          metadata: {
            severity: unlockMethod === 'recovery_key' ? 'warning' : 'info', // Recovery key unlock is more sensitive
            outcome: 'success',
            unlockMethod,
            hasVerifier: !!vault.masterPasswordVerifier,
            hasRecoveryKey: !!vault.recoveryKeyEncryptedVaultKey,
            isOwner,
          },
          createdAt: now,
        },
      });
    } catch (logError) {
      console.error('Failed to log MyVault unlock activity:', logError);
    }

    // Return appropriate keys based on whether user is owner or member
    if (isOwner) {
      return NextResponse.json({
        masterPasswordVerifier: vault.masterPasswordVerifier,
        masterPasswordEncryptedVaultKey: vault.masterPasswordEncryptedVaultKey,
        recoveryKeyEncryptedVaultKey: vault.recoveryKeyEncryptedVaultKey,
        recoveryKeyGeneratedAt: vault.recoveryKeyGeneratedAt,
        isOwner: true,
      });
    } else {
      // For members, return member-specific keys
      return NextResponse.json({
        encryptedSharedMasterKey: memberData?.encryptedSharedMasterKey,
        encryptedPrivateKey: memberData?.encryptedPrivateKey,
        recoveryKeyEncryptedSMK: memberData?.recoveryKeyEncryptedSMK,
        recoveryKeyGeneratedAt: memberData?.recoveryKeyGeneratedAt,
        isOwner: false,
        isMember: true,
      });
    }
  } catch (error) {
    console.error('Error fetching vault keys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vault keys' },
      { status: 500 }
    );
  }
}

