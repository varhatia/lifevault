import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest, verifyPassword } from '@/lib/api/auth';
import { sendDeviceAuthorizationEmail } from '@/lib/api/email';

/**
 * @route   POST /api/auth/device/authorize
 * @desc    Request authorization for a new device
 * @access  Public (but requires email + password verification for security)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deviceFingerprint, deviceName, userAgent, email, password } = body || {};

    if (!deviceFingerprint || !deviceName) {
      return NextResponse.json(
        { error: 'Device fingerprint and name are required' },
        { status: 400 }
      );
    }

    // For unauthenticated requests (during login), require email + password verification
    let user;
    const authUser = await getUserFromRequest(req);
    
    if (authUser) {
      // User is authenticated - use their session
      user = authUser;
    } else if (email && password) {
      // User is not authenticated but provided credentials - verify them
      const userRecord = await prisma.user.findUnique({ 
        where: { email },
        select: { id: true, email: true, hashedPassword: true, fullName: true, isActive: true }
      });
      
      if (!userRecord || !userRecord.hashedPassword || !userRecord.isActive) {
        return NextResponse.json(
          { error: 'Invalid credentials' },
          { status: 401 }
        );
      }

      const valid = await verifyPassword(password, userRecord.hashedPassword);
      if (!valid) {
        return NextResponse.json(
          { error: 'Invalid credentials' },
          { status: 401 }
        );
      }

      user = {
        id: userRecord.id,
        email: userRecord.email,
        fullName: userRecord.fullName,
      };
    } else {
      return NextResponse.json(
        { error: 'Authentication required. Please provide email and password, or log in first.' },
        { status: 401 }
      );
    }

    // Check if device is already trusted
    const existingDevice = await prisma.trustedDevice.findUnique({
      where: {
        userId_deviceFingerprint: {
          userId: user.id,
          deviceFingerprint,
        },
      },
    });

    if (existingDevice && existingDevice.isActive) {
      return NextResponse.json(
        { error: 'Device is already authorized' },
        { status: 400 }
      );
    }

    // Generate authorization token
    const nodeCrypto = await import('crypto');
    const authorizationToken = nodeCrypto.default.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Token expires in 24 hours

    // Hash the token for storage
    const tokenHash = nodeCrypto.default.createHash('sha256').update(authorizationToken).digest('hex');

    const ipAddress =
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      null;

    // Create or update pending device record (inactive until authorized)
    if (existingDevice) {
      // Update existing inactive device
      await prisma.trustedDevice.update({
        where: { id: existingDevice.id },
        data: {
          deviceName,
          userAgent: userAgent || null,
          ipAddress,
          isActive: false, // Will be activated after email verification
          authorizationTokenHash: tokenHash,
          authorizationTokenExpires: expiresAt,
        },
      });
    } else {
      // Create new device record (inactive until authorized)
      await prisma.trustedDevice.create({
        data: {
          userId: user.id,
          deviceFingerprint,
          deviceName,
          userAgent: userAgent || null,
          ipAddress,
          isActive: false, // Will be activated after email verification
          authorizationTokenHash: tokenHash,
          authorizationTokenExpires: expiresAt,
        },
      });
    }

    // Send authorization email
    try {
      await sendDeviceAuthorizationEmail(
        user.email,
        user.fullName,
        deviceName,
        authorizationToken,
        deviceFingerprint,
        ipAddress || 'Unknown',
        userAgent || 'Unknown'
      );
    } catch (emailError) {
      console.error('Failed to send device authorization email:', emailError);
      // Continue anyway - user can request resend
    }

    return NextResponse.json({
      success: true,
      message: 'Authorization email sent. Please check your email to authorize this device.',
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Device authorization request error:', error);
    return NextResponse.json(
      { error: 'Failed to request device authorization' },
      { status: 500 }
    );
  }
}

