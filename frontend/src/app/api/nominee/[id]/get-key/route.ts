import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';

/**
 * @route   GET /api/nominee/[id]/get-key
 * @desc    Get encrypted Part C for manual delivery (user can copy/download)
 * @access  Private
 */
export async function GET(
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

    // Find nominee and verify user is the vault owner (not just a member)
    const nominee = await prisma.nominee.findFirst({
      where: {
        id: nomineeId,
        userId: userId,
        isActive: true,
      },
      include: {
        myVault: {
          select: {
            id: true,
            ownerId: true, // Check owner
          },
        },
        familyVault: {
          select: {
            id: true,
            ownerId: true, // Check owner
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

    // Verify user is the vault owner (not just a member)
    if (nominee.vaultType === 'my_vault') {
      if (nominee.myVault?.ownerId !== userId) {
        return NextResponse.json(
          { error: 'Only the vault owner can retrieve nominee keys' },
          { status: 403 }
        );
      }
    } else if (nominee.vaultType === 'family_vault') {
      if (nominee.familyVault?.ownerId !== userId) {
        return NextResponse.json(
          { error: 'Only the vault owner can retrieve nominee keys' },
          { status: 403 }
        );
      }
    }

    // Return encrypted Part C for manual delivery
    return NextResponse.json({
      success: true,
      nominee: {
        id: nominee.id,
        nomineeName: nominee.nomineeName,
        nomineeEmail: nominee.nomineeEmail,
        nomineePhone: nominee.nomineePhone,
        encryptedPartC: nominee.nomineeKeyPartC, // Encrypted Part C
      },
      instructions: {
        message: 'Share this encrypted key part with your nominee through a secure channel.',
        steps: [
          'Copy the encrypted key part below',
          'Share it with your nominee via a secure method (in person, secure messaging, etc.)',
          'Share the decryption password separately through another secure channel',
          'Instruct the nominee to save both the encrypted key and password securely',
        ],
      },
    });
  } catch (error) {
    console.error('Error retrieving nominee key:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve nominee key' },
      { status: 500 }
    );
  }
}

