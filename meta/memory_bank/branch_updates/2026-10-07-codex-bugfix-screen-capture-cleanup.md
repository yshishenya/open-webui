- [ ] **[BUG][CHAT]** Release screen capture resources on every outcome
  - Spec: `meta/memory_bank/specs/work_items/2026-10-07__bugfix__screen-capture-cleanup.md`
  - Owner: Codex
  - Branch: `codex/bugfix/screen-capture-cleanup`
  - Started: 2026-10-07
  - Summary: Fix the reproduced display-stream leak at the common desktop capture handler, before image conversion or upload.
  - Tests: Actual-handler failure reproduction retained; verification in progress.
  - Risks: Preserve copied frame, native constraints and successful PNG attachment behavior.

## Source verification — 2026-10-07

Actual-handler regression: original7failed/1passed, fixed8/8passed. Full frontend891/891,108files. Check3004→3002errors/118warnings; fullESLint1127unchanged; zero new diagnostics. Scoped lint0 after declaring the native MediaTrackConstraints ambient type as readonly; no rules weakened. Compiled browser scenario added for real menu invocation with disposable media doubles; no real device/permission accessed. Source/CI/compiled/production acceptance remain separate, SDDactive. No business criteria closed.
