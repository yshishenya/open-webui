# Shared contracts for the main chat path

- Type: refactor
- Status: In Progress
- Owner: Codex
- Branch: codex/refactor/chat-core-contracts
- SDD Spec: meta/sdd/specs/active/airis-chat-core-contracts-2026-10-07-001.json
- Plan: 2026-10-01**local**onboarding-retention-implementation-plan.md, global quality gate G14/13.11

## Goal and measurable acceptance

Remove the shared-data and handler type errors in Chat, MessageInput, ResponseMessage and RichTextInput as one coherent quality block. Baseline source b34184a147cc344d95336cd01923aebdc253dc91: 85 + 86 + 67 + 57 = 295 errors in those four files, full check 2942 errors/113 warnings, full ESLint 1110 errors. These remain failing gates until verified.

- [x] Trace shared history, attachments, status, usage, feedback, editor events and all relevant producers/consumers.
- [x] Reuse the existing fork-owned chat_history/frontend-contracts definitions; remove competing local message descriptions.
- [x] Zero type errors in the four main files and directly modified shared contracts; zero new diagnostics elsewhere.
- [x] Touched-file lint/format pass without suppression, any, dependency or configuration relaxation.
- [ ] Full frontend tests pass (baseline 921), regression checks preserve actual chat editing/streaming/cancellation behavior.
- [ ] Both compiled browser projects pass; integration tree matches tested source; applicable CI succeeds.
- [ ] Protected production identity/assets/health/backups/money acceptance documented, with existing backend/static policy retained.

## Boundaries and upstream impact

Use native types and installed dependencies. Define fields from actual producers, not speculative API shapes. Keep optional legacy data optional. Do not claim a runtime bug fixed from a compiler warning alone; reproduce behavior before changing it. Existing large upstream components retain their structure to avoid unrelated sync conflicts. Thin imports/types in upstream files point to existing Airis contracts. No backend/schema/provider/payment/mail changes.

## Dependency and source provenance

No new dependency or unfamiliar provider introduced. TypeScript 5.5.4 and Svelte 5.0.0 remain pinned. Branch now follows accepted integration 739994ee617040572d2c189770af59413d1c0371 after PR355 source and PR356 documentation. Previous GitHub HTTP500 recovered. The microphone release is accepted on production source b34184a147cc344d95336cd01923aebdc253dc91; this refactor has separate source/CI/production proofs.

## Verification and status

Docker Compose with existing dependencies and no network for source checks. Full global quality, independent usefulness, physical devices, mail, real payments, pilots and calendar gates remain open. Overall plan 198/244; this work does not close a numbered item until its measured criteria are fulfilled.

## Initial investigation

ResponseMessage duplicates an incomplete message interface while Messages and Chat already use chat_history.ts. Code executions are produced and keyed by id, while the local duplicate declares uuid. Citations binds a component to HTMLDivElement. Both KokoroWorker callers pass an object to a string constructor; the actual constructor and both Svelte script/markup call arguments reproduce an object in the init payload with a synthetic Worker (two cases). This is a data-contract reproduction, not successful ML loading or physical audio. Private evidence: airis-chat-core-contracts-20261007/investigation.json and worker-constructor-before.json. No application changes yet.

## Source verification progress

2026-10-07: all four main components now have zero type diagnostics. Full check: 2599 errors/111 warnings (baseline2942/113); normalized diagnostic additions0. Full ESLint1097 errors (baseline1110), additions0; changed-file lint0. Existing errors in sibling/channel/note/legacy utility areas remain and the global G14/13.11 gate stays open. No new dependencies, any annotations or rule suppressions. Existing Chat and ResponseMessage suppressions removed.

Full frontend suite932/932 passed; the subsequently added actual installed TipTap selection-plugin check1/1 passed separately. Additional actual Google Picker paths7/7 (cancel, regular download, Workspace export, invalid result, download/config/OAuth failures), error extraction1/1 and two actual Kokoro constructor call sites passed. Synthetic Google/Worker checks establish application data flow, not real OAuth/ML loading or physical audio. Frozen-SHA suite, compiled browsers, CI, integration and production remain pending.

Installed Kokoro1.2.1 latest confirmed, TipTap/HEIC/Turndown contracts inspected against installed source/docs. Kokoro calls now forward a string precision rather than an object. Editor focus uses installed isFocused; file storage and native custom-event payloads are shared with all sibling callers. Shared error rendering accepts legacy unknown values; Google Picker executor is synchronous and propagates failures.

Private proofs: airis-chat-core-contracts-20261007/{types-r11.log,diagnostic-comparison.json,quality-r1.log,frontend-r1.log,regressions-r3.log}. Fresh production2026-10-07T16:05:54Z remains on b34184a147cc344d95336cd01923aebdc253dc91, healthy/restarts0. This source is not yet deployed.

Verification correction: the initial frozen-suite selection test identified a bound callback by function text and failed. It now identifies the original plugin spec callback; actual installed behavior rechecked. CI found a generated SDD id outside the required NNN naming convention; corrected without changing validation rules. Frozen source and CI will be repeated for the new SHA.
