### Done

- [x] **[BUG][UI][BILLING]** Fix non-working history filters in billing timeline
  - Spec: `meta/memory_bank/specs/work_items/2026-02-11__bugfix__billing-history-filters-not-working.md`
  - Owner: Codex
  - Branch: `codex/bugfix/billing-history-filters-not-working`
  - Done: 2026-02-11
  - Summary: Fixed billing history filter reactivity and added race-safe URL sync so stale URL updates cannot override the latest quick filter selection; added regression tests.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/vitest ]; then npm ci --legacy-peer-deps; fi; npm run test:frontend -- --run src/lib/components/billing/UnifiedTimeline.test.ts"`, `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/eslint ]; then npm ci --legacy-peer-deps; fi; npx eslint src/lib/components/billing/UnifiedTimeline.svelte src/lib/components/billing/UnifiedTimeline.test.ts"`
  - Risks: Low (frontend-only, localized timeline logic)
