#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
DEPS_DIR="$BACKEND_DIR/.deps"

cd "$BACKEND_DIR"

rm -rf "$DEPS_DIR"
mkdir -p "$DEPS_DIR"

python3 -m pip install --quiet --upgrade --target "$DEPS_DIR" -r requirements-dev.txt
export PYTHONPATH="$DEPS_DIR:$BACKEND_DIR"
python3 -m pytest -q tests
