#!/bin/bash
# Script to run migration on production database
# Usage: ./run-production-migration.sh

set -e

echo "🔄 Running migration on production database..."

# Check if DATABASE_URL is provided
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable is required"
    echo "Usage: DATABASE_URL='your-production-db-url' ./run-production-migration.sh"
    exit 1
fi

cd "$(dirname "$0")"

# Run the migration
npx prisma migrate deploy

echo "✅ Migration complete!"
