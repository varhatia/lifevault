# Demo Account Setup Guide

This guide explains how to set up a demo account for testing and feedback purposes. The demo account bypasses device authorization to allow easy access for reviewers.

## Demo Account Credentials

- **Email:** `demo1@gmail.com`
- **Password:** `demo@123456`

## Features

✅ **Device Authorization Bypassed:** No email verification needed for new devices  
✅ **Full App Access:** Can review all features and provide feedback  
✅ **Isolated:** Only affects the demo account, other users still require device authorization  

## Setup Methods

### Method 1: API Endpoint (Recommended for Production)

1. **Call the API endpoint:**
   ```bash
   curl -X POST https://livpeace.com/api/admin/create-demo-account
   ```

   Or use any HTTP client (Postman, Insomnia, etc.)

2. **Response:**
   ```json
   {
     "success": true,
     "message": "Demo account created successfully",
     "user": {
       "id": "...",
       "email": "demo1@gmail.com",
       "fullName": "Demo User"
     },
     "credentials": {
       "email": "demo1@gmail.com",
       "password": "demo@123456"
     },
     "note": "Device authorization is bypassed for this demo account"
   }
   ```

### Method 2: Script (For Local Development)

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Run the script:**
   ```bash
   npx tsx scripts/create-demo-account.ts
   ```

   **Note:** Requires `tsx` package. Install with:
   ```bash
   npm install -g tsx
   ```

## How It Works

### Device Authorization Bypass

The login route (`/api/auth/login/route.ts`) checks if the email is `demo1@gmail.com`:

- ✅ **Demo Account:** Automatically authorizes any device without email verification
- ✅ **Other Accounts:** Still require device authorization (normal security flow)

### Code Location

The bypass logic is in:
- `frontend/src/app/api/auth/login/route.ts` (lines 44-109)

Look for:
```typescript
const DEMO_EMAIL = 'demo1@gmail.com';
const isDemoAccount = user.email.toLowerCase() === DEMO_EMAIL.toLowerCase();
```

## Usage

1. **Share credentials with reviewers:**
   - Email: `demo1@gmail.com`
   - Password: `demo@123456`
   - URL: `https://livpeace.com/auth/login`

2. **Reviewers can:**
   - Log in from any device
   - No email verification needed
   - Access all app features
   - Provide feedback

3. **Security Note:**
   - This is a **demo account only**
   - Should be used temporarily
   - Consider removing or restricting after feedback period

## Removing Demo Account (When Done)

### Option 1: Delete via Database

```sql
DELETE FROM users WHERE email = 'demo1@gmail.com';
```

### Option 2: Deactivate via API

Update the user to `isActive: false` in the database.

### Option 3: Remove Bypass Logic

Remove the demo account bypass code from `login/route.ts` to restore normal device authorization for all accounts.

## Important Notes

⚠️ **Security Considerations:**
- Demo account bypasses security features (device authorization)
- Should only be used for temporary feedback/testing
- Consider adding IP restrictions or time-based access if needed
- Remove or restrict after feedback period

⚠️ **Production Deployment:**
- The bypass logic is active in production
- Monitor usage of demo account
- Consider adding admin authentication to the create endpoint
- Document this in your security audit

## Troubleshooting

### "User does not exist"
- Run the setup script or API endpoint to create the account

### "Device authorization required" (for demo account)
- Check that the email is exactly `demo1@gmail.com` (case-insensitive)
- Verify the bypass logic is deployed

### "Invalid credentials"
- Ensure password is exactly: `demo@123456`
- Recreate the account if needed

## Code Changes Summary

1. **Modified:** `frontend/src/app/api/auth/login/route.ts`
   - Added demo account detection
   - Auto-authorizes devices for demo account
   - Bypasses device authorization requirement

2. **Created:** `frontend/src/app/api/admin/create-demo-account/route.ts`
   - API endpoint to create/update demo account

3. **Created:** `frontend/scripts/create-demo-account.ts`
   - Script to create demo account locally

---

**Last Updated:** January 2025

