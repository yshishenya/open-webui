# VK ID email consent recovery

## Meta

- Type: bugfix
- Status: active
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
- [ ] Focused regression tests, frontend checks and production acceptance are recorded; real user login is a separate external check.

## Scope / Implementation

Reuse the SDK 2.6.9 Config prompt option and documented consent parameter. Keep the existing 400 detail string contract and add a machine-readable error response header. The auth page remembers consent recovery only in memory. No new dependencies, email fabrication, automatic merging, account creation without provider email, migrations or credential changes.

## Upstream impact

Only a small hook in src/routes/auth/+page.svelte; logic stays in fork-owned vkid.ts and social_account.py. Update local SDK declarations to match the existing prompt option.

## Verification

Docker Compose frontend tests/check/lint/build; focused backend onboarding acceptance and lint; actual official SDK authorization URL check for scope=email and prompt=consent. Backend: 1287 passed, 10 skipped (Docker Compose on dev-p4). Frontend: 2605 passed; type check and ESLint passed. Official SDK 2.6.9 URL assertions passed (Mail.ru/email/consent/PKCE/state). Black accepted with repository settings; existing Ruff diagnostics are unchanged. Full frontend preflight passed (tests/check/lint/production build). Runtime installation is pending. Real user login remains an external acceptance check.

## Risks / Rollback

The provider may still omit email after explicit consent. Keep the signup requirement and actionable error; do not infer success. Roll back to the previous accepted immutable image if runtime checks fail.

## Sources

- https://id.vk.com/about/business/go/docs/ru/vkid/latest/vk-id/connection/api-description
- https://registry.npmjs.org/@vkid/sdk/2.6.9 (ConfigData.prompt and Prompt.Consent verified against published package)

