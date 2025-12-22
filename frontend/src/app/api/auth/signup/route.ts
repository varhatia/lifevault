import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/api/auth';
import { sendVerificationEmail } from '@/lib/api/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, fullName, phone } = body || {};

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Optional phone validation (expects E.164-style: +[country][number])
    if (phone) {
      const phoneString = String(phone).trim();
      const phoneRegex = /^\+[1-9]\d{7,14}$/;
      if (!phoneRegex.test(phoneString)) {
        return NextResponse.json(
          { error: 'Invalid phone number format' },
          { status: 400 }
        );
      }
    }

    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) {
      return NextResponse.json(
        {
          error:
            'An account with this email already exists. Please log in or use a different email / phone number.',
        },
        { status: 409 }
      );
    }

    if (phone) {
      const existingByPhone = await prisma.user.findFirst({
        where: { phone: String(phone).trim() },
      });
      if (existingByPhone) {
        return NextResponse.json(
          {
            error:
              'An account with this phone number already exists. Please use a different phone number or email address.',
          },
          { status: 409 }
        );
      }
    }

    const hashedPassword = await hashPassword(password);

    // Generate verification token
    const verificationToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30); // Token expires in 30 minutes

    const user = await prisma.user.create({
      data: {
        email,
        phone: phone ? String(phone).trim() : null,
        hashedPassword,
        fullName: fullName || null,
        emailVerified: false, // Email not verified yet
        emailVerificationToken: verificationToken,
        emailVerificationTokenExpires: expiresAt,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    // Send verification email
    try {
      await sendVerificationEmail(user.email, verificationToken, user.fullName);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      // Continue anyway - user can request resend later
    }

    // Don't sign in user yet - they need to verify email first
    return NextResponse.json({
      success: true,
      message: 'Account created. Please check your email to verify your account.',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to sign up' },
      { status: 500 }
    );
  }
}