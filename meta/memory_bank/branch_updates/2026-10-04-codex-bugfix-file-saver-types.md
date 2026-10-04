- [x] **[BUG]** Restore type information for existing file exports
  - Spec: `meta/memory_bank/specs/work_items/2026-10-04__bugfix__file-saver-types.md`
  - Owner: Codex
  - Done: 2026-10-04
  - Summary: Missing file-saver declarations affect all existing importers; add the documented used contract without runtime/dependency changes.
  - Tests: Full type baseline saved; invalid-argument contract and full frontend checks pending.
  - Risks: Other global type/lint debt remains open.

- 04.10.2026: source contract verified;443 tests, valid calls accepted/3 invalid calls rejected,21 removed type errors/0 added. Strict declaration lint/format passes; runtime files unchanged. Exact-source full checks and PR acceptance pending.

- 04.10.2026: PR234 source e35a66e55073ffd2e894d22c513878ce97ce13c7 accepted; merge 2ef78e24ce32d6a880d5c4dbc2c45dcba061686f,10CI success/1skip. All21 missing declaration errors removed/0added;443tests pass. No runtime/dependency change or redeploy.
