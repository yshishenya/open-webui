# Chat attachment contracts

## Meta

- Type: refactor
- Status: done
- Owner: Codex
- Branch: codex/refactor/chat-attachment-contracts
- SDD Spec: meta/sdd/specs/completed/airis-chat-attachment-contracts-2026-10-04-001.json
- Created: 2026-10-04

## Goal / Acceptance Criteria

- [x] Reuse and refine the existing history attachment record across Chat, MessageInput and forwarding Placeholder.
- [x] Temporary images, extracted text, upload placeholders/results, web content, collection/chat/folder/note references retain their optional fields and unknown extensions. Numeric IDs/URLs/sizes and invalid lists are rejected by a strict probe.
- [x] All changed complete component client/server JavaScript and shared module runtime are byte identical.
- [x] All frontend tests pass; diagnostic delta is fully accounted for: removed, refined and newly exposed existing incompatibilities; no new executable behavior or suppression. Global debt remains visible.
- [x] SDD closed/valid, work item and branch log updated, source/tests/docs committed and pushed for exact CI/review against airis_b2c.

## Traced flow / Scope

Existing ChatHistoryMessage.files is an extensible record with known type/content_type. Refine that existing contract and reuse it. Chat restores stored files/drafts/queued submissions, merges embedded files with incoming priority, deduplicates by type/id/url/name and by equality, filters references and non-image uploads for backend submission. MessageInput writes upload placeholders, uploaded server files, temporary extracted text/images, dragged chat/folder/note references, pasted full-content files and Google/OneDrive files. ChatControls attaches terminal blobs. Both control layouts display/persist chatFiles, and FileItem displays descriptors with heterogeneous optional name/type/size.

Actual uploaded FileModelResponse is separate from the client descriptor; payload/metadata may be nullable and provider extensions remain unknown. Do not make an image's optional server ID/name/size mandatory. Preserve error cleanup by itemId and modal mutations of descriptor context/file/files. Existing history, graph, message, model and upload tests remain the runtime safety net; add a strict contract probe.

## Upstream impact / Non-goals

Minimal type imports/annotations in Chat and MessageInput; shared fork-owned chat_history.ts owns the refined record. No new runtime helper, package, backend/API/persistence/config changes or formatting cleanup. Placeholder forwards the existing MessageInput files prop type. The FileReader onload result is typed as string because its only initiating method is readAsDataURL; this native boundary assertion erases without changing behavior. Keep missing/nullable field issues visible rather than assertions/suppressions. Controls/ChatControls/FileItem were traced but their annotations are deferred with their existing lint/runtime defects.

## Verification / Risks

Compose-created frontend tools: full tests/check/lint; compare diagnostic messages and original line locations. Compile complete changed Svelte components for client/server and transpile shared module, with exact before/after byte comparison. Shared module/test/docs formatting; retain upstream formatting debt. Backend unchanged; no backend test repetition or production build if all executable bytes match.

Narrow types may expose mismatched consumers; trace and fix declaration contracts only, or separate real behavior fixes under bug workflow. Full G01-G17 remains active; no new numbered plan closure from this refactor alone.

## Verified result

Baseline: 58d4c0a114ad25dbe980272ac480fad0e1873547. All 493 frontend tests pass in 74 files after the final scope adjustment. All three complete changed components compile to identical client/server JavaScript; both complete shared TypeScript modules transpile identically: 8/8 comparisons. No production rebuild is required.

Full check: 3848 → 3799 errors, 164 warnings unchanged. Complete diagnostic messages are compared after mapping changed lines to original lines: 57 removed, no refinements, eight newly exposed in unchanged executable statements. Full 1419 ESLint diagnostics are identical. Neither global check nor lint is green. No new dependency, Any, runtime fallback or external response assertion.

Outstanding incompatibilities (original baseline lines):

- MessageInput:1618 (two diagnostics) and :1624: an image descriptor can have a missing/null URL; startsWith and Image src expect a string.
- MessageInput:1682/1683/1684/1685: the existing FileItem declaration incorrectly accepts only null item and mandatory name/type/size, while real heterogeneous attachments can omit them.
- MessageInput:1690: optional type reaches includes(string).

The first CI lint run found 14 existing errors in ChatControls/Controls/FileItem (unused declarations, self-closing non-void HTML and nested buttons). Their type-only annotations were restored to the baseline, avoiding an unrelated behavior repair in this PR. These components remain explicit follow-up work under the full G14 goal; no lint rule or global acceptance was relaxed. Intermediate 3782/14-comparison results are superseded by the final scope/results above.

The native FileReader string assertions are supported by the initiating readAsText/readAsDataURL methods and successful load callbacks; real jsdom native reads are checked. These erase from JavaScript and do not assert a provider response shape. Real nullable-field handling is a separate behavior fix with its own acceptance; keep it visible in G14/13.11.

SDD: 3/3 tasks completed and JSON validation has zero errors/warnings. Review: scope and all consumers traced; upstream formatting debt preserved; frontend test/diagnostic/runtime proofs accepted. Backend/migrations/environment are untouched. Exact-head CI and merge evidence will complete source delivery.

Accepted 2026-10-04T16:55:18Z: PR253 head74a30c4195c02b979d89159fc4d06052a6f530ec / merge74a4ed6f7fe6ad7f0ce717cb53af2e40e459f5d1, ten unique successful CI checks and one dependency-review skip. All nine final files match head/merge SHA256; unrelated controls and prior history SDD preserved. Runtime unchanged, no deploy required. Overall G14 and the full onboarding goal remain open; shared FileItem repair is a separate work item.
