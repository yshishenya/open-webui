# Channel and message frontend data contracts

Workflow: refactoring. Owner: Codex. Status: Source accepted; integration and release pending.
Branch: codex/refactor/channel-message-contracts.
Base: origin/airis_b2c d579f5c02926cace8c8da60434ce1c39c7284361; explicit accepted dependency621d20524d6c8e1fc90f5929ff2d9ed38f38bc3e.
SDD Spec: meta/sdd/specs/completed/airis-channel-message-contracts-2026-10-09-011.json

## Goal and measurable criteria

This is one source step toward G14 of the existing final onboarding-retention goal. Represent actual channel detail, full/slim/pinned messages, socket events, and optimistic pending messages without inventing backend fields. Reuse existing attachment, structured output, session user, and access grant types.

- [x] Trace all API callers, emitter variants and affected component props before changes.
- [x] Describe full channel response without last_message_at; keep list contract intact.
- [x] Describe nullable forms and data:false/true/null versus loaded data; server response fields remain exact, optimistic state separate.
- [x] Type channel/thread state and connected props; no new Any, dependencies, suppressions or hidden assertions.
- [x] Existing22 loading and16 capture regressions pass; full frontend tests pass; complete type/lint diagnostic comparison recorded.
- [x] Type-only edits produce identical erased JavaScript and template/CSS. Any necessary runtime guard is reproduced and checked separately before acceptance.
- [x] Required Docker backend format/lint/test results retained; production and21 protected primary files preserved.
- [x] Commit and push source/docs; verify exact remote SHA. General quality, missing preflight, PR/integration/image/production and final human/mail/pilot gates remain separate.

## Scope and upstream impact

Fork-owned channel-types.ts owns contracts. Upstream channel API receives only concrete type annotations. Minimal connected annotations in channel components replace null/never/Function inference. No API payload/schema/config/dependency changes. No broad formatting. Existing Svelte/TypeScript types and installed compiler are reused; no new integration or unfamiliar API.

## Verification and rollback

Docker Compose-first frontend tests/check/lint plus formatting on changed files; backend full PostgreSQL suite and readonly Black/Ruff. Compare full diagnostics against dependency source. Verify erased TypeScript JavaScript and unchanged template/CSS for purely typed files. Retain one runnable verifier and existing regression checks. Revert this isolated source commit to roll back. Own test fixtures use tmpfs; preserve production backups and shared caches.

## Verified isolated source — 2026-10-09

Source `7298a0a07161d6019a75e24f0fae2ffb0c8db6fa` pushed to `codex/refactor/channel-message-contracts`; exact remote source SHA matched. Ten source/test files,415insertions/109deletions. API/detail/full/slim/pinned/reply/pending/event contracts reflect inspected server models and emitters. ChannelFullResponse intentionally excludes last_message_at. MessageForm accepts null as the server does. Exact response types remain separate from optimistic partial state; existing attachments/output/session users/access grants reused.

Connected Channel/Thread/Messages/Input/Navbar/Pinned props are typed. Message's id/action callback annotations accept the same displayed variants; its renderer and input file internals still need the remaining general-quality work. This stage does not claim zero diagnostics across the complete channel subsystem.

Unavailable state guards reproduced on original handlers:9failures/7positive cases passed; corrected16/16. Real component scripts and inline callbacks cover missing channel/list/editor, typing after selection clears, delete/edit/pin/reaction without confirmed channel/user, pinned list unavailable, and valid selected submissions/actions. Existing22 loading and16 capture regressions pass; combined54/54. Initial editor harness lacked a document stub; it was fixed without changing the handler or assertion. Final identical regression ran against original readonly component overlays and corrected files.

Full Docker frontend998/125files; backend/PostgreSQL1025,failures/errors/skips0,182warnings. Black454unchanged; Ruff547unchanged. Final type errors2230→2093,warnings108;137messages removed,added0. ESLint1019→1012,added0. Two incorrectly broad Vitest Mock return annotations were found by the full type check, corrected to actual unknown[]/Promise<null> generics and rechecked. The correction has identical erased JavaScript; final16guard tests rerun successfully. The full998suite ran on the same runtime and remains valid. All454backend/1063frontend source hashes verified; only this erased test-type correction separates initial full-test snapshot from final snapshot.

API and shared type module erased JavaScript match the accepted dependency exactly. Navbar/Message script, template and CSS unchanged after erasure; pinned script also unchanged. Other script/template differences are the explicitly tested null guards, optional reply/member access and Boolean coercion of an existing truthy disabled flag. All component CSS is unchanged. No runtime dependency/schema/config/backend/protocol changes. No build/image/browser run was performed for this type/guard step; compiled UI from the preceding loading-events stage remains separate evidence.

Production readback at2026-10-09T10:23:38.367500UTC:sourcec0ea9dd7823a89e21a8bd58f1e8eef6fe930b908,healthy/restarts0; image/ENV/config/mounts and12neighbors matched before.21protected primary files unchanged. No remote mutations. Own PostgreSQL fixture used tmpfs with Mounts=[]; removed after tests. Compose-created two empty volumes had no users and were verified empty before exact removal. Shared test network/cache preserved; no copied databases/archives/build outputs retained.

First Compose attempt hit exhausted network pools; subsequent checks used the existing test network. The first chosen dependency cache lacked svelte-kit; the already populated accepted-stage cache was then selected. An initial pytools command incorrectly repeated its shell entrypoint and did not run tools; corrected command produced actual Black/Ruff logs. All failed setup/test attempts remain in the evidence directory; they are not counted as passing checks. The SDD CLI generated a four-digit time suffix; this own identifier was normalized to the required three-digit suffix before full schema validation.

Proof:`/Users/yshishenya/.codex/private-artifacts/airis-channel-message-contracts-20261009`:verify-checks.py,test-acceptance.json,diagnostic-comparison.json,tested-source-snapshot.json,final-source-snapshot.json,erasure.json,test-type-erasure.json,backend-results.xml,frontend/backend/quality/original/fixed logs,production-before.json,production-after.json,cleanup.json and receipt.json. Receipt records final source/docs SHA, exact remote and1517tested Git blobs after delivery.

- [x] Isolated source contracts/guards/checks, preserved primary/runtime, source push and source-scope SDD complete.
- [ ] General quality and preflight, PR/integration, new image and production acceptance.
- [ ] Full A/B human/mail/Reply-To/two operators/payment/receipt/device/pilot24h/72h/14d/mature cohort acceptance.

Plan198/244,46open,new numbered closures0; final goalactive. Next source block: remaining channel input attachments/suggestions and renderer/member props, then remaining common frontend quality. This source step cannot close G14/13.11/13.16.
