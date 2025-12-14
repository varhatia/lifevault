#!/bin/bash
# LifeVault Local Development Setup Script (Node.js Backend)

set -e

echo "🔧 Setting up LifeVault for local development (Node.js stack)..."

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

# Setup frontend
echo "📦 Setting up frontend..."
cd "$(dirname "$0")/../frontend" || exit

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
else
    echo "Frontend dependencies already installed"
fi

echo "✅ Frontend setup complete"
echo ""

# Setup backend (Node.js)
echo "📦 Setting up backend (Node.js)..."
cd "$(dirname "$0")/../backend-ts" || exit

if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install
else
    echo "Backend dependencies already installed"
fi

echo "Generating Prisma Client..."
npm run prisma:generate

echo "✅ Backend setup complete"
echo ""

# Create .env files
echo "📝 Setting up environment files..."

# Frontend .env
cd "$(dirname "$0")/../frontend" || exit
if [ ! -f ".env.local" ]; then
    cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8000
EOF
    echo "✅ Created frontend/.env.local"
else
    echo "⚠️  frontend/.env.local already exists"
fi

# Backend .env
cd "$(dirname "$0")/../backend-ts" || exit
if [ ! -f ".env" ]; then
    cat > .env << EOF
# Database Configuration
DATABASE_URL=postgresql://lifevault:lifevault_dev@localhost:5432/lifevault

# Server Configuration
PORT=8000
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000

# Security
SECRET_KEY=dev-secret-key-change-in-production
JWT_SECRET_KEY=dev-jwt-secret-change-in-production
SERVER_SHARE_SECRET=dev-server-share-secret-change-in-production

# AWS S3 Configuration (optional - can use local file storage for dev)
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin123
AWS_ENDPOINT_URL=http://localhost:9000
AWS_REGION=us-east-1
AWS_S3_BUCKET=lifevault-vaults
EOF
    echo "✅ Created backend-ts/.env"
else
    echo "⚠️  backend-ts/.env already exists"
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
echo "2. Run database migrations:"
echo "   cd backend-ts"
echo "   npm run prisma:migrate"
echo ""
echo "3. Start the application:"
echo "   Terminal 1 (Backend):"
echo "   cd backend-ts && npm run dev"
echo ""
echo "   Terminal 2 (Frontend):"
echo "   cd frontend && npm run dev"
echo ""
echo "4. Access the application:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"

