#!/bin/bash
# Deploy QAS environment (port 5302).
# Run this script on the server after pulling the latest code.
#
# Usage:
#   ./deploy-qas.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -f .env.qas ]]; then
  echo "ERROR: .env.qas not found. Copy .env.qas.example and fill in real values."
  exit 1
fi

echo "==> [QAS] Stopping existing stack..."
docker-compose -f docker-compose.qas.yml --env-file .env.qas down

echo "==> [QAS] Building images..."
docker-compose -f docker-compose.qas.yml --env-file .env.qas build

echo "==> [QAS] Starting stack..."
docker-compose -f docker-compose.qas.yml --env-file .env.qas up -d

echo "==> [QAS] Running at http://$(hostname -I | awk '{print $1}'):5302"
echo "Done."
