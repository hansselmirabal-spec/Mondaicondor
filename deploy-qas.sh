#!/bin/bash
# Restart QAS with whatever images are currently tagged taskflow-*:dev.
# Run this only if you need to restart QAS independently.
# For a full DEV+QAS deploy, use deploy-dev.sh instead.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -f .env.qas ]]; then
  echo "ERROR: .env.qas not found. Copy .env.qas.example and fill in real values."
  exit 1
fi

echo "==> [QAS] Restarting with current taskflow-*:dev images..."
docker compose -f docker-compose.qas.yml --env-file .env.qas up -d --no-build

echo "==> [QAS] Running at http://$(hostname -I | awk '{print $1}'):5302"
