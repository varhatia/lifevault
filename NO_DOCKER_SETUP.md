# LifeVault Setup Without Docker

Since Docker is not available, LifeVault will use **local file storage** instead of S3/MinIO for encrypted files.

## ✅ Automatic Fallback

The application automatically detects when S3 is not available and falls back to local file storage in `.storage/encrypted-files/`.

**No configuration needed!** It just works.

## Setup Instructions

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Generate Prisma Client

```bash
npm run prisma:generate
```

### 3. Environment Variables

Your `.env.local` should have:

```env
# Database
DATABASE_URL=postgresql://lifevault:lifevault_dev@localhost:5432/lifevault

# Security
SECRET_KEY=dev-secret-key-change-in-production
JWT_SECRET_KEY=dev-jwt-secret-change-in-production
SERVER_SHARE_SECRET=dev-server-share-secret-change-in-production

# Local Storage (automatic fallback)
USE_LOCAL_STORAGE=true
# Or leave AWS_ENDPOINT_URL empty to auto-detect
```

### 4. Start the Application

```bash
npm run dev
```

## How It Works

### With S3 (Production)
```
Client → Encrypt → Server → S3 (encrypted)
```

### Without S3 (Development - Current)
```
Client → Encrypt → Server → Local File System (.storage/)
```

**Security is the same!** Files are still encrypted client-side before storage.

## File Storage Location

Encrypted files are stored in:
```
frontend/.storage/encrypted-files/
```

This directory is:
- ✅ Git-ignored (not committed)
- ✅ Contains only encrypted blobs
- ✅ Server never decrypts them

## Switching to S3 Later

When you're ready to use S3:

1. **Start MinIO** (if using Docker):
```bash
docker run -d -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin123 \
  minio/minio server /data --console-address ":9001"
```

2. **Update `.env.local`**:
```env
AWS_ENDPOINT_URL=http://localhost:9000
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin123
AWS_S3_BUCKET=lifevault-vaults
USE_LOCAL_STORAGE=false
```

3. **Create bucket** at http://localhost:9001

The application will automatically switch to S3!

## Benefits of Local Storage (Development)

- ✅ No Docker required
- ✅ Faster for development
- ✅ Same security (client-side encryption)
- ✅ Easy to inspect files (though encrypted)
- ✅ No external dependencies

## Migration from Local to S3

When you switch to S3, you can migrate files:

```bash
# Copy encrypted files from local storage to S3
# (Files are already encrypted, so safe to copy)
```

Or just start fresh - old files in `.storage/` will remain but new uploads go to S3.

## Current Status

✅ **Working without Docker!**
- Local file storage active
- Zero-knowledge encryption maintained
- All features work the same

Just run `npm run dev` and start uploading encrypted files! 🚀


