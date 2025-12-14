import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
import { deriveKeyFromPasswordServer, decryptTextDataServer, encryptTextDataServer } from '@/lib/api/crypto';

/**
 * @route   POST /api/family/vaults/[vaultId]/invite/accept
 * @desc    Accept invitation and set master password for vault access
 * @access  Private (user must be logged in and match the invitation)
 * 
 * Expected payload:
 * {
 *   token: string,
 *   masterPassword: string,
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
    const { token, masterPassword } = body;

    if (!token || !masterPassword) {
      return NextResponse.json(
        { error: 'Missing required fields: token, masterPassword' },
        { status: 400 }
      );
    }

    if (masterPassword.length < 8) {
      return NextResponse.json(
        { error: 'Master password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // First, find member by token and vault (to verify token is valid)
    const memberByToken = await prisma.familyMember.findFirst({
      where: {
        familyVaultId: vaultId,
        inviteToken: token,
        isActive: true,
      },
      select: {
        id: true,
        userId: true,
        familyVaultId: true,
        role: true,
        publicKey: true,
        encryptedSharedMasterKey: true,
        encryptedPrivateKey: true,
        encryptedPrivateKeyTemp: true,
        inviteToken: true,
        inviteEmail: true,
        invitePhone: true,
        invitedAt: true,
        acceptedAt: true,
        isActive: true,
        familyVault: {
          select: {
            id: true,
            name: true,
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

    if (!memberByToken) {
      console.error('Invitation token not found', { vaultId, token, userId });
      return NextResponse.json(
        { error: 'Invalid or expired invitation token. Please check your email for the correct invitation link.' },
        { status: 404 }
      );
    }

    // Verify the logged-in user matches the member's userId
    if (memberByToken.userId !== userId) {
      console.error('User ID mismatch', { 
        expectedUserId: memberByToken.userId, 
        currentUserId: userId,
        memberEmail: memberByToken.user?.email,
        inviteEmail: memberByToken.inviteEmail
      });
      return NextResponse.json(
        { 
          error: `This invitation is for a different account (${memberByToken.inviteEmail || memberByToken.user?.email}). Please log in with the account that was invited to this vault.`,
        },
        { status: 403 }
      );
    }

    const member = memberByToken;

    // Check if already accepted
    if (member.acceptedAt) {
      return NextResponse.json(
        { error: 'This invitation has already been accepted' },
        { status: 400 }
      );
    }

    // Decrypt temporary private key with member's email, then re-encrypt with master password
    if (!member.encryptedPrivateKeyTemp) {
      return NextResponse.json(
        { error: 'Temporary private key not found. Please contact the vault owner.' },
        { status: 400 }
      );
    }

    // Get member's email or phone to decrypt temporary private key
    // The temp password was: email || phone || "temp-password"
    // So we need to try in the same order
    const tempPassword = member.inviteEmail || member.invitePhone || member.user?.email || "temp-password";
    
    if (!tempPassword) {
      return NextResponse.json(
        { error: 'Member email or phone not found' },
        { status: 400 }
      );
    }

    try {
      // Decrypt temporary private key with email/phone (temporary password)
      // Try the same order as encryption: email || phone || "temp-password"
      // Use server-side crypto functions
      const tempKey = await deriveKeyFromPasswordServer(tempPassword);
      const encryptedPrivateKeyTempData = JSON.parse(member.encryptedPrivateKeyTemp);
      const decryptedTempData = await decryptTextDataServer(encryptedPrivateKeyTempData, tempKey);
      const privateKey = decryptedTempData.privateKey;

      if (!privateKey || typeof privateKey !== 'string') {
        console.error('Failed to decrypt temporary private key', {
          tempPasswordUsed: tempPassword ? '***' : 'null',
          hasInviteEmail: !!member.inviteEmail,
          hasInvitePhone: !!member.invitePhone,
          hasUserEmail: !!member.user?.email,
        });
        throw new Error('Failed to decrypt temporary private key. The encryption password may not match.');
      }

      // Re-encrypt private key with member's master password
      const memberKey = await deriveKeyFromPasswordServer(masterPassword);
      const encryptedPrivateKeyFinal = await encryptTextDataServer(
        { privateKey },
        memberKey
      );

      // Update member record
      const updatedMember = await prisma.familyMember.update({
        where: { id: member.id },
        data: {
          // Keep existing public key (it matches the private key we just decrypted)
          encryptedPrivateKey: JSON.stringify(encryptedPrivateKeyFinal), // Store encrypted private key with master password
          encryptedPrivateKeyTemp: null, // Clear temporary encrypted private key
          acceptedAt: new Date(),
          inviteToken: null, // Clear invite token
        },
        include: {
          familyVault: {
            select: {
              id: true,
              name: true,
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

      return NextResponse.json({
        success: true,
        message: 'Invitation accepted successfully. You can now access the vault with your master password.',
        member: updatedMember,
      });
    } catch (decryptError) {
      console.error('Error decrypting temporary private key:', decryptError);
      return NextResponse.json(
        { error: 'Failed to decrypt temporary private key. Please contact the vault owner.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    );
  }
}
