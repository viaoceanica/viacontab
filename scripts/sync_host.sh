#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST_DIR="${HOST_DIR:-/root/viacontab}"
REMOTE_TMP="/tmp/viacontab-sync"

if ! command -v vps-host >/dev/null 2>&1; then
  echo "Missing vps-host helper on PATH" >&2
  exit 1
fi

tar \
  --exclude='./.git' \
  --exclude='./backend/.venv' \
  --exclude='./backend/.pytest_cache' \
  --exclude='./frontend/node_modules' \
  --exclude='./frontend/.next' \
  --exclude='./backend/.env' \
  --exclude='./frontend/.env' \
  --exclude='./infra/.env' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  -C "$ROOT_DIR" -czf - . \
| vps-host "rm -rf '$REMOTE_TMP' && mkdir -p '$REMOTE_TMP' '$HOST_DIR' && tar -xzf - -C '$REMOTE_TMP' && rsync -a --delete --exclude '.git' --exclude 'backend/.venv' --exclude 'backend/.pytest_cache' --exclude 'frontend/node_modules' --exclude 'frontend/.next' --exclude 'backend/.env' --exclude 'frontend/.env' --exclude 'infra/.env' '$REMOTE_TMP/' '$HOST_DIR/' && rm -rf '$REMOTE_TMP'"

echo "Synced workspace repo to $HOST_DIR"
