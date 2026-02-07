# Refactor: Minimize upstream conflict surface (auths/main bootstrap hooks)

## Meta

- Type: refactor
- Status: active
- Owner: Codex
- Branch: codex/refactor/minimize-upstream-conflicts-auth-bootstrap
- SDD Spec (JSON, required for non-trivial): meta/sdd/specs/pending/minimize-upstream-conflicts-auth-bootstrap-2026-02-07-001.json
- Created: 2026-02-07
- Updated: 2026-02-07

## Context

Airis is a fork of upstream Open WebUI. We periodically sync from upstream, so we must keep our fork diff small and conflict-resistant.

Right now, two upstream-owned files carry large Airis-specific diffs:

- `backend/open_webui/routers/auths.py` (+949/-10 vs `upstream/main`) due to Telegram auth + email verification/password reset endpoints.
- `backend/open_webui/main.py` (+94/-4 vs `upstream/main`) due to Airis-only router registration and `/api/config` payload extensions.

This increases merge-conflict risk on upstream sync and makes upstream updates more expensive.

## Goal / Acceptance Criteria

- [ ] **No behavior change** (API surface + contracts):
  - [ ] Telegram auth endpoints remain available under `/api/v1/auths/telegram/*` with the same request/response behavior.
  - [ ] Email verification + password reset endpoints remain available under the same `/api/v1/auths/*` paths.
  - [ ] `/api/config` response remains backward compatible for Airis UI (telegram section, billing feature flags, VK/Telegram oauth provider metadata).
- [ ] **Reduce upstream conflict surface**:
  - [ ] `backend/open_webui/routers/auths.py` becomes a thin hook (remove large Airis blocks; include Airis routers instead).
  - [ ] `backend/open_webui/main.py` becomes a thin hook (Airis-only router includes + config extensions moved into a fork-owned bootstrap helper).
- [ ] **Verification**:
  - [ ] Backend tests covering auth/telegram/password-reset/config pass.
  - [ ] Diff reduction is measurable: `git diff --numstat upstream/main...HEAD backend/open_webui/routers/auths.py backend/open_webui/main.py` shows materially smaller deltas.

## Non-goals

- Introduce new auth or billing features.
- Change data model / migrations (this is a refactor only).
- Change UI behavior beyond what is required to keep existing UI working.

## Scope (what changes)

- Backend:
  - Add Airis routers:
    - `backend/open_webui/routers/airis/telegram_auth.py`
    - `backend/open_webui/routers/airis/password_reset.py`
  - Update upstream-owned `backend/open_webui/routers/auths.py` to include the Airis routers (thin hook).
  - Add Airis bootstrap helper:
    - `backend/open_webui/utils/airis/app_bootstrap.py`
  - Update upstream-owned `backend/open_webui/main.py` to call Airis bootstrap + config extender (thin hook).
- Frontend:
  - No expected changes (should remain compatible). Any required changes must be minimal and confined to Airis-owned helpers (`src/lib/utils/airis/*`).
- Config/Env:
  - No new env vars; reuse existing Airis config.
- Data model / migrations:
  - None.

## Implementation Notes

- Prefer **additive** changes:
  - New routers under `backend/open_webui/routers/airis/`.
  - New bootstrap helper under `backend/open_webui/utils/airis/`.
- Keep upstream diffs minimal:
  - `auths.py`: replace large blocks with `router.include_router(...)`.
  - `main.py`: keep upstream router import list + includes as-is; call `bootstrap_airis(app)` once for Airis-only routers; call `extend_airis_app_config(payload, request)` once for `/api/config`.
- Avoid import cycles:
  - Bootstrap should import routers inside the bootstrap function (lazy imports) when needed.

## Upstream impact

- Upstream-owned files touched:
  - `backend/open_webui/routers/auths.py`
  - `backend/open_webui/main.py`
- Why unavoidable:
  - We must mount Airis endpoints and extend `/api/config` in the running app.
- Minimization strategy:
  - Move all Airis-owned logic into fork-owned modules.
  - Keep upstream-owned files to **thin hooks** only (single import + single call / include).

## Verification

Docker Compose-first commands (adjust if needed):

- Backend tests (targeted):
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm -e DATABASE_URL= airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_auths.py open_webui/test/util/test_telegram_auth.py"`
- Backend tests (full):
  - `npm run docker:test:backend`
- Backend lint (ruff):
  - `npm run docker:lint:backend`

## Task Entry (for branch_updates/current_tasks)

- [ ] **[REFACTOR][UPSTREAM]** Minimize upstream conflict surface (auths/main bootstrap hooks)
  - Spec: `meta/memory_bank/specs/work_items/2026-02-07__refactor__minimize-upstream-conflicts-auth-bootstrap.md`
  - Owner: Codex
  - Branch: `codex/refactor/minimize-upstream-conflicts-auth-bootstrap`
  - Started: 2026-02-07
  - Summary: Extract Airis auth endpoints + app bootstrap into fork-owned modules; keep upstream files as thin hooks to reduce merge conflicts.
  - Tests: TBD
  - Risks: Medium (auth routes + config payload)

## Risks / Rollback

- Risks:
  - Route regressions (wrong prefix/path), import cycles, subtle `/api/config` shape drift.
- Rollback plan:
  - Revert this refactor branch (no DB schema changes; rollback is a code revert + redeploy).
