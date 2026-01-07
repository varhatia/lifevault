import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';

const ROTATION_PERIOD_DAYS = 180; // Fixed 6-month rotation period

/**
 * @route   GET /api/account/security-rotation
 * @desc    Get account-level security rotation status (account password)
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

    const now = new Date();

    // Get user details with security info
    const userDetails = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        lastPasswordChange: true,
        createdAt: true,
      },
    });

    if (!userDetails) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check account password rotation
    const accountPasswordBaseDate = userDetails.lastPasswordChange || userDetails.createdAt;
    const daysSinceAccountPassword = Math.floor(
      (now.getTime() - accountPasswordBaseDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const accountPasswordNeedsRotation = daysSinceAccountPassword >= ROTATION_PERIOD_DAYS;

    // Calculate overall rotation status
    const hasAnyRotationNeeded = accountPasswordNeedsRotation;

    return NextResponse.json({
      rotationPeriodDays: ROTATION_PERIOD_DAYS,
      hasRotationNeeded: hasAnyRotationNeeded,
      accountPassword: {
        hasPassword: true, // User always has a password
        lastChanged: userDetails.lastPasswordChange?.toISOString() || null,
        daysSinceChange: daysSinceAccountPassword,
        needsRotation: accountPasswordNeedsRotation,
      },
    });
  } catch (error) {
    console.error('Error fetching account security rotation status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account security rotation status' },
      { status: 500 }
    );
  }
}

