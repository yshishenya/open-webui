# Welcome Page: Intentional Rollback + Type Safety Cleanup

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/welcome-rollback-intentional
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-24
- Updated: 2026-02-24

## Context

The current local change for `src/routes/welcome/+page.svelte` is an intentional rollback to a previous landing implementation. During review, the rollback version contained `any` usage in Telegram auth callback bindings and failed frontend lint checks.

## Goal / Acceptance Criteria

- [x] Keep the intentional rollback of `/welcome` page implementation.
- [x] Remove `any` usage in Telegram callback path so lint passes.
- [x] Preserve existing redirect/auth behavior in the rollback version.

## Non-goals

- Re-design of `/welcome` landing content.
- Refactor of reusable landing components.
- Changes to backend auth endpoints.

## Scope (what changes)

- Backend:
  - None.
- Frontend:
  - `src/routes/welcome/+page.svelte` rollback content retained.
  - Typed Telegram auth payload/response and window callback binding.
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `src/routes/welcome/+page.svelte`
- API changes:
  - None.
- Edge cases:
  - Missing optional fields in Telegram response are guarded.

## Upstream impact

If this work touches upstream-owned files, list them here and explain why (and how the diff is minimized):

- Upstream-owned files touched:
  - `src/routes/welcome/+page.svelte`
- Why unavoidable:
  - `/welcome` page implementation lives in upstream-owned routing file.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - No extra refactor; only keep intended rollback and minimal type-safety fixes.

## Verification

Docker Compose-first commands (adjust if needed):

- Frontend lint (targeted): `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/eslint ]; then npm ci --legacy-peer-deps; fi; node_modules/.bin/eslint src/routes/welcome/+page.svelte"`

## Task Entry (for branch_updates/current_tasks)

Use this snippet in `meta/memory_bank/branch_updates/<YYYY-MM-DD>-<branch-slug>.md` and later in `meta/memory_bank/current_tasks.md`:

- [ ] **[BUG][WELCOME]** Keep intentional /welcome rollback and restore TS lint compliance
  - Spec: `meta/memory_bank/specs/work_items/2026-02-24__bugfix__welcome-intentional-rollback-typing.md`
  - Owner: Codex
  - Branch: `codex/bugfix/welcome-rollback-intentional`
  - Started: 2026-02-24
  - Summary: Preserve intentional rollback of `/welcome` while removing `any` usage in Telegram callback path.
  - Tests: targeted frontend lint for `src/routes/welcome/+page.svelte`
  - Risks: Medium (landing-page UX/content changed by rollback).

## Risks / Rollback

- Risks:
  - Intentional rollback changes landing UX and content scope.
- Rollback plan:
  - Revert commit to restore latest `/welcome` implementation.

## Completion Checklist

- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)
