# Email Verification Setup - Quick Start

## ✅ Step 1: Dependencies Installed
- `nodemailer` and `@types/nodemailer` have been installed

## ✅ Step 2: MailHog Installation
Run the setup script or install manually:

```bash
# Option 1: Use setup script
../scripts/setup-mailhog.sh

# Option 2: Install manually (macOS)
brew install mailhog
```

## 📝 Step 3: Add Email Configuration to `.env.local`

Add these lines to your `frontend/.env.local` file:

```env
# Email Configuration (Development - MailHog)
USE_MAILHOG=true
MAILHOG_HOST=localhost
MAILHOG_PORT=1025
EMAIL_FROM=noreply@lifevault.app
EMAIL_FROM_NAME=LifeVault
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 🚀 Step 4: Start MailHog

In a separate terminal, start MailHog:

```bash
mailhog
```

MailHog will start on:
- **SMTP Server**: `localhost:1025` (for sending emails)
- **Web UI**: `http://localhost:8025` (to view captured emails)

## ✅ Step 5: Start Your App

```bash
cd frontend
npm run dev
```

## 🧪 Step 6: Test Email Verification

1. Go to `http://localhost:3000/auth/signup`
2. Create a new account
3. Check MailHog web UI at `http://localhost:8025`
4. Click the verification link in the email
5. You should be redirected to vault setup

## 📧 Viewing Emails in MailHog

- Open `http://localhost:8025` in your browser
- All emails sent by the app will appear here
- Click on any email to view the full content
- Click the verification link directly from MailHog

## 🔧 Troubleshooting

**MailHog not starting?**
- Make sure port 1025 and 8025 are not in use
- Try: `lsof -ti:1025 | xargs kill` to free the port

**Emails not sending?**
- Check that MailHog is running: `ps aux | grep mailhog`
- Verify `.env.local` has the correct MailHog settings
- Check server logs for email errors

**TypeScript errors?**
- Restart your TypeScript server in your IDE
- VS Code/Cursor: `Cmd+Shift+P` → "TypeScript: Restart TS Server"


