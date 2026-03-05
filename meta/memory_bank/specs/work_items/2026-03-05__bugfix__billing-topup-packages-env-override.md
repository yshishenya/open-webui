# Billing top-up presets not updated due env override

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: airis_b2c
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-03-05
- Updated: 2026-03-05

## Context

After merging the preset change to `100/500/1000/2000 RUB`, `/billing/balance` still displayed old values
`1000/1500/5000/10000`. Root cause: runtime `.env` and tracked etalon env templates still had old
`BILLING_TOPUP_PACKAGES_KOPEKS`, which overrode backend defaults and compose fallback.

## Goal / Acceptance Criteria

- [x] Runtime API returns `topup_amounts_rub = [100, 500, 1000, 2000]`.
- [x] `.env.etalon` and `.env.etalon.example` are aligned with the new preset values.
- [x] Effective `.env` value is updated to match the intended presets.

## Non-goals

- No changes to billing business logic, API contracts, or UI layout.
- No new dependencies, migrations, or refactors.

## Scope (what changes)

- Backend: none (logic already correct).
- Frontend: none (fallback already correct).
- Config/Env:
  - update `.env`, `.env.etalon`, `.env.etalon.example`
- Data model / migrations: none.

## Implementation Notes

- Root-cause check:
  - `docker compose exec -T airis ... /billing/public/pricing-config` returned old `[1000, 1500, 5000, 10000]`.
- Fix:
  - Set `BILLING_TOPUP_PACKAGES_KOPEKS=10000,50000,100000,200000` in env files.
  - Recreate `airis` container.
- Verification:
  - API now returns `[100, 500, 1000, 2000]`.

## Upstream impact

- Upstream-owned files touched:
  - none (env templates/docs only).
- Why unavoidable:
  - N/A.
- Minimization strategy:
  - single-line value changes only.

## Verification

- `docker compose up -d airis`
- `docker compose exec -T airis python - <<'PY' ... /api/v1/billing/public/pricing-config ... PY`
  - observed: `[100, 500, 1000, 2000]`

## Task Entry (for current_tasks)

- [x] **[BUG][BILLING]** Top-up presets remained old due `.env` override
  - Spec: `meta/memory_bank/specs/work_items/2026-03-05__bugfix__billing-topup-packages-env-override.md`
  - Owner: Codex
  - Branch: `airis_b2c`
  - Done: 2026-03-05
  - Summary: Updated env sources overriding runtime billing presets and restarted service so `/billing/balance` shows `100/500/1000/2000`.
  - Tests: `docker compose exec -T airis python - <<'PY' ... pricing-config ... PY`
  - Risks: Low (config-only change).

## Risks / Rollback

- Risks:
  - low; only env values were changed.
- Rollback plan:
  - restore previous `BILLING_TOPUP_PACKAGES_KOPEKS` values and restart `airis`.

## Completion Checklist

- [x] If SDD spec is linked: `meta/tools/sdd check-complete <spec_id> --json` (N/A)
- [x] If SDD spec is linked: `meta/tools/sdd complete-spec <spec_id> --json` (N/A)
- [x] Task status updated on integration branch (`current_tasks.md`)
