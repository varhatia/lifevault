# Government-Standard Audit System Guide

## Overview

This audit system provides comprehensive, government-standard audit logging for LivPeace. It captures complete audit trails with immutable logs, session tracking, request correlation, and detailed metadata.

## Features

- ✅ **Immutable Audit Trail**: All logs are write-only and cannot be modified
- ✅ **Complete Context**: Captures who, what, when, where, why
- ✅ **Session Tracking**: Tracks user sessions across requests
- ✅ **Request Correlation**: Links related operations via request IDs
- ✅ **Before/After State**: Tracks changes with before/after snapshots
- ✅ **Severity Levels**: Info, Warning, Error, Critical
- ✅ **Outcome Tracking**: Success, Failure, Partial, Pending
- ✅ **Performance Metrics**: Operation duration tracking
- ✅ **IP & User Agent**: Complete request context
- ✅ **Export Capabilities**: CSV and JSON export for compliance

## Usage

### Basic Audit Logging

```typescript
import { extractAuditContext, createAuditLog } from '@/lib/api/audit';
import { getUserFromRequest } from '@/lib/api/auth';

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Extract audit context from request
  const auditContext = extractAuditContext(req, user.id, {
    vaultType: 'my_vault',
    vaultId: vaultId,
  });

  // Create audit log
  await createAuditLog(auditContext, {
    action: 'item_uploaded',
    description: 'Item uploaded to My Vault',
    severity: 'info',
    outcome: 'success',
    metadata: {
      category: 'documents',
      hasFile: true,
    },
  });

  // ... rest of your code
}
```

### Security Events

```typescript
import { logSecurityEvent } from '@/lib/api/audit';

await logSecurityEvent(auditContext, 'login_success', 'success', {
  description: 'User logged in successfully',
  metadata: {
    deviceName: 'Chrome on Windows',
    twoFactorEnabled: true,
  },
});
```

### Data Access Events

```typescript
import { logDataAccess } from '@/lib/api/audit';

await logDataAccess(
  auditContext,
  'item_downloaded',
  'vault_item',
  itemId,
  {
    description: 'Vault item downloaded',
    outcome: 'success',
    metadata: {
      fileName: 'document.pdf',
      fileSize: 1024000,
    },
  }
);
```

### Data Modification with Before/After State

```typescript
import { logDataModification } from '@/lib/api/audit';

const beforeState = {
  role: 'viewer',
  isActive: true,
};

const afterState = {
  role: 'editor',
  isActive: true,
};

await logDataModification(
  auditContext,
  'member_role_updated',
  'family_member',
  memberId,
  {
    description: 'Family member role updated',
    beforeState,
    afterState,
    outcome: 'success',
  }
);
```

### Performance Tracking

```typescript
import { createAuditTimer } from '@/lib/api/audit';

const timer = createAuditTimer();

// ... perform operation ...

const durationMs = timer.end();

await createAuditLog(auditContext, {
  action: 'vault_unlocked',
  description: 'Vault unlocked successfully',
  durationMs,
  outcome: 'success',
});
```

### Error Logging

```typescript
import { logError } from '@/lib/api/audit';

try {
  // ... operation ...
} catch (error) {
  await logError(auditContext, 'vault_unlock_failed', error, {
    description: 'Failed to unlock vault',
    errorCode: 'INVALID_PASSWORD',
    metadata: {
      attemptNumber: 3,
    },
  });
  throw error;
}
```

## Activity UI

The enhanced Activity UI provides:

- **Visual Severity Indicators**: Color-coded logs by severity
- **Detailed Views**: Expandable logs with full metadata
- **Advanced Filtering**: By vault type, action, severity, date range
- **Export Functionality**: CSV and JSON export for compliance
- **Before/After Visualization**: See state changes clearly
- **Session Tracking**: View related operations via session/request IDs

## Database Storage

All audit logs are stored in PostgreSQL using the `activity_logs` table. The current schema supports:

- User identification
- Vault and item references
- IP addresses and user agents
- Rich JSONB metadata for flexible storage
- Timestamps with timezone

The metadata JSONB field stores:
- Severity and outcome
- Session and request IDs
- Before/after states
- Error information
- Performance metrics
- Custom event-specific data

## Cost Considerations

PostgreSQL is already in use and provides:
- Efficient JSONB storage and querying
- Proper indexing for fast lookups
- Cost-effective for audit logs
- No additional infrastructure needed

For very high-volume scenarios, consider:
- Partitioning by date (monthly/quarterly)
- Archiving old logs to cheaper storage
- Compression for historical data

## Compliance

This audit system meets government auditing standards by providing:

1. **Immutable Logs**: Cannot be modified after creation
2. **Complete Audit Trail**: All necessary information captured
3. **Timestamp Accuracy**: Precise timestamps with timezone
4. **User Identification**: Clear user attribution
5. **Change Tracking**: Before/after state for modifications
6. **Export Capabilities**: Easy export for compliance reviews
7. **Retention**: Long-term storage in database

## Migration from Old Logging

To migrate existing code to use the new audit system:

1. Replace direct `prisma.activityLog.create()` calls with audit utility functions
2. Use `extractAuditContext()` to get context from requests
3. Use appropriate logging function (`logSecurityEvent`, `logDataAccess`, etc.)
4. Add before/after states for modification operations
5. Add performance tracking where relevant

Example migration:

**Before:**
```typescript
await prisma.activityLog.create({
  data: {
    userId,
    vaultType: 'my_vault',
    action: 'item_uploaded',
    description: 'Item uploaded',
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
    metadata: { category },
  },
});
```

**After:**
```typescript
const auditContext = extractAuditContext(req, userId, {
  vaultType: 'my_vault',
  vaultId: vaultId,
  vaultItemId: itemId,
});

await logDataModification(auditContext, 'item_uploaded', 'vault_item', itemId, {
  description: 'Item uploaded to My Vault',
  outcome: 'success',
  metadata: { category, hasFile: !!s3Key },
});
```

