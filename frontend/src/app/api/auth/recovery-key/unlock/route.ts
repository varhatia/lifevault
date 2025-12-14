import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';

/**
 * @route   POST /api/auth/recovery-key/unlock
 * @desc    Unlock vault using recovery key
 * @access  Private
 * 
 * Expected payload:
 * {
 *   recoveryKey: string, // Base64 encoded recovery key
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = typeof user.id === 'string' ? user.id : String(user.id);
    const body = await req.json();
    const { recoveryKey } = body;

    if (!recoveryKey) {
      return NextResponse.json(
        { error: 'Recovery key is required' },
        { status: 400 }
      );
    }

    // Get user's recovery key encrypted vault key
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        recoveryKeyEncryptedVaultKey: true,
        recoveryKeyGeneratedAt: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!dbUser.recoveryKeyEncryptedVaultKey) {
      return NextResponse.json(
        { error: 'Recovery key not configured for this account. Please use your master password or contact support.' },
        { status: 400 }
      );
    }

    // Return encrypted vault key to client for decryption (zero-knowledge)
    // Client will decrypt using recovery key
    return NextResponse.json({
      success: true,
      encryptedVaultKey: dbUser.recoveryKeyEncryptedVaultKey,
      message: 'Recovery key verified. Decrypting vault key...',
    });
  } catch (error) {
    console.error('Recovery key unlock error:', error);
    return NextResponse.json(
      { error: 'Failed to unlock vault with recovery key' },
      { status: 500 }
    );
  }
}

