# Billing top-up minimum 500 RUB

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: airis_b2c
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-08-06
- Updated: 2026-08-06

## Context

The wallet top-up presets still exposed a 100 RUB option in the default/runtime configuration.

## Goal / Acceptance Criteria

- [x] The smallest configured top-up is 500 RUB.
- [x] Frontend fallback does not expose 100 RUB.
- [x] Backend pricing tests cover the updated preset list and reject the removed amount.

## Non-goals

- No payment API, database, or migration changes.
- No new dependencies.

## Scope (what changes)

- Backend: update the default preset list and focused regression test.
- Frontend: update the fallback preset list.
- Config/Env: update tracked env templates and local etalon config.
- Data model / migrations: none.

## Implementation Notes

- Existing backend validation rejects amounts not present in `BILLING_TOPUP_PACKAGES_KOPEKS`; the fix removes 100 RUB from all default/configured sources.
- Presets are now 500 / 1000 / 2000 RUB.

## Upstream impact

- Upstream-owned files touched: none.
- Why unavoidable: N/A.
- Minimization strategy: configuration/fallback-only changes.

## Verification

- Focused frontend billing test: 1 file, 7 tests passed.
- Focused backend tests attempted: `test_billing_topup.py` invalid amount and `test_billing_public_pricing.py` public preset response; blocked during collection because the Docker image lacks the existing `aiosmtplib` dependency and PyPI installation timed out.
- `python -m py_compile backend/open_webui/env.py`.
- `git diff --check`.
- Built and inspected production image `yshishenya/yshishenya:b4b52058` for `linux/amd64`; registry push was denied, so the verified image archive was transferred to production and loaded locally.
- Guarded production deploy completed with verified database/application backups at `/opt/backups/airis/20260806T125545Z-b4b52058`, hard Alembic gate, retained rollback image, and healthy containers.
- Production and public API verification returned `topup_amounts_rub: [500, 1000, 2000]`; `/health` returned `{"status":true}`.

## Completion Checklist

- [x] SDD not required for this config-only bugfix.
- [x] Task status updated on integration branch.
- [x] Production rollout and public pricing verification completed.
