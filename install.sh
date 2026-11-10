#!/usr/bin/env bash
# Visitly installer — works for anyone who clones this repo.
# Usage:
#   ./install.sh
#   ./install.sh --yes
#   VISITLY_ADMIN_PASSWORD='...' ./install.sh --non-interactive --skip-nginx
#
# On hosts with old system Python (e.g. CentOS 7 / Python 3.6), the installer
# automatically re-runs itself inside a Python 3.12 container.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker is required. Install Docker Engine, then re-run ./install.sh" >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: Docker Compose plugin is required (\`docker compose\`)." >&2
  exit 1
fi

python_ok() {
  local bin="$1"
  "$bin" - <<'PY' >/dev/null 2>&1
import sys
raise SystemExit(0 if sys.version_info >= (3, 10) else 1)
PY
}

pick_host_python() {
  local candidate
  for candidate in python3.13 python3.12 python3.11 python3.10 python3 python; do
    if command -v "$candidate" >/dev/null 2>&1 && python_ok "$(command -v "$candidate")"; then
      command -v "$candidate"
      return 0
    fi
  done
  return 1
}

run_via_docker_python() {
  local image="${VISITLY_INSTALLER_IMAGE:-}"
  local images=()
  if [[ -n "$image" ]]; then
    images+=("$image")
  else
    # Prefer Iran mirror first when explicitly requested, else try global then Arvan.
    if [[ "${VISITLY_MIRROR_PROFILE:-}" =~ ^(iran|ir|2)$ ]]; then
      images+=(
        "docker.arvancloud.ir/library/python:3.12-slim"
        "python:3.12-slim"
      )
    else
      images+=(
        "python:3.12-slim"
        "docker.arvancloud.ir/library/python:3.12-slim"
      )
    fi
  fi

  local chosen=""
  local candidate
  for candidate in "${images[@]}"; do
    echo "Visitly → pulling installer runtime: $candidate"
    if docker pull "$candidate"; then
      chosen="$candidate"
      break
    fi
  done
  if [[ -z "$chosen" ]]; then
    echo "ERROR: could not pull a Python 3.12 image for the installer." >&2
    echo "Set VISITLY_INSTALLER_IMAGE to a reachable python:3.12 image and retry." >&2
    exit 1
  fi

  local docker_bin
  docker_bin="$(command -v docker)"
  local tty_flags=()
  if [[ -t 0 && -t 1 ]]; then
    tty_flags+=(-it)
  fi

  local mount_flags=(
    -v /var/run/docker.sock:/var/run/docker.sock
    -v "$docker_bin":/usr/bin/docker:ro
    -v "$ROOT":"$ROOT"
  )

  # Host compose plugin (needed for `docker compose` inside the container).
  if [[ -d /usr/libexec/docker/cli-plugins ]]; then
    mount_flags+=(-v /usr/libexec/docker/cli-plugins:/usr/libexec/docker/cli-plugins:ro)
  elif [[ -d /usr/local/lib/docker/cli-plugins ]]; then
    mount_flags+=(-v /usr/local/lib/docker/cli-plugins:/usr/local/lib/docker/cli-plugins:ro)
  fi

  # Allow writing cron + reading typical nginx paths during install.
  if [[ -d /etc/cron.d ]]; then
    mount_flags+=(-v /etc/cron.d:/etc/cron.d)
  fi
  if [[ -d /root ]]; then
    mount_flags+=(-v /root:/root)
  fi

  # Forward Visitly/Postgres config env vars into the installer container.
  local env_flags=()
  local line key
  while IFS= read -r line; do
    key="${line%%=*}"
    case "$key" in
      VISITLY_*|POSTGRES_*|PIP_*|NPM_*|DATABASE_URL|NODE_IMAGE|PYTHON_IMAGE)
        env_flags+=(-e "$key")
        ;;
    esac
  done < <(env)

  echo "Visitly → host Python is too old; running installer in $chosen"
  exec docker run --rm "${tty_flags[@]}" \
    --network host \
    --pid host \
    "${mount_flags[@]}" \
    "${env_flags[@]}" \
    -e VISITLY_INSTALLER_IMAGE="$chosen" \
    -w "$ROOT" \
    "$chosen" \
    python3 "$ROOT/install.py" "$@"
}

HOST_PYTHON="$(pick_host_python || true)"
if [[ -n "${HOST_PYTHON}" ]]; then
  echo "Visitly → starting staged installer ($("$HOST_PYTHON" -c 'import sys; print(sys.version.split()[0])'))"
  exec "$HOST_PYTHON" "$ROOT/install.py" "$@"
fi

HOST_PY_VERSION="unknown"
if command -v python3 >/dev/null 2>&1; then
  HOST_PY_VERSION="$(python3 -c 'import sys; print(sys.version.split()[0])' 2>/dev/null || echo unknown)"
elif command -v python >/dev/null 2>&1; then
  HOST_PY_VERSION="$(python -c 'import sys; print(sys.version.split()[0])' 2>/dev/null || echo unknown)"
fi

echo "Visitly → host Python ${HOST_PY_VERSION} < 3.10; bootstrapping via Docker"
run_via_docker_python "$@"
