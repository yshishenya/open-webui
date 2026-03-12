# [BUG][UI][BILLING] Simplify header billing access copy and density

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: airis_b2c
- Created: 2026-03-12
- Updated: 2026-03-12
- Related: `meta/memory_bank/specs/work_items/2026-03-12__feature__header-billing-quick-access.md`

## Context

The first shipped version of header billing quick access solved discoverability, but the split control became too busy in the header. The visible `Balance` label and explicit `Top up` text add noise next to the amount and user menu, especially in dense navbar layouts.

User request:

- remove visible `Top up` text and keep only a compact plus action, or remove unnecessary wording entirely
- remove visible `Balance` text
- make the control simpler, more laconic, and clearer

## Goal

- Keep wallet amount visible as the main signal
- Keep top-up affordance obvious without visible explanatory copy
- Reduce header width and visual noise
- Preserve existing wallet/top-up links and safe `return_to` behavior

## Scope

- `src/lib/components/airis/HeaderBillingAccess.svelte`
- `src/lib/components/airis/HeaderBillingAccess.test.ts`

## Implementation

- Removed the visible `Balance` / `Low balance` label row from the header chip
- Kept the left side as card icon + amount only
- Changed the right side to an icon-only circular `+` action with `aria-label`
- Tightened spacing and shape to reduce header crowding
- Replaced the verbose error fallback with a short placeholder (`--`)

## Verification

- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/vitest ]; then npm ci --legacy-peer-deps; fi; npm run test:frontend -- --run src/lib/components/airis/HeaderBillingAccess.test.ts"` ✅
- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/eslint ]; then npm ci --legacy-peer-deps; fi; npx eslint src/lib/components/airis/HeaderBillingAccess.svelte src/lib/components/airis/HeaderBillingAccess.test.ts"` ✅
- `git diff --check` ✅
- Clean release image built from `HEAD` + patched `src/lib/components/airis/HeaderBillingAccess.svelte` only:
  - image: `yshishenya/yshishenya:88138a18d-header-billing-lite`
  - digest: `sha256:fc531f9ec771c2b3bc73a5ccfa507f2f47fc96fbd7454cc95aca7eb81d98e8ad`
- Demo deployed on the current server:
  - `docker inspect airis` => `status=running health=healthy restarts=0 image=yshishenya/yshishenya:88138a18d-header-billing-lite`
  - `curl -sS http://localhost:3000/health` => `{"status":true}`
  - `curl -sS https://dev.chat.airis.you/health` => `{"status":true}`
- Prod deployed on `185.130.212.71`:
  - remote `docker inspect airis` => `status=running health=healthy restarts=0 image=yshishenya/yshishenya:88138a18d-header-billing-lite`
  - remote `curl -sS http://localhost:3000/health` => `{"status":true}`
  - `curl -sS https://chat.airis.you/health` => `{"status":true}`

## Notes

The local worktree contained unrelated uncommitted backend changes (`backend/open_webui/main.py` and its test).
To avoid deploying those to prod, the release image was built from clean `HEAD` in a temporary context and overlaid
only with the approved header billing component change.
