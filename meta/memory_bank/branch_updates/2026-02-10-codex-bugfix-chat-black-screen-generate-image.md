### Done

- [x] **[BUG][CHAT][UI]** Fix chat black screen caused by `generatingImage` ReferenceError
  - Spec: `meta/memory_bank/specs/work_items/2026-02-10__bugfix__chat-responsemessage-generatingimage-referenceerror.md`
  - Owner: Codex
  - Branch: `codex/bugfix/chat-black-screen-generate-image`
  - Done: 2026-02-10
  - Summary: Define missing image-generation state/handler in `ResponseMessage` so chats render without crashing.
  - Tests: `vitest (docker, --run)`, `vite build (docker, NODE_OPTIONS=--max-old-space-size=4096)`
  - Risks: Low (frontend-only; localized to one component)

