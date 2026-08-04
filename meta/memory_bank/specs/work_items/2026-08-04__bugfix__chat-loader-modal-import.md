# Work Item: Restore authenticated chat loader

## Metadata

- **Type:** Bug fix
- **Status:** Completed
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
- [x] Run focused frontend checks and production image build.
- [x] Deploy a uniquely tagged image with the existing production Compose configuration.
- [x] Re-run authenticated browser smoke test and verify there is no client page error or loading-only state.
- [x] Verify health endpoints, container state, and recent logs after rollout.

## Verification results

- Frontend Vitest passed: 18 files and 87 tests.
- Full `svelte-check` reported 8,430 existing diagnostics across 351 files; the result is a repository baseline failure, not an import-specific failure.
- Focused ESLint for `Chat.svelte` reported 16 existing errors (`no-undef`, empty block, and Svelte self-closing markup); no error was introduced for the new import.
- `npm run build:vite` completed successfully in 18m53s with sourcemaps disabled and a temporary 6 GiB swap file. The swap was disabled and removed after the build.
- The deploy image was built from the existing production image without changing backend layers or data volumes: `airis:chat-loader-v011-20260804`, digest `sha256:91eb5c1b8fcc06b0f214fe498fe71ccdc7d6d71e211713e28b222729a6537515`.
- Production was recreated for only the `airis` service with `--pull never`; Postgres and persistent volumes were left unchanged. The container is healthy with zero restarts.
- Public Playwright smoke test at `https://chat.airis.you/` completed with `readyState=complete`, a rendered main element, zero loading nodes, no page errors, and no failed requests.

Two earlier full Docker build attempts were stopped after host memory pressure (one reached the Node heap limit and one was SIGKILLed). The production service was recovered on the original image before the successful isolated frontend build; the original image remains available for rollback.

## Rollback

Re-deploy the previous production image tag `yshishenya/yshishenya:v0.11.0-airis-20260803` with the existing production Compose configuration. The change does not alter persistent data or require a rollback migration.

## Completion criteria

The authenticated chat UI renders at `https://chat.airis.you`, the browser reports no `BillingBlockedModal` runtime error, health checks remain green, and this spec plus the branch update record the verification results.
