- [x] **[BUG][CHAT]** Recover failed folder writes without losing the draft
  - Spec: `meta/memory_bank/specs/work_items/2026-10-06__bugfix__folder-save-recovery.md`
  - Owner: Codex
  - Branch: `codex/bugfix/folder-save-recovery`
  - Started: 2026-10-06
  - Summary: Chromium and Firefox reproduce draft loss after HTTP500; trace all five consumers and return the write outcome to the shared modal. Frozen PR272/273 source and candidate remain separate.
  - Tests: Baseline compiled browser reproduction fails2/2; repair and regression checks in progress.
  - Risks: Shared creation/edit contract; preserve accepted writes despite refresh failures and avoid duplicate retries.

- CI follow-up: remove seven pre-existing unused-code diagnostics from the touched consumer; changed-file ESLint passes. Single-worker frontend and final browser acceptance are running. No production mutation.

- Done:2026-10-06. Final source c6e57eb059f599441137868f88e09e9f2edf8bed / PR274 merge658bb54d27bbae098e8fc6f06f6812416c111cc3 accepted.567 frontend tests,32 compiled browser cases, all required CI success,0 new diagnostics. Production digest a11bb79b937d5ba9f81626fed7856affb01c6ff8d9061bbabe8a91389e7110e4 matches5340 application files; ordinary-user rejected save and retry pass. SDD3/3 closed. Earlier pending notes above are historical.
