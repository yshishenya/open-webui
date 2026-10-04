# AIRIS — message input ID contracts

## Meta

- Type: bugfix
- Status: done
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
- [x] Source, CI and merge evidence are recorded separately. General quality remains open.

## Scope / Upstream impact

Five erased annotations in existing src/lib/components/chat/MessageInput.svelte. Remove two ignored toolServers bindings in its Chat call sites; the child already reads the imported store and does not reference $$props/$$restProps. Initial values and complete component source outside those annotations are byte-identical. No abstractions, dependencies, provider, migration or draft shape change. Component client/server code is identical; parent markup changes require separate candidate/production evidence before runtime acceptance. Use installed TypeScript/Svelte compiler for focused contract and erasure checks; existing compatibility versions retained, toolchain upgrade separate.

## Verification / Risks

Docker Compose frontend suite, full types/style and strict changed-file lint, actual compiler client/server identity and exact frozen-source comparison. Baseline after ModelMeta:467 tests,3991 errors/164 warnings,1419 ESLint. Annotation alone is not validation of arbitrary server JSON; existing boundaries remain. Real pilot and G14 stay open.

The first type pass removed24 diagnostics and exposed2 previously masked unknown toolServers props at Chat4053/4172. Resolve those call sites instead of hiding the errors. Blank lines preserve diagnostic locations and avoid unrelated parent formatting.

## Verified source — 2026-10-04

Docker Compose frontend469/469 in71 files. First concurrent test process ended with SIGKILL; standalone rerun passes and is retained separately. Final full types3991/164→3967/164:24diagnostics removed/0added. Final full ESLint1419 unchanged, exact list0removed/0added. Strict Chat/MessageInput/test lint passes. Child source changes only in5 erased annotations; client/server JavaScript fully identical. Parent client/server compiled AST identical after removing exactly2 ignored toolServers properties; no script, other markup, initial value, draft, provider or data changes. Two persistent compiler checks pass. SDD3/3 completed, validator0errors/0warnings. General types/style retain exit1 and G14 remains open.

Current parent source differs from deployed files by removing2 ignored bindings. Candidate/production evidence is separate; no new production claimed. Private receipts: airis-message-input-ids-20261004/{types-delta-final.json,lint-delta-final.json,runtime-boundary-proof.json,parent-runtime-boundary-proof.json,tests-after-callsite.log}.

## Accepted source and compiled candidate — 2026-10-04

PR241 source43054d4d3a192fb0ad9e332d7e7bdb8dd75e875c / merge4d9666311292a4b72b1162e97b0c1efdc5283b05 accepted10:07:59UTC. All10CI checks success, dependency-review skipped; CodeRabbit disabled for this base. All8files SHA256 identical after merge. Candidate image3fca9ea6d1009eea6644e6889e79e8ba06dd1b22a24d26ebe484ace14c210105 on localhost6218:4913frontend hashes,21base layers and imageENV preserved. Ordinary disposable user, real local API/storage,6previews+6chat openings passed,0pageerrors/0modelcalls. Initial empty-chat assertion checked before transition settled; final run waits for previous text to disappear, application unchanged. Legal marks are local fixtures, not real consents. Production remains separate pending combined runtime fix for empty-model filter reduction.

## Combined runtime acceptance

The two Chat call-site removals and all erased types are included in PR242 frontendcce5a05de,registry/runtime2037787c. All4913compiled files match,component/candidate checks pass and existing production chat renders2messages/input without console errors or message submission.14current neighbors,ENV,compiled counter,backup/rollback/migration and persisted full Compose are verified. Thus runtime acceptance is closed separately from the source/CI proof above;overall quality and real pilot stay open.
