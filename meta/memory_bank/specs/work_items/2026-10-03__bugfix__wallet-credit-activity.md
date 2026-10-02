# Refresh recent wallet activity after confirmed top-up

## Meta

- Type: bugfix
- Status: completed (implementation and automated verification; rollout pending)
- Owner: Codex
- Branch: `codex/bugfix/wallet-credit-activity`
- SDD Spec: `meta/sdd/specs/completed/airis-wallet-credit-activity-2-2026-10-03-0029.json`
- Created: 2026-10-03
- Updated: 2026-10-03

## Context

Returning from a successful payment updates the wallet balance and shows the success banner, but Latest activity retains the ledger loaded before reconciliation. Opening full History shows the new entry. UnifiedTimeline loads on mount while wallet return checks update only the balance.

## Goal / Acceptance Criteria

- [x] Reproduce stale recent activity with a component test before changing runtime code.
- [x] Automatic return polling and manual Refresh show the confirmed top-up without navigation or page reload.
- [x] Pending or failed reconciliation preserves current activity and never shows payment success.
- [x] Refresh uses the existing ledger/usage APIs; no client-synthesized transaction or balance-inferred credit.
- [x] Run full frontend tests and strict checks; retain documented existing failures without weakening rules.

## Scope / Implementation Notes

Increment a wallet-local timeline revision only when the shared reconciliation function returns credited=true. Key the small recent-activity component by that revision to reload authoritative ledger/usage data. Both manual and polling paths share this function; financial APIs, payment processing and full History stay unchanged.

No new dependencies, environment settings, schema or backend changes. Existing Svelte key-block semantics are documented at https://svelte.dev/docs/svelte/key. Dependencies remain repo-pinned; framework upgrade is a separate compatibility task.

## Upstream impact

- `src/routes/(app)/billing/balance/+page.svelte`: narrow revision state, reconciliation hook and keyed wrapper around the existing recent-activity component.
- `src/routes/(app)/billing/balance/billing-balance.test.ts`: user-visible regressions using the real timeline component.
- No shared timeline contract or unrelated formatting changes.

## Verification

Docker Compose frontend tests, `npm run check`, `npm run lint:frontend`, focused strict lint and formatting for changed files. Backend checks already cover the unchanged backend; CI and exact source identity are recorded separately. Candidate return acceptance follows before production rollout.

## Risks / Rollback

A confirmed top-up triggers one additional ledger/usage fetch and briefly reloads the small recent list. A failed history request must remain an explicit history error and must not change payment success. Rollback the frontend image if the candidate/live return path fails; no database downgrade.

### Recorded results (2026-10-03)

- Before fix: automatic/manual credit assertions failed; 14 passed / 2 failed.
- After fix: 16 wallet tests and all 202 frontend tests in 46 files passed in Compose.
- Focused ESLint passed for both changed source files; test file formatting passed. Existing unrelated page formatting retained to keep upstream diff minimal.
- Full strict check remains at 4,668 errors / 215 warnings; full frontend lint at 1,600 errors, zero warnings. Changed files have no lint findings. No rule or baseline was weakened.
- Backend code and financial APIs are unchanged. Candidate and production acceptance remain separate release gates.
