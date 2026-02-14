# Billing Confidence: Smoke Artifacts + Smoke-Only CI Mode

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: `codex/bugfix/billing-confidence-ci`
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-14
- Updated: 2026-02-14

## Context

We added a billing-confidence smoke guard to validate runner semantics (pass/fail detection, artifact integrity).
However, in CI the smoke script currently uses a temp directory and cleans it up, which makes post-failure triage harder.
We also want a cheap `workflow_dispatch` mode to run only the smoke guard without running full suites.

## Goal / Acceptance Criteria

- [x] Smoke step writes its outputs into the workflow artifact bundle (not only to a cleaned temp dir).
- [x] `workflow_dispatch` supports a smoke-only run mode (fast debug).
- [x] Smoke script remains deterministic and fast (no Docker required in smoke itself).
- [x] Existing `billing-confidence` tier behavior for PR/push remains unchanged (smoke + full suites).

## Non-goals

- No new dependencies.
- No changes to billing runtime behavior.
- No changes to suite selection logic in `run_billing_confidence.sh` tiers beyond smoke-only skipping the full runner in manual dispatch.

## Scope (what changes)

- Config/Env:
  - Update `.github/workflows/billing-confidence.yml` to:
    - persist smoke outputs under `artifacts/billing-confidence/<run-id>/smoke/`
    - add `workflow_dispatch` smoke-only input and gate runner steps accordingly
- Scripts:
  - Update `scripts/ci/test_billing_confidence_smoke.sh` to accept an output directory and to preserve artifacts there.
- Docs:
  - Update `meta/memory_bank/guides/testing_strategy.md` to document smoke output location and smoke-only mode.

## Upstream impact

- Upstream-owned files touched:
  - `.github/workflows/billing-confidence.yml` (fork CI config)
- Why unavoidable:
  - Need CI to persist smoke outputs and support smoke-only manual runs.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Keep changes limited to one workflow + one CI script; no refactors.

## Verification

- `bash -n scripts/ci/test_billing_confidence_smoke.sh`
- `bash -n scripts/ci/run_billing_confidence.sh`
- `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/billing-confidence.yml'); puts 'YAML_OK'"`
- `npm run billing:confidence:smoke`
- Real confidence runs (requires Docker daemon):
  - `BILLING_CONFIDENCE_TIER=pr-fast BILLING_CONFIDENCE_RUN_ID=local-pr-fast-docker-check-<ts> BILLING_CONFIDENCE_ARTIFACT_DIR=artifacts/billing-confidence scripts/ci/run_billing_confidence.sh`
  - `BILLING_CONFIDENCE_TIER=merge-medium BILLING_CONFIDENCE_RUN_ID=local-merge-medium-docker-check-<ts> BILLING_CONFIDENCE_ARTIFACT_DIR=artifacts/billing-confidence scripts/ci/run_billing_confidence.sh`
- Smoke artifact persistence:
  - `BILLING_CONFIDENCE_SMOKE_OUTPUT_DIR=artifacts/billing-confidence/local-smoke-artifacts-<ts>/smoke scripts/ci/test_billing_confidence_smoke.sh`

## Task Entry (for branch_updates/current_tasks)

- [ ] **[BUG][CI][BILLING]** Persist billing-confidence smoke artifacts + add smoke-only workflow_dispatch
  - Spec: `meta/memory_bank/specs/work_items/2026-02-14__bugfix__billing-confidence-smoke-artifacts.md`
  - Owner: Codex
  - Branch: `codex/bugfix/billing-confidence-ci`
  - Started: 2026-02-14
  - Summary: Make smoke guard outputs available in CI artifacts and add a fast smoke-only manual run mode.
  - Tests: `npm run billing:confidence:smoke`, `ruby -e "require 'yaml'; ..."`
  - Risks: Low (CI-only changes)

## Risks / Rollback

- Risks:
  - Slightly larger artifact bundles (smoke outputs).
  - Smoke-only mode could be misused as substitute for full tier runs (doc mitigates).
- Rollback plan:
  - Remove smoke output wiring and smoke-only input; keep smoke guard itself.
