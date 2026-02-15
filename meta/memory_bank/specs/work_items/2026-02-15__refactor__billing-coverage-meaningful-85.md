# Billing Coverage Gate: >=85% With Meaningful Assertions

## Meta

- Type: refactor
- Status: done
- Owner: codex (gpt-5.3-codex)
- Branch: codex/refactor/billing-coverage-meaningful
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-15
- Updated: 2026-02-15

## Context

We already have a billing confidence harness (backend critical + frontend billing balance + e2e wallet) and
a coverage gate for billing modules. The goal now is to ensure the coverage threshold is met by tests that
assert real invariants (happy paths, negative paths, idempotency/replay safety), not by shallow line hits.

## Goal / Acceptance Criteria

- [ ] Billing module coverage meets/exceeds 85% line coverage for:
  - `open_webui.routers.billing`
  - `open_webui.utils.billing`
- [ ] Added tests validate *behavior*, not implementation details:
  - Return URL sanitization rejects unsafe inputs.
  - Provider error mapping returns correct HTTP status + user-safe detail.
  - Webhook replay detection/idempotency prevents double-credit/double-subscribe.
  - Wallet top-up validation rejects invalid amounts/packages.
- [ ] Billing confidence suite remains green on PR/merge.

## Non-goals

- Raising global repo coverage to 85% (we focus on billing-critical modules).
- Refactoring billing architecture beyond what is needed for testability.

## Scope (what changes)

- Tests:
  - Add/extend pytest cases in `backend/open_webui/test/apps/webui/routers/` and/or `backend/open_webui/test/apps/webui/utils/`
    to cover uncovered branches and fault-tolerance paths.
- Coverage gate:
  - Ensure the billing confidence runner continues to enforce module-specific thresholds (no "gaming").

## Verification

- Targeted coverage run (fast iteration): run the `backend_billing_coverage` command from `scripts/ci/run_billing_confidence.sh` and inspect `--cov-report=term-missing`.
  - Result (local): routers line=92.31% (min 85), routers branch=80.93% (min 65); utils line=89.41% (min 85), utils branch=82.04% (min 70)
  - Coverage gate: PASS

## Risks / Rollback

- Risk:
  - Over-mocking can produce brittle tests; prefer API-level tests around routers/service boundaries.
- Rollback:
  - Revert test additions and threshold changes if they cause false negatives in CI.
