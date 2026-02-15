### Done

- [x] **[BUG]** Prevent Docker dev/test from mutating git-tracked static
  - Spec: `meta/memory_bank/specs/work_items/2026-02-15__bugfix__docker-dev-static-dir-no-clobber.md`
  - Owner: codex (gpt-5.3-codex)
  - Branch: `codex/bugfix/docker-static-dir-no-clobber`
  - Done: 2026-02-15
  - Summary: Route static sync output to a data volume path to keep repo clean during docker test runs.
  - Tests: `npm run docker:test:backend`, `npm run billing:confidence:merge-medium`
  - Risks: Low; dev-only env var in compose overlay.
