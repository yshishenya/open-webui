### Done

- [x] **[PUBLIC-PAGES]** Redesign Airis public pages around one clear user journey
  - Spec: `meta/memory_bank/specs/work_items/2026-08-07__feature__public-airis-pages-redesign.md`
  - Owner: Codex
  - Branch: `codex/bugfix/welcome-navigation-routes`
  - Started: 2026-08-07
  - Summary: Unify welcome, features, pricing, company, support, documents, and legal pages around the Airis purple visual system and truthful product messaging.
  - Tests: Targeted Vitest 10/10 passed; full frontend suite 97/98 passed with one unrelated stale admin navigation regression; production build passed with `NODE_OPTIONS=--max-old-space-size=8192`; route smoke returned 200 for all public routes.
  - Risks: Shared public layout changes affect all marketing and document routes; mitigated with targeted tests, `git diff --check`, route smoke, and build verification.
  - Completed: 2026-08-07
