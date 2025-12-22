# Prisma Migration Analysis

## Current Migration Status

**Total Migrations Found:** 8 (7 with SQL files, 1 empty directory)

## Issues Identified

### 1. ❌ Duplicate Migrations

#### Duplicate: Recovery Key Columns
- **`20250104120000_add_recovery_key`** (Jan 4, 2025)
  - Adds: `recovery_key_encrypted_vault_key`, `recovery_key_generated_at` to `users` table
  
- **`20251210164936_add_recovery_key`** (Dec 10, 2025)
  - Adds: **Same columns** to `users` table (DUPLICATE!)

**Problem:** Running both migrations will fail because the columns already exist after the first migration.

#### Duplicate: My Vault Model
- **`20250104130000_add_my_vault_model`** (Jan 4, 2025)
  - Creates `my_vaults` table
  - Migrates `vault_items` from `user_id` to `my_vault_id`
  - Adds `my_vault_id` and `family_vault_id` to `nominees`
  
- **`20251210223929_add_my_vault_model`** (Dec 10, 2025)
  - **Empty directory** - no `migration.sql` file exists!

**Problem:** Empty migration directory will cause Prisma to fail when trying to apply it.

### 2. ⚠️ Migration Order Issues

The migrations have inconsistent date ordering:

```
20250104120000_add_recovery_key          (Jan 4, 2025)  ❌ Future date
20250104130000_add_my_vault_model        (Jan 4, 2025)  ❌ Future date
20251130121130_partb                     (Nov 30, 2025)  ❌ Future date
20251130151509_nominee_access_workflows  (Nov 30, 2025)  ❌ Future date
20251204035946_family_vault              (Dec 4, 2025)   ❌ Future date
20251204153224_add_vault_type_to_nominee (Dec 4, 2025)   ❌ Future date
20251210164936_add_recovery_key          (Dec 10, 2025)  ❌ Future date (DUPLICATE)
20251210223929_add_my_vault_model        (Dec 10, 2025)  ❌ Future date (EMPTY)
```

**Problem:** The dates suggest migrations were created manually with incorrect timestamps, which can cause ordering issues.

### 3. ⚠️ Potential Conflicts

#### Nominee Table Evolution
1. **`20251204153224_add_vault_type_to_nominee`** adds:
   - `vault_type` VARCHAR(20) NOT NULL
   - `vault_id` UUID
   - Foreign key: `vault_id` → `family_vaults.id`

2. **`20250104130000_add_my_vault_model`** (runs AFTER in chronological order) adds:
   - `my_vault_id` UUID
   - `family_vault_id` UUID
   - Foreign keys to both `my_vaults` and `family_vaults`

**Problem:** The schema evolves from a single `vault_id` to separate `my_vault_id` and `family_vault_id`, but the migration order might cause issues if `vault_id` foreign key exists first.

### 4. ✅ Valid Migrations (No Issues)

These migrations appear valid and necessary:

1. **`20251130121130_partb`** - Initial schema creation
   - Creates: `users`, `vault_items`, `family_vaults`, `family_members`, `nominees`
   - This is the base schema

2. **`20251130151509_nominee_access_workflows`** - Adds access request system
   - Creates: `nominee_access_requests`, `inactivity_reminders`
   - Adds: `last_login` to `users`

3. **`20251204035946_family_vault`** - Family vault improvements
   - Creates: `family_vault_items`
   - Updates: `family_members` with encryption fields
   - Removes: `encrypted_shared_key` from `family_vaults`

## Recommended Actions

### Option 1: Clean Up and Recreate (Recommended for Fresh Database)

If you're starting fresh or can reset the database:

1. **Delete problematic migrations:**
   ```bash
   rm -rf prisma/migrations/20250104120000_add_recovery_key
   rm -rf prisma/migrations/20251210164936_add_recovery_key
   rm -rf prisma/migrations/20250104130000_add_my_vault_model
   rm -rf prisma/migrations/20251210223929_add_my_vault_model
   ```

2. **Create a single consolidated migration:**
   ```bash
   cd frontend
   npx prisma migrate dev --name consolidated_schema
   ```

3. **Verify the migration matches your schema:**
   ```bash
   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma
   ```

### Option 2: Fix Existing Migrations (For Production Database)

If you have existing data:

1. **Remove duplicate recovery_key migration:**
   - Keep: `20250104120000_add_recovery_key` (first one)
   - Delete: `20251210164936_add_recovery_key`

2. **Fix empty migration:**
   - Delete: `20251210223929_add_my_vault_model` (empty directory)
   - Keep: `20250104130000_add_my_vault_model` (has actual SQL)

3. **Mark migrations as applied (if already in database):**
   ```bash
   # If migrations were partially applied, mark them as resolved
   npx prisma migrate resolve --applied 20250104120000_add_recovery_key
   npx prisma migrate resolve --applied 20250104130000_add_my_vault_model
   ```

4. **Verify migration status:**
   ```bash
   npx prisma migrate status
   ```

### Option 3: Baseline and Start Fresh (For Production)

If migrations are too messy:

1. **Create a baseline migration:**
   ```bash
   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > baseline.sql
   ```

2. **Mark current state as baseline:**
   ```bash
   npx prisma migrate resolve --applied baseline
   ```

3. **Delete old migrations and start fresh:**
   ```bash
   rm -rf prisma/migrations/*
   npx prisma migrate dev --name baseline
   ```

## Migration Execution Order

If keeping existing migrations, they should execute in this order:

1. ✅ `20251130121130_partb` - Base schema
2. ✅ `20251130151509_nominee_access_workflows` - Access requests
3. ✅ `20251204035946_family_vault` - Family vault updates
4. ✅ `20251204153224_add_vault_type_to_nominee` - Nominee vault type
5. ⚠️ `20250104120000_add_recovery_key` - Recovery key (KEEP THIS ONE)
6. ⚠️ `20250104130000_add_my_vault_model` - My vault model (KEEP THIS ONE)
7. ❌ `20251210164936_add_recovery_key` - **DELETE (DUPLICATE)**
8. ❌ `20251210223929_add_my_vault_model` - **DELETE (EMPTY)**

## Validation Checklist

Before applying migrations:

- [ ] Remove duplicate `20251210164936_add_recovery_key`
- [ ] Remove empty `20251210223929_add_my_vault_model`
- [ ] Verify all remaining migrations have valid SQL
- [ ] Check that migration order matches schema evolution
- [ ] Test migrations on a fresh database first
- [ ] Backup production database before applying

## Current Schema vs Migrations

The current `schema.prisma` expects:
- ✅ `users` with `recovery_key_encrypted_vault_key` and `recovery_key_generated_at`
- ✅ `my_vaults` table
- ✅ `vault_items` with `my_vault_id` (not `user_id`)
- ✅ `nominees` with `vault_type`, `my_vault_id`, `family_vault_id`
- ✅ All other tables from the base schema

**Conclusion:** The schema is correct, but the migrations have duplicates and one empty migration that need to be cleaned up.
