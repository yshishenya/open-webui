- [x] **[REFACTOR][CHAT]** Reuse concrete chat attachment contracts
  - Spec: `meta/memory_bank/specs/work_items/2026-10-04__refactor__chat-attachment-contracts.md`
  - Owner: Codex
  - Started: 2026-10-04
  - Done: 2026-10-04
  - Summary: Type existing heterogeneous attachments in Chat/input/controls, preserving executable behavior and measuring diagnostic changes.

    04.10.2026: local verification complete. Final scope is Chat/MessageInput/Placeholder and the existing shared descriptor/text-reader types. 493/493 frontend, 8/8 complete executable comparisons identical. Types 3848→3799/164: 57 removed, eight newly exposed in existing statements; full 1419 ESLint unchanged. Controls/FileItem annotations deferred with 14 existing CI lint errors and their runtime repair; optional-field incompatibilities remain documented. Global G14/13.11 is open. SDD 3/3 valid; no runtime deployment needed. Exact-head CI/merge pending.

    04.10.2026: PR253 accepted at16:55:18Z, head74a30c4195c02b979d89159fc4d06052a6f530ec / merge74a4ed6f7fe6ad7f0ce717cb53af2e40e459f5d1; ten unique successful CI checks/one skip, nine files match SHA256. Global goal remains active. Source delivery completed; no runtime deploy.
