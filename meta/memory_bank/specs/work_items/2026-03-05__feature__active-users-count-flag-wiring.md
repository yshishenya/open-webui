# Public Active Users Flag Wiring

## Meta

- Type: feature
- Status: done
- Owner: Codex
- Branch: feature/billing-balance-topup-presets
- SDD Spec (JSON, required for non-trivial): N/A (trivial config/docs wiring)
- Created: 2026-03-05
- Updated: 2026-03-05

## Context

The UI already supports `enable_public_active_users_count`, but the deployment templates did not expose a documented env toggle. We need a clear, documented, and consistently wired flag so operators can control the "Active Users" counter visibility without code changes.

## Goal / Acceptance Criteria

- [x] Add `ENABLE_PUBLIC_ACTIVE_USERS_COUNT` with clear comments to env templates.
- [x] Pass the flag through `docker-compose.yaml` so `.env` value reaches backend runtime.
- [x] Keep backend comments clear about behavior (admins always can see the counter).
- [x] Set the local `.env` value to disable public visibility in this environment.

## Non-goals

- Adding an admin UI toggle for this flag.
- Changing role-based behavior (admins still see the counter).

## Scope (what changes)

- Backend:
  - Clarified inline comments for `ENABLE_PUBLIC_ACTIVE_USERS_COUNT`.
- Frontend:
  - No behavior/code changes.
- Config/Env:
  - Added documented flag to `.env.example`, `.env.etalon.example`, `.env.etalon`.
  - Added env passthrough in `docker-compose.yaml`.
  - Added local `.env` override (`false`) for this environment.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `.env.example`
  - `.env.etalon.example`
  - `.env.etalon`
  - `.env`
  - `docker-compose.yaml`
  - `backend/open_webui/env.py`
  - `backend/open_webui/main.py`
- API changes:
  - None.
- Edge cases:
  - Even with `ENABLE_PUBLIC_ACTIVE_USERS_COUNT=false`, admins still see the counter by design.

## Upstream impact

- Upstream-owned files touched:
  - `backend/open_webui/env.py`
  - `backend/open_webui/main.py`
  - `docker-compose.yaml`
- Why unavoidable:
  - The flag must be wired from deployment env to backend and documented near runtime feature exposure.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Only additive env/config line and comment-level clarifications; no behavioral logic changes.

## Verification

- Docker Compose config render:
  - `docker compose -f docker-compose.yaml config >/tmp/docker-compose.resolved.yaml`
- Syntax validation for touched Python files (no bytecode writes):
  - `python -c "import ast, pathlib; [ast.parse(pathlib.Path(p).read_text()) for p in ['backend/open_webui/env.py','backend/open_webui/main.py']]; print('OK')"`
- Presence checks:
  - `rg -n "ENABLE_PUBLIC_ACTIVE_USERS_COUNT" .env .env.example .env.etalon .env.etalon.example docker-compose.yaml backend/open_webui/env.py backend/open_webui/main.py`

## Task Entry (for branch_updates/current_tasks)

- [x] **[CONFIG][UI]** Wire and document `ENABLE_PUBLIC_ACTIVE_USERS_COUNT`
  - Spec: `meta/memory_bank/specs/work_items/2026-03-05__feature__active-users-count-flag-wiring.md`
  - Owner: Codex
  - Branch: `feature/billing-balance-topup-presets`
  - Done: 2026-03-05
  - Summary: Added env templates + compose passthrough + backend comments for public active-users counter visibility and set local env to disable public visibility.
  - Tests: `docker compose -f docker-compose.yaml config >/tmp/docker-compose.resolved.yaml`, `python -c "import ast, pathlib; [ast.parse(pathlib.Path(p).read_text()) for p in ['backend/open_webui/env.py','backend/open_webui/main.py']]; print('OK')"`, `rg -n "ENABLE_PUBLIC_ACTIVE_USERS_COUNT" ...`
  - Risks: Low (config/documentation wiring only; admins still see counter by design).

## Risks / Rollback

- Risks:
  - Operator may expect admins to also lose visibility when the flag is `false`.
- Rollback plan:
  - Remove the added env lines/comments and set `ENABLE_PUBLIC_ACTIVE_USERS_COUNT=true` in runtime env.

## Completion Checklist

- [x] If SDD spec is linked: `meta/tools/sdd check-complete <spec_id> --json` (N/A, no SDD for trivial task)
- [x] If SDD spec is linked: `meta/tools/sdd complete-spec <spec_id> --json` (N/A, no SDD for trivial task)
- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)
