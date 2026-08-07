### In progress

- [ ] **[UX/IA]** Simplify public Airis pages for ordinary users
  - Spec: `meta/memory_bank/specs/work_items/2026-08-07__refactor__public-pages-simple-ux-ia.md`
  - Owner: Codex
  - Branch: `codex/feature/public-pages-simplify`
  - Started: 2026-08-07
  - Summary: Rework non-home public pages around task-first IA, truthful product states, and one clear path into Airis.
  - Tests: `git diff --check`; changed-file ESLint clean; `welcomeNavigation.test.ts` 7/7; `npm run check:rate-card` clean; Playwright smoke file parses/listed (3 tests), full browser run pending local/production server.
  - Risks: Legal content remains complete while presentation is simplified.
