# Email verification completes sign-in

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/email-verification-login
- SDD Spec: meta/sdd/specs/active/email-verification-login-2026-10-21-001.json
- Workflow: bug_fix
- Created: 2026-10-21

## Context

The owner confirms receipt of the Proton verification email. Its public page confirms the address, then sends the person to password sign-in. Production confirms one successful verification followed by two signin400 responses. Reopening the consumed link fails as expected. Current active account has a valid-format bcrypt hash, matching unpadded emails, password auth enabled and zero remaining verification tokens. The actual password mismatch is not yet explained; no claim of corruption and no credential replacement.

## Acceptance

- [x] One valid unexpired verification link confirms the current address and signs in without password via the existing session/cookie contract.
- [x] Consumption is atomic: concurrent clicks issue at most one session; expired, replayed, deleted/inactive account or old-address tokens cannot authenticate.
- [x] Legacy GET verification remains sessionless; new browser exchange uses POST body and no-store, removes the token from the visible URL, then opens the chat.
- [x] Existing signup/password signin and consent/welcome boundaries remain intact; original password works in isolated real-route regression, including Unicode.
- [x] No password, credential hash or verification secret is published. User account credentials are not reset silently.
- [ ] Docker Compose backend/frontend checks, PostgreSQL concurrency and relevant browser acceptance pass.
- [ ] Exact-source CI, clean image, guarded deploy and current runtime acceptance; preserve VK changes, production settings, observation scope, money and neighboring services.
- [ ] Owner's existing consumed link is not revived; any needed password recovery remains the normal user-controlled flow. Individual password failure is left open until explained or recovered.

## Implementation

Reuse email_verification token storage and create_session_response. Atomic consume plus current User/Auth checks in the existing model; no schema/dependency additions. New POST callback in fork-owned password_reset.py; legacy GET reuses the same consume helper. Verify page stores the normal session token then navigates to chat. One new focused regression module plus existing lifecycle tests. A short email-text clarification says the link confirms and signs in.

## Upstream impact

No changes to upstream auths.py: reuse its session helper via a local import to avoid existing router import cycle. Changed files are existing AIRIS verification model/router/page/API/templates and focused tests. No general passwordless-login service, provider migration or silent consent change.

## Verification / Rollback

Docker Compose-first isolated backend and frontend runs; disposable PostgreSQL for parallel token consumption. Clean build/deploy per clean_production_image.md and scripts/deploy_guarded.sh, current image/verified backup retained. Revert only this release if acceptance fails; never delete data or revive tokens. All live account checks are SELECT-only, secrets remain private.

## Verified before release — 2026-10-22 Europe/Istanbul

- Isolated Compose full backend: 1297 passed, 10 skipped (existing prerequisites); focused verification/preferences/lifecycle: 46 passed, 1 PostgreSQL-only skip on SQLite.
- Disposable PostgreSQL verification/lifecycle: 24 passed, including concurrent consumption.
- Black applied to changed Python files; full Ruff report retained (490 historical findings). Existing lint delta tool: 0 current diagnostics in changed Python files, 2 baseline, 0 new.
- Frontend initial parallel run: 2604 passed, one unrelated notebook timeout; notebook rerun: 4 passed. Focused API/page tests: 4 passed. Full bounded-worker preflight is pending.
- Password values travel unchanged through registration and signin; real-route ASCII, Unicode/emoji and leading/trailing spaces pass. This does not determine the owner's original mismatch; no reset performed.
- New browser regression exercises actual mail capture and compiled page/session/replay; adapt existing onboarding fixture to fragment token and POST.
- Runtime baseline remains VK consent release b037eb00925b75f406d3fa83d28ba721cd645ec9, healthy. No new dependency, schema or feature switch.
- Production lock preserves accepted SQLAlchemy 2.0.50; existing async ORM delete/select/row-lock APIs checked against official 2.0 DML documentation. Dependency upgrade is outside this incident.

Private evidence: /Users/yshishenya/.codex/private-artifacts/airis-verification-login-20261021. Release and owner's recovery remain open.
