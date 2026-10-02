# Recover frontend lint after unused reactive declarations

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: `codex/bugfix/frontend-unused-reactive`
- SDD Spec: `meta/sdd/specs/active/airis-frontend-unused-reactive-2026-10-02-207.json`
- Created: 2026-10-02

## Problem and criteria

Pinned ESLint 8.57.1 throws in `@typescript-eslint/no-unused-vars` when unused Svelte computed variables have no explicit declarator. Three components contain dead reactive values. Their removal exposes ordinary diagnostics in those same files; changed-file CI must also pass.

- [x] Reproduce the exception with the pinned dependencies and trace all affected callers.
- [x] Remove the three unused calculations; retain the independent `/compact` callback.
- [x] A runnable regression lints the three components and their placeholder caller with the unchanged repository rules.
- [x] Touched-file ESLint and formatting pass; frontend tests pass through Docker Compose.
- [x] Full lint reaches ordinary diagnostics rather than crashing; strict typecheck results are recorded honestly.
- [ ] Exact source is reviewed and accepted through PR/CI.

## Scope and security

Only affected component diagnostics, a regression check, and task records. No new dependencies, global rule changes, provider changes, migrations or mail enablement. Existing HTML preview must remain rendered. Every HTML sink is traced to DOMPurify; direct sanitization at the sink and narrowly explained exceptions follow the existing `Valves.svelte` pattern. No raw untrusted HTML is exempted. Office markup is already sanitized by FileNav; enforce sanitization again at its receiving sink. Mermaid rendering already returns `sanitizeSvg` output. Shiki emits escaped markup; sanitize it before rendering too.

## Upstream impact

- `FilePreview.svelte`: remove unused state, make reactive resets explicit, type the existing Mermaid instance, correct non-void closing tags and document sanitized HTML sinks.
- `MessageInput.svelte`: remove unused state/imports, specify callback signatures and variable map/queue types, correct non-void closing tags; preserve behavior and `/compact` options.
- `ConsecutiveDetailsGroup.svelte`: remove unused imports/computations and redundant parser catch, validate embeds as strings, remove a stale accessibility suppression.
- `Placeholder.svelte`: reuse `MessageInput` callback signatures via `ComponentProps` to keep the empty-chat caller compatible. Import its existing Model type and type the input component reference; remove unused imports and annotate its already sanitized description sink.

Keep all diffs local; do not reformat unrelated files or introduce another renderer.

## Verification and rollback

Docker Compose frontend tests and targeted lint, full `lint:frontend` and `check`, touched Prettier, and `git diff --check`. Backend unchanged. Runtime rollout is a separate acceptance step after source proof; do not reuse release scripts tied to older image identities. Revert this commit for source rollback. The full repository baseline remains a separate open gate until all diagnostics pass.

Initial verification: all 161 frontend tests pass (38 files), including executable ESLint regression, Office XSS rejection and three malformed embed cases. Full lint returns 1657 ordinary errors, zero warnings, without an exception. Initial strict check: 4885 errors / 218 warnings / 287 files, compared with 4893 / 224 / 288 before the change. This initial check exposed four callback incompatibilities in `Placeholder`, repaired by deriving its signatures from `MessageInput`; final strict results follow below. This work does not close the repository-wide quality gate.

Final verification after the caller repair: all 161 tests still pass; all changed frontend files have zero ESLint diagnostics; touched Prettier passes. Full ESLint completes with 1639 errors / 0 warnings. Strict check completes with 4876 errors / 217 warnings / 287 files. Diagnostic comparison with the earlier baseline found no newly failing contract: the remaining Placeholder forwarding of `toolServers` and Suggestions callback mismatch were already present; their printed type signatures changed. Removed dead code and invalid closing tags account for the reduced counts. Backend tests/migrations are not applicable to this frontend-only change. No preflight npm script exists; the actual commands above were run instead.
