# Sync Backend Dependencies In Docker Dev Overlay

## Meta

- Type: bugfix
- Status: done
- Owner: codex (gpt-5)
- Branch: codex/feature/welcome-landing-figma-copy
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-22
- Updated: 2026-02-22

## Context

`docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up airis` runs backend code from bind-mounted `./backend`,
but Python packages come from the base image (`ghcr.io/open-webui/open-webui:main`).
When fork-only dependencies exist in `backend/requirements.txt` (e.g. `aiosmtplib`), startup crashes with
`ModuleNotFoundError`, despite database migrations being applied.

## Goal / Acceptance Criteria

- [x] Dev overlay auto-syncs backend Python dependencies from mounted `backend/requirements.txt` before starting `start.sh`.
- [x] Dependency sync is idempotent and avoids reinstalling on every restart.
- [x] Compose parsing is clean (no unintended `${...}` interpolation from inline shell script).

## Non-goals

- Rebuilding Docker image layers for this fix.
- Changing production compose behavior.
- Refactoring backend email/auth modules.

## Scope (what changes)

- Config/Env:
  - Update `docker-compose.dev.yaml` `airis.command` to:
    - compute `requirements.txt` SHA256;
    - compare with persisted stamp in `/app/backend/data/.requirements.sha256`;
    - run `python -m pip install -r /app/backend/requirements.txt` only on hash change;
    - start backend with existing reload command.

## Implementation Notes

- Key files/entrypoints:
  - `docker-compose.dev.yaml`
- Behavior details:
  - stamp file is stored in `airis` named volume (`/app/backend/data`), so dependency sync persists across container recreation.
  - shell `$` variables are escaped as `$$` to prevent Docker Compose env interpolation.

## Upstream impact

- Upstream-owned files touched:
  - `docker-compose.dev.yaml`
- Why unavoidable:
  - the crash is caused by dev overlay runtime composition (mounted backend + upstream image deps).
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - changed only `airis.command` in dev overlay, leaving backend runtime code unchanged.

## Verification

- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml config`
  - verified command renders with escaped variables and no interpolation warnings.

## Task Entry (for branch_updates/current_tasks)

- [x] **[BUG][DEV][DOCKER]** Sync backend deps for dev compose overlay
  - Spec: `meta/memory_bank/specs/work_items/2026-02-22__bugfix__docker-dev-backend-deps-sync.md`
  - Owner: codex (gpt-5)
  - Branch: `codex/feature/welcome-landing-figma-copy`
  - Done: 2026-02-22
  - Summary: Prevent dev startup crashes from dependency drift between mounted backend code and upstream base image.
  - Tests: `docker compose ... config`
  - Risks: Low (dev-only startup command change).

## Risks / Rollback

- Risks:
  - First startup after dependency changes will spend extra time installing packages.
- Rollback plan:
  - Revert `docker-compose.dev.yaml` `airis.command` to `bash start.sh --reload --reload-dir /app/backend`.
