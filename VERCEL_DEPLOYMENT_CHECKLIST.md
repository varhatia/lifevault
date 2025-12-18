# Vercel + Neon + S3 Deployment Checklist

Quick reference checklist for deploying LifeVault on Vercel.

## Pre-Deployment

- [ ] GitHub repository created and code pushed
- [ ] Vercel account created
- [ ] Neon account created
- [ ] AWS account created (for S3)
- [ ] Domain name registered (optional)

## Step 1: Neon Database

- [ ] Neon account created
- [ ] New project created (`lifevault-prod`)
- [ ] Region selected (closest to users)
- [ ] Connection string copied (with pooling)
- [ ] Password saved securely
- [ ] Connection pooling enabled
- [ ] Database name set (if custom)

## Step 2: AWS S3

- [ ] S3 bucket created (`lifevault-vaults-prod`)
- [ ] Bucket encryption enabled (AES-256)
- [ ] Versioning enabled (optional)
- [ ] IAM user created (`vercel-s3-access`)
- [ ] IAM policy created (S3 access only)
- [ ] Policy attached to IAM user
- [ ] Access key ID saved
- [ ] Secret access key saved securely
- [ ] Bucket policy configured (optional)

## Step 3: Vercel Setup

- [ ] Vercel CLI installed (`npm install -g vercel`)
- [ ] Logged in to Vercel (`vercel login`)
- [ ] Project linked (`vercel link`)
- [ ] GitHub repository connected
- [ ] Build settings configured
- [ ] Root directory set (if needed)

## Step 4: Environment Variables

### Database
- [ ] `DATABASE_URL` - Neon connection string (with pooling)
- [ ] Connection string includes `?sslmode=require`

### Security
- [ ] `JWT_SECRET` - Generated (32+ characters)
- [ ] `NEXTAUTH_SECRET` - Generated (32+ characters)
- [ ] `SERVER_SHARE_SECRET` - Generated (32+ characters)

### AWS S3
- [ ] `AWS_ACCESS_KEY_ID` - IAM user access key
- [ ] `AWS_SECRET_ACCESS_KEY` - IAM user secret key
- [ ] `AWS_S3_BUCKET` - `lifevault-vaults-prod`
- [ ] `AWS_S3_REGION` - `us-east-1`

### Email (SMTP)
- [ ] `SMTP_HOST` - Email provider host
- [ ] `SMTP_PORT` - `587` (TLS) or `465` (SSL)
- [ ] `SMTP_USER` - Email username
- [ ] `SMTP_PASSWORD` - Email password/app password
- [ ] `SMTP_SECURE` - `false` (587) or `true` (465)
- [ ] `EMAIL_FROM` - `noreply@yourdomain.com`

### Application
- [ ] `NODE_ENV` - `production`
- [ ] `NEXT_PUBLIC_API_URL` - `https://your-app.vercel.app`

### All Variables
- [ ] All variables marked as "Encrypted" in Vercel
- [ ] Variables set for Production environment
- [ ] Variables set for Preview environment (optional)
- [ ] Variables set for Development environment (optional)

## Step 5: Database Migrations

- [ ] Dependencies installed locally (`npm install`)
- [ ] Prisma Client generated (`npm run prisma:generate`)
- [ ] Migrations run against Neon (`npx prisma migrate deploy`)
- [ ] Database schema verified
- [ ] Test data created (optional)

## Step 6: Deployment

- [ ] Code pushed to GitHub
- [ ] Vercel deployment triggered (automatic or manual)
- [ ] Build successful
- [ ] Deployment completed
- [ ] No build errors

## Step 7: Verification

- [ ] Application accessible at Vercel URL
- [ ] Health endpoint working (`/api/health`)
- [ ] User signup working
- [ ] Email verification working (if configured)
- [ ] Database connection working
- [ ] S3 upload working
- [ ] S3 download working
- [ ] Vault creation working
- [ ] File upload working

## Step 8: Custom Domain (Optional)

- [ ] Domain added in Vercel
- [ ] DNS records configured
- [ ] SSL certificate provisioned
- [ ] Domain verified
- [ ] `NEXT_PUBLIC_API_URL` updated
- [ ] Application accessible via custom domain

## Post-Deployment

- [ ] Monitoring configured
- [ ] Error tracking set up (Sentry, etc.)
- [ ] Logs accessible
- [ ] Cron jobs running (check logs)
- [ ] Backup strategy in place
- [ ] Team access configured
- [ ] Documentation updated

## Security Verification

- [ ] All environment variables encrypted
- [ ] Database connection uses SSL
- [ ] S3 bucket encryption enabled
- [ ] IAM user has least privilege
- [ ] Strong secrets used (32+ characters)
- [ ] HTTPS enforced
- [ ] Security headers configured
- [ ] No sensitive data in logs
- [ ] No secrets in code

## Cost Monitoring

- [ ] Vercel usage monitored
- [ ] Neon usage monitored
- [ ] S3 usage monitored
- [ ] Billing alerts configured
- [ ] Cost optimization reviewed

---

## Quick Commands

### Vercel CLI
```bash
# Deploy
vercel --prod

# View logs
vercel logs

# Pull env vars
vercel env pull .env.local

# List env vars
vercel env ls
```

### Database
```bash
# Run migrations
npx prisma migrate deploy

# Generate Prisma Client
npm run prisma:generate

# Open Prisma Studio
npx prisma studio
```

### Generate Secrets
```bash
# Generate secure secrets
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For NEXTAUTH_SECRET
openssl rand -base64 32  # For SERVER_SHARE_SECRET
```

---

## Troubleshooting Quick Reference

| Issue | Solution |
|-------|----------|
| Build fails | Check dependencies, clear `.next` folder |
| Database timeout | Use pooled connection string |
| S3 access denied | Verify IAM permissions |
| Email not sending | Check SMTP credentials |
| Environment vars not working | Redeploy after adding vars |
| Cron not running | Check `vercel.json` configuration |

---

**Last Updated**: January 2025

