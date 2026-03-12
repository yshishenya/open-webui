# [BUG][UI][BILLING] Unify header billing chip height with adjacent navbar controls

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: airis_b2c
- Created: 2026-03-12
- Updated: 2026-03-12
- Related:
  - `meta/memory_bank/specs/work_items/2026-03-12__bugfix__header-billing-access-laconic-copy.md`
  - `meta/memory_bank/specs/work_items/2026-03-12__feature__header-billing-quick-access.md`

## Context

After shipping the laconic wallet chip, the control still felt visually heavier than adjacent navbar buttons because it kept a taller pill and a second circular `+` button. The requested refinement was to make the control match neighboring button height, remove the second circle, and keep the `+` inside the same outline as the amount.

User request:

- make the billing chip smaller and the same height as neighboring header buttons
- remove the separate second circle
- keep the `+` inside the same contour as the amount
- keep the result simpler and less overloaded

## Goal

- Match the visual height of adjacent navbar actions
- Reduce visual weight without removing the top-up affordance
- Preserve separate wallet and top-up links with safe `return_to` behavior

## Scope

- `src/lib/components/airis/HeaderBillingAccess.svelte`
- `src/lib/components/airis/HeaderBillingAccess.test.ts`

## Implementation

- Reworked the shell into a single `rounded-xl` pill with fixed `34px` height
- Removed the separate filled circular `+` button
- Moved the `+` action into the same outlined shell, separated by a thin divider
- Simplified the left side further by removing the inner circular card badge and keeping a compact card icon + amount
- Added a regression assertion for the unified shell shape and the absence of the old circular top-up button

## Verification

- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/vitest ]; then npm ci --legacy-peer-deps; fi; npm run test:frontend -- --run src/lib/components/airis/HeaderBillingAccess.test.ts"` ✅
- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/eslint ]; then npm ci --legacy-peer-deps; fi; npx eslint src/lib/components/airis/HeaderBillingAccess.svelte src/lib/components/airis/HeaderBillingAccess.test.ts"` ✅
- `git diff --check -- src/lib/components/airis/HeaderBillingAccess.svelte src/lib/components/airis/HeaderBillingAccess.test.ts` ✅
- Demo preview build:
  - `docker build -t airis:header-billing-height-unify .`
- Demo preview deploy:
  - local `WEBUI_IMAGE=airis WEBUI_DOCKER_TAG=header-billing-height-unify docker compose -f docker-compose.yaml -f docker-compose.prod.yml up -d --remove-orphans --no-build --force-recreate`
  - local `docker inspect airis` => `image=airis:header-billing-height-unify health=healthy restarts=0`
  - local `curl -sS http://localhost:3000/health` => `{"status":true}`
  - external `curl -sS https://dev.chat.airis.you/health` => `{"status":true}`
- Prod deploy:
  - local `docker build -t yshishenya/yshishenya:47ff7292a-header-billing-height-unify .`
  - `docker push yshishenya/yshishenya:47ff7292a-header-billing-height-unify`
  - push result: `47ff7292a-header-billing-height-unify: digest: sha256:5ad11097cc6c0f23951d8d3fa08b4ee3bba5909da1c0c5fac279799ca3cd2f63`
  - remote `WEBUI_IMAGE=yshishenya/yshishenya WEBUI_DOCKER_TAG=47ff7292a-header-billing-height-unify docker compose -f docker-compose.yaml -f docker-compose.prod.yml pull`
  - remote `WEBUI_IMAGE=yshishenya/yshishenya WEBUI_DOCKER_TAG=47ff7292a-header-billing-height-unify docker compose -f docker-compose.yaml -f docker-compose.prod.yml up -d --remove-orphans --no-build --force-recreate`
  - remote `docker inspect airis` => `image=yshishenya/yshishenya:47ff7292a-header-billing-height-unify health=healthy restarts=0`
  - remote `curl -sS http://localhost:3000/health` => `{"status":true}`
  - external `curl -sS https://chat.airis.you/health` => `{"status":true}`

## Notes

Prod rollout briefly returned external `502` responses while the new container was still in `health=starting`; the service recovered to `healthy` without manual intervention once startup completed.
