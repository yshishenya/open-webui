# Branch updates

- [x] **[FEATURE][ONBOARDING]** Public first task guide and explicit model links
  - Spec: `meta/memory_bank/specs/work_items/2026-10-01__feature__first-task-guide.md`
  - Owner: Codex
  - Branch: `codex/feature/first-task-guide`
  - Done: 2026-10-02
  - Summary: Reuse public layout and existing draft/auth navigation; prevent unavailable model links from silently choosing a default.
  - Tests: Docker frontend 33 files / 130 passed; changed-file ESLint/Prettier, production build, Firefox 7/7 and final Chromium 7/7 passed. Baseline full typecheck/lint failures disclosed in spec. SDD completed; production and real-model/human acceptance remain open.
  - Risks: Explicit unavailable model selection requires the user to choose a replacement.
