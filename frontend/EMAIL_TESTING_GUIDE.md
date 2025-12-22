# Email Testing Guide for Vercel + AWS SES

This guide explains how to test emails when using AWS SES on Vercel, especially with fake/test email addresses during development.

## The Problem

When you deploy to Vercel with AWS SES configured, emails are sent through SES. However, **AWS SES starts in "Sandbox Mode"** which has limitations:

- ✅ You can send emails **TO** verified email addresses
- ❌ You **CANNOT** send emails to unverified addresses (like `user1@gmail.com`, `test@example.com`)
- ❌ You **CANNOT** send emails from unverified domains/addresses

## Solutions for Testing

### Option 1: Verify Test Email Addresses in SES (Recommended)

This is the simplest solution for testing with fake emails.

#### Steps:

1. **Go to AWS SES Console**
   - Navigate to [AWS SES Console](https://console.aws.amazon.com/ses/)
   - Select your region (e.g., `us-east-1`)

2. **Verify Email Addresses**
   - Go to **Verified identities** → **Create identity**
   - Choose **Email address**
   - Enter test emails you want to use:
     - `user1@gmail.com`
     - `user2@gmail.com`
     - `test@example.com`
     - etc.
   - Click **Create identity**

3. **Check Your Email Inbox**
   - AWS will send a verification email to each address
   - Click the verification link in each email
   - Once verified, you can send emails TO these addresses

4. **Test Your Application**
   - Now you can use these verified emails in your app
   - Emails will be delivered to the real inboxes
   - You can check the inboxes to see the emails

**Note:** You can verify up to 10,000 email addresses in SES sandbox mode.

---

### Option 2: Request Production Access (For Production Only)

If you need to send to any email address (not just verified ones):

1. **Request Production Access**
   - Go to AWS SES Console → **Account dashboard**
   - Click **Request production access**
   - Fill out the form explaining your use case
   - AWS will review and approve (usually within 24-48 hours)

2. **Benefits:**
   - Can send to any email address
   - Higher sending limits
   - No need to verify recipient emails

**⚠️ Warning:** Only request this for production. For testing, use Option 1.

---

### Option 3: Use Different Email Service for Preview/Development

You can use a different email service for Vercel Preview/Development environments while using SES for Production.

#### Option 3a: Use Resend (Real Email Service)

**⚠️ Important:** Resend is a **real email sending service** (like AWS SES). It actually sends emails to real email addresses.

**How Resend Works:**
- ✅ **Actually sends emails** to real email addresses
- ✅ **Emails arrive in real inboxes** (Gmail, Yahoo, etc.)
- ❌ **You need real email accounts** to receive and view emails
- ❌ **Not ideal for testing with fake emails** - emails will bounce or go to spam if addresses don't exist

**Use Cases:**
- Good for **production** or **staging** where you want real emails
- Good when you have **real test email accounts** (like your own Gmail)
- **Not ideal** for testing with fake emails like `user1@gmail.com`

**Setup Steps:**

1. **Sign up for Resend** (free tier available)
   - Go to [resend.com](https://resend.com)
   - Create an account
   - Get your API key

2. **Configure in Vercel**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - For **Preview** and **Development** environments:
     ```
     SMTP_HOST=smtp.resend.com
     SMTP_PORT=587
     SMTP_USER=resend
     SMTP_PASSWORD=your-resend-api-key
     SMTP_SECURE=false
     USE_MAILHOG=false
     ```
   - For **Production** environment (keep SES):
     ```
     SMTP_HOST=email-smtp.us-east-1.amazonaws.com
     SMTP_PORT=587
     SMTP_USER=your-ses-smtp-username
     SMTP_PASSWORD=your-ses-smtp-password
     SMTP_SECURE=false
     USE_MAILHOG=false
     ```

3. **Benefits:**
   - Can send to any email address (no verification needed)
   - Free tier: 3,000 emails/month
   - Easy to use
   - Real emails arrive in inboxes

4. **Limitations:**
   - Requires real email accounts to receive emails
   - Fake emails (like `user1@gmail.com`) will bounce or go to spam
   - Not ideal for testing without real email accounts

#### Option 3b: Use Mailtrap (Email Testing Service) ⭐ Recommended for Testing

**Mailtrap is perfect for your use case!** It's a **fake SMTP server** that **captures/intercepts** emails without sending them to real addresses.

**How Mailtrap Works:**
- ✅ **Captures emails** - Intercepts emails your app sends
- ✅ **Stores in web inbox** - View all emails in Mailtrap's web interface
- ✅ **No real emails sent** - Nothing is delivered to real addresses
- ✅ **No email verification needed** - Works with any email address (user1@gmail.com, test@example.com, etc.)
- ✅ **No need to create Gmail/Yahoo accounts** - Use any fake email addresses
- ✅ **Perfect for testing** - No risk of sending test emails to real users

**Key Difference from Resend:**
- **Mailtrap**: Captures emails (testing tool) → View in Mailtrap's inbox
- **Resend**: Actually sends emails → View in real email inboxes (Gmail, Yahoo, etc.)

**Key Benefits:**
- ✅ **No real emails sent** - All emails are captured in Mailtrap's inbox
- ✅ **No email verification needed** - Works with any email address (user1@gmail.com, test@example.com, etc.)
- ✅ **No need to create Gmail/Yahoo accounts** - Use any fake email addresses
- ✅ **View emails in web interface** - See exactly what your app sends
- ✅ **Free tier available** - 500 emails/month free
- ✅ **Perfect for testing** - No risk of sending test emails to real users

**Setup Steps:**

1. **Sign up for Mailtrap**
   - Go to [mailtrap.io](https://mailtrap.io)
   - Click "Sign Up" (free account available)
   - Verify your email address

2. **Get SMTP Credentials**
   - After login, go to **Email Testing** → **Inboxes**
   - Click on your inbox (or create a new one)
   - Go to **SMTP Settings** tab
   - Select **Integrations** → **Nodemailer**
   - You'll see:
     ```
     Host: smtp.mailtrap.io
     Port: 2525
     Username: (your username)
     Password: (your password)
     ```

3. **Configure in Vercel**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - For **Preview** and **Development** environments, add:
     ```
     SMTP_HOST=smtp.mailtrap.io
     SMTP_PORT=2525
     SMTP_USER=your-mailtrap-username
     SMTP_PASSWORD=your-mailtrap-password
     SMTP_SECURE=false
     USE_MAILHOG=false
     ```
   - For **Production**, keep your AWS SES settings

4. **Test Your Application**
   - Deploy to Vercel Preview
   - Trigger email sending (signup, password reset, etc.)
   - Go to Mailtrap → **Email Testing** → **Inboxes**
   - You'll see all captured emails in the inbox
   - Click on any email to view the full content, HTML, headers, etc.

**Example:**
- Your app sends email to `user1@gmail.com` (doesn't need to exist)
- Mailtrap captures it
- You view it in Mailtrap's web interface
- No email is sent to the real Gmail address

---

### Option 4: Use Ethereal Email (Free Testing Service)

Ethereal Email provides a free SMTP service for testing:

1. **Generate Ethereal Credentials**
   - Go to [ethereal.email](https://ethereal.email)
   - Click "Create Account"
   - You'll get SMTP credentials

2. **Configure in Vercel**
   - For **Preview** and **Development**:
     ```
     SMTP_HOST=smtp.ethereal.email
     SMTP_PORT=587
     SMTP_USER=your-ethereal-username
     SMTP_PASSWORD=your-ethereal-password
     SMTP_SECURE=false
     USE_MAILHOG=false
     ```
   - Emails are captured in Ethereal's web interface
   - No real emails are sent

---

## Recommended Setup for Different Environments

### Local Development (Your Computer)

Use MailHog (as you're already doing):

```env
USE_MAILHOG=true
MAILHOG_HOST=localhost
MAILHOG_PORT=1025
NODE_ENV=development
```

### Vercel Preview/Development

**Option A:** Verify test emails in SES (see Option 1 above)

**Option B:** Use Resend or Mailtrap:

```env
USE_MAILHOG=false
SMTP_HOST=smtp.resend.com  # or smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=resend  # or your-mailtrap-username
SMTP_PASSWORD=your-api-key
SMTP_SECURE=false
NODE_ENV=production
VERCEL_ENV=preview
```

### Vercel Production

Use AWS SES:

```env
USE_MAILHOG=false
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-smtp-username
SMTP_PASSWORD=your-ses-smtp-password
SMTP_SECURE=false
NODE_ENV=production
VERCEL_ENV=production
```

---

## How to Set Environment Variables in Vercel

1. **Go to Vercel Dashboard**
   - Navigate to your project
   - Click **Settings** → **Environment Variables**

2. **Add Variables for Each Environment**
   - Select the environment: **Production**, **Preview**, or **Development**
   - Add each variable
   - Click **Save**

3. **Environment-Specific Configuration**
   - You can set different values for Production vs Preview
   - For example:
     - Production: Use SES
     - Preview: Use Resend or verified SES emails

---

## Testing Checklist

- [ ] Verify test email addresses in AWS SES (if using SES for testing)
- [ ] Set up environment variables in Vercel for each environment
- [ ] Test email sending in Preview environment
- [ ] Verify emails are received (check inbox or Mailtrap/Ethereal)
- [ ] Test email sending in Production environment
- [ ] Monitor AWS SES sending limits and quotas

---

## Quick Reference: AWS SES Sandbox Limits

- **Sending Quota:** 200 emails per day (can be increased)
- **Sending Rate:** 1 email per second (can be increased)
- **Recipients:** Only verified email addresses
- **From Address:** Must be verified domain or email

---

## Troubleshooting

### "Email address is not verified" Error

**Solution:** Verify the recipient email address in AWS SES Console.

### "Sending quota exceeded" Error

**Solution:** 
- Wait 24 hours for quota reset, OR
- Request production access to increase limits

### Emails Not Arriving

**Check:**
1. AWS SES Console → **Sending statistics** → Check bounce/complaint rates
2. Check spam folder
3. Verify sender email/domain is verified
4. Check Vercel logs for email sending errors

---

## Best Practices

1. **For Development/Testing:**
   - Use MailHog locally
   - Use Resend or Mailtrap for Vercel Preview
   - Verify test emails in SES if you want to test with real inboxes

2. **For Production:**
   - Use AWS SES with verified domain
   - Request production access if needed
   - Monitor sending statistics and bounce rates
   - Set up bounce/complaint handling

3. **Email Testing:**
   - Always test email templates before production
   - Use email testing services (Mailtrap, Ethereal) to avoid cluttering real inboxes
   - Verify emails render correctly in different email clients

---

**Last Updated:** January 2025

