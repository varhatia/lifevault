# Cron Job Setup - Complete ✅

The cron job for inactivity checks has been set up. Here's what was configured:

## Files Created/Updated

1. **`frontend/vercel.json`** - Vercel Cron configuration
   - Runs daily at 2 AM UTC
   - Automatically authenticated by Vercel

2. **`frontend/src/app/api/nominee/access/check-inactivity/route.ts`** - Updated
   - Now supports both GET (Vercel Cron) and POST (external services)
   - Handles Vercel's `x-vercel-cron` header
   - Supports Bearer token authentication

3. **`frontend/scripts/run-inactivity-check.sh`** - Shell script for manual testing
4. **`frontend/scripts/run-inactivity-check.js`** - Node.js script for manual testing
5. **`frontend/package.json`** - Added `cron:check-inactivity` script
6. **`docs/cron-job-setup.md`** - Complete setup documentation

## Quick Start

### For Vercel Deployment (Recommended)

1. **Deploy to Vercel**:
   ```bash
   cd frontend
   vercel deploy
   ```

2. **Verify Cron Job**:
   - Go to Vercel dashboard → Your Project → Settings → Cron Jobs
   - You should see the cron job listed

That's it! Vercel will automatically run the cron job daily at 2 AM UTC.

### For Other Platforms (External Cron Service)

1. **Generate a secure secret**:
   ```bash
   openssl rand -hex 32
   ```

2. **Add to `.env.local`** (for development):
   ```env
   CRON_SECRET=your-generated-secret-here
   ```

3. **Add to Production Environment Variables**:
   - Vercel: Project Settings → Environment Variables
   - Railway: Variables tab
   - Other platforms: Add `CRON_SECRET` environment variable

4. **Set up External Cron Service**:
   - Use [cron-job.org](https://cron-job.org) or similar
   - URL: `https://your-app.com/api/nominee/access/check-inactivity`
   - Method: POST
   - Headers: `Authorization: Bearer YOUR_CRON_SECRET`
   - Schedule: `0 2 * * *` (daily at 2 AM UTC)

## Testing Locally

### Option 1: Using npm script
```bash
cd frontend
npm run cron:check-inactivity
```

### Option 2: Using Node.js script directly
```bash
cd frontend
node scripts/run-inactivity-check.js
```

### Option 3: Using shell script
```bash
cd frontend
./scripts/run-inactivity-check.sh
```

### Option 4: Manual curl
```bash
curl -X POST http://localhost:3000/api/nominee/access/check-inactivity \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

## What the Cron Job Does

1. **Checks all active users** with nominees configured
2. **Calculates inactivity** based on `lastLogin` (or `createdAt` as fallback)
3. **Sends reminders** (up to 3 over 2 weeks) if user is inactive ≥ `accessTriggerDays`
4. **Notifies nominees** after 3 reminders have been sent
5. **Records all actions** in the `InactivityReminder` table

## Expected Response

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

- **Vercel**: Dashboard → Functions → Cron Jobs → View logs
- **External Services**: Check service dashboard for execution logs
- **Application Logs**: Check your application logs for processing details

## Next Steps

1. ✅ Deploy to Vercel (or set up external cron)
2. ✅ Monitor first few executions
3. ✅ Verify reminders are being sent
4. ✅ Test nominee notification flow
5. ✅ Set up alerts for failures (optional)

## Documentation

For detailed setup instructions, see:
- **`docs/cron-job-setup.md`** - Complete setup guide with all options
- **`docs/nominee-access-workflows.md`** - Workflow documentation

## Troubleshooting

If the cron job isn't working:

1. **Check Vercel Cron**:
   - Verify `vercel.json` is in the project root
   - Check deployment includes the file
   - View cron job logs in Vercel dashboard

2. **Check External Cron**:
   - Verify URL is correct
   - Check Authorization header format
   - Test endpoint manually

3. **Check Environment Variables**:
   - Ensure `CRON_SECRET` is set (if using external cron)
   - Verify secret matches in both places

4. **Check Application Logs**:
   - Look for errors in processing
   - Verify email service is configured
   - Check database connectivity

For more help, see `docs/cron-job-setup.md`.


