# Billing E2E disclosure expectations

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/fix-billing-e2e-disclosure
- SDD Spec (JSON, required for non-trivial): N/A (test-only compatibility fix)
- Created: 2026-08-08
- Updated: 2026-08-08

## Context

The wallet UX now keeps free-limit details collapsed by default. The billing confidence suite still expected the old expanded state, and the new regression test used a locator whose accessible name changes after disclosure.

## Goal / Acceptance Criteria

- [x] Update existing lead-magnet E2E tests to disclose limits before asserting metrics.
- [x] Use a stable disclosure locator across the state change.
- [x] Preserve coverage for collapsed initial state, keyboard disclosure, and visible metrics.

## Non-goals

- No production UI or billing behavior changes.
- No dependency or CI runner changes.

## Scope (what changes)

- Backend: none.
- Frontend: none.
- E2E: update billing wallet and lead-magnet assertions.
- Config/Env: none.

## Implementation Notes

- Use `button[aria-controls="free-limit-details"]` because its accessible label changes from `Limits` to `Hide limits` after activation.
- Seed the E2E storage state with denied analytics consent so first-run UI cannot intercept billing interactions.
- Existing summary tests now explicitly activate the disclosure before checking metric labels.

## Upstream impact

- Upstream-owned files touched: none.

## Verification

- `npx esbuild@0.25.0 e2e/billing_wallet_recovery.spec.ts e2e/billing_lead_magnet.spec.ts --bundle --platform=node --format=esm --external:@playwright/test --outdir=/tmp/billing-e2e-disclosure`
- `git diff --check`
- Billing confidence E2E suite (GitHub Actions) after push.

## Risks / Rollback

- Risks: Low; test-only selectors and expectations.
- Rollback plan: revert the single test commit.

## Completion Checklist

- [x] Branch update entry marked Done.
