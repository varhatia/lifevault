import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import { sendRecoveryKeyEmail } from '@/lib/api/email';

/**
 * @route   POST /api/auth/recovery-key/send-email
 * @desc    Send recovery key email to user
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

    const body = await req.json();
    const { recoveryKey } = body;

    if (!recoveryKey) {
      return NextResponse.json(
        { error: 'Recovery key is required' },
        { status: 400 }
      );
    }

    // Send recovery key email
    try {
      await sendRecoveryKeyEmail(
        user.email,
        user.fullName || null,
        recoveryKey
      );
    } catch (emailError) {
      console.error('Failed to send recovery key email:', emailError);
      return NextResponse.json(
        { error: 'Failed to send recovery key email' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Recovery key email error:', error);
    return NextResponse.json(
      { error: 'Failed to send recovery key email' },
      { status: 500 }
    );
  }
}


