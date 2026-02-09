# Auth: Fix Provider Icon Aspect Ratio on /auth

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: bugfix/auth-provider-icons-object-fit
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-09
- Updated: 2026-02-09

## Context

Provider icons on `/auth` are rendered as fixed-size `<img>` elements. Without `object-fit`, non-square assets can be slightly distorted on some browsers.

## Goal / Acceptance Criteria

- [ ] Provider icons on `/auth` keep their original aspect ratio (no stretching).
- [ ] Change is minimal and does not affect provider button behavior.

## Non-goals

- Replacing the icon assets.
- Any layout redesign of `/auth`.

## Scope (what changes)

- Frontend:
  - Add `object-contain` to provider icon `<img>` elements in `/auth`.

## Upstream impact

- Upstream-owned files touched:
  - `src/routes/auth/+page.svelte`
- Why unavoidable:
  - This is where the provider icon row is rendered.
- Minimization strategy:
  - Single-class change (`object-contain`) scoped only to the three provider icons.

## Verification

- Frontend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run"`

## Task Entry (for branch_updates/current_tasks)

- [ ] **[BUG][AUTH]** Fix provider icon aspect ratio on `/auth`
  - Spec: `meta/memory_bank/specs/work_items/2026-02-09__bugfix__auth-provider-icon-aspect-ratio.md`
  - Owner: Codex
  - Branch: `bugfix/auth-provider-icons-object-fit`
  - Started: 2026-02-09
  - Summary: Ensure Telegram/VK/GitHub icons render without stretching by using `object-contain`.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run"`
  - Risks: Low (CSS-only).
