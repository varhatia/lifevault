#!/bin/bash
# LifeVault Local Development Start Script

set -e

echo "🚀 Starting LifeVault locally..."

# Check if setup has been run
if [ ! -d "frontend/node_modules" ]; then
    echo "⚠️  Frontend dependencies not installed. Running setup..."
    ./scripts/setup-local.sh
fi

if [ ! -d "backend/.venv" ]; then
    echo "⚠️  Backend virtual environment not found. Running setup..."
    ./scripts/setup-local.sh
fi

# Check PostgreSQL
echo "🔍 Checking PostgreSQL connection..."
if command -v psql &> /dev/null; then
    if psql -lqt | cut -d \| -f 1 | grep -qw lifevault; then
        echo "✅ Database 'lifevault' exists"
    else
        echo "⚠️  Database 'lifevault' not found. Creating..."
        createdb lifevault || echo "⚠️  Could not create database. Please create manually: createdb lifevault"
    fi
else
    echo "⚠️  PostgreSQL not found. Please install PostgreSQL or use a remote database."
fi

echo ""
echo "📋 Starting services..."
echo ""
echo "Starting Backend (Terminal 1)..."
echo "Run this command in a separate terminal:"
echo "  cd backend && source .venv/bin/activate && uvicorn app.main:app --reload"
echo ""
echo "Starting Frontend (Terminal 2)..."
echo "Run this command in another terminal:"
echo "  cd frontend && npm run dev"
echo ""
echo "Or use the convenience script:"
echo "  ./scripts/dev.sh"
echo ""

