- [ ] **[REFACTOR]** Type permission form state while preserving rights
  - Spec: `meta/memory_bank/specs/work_items/2026-10-03__refactor__permission-form-types.md`
  - Owner: Codex
  - Branch: `codex/refactor/permission-form-types`
  - Started: 2026-10-03
  - Summary: Measured189 permission-form and7 group-modal errors on fresh integration base; preserve partial input and normalized mutable state.
  - Tests: Baseline check4631/179; behavior safety net and implementation pending.

- Verification:189 form diagnostics removed, zero new diagnostics,213/213 frontend tests; fullcheck4442/179, ESLint1546. Production client/server compiled JS byte-identical to b0a248; no image release required. Group/modal7 diagnostics retained for a separate contract item. Integration/CI pending.
