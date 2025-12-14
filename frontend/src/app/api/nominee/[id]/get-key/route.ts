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

    // Find nominee and verify ownership
    const nominee = await prisma.nominee.findFirst({
      where: {
        id: nomineeId,
        userId: userId,
        isActive: true,
      },
      select: {
        id: true,
        nomineeName: true,
        nomineeEmail: true,
        nomineePhone: true,
        nomineeKeyPartC: true, // Return encrypted Part C
      },
    });

    if (!nominee) {
      return NextResponse.json(
        { error: 'Nominee not found' },
        { status: 404 }
      );
    }

    // Return encrypted Part C for manual delivery
    return NextResponse.json({
      success: true,
      nominee: {
        id: nominee.id,
        nomineeName: nominee.nomineeName,
        nomineeEmail: nominee.nomineeEmail,
        nomineePhone: nominee.nomineePhone,
        encryptedPartC: nominee.nomineeKeyPartC,
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

