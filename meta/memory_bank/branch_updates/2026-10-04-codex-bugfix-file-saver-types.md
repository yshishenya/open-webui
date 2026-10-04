- [ ] **[BUG]** Restore type information for existing file exports
  - Spec: `meta/memory_bank/specs/work_items/2026-10-04__bugfix__file-saver-types.md`
  - Owner: Codex
  - Started: 2026-10-04
  - Summary: Missing file-saver declarations affect all existing importers; add the documented used contract without runtime/dependency changes.
  - Tests: Full type baseline saved; invalid-argument contract and full frontend checks pending.
  - Risks: Other global type/lint debt remains open.

- 04.10.2026: source contract verified;443 tests, valid calls accepted/3 invalid calls rejected,21 removed type errors/0 added. Strict declaration lint/format passes; runtime files unchanged. Exact-source full checks and PR acceptance pending.
