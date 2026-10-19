# [BUG][AUTH] Восстановление входа через VK ID

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/vk-login-recovery
- SDD Spec: meta/sdd/specs/active/vk-id-profile-2026-10-19-001.json
- Created: 2026-10-19
- Updated: 2026-10-19

## Context

User-confirmed error: `VK ID must provide identity and email`. Production source 76031ee6dd360459f23a6562f1a58bc95173f105 rejects `VKIdentity` before finding an existing provider binding. SDK 2.6.0 declares `UserInfoResult.user: Partial<UserData>`; nullable/missing optional profile fields must not invalidate an authenticated returning user. The generic error also hides whether identity, address, or optional metadata failed.

## Acceptance criteria

- [x] Provider-authenticated positive user id remains mandatory; browser user id/email never establish identity or account linking.
- [x] A bound active VK account can log in without email/name/avatar from VK; stored identity/address is preserved.
- [x] New VK registration still requires a valid provider-supplied address, rejects email collisions, and does not auto-merge accounts.
- [x] Null/malformed optional profile metadata does not block identity validation; missing identity and missing signup email produce actionable separate errors and safe reason-only logs.
- [x] Regression test fails before the change and passes afterward, including blocked accounts and malformed identity; relevant existing suites pass.
- [ ] Reviewed immutable clean-platform build, verified private backup, migration/health/configuration gates, and service-only production rollout; separate technical proof from the user's real VK acceptance.

## Scope / Upstream impact

Only fork-owned `utils/airis/social_account.py`, Russian OAuth router and its existing acceptance test. No schema, dependency, frontend, automatic merge, consent or balance change. Reuse existing asynchronous provider calls and account lifecycle. Keep patch small; preserve production configuration and neighboring services. Test version-pinned Pydantic behavior; do not upgrade dependencies as part of this fix.

## Verification / rollback

Docker Compose-first backend tests with an isolated SQLite database and production-compatible dependency image; security assertions for untrusted browser fields and disabled Auth. Focused formatting/lint, full backend suite as practical, immutable artifact/source checks. Guarded rollout retains old image and fresh verified backup. Roll back the application only; do not downgrade or overwrite live financial data.

## References

- https://unpkg.com/@vkid/sdk@2.6.0/dist-sdk/types/auth/types.d.ts
- https://github.com/VKCOM/vkid-web-sdk/blob/master/src/auth/types.ts
- `meta/memory_bank/guides/clean_production_image.md`

## Verification evidence — 2026-10-19

- Old accepted code reproduces the reported 400 for a partial authenticated VK profile.
- Isolated Docker Compose, accepted amd64 dependency image and read-only patched files: 21 focused tests passed; full backend: 1287 passed, 10 skipped, 253 existing warnings. Disposable SQLite, no network or production data.
- Black with repository settings (120 columns, preserve quotes): all 3 changed files unchanged. Current Ruff and `git diff --check`: passed. No new dependencies.
- Security review: only server-authenticated provider id resolves the binding; invalid positive-id input fails; signup requires valid provider email, collisions still fail; active-Auth gate still applies. Browser claims, stored email, consent, balances and verification status are not overwritten.
- Exact optional field missing in the live VK response was not logged by the old version; do not identify email alone as the confirmed cause.
- Real user VK retry remains a separate acceptance step after deployment.

- Frontend `npm run preflight`: 2604 tests passed; Svelte 0 errors/warnings, ESLint and production build passed.
- Corrected the SDD generator's four-digit suffix and added required task file paths after CI caught tracking-policy violations; runtime code is unchanged.
