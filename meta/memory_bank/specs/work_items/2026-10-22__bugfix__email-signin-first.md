# Email entry opens sign-in first

- Type: bugfix
- Status: completed
- Owner: Codex
- Branch: codex/bugfix/email-signin-first
- SDD Spec: N/A — localized mode-priority and label correction; no architecture/API changes.
- Created: 2026-10-22

## Problem and acceptance

The provider choice calls choiceEmailPrimaryMode, which prioritizes enabled signup over enabled login. Thus “Continue with Email” opens registration even for returning users.

- Email choice opens sign-in when login is enabled.
- Sign-in offers “Create Account”; registration offers “Sign in”.
- Password reset, explicit signup links, signup-disabled, LDAP-only and initial setup stay supported.
- No duplicate sign-in action on provider choice; registration stays on the email form.

## Implementation / upstream impact

Change only the existing mode precedence and secondary-action condition in src/routes/auth/+page.svelte, where the behavior is owned. Reuse existing form, handlers and translations. Add a rendered component regression test. No dependencies, backend, API, schema or environment changes.

## Verification and release

Passed: the original rendered regression fails before the fix; five rendered cases pass after it. After rebasing onto the latest integration branch, Docker Compose preflight passed 2614 tests across 235 files, typecheck (0 errors/warnings), ESLint and the production build. All applicable GitHub checks passed; PR #376 is merged.

Production release:
- Source: `8e6679015b57ed522c43f70ee4094d526a279b28` (includes PR #374 and #375).
- Image: `yshishenya/yshishenya:email-signin-8e6679015b-20261022`.
- Registry digest: `sha256:232f91f37c62e4546128973c1f70b1dc5b266f06e971d55d7288d6804551cf16`.
- Clean pinned build on 2brain.dev; package/static/model parity and 46 backend checks passed (1 expected skip).
- Disposable PostgreSQL restore and Alembic rehearsal passed. A new private production backup, checksums, archive listing and the hard migration gate passed before container recreation.
- Guarded release recreated only airis, preserving the analytics Compose overlay; health recovered with zero restarts. The immutable tag is pinned in production configuration.
- Private browser clicks verified email → sign-in → Create Account → signup → Sign in; the reset-password page and explicit `?form=signup` route also work. No account or reset email was created.
- Evidence: private artifact directory `airis-email-signin-20261022`; environment comparison permits only the expected image default `WEBUI_BUILD_VERSION` change.

## Risk / rollback

Low application risk; container recreation has brief availability risk. Keep previous accepted image and private verified production backup. Restore previous image if health fails.
