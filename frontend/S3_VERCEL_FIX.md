# S3 Upload Issue on Vercel - Fixed

## Problem

When uploading items to MyVault on Vercel, you were getting:
```
S3 upload failed, using local storage fallback: connect ECONNREFUSED 127.0.0.1:9000
```

## Root Cause

The error `connect ECONNREFUSED 127.0.0.1:9000` indicates that the code was trying to connect to `localhost:9000`, which is a **MinIO local development server**. This happens when:

1. **`AWS_ENDPOINT_URL` is set to `http://localhost:9000`** in your Vercel environment variables
2. This is a development/MinIO setting that doesn't work in production on Vercel
3. The old code required `AWS_ENDPOINT_URL` to be set to initialize the S3 client, but **AWS S3 doesn't need an endpoint URL** - it uses the region to determine the endpoint automatically

## Solution

The code has been updated to:

1. **Support AWS S3 without requiring `AWS_ENDPOINT_URL`**
   - If `AWS_ENDPOINT_URL` is not set and you're in production, it will use AWS S3 with the default endpoints
   - Only sets a custom endpoint if `AWS_ENDPOINT_URL` is explicitly provided (for MinIO or custom S3-compatible services)

2. **Better error detection and logging**
   - Warns if `AWS_ENDPOINT_URL` points to localhost in production
   - Provides detailed error messages showing what configuration is being used
   - Better fallback handling

3. **Improved initialization logic**
   - Checks for AWS credentials
   - Detects production environment
   - Only uses S3 if credentials are available and not explicitly using local storage

## Action Required: Update Vercel Environment Variables

### For AWS S3 (Production - Recommended)

**Remove or unset `AWS_ENDPOINT_URL`** in your Vercel environment variables. The following variables should be set:

```env
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1  # or your preferred region
AWS_S3_REGION=us-east-1  # alternative name (both work)
```

**Do NOT set:**
- `AWS_ENDPOINT_URL` (remove it if it exists)
- `USE_LOCAL_STORAGE` (or set it to `false`)

### For MinIO or Custom S3-Compatible Service

If you're using MinIO or a custom S3-compatible service, set:

```env
AWS_ENDPOINT_URL=https://your-minio-endpoint.com
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1
```

**Important:** The endpoint must be accessible from Vercel's servers, not `localhost:9000`.

## How to Fix in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. **Remove** `AWS_ENDPOINT_URL` if it's set to `http://localhost:9000` or any localhost URL
4. Ensure these are set correctly:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_S3_BUCKET`
   - `AWS_REGION` or `AWS_S3_REGION`
5. **Redeploy** your application

## Verification

After updating environment variables and redeploying, check the Vercel function logs. You should see:

```
[S3] Initialized S3 client: AWS S3 (region: us-east-1)
```

Instead of trying to connect to localhost.

## Testing

After the fix:
1. Try uploading a file to MyVault
2. Check Vercel function logs for S3 upload success messages
3. Verify the file appears in your S3 bucket

## Why CLI Works But Vercel Doesn't

When you use AWS CLI, it:
- Uses AWS SDK defaults (no endpoint needed)
- Connects directly to AWS S3 using the region

The old code required `AWS_ENDPOINT_URL` to be set, which caused it to try connecting to localhost when that variable was set to a development value.

## Summary

- ✅ **Fixed:** Code now supports AWS S3 without requiring `AWS_ENDPOINT_URL`
- ✅ **Fixed:** Better error detection and logging
- ✅ **Action Required:** Remove `AWS_ENDPOINT_URL=http://localhost:9000` from Vercel environment variables
- ✅ **Action Required:** Ensure AWS credentials and bucket name are set correctly
