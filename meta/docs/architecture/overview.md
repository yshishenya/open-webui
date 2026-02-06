# Architecture Overview (Airis)

Airis keeps upstream diffs small and isolates fork logic behind thin hooks.

## High-level components

- **Frontend**: SvelteKit app under `src/`
- **Backend**: FastAPI app under `backend/open_webui/`
- **Persistence**: Postgres in production (SQLite in dev where configured)
- **Dev stack**: Docker Compose-first (see `scripts/dev_stack.sh`)

## Repo layout (practical)

- Backend entrypoint: `backend/open_webui/main.py`
- Routers: `backend/open_webui/routers/`
- Models/persistence: `backend/open_webui/models/`
- Helpers/services: `backend/open_webui/utils/`
- Frontend routes: `src/routes/`
- Frontend utilities:
  - Upstream-friendly fork code: `src/lib/utils/airis/`

## Fork-owned isolation rule

Prefer additive “fork-owned” modules:

- Frontend: `src/lib/utils/airis/*`
- Backend (when needed): `backend/open_webui/utils/airis/*`

Keep upstream-owned files as **thin callers**. Details: [Upstream sync guide](../../memory_bank/guides/upstream_sync.md).

## Runtime data flow (simplified)

1. Browser loads SvelteKit UI (`src/`).
2. UI calls backend API (`/api/v1/*`).
3. Backend reads/writes DB models and calls external providers (LLMs, YooKassa, etc).

## Local services (Docker Compose)

- `docker-compose.yaml`: `airis`, `postgres`
- `docker-compose.dev.yaml`: adds `airis-frontend` (Vite dev server)
- `.codex/docker-compose.codex.yaml`: helpers (`pytools`, `e2e`)
