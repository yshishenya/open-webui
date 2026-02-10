### Done

- [x] **[BUG][CHAT][UI]** Fix chat black screen caused by `generatingImage` ReferenceError
  - Spec: `meta/memory_bank/specs/work_items/2026-02-10__bugfix__chat-responsemessage-generatingimage-referenceerror.md`
  - Owner: Codex
  - Branch: `codex/bugfix/chat-black-screen-generate-image`
  - Done: 2026-02-10
  - Summary: Define missing image-generation state/handler in `ResponseMessage` so chats render without crashing.
  - Tests: `vitest (docker, --run)`, `vite build (docker, NODE_OPTIONS=--max-old-space-size=4096)`
  - Risks: Low (frontend-only; localized to one component)

- [x] **[BUG][SDD]** Fidelity-review prompt includes git diff + verify outputs
  - Spec: `meta/memory_bank/specs/work_items/2026-02-10__bugfix__sdd-fidelity-review-prompt-includes-diff-and-verify-output.md`
  - Owner: Codex
  - Branch: `codex/bugfix/chat-black-screen-generate-image`
  - Done: 2026-02-10
  - Summary: Fix `sdd fidelity-review` to include PR-style diffs and verification command evidence; bump default timeout to avoid Codex timeouts.
  - Tests: `meta/tools/sdd fidelity-review chat-responsemessage-generatingimage-2026-02-10-001 --phase phase-1 --ai-tools codex --consensus-threshold 1 --base-branch airis_b2c --format json`
  - Risks: Low (tooling/config-only)
