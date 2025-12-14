import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';

/**
 * @route   GET /api/family/vaults/[vaultId]/recovery-key
 * @desc    Get recovery key encrypted SMK for the current user's membership in this vault
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

    // Find the FamilyMember record for this user and vault
    const familyMember = await prisma.familyMember.findUnique({
      where: {
        familyVaultId_userId: {
          familyVaultId: vaultId,
          userId: userId,
        },
      },
      select: {
        id: true,
        recoveryKeyEncryptedSMK: true,
        recoveryKeyGeneratedAt: true,
      },
    });

    if (!familyMember) {
      return NextResponse.json(
        { error: 'Family member record not found' },
        { status: 404 }
      );
    }

    if (!familyMember.recoveryKeyEncryptedSMK) {
      return NextResponse.json(
        { error: 'Recovery key not configured for this vault membership' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      recoveryKeyEncryptedSMK: familyMember.recoveryKeyEncryptedSMK,
      recoveryKeyGeneratedAt: familyMember.recoveryKeyGeneratedAt,
    });
  } catch (error) {
    console.error('Error fetching recovery key for family vault:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recovery key' },
      { status: 500 }
    );
  }
}

