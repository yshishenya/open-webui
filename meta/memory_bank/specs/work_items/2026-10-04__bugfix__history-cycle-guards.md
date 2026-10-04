# AIRIS — bounded chat history traversal

## Meta

- Type: bugfix
- Status: done (source checks; candidate/CI/merge/production separate)
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
- [ ] Source revision, CI and merge are recorded separately from candidate/production acceptance.

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
- [ ] Branch update contains exact source evidence.
- [ ] CI and merge receipt.
- [ ] Compiled candidate and production receipt.


## Source verification receipt

465/465 frontend tests in 69 files. Five shared/consumer/type checks and two ordinary-navigation/deletion cycle checks. Four actual baseline functions timeout at 100 ms. Chrome: four valid/cyclic/missing-link paths and Enter/Space activation of cyclic response cards pass; zero page errors. Expected cycle-render warnings are retained.

Full types: 4087 errors/170 warnings to 4003/164 (84 errors and six warnings removed, zero additions). Full ESLint: 1477 to 1419 (58 removed, zero additions). Strict lint passes for all 12 changed source/test files; no new suppressions. Existing unrelated formatting is retained in large source files. Seven changed files are fully Prettier clean; edited snippets in the others are formatted. No backend/dependency/schema change. Full quality remains open.

Concrete message typing exposed existing API contracts incorrectly declaring message arrays as strings; ChatActionForm and generateTags now describe their existing wire payloads without changing serialization. Their existing strict lint violations were repaired. The dispatch Message wrapper forwards concrete callbacks. The MapSelector fixture's ten event-loop ticks could expire before dynamic imports; it now waits for the observable click registration with all four behavior assertions retained. This was reproduced during the complete suite; isolated old fixture could pass. This is test-readiness repair, not a map runtime change.
