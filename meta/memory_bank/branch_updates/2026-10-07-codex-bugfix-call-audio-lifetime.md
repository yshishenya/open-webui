- [x] **[BUG][VOICE]** Release microphone when a voice call closes
  - Spec: meta/memory_bank/specs/work_items/2026-10-07**bugfix**call-audio-lifetime.md
  - Owner: Codex
  - Done: 2026-10-07
  - Summary: Reproduced late microphone permission after close. Preserve complete phrase bytes and normal overlapping transcription while releasing owned media resources.

  - Acceptance: Source b34184a147cc344d95336cd01923aebdc253dc91; integration tree identical; frontend 921/921 and compiled browsers 76/76. Applicable CI, protected production, 11-file backup/rollback, money/config/data/12 neighbors and pin accepted. Full global quality and physical/human gates remain open.
