import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth';
import prisma from '@/lib/prisma';

export type VaultType = 'my_vault' | 'family_vault';

/**
 * Shared utility to invalidate nominees for a vault after recovery key reset
 */
export async function invalidateNomineesForVault(
  vaultType: VaultType,
  vaultId: string,
  userId: string
) {
  const whereClause: any = {
    userId: userId,
    isActive: true,
  };

  if (vaultType === 'my_vault') {
    whereClause.myVaultId = vaultId;
  } else {
    whereClause.familyVaultId = vaultId;
  }

  await prisma.nominee.updateMany({
    where: whereClause,
    data: {
      isActive: false,
    },
  });
}

/**
 * Shared utility to verify vault ownership
 */
export async function verifyVaultOwnership(
  vaultType: VaultType,
  vaultId: string,
  userId: string
) {
  if (vaultType === 'my_vault') {
    const myVault = await prisma.myVault.findFirst({
      where: { id: vaultId, ownerId: userId },
    });
    return myVault;
  } else {
    // For family vault, check if user is a member (admin can reset)
    const member = await prisma.familyMember.findFirst({
      where: {
        familyVaultId: vaultId,
        userId: userId,
        role: 'admin', // Only admin can reset recovery key
      },
      include: {
        familyVault: true,
      },
    });
    return member?.familyVault || null;
  }
}

