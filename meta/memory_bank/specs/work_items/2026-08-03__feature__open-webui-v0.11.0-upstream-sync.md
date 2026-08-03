# [UPSTREAM] Open WebUI v0.11.0 Sync

## Meta

- Type: feature
- Status: active
- Owner: Codex
- Branch: `codex/feature/upstream-sync-v0.11.0`
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/active/open-webui-upstream-sync-2026-08-03-001.json`
- Created: 2026-08-03
- Updated: 2026-08-03

## Context

Airis is currently based on the Open WebUI v0.8.12 upstream commit while the latest
stable upstream release is v0.11.0. The fork contains billing, authentication,
deployment, branding, and operational changes that must remain functional after the
sync. The production service currently runs image revision
`cd51aefb6a507f818a759ddaf873f1754d080052` with PostgreSQL persistence.

The update spans 1,812 upstream commits and 908 changed upstream files, including a
large migration set and a redesigned frontend. It therefore requires an isolated
merge, focused conflict resolution, Docker verification, a database backup, and a
controlled production rollout.

## Goal / Acceptance Criteria

- [ ] Merge official stable tag `v0.11.0` (`f9590b8017199e56d5e953657e6498e3cef1d246`) into the Airis integration baseline `cd51aefb6a507f818a759ddaf873f1754d080052`.
- [ ] Preserve Airis billing, wallet, pricing, authentication providers, deployment tooling, branding, and environment governance.
- [ ] Preserve upstream v0.11.0 behavior in upstream-owned files except for the smallest required Airis hooks.
- [ ] Produce a single valid Alembic head that includes both upstream and Airis migrations.
- [ ] Build backend/frontend images and run migration, backend, frontend, lint/typecheck, and focused Airis regression checks through Docker Compose.
- [ ] Create a verified PostgreSQL backup and record the pre-update source/image revision before production migration.
- [ ] Rebuild and recreate production services only after pre-deploy checks pass.
- [ ] Verify production health, version, authentication surface, model discovery, chat request path, and billing/wallet API behavior after rollout.
- [ ] Keep a tested rollback path for source/image and database restoration.

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

## Upstream impact

- Upstream-owned files touched:
  - The v0.11.0 merge updates upstream-owned backend, frontend, dependency, migration, and container files.
  - The exact conflict-resolution list will be appended after the merge.
- Why unavoidable:
  - Airis is an Open WebUI fork and the requested update replaces the upstream base.
  - Airis hooks overlap authentication, chat, models, access control, and UI surfaces changed upstream.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Accept upstream implementations where no Airis behavior is required.
  - Keep Airis logic in existing fork-owned helpers and restore only narrow call sites.
  - Avoid formatting churn and unrelated refactors during conflict resolution.

## Verification

- SDD schema/policy: run the validation body from `.github/workflows/sdd-validate.yml` locally.
- Merge integrity: `git diff --check` and conflict-marker scan.
- Migration graph: Docker Alembic heads/history checks and upgrade against a disposable PostgreSQL copy.
- Backend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest"`.
- Backend lint: Docker ruff command from `AGENTS.md`.
- Frontend tests: Docker `npm run test:frontend`.
- Frontend checks: Docker `npm run check` and `npm run lint:frontend`.
- Production image build followed by health and focused authenticated smoke checks.

## Task Entry (for branch_updates/current_tasks)

- [ ] **[UPSTREAM]** Sync Airis with Open WebUI v0.11.0
  - Spec: `meta/memory_bank/specs/work_items/2026-08-03__feature__open-webui-v0.11.0-upstream-sync.md`
  - Owner: Codex
  - Branch: `codex/feature/upstream-sync-v0.11.0`
  - Started: 2026-08-03
  - Summary: Integrate official Open WebUI v0.11.0 while preserving Airis behavior, migrations, and production rollback safety.
  - Tests: Pending merge, Docker verification, migration rehearsal, and production smoke checks.
  - Risks: High; large upstream delta, migration graph changes, frontend redesign, and production data migration.

## Risks / Rollback

- Risks:
  - Merge conflicts can silently remove Airis billing/auth behavior.
  - New upstream migrations can conflict with the fork migration graph or be expensive on production data.
  - Dependency and container changes can prevent image build or runtime startup.
  - The v0.11.0 interface may invalidate Airis frontend hooks and regression tests.
- Rollback plan:
  - Keep the pre-sync branch revision and current production image digest available.
  - Create and checksum a PostgreSQL dump before any production migration.
  - On rollout failure, stop the new application, restore the pre-update image/source and database dump, then verify health before reopening traffic.

## Completion Checklist

- [ ] Manually validate SDD schema and repository policy (approved fallback for unavailable `sdd` CLI).
- [ ] Mark all SDD hierarchy tasks completed and move the JSON from `active` to `completed`.
- [ ] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`).
