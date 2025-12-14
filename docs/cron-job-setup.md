# Cron Job Setup for Inactivity Checks

This document explains how to set up the cron job for checking user inactivity and sending reminders/notifications.

## Overview

The inactivity check endpoint (`/api/nominee/access/check-inactivity`) should be called daily to:
1. Check users who haven't logged in for their configured `accessTriggerDays`
2. Send reminder emails (up to 3 over 2 weeks)
3. Notify nominees after 3 reminders

## Option 1: Vercel Cron (Recommended for Vercel Deployments)

If you're deploying to Vercel, use Vercel Cron which is built-in and free.

### Setup Steps

1. **Create `vercel.json`** (already created in `frontend/vercel.json`):
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

2. **Deploy to Vercel**:
   ```bash
   vercel deploy
   ```

3. **Verify Cron Job**:
   - Go to your Vercel project dashboard
   - Navigate to "Settings" → "Cron Jobs"
   - You should see the cron job listed

The cron job will run daily at 2 AM UTC. Vercel automatically adds the `x-vercel-cron` header for authentication.

## Option 2: External Cron Service

Use an external service like [cron-job.org](https://cron-job.org) or [EasyCron](https://www.easycron.com).

### Setup Steps

1. **Add CRON_SECRET to Environment Variables**:
   ```bash
   # Generate a secure random secret
   openssl rand -hex 32
   ```

2. **Add to `.env.local`**:
   ```env
   CRON_SECRET=your-generated-secret-here
   ```

3. **Add to Production Environment** (Vercel, Railway, etc.):
   - Go to your deployment platform's environment variables
   - Add `CRON_SECRET` with your generated secret

4. **Configure External Cron Service**:
   - **URL**: `https://your-app.com/api/nominee/access/check-inactivity`
   - **Method**: POST
   - **Headers**: 
     ```
     Authorization: Bearer YOUR_CRON_SECRET
     Content-Type: application/json
     ```
   - **Schedule**: `0 2 * * *` (daily at 2 AM UTC)

### Example: cron-job.org Setup

1. Sign up at [cron-job.org](https://cron-job.org)
2. Create a new cron job:
   - **Title**: LifeVault Inactivity Check
   - **URL**: `https://your-app.com/api/nominee/access/check-inactivity`
   - **Schedule**: Daily at 2:00 AM UTC
   - **Request Method**: POST
   - **Request Headers**: 
     ```
     Authorization: Bearer YOUR_CRON_SECRET
     Content-Type: application/json
     ```

## Option 3: GitHub Actions (Free for Public Repos)

Create `.github/workflows/inactivity-check.yml`:

```yaml
name: Inactivity Check

on:
  schedule:
    # Run daily at 2 AM UTC
    - cron: '0 2 * * *'
  workflow_dispatch: # Allow manual triggering

jobs:
  check-inactivity:
    runs-on: ubuntu-latest
    steps:
      - name: Run Inactivity Check
        run: |
          curl -X POST https://your-app.com/api/nominee/access/check-inactivity \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json"
```

Add `CRON_SECRET` to GitHub Secrets:
1. Go to your repository → Settings → Secrets
2. Add a new secret named `CRON_SECRET`
3. Paste your generated secret

## Option 4: Local Development / Testing

For local testing, you can use the provided scripts:

### Using the Shell Script

```bash
cd frontend
chmod +x scripts/run-inactivity-check.sh
./scripts/run-inactivity-check.sh
```

### Using the Node.js Script

```bash
cd frontend
node scripts/run-inactivity-check.js
```

### Using Node-Cron (For Continuous Local Testing)

Install `node-cron`:
```bash
npm install --save-dev node-cron
```

Create `scripts/local-cron.ts`:
```typescript
import cron from 'node-cron';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET;

cron.schedule('0 2 * * *', async () => {
  console.log('Running inactivity check...');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (CRON_SECRET) {
    headers['Authorization'] = `Bearer ${CRON_SECRET}`;
  }
  
  try {
    const response = await fetch(`${API_URL}/api/nominee/access/check-inactivity`, {
      method: 'POST',
      headers,
    });
    
    const data = await response.json();
    console.log('Inactivity check completed:', data);
  } catch (error) {
    console.error('Error running inactivity check:', error);
  }
});

console.log('Cron job scheduled. Running daily at 2 AM UTC.');
```

Run it:
```bash
npx tsx scripts/local-cron.ts
```

## Environment Variables

Add to `.env.local` (for development) and your production environment:

```env
# Optional: Secret for cron job authentication
# If not set, the endpoint will be accessible without authentication
# (not recommended for production)
CRON_SECRET=your-secure-random-secret-here

# API URL (for external cron services)
NEXT_PUBLIC_API_URL=https://your-app.com
```

## Testing the Cron Job

### Manual Test

1. **Test locally**:
   ```bash
   cd frontend
   node scripts/run-inactivity-check.js
   ```

2. **Test on production**:
   ```bash
   curl -X POST https://your-app.com/api/nominee/access/check-inactivity \
     -H "Authorization: Bearer YOUR_CRON_SECRET" \
     -H "Content-Type: application/json"
   ```

### Expected Response

```json
{
  "success": true,
  "results": {
    "usersChecked": 5,
    "remindersSent": 2,
    "nomineeNotificationsSent": 1,
    "errors": []
  }
}
```

## Monitoring

### Vercel

- Go to your Vercel project dashboard
- Navigate to "Functions" → "Cron Jobs"
- View execution logs and history

### External Services

Most external cron services provide:
- Execution logs
- Success/failure notifications
- Email alerts on failures

### Application Logs

Check your application logs for:
- `Inactivity check completed` messages
- Any errors during processing
- Email sending failures

## Troubleshooting

### Cron Job Not Running

1. **Check Vercel Cron**:
   - Verify `vercel.json` is in the root of your project
   - Check that the path matches exactly
   - Ensure the deployment includes the file

2. **Check External Cron**:
   - Verify the URL is correct
   - Check that authentication header is set correctly
   - Test the endpoint manually

3. **Check Environment Variables**:
   - Ensure `CRON_SECRET` is set in production
   - Verify the secret matches in both places

### Authentication Errors

If you see `401 Unauthorized`:
- Verify `CRON_SECRET` is set correctly
- Check that the Authorization header format is: `Bearer YOUR_SECRET`
- For Vercel Cron, ensure `vercel.json` is configured correctly

### No Reminders Being Sent

1. **Check User Data**:
   - Verify users have `lastLogin` set (or `createdAt` as fallback)
   - Check that users have active nominees
   - Verify `accessTriggerDays` is configured

2. **Check Email Configuration**:
   - Verify email service is configured (MailHog for dev, SMTP for prod)
   - Check email logs for sending errors

3. **Check Reminder Logic**:
   - Ensure users are inactive for at least `accessTriggerDays`
   - Verify reminders haven't already been sent (check `InactivityReminder` table)

## Security Considerations

1. **CRON_SECRET**: Always use a strong, randomly generated secret
2. **HTTPS**: Always use HTTPS for production endpoints
3. **Rate Limiting**: Consider adding rate limiting to prevent abuse
4. **Logging**: Monitor logs for suspicious activity
5. **Vercel Cron**: Automatically secured with Vercel's infrastructure

## Schedule Recommendations

- **Frequency**: Daily is recommended
- **Time**: 2 AM UTC is a good default (low traffic time)
- **Adjustment**: Consider your user base's timezone for better UX

## Next Steps

After setting up the cron job:
1. Monitor the first few executions
2. Check that reminders are being sent correctly
3. Verify nominee notifications work after 3 reminders
4. Set up alerts for failures (if using external service)


