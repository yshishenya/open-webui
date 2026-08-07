# Billing merge-gate coverage remediation

## Meta

- Type: bugfix
- Status: In progress
- Owner: Codex
- Branch: `codex/bugfix/billing-coverage-merge-gate`
- SDD Spec: N/A (targeted regression-test follow-up)
- Created: 2026-08-07

## Goal

Restore the merge-medium billing confidence gate after PR #93 by covering the
new billing utility branches without weakening coverage thresholds or runtime
behavior.

## Scope

- Add focused regression cases for uncovered payment/webhook and reporting
  branches in `backend/open_webui/utils/billing.py`.
- Keep production code unchanged unless a test exposes a real defect.

## Verification

- Merge-medium billing confidence workflow passes, including line and branch
  coverage thresholds.
- Ruff, compileall, and `git diff --check` pass.

## Upstream impact

Test-only follow-up on top of the merged billing remediation; no dependencies,
migrations, or upstream-owned runtime contracts change.
