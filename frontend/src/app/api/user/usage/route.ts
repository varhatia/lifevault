import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/api/auth';
import { bytesToMB } from '@/lib/plan-limits';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET_NAME, USE_LOCAL_STORAGE, LOCAL_STORAGE_DIR } from '@/lib/api/s3';
import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * @route   GET /api/user/usage
 * @desc    Get current usage statistics for the authenticated user
 * @access  Private
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = String(user.id);

    // Get vault count (MyVaults owned by user)
    const vaultCount = await prisma.myVault.count({
      where: { ownerId: userId },
    });

    // Get nominee count (all nominees across all vaults)
    const nomineeCount = await prisma.nominee.count({
      where: {
        userId: userId,
        isActive: true,
      },
    });

    // Get member count for the vault the user owns (if any)
    // Member limit is per-vault: each vault can have up to 2 members
    // Count members in the vault where user is owner (free plan allows only 1 vault)
    const myVault = await prisma.myVault.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });

    let myVaultMemberCount = 0;
    if (myVault) {
      myVaultMemberCount = await prisma.myVaultMember.count({
        where: {
          myVaultId: myVault.id,
          isActive: true,
          userId: { not: userId }, // Exclude owner
        },
      });
    }

    // Note: 
    // - FamilyVault members and nominees are not counted toward member limit
    // - Member limit is per-vault (each vault can have up to 2 members)
    // - If user is a member of other vaults, those don't count toward their limit
    const totalMemberCount = myVaultMemberCount;

    // Calculate storage usage
    // Get all items with s3Key (files) for MyVaults owned by user
    const myVaultIds = await prisma.myVault.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });

    // Get all items with files in MyVaults
    const myVaultItems = await prisma.vaultItem.findMany({
      where: {
        myVaultId: { in: myVaultIds.map(v => v.id) },
        s3Key: { not: null },
      },
      select: { s3Key: true },
    });

    let totalStorageBytes = 0;

    const allS3Keys = myVaultItems.map(item => item.s3Key).filter(Boolean) as string[];

    if (USE_LOCAL_STORAGE || !s3Client || !BUCKET_NAME) {
      // Local development: calculate size from local encrypted files
      for (const s3Key of allS3Keys) {
        try {
          const filePath = join(LOCAL_STORAGE_DIR, s3Key.replace(/\//g, '_'));
          const stat = await fs.stat(filePath);
          totalStorageBytes += stat.size;
        } catch (error) {
          console.error(`Failed to get local file size for ${s3Key}:`, error);
        }
      }
    } else {
      // Production: calculate storage from S3
      for (const s3Key of allS3Keys) {
        try {
          const command = new HeadObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
          });
          const response = await s3Client.send(command);
          if (response.ContentLength) {
            totalStorageBytes += response.ContentLength;
          }
        } catch (error) {
          console.error(`Failed to get size for ${s3Key}:`, error);
          // Continue with other files
        }
      }
    }

    const storageUsedMB = bytesToMB(totalStorageBytes);

    // Fetch subscription plan directly from database
    const userWithPlan = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
      },
    });

    const plan = (userWithPlan?.subscriptionPlan || "free") as "free" | "plus";

    return NextResponse.json({
      usage: {
        vaultCount,
        nomineeCount,
        memberCount: totalMemberCount,
        storageUsedMB,
      },
      plan,
      subscriptionStatus: userWithPlan?.subscriptionStatus || null,
      subscriptionExpiresAt: userWithPlan?.subscriptionExpiresAt?.toISOString() || null,
    });
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage statistics' },
      { status: 500 }
    );
  }
}


