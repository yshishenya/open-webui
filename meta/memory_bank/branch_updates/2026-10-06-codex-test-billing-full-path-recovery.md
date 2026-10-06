# Billing recovery checks

- [x] **[TEST][BILLING]** Full application recovery paths
  - Spec: `meta/memory_bank/specs/work_items/2026-10-06__test__billing-full-path-recovery.md`
  - Owner: Codex
  - Done: 2026-10-06
  - Summary: Extend the existing disposable external protocols to verify delayed notifications, closed tabs, duplicate callbacks, provider failures and mail retry with real AIRIS persistence.
  - Tests: SQLite24/24 and PostgreSQL24/24 in two browsers; 0 skips/page errors; changed E2E types/lint/format and wrapper Black/Ruff pass. SDD3/3 completed.
  - Risks: Local provider/SMTP and explicit retry scheduling; real settlement/Inbox/phone/pilot and full frontend baseline remain separate. Application unchanged; no deployment needed. PR acceptance pending.
