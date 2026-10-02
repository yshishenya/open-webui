# Branch updates

- [ ] **[BUG][UI]** Preserve profile photo when Canvas is unavailable
  - Spec: meta/memory_bank/specs/work_items/2026-10-02__bugfix__profile-photo-canvas.md
  - Owner: Codex
  - Branch: codex/bugfix/profile-photo-canvas
  - Started: 2026-10-02
  - Summary: Shared upload callback fails at drawImage in both account and administrator forms; preserve previous photo and enable retry with the existing error message.
  - Tests: Original callback failure reproduced; regression and release pending.
  - Risks: Low; shared upload path, existing crop and API contracts retained.
