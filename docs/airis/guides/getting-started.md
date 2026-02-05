# Getting Started (Local Dev)

Airis is **Docker Compose-first**. You can run the full dev stack without installing local Python/npm.

## Prerequisites

- Docker Desktop / Docker Engine
- Docker Compose (`docker compose`)

## 1) Configure environment

- Start from `.env.example` and create your local `.env` (never commit it).
- Keep `.env` in sync with upstream updates:
  - `python3 scripts/sync_env.py --env .env`

## 2) Run the dev stack

### Option A: Interactive helper (recommended)

- `./scripts/dev_stack.sh`

### Option B: Raw compose

- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up`

Default URLs (unless overridden by env):

- Backend API: `http://localhost:8080`
- Frontend: `http://localhost:5173`

## 3) Run tests (Docker wrappers)

- Backend: `npm run docker:test:backend`
- Frontend: `npm run docker:test:frontend`
- E2E (when relevant): `npm run docker:test:e2e`
