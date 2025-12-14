# Part B Storage Configuration - Environment Variables Update

## Step 2: Update `.env.local`

Since `.env.local` is protected, please manually add the following environment variables to your `frontend/.env.local` file:

### Add these lines to your `.env.local` file:

```env
# Key Storage Backend
# Options: 'local' (PostgreSQL), 'aws-kms' (AWS Key Management Service)
KEY_STORAGE_BACKEND=local

# Part B Encryption Secret (for local storage)
# Must be at least 32 characters for security
# Generate a secure random string for production
SERVER_PART_B_SECRET=dev-server-part-b-secret-change-in-production-min-32-chars
```

### Where to add them:

Add these lines in the **Security** section of your `.env.local` file, after the existing security variables:

```env
# Security
SECRET_KEY=dev-secret-key-change-in-production
JWT_SECRET_KEY=dev-jwt-secret-change-in-production
SERVER_SHARE_SECRET=dev-server-share-secret-change-in-production
SERVER_PART_B_SECRET=dev-server-part-b-secret-change-in-production-min-32-chars

# Key Storage Backend
KEY_STORAGE_BACKEND=local
```

### For Production (AWS KMS):

When you're ready to use AWS KMS for cloud storage, update these variables:

```env
# Key Storage Backend
KEY_STORAGE_BACKEND=aws-kms

# AWS KMS Configuration
AWS_REGION=us-east-1
AWS_KMS_KEY_ID=arn:aws:kms:us-east-1:123456789012:key/your-key-id
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
```

### Generate a Secure Secret (for Production):

For production, generate a secure random secret:

```bash
# Using OpenSSL
openssl rand -base64 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Verification:

After updating `.env.local`, verify the configuration:

```bash
cd frontend
grep -E "KEY_STORAGE_BACKEND|SERVER_PART_B_SECRET" .env.local
```

You should see:
```
KEY_STORAGE_BACKEND=local
SERVER_PART_B_SECRET=dev-server-part-b-secret-change-in-production-min-32-chars
```

### Important Notes:

1. **Never commit `.env.local`** to version control
2. **Use a strong secret** (at least 32 characters) for production
3. **Keep secrets secure** - rotate them regularly
4. **For cloud deployment**, use AWS KMS or similar key management service


