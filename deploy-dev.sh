#!/bin/bash
# Deploy DEV environment (port 5301).
# Run this script on the server after pulling the latest code.
#
# Usage:
#   ./deploy-dev.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -f .env.dev ]]; then
  echo "ERROR: .env.dev not found. Copy .env.dev.example and fill in real values."
  exit 1
fi

echo "==> [DEV] Stopping existing stack..."
docker-compose -f docker-compose.dev.yml --env-file .env.dev down

echo "==> [DEV] Building images..."
docker-compose -f docker-compose.dev.yml --env-file .env.dev build

echo "==> [DEV] Starting stack..."
docker-compose -f docker-compose.dev.yml --env-file .env.dev up -d

echo "==> [DEV] Running at http://$(hostname -I | awk '{print $1}'):5301"
echo "Done."
