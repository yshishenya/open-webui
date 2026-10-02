# Branch updates

- [x] [BUG] Preserve registration and profile when Canvas is unavailable
  - Spec: meta/memory_bank/specs/work_items/2026-10-02__bugfix__avatar-canvas-fallback.md
  - Owner: Codex
  - Done: 2026-10-02
  - Summary: Two shared helpers throw on a null 2D context; reuse the existing avatar fallback and verify real isolated browser flows.

  - Verification: PR177 accepted source50a2926fdb03b2d03f5dff2907befcaa6abce973;195 frontend/21 browser checks, zero new diagnostics; released frontend/backend hashes match. SDD2143/3; global diagnostics and overall product acceptance remain open.
