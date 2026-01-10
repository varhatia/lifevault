import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { sendMyVaultInviteEmail } from '@/lib/api/email';
import { canAddMember, type SubscriptionPlan } from '@/lib/plan-limits';

/**
 * @route   GET /api/vaults/my/[vaultId]/members
 * @desc    List members of a my vault
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

    // Verify user is a member of this vault (owner or member)
    const vault = await prisma.myVault.findUnique({
      where: { id: vaultId },
    });

    if (!vault) {
      return NextResponse.json(
        { error: 'Vault not found' },
        { status: 404 }
      );
    }

    // Check if user is owner or member
    const isOwner = vault.ownerId === userId;
    const membership = await prisma.myVaultMember.findFirst({
      where: {
        myVaultId: vaultId,
        userId: userId,
        isActive: true,
      },
    });

    if (!isOwner && !membership) {
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
          myVaultMemberId: membership?.id || null,
          vaultType: 'my_vault',
          myVaultId: vaultId,
          action: 'myvault_unlocked',
          description: 'My vault unlocked - member keys fetched',
          ipAddress:
            req.headers.get('x-forwarded-for') ||
            req.headers.get('x-real-ip') ||
            null,
          userAgent: req.headers.get('user-agent') || null,
          metadata: {
            memberRole: isOwner ? 'owner' : membership?.role || null,
            hasEncryptedSMK: true,
            hasEncryptedPrivateKey: true,
          },
          createdAt: now,
        },
      });
    } catch (logError) {
      console.error('Failed to log my vault unlock activity:', logError);
    }

    // Get all members (include encryptedSharedMasterKey for current user to decrypt SMK)
    const members = await prisma.myVaultMember.findMany({
      where: {
        myVaultId: vaultId,
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
 * @route   POST /api/vaults/my/[vaultId]/members
 * @desc    Add a new member to my vault (Admin/Owner only)
 * @access  Private (Admin/Owner only)
 * 
 * Expected payload:
 * {
 *   email?: string,
 *   phone?: string,
 *   memberPublicKey: string, // New member's RSA public key (PEM format)
 *   encryptedSMK: string,     // SMK encrypted with new member's public key (base64)
 * }
 * Note: Role system removed - all members have full access except adding members/nominees
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

    // Verify user is owner or admin of this vault
    const vault = await prisma.myVault.findUnique({
      where: { id: vaultId },
    });

    if (!vault) {
      return NextResponse.json(
        { error: 'Vault not found' },
        { status: 404 }
      );
    }

    const isOwner = vault.ownerId === userId;
    const membership = await prisma.myVaultMember.findFirst({
      where: {
        myVaultId: vaultId,
        userId: userId,
        isActive: true,
      },
    });

    // Only owner can add members (members cannot add other members)
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Only vault owners can add members' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { email, phone, memberPublicKey, encryptedSMK, encryptedPrivateKey, encryptedPrivateKeyTemp } = body;

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

    // Role system removed - all members have full access except adding members/nominees

    if (!memberPublicKey || !encryptedSMK) {
      return NextResponse.json(
        { error: 'Member public key and encrypted SMK are required' },
        { status: 400 }
      );
    }

    // Check plan limits for members
    // Only check if user is owner
    // Member limit is per-vault: each vault can have up to 2 members (free plan)
    if (isOwner) {
      const plan = ((user as any).subscriptionPlan || "free") as SubscriptionPlan;
      
      // Count members in THIS specific vault only (excluding owner)
      // Only count active members who are not the owner
      const vaultMemberCount = await prisma.myVaultMember.count({
        where: {
          myVaultId: vaultId,
          isActive: true,
          userId: { not: userId }, // Exclude owner
        },
      });

      // Debug logging (remove in production if needed)
      console.log(`[Member Limit Check] Plan: ${plan}, Vault: ${vaultId}, Current Members: ${vaultMemberCount}, Can Add: ${canAddMember(plan, vaultMemberCount)}`);

      if (!canAddMember(plan, vaultMemberCount)) {
        return NextResponse.json(
          {
            error: 'Member limit reached',
            limitReached: true,
            limitType: 'members',
            currentCount: vaultMemberCount,
            maxAllowed: plan === "free" ? 2 : Infinity,
            message: plan === "free"
              ? `Free plan allows up to 2 members per vault. You currently have ${vaultMemberCount} member(s). Please upgrade to LifeVault Plus to add unlimited members.`
              : 'Unable to add member. Please contact support.',
          },
          { status: 403 }
        );
      }
    }

    // Check if user already exists (by email or phone)
    let targetUser = null;
    if (email) {
      targetUser = await prisma.user.findUnique({
        where: { email },
      });
    }

    // Check if user is already a member of this vault
    if (targetUser) {
      const existingMember = await prisma.myVaultMember.findFirst({
        where: {
          myVaultId: vaultId,
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
          const member = await prisma.myVaultMember.update({
            where: { id: existingMember.id },
            data: {
              // Role system removed - keep existing role for backward compatibility
              publicKey: memberPublicKey,
              encryptedSharedMasterKey: encryptedSMK,
              encryptedPrivateKey: encryptedPrivateKey || existingMember.encryptedPrivateKey,
              isActive: true,
              acceptedAt: new Date(),
              inviteToken: null,
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
    if (!targetUser) {
      return NextResponse.json(
        { 
          error: 'User not found. The person must sign up for LifeVault first before being added to a vault.',
          requiresSignup: true,
        },
        { status: 404 }
      );
    }

    const inviteToken = randomUUID();

    // Create my vault member record (pending setup - member needs to set master password)
    // Role system removed - all members have full access except adding members/nominees
    // Set default role for backward compatibility (not used for permissions)
    const member = await prisma.myVaultMember.create({
      data: {
        myVaultId: vaultId,
        userId: targetUser.id,
        role: 'editor', // Default role for backward compatibility (not used for permissions)
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

    // Log member added to my vault
    try {
      const now = new Date();
      await prisma.activityLog.create({
        data: {
          userId,
          vaultType: 'my_vault',
          myVaultId: vaultId,
          action: 'myvault_member_added',
          description: 'My vault member added',
          ipAddress:
            req.headers.get('x-forwarded-for') ||
            req.headers.get('x-real-ip') ||
            null,
          userAgent: req.headers.get('user-agent') || null,
          metadata: {
            memberId: member.id,
            memberEmail: member.user?.email ?? email ?? null,
            memberRole: member.role || 'editor',
          },
          createdAt: now,
        },
      });
    } catch (logError) {
      console.error('Failed to log my vault member add activity:', logError);
    }

    // Send invite email if email provided
    if (email) {
      try {
        await sendMyVaultInviteEmail(
          email,
          vault.name,
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



