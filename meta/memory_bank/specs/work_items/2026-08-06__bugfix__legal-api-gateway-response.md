# Legal API gateway response recovery

## Meta

- Type: bug fix
- Status: done
- Owner: Codex
- Branch: `codex/feature/landing-airis-refinement`
- Created: 2026-08-06
- Updated: 2026-08-06

## Context

Opening a landing example can enter the authenticated app while `/api/v1/legal/status` or `/api/v1/legal/requirements` is behind a temporary 502/503/504 response. The frontend attempted to parse an HTML gateway page as JSON and then showed two internal English errors to the user.

## Goal / Acceptance Criteria

- [x] Temporary gateway failures receive one immediate retry for safe legal GET requests; acceptance POST requests are never replayed.
- [x] HTML or malformed responses never become raw parsing errors in the UI.
- [x] Legal-status and public-requirements failures surface actionable Russian messages instead of internal English or JSON parsing errors.
- [x] The legal gate remains fail-closed when requirements cannot be loaded.
- [x] A focused regression test covers gateway HTML and retry recovery.

## Scope

- `src/lib/apis/legal/index.ts`
- `src/lib/apis/legal/index.test.ts`

## Root Cause

Each legal API method called `response.json()` unconditionally for non-OK responses, so an HTML gateway page escaped as an internal parsing failure instead of a user-safe message.

## Upstream impact

- Legal API changes remain isolated in the Airis legal client; the upstream app layout and its fail-closed fallback stay unchanged.

## Verification

- `vitest run src/lib/apis/legal/index.test.ts`
- Browser check of the fail-closed legal gate with an unavailable local API.

## Task Entry

- [x] **[BUG]** Recover cleanly from temporary legal API gateway responses
  - Spec: `meta/memory_bank/specs/work_items/2026-08-06__bugfix__legal-api-gateway-response.md`
  - Owner: Codex
  - Branch: `codex/feature/landing-airis-refinement`
  - Started: 2026-08-06
  - Summary: Retry temporary legal API failures once and replace technical English/JSON errors with actionable Russian messages.
  - Tests: `src/lib/apis/legal/index.test.ts` passed; included in the 96-test frontend suite.
  - Risks: The client cannot repair an extended upstream outage; the legal gate must remain closed.
