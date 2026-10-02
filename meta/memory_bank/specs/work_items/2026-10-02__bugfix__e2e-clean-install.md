# Reproducible complete E2E acceptance

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/e2e-clean-install
- SDD Spec: meta/sdd/specs/completed/airis-current-acceptance-audit-2026-10-02-216.json

## Context and scope

Recent releases accepted bounded browser fixes. The complete onboarding acceptance still requires a current source audit, including backend money/consent/queue scenarios and PostgreSQL concurrency. Existing tests and Docker Compose are reused. The clean E2E install fails because its npm peer mode differs from the mode used to generate the lockfile. Reuse the existing frontend legacy peer installation mode in the E2E helper environment. No dependency version, application runtime, production configuration or user record changes.

## Acceptance

- [x] Freeze the current integration source and record its full SHA and file hashes.
- [x] Execute the full backend suite in isolated Docker data and the relevant PostgreSQL controls with no row-locking skips.
- [x] Map mandatory scenarios to actual assertions and explicitly record missing provider, human and elapsed-time evidence.
- [x] Preserve unresolved global diagnostics as acceptance gates; commit only public generic evidence.

## Upstream impact

Fork-owned E2E helper configuration, global test setup and two existing browser checks change. No application-owned file changes. The public-page check is scoped to its existing named navigation rather than matching the additional footer link. Application source and lockfile stay identical.

## Verification

Use existing Docker Compose backend pytest/Black commands against frozen source; dedicated disposable PostgreSQL16 for queue and task concurrency. Store logs, JUnit and exact command/exit evidence privately. A test transport or accelerated clock does not establish external Inbox delivery, real payment or calendar pilot completion.

## Risks and rollback

Isolated source/data only. Preserve production and unrelated containers. No application deployment is required; this change is confined to test setup.

## Reproduced cause and minimal fix

The mandatory `npm ci && npm run test:e2e` fails with EUSAGE before browser tests, requesting peer packages absent from the legacy-generated lockfile. Existing frontend Compose scripts already use `npm ci --legacy-peer-deps`. npm10 documentation requires the same tree-shaping flags when consuming a lockfile: [npm ci](https://docs.npmjs.com/cli/v10/commands/npm-ci). Set `NPM_CONFIG_LEGACY_PEER_DEPS=true` only in the E2E helper; keep engine-strict, source, lockfile and checks intact. Dependency upgrades remain separate work. Verify the exact mandatory command from an empty helper volume, then the complete browser suite.


The first complete browser run additionally reproduces closed registration after initial-admin signup (ordinary signup and guide account creation fail), pending default roles, and an outdated empty-model selector. Restore `ENABLE_SIGNUP=true` and `DEFAULT_USER_ROLE=user` through the existing administrator configuration API during both global setup login paths; verify the applied result. Keep all other configuration fields. Recognize the current `No models available` empty catalog alongside `No results found`; retain the existing explicit no-provider skips, without claiming a generated answer. Changes affect only E2E files and helper configuration.


The prepared complete suite runs all46 tests:41 pass,4 explicit no-model skips and1 strict-locator failure. Both the document navigation and footer contain a valid Documents link; scope the assertion to the existing named page navigation. The final complete rerun validates the existing-admin setup path; the fresh-data run already exercised initial-admin setup and all signup/guide/consent cases. Real-provider generation and physical-device/provider/pilot acceptance remain separate gates.

## Current measured baseline

Integration base `1f6b847478c740a4c1f1d437c2d55b0f255b5b13`:615 backend passed/3 PostgreSQL-only skips/135 warnings; dedicated PostgreSQL16 critical suite134 passed/0 skipped/13 warnings; full frontend197/197. Black succeeds and reformats69 files only in an isolated copy; original hashes restored. Full typecheck4668 errors/215 warnings, frontend lint1600 errors and Ruff0.16.10/backend6476 errors remain open. All results are recorded without claiming overall readiness. No new dependency or application behavior is introduced. Changed E2E ESLint and TypeScript syntax checks pass.


## Accepted bounded verification

The exact required `npm ci && npm run test:e2e` now completes from clean install:42 passed/4 explicit no-provider skips/0 failures, exit0 across all46 cases. Initial-admin and existing-admin setup paths are exercised in separate complete runs. The last run includes all signup, guide, consent/unsubscribe, wallet, profile and public-navigation assertions. Candidate E2E input hashes match the frozen workspace; every other original tracked hash matches the integration base. Package.json, lockfile and engine-strict are unchanged. Changed E2E ESLint/syntax checks and chat/public-page formatting pass; documentation links and SDD validate. Overall global quality and real-provider/payment/human/pilot gates remain open.
