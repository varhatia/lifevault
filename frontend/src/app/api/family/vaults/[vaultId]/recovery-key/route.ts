import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';

/**
 * @route   POST /api/family/vaults/[vaultId]/recovery-key
 * @desc    Store recovery key encrypted SMK for a family vault member
 * @access  Private
 * 
 * Expected payload:
 * {
 *   recoveryKeyEncryptedSMK: string, // SMK encrypted with recovery key
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
    const { recoveryKeyEncryptedSMK } = body;

    if (!recoveryKeyEncryptedSMK) {
      return NextResponse.json(
        { error: 'Recovery key encrypted SMK is required' },
        { status: 400 }
      );
    }

    // Find the FamilyMember record for this user and vault
    const familyMember = await prisma.familyMember.findUnique({
      where: {
        familyVaultId_userId: {
          familyVaultId: vaultId,
          userId: userId,
        },
      },
    });

    if (!familyMember) {
      return NextResponse.json(
        { error: 'Family member record not found' },
        { status: 404 }
      );
    }

    // Update FamilyMember's recovery key encrypted SMK (per-member, per-vault)
    // This ensures isolation: each member has their own recovery key for each vault
    await prisma.familyMember.update({
      where: {
        id: familyMember.id,
      },
      data: {
        recoveryKeyEncryptedSMK: recoveryKeyEncryptedSMK,
        recoveryKeyGeneratedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Recovery key stored successfully',
    });
  } catch (error) {
    console.error('Error storing recovery key for family vault:', error);
    return NextResponse.json(
      { error: 'Failed to store recovery key' },
      { status: 500 }
    );
  }
}

