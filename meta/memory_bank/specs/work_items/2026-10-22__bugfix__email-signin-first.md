# Email entry opens sign-in first

- Type: bugfix
- Status: active
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

Passed: original rendered regression fails before the fix; five rendered cases pass after it; full Docker Compose frontend suite 2610/2610, typecheck (0 errors/warnings), ESLint and git diff --check. Original failure also reproduced in a private Safari window.

Pending: production frontend build, clean pinned image, verified backup/migration/health gates, installed browser behavior/asset/version and environment/mount checks.

## Risk / rollback

Low application risk; container recreation has brief availability risk. Keep previous accepted image and private verified production backup. Restore previous image if health fails.
