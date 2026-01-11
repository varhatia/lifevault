# Audit System Migration Checklist

This document lists all routes that need to be migrated from direct `prisma.activityLog.create()` calls to the new audit utility system.

## Migration Status

- ✅ **Already Migrated**: `/api/vaults/my/[vaultId]/items` (POST) - Item upload
- ⏳ **Pending Migration**: All routes below

---

## Priority 1: Security & Authentication (High Priority)

These routes handle sensitive security operations and should be migrated first.

### Authentication Routes
- [ ] `/api/auth/login` (POST) - User login
  - **Current**: `prisma.activityLog.create()` for `login_success`
  - **Migrate to**: `logSecurityEvent()` with outcome tracking

- [ ] `/api/auth/reset-password` (POST) - Password reset
  - **Current**: `prisma.activityLog.create()` for `password_reset`
  - **Migrate to**: `logSecurityEvent()` with outcome tracking

- [ ] `/api/auth/device/verify` (GET) - Device authorization
  - **Current**: `prisma.activityLog.create()` for device authorization
  - **Migrate to**: `logSecurityEvent()` with device context

---

## Priority 2: Vault Operations (High Priority)

These routes handle vault creation, unlocking, and key management.

### My Vault Routes
- [ ] `/api/vaults/my` (POST) - Create My Vault
  - **Current**: `prisma.activityLog.create()` for `myvault_created`
  - **Migrate to**: `logDataModification()` with before/after state

- [ ] `/api/vaults/my/[vaultId]` (GET) - Unlock My Vault
  - **Current**: `prisma.activityLog.create()` for `myvault_unlocked`
  - **Migrate to**: `logDataAccess()` with performance tracking

- [ ] `/api/vaults/my/[vaultId]/keys` (GET) - Get vault keys
  - **Current**: 2x `prisma.activityLog.create()` calls
  - **Migrate to**: `logDataAccess()` with security context

- [ ] `/api/vaults/my/[vaultId]/recovery-reset` (POST) - Reset recovery key
  - **Current**: `prisma.activityLog.create()` for `myvault_recovery_key_reset`
  - **Migrate to**: `logConfigurationChange()` with before/after state

### Family Vault Routes
- [ ] `/api/family/vaults` (POST) - Create Family Vault
  - **Current**: `prisma.activityLog.create()` for `familyvault_created`
  - **Migrate to**: `logDataModification()` with before/after state

- [ ] `/api/family/vaults/[vaultId]` (GET) - Unlock Family Vault
  - **Current**: `prisma.activityLog.create()` for `familyvault_unlocked`
  - **Migrate to**: `logDataAccess()` with performance tracking

- [ ] `/api/family/vaults/[vaultId]/recovery-key` (POST) - Set recovery key
  - **Current**: `prisma.activityLog.create()` for `familyvault_recovery_key_set`
  - **Migrate to**: `logConfigurationChange()` with before/after state

---

## Priority 3: Item Operations (Medium Priority)

These routes handle file/document operations.

### My Vault Items
- [x] `/api/vaults/my/[vaultId]/items` (POST) - Upload item ✅ **DONE**
- [ ] `/api/vaults/my/[vaultId]/items/[id]` (PUT) - Update item
  - **Current**: `prisma.activityLog.create()` for item update
  - **Migrate to**: `logDataModification()` with before/after state

- [ ] `/api/vaults/my/[vaultId]/items/[id]` (DELETE) - Delete item
  - **Current**: `prisma.activityLog.create()` for `item_deleted`
  - **Migrate to**: `logDataModification()` with before state (item being deleted)

- [ ] `/api/vaults/my/[vaultId]/items/[id]/download` (GET) - Download item
  - **Current**: `prisma.activityLog.create()` for `item_downloaded`
  - **Migrate to**: `logDataAccess()` with file metadata

