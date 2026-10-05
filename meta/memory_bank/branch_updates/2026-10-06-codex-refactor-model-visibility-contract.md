- [ ] **[REFACTOR][TYPES]** Describe existing model visibility metadata
  - Spec: `meta/memory_bank/specs/work_items/2026-10-06__refactor__model-visibility-contract.md`
  - Owner: Codex
  - Branch: `codex/refactor/model-visibility-contract`
  - Started:2026-10-06
  - Summary: Add one erased optional field after tracing all readers/setters; preserve actual selection and production behavior.
  - Tests: Full typecheck comparison, compiled JavaScript equality, changed-file ESLint, Docker frontend suite.
  - Risks: Contract only; whole application quality and real pilot remain separate.

- Local verification:3567→3559 type errors/158 warnings,8 removed hidden-field diagnostics and0 added;567/567 frontend tests pass; runtime JavaScript identical with TypeScript5.9.3. Changed-file lint passes; full ESLint1353 and prior whole-file formatting debt remain. Exact source/CI/merge pending.
