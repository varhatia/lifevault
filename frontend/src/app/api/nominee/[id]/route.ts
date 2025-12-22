import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';

/**
 * @route   DELETE /api/nominee/[id]
 * @desc    Delete (soft delete) a nominee
 * @access  Private
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: nomineeId } = await params;
    const userId = String(user.id);

    // Find nominee and verify ownership
    const nominee = await prisma.nominee.findFirst({
      where: {
        id: nomineeId,
        userId: userId,
      },
    });

    if (!nominee) {
      return NextResponse.json(
        { error: 'Nominee not found' },
        { status: 404 }
      );
    }

    // Get nominee details for logging before deletion
    const nomineeDetails = await prisma.nominee.findFirst({
      where: {
        id: nomineeId,
        userId: userId,
      },
      include: {
        myVault: {
          select: {
            id: true,
            name: true,
          },
        },
        familyVault: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Soft delete (set isActive to false)
    await prisma.nominee.update({
      where: { id: nomineeId },
      data: { isActive: false },
    });

    // Log nominee deletion
    if (nomineeDetails) {
      try {
        const now = new Date();
        await prisma.activityLog.create({
          data: {
            userId,
            vaultType: nomineeDetails.vaultType === 'family_vault' ? 'family_vault' : 'my_vault',
            myVaultId: nomineeDetails.myVaultId,
            familyVaultId: nomineeDetails.familyVaultId,
            action: 'nominee_deleted',
            description: `Nominee "${nomineeDetails.nomineeName}" removed from ${nomineeDetails.vaultType === 'family_vault' ? 'family vault' : 'my vault'}`,
            ipAddress:
              req.headers.get('x-forwarded-for') ||
              req.headers.get('x-real-ip') ||
              null,
            userAgent: req.headers.get('user-agent') || null,
            metadata: {
              nomineeId: nomineeDetails.id,
              nomineeName: nomineeDetails.nomineeName,
              vaultName: nomineeDetails.vaultType === 'family_vault' && nomineeDetails.familyVault
                ? nomineeDetails.familyVault.name
                : nomineeDetails.vaultType === 'my_vault' && nomineeDetails.myVault
                ? nomineeDetails.myVault.name
                : null,
            },
            createdAt: now,
          },
        });
      } catch (logError) {
        console.error('Failed to log nominee deletion:', logError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Nominee removed successfully',
    });
  } catch (error) {
    console.error('Error deleting nominee:', error);
    return NextResponse.json(
      { error: 'Failed to remove nominee' },
      { status: 500 }
    );
  }
}

