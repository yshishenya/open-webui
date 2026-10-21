# VK ID email consent recovery

## Meta

- Type: bugfix
- Status: released; real-account verification pending
- Owner: Codex
- Branch: codex/bugfix/vkid-email-consent
- SDD Spec: meta/sdd/specs/active/vk-id-email-consent-recovery-2026-10-21-001.json
- Created: 2026-10-21
- Updated: 2026-10-21

## Context

Mail.ru login through VK ID reaches the authenticated profile, then fails the new-account email requirement. The public production app is 54402052; the provided mail address passes the production validator. Application email access is enabled. The user observes account selection followed by rejection, with no separate consent page. The current log conflates missing and invalid provider email; the actual token permissions are unknown. No claim that forced consent alone fixes provider data availability.

## Goal / Acceptance Criteria

- [x] A rejected signup can request email consent on the next explicit login click, without revoking access or opening a popup after an awaited network response.
- [x] Consent applies only to the provider being retried; normal and returning login stay unchanged.
- [x] Missing and invalid provider email have distinct reason-only diagnostics, without logging address, profile or tokens.
- [x] Provider identity, active-account, valid signup address and collision checks remain intact.
- [x] Focused regression tests, frontend checks and production acceptance are recorded; real user login is a separate external check.

## Scope / Implementation

Reuse the SDK 2.6.9 Config prompt option and documented consent parameter. Keep the existing 400 detail string contract and add a machine-readable error response header. The auth page remembers consent recovery only in memory. No new dependencies, email fabrication, automatic merging, account creation without provider email, migrations or credential changes.

## Upstream impact

Only a small hook in src/routes/auth/+page.svelte; logic stays in fork-owned vkid.ts and social_account.py. Update local SDK declarations to match the existing prompt option.

## Verification

Docker Compose frontend tests/check/lint/build; focused backend onboarding acceptance and lint; actual official SDK authorization URL check for scope=email and prompt=consent. Backend: 1287 passed, 10 skipped (Docker Compose on dev-p4). Frontend: 2605 passed; type check and ESLint passed. Official SDK 2.6.9 URL assertions passed (Mail.ru/email/consent/PKCE/state). Black accepted with repository settings; existing Ruff diagnostics are unchanged. Full frontend preflight passed (tests/check/lint/production build). Runtime installation passed; the public auth asset matches the candidate checksum. Real user login remains an external acceptance check.

## Risks / Rollback

The provider may still omit email after explicit consent. Keep the signup requirement and actionable error; do not infer success. Roll back to the previous accepted immutable image if runtime checks fail.

## Sources

- https://id.vk.com/about/business/go/docs/ru/vkid/latest/vk-id/connection/api-description
- https://registry.npmjs.org/@vkid/sdk/2.6.9 (ConfigData.prompt and Prompt.Consent verified against published package)


## Production evidence (2026-10-21)

- Code: PR #372, source `b037eb00925b75f406d3fa83d28ba721cd645ec9`, merged as `cee12b44558491bfce0f1ead6b4a49f5763485b3`.
- All required source CI passed. Billing retry 2 passed all 3 suites. Attempt 1 failed before frontend tests because npm/esbuild returned ETXTBSY; backend billing 95 and wallet E2E 11 passed even in that attempt. No source changes were needed for the retry.
- Clean pinned Node/Python build; 351 Python distributions, 556 backend files, 62 prepared static files, 153 model files and 27 links verified. Candidate onboarding tests: 21 passed.
- Installed and pinned `yshishenya/yshishenya:vkid-consent-b037eb0092-20261021`, digest `sha256:be164128d6e0a0105dd3f4d2219ee61ae41343c22b483d8f0e428db243ab0218`.
- Runtime healthy, zero restarts; public health/auth/config/version and exact new auth asset checksum passed. Correct public app 54402052 and redirect https://chat.airis.you preserved.
- Twelve current neighbor containers and persistent mounts preserved. Two temporary terminal containers expired naturally before deployment; the fresh guard was accepted only after application/configuration and persistent neighbor comparison passed.
- Configuration changes are limited to the image selector. Runtime environment differs only in WEBUI_BUILD_VERSION. Wallet/payment/ledger/transaction fingerprints are unchanged; verification issued SELECT statements only.
- Fresh verified backup: `AIris:/opt/backups/airis/20261021T124915Z-vkid-consent-b037eb0092-20261021`; prior image retained for rollback. Six older backups were relocated to closed storage on 2brain.dev with 66 file hashes checked; recent backups remain on production.
- Local private evidence: `/Users/yshishenya/.codex/private-artifacts/airis-vkid-consent-20261021/final-acceptance.json`.

## Remaining acceptance

User must reload the auth page, select Mail.ru, and if the email-recovery message appears, click the same provider again to request consent. Access must not be revoked. A successful real account login / callback HTTP 200 has not been observed. The SDD remains active until this external acceptance is complete. Explicit consent is not claimed as a confirmed explanation for the provider omitting email.
