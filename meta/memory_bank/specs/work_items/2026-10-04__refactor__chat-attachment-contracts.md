# Chat attachment contracts

## Meta

- Type: refactor
- Status: implementation verified; exact-head CI/merge pending
- Owner: Codex
- Branch: codex/refactor/chat-attachment-contracts
- SDD Spec: meta/sdd/specs/completed/airis-chat-attachment-contracts-2026-10-04-001.json
- Created: 2026-10-04

## Goal / Acceptance Criteria

- [x] Reuse and refine the existing history attachment record across Chat, MessageInput and controls.
- [x] Temporary images, extracted text, upload placeholders/results, web content, collection/chat/folder/note references retain their optional fields and unknown extensions. Numeric IDs/URLs/sizes and invalid lists are rejected by a strict probe.
- [x] All changed complete component client/server JavaScript and shared module runtime are byte identical.
- [x] All frontend tests pass; diagnostic delta is fully accounted for: removed, refined and newly exposed existing incompatibilities; no new executable behavior or suppression. Global debt remains visible.
- [ ] SDD closed/valid, work item and branch log updated, source/tests/docs committed and pushed for exact CI/review against airis_b2c.

## Traced flow / Scope

Existing ChatHistoryMessage.files is an extensible record with known type/content_type. Refine that existing contract and reuse it. Chat restores stored files/drafts/queued submissions, merges embedded files with incoming priority, deduplicates by type/id/url/name and by equality, filters references and non-image uploads for backend submission. MessageInput writes upload placeholders, uploaded server files, temporary extracted text/images, dragged chat/folder/note references, pasted full-content files and Google/OneDrive files. ChatControls attaches terminal blobs. Both control layouts display/persist chatFiles, and FileItem displays descriptors with heterogeneous optional name/type/size.

Actual uploaded FileModelResponse is separate from the client descriptor; payload/metadata may be nullable and provider extensions remain unknown. Do not make an image's optional server ID/name/size mandatory. Preserve error cleanup by itemId and modal mutations of descriptor context/file/files. Existing history, graph, message, model and upload tests remain the runtime safety net; add a strict contract probe.

## Upstream impact / Non-goals

Minimal type imports/annotations in Chat, MessageInput, ChatControls, Controls and FileItem; shared fork-owned chat_history.ts owns the refined record. No new runtime helper, package, backend/API/persistence/config changes or formatting cleanup. Placeholder forwards the existing MessageInput files prop type. The FileReader onload result is typed as string because its only initiating method is readAsDataURL; this native boundary assertion erases without changing behavior. Keep missing/nullable field issues visible rather than assertions/suppressions.

## Verification / Risks

Compose-created frontend tools: full tests/check/lint; compare diagnostic messages and original line locations. Compile complete changed Svelte components for client/server and transpile shared module, with exact before/after byte comparison. Shared module/test/docs formatting; retain upstream formatting debt. Backend unchanged; no backend test repetition or production build if all executable bytes match.

Narrow types may expose mismatched consumers; trace and fix declaration contracts only, or separate real behavior fixes under bug workflow. Full G01-G17 remains active; no new numbered plan closure from this refactor alone.

## Verified result

Baseline: 58d4c0a114ad25dbe980272ac480fad0e1873547. All 493 frontend tests pass in 74 files; the two attachment checks pass again after formatting. All six complete components compile to identical client/server JavaScript; both complete shared TypeScript modules transpile identically: 14/14 comparisons. No production rebuild is required.

Full check: 3848 → 3782 errors, 164 warnings unchanged. Complete diagnostic messages are compared after mapping changed lines to original lines: 73 removed, one refined, seven newly exposed in unchanged executable statements. Full 1419 ESLint diagnostics are identical. Neither global check nor lint is green. No new dependency, Any, runtime fallback or external response assertion.

Outstanding incompatibilities (original baseline lines):

- FileItem:60: `item.file` may be the upload placeholder string; `.data` access must narrow the existing union. This refines the previous implicit-any diagnostic.
- FileItem:140/165/168: optional attachment name reaches decodeString(string).
- MessageInput:1618 (two diagnostics) and :1624: an image descriptor can have a missing/null URL; startsWith and Image src expect a string.
- MessageInput:1690: optional type reaches includes(string).

The native FileReader string assertions are supported by the initiating readAsText/readAsDataURL methods and successful load callbacks; real jsdom native reads are checked. These erase from JavaScript and do not assert a provider response shape. Real nullable-field handling is a separate behavior fix with its own acceptance; keep it visible in G14/13.11.

SDD: 3/3 tasks completed and JSON validation has zero errors/warnings. Review: scope and all consumers traced; upstream formatting debt preserved; frontend test/diagnostic/runtime proofs accepted. Backend/migrations/environment are untouched. Exact-head CI and merge evidence will complete source delivery.
