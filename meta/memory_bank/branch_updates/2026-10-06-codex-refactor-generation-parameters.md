- [x] **[REFACTOR][TYPES]** Describe existing generation parameters in chat
  - Spec: `meta/memory_bank/specs/work_items/2026-10-06__refactor__generation-parameters.md`
  - Owner: Codex
  - Branch: `codex/refactor/generation-parameters`
  - Done: 2026-10-06
  - Summary: Reuse shared types across chat/control panels after tracing load, edit, request and persistence; preserve nullable defaults and custom provider fields.
  - Tests: Strict compiler probe, full Docker frontend/type/lint comparison, full emitted JavaScript equality.
  - Risks: Existing whole-application quality debt and real onboarding acceptance remain separate.

- Local acceptance:567/567 Docker tests;3559→3550 errors/158 warnings,9 removed/0 added;ESLint1353 identical; changed-file lint passes;strict probe4→0; API/client/server JavaScript identical. SDD2/2 closed; PR277 final source b16f1550bee4a77b80207d8c5d1668c36605dcb5 accepted and merged as 867f3bf57244fcd2312409529c3071d761cc7789; ten checks successful/one expected skip, full integration tree matched.
