- [ ] **[BUG][TYPES]** Restore concrete shared utility contracts
  - Spec: `meta/memory_bank/specs/work_items/2026-10-02__bugfix__shared-utility-types.md`
  - Owner: Codex
  - Branch: `codex/bugfix/shared-utility-types`
  - Started: 2026-10-02
  - Summary: Annotate existing helper inputs/outputs while requiring emitted JavaScript equality apart from three declared lint-only cleanups and no new caller diagnostics.
  - Tests: Docker frontend 166/166 passed, changed-file ESLint zero errors; strict diagnostics 4783 to 4730 with 217 warnings unchanged. Exact-source CI pending.
  - Risks: New caller diagnostics must be addressed; final consolidated runtime release remains separate.

CI SDD policy rejected the generated four-digit suffix. Renamed the spec to the required three-digit suffix; no schema or policy relaxation.
