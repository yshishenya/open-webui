- [ ] **[BUG][CHAT]** Release owned sidebar resources on teardown
  - Spec: `meta/memory_bank/specs/work_items/2026-10-09__bugfix__sidebar-lifecycle-cleanup.md`
  - Owner: Codex
  - Branch: codex/bugfix/sidebar-lifecycle-cleanup
  - Started: 2026-10-09
  - Summary: Reproduce ignored async mount destructor, then correct lifecycle ownership using existing APIs.
  - Tests: Before reproduction failed; after 3/3 regression cases and full frontend 949/949 passed. Check 2292/108, ESLint1020, new normalized diagnostics0. Candidate/browser/release pending.
  - Risks: Preserve tick ordering and prevent initialization after teardown.

- [ ] [BUG] Browser-discovered sidebar DOM replacement is in progress
  - Spec: meta/memory_bank/specs/work_items/2026-10-09__bugfix__sidebar-lifecycle-cleanup.md
  - Owner: Codex
  - Started: 2026-10-09
  - Summary: Candidate31e rejected by pin-order browser check. Native Svelte actions now bind Sortable/drop handlers to live elements;3/3 actual-source regression cases passed, new full/browser/release verification pending.

- [ ] [BUG] Hidden pin ordering is in progress
  - Spec: meta/memory_bank/specs/work_items/2026-10-09__bugfix__sidebar-lifecycle-cleanup.md
  - Owner: Codex
  - Started: 2026-10-09
  - Summary: Actual callback reproduced visible-order failure with a hidden middle item. Use reordered DOM ids while preserving hidden slots; candidatea2e superseded, new source verification pending.
