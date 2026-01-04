# Review Functionality Testing Guide

This guide shows how to test the vault review functionality by making direct database changes.

## Database Schema

The review functionality uses the following fields in the `my_vaults` table:

- `last_reviewed_at` (DateTime, nullable) - When the vault was last reviewed
- `review_reminder_frequency` (String, nullable) - 'monthly', 'quarterly', or 'biannual'
- `review_reminder_day` (Int, nullable) - **DEPRECATED**: No longer used. Reminders always trigger on 5th, 10th, and 15th of each period.

## Reminder System

The reminder system works as follows:
- **User configures frequency only**: Monthly (1 month), Quarterly (3 months), or Biannual (6 months)
- **Review is due**: Once the configured period has passed since the last review (or vault creation if never reviewed)
- **Email notifications**: System will send email reminders based on the configured frequency (to be implemented via cron job)
- **In-app notification**: Shows as long as review is due and hasn't been completed
- **Review completion**: Once user completes review, `last_reviewed_at` is updated and notification disappears

## Test Scenarios

### 1. Make Review Due (Never Reviewed)

Set `last_reviewed_at` to NULL and ensure the period has passed:

```sql
-- Find your vault ID first
SELECT id, name, owner_id, last_reviewed_at, review_reminder_frequency 
FROM my_vaults 
WHERE owner_id = 'YOUR_USER_ID';

-- Make review due by setting last_reviewed_at to NULL and vault created more than 1 month ago
UPDATE my_vaults 
SET 
  last_reviewed_at = NULL,
  review_reminder_frequency = 'monthly',
  created_at = NOW() - INTERVAL '35 days'  -- More than 1 month ago
WHERE id = 'YOUR_VAULT_ID';
```

### 2. Make Review Due (Previously Reviewed, But Overdue)

Set `last_reviewed_at` to a date that's more than the configured period ago:

```sql
-- For monthly reminder: set last_reviewed_at to more than 1 month ago
UPDATE my_vaults 
SET 
  last_reviewed_at = NOW() - INTERVAL '35 days',  -- More than 30 days
  review_reminder_frequency = 'monthly'
WHERE id = 'YOUR_VAULT_ID';

-- For quarterly reminder: set last_reviewed_at to more than 3 months ago
UPDATE my_vaults 
SET 
  last_reviewed_at = NOW() - INTERVAL '95 days',  -- More than 90 days
  review_reminder_frequency = 'quarterly'
WHERE id = 'YOUR_VAULT_ID';

-- For biannual reminder: set last_reviewed_at to more than 6 months ago
UPDATE my_vaults 
SET 
  last_reviewed_at = NOW() - INTERVAL '185 days',  -- More than 180 days
  review_reminder_frequency = 'biannual'
WHERE id = 'YOUR_VAULT_ID';
```

### 3. Make Review NOT Due (Recently Reviewed)

Set `last_reviewed_at` to a date within the configured period:

```sql
-- Set reviewed recently (within the period)
UPDATE my_vaults 
SET 
  last_reviewed_at = NOW() - INTERVAL '10 days',  -- Reviewed 10 days ago (less than 30 days for monthly)
  review_reminder_frequency = 'monthly'
WHERE id = 'YOUR_VAULT_ID';
```

### 4. Test Different Reminder Frequencies

```sql
-- Monthly reminder (default) - reminder after 1 month (30 days)
UPDATE my_vaults 
SET 
  review_reminder_frequency = 'monthly',
  last_reviewed_at = NOW() - INTERVAL '35 days'  -- More than 30 days ago
WHERE id = 'YOUR_VAULT_ID';

-- Quarterly reminder - reminder after 3 months (90 days)
UPDATE my_vaults 
SET 
  review_reminder_frequency = 'quarterly',
  last_reviewed_at = NOW() - INTERVAL '95 days'  -- More than 90 days ago
WHERE id = 'YOUR_VAULT_ID';

-- Biannual reminder - reminder after 6 months (180 days)
UPDATE my_vaults 
SET 
  review_reminder_frequency = 'biannual',
  last_reviewed_at = NOW() - INTERVAL '185 days'  -- More than 180 days ago
WHERE id = 'YOUR_VAULT_ID';
```

