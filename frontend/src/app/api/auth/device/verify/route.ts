import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * @route   GET /api/auth/device/verify
 * @desc    Verify device authorization token and activate device
 * @access  Public (via email link)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const deviceFingerprint = searchParams.get('fingerprint');

    if (!token || !deviceFingerprint) {
      return NextResponse.json(
        { error: 'Token and device fingerprint are required' },
        { status: 400 }
      );
    }

    // For MVP, we'll use a simplified approach
    // In production, you'd have a DeviceAuthorization table with tokens
    // For now, we'll verify the token format and activate the device
    // This is a simplified implementation - in production, store tokens securely

    // Find the device by fingerprint (should be inactive)
    const device = await prisma.trustedDevice.findFirst({
      where: {
        deviceFingerprint,
        isActive: false,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    if (!device) {
      return NextResponse.json(
        { error: 'Device authorization not found or already activated' },
        { status: 400 }
      );
    }

    // Verify token hash
    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    // Check if token hash matches and is not expired
    if (!device.authorizationTokenHash || device.authorizationTokenHash !== tokenHash) {
      return NextResponse.json(
        { error: 'Invalid authorization token' },
        { status: 400 }
      );
    }

    if (device.authorizationTokenExpires && device.authorizationTokenExpires < new Date()) {
      return NextResponse.json(
        { error: 'Authorization token has expired. Please request a new authorization.' },
        { status: 400 }
      );
    }

    // Activate the device and clear authorization token
    await prisma.trustedDevice.update({
      where: { id: device.id },
      data: {
        isActive: true,
        lastUsedAt: new Date(),
        authorizationTokenHash: null, // Clear token after use
        authorizationTokenExpires: null,
      },
    });

    // Log activity
    try {
      await prisma.activityLog.create({
        data: {
          userId: device.userId,
          vaultType: 'account',
          action: 'device_authorized',
          description: `Device "${device.deviceName}" authorized successfully`,
          ipAddress: device.ipAddress,
          userAgent: device.userAgent,
          metadata: {
            deviceFingerprint,
          },
          createdAt: new Date(),
        },
      });
    } catch (logError) {
      console.error('Failed to log device authorization:', logError);
    }

    return NextResponse.json({
      success: true,
      message: 'Device authorized successfully. You can now log in from this device.',
      device: {
        id: device.id,
        name: device.deviceName,
      },
    });
  } catch (error) {
    console.error('Device verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify device authorization' },
      { status: 500 }
    );
  }
}

