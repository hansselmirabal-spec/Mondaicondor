#!/bin/bash
# Deploy PROD environment (port 5300).
# Run this script on the server after pulling the latest code.
#
# Usage:
#   ./deploy-prod.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -f .env.prod ]]; then
  echo "ERROR: .env.prod not found. Copy .env.prod.example and fill in real values."
  exit 1
fi

echo "==> [PROD] Stopping existing stack..."
docker-compose -f docker-compose.prod.yml --env-file .env.prod down

echo "==> [PROD] Building images..."
docker-compose -f docker-compose.prod.yml --env-file .env.prod build

echo "==> [PROD] Starting stack..."
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

echo "==> [PROD] Running at http://$(hostname -I | awk '{print $1}'):5300"
echo "Done."
