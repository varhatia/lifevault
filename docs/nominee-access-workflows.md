# Nominee Access Workflows

This document describes the two nominee access workflows implemented in LifeVault.

## Use Case 1: Nominee Requests Access (User is Alive)

### Overview
When a user is alive and active, nominees can request read-only access to the vault. The user receives an email notification and can approve or reject the request.

### Workflow Steps

1. **Nominee Submits Request**
   - Nominee visits `/nominee-access` (public page, no login required)
   - Fills out the access request form:
     - Vault owner email
     - Nominee name, email/phone
     - Relationship to vault owner
     - Reason for access
   - Submits request via `POST /api/nominee/access/request`

2. **System Processing**
   - Validates nominee is designated for the user
   - Creates `NomineeAccessRequest` record with status "pending"
   - Generates unique approval token
   - Sets expiration (7 days)

3. **User Notification**
   - User receives email with:
     - Nominee details
     - Relationship and reason
     - Approve/Reject buttons (links with tokens)

4. **User Decision**
   - **Approve**: User clicks approve link → `GET /api/nominee/access/approve?token=...`
     - Updates request status to "approved"
     - Sends approval email to nominee
   - **Reject**: User clicks reject link → `GET /api/nominee/access/reject?token=...`
     - Updates request status to "rejected"
     - Sends rejection email to nominee

5. **Nominee Unlocks Vault**
   - Nominee visits `/nominee-access` and switches to "Unlock Vault" mode
   - Enters:
     - User ID and Nominee ID (from approval email)
     - Encrypted Part C (from original designation email)
     - Decryption password (shared separately by user)
   - System verifies approval status and unlocks vault

### API Endpoints

- `POST /api/nominee/access/request` - Submit access request
- `GET /api/nominee/access/approve?token=...` - Approve request (via email link)
- `GET /api/nominee/access/reject?token=...` - Reject request (via email link)
- `POST /api/nominee/unlock` - Unlock vault (checks for approved request)

### Database Models

- `NomineeAccessRequest`: Tracks access requests with status, approval token, expiration

## Use Case 2: Inactivity-Based Nominee Notification

### Overview
If a user is inactive for a specified number of days (configured during nominee setup), the system sends reminders to the user. After 3 reminders over 2 weeks, nominees are notified and can access the vault.

### Workflow Steps

1. **Inactivity Detection**
   - Background job runs periodically (recommended: daily)
   - Checks all users with active nominees
   - Calculates days since last login (`lastLogin` field)

2. **Reminder Phase** (3 reminders over 2 weeks)
   - If user inactive ≥ `accessTriggerDays`:
     - Sends reminder email (reminder #1, #2, or #3)
     - Records reminder in `InactivityReminder` table
     - Reminders sent ~4-5 days apart

3. **Nominee Notification Phase**
   - After 3 reminders sent:
     - System sends notification email to all active nominees
     - Records notification in `InactivityReminder` table
     - Nominees can now unlock vault

4. **Nominee Unlocks Vault**
   - Nominee visits `/nominee-access` and switches to "Unlock Vault" mode
   - Enters:
     - User ID and Nominee ID (from notification email)
     - Encrypted Part C (from original designation email)
     - Decryption password (shared separately by user)
   - System verifies inactivity notification and unlocks vault

### API Endpoints

- `POST /api/nominee/access/check-inactivity` - Check inactivity and send reminders/notifications
- `POST /api/nominee/unlock` - Unlock vault (checks for inactivity notification)

### Database Models

- `InactivityReminder`: Tracks reminders sent to users and notifications sent to nominees
  - `reminderType`: "user_reminder" or "nominee_notification"
  - `reminderNumber`: 1, 2, or 3 for user reminders

## Setting Up the Inactivity Check Cron Job

### Option 1: External Cron Service (Recommended)

Use a service like:
- **Vercel Cron** (if deployed on Vercel)
- **GitHub Actions** (scheduled workflow)
- **AWS EventBridge** (if on AWS)
- **Cron-job.org** (free external service)

Example cron job configuration:
```bash
# Run daily at 2 AM UTC
0 2 * * * curl -X POST https://your-app.com/api/nominee/access/check-inactivity \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Option 2: Next.js API Route with Vercel Cron

Create `vercel.json`:
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

### Option 3: Node.js Cron (Development/Testing)

Install `node-cron`:
```bash
npm install node-cron
```

Create a script `scripts/check-inactivity.ts`:
```typescript
import cron from 'node-cron';

cron.schedule('0 2 * * *', async () => {
  const response = await fetch('http://localhost:3000/api/nominee/access/check-inactivity', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CRON_SECRET}`,
    },
  });
  const data = await response.json();
  console.log('Inactivity check completed:', data);
});
```

### Environment Variables

Add to `.env.local`:
```env
# Optional: Secret for cron job authentication
CRON_SECRET=your-secure-random-secret-here
```

## Security Considerations

1. **Approval Tokens**: Unique, cryptographically random tokens for approval/rejection links
2. **Token Expiration**: Access requests expire after 7 days
3. **Read-Only Access**: Nominees can only view vault contents, not modify
4. **Key Verification**: Part C decryption happens server-side (MVP), should be moved client-side in production
5. **Authorization Checks**: Unlock endpoint verifies either:
   - Approved access request (Use Case 1), OR
   - Inactivity notification sent (Use Case 2)

## Email Templates

All email templates are in `frontend/src/lib/api/email.ts`:
- `sendAccessRequestEmail()` - Notify user of access request
- `sendAccessDecisionEmail()` - Notify nominee of approval/rejection
- `sendInactivityReminderEmail()` - Remind user to log in
- `sendNomineeInactivityNotification()` - Notify nominee of inactivity

## Testing

### Test Use Case 1 (Access Request)
1. Add a nominee to a user account
2. Visit `/nominee-access` as nominee
3. Submit access request
4. Check user's email for approval link
5. Click approve
6. Check nominee's email for approval notification
7. Unlock vault using nominee credentials

### Test Use Case 2 (Inactivity)
1. Set `lastLogin` to a date > `accessTriggerDays` days ago
2. Call `POST /api/nominee/access/check-inactivity`
3. Verify reminder email sent (if < 3 reminders)
4. Repeat until 3 reminders sent
5. Call again to trigger nominee notification
6. Verify nominee notification email sent
7. Unlock vault using nominee credentials

## Future Enhancements

1. **Client-Side Decryption**: Move Part C decryption to client-side for better security
2. **Session Tokens**: Return session tokens instead of reconstructed keys
3. **Read-Only Vault View**: Create dedicated read-only vault interface for nominees
4. **Audit Logging**: Log all access attempts and approvals
5. **Multi-Factor Approval**: Require multiple approvals for sensitive access
6. **Time-Limited Access**: Set expiration dates for nominee access sessions


