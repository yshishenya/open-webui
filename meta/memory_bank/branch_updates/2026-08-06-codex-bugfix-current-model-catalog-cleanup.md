# Branch Updates: codex/bugfix/current-model-catalog-cleanup

## Done

- [x] **[BUGFIX]** Clean up production public model catalog
  - Spec: `meta/memory_bank/specs/work_items/2026-08-06__bugfix__current-model-catalog-cleanup.md`
  - Owner: Codex
  - Branch: `codex/bugfix/current-model-catalog-cleanup`
  - Started: 2026-08-06
  - Summary: Production now exposes exactly 18 current models. Qwen 3.7 Plus replaced Qwen 3.5 Plus, defaults/order were normalized, and historical chats/rates were preserved.
  - Tests: validated pre/post dumps; public catalog assertion; DB/config/count assertions; Qwen 3.7 completion HTTP 200 with content; health and authenticated browser smoke tests
  - Risks: production catalog and billing configuration; protected by validated backups and a single transaction.
  - Done: 2026-08-06
