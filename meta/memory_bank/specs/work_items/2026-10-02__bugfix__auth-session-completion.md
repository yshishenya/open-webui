# Complete login when the socket store is not initialized

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/auth-session-completion
- SDD Spec: meta/sdd/specs/active/airis-auth-session-completion-2026-10-02-209.json
- Created: 2026-10-02

## Context

The auth completion handler calls `emit` on the nullable socket before it sets the session user and refreshed config. The main layout initializes the socket asynchronously and independently handles user-join on connection using the saved token. A missing socket should not interrupt a completed HTTP login. The route also has untyped session/cookie/image references and an optional Telegram username passed to a required string prop.

## Goal / Acceptance Criteria

- [x] Execute the actual route handler in a regression test; prove missing socket blocks session completion before the fix.
- [x] A valid session saves user/config and follows the sanitized destination with or without a socket; a present socket receives one user-join event.
- [x] Null session is a no-op and does not report successful login.
- [x] Auth page has0 strict diagnostics after the accepted shared config contract; touched ESLint passes and unrelated formatting is preserved.
- [ ] Docker tests and applicable candidate E2E pass; exact source, PR checks and merge are verified.
- [ ] Changed runtime is built and accepted on production with guarded backup/digest/files/settings/health evidence.

## Scope / Upstream impact

`src/routes/auth/+page.svelte`: minimal type annotations, nullable socket guard, optional widget value fallback. Existing main layout reconnect/user-join behavior remains the recovery path; do not add another connection mechanism. Regression test lives in fork-owned utils and runs the real handler extracted by the existing TypeScript parser rather than testing a duplicate helper. No new dependencies or backend configuration.

## Verification

Reproduce the handler failure, then test session completion and socket emission. Run Docker frontend tests, touched ESLint, strict diagnostic comparison and relevant registration/guide E2E. Preserve inherited route formatting instead of reformatting upstream markup. Existing TypeScript5.9.3 is reused with the compatibility/upgrade rationale from the shared contract work item.

## Risks / Rollback

Auth is a critical user path: preserve token persistence, analytics, timezone update and sanitized redirect. The socket connect handler still joins with localStorage token if the socket arrives later. Keep the previously accepted production image for rollback and verify no server settings change.

## Reproduction and initial checks

The regression test uses the installed TypeScript parser to locate the actual `setSessionUser` arrow function and executes its transpiled body with observable session/config/navigation dependencies. It fails before the fix with `Cannot read properties of null (reading 'emit')`, while connected and failed-login cases pass. After the one-character optional socket guard, all3 cases pass. Changed route/test ESLint passes; route diff is17 lines, preserving inherited markup formatting. Full diagnostics and accepted candidate checks follow after shared contract PR165 integration.

## Full source checks

After integrating shared config PR165, Docker165/165 tests in40 files pass. Auth route strict diagnostics are0 (before5), with0 newly introduced diagnostics: the full baseline is4791 errors /217 warnings /285 files, down from4796/217/286. Changed route/test ESLint and new-test Prettier pass. Candidate E2E, exact source/PR and guarded production release remain pending.

## Candidate environment corrections

The first candidate guide suite passes7/7; generic registration coverage reports one skip and one admin-login failure before the form mounts. The browser trace identifies `crypto.randomUUID is not a function` on the internal Compose HTTP origin. Run the isolated test client in the server container network and use the loopback URL. Browsers treat loopback as a secure context, exposing the same native APIs as production HTTPS. This changes only the temporary Compose test fixture; application UUID generation and checked-in test configuration stay unchanged.

CodeQL identifies that the test script-extraction regex did not recognize uppercase SCRIPT tags. Use case-insensitive matching; no security rule suppression or gate bypass. Recheck the fixed parser fixture and exact new source before releasing.

## Candidate behavior accepted before final source freeze

The same candidate runtime passes all9 checked-in registration/guide tests after using loopback in the isolated fixture; no skips. A separate temporary diagnostic test also confirms `isSecureContext=true` and native `crypto.randomUUID`, for10/10 observed passes. It is retained as private diagnostic evidence, not additional application scaffolding. The registration test asserts profile visibility; the fixture's ordinary role is `user`, so its historical test title is not evidence of a pending-role flow.

The security finding is corrected in the test regex; all3 parsed-handler regressions still pass. The final source commit and rebuilt source marker will include this correction before the production candidate is accepted. Production release remains pending.
