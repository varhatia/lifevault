import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/api/auth';

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using token from email
 * @access  Public
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, password } = body || {};

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Find user with matching token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetTokenExpires: {
          gt: new Date(), // Token must not be expired
        },
        isActive: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await hashPassword(password);

    const now = new Date();

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        hashedPassword,
        passwordResetToken: null,
        passwordResetTokenExpires: null,
        lastPasswordChange: now,
      },
    });

    // Capture basic request context (no secrets)
    const ip =
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      null;
    const userAgent = req.headers.get('user-agent') || null;

    // Log password change activity
    try {
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          vaultType: 'account',
          action: 'password_reset',
          description: 'User password was reset via reset link',
          ipAddress: ip,
          userAgent,
          metadata: {},
          createdAt: now,
        },
      });
    } catch (logError) {
      console.error('Failed to log password reset activity:', logError);
      // Do not fail the reset for logging issues
    }

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}

