# Remove unused bindings while preserving evaluated operations

Workflow: refactoring. Branch: `codex/refactor/unused-bindings`.
SDD Spec: meta/sdd/specs/completed/airis-unused-bindings-2026-10-09-931.json

## Goal and scope

Reduce source-quality debt without changing behavior. Fresh base d579f5c02926cace8c8da60434ce1c39c7284361; explicitly merge dependency fe207513eebfe53b2d830a647d1f2f5dde7e798a. Onboarding plan198/244 and general release gates remain open.

Reviewed42 unused locals and7 migration imports. Only fully annotated functions may change under AGENTS.md. Preserve6 evaluated right-hand sides exactly once; defer22 locals in18 functions pending complete annotations, including5 evaluated assignments: awaited membership/config reads, dictionary pop, property accesses and ORM calls. Remove only one unused empty-list allocation. Exception type/body/context remain unchanged; inspect scopes, lifetime and reflection. Alembic env imports internal.db before executing migrations; prove actual isolated PostgreSQL outcomes.

## Measurable acceptance

- [x] Review callers/scopes; remove27 approved declarations (20 locals and7 imports); defer22 locals in18 untyped functions and preserve453 canonical ASTs/comments under exact allowances.
- [x] Runtime/API/ORM/schemas/tools/forms/migration graph match; isolated PostgreSQL migration outcome matches; review import graph.
- [x] Docker backend1017/frontend952, Black453; no new Ruff diagnostics; unchanged frontend check/lint counts.
- [x] Freeze453backend/1061frontend; preserve primary21/production; remove owned fixtures/temp source; commit/push and prove remote SHA.

## Upstream impact and rollback

Existing declarations contain debt; thin hooks cannot remove unused local names. Preserve evaluations, control flow, exception types, comments and import order. No dependency/config/API/schema migration change. Revert isolated source commit to undo.

## Completion boundary

Focused source acceptance only. General quality0, clean image, combined browser/native/runtime/CI/review/merge/deploy and real mail/payment/pilot/cohort remain open. Private proof: /Users/yshishenya/.codex/private-artifacts/airis-unused-bindings-20261009.

## Scope review

The rejected49-change candidate is excluded from acceptance. Accepted27 changes in23 files:7 redundant migration imports,13 unused exception names,6 evaluated expressions retained exactly once and1 unused empty list removed. All modified functions have parameter and return annotations, including variadics. No reflection or remaining references to removed bindings.

Fresh accepted27 contracts are identical for9 captured sets, including real PostgreSQL migration and replay:77 tables at o1a020261003. Ruff739→712, added0; F4010/F84122. Remaining22 bindings require annotations and caller/schema review; they remain unchanged.

## Verification

Accepted27 source: backend1017 passed,0 failures/errors/skips (116.307s); frontend952/123 passed. Backend453 and frontend1061 hashes remained unchanged. Black453 accepted. Type check remains2271 errors/108 warnings; ESLint1020; both exit1. General quality and PR/release readiness are not passed.

Preserved primary21 and production c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908 at2026-10-09T06:45:23.950474 UTC. Six disposable PostgreSQL databases removed with owned container; actual HostConfig.Tmpfs verified,0 persistent volumes removed. Temporary baseline453 hashes verified before removal.

## Source delivery

Source commit5889cfca3880918d38c79de5eee6440339aa6a66 pushed to codex/refactor/unused-bindings; remote SHA matches. Focused SDD2/2 completed. General checks remain failing, so PR/integration/clean image/production acceptance remain open. No numbered onboarding task closed;198/244 unchanged.
