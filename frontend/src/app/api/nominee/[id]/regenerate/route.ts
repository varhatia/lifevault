import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
import { storePartB } from '@/lib/api/key-storage';
import { sendNomineeNotificationEmail } from '@/lib/api/email';

/**
 * @route   PUT /api/nominee/[id]/regenerate
 * @desc    Regenerate nominee keys after recovery key reset
 * @access  Private
 * 
 * Expected payload:
 * {
 *   nomineeKeyPartC: string, // New encrypted Part C (JSON string)
 *   serverKeyPartB: string,  // New Part B (will be encrypted server-side)
 *   encryptionPassword: string, // Password used to encrypt Part C (for email notification)
 * }
 */
export async function PUT(
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

    const body = await req.json();
    const { nomineeKeyPartC, serverKeyPartB, encryptionPassword } = body;

    if (!nomineeKeyPartC || !serverKeyPartB) {
      return NextResponse.json(
        { error: 'nomineeKeyPartC and serverKeyPartB are required' },
        { status: 400 }
      );
    }

    // Find nominee and verify ownership
    const nominee = await prisma.nominee.findFirst({
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

    if (!nominee) {
      return NextResponse.json(
        { error: 'Nominee not found' },
        { status: 404 }
      );
    }

    // Store/update Part B (server key)
    await storePartB(userId, serverKeyPartB, 1); // Use version 1 for now

    // Update nominee with new Part C and reactivate
    const updatedNominee = await prisma.nominee.update({
      where: { id: nomineeId },
      data: {
        nomineeKeyPartC: nomineeKeyPartC, // New encrypted Part C
        isActive: true, // Reactivate the nominee
        unlockInitiatedAt: null, // Reset unlock status
        unlockCompletedAt: null,
      },
      select: {
        id: true,
        nomineeName: true,
        nomineeEmail: true,
        nomineePhone: true,
        vaultType: true,
        myVault: {
          select: {
            name: true,
          },
        },
        familyVault: {
          select: {
            name: true,
          },
        },
      },
    });

    // Send notification email to nominee with new key
    if (updatedNominee.nomineeEmail) {
      try {
        const vaultName = updatedNominee.vaultType === 'family_vault' && updatedNominee.familyVault
          ? updatedNominee.familyVault.name
          : updatedNominee.myVault?.name || 'Personal Vault';

        await sendNomineeNotificationEmail(
          updatedNominee.nomineeEmail,
          updatedNominee.nomineeName,
          user.fullName || user.email,
          (updatedNominee.vaultType === 'family_vault' ? 'family_vault' : 'my_vault') as 'my_vault' | 'family_vault',
          vaultName,
          nomineeKeyPartC // Send encrypted Part C
        );
      } catch (emailError) {
        console.error('Failed to send nominee notification email:', emailError);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Nominee keys regenerated successfully',
      nominee: updatedNominee,
    });
  } catch (error) {
    console.error('Error regenerating nominee keys:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate nominee keys' },
      { status: 500 }
    );
  }
}

