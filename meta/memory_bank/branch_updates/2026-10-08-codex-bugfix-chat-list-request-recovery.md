- [x] **[BUG][CHATLIST]** Recover failed search and sidebar requests
  - Spec: `meta/memory_bank/specs/work_items/2026-10-08__bugfix__chat-list-request-recovery.md`
  - Owner: Codex
  - Started: 2026-10-08
  - Summary: Both actual handlers retain loading after rejected next-page request; search also advances past failed page. Preserve rows and use explicit Retry to prevent Loader loop. Overall198/244 active.

  - Update: 7 regressions/946 frontend tests pass; types2318→2293, new: 0; scoped lint pass, global1020 open. Compiler exposed reactive cancellation dependency, removed via local cancelSearch. Compiled browser/release pending.

  - Done: 2026-10-09
  - Summary: PR363/source5e2a8c06169e6111fdc9576629acb8841f66a8cb merged as a7b2de933f4e88eff087784dfb6cf92d1e59a412 with equal trees. Healthy guarded release08845b48cc with11backup files,496raw backend/4915frontend/427Python, 12 neighbors/money/ENV/mounts retained; pin has no second recreation.946 frontend + 84 browser + 7 handler/compiler tests pass. Global types: 2293/108 and lint: 1020 remain open, new: 0. SDD 4/4 closed;whole plan: 198/244 active.
  - Storage: Adopt new clean-image and 80 GiB local reserve rules for subsequent builds. Clean accepted temporary copies after preserving reports/private tests/traces; no volume/worktree/user-backup removal.
