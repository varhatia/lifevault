import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';

/**
 * @route   POST /api/nominee/[id]/resend-key
 * @desc    Resend encrypted Part C to nominee via email
 * @access  Private
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: nomineeId } = await params;
    const userId = String(user.id); // Ensure userId is a string

    // Find nominee and verify ownership
    const nominee = await prisma.nominee.findFirst({
      where: {
        id: nomineeId,
        userId: userId,
        isActive: true,
      },
    });

    if (!nominee) {
      return NextResponse.json(
        { error: 'Nominee not found' },
        { status: 404 }
      );
    }

    if (!nominee.nomineeEmail) {
      return NextResponse.json(
        { error: 'Nominee email not available. Cannot send key via email.' },
        { status: 400 }
      );
    }

    // Send notification email with encrypted Part C
    try {
      const { sendNomineeNotificationEmail } = await import('@/lib/api/email');
      // Get vault name for family vaults
      let vaultName: string | undefined;
      if (nominee.vaultType === 'family_vault' && nominee.familyVaultId) {
        const vault = await prisma.familyVault.findUnique({
          where: { id: nominee.familyVaultId },
          select: { name: true },
        });
        vaultName = vault?.name;
      }
      
      await sendNomineeNotificationEmail(
        nominee.nomineeEmail!,
        nominee.nomineeName,
        user.fullName || user.email,
        (nominee.vaultType === 'family_vault' ? 'family_vault' : 'my_vault') as 'my_vault' | 'family_vault',
        vaultName,
        nominee.nomineeKeyPartC // Send encrypted Part C
      );

      return NextResponse.json({
        success: true,
        message: 'Nominee key has been resent successfully',
      });
    } catch (error) {
      console.error('Failed to resend nominee key:', error);
      return NextResponse.json(
        { error: 'Failed to resend nominee key' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error resending nominee key:', error);
    return NextResponse.json(
      { error: 'Failed to resend nominee key' },
      { status: 500 }
    );
  }
}

