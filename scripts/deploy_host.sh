#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_TESTS=true

for arg in "$@"; do
  case "$arg" in
    --skip-tests)
      RUN_TESTS=false
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

if [[ "$RUN_TESTS" == "true" ]]; then
  "$ROOT_DIR/scripts/test_all.sh"
fi

"$ROOT_DIR/scripts/sync_host.sh"
"$ROOT_DIR/scripts/ensure_host_env.sh"

vps-host 'mkdir -p /root/backups/viacontab && tar -czf "/root/backups/viacontab/viacontab-$(date +%Y%m%d-%H%M%S).tgz" -C /root viacontab'
vps-host 'cd /root/viacontab/infra && docker compose up -d --build --remove-orphans'

"$ROOT_DIR/scripts/smoke_host.sh"

echo "ViaContab deployed successfully"
