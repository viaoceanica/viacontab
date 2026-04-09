#!/usr/bin/env bash
set -euo pipefail

if ! command -v vps-host >/dev/null 2>&1; then
  echo "Missing vps-host helper on PATH" >&2
  exit 1
fi

vps-host 'cd /root/viacontab/infra && docker compose ps'
vps-host 'python3 - <<"PY"
import json
import urllib.request

for url in [
    "http://127.0.0.1:8100/api/health",
    "http://127.0.0.1:8100/api/ready",
    "http://127.0.0.1:7100",
]:
    with urllib.request.urlopen(url, timeout=15) as response:
        body = response.read().decode("utf-8", errors="ignore")
        preview = body[:200].replace("\n", " ")
        print(json.dumps({"url": url, "status": response.status, "preview": preview}))
PY'
