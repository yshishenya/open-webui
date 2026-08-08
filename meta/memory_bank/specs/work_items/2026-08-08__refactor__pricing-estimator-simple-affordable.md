# Simplify public pricing estimator

## Meta

- Type: refactor
- Status: done
- Owner: Codex
- Branch: codex/fix/pricing-estimator-context
- SDD Spec (JSON): `meta/sdd/specs/completed/affordable-pricing-estimator-2026-08-08-001.json`
- Created: 2026-08-08
- Updated: 2026-08-08

## Context

The public pricing estimator exposes too many text-size controls and can select the first
rate-card model when no recommendation is configured. A fixed short-message sample also
ignores that a continuing chat sends its previous context again on every request.

## Goal / Acceptance Criteria

- [x] Text estimation has one primary input: messages per day.
- [x] The default text scenario uses short messages while accumulating one chat's context.
- [x] The estimator uses an affordable working model when it is available, with a safe cheapest
      model fallback.
- [x] Image and audio estimates remain available and unchanged.
- [x] No billing API, rate-card, or charged-cost behavior changes.

## Non-goals

- Changing real billing rates or wallet charging.
- Adding a new model or dependency.
- Redesigning the full pricing page.

## Scope (what changes)

- Frontend:
  - simplify `Estimator.svelte` text controls and remove duplicate example cards;
  - prefer an affordable working model and keep the cheapest-model fallback;
  - account for accumulated context while keeping short request/reply defaults.
- Backend: none.
- Config/Env: none.
- Data model / migrations: none.

## Implementation Notes

- Key files/entrypoints:
  - `src/lib/components/pricing/Estimator.svelte`
  - `src/lib/data/pricing-estimator.json`
- API changes: none.
- Edge cases: keep the current unavailable-rate fallback and honor an explicit recommended model.
- Billing alignment: the text estimate mirrors backend per-request kopek rounding and sends
  previous turns again; the current Qwen 3.7 Plus scenario produces about 623–880 ₽ for
  10 messages per day.

## Upstream impact

- Upstream-owned files touched:
  - `src/lib/components/pricing/Estimator.svelte`
- Why unavoidable: the public estimator is the user-facing scope.
- Minimization strategy: no API changes; keep the existing component and rate-card contract.

## Verification

- `npm run test:frontend -- --run` — 32 files / 123 tests passed
- `npm run check` — blocked by pre-existing repository diagnostics (8,357 errors in 349 files)
- `NODE_OPTIONS=--max-old-space-size=8192 npm run build:vite` — passed
- `npx eslint src/lib/components/pricing/Estimator.svelte src/lib/utils/airis/pricing_estimator.ts src/lib/utils/airis/pricing_estimator.test.ts` — passed
- `npx vitest --config vitest.config.ts run src/lib/utils/airis/pricing_estimator.test.ts` — 4 passed
- `git diff --check` — passed

## Production Evidence

- PR #110 merged into `airis_b2c` as `4c65d0b6dfeae10f6a2ceff1fdf2fa5cf3d16bd4`.
- Deployed `yshishenya/yshishenya:4c65d0b6dfeae10f6a2ceff1fdf2fa5cf3d16bd4` with the guarded script.
- Backup: `/opt/backups/airis/20260808T050020Z-4c65d0b6dfeae10f6a2ceff1fdf2fa5cf3d16bd4`;
  checksums and `pg_restore.list` validation passed.
- Hard Alembic migration passed; `airis` is healthy on the immutable tag.
- Production smoke: `https://chat.airis.you/health` returned `{"status":true}` and the
  public root returned HTTP 200.

## Risks / Rollback

- Risks: a single continuously growing chat is a conservative scenario; real usage is lower when
  users split work across multiple chats or send shorter replies.
- Rollback plan: revert the estimator and JSON changes; no persistent state is changed.

## Completion Checklist

- [x] Frontend checks completed; full typecheck remains blocked by the documented baseline.
- [x] Branch update entry moved to `Done` with required fields.
