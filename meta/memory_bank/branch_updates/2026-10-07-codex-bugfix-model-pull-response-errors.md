- [ ] **[BUG]** Settle model pulls after rejected or empty responses
  - Spec: `meta/memory_bank/specs/work_items/2026-10-07__bugfix__model-pull-response-errors.md`
  - Owner: Codex
  - Started: 2026-10-07
  - Summary: Trace all3 callers; prevent null destructuring/body reads, stuck loading and misleading update success.
  - Tests: Original8fail/4pass; after15/15 incl stream error/cancellation, full706/706;types3393→3388/141warnings,lint1277 unchanged,0new messages.
  - Risks: Changes model download error handling; requires compiled browser/release acceptance, no real model download.

  - Updated source checks: full706/706;types3379/131warnings;lint1236;0new normalized diagnostics, changed-file formatting/lint pass.

  - Browser found empty readable stream incorrectly accepted by update-all; native success marker now required. Original1failed/17passed; corrected18/18/full709/709, types3379/131 unchanged. Earlier compiled candidate rejected; final browser/release pending.
