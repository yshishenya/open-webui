### Done

- [x] **[BUG][UI][BILLING]** Fix non-working history filters in billing timeline
  - Spec: `meta/memory_bank/specs/work_items/2026-02-11__bugfix__billing-history-filters-not-working.md`
  - Owner: Codex
  - Branch: `codex/bugfix/billing-history-filters-not-working`
  - Done: 2026-02-11
  - Summary: Fixed billing history filter reactivity and added race-safe URL sync so stale URL updates cannot override the latest quick filter selection; added regression tests.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/vitest ]; then npm ci --legacy-peer-deps; fi; npm run test:frontend -- --run src/lib/components/billing/UnifiedTimeline.test.ts"`, `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/eslint ]; then npm ci --legacy-peer-deps; fi; npx eslint src/lib/components/billing/UnifiedTimeline.svelte src/lib/components/billing/UnifiedTimeline.test.ts"`
  - Risks: Low (frontend-only, localized timeline logic)

- [x] **[DOCS][PROCESS]** Enforce integration branch policy (`airis_b2c`, no direct work to `main`)
  - Spec: `meta/memory_bank/specs/work_items/2026-02-11__docs__integration-branch-policy-airis-b2c.md`
  - Owner: Codex
  - Branch: `codex/bugfix/billing-history-filters-not-working`
  - Done: 2026-02-11
  - Summary: Unified AGENTS and Memory Bank branch rules so daily work targets `airis_b2c`, and direct feature/bugfix/refactor/docs PRs to `main` are explicitly disallowed. `current_tasks.md` wording is intentionally left for consolidation on `airis_b2c`.
  - Tests: N/A (docs-only)
  - Risks: Low (process docs alignment only)
