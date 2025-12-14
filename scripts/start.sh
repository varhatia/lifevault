#!/bin/bash
# LifeVault Startup Script

set -e

echo "🚀 Starting LifeVault Application..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Navigate to infra directory
cd "$(dirname "$0")/../infra" || exit

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "✅ .env file created. Please review and update if needed."
fi

# Start services
echo "🐳 Starting Docker containers..."
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check service health
echo "🔍 Checking service health..."
if docker-compose ps | grep -q "Up"; then
    echo "✅ Services are starting up!"
    echo ""
    echo "📍 Service URLs:"
    echo "   Frontend:    http://localhost:3000"
    echo "   Backend API: http://localhost:8000"
    echo "   API Docs:    http://localhost:8000/docs"
    echo "   MinIO:       http://localhost:9001 (Console)"
    echo ""
    echo "📊 View logs: docker-compose -f infra/docker-compose.yml logs -f"
    echo "🛑 Stop:       docker-compose -f infra/docker-compose.yml down"
else
    echo "❌ Some services failed to start. Check logs with:"
    echo "   docker-compose -f infra/docker-compose.yml logs"
fi

