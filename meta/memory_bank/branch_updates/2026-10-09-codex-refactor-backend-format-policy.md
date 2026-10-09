- [ ] **[REFACTOR][QUALITY]** Apply the existing backend formatting policy
  - Spec: `meta/memory_bank/specs/work_items/2026-10-09__refactor__backend-format-policy.md`
  - Owner: Codex
  - Branch: `codex/refactor/backend-format-policy`
  - Started: 2026-10-09
  - Summary: Correct the formatter's configuration mount and format only required Python files, proving unchanged syntax trees.
  - Tests: In progress; G14 and release acceptance remain open.
  - Risks: Mechanical upstream diff; no runtime or dependency changes.

- Source verification: 453 Python ASTs unchanged, 105 mechanical source changes. Black 26.10.0: 453/453 pass. Ruff 6466 -> 2956, 3510 removed/0 added, Q000 0. Full backend 1017/1017 on fresh disposable PostgreSQL databases, frontend 946/946; no failures/skips. Full frontend check 2293/108 and ESLint 1020 stay open. Existing native audio check, frontend and lockfiles unchanged. Temporary databases removed. Correct configured earlier Black debt was 69 files rather than 417.
