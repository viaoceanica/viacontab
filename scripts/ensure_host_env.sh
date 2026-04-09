#!/usr/bin/env bash
set -euo pipefail

if ! command -v vps-host >/dev/null 2>&1; then
  echo "Missing vps-host helper on PATH" >&2
  exit 1
fi

vps-host 'python3 - <<"PY"
from pathlib import Path
import subprocess

env_path = Path("/root/viacontab/infra/.env")
text = env_path.read_text() if env_path.exists() else ""
keys = {line.split("=", 1)[0] for line in text.splitlines() if line and not line.startswith("#") and "=" in line}

if "NIF_PT_API_KEY" not in keys:
    output = subprocess.check_output(
        [
            "docker",
            "inspect",
            "viacontab-backend",
            "--format",
            "{{range .Config.Env}}{{println .}}{{end}}",
        ],
        text=True,
    )
    value = ""
    for line in output.splitlines():
        if line.startswith("NIF_PT_API_KEY="):
            value = line.split("=", 1)[1]
            break
    if value:
        with env_path.open("a") as handle:
            if text and not text.endswith("\n"):
                handle.write("\n")
            handle.write(f"NIF_PT_API_KEY={value}\n")
        print("Added NIF_PT_API_KEY to host .env")
    else:
        print("NIF_PT_API_KEY not found in current backend container env; leaving host .env unchanged")
else:
    print("Host .env already contains NIF_PT_API_KEY")
PY'
