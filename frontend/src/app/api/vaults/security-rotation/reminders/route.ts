import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendVaultSecurityRotationReminderEmail } from '@/lib/api/email';

const ROTATION_PERIOD_DAYS = 180; // Fixed 6-month rotation period

/**
 * @route   POST /api/vaults/security-rotation/reminders
 * @desc    Send security rotation reminder emails (called by cron job)
 * @access  Internal (cron job only)
 */
export async function POST(req: NextRequest) {
  try {
    // Optional: Add authentication/authorization for cron job
    const authHeader = req.headers.get('authorization');
    const vercelCronHeader = req.headers.get('x-vercel-cron');
    const cronSecret = process.env.CRON_SECRET;

    // If CRON_SECRET is set, require authentication
    if (cronSecret) {
      const isVercelCron = vercelCronHeader === '1' || vercelCronHeader === 'true';
      const hasValidToken = authHeader === `Bearer ${cronSecret}`;

      if (!isVercelCron && !hasValidToken) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const now = new Date();
    const results = {
      vaultsChecked: 0,
      vaultRemindersSent: 0,
      accountsChecked: 0,
      accountRemindersSent: 0,
      errors: [] as string[],
    };

    // Get all active vaults
    const vaults = await prisma.myVault.findMany({
      where: {
        // Only check vaults that have been set up (have verifier or recovery key)
        OR: [
          { masterPasswordVerifier: { not: null } },
          { recoveryKeyEncryptedVaultKey: { not: null } },
        ],
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        masterPasswordLastChanged: true,
        recoveryKeyGeneratedAt: true,
        createdAt: true,
        owner: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    results.vaultsChecked = vaults.length;

    for (const vault of vaults) {
      try {
        // Check master password rotation
        const masterPasswordBaseDate = vault.masterPasswordLastChanged || vault.createdAt;
        const daysSinceMasterPassword = Math.floor(
          (now.getTime() - masterPasswordBaseDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const masterPasswordNeedsRotation = daysSinceMasterPassword >= ROTATION_PERIOD_DAYS;

        // Check recovery key rotation
        const recoveryKeyBaseDate = vault.recoveryKeyGeneratedAt || vault.createdAt;
        const daysSinceRecoveryKey = Math.floor(
          (now.getTime() - recoveryKeyBaseDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const recoveryKeyNeedsRotation = daysSinceRecoveryKey >= ROTATION_PERIOD_DAYS;

        // Get members that need rotation
        const members = await prisma.myVaultMember.findMany({
          where: {
            myVaultId: vault.id,
            isActive: true,
          },
          select: {
            id: true,
            userId: true,
            user: {
              select: {
                email: true,
                fullName: true,
              },
            },
            keysLastRotatedAt: true,
            acceptedAt: true,
            createdAt: true,
          },
        });

        const membersNeedingRotation = members.filter((member) => {
          const baseDate = member.keysLastRotatedAt || member.acceptedAt || member.createdAt;
          const daysSinceRotation = Math.floor(
            (now.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          return daysSinceRotation >= ROTATION_PERIOD_DAYS;
        });

        // Get nominees that need rotation
        const nominees = await prisma.nominee.findMany({
          where: {
            myVaultId: vault.id,
            isActive: true,
          },
          select: {
            id: true,
            nomineeName: true,
            nomineeEmail: true,
            keysLastRotatedAt: true,
            createdAt: true,
          },
        });

        const nomineesNeedingRotation = nominees.filter((nominee) => {
          const baseDate = nominee.keysLastRotatedAt || nominee.createdAt;
          const daysSinceRotation = Math.floor(
            (now.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          return daysSinceRotation >= ROTATION_PERIOD_DAYS;
        });

        // Check if any rotation is needed
        const hasAnyRotationNeeded =
          masterPasswordNeedsRotation ||
          recoveryKeyNeedsRotation ||
          membersNeedingRotation.length > 0 ||
          nomineesNeedingRotation.length > 0;

        if (hasAnyRotationNeeded) {
          // Send reminder email
          await sendVaultSecurityRotationReminderEmail(
            vault.owner.email,
            vault.owner.fullName,
            vault.name,
            {
              masterPassword: masterPasswordNeedsRotation,
              recoveryKey: recoveryKeyNeedsRotation,
              members: membersNeedingRotation.map((m) => ({
                email: m.user.email,
                fullName: m.user.fullName,
              })),
              nominees: nomineesNeedingRotation.map((n) => ({
                name: n.nomineeName,
                email: n.nomineeEmail,
              })),
            }
          );

          results.vaultRemindersSent++;
        }
      } catch (error) {
        console.error(`Error processing vault ${vault.id}:`, error);
        results.errors.push(`Failed to process vault ${vault.name}`);
      }
    }

    // Check account-level security rotation (account password only)
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        lastPasswordChange: true,
        createdAt: true,
      },
    });

    results.accountsChecked = users.length;

    for (const user of users) {
      try {
        // Check account password rotation
        const accountPasswordBaseDate = user.lastPasswordChange || user.createdAt;
        const daysSinceAccountPassword = Math.floor(
          (now.getTime() - accountPasswordBaseDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const accountPasswordNeedsRotation = daysSinceAccountPassword >= ROTATION_PERIOD_DAYS;

        // Check if account-level rotation is needed
        if (accountPasswordNeedsRotation) {
          // Send account-level reminder email
          await sendVaultSecurityRotationReminderEmail(
            user.email,
            user.fullName,
            'Account Security', // Use generic name for account-level
            {
              masterPassword: accountPasswordNeedsRotation,
              recoveryKey: false, // Not applicable for account-level
              members: [], // Not applicable for account-level
              nominees: [], // Not applicable for account-level
            }
          );

          results.accountRemindersSent++;
        }
      } catch (error) {
        console.error(`Error processing account ${user.id}:`, error);
        results.errors.push(`Failed to process account ${user.email}`);
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      message: `Processed ${results.vaultsChecked} vaults (${results.vaultRemindersSent} reminders), ${results.accountsChecked} accounts (${results.accountRemindersSent} reminders)`,
    });
  } catch (error) {
    console.error('Error sending security rotation reminders:', error);
    return NextResponse.json(
      { error: 'Failed to send security rotation reminders' },
      { status: 500 }
    );
  }
}

