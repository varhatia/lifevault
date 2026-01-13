# Environment Variables Setup Guide for LivPeace

This guide explains how to configure different environment variables for Production, Preview, and Development environments in Vercel.

---

## Understanding Vercel Environments

Vercel has three environments:

1. **Production** - Your live site at `livpeace.com`
2. **Preview** - Automatic deployments from pull requests and branches
3. **Development** - Local development (when running `vercel dev`)

**Important:** You can set different values for the same variable in each environment!

---

## How to Set Environment-Specific Variables in Vercel

### Step 1: Access Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: **lifevault** (or your project name)
3. Click **Settings** → **Environment Variables**

### Step 2: Add Variables for Each Environment

When adding a variable, you'll see checkboxes for:
- ☑️ **Production**
- ☑️ **Preview**  
- ☑️ **Development**

**You can:**
- ✅ Check different boxes for the same variable
- ✅ Use different values for Production vs Preview vs Development
- ✅ Leave some environments unchecked (variable won't be available there)

### Step 3: Example Configuration

Here's how to set up `SMTP_HOST` differently for each environment:

**For Production:**
1. Click **Add New**
2. Key: `SMTP_HOST`
3. Value: `email-smtp.us-east-1.amazonaws.com` (AWS SES)
4. Check: ☑️ Production only
5. Click **Save**

**For Preview:**
1. Click **Add New** again
2. Key: `SMTP_HOST` (same name!)
3. Value: `smtp.mailtrap.io` (Mailtrap for testing)
4. Check: ☑️ Preview only
5. Click **Save**

**For Development:**
1. Click **Add New** again
2. Key: `SMTP_HOST`
3. Value: `localhost` (or MailHog)
4. Check: ☑️ Development only
5. Click **Save**

**Result:** Vercel will use the correct value based on which environment is running!

---

## Recommended Production Email Services

### Option 1: AWS SES (Recommended for Production)

**Why AWS SES?**
- ✅ Very cost-effective ($0.10 per 1,000 emails after free tier)
- ✅ High deliverability
- ✅ Scales automatically
- ✅ Integrates well with AWS S3 (you're already using AWS)

**Setup Steps:**

1. **Go to AWS SES Console**
   - Visit: https://console.aws.amazon.com/ses/
   - Select your region (e.g., `us-east-1`)

2. **Verify Your Domain**
   - Click **Verified identities** → **Create identity**
   - Select **Domain**
   - Enter: `livpeace.com`
   - Click **Create identity**
   - Add the DNS records to your domain registrar (SPF, DKIM, DMARC)
   - Wait for verification (usually 5-10 minutes)

3. **Request Production Access** (if in sandbox)
   - Click **Account dashboard**
   - Click **Request production access**
   - Fill out the form (explain your use case)
   - Usually approved within 24 hours

4. **Create SMTP Credentials**
   - Go to **SMTP settings** → **Create SMTP credentials**
   - Save the username and password securely
   - **Note:** These are different from your AWS access keys!

5. **Configure in Vercel (Production Only):**
   ```
   SMTP_HOST=email-smtp.us-east-1.amazonaws.com
   SMTP_PORT=587
   SMTP_USER=your-ses-smtp-username
   SMTP_PASSWORD=your-ses-smtp-password
   SMTP_SECURE=false
   EMAIL_FROM=noreply@livpeace.com
   ```

**Cost:** 
- First 62,000 emails/month: **FREE** (if sent from EC2)
- After that: $0.10 per 1,000 emails
- Very affordable for most applications

---

### Option 2: Resend (Developer-Friendly)

**Why Resend?**
- ✅ Easy setup (5 minutes)
- ✅ Great developer experience
- ✅ Good deliverability
- ✅ Free tier: 3,000 emails/month
- ✅ $20/month for 50,000 emails

**Setup Steps:**

1. **Sign up at Resend**
   - Visit: https://resend.com
   - Create account

2. **Verify Your Domain**
   - Go to **Domains** → **Add Domain**
   - Enter: `livpeace.com`
   - Add DNS records to your registrar
   - Wait for verification

3. **Get API Key**
   - Go to **API Keys** → **Create API Key**
   - Save the key securely

4. **Configure in Vercel (Production Only):**
   ```
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=587
   SMTP_USER=resend
   SMTP_PASSWORD=your-resend-api-key
   SMTP_SECURE=false
   EMAIL_FROM=noreply@livpeace.com
   ```

**Cost:**
- Free: 3,000 emails/month
- Pro: $20/month for 50,000 emails
- Good for startups and small apps

---

### Option 3: SendGrid

**Why SendGrid?**
- ✅ Reliable and established
- ✅ Good free tier (100 emails/day)
- ✅ Good deliverability
- ✅ Detailed analytics

**Setup Steps:**

1. **Sign up at SendGrid**
   - Visit: https://sendgrid.com
   - Create account

2. **Verify Your Domain**
   - Go to **Settings** → **Sender Authentication**
   - Verify domain: `livpeace.com`
   - Add DNS records

3. **Create API Key**
   - Go to **Settings** → **API Keys**
   - Create API key with "Mail Send" permissions

4. **Configure in Vercel (Production Only):**
   ```
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASSWORD=your-sendgrid-api-key
   SMTP_SECURE=false
   EMAIL_FROM=noreply@livpeace.com
   ```

**Cost:**
- Free: 100 emails/day
- Essentials: $19.95/month for 50,000 emails

---

## Complete Environment Variables Configuration

### Production Environment Variables

Set these **only for Production** (☑️ Production checked):

```env
# Database
DATABASE_URL=postgresql://user:pass@neon-prod-host/dbname?sslmode=require

# Email (AWS SES)
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-smtp-username
SMTP_PASSWORD=your-ses-smtp-password
SMTP_SECURE=false
EMAIL_FROM=noreply@livpeace.com
EMAIL_FROM_NAME=LivPeace

# Application
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://livpeace.com
VERCEL_ENV=production

# Security (same for all environments)
JWT_SECRET=your-jwt-secret
NEXTAUTH_SECRET=your-nextauth-secret
SERVER_SHARE_SECRET=your-server-share-secret

# AWS S3 (same for all environments)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=lifevault-vaults-prod
AWS_S3_REGION=ap-southeast-2
```

### Preview Environment Variables

Set these **only for Preview** (☑️ Preview checked):

```env
# Database (use a separate preview/staging database)
DATABASE_URL=postgresql://user:pass@neon-preview-host/dbname?sslmode=require

# Email (Mailtrap for testing)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-mailtrap-username
SMTP_PASSWORD=your-mailtrap-password
SMTP_SECURE=false
EMAIL_FROM=noreply@livpeace.com
EMAIL_FROM_NAME=LivPeace (Preview)

# Application
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://your-preview-url.vercel.app
VERCEL_ENV=preview

# Security (same as production)
JWT_SECRET=your-jwt-secret
NEXTAUTH_SECRET=your-nextauth-secret
SERVER_SHARE_SECRET=your-server-share-secret

# AWS S3 (can use same bucket or separate preview bucket)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=lifevault-vaults-preview  # or same as prod
AWS_S3_REGION=ap-southeast-2
```

### Development Environment Variables

Set these **only for Development** (☑️ Development checked):

```env
# Database (local or dev database)
DATABASE_URL=postgresql://user:pass@localhost:5432/livpeace_dev

# Email (MailHog for local development)
USE_MAILHOG=true
MAILHOG_HOST=localhost
MAILHOG_PORT=1025

# Application
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3000

# Security (can use test secrets)
JWT_SECRET=dev-jwt-secret
NEXTAUTH_SECRET=dev-nextauth-secret
SERVER_SHARE_SECRET=dev-server-share-secret

# AWS S3 (local or dev bucket)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=lifevault-vaults-dev
AWS_S3_REGION=ap-southeast-2
```

---

## How Your Code Detects Environment

Your email code (`frontend/src/lib/api/email.ts`) already handles this:

```typescript
// It checks VERCEL_ENV to determine environment
const IS_PRODUCTION = process.env.VERCEL_ENV === 'production';
const USE_MAILHOG = process.env.USE_MAILHOG === 'true' || (!IS_PRODUCTION && ...);

// Production: Uses SMTP settings
// Preview/Dev: Can use MailHog or SMTP
```

**This means:**
- ✅ Production: Uses `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` (AWS SES)
- ✅ Preview: Can use Mailtrap SMTP settings
- ✅ Development: Can use MailHog (if `USE_MAILHOG=true`)

---

## Step-by-Step: Setting Up Production Email (AWS SES)

### 1. Create AWS SES Account

1. Go to https://console.aws.amazon.com/ses/
2. Sign in or create AWS account
3. Select region (e.g., `us-east-1`)

### 2. Verify Domain

1. Click **Verified identities** → **Create identity**
2. Select **Domain**
3. Enter: `livpeace.com`
4. Click **Create identity**
5. You'll see DNS records to add:
   - **CNAME records** for DKIM
   - **TXT record** for domain verification
6. Add these to your domain registrar (where you manage DNS for `livpeace.com`)
7. Wait for verification (checkmark appears)

### 3. Request Production Access

1. In SES Console, go to **Account dashboard**
2. You'll see "Account is in sandbox mode"
3. Click **Request production access**
4. Fill out the form:
   - **Mail Type:** Transactional
   - **Website URL:** https://livpeace.com
   - **Use case description:** 
     ```
     LivPeace is a secure vault application. We send:
     - Email verification emails
     - Password reset emails
     - Nominee access notifications
     - Vault recovery emails
     ```
   - **Expected sending volume:** Estimate your monthly emails
5. Submit request
6. Usually approved within 24 hours

### 4. Create SMTP Credentials

1. Go to **SMTP settings** (left sidebar)
2. Click **Create SMTP credentials**
3. **IAM User Name:** `livpeace-smtp-user` (or any name)
4. Click **Create**
5. **IMPORTANT:** Download or copy the credentials:
   - **SMTP Username:** (starts with `AKIA...`)
   - **SMTP Password:** (random string)
6. Save these securely - you can't view the password again!

### 5. Configure in Vercel

1. Go to Vercel Dashboard → **Settings** → **Environment Variables**
2. Add these variables **for Production only**:

   ```
   SMTP_HOST=email-smtp.us-east-1.amazonaws.com
   SMTP_PORT=587
   SMTP_USER=AKIA... (your SMTP username from step 4)
   SMTP_PASSWORD=... (your SMTP password from step 4)
   SMTP_SECURE=false
   EMAIL_FROM=noreply@livpeace.com
   EMAIL_FROM_NAME=LivPeace
   ```

3. Make sure **only Production** is checked ☑️
4. Click **Save**

### 6. Test Production Email

1. Redeploy your production site (or wait for next deployment)
2. Test email verification:
   - Sign up with a real email
   - Check if verification email arrives
3. Check AWS SES Console → **Sending statistics** to see sent emails

---

## Step-by-Step: Keeping Mailtrap for Preview

### Option A: Keep Mailtrap for Preview Only

1. In Vercel → **Environment Variables**
2. Find your Mailtrap variables
3. Edit each one:
   - Uncheck ☑️ Production
   - Keep ☑️ Preview checked
   - Keep ☑️ Development checked (optional)
4. Click **Save**

### Option B: Add New Mailtrap Variables for Preview

1. Add new variables with same names but different values
2. Check only ☑️ Preview
3. This way:
   - Production: Uses AWS SES
   - Preview: Uses Mailtrap
   - Development: Uses MailHog

---

## Database URLs: Separate for Each Environment

### Production Database

Use your **Neon Production database**:
```
DATABASE_URL=postgresql://user:pass@prod-host.neon.tech/dbname?sslmode=require
```
☑️ Production only

### Preview Database

Create a **separate Neon database** for preview/staging:
1. Go to Neon Console
2. Create new project: `livpeace-preview`
3. Copy connection string
4. Set in Vercel: ☑️ Preview only

### Development Database

Use local PostgreSQL or separate dev database:
```
DATABASE_URL=postgresql://user:pass@localhost:5432/livpeace_dev
```
☑️ Development only

---

## Quick Reference: Environment Checklist

### ✅ Production (`livpeace.com`)

- [ ] Database: Neon Production database
- [ ] Email: AWS SES (or Resend/SendGrid)
- [ ] Domain: `livpeace.com`
- [ ] S3 Bucket: Production bucket
- [ ] All secrets: Production secrets

### ✅ Preview (Pull Requests)

- [ ] Database: Neon Preview/Staging database (separate)
- [ ] Email: Mailtrap (for testing)
- [ ] Domain: Auto-generated Vercel URL
- [ ] S3 Bucket: Preview bucket (or same as prod)
- [ ] Secrets: Can use same or separate

### ✅ Development (Local)

- [ ] Database: Local PostgreSQL or dev database
- [ ] Email: MailHog (`USE_MAILHOG=true`)
- [ ] Domain: `localhost:3000`
- [ ] S3 Bucket: Dev bucket (or local)
- [ ] Secrets: Dev/test secrets

---

## Troubleshooting

### "Same variables for all environments"

**Problem:** You see the same values in Production, Preview, and Development

**Solution:**
1. In Vercel → Environment Variables
2. Click on a variable
3. You'll see which environments it's set for
4. You can have **multiple entries** with the same name for different environments
5. Vercel uses the one matching the current environment

### "Emails not sending in production"

**Check:**
1. Verify `VERCEL_ENV=production` is set
2. Check SMTP credentials are correct
3. Verify domain in AWS SES (if using SES)
4. Check AWS SES is out of sandbox (if needed)
5. Check Vercel function logs for errors

### "How do I know which environment is running?"

Your code can check:
```typescript
console.log('VERCEL_ENV:', process.env.VERCEL_ENV);
// Production: 'production'
// Preview: 'preview'  
// Development: undefined or 'development'
```

---

## Recommended Setup Summary

### For Production (`livpeace.com`):

**Email Service:** AWS SES
- ✅ Cost-effective
- ✅ High deliverability
- ✅ Scales automatically
- ✅ You're already using AWS (S3)

**Database:** Neon Production
- ✅ Separate production database
- ✅ Regular backups
- ✅ Connection pooling enabled

### For Preview (Testing):

**Email Service:** Mailtrap
- ✅ Keep for testing preview deployments
- ✅ See all emails in Mailtrap inbox
- ✅ No cost for testing

**Database:** Neon Preview/Staging
- ✅ Separate database for testing
- ✅ Can reset without affecting production

### For Development (Local):

**Email Service:** MailHog
- ✅ Local email testing
- ✅ No external service needed
- ✅ Fast and easy

**Database:** Local PostgreSQL
- ✅ Fast development
- ✅ Can reset anytime

---

## Next Steps

1. **Set up AWS SES** for production email (follow steps above)
2. **Update Vercel environment variables** to separate Production/Preview/Development
3. **Test production email** after deployment
4. **Monitor AWS SES** sending statistics
5. **Set up separate preview database** (optional but recommended)

---

**Last Updated:** January 2025

