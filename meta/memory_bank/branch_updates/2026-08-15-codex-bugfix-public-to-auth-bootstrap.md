# Branch Updates — public-to-auth bootstrap

### In progress

- [ ] **[BUGFIX]** Restore auth bootstrap after public-page navigation
  - Spec: `meta/memory_bank/specs/work_items/2026-08-15__bugfix__public-to-auth-bootstrap.md`
  - Owner: Codex
  - Branch: `codex/bugfix/public-to-auth-bootstrap`
  - Started: 2026-08-15
  - Summary: Preserve fast public landing loads while correctly bootstrapping auth and app routes after navigation.
  - Tests: focused Vitest, changed-file ESLint, and local Playwright smoke passed; repository-wide typecheck has pre-existing failures.
  - Risks: one full document navigation when crossing from marketing pages into the product.
