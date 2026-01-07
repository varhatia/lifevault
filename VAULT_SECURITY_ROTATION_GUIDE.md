# Vault Security Rotation System

This document describes the vault security rotation reminder system that recommends users to rotate their vault keys every 6 months (180 days).

## Overview

The security rotation system is separate from the vault review system and focuses specifically on key rotation for security best practices. It is **not configurable** by users - the 180-day period is fixed.

## Components

### 1. Database Schema

Added fields to track key rotation:
- `MyVaultMember.keysLastRotatedAt` - When member keys were last rotated
- `Nominee.keysLastRotatedAt` - When nominee keys were last rotated
- `MyVault.masterPasswordLastChanged` - Already exists, tracks vault password changes
- `MyVault.recoveryKeyGeneratedAt` - Already exists, tracks recovery key generation

### 2. API Endpoints

#### GET `/api/account/security-rotation`
Returns account-level security rotation status:
- Account password rotation status (180 days)
- Overall `hasRotationNeeded` flag

#### GET `/api/vaults/my/[vaultId]/security-rotation`
Returns vault-level security rotation status for a vault:
- Master password rotation status (180 days)
- Recovery key rotation status (180 days)
- Member keys rotation status (all active members, 180 days)
- Nominee keys rotation status (all active nominees, 180 days)
- Overall `hasRotationNeeded` flag

#### POST `/api/vaults/security-rotation/reminders`
Cron job endpoint to send security rotation reminder emails:
- Checks all active vaults for vault-level rotation needs
- Checks all active users for account-level rotation needs
- Identifies items needing rotation (180+ days)
- Sends email reminders to users
- Includes details of what needs rotation (account password, vault password, recovery key, members, nominees)

### 3. Email Notifications

**Function**: `sendVaultSecurityRotationReminderEmail`
- Sent automatically every 180 days via cron job
- Includes list of items needing rotation
- Provides link to vault for rotation

### 4. UI Components

**Security Rotation Nudge Banners**:
- **Account Security Nudge**: Red banner for account-level rotation (account password)
- **Vault Security Nudge**: Red banner for vault-level rotation (vault password, recovery key, members, nominees)
- Shows which items need rotation with days since last rotation
- Call To Action buttons to reset password/recovery key
- Account nudge visible to all users
- Vault nudge only visible to vault owners when vault is unlocked

## Rotation Period

- **Fixed Period**: 180 days (6 months)
- **Not Configurable**: Users cannot change this period
- **System-Generated**: Reminders are sent automatically via cron job

## What Gets Rotated

### Account-Level (User Table)
1. **Account Password** - User changes account login password (180 days)

### Vault-Level (MyVault Table)
1. **Vault Master Password** - User changes vault password (180 days)
2. **Recovery Key** - User generates new recovery key (180 days)
3. **Member Keys** - Vault owner rotates keys for all active members (180 days)
4. **Nominee Keys** - Vault owner rotates keys for all active nominees (180 days)

## Implementation Details

### Tracking Rotation

When keys are rotated:
- **Master Password**: `MyVault.masterPasswordLastChanged` is updated automatically
- **Recovery Key**: `MyVault.recoveryKeyGeneratedAt` is updated automatically
- **Member Keys**: `MyVaultMember.keysLastRotatedAt` should be updated (to be implemented in rotation flow)
- **Nominee Keys**: `Nominee.keysLastRotatedAt` should be updated (to be implemented in rotation flow)

### Cron Job Setup

Add to `vercel.json` or your cron service:
```json
{
  "crons": [
    {
      "path": "/api/vaults/security-rotation/reminders",
      "schedule": "0 9 * * *"
    }
  ]
}
```

This runs daily at 9 AM UTC to check and send reminders.

### Testing

To test the system, update database fields to simulate old keys:

```sql
-- Make master password need rotation (set to 200 days ago)
UPDATE my_vaults 
SET master_password_last_changed = NOW() - INTERVAL '200 days'
WHERE id = 'YOUR_VAULT_ID';

-- Make recovery key need rotation
UPDATE my_vaults 
SET recovery_key_generated_at = NOW() - INTERVAL '200 days'
WHERE id = 'YOUR_VAULT_ID';

-- Make member keys need rotation
UPDATE my_vault_members 
SET keys_last_rotated_at = NOW() - INTERVAL '200 days'
WHERE my_vault_id = 'YOUR_VAULT_ID';

-- Make nominee keys need rotation
UPDATE nominees 
SET keys_last_rotated_at = NOW() - INTERVAL '200 days'
WHERE my_vault_id = 'YOUR_VAULT_ID';
```

## Next Steps

1. **Run Database Migration**: 
   ```bash
   cd frontend
   pnpm prisma migrate dev --name add_key_rotation_tracking
   ```

2. **Update Rotation Flows**: When users rotate keys, update the `keysLastRotatedAt` fields:
   - Member key rotation: Update `MyVaultMember.keysLastRotatedAt`
   - Nominee key rotation: Update `Nominee.keysLastRotatedAt`

3. **Set Up Cron Job**: Configure the cron job endpoint in your deployment platform

4. **Test Email Sending**: Verify email delivery in development and production

## Notes

- The system is separate from vault review reminders
- Rotation reminders are security-focused and not optional
- Users will see both review reminders (configurable) and security rotation reminders (fixed 180 days)
- The nudge appears in-app when vault is unlocked and rotation is needed
- Email reminders are sent automatically via cron job

