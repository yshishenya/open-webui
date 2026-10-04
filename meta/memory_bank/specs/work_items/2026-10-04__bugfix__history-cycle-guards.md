# AIRIS — bounded chat history traversal

## Meta

- Type: bugfix
- Status: done (source, candidate, merge and production accepted)
- Owner: Codex
- Branch: codex/bugfix/history-cycle-guards
- SDD Spec: meta/sdd/specs/completed/airis-history-cycle-guards-2026-10-04-001.json
- Created: 2026-10-04
- Updated: 2026-10-04

## Context

The shared createMessagesList parent walk never terminates on a self-link or two-node cycle. The actual helper hits a 30 ms VM timeout; a valid chain returns normally. Its 22 consumers include sending, regeneration, context, rating and export. Separate unguarded last-child walks appear in Messages navigation/deletion, MultiResponseMessages and Chat.showMessage. Search title selection has an additional parent walk. Existing sanitizeHistory repairs missing edges but does not break cycles; Messages rendering already guards parent cycles.

## Goal / Acceptance Criteria

- [x] Each traversal visits each message ID at most once and terminates for self-cycles, multi-node cycles and missing links.
- [x] Valid parent chains retain the original order, object identity and custom message fields.
- [x] Valid descendant paths retain the existing last-child selection, including root selection after deletion.
- [x] Navigation and deletion preserve sibling branches; model selection uses the most recent reachable assistant.
- [x] Runnable regression checks exercise actual shared functions and actual consumer handlers with bounded execution.
- [x] All frontend tests and strict lint of changed files pass without rule suppression; full diagnostics have zero additions.
- [x] Source revision, CI and merge are recorded separately from candidate/production acceptance.

## Scope

Reuse the existing Airis chat_history module for the safe last-descendant helper. Keep the parent walk in its current shared entry point with a visited-ID guard and a concrete generic signature. Replace duplicated descendant loops with thin calls. Search uses the shared parent list to find the latest assistant. Remove existing lint violations only where the mandatory touched-file gate requires it. No dependency, backend, provider, persistence-format or migration change.

## Upstream impact

utils/index.ts: narrow shared parent helper signature and guard. Messages.svelte, MultiResponseMessages.svelte and Chat.svelte: replace repeated last-child loops with one helper; retain surrounding save/scroll behavior. SearchModal.svelte: replace its parent loop with the safe shared list. Existing unrelated formatting is retained. MultiResponse callback contracts and existing accessibility violations must be fixed to satisfy strict touched-file lint.

## Verification

Docker Compose frontend Vitest, svelte-check, full ESLint and strict changed-file ESLint. Compare exact-base diagnostics (4087 errors/170 warnings; 1477 lint errors). Regression timeout reproduces the old defect. Local real components and a compiled candidate verify navigation before a separate guarded production rollout. Full quality G14 remains open while old diagnostics remain.

## Risks / Rollback

Malformed histories terminate at the last existing unique node; no stored links are rewritten by traversal. Null start means last root for descendant selection; a missing start returns null. Revert the narrow source change if selection regresses. Do not treat synthetic fixture consent as a real pilot.

## Completion Checklist

- [x] Regression and quality evidence recorded.
- [x] SDD check-complete and complete-spec succeed.
- [x] Branch update contains exact source evidence.
- [x] CI and merge receipt.
- [x] Compiled candidate and production receipt.


## Source verification receipt

465/465 frontend tests in 69 files. Five shared/consumer/type checks and two ordinary-navigation/deletion cycle checks. Four actual baseline functions timeout at 100 ms. Chrome: four valid/cyclic/missing-link paths and Enter/Space activation of cyclic response cards pass; zero page errors. Expected cycle-render warnings are retained.

Full types: 4087 errors/170 warnings to 4003/164 (84 errors and six warnings removed, zero additions). Full ESLint: 1477 to 1419 (58 removed, zero additions). Strict lint passes for all 12 changed source/test files; no new suppressions. Existing unrelated formatting is retained in large source files. Seven changed files are fully Prettier clean; edited snippets in the others are formatted. No backend/dependency/schema change. Full quality remains open.

Concrete message typing exposed existing API contracts incorrectly declaring message arrays as strings; ChatActionForm and generateTags now describe their existing wire payloads without changing serialization. Their existing strict lint violations were repaired. The dispatch Message wrapper forwards concrete callbacks. The MapSelector fixture's ten event-loop ticks could expire before dynamic imports; it now waits for the observable click registration with all four behavior assertions retained. This was reproduced during the complete suite; isolated old fixture could pass. This is test-readiness repair, not a map runtime change.

## Candidate and production receipt

PR238 source `3db735e6e8883741a8e8b0016b6ca0b5ace331ac`, merge `79bb137ee304b58f4fbe945ae375f93bdd467d5d`: ten successful checks, dependency-review skipped. CodeRabbit review was disabled for the base. All fifteen source/document hashes matched after merge.

Compiled candidate: twelve browser preview/open cases with the real local API, SQLite and an ordinary disposable user; valid, cyclic, missing-link, null and absent histories. Zero page errors and completion calls. Existing component checks cover four graphs and Enter/Space activation. The first empty-chat browser assertion timed out waiting for placeholder text; the rerun waits for the actual input and checks that prior assistant content is absent. No product code was changed for that assertion.

Production frontend version `3db735e6e`, immutable registry digest `sha256:2df5cfe13b964a50db4db66d7df9ef6c5063734ac925f4181abe43d2e49c07fd`. All 4,913 frontend files match the build; all 425 backend Python files match the previous runtime. Local image ID differs from remote; all 21 layers, image environment and labels match, including the 19 inherited backend layers. Compiled Metrica counter 111392024 is preserved.

Guarded rollout retained the ten-GiB floor, deployment lock, verified PostgreSQL/data/config backup, hard Alembic gate and previous image for rollback. The initial identity gate stopped before migration/recreation; resumption used the same checked backup after verifying the remote files. Only the app was recreated using all three production Compose files. Default image keys were persisted atomically with a verified config backup; rendered Compose changes only the app image. Health is healthy, restart count zero, all fifteen existing neighbors and the runtime environment are preserved. Public health/version and authenticated existing-chat loading passed, with three rendered messages and zero console errors or messages sent. General quality debt and real pilot conditions remain open.
