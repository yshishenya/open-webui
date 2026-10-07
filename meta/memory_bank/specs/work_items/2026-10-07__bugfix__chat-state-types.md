# AIRIS chat state type contracts

- Type: bugfix
- Status: in progress
- Workflow: bug_fix
- Owner: Codex
- Branch: `codex/bugfix/chat-state-types`
- Created: 2026-10-07
- SDD Spec: `meta/sdd/specs/active/airis-chat-state-types-2026-10-07-001.json`

## Problem and cause

Unannotated arrays/null/timer create implicit-any diagnostics in the primary chat.
OAuth state flows Chat -> Placeholder -> MessageInput -> initiateOAuthRedirect;
task state flows saved chat/socket -> Chat -> MessageInput -> TaskList. Reuse
SavedChat and ComponentProps; derive OAuth input from the existing function.
Embedded history is note-chat records; suggestions are translated strings.
Toast/timer handles derive from existing platform/dependency return types.

## Measurable acceptance

- [x] Reproduce existing diagnostics and trace every caller/consumer.
- [x] No new Any, casts, suppression, dependencies or behavior changes.
- [x] All changed Svelte components have identical erased and compiled JS
      to baseline in client/server modes, ignoring source positions only.
- [x] Full frontend suite passes; complete type/lint comparison has zero new
      normalized diagnostics and removes the targeted state diagnostics.
- [ ] Exact committed source CI and source/merge trees accepted into airis_b2c.

## Scope and upstream impact

Chat.svelte, MessageInput.svelte and Placeholder.svelte: type-only annotations
and imports; existing runtime-state test checks emitted JavaScript so annotations
do not invalidate it. No restructuring or reformatting unrelated upstream code.
No backend, schema, money, quota, mail or production changes. This is bounded
quality debt work for G14/plan13.11; the full A/B goal remains open.

## Verification and rollback

Docker Compose with existing pinned dependency volume; baseline diagnostic log
is reusable only after proving source/config identity with previously tested
source. Compare emitted JS and compiled Svelte client/server code; run full
Vitest, full svelte-check and ESLint, changed-file format checks. Revert source
commit if necessary; no production restart for erased type annotations.

## Source verification

Full frontend799/799 in96files;9/9 erased-script/client/server comparisons identical.
Complete svelte-check3357 ->3327errors/130warnings; ESLint1227 unchanged.
Zero new normalized type/lint diagnostics,30targeted diagnostics removed.
Three other changed files pass Prettier; Chat keeps exactly7existing formatter
hunks with0new ones. Changed-file ESLint retains inherited debt; no suppression
added. Baseline confirmed source/config identical to accepted4f15 source. Backend
and browser rollout tests are not applicable to erased annotations. Source CI
and merge acceptance pending; production remains accepted4f15/d666 image.
