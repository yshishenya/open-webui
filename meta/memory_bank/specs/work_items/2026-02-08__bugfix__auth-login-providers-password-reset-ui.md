# Auth: Restore Social Providers + Password Reset UI

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: bugfix/auth-login-providers-password-reset
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-08
- Updated: 2026-02-08

## Context

After the `/auth` login screen redesign, users can no longer sign in via:

- OK.ru and Mail.ru (as VK ID alternative providers)
- Telegram

Additionally, password reset is effectively broken end-to-end:

- Backend endpoints exist (`/api/v1/auths/request-password-reset`, `/validate-reset-token/{token}`, `/reset-password`)
- Emails are generated with a frontend link to `/reset-password?token=...`
- But the frontend has no `/forgot-password` / `/reset-password` pages (and the auth UI has no "Forgot password?" entry point)

This creates lockout risk: if a user forgets their password, there is no self-serve recovery path.

## Goal / Acceptance Criteria

- [ ] `/auth` shows Telegram login when Telegram is enabled (independent of other social providers).
- [ ] VK ID widget exposes OK.ru and Mail.ru alternative login options when VK ID is configured.
- [ ] `/auth` (email sign-in) provides a visible "Forgot password?" entry point.
- [ ] `/auth` close (X) is always clickable and actually navigates away (no disabled trap).
- [ ] RU copy fits on mobile without awkward word-breaking (short header copy).
- [ ] `/forgot-password` allows requesting a reset link via email (no email enumeration; user-safe messaging).
- [ ] `/reset-password` validates token and allows setting a new password.
- [ ] Error handling is user-safe (rate limit, invalid/expired token, email service not configured).
- [ ] Keep upstream diffs minimal; prefer additive files for new UI.

## Non-goals

- Changing backend password reset semantics, token format, expiry, or email templates.
- Implementing SMS/phone-based recovery.

## Scope (what changes)

- Backend:
  - None (existing endpoints are used as-is).
- Frontend:
  - Restore Telegram + OK/Mail provider visibility on `/auth`.
  - Add `/forgot-password` and `/reset-password` pages.
  - (Optional but recommended) Add `/verify-email` page since verification emails also link to it.
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `src/routes/auth/+page.svelte`
  - `src/routes/forgot-password/+page.svelte` (new)
  - `src/routes/reset-password/+page.svelte` (new)
  - `src/lib/apis/auths/password_reset.ts` (new)
- API changes:
  - None (frontend consumes existing API routes).
- Edge cases:
  - Signup disabled: "Forgot password?" link must still be available on sign-in.
  - LDAP mode: do not show password reset (not applicable).
  - Email service not configured: show a clear error and next step (contact support/admin).
  - Rate limited requests: show rate limit error.

## Upstream impact

If this work touches upstream-owned files, list them here and explain why (and how the diff is minimized):

- Upstream-owned files touched:
  - `src/routes/auth/+page.svelte`
  - `src/routes/+layout.svelte`
  - `src/lib/i18n/locales/ru-RU/translation.json`
- Why unavoidable:
  - The login provider list is rendered by `/auth` and currently hides Telegram and VK ID alternative providers.
  - Public-page allowlist lives in `src/routes/+layout.svelte`; without it, `/forgot-password`, `/reset-password`, and `/verify-email` are redirected away for logged-out users.
  - New auth UI text needs Russian translations for parity with the rest of the RU locale.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Keep changes scoped to provider visibility and small UI link additions.
  - Add new pages and API helpers as new files.

## Verification

Docker Compose-first commands (adjust if needed):

- Frontend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run"`
- Frontend build: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps -e NODE_OPTIONS=--max-old-space-size=4096 airis-frontend sh -lc "npm run build:vite"`
- Frontend typecheck: `npm run docker:check:frontend` (currently noisy in this repo; not treated as a hard gate for this bugfix)

## Task Entry (for branch_updates/current_tasks)

Use this snippet in `meta/memory_bank/branch_updates/<YYYY-MM-DD>-<branch-slug>.md` and later in `meta/memory_bank/current_tasks.md`:

- [ ] **[BUG][AUTH]** Restore social providers + add password reset UI
  - Spec: `meta/memory_bank/specs/work_items/2026-02-08__bugfix__auth-login-providers-password-reset-ui.md`
  - Owner: Codex
  - Branch: `bugfix/auth-login-providers-password-reset`
  - Started: 2026-02-08
  - Summary: Bring back OK/Mail.ru + Telegram on `/auth` and ship password reset pages (`/forgot-password`, `/reset-password`).
  - Tests: Pending
  - Risks: Low-Medium (auth UX changes; ensure no regressions for existing providers).

## Risks / Rollback

- Risks:
  - UI regressions on small screens or edge auth modes (LDAP, onboarding).
  - Misconfigured email service causes user confusion; mitigate with clear messaging.
- Rollback plan:
  - Revert frontend changes (no migrations; backend is unchanged).
