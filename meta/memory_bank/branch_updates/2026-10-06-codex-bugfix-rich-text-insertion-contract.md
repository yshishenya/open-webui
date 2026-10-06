- [x] **[BUG][EDITOR]** Preserve pasted text and command insertion
  - Spec: `meta/memory_bank/specs/work_items/2026-10-06__bugfix__rich-text-insertion-contract.md`
  - Owner: Codex
  - Started: 2026-10-06
  - Summary: Reproduce shared native editor insertion/lifecycle defects, then repair once for chat/channel/note callers.

  - Update: Compiled Chromium rejected the first candidate on stale DOM cursor after prompt-button focus. Shared native view focus added; Docker677/677 and mapped type3400/150, zero new diagnostics pass. Rebuild/browser/CI/deploy pending.
  - Update: Native plain-copy reproduces full-document HTML and missing hard breaks. Native selected-slice serialization repaired;678/678 frontend, types3396/150,0new; final compiled browsers/CI/deploy pending.

  - Done: 2026-10-06
  - Final: Source e82d481a16ddfca3bd78d64e2addf39cbdb8f10d/PR299 accepted with tested merge tree; native32/frontend678/678/compiled18 paths pass,0new diagnostics. Guarded production healthy/restarts0;4914frontend/426Python equal,ENV/Metrica/13neighbors preserved;public and ordinary readonly browser accepted. SDD2/2 completed. General type/lint baseline and real pilot/payment/human acceptance remain open.
