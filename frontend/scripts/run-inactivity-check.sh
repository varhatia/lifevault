#!/bin/bash

# Script to manually run the inactivity check
# Useful for testing or running from external cron services

# Load environment variables from .env.local
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi

# Get the API URL (default to localhost for development)
API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-}"

# Make the request
if [ -n "$CRON_SECRET" ]; then
  echo "Running inactivity check with authentication..."
  curl -X POST "${API_URL}/api/nominee/access/check-inactivity" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "Content-Type: application/json"
else
  echo "Running inactivity check without authentication (CRON_SECRET not set)..."
  curl -X POST "${API_URL}/api/nominee/access/check-inactivity" \
    -H "Content-Type: application/json"
fi

echo ""
echo "Done!"


