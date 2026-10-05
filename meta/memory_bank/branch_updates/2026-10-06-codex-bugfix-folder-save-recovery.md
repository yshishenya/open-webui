- [ ] **[BUG][CHAT]** Recover failed folder writes without losing the draft
  - Spec: `meta/memory_bank/specs/work_items/2026-10-06__bugfix__folder-save-recovery.md`
  - Owner: Codex
  - Branch: `codex/bugfix/folder-save-recovery`
  - Started: 2026-10-06
  - Summary: Chromium and Firefox reproduce draft loss after HTTP500; trace all five consumers and return the write outcome to the shared modal. Frozen PR272/273 source and candidate remain separate.
  - Tests: Baseline compiled browser reproduction fails2/2; repair and regression checks in progress.
  - Risks: Shared creation/edit contract; preserve accepted writes despite refresh failures and avoid duplicate retries.

- CI follow-up: remove seven pre-existing unused-code diagnostics from the touched consumer; changed-file ESLint passes. Single-worker frontend and final browser acceptance are running. No production mutation.
