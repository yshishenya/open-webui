# Edit User billing display correction

- Type: bugfix
- Status: done (bounded local fix; integration/release belongs to main)
- Owner: Codex (EditUserModal scope)
- Branch: codex/bugfix/billing-experience-20261022
- Created: 2026-10-23
- SDD Spec: N/A — narrow display-only regression, parent billing implementation remains active.

## Context and acceptance

Production c386 displays raw `active` in green for a period ending March 12, 2026,
and translates raw ledger codes rather than existing human-readable labels.
Display the stored status separately from the period fact, localize dates with
`getI18nLocale`, and show ended periods without claiming current access.
Reuse reporting labels/formatters and preserve signed values and known currency.
No subscription mutation, monetary API change, locale-file edits, commit or deploy.

## Upstream impact

Only the billing rendering hooks in `EditUserModal.svelte` change; status mapping
and period classification stay in a fork-owned helper. Other agents own navigation,
plans and translations. Two requested translation keys are handed back separately.

## Verification

Extend the existing `EditUserModal.billing.test.ts` component suite for RU/EN,
expired versus future/unknown periods, ledger labels/currency and no write calls.
Run focused Vitest, ESLint and formatting in a disposable Compose runner on 2brain.
No large Mac build or production writes.

## Frozen result

- Four source/test files frozen; existing billing reporting helpers reused unchanged.
- Stored status remains neutral and localized; period facts do not mutate subscriptions.
- Removed duplicate currency suffixes in both balance rows and both confirmation rows.
- Hilbert supplied the two RU keys; EN uses the project's tested key fallback.
  No locale files were edited by this scope.
- Compose snapshot: `2brain.dev:/tmp/airis-edit-user-display.PFGuwA`.
- Focused Vitest: 42/42 in 4 files (8 component, 19 display helper, 5 wallet,
  10 reporting). Four new original component scenarios failed before the fix;
  both existing scenarios passed. Added RUB/USD duplication checks then passed.
- Targeted ESLint and Prettier: PASS; full `npm run check` on this snapshot:
  0 errors, 0 warnings. Existing Vite package-export and Prettier option notices
  are retained in the full log, not claimed absent.
- Worktree/remote SHA256 matches for all four source/test files and package lock.
- Local full log: `/tmp/airis-edit-user-display-final.log`.
- Pending main: combined-agent verification and compiled-browser acceptance.
  No commit, deploy, real money action or production writes performed.
