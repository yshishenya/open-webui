# CI: Run Full Backend Tests on `airis_b2c` PR/Push

## Meta

- Type: refactor
- Status: done
- Owner: Codex
- Branch: `codex/ci/airis-b2c-backend-full-tests`
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-15
- Updated: 2026-02-15

## Context

Today `airis_b2c` is gated primarily by Billing Confidence. This is great for billing safety, but it does not run
the full backend test suite, so regressions in non-billing routers/models can slip through until manual checks.

We already saw how API contract drift (tests vs implementation) can happen; adding a fast full-backend pytest run on
PR/push improves launch confidence with minimal CI cost.

## Goal / Acceptance Criteria

- [x] On PRs to `airis_b2c`, run full backend `pytest` in Docker Compose (same as local standard command).
- [x] On pushes to `airis_b2c` (post-merge), run the same backend suite.
- [x] Upload JUnit artifact for triage on failures.
- [x] Keep triggers path-scoped to backend/compose/CI-related changes to avoid unnecessary runs.

## Non-goals

- Enabling backend lint (ruff) as a gate (there is an existing backlog and the workflow is currently disabled).
- Running the full frontend build/test matrix on `airis_b2c` (handled separately; billing-confidence already covers critical frontend/e2e for billing).

## Scope (what changes)

- CI:
  - Add a GitHub Actions workflow that runs `docker compose ... pytest` on PR/push to `airis_b2c`.
  - Produce `backend/artifacts/backend-tests/<run-id>/pytest.xml` and upload it as an artifact.
- Docs:
  - Work item spec + branch update entry (this file).

## Implementation Notes

- Use Docker Compose-first command (mirrors local guidance):
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest ..."`
- Pass `WEBUI_AUTH` and `WEBUI_SECRET_KEY` explicitly to keep test startup deterministic in CI.
- Write artifacts under `backend/artifacts/...` because the dev overlay mounts only `./backend` into the container.

## Upstream impact

- Fork-owned CI only (`.github/workflows/*`) + Memory Bank spec. No upstream runtime logic changes.

## Verification

- Local: `npm run docker:test:backend`
- CI: GitHub Actions on PR to `airis_b2c` should show a new workflow run with JUnit artifact uploaded.

## Task Entry (for branch_updates/current_tasks)

- [x] **[REFACTOR][CI]** Add full backend pytest gate for `airis_b2c`
  - Spec: `meta/memory_bank/specs/work_items/2026-02-15__refactor__ci-airis-b2c-backend-full-tests.md`
  - Owner: Codex
  - Branch: `airis_b2c`
  - Done: 2026-02-15
  - Summary: Run full backend pytest on PR/push to `airis_b2c` and upload JUnit artifacts for triage.
  - Tests: `npm run docker:test:backend`
  - Risks: Low (CI-only)

## Risks / Rollback

- Risks:
  - Longer CI time on `airis_b2c` PRs/pushes (expected ~1–3 minutes for the current backend suite).
- Rollback plan:
  - Revert the workflow file to disable the job.
