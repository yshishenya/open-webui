- [ ] **[BUG][BILLING]** Identify and focus invalid receipt contacts (audit U21)
  - Spec: `meta/memory_bank/specs/work_items/2026-10-27__bugfix__billing-contact-errors.md`
  - Owner: Codex
  - Branch: `codex/bugfix/billing-contact-errors-20261027`
  - Started: 2026-10-27
  - Summary: Reuse existing field-error semantics; preserve network retry and edits during saving without changing billing rules.
  - Tests: U21 red/green passed; combined draft/contact pack 120/120; full exact-source preflight pending.
  - Risks: Low, UI-only; production contacts will not be changed.

- [ ] **[BUG][BILLING][TEST]** Verify UTC credit and expired-session boundaries (A08/Q10)
  - Spec: `meta/memory_bank/specs/work_items/2026-10-27__bugfix__billing-boundary-regressions.md`
  - Owner: Codex
  - Branch: `codex/bugfix/billing-contact-errors-20261027`
  - Started: 2026-10-27
  - Summary: Add runnable evidence for original audit boundaries using existing disposable test services; no production financial actions.
  - Tests: A08 3 passed / 1 PostgreSQL-required skip; Q10 Chromium and Firefox-narrow passed against disposable b2e4 runtime with simulated server 401. L-F5 real Enter/Tab after final history batch passed in both browsers with synthetic ledger responses.
  - Risks: Test-only; do not mistake simulated session/provider responses for production acceptance.

- [ ] **[BUG][BILLING]** Preserve configuration drafts during navigation and saving (Q02)
  - Spec: `meta/memory_bank/specs/work_items/2026-10-27__bugfix__billing-draft-safety.md`
  - Owner: Codex
  - Branch: `codex/bugfix/billing-contact-errors-20261027`
  - Started: 2026-10-27
  - Summary: Guard actual billing forms and modal close boundaries, preserve newer draft values and reconcile uncertain price changes before further writes.
  - Tests: Independent baseline reproductions confirmed six data-loss paths; 120/120 focused frontend checks passed. Type check 0 errors / 0 warnings and frontend lint passed. Independent review/full exact-source preflight/release pending.
  - Risks: Root navigation ordering and late writes; no production financial acceptance writes.
# 2026-10-28 verification checkpoint

- [ ] **[BUG][BILLING]** Complete guarded release of contact and draft safety fixes
  - Spec: meta/memory_bank/specs/work_items/2026-10-27__bugfix__billing-draft-safety.md
  - Owner: Codex
  - Started: 2026-10-27
  - Summary: Independent review approved exact e9a149603; 8cc181b7f adds only lifecycle mocks to existing tests. Backend changed files: 28 passed, 1 PostgreSQL-required skip; project-configured Black passes. Installed frontend dependencies match the locked 1169 packages. Full 8cc preflight is running; PR/release/production acceptance remain pending.
  - SDD: Correct the generated spec identifier to the CI-required three-digit suffix and add concrete task file paths. Local validation passes with zero errors/warnings. No application code changed in this documentation correction.

