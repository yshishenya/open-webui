# [BUG][UI][BILLING] Keep zero-balance amount visible in header chip

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: bugfix/header-billing-zero-balance-visibility
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-03-12
- Updated: 2026-03-12

## Context

The header billing chip now renders as a compact single pill. In dense navbar layouts, especially for regular users in chat routes, the amount label can shrink away completely because the amount node is configured as a fully shrinkable flex item. This makes zero balance look "empty" even though the wallet exists and the backend still returns `0`.

## Goal / Acceptance Criteria

- [x] A regular user with zero balance sees an explicit amount in the header chip
- [x] The chip remains compact and aligned with adjacent navbar controls
- [x] Existing wallet/top-up links and error fallback behavior stay intact
- [x] A regression test covers zero-balance rendering

## Non-goals

- Reworking billing permissions or wallet backend behavior
- Changing billing page logic outside the header chip

## Scope (what changes)

- Backend:
  - None
- Frontend:
  - Adjust `HeaderBillingAccess` amount sizing so it cannot collapse to zero width
  - Add a regression test for zero-balance rendering
- Config/Env:
  - None
- Data model / migrations:
  - None

## Implementation Notes

- Key files/entrypoints:
  - `src/lib/components/airis/HeaderBillingAccess.svelte`
  - `src/lib/components/airis/HeaderBillingAccess.test.ts`
- API changes:
  - None
- Edge cases:
  - Zero balance
  - Large balances that still need truncation if space is limited
  - Existing `--` fallback after load failure

## Upstream impact

- Upstream-owned files touched:
  - `src/lib/components/airis/HeaderBillingAccess.svelte`
- Why unavoidable:
  - The visibility bug is in the concrete flex sizing of the shared header billing component
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Keep the diff limited to amount sizing/title behavior and a narrow component-level regression test

## Verification

Docker Compose-first commands (adjust if needed):

- Frontend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/vitest ]; then npm ci --legacy-peer-deps; fi; npm run test:frontend -- --run src/lib/components/airis/HeaderBillingAccess.test.ts"` ✅
- Frontend lint: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/eslint ]; then npm ci --legacy-peer-deps; fi; npx eslint src/lib/components/airis/HeaderBillingAccess.svelte src/lib/components/airis/HeaderBillingAccess.test.ts"` ✅
- Diff hygiene: `git diff --check -- src/lib/components/airis/HeaderBillingAccess.svelte src/lib/components/airis/HeaderBillingAccess.test.ts meta/memory_bank/specs/work_items/2026-03-12__bugfix__header-billing-zero-balance-visibility.md meta/memory_bank/branch_updates/2026-03-12-bugfix-header-billing-zero-balance-visibility.md` ✅
- Demo preview build: `docker build -t airis:header-billing-zero-balance .`
- Demo preview deploy:
  - local `WEBUI_IMAGE=airis WEBUI_DOCKER_TAG=header-billing-zero-balance docker compose -f docker-compose.yaml -f docker-compose.prod.yml up -d --remove-orphans --no-build --force-recreate`
  - local `docker inspect airis` => `image=airis:header-billing-zero-balance health=healthy restarts=0`
  - local `curl -sS http://localhost:3000/health` => `{"status":true}`
  - external `curl -sS https://dev.chat.airis.you/health` => `{"status":true}`

## Task Entry (for branch_updates/current_tasks)

- [x] **[BUG][UI][BILLING]** Keep zero-balance amount visible in header chip
  - Spec: `meta/memory_bank/specs/work_items/2026-03-12__bugfix__header-billing-zero-balance-visibility.md`
  - Owner: Codex
  - Branch: `bugfix/header-billing-zero-balance-visibility`
  - Done: 2026-03-12
  - Summary: Prevent the compact header wallet amount from collapsing away in dense navbars so ordinary users still see `0` instead of an empty chip.
  - Tests: Targeted vitest + eslint for `HeaderBillingAccess`; `git diff --check`; demo preview deploy + internal/public health checks
  - Risks: Low (small shared header UI tweak)

## Risks / Rollback

- Risks:
  - The chip could become slightly wider in very narrow headers
- Rollback plan:
  - Revert the component sizing change and its regression test

## Completion Checklist

- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)
