# Vault Security Tracking Implementation

## Overview

This document describes the separation of account-level and vault-level security tracking, and how readiness score will integrate vault password and recovery key rotation checks.

## Architecture

### Account-Level Security (User Table)
- **Account Password**: `User.hashedPassword` + `User.lastPasswordChange`
  - Used for logging into the account
  - Tracked at account level ✅

### Vault-Level Security (MyVault Table)
- **Master Password**: Tracked via `MyVault.masterPasswordVerifier` + `MyVault.masterPasswordLastChanged`
  - Used to unlock/decrypt vault contents
  - Each vault has its own master password
  - Timestamp tracked when verifier is updated ✅

- **Recovery Key**: `MyVault.recoveryKeyEncryptedVaultKey` + `MyVault.recoveryKeyGeneratedAt`
  - Vault-specific recovery key
  - Stored per vault ✅

## Implementation Details

### Database Schema
- Added `masterPasswordLastChanged` field to `MyVault` model
- Tracks when master password verifier is updated (indicates password change)

### API Endpoints

#### `/api/account/vaults/security` (NEW)
- Returns per-vault security information
- Includes master password and recovery key status
- Calculates days since last change/generation
- Flags vaults needing rotation (>90 days)

#### Updated `/api/vaults/my/[vaultId]/keys` (PUT)
- Now tracks `masterPasswordLastChanged` when verifier is updated
- Automatically sets timestamp when master password changes

#### Updated `/api/vaults/my/[vaultId]/recovery-reset` (POST)
- Updates vault's recovery key (not user-level)
- Sets `masterPasswordLastChanged` (recovery reset involves new master password)

### UI Changes

**My Account Page** now shows:
1. **Account Security Section**:
   - Account Password Change (User-level)
   - Email Verification
   - Device Binding
   - Last Login

2. **Vault Security Section** (NEW):
   - Per-vault master password status
   - Per-vault recovery key status
   - Days since last change/generation
   - Rotation warnings (>90 days)

## Readiness Score Integration (Future)

The readiness score calculation should check vault password and recovery key rotation when a vault is unlocked.

### Proposed Logic

```typescript
// In computeReadinessScore function
// Add to "Freshness & Maintenance" category (currently 15 pts)

// Check vault password rotation (5 pts)
const vaultPasswordRotated = vaults.some(vault => {
  if (!vault.masterPasswordLastChanged) return false;
  const daysSince = Math.floor(
    (Date.now() - new Date(vault.masterPasswordLastChanged).getTime()) / 
    (1000 * 60 * 60 * 24)
  );
  return daysSince <= 90;
});

// Check recovery key rotation (5 pts)
const recoveryKeyRotated = vaults.some(vault => {
  if (!vault.recoveryKeyGeneratedAt) return false;
  const daysSince = Math.floor(
    (Date.now() - new Date(vault.recoveryKeyGeneratedAt).getTime()) / 
    (1000 * 60 * 60 * 24)
  );
  return daysSince <= 90;
});

const freshnessPoints = 
  (itemsRecent ? 5 : 0) +
  (vaultPasswordRotated ? 5 : 0) +
  (recoveryKeyRotated ? 5 : 0);
```

### Integration Points

1. **Readiness Score Calculation** (`/app/my-vault/page.tsx`):
   - Fetch vault security data when calculating readiness
   - Include `masterPasswordLastChanged` and `recoveryKeyGeneratedAt` in inputs
   - Add rotation checks to freshness category

2. **Readiness Improvement Wizard**:
   - Add actions for vault password rotation (>90 days)
   - Add actions for recovery key rotation (>90 days)
   - Link to vault security management

3. **API Updates**:
   - Include vault security data in readiness score calculation inputs
   - Or fetch separately and merge in frontend

## Next Steps

1. ✅ Schema updated with `masterPasswordLastChanged`
2. ✅ APIs updated to track master password changes
3. ✅ My Account page shows vault security
4. ⏳ **TODO**: Update readiness score calculation to include vault password/key rotation
5. ⏳ **TODO**: Add rotation actions to Readiness Improvement Wizard

## Notes

- Master password changes are tracked when `masterPasswordVerifier` is updated
- Recovery key generation is tracked when `recoveryKeyEncryptedVaultKey` is set
- 90-day rotation window is recommended for optimal security
- Readiness score will incentivize regular rotation through points system

