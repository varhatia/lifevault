import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';

/**
 * @route   GET /api/account
 * @desc    Get user account details including profile and security information
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

    // Fetch full user details
    const userDetails = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        emailVerified: true,
        emailVerifiedAt: true,
        lastPasswordChange: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        serverKeyPartBKeyVersion: true,
        serverKeyPartBEncryptedAt: true,
        recoveryKeyGeneratedAt: true,
        vaultSetupCompleted: true,
        vaultSetupCompletedAt: true,
      },
    });

    if (!userDetails) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Fetch recent login activity logs
    const recentLogins = await prisma.activityLog.findMany({
      where: {
        userId: user.id,
        action: 'login_success',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
      select: {
        id: true,
        action: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        metadata: true,
      },
    });

    // Fetch emergency contact from nominees (if any active nominee exists)
    // For now, we'll check if there's a nominee that could serve as emergency contact
    const nominees = await prisma.nominee.findMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      select: {
        id: true,
        nomineeName: true,
        nomineeEmail: true,
        nomineePhone: true,
        accessTriggerDays: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1, // Get the most recent active nominee as potential emergency contact
    });

    // Parse user agent to extract device info
    const parseUserAgent = (userAgent: string | null) => {
      if (!userAgent) return { device: 'Unknown', browser: 'Unknown', os: 'Unknown' };
      
      // Simple parsing - can be enhanced
      let device = 'Desktop';
      let browser = 'Unknown';
      let os = 'Unknown';

      if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
        device = 'Mobile';
      } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
        device = 'Tablet';
      }

      if (userAgent.includes('Chrome')) browser = 'Chrome';
      else if (userAgent.includes('Firefox')) browser = 'Firefox';
      else if (userAgent.includes('Safari')) browser = 'Safari';
      else if (userAgent.includes('Edge')) browser = 'Edge';

      if (userAgent.includes('Windows')) os = 'Windows';
      else if (userAgent.includes('Mac')) os = 'macOS';
      else if (userAgent.includes('Linux')) os = 'Linux';
      else if (userAgent.includes('Android')) os = 'Android';
      else if (userAgent.includes('iOS') || userAgent.includes('iPhone')) os = 'iOS';

      return { device, browser, os };
    };

    // Format recent logins with parsed device info
    const formattedLogins = recentLogins.map((log) => {
      const deviceInfo = parseUserAgent(log.userAgent);
      return {
        id: log.id,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        device: deviceInfo.device,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        timestamp: log.createdAt,
        metadata: log.metadata,
      };
    });

    // Check for device binding status - check if user has any trusted devices
    const trustedDevicesCount = await prisma.trustedDevice.count({
      where: {
        userId: user.id,
        isActive: true,
      },
    });
    const hasDeviceBinding = trustedDevicesCount > 0;

    // Calculate security score indicators
    const accountCreatedAt = new Date(userDetails.createdAt).getTime();
    const now = Date.now();
    
    // For password change: if never changed, use account creation date as baseline
    // Password should be changed within 90 days of account creation
    const passwordLastChanged = userDetails.lastPasswordChange 
      ? new Date(userDetails.lastPasswordChange).getTime()
      : accountCreatedAt; // Use account creation as baseline for first-time users
    
    const daysSincePasswordChange = Math.floor((now - passwordLastChanged) / (1000 * 60 * 60 * 24));
    const passwordShouldBeChangedBy = accountCreatedAt + (180 * 24 * 60 * 60 * 1000); // 180 days from account creation
    const daysUntilPasswordShouldChange = userDetails.lastPasswordChange 
      ? null // Already changed, no deadline
      : Math.max(0, Math.floor((passwordShouldBeChangedBy - now) / (1000 * 60 * 60 * 24))); // Days until 90-day deadline
    
    const securityIndicators = {
      emailVerified: userDetails.emailVerified,
      hasDeviceBinding,
      hasPasswordChanged: !!userDetails.lastPasswordChange,
      // Note: Recovery keys are vault-specific, not user-level
      vaultSetupCompleted: userDetails.vaultSetupCompleted,
      daysSincePasswordChange,
      daysUntilPasswordShouldChange, // For first-time users, when password should be changed
      passwordShouldBeChangedBy: userDetails.lastPasswordChange ? null : new Date(passwordShouldBeChangedBy).toISOString(),
      daysSinceLastLogin: userDetails.lastLogin
        ? Math.floor((Date.now() - new Date(userDetails.lastLogin).getTime()) / (1000 * 60 * 60 * 24))
        : null,
    };

    return NextResponse.json({
      profile: {
        email: userDetails.email,
        phone: userDetails.phone,
        fullName: userDetails.fullName,
        accountCreatedAt: userDetails.createdAt,
        lastUpdatedAt: userDetails.updatedAt,
      },
      emergencyContact: nominees.length > 0 ? {
        name: nominees[0].nomineeName,
        email: nominees[0].nomineeEmail,
        phone: nominees[0].nomineePhone,
        accessTriggerDays: nominees[0].accessTriggerDays,
        addedAt: nominees[0].createdAt,
      } : null,
      security: {
        emailVerified: userDetails.emailVerified,
        emailVerifiedAt: userDetails.emailVerifiedAt,
        deviceBinding: {
          enabled: hasDeviceBinding,
          keyPresent: hasDeviceBinding,
          trustedDevicesCount,
        },
        lastPasswordChange: userDetails.lastPasswordChange,
        lastLogin: userDetails.lastLogin,
        serverKeyPartB: {
          version: userDetails.serverKeyPartBKeyVersion,
          encryptedAt: userDetails.serverKeyPartBEncryptedAt,
        },
        // Note: Recovery keys are vault-specific, not user-level
        // Vault security information is available via /api/account/vaults/security
        vaultSetup: {
          completed: userDetails.vaultSetupCompleted,
          completedAt: userDetails.vaultSetupCompletedAt,
        },
      },
      recentLogins: formattedLogins,
      securityIndicators,
    });
  } catch (error) {
    console.error('Error fetching account details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account details' },
      { status: 500 }
    );
  }
}

