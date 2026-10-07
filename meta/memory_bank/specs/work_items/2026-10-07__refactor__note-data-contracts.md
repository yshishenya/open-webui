# Shared note data contracts

- Type: refactor
- Status: In Progress
- Owner: Codex
- Branch: codex/refactor/note-data-contracts
- SDD Spec: meta/sdd/specs/active/airis-note-data-contracts-2026-10-07-001.json
- Base: dbb48b0fca13998a3524c0c2d16d1ded24bab40c; application matches accepted09866.
- Plan: global quality G14/13.11, overall198/244 remains active.

## Final scoped result and measured acceptance

Align every selected note list/details/file/event and linked-chat producer with reusable frontend contracts. Baseline2451type errors/110warnings,1037ESLint errors,935frontend tests; NoteEditor69 and Notes42type errors. No runtime defect is claimed from a diagnostic alone.

- [ ] Trace all notes API producers/callers and sparse/null/truncated responses.
- [ ] Reuse existing NoteRecord/NoteFile/normalization, ordered writes, native Editor/events and shared chat/attachment/user/access types.
- [ ] Selected note components/API contracts reach0type/lint errors; whole-project normalized new diagnostics0.
- [ ] Modified files pass formatting; no new dependency, Any, suppression or configuration relaxation.
- [ ] Full935+frontend suite passes; minimal actual-code checks protect any executable delta.
- [ ] Type-only JS/CSS emissions match; reproduce and verify any behavior change in compiled mandatory paths.
- [ ] Exact-source CI/integration and required guarded runtime accepted; SDD/docs completed, branch committed/pushed.

## Existing causal evidence and scope

GET /notes and /notes/pinned use routers.notes.NoteItemResponse, filtering user_id/meta/access_grants even though the implementation returns NoteUserResponse. Their data contains truncated content.md,1000characters. Search returns models.notes.NoteListResponse with full records. Existing notes.ts already normalizes full detail/update responses while preserving sparse content, opaque fields, pending files and permissions. Do not normalize truncated lists as editable records. Linked chats use server ChatResponse; trace shared StoredChat contract before introducing anything new. Existing callers include list/editor/utils,sidebar/pinned list,chat input menu and model knowledge selector.

Preserve ordered writes, generation/account guards, local draft/content,200msdebounce/800msevent guard, delayed title/file updates, null/pending file ids, pinned ownership, attachments, current endpoints/errors/fallbacks. Partial socket events must not be assumed normalized full records. Inspect installed TipTap/platform/native declarations and current compatibility constraints. Behavioral repair requires evidence, not diagnostic count.

## Upstream impact and boundaries

Prefer additions to fork-owned notes.ts and thin annotations in existing APIs/store/components. Keep upstream diffs small; no unrelated formatting or backend/schema/mail/payment/provider changes. No compiler/library upgrade, full backend export, Docker reset/prune/data-volume removal. Preserve21foreign primary tracked edits and110private acceptance documents. New code/branches must not edit shared current_tasks.md. Whole-project G14 requires0errors and the complete final suite; this block alone does not close it or real user/mail/payment/device/pilot/calendar criteria.

Initial private evidence: airis-knowledge-data-contracts-20261007/next-block-causal-notes.md. Full implementation evidence belongs to a separate airis-note-data-contracts task directory.
