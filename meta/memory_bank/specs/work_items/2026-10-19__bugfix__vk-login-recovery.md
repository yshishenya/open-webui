# [BUG][AUTH] Восстановление входа через VK ID

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/vk-login-recovery
- SDD Spec: meta/sdd/specs/completed/vk-id-profile-2026-10-19-001.json
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
- [x] Reviewed immutable clean-platform build, verified private backup, migration/health/configuration gates, and service-only production rollout; separate technical proof from the user's real VK acceptance.

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

## Production acceptance — 2026-10-19

- Code PR: https://github.com/yshishenya/open-webui/pull/370, merged as `d88c929d3a58605f60de8c1bb6e3a4748be6b6e7`. Reviewed/build source: `a4d2ff5ebc16688475a207757ad39e294c45b242`; exact-source CI passed.
- Installed immutable image: `yshishenya/yshishenya:vk-login-a4d2ff5ebc-20261019`, digest `sha256:6d09783110a4d6d36359f9cc209e17a1f1156aab7d1e148d1a19b596608e4fde`. Built through the repository Dockerfile from pinned Node/Python platform bases, accepted Python lock, 62 verified static resources and verified model inputs. No previous application image used as a build base.
- All 7119 source files matched the reviewed Git commit. Two native builds matched all 4915 compiled application files, 351 Python distributions, system-package versions and model resources; universal whole-image byte reproducibility is not claimed. Candidate backend: 1287 passed / 10 skipped. PostgreSQL 16: 205 passed, including VK trust/lifecycle, queue/preferences/success/report checks. Frontend preflight: 2604 passed, Svelte 0 errors/warnings, ESLint/build passed.
- Rehearsed `alembic upgrade head` on a private disposable production dump; fresh production database/data/configuration backup passed checksums, archive listing and pg_restore listing before the hard production migration gate. Previous image retained for rollback; no data downgrade performed.
- Recreated only `airis` with the full existing three-file Compose configuration, without dependencies/orphan removal/build/pull. Docker and HTTP health passed; zero restarts. Public version/assets/guide and all installed application files matched the accepted candidate.
- Read-only financial audit: four table fingerprints unchanged, zero audit DML. Data mount and 14 initial neighboring services preserved. Runtime environment changed only `WEBUI_BUILD_VERSION`. Image selectors pinned after acceptance; all other environment-file bytes and resolved Compose fields unchanged; pinning did not recreate the container.
- Native torch/vision/audio operations, both local embedding models, tiktoken, NLTK and Whisper CPU inference passed on production. Mounted model hashes/links matched the fresh backup; the same 26 pre-existing absent cache metadata files remained absent.
- Eight older production backup directories (88 files, 12,573,202,133 bytes) relocated to verified private server storage, with all source/destination hashes matched and an index retained at the original backup root. Fresh/current backups and rollback image remain on production; post-release free space was 13.74 GiB.
- Temporary build contexts, model/static/source archives, disposable database dump, owned builder/images and task registry credentials removed after verification. Shared dependency volumes, existing host images/cache, source worktrees and required production backups retained. Final logs/manifests/checksums retained privately outside Git.

### External acceptance boundary

Technical release is accepted. The user's real VK retry remains pending; automated tests use an authenticated-provider response fixture and do not prove a login to the user's VK account. The old log did not identify the exact invalid/missing profile field. No browser-supplied identity/address, automatic account merge or invented signup address was introduced.
