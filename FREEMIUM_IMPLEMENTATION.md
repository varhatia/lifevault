# Freemium Feature Limits Implementation

## Overview
This document tracks the implementation of freemium feature limits for LifeVault, where free users have restricted access and paid users get unlimited access.

## Free Plan Limits
- **1 Vault** (MyVault only)
- **1 Nominee** (total across all vaults)
- **Up to 2 Additional Members** (owner + 2 additional = 3 total)
- **5 MB Storage**

## Plus Plan Limits
- **Unlimited vaults**
- **Unlimited nominees** (with priority order)
- **Unlimited members**
- **Unlimited storage**
- **Export vault** (PDF/ZIP for offline safekeeping)

## Implementation Status

### ✅ Completed
1. **Database Schema** - Added subscription plan fields to User model
   - `subscriptionPlan` (default: "free")
   - `subscriptionStatus` (optional)
   - `subscriptionExpiresAt` (optional)

2. **Plan Limits Utility** (`frontend/src/lib/plan-limits.ts`)
   - Plan limit definitions
   - Helper functions: `canCreateVault`, `canAddNominee`, `canAddMember`, `canUploadFile`
   - Storage formatting utilities

3. **Usage Stats API** (`frontend/src/app/api/user/usage/route.ts`)
   - Returns current usage: vault count, nominee count, member count, storage used
   - Calculates storage from S3 file sizes

4. **Vault Creation Limit** (`frontend/src/app/api/vaults/my/route.ts`)
   - Checks plan limits before creating vault
   - Returns error with upgrade message if limit reached

5. **Nominee Addition Limit** (`frontend/src/app/api/nominee/route.ts`)
   - Checks plan limits before adding nominee
   - Free plan: 1 nominee total, 1 per vault
   - Returns error with upgrade message if limit reached

### 🚧 In Progress
6. **Member Addition Limits** - Need to add to:
   - `frontend/src/app/api/vaults/my/[vaultId]/members/route.ts`
   - `frontend/src/app/api/family/vaults/[vaultId]/members/route.ts`

7. **Storage Limit Checks** - Need to add to:
   - `frontend/src/app/api/vaults/my/[vaultId]/items/route.ts`
   - `frontend/src/app/api/family/vaults/[vaultId]/items/route.ts`

### 📋 Pending
8. **UpgradeModal Component** - Modal to prompt users to upgrade
9. **Usage Hook** - React hook to fetch and track user plan/usage
10. **UI Integration** - Add limit checks and upgrade prompts in:
    - Vault creation UI
    - Nominee addition UI
    - Member addition UI
    - File upload UI (with storage usage display)

## Next Steps

1. Complete member addition limit checks in both APIs
2. Add storage limit checks in file upload APIs
3. Create UpgradeModal component
4. Create usePlanUsage hook
5. Integrate checks and modals in UI components
6. Run database migration to add subscription fields

## Migration Note
The Prisma migration needs to be run manually:
```bash
cd frontend
npx prisma migrate dev --name add_subscription_plan
```


