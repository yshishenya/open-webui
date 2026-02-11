# Billing Payment Error Mapping Coverage + SDD Docs Artifact Ignore

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/billing-payment-mapping-coverage
- Created: 2026-02-11
- Updated: 2026-02-11

## Context

After merging the YooKassa top-up visibility fix, review found two residual issues:
- no dedicated regression tests for `/api/v1/billing/payment` provider-error mapping;
- `meta/sdd/docs/codebase.json` (tool-generated artifact) was committed and can create review noise.

## Goal / Acceptance Criteria

- [x] Add backend regression tests for `/billing/payment` mapping (`401/403` and `400` -> stable `502` details).
- [x] Stop tracking generated `meta/sdd/docs` artifacts in git for future commits.
- [x] Remove currently tracked `meta/sdd/docs/codebase.json` from repository.

## Scope

- Backend tests:
  - `backend/open_webui/test/apps/webui/routers/test_billing_topup.py`
- Repo hygiene:
  - `.gitignore`
  - remove `meta/sdd/docs/codebase.json`

## Verification

- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_billing_topup.py"`
- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps pytools "python -m pip install -U pip >/dev/null && python -m pip install -q 'ruff>=0.1' && ruff check backend/open_webui/test/apps/webui/routers/test_billing_topup.py"`

## Risks / Rollback

- Risks: low (test coverage + ignore rule only).
- Rollback: revert this commit to restore previous artifact tracking and test state.
