# Billing Launch Confidence Program (Pre-Release)

## Meta

- Type: feature
- Status: done
- Owner: Codex
- Branch: `codex/bugfix/billing-confidence-ci`
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/billing-launch-confidence-program-2026-02-11-001.json`
- Created: 2026-02-11
- Updated: 2026-02-14

## Context

We need a release-quality confidence program for billing before broader user launch.
Current state has a mismatch between green tests and manual payment confidence:

- Billing-focused backend tests pass, but critical provider boundary is heavily mocked.
- Billing E2E recovery scenario currently fails.
- CI quality gates are incomplete/disabled for lint/integration paths.
- Static quality checks have large legacy debt and cannot be used as strict global blockers yet.

## Goal / Acceptance Criteria

- [x] Define and approve a phased implementation plan for billing launch confidence.
- [x] Create an SDD JSON spec with atomic tasks, dependencies, and verification steps.
- [x] Lock explicit P0/P1 boundaries with release-blocking vs post-launch scope.
- [x] Define rollout path for stronger CI gates without blocking all development on legacy debt.
- [x] Establish measurable pre-release gates (commands, thresholds, and pass conditions).

## P0 / P1 Boundary (Final)

### P0 (release-blocking)

- Fix billing flow defects visible to end users in `/billing/balance` and top-up recovery.
- Ensure deterministic behavior for both low-balance branches:
  - free usage available
  - free usage not available
- Validate payment return path correctness for non-root deployments (no broken redirect loop).
- Cover provider boundary risks that can silently break real payments:
  - webhook trust validation matrix (token/signature/source checks)
  - timeout/429/5xx handling on critical top-up/subscription paths
- Enforce CI gates that block release if P0 checks fail or hang.

### P1 (post-launch hardening, non-blocking for initial rollout)

- Expand provider-contract depth beyond minimum critical flows.
- Increase observability and canary sophistication after first stable release.
- Incrementally raise coverage and lint/type strictness in legacy-heavy areas.
- Add additional synthetic probes and longer soak windows once P0 is stable.

## Measurable Acceptance Criteria (Release Readiness)

- P0 automated suites pass in 2 consecutive runs without manual intervention:
  - backend billing critical suite
  - frontend billing balance unit suite
  - billing wallet E2E recovery scenario
- No unresolved P0 billing defects remain from manual smoke on the latest candidate build.
- Billing confidence runner produces required artifacts (JSON + markdown summary) and exits non-zero on any gate violation.
- Webhook trust checks cover all approved security combinations in the matrix defined by the SDD spec.
- CI tiering is active and documented:
  - `pr-fast` (blocking on P0 smoke)
  - `merge-medium` (blocking on broader integration)
  - `pre-release` (blocking on full confidence run)

## Non-goals

- No implementation changes in this planning item.
- No immediate removal of all legacy lint/type debt in one batch.

## Scope (what changes)

- Backend:
  - Payment provider boundary confidence, webhook security coverage, reliability checks.
- Frontend:
  - Billing wallet recovery E2E reliability and low-balance branch correctness.
- Config/Env:
  - CI gate strategy for PR/merge/release layers.
- Data model / migrations:
  - None expected initially.

## Implementation Notes

- Key files/entrypoints:
  - `backend/open_webui/routers/billing.py`
  - `backend/open_webui/utils/billing.py`
  - `backend/open_webui/utils/yookassa.py`
  - `backend/open_webui/test/apps/webui/routers/test_billing_topup.py`
  - `backend/open_webui/test/apps/webui/routers/test_billing_subscription_webhook.py`
  - `e2e/billing_wallet_recovery.spec.ts`
  - `src/routes/(app)/billing/balance/+page.svelte`
  - `.github/workflows/*`
- API changes:
  - TBD after detailed planning.
- Edge cases:
  - low-balance UX path with/without lead-magnet models
  - provider outages/timeouts/rate limits
  - webhook source/signature enforcement combinations

## High-Level Phases (for approval)

### Phase 1: Baseline and Gap Lock
- Purpose: Freeze baseline quality gates, exact failing scenarios, and target confidence metrics.
- Dependencies: none
- Risk Level: Medium
- Key deliverables:
  - Documented baseline runbook with current pass/fail/flaky map
  - Approved P0/P1 scope and acceptance criteria

### Phase 2: Billing Flow Correctness (P0)
- Purpose: Close correctness gaps that directly affect user billing flow.
- Dependencies: Phase 1
- Risk Level: High
- Key deliverables:
  - Fixed and hardened wallet recovery E2E scenario coverage
  - Return URL/path correctness checks for deployment variants
  - Clear pass criteria for top-up happy path and failure path UX

### Phase 3: Provider Boundary and Webhook Trust (P0)
- Purpose: Increase confidence at external payment boundary where mocks currently hide risk.
- Dependencies: Phase 1
- Risk Level: High
- Key deliverables:
  - Contract/integration tests for provider-facing top-up + webhook processing
  - Security matrix coverage for webhook token/IP/signature combinations
  - Failure-injection tests for timeout/429/5xx provider responses

### Phase 4: Test Reliability and CI Gating (P0/P1)
- Purpose: Make confidence signals stable and enforceable in CI.
- Dependencies: Phase 2, Phase 3
- Risk Level: High
- Key deliverables:
  - Reliable billing test shards (no hidden hangs/timeouts)
  - Layered gates: PR-fast, merge-medium, release-heavy
  - Artifact-first diagnostics (trace/video/logs/junit) on failures

### Phase 5: Pre-Release Verification and Canary
- Purpose: Validate in staging-like environment and protect first users post-launch.
- Dependencies: Phase 4
- Risk Level: Medium
- Key deliverables:
  - Release candidate checklist with synthetic billing probes
  - Canary monitoring/alert thresholds for payment and webhook health
  - Rollback triggers for billing regression

## Implementation Order

1. Phase 1
2. Phase 2 + Phase 3 (can run in parallel after Phase 1)
3. Phase 4
4. Phase 5

## Key Integration Points

- Wallet UI branch logic depends on model metadata + lead-magnet state.
- Backend payment processing depends on provider responses and trusted webhook reconciliation.
- CI confidence depends on both test correctness and runtime reliability (non-hanging execution).

## Questions for Review

- Should webhook security hardening be split into a separate track from provider contract tests?
- Should we gate release on one synthetic provider flow or at least two (top-up + subscription)?
- Do you want strict release blocking on flaky test detection, or warning-only for first iteration?

## Phase Approval

- Approved by user: 2026-02-11
- Approved phases:
  1. Baseline and Gap Lock
  2. Billing Flow Correctness (P0)
  3. Provider Boundary and Webhook Trust (P0)
  4. Test Reliability and CI Gating (P0/P1)
  5. Pre-Release Verification and Canary

## Upstream impact

- Upstream-owned files touched:
  - TBD (planning stage).
- Why unavoidable:
  - TBD.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Prefer additive tests/utilities and minimal diffs in upstream-owned files.

## Verification

- Planning-stage checks only in this item.
- SDD execution/verification source of truth:
  - `meta/sdd/specs/active/billing-launch-confidence-program-2026-02-11-001.json`
- Verification scope is fixed to three layers:
  - Backend billing critical integration/API tests (top-up, subscription, webhook, billing integration).
  - Frontend billing balance unit/integration tests.
  - Billing E2E recovery + wallet smoke paths.
- CI gating verification path:
  - `pr-fast` (P0 smoke only)
  - `merge-medium` (broader integration confidence)
  - `pre-release` (full billing confidence run + artifact validation)

## Task Entry (for branch_updates/current_tasks)

- [x] **[FEATURE][BILLING][QA]** Billing launch confidence program (SDD planning + execution)
  - Spec: `meta/memory_bank/specs/work_items/2026-02-11__feature__billing-launch-confidence-program.md`
  - Owner: Codex
  - Branch: `codex/bugfix/billing-confidence-ci`
  - Done: 2026-02-14
  - Summary: Delivered a tiered billing confidence runner + gates (coverage + artifacts) and expanded high-signal billing/webhook tests to support prelaunch rollout.
  - Tests: `npm run billing:confidence:smoke`, `scripts/ci/run_billing_confidence.sh --tier pr-fast`, `scripts/ci/run_billing_confidence.sh --tier merge-medium`, `scripts/ci/run_billing_confidence.sh --tier release-heavy`
  - Risks: Medium (billing-critical surfaces); mitigated with tiered gates + artifact-first triage.

## Risks / Rollback

- Risks:
  - Over-scoping may delay launch if phases are not tightly prioritized.
  - Under-scoping can preserve false confidence from mocked-only flows.
- Rollback plan:
  - Keep phase boundaries explicit; release only P0 tracks first if needed.
