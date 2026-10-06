# Saved note state contract

- Type: bugfix
- Status: in progress
- Owner: Codex
- Branch: codex/bugfix/note-record-state-contract
- Created: 2026-10-06
- SDD Spec: meta/sdd/specs/active/airis-note-record-state-contract-2026-10-06-001.json

## Cause and scope

NoteEditor does not reuse the existing NoteRecord returned by getNoteById/updateNoteById. The shared contract omits dates and versions read by the editor, and attachment descriptors remain untyped. Study all state assignments and callers; describe the actual backend NoteResponse and existing editor mutations, preserving unknown extensions and legacy sparse content. Reuse the shared normalizer and existing test harness. No dependency, backend, migration or permission changes.

## Measurable criteria

- [ ] Concrete nullable saved-note state and fields match backend and editor behavior, without any or suppressed checks.
- [ ] Valid sparse content, JSON, attachments, versions and unknown fields are preserved; malformed existing data is explicitly rejected rather than silently replaced.
- [ ] Existing load/save/title, stale-response/session and draft preservation tests pass.
- [ ] Full Docker frontend, mapped type/style diagnostics and relevant compiled browser checks accepted; no new diagnostics.
- [ ] Exact source CI/merge and production equivalence or guarded current-base release accepted; SDD and status closed.

## Upstream impact

Prefer fork-owned notes.ts contracts and validation; NoteEditor has only necessary state/guard annotations. If the common editor value contract must change, document the actual existing JSON/text callers and prove runtime preservation. This work does not close G14 or human/pilot/payment gates by itself.

## Tooling

Reuse pinned TypeScript5.9.3, Svelte5.56.0, svelte-check4.4.5 and Vitest1.6.1. No unfamiliar runtime API or new dependency introduced. Upgrade compiler/tooling only as a separate compatibility work item; preserve strict diagnostics and current JavaScript behavior unless a reproduced invalid-data defect requires correction.

## Reproduced defects and minimum repair

The canonical baseline with the final test cases fails17/68; source restored after the isolated reproduction. Invalid persisted timestamps, access grants, attachment scalar fields, versions and rich-text nodes were accepted. A delayed upload/lookup/image compression could mutate the next note or an obsolete session. Shared normalizer validates these existing fields, preserving sparse content, nullable legacy lists and unknown extensions. The editor uses nullable NoteRecord, captures the note/session/load generation for async attachments and uses empty local file arrays.

RichTextInput callers inspected: NoteEditor, chat MessageInput, channel MessageInput and InputModal all use JSON mode; the existing markdown/raw handler is also tested. The installed TipTap Content type describes their existing string/JSON/null inputs. Collaboration getter and initial content types change only; emitted JavaScript must remain identical. No new dependencies, server/schema/permissions changes. No any/suppression introduced. Existing unrelated collaboration warnings remain outside this task.

Tests: before17failed/51passed on baseline; afterfullDocker644/644 in88files (68 note/rich-text cases). Type/style comparison and compiled real-browser acceptance remain pending.
