- [ ] **[BUG][CHAT]** Validate shared detail duration and disclosure contracts
  - Spec: `meta/memory_bank/specs/work_items/2026-10-04__bugfix__collapsible-attributes.md`
  - Owner: Codex
  - Branch: `codex/bugfix/collapsible-attributes`
  - Started: 2026-10-04
  - Summary: Numeric strings work; malformed duration displays a month and negative values display less than a second. Reproduce on the actual component, then repair the shared boundary and its concrete contracts.
  - Tests: dayjs1.11.20 diagnostic; mounted regressions and full comparison pending.
  - Risks: Shared disclosure component used in chat and sidebar; preserve slots, callbacks and all valid labels. Production pending.

2026-10-04 — Source checks:547/547frontend;25mounted checks.20type/3lint removed,0new;4old dir signatures refined. Strict changed files clean. Compiled behavior/CI/production pending; goalactive and plan192/244.

2026-10-04 20:25 UTC — Source SDD3/3 closed after547frontend/25mounted/16compiled full paths and4actual browser proofs (0pageerrors). CI b5bf88b25d9bbcad3a32869d54fd59ace9421c7c:10success,dependency-review skipped;CodeRabbit disabled. Compiled slots,Controls,Sidebar,Playground accepted. Runtime source c9a8c940893a91e9c33c0bacbdba349b4cde6ad2;subsequent changes docs only. Merge/production remain pending;full goal active192/244.
