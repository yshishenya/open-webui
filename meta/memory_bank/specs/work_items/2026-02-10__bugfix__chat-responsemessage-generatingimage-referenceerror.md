# Fix Chat Black Screen: `generatingImage` ReferenceError

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/chat-black-screen-generate-image
- SDD Spec (JSON, required for non-trivial): meta/sdd/specs/completed/chat-responsemessage-generatingimage-2026-02-10-001.json
- Created: 2026-02-10
- Updated: 2026-02-10

## Context

On production, opening some chats results in a black/blank screen. Browser console shows:

- `Uncaught ReferenceError: generatingImage is not defined`

This comes from `ResponseMessage.svelte` referencing `generatingImage` (and calling `generateImage(...)`) without defining either, which can crash the component render when the image generation feature flag is enabled for the user.

## Goal / Acceptance Criteria

- [x] Chat page renders without a runtime `ReferenceError` when image generation is enabled.
- [x] The “Generate Image” action in a response message does not crash the app.
- [x] (Best-effort) Generated images are appended to the message `files` list and persisted via `updateChat()`.

## Non-goals

- Reworking the image generation UX (progress UI, model selection, prompt editing).
- Backend changes to the image generation endpoint.

## Scope (what changes)

- Backend:
  - None
- Frontend:
  - Define `generatingImage` state and implement `generateImage(...)` in `ResponseMessage.svelte`.
- Config/Env:
  - None
- Data model / migrations:
  - None

## Implementation Notes

- Key files/entrypoints:
  - `src/lib/components/chat/Messages/ResponseMessage.svelte`
- Edge cases:
  - Empty response content: show a toast and do nothing.
  - Multiple clicks: ignore while a generation request is in-flight.

## Upstream impact

- Upstream-owned files touched:
  - `src/lib/components/chat/Messages/ResponseMessage.svelte`
- Why unavoidable:
  - The runtime crash is caused by an undefined identifier in this component template.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Keep the change minimal: local state + a small handler, no refactors.

## Verification

- Frontend tests:
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/vitest ]; then npm ci --legacy-peer-deps; fi; npm run test:frontend -- --run"`
- Frontend build (OOM-safe):
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps -e NODE_OPTIONS=--max-old-space-size=4096 airis-frontend sh -lc "npm run build:vite"`

## Task Entry (for branch_updates/current_tasks)

- [x] **[BUG][CHAT][UI]** Fix chat black screen caused by `generatingImage` ReferenceError
  - Spec: `meta/memory_bank/specs/work_items/2026-02-10__bugfix__chat-responsemessage-generatingimage-referenceerror.md`
  - Owner: Codex
  - Branch: `codex/bugfix/chat-black-screen-generate-image`
  - Done: 2026-02-10
  - Summary: Define missing image-generation state/handler in `ResponseMessage` so chats render without crashing.
  - Tests: `vitest (docker, --run)`, `vite build (docker, NODE_OPTIONS=--max-old-space-size=4096)`
  - Risks: Low (frontend-only; localized to one component)

## Risks / Rollback

- Risks:
  - Appending generated images to `message.files` may not fully match existing file item shape (but should be safe for rendering).
- Rollback plan:
  - Revert the `ResponseMessage.svelte` change; as a stop-gap, remove the “Generate Image” button block entirely.