### Family Vault Items
- [ ] `/api/family/vaults/[vaultId]/items` (POST) - Upload item
  - **Current**: `prisma.activityLog.create()` for `item_uploaded`
  - **Migrate to**: `logDataModification()` with member context

- [ ] `/api/family/vaults/[vaultId]/items/[itemId]` (PUT) - Update item
  - **Current**: `prisma.activityLog.create()` for item update
  - **Migrate to**: `logDataModification()` with before/after state

- [ ] `/api/family/vaults/[vaultId]/items/[itemId]` (DELETE) - Delete item
  - **Current**: `prisma.activityLog.create()` for `item_deleted`
  - **Migrate to**: `logDataModification()` with before state

- [ ] `/api/family/vaults/[vaultId]/items/[itemId]/download` (GET) - Download item
  - **Current**: `prisma.activityLog.create()` for `item_downloaded`
  - **Migrate to**: `logDataAccess()` with file metadata

---

## Priority 4: Member Management (Medium Priority)

These routes handle adding/removing members and role changes.

### My Vault Members
- [ ] `/api/vaults/my/[vaultId]/members` (GET) - List members (unlock)
  - **Current**: `prisma.activityLog.create()` for `myvault_unlocked`
  - **Migrate to**: `logDataAccess()` with performance tracking

- [ ] `/api/vaults/my/[vaultId]/members` (POST) - Add member
  - **Current**: `prisma.activityLog.create()` for member addition
  - **Migrate to**: `logDataModification()` with before/after state

- [ ] `/api/vaults/my/[vaultId]/members/[memberId]` (PUT) - Update member role
  - **Current**: 2x `prisma.activityLog.create()` calls
  - **Migrate to**: `logConfigurationChange()` with before/after state

- [ ] `/api/vaults/my/[vaultId]/members/[memberId]` (DELETE) - Remove member
  - **Current**: `prisma.activityLog.create()` for member removal
  - **Migrate to**: `logDataModification()` with before state

### Family Vault Members
- [ ] `/api/family/vaults/[vaultId]/members` (GET) - List members (unlock)
  - **Current**: `prisma.activityLog.create()` for `familyvault_unlocked`
  - **Migrate to**: `logDataAccess()` with performance tracking

- [ ] `/api/family/vaults/[vaultId]/members` (POST) - Add member
  - **Current**: `prisma.activityLog.create()` for `family_member_added`
  - **Migrate to**: `logDataModification()` with before/after state

- [ ] `/api/family/vaults/[vaultId]/members/[memberId]` (PUT) - Update member role
  - **Current**: 2x `prisma.activityLog.create()` calls
  - **Migrate to**: `logConfigurationChange()` with before/after state

- [ ] `/api/family/vaults/[vaultId]/members/[memberId]` (DELETE) - Remove member
  - **Current**: `prisma.activityLog.create()` for `family_member_removed`
  - **Migrate to**: `logDataModification()` with before state

---

## Priority 5: Nominee Operations (Medium Priority)

These routes handle nominee management and access.

### Nominee Management
- [ ] `/api/nominee` (POST) - Add nominee
  - **Current**: `prisma.activityLog.create()` for `nominee_added`
  - **Migrate to**: `logDataModification()` with nominee details

- [ ] `/api/nominee/[id]` (DELETE) - Remove nominee
  - **Current**: `prisma.activityLog.create()` for `nominee_deleted`
  - **Migrate to**: `logDataModification()` with before state

- [ ] `/api/nominee/[id]/regenerate` (PUT) - Regenerate nominee keys
  - **Current**: `prisma.activityLog.create()` for `nominee_regenerated`
  - **Migrate to**: `logConfigurationChange()` with before/after state

### Nominee Access
- [ ] `/api/nominee/access/request` (POST) - Request access
  - **Current**: `prisma.activityLog.create()` for `nominee_access_requested`
  - **Migrate to**: `logSecurityEvent()` with request details

