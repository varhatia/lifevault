/**
 * Plan limits and utility functions for freemium model
 */

export type SubscriptionPlan = "free" | "plus";

export interface PlanLimits {
  maxVaults: number;
  maxNominees: number;
  maxAdditionalMembers: number; // Total members = owner + additional members
  maxStorageMB: number;
  allowMultipleNominees: boolean;
  allowExport: boolean;
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  free: {
    maxVaults: 1, // User can own only 1 vault
    maxNominees: 1,
    maxAdditionalMembers: 2, // Per vault: each vault can have up to 2 members (owner + 2 members)
    maxStorageMB: 5,
    allowMultipleNominees: false,
    allowExport: false,
  },
  plus: {
    maxVaults: Infinity,
    maxNominees: Infinity,
    maxAdditionalMembers: Infinity,
    maxStorageMB: Infinity,
    allowMultipleNominees: true,
    allowExport: true,
  },
};

export interface UsageStats {
  vaultCount: number;
  nomineeCount: number;
  memberCount: number; // Total members across all vaults (excluding owner)
  storageUsedMB: number;
}

/**
 * Get plan limits for a user
 */
export function getPlanLimits(plan: SubscriptionPlan): PlanLimits {
  return PLAN_LIMITS[plan];
}

/**
 * Check if user can create a new vault
 */
export function canCreateVault(plan: SubscriptionPlan, currentVaultCount: number): boolean {
  const limits = getPlanLimits(plan);
  return currentVaultCount < limits.maxVaults;
}

/**
 * Check if user can add a nominee
 */
export function canAddNominee(
  plan: SubscriptionPlan,
  currentNomineeCount: number,
  vaultNomineeCount?: number
): boolean {
  const limits = getPlanLimits(plan);
  
  // Free plan: only 1 nominee total, and only 1 per vault
  if (plan === "free") {
    return currentNomineeCount < limits.maxNominees && (!vaultNomineeCount || vaultNomineeCount === 0);
  }
  
  // Plus plan: unlimited
  return true;
}

/**
 * Check if user can add a member to a vault
 * Note: owner is not counted in member count
 * Member limit is per-vault: each vault can have up to 2 members
 */
export function canAddMember(
  plan: SubscriptionPlan,
  currentMemberCount: number // Members in this specific vault (excluding owner)
): boolean {
  const limits = getPlanLimits(plan);
  return currentMemberCount < limits.maxAdditionalMembers;
}

/**
 * Check if user can upload file based on storage limit
 */
export function canUploadFile(
  plan: SubscriptionPlan,
  currentStorageMB: number,
  fileSizeMB: number
): boolean {
  const limits = getPlanLimits(plan);
  return currentStorageMB + fileSizeMB <= limits.maxStorageMB;
}

/**
 * Get storage limit message
 */
export function getStorageLimitMessage(plan: SubscriptionPlan): string {
  const limits = getPlanLimits(plan);
  if (limits.maxStorageMB === Infinity) {
    return "Unlimited storage";
  }
  return `${limits.maxStorageMB} MB`;
}

/**
 * Format bytes to MB
 */
export function bytesToMB(bytes: number): number {
  return bytes / (1024 * 1024);
}

/**
 * Format MB to human readable string
 */
export function formatStorageMB(mb: number): string {
  if (mb < 1) {
    return `${(mb * 1024).toFixed(0)} KB`;
  }
  return `${mb.toFixed(2)} MB`;
}


