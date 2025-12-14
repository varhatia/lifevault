import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * @route   GET /api/family/vaults/[vaultId]/invite/verify
 * @desc    Verify invitation token and return vault details
 * @access  Public (for invitation verification)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  try {
    const { vaultId } = await params;
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      );
    }

    // Find member with matching token and vault
    // Note: This endpoint can be accessed without authentication for invitation verification
    const member = await prisma.familyMember.findFirst({
      where: {
        familyVaultId: vaultId,
        inviteToken: token,
        isActive: true,
      },
      include: {
        familyVault: {
          select: {
            id: true,
            name: true,
            owner: {
              select: {
                id: true,
                email: true,
                fullName: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation token' },
        { status: 404 }
      );
    }

    // Check if already accepted
    if (member.acceptedAt) {
      return NextResponse.json(
        { error: 'This invitation has already been accepted' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      vaultName: member.familyVault.name,
      inviterName: member.familyVault.owner.fullName || member.familyVault.owner.email,
      role: member.role,
      memberEmail: member.user.email,
    });
  } catch (error) {
    console.error('Error verifying invitation:', error);
    return NextResponse.json(
      { error: 'Failed to verify invitation' },
      { status: 500 }
    );
  }
}

