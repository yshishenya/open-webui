# Voice recording lifetime

- [ ] [BUG] Preserve recorded content and release voice media on failure/cancel/unmount.
  - Spec: meta/memory_bank/specs/work_items/2026-10-07__bugfix__voice-recording-lifetime.md
  - Owner: Codex
  - Started: 2026-10-07
  - Summary: Four callers traced; native event ordering and ownership regression under investigation. Global goal remains active.

- Source checks:15/15 regressions;908/908frontend; types2962/113,new0;scopedlint0. Web recognition now confirms through one terminal recorder event, preventing loss when recorder stop precedes recognition end. SDD2/3;compiled/CI/production pending;plan198/244,goalactive.
