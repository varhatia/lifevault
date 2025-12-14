#!/bin/bash
# LifeVault Development Script - Starts both frontend and backend

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting LifeVault Development Environment${NC}"
echo ""

# Check if setup has been run
if [ ! -d "frontend/node_modules" ] || [ ! -d "backend/.venv" ]; then
    echo "Running initial setup..."
    ./scripts/setup-local.sh
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${GREEN}🛑 Stopping services...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    exit
}

trap cleanup SIGINT SIGTERM

# Start backend
echo -e "${BLUE}🐍 Starting Backend...${NC}"
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# Wait a bit for backend to start
sleep 2

# Start frontend
echo -e "${BLUE}⚛️  Starting Frontend...${NC}"
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo -e "${GREEN}✅ Services started!${NC}"
echo ""
echo "📍 Service URLs:"
echo "   Frontend:    http://localhost:3000"
echo "   Backend API: http://localhost:8000"
echo "   API Docs:    http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for both processes
wait

