#!/bin/bash
# LifeVault Local Development Setup Script

set -e

echo "🔧 Setting up LifeVault for local development..."

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

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.11+"
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

# Setup backend
echo "🐍 Setting up backend..."
cd "$(dirname "$0")/../backend" || exit

if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv .venv
fi

echo "Activating virtual environment..."
source .venv/bin/activate

echo "Installing backend dependencies..."
pip install --upgrade pip
pip install -e .

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
cd "$(dirname "$0")/../backend" || exit
if [ ! -f ".env" ]; then
    cat > .env << EOF
# Database Configuration
DATABASE_URL=postgresql+asyncpg://lifevault:lifevault_dev@localhost:5432/lifevault

# MinIO/S3 Configuration (optional - can use local file storage for dev)
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin123
AWS_ENDPOINT_URL=http://localhost:9000
AWS_REGION=us-east-1
AWS_S3_BUCKET=lifevault-vaults

# Security
SECRET_KEY=dev-secret-key-change-in-production
JWT_SECRET_KEY=dev-jwt-secret-change-in-production
JWT_ALGORITHM=HS256

# CORS
CORS_ORIGINS=http://localhost:3000
EOF
    echo "✅ Created backend/.env"
else
    echo "⚠️  backend/.env already exists"
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
echo "2. (Optional) Set up MinIO for S3 storage:"
echo "   - Download from: https://min.io/download"
echo "   - Or use local file storage (backend will handle this)"
echo ""
echo "3. Run database migrations:"
echo "   cd backend"
echo "   source .venv/bin/activate"
echo "   alembic upgrade head"
echo ""
echo "4. Start the application:"
echo "   Terminal 1 (Backend):"
echo "   cd backend && source .venv/bin/activate && uvicorn app.main:app --reload"
echo ""
echo "   Terminal 2 (Frontend):"
echo "   cd frontend && npm run dev"
echo ""
echo "5. Access the application:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"

