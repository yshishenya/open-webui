# Prod deploy runtime import hotfix

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: airis_b2c
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-03-11
- Updated: 2026-03-11

## Context

After syncing `airis_b2c` from upstream and starting a prod deploy, the new image failed to boot on production. The first failure was a broken backend dependency install caused by `ddgs==9.11.2` no longer being available. Once that was fixed, production still crashed during application import because the merged branch contained two runtime import regressions.

## Goal / Acceptance Criteria

- [x] Build a production image that contains backend runtime dependencies, including `uvicorn`.
- [x] Restore application startup on production without manual source edits on the server.
- [x] Verify the deployed prod container reaches `healthy`.
- [x] Verify `http://localhost:3000/health` returns `{"status":true}` on prod.

## Non-goals

- Full backend/frontend test suite execution.
- Refactoring the deploy script to remove its remote `git pull` dependency.
- General cleanup of stale `uv.lock` drift versus `pyproject.toml`.

## Scope (what changes)

- Backend:
  - Restore runtime import compatibility in `open_webui.utils.access_control`.
  - Restore `deep_get_bool` / `deep_get_mapping` exports expected by middleware.
- Frontend:
  - None.
- Config/Env:
  - None.
- Data model / migrations:
  - None.
- Build/deploy:
  - Update `ddgs` pin to an available release.
  - Make Docker backend dependency installation fail fast so broken images stop at build time.

## Implementation Notes

- Key files/entrypoints:
  - `Dockerfile`
  - `backend/requirements.txt`
  - `pyproject.toml`
  - `backend/open_webui/utils/access_control/__init__.py`
  - `backend/open_webui/utils/misc.py`
- API changes:
  - None.
- Edge cases:
  - The prod deploy script still fails on remote `git pull` because prod `origin` uses HTTPS and hits a GnuTLS handshake error.
  - Manual remote `docker compose pull/up` remains necessary until prod git remote access is fixed.

## Upstream impact

If this work touches upstream-owned files, list them here and explain why (and how the diff is minimized):

- Upstream-owned files touched:
  - `Dockerfile`
  - `backend/requirements.txt`
  - `pyproject.toml`
  - `backend/open_webui/utils/access_control/__init__.py`
  - `backend/open_webui/utils/misc.py`
- Why unavoidable:
  - The boot failures were in the upstream build/runtime path used by production.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Keep the dependency fix to a single version bump.
  - Keep build hardening to fail-fast checks only.
  - Reuse the existing additive Airis `safe_get` helper and re-export it via the upstream module contract.
  - Add only the missing `UserModel` import required by the merged runtime annotation.

## Verification

Docker Compose-first commands (adjust if needed):

- Backend tests: not run
- Backend lint (ruff): not run
- Frontend tests: not run
- Frontend typecheck: not run
- Frontend lint: not run
- E2E (when relevant): not run
- Additional operational verification:
  - `cd backend && uv pip install --system -r requirements.txt --dry-run`
  - `git diff --check`
  - `scripts/deploy_target.sh --target prod --yes --non-interactive` (build/push stage; remote `git pull` still fails)
  - Manual prod rollout via `docker compose -f docker-compose.yaml -f docker-compose.prod.yml pull && ... up -d`
  - Prod `docker inspect airis --format "{{json .State.Health}}"`
  - Prod `curl -fsS http://localhost:3000/health`

## Task Entry (for branch_updates/current_tasks)

Use this snippet in `meta/memory_bank/branch_updates/<YYYY-MM-DD>-<branch-slug>.md` and later in `meta/memory_bank/current_tasks.md`:

- [x] **[BUG][DEPLOY][PROD]** Restore prod boot after upstream sync deploy
  - Spec: `meta/memory_bank/specs/work_items/2026-03-11__bugfix__prod-deploy-runtime-import-hotfix.md`
  - Owner: Codex
  - Branch: `airis_b2c`
  - Done: 2026-03-11
  - Summary: Fixed broken prod image build (`ddgs` pin + fail-fast Docker install) and two runtime import regressions so the freshly deployed container on prod reaches `healthy`.
  - Tests: `cd backend && uv pip install --system -r requirements.txt --dry-run`, `git diff --check`, prod `docker inspect airis --format "{{json .State.Health}}"`, prod `curl -fsS http://localhost:3000/health`
  - Risks: Medium (upstream-owned runtime/build path); minimized by narrow fixes and live prod verification.

## Risks / Rollback

- Risks:
  - The deploy script remains partially broken until the prod git remote is fixed.
  - `uv.lock` still has broader stale drift and was intentionally not refreshed to avoid unrelated package churn.
- Rollback plan:
  - Re-deploy the previous known-good image tag on prod with the same manual `docker compose pull/up` flow.

## Completion Checklist

- [x] If SDD spec is linked: `meta/tools/sdd check-complete <spec_id> --json`
- [x] If SDD spec is linked: `meta/tools/sdd complete-spec <spec_id> --json`
- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)
