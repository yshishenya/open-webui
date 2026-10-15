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

- [ ] [BUG] Exact-source candidate verification is in progress
  - Spec: meta/memory_bank/specs/work_items/2026-10-09__bugfix__sidebar-lifecycle-cleanup.md
  - Owner: Codex
  - Started: 2026-10-09
  - Summary: f21 native/file/package checks and Chromium43/43 pass. Focused test now captures a document marker per cycle and also asserts the existing intentional public-to-app reload; teardown and pin persistence checks remain. Firefox390px and production release pending; global quality gates open.

- [ ] [BUG][BILLING] Keep top-up preset under pointer while totals load
  - Spec: meta/memory_bank/specs/work_items/2026-10-09__bugfix__wallet-period-layout.md
  - Owner: Codex
  - Started: 2026-10-09
  - Summary: Native Firefox check reproduces236px shift on f21. Shared loading/result markup preserves3slots; component fails before and passes after.
  - Tests:951/951 frontend; check2289/108 and ESLint1020 unchanged. New clean candidate44+44 browser checks/release pending. f21 rejected.

- [ ] [BUG][BILLING] Preserve top-up controls when period API refuses
  - Spec: meta/memory_bank/specs/work_items/2026-10-09__bugfix__wallet-period-layout.md
  - Owner: Codex
  - Started: 2026-10-09
  - Summary: d0e rejected by native58px error transition. Keep3amount nodes and reserve natural caption height with CSS grid; old totals are hidden after invalid dates.
  - Tests:6/6 focused source and952/952 frontend; scoped format/lint passed. Check2289/108 and ESLint1020 unchanged; global gates open. New candidate focused6/full90/cold3 and release pending.