### 5. Reset Review Status (Clear Review)

```sql
-- Clear review to test from scratch
UPDATE my_vaults 
SET 
  last_reviewed_at = NULL,
  review_reminder_frequency = NULL
WHERE id = 'YOUR_VAULT_ID';
```

## Quick Test Queries

### Find Your Vault ID
```sql
SELECT 
  id, 
  name, 
  owner_id,
  last_reviewed_at,
  review_reminder_frequency,
  review_reminder_day,
  created_at
FROM my_vaults 
WHERE owner_id = (SELECT id FROM users WHERE email = 'your-email@example.com');
```

### Check Current Review Status
```sql
SELECT 
  id,
  name,
  last_reviewed_at,
  review_reminder_frequency,
  CASE 
    WHEN last_reviewed_at IS NULL THEN 'Never reviewed'
    ELSE 'Last reviewed: ' || last_reviewed_at::text
  END as review_status,
  CASE 
    WHEN last_reviewed_at IS NULL THEN
      CASE 
        WHEN review_reminder_frequency = 'monthly' AND created_at < NOW() - INTERVAL '30 days' THEN 'Due'
        WHEN review_reminder_frequency = 'quarterly' AND created_at < NOW() - INTERVAL '90 days' THEN 'Due'
        WHEN review_reminder_frequency = 'biannual' AND created_at < NOW() - INTERVAL '180 days' THEN 'Due'
        ELSE 'Not due yet'
      END
    ELSE
      CASE 
        WHEN review_reminder_frequency = 'monthly' AND last_reviewed_at < NOW() - INTERVAL '30 days' THEN 'Due'
        WHEN review_reminder_frequency = 'quarterly' AND last_reviewed_at < NOW() - INTERVAL '90 days' THEN 'Due'
        WHEN review_reminder_frequency = 'biannual' AND last_reviewed_at < NOW() - INTERVAL '180 days' THEN 'Due'
        ELSE 'Not due yet'
      END
  END as reminder_status
FROM my_vaults 
WHERE id = 'YOUR_VAULT_ID';
```

### Make Review Due Today (Quick Test)
```sql
-- Set last review to more than 1 month ago to trigger reminder
UPDATE my_vaults 
SET 
  last_reviewed_at = NOW() - INTERVAL '35 days',
  review_reminder_frequency = 'monthly'
WHERE id = 'YOUR_VAULT_ID';
```

## Testing Checklist

1. ✅ **Review Due (Never Reviewed)**: Set `last_reviewed_at = NULL` and ensure vault created more than the configured period ago
2. ✅ **Review Due (Overdue)**: Set `last_reviewed_at` to more than the configured period ago
3. ✅ **Review NOT Due**: Set `last_reviewed_at` to within the configured period
4. ✅ **Different Frequencies**: Test monthly (30 days), quarterly (90 days), biannual (180 days)
5. ✅ **Complete Review**: Use the UI to complete review and verify `last_reviewed_at` updates
6. ✅ **Review Button State**: Verify button is enabled/disabled based on `isReviewDue`
7. ✅ **Notification Persistence**: Verify notification shows as long as review is due and disappears once completed

## Notes

- **Period durations**: 
  - Monthly: 30 days (1 month)
  - Quarterly: 90 days (3 months)
  - Biannual: 180 days (6 months)
- **Default frequency**: `'monthly'` if not set
- **Review due logic**: Review is due if the configured period has passed since `last_reviewed_at` (or `created_at` if never reviewed)
- **The review button is only enabled when `isReviewDue` is `true`**
- **Only vault owners can complete reviews**
- **User configures only frequency**: Monthly, Quarterly, or Biannual (no day selection)
- **Email notifications**: Will be sent via cron job based on configured frequency (to be implemented)
- **In-app notification**: Shows as long as review is due and disappears once review is completed

