# Explicit product email preferences and unsubscribe

## Meta

- Type: feature
- Status: active
- Owner: Codex
- Branch: codex/feature/product-email-consent
- Base SHA: a75a49c952bb11fe51fb88bb9bf63dc84a7759fc
- Created: 2026-10-02
- Updated: 2026-10-02
- SDD Spec: meta/sdd/specs/active/airis-product-email-consent-2026-10-02-146.json

## Goal and acceptance

Optional product emails require explicit server-recorded consent bound to the current verified email. Registration, authentication and service emails work without product consent. Old accounts default to no consent. User.settings is not an authorization source. Unsubscribe works without login; GET never changes consent. One-click POST is separate and uses the RFC 8058 body. No new sequence is enabled by this change. AIRIS_PRODUCT_EMAILS_ENABLED defaults false and keeps all product SMTP off until the durable queue and pilot gates pass; service mail is unaffected.

- [x] Voluntary unchecked signup checkbox and existing-account settings save explicit choice, version, source and time.
- [x] Durable preference/history cannot be forged through client settings, social claims or another user ID.
- [x] All welcome callers use one common fail-closed check; service verification/reset/change mail remain independent.
- [x] Current address must match consent, be valid and verified, and have no hard-bounce/complaint suppression.
- [x] Old verification token never verifies a new address; address changes invalidate verification, preferences and unsubscribe tokens atomically.
- [x] Unsubscribe GET is passive; POST is idempotent; expired/unknown token responses do not reveal an account; resubscribe requires an explicit authenticated choice.
- [ ] Each product message has a footer and List-Unsubscribe / List-Unsubscribe-Post; DKIM and access-log redaction verified on release.
- [x] Account deletion removes preferences/tokens, unlinks retained history; bounded cleanup removes expired data.
- [ ] SQLite/PostgreSQL migration, concurrency/security tests, frontend checks and browser flow pass.
- [ ] Reviewed exact-SHA PR merged; guarded release, rollback and live acceptance verified.

## Minimal data model

Three tables; fixed product category, no general notification framework:

1. airis_email_preference: user_id primary key, email_hash, subscribed, consent_version, accepted_at, withdrawn_at, updated_at. No row means no permission. Only one product category is currently supported.
2. airis_email_preference_event: id, nullable user_id, email_hash, action, consent_version, source, created_at. Append-only during normal operation. Indexed by user/time and address/time. Suppression uses recent hard_bounce/complaint events in this same journal, so a separate suppression table is unnecessary. Explicit opt-in never removes those events.
3. airis_email_unsubscribe_token: token_hash primary key, user_id, email_hash, created_at, expires_at. A new random token is created per message and stored only as SHA256. Old message links remain valid. No plaintext recipient, IP, User-Agent, body or token is duplicated into this storage.

Existing user rows serialize preference changes, unsubscribe and address changes with a row lock in PostgreSQL. SQLite tests use the existing async ORM boundary. No network call holds a database transaction open. Consent is read again immediately before SMTP; a narrow unavoidable race after that check is documented. Durable queue cancellation and account-wide frequency serialization belong to the queue work item.

Retention defaults: unsubscribe tokens 180 days (minimum 30), history 730 days, address suppression 365 days. Values are bounded environment configuration; history retention must cover suppression. The existing scheduler invokes bounded hourly cleanup regardless of user automations. Current preferences exist for the account lifetime and are deleted with it. Address hashes remain personal data; unlinking user_id does not make them anonymous.

## API and UI

