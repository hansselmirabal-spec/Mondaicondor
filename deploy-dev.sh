#!/bin/bash
# Deploy DEV environment and auto-promote to QAS.
# Run this script on the server after pulling the latest code.
#
# Usage:
#   ./deploy-dev.sh           — build + start DEV, then promote to QAS
#   ./deploy-dev.sh --dev-only — build + start DEV only (skip QAS promotion)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DEV_ONLY=false
[[ "${1:-}" == "--dev-only" ]] && DEV_ONLY=true

if [[ ! -f .env.dev ]]; then
  echo "ERROR: .env.dev not found. Copy .env.dev.example and fill in real values."
  exit 1
fi

echo "==> [DEV] Building images..."
docker compose -f docker-compose.dev.yml --env-file .env.dev build --no-cache

echo "==> [DEV] Starting stack..."
docker compose -f docker-compose.dev.yml --env-file .env.dev up -d

echo "==> [DEV] Running at http://$(hostname -I | awk '{print $1}'):5301"

if $DEV_ONLY; then
  echo "==> QAS promotion skipped (--dev-only)."
  exit 0
fi

if [[ ! -f .env.qas ]]; then
  echo "WARNING: .env.qas not found — skipping QAS promotion."
  echo "Copy .env.qas.example to .env.qas to enable auto-promotion."
  exit 0
fi

echo ""
echo "==> [QAS] Promoting same images to QAS (no rebuild)..."
docker compose -f docker-compose.qas.yml --env-file .env.qas up -d --no-build

echo "==> [QAS] Running at http://$(hostname -I | awk '{print $1}'):5302"
echo ""
echo "Done. DEV and QAS are in sync."
