# Master Password Recovery - Zero-Knowledge Architecture

## ⚠️ Critical: Master Password Cannot Be Recovered

In LifeVault's **zero-knowledge architecture**, the master password **cannot be recovered or reset**. This is by design for security.

### Why Master Password Cannot Be Recovered

1. **Zero-Knowledge Architecture**
   - Master password **never leaves the browser**
   - Server never sees or stores the master password
   - All encryption happens client-side

2. **Data Encryption**
   - Master password is used to derive the encryption key
   - All vault data is encrypted with this key
   - Without the key, data is **permanently inaccessible**

3. **Security vs. Convenience**
   - Recoverable passwords = security risk
   - If we could reset it, we could decrypt your data
   - This defeats the purpose of zero-knowledge encryption

## How We Track Master Password Setup

### Server-Side Tracking

We track whether a user has **completed vault setup** (set their master password):

- **`vaultSetupCompleted`** (Boolean): `true` if user has set master password
- **`vaultSetupCompletedAt`** (DateTime): When vault setup was completed

This is **NOT** the master password itself - just a flag that setup is done.

### Client-Side Tracking

- **`localStorage.vaultKeyInitialized`**: Client-side flag (can be cleared)

### API Endpoints

- **`GET /api/auth/vault-setup`**: Check if vault setup is completed
- **`POST /api/auth/vault-setup`**: Mark vault setup as completed

## What Happens If User Forgets Master Password?

### Scenario 1: User Forgets Master Password

**Result**: **All vault data is permanently lost**

- Cannot decrypt existing files
- Cannot access vault items
- Server cannot help (doesn't have the password)

### Scenario 2: User Clears Browser Data

**Result**: Must re-enter master password to unlock vault

- `localStorage` is cleared
- User must enter master password again
- If password is forgotten → data is lost

## Recovery Options (Future Enhancements)

While master password **cannot be recovered**, there are potential recovery mechanisms:

### 1. **Recovery Key** (Recommended)
- Generate a recovery key during setup
- User stores it securely (password manager, safe, etc.)
- Can be used to decrypt vault if master password is forgotten
- **Not yet implemented**

### 2. **Nominee Access** (Already Planned)
- Nominee can access vault using Shamir Secret Sharing
- Requires Part C key from nominee
- Read-only access
- **Already in schema, needs implementation**

### 3. **Backup Encryption Key**
- Export encrypted backup key during setup
- User stores it securely
- Can restore vault with backup key
- **Not yet implemented**

## Best Practices for Users

1. **Use a Password Manager**
   - Store master password in a secure password manager
   - Use a strong, unique password

2. **Write It Down Securely**
   - Physical backup in a safe
   - Share with trusted family member (separate from nominee)

3. **Set Up Nominee**
   - Configure nominee access as backup
   - Nominee can access vault if needed

4. **Regular Backups**
   - Export encrypted backups periodically
   - Store backups securely

## Current Implementation Status

✅ **Implemented:**
- Server-side tracking of vault setup completion
- Client-side flag for vault initialization
- Setup page that marks completion

❌ **Not Implemented:**
- Master password recovery
- Recovery key generation
- Backup key export
- Password reset flow

## Database Schema

```prisma
model User {
  vaultSetupCompleted Boolean @default(false)  // Has user set master password?
  vaultSetupCompletedAt DateTime?              // When was it set?
  // ... other fields
}
```

## API Usage

### Check Setup Status
```typescript
const res = await fetch("/api/auth/vault-setup");
const { vaultSetupCompleted, vaultSetupCompletedAt } = await res.json();
```

### Mark Setup Complete
```typescript
await fetch("/api/auth/vault-setup", {
  method: "POST",
});
```

## Summary

- ✅ **We track** if user has set master password (server-side)
- ❌ **We cannot** recover or reset master password
- ⚠️ **If forgotten**, vault data is permanently lost
- 🔐 **This is by design** - zero-knowledge security

**Recommendation**: Implement recovery key generation in future versions to provide a secure recovery mechanism while maintaining zero-knowledge architecture.


