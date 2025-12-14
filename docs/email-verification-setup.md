# Email Verification Setup Guide

LifeVault now includes email verification for user onboarding. Users must verify their email address before they can set up their master password.

## Development Setup (MailHog)

For development, we use **MailHog** to capture emails locally without sending real emails.

### 1. Install MailHog

**macOS (using Homebrew):**
```bash
brew install mailhog
```

**Linux:**
```bash
# Download from https://github.com/mailhog/MailHog/releases
# Or use Docker:
docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog
```

**Windows:**
Download from https://github.com/mailhog/MailHog/releases

### 2. Start MailHog

```bash
mailhog
```

MailHog will start on:
- **SMTP Server**: `localhost:1025` (for sending emails)
- **Web UI**: `http://localhost:8025` (to view captured emails)

### 3. Configure Environment Variables

Add to your `.env.local`:

```env
USE_MAILHOG=true
MAILHOG_HOST=localhost
MAILHOG_PORT=1025
EMAIL_FROM=noreply@lifevault.app
EMAIL_FROM_NAME=LifeVault
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Test Email Verification

1. Start your Next.js app: `npm run dev`
2. Sign up with a new account
3. Check MailHog web UI at `http://localhost:8025`
4. Click the verification link in the email
5. You should be redirected to vault setup

## Production Setup

For production, configure a real email service (SendGrid, AWS SES, etc.).

### Option 1: SendGrid

1. Create a SendGrid account
2. Generate an API key
3. Configure environment variables:

```env
USE_MAILHOG=false
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_SECURE=false
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=LifeVault
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Option 2: AWS SES

1. Set up AWS SES
2. Verify your domain/email
3. Configure environment variables:

```env
USE_MAILHOG=false
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-aws-access-key
SMTP_PASSWORD=your-aws-secret-key
SMTP_SECURE=false
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=LifeVault
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Option 3: Other SMTP Services

Any SMTP service can be used by configuring:
- `SMTP_HOST`: SMTP server hostname
- `SMTP_PORT`: SMTP port (usually 587 for TLS, 465 for SSL)
- `SMTP_USER`: SMTP username
- `SMTP_PASSWORD`: SMTP password
- `SMTP_SECURE`: `true` for SSL (port 465), `false` for TLS (port 587)

## User Flow

1. **Sign Up**: User creates account → receives verification email
2. **Email Verification**: User clicks link in email → email verified → auto-login
3. **Vault Setup**: User sets master password → can access vault

## API Endpoints

- `GET /api/auth/verify-email?token=xxx` - Verify email with token
- `POST /api/auth/verify-email/resend` - Resend verification email

## Security Features

- Verification tokens expire after 24 hours
- Tokens are single-use (cleared after verification)
- Users cannot set master password until email is verified
- Resend functionality available for expired tokens


