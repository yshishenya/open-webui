# Active users counter: safe default hidden for non-admins

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: bugfix/active-users-counter-visibility
- SDD Spec (JSON, required for non-trivial): N/A (trivial config/runtime default hardening)
- Created: 2026-03-05
- Updated: 2026-03-05

## Context

`ENABLE_PUBLIC_ACTIVE_USERS_COUNT=false` was expected to hide the "Active Users" counter for regular users.
On a stale deployment commit this variable was not passed into the container, and repository defaults were permissive
(`true`) in multiple places. This made the behavior fragile and could re-enable public visibility when env wiring is missing.

## Goal / Acceptance Criteria

- [x] Backend runtime default is `false` when env var is absent.
- [x] Docker Compose fallback is `false` when env var is absent.
- [x] Env templates default to `false` to match expected privacy-safe behavior.
- [x] Admin visibility behavior remains unchanged.

## Non-goals

- Changing admin-only visibility logic.
- Introducing UI toggles or role model changes.
- Any billing or auth logic changes.

## Scope (what changes)

- Backend:
  - `backend/open_webui/env.py` default for `ENABLE_PUBLIC_ACTIVE_USERS_COUNT`.
- Frontend:
  - None.
- Config/Env:
  - `docker-compose.yaml` fallback for `ENABLE_PUBLIC_ACTIVE_USERS_COUNT`.
  - `.env.example`, `.env.etalon`, `.env.etalon.example` defaults.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `backend/open_webui/env.py`
  - `docker-compose.yaml`
  - `.env.example`
  - `.env.etalon`
  - `.env.etalon.example`
- API changes:
  - None.
- Edge cases:
  - Admins still see active users counter by design.

## Upstream impact

If this work touches upstream-owned files, list them here and explain why (and how the diff is minimized):

- Upstream-owned files touched:
  - `backend/open_webui/env.py`
  - `docker-compose.yaml`
- Why unavoidable:
  - Runtime/env defaults and compose wiring live in upstream-owned files.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Single-line default changes only; no structural edits.

## Verification

- `rg -n "ENABLE_PUBLIC_ACTIVE_USERS_COUNT" backend/open_webui/env.py docker-compose.yaml .env.example .env.etalon .env.etalon.example`
- `docker compose -f docker-compose.yaml config | rg -n "ENABLE_PUBLIC_ACTIVE_USERS_COUNT"`
- `python -c "import ast, pathlib; ast.parse(pathlib.Path('backend/open_webui/env.py').read_text()); print('OK')"`

## Task Entry (for branch_updates/current_tasks)

- [x] **[BUG][CONFIG][UI]** Hide public active-users counter by default
  - Spec: `meta/memory_bank/specs/work_items/2026-03-05__bugfix__active-users-counter-default-hidden.md`
  - Owner: Codex
  - Branch: `bugfix/active-users-counter-visibility`
  - Done: 2026-03-05
  - Summary: Set safe default `false` in backend, compose fallback, and env templates so non-admins do not see active users counter when env wiring is missing.
  - Tests: `rg -n "ENABLE_PUBLIC_ACTIVE_USERS_COUNT" ...`, `docker compose -f docker-compose.yaml config | rg -n "ENABLE_PUBLIC_ACTIVE_USERS_COUNT"`, `python -c "import ast, pathlib; ast.parse(...); print('OK')"`
  - Risks: Low (config/default-only change; admin behavior preserved).

## Risks / Rollback

- Risks:
  - Operators relying on implicit public visibility must set env var explicitly to `true`.
- Rollback plan:
  - Revert this commit or set `ENABLE_PUBLIC_ACTIVE_USERS_COUNT=true` in runtime env.

## Completion Checklist

- [x] If SDD spec is linked: `meta/tools/sdd check-complete <spec_id> --json` (N/A)
- [x] If SDD spec is linked: `meta/tools/sdd complete-spec <spec_id> --json` (N/A)
- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)
