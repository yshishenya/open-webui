# AIRIS — контракт списка сообщений чата

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/chat-history-contracts
- SDD Spec: meta/sdd/specs/completed/airis-chat-history-contracts-2026-10-04-001.json
- Created: 2026-10-04
- Updated: 2026-10-04

## Context

The shared message list initializes its history to an untyped empty object and its messages to an untyped array. Message graph fields and action arguments are therefore unchecked; the full frontend check reports 110 errors in Messages.svelte. All six consumers (regular chat, shared chat, search preview, hover preview and both export menus) supply a history graph; existing undeclared preview props remain separate debt. The parent/children representation is already persisted and repaired by existing helpers; no new persistence format is needed.

## Goal / Acceptance Criteria

- [x] Describe the actual message graph and edit payload with concrete types, preserving structured output and attachments.
- [x] All source-handler checks pass for empty history, paging, streaming updates, branch navigation, user/assistant editing, annotation and deletion, including persistence failures.
- [x] Complete frontend diagnostics shrink with zero added diagnostics; all frontend tests pass.
- [x] Freeze exact tested source and prepare a reviewable PR; keep production and final product acceptance separate.

## Non-goals

No provider, billing, database or dependency changes. Existing TypeScript 5.9.3 is retained with the repository toolchain; current registry stable 7.0.2 was checked, and a compiler/toolchain upgrade is a separate compatibility task. Official object and optional-property documentation was read. No invented universal message schema. Cyclic ancestry and repeated child descent discovered during tracing require a separately verified shared traversal fix; they are not declared solved by type annotations.

## Scope and implementation

Add a small graph contract under src/lib/utils/airis and annotate Messages.svelte. Reuse the existing OutputItem type. Keep current persistence and branch algorithms. Use a valid empty history as the component default; both callers already supply history. Preserve unknown message extensions through existing object spread and API round trips.

## Upstream impact

Messages.svelte is upstream-owned. Its diff is limited to type annotations and removing unused imports in this component; the empty default graph is made explicit. Do not reformat unrelated components. The first block does not yet type Chat.svelte or shared chat API responses.

## Verification

Docker Compose frontend tests, full svelte-check and full ESLint compared with the exact pre-change baseline, strict changed files, component behavior checks, SDD validation and source review. Backend code is unchanged. Runtime default differences must be reported honestly; deployment acceptance is a separate step.

## Risks / Rollback

Existing histories may contain malformed nodes; graph types describe repaired client state, not validation of arbitrary server JSON. Keep the existing repair boundary and algorithms. Revert this narrow source change if consumer diagnostics regress.

## Completion Checklist

- [x] Close linked SDD after verified checks.
- [x] Mark branch entry Done with evidence.
- [ ] CI and merge receipt are recorded separately after the frozen source is reviewed.

## Source verification result

All 110 message-list errors are removed. Full svelte-check is 4094 errors / 174 warnings (baseline 4204 / 174); four existing caller diagnostics change their printed prop schemas but retain the same source locations and causes. Raw text delta is 114 removed / 4 rewritten, with zero added error locations. Full ESLint is 1500 (baseline 1503), three removed / zero added. All 457 frontend tests pass in 67 files, including 14 message-list checks. The previous source fails the concrete-type probe and passes the other 13 behavior checks. Strict new contract/test ESLint passes.

All 16 existing runtime handlers emit identical JavaScript after annotation erasure. The default history becomes a usable empty graph; the unused default onSelect argument is removed. This is not a claim of whole-component byte identity or production acceptance. Existing callback Function types and preview prop mismatches remain tracked debt; no new rule disables are introduced. Browser/candidate/deployment evidence for runtime changes must be obtained separately.
