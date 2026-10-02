- [x] **[BUG][TYPES]** Restore concrete shared utility contracts
  - Spec: `meta/memory_bank/specs/work_items/2026-10-02__bugfix__shared-utility-types.md`
  - Owner: Codex
  - Branch: `codex/bugfix/shared-utility-types`
  - Done: 2026-10-02
  - Summary: Annotate existing helper inputs/outputs while requiring emitted JavaScript equality apart from three declared lint-only cleanups and no new caller diagnostics.
  - Tests: Docker frontend 166/166 passed, changed-file ESLint zero errors; strict diagnostics 4783 to 4730 with 217 warnings unchanged. All 12 observed statuses accepted on b174357f60c7217df9b385d2542ff7b897eba6c4; PR170 merged 118593fea32ea3aa93742fe79e71e08c1fbc8be3. SDD212 closed 3/3.
  - Risks: New caller diagnostics must be addressed; final consolidated runtime release remains separate.

CI SDD policy rejected the generated four-digit suffix. Renamed the spec to the required three-digit suffix; no schema or policy relaxation.
