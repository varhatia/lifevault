#!/bin/bash
# LifeVault Database Setup Script

set -e

echo "🗄️  Setting up LifeVault database..."

# Check if PostgreSQL is running
if ! pg_isready > /dev/null 2>&1; then
    echo "❌ PostgreSQL is not running. Please start PostgreSQL first."
    echo ""
    echo "On macOS with Homebrew:"
    echo "  brew services start postgresql@15"
    echo ""
    echo "On Linux:"
    echo "  sudo systemctl start postgresql"
    exit 1
fi

echo "✅ PostgreSQL is running"
echo ""

# Try to connect and create user/database
echo "Creating database user and database..."

# Try with postgres user first
if psql -d postgres -c "\q" > /dev/null 2>&1; then
    echo "Using 'postgres' user to create database..."
    psql -d postgres << EOF
-- Create user if it doesn't exist
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'lifevault') THEN
        CREATE USER lifevault WITH PASSWORD 'lifevault_dev';
        ALTER USER lifevault CREATEDB;
    END IF;
END
\$\$;

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE lifevault OWNER lifevault'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'lifevault')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE lifevault TO lifevault;

-- Grant schema permissions (required for PostgreSQL 15+)
\c lifevault
GRANT ALL ON SCHEMA public TO lifevault;
ALTER SCHEMA public OWNER TO lifevault;
EOF
    echo "✅ Database user and database created successfully!"
elif psql -U postgres -d postgres -c "\q" > /dev/null 2>&1; then
    echo "Using 'postgres' user (with -U flag) to create database..."
    psql -U postgres -d postgres << EOF
-- Create user if it doesn't exist
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'lifevault') THEN
        CREATE USER lifevault WITH PASSWORD 'lifevault_dev';
        ALTER USER lifevault CREATEDB;
    END IF;
END
\$\$;

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE lifevault OWNER lifevault'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'lifevault')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE lifevault TO lifevault;

-- Grant schema permissions (required for PostgreSQL 15+)
\c lifevault
GRANT ALL ON SCHEMA public TO lifevault;
ALTER SCHEMA public OWNER TO lifevault;
EOF
    echo "✅ Database user and database created successfully!"
else
    echo "⚠️  Could not connect to PostgreSQL automatically."
    echo ""
    echo "Please run these commands manually:"
    echo ""
    echo "  psql -d postgres"
    echo ""
    echo "Then run:"
    echo "  CREATE USER lifevault WITH PASSWORD 'lifevault_dev';"
    echo "  ALTER USER lifevault CREATEDB;"
    echo "  CREATE DATABASE lifevault OWNER lifevault;"
    echo "  GRANT ALL PRIVILEGES ON DATABASE lifevault TO lifevault;"
    echo ""
    echo "Or if you want to use your existing PostgreSQL user, update backend/.env:"
    echo "  DATABASE_URL=postgresql+asyncpg://YOUR_USER:YOUR_PASSWORD@localhost:5432/lifevault"
    exit 1
fi

echo ""
echo "✅ Database setup complete!"
echo ""
echo "You can now run migrations:"
echo "  cd backend"
echo "  source .venv/bin/activate"
echo "  alembic upgrade head"

