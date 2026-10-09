- [ ] **[REFACTOR]** Review unused import statements
  - Spec: meta/memory_bank/specs/work_items/2026-10-09**refactor**unused-import-statements.md
  - Owner: Codex
  - Started: 2026-10-09
  - Summary: Remove only reviewed unused bindings; preserve initialization, contracts and existing production. General quality/release remain open.

  - Source accepted: 2026-10-09;135 bindings removed,2 actual reexports preserved,7 initialization imports retained. Ruff880→739 with0 new; backend1017/frontend952 and source/runtime contracts pass.
  - Release: Pending; frontend check2271/108/ESLint1020 and general Ruff739 remain unsuccessful. No PR/CI/merge/deploy claim; onboarding plan198/244.
