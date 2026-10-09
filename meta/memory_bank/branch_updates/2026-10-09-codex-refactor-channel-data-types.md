- [ ] **[REFACTOR][CHANNEL]** Type channel list stores against the server response
  - Spec: `meta/memory_bank/specs/work_items/2026-10-09__refactor__channel-store-contracts.md`
  - Owner: Codex
  - Branch: `codex/refactor/channel-data-types`
  - Started: 2026-10-09
  - Summary: Mechanical store/API types; preserve emitted JavaScript. Independent of frozen PR #367.
  - Tests: In progress; full type/lint gate stays open.
  - Risks: Nullable server fields must remain accurately represented.

- Verification 2026-10-09: frontend 946/946; backend 1007 passed/10 skipped/0 failures. Emitted JavaScript unchanged in both runtime modules; 18 type errors removed, zero new type/lint diagnostics. Full typecheck 2275 errors/108 warnings, ESLint 1020, Ruff 6466, Black 417 files remain open. SDD valid. Commit/push prepares review; general quality gate and PR/CI acceptance remain pending.

- PostgreSQL-only follow-up: all 10 previously skipped scenarios passed (0 failures/skips); disposable database removed, no persistent volumes used.
