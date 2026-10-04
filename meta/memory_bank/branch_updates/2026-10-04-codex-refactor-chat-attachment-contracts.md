- [ ] **[REFACTOR][CHAT]** Reuse concrete chat attachment contracts
  - Spec: meta/memory_bank/specs/work_items/2026-10-04**refactor**chat-attachment-contracts.md
  - Owner: Codex
  - Started: 2026-10-04
  - Summary: Type existing heterogeneous attachments in Chat/input/controls, preserving executable behavior and measuring diagnostic changes.

  04.10.2026: local verification complete. 493/493 frontend, 14/14 complete executable comparisons identical. Types 3848→3782/164: 73 removed, one refined, seven newly exposed in existing statements; full 1419 ESLint unchanged. Known optional-field incompatibilities remain documented; global G14/13.11 is open. SDD 3/3 valid; no runtime deployment needed. Exact-head CI/merge pending.
