# AIRIS: browser suite environment routing

## Meta

- Type: bugfix
- Status: implementation complete; PR CI/merge required
- Owner: Codex
- Branch: codex/bugfix/e2e-suite-routing
- SDD Spec: meta/sdd/specs/completed/airis-e2e-suite-routing-2026-10-07-001.json
- Created: 2026-10-07
- Updated: 2026-10-07

## Context

Default Playwright discovery finds 92 cases in 25 files. Eleven files (31 cases) need guarded onboarding-paths routes, captured SMTP, controlled provider and fullpaths-admin; the default setup prepares only airis-e2e. Existing targeted configurations cannot make the default invocation correct.

## Goal / Acceptance Criteria

- [x] Reproduce the wrong environment with a real runner and preserve its failure.
- [x] Preserve every existing case and its behavior contract; default discovery routes all 11 fixture files to onboarding-paths and the other 14 to ordinary AIRIS.
- [x] Each environment prepares its own administrator before dependent cases; targeted ordinary billing invocations continue to work.
- [x] Run full routed suites against the accepted compiled image in isolated Compose services; record every failure, skip and retry without converting missing prerequisites into success.
- [x] Document separate .pw.ts analytics/billing suites and their actual required serving environments.
- [x] Validate the routing partition with a runnable regression check, preserve unrelated changes and require exact-source CI before merge.

## Scope / Upstream impact

Fork-owned Playwright and Compose test configuration, setup adapters, a routing regression check, guides and work item. Shared package.json changes only the docker:test:e2e command to start both existing environments using an explicitly selected compiled image. Native setup dependencies preserve filename-filtered billing invocations. The runner and ordinary AIRIS share guarded AIRIS network namespace and use separate localhost ports (8080/8082). Both browsers supply native secure-context APIs without shims, insecure-origin flags or TLS claims. All seven guarded setup/check callers accept only the exact local origin. The local provider fixture rejects checkout returns to any other host/port. No application runtime, payment/consent rules or dependencies change. Existing setup functions are reused. Production deployment is unnecessary for a test-only fix.

## Verification

Docker Compose isolated ephemeral ordinary AIRIS, onboarding-paths and PostgreSQL; current Playwright 1.62.1 lockfile and browser image; actual project discovery and full E2E JUnit. Latest stable observed 1.63.0; retain the existing tested 1.62.1 browser/lockfile pair for this configuration-only fix, with upgrades handled as a separate work item. Official project-dependency docs and 1.62 release notes checked. Current full global type/lint/format debt remains open and is not suppressed.

## Risks / Rollback

Only owned test services and network may be removed. No external SMTP, payment, provider or production database. Revert this commit to restore configuration; no migration or deployment.

## Preparation defects resolved

- Registration used an ambiguous name selector matching both the greeting and menu; the shared menu helper now verifies the exact name within the menu. The previous pending-role title never asserted role and was corrected to describe the actual check.
- Native cancellation pressed Enter before the asynchronous URL draft was ready; it now waits for that exact draft. No request or result assertion is removed.
- The obsolete report case mounted a source component without SvelteKit page state. It now reuses existing compiled-page authentication/report fixtures in analytics_billing_ui.pw.ts. It still verifies 2/10 mature conversion, 3 immature visitors, exact net money, window/group/date requests and failure recovery, using the current explicit Apply and retained-report contract. The analytics case total remains 43; Vite and standalone mounting are unnecessary.
- Both browsers use native localhost secure contexts. A Firefox insecure-origin allowlist caused HTTPS upgrades and hanging form submissions and media. That rejected attempt remains separate from final acceptance.
- Reused disposable PostgreSQL data consumed local SMTP capacity across repeated attempts. The final run uses a freshly recreated tmpfs database; production limits and delivery checks remain enabled. The default Docker command recreates ephemeral app data too.

- The registration check inspected synchronous locator counts before hydration and could report an unavailable form even on the prepared signup-enabled app. It now waits for the actual email field and signup control; a missing required form fails rather than skips.
- The only route.fetch caller parses JSON after copying browser headers. Narrow Firefox advertises zstd, which Playwright APIResponse.json cannot decode here. The intercepted request explicitly negotiates identity encoding; original authentication headers and app compression stay unchanged, and malformed-note/retry/data-preservation assertions still execute.
- Test-only Window declarations replace two pre-existing invalid counter casts. They describe the getters installed by the fixture; no unknown/double cast or diagnostic suppression is added.

## Final local results

- Default run: 126 discovered, 122 passed, 0 failed/errors, 4 explicit ordinary chat skips (no configured models). Includes two setup cases, ordinary 58/62 and guarded 31/31 in each browser. Zero retries. The four legacy chat prerequisites remain open; this is not blanket application release acceptance.
- Separate analytics: 43/43, 0 failed/errors/skipped; the report case uses the actual compiled page. Separate billing UI: 18/18, 0 failed/errors/skipped. Some billing cases repeat default-suite cases and are not claimed as unique additional coverage.
- Corrected cases: 8/8, 0 skipped. Public Compose routing/native browser prerequisite: 1/1 with --no-deps as an additional configuration check; the full run above executes setup dependencies.
- Scoped ESLint, TypeScript bundler typecheck and Prettier pass for all 17 changed TypeScript files; Python fixture parses; Compose resolves; runnable source hashes match the full run. No src/backend/lockfile changes.
- Existing full-project type/lint/format diagnostics remain unresolved. Earlier failed/incomplete attempts, including origin flags, missing setup selection, SMTP capacity and zstd parsing, are preserved separately; none are promoted to acceptance.
- SDD implementation tasks 3/3 complete. Exact published SHA and CI results belong to the PR gate after commit; merge is permitted only after that gate. Production needs no application rollout for this test-only change.
