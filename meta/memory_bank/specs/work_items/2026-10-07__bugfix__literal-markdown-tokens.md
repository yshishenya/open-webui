# Literal name replacement in Markdown responses

- Type: bugfix
- Status: done
- Workflow: bug_fix
- Owner: Codex
- Branch: `codex/bugfix/literal-markdown-tokens`
- Created: 2026-10-07
- SDD Spec: `meta/sdd/specs/completed/airis-literal-markdown-tokens-2026-10-07-001.json`

## Cause and scope

Markdown rendering passes model.name and session user.name to replaceTokens. A string
replacement interprets dollar sequences as replacement directives, corrupting names
and duplicating surrounding response text. Trace the shared renderer and its callers;
use a replacement callback for literal values, preserving existing file-id callbacks,
null/undefined skip behavior, and the code-block exclusion. No subsystem/dependency.

## Measurable acceptance

- [x] Regression fails on accepted baseline and passes for literal dollar sequences in model/user names.
- [x] Existing case-insensitive name tokens and media/file-id tokens remain correct; null/undefined, empty names and code spans/fences preserve their contract.
- [x] Ordinary names produce identical output on a deterministic comparison corpus.
- [x] Actual source checks pass for changed files; full type/lint comparison introduces zero normalized diagnostics.
- [x] Compiled browser and guarded production candidate accepted; unrelated settings/data preserved before closure.

## Upstream impact

Minimal typed replacement handling in src/lib/utils/index.ts, the existing shared
upstream helper. Actual helper regression is fork-owned. The Markdown consumer and
its chat/channel/citation/file/structured-output callers do not need separate patches.
Global G14/13.11 and human/calendar onboarding conditions remain independently open.

## Source validation

Baseline 7 failures/6 passes; fixed 13/13. Full frontend 744/744. Ordinary-name
corpus 10000/10000 identical. Changed-file ESLint passes; changed helpers and test
are formatted, preserving existing unrelated formatting in MessageList. Global
types 3369 -> 3362 errors, warnings 131; ESLint 1231 unchanged. Zero new normalized
diagnostics. Global G14/13.11 remains open; global commands still return 1.

## Runtime and completion

PR319 source `0b43a8ce6ca071ce91b45083175a0dc906f7aa8d`, merge
`26473575ea968d9bd949217e8d08663d548ed406`: identical trees. All 10 distinct
applicable CI checks succeed; dependency-review skipped, CodeRabbit review disabled.
Compiled Chromium/Firefox 26/26 and full onboarding/payment path 24/24 pass,
zero page errors. An initial media assertion exposed an existing independent
HTMLToken video source mismatch: this release preserves emitted media markup and
code exclusions; native video playback is not claimed.

Guarded frontend release `literal-tokens-0b43a8ce6-20261007`, registry digest
`sha256:4be56f5a431da0af4d698b9a3227b8650ca07469b25244e8ec525616719b83f3`:
4914 frontend hashes match the candidate; 427 backend files, environment,
configuration, money records and 13 neighbors preserved. Backup/restore-readability,
migration and health gates pass, restart count zero, free space above 10 GiB.
Image selection persisted without another recreate. Existing authenticated
production guide button opens the complete draft with Luna and submit=false,
zero browser errors. Profile names were not changed in production.

Linked SDD 3/3 completed and check-complete/complete-spec pass. Overall onboarding
198/244 and G14/13.11 remain open; human/calendar conditions are unchanged.
