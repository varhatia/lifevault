#!/bin/bash
# LifeVault Reset Script (removes all data)

set -e

echo "⚠️  WARNING: This will remove all LifeVault data!"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Reset cancelled."
    exit 0
fi

echo "🗑️  Removing containers and volumes..."
cd "$(dirname "$0")/../infra" || exit

docker-compose down -v

echo "✅ All data has been removed. Run ./scripts/start.sh to start fresh."

