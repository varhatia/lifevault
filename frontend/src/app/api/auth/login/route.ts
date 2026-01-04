import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPassword, signAuthToken, AUTH_COOKIE_NAME } from '@/lib/api/auth';
import { generateDeviceFingerprint, getDeviceName } from '@/lib/device-fingerprint';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, deviceFingerprint, deviceName } = body || {};

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

    // Capture basic request context for logging (no secrets)
    const ip =
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      null;
    const userAgent = req.headers.get('user-agent') || null;

    // Handle device binding
    let deviceAuthorized = false;
    let requiresDeviceAuthorization = false;

    if (deviceFingerprint) {
      // Check if device is trusted
      const trustedDevice = await prisma.trustedDevice.findUnique({
        where: {
          userId_deviceFingerprint: {
            userId: user.id,
            deviceFingerprint,
          },
        },
      });

      if (trustedDevice && trustedDevice.isActive) {
        // Device is trusted - update last used timestamp
        await prisma.trustedDevice.update({
          where: { id: trustedDevice.id },
          data: { lastUsedAt: now },
        });
        deviceAuthorized = true;
      } else {
        // Device is not trusted - requires authorization
        requiresDeviceAuthorization = true;
        
        // Generate device name if not provided
        const finalDeviceName = deviceName || getDeviceName(userAgent || '');
        
        // Create or update device record (inactive)
        if (trustedDevice) {
          await prisma.trustedDevice.update({
            where: { id: trustedDevice.id },
            data: {
              deviceName: finalDeviceName,
              userAgent: userAgent || null,
              ipAddress: ip,
              isActive: false,
            },
          });
        } else {
          await prisma.trustedDevice.create({
            data: {
              userId: user.id,
              deviceFingerprint,
              deviceName: finalDeviceName,
              userAgent: userAgent || null,
              ipAddress: ip,
              isActive: false,
            },
          });
        }
      }
    }

    // If device requires authorization, return error with flag
    if (requiresDeviceAuthorization) {
      return NextResponse.json(
        {
          error: 'Device authorization required',
          requiresDeviceAuthorization: true,
          deviceFingerprint,
        },
        { status: 403 }
      );
    }

    // Update lastLogin timestamp for inactivity monitoring
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: now },
    });

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
          metadata: {
            deviceAuthorized,
            deviceFingerprint: deviceFingerprint || null,
          },
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
      deviceAuthorized,
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
