### Done

- [x] **[REFACTOR][TEST][BILLING]** Add wallet free-limit disclosure E2E guard
  - Spec: `meta/memory_bank/specs/work_items/2026-08-08__refactor__billing-wallet-disclosure-e2e.md`
  - Owner: Codex
  - Branch: `codex/billing-wallet-e2e-smoke`
  - Done: 2026-08-08
  - Summary: Guard collapsed free-limit details, keyboard disclosure, top-up visibility, and mobile overflow in the existing wallet E2E suite.
  - Tests: esbuild syntax validation; `git diff --check`; Docker E2E runtime deferred to CI because the local ARM image build is infrastructure-bound.
  - Risks: None; test-only change.
