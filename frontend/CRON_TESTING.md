# Testing the Cron Job Locally

## Prerequisites

Before running the inactivity check, make sure:

1. **Next.js server is running**:
   ```bash
   npm run dev
   ```

2. **Database is accessible** (PostgreSQL should be running)

3. **Email service is configured** (MailHog for development)

## Running the Test

### Option 1: Using npm script (Recommended)

1. **Start the dev server** (in one terminal):
   ```bash
   npm run dev
   ```

2. **Run the cron check** (in another terminal):
   ```bash
   npm run cron:check-inactivity
   ```

### Option 2: Using Node.js script directly

```bash
node scripts/run-inactivity-check.js
```

### Option 3: Using curl

```bash
curl -X POST http://localhost:3000/api/nominee/access/check-inactivity \
  -H "Content-Type: application/json"
```

With authentication (if CRON_SECRET is set):
```bash
curl -X POST http://localhost:3000/api/nominee/access/check-inactivity \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

## Expected Output

### Success Response

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

### Common Errors

1. **"Next.js server is not running"**
   - Solution: Run `npm run dev` first

2. **"Could not connect to the API server"**
   - Check if server is running on port 3000
   - Verify DATABASE_URL is correct
   - Check database connection

3. **"Unauthorized"**
   - If CRON_SECRET is set, make sure it matches
   - For local testing, you can remove CRON_SECRET from .env.local

## Testing the Full Workflow

To test the complete inactivity workflow:

1. **Create a test user** with nominees
2. **Set lastLogin to past date** (manually in database or via API):
   ```sql
   UPDATE users 
   SET last_login = NOW() - INTERVAL '100 days' 
   WHERE email = 'test@example.com';
   ```
3. **Run the cron check**:
   ```bash
   npm run cron:check-inactivity
   ```
4. **Check results**:
   - Verify reminder email was sent (check MailHog)
   - Check `inactivity_reminders` table
   - Run again after 4+ days to trigger next reminder
   - After 3 reminders, nominees should be notified

## Production Testing

For production, use the same script but point to production URL:

```bash
NEXT_PUBLIC_API_URL=https://your-app.com npm run cron:check-inactivity
```

Or set it in `.env.local`:
```env
NEXT_PUBLIC_API_URL=https://your-app.com
CRON_SECRET=your-production-secret
```


