import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/api/auth';
import { sendVerificationEmail } from '@/lib/api/email';
import { evaluatePasswordStrength } from '@/lib/passwordStrength';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, fullName, phone, dateOfBirth } = body || {};

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

    // Validate phone number format (international: + followed by digits)
    if (phone) {
      const phoneRegex = /^\+[1-9]\d{1,14}$/;
      if (!phoneRegex.test(phone)) {
        return NextResponse.json(
          { error: 'Phone number must be in international format (e.g., +1234567890)' },
          { status: 400 }
        );
      }
    }

    // Validate date of birth
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      if (isNaN(dob.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date of birth' },
          { status: 400 }
        );
      }

      // Check if user is at least 18 years old
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      const dayDiff = today.getDate() - dob.getDate();
      
      const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
      
      if (actualAge < 18) {
        return NextResponse.json(
          { error: 'You must be at least 18 years old to create an account' },
          { status: 400 }
        );
      }
    }

    // Validate strong password requirements
    const passwordStrength = evaluatePasswordStrength(password, {
      name: fullName,
      email,
      phone,
    });

    if (!passwordStrength.isValid) {
      const unmetRequirements = passwordStrength.requirements
        .filter((req) => !req.met)
        .map((req) => req.message)
        .join(', ');
      return NextResponse.json(
        { error: `Password does not meet requirements: ${unmetRequirements}` },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);

    // Generate verification token
    const verificationToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30); // Token expires in 30 minutes

    const user = await prisma.user.create({
      data: {
        email,
        hashedPassword,
        fullName: fullName || null,
        phone: phone || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
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
