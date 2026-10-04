# Complete onboarding paths and chat return after payment

## Meta

- Type: bugfix + test; new_feature.md and bug_fix.md
- Status: in progress
- Owner: Codex
- Branch: codex/bugfix/onboarding-return-paths
- SDD Spec: meta/sdd/specs/active/airis-onboarding-full-paths-2026-10-04-001.json

## Requirement and scope

Close the two automated browser gaps identified by the mandatory scenario audit. Exercise the unchanged compiled application, real authentication, APIs, persistence, billing and durable email queue. Replace only external model/payment services and SMTP with bounded local fixtures. Never use production credentials, recipients, credit or consent. Fixtures must refuse to start unless explicitly enabled in a disposable test application.

## Acceptance

- [ ] All three guide tasks survive login without auto-send; an ordinary user explicitly sends and sees a completed answer. Provider input/output exactly match persisted usage and free quota; wallet and money ledger remain unchanged.
- [ ] Provider failure records no completed task, consumes no quota and changes no money.
- [ ] Browser starts checkout with an ordinary verified account; pending provider state gives zero credit and zero credited notices. Local provider success returns to the wallet, applies one exact credit, updates visible history and submits exactly one captured service email with Reply-To.
- [ ] Reconcile and queue replay create zero extra credits, ledger rows or credited messages. Artificial recipients remain exclusively in local SMTP.
- [ ] Chromium and Firefox, including a narrow viewport, pass without skips or page errors; assertions fail if completion, usage or idempotency breaks.
- [ ] Required source checks, SDD, exact CI SHA and unchanged application content are recorded. Real provider, money, fiscal receipt, external Inbox, phone and elapsed pilot windows remain separate gates.

## Reuse and dependency compatibility

Use the existing compiled application image, FastAPI/asyncio, YooKassa API URL setting, OpenAI provider URL configuration, model/rate-card administration APIs and actual queue drain helper. Test-only ASGI wrapper adds local protocol fixtures; no production module imports it. No new packages.

Repository Playwright is 1.62.1; the official registry currently reports latest stable 1.63.0. These tests reuse pinned 1.62.1 because the repository's browser image and lockfile are matched to that version. Official assertions documentation and release notes were checked. Upgrade path: update package lock and `.codex/e2e.Dockerfile` browser version together in a tooling work item, then run the existing and new suites. This work adds no new integration dependency.

## Verification and upstream impact

Docker Compose starts a fresh application database and runs both browser projects. No browser mocks for application APIs, persisted usage, wallet, ledger or queue. Check formatting/changed-file lint, full frontend tests and unchanged backend hashes; existing general type/style debt stays open.

Full payment return reproduced a product defect in Chromium and Firefox: creating a chat changed the browser URL with native history.replaceState, but left the SvelteKit page URL stale. HeaderBillingAccess therefore omitted return_to and Back to chat opened an empty chat. All three native history replacements in upstream Chat.svelte are changed to the existing SvelteKit replaceState API, preserving page.state. This thin hook keeps visible URL and shared route state together, including reset to New Chat; no per-link workaround, extra listeners or dependencies. Navbar and billing/workspace consumers keep their existing validated return URL handling.

Pinned SvelteKit 2.68.0 public types and current official shallow-routing documentation were checked. Latest stable is 3.0.0; reuse 2.68.0 because this is a fix inside the existing SvelteKit 2 application. A major-version migration would require its own application-wide compatibility work. No package or lockfile changes.

- [ ] Newly created chat survives wallet checkout, history and Back to chat without reload; zero extra model requests or completed successes. All three URL updates use the framework API; reset and existing route navigation remain usable.

## Run locally

Use a compiled application image containing the accepted source, with the existing backend. The test service uses a disposable tmpfs database and local provider/SMTP protocols; FRONTEND_URL stays canonical for the production mail-origin validation. Verification URLs are parsed for their token, never opened externally. Model, payment and queue APIs run in the actual app.

```sh
ONBOARDING_PATHS_IMAGE=<compiled-image> docker compose -f .codex/docker-compose.onboarding-paths.yaml up -d --force-recreate --wait onboarding-paths
ONBOARDING_PATHS_IMAGE=<compiled-image> docker compose -f .codex/docker-compose.onboarding-paths.yaml run --rm --no-deps e2e 'npm ci --legacy-peer-deps && npm run test:e2e -- --config e2e/onboarding-paths.config.ts'
ONBOARDING_PATHS_IMAGE=<compiled-image> docker compose -f .codex/docker-compose.onboarding-paths.yaml stop onboarding-paths
```
