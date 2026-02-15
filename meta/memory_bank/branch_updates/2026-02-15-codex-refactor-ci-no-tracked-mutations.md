### In progress

- [ ] **[REFACTOR][CI]** Guard against test runs mutating git-tracked files
  - Spec: `meta/memory_bank/specs/work_items/2026-02-15__refactor__ci-guard-no-tracked-mutations.md`
  - Owner: codex (gpt-5.3-codex)
  - Branch: `codex/refactor/ci-no-tracked-mutations`
  - Started: 2026-02-15
  - Summary: Add `git diff --exit-code` guards to CI workflows to catch tracked-file mutations (e.g. static clobber).
  - Tests: pending
  - Risks: Low (CI-only).

