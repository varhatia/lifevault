# Difference: Server Key Part B vs Vault Recovery Key

## Overview

These are **two completely different keys** serving different purposes in the system:

### 1. **Vault Recovery Key** (Vault-Specific)
- **Purpose**: Allows the **vault owner** to unlock their vault if they forget their master password
- **Who uses it**: The vault owner themselves
- **Storage**: `MyVault.recoveryKeyEncryptedVaultKey` (per vault)
- **When created**: When vault is first set up or when recovery key is reset
- **How it works**: 
  - User generates a recovery key (random base64 string)
  - Vault key is encrypted with the recovery key
  - If user forgets master password, they can use recovery key to decrypt vault key
  - Recovery key is stored encrypted in the vault record

### 2. **Server Key Part B** (User-Level, for Nominee Access)
- **Purpose**: Part of **Shamir Secret Sharing** system to enable **nominee access** to the vault
- **Who uses it**: Nominees (with Part C) to access vault when user is unavailable
- **Storage**: `User.serverKeyPartB` (per user, shared across all nominees)
- **When created**: When the first nominee is added
- **How it works**:
  - Vault key is split into 3 parts using Shamir Secret Sharing (2-of-3 scheme):
    - **Part A**: User's part (stored locally in browser)
    - **Part B**: Server's part (stored encrypted on server)
    - **Part C**: Nominee's part (sent to nominee, encrypted)
  - To unlock vault, need **2 of 3 parts**:
    - User: Uses Part A + master password
    - Nominee: Uses Part B (from server) + Part C (from nominee)
  - Server Key Part B is shared across ALL nominees for a user

## Key Differences

| Aspect | Vault Recovery Key | Server Key Part B |
|--------|-------------------|-------------------|
| **Purpose** | Owner recovery (forgot password) | Nominee access (user unavailable) |
| **Who uses** | Vault owner | Nominees |
| **Storage** | Per vault (`MyVault`) | Per user (`User`) |
| **Scope** | One per vault | One per user (shared by all nominees) |
| **Encryption** | Encrypts vault key directly | Part of Shamir Secret Sharing |
| **When needed** | User forgets master password | User is unavailable/inactive |
| **Access level** | Full access (owner) | Read-only (nominee) |

## Visual Flow

### Vault Recovery Key Flow:
```
User forgets master password
    ↓
User enters recovery key
    ↓
Recovery key decrypts vault key
    ↓
User can access vault (full access)
```

### Server Key Part B Flow (Nominee Access):
```
User becomes unavailable
    ↓
Nominee provides Part C + password
    ↓
Server retrieves Part B (encrypted)
    ↓
Server combines Part B + Part C (Shamir reconstruction)
    ↓
Nominee gets read-only access to vault
```

## Why Both Exist?

1. **Recovery Key**: Personal backup for the owner
   - "I forgot my password, but I saved my recovery key"
   - Owner maintains full control

2. **Server Key Part B**: Emergency access for nominees
   - "I'm unavailable, but my nominee needs to access my vault"
   - Enables trusted third-party access (read-only)

## Security Rotation

Both keys need rotation every 180 days:
- **Recovery Key**: Rotated when user resets it (via RecoveryKeyResetModal)
- **Server Key Part B**: Rotated when user regenerates nominee keys (affects all nominees)

## Important Notes

1. **Recovery Key** is vault-specific - each vault has its own recovery key
2. **Server Key Part B** is user-level - one Part B is shared by all nominees across all vaults for that user
3. They serve completely different use cases and should not be confused
4. Both are tracked separately for security rotation reminders

