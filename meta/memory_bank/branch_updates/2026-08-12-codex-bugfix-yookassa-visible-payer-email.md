### Done — implementation ready for delivery

- [ ] **[BUG][BILLING]** Make payer email visible in YooKassa payment description
  - Spec: `meta/memory_bank/specs/work_items/2026-08-12__bugfix__yookassa-visible-payer-email.md`
  - Owner: Codex
  - Branch: `codex/bugfix/yookassa-visible-payer-email`
  - Started: 2026-08-12
  - Summary: Keep email in metadata and add it to the provider-visible description so the payer is identifiable in the YooKassa UI.
  - Tests: `py_compile` and `git diff --check` passed. Targeted pytest is blocked during collection by the existing SQLite SQLAlchemy configuration (`pool_size`/`pool_timeout` with `NullPool`).
  - Risks: Email is intentionally visible in YooKassa payment descriptions.
