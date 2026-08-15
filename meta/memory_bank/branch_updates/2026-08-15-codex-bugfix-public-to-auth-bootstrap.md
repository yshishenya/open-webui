# Branch Updates — public-to-auth bootstrap

### Done

- [x] **[BUGFIX]** Restore auth bootstrap after public-page navigation
  - Spec: `meta/memory_bank/specs/work_items/2026-08-15__bugfix__public-to-auth-bootstrap.md`
  - Owner: Codex
  - Branch: `codex/bugfix/public-to-auth-bootstrap`
  - Started: 2026-08-15
  - Summary: Preserve fast public landing loads while correctly bootstrapping auth and app routes after navigation.
  - Tests: focused Vitest, changed-file ESLint, local and production Playwright smoke passed; `/welcome` made zero config requests, `/welcome` → `/auth` made one, and all configured providers rendered. Repository-wide typecheck has pre-existing failures.
  - Risks: one full document navigation when crossing from marketing pages into the product.
  - Production: `yshishenya/yshishenya:33c909b9acf707689107cdbe2b42c444cb25e97f` (`sha256:e71361a282936b9d891d41926e55072dcab5703e09faeb78f389c32eb8681c8c`), healthy with zero restarts.
  - Backup: `/opt/backups/airis/20260815T140753Z-33c909b9acf707689107cdbe2b42c444cb25e97f`.
  - Done: 2026-08-15
