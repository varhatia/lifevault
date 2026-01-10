# Running Migrations on NeonDB from Terminal

## Quick Start

### Option 1: Direct Command (Recommended)

```bash
cd frontend

# Set your NeonDB connection string and run migrations
DATABASE_URL="postgresql://user:password@ep-xxx-xxx.region.neon.tech/dbname?sslmode=require" npx prisma migrate deploy
```

### Option 2: Using Environment File

1. **Create or update `.env.production`** (or use existing `.env.local`):
   ```bash
   cd frontend
   echo 'DATABASE_URL="postgresql://user:password@ep-xxx-xxx.region.neon.tech/dbname?sslmode=require"' > .env.production
   ```

2. **Run migration**:
   ```bash
   # Using dotenv to load .env.production
   dotenv -e .env.production -- npx prisma migrate deploy
   
   # Or if you've exported DATABASE_URL in your shell
   npx prisma migrate deploy
   ```

### Option 3: Using the Production Script

```bash
cd frontend

# Set DATABASE_URL and run the script
DATABASE_URL="your-neon-connection-string" ./run-production-migration.sh
```

## Step-by-Step Instructions

### 1. Get Your NeonDB Connection String

1. Go to [Neon Console](https://console.neon.tech)
2. Select your project
3. Go to **Connection Details** or **Dashboard**
4. Copy the connection string (it looks like):
   ```
   postgresql://user:password@ep-xxx-xxx.region.neon.tech/dbname?sslmode=require
   ```

### 2. Navigate to Frontend Directory

```bash
cd frontend
```

### 3. Generate Prisma Client (if needed)

```bash
npx prisma generate
```

### 4. Run Migrations

**For Production (applies pending migrations):**
```bash
DATABASE_URL="your-neon-connection-string" npx prisma migrate deploy
```

**For Development (creates new migration + applies):**
```bash
DATABASE_URL="your-neon-connection-string" npx prisma migrate dev
```

⚠️ **Important**: Use `migrate deploy` for production/NeonDB. Use `migrate dev` only for local development.

## Verify Migration Status

### Check which migrations are pending/applied:

```bash
DATABASE_URL="your-neon-connection-string" npx prisma migrate status
```

This will show:
- ✅ Applied migrations
- ⏳ Pending migrations
- ❌ Issues or conflicts

### View Database Schema:

```bash
DATABASE_URL="your-neon-connection-string" npx prisma db pull
```

### Open Prisma Studio (Optional - for visual inspection):

```bash
DATABASE_URL="your-neon-connection-string" npx prisma studio
```

This opens a web interface at `http://localhost:5555` to browse your database.

## Common Commands Reference

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `prisma migrate deploy` | Apply pending migrations | **Production/NeonDB** |
| `prisma migrate dev` | Create + apply new migration | Local development only |
| `prisma migrate status` | Check migration status | Anytime |
| `prisma generate` | Generate Prisma Client | After schema changes |
| `prisma db pull` | Pull schema from database | To sync schema |
| `prisma studio` | Open database browser | For inspection |

## Troubleshooting

### Error: "Migration X is not in the migrations directory"

**Solution**: Make sure you're in the `frontend` directory and all migrations exist:
```bash
cd frontend
ls -la prisma/migrations/
```

### Error: "Database connection failed"

**Check**:
1. Connection string is correct
2. NeonDB project is active (not paused)
3. IP allowlist allows your connection (if configured)
4. SSL mode is set: `?sslmode=require`

### Error: "Migration already applied"

**Solution**: Mark it as resolved:
```bash
DATABASE_URL="your-neon-connection-string" npx prisma migrate resolve --applied <migration-name>
```

### Error: "Migration failed"

**Solution**: 
1. Check the error message
2. Review the migration SQL in `prisma/migrations/<migration-name>/migration.sql`
3. If safe, mark as rolled back and fix:
   ```bash
   npx prisma migrate resolve --rolled-back <migration-name>
   ```

## Security Best Practices

1. **Never commit connection strings** to git
2. **Use environment variables** or `.env` files (already in `.gitignore`)
3. **Use read-only connection strings** for status checks when possible
4. **Backup database** before running migrations in production

## Example: Complete Migration Workflow

```bash
# 1. Navigate to frontend
cd frontend

# 2. Set connection string (or use .env file)
export DATABASE_URL="postgresql://user:password@ep-xxx-xxx.region.neon.tech/dbname?sslmode=require"

# 3. Check current status
npx prisma migrate status

# 4. Generate Prisma Client (if schema changed)
npx prisma generate

# 5. Apply migrations
npx prisma migrate deploy

# 6. Verify
npx prisma migrate status
```

## Using with Vercel Deployment

If you're deploying to Vercel, migrations can be run:

1. **Before deployment** (recommended):
   ```bash
   DATABASE_URL="your-neon-connection-string" npx prisma migrate deploy
   ```

2. **After deployment** (via Vercel CLI):
   ```bash
   # Pull environment variables from Vercel
   vercel env pull .env.local
   
   # Run migrations
   cd frontend
   npx prisma migrate deploy
   ```

3. **Automatically** (via build command):
   Add to `package.json`:
   ```json
   {
     "scripts": {
       "build": "prisma generate && prisma migrate deploy && next build"
     }
   }
   ```
   ⚠️ Note: This runs migrations on every build, which may not be desired.

## Quick Reference: NeonDB Connection String Format

```
postgresql://[user]:[password]@[host]/[database]?sslmode=require
```

Example:
```
postgresql://neondb_owner:abc123@ep-cool-darkness-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
```




