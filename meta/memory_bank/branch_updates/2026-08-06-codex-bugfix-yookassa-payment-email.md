### Done

- [x] **[BUG][BILLING]** Include user email in YooKassa payment metadata
  - Spec: `meta/memory_bank/specs/work_items/2026-08-06__bugfix__yookassa-payment-email.md`
  - Owner: Codex
  - Branch: `codex/bugfix/yookassa-payment-email`
  - Done: 2026-08-06
  - Summary: Added the account email to subscription, top-up, and auto-top-up YooKassa metadata for payer identification.
  - Tests: `python -m py_compile ...`; `git diff --check`; pytest blocked by local test environment configuration.
  - Risks: Email becomes visible in YooKassa payment metadata.
