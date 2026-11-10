#!/usr/bin/env bash
# Visitly installer — works for anyone who clones this repo.
# Usage:
#   ./install.sh
#   ./install.sh --yes
#   VISITLY_ADMIN_PASSWORD='...' ./install.sh --non-interactive --skip-nginx
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if ! command -v python3 >/dev/null 2>&1 && ! command -v python >/dev/null 2>&1; then
  echo "ERROR: Python 3.10+ is required." >&2
  exit 1
fi

PYTHON_BIN="$(command -v python3 || command -v python)"
"$PYTHON_BIN" - <<'PY'
import sys
if sys.version_info < (3, 10):
    raise SystemExit(f"ERROR: Python 3.10+ required, found {sys.version.split()[0]}")
PY

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker is required. Install Docker Engine, then re-run ./install.sh" >&2
  exit 1
fi

echo "Visitly → starting staged installer"
exec "$PYTHON_BIN" "$ROOT/install.py" "$@"
