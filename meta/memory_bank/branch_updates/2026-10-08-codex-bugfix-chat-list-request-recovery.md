- [ ] **[BUG][CHATLIST]** Recover failed search and sidebar requests
  - Spec: `meta/memory_bank/specs/work_items/2026-10-08__bugfix__chat-list-request-recovery.md`
  - Owner: Codex
  - Started: 2026-10-08
  - Summary: Both actual handlers retain loading after rejected next-page request; search also advances past failed page. Preserve rows and use explicit Retry to prevent Loader loop. Overall198/244 active.

  - Update: 7 regressions/946 frontend tests pass; types2318→2293,new0; scoped lint pass, global1020 open. Compiler exposed reactive cancellation dependency, removed via local cancelSearch. Compiled browser/release pending.
