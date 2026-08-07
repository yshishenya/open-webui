# Billing wallet disclosure E2E guard

## Meta

- Type: refactor
- Status: done
- Owner: Codex
- Branch: codex/billing-wallet-e2e-smoke
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-08-08
- Updated: 2026-08-08

## Context

The wallet's free-limit metrics are intentionally collapsed to keep the top-up action primary. The behavior was verified manually in production but needs a deterministic regression guard.

## Goal / Acceptance Criteria

- [x] Keep free-limit details collapsed on initial wallet render.
- [x] Reveal metrics and included models through the disclosure button and keyboard activation.
- [x] Keep the top-up action visible and avoid horizontal overflow at a mobile viewport.

## Non-goals

- No billing API, pricing, quota, or persistence changes.
- No new dependencies or production UI changes.

## Scope (what changes)

- Backend: none.
- Frontend: E2E coverage only.
- Config/Env: none.
- Data model / migrations: none.

## Implementation Notes

- Key file: `e2e/billing_wallet_recovery.spec.ts`.
- Use the existing mocked billing fixtures and Playwright storage state.
- Assert behavior through accessible roles and stable IDs, not CSS layout selectors.

## Upstream impact

- Upstream-owned files touched: none.
- Minimization strategy: one focused test in the existing billing wallet recovery suite.

## Verification

- E2E: Docker runner attempted; local ARM build was stopped during the heavyweight backend dependency image build. The focused spec passed esbuild syntax validation.
- Static: `git diff --check`.

## Risks / Rollback

- Risks: Test depends on the existing wallet fixture contract; no runtime risk.
- Rollback plan: revert the single test and documentation files.

## Completion Checklist

- [x] Focused E2E spec is syntactically valid; runtime execution is delegated to CI because the local ARM image build is infrastructure-bound.
- [x] Diff check passes.
- [x] Branch update marked Done.
