# ChatControls: remove the unused terminal attachment channel

## Meta

- Type: refactor
- Status: source verified; delivery pending
- Owner: Codex
- Branch: codex/refactor/chat-controls-unused-attachment
- SDD Spec: meta/sdd/specs/completed/airis-terminal-attachment-cleanup-2026-10-05-001.json
- Created: 2026-10-05

## Context / root cause

The preceding Controls investigation identified a misleading success notification after cancellation in handleTerminalAttach. Complete caller tracing refuted its relevance to the current product: FileNav declares onAttach but never reads or calls it, and neither its extracted children nor the terminal API use this callback. Only two ChatControls templates pass it. This is unreachable upload logic rather than a demonstrated user-facing upload bug. Remove the dead channel instead of adding cancellation logic for a speculative feature.

## Goal / measurable acceptance

- [x] All references to handleTerminalAttach and FileNav onAttach are removed; zero changes to active terminal download/upload/navigation APIs and children.
- [x] The diff removes only the unused prop, both caller props, handler and its three dedicated imports; no new dependency, configuration, migration or API.
- [x] Svelte client compilation succeeds for both baseline and final components; unchanged used FileNav code is verified after accounting for removed prop.
- [x] All existing frontend tests pass. Full type/lint diagnostics have zero additions after source line mapping; counts and existing failures are reported honestly.
- [ ] SDD, spec and branch log agree; commit/push and exact-head CI/merge are verified. Runtime delivery is tracked separately and is not claimed from source checks.

## Scope / upstream impact

Upstream-owned src/lib/components/chat/ChatControls.svelte and FileNav.svelte: delete the unused callback at both desktop/mobile callers and its implementation. Active file uploading/downloading and other callbacks are unchanged. The remaining generation/pane contracts require separate traced work. No new abstractions or tests mirroring dead code. Existing frontend suite plus compiler/source comparison supplies the safety net for this mechanical deletion.

## Verification / rollback

Use the existing Compose-created frontend tools container with the isolated worktree bind. Compare baseline813db66ab67e527de890eec723cfa3f9253ae4be against final with line mapping. Existing full checks start at3743type errors/160warnings/1393ESLint errors. No backend changes, so backend/migration checks are not rerun for this deletion. Revert the source commit to restore the unused prop if needed. Public image remains the accepted Collapsible runtime until a separately checked release.

Full goal G01–G17 remains active and plan192/244 remains unchanged; no new evidence for actual pilot, external delivery, real payment or mature cohorts is implied.

## Source results

547/547 tests in79files pass. Baseline/final client compilation succeeds for both components. FileNav final source equals baseline after removing only its unused export. Type errors3743→3742, warnings160→159, ESLint1393→1391. Line-mapped diagnostic comparison:0added,1typeerror/1warningremoved,2ESLintremoved. Existing full-project checks remain red; no suppressions introduced. Prettier and git diff --check pass. SDD2/2 complete. Exact-source CI/merge pending.
