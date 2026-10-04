# AIRIS — message input ID contracts

## Meta

- Type: bugfix
- Status: verified; CI/merge/candidate/production pending
- Owner: Codex
- Branch: codex/bugfix/message-input-id-contracts
- SDD Spec: meta/sdd/specs/completed/airis-message-input-id-contracts-2026-10-04-001.json
- Created: 2026-10-04
- Updated: 2026-10-04

## Context / Root cause

MessageInput declares selectedModels as a single empty-string tuple even though both Chat call sites and ModelSelector pass ordinary string lists. Three integration ID lists infer implicit any[], and null-only taskIds makes the active-task check impossible to type. All consumers, drafts, capability selection, empty resets, filter removal and UUID task creation were traced. No changes to attachments or runtime algorithms.

## Goal / Acceptance Criteria

- [x] Empty, single and multiple string IDs compile; numeric IDs are rejected for all five lists; taskIds retains null.
- [x] Full Svelte client and server emitted code is identical to the frozen base.
- [x] Full frontend tests and strict changed-file lint pass; exact types/style diagnostics add zero errors or warnings.
- [ ] Source, CI and merge evidence are recorded separately. General quality remains open.

## Scope / Upstream impact

Five erased annotations in existing src/lib/components/chat/MessageInput.svelte. Remove two ignored toolServers bindings in its Chat call sites; the child already reads the imported store and does not reference $$props/$$restProps. Initial values and complete component source outside those annotations are byte-identical. No abstractions, dependencies, provider, migration or draft shape change. Component client/server code is identical; parent markup changes require separate candidate/production evidence before runtime acceptance. Use installed TypeScript/Svelte compiler for focused contract and erasure checks; existing compatibility versions retained, toolchain upgrade separate.

## Verification / Risks

Docker Compose frontend suite, full types/style and strict changed-file lint, actual compiler client/server identity and exact frozen-source comparison. Baseline after ModelMeta:467 tests,3991 errors/164 warnings,1419 ESLint. Annotation alone is not validation of arbitrary server JSON; existing boundaries remain. Real pilot and G14 stay open.

The first type pass removed24 diagnostics and exposed2 previously masked unknown toolServers props at Chat4053/4172. Resolve those call sites instead of hiding the errors. Blank lines preserve diagnostic locations and avoid unrelated parent formatting.

## Verified source — 2026-10-04

Docker Compose frontend469/469 in71 files. First concurrent test process ended with SIGKILL; standalone rerun passes and is retained separately. Final full types3991/164→3967/164:24diagnostics removed/0added. Final full ESLint1419 unchanged, exact list0removed/0added. Strict Chat/MessageInput/test lint passes. Child source changes only in5 erased annotations; client/server JavaScript fully identical. Parent client/server compiled AST identical after removing exactly2 ignored toolServers properties; no script, other markup, initial value, draft, provider or data changes. Two persistent compiler checks pass. SDD3/3 completed, validator0errors/0warnings. General types/style retain exit1 and G14 remains open.

Current parent source differs from deployed files by removing2 ignored bindings. Candidate/production evidence is separate; no new production claimed. Private receipts: airis-message-input-ids-20261004/{types-delta-final.json,lint-delta-final.json,runtime-boundary-proof.json,parent-runtime-boundary-proof.json,tests-after-callsite.log}.
