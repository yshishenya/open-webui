# Work Item: Restore authenticated chat loader

## Metadata

- **Type:** Bug fix
- **Status:** Active
- **Owner:** Codex
- **Branch:** `codex/bugfix/chat-loader-modal-v011`
- **Created:** 2026-08-04
- **Updated:** 2026-08-04
- **SDD Spec:** Not applicable; the change is a one-line import fix with no new subsystem or contract.

## Goal

Restore the authenticated Open WebUI application at `https://chat.airis.you` after the v0.11.0 deployment left the page on an infinite loading state.

## Reproduction and evidence

- The production container is healthy, has no restart loop, and serves `/`, `/welcome`, `/auth`, `/api/config`, and `/health` successfully.
- A real Playwright browser authenticated with a short-lived admin token receives successful API and asset responses but remains with only the skip-link/loading shell rendered.
- The browser reports `BillingBlockedModal is not defined` as a page error.
- The production v0.11.0 source renders `<BillingBlockedModal>` in `src/lib/components/chat/Chat.svelte` but does not import the existing component.

## Root cause

The Svelte client bundle references `BillingBlockedModal` from the chat page template without a module import. The backend and static shell can respond with HTTP 200 while client initialization fails, which presents to users as an endless loader.

## Implementation

Add the existing component import to `src/lib/components/chat/Chat.svelte`:

```svelte
import BillingBlockedModal from '$lib/components/airis/BillingBlockedModal.svelte';
```

Keep the fix limited to the upstream-owned component file. No database, API, environment, dependency, or billing behavior changes are required.

## Upstream impact

One upstream-owned frontend file is touched because the missing import is in the upstream chat component. The diff is intentionally limited to one import and should be easy to carry during the next upstream sync.

## Verification plan

- [x] Reproduce the authenticated loader failure in a real browser.
- [x] Confirm API, asset, container, and reverse-proxy health are not the cause.
- [ ] Run focused frontend checks and production image build.
- [ ] Deploy a uniquely tagged image with the existing production Compose configuration.
- [ ] Re-run authenticated browser smoke test and verify there is no client page error or loading-only state.
- [ ] Verify health endpoints, container state, and recent logs after rollout.

## Rollback

Re-deploy the previous production image tag `yshishenya/yshishenya:v0.11.0-airis-20260803` with the existing production Compose configuration. The change does not alter persistent data or require a rollback migration.

## Completion criteria

The authenticated chat UI renders at `https://chat.airis.you`, the browser reports no `BillingBlockedModal` runtime error, health checks remain green, and this spec plus the branch update record the verification results.
