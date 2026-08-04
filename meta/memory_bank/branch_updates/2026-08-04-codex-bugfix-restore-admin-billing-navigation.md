### Done

- [x] **[BUG]** Restore admin billing navigation
  - Spec: `meta/memory_bank/specs/work_items/2026-08-04__bugfix__restore-admin-billing-navigation.md`
  - Owner: Codex
  - Branch: `codex/bugfix/restore-admin-billing-navigation`
  - Done: 2026-08-04
  - Summary: Restored Analytics and Airis billing links in the v0.11.0 admin navigation while preserving the deployed loader fix. Production is running `airis:admin-nav-v011-20260804` and is healthy.
  - Tests: Docker Compose Vitest 19 files / 88 tests passed; targeted ESLint and Prettier passed; production Playwright smoke passed; typecheck baseline remains documented in the spec.
  - Risks: Frontend-only admin layout change; rollback is an image tag switch.
