#!/bin/bash
# LifeVault Database Check Script

set -e

echo "🗄️  LifeVault Database Information"
echo "=================================="
echo ""

# Check if database exists
if psql -d lifevault -c "\q" > /dev/null 2>&1; then
    echo "✅ Database 'lifevault' exists"
else
    echo "❌ Database 'lifevault' does not exist"
    echo "Run: ./scripts/setup-database.sh"
    exit 1
fi

echo ""
echo "📊 Database Tables:"
echo "-------------------"
psql -d lifevault -c "\dt"

echo ""
echo "📈 Table Row Counts:"
echo "---------------------"
psql -d lifevault << EOF
SELECT 
    schemaname,
    tablename,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = tablename) as column_count
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
EOF

echo ""
echo "👥 Users Table:"
echo "---------------"
psql -d lifevault -c "SELECT id, email, full_name, is_active, created_at FROM users LIMIT 5;" 2>/dev/null || echo "No users found"

echo ""
echo "📦 Vault Items:"
echo "--------------"
psql -d lifevault -c "SELECT COUNT(*) as total_items FROM vault_items;" 2>/dev/null || echo "No vault items found"

echo ""
echo "👨‍👩‍👧‍👦 Family Vaults:"
echo "-------------------"
psql -d lifevault -c "SELECT COUNT(*) as total_family_vaults FROM family_vaults;" 2>/dev/null || echo "No family vaults found"

echo ""
echo "🔑 Nominees:"
echo "-----------"
psql -d lifevault -c "SELECT COUNT(*) as total_nominees FROM nominees;" 2>/dev/null || echo "No nominees found"

echo ""
echo "📋 Migration Status:"
echo "-------------------"
psql -d lifevault -c "SELECT version_num, 'Applied' as status FROM alembic_version;" 2>/dev/null || echo "No migrations found"

echo ""
echo "💡 Quick Commands:"
echo "-----------------"
echo "  View all users:        psql -d lifevault -c \"SELECT * FROM users;\""
echo "  View all vault items:  psql -d lifevault -c \"SELECT id, user_id, category, title, created_at FROM vault_items;\""
echo "  Connect interactively: psql -d lifevault"
echo "  View table structure:   psql -d lifevault -c \"\\d users\""

