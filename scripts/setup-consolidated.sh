#!/bin/bash
# LifeVault Consolidated Setup Script (Single Port - Next.js)

set -e

echo "🔧 Setting up LifeVault (Consolidated Next.js App)..."

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+ from https://nodejs.org"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "⚠️  Warning: Node.js version should be 20+. Current: $(node -v)"
fi

echo "✅ Prerequisites check passed"
echo ""

# Setup frontend (now includes backend)
echo "📦 Setting up LifeVault app (Next.js with API routes)..."
cd "$(dirname "$0")/../frontend" || exit

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
else
    echo "Dependencies already installed"
fi

echo "Generating Prisma Client..."
npm run prisma:generate

echo "✅ Setup complete"
echo ""

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    echo "📝 Creating .env.local..."
    cat > .env.local << EOF
# Frontend Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000

# Database Configuration (for API routes)
DATABASE_URL=postgresql://lifevault:lifevault_dev@localhost:5432/lifevault

# Security
SECRET_KEY=dev-secret-key-change-in-production
JWT_SECRET_KEY=dev-jwt-secret-change-in-production
SERVER_SHARE_SECRET=dev-server-share-secret-change-in-production

# AWS S3 Configuration (optional)
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin123
AWS_ENDPOINT_URL=http://localhost:9000
AWS_REGION=us-east-1
AWS_S3_BUCKET=lifevault-vaults
EOF
    echo "✅ Created .env.local"
else
    echo "⚠️  .env.local already exists"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Set up PostgreSQL database:"
echo "   - Install PostgreSQL: https://www.postgresql.org/download/"
echo "   - Create database: createdb lifevault"
echo "   - Or use: psql -c 'CREATE DATABASE lifevault;'"
echo ""
echo "2. Run database migrations (if needed):"
echo "   cd frontend"
echo "   npm run prisma:migrate"
echo ""
echo "3. Start the application:"
echo "   cd frontend"
echo "   npm run dev"
echo ""
echo "4. Access the application:"
echo "   Frontend: http://localhost:3000"
echo "   API: http://localhost:3000/api/health"
echo "   All on one port! 🎉"

