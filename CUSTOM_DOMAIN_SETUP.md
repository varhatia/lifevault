# Custom Domain Setup Guide: livpeace.com

This guide will walk you through configuring `livpeace.com` as your custom domain on Vercel.

---

## Prerequisites

- ✅ Domain `livpeace.com` registered and accessible
- ✅ Access to your domain registrar's DNS management panel
- ✅ Vercel project deployed and working
- ✅ Access to Vercel dashboard

---

## Step 1: Add Domain in Vercel Dashboard

### 1.1 Navigate to Domain Settings

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: **lifevault** (or your project name)
3. Click on **Settings** tab
4. Click on **Domains** in the left sidebar

### 1.2 Add Your Domain

1. In the **Domains** section, enter: `livpeace.com`
2. Click **Add** or **Add Domain**
3. Vercel will show you DNS configuration instructions

---

## Step 2: Configure DNS Records

You have two options for DNS configuration:

### Option A: Use Vercel's Nameservers (Recommended - Easiest)

**If your domain registrar supports nameserver changes:**

1. In Vercel, you'll see nameservers like:
   ```
   ns1.vercel-dns.com
   ns2.vercel-dns.com
   ```

2. Go to your domain registrar (where you bought `livpeace.com`)
3. Find **Nameserver** or **DNS** settings
4. Replace existing nameservers with Vercel's nameservers
5. Save changes
6. Wait 24-48 hours for DNS propagation

**Benefits:**
- ✅ Vercel manages all DNS records automatically
- ✅ Automatic SSL certificate provisioning
- ✅ Easier to manage

### Option B: Configure DNS Records Manually

**If you want to keep your current nameservers:**

#### For Root Domain (livpeace.com):

Add these DNS records in your domain registrar:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | 76.76.21.21 | 3600 |
| A | @ | 76.223.126.88 | 3600 |

**Note:** Vercel will show you the exact IP addresses to use. These may change, so check Vercel dashboard for current values.

#### For WWW Subdomain (www.livpeace.com):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | www | cname.vercel-dns.com | 3600 |

**Or if your registrar doesn't support CNAME for root:**

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | www | 76.76.21.21 | 3600 |
| A | www | 76.223.126.88 | 3600 |

---

## Step 3: Verify Domain in Vercel

1. After adding DNS records, go back to Vercel Dashboard
2. In **Settings** → **Domains**, you'll see your domain status:
   - ⏳ **Pending** - DNS records not yet detected
   - ✅ **Valid** - Domain is configured correctly
   - ❌ **Invalid** - Check DNS configuration

3. **Wait for DNS Propagation:**
   - Usually takes 5 minutes to 24 hours
   - You can check status using: https://dnschecker.org
   - Enter `livpeace.com` and check A records

---

## Step 4: SSL Certificate (Automatic)

Vercel automatically provisions SSL certificates via Let's Encrypt:

1. Once DNS is verified, Vercel will automatically:
   - Request SSL certificate
   - Configure HTTPS
   - Enable automatic renewal

2. **Wait Time:** 1-5 minutes after DNS verification

3. **Verify SSL:**
   - Visit: `https://livpeace.com`
   - Check for padlock icon in browser
   - Should show "Secure" connection

---

## Step 5: Update Environment Variables

After domain is configured, update your environment variables:

### 5.1 Update in Vercel Dashboard

1. Go to **Settings** → **Environment Variables**
2. Find or add: `NEXT_PUBLIC_API_URL`
3. Update value to: `https://livpeace.com`
4. Make sure it's set for **Production** environment
5. Click **Save**

### 5.2 Update Email Configuration

If you have email-related environment variables:

1. Update `EMAIL_FROM` to: `noreply@livpeace.com`
2. Update any email templates that reference the old domain

### 5.3 Redeploy

After updating environment variables:

1. Go to **Deployments** tab
2. Click **Redeploy** on the latest deployment
3. Or push a new commit to trigger automatic deployment

---

## Step 6: Update Application Code (If Needed)

### 6.1 Check for Hardcoded URLs

Search your codebase for any hardcoded Vercel URLs:

```bash
# Search for old domain references
grep -r "lifevault.*vercel" frontend/src
grep -r "vercel.app" frontend/src
```

### 6.2 Update Email Templates