- [ ] `/api/nominee/access/approve` (POST - Approve access
  - **Current**: `prisma.activityLog.create()` for `nominee_access_approved`
  - **Migrate to**: `logSecurityEvent()` with approval context

- [ ] `/api/nominee/vault` (GET) - Nominee view vault
  - **Current**: `prisma.activityLog.create()` for `nominee_vault_viewed`
  - **Migrate to**: `logDataAccess()` with nominee context

- [ ] `/api/nominee/vault/[id]/download` (GET) - Nominee download item
  - **Current**: `prisma.activityLog.create()` for `nominee_item_downloaded`
  - **Migrate to**: `logDataAccess()` with nominee and file context

---

## Priority 6: Review & Reminders (Low Priority)

These routes handle vault review functionality.

- [ ] `/api/vaults/my/[vaultId]/review` (POST) - Mark review complete
  - **Current**: `prisma.activityLog.create()` for review completion
  - **Migrate to**: `logDataModification()` with review metadata

- [ ] `/api/vaults/my/[vaultId]/review/reminder` (POST) - Send review reminder
  - **Current**: `prisma.activityLog.create()` for reminder sent
  - **Migrate to**: `logSecurityEvent()` with reminder context

---

## Priority 7: Device Management (Low Priority)

- [ ] `/api/account/devices` (DELETE) - Remove trusted device
  - **Current**: `prisma.activityLog.create()` for device removal
  - **Migrate to**: `logSecurityEvent()` with device context

---

## Migration Pattern

For each route, follow this pattern:

### 1. Import the audit utility
```typescript
import { extractAuditContext, logSecurityEvent, logDataAccess, logDataModification, logConfigurationChange, createAuditTimer } from '@/lib/api/audit';
```

### 2. Extract context from request
```typescript
const auditContext = extractAuditContext(req, userId, {
  vaultType: 'my_vault',
  vaultId: vaultId,
  // ... additional context
});
```

### 3. Use appropriate logging function
```typescript
// For security events
await logSecurityEvent(auditContext, 'login_success', 'success', {
  description: 'User logged in successfully',
  metadata: { deviceName: '...' },
});

// For data access
await logDataAccess(auditContext, 'item_downloaded', 'vault_item', itemId, {
  description: 'Item downloaded',
  metadata: { fileName: '...', fileSize: '...' },
});

// For data modifications
await logDataModification(auditContext, 'item_uploaded', 'vault_item', itemId, {
  description: 'Item uploaded',
  beforeState: {}, // if applicable
  afterState: { category, title },
  metadata: { hasFile: true },
});

// For configuration changes
await logConfigurationChange(auditContext, 'member_role_updated', 'vault_member', {
  description: 'Member role updated',
  beforeState: { role: 'viewer' },
  afterState: { role: 'editor' },
});
```

### 4. Add performance tracking (optional but recommended)
```typescript
const timer = createAuditTimer();
// ... perform operation ...
await logDataAccess(auditContext, 'vault_unlocked', 'vault', vaultId, {
  durationMs: timer.end(),
});
```

---

## Total Routes to Migrate

- **Security & Auth**: 3 routes
- **Vault Operations**: 6 routes
- **Item Operations**: 8 routes
- **Member Management**: 8 routes
- **Nominee Operations**: 7 routes
- **Review & Reminders**: 2 routes
- **Device Management**: 1 route

**Total: 35 routes** (1 already done, 34 remaining)

---

## Recommended Migration Order

1. **Week 1**: Priority 1 (Security & Auth) - 3 routes
2. **Week 2**: Priority 2 (Vault Operations) - 6 routes
3. **Week 3**: Priority 3 (Item Operations) - 8 routes
4. **Week 4**: Priority 4 (Member Management) - 8 routes
5. **Week 5**: Priority 5 (Nominee Operations) - 7 routes
6. **Week 6**: Priority 6 & 7 (Review & Devices) - 3 routes

This gradual approach allows you to:
- Test each category thoroughly
- Monitor for any issues
- Ensure backward compatibility
- Maintain system stability

