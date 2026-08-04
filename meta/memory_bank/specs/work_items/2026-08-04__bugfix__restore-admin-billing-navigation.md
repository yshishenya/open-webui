# Restore Admin Billing Navigation

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/restore-admin-billing-navigation
- SDD Spec (JSON, required for non-trivial): N/A (scoped one-file navigation regression)
- Created: 2026-08-04
- Updated: 2026-08-04

## Context

After the v0.11.0 frontend rollout, the admin billing pages remained available by direct URL, but their links disappeared from the admin navigation. The deployed frontend was built from the upstream-sync hotfix tree, whose admin layout omitted Airis billing links that are present in the integration baseline. The same tree also omitted the guarded Analytics link.

## Goal / Acceptance Criteria

- [ ] Admin navigation exposes `Analytics` when `enable_admin_analytics` is enabled or unspecified.
- [ ] Admin navigation exposes `Billing Plans`, `Model Pricing`, and `Lead magnet`.
- [ ] Direct routes for model pricing and lead magnet still render for an admin.
- [ ] Existing authenticated chat loader behavior remains intact.
- [ ] No backend, database, dependency, or configuration changes are introduced.

## Non-goals

- Redesigning billing pages or changing billing permissions.
- Changing the admin settings modal or backend billing APIs.
- Rebuilding unrelated frontend components from the integration branch.

## Scope (what changes)

- Backend:
  - None.
- Frontend:
  - Restore the missing admin navigation anchors in `src/routes/(app)/admin/+layout.svelte`.
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `src/routes/(app)/admin/+layout.svelte`
  - `/admin/billing/plans`
  - `/admin/billing/models`
  - `/admin/billing/lead-magnet`
- API changes:
  - None.
- Edge cases:
  - Keep Analytics behind the existing `enable_admin_analytics` feature flag.
  - Preserve the current loader fix and the existing plugin guard for Functions.

## Upstream impact

If this work touches upstream-owned files, list them here and explain why (and how the diff is minimized):

- Upstream-owned files touched:
  - `src/routes/(app)/admin/+layout.svelte`
- Why unavoidable:
  - The navigation is rendered directly by the upstream admin layout and has no existing fork hook.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Add only the four missing anchors, retain existing feature gating, and preserve the current v0.11.0 layout structure without formatting churn.

## Verification

Docker Compose-first commands (adjust if needed):

- Frontend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/vitest ]; then npm ci --legacy-peer-deps; fi; npm run test:frontend"`
- Frontend typecheck: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run check"`
- Frontend lint: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run lint:frontend"`
- Production browser smoke: authenticated Playwright check of admin navigation and billing routes.

## Task Entry (for branch_updates/current_tasks)

- [ ] **[BUG]** Restore admin billing navigation
  - Spec: `meta/memory_bank/specs/work_items/2026-08-04__bugfix__restore-admin-billing-navigation.md`
  - Owner: Codex
  - Branch: `codex/bugfix/restore-admin-billing-navigation`
  - Started: 2026-08-04
  - Summary: Restore missing Analytics and Airis billing links in the v0.11.0 admin navigation while preserving the deployed loader fix.
  - Tests: Pending
  - Risks: Frontend-only admin layout change; rollback is an image tag switch.

## Risks / Rollback

- Risks:
  - A longer admin nav may require horizontal scrolling on narrow viewports; the existing overflow behavior is retained.
- Rollback plan:
  - Restore the previous production image `airis:chat-loader-v011-20260804` or the pre-hotfix image `yshishenya/yshishenya:v0.11.0-airis-20260803`.

## Completion Checklist

- [ ] Run focused and Docker Compose frontend verification.
- [ ] Build and deploy a tagged production image only after validation.
- [ ] Update this spec and its branch update entry to Done.
