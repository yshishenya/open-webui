### Done

- [x] **[UI][BILLING]** Simplify wallet balance and transaction history
  - Spec: `meta/memory_bank/specs/work_items/2026-08-07__feature__billing-balance-history-simplify.md`
  - Owner: Codex
  - Branch: `codex/feature/billing-balance-history-simplify`
  - Started: 2026-08-07
  - Summary: Reduce billing visual density while preserving top-up, balance, free-limit, advanced-settings, and history behavior.
  - Tests: `npm run test:frontend -- --run` (27 files, 104 tests); production browser smoke and filter regression passed with zero console errors.
  - Risks: Shared timeline markup changes wallet preview and history presentation; covered by focused tests and browser QA.

- [x] **[REFACTOR][UI][PUBLIC]** Replace misleading company page with a factual Airis project page
  - Spec: `meta/memory_bank/specs/work_items/2026-08-07__refactor__public-about-project-page.md`
  - Owner: Codex
  - Branch: `codex/feature/billing-balance-history-simplify`
  - Done: 2026-08-07
  - Summary: Rewrote `/about` as a concise project explanation, removed unsupported company claims, and renamed shared navigation labels to `О проекте` while keeping the URL stable.
  - Tests: `git diff --check`; targeted frontend lint; production `/about` route smoke after deployment.
  - Risks: Low (copy and shared labels only; no API or auth behavior changed).
