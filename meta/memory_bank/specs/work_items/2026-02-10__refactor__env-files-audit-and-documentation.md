# Refactor: Audit + Document `.env` / `.env.example`

## Meta

- Type: refactor
- Status: done
- Owner: Codex
- Branch: airis_b2c
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-10
- Updated: 2026-02-10

## Context

`.env.example` is the main configuration entrypoint for both local runs and Docker Compose deployments.
Over time it accumulated inconsistent commentary and a few variables that were documented but not plumbed into
the `airis` container environment in `docker-compose.yaml` (meaning they would not work in Compose-based deploys).

This work audits the env var set we document, confirms they are referenced in code/compose, and makes the files
easier and safer to use by adding clear, detailed comments and consistent ordering.

## Goal / Acceptance Criteria

- [x] `.env.example` is grouped, ordered, and has clear comments (required vs optional; dev vs prod guidance).
- [x] `.env` (local, gitignored) matches the same structure and avoids inline comments after values.
- [x] All variables present in `.env.example` are referenced somewhere in the repo (code, compose, scripts).
- [x] Variables that must reach the backend in Docker Compose are passed via `docker-compose.yaml` environment.
- [x] No secrets are added to tracked files.

## Non-goals

- Document every upstream Open WebUI env var (the full list remains in `backend/open_webui/env.py`).
- Rotate or change any existing secrets in local `.env`.
- Change application behavior beyond making already-supported env vars configurable in Compose.

## Scope (what changes)

- Backend:
  - None (no runtime logic changes expected).
- Frontend:
  - None.
- Config/Env:
  - Reformat + comment improvements in `.env.example`.
  - Reformat + comment improvements in local `.env` (gitignored).
  - Ensure Compose passes documented backend env vars (YooKassa webhook hardening + billing estimate cap).
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `.env.example`
  - `.env` (gitignored)
  - `docker-compose.yaml`
  - `backend/open_webui/env.py` (source of truth for env parsing)
  - `backend/open_webui/routers/billing.py` (YooKassa webhook hardening knobs)
- API changes:
  - None.
- Edge cases:
  - Keep dotenv/compose-friendly syntax: no trailing inline comments after values; JSON values stay single-quoted.

## Upstream impact

- Upstream-owned files touched:
  - `.env.example`
  - `docker-compose.yaml`
- Why unavoidable:
  - The goal is to reduce operator error by improving the primary env templates and ensuring documented vars work
    in Compose-based deployments.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Comment-only changes in `.env.example` plus small, additive env passthrough lines in `docker-compose.yaml`.

## Verification

- Docker Compose config validation: `docker compose -f docker-compose.yaml config`

## Task Entry (for branch_updates/current_tasks)

- [ ] **[REFACTOR][ENV]** Audit + document `.env`/`.env.example` variables
  - Spec: `meta/memory_bank/specs/work_items/2026-02-10__refactor__env-files-audit-and-documentation.md`
  - Owner: Codex
  - Branch: `airis_b2c`
  - Started: 2026-02-10
  - Summary: Упорядочить и прокомментировать `.env*`, сверить переменные с кодом/compose и починить passthrough для Compose.
  - Tests: `docker compose -f docker-compose.yaml config`
  - Risks: Low (config/docs-only; tiny Compose env passthrough changes)

## Risks / Rollback

- Risks:
  - Minor: typo in `.env.example` comments/order could confuse operators.
  - Minor: Compose env passthrough line typos could break `docker compose up`.
- Rollback plan:
  - Revert `.env.example` / `docker-compose.yaml` changes (no data migrations involved).
