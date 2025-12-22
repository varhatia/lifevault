import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPassword, signAuthToken, AUTH_COOKIE_NAME } from '@/lib/api/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body || {};

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.hashedPassword) {
      // Explicitly indicate when the account doesn't exist or is misconfigured
      return NextResponse.json(
        { error: "User does not exist. Please sign up to continue." },
        { status: 404 }
      );
    }

    const valid = await verifyPassword(password, user.hashedPassword);
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid credentials. Please check your password.' },
        { status: 401 }
      );
    }

    const now = new Date();

    // Update lastLogin timestamp for inactivity monitoring
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: now },
    });

    // Capture basic request context for logging (no secrets)
    const ip =
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      null;
    const userAgent = req.headers.get('user-agent') || null;

    // Log successful login activity (no password or vault content)
    try {
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          vaultType: 'account',
          action: 'login_success',
          description: 'User logged in successfully',
          ipAddress: ip,
          userAgent,
          metadata: {},
          createdAt: now,
        },
      });
    } catch (logError) {
      // Do not block login if logging fails
      console.error('Failed to log login activity:', logError);
    }

    const token = signAuthToken(user.id, user.email);

    const res = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        createdAt: user.createdAt,
      },
    });

    res.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 30, // 30 minutes (matches JWT expiry)
    });

    return res;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Failed to login' },
      { status: 500 }
    );
  }
}
