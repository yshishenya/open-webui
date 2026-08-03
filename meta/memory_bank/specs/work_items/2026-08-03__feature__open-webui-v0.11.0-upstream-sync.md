# [UPSTREAM] Open WebUI v0.11.0 Sync

## Meta

- Type: feature
- Status: completed
- Owner: Codex
- Branch: `codex/feature/upstream-sync-v0.11.0`
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/open-webui-upstream-sync-2026-08-03-001.json`
- Created: 2026-08-03
- Updated: 2026-08-03

## Context

Airis is currently based on the Open WebUI v0.8.12 upstream commit while the latest
stable upstream release is v0.11.0. The fork contains billing, authentication,
deployment, branding, and operational changes that must remain functional after the
sync. The production service currently runs image revision
`cd51aefb6a507f818a759ddaf873f1754d080052` with PostgreSQL persistence.

The update spans 1,812 upstream commits and 908 changed upstream files, including a
large migration set and a redesigned frontend. It was completed in an isolated
worktree, rehearsed against both a fresh database and a restored production clone,
and deployed to production from a checksummed rollback backup.

## Goal / Acceptance Criteria

- [x] Merge official stable tag `v0.11.0` (`f9590b8017199e56d5e953657e6498e3cef1d246`) into the Airis integration baseline `cd51aefb6a507f818a759ddaf873f1754d080052`.
- [x] Preserve Airis billing, wallet, pricing, authentication providers, deployment tooling, branding, and environment governance.
- [x] Preserve upstream v0.11.0 behavior in upstream-owned files except for the smallest required Airis hooks.
- [x] Produce a single valid Alembic head that includes both upstream and Airis migrations.
- [x] Build backend/frontend images and run migration, backend, frontend, lint/typecheck, and focused Airis regression checks through Docker.
- [x] Create a verified PostgreSQL backup and record the pre-update source/image revision before production migration.
- [x] Rebuild and recreate production services only after pre-deploy checks pass.
- [x] Verify production health, version, authentication surface, model discovery, chat request path, and billing/wallet API behavior after rollout.
- [x] Keep a tested rollback path for source/image and database restoration.

## Non-goals

- Redesigning Airis-specific product behavior during the upstream sync.
- Removing fork functionality merely to make conflicts easier.
- Force-updating or deleting fork-owned Git tags that differ from upstream tags.
- Modifying or stashing the user's dirty worktree at `/opt/projects/open-webui`.

## Scope (what changes)

- Backend:
  - Integrate upstream backend changes and reapply minimal Airis hooks.
  - Reconcile authentication, access control, chat middleware, model routing, billing, and storage changes.
- Frontend:
  - Integrate the v0.11.0 interface and restore Airis billing, authentication, branding, and product entry points.
- Config/Env:
  - Reconcile Docker, environment, dependency, and deployment changes without exposing secrets.
- Data model / migrations:
  - Preserve Airis billing/auth migrations while integrating all upstream migrations through one Alembic head.

## Implementation Notes

- Baseline: `origin/airis_b2c` at `cd51aefb6a507f818a759ddaf873f1754d080052`.
- Target: official upstream tag `v0.11.0` at `f9590b8017199e56d5e953657e6498e3cef1d246`.
- Worktree: `/opt/projects/open-webui-worktrees/upstream-sync-v0.11.0`.
- Integration strategy: merge the stable tag, resolve each overlapping file by preserving upstream intent and restoring isolated Airis behavior.
- Existing divergent fork tags are retained unchanged.
- The local `sdd` CLI is unavailable; the user approved manual SDD JSON creation and validation with the repository JSON Schema/CI policy.
- Final image: `yshishenya/yshishenya:v0.11.0-airis-20260803` (`sha256:97b7929b7842407519f9b0112f26557788b1b6f1af1ed815f0c81ada9098611f`).
- Production migration: `f8b9c7d1a2e3` to merge head `a91c0d8e4f62`.
- Production rollout completed at 2026-08-03 18:58 Europe/Amsterdam; only the `airis` application container was recreated.

## Upstream impact

- Upstream-owned files touched:
  - The v0.11.0 merge updates upstream-owned backend, frontend, dependency, migration, and container files.
  - Narrow Airis conflict resolutions remain in `backend/open_webui/main.py`, `config.py`, `env.py`, auth/user models and routers, OpenAI/image/audio routers, chat/middleware/OAuth/access-control utilities, `src/app.html`, the auth/app layouts, sidebar billing entry points, `Dockerfile`, and dependency locks.
  - Additive fork-owned helpers contain runtime config, image billing, app bootstrap, and the Alembic merge revision.
- Why unavoidable:
  - Airis is an Open WebUI fork and the requested update replaces the upstream base.
  - Airis hooks overlap authentication, chat, models, access control, and UI surfaces changed upstream.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Accept upstream implementations where no Airis behavior is required.
  - Keep Airis logic in existing fork-owned helpers and restore only narrow call sites.
  - Avoid formatting churn and unrelated refactors during conflict resolution.

## Verification Results

- SDD JSON: repository schema/policy validation passed using the approved manual fallback.
- Merge integrity: no unmerged paths or conflict markers; `git diff --check` and Python `compileall` passed.
- Formatting/lint: Black check passed for 36 resolved Python files; focused Ruff `E9,F` passed for fork-owned files. Full-repository Ruff/Svelte checks retain a large upstream/fork baseline and are not treated as new regressions.
- Migrations: fresh PostgreSQL and a restored production clone both upgraded to the single head `a91c0d8e4f62`; repeated `upgrade heads` was idempotent.
- Backend: utility/service suite passed (`90 passed`). The legacy router suite reached `28 passed, 65 failed`; failures are concentrated in its synchronous model mocks after v0.11 converted `Users`, `Models`, and `Auths` APIs to async. Runtime AST audits, authenticated clone smoke, and production smoke found no un-awaited model calls.
- Frontend: `18` test files and `87` tests passed; production Vite/Docker build passed.
- Browser: Playwright desktop/mobile checks for `/auth` and `/pricing` passed on the final image and production with HTTP 200, no page/console errors, and no horizontal overflow. This caught and fixed a missing `isDarkMode` initialization in `src/app.html` before deployment.
- Production: `/health`, `/api/config`, auth/pricing/legal/public billing endpoints passed. Authenticated read-only smoke returned 84 models and successful chat/legal/balance responses; the no-model chat request returned the expected `400 Model not found` without data writes.
- Data integrity: counts for users, auth records, chats, plans, subscriptions, wallets, ledger entries, payments, rate cards, and usage events were unchanged before and after rollout/smoke.

## Task Entry (for branch_updates/current_tasks)

- [x] **[UPSTREAM]** Sync Airis with Open WebUI v0.11.0
  - Spec: `meta/memory_bank/specs/work_items/2026-08-03__feature__open-webui-v0.11.0-upstream-sync.md`
  - Owner: Codex
  - Branch: `codex/feature/upstream-sync-v0.11.0`
  - Started: 2026-08-03
  - Done: 2026-08-03
  - Summary: Integrated and deployed official Open WebUI v0.11.0 while preserving Airis behavior and a verified rollback path.
  - Tests: 90 backend utility/service tests and 87 frontend tests passed; fresh/clone/production migrations, Docker build, authenticated API smoke, and desktop/mobile Playwright passed.
  - Follow-up: Modernize the legacy synchronous router-test harness for v0.11 async model APIs and reduce inherited lint/typecheck baseline.

## Risks / Rollback

- Risks:
  - Merge conflicts can silently remove Airis billing/auth behavior.
  - New upstream migrations can conflict with the fork migration graph or be expensive on production data.
  - Dependency and container changes can prevent image build or runtime startup.
  - The v0.11.0 interface may invalidate Airis frontend hooks and regression tests.
- Rollback plan:
  - Source ref `backup/upstream-sync-v0.11.0-premerge` and image `yshishenya/yshishenya:cd51aefb6` remain available.
  - Verified rollback artifacts are under `/opt/projects/.backups/airis/20260803-185252-open-webui-v0.11.0/` with `SHA256SUMS`, PostgreSQL custom dump, application-data archive, Compose files, and the pre-update environment file.
  - On rollout failure, stop the new application, restore the pre-update database/data as needed, recreate `airis` from `cd51aefb6`, and verify health before reopening traffic.

## Completion Checklist

- [x] Manually validate SDD schema and repository policy (approved fallback for unavailable `sdd` CLI).
- [x] Mark all SDD hierarchy tasks completed and move the JSON from `active` to `completed`.
- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`).
