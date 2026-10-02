# Recover frontend lint after unused reactive declarations

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: `codex/bugfix/frontend-unused-reactive`
- SDD Spec: `meta/sdd/specs/completed/airis-frontend-unused-reactive-2026-10-02-207.json`
- Created: 2026-10-02

## Problem and criteria

Pinned ESLint 8.57.1 throws in `@typescript-eslint/no-unused-vars` when unused Svelte computed variables have no explicit declarator. Three components contain dead reactive values. Their removal exposes ordinary diagnostics in those same files; changed-file CI must also pass.

- [x] Reproduce the exception with the pinned dependencies and trace all affected callers.
- [x] Remove the three unused calculations; retain the independent `/compact` callback.
- [x] A runnable regression lints the three components and their placeholder caller with the unchanged repository rules.
- [x] Touched-file ESLint and formatting pass; frontend tests pass through Docker Compose.
- [x] Full lint reaches ordinary diagnostics rather than crashing; strict typecheck results are recorded honestly.
- [x] Exact source is reviewed and accepted through PR/CI.

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

## Accepted source and candidate verification

PR [162](https://github.com/yshishenya/open-webui/pull/162) accepted source `ca011745aa5f512c113a5f74c652123b8ff84be7` and merged as `4fb52df3d2aa199b699fbd7457fd1ebb4aadd795` on 2026-10-02. All 12 observed status checks were satisfied; dependency review was skipped. CodeRabbit reported success because review is disabled on this base branch; this is not a human review.

The frozen build passed on Node 22.23.3 within repository engines. The final candidate passed all 7 guide E2E scenarios through Docker Compose: public guide, public configuration failure, three signed-in drafts, unavailable explicit model without paid fallback, and draft preservation through registration. A fresh isolated SQLite fixture needed signup enabled and the default user role set to `user` through the existing async Config ORM: the first administrator signup intentionally disables further signups, and the independent E2E service does not inherit the main service role setting. Production configuration was not changed for this fixture. These checks do not send real completions or perform payments.

All four SDD tasks are complete. Runtime acceptance is recorded separately in private operational evidence. The repository-wide lint/typecheck gate remains open at the recorded counts; this completed bugfix resolves the reproducible linter exception and the touched-file diagnostics.
