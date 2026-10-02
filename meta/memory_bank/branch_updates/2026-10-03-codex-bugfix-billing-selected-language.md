- [ ] **[BUG][BILLING]** Respect selected language for money and dates
  - Spec: `meta/memory_bank/specs/work_items/2026-10-03__bugfix__billing-selected-language.md`
  - Owner: Codex
  - Branch: `codex/bugfix/billing-selected-language`
  - Started: 2026-10-03
  - Summary: Reproduce nonexistent i18n.locale fallback to browser language; add supported language resolution and narrow formatter calls.
  - Tests: 207/207 frontend; focused ESLint; strict type errors 4668 → 4631, 0 new; full lint retains 1600 existing errors. Candidate browser/release pending.
  - Risks: Presentation changes only; no financial arithmetic or backend change.

- CI correction: first head failed on 52 existing violations in changed caller files. All 52 corrected, changed files ESLint clean; 207/207 tests; 4631 type errors /179 warnings remain globally. New candidate/CI pending.
