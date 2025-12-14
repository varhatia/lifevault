#!/bin/bash
# LifeVault Stop Script

set -e

echo "🛑 Stopping LifeVault Application..."

cd "$(dirname "$0")/../infra" || exit

docker-compose down

echo "✅ LifeVault services stopped."

