# Model knowledge widget and selection contracts

## Meta

- Type: bugfix
- Status: local acceptance complete; source publication and runtime acceptance pending
- Owner: Codex
- Branch: codex/bugfix/model-knowledge-contracts
- SDD Spec: meta/sdd/specs/completed/airis-model-knowledge-contracts-2026-10-07-001.json
- Created: 2026-10-07
- Updated: 2026-10-07

## Context and goal

The model editor contract correction is in PR345. Its knowledge upload/widget and selector still have 25 type errors: untyped arrays, DOM/file bindings and search result callbacks. Reuse ChatAttachment and the existing note fields, keep the persisted selected list unknown[], and distinguish the optional display view from arbitrary saved values. No second upload, search or reference sanitizer is needed.

## Acceptance criteria

- [x] Trace editor binding, file upload and note/knowledge/file search responses and consumers.
- [x] Reuse existing contracts, preserve null/primitive entries and original row indices; no Any, dependencies, weaker rules or suppression directives.
- [x] Preserve search mapping, selection events, deduplication, upload failures and permissions; only necessary DOM guards may change runtime.
- [x] All 25 original widget/selector errors removed with zero new global diagnostics; full frontend tests pass and touched files pass lint/format.
- [ ] Exact-source CI accepted, publication recorded; compiled candidate and production acceptance remain separate where runtime changes exist.

## Upstream impact

Only model Knowledge.svelte and its KnowledgeSelector.svelte are planned. Use existing ChatAttachment/NoteRecord fields and local optional display types, preserve full API records when spreading results, and retain existing async requests and sanitation. No backend, access policy, schema, billing or dependency changes. Remove unused selector icon imports as required by changed-file lint.

## Verification

Docker Compose frontend/check/lint; compare normalized full diagnostic multisets and compiled JS/CSS; existing mounted Knowledge regression covers arbitrary values/removal, with a focused mounted selection/upload check if runtime changes warrant it. Source, candidate and production must not be conflated. Existing pinned Svelte5.56.0 and TypeScript5.9.3 are reused; official references were inspected for PR344 and no new library or integration is introduced.

## Risks

Search result annotations describe server fields, not a new runtime validation boundary. The display view must not alter saved knowledge or discard opaque values. Keep unrelated source edits and all private acceptance documents out of this public PR. PR345 runtime guards are not yet accepted on production.

## Local acceptance

Full frontend **868/868**,106files; the four related checks include actual submit/profile handlers, mounted arbitrary knowledge/removal and a mounted native-input upload flow. The upload check exercises failed-file cleanup, ordinary/audio completion, STT language and permission/image rejection while preserving all previous opaque entries. Its first fixture attempt had four unhandled read-only files errors; the corrected writable test property has no such errors. Those fixture errors are preserved and not described as product defects.

Widget/selector **25→0**, full types **3065→3040**,warnings118 unchanged; exact diagnostic multisets have no new messages. Original full diagnostics reproduce all25 failures; the new runtime upload check also passes on valid original paths and is not claimed to fail on the original. Full ESLint **1161→1158**,3changedsource/testfiles lint0/warnings0. CSS is identical; esbuild-minified compiled output matches the original plus exactly two DOM changes (currentTarget reset/optional click) and two deleted unused icon imports, including removal of compiler-generated name/comment differences. This is not a claim of byte-identical original compiled JS.

Saved selectedItems remains unknown[]; its optional display view and callback annotations do not validate JSON or remove opaque values. PR345 source is merged and its separate exact-source frontend build passed with6527originalsourcehashes preserved; production remains accepted PR344. The secondary runtime changes await the combined candidate/final release.
