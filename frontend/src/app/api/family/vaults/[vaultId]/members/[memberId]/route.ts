import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';

/**
 * @route   PUT /api/family/vaults/[vaultId]/members/[memberId]
 * @desc    Update member permissions (Admin only)
 * @access  Private (Admin only)
 * 
 * Expected payload:
 * {
 *   role: "admin" | "editor" | "viewer",
 *   encryptedSMK?: string, // Optional: new encrypted SMK if key rotation occurred
 * }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string; memberId: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { vaultId, memberId } = await params;
    const userId = String(user.id);

    // Verify requester is admin
    const requesterMembership = await prisma.familyMember.findFirst({
      where: {
        familyVaultId: vaultId,
        userId: userId,
        isActive: true,
      },
    });

    if (!requesterMembership || requesterMembership.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can update member permissions' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { role, encryptedSMK } = body;

    if (!['admin', 'editor', 'viewer'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be admin, editor, or viewer' },
        { status: 400 }
      );
    }

    // Prevent removing last admin
    if (role !== 'admin') {
      const adminCount = await prisma.familyMember.count({
        where: {
          familyVaultId: vaultId,
          role: 'admin',
          isActive: true,
        },
      });

      const targetMember = await prisma.familyMember.findUnique({
        where: { id: memberId },
      });

      if (targetMember?.role === 'admin' && adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the last admin' },
          { status: 400 }
        );
      }
    }

    // Update member
    const updateData: any = { role };
    if (encryptedSMK) {
      updateData.encryptedSharedMasterKey = encryptedSMK;
    }

    const member = await prisma.familyMember.update({
      where: { id: memberId },
      data: updateData,
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

    // Log role/permissions change
    try {
      const now = new Date();
      await prisma.activityLog.create({
        data: {
          userId,
          vaultType: 'family_vault',
          familyVaultId: vaultId,
          action: 'family_member_role_updated',
          description: 'Family vault member role updated',
          ipAddress:
            req.headers.get('x-forwarded-for') ||
            req.headers.get('x-real-ip') ||
            null,
          userAgent: req.headers.get('user-agent') || null,
          metadata: {
            memberId,
            newRole: role,
          },
          createdAt: now,
        },
      });
    } catch (logError) {
      console.error('Failed to log family member role update:', logError);
    }

    return NextResponse.json({
      success: true,
      member,
    });
  } catch (error) {
    console.error('Error updating member permissions:', error);
    return NextResponse.json(
      { error: 'Failed to update member permissions' },
      { status: 500 }
    );
  }
}

/**
 * @route   DELETE /api/family/vaults/[vaultId]/members/[memberId]
 * @desc    Remove member from vault (Admin only)
 * @access  Private (Admin only)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string; memberId: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { vaultId, memberId } = await params;
    const userId = String(user.id);

    // Verify requester is admin
    const requesterMembership = await prisma.familyMember.findFirst({
      where: {
        familyVaultId: vaultId,
        userId: userId,
        isActive: true,
      },
    });

    if (!requesterMembership || requesterMembership.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can remove members' },
        { status: 403 }
      );
    }

    // Prevent removing last admin
    const targetMember = await prisma.familyMember.findUnique({
      where: { id: memberId },
    });

    if (targetMember?.role === 'admin') {
      const adminCount = await prisma.familyMember.count({
        where: {
          familyVaultId: vaultId,
          role: 'admin',
          isActive: true,
        },
      });

      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the last admin' },
          { status: 400 }
        );
      }
    }

    // Soft delete (set isActive to false)
    await prisma.familyMember.update({
      where: { id: memberId },
      data: { isActive: false },
    });
    
    // Log member removal
    try {
      const now = new Date();
      await prisma.activityLog.create({
        data: {
          userId,
          vaultType: 'family_vault',
          familyVaultId: vaultId,
          action: 'family_member_removed',
          description: 'Family vault member removed',
          ipAddress:
            req.headers.get('x-forwarded-for') ||
            req.headers.get('x-real-ip') ||
            null,
          userAgent: req.headers.get('user-agent') || null,
          metadata: {
            memberId,
            removedRole: targetMember?.role ?? null,
          },
          createdAt: now,
        },
      });
    } catch (logError) {
      console.error('Failed to log family member removal:', logError);
    }

    return NextResponse.json({
      success: true,
      message: 'Member removed successfully',
    });
  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json(
      { error: 'Failed to remove member' },
      { status: 500 }
    );
  }
}


