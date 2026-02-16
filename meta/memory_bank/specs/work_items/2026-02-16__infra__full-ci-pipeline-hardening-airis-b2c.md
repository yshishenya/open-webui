# Work Item: Full CI Pipeline Hardening for `airis_b2c`

## Meta

- Type: refactor
- Status: done
- Owner: Codex
- Branch: head-no-branch
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-16
- Updated: 2026-02-16

## Context

We need a complete, enforceable delivery pipeline aligned with Airis branch policy and SDD discipline.

## Goals

1. Re-enable disabled quality gates (lint/integration).
2. Enforce `airis_b2c` as mandatory PR base branch.
3. Add blocking SDD validation in CI.
4. Add baseline security gates in CI.
5. Add migration safety gate for Alembic flows.

## Scope

1. GitHub Actions workflows in `.github/workflows/`.
2. PR template in `.github/pull_request_template.md`.
3. CODEOWNERS governance file.

## Changes

1. Activated:
   - `lint-backend.yml`
   - `lint-frontend.yml`
   - `integration-test.yml`
2. Added:
   - `.github/workflows/airis-branch-policy.yml`
   - `.github/workflows/sdd-validate.yml`
   - `.github/workflows/security.yml`
   - `.github/workflows/migration-check.yml`
3. Updated:
   - `.github/pull_request_template.md` to require `airis_b2c` and mandatory gates.
4. Governance:
   - `.github/CODEOWNERS` single owner for the repo.

## Upstream Impact

Low. Changes are isolated to repo governance and CI workflows, with no product runtime impact.

## Risks

1. New checks can increase CI duration.
2. Security scans can surface legacy issues that block PRs.
3. Migration check depends on Docker Compose runtime in CI.

## Rollback

1. Disable or remove newly added workflow files.
2. Revert template/ownership updates if needed.

## Done Criteria

1. PRs to non-`airis_b2c` are rejected by CI.
2. SDD errors fail CI.
3. Security checks run on PR/push.
4. Migration check runs on PR/push.
5. Lint/integration workflows are active again.
