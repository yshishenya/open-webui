# AIRIS chat cancellation and history ownership

- Type: bugfix
- Status: completed
- Workflow: bug_fix
- Owner: Codex
- Branch: `codex/bugfix/chat-cancel-history`
- Created: 2026-10-07
- SDD Spec: `meta/sdd/specs/completed/airis-chat-cancel-history-2026-10-07-001.json`

## Context and root cause

Socket cancellation assumes an existing parent and every sibling. Manual stop
also dereferences the current message and uses mutable active chat state after
awaiting the server. sanitizeHistory permits valid root assistant nodes and does
not manufacture missing parents. Delayed stop can therefore mutate a new chat
or a newer generation. Rejected/null/false stop results currently look completed.
Both paths feed the existing queue; preserve its ownership and error behavior.

## Measurable acceptance

- [x] Actual Chat handlers reproduce root/missing graph, delayed ownership and stop-refusal failures on accepted source.
- [x] Both paths safely finish only the selected assistant response group; missing current/parent/child do not throw, text/links/user messages preserved.
- [x] Late stop/event never changes another history/chat/new task/controller or starts its queue; refused stop preserves pending state and reports an error.
- [x] Existing suites and actual handler regressions pass; zero new normalized diagnostics; full type/lint commands retain their measured status.
- [x] Exact source/CI/tree/candidate and compiled browser/full paths accepted; guarded production files/data/config/health accepted before closure.

## Scope and upstream impact

Reuse fork-owned chat_history helper and existing types; thin hooks in Chat.svelte
for socket/manual cancellation and ownership checks. No new dependencies, backend,
schema, quota or payment changes. Existing queue stays the queue implementation.
Unrelated socket payload typing is separate inherited debt; no new Any types.

## Verification and rollback

Docker Compose actual AST-extracted handlers and full frontend suite, changed-file
format/lint, complete type/lint diagnostic comparison. Compiled browser with normal
and repaired histories and delayed cancellation, plus complete onboarding/payment
paths. Fresh production CAS, backup/readability/migration/disk/health/rollback and
source/file identity. Global G14 and independent human/calendar criteria stay open.

## Source verification

Accepted source baseline:24fail/5pass in29 actual-handler cases (original22case subset18fail/4pass). Fixed29/29 and complete799/799 in96files. Changed runtime/helper/test ESLint passes. Full types3357errors/130warnings (5 removed), ESLint1227, zero new normalized diagnostics. Compiled/source/production acceptance still pending.

## Compiled regression preparation

Five scenarios run in both Chromium and narrow Firefox: root/orphan saved
responses, stop refusal/retry, navigation during delayed stop, and a native
streaming background task cancellation. The first four use a synthetic pending
task list to exercise saved UI state; only the fifth creates a real server task.
The existing test-only provider wrapper delays after partial text with no final
usage; production backend and provider settings remain untouched. Source
format/ESLint and existing Python formatter/linter checks pass.

## Final release acceptance

Source `4f15ba1c280a46dc0ef198ff056de5ff9a471e39`, PR323 merged as
`cbaaeb878f55fc2efa00c04efde79a6b74657d5e`; source/merge trees match,
all applicable source CI accepted. Actual29/29, full frontend799/799,
compiled cancellation10/10 (2 real native streaming tasks,8 synthetic saved
history cases), complete onboarding/payment24/24; Chromium and narrow Firefox.
4914frontend and427backend file hashes match the accepted candidate. Backend,
schema, money, environment and Compose retained; image pin adds no recreate.
Docker healthy/restarts0,12neighbors preserved, draft/free Luna/page errors0
verified after reload. First attempt stopped before backup/migration/recreate
after an externally removed temporary terminal; initiator unknown. Fresh exact
preflight accepted the retry; browser reload created a new per-user terminal.
Full types3357/130 and ESLint1227 remain inherited open debt; zero new normalized
diagnostics. Global human/calendar/pilot and overall plan remain open.
