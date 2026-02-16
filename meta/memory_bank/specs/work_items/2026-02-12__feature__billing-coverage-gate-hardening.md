# Billing Coverage Gate Hardening (Module-Scoped, Artifact-First)

## Meta

- Type: feature
- Status: done
- Owner: Codex
- Branch: HEAD (no branch)
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/billing-coverage-gate-hardenin-2026-02-12-102.json`
- Created: 2026-02-12
- Updated: 2026-02-12

## Context

Billing confidence checks existed, but coverage gate behavior was not fully operational in the real Docker Compose dev/test topology. We needed module-scoped, meaningful coverage checks with reliable artifact paths so failures are diagnosable and deterministic.

## Goal / Acceptance Criteria

- [x] Add module-scoped coverage checker for billing-critical backend modules.
- [x] Enforce both line and branch thresholds in `merge-medium`/`release-heavy` confidence tiers.
- [x] Ensure coverage/junit artifacts are indexed and actually exist in confidence run summaries.
- [x] Validate repeated confidence runs for stability and artifact integrity.
- [x] Update operational docs/runbook with gate policy and evidence snapshot.

## Non-goals

- Do not enforce project-wide aggregate coverage as release gate.
- Do not claim `>=85%` module coverage before tests actually reach it.
- Do not broaden static lint/type gates in this work item.

## Scope (what changes)

- Backend:
  - Added `scripts/ci/check_billing_module_coverage.py` for module line+branch threshold checks.
- Frontend:
  - No direct frontend code changes in this item.
- Config/Env:
  - Updated `.github/workflows/billing-confidence.yml` with explicit threshold env vars.
  - Updated `scripts/ci/run_billing_confidence.sh` to wire coverage artifact paths and checker execution.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `scripts/ci/run_billing_confidence.sh`
  - `scripts/ci/check_billing_module_coverage.py`
  - `.github/workflows/billing-confidence.yml`
  - `meta/memory_bank/guides/testing_strategy.md`
  - `meta/memory_bank/guides/billing_release_runbook.md`
  - `meta/memory_bank/guides/billing_launch_confidence.md`
- API changes:
  - None.
- Edge cases:
  - Docker dev overlay mounts only `./backend` into backend container.
  - Canonical run artifacts must remain under `artifacts/billing-confidence/<run-id>/` even when backend commands emit to `backend/artifacts/...`.

## Upstream impact

- Upstream-owned files touched:
  - None (CI scripts/workflows/docs only).
- Why unavoidable:
  - N/A.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Additive checker script and targeted runner/workflow wiring only.

## Verification

- `bash -n scripts/ci/run_billing_confidence.sh`
- `python3 -m py_compile scripts/ci/check_billing_module_coverage.py`
- `python3 scripts/ci/check_billing_module_coverage.py --coverage-json backend/artifacts/billing-coverage-baseline/coverage-billing-after-task3.json`
- `scripts/ci/run_billing_confidence.sh --tier pr-fast --run-id local-pr-fast-sync-check`
- `scripts/ci/run_billing_confidence.sh --tier merge-medium --run-id local-merge-medium-gate-check-2`
- `scripts/ci/run_billing_confidence.sh --tier merge-medium --run-id local-merge-medium-gate-check-3`

## Task Entry (for branch_updates/current_tasks)

- [x] **[FEATURE][BILLING][QA]** Billing coverage gate hardening (module-scoped + artifact integrity)
  - Spec: `meta/memory_bank/specs/work_items/2026-02-12__feature__billing-coverage-gate-hardening.md`
  - Owner: Codex
  - Branch: `HEAD (no branch)`
  - Done: 2026-02-12
  - Summary: Wired meaningful module line+branch coverage gate into billing confidence CI, fixed artifact path normalization for backend container topology, and validated repeat green runs.
  - Tests: `scripts/ci/run_billing_confidence.sh --tier pr-fast --run-id local-pr-fast-sync-check`, `scripts/ci/run_billing_confidence.sh --tier merge-medium --run-id local-merge-medium-gate-check-2`, `scripts/ci/run_billing_confidence.sh --tier merge-medium --run-id local-merge-medium-gate-check-3`
  - Risks: Medium (thresholds are non-regression floors; additional test expansion is required to reach higher targets like 85%+ without weakening meaning).

## Risks / Rollback

- Risks:
  - Thresholds can still be gamed if future tests become low-signal; maintain review discipline on assertion quality.
  - Backend container path assumptions can regress if compose topology changes.
- Rollback plan:
  - Revert coverage-check invocation from runner/workflow.
  - Keep confidence suites and artifact generation intact while reworking gate logic.
