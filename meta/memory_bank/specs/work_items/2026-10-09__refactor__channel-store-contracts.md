# Channel list store contracts

## Meta

- Type: refactor
- Status: active
- Owner: Codex
- Branch: codex/refactor/channel-data-types
- SDD Spec: meta/sdd/specs/active/airis-channel-store-contracts-2026-10-09-638.json
- Created: 2026-10-09
- Updated: 2026-10-09

## Context

The shared channels store infers `never[]`; channelId infers only `null`.
Consumers cannot safely read channel identifiers, types or names. This is one
root cause of the open full frontend quality gate. PR #367 remains frozen and
is a separate release prerequisite; this branch starts from origin/airis_b2c.

## Goal / Acceptance Criteria

- [x] Match ChannelModel, ChannelListItemResponse and UserIdNameStatusResponse.
- [x] Type the shared list/current-id stores and getChannels response without changing requests, errors, sorting or initialization.
- [x] Compile-time checks accept null metadata/users/id and arbitrary stored channel type; reject wrong identifiers and unchecked list items.
- [x] JavaScript emitted for both modified runtime modules is byte-identical to the base.
- [x] Full frontend tests pass with zero failures/skips.
- [x] No new normalized global type/lint diagnostics; report the remaining full gate honestly.
- [ ] Commit and push the reviewed source, open PR to airis_b2c and read CI for that SHA.

## Non-goals

Channel event ordering, message loading, timers, UI changes, payments and pilot
activation. Do not expand this mechanical block into speculative runtime fixes.

## Scope / Upstream impact

Add a fork-owned channel list type module using existing SessionUser status
fields. Only type imports/annotations in src/lib/stores/index.ts and
src/lib/apis/channels/index.ts: upstream runtime output must remain identical.
No dependency, configuration, database or API wire changes.

## Verification

Docker Compose-first: existing Node 22 frontend image and accepted dependency
volume, `npm run test:frontend`, `npm run check`, `npm run lint:frontend`.
Use the pinned TypeScript compiler to compare emitted runtime modules with
the integration base. Compile-time assertions are checked by svelte-check.
Backend files are unchanged; mandatory backend checks before commit still apply.

## Risks / Rollback

Stricter types may expose consumer defects. Keep nullable server fields truthful
and do not weaken compiler rules or use Any. Revert this commit to roll back.
The general quality gate remains open until every mandatory check passes.

## Completion Checklist

- [ ] SDD check-complete and complete-spec.
- [ ] Branch update records measured results and remaining release prerequisites.

## Measured source verification

- Base: `d579f5c02926cace8c8da60434ce1c39c7284361`.
- Full frontend: 946/946 passed, zero failures/skips.
- Full typecheck: 2293 -> 2275 errors, 108 warnings; 18 removed, zero new normalized diagnostics. New type assertions: zero diagnostics.
- Full ESLint: 1020 -> 1020 errors, zero new diagnostics.
- Scoped Prettier/new-module ESLint: passed. No dependency or backend changes.
- Pinned TypeScript 5.9.3 emits byte-identical JavaScript for both edited runtime modules. Type imports introduce no runtime dependency cycle.
- SDD validation: zero errors/warnings.
- Full Ruff: 6466 pre-existing errors. Black check: 417 files would be reformatted; no mass formatting performed.
- Full backend tests: 1007 passed, 10 skipped, zero failures (107.22s). All 10 PostgreSQL-only scenarios then passed on a separate disposable PostgreSQL database (10/10, zero failures/skips); the temporary database was removed. Tests used current backend source, existing dependencies and a temporary isolated filesystem. Initial plain pytest failed module lookup; rerun uses python -m pytest and explicit PYTHONPATH.
- No npm preflight script exists in this repository; the explicit workflow checks are used. General quality gate remains open; PR/release acceptance is pending.