- Authenticated GET/POST /api/v1/email-preferences: act only on the authenticated user; StrictBool choice, server-owned version/source/time; preference and readiness returned.
- POST /api/v1/email-preferences/unsubscribe: opaque token in a bounded JSON body; always a generic response, never an address/name. Invalid token does not change preferences. Public page /unsubscribe uses a URL fragment to keep its token out of server GET logs.
- POST /api/v1/email-preferences/one-click/{token}: exact RFC 8058 form body, no authentication or cookies required. GET is passive. Uvicorn and production proxy access logs redact the token-bearing route before release.
- Admin-only suppression: known hard_bounce/complaint; no invented delivered status or unsigned provider webhook. A provider-event integration requires a separate trusted source.
- Signup defaults false. Social users choose in the existing account settings. A small fork-owned component and API module keep hooks in auth/account pages minimal.
- Public consent explanation states product tips/news, voluntary choice, unsubscribe and service email separation. User-selected consent is not inferred from legal-document acceptance.

## Callers and trust boundaries

Signup auths.signup records only explicit choice. Welcome callers are airis/password_reset.verify_email and two VK creation paths in oauth_russian.py. email_service.send_welcome_email becomes user-id based and reads current state before SMTP. General OAuth, LDAP, trusted headers and administrator-created accounts have no automatic consent. Common Users.update_user_by_id invalidates address trust across admin, SCIM and OAuth updates; Auths.update_email_by_id delegates to it. Users.delete_user_by_id cleans up consent state for auth/admin/SCIM deletion.

## Dependencies

Reuse repository-pinned SQLAlchemy 2.0.50, Alembic 1.18.4, FastAPI 0.136.3, Pydantic 2.13.4, Svelte, existing email-validator 2.2.0 (official version README reviewed, syntax only without DNS I/O), and native fetch/input. Official SQLAlchemy 2.0 async documentation and Alembic operations documentation reviewed. Current registry stable releases are newer (SQLAlchemy 2.1.1, Alembic 1.20.0); this feature does not introduce or replace dependencies. Compatibility constraint: the shared engine/models, deployment base and lockfiles are tested together at existing pins. Upgrade those dependencies as a separate migration/testing work item before changing the shared baseline; no unsupported API from newer releases is used here.

## Upstream impact

Thin hooks in signup form/router, Users address/deletion methods, scheduler, main router registration, auth page, account settings and public routes. New data model, router, policy/helper, UI component and tests are fork-owned. SMTP supports explicit extra unsubscribe headers only for product mail; no subject/template guessing. No unrelated formatting, public contract removal or dependency change.

## Release and rollback

Migration adds tables without opting anyone in. A rollback image must retain the common consent guard or disable product mail, because returning to an unguarded welcome sender would ignore withdrawals. Service email remains available. Validate migration on a disposable PostgreSQL copy, effective configuration and current production base before release. Code/tests alone do not close live SMTP, DKIM, proxy logs or browser acceptance.

## Verification in progress

- Full backend: 471 passed / 1 PostgreSQL-only skip; dedicated PostgreSQL policy and concurrent-row checks: 49 passed. Includes the product-off regression.
- A restored PostgreSQL copy upgrades through the prior analytics revision to e1c020261002; existing users have no product consent.
- Frontend unit tests: 147 passed. Typecheck baseline and current each contain the same 8360 errors / 224 warnings; normalized diagnostic comparison adds/removes zero errors. Ruff adds zero findings against the base branch. Existing frontend ESLint fails in the same baseline/current no-unused-vars rule. These global checks are not reported as green.
- Native build fallback preserves the repository-supported Node 22 line after Docker heap exhaustion. No application dependency is introduced or replaced. Native production build succeeds and 16 browser scenarios pass. Proxy-token privacy, DKIM, exact-SHA CI and production acceptance remain pending.
- The repository has no npm preflight script; the documented Compose tests, formatting, lint comparison, migration and SDD gates are used instead.

- Final local source check: 471 backend tests pass, one PostgreSQL-only skip is covered by 49 passing PostgreSQL/SMTP checks. All five new Python files pass Ruff and Black checks. Native build and 16 browser scenarios pass.
- Tested safe rollback: 27 service SMTP checks pass and product welcome is blocked. Proxy config is validated and synthetic raw/encoded GET/POST requests produce zero token leaks. Live application, delivered DKIM and exact-SHA CI are still pending.
