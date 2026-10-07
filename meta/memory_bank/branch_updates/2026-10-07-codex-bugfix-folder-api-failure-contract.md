- [ ] **[BUG][CHAT]** Preserve folder API failures and loaded folders
  - Spec: `meta/memory_bank/specs/work_items/2026-10-07__bugfix__folder-api-failure-contract.md`
  - Owner: Codex
  - Branch: `codex/bugfix/folder-api-failure-contract`
  - Started: 2026-10-07
  - Summary: Fix the aborted-request null-sort crash detected in the mandatory Firefox free-task path, retaining loaded folder data.
  - Tests: In progress; original compiled failure trace retained.
  - Risks: Formerly swallowed transport failures now reject; inspect every caller.

- 2026-10-07: Source fix and focused regression accepted13/13; fullfrontend881/881. Check3040→3005/118warnings; fullESLint1158unchanged/0newdiagnostics. Compiledbrowser/productionpending,SDDactive. OriginalFirefoxtrace retained.
