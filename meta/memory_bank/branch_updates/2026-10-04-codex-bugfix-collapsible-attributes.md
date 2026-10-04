- [ ] **[BUG][CHAT]** Validate shared detail duration and disclosure contracts
  - Spec: `meta/memory_bank/specs/work_items/2026-10-04__bugfix__collapsible-attributes.md`
  - Owner: Codex
  - Branch: `codex/bugfix/collapsible-attributes`
  - Started: 2026-10-04
  - Summary: Numeric strings work; malformed duration displays a month and negative values display less than a second. Reproduce on the actual component, then repair the shared boundary and its concrete contracts.
  - Tests: dayjs1.11.20 diagnostic; mounted regressions and full comparison pending.
  - Risks: Shared disclosure component used in chat and sidebar; preserve slots, callbacks and all valid labels. Production pending.

2026-10-04 — Source checks:547/547frontend;25mounted checks.20type/3lint removed,0new;4old dir signatures refined. Strict changed files clean. Compiled behavior/CI/production pending; goalactive and plan192/244.