Check `frontend/src/lib/api/email.ts`:
- Already updated to use `livpeace.com` domain ✅
- Verify `EMAIL_FROM` is set correctly

### 6.3 Update Landing Page

Check `frontend/src/app/components/LandingPage.tsx`:
- Already rebranded to LivPeace ✅

---

## Step 7: Test Your Domain

### 7.1 Basic Tests

1. **Root Domain:**
   ```bash
   curl https://livpeace.com/api/health
   # Expected: {"status":"ok"}
   ```

2. **WWW Subdomain (if configured):**
   ```bash
   curl https://www.livpeace.com/api/health
   ```

3. **Browser Test:**
   - Visit: `https://livpeace.com`
   - Check for SSL certificate (padlock icon)
   - Test login/signup flows
   - Verify email links work correctly

### 7.2 Verify Redirects

Vercel should automatically:
- Redirect `http://livpeace.com` → `https://livpeace.com`
- Redirect `www.livpeace.com` → `livpeace.com` (if configured)

---

## Step 8: Update External Services

### 8.1 Email Service Provider

If using a service like SendGrid, Mailgun, etc.:
- Update sender domain to `livpeace.com`
- Configure SPF, DKIM, and DMARC records
- Verify domain in email service dashboard

### 8.2 OAuth Providers (if applicable)

If using Google OAuth, Facebook Login, etc.:
- Update authorized redirect URIs to include `https://livpeace.com`
- Update authorized JavaScript origins

### 8.3 Analytics

If using Google Analytics, Plausible, etc.:
- Update domain in analytics dashboard
- Update tracking code if needed

---

## Troubleshooting

### Domain Not Verifying

**Problem:** Domain shows as "Invalid" in Vercel

**Solutions:**
1. Check DNS records are correct using: https://dnschecker.org
2. Ensure TTL is not too high (use 3600 or lower)
3. Wait 24-48 hours for full DNS propagation
4. Verify you're using the correct IP addresses from Vercel

### SSL Certificate Not Provisioning

**Problem:** HTTPS not working after DNS verification

**Solutions:**
1. Wait 5-10 minutes after DNS verification
2. Check Vercel dashboard for SSL status
3. Clear browser cache and try again
4. Contact Vercel support if issue persists

### Redirects Not Working

**Problem:** HTTP not redirecting to HTTPS

**Solutions:**
1. Vercel handles this automatically
2. Check Vercel dashboard → Settings → Domains
3. Ensure "Force HTTPS" is enabled (default)

### Email Links Broken

**Problem:** Email links point to old Vercel URL

**Solutions:**
1. Update `NEXT_PUBLIC_API_URL` environment variable
2. Redeploy application
3. Test email links after redeploy

---

## Quick Reference: DNS Records Summary

### For Root Domain (livpeace.com)

**Option 1: A Records (if not using nameservers)**
```
Type: A
Name: @
Value: 76.76.21.21
TTL: 3600

Type: A
Name: @
Value: 76.223.126.88
TTL: 3600
```

**Option 2: CNAME (if supported)**
```
Type: CNAME
Name: @
Value: cname.vercel-dns.com
TTL: 3600
```

### For WWW Subdomain

```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 3600
```

---

## Post-Setup Checklist

- [ ] Domain added in Vercel dashboard
- [ ] DNS records configured correctly
- [ ] Domain verified in Vercel (shows as "Valid")
- [ ] SSL certificate provisioned (HTTPS working)
- [ ] `NEXT_PUBLIC_API_URL` updated to `https://livpeace.com`
- [ ] Application redeployed with new environment variables
- [ ] Root domain accessible: `https://livpeace.com`
- [ ] WWW subdomain accessible (if configured): `https://www.livpeace.com`
- [ ] HTTP redirects to HTTPS automatically
- [ ] Email links work correctly
- [ ] All application features tested on new domain

---

## Additional Resources

- [Vercel Domain Documentation](https://vercel.com/docs/concepts/projects/domains)
- [DNS Checker Tool](https://dnschecker.org)
- [SSL Checker Tool](https://www.ssllabs.com/ssltest/)

---

## Support

If you encounter issues:

1. **Check Vercel Status:** https://vercel-status.com
2. **Vercel Support:** https://vercel.com/support
3. **DNS Propagation:** Use https://dnschecker.org to verify DNS records globally

---

**Last Updated:** January 2025

