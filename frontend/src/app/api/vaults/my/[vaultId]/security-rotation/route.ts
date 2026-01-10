import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';

const ROTATION_PERIOD_DAYS = 180; // Fixed 6-month rotation period

/**
 * @route   GET /api/vaults/my/[vaultId]/security-rotation
 * @desc    Get vault security rotation status (master password, recovery key, member keys, nominee keys)
 * @access  Private (vault owner only)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { vaultId } = await params;
    const now = new Date();
    const rotationPeriodMs = ROTATION_PERIOD_DAYS * 24 * 60 * 60 * 1000;

    // Get vault with security info
    const vault = await prisma.myVault.findUnique({
      where: { id: vaultId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        masterPasswordLastChanged: true,
        recoveryKeyGeneratedAt: true,
        createdAt: true,
        masterPasswordVerifier: true,
        recoveryKeyEncryptedVaultKey: true,
      },
    });

    if (!vault) {
      return NextResponse.json(
        { error: 'Vault not found' },
        { status: 404 }
      );
    }

    if (vault.ownerId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: Only vault owner can view security rotation status' },
        { status: 403 }
      );
    }

    // Check master password rotation
    const masterPasswordBaseDate = vault.masterPasswordLastChanged || vault.createdAt;
    const daysSinceMasterPassword = Math.floor(
      (now.getTime() - masterPasswordBaseDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const masterPasswordNeedsRotation = daysSinceMasterPassword >= ROTATION_PERIOD_DAYS;

    // Check recovery key rotation
    const recoveryKeyBaseDate = vault.recoveryKeyGeneratedAt || vault.createdAt;
    const daysSinceRecoveryKey = Math.floor(
      (now.getTime() - recoveryKeyBaseDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const recoveryKeyNeedsRotation = daysSinceRecoveryKey >= ROTATION_PERIOD_DAYS;

    // Get members and check their key rotation status
    const members = await prisma.myVaultMember.findMany({
      where: {
        myVaultId: vaultId,
        isActive: true,
      },
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        keysLastRotatedAt: true,
        acceptedAt: true,
        createdAt: true,
      },
    });

    const membersRotationStatus = members.map((member) => {
      const baseDate = member.keysLastRotatedAt || member.acceptedAt || member.createdAt;
      const daysSinceRotation = Math.floor(
        (now.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        memberId: member.id,
        userId: member.userId,
        email: member.user.email,
        fullName: member.user.fullName,
        keysLastRotatedAt: member.keysLastRotatedAt?.toISOString() || null,
        daysSinceRotation,
        needsRotation: daysSinceRotation >= ROTATION_PERIOD_DAYS,
      };
    });

    // Get nominees and check their key rotation status
    const nominees = await prisma.nominee.findMany({
      where: {
        myVaultId: vaultId,
        isActive: true,
      },
      select: {
        id: true,
        nomineeName: true,
        nomineeEmail: true,
        nomineePhone: true,
        keysLastRotatedAt: true,
        createdAt: true,
      },
    });

    const nomineesRotationStatus = nominees.map((nominee) => {
      const baseDate = nominee.keysLastRotatedAt || nominee.createdAt;
      const daysSinceRotation = Math.floor(
        (now.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        nomineeId: nominee.id,
        nomineeName: nominee.nomineeName,
        nomineeEmail: nominee.nomineeEmail,
        nomineePhone: nominee.nomineePhone,
        keysLastRotatedAt: nominee.keysLastRotatedAt?.toISOString() || null,
        daysSinceRotation,
        needsRotation: daysSinceRotation >= ROTATION_PERIOD_DAYS,
      };
    });

    // Calculate overall rotation status
    const hasAnyRotationNeeded =
      masterPasswordNeedsRotation ||
      recoveryKeyNeedsRotation ||
      membersRotationStatus.some((m) => m.needsRotation) ||
      nomineesRotationStatus.some((n) => n.needsRotation);

    return NextResponse.json({
      vaultId: vault.id,
      vaultName: vault.name,
      rotationPeriodDays: ROTATION_PERIOD_DAYS,
      hasRotationNeeded: hasAnyRotationNeeded,
      masterPassword: {
        hasVerifier: !!vault.masterPasswordVerifier,
        lastChanged: vault.masterPasswordLastChanged?.toISOString() || null,
        daysSinceChange: daysSinceMasterPassword,
        needsRotation: masterPasswordNeedsRotation,
      },
      recoveryKey: {
        hasRecoveryKey: !!vault.recoveryKeyEncryptedVaultKey,
        generatedAt: vault.recoveryKeyGeneratedAt?.toISOString() || null,
        daysSinceGeneration: daysSinceRecoveryKey,
        needsRotation: recoveryKeyNeedsRotation,
      },
      members: membersRotationStatus,
      nominees: nomineesRotationStatus,
    });
  } catch (error) {
    console.error('Error fetching vault security rotation status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vault security rotation status' },
      { status: 500 }
    );
  }
}




