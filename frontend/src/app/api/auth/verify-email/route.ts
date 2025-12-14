import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { signAuthToken, AUTH_COOKIE_NAME } from '@/lib/api/auth';

/**
 * @route   GET /api/auth/verify-email
 * @desc    Verify email address using token from email link
 * @access  Public
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }

    // Find user with matching token
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationTokenExpires: {
          gt: new Date(), // Token must not be expired
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 400 }
      );
    }

    // Mark email as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null, // Clear token after verification
        emailVerificationTokenExpires: null,
      },
    });

    // Don't auto-login - force user to login manually
    const res = NextResponse.json({
      success: true,
      message: 'Email verified successfully. Please login to continue.',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        emailVerified: true,
      },
    });

    return res;
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify email' },
      { status: 500 }
    );
  }
}


