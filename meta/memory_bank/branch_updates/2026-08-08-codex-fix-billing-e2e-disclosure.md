### Done

- [x] **[BUG][CI][BILLING]** Align billing E2E disclosure assertions with collapsed wallet UX
  - Spec: `meta/memory_bank/specs/work_items/2026-08-08__bugfix__billing-e2e-disclosure-expectations.md`
  - Owner: Codex
  - Branch: `codex/fix-billing-e2e-disclosure`
  - Done: 2026-08-08
  - Summary: Fixed stale expanded-state expectations and replaced the dynamic accessible-name locator with a stable disclosure selector.
  - Tests: esbuild syntax validation; git diff check; GitHub billing confidence E2E pending.
  - Risks: Low; test-only.

- [x] **[BUG][CI][BILLING]** Stabilize shared E2E startup and wallet readiness
  - Spec: `meta/memory_bank/specs/work_items/2026-08-08__bugfix__billing-e2e-disclosure-expectations.md`
  - Owner: Codex
  - Branch: `codex/fix-billing-e2e-disclosure`
  - Done: 2026-08-08
  - Summary: Wait for the asynchronous release-notes modal before dismissing it in global setup and wait for the mocked balance response before asserting the wallet hero.
  - Tests: esbuild syntax validation; git diff check; GitHub billing confidence E2E after push.
  - Risks: Low; test-only synchronization.
