# Device Binding and Security Tracking Architecture

## Current State Analysis

### Account-Level Security (User Table)
- **Account Password**: `User.hashedPassword` + `User.lastPasswordChange`
  - Used for logging into the account
  - ✅ Correctly tracked at account level

### Vault-Level Security (MyVault Table)
- **Master Password**: Never stored (zero-knowledge), but tracked via `MyVault.masterPasswordVerifier`
  - Used to unlock/decrypt vault contents
  - Each vault has its own master password
  - ❌ Currently NOT tracked in My Account page
  - ❌ No timestamp for when master password was last changed

- **Recovery Key**: `MyVault.recoveryKeyEncryptedVaultKey` + `MyVault.recoveryKeyGeneratedAt`
  - Vault-specific recovery key
  - ✅ Stored per vault (correct)
  - ❌ Currently shown at User level in My Account (incorrect)

## Problem Statement

The My Account page currently shows:
1. **"Password Changed"** - Shows `User.lastPasswordChange` (Account password) ✅ Correct
2. **"Recovery Key"** - Shows `User.recoveryKeyGeneratedAt` ❌ **WRONG** - Recovery keys are vault-specific!

This creates confusion because:
- Users may have multiple vaults, each with its own recovery key
- The User-level recovery key field may not reflect the actual vault recovery keys
- Vault master password changes are not tracked at all

## Proposed Solution

### 1. Separate Account vs Vault Security Tracking

**Account-Level Security** (in My Account page):
- Account Password Change (`User.lastPasswordChange`)
- Email Verification
- Device Binding
- Last Login

**Vault-Level Security** (new section in My Account or separate page):
- Per-vault master password change tracking
- Per-vault recovery key tracking
- Vault unlock history

### 2. Database Schema Updates

Add tracking fields to `MyVault` model:
```prisma
model MyVault {
  // ... existing fields ...
  masterPasswordLastChanged DateTime? @map("master_password_last_changed") @db.Timestamptz(6)
  // recoveryKeyGeneratedAt already exists ✅
}
```

### 3. Implementation Plan

#### Step 1: Update Schema
- Add `masterPasswordLastChanged` to `MyVault` model
- Create migration

#### Step 2: Update Vault Key Management APIs
- When `masterPasswordVerifier` is updated, also update `masterPasswordLastChanged`
- Track this in:
  - `/api/vaults/my/[vaultId]/keys` (PUT endpoint)
  - `/api/vaults/my/[vaultId]/recovery-reset` (POST endpoint)

#### Step 3: Update Account API
- Remove User-level recovery key tracking
- Add vault-level security information
- Return per-vault security status

#### Step 4: Update My Account UI
- Separate "Account Security" and "Vault Security" sections
- Show per-vault master password and recovery key status
- Display last changed dates for each vault

### 4. API Changes

**New Endpoint**: `/api/account/vaults/security`
```typescript
GET /api/account/vaults/security
Response: {
  vaults: [{
    vaultId: string,
    vaultName: string,
    masterPassword: {
      lastChanged: string | null,
      daysSinceChange: number | null
    },
    recoveryKey: {
      generatedAt: string | null,
      daysSinceGeneration: number | null
    }
  }]
}
```

**Updated Endpoint**: `/api/account`
- Remove `recoveryKey` from User-level security
- Keep only account-level security indicators

### 5. UI Changes

**My Account Page Structure**:
```
1. Profile Information (Account-level)
2. Emergency Contact
3. Account Security (Account-level)
   - Email Verification
   - Device Binding
   - Account Password Change
   - Last Login
4. Vault Security (NEW - Vault-level)
   - List of vaults with:
     - Master Password Last Changed
     - Recovery Key Generated
     - Vault Unlock History
5. Trusted Devices
6. Recent Sign-Ins
```

## Benefits

1. **Clear Separation**: Users understand account vs vault security
2. **Accurate Tracking**: Per-vault recovery keys shown correctly
3. **Better Security Posture**: Track master password changes per vault
4. **Multi-Vault Support**: Properly handle users with multiple vaults
5. **Zero-Knowledge Compliance**: No passwords stored, only timestamps

## Migration Path

1. Add `masterPasswordLastChanged` field to schema
2. Backfill existing vaults (set to `recoveryKeyGeneratedAt` or `createdAt` as fallback)
3. Update APIs to track master password changes
4. Update My Account page to show vault-level security
5. Remove User-level recovery key display




