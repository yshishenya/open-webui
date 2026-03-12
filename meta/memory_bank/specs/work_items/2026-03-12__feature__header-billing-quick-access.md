# Header billing quick access (balance + top-up in app headers)

## Meta

- Type: feature
- Status: done
- Owner: Codex
- Branch: feature/header-billing-quick-access
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-03-12
- Updated: 2026-03-12

## Context

The wallet page itself is already much clearer than before, but the user still has to intentionally go looking
for it. That makes top-up a second-step action instead of a first-step recovery path, especially from chat.

The requested improvement is to surface two things directly in the app header:

- the current balance
- a clear top-up / payment CTA

This should reduce time-to-payment, make billing state visible without opening the user menu, and preserve
the existing return-to-chat flow when the user starts from a chat route.

Related work:

- Wallet UX v2 plan: `meta/memory_bank/specs/work_items/2026-02-05__feature__billing-wallet-ux-v2.md`
- Wallet page rebuild: `meta/memory_bank/specs/work_items/2026-02-06__feature__billing-balance-page-rebuild.md`

## Goal / Acceptance Criteria

- [x] Key app headers show a compact balance summary and a dedicated top-up CTA.
- [x] Desktop layout is explicit and readable; mobile layout remains compact and does not crowd primary actions.
- [x] Clicking the balance opens the wallet hub; clicking the CTA opens the wallet focused on top-up.
- [x] When opened from chat, the quick access preserves the existing `return_to=/c/<id>` recovery path.
- [x] Low-balance states are visually clearer without becoming noisy when balance is healthy.
- [x] If balance loading fails, the top-up CTA still remains usable.

## Non-goals

- Changing billing business rules, pricing, or YooKassa behavior.
- Reworking the entire billing page again.
- Adding new dependencies.

## Scope (what changes)

- Backend:
  - None.
- Frontend:
  - Add a reusable Airis-owned header component for wallet quick access.
  - Reuse existing billing helpers to build safe wallet/top-up links.
  - Embed the component into the main logged-in app headers.
  - Add targeted frontend tests for the new component.
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

- Keep the visual hierarchy simple:
  - balance is informative
  - top-up CTA is the primary action
- Reuse `/billing/balance` as the single payment hub rather than creating a separate payment modal.
- Preserve `return_to` only for validated chat routes, consistent with existing billing safety rules.
- Prefer additive Airis-owned files and minimal hook-style edits in upstream-owned header files.
- Shipped as a split control:
  - left segment = current available balance / wallet entry point
  - right segment = explicit top-up CTA with stronger contrast
- Added lightweight client refresh on focus/visibility so the header balance does not remain stale for long sessions.

## Upstream impact

If this work touches upstream-owned files, list them here and explain why (and how the diff is minimized):

- Upstream-owned files touched:
  - `src/lib/components/chat/Navbar.svelte`
  - `src/lib/components/channel/Navbar.svelte`
  - `src/routes/(app)/notes/+page.svelte`
  - `src/routes/(app)/workspace/+layout.svelte`
  - `src/routes/(app)/billing/+layout.svelte`
- Why unavoidable:
  - The feature is explicitly about app-header placement, so those header entrypoints must render the new component.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Add a single reusable component under `src/lib/components/airis/` and wire it into each header with minimal
    layout-only diffs.

## Verification

Docker Compose-first commands (adjust if needed):

- Frontend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run src/lib/components/airis/HeaderBillingAccess.test.ts"` ✅
- Frontend typecheck: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run check"` ⚠️ fails due pre-existing repo-wide `svelte-check` errors outside this task
- Frontend lint: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npx eslint src/lib/components/airis/HeaderBillingAccess.svelte src/lib/components/airis/HeaderBillingAccess.test.ts"` ✅
- Diff hygiene: `git diff --check` ✅

## Task Entry (for branch_updates/current_tasks)

Use this snippet in `meta/memory_bank/branch_updates/<YYYY-MM-DD>-<branch-slug>.md` and later in `meta/memory_bank/current_tasks.md`:

- [x] **[UI][BILLING]** Header quick access for balance and top-up
  - Spec: `meta/memory_bank/specs/work_items/2026-03-12__feature__header-billing-quick-access.md`
  - Owner: Codex
  - Branch: `feature/header-billing-quick-access`
  - Done: 2026-03-12
  - Summary: Added a reusable split header control that surfaces current balance and a focused top-up CTA across the main logged-in app headers while preserving safe chat return links.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run src/lib/components/airis/HeaderBillingAccess.test.ts"`; `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npx eslint src/lib/components/airis/HeaderBillingAccess.svelte src/lib/components/airis/HeaderBillingAccess.test.ts"`; `git diff --check`; `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run check"` (fails due pre-existing repo-wide `svelte-check` errors outside this work item)
  - Risks: Medium (touches shared navigation on desktop/mobile)

## Risks / Rollback

- Risks:
  - Header crowding on smaller viewports.
  - Stale balance presentation if the refresh behavior is too passive.
- Rollback plan:
  - Remove the header quick access component mounts and keep the existing billing access via user menu/sidebar.

## Completion Checklist

- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)
