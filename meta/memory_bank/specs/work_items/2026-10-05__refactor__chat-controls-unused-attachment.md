# ChatControls: remove unused attachment handler and verify callbacks

## Meta

- Type: refactor
- Status: source complete; integration and runtime delivery tracked separately
- Owner: Codex
- Branch: codex/refactor/chat-controls-unused-attachment
- SDD Spec: meta/sdd/specs/completed/airis-terminal-attachment-cleanup-2026-10-05-001.json
- Created: 2026-10-05

## Context / root cause

Complete caller tracing refuted the relevance of a misleading success toast after cancellation: FileNav declares onAttach but never reads or invokes it. Only two ChatControls templates pass the handler. Remove that unreachable upload logic instead of adding a speculative cancellation feature. Strict CI also exposed eight pre-existing ChatControls lint failures. Repair its unused imports, concrete callback contracts and non-void HTML closing tag. FileNav itself remains byte-identical: its separate reactive/navigation/accessibility debt needs a dedicated behavioral review.

## Goal / measurable acceptance

- [x] Zero handleTerminalAttach references and zero onAttach caller props in ChatControls; FileNav unused declaration is retained with zero calls.
- [x] Active terminal APIs/children and FileNav source remain byte-identical to baseline813db66ab67e527de890eec723cfa3f9253ae4be. No dependency/configuration/migration/API additions.
- [x] Submit/stop/showMessage callbacks match actual Chat and CallOverlay boundaries, including \_raw, processQueue, scroll and save. No Function/any/suppression introduced.
- [x] Svelte client compilation succeeds; ChatControls has zero compiler warnings. HTML resizer structure is preserved with explicit closing tag.
- [x] All547 frontend tests pass. Changed ChatControls strict ESLint, Prettier and diff check pass; full mapped comparison adds zero diagnostics.
- [ ] Commit/push, exact-head CI and merge verified. Public runtime delivery remains separate.

## Scope / upstream impact

Upstream-owned ChatControls.svelte only: delete the unreachable handler, both callback props and its dedicated imports. Remove four other unused imports, define the three function contracts from actual callers and close one div. Both panel layouts retain controls/files/overview/call/artifacts behavior and permission gates. No change to params, stop-token conversions, models, panes or history. FileNav restoration narrows the final PR to one executable component; its unused declaration remains a separately recorded limit.

## Verification

Existing Compose-created frontend container uses the isolated worktree bind.547/547 tests in79files pass. Original/final components compile; FileNav source exactly equal. Typeerrors3743→3742, warnings160→159, ESLint1393→1384. Line-mapped comparison0added,1typeerror/1warning/9lint removed. Full-project checks remain red; no rules relaxed. SDD2/2complete and schema0errors/0warnings. Initial CI spec suffix0237 was rejected; renamed to001 and validation passed. Initial changed-file lint exposed inherited failures, now strict ChatControls lint passes. Backend untouched; runtime acceptance not claimed.

## Risks / rollback

Restore the source commit if needed. FileNav debt, generation/pane contracts and whole-project type/lint failures remain. Existing public Collapsible runtime remains accepted until a separately checked release. Full goal G01–G17 active and plan192/244 unchanged; no new real delivery, payment, pilot or mature cohort evidence.
