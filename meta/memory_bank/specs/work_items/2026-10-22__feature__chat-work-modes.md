# AIRIS: «Чат» и «Работа»

## Meta

- Type: feature
- Status: active
- Owner: Codex
- Branch: codex/feature/chat-work-modes
- SDD Spec: N/A — focused existing-menu change and configuration, no new execution subsystem.
- Created: 2026-10-22
- Updated: 2026-10-22

## Goal / Acceptance Criteria

- [x] Rename the existing production terminal connection to «Работа» using configuration.
- [x] Show explicit «Чат» and «Работа» choices independently of the model selector.
- [x] «Чат» clears terminal selection and disables direct terminals; «Работа» selects the existing personal environment.
- [x] Re-selecting «Работа» keeps it enabled. Model changes do not implicitly re-enable Work after choosing Chat.
- [x] Use Chat by default by removing model terminal defaults through configuration.
- [x] Verify the real menu, request terminal selection, and file execution without changing resource limits or access grants.

## Scope / Non-goals

Reuse the existing terminal selector, model capabilities, authentication, file handling and execution loop. No duplicate models, model routes, pricing changes, new dependencies, new runtime, browser automation subsystem, or restart recovery in this first step. Existing non-terminal chat features remain available. Existing per-user terminal isolation and lifecycle remain unchanged.

## Upstream impact

TerminalMenu.svelte receives explicit off selection and visible mode labels. Russian/English dictionaries receive Work. No backend contract changes. Configuration renames the existing connection (same ID) and removes only that connection's terminalId defaults from active models. Keep a private, server-side configuration rollback record, use compare-before-write, and verify unchanged non-target fields.

## Verification

Focused runnable selector check, frontend suite/format/lint/type checks with existing debt distinguished, clean production build from the existing pinned platform profile, guarded rollout, production configuration and UI checks. No backend code/schema change; backend suite only if a changed path warrants it. Preserve unrelated working-tree changes and current production release provenance.

## Risks / Rollback

Switching to Chat affects future calls; it does not undo work already completed in the personal workspace. The existing app layout saves the last selected terminal in browser storage; choosing Chat clears it. Fresh browser sessions without a saved choice start in Chat. Restore the prior image and only the configuration fields captured for this task if rollback is required. Do not overwrite concurrent configuration changes.

## Implementation / review evidence

- Existing connection renamed in one locked database transaction; matching model defaults removed from 16 records. Read-only follow-up: all 30 active models have no terminal default and global metadata has none.
- Private configuration rollback record retained server-side; no connection authentication, access grant, policy or limit changed.
- Full frontend suite: 236 files / 2615 tests passed after updating the old toggle expectation. Focused selector regression checks Chat clearing, disabling direct terminals, preserving system entries and idempotent Work selection.
- Source review: Chat request uses current selection for terminal_id; direct terminal tools are removed when disabled. No new network path or dependency. All 557 backend files match the accepted production manifest.
- Initial release accepted: source c63de6eb38afaac786fad5bf6df7338d15b074b3, image sha256:3b9e0ba5b3d679a44c7dd0780cf5d43c88ed01bd94984b4d0842813229c23e1c (PR380 merged). Browser verified Work execution and file content AIRIS_WORK_OK_20261022 on Claude Haiku 5.5, then Chat response ЧАТ_ОК on the same model. Selection persists across reload; changing models does not force Work.
- Current release backup is verified in private storage on 2brain.dev; matching manifests/sizes and restrictive permissions checked before local duplicate removal. Guarded deployment retained the 10 GiB free-space threshold. Temporary build materials were removed; reports retained.
- 2026-10-22 follow-up: user requests ChatGPT-like mode switching and explicitly supersedes the earlier no-hints preference. Reuse Dropdown with a rounded trigger, chevron, two larger menu rows, selected check and short localized explanations. No new state, APIs or execution changes.
- [ ] Verify and release the visual/hints follow-up.
