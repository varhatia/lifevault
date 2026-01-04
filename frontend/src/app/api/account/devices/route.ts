import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';

/**
 * @route   GET /api/account/devices
 * @desc    Get list of trusted devices for the user
 * @access  Private
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const devices = await prisma.trustedDevice.findMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      orderBy: {
        lastUsedAt: 'desc',
      },
      select: {
        id: true,
        deviceFingerprint: true,
        deviceName: true,
        userAgent: true,
        ipAddress: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      devices: devices.map(device => ({
        id: device.id,
        name: device.deviceName,
        userAgent: device.userAgent,
        ipAddress: device.ipAddress,
        lastUsedAt: device.lastUsedAt,
        createdAt: device.createdAt,
        fingerprint: device.deviceFingerprint.substring(0, 8) + '...', // Partial for display
      })),
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch devices' },
      { status: 500 }
    );
  }
}

/**
 * @route   DELETE /api/account/devices
 * @desc    Revoke/remove a trusted device
 * @access  Private
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { deviceId } = body || {};

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID is required' },
        { status: 400 }
      );
    }

    // Verify device belongs to user
    const device = await prisma.trustedDevice.findFirst({
      where: {
        id: deviceId,
        userId: user.id,
      },
    });

    if (!device) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }

    // Deactivate device (soft delete)
    await prisma.trustedDevice.update({
      where: { id: deviceId },
      data: { isActive: false },
    });

    // Log activity
    try {
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          vaultType: 'account',
          action: 'device_revoked',
          description: `Device "${device.deviceName}" revoked`,
          metadata: {
            deviceId,
            deviceFingerprint: device.deviceFingerprint,
          },
          createdAt: new Date(),
        },
      });
    } catch (logError) {
      console.error('Failed to log device revocation:', logError);
    }

    return NextResponse.json({
      success: true,
      message: 'Device revoked successfully',
    });
  } catch (error) {
    console.error('Error revoking device:', error);
    return NextResponse.json(
      { error: 'Failed to revoke device' },
      { status: 500 }
    );
  }
}

