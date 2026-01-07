import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { sendFamilyVaultInviteEmail } from '@/lib/api/email';

/**
 * @route   GET /api/family/vaults/[vaultId]/members
 * @desc    List members of a family vault
 * @access  Private (must be member)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { vaultId } = await params;
    const userId = String(user.id);

    // Verify user is a member of this vault
    const membership = await prisma.familyMember.findFirst({
      where: {
        familyVaultId: vaultId,
        userId: userId,
        isActive: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'You are not a member of this vault' },
        { status: 403 }
      );
    }

    // Log vault access/unlock activity (members endpoint is called during unlock)
    try {
      const now = new Date();
      await (prisma as any).activityLog.create({
        data: {
          userId,
          familyMemberId: membership.id,
          vaultType: 'family_vault',
          familyVaultId: vaultId,
          action: 'familyvault_unlocked',
          description: 'Family vault unlocked - member keys fetched',
          ipAddress:
            req.headers.get('x-forwarded-for') ||
            req.headers.get('x-real-ip') ||
            null,
          userAgent: req.headers.get('user-agent') || null,
          metadata: {
            memberRole: membership.role,
            hasEncryptedSMK: true,
            hasEncryptedPrivateKey: true,
          },
          createdAt: now,
        },
      });
    } catch (logError) {
      console.error('Failed to log family vault unlock activity:', logError);
    }

    // Get all members (include encryptedSharedMasterKey for current user to decrypt SMK)
    const members = await prisma.familyMember.findMany({
      where: {
        familyVaultId: vaultId,
        isActive: true,
      },
        select: {
          id: true,
          role: true,
          publicKey: true,
          encryptedSharedMasterKey: true, // Include for all members (needed for current user)
          encryptedPrivateKey: true, // Include encrypted private key for cross-device support
          inviteToken: true,
          inviteEmail: true,
          invitePhone: true,
          invitedAt: true,
          acceptedAt: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error('Error fetching vault members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vault members' },
      { status: 500 }
    );
  }
}

/**
 * @route   POST /api/family/vaults/[vaultId]/members
 * @desc    Add a new member to family vault (Admin only)
 * @access  Private (Admin only)
 * 
 * Expected payload:
 * {
 *   email?: string,
 *   phone?: string,
 *   role: "admin" | "editor" | "viewer",
 *   memberPublicKey: string, // New member's RSA public key (PEM format)
 *   encryptedSMK: string,     // SMK encrypted with new member's public key (base64)
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { vaultId } = await params;
    const userId = String(user.id);

    // Verify user is admin of this vault
    const membership = await prisma.familyMember.findFirst({
      where: {
        familyVaultId: vaultId,
        userId: userId,
        isActive: true,
      },
      include: {
        familyVault: true,
      },
    });

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can add members' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { email, phone, role, memberPublicKey, encryptedSMK, encryptedPrivateKey, encryptedPrivateKeyTemp } = body;

    // Validation: Both email and phone are required
    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!phone || !phone.trim()) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    if (!['admin', 'editor', 'viewer'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be admin, editor, or viewer' },
        { status: 400 }
      );
    }

    if (!memberPublicKey || !encryptedSMK) {
      return NextResponse.json(
        { error: 'Member public key and encrypted SMK are required' },
        { status: 400 }
      );
    }

    // Note: encryptedPrivateKey is optional - member will set it when they first unlock with their master password

    // Check if user already exists (by email or phone)
    let targetUser = null;
    if (email) {
      targetUser = await prisma.user.findUnique({
        where: { email },
      });
    }

    // Check if user is already a member of this vault
    if (targetUser) {
      const existingMember = await prisma.familyMember.findFirst({
        where: {
          familyVaultId: vaultId,
          userId: targetUser.id,
        },
      });

      if (existingMember) {
        if (existingMember.isActive) {
          return NextResponse.json(
            { error: 'User is already a member of this vault' },
            { status: 400 }
          );
        } else {
          // Reactivate and update the existing member
          const member = await prisma.familyMember.update({
            where: { id: existingMember.id },
            data: {
              role,
              publicKey: memberPublicKey,
              encryptedSharedMasterKey: encryptedSMK,
              encryptedPrivateKey: encryptedPrivateKey || existingMember.encryptedPrivateKey, // Update if provided, keep existing otherwise
              isActive: true,
              acceptedAt: new Date(),
              inviteToken: null, // Clear invite token
            },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  fullName: true,
                },
              },
            },
          });

          return NextResponse.json(
            {
              success: true,
              member,
              message: 'Member reactivated successfully',
            },
            { status: 200 }
          );
        }
      }
    }

    // If user doesn't exist, we need to handle the invite case
    // For now, we'll require the user to exist (they need to sign up first)
    // In the future, we can create a pending invite that gets linked when user signs up
    if (!targetUser) {
      return NextResponse.json(
        { 
          error: 'User not found. The person must sign up for LifeVault first before being added to a family vault.',
          requiresSignup: true,
        },
        { status: 404 }
      );
    }

    const inviteToken = randomUUID();

    // Create family member record (pending setup - member needs to set master password)
    const member = await prisma.familyMember.create({
      data: {
        familyVaultId: vaultId,
        userId: targetUser.id,
        role,
        publicKey: memberPublicKey,
        encryptedSharedMasterKey: encryptedSMK,
        encryptedPrivateKey: null, // Member will set this when they accept invitation and set master password
        encryptedPrivateKeyTemp: encryptedPrivateKeyTemp || null, // Temporary encrypted private key (encrypted with email)
        inviteToken,
        inviteEmail: email || null,
        invitePhone: phone || null,
        invitedAt: new Date(),
        acceptedAt: null, // Member needs to accept invitation and set master password
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    // Log member added to family vault
    try {
      const now = new Date();
      await prisma.activityLog.create({
        data: {
          userId,
          vaultType: 'family_vault',
          familyVaultId: vaultId,
          action: 'family_member_added',
          description: 'Family vault member added',
          ipAddress:
            req.headers.get('x-forwarded-for') ||
            req.headers.get('x-real-ip') ||
            null,
          userAgent: req.headers.get('user-agent') || null,
          metadata: {
            memberId: member.id,
            memberEmail: member.user?.email ?? email ?? null,
            memberRole: role,
          },
          createdAt: now,
        },
      });
    } catch (logError) {
      console.error('Failed to log family member add activity:', logError);
    }

    // Send invite email if email provided
    if (email) {
      try {
        await sendFamilyVaultInviteEmail(
          email,
          membership.familyVault.name,
          user.fullName || user.email,
          inviteToken,
          vaultId
        );
      } catch (emailError) {
        console.error('Failed to send invite email:', emailError);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json(
      {
        success: true,
        member,
        message: targetUser
          ? 'Member added successfully'
          : 'Invite sent successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error adding vault member:', error);
    return NextResponse.json(
      { error: 'Failed to add vault member' },
      { status: 500 }
    );
  }
}

