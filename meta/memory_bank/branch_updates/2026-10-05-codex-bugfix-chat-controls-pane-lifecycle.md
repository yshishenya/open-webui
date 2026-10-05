- [x] **[BUG][CHAT]** Verify pane restoration across responsive breakpoints
  - Spec: `meta/memory_bank/specs/work_items/2026-10-05__bugfix__chat-controls-pane-lifecycle.md`
  - Owner: Codex
  - Branch: `codex/bugfix/chat-controls-pane-lifecycle`
  - Done: 2026-10-05
  - Summary: Trace the actual pane/drawer lifecycle and parent subscription; reproduce before changing application code.
  - Tests: Pending browser reproduction and pinned-library lifecycle verification.

- Source verification: confirmed production reproduction; baseline regression fails; 6 focused and 553 full frontend tests pass. 0 new mapped type or ESLint diagnostics; 9 type errors removed. Candidate, exact-head CI and production acceptance pending.

- Additional live acceptance found terminal selection replay on every desktop breakpoint: closed panel reopened. Task remains active. Two regression cases fail on c81f19976; after isolating selection reactivity, 8 focused / 555 complete frontend tests pass and 0 new mapped type diagnostics. Public release acceptance is not closed.

- Final: PR265 source `aa68736a977668e9a44eed1c9bd9612be6c6225a`, merge `a85348a86a7d60e09646a284cfbcc804baf65a4e`; 10 CI success / 1 skip, equal trees. Final candidate/production accepted: 555 frontend, 20 browser paths, selected-terminal open/closed breakpoint; original SDD 2/2 closed. See `meta/memory_bank/specs/work_items/2026-10-05__docs__pane-lifecycle-release-acceptance.md`.
