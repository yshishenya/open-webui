#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

export CORS_ALLOW_ORIGIN="http://localhost:5173;http://localhost:8080"

# Prevent repo .env (often Docker-oriented) from forcing Postgres when running locally.
# If the user didn't explicitly configure a DB via environment variables, default to SQLite.
if [ -z "${DATABASE_URL:-}" ] && [ -z "${DATABASE_TYPE:-}" ] && [ -z "${DATABASE_HOST:-}" ]; then
	export DATABASE_URL="sqlite:///$REPO_ROOT/backend/data/webui.db"
fi

# When running the backend locally, the Docker service hostname "postgres" is not reachable.
# If the user has a local Postgres exposed on localhost (e.g. via docker-compose ports),
# rewrite the common Docker URL form to localhost to avoid startup failure.
if [[ "${DATABASE_HOST:-}" == "postgres" ]]; then
	export DATABASE_HOST="localhost"
fi

if [[ "${DATABASE_URL:-}" == *"@postgres:"* ]]; then
	export DATABASE_URL="${DATABASE_URL//@postgres:/@localhost:}"
fi

PORT="${PORT:-8080}"
HOST="${HOST:-0.0.0.0}"

# Prefer running uvicorn from a local venv (avoids broken global shims).
if [ -f "$REPO_ROOT/.venv/bin/activate" ]; then
	# shellcheck disable=SC1091
	. "$REPO_ROOT/.venv/bin/activate"
fi

export PYTHONPATH="$REPO_ROOT/backend${PYTHONPATH:+:$PYTHONPATH}"

python -m uvicorn open_webui.main:app \
	--port "$PORT" \
	--host "$HOST" \
	--forwarded-allow-ips '*' \
	--reload
