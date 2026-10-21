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
- [x] Docker Compose backend/frontend checks, PostgreSQL concurrency and relevant browser acceptance pass.
- [ ] Exact-source CI, clean image, guarded deploy and current runtime acceptance; preserve VK changes, production settings, observation scope, money and neighboring services.
- [x] Owner's existing consumed link is not revived; password recovery remains the normal user-controlled flow. No credentials are replaced silently.
- [ ] Individual password failure is explained or the owner completes normal password recovery.

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
- Frontend final bounded-worker run: 2609 passed; svelte-check 0 errors/0 warnings; ESLint and Vite production build passed. Initial parallel notebook timeout is retained in evidence and resolved by the complete final run.
- Password values travel unchanged through registration and signin; real-route ASCII, Unicode/emoji and leading/trailing spaces pass. This does not determine the owner's original mismatch; no reset performed.
- New browser regression exercises actual mail capture and compiled page/session/replay; adapt existing onboarding fixture to fragment token and POST.
- Runtime baseline remains VK consent release b037eb00925b75f406d3fa83d28ba721cd645ec9, healthy. No new dependency, schema or feature switch.
- Production lock preserves accepted SQLAlchemy 2.0.50; existing async ORM delete/select/row-lock APIs checked against official 2.0 DML documentation. Dependency upgrade is outside this incident.

Private evidence: /Users/yshishenya/.codex/private-artifacts/airis-verification-login-20261021. Release and owner's recovery remain open.

## Final release checks

- PR375 merged into airis_b2c; candidate source `10f2f2c727b6e435b7c033e5686ed3824d0a2361`, merge `fd86a5a224912b5348548a9631195d8a058fd96f`.
- All applicable exact-head GitHub checks passed, including billing-confidence, backend, migration, lint, SDD, CodeQL and gitleaks. Dependency review skipped because dependencies did not change.
- Compiled candidate browser checks: 4/4 passed in Chromium and narrow Firefox. Real captured email, automatic session, persistence, replay rejection, original Unicode password and adjacent guide/free quota path verified. First temporary Firefox configuration used a desktop viewport instead of the established narrow project; corrected runner and complete rerun passed without an application change.
- Clean image `yshishenya/yshishenya:verify-login-10f2f2c727-20261022`; image ID and registry digest `sha256:9717604aaaf4f0858f92baac16e78c6c762912efdc1cc38f34504492385b7a6a`.
- Target preload verifies 557 backend files, 4915 compiled application files, 62 frozen static resources, 153 model files and 27 links; 351 accepted Python distributions, pip check and native torch/vision/audio operations passed.
- Repeat build with cache matched application files, Python distributions and 391 OS package versions; this does not establish an independent uncached or universal byte-identical rebuild.
- Migration rehearsal restored the latest production dump into isolated PostgreSQL tmpfs; Alembic passed and remained at `d1c020261009`. Temporary database/network and credentials removed.
- Three older server backup duplicates moved to existing private storage on 2brain.dev; all 31 files verified by size/SHA256 and application archives checked. Only matching source duplicates removed; latest October 21 backup preserved. No production data, volumes or unrelated images removed.
- Runtime deployment and personal recovery acceptance are recorded below when proved. The original consumed confirmation link is not revived; no recovery email or password replacement has been performed.

## Combined integration release

Concurrent legal-checkbox work merged and began release preparation while the first candidate was being checked. The first guarded attempt stopped at the 10 GiB free-space gate before migration or recreation; the existing application stayed healthy. Its verified backup is retained. No retired-image cleanup was needed by this task (zero selected images removed). The task later removed only its own superseded, never-deployed candidate cache from AIris after verifying the immutable registry copy and absence of container references; current/recent rollback images and all volumes were preserved.

The final candidate uses integration source `fd86a5a224912b5348548a9631195d8a058fd96f`, preserving both the email fix and the legal-checkbox geometry fix. Backend, dependencies, lock and Dockerfile are byte-identical to the already accepted auth candidate. All five integration CI workflows passed, including backend, billing-confidence, security, migration and SDD. Original full auth/frontend checks and the separate legal geometry checks remain evidence for their unchanged respective code. Compiled combined browser checks and runtime acceptance are recorded once finished.

## Interrupted version-request follow-up

The compiled combined candidate exposed an unhandled rejection in the root layout's Socket.IO connect callback: getVersion rejects on a network cancellation while the confirmation page reloads into the chat. All sign-in/session/replay/password assertions passed; the strict browser pageerror check caught the background rejection. Trace points to the shared root callback, rather than the token exchange.

The existing settings callers already catch getVersion failures. Add the same null fallback to the root callback (three added lines), retaining heartbeat and user-join processing. Do not change the API helper's public error contract or suppress browser errors in tests. The existing confirmation browser test now deliberately aborts /api/version and requires at least one interruption. On the unchanged compiled candidate it fails in both Chromium and Firefox, proving the reproduction.

Upstream impact delta: src/routes/+layout.svelte receives only the missing error handler around its existing version lookup. Integration also contains the independently merged email-signin-first correction; preserve it together with legal-checkbox geometry in the final source. No backend, dependency, schema, consent or provider change in this follow-up.
