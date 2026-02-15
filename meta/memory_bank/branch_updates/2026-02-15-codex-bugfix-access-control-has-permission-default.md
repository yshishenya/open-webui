### Done

- [x] **[BUG]** Fix mutable default in access control has_permission()
  - Spec: `meta/memory_bank/specs/work_items/2026-02-15__bugfix__access-control-has-permission-mutable-default.md`
  - Owner: codex (gpt-5.3-codex)
  - Branch: `codex/bugfix/access-control-has-permission-default`
  - Done: 2026-02-15
  - Summary: Prevent cross-request state leakage in permission checks by removing mutable defaults and adding regression coverage.
  - Tests: `npm run docker:test:backend`
  - Risks: Low; localized change covered by tests.
