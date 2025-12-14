# Part B (Service Key) Storage Implementation

## Current Status: ❌ NOT IMPLEMENTED

Part B (Service Key) is **not currently stored** in the database. This is a critical missing piece for the nominee unlock workflow.

## Where Part B Should Be Stored

### Recommended: User Model

Add `serverKeyPartB` field to the `User` model in Prisma schema:

```prisma
model User {
  // ... existing fields ...
  serverKeyPartB   String?   @map("server_key_part_b") @db.VarChar(512) // Encrypted Part B
  serverKeyPartBEncryptedAt DateTime? @map("server_key_part_b_encrypted_at") @db.Timestamptz(6)
  // ... rest of fields ...
}
```

### Why User Model?

1. **One Part B per user**: Each user has one master key, so one Part B
2. **Shared across nominees**: All nominees for a user share the same Part B
3. **Simpler implementation**: No need for separate key management table
4. **Easier key rotation**: Update one field when rotating keys

## Implementation Plan

### Step 1: Update Prisma Schema

Add Part B fields to User model:

```prisma
model User {
  // ... existing fields ...
  serverKeyPartB   String?   @map("server_key_part_b") @db.VarChar(512)
  serverKeyPartBEncryptedAt DateTime? @map("server_key_part_b_encrypted_at") @db.Timestamptz(6)
  // ... rest of fields ...
}
```

### Step 2: Generate Part B When Adding First Nominee

When a user adds their first nominee:

1. Generate all 3 parts using Shamir Secret Sharing:
   - Part A: User (already stored locally)
   - Part B: Service (needs to be generated and stored)
   - Part C: Nominee (already being generated)

2. Encrypt Part B with server secret before storing:
   ```typescript
   // In AddNomineeModal or API route
   const shares = splitSecretTwoOfThree(keyString);
   const partB = shares[1].value; // Part B for service
   
   // Encrypt Part B with server secret
   const encryptedPartB = encryptWithServerSecret(partB);
   
   // Store in User.serverKeyPartB
   ```

3. Store encrypted Part B in database

### Step 3: Use Part B in Nominee Unlock

When nominee initiates unlock:

1. Nominee provides Part C (decrypted)
2. Server retrieves encrypted Part B from `User.serverKeyPartB`
3. Server decrypts Part B using server secret
4. Combine Part B + Part C using Shamir reconstruction
5. Use reconstructed key to decrypt vault (read-only)

## Security Considerations

### Encryption of Part B

Part B should be encrypted with a server-side secret before storage:

```typescript
// Server-side encryption key (from environment)
const SERVER_PART_B_SECRET = process.env.SERVER_PART_B_SECRET;

// Encrypt Part B before storing
function encryptPartB(partB: string): string {
  // Use AES-256-GCM with server secret
  // Store IV + ciphertext
}
```

### Key Rotation

When rotating keys:
1. Generate new master key
2. Split into new Parts A, B, C
3. Update `User.serverKeyPartB` with new encrypted Part B
4. User must update Part A locally
5. User must regenerate and resend Part C to all nominees

## Database Migration

```sql
-- Add Part B fields to users table
ALTER TABLE users 
ADD COLUMN server_key_part_b VARCHAR(512),
ADD COLUMN server_key_part_b_encrypted_at TIMESTAMPTZ(6);
```

## API Changes Needed

### 1. Update POST /api/nominee

When adding a nominee:
- Check if `User.serverKeyPartB` exists
- If not, generate Part B and store it
- If yes, reuse existing Part B

### 2. Implement POST /api/nominee/unlock

When nominee unlocks:
- Retrieve encrypted Part B from `User.serverKeyPartB`
- Decrypt Part B
- Combine with nominee's Part C
- Reconstruct master key
- Decrypt vault items (read-only)

## Alternative: Separate Key Table

For more complex scenarios (key rotation, audit trail):

```prisma
model UserKey {
  id                String    @id @default(uuid()) @db.Uuid
  userId            String    @map("user_id") @db.Uuid
  keyVersion        Int       @default(1) @map("key_version")
  serverKeyPartB    String    @map("server_key_part_b") @db.VarChar(512)
  encryptedAt       DateTime  @default(now()) @map("encrypted_at") @db.Timestamptz(6)
  isActive          Boolean   @default(true) @map("is_active")
  createdAt         DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  user              User      @relation(fields: [userId], references: [id])
  
  @@unique([userId, keyVersion])
  @@map("user_keys")
}
```

## Current Workaround

Until Part B is implemented:
- Nominee unlock workflow cannot work
- The `/api/nominee/unlock` endpoint is a stub
- Part B generation is missing from nominee addition flow

## Priority: HIGH

This is a critical missing piece for the nominee access feature to function.


