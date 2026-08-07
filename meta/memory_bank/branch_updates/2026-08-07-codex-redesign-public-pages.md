### Done

- [x] **[REFACTOR][UI][PUBLIC]** Centralize Airis public-page design system
  - Spec: `meta/memory_bank/specs/work_items/2026-08-07__refactor__public-airis-design-system.md`
  - Owner: Codex
  - Branch: `codex/redesign/public-pages`
  - Done: 2026-08-07
  - Summary: Unify public and legal routes around the Airis deep-violet shell, shared navigation/CTA/footer tokens, and consistent brand spelling without changing product behavior or legal copy.
  - Tests: `git diff --check`; `npm run check` (pre-existing repo-wide diagnostics); `npm run build:vite` (local heap limit); in-app route smoke test passed.
  - Risks: Low-Medium (shared public shell CSS); mitigated by scoping styles to public route boundaries and visual route checks.
