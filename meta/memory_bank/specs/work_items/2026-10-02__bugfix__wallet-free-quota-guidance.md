# Wallet guidance with available free quota

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/wallet-free-quota-guidance
- SDD Spec: meta/sdd/specs/active/airis-wallet-free-quota-guidance-2026-10-02-210.json
- Created: 2026-10-02

## Context

The ordinary account has a zero cash balance, available free quota and successful free Luna usage. The wallet still displays an amber low-balance badge, emphasizes top-up and preselects payment. The common `isLowBalance` predicate considers cash alone and drives all four effects. Existing free-quota and model-availability state already determines whether free usage is available.

## Goal / Acceptance Criteria

- [x] Available free usage with zero cash does not show a low-balance warning or preselect payment; the free quota section and voluntary top-up remain available.
- [x] Low cash without free usage retains its warning and package selection.
- [x] Explicit recovery from a blocked paid request retains the package recommendation even with available free usage.
- [x] Existing mounted wallet tests reproduce failure before the fix and pass afterward; touched fixture typing/ESLint and Docker suites pass with no new strict diagnostics.
- [ ] Accepted source, candidate and guarded production UI evidence match; backend/settings remain unchanged.

## Scope / Upstream impact

Change the existing route predicate in `src/routes/(app)/billing/balance/+page.svelte`; reuse free-usage state and paid-request recommendation. Update the existing mounted-page and browser recovery fixtures to cover the behavior; correct obsolete mock arguments/store inference. No new helper, component, dependency, threshold, billing calculation, payment or database change.

## Verification

Use Docker frontend tests, touched ESLint/format checks, full strict diagnostic comparison and relevant wallet/guide E2E. Freeze the accepted source, build the frontend overlay from the current production base and verify file hashes, rollback backup, configuration, health and ordinary-account wallet UI.

## Risks / Rollback

Free quota availability is the existing wallet-wide hint, not a guarantee that an arbitrary future request fits its quota. Preserve explicit paid recovery and voluntary top-up. Restore the accepted auth-session image if production verification fails. Real financial acceptance remains an independent product criterion.

## Source checks

The existing mounted-page fixture fails2 cases before the single route-predicate correction and passes all12 wallet cases after it. The explicit paid recovery scenario has available free usage and still preselects the required package. Docker frontend166/166 in40 files and touched ESLint/Prettier pass. Both wallet route and fixture have0 strict diagnostics. Correcting legacy mock arguments and store inference removes8 findings and introduces0; full baseline4783 errors /217 warnings /284 files remains open. No new dependencies or payment changes. Candidate/exact-source CI and production acceptance remain pending.

The existing wallet recovery browser checks now assert absent warning and unselected/disabled payment while free usage is available, including the mobile disclosure case. The unavailable-free-model top-up wiring scenario is retained. Touched browser-fixture ESLint and Prettier pass; final candidate E2E follows.
