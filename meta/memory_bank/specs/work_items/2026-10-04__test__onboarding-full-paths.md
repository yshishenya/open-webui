# Complete onboarding paths and chat return after payment

## Meta

- Type: bugfix + test; new_feature.md and bug_fix.md
- Status: done; source and production accepted, follow-up documentation tracked separately
- Owner: Codex
- Branch: codex/bugfix/onboarding-return-paths
- SDD Spec: meta/sdd/specs/completed/airis-onboarding-full-paths-2026-10-04-001.json

## Requirement and scope

Close the two automated browser gaps identified by the mandatory scenario audit. Exercise the compiled application, real authentication, APIs, persistence, billing and durable email queue. Replace only external model/payment services and SMTP with bounded local fixtures. Never use production credentials, recipients, credit or consent. Fixtures must refuse to start unless explicitly enabled in a disposable test application.

## Acceptance

- [x] All three guide tasks survive login without auto-send; an ordinary user explicitly sends and sees a completed answer. Provider input/output exactly match persisted usage and free quota; wallet and money ledger remain unchanged.
- [x] Provider failure records no completed task, consumes no quota and changes no money.
- [x] Browser starts checkout with an ordinary verified account; pending provider state gives zero credit and zero credited notices. Local provider success returns to the wallet, applies one exact credit, updates visible history and submits exactly one captured service email with Reply-To.
- [x] Reconcile and queue replay create zero extra credits, ledger rows or credited messages. Artificial recipients remain exclusively in local SMTP.
- [x] Chromium and Firefox, including a narrow viewport, pass without skips or page errors; assertions fail if completion, usage or idempotency breaks.
- [x] Required source checks, SDD, exact CI SHA and unchanged application content are recorded. Real provider, money, fiscal receipt, external Inbox, phone and elapsed pilot windows remain separate gates.

## Reuse and dependency compatibility

Use the existing compiled application image, FastAPI/asyncio, YooKassa API URL setting, OpenAI provider URL configuration, model/rate-card administration APIs and actual queue drain helper. Test-only ASGI wrapper adds local protocol fixtures; no production module imports it. No new packages.

Repository Playwright is 1.62.1; the official registry currently reports latest stable 1.63.0. These tests reuse pinned 1.62.1 because the repository's browser image and lockfile are matched to that version. Official assertions documentation and release notes were checked. Upgrade path: update package lock and `.codex/e2e.Dockerfile` browser version together in a tooling work item, then run the existing and new suites. This work adds no new integration dependency.

## Verification and upstream impact

Docker Compose starts a fresh application database and runs both browser projects. No browser mocks for application APIs, persisted usage, wallet, ledger or queue. Check formatting/changed-file lint, full frontend tests and unchanged backend hashes; existing general type/style debt stays open.

Desktop tests open the sidebar with the existing Control+Shift+S shortcut; the narrow viewport uses its visible Open Sidebar button and user menu. The existing collapsed desktop rail can lie outside the viewport; this separate layout defect remains open and must not be inferred as verified by these paths. Return navigation uses the first visible Back/Back to chat link, whose label varies with viewport width.

Full payment return reproduced a product defect in Chromium and Firefox: creating a chat changed the visible URL with native history.replaceState, while the SvelteKit page URL remained the original home route. HeaderBillingAccess therefore omitted return_to and Back to chat opened an empty chat. The shared fork-owned return helper now derives the return path from the existing persisted chat ID on chat routes, retaining validated query parameters when the route matches. Empty and temporary IDs do not create links to nonexistent saved chats; billing return_to and non-chat routes retain their existing handling. Navbar, billing and workspace share the header; the mobile user menu uses the same helper and preserves return_to through its existing dashboard redirect. Upstream impact: only thin imports, one derived menu link and its two uses in UserMenu.svelte. Chat.svelte, backend and dependencies are unchanged.

- [x] Newly created chat survives wallet checkout, history and Back to chat without reload; zero extra model requests or completed successes. New Chat clears the input without sending; temporary and empty IDs do not produce saved-chat return links.

## Run locally

Use a compiled application image containing the accepted source, with the existing backend. The test service uses a disposable tmpfs database and local provider/SMTP protocols; FRONTEND_URL stays canonical for the production mail-origin validation. Verification URLs are parsed for their token, never opened externally. Model, payment and queue APIs run in the actual app.

```sh
ONBOARDING_PATHS_IMAGE=<compiled-image> docker compose -f .codex/docker-compose.onboarding-paths.yaml up -d --force-recreate --wait onboarding-paths
ONBOARDING_PATHS_IMAGE=<compiled-image> docker compose -f .codex/docker-compose.onboarding-paths.yaml run --rm --no-deps e2e 'npm ci --legacy-peer-deps && npm run test:e2e -- --config e2e/onboarding-paths.config.ts'
ONBOARDING_PATHS_IMAGE=<compiled-image> docker compose -f .codex/docker-compose.onboarding-paths.yaml stop onboarding-paths
```

## Local acceptance — 2026-10-04

Compiled runtime source `c00765af14d3bda95e12e31add3c9c782272ecc9`: 10/10 complete browser paths in Chromium and Firefox 390×844, 0 skips and 0 page errors. Exact provider usage 17 input/3 output, one 50000-kopeck test credit, one captured notice, two safe reconciliation/queue replays. Frontend 480 tests in 72 files; strict changed-file lint and Python Ruff/Black pass. General checks retain 3967 type errors/164 warnings and 1419 ESLint diagnostics, 0 added/removed. The full quality gate remains open. `npm run preflight` is absent in this repository. Existing backend receipts: 900 passed/5 PostgreSQL-only skips, all five verified separately among PostgreSQL 111+2 passes. Backend is unchanged. SDD 4/4 completed.

## Source and production acceptance — 2026-10-04

PR245 head `a35aa18fa6a547009cd7a4f7bde0e4fc4c3360e9` passed 10 CI checks with one dependency-review skip, then merged as `30190a01c8dbafe046fd15550279824795496e45`. CodeRabbit is disabled for this base; CodeQL reported no new alerts. All 11 changed files match through the merge; runtime source remains the compiled source above.

The first artifact was stopped by the existing analytics check before migration or container replacement: its generated dynamic public environment module was empty. The accepted r1 restores that single module from the accepted base image; all other compiled files, backend layers, environment and labels are unchanged. This preserves the deployed analytics settings. Full browser paths were repeated against r1: 10/10, no skips or page errors.

Accepted local image ID: `sha256:3194e24d652c9554bbbe4663213ef5c83783fb4cdbb4b610a7829a6fa2846a7f`. Registry and production identity: `sha256:8b584fa2e58bf712b610e4d3f022cb2d835061648cdbb85dcb1530708fdfd4e3`. All 4913 frontend and 425 backend Python files match the registry artifact. Guarded rollout passed backup integrity/readability, migration and health checks. The accepted default Compose image persists; container environment and all 13 original neighboring containers are preserved. One additional application-created per-user terminal is recorded separately. Rollback remains available.

Read-only production browser acceptance exercised desktop header → balance → history → original chat, and narrow sidebar/UserMenu → dashboard redirect → balance → original chat. Both preserve the saved chat; two historical messages and empty input remain, no messages or payments were submitted, and no console errors were observed. Temporary viewport override was reset. A historical failed image response is not evidence of new generation. The collapsed desktop rail layout defect and full quality debt remain open.
