# Voice recording lifetime

- [x] [BUG] Preserve recorded content and release voice media on failure/cancel/unmount.
  - Spec: meta/memory_bank/specs/work_items/2026-10-07**bugfix**voice-recording-lifetime.md
  - Owner: Codex
  - Done: 2026-10-07
  - Summary: PR353 merged and protected production accepted:15handler/908frontend/74compiled tests pass, all applicable CI; final chunks and web text preserved, owned tracks released. Global goal remains active.

- Source checks:15/15 regressions;908/908frontend; types2962/113,new0;scopedlint0. Web recognition now confirms through one terminal recorder event, preventing loss when recorder stop precedes recognition end. SDD2/3;compiled/CI/production pending;plan198/244,goalactive.

- Final acceptance: SDD3/3, digest `sha256:3c05baa40669b588bbb78b669dfedcdab2d8af1c3e69a6d76c1ad7833e8a36cd`; health/config/data/money/backup/pin verified. Spec contains complete evidence and limits; plan198/244unchanged.
