#!/bin/bash
# Migration Order Verification Script

set -e

echo "🔍 Verifying Prisma Migration Order and Dependencies"
echo "======================================================"
echo ""

MIGRATIONS_DIR="prisma/migrations"
SCHEMA_FILE="prisma/schema.prisma"

# List all migrations in order
echo "📋 Migration Files Found:"
echo "------------------------"
find "$MIGRATIONS_DIR" -name "migration.sql" -type f | sort | while read file; do
    dir=$(dirname "$file")
    migration_name=$(basename "$dir")
    echo "  ✓ $migration_name"
done
echo ""

# Check for empty migrations
echo "🔍 Checking for Empty Migrations:"
echo "----------------------------------"
empty_count=0
for dir in "$MIGRATIONS_DIR"/*/; do
    if [ -d "$dir" ] && [ ! -f "$dir/migration.sql" ]; then
        migration_name=$(basename "$dir")
        echo "  ❌ EMPTY: $migration_name (no migration.sql file)"
        empty_count=$((empty_count + 1))
    fi
done
if [ $empty_count -eq 0 ]; then
    echo "  ✅ No empty migrations found"
fi
echo ""

# Check for duplicate migration names
echo "🔍 Checking for Duplicate Migration Patterns:"
echo "----------------------------------------------"
duplicates=0
declare -A migration_patterns

for file in "$MIGRATIONS_DIR"/*/migration.sql; do
    if [ -f "$file" ]; then
        dir=$(dirname "$file")
        migration_name=$(basename "$dir")
        # Extract pattern (everything after timestamp)
        pattern=$(echo "$migration_name" | sed 's/^[0-9_]*//')
        if [ -n "$pattern" ]; then
            if [ -n "${migration_patterns[$pattern]}" ]; then
                echo "  ⚠️  DUPLICATE PATTERN: '$pattern'"
                echo "      - ${migration_patterns[$pattern]}"
                echo "      - $migration_name"
                duplicates=$((duplicates + 1))
            else
                migration_patterns[$pattern]="$migration_name"
            fi
        fi
    fi
done
if [ $duplicates -eq 0 ]; then
    echo "  ✅ No duplicate patterns found"
fi
echo ""

# Analyze migration dependencies
echo "📊 Migration Dependency Analysis:"
echo "----------------------------------"
echo ""

# Check what each migration creates/modifies
for file in "$MIGRATIONS_DIR"/*/migration.sql; do
    if [ -f "$file" ]; then
        dir=$(dirname "$file")
        migration_name=$(basename "$dir")
        echo "  📄 $migration_name:"
        
        # Count CREATE TABLE statements
        create_tables=$(grep -i "CREATE TABLE" "$file" | wc -l | tr -d ' ')
        if [ "$create_tables" -gt 0 ]; then
            tables=$(grep -i "CREATE TABLE" "$file" | sed 's/.*CREATE TABLE[^"]*"\([^"]*\)".*/\1/' | tr '\n' ', ' | sed 's/,$//')
            echo "      Creates tables: $tables"
        fi
        
        # Count ALTER TABLE statements
        alter_tables=$(grep -i "ALTER TABLE" "$file" | wc -l | tr -d ' ')
        if [ "$alter_tables" -gt 0 ]; then
            echo "      Alters $alter_tables table(s)"
        fi
        
        # Check for DROP statements
        drop_count=$(grep -i "DROP" "$file" | wc -l | tr -d ' ')
        if [ "$drop_count" -gt 0 ]; then
            echo "      ⚠️  Contains $drop_count DROP statement(s)"
        fi
    fi
done
echo ""

# Verify migration status
echo "🔍 Checking Migration Status:"
echo "------------------------------"
if command -v npx &> /dev/null; then
    cd "$(dirname "$SCHEMA_FILE")/.."
    npx prisma migrate status 2>&1 | head -20 || echo "  ⚠️  Could not check migration status (database may not be connected)"
else
    echo "  ⚠️  npx not available, skipping status check"
fi
echo ""

echo "✅ Verification Complete!"
echo ""
echo "📝 Next Steps:"
echo "  1. Review any issues identified above"
echo "  2. Remove duplicate/empty migrations if found"
echo "  3. Verify migration order matches schema evolution"
echo "  4. Test migrations on a fresh database"
