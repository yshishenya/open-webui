# Saved chat state contract

## Meta

- Type: refactor
- Status: done
- Owner: Codex
- Branch: `codex/refactor/saved-chat-contract`
- Created: 2026-10-06
- SDD Spec: meta/sdd/specs/completed/airis-saved-chat-contract-2026-10-06-001.json

## Scope and evidence

The loaded Chat.svelte state is inferred as any because it starts with null. Creation/get/update all return server ChatResponse/ChatModel; the note embedded callback creates the same server chat. Describe shared stored response and consumed payload fields, reusing ChatHistory, ChatAttachment and ModelParams. Preserve owner read-only rule, legacy messages conversion, model/history selection, variables and autosave dedupe. No API/network/ORM/migration, estimator or billing changes.

## Measurable acceptance

- [x] Trace all chat assignments and server producers; type nullable state and embedded callback.
- [x] Check real consumer expressions for owner boundary, modern/legacy loading, models/variables/params/files and autosave baseline.
- [x] Docker frontend suite passes; mapped full diagnostics remove errors and add0; full lint adds0.
- [x] Full client/server component output and type module JavaScript match baseline; executable changes require separate compiled release acceptance.
- [x] Exact-source CI and merged-tree accepted; source changes committed and pushed.

## Upstream impact

Minimal erased annotations/assertions in Chat.svelte. Shared contract stays in fork-owned frontend-contracts.ts; no new dependency. Source rollback reverts declarations. Whole-goal quality and external pilot gates remain open.

## Local validation

Docker suite: 582/582 tests in 84 files (isolated, 2 workers; a simultaneous run was killed by SIGKILL). Mapped type diagnostics: 3518 -> 3514 errors, 158 warnings, 4 removed/0 added. ESLint: 1348 unchanged, 0 added. Full client/server Chat output and the type module JavaScript are byte-identical. Scoped Prettier/ESLint pass. Backend and migrations unchanged. `npm run preflight` is absent in this repository; actual Docker suite/type/lint/emit checks are recorded above. Overall G14 remains open.

## Source acceptance

PR283 source `ec4d153e37469dc30f85ea8083777b3d42f28fb1`, merge `3c81723de5d996fb4454961afcf9f21773b4fb86`; source/merged tree `3a9a439648f5fc2fe0289a36541be7d5857e52bd` identical. Exact-source CI:11success/1expected dependency-review skip (base-branch check ran twice after metadata edit); independent CodeRabbit review skipped. Self-review and local compiler/consumer evidence accepted. Production9e2546496… remains healthy/restarts0;container/environment/configuration/13neighbors unchanged.193/244 and whole goal active. Private operational snapshots remain outside GitHub.
