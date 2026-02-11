# Work Item: Refactor .env (Cleanup + Clarify)

- Type: Refactor
- Date: 2026-02-10
- Owner: Codex

## Goal

Make `.env` easier to operate by:

- Syncing structure and ordering with `.env.example`.
- Removing variables not needed for the current deployment scenario.
- Adding clear comments (RU) explaining what each block is for.

## Non-Goals

- No backend/frontend runtime logic changes.
- No dependency changes.

## Current Deployment Assumptions

- Ollama not used.
- OpenAI configured via UI (not via env vars).
- `docker-compose.dev.yaml` overlay is used for development.
- SMTP is used (verification/reset emails).

## Changes

- Reorganized `.env` into clear sections mirroring `.env.example`.
- Disabled Ollama by setting `OLLAMA_BASE_URL=` and removed Ollama overlay-only variables.
- Removed OpenAI env vars (kept as commented documentation only).
- Kept dev overlay ports variables.
- Normalized SMTP password line (no inline comment on the value).

## Verification

- Static: verified all remaining variables are referenced in repo runtime/config files
  (`backend/open_webui/*`, `docker-compose*.y*ml`, `scripts/*`).

## Notes / Ops

- Runtime requires a container restart to pick up `.env` changes.

