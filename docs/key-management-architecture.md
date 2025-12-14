# Key Management Architecture

## Overview

LifeVault implements a zero-knowledge encryption architecture where the service provider never has access to plaintext data. This document describes the complete key management system for both **MyVault** (personal vaults) and **FamilyVault** (shared vaults), including how keys are generated, stored, shared, and used by users, members, servers, and nominees.

---

## Table of Contents

1. [MyVault Key Management](#myvault-key-management)
2. [FamilyVault Key Management](#familyvault-key-management)
3. [Key Storage Locations](#key-storage-locations)
4. [Key Derivation](#key-derivation)
5. [Shamir Secret Sharing](#shamir-secret-sharing)
6. [Nominee Access Flow](#nominee-access-flow)
7. [Security Considerations](#security-considerations)

---

## MyVault Key Management

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    MyVault Key Management                    │
└─────────────────────────────────────────────────────────────┘

User (Client-Side)              Server                    Nominee
─────────────────              ──────                    ───────

Master Password                 Part B (Encrypted)        Part C (Encrypted)
     │                              │                          │
     │ PBKDF2                       │                          │
     ▼                              │                          │
Vault Key (AES-256)                 │                          │
     │                              │                          │
     │ Shamir Split (2-of-3)        │                          │
     ├─── Part A ───────────────────┼──────────────────────────┤
     │    (localStorage)            │                          │
     ├─── Part B ───────────────────► (User.serverKeyPartB)   │
     │    (encrypted)               │                          │
     └─── Part C ───────────────────┼──────────────────────────►
          (encrypted)                │                    (Encrypted + Password)
                                     │
```

### Key Components

#### 1. Master Password
- **Location**: User's memory (never stored)
- **Purpose**: Primary authentication and key derivation
- **Derivation**: Used with PBKDF2 to derive the vault encryption key
- **Security**: Never transmitted to server, never stored

#### 2. Vault Key (AES-256)
- **Generation**: Derived from master password using PBKDF2
- **Algorithm**: AES-256-GCM
- **Derivation Parameters**:
  - Salt: `"lifevault-mvp-static-salt"` (static for MVP, per-user in production)
  - Iterations: 310,000
  - Hash: SHA-256
- **Usage**: Encrypts/decrypts all vault items
- **Storage**: Never stored directly; split into parts using Shamir Secret Sharing

#### 3. Key Splitting (Shamir Secret Sharing - 2-of-3)

When a user adds their first nominee, the vault key is split into three parts:

**Part A - User's Local Key**
- **Location**: Browser `localStorage` (encrypted with master password)
- **Format**: Encrypted JSON payload containing verifier
- **Purpose**: Allows user to unlock vault with master password
- **Access**: User only (with master password)
- **Storage**: `localStorage.getItem("vaultVerifier")`

**Part B - Server Key**
- **Location**: Database (`User.serverKeyPartB`)
- **Format**: Encrypted with server secret before storage
- **Purpose**: Combined with Part C for nominee access
- **Access**: Server (encrypted, cannot decrypt alone)
- **Storage**: PostgreSQL `users.server_key_part_b` column
- **Encryption**: AES-256-GCM with server-side secret key

**Part C - Nominee Key**
- **Location**: Database (`Nominee.nomineeKeyPartC`) + Email (optional)
- **Format**: Encrypted with user-provided password
- **Purpose**: Combined with Part B for nominee access
- **Access**: Nominee (with decryption password shared separately)
- **Storage**: 
  - Database: `nominees.nominee_key_part_c` (encrypted)
  - Email: Sent to nominee (encrypted, password shared separately)

### Key Flow: User Unlock

```
1. User enters Master Password
   │
   ▼
2. Derive Vault Key using PBKDF2
   │
   ▼
3. Decrypt Part A from localStorage
   │
   ▼
4. Verify verifier payload
   │
   ▼
5. Vault Key ready for encryption/decryption
```

### Key Flow: Adding Nominee

```
1. User unlocks vault (has Vault Key in memory)
   │
   ▼
2. Export Vault Key as hex string (extractable: true)
   │
   ▼
3. Split using Shamir Secret Sharing (2-of-3)
   ├─── Part A: Already exists (user's local key)
   ├─── Part B: New (server key)
   └─── Part C: New (nominee key)
   │
   ▼
4. Encrypt Part C with user-provided password
   │
   ▼
5. Store Part B (encrypted) in User.serverKeyPartB
   │
   ▼
6. Store Part C (encrypted) in Nominee.nomineeKeyPartC
   │
   ▼
7. Send encrypted Part C to nominee via email (optional)
```

### Key Flow: Nominee Unlock

```
1. Nominee provides:
   - Encrypted Part C (from email/database)
   - Decryption password (shared separately by user)
   │
   ▼
2. Server retrieves encrypted Part B from User.serverKeyPartB
   │
   ▼
3. Server decrypts Part B using server secret
   │
   ▼
4. Server decrypts Part C using nominee's password
   │
   ▼
5. Combine Part B + Part C using Shamir reconstruction
   │
   ▼
6. Reconstruct Vault Key (hex string)
   │
   ▼
7. Return reconstructed key to nominee (read-only session)
   │
   ▼
8. Nominee can decrypt vault items (read-only)
```

---

## FamilyVault Key Management

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                 FamilyVault Key Management                   │
└─────────────────────────────────────────────────────────────┘

Owner/Members (Client-Side)      Server                    Nominee
───────────────────────────      ──────                    ───────

Master Password                  Part B (Encrypted)        Part C (Encrypted)
     │                               │                          │
     │ PBKDF2                        │                          │
     ▼                               │                          │
Derived Key                          │                          │
     │                               │                          │
     │ RSA Key Pair Generation       │                          │
     ├─── Public Key ────────────────► (FamilyMember.publicKey) │
     └─── Private Key (Encrypted)    │                          │
          (localStorage)              │                          │
                                      │                          │
SMK (Shared Master Key)              │                          │
     │                               │                          │
     │ RSA Encryption (per member)   │                          │
     ├─── Encrypted SMK ─────────────► (FamilyMember.encryptedSharedMasterKey)
     │    (per member)                │                          │
     │                               │                          │
     │ Shamir Split (2-of-3)         │                          │
     ├─── Part A ────────────────────┼──────────────────────────┤
     │    (localStorage)              │                          │
     ├─── Part B ────────────────────► (User.serverKeyPartB)   │
     │    (encrypted)                 │                          │
     └─── Part C ─────────────────────┼──────────────────────────►
          (encrypted)                 │                    (Encrypted + Password)
```

### Key Components

#### 1. Master Password
- **Location**: User's memory (never stored)
- **Purpose**: Authenticate user and derive encryption key for private key storage
- **Usage**: Same as MyVault - used to encrypt/decrypt RSA private key locally

#### 2. RSA Key Pair (Per Member)
- **Generation**: Client-side using Web Crypto API
- **Algorithm**: RSA-OAEP, 2048-bit
- **Public Key**:
  - **Location**: Database (`FamilyMember.publicKey`)
  - **Purpose**: Encrypt SMK for this member
  - **Storage**: PostgreSQL `family_members.public_key` column
- **Private Key**:
  - **Location**: Browser `localStorage` (encrypted with master password)
  - **Purpose**: Decrypt SMK from server
  - **Storage**: `localStorage.getItem("family_vault_{vaultId}")`
  - **Format**: Encrypted JSON payload containing `{ smkHex, privateKey }`

#### 3. Shared Master Key (SMK)
- **Generation**: Random 256-bit AES key (generated client-side)
- **Algorithm**: AES-256-GCM
- **Purpose**: Encrypts all items in the family vault
- **Storage**: 
  - **Server**: Encrypted with each member's RSA public key
  - **Client**: Encrypted with master password in `localStorage`
- **Location**: 
  - Database: `FamilyMember.encryptedSharedMasterKey` (RSA-encrypted, per member)
  - Client: `localStorage` (AES-encrypted with master password)

#### 4. Key Splitting (Shamir Secret Sharing - 2-of-3)

When adding a nominee to a FamilyVault, the SMK is split:

**Part A - User's Local Key**
- **Location**: Browser `localStorage` (encrypted with master password)
- **Format**: Encrypted JSON containing SMK hex and RSA private key
- **Purpose**: Allows member to unlock vault with master password
- **Access**: Member only (with master password)

**Part B - Server Key**
- **Location**: Database (`User.serverKeyPartB`)
- **Format**: Encrypted with server secret
- **Purpose**: Combined with Part C for nominee access
- **Note**: Same Part B storage as MyVault (one per user, shared across all vaults)

**Part C - Nominee Key**
- **Location**: Database (`Nominee.nomineeKeyPartC`) + Email (optional)
- **Format**: Encrypted with user-provided password
- **Purpose**: Combined with Part B for nominee access
- **Vault Association**: Linked to specific FamilyVault via `Nominee.vaultId`

### Key Flow: Creating FamilyVault

```
1. Owner enters Master Password
   │
   ▼
2. Generate RSA Key Pair (client-side)
   ├─── Public Key: Store in FamilyMember.publicKey
   └─── Private Key: Encrypt with master password → localStorage
   │
   ▼
3. Generate SMK (256-bit random AES key)
   │
   ▼
4. Encrypt SMK with owner's RSA public key
   │
   ▼
5. Store encrypted SMK in FamilyMember.encryptedSharedMasterKey
   │
   ▼
6. Encrypt SMK + Private Key with master password
   │
   ▼
7. Store in localStorage: family_vault_{vaultId}
```

### Key Flow: Adding Family Member

```
1. Owner unlocks vault (has SMK in memory)
   │
   ▼
2. Generate RSA Key Pair for new member (client-side)
   ├─── Public Key: Store in FamilyMember.publicKey
   └─── Private Key: Encrypt with member's master password → localStorage
   │
   ▼
3. Encrypt SMK with new member's RSA public key
   │
   ▼
4. Store encrypted SMK in FamilyMember.encryptedSharedMasterKey
   │
   ▼
5. Send invitation to member (with encrypted private key)
   │
   ▼
6. Member accepts invitation
   │
   ▼
7. Member decrypts private key with their master password
   │
   ▼
8. Member decrypts SMK from server using their private key
   │
   ▼
9. Member stores SMK + Private Key in localStorage
```

### Key Flow: Member Unlock

```
1. Member enters Master Password
   │
   ▼
2. Derive key using PBKDF2
   │
   ▼
3. Decrypt localStorage data (SMK + Private Key)
   │
   ▼
4. Verify decrypted data structure
   │
   ▼
5. Optionally verify SMK matches server version:
   - Decrypt server's encrypted SMK using private key
   - Compare with localStorage SMK
   │
   ▼
6. SMK ready for encryption/decryption
```

### Key Flow: Adding Nominee to FamilyVault

```
1. Admin unlocks vault (has SMK in memory)
   │
   ▼
2. Export SMK as hex string
   │
   ▼
3. Split using Shamir Secret Sharing (2-of-3)
   ├─── Part A: Already exists (member's local key)
   ├─── Part B: Use existing User.serverKeyPartB (or create if first nominee)
   └─── Part C: New (nominee key)
   │
   ▼
4. Encrypt Part C with user-provided password
   │
   ▼
5. Store Part C (encrypted) in Nominee.nomineeKeyPartC
   │
   ▼
6. Link nominee to FamilyVault via Nominee.vaultId
   │
   ▼
7. Send encrypted Part C to nominee via email (optional)
```

### Key Flow: Nominee Unlock (FamilyVault)

```
1. Nominee provides:
   - Encrypted Part C (from email/database)
   - Decryption password (shared separately)
   │
   ▼
2. Server retrieves encrypted Part B from User.serverKeyPartB
   │
   ▼
3. Server decrypts Part B using server secret
   │
   ▼
4. Server decrypts Part C using nominee's password
   │
   ▼
5. Combine Part B + Part C using Shamir reconstruction
   │
   ▼
6. Reconstruct SMK (hex string)
   │
   ▼
7. Return reconstructed SMK to nominee (read-only session)
   │
   ▼
8. Nominee can decrypt family vault items (read-only)
```

---

## Key Storage Locations

### Client-Side Storage (Browser)

#### MyVault
- **`localStorage.getItem("vaultVerifier")`**
  - **Content**: Encrypted verifier payload
  - **Encryption**: AES-256-GCM with vault key (derived from master password)
  - **Purpose**: Verify master password correctness
  - **Format**: `{ iv: string, ciphertext: string }`

#### FamilyVault
- **`localStorage.getItem("family_vault_{vaultId}")`**
  - **Content**: Encrypted SMK and RSA private key
  - **Encryption**: AES-256-GCM with key derived from master password
  - **Purpose**: Store SMK and private key for vault unlock
  - **Format**: `{ iv: string, ciphertext: string }` containing `{ smkHex: string, privateKey: string }`

### Server-Side Storage (Database)

#### User Table
- **`users.server_key_part_b`**
  - **Content**: Encrypted Part B (Shamir share)
  - **Encryption**: AES-256-GCM with server secret key
  - **Purpose**: Combined with Part C for nominee access
  - **Scope**: One per user, shared across all vaults (MyVault and FamilyVaults)

#### Nominee Table
- **`nominees.nominee_key_part_c`**
  - **Content**: Encrypted Part C (Shamir share)
  - **Encryption**: AES-256-GCM with user-provided password
  - **Purpose**: Combined with Part B for nominee access
  - **Vault Association**: 
    - `vault_type`: "my_vault" or "family_vault"
    - `vault_id`: null for MyVault, FamilyVault ID for FamilyVault

#### FamilyMember Table
- **`family_members.public_key`**
  - **Content**: RSA public key (PEM format)
  - **Purpose**: Encrypt SMK for this member
  - **Format**: PEM-encoded RSA public key

- **`family_members.encrypted_shared_master_key`**
  - **Content**: SMK encrypted with member's RSA public key
  - **Encryption**: RSA-OAEP (2048-bit)
  - **Purpose**: Server-stored SMK for this member
  - **Format**: Base64-encoded encrypted SMK (hex string)

---

## Key Derivation

### Master Password → Vault Key (MyVault)

```typescript
// Client-side (Web Crypto API)
const vaultKey = await crypto.subtle.deriveKey(
  {
    name: "PBKDF2",
    salt: new TextEncoder().encode("lifevault-mvp-static-salt"),
    iterations: 310_000,
    hash: "SHA-256"
  },
  passwordMaterial, // Imported from master password
  { name: "AES-GCM", length: 256 },
  false, // Not extractable by default
  ["encrypt", "decrypt"]
);
```

### Master Password → Encryption Key (FamilyVault)

```typescript
// Same derivation as MyVault
// Used to encrypt/decrypt RSA private key and SMK in localStorage
const encryptionKey = await deriveKeyFromPassword(masterPassword);
```

### SMK Generation (FamilyVault)

```typescript
// Client-side random generation
const smkArray = crypto.getRandomValues(new Uint8Array(32)); // 256 bits
const smkHex = Array.from(smkArray)
  .map(b => b.toString(16).padStart(2, "0"))
  .join("");
```

---

## Shamir Secret Sharing

### Algorithm: 2-of-3 Threshold

LifeVault uses a simplified 2-of-3 Shamir Secret Sharing scheme where:
- **Threshold**: 2 parts required to reconstruct the secret
- **Total Parts**: 3 parts generated
- **Parts**:
  - **Part A**: User's local key (stored encrypted in localStorage)
  - **Part B**: Server key (stored encrypted in database)
  - **Part C**: Nominee key (stored encrypted, sent to nominee)

### Key Splitting

```typescript
// Split vault key (hex string) into 3 parts
const shares = splitSecretTwoOfThree(vaultKeyHex);
// Returns: [
//   { id: 0, value: "partA..." },  // User's local key
//   { id: 1, value: "partB..." },  // Server key
//   { id: 2, value: "partC..." }   // Nominee key
// ]
```

### Key Reconstruction

```typescript
// Combine any 2 parts to reconstruct the original key
const shares = [
  { id: 1, value: serverKeyPartB },  // Part B
  { id: 2, value: nomineeKeyPartC }   // Part C
];
const reconstructedKey = combineTwoOfThree(shares);
// Returns: Original vault key (hex string)
```

### Security Properties

1. **No Single Point of Failure**: No single party can reconstruct the key alone
2. **User Access**: User needs Part A + master password (Part A stored encrypted)
3. **Nominee Access**: Nominee needs Part C + password + Server's Part B
4. **Server Cannot Decrypt**: Server has Part B but cannot decrypt without Part C

---

## Nominee Access Flow

### Use Case 1: User is Alive (Manual Approval)

```
1. Nominee requests access via /nominee-access page
   │
   ▼
2. User receives email notification
   │
   ▼
3. User approves/rejects request
   │
   ▼
4. If approved:
   - Nominee can unlock vault
   - Nominee provides Part C + decryption password
   - Server combines Part B + Part C
   - Nominee gets read-only access
```

### Use Case 2: User is Inactive (Automatic Trigger)

```
1. System detects user inactivity (last login > threshold)
   │
   ▼
2. System sends reminder emails to user (3 emails over 2 weeks)
   │
   ▼
3. If user doesn't respond after 3 reminders:
   - System notifies nominee
   - Nominee can unlock vault
   - Nominee provides Part C + decryption password
   - Server combines Part B + Part C
   - Nominee gets read-only access
```

### Nominee Unlock Process

```
1. Nominee visits /nominee-access
   │
   ▼
2. Nominee provides:
   - User ID
   - Nominee ID
   - Encrypted Part C (from email/database)
   - Decryption password (shared separately)
   │
   ▼
3. Server validates:
   - Nominee exists and is active
   - Access is authorized (approved request OR inactivity trigger)
   │
   ▼
4. Server retrieves:
   - Encrypted Part B from User.serverKeyPartB
   - Encrypted Part C from Nominee.nomineeKeyPartC
   │
   ▼
5. Server decrypts:
   - Part B using server secret
   - Part C using nominee's password
   │
   ▼
6. Server combines Part B + Part C using Shamir reconstruction
   │
   ▼
7. Server returns reconstructed key to nominee (read-only session)
   │
   ▼
8. Nominee can decrypt vault items (read-only, cannot modify)
```

---

## Security Considerations

### Zero-Knowledge Architecture

1. **Server Never Sees Plaintext**:
   - All data encrypted client-side before upload
   - Server only stores encrypted blobs
   - Server cannot decrypt without client keys

2. **Split-Key Model**:
   - No single party has complete key
   - User needs master password + Part A
   - Nominee needs Part C + password + Server's Part B
   - Server cannot decrypt alone

3. **Key Storage**:
   - Part A: Client-side only (encrypted)
   - Part B: Server-side (encrypted with server secret)
   - Part C: Database + Email (encrypted with user-provided password)

### Key Derivation Security

1. **PBKDF2 Parameters**:
   - Iterations: 310,000 (high iteration count)
   - Hash: SHA-256
   - Salt: Static for MVP (should be per-user in production)

2. **Key Extraction**:
   - Keys are non-extractable by default
   - Extractable keys only generated when needed (nominee addition)
   - Extracted keys never stored, only used temporarily

### Encryption Standards

1. **Vault Encryption**: AES-256-GCM
2. **RSA Encryption**: RSA-OAEP, 2048-bit
3. **Key Storage Encryption**: AES-256-GCM
4. **Part B Encryption**: AES-256-GCM with server secret
5. **Part C Encryption**: AES-256-GCM with user-provided password

### Access Control

1. **User Access**: 
   - Requires master password
   - Full read/write access
   - Can add/remove items

2. **Family Member Access**:
   - Requires master password
   - Role-based permissions (Admin/Editor/Viewer)
   - Can add/remove items based on role

3. **Nominee Access**:
   - Requires Part C + decryption password + Server's Part B
   - Read-only access
   - Cannot modify or delete items
   - Time-limited session

### Key Rotation

1. **Master Password Change**:
   - User must re-encrypt all keys
   - Part A must be regenerated
   - Part B and Part C remain the same (vault key unchanged)

2. **Vault Key Rotation**:
   - Generate new vault key
   - Re-encrypt all vault items
   - Regenerate Part A, Part B, Part C
   - Distribute new Part C to all nominees

3. **SMK Rotation (FamilyVault)**:
   - Generate new SMK
   - Re-encrypt all vault items
   - Re-encrypt SMK for all members
   - Regenerate Part A, Part B, Part C for nominees

### Threat Mitigation

1. **Server Compromise**:
   - Server has encrypted Part B (cannot decrypt alone)
   - Server has encrypted data (cannot decrypt without keys)
   - Attacker needs Part C + password to access vault

2. **Client Compromise**:
   - Attacker needs master password to decrypt Part A
   - Attacker cannot access vault without master password
   - localStorage data is encrypted

3. **Nominee Compromise**:
   - Nominee has Part C (encrypted) but needs password
   - Nominee needs Server's Part B (requires server access)
   - Nominee access is read-only

4. **Database Compromise**:
   - All keys are encrypted before storage
   - Part B encrypted with server secret (not in database)
   - Part C encrypted with user-provided password (not in database)
   - Attacker cannot decrypt without additional secrets

---

## Summary

### MyVault Key Management

- **User**: Master password → Vault Key (AES-256) → Part A (localStorage)
- **Server**: Part B (encrypted, database)
- **Nominee**: Part C (encrypted, database + email)

### FamilyVault Key Management

- **Owner/Members**: Master password → Encryption Key → RSA Private Key (localStorage) + SMK (localStorage)
- **Server**: RSA Public Keys + Encrypted SMK (per member) + Part B (shared)
- **Nominee**: Part C (encrypted, database + email, linked to specific FamilyVault)

### Key Principles

1. **Zero-Knowledge**: Server never sees plaintext
2. **Split-Key**: No single party has complete key
3. **Client-Side Encryption**: All encryption happens client-side
4. **Shamir Secret Sharing**: 2-of-3 threshold for nominee access
5. **Role-Based Access**: Different permissions for users, members, and nominees

---

## Future Enhancements

1. **Per-User Salt**: Replace static salt with per-user salt
2. **Key Versioning**: Support multiple key versions for rotation
3. **HSM Integration**: Use Hardware Security Module for Part B storage
4. **Multi-Factor Authentication**: Add MFA for key operations
5. **Audit Logging**: Track all key operations and access
6. **Key Escrow**: Optional key recovery mechanism
7. **Biometric Authentication**: Use biometrics for key derivation

