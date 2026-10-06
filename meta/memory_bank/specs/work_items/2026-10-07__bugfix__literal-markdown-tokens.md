# Literal name replacement in Markdown responses

- Type: bugfix
- Status: active
- Workflow: bug_fix
- Owner: Codex
- Branch: `codex/bugfix/literal-markdown-tokens`
- Created: 2026-10-07
- SDD Spec: `meta/sdd/specs/active/airis-literal-markdown-tokens-2026-10-07-001.json`

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
- [ ] Compiled browser and guarded production candidate accepted; unrelated settings/data preserved before closure.

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
