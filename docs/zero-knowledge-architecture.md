# Zero-Knowledge Architecture - Node.js Recommendation

## Why Node.js for Zero-Knowledge File Storage

### Architecture Flow

```
┌─────────────┐
│   Browser   │
│  (Client)   │
└──────┬──────┘
       │
       │ 1. User selects file
       │ 2. Encrypt with AES-256-GCM (client-side)
       │ 3. Generate encrypted blob
       ▼
┌─────────────────┐
│  Next.js Frontend│
│  (TypeScript)    │
└──────┬───────────┘
       │
       │ POST /api/upload
       │ { encryptedBlob, metadata }
       ▼
┌─────────────────┐
│  Node.js Backend │
│  (TypeScript)    │
│  - Validates auth│
│  - Generates S3 key│
│  - Proxies blob │
│  - NEVER decrypts│
└──────┬───────────┘
       │
       │ Stream encrypted blob
       │ (no decryption)
       ▼
┌─────────────────┐
│   S3/MinIO       │
│  (Encrypted)     │
└─────────────────┘
```

### Key Points

1. **Server Never Sees Plaintext**: Encrypted blob flows through server unchanged
2. **Streaming**: Node.js streams excel at proxying encrypted data
3. **Shared Crypto**: Same Web Crypto API on frontend and backend
4. **Type Safety**: Shared TypeScript types for encrypted payloads

## Node.js Advantages for This Use Case

### 1. Crypto Consistency
```typescript
// Frontend (browser)
const encrypted = await crypto.subtle.encrypt(...)

// Backend (Node.js) - SAME API!
const crypto = require('crypto');
const encrypted = crypto.createCipheriv(...)
```

### 2. Streaming Encrypted Data
```typescript
// Node.js - Efficient streaming proxy
app.post('/api/upload', async (req, res) => {
  const encryptedStream = req; // Already encrypted from client
  const s3Key = generateS3Key();
  
  // Stream directly to S3 - no decryption, no storage
  await s3.upload({
    Bucket: 'lifevault-vaults',
    Key: s3Key,
    Body: encryptedStream, // Forward encrypted blob
  }).promise();
  
  // Store only metadata in DB
  await db.vaultItems.create({
    s3Key,
    userId: req.user.id,
    // No encrypted data stored in DB
  });
});
```

### 3. Shared TypeScript Types
```typescript
// shared/types.ts
export interface EncryptedPayload {
  iv: string;
  ciphertext: string;
  tag: string;
}

// Used in both frontend and backend!
```

### 4. Zero-Knowledge Verification
```typescript
// Backend can verify encryption without decrypting
function validateEncryptedBlob(blob: Buffer): boolean {
  // Check structure, size, format
  // But NEVER decrypt
  return blob.length > 0 && isValidFormat(blob);
}
```

## Comparison: Node.js vs Python

| Feature | Node.js | Python |
|---------|---------|--------|
| **Crypto API Match** | ✅ Native Web Crypto | ❌ Different API |
| **Streaming Proxy** | ✅ Excellent | ⚠️ Good but more overhead |
| **Shared Types** | ✅ TypeScript | ❌ Different languages |
| **Code Reuse** | ✅ Same crypto utils | ❌ Duplicate code |
| **Zero-Knowledge** | ✅ Perfect fit | ⚠️ Works but less optimal |

## Recommended Stack

- **Frontend**: Next.js 15 + TypeScript
- **Backend**: Express.js/Fastify + TypeScript
- **Database**: Prisma (TypeScript-first ORM)
- **Storage**: AWS S3 (via `@aws-sdk/client-s3`)
- **Crypto**: Native Node.js `crypto` module

## Implementation Example

### Client-Side (Frontend)
```typescript
// Encrypt file before upload
const file = event.target.files[0];
const encryptedBlob = await encryptFile(file, userKey);

// Upload encrypted blob
await fetch('/api/vaults/upload', {
  method: 'POST',
  body: encryptedBlob, // Already encrypted
  headers: {
    'Content-Type': 'application/octet-stream',
  },
});
```

### Server-Side (Backend)
```typescript
// Receive encrypted blob, proxy to S3
app.post('/api/vaults/upload', authenticate, async (req, res) => {
  // req.body is already encrypted - we never decrypt it
  const s3Key = `${req.user.id}/${uuid()}`;
  
  // Stream encrypted blob directly to S3
  await s3Client.putObject({
    Bucket: 'lifevault-vaults',
    Key: s3Key,
    Body: req, // Stream encrypted data
    ContentType: 'application/octet-stream',
  });
  
  // Store only metadata
  await prisma.vaultItem.create({
    data: {
      userId: req.user.id,
      s3Key,
      category: req.headers['x-category'],
      // No encrypted data in DB
    },
  });
  
  res.json({ s3Key });
});
```

## Security Benefits

1. **Server Can't Decrypt**: Even if compromised, server has no keys
2. **No Plaintext Storage**: Encrypted data only in S3
3. **Audit Trail**: Server logs show encrypted blobs, not content
4. **Compliance**: Easier to prove zero-knowledge architecture

## Conclusion

For a zero-knowledge architecture like WhatsApp, **Node.js is the clear winner** because:
- Server is just a proxy (Node.js excels at this)
- Crypto consistency between frontend/backend
- Shared TypeScript types and utilities
- Better for streaming encrypted data
- Simpler, more maintainable codebase

