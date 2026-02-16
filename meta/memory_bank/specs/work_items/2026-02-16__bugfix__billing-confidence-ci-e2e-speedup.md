# Billing Confidence: CI E2E suite speedup without coverage reduction

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: `codex/bugfix/post-merge-validation-fixes`
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-16
- Updated: 2026-02-16

## Context

`billing-confidence` workflow has been slow in CI, especially suite `e2e_billing_wallet` for the `pr-fast` tier. The goal is to reduce wall-clock without lowering test coverage or weakening assertions.

## Goal / Acceptance Criteria

- [x] Install frontend e2e dependencies once per workflow run before the suite executes.
- [x] Avoid running `npm ci` inside the suite command when dependencies are already prepared.
- [x] Keep the same E2E spec set (`billing_wallet.spec.ts`, `billing_wallet_recovery.spec.ts`, `billing_lead_magnet.spec.ts`).
- [x] Keep quality checks and artifacts unchanged (`Junit + traces`).
- [x] Increase Playwright parallelism with a controlled worker count (`2`) for stability/throughput balance.

## Non-goals

- No changes to production runtime behavior.
- No changes to backend/coverage assertions.
- No new dependencies.

## Scope (what changes)

- CI workflow: `.github/workflows/billing-confidence.yml`
  - Added explicit e2e dependency preinstall step before full suites when `smoke_only=false`.
  - Reduced suite runtime overhead by using preinstalled dependencies and `BILLING_CONF_E2E_WORKERS=2`.
- CI runner script: `scripts/ci/run_billing_confidence.sh`
  - Added configurable `BILLING_CONF_E2E_WORKERS` passthrough into E2E command.

## Upstream impact

- Upstream-owned files touched:
  - `.github/workflows/billing-confidence.yml` (fork CI config)
  - `scripts/ci/run_billing_confidence.sh` (CI execution script used by CI)
- Why unavoidable:
  - CI duration is an operational concern for this integration branch.
- Minimization strategy:
  - Keep changes additive in CI execution path, no functional application code changes.

## Verification

- `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/billing-confidence.yml'); puts 'YAML_OK'"`
- `bash -n scripts/ci/run_billing_confidence.sh`
- `sed -n '1,260p' scripts/ci/run_billing_confidence.sh` for env propagation consistency (manual review).

## Task Entry (for branch_updates/current_tasks)

- [x] **[BUG][CI][BILLING]** Speed up billing-confidence E2E suite in `pr-fast`/`merge-medium`
  - Spec: `meta/memory_bank/specs/work_items/2026-02-16__bugfix__billing-confidence-ci-e2e-speedup.md`
  - Owner: Codex
  - Branch: `codex/bugfix/post-merge-validation-fixes`
  - Done: 2026-02-16
  - Summary: Added preinstall + configurable E2E workers for CI to avoid redundant package installs and cut runner wall time.
  - Tests: `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/billing-confidence.yml'); puts 'YAML_OK'"`, `bash -n scripts/ci/run_billing_confidence.sh`
  - Risks: Low (CI-only optimization; no runtime feature behavior changes)

## Risks / Rollback

- Risks:
  - More aggressive worker settings can increase flakiness on slower runners.
- Rollback plan:
  - Remove `BILLING_CONF_E2E_WORKERS` and run with default suite command behavior.
