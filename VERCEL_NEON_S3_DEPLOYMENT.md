# Vercel + Neon + S3 Deployment Guide

Complete step-by-step guide for deploying your zero-knowledge LifeVault application on Vercel with Neon PostgreSQL and AWS S3.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Step 1: Neon Database Setup](#step-1-neon-database-setup)
4. [Step 2: AWS S3 Setup](#step-2-aws-s3-setup)
5. [Step 3: Vercel Project Setup](#step-3-vercel-project-setup)
6. [Step 4: Environment Variables](#step-4-environment-variables)
7. [Step 5: Database Migrations](#step-5-database-migrations)
8. [Step 6: Deploy to Vercel](#step-6-deploy-to-vercel)
9. [Step 7: Verify Deployment](#step-7-verify-deployment)
10. [Step 8: Configure Custom Domain](#step-8-configure-custom-domain)
11. [Troubleshooting](#troubleshooting)
12. [Cost Breakdown](#cost-breakdown)

---

## Prerequisites

- GitHub account (for repository hosting)
- Vercel account (free tier available)
- Neon account (free tier available)
- AWS account (for S3)
- Domain name (optional, for custom domain)

---

## Architecture Overview

```
┌─────────────────┐
│   User Browser  │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│  Vercel Edge    │ ← Next.js App (Serverless)
│  Network        │ ← API Routes
└────────┬────────┘
         │
    ┌────┴────┐
    │        │
    ▼        ▼
┌────────┐ ┌──────────┐
│  Neon  │ │   AWS   │
│Postgres│ │   S3    │
└────────┘ └──────────┘
```

**Key Benefits:**
- ✅ Zero-config deployment
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Serverless scaling
- ✅ Built-in cron jobs
- ✅ Free tier available

---

## Step 1: Neon Database Setup

### 1.1 Create Neon Account

1. Go to [neon.tech](https://neon.tech)
2. Sign up with GitHub (recommended) or email
3. Verify your email if required

### 1.2 Create a New Project

1. Click **"Create a project"**
2. **Project name**: `lifevault-prod`
3. **Region**: Choose closest to your users (e.g., `us-east-1`)
4. **PostgreSQL version**: 16 (latest)
5. Click **"Create project"**

### 1.3 Get Connection String

1. After project creation, you'll see a connection string like:
   ```
   postgresql://username:password@ep-xxx-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
2. **Copy this connection string** - you'll need it for Vercel
3. Click **"Show password"** and save it securely

### 1.4 Configure Database Settings

**In Neon Dashboard:**

1. Go to **Settings** → **Connection pooling**
2. Enable **Connection pooling** (recommended for serverless)
3. Copy the pooled connection string (starts with `postgresql://...@ep-...pooler...`)

**Why Connection Pooling?**
- Vercel uses serverless functions
- Each function gets a new connection
- Pooling prevents connection exhaustion
- Better performance and cost

### 1.5 Create Database (if needed)

By default, Neon creates a `neondb` database. You can create a custom one:

```sql
-- In Neon SQL Editor
CREATE DATABASE lifevault;
```

Then update your connection string to use `lifevault` instead of `neondb`.

---

## Step 2: AWS S3 Setup

### 2.1 Create S3 Bucket

**Via AWS Console:**

1. Go to [AWS S3 Console](https://s3.console.aws.amazon.com/)
2. Click **"Create bucket"**
3. **Bucket name**: `lifevault-vaults-prod` (must be globally unique)
4. **AWS Region**: `us-east-1` (or your preferred region)
5. **Object Ownership**: ACLs disabled (recommended)
6. **Block Public Access**: Keep all settings enabled (we'll use IAM)
7. **Bucket Versioning**: Enable (optional but recommended)
8. **Default encryption**: 
   - Enable encryption
   - Choose **SSE-S3** (AES-256) - included in S3 pricing
9. Click **"Create bucket"**

**Via AWS CLI:**
```bash
aws s3 mb s3://lifevault-vaults-prod --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket lifevault-vaults-prod \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket lifevault-vaults-prod \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
```

### 2.2 Create IAM User for S3 Access

**Via AWS Console:**

1. Go to **IAM** → **Users** → **Create user**
2. **User name**: `vercel-s3-access`
3. **Access type**: Select **"Access key - Programmatic access"**
4. Click **"Next: Permissions"**
5. Click **"Attach policies directly"**
6. Click **"Create policy"** (opens new tab)

**Create Custom Policy:**

1. Go to **IAM** → **Policies** → **Create policy**
2. Click **"JSON"** tab
3. Paste this policy (replace `lifevault-vaults-prod` with your bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowS3Access",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::lifevault-vaults-prod",
        "arn:aws:s3:::lifevault-vaults-prod/*"
      ],
      "Condition": {
        "StringEquals": {
          "s3:x-amz-server-side-encryption": "AES256"
        }
      }
    }
  ]
}
```

4. Click **"Next"**
5. **Policy name**: `VercelS3AccessPolicy`
6. Click **"Create policy"**
7. Go back to user creation tab
8. Refresh policies list
9. Search for `VercelS3AccessPolicy` and select it
10. Click **"Next"** → **"Create user"**
11. **IMPORTANT**: Copy the **Access Key ID** and **Secret Access Key**
   - You won't be able to see the secret again!
   - Save these securely - you'll add them to Vercel

**Via AWS CLI:**
```bash
# Create IAM user
aws iam create-user --user-name vercel-s3-access

# Create policy
aws iam create-policy \
  --policy-name VercelS3AccessPolicy \
  --policy-document file://s3-policy.json

# Attach policy to user
aws iam attach-user-policy \
  --user-name vercel-s3-access \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/VercelS3AccessPolicy

# Create access key
aws iam create-access-key --user-name vercel-s3-access
```

### 2.3 Configure S3 Bucket Policy (Optional)

For additional security, you can restrict bucket access to specific IAM user:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowVercelUser",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:user/vercel-s3-access"
      },
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::lifevault-vaults-prod",
        "arn:aws:s3:::lifevault-vaults-prod/*"
      ]
    }
  ]
}
```

Apply via AWS Console:
1. Go to S3 → Your bucket → **Permissions** → **Bucket policy**
2. Paste the policy (replace `YOUR_ACCOUNT_ID`)
3. Click **"Save"**

---

## Step 3: Vercel Project Setup

### 3.1 Install Vercel CLI

```bash
npm install -g vercel
```

### 3.2 Login to Vercel

```bash
vercel login
```

Follow the prompts to authenticate.

### 3.3 Link Your Project

```bash
cd frontend
vercel link
```

**Follow prompts:**
- **Set up and deploy?** → Yes
- **Which scope?** → Your account
- **Link to existing project?** → No (for first deployment)
- **Project name?** → `lifevault` (or your preferred name)
- **Directory?** → `./` (current directory)

This creates a `.vercel` folder with project configuration.

### 3.4 Verify Vercel Configuration

Check that `vercel.json` exists in your `frontend` directory:

```json
{
  "crons": [
    {
      "path": "/api/nominee/access/check-inactivity",
      "schedule": "0 2 * * *"
    }
  ]
}
```

This configures your cron job for inactivity checks.

---

## Step 4: Environment Variables

### 4.1 Set Environment Variables in Vercel

**Via Vercel Dashboard (Recommended):**

1. Go to your project on [vercel.com](https://vercel.com)
2. Click **Settings** → **Environment Variables**
3. Add each variable below:

**Required Variables:**

| Variable | Value | Environment |
|----------|-------|-------------|
| `DATABASE_URL` | Your Neon connection string (with pooling) | Production, Preview, Development |
| `JWT_SECRET` | Generate with: `openssl rand -base64 32` | Production, Preview, Development |
| `NEXTAUTH_SECRET` | Generate with: `openssl rand -base64 32` | Production, Preview, Development |
| `SERVER_SHARE_SECRET` | Generate with: `openssl rand -base64 32` | Production, Preview, Development |
| `AWS_ACCESS_KEY_ID` | Your IAM user access key | Production, Preview, Development |
| `AWS_SECRET_ACCESS_KEY` | Your IAM user secret key | Production, Preview, Development |
| `AWS_S3_BUCKET` | `lifevault-vaults-prod` | Production, Preview, Development |
| `AWS_S3_REGION` | `us-east-1` | Production, Preview, Development |
| `SMTP_HOST` | Your email provider (see below) | Production, Preview, Development |
| `SMTP_PORT` | `587` (TLS) or `465` (SSL) | Production, Preview, Development |
| `SMTP_USER` | Your email username | Production, Preview, Development |
| `SMTP_PASSWORD` | Your email password/app password | Production, Preview, Development |
| `EMAIL_FROM` | `noreply@yourdomain.com` | Production, Preview, Development |
| `SMTP_SECURE` | `false` (for 587) or `true` (for 465) | Production, Preview, Development |
| `NODE_ENV` | `production` | Production only |
| `NEXT_PUBLIC_API_URL` | `https://your-app.vercel.app` | Production, Preview, Development |

**Generate Secrets:**
```bash
# Generate secure random secrets
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For NEXTAUTH_SECRET
openssl rand -base64 32  # For SERVER_SHARE_SECRET
```

**Via Vercel CLI:**
```bash
# Set environment variables
vercel env add DATABASE_URL production
vercel env add JWT_SECRET production
vercel env add NEXTAUTH_SECRET production
vercel env add SERVER_SHARE_SECRET production
vercel env add AWS_ACCESS_KEY_ID production
vercel env add AWS_SECRET_ACCESS_KEY production
vercel env add AWS_S3_BUCKET production
vercel env add AWS_S3_REGION production
vercel env add SMTP_HOST production
vercel env add SMTP_PORT production
vercel env add SMTP_USER production
vercel env add SMTP_PASSWORD production
vercel env add EMAIL_FROM production
vercel env add SMTP_SECURE production
vercel env add NODE_ENV production
vercel env add NEXT_PUBLIC_API_URL production

# Repeat for preview and development if needed
```

### 4.2 Email Configuration Options

**Option 1: AWS SES (Recommended for Production)**

1. Go to [AWS SES Console](https://console.aws.amazon.com/ses/)
2. Verify your domain or email address
3. Create SMTP credentials:
   - Go to **SMTP settings** → **Create SMTP credentials**
   - Save the username and password
4. Use these values:
   ```
   SMTP_HOST=smtp.email.us-east-1.amazonaws.com
   SMTP_PORT=587
   SMTP_USER=your-smtp-username
   SMTP_PASSWORD=your-smtp-password
   SMTP_SECURE=false
   ```

**Option 2: Resend (Developer-Friendly)**

1. Sign up at [resend.com](https://resend.com)
2. Verify your domain
3. Get API key from dashboard
4. Use these values:
   ```
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=587
   SMTP_USER=resend
   SMTP_PASSWORD=your-resend-api-key
   SMTP_SECURE=false
   ```

**Option 3: SendGrid**

1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Create API key
3. Use these values:
   ```
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASSWORD=your-sendgrid-api-key
   SMTP_SECURE=false
   ```

**Option 4: Gmail (Development Only)**

⚠️ **Not recommended for production** - use for testing only

1. Enable 2-factor authentication
2. Generate app password
3. Use these values:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-app-password
   SMTP_SECURE=false
   ```

---

## Step 5: Database Migrations

### 5.1 Run Migrations Locally (First Time)

Before deploying, run migrations to set up your database schema:

```bash
cd frontend

# Install dependencies
npm install

# Generate Prisma Client
npm run prisma:generate

# Run migrations against Neon database
DATABASE_URL="your-neon-connection-string" npx prisma migrate deploy
```

### 5.2 Verify Database Schema

```bash
# Check database connection
DATABASE_URL="your-neon-connection-string" npx prisma db pull

# Open Prisma Studio (optional)
DATABASE_URL="your-neon-connection-string" npx prisma studio
```

### 5.3 Set Up Migration Script (Optional)

Create a script to run migrations after deployment:

**Create `scripts/migrate.sh`:**
```bash
#!/bin/bash
set -e

echo "🔄 Running database migrations..."

cd "$(dirname "$0")/../frontend"

# Generate Prisma Client
npm run prisma:generate

# Run migrations
npx prisma migrate deploy

echo "✅ Migrations complete!"
```

**Make executable:**
```bash
chmod +x scripts/migrate.sh
```

---

## Step 6: Deploy to Vercel

### 6.1 Deploy via CLI

```bash
cd frontend

# Deploy to production
vercel --prod

# Or deploy to preview (for testing)
vercel
```

**First Deployment:**
- Vercel will detect Next.js automatically
- It will run `npm install` and `npm run build`
- Deployment takes 2-5 minutes

### 6.2 Deploy via GitHub (Recommended)

**Connect GitHub Repository:**

1. Go to [vercel.com](https://vercel.com) → Your project
2. Click **Settings** → **Git**
3. Connect your GitHub repository
4. Configure:
   - **Production Branch**: `main` (or `master`)
   - **Framework Preset**: Next.js (auto-detected)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)

**Automatic Deployments:**
- Every push to `main` → Production deployment
- Every pull request → Preview deployment
- Every push to other branches → Preview deployment

### 6.3 Configure Build Settings

**In Vercel Dashboard:**

1. Go to **Settings** → **General**
2. **Framework Preset**: Next.js
3. **Root Directory**: `frontend` (if your repo root is not `frontend`)
4. **Build Command**: `npm run build`
5. **Output Directory**: `.next`
6. **Install Command**: `npm install`
7. **Node.js Version**: 20.x (or latest LTS)

**Environment Variables:**
- Make sure all environment variables are set (from Step 4)
- Mark sensitive variables as **"Encrypted"**

### 6.4 Run Migrations After Deployment

After first deployment, run migrations:

**Option 1: Via Vercel CLI (Local)**
```bash
# Pull environment variables
vercel env pull .env.local

# Run migrations
cd frontend
npx prisma migrate deploy
```

**Option 2: Via Vercel Function**

Create `api/migrate/route.ts` (temporary, remove after first migration):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  // Add authentication check here
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.MIGRATION_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { stdout, stderr } = await execAsync('npx prisma migrate deploy');
    return NextResponse.json({ 
      success: true, 
      output: stdout,
      error: stderr 
    });
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
```

Then call it:
```bash
curl -X POST https://your-app.vercel.app/api/migrate \
  -H "Authorization: Bearer YOUR_MIGRATION_SECRET"
```

**⚠️ Remove this endpoint after migrations are complete!**

---

## Step 7: Verify Deployment

### 7.1 Check Deployment Status

1. Go to [vercel.com](https://vercel.com) → Your project
2. Check **Deployments** tab
3. Verify deployment is successful (green checkmark)

### 7.2 Test Application

```bash
# Get your deployment URL
# Format: https://your-app.vercel.app

# Test health endpoint
curl https://your-app.vercel.app/api/health

# Expected response:
# {"status":"ok"}
```

### 7.3 Test Database Connection

1. Sign up for a new account
2. Verify email (if email is configured)
3. Create a vault
4. Upload a file
5. Verify it's stored in S3

### 7.4 Check Logs

**Via Vercel Dashboard:**
1. Go to **Deployments** → Click on deployment
2. Click **"Functions"** tab
3. View function logs

**Via Vercel CLI:**
```bash
vercel logs your-app.vercel.app
```

### 7.5 Verify S3 Uploads

1. Go to AWS S3 Console
2. Open your bucket: `lifevault-vaults-prod`
3. Upload a file via your app
4. Verify it appears in S3 (encrypted)

---

## Step 8: Configure Custom Domain

### 8.1 Add Domain in Vercel

1. Go to **Settings** → **Domains**
2. Enter your domain: `yourdomain.com`
3. Click **"Add"**
4. Follow DNS configuration instructions

### 8.2 Configure DNS

**For Root Domain (yourdomain.com):**

Add these DNS records:

| Type | Name | Value |
|------|------|-------|
| A | @ | 76.76.21.21 |
| A | @ | 76.223.126.88 |

**For Subdomain (www.yourdomain.com):**

| Type | Name | Value |
|------|------|-------|
| CNAME | www | cname.vercel-dns.com |

**Or use Vercel's nameservers:**
- Change your domain's nameservers to Vercel's
- Vercel will manage all DNS records

### 8.3 Update Environment Variables

After domain is configured:

1. Go to **Settings** → **Environment Variables**
2. Update `NEXT_PUBLIC_API_URL`:
   ```
   https://yourdomain.com
   ```
3. Redeploy (or wait for automatic redeploy)

### 8.4 Verify SSL

Vercel automatically provisions SSL certificates via Let's Encrypt. Wait 1-5 minutes for SSL to activate.

---

## Troubleshooting

### Build Fails

**Error: "Module not found"**
```bash
# Check package.json dependencies
# Make sure all dependencies are listed

# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

**Error: "Prisma Client not generated"**
```bash
# Generate Prisma Client
npm run prisma:generate

# Or add to build command in Vercel:
# Build Command: npm run prisma:generate && npm run build
```

### Database Connection Issues

**Error: "Connection timeout"**
- Check Neon connection string includes `?sslmode=require`
- Use pooled connection string (ends with `...pooler...`)
- Verify Neon project is active

**Error: "Too many connections"**
- Use connection pooling (Neon pooled connection string)
- Check Prisma connection pool settings

### S3 Upload Fails

**Error: "Access Denied"**
- Verify IAM user has correct permissions
- Check bucket policy allows IAM user
- Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are correct

**Error: "Bucket not found"**
- Verify `AWS_S3_BUCKET` environment variable matches bucket name
- Check bucket region matches `AWS_S3_REGION`

### Environment Variables Not Working

**Variables not available at runtime:**
- Make sure variables are set for correct environment (Production/Preview/Development)
- Redeploy after adding new variables
- Check variable names match exactly (case-sensitive)

**Sensitive data exposed:**
- Never commit `.env` files to git
- Use Vercel's encrypted environment variables
- Don't log environment variables

### Cron Jobs Not Running

**Cron not executing:**
- Verify `vercel.json` has correct cron configuration
- Check cron path matches your API route
- Verify function is deployed successfully
- Check Vercel logs for cron execution

---

## Cost Breakdown

### Free Tier (First Month/Year)

| Service | Free Tier | Limits |
|---------|-----------|--------|
| **Vercel** | Free | 100GB bandwidth, 100 serverless hours |
| **Neon** | Free | 0.5GB storage, 1 project |
| **AWS S3** | Free | 5GB storage, 20K GET requests |
| **Total** | **$0/month** | Perfect for MVP/testing |

### Production Costs (After Free Tier)

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| **Vercel** | Pro | $20/month |
| **Neon** | Launch | $19/month (10GB) |
| **AWS S3** | Pay-as-you-go | ~$0.25/month (10GB) |
| **Total** | | **~$40/month** |

### Cost Optimization Tips

1. **Use Vercel Free Tier** for development/preview
2. **Neon Free Tier** is generous for small apps
3. **S3 Lifecycle Policies** - move old files to Glacier
4. **Monitor Usage** - set up billing alerts
5. **Reserved Capacity** - not applicable (serverless)

---

## Security Checklist

- [ ] All environment variables marked as "Encrypted" in Vercel
- [ ] Database connection uses SSL (`sslmode=require`)
- [ ] S3 bucket encryption enabled (AES-256)
- [ ] IAM user has least privilege (S3 access only)
- [ ] Strong secrets generated (32+ characters)
- [ ] Custom domain with SSL enabled
- [ ] Security headers configured (in `next.config.mjs`)
- [ ] No sensitive data in logs
- [ ] Database backups enabled (Neon automatic)
- [ ] S3 versioning enabled (optional)

---

## Next Steps

1. **Set up monitoring**: Vercel Analytics, Sentry
2. **Configure backups**: Neon automatic backups
3. **Set up alerts**: Vercel deployment notifications
4. **Optimize performance**: Image optimization, caching
5. **Scale**: Upgrade plans as needed

---

## Quick Reference

### Deployment Commands

```bash
# Deploy to production
vercel --prod

# Deploy to preview
vercel

# View logs
vercel logs

# Pull environment variables
vercel env pull .env.local

# List environment variables
vercel env ls
```

### Database Commands

```bash
# Run migrations
npx prisma migrate deploy

# Generate Prisma Client
npm run prisma:generate

# Open Prisma Studio
npx prisma studio
```

### Useful Links

- [Vercel Dashboard](https://vercel.com/dashboard)
- [Neon Dashboard](https://console.neon.tech)
- [AWS S3 Console](https://s3.console.aws.amazon.com)
- [Vercel Documentation](https://vercel.com/docs)
- [Neon Documentation](https://neon.tech/docs)

---

**Last Updated**: January 2025

