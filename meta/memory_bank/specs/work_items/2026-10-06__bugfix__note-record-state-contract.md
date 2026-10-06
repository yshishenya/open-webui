# Saved note state contract

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/note-record-state-contract
- Created / accepted: 2026-10-06
- SDD Spec: meta/sdd/specs/completed/airis-note-record-state-contract-2026-10-06-001.json

## Cause and repair

The existing shared NoteRecord omitted dates and versions consumed by NoteEditor. Existing normalizer accepted malformed JSON, versions, grants and attachment fields. File/image work could finish after switching note, load generation or session and mutate the new state.

Reuse the fork-owned normalizer: validate the actual backend/editor fields and preserve sparse content, legacy nullable lists and unknown extensions. Type the saved state as NoteRecord|null; keep local empty attachments as arrays. Capture note/session/load ownership and reject obsolete upload/lookup/compression results. Existing load/save/title and draft-recovery behavior is retained.

RichTextInput callers inspected: NoteEditor, ordinary/channel MessageInput and InputModal use JSON mode; existing markdown/raw handling is covered too. Reuse the installed TipTap Content contract, narrow text branches and describe existing callbacks. Remove unused declarations, replace nested declarations with equivalent arrows, use the installed highlight.js LanguageFn and explicit HTML closing tags. Safe variable replacement uses Object.prototype.hasOwnProperty.call, including objects without a prototype and a hasOwnProperty key.

Collaboration initialContent accepts the existing string/JSON/null Content. Decoded JSON awareness records are validated while correct records and unknown extensions are retained. Its existing one compatibility suppression is now ts-expect-error with the JSON-adapter/binary-awareness mismatch documented. No added suppression. The existing awareness protocol debt is not closed by this repair.

## Measurable acceptance

- [x] Saved-note fields match the actual backend/editor contract; no any or new suppression added.
- [x] Sparse/nullable content, files, versions and extensions preserved; malformed existing data explicitly refused.
- [x] Load/save/title, draft preservation and stale response/session/upload cases pass:70 note/editor/awareness cases.
- [x] Reproduction on baseline:17failed/51passed in68cases; final Docker frontend646/646 in88files.
- [x] Mapped type diagnostics3428errors/150warnings:65errors/1warning removed,0new. ESLint1288:34removed,0new; changed frontend files clean.
- [x] Read-only production compatibility:all6 existing notes accepted, content strings masked.
- [x] Compiled Chromium/Firefox390 notes2/2 and shared onboarding/chat/wallet paths16/16;0pageerrors.
- [x] Exact source CI passes, including backend critical, wallet frontend and wallet browser suites; expected dependency-review skip. CodeRabbit review disabled for this base.
- [x] Merged tree equals tested source tree; guarded current-base production release, file/env/neighbor/public/live acceptance complete; SDD2/2 closed.

## Source and release

PR297:https://github.com/yshishenya/open-webui/pull/297

Source:`e1f32a3dc8b6de01cd74b4dd1609a88f781066b2`; merge:`85b4b2fd9beeb943827785c141a742bd440b5b68`; source/merge tree:`bf21e8ca9282573a5ce3a715f537edf8bb3fd994`.

Docker-first compiled builds were rejected:SIGKILL with8192/4096MiB heaps and heap exhaustion at3072MiB in the7.65GiB VM. Official SHA256-verified Node22.23.3 darwin-arm64 built the same archived source on Mac; all installed dependency versions matched package-lock (0mismatch). Native adapter-static build accepted, then verified in linux/amd64 Docker and real Chromium/Firefox. No app/runtime dependency change.

Production digest:`sha256:fcda8956657009b3d6a5f8fee4dac4696664da3fd1c9002f92bd1b8fe29ccd94`. All4914 frontend/426Python files match candidate;66base layers preserved,13neighbors and ENV unchanged, compiled Metrica111392024 retained,0public application maps. Backup:`/opt/backups/airis/20261006T050235Z-note-record-candidate-e1f32a3dc-20261006`; checksums/archive/pg_restore and hard Alembic`o1a020261003` accepted. Healthy/restarts0. Image pin changes only rendered Compose image without another recreate. Public version/guide/auth and ordinary-account existing chat/input/free model/balance/files accepted;0new executor generations.

## Upstream impact

- src/lib/components/notes/NoteEditor.svelte:reuse concrete saved-note state, necessary nullable guards and async ownership checks.
- src/lib/components/common/RichTextInput.svelte:describe actual Content/callback contracts, necessary narrowing and safe own-property check; only lint repairs in the touched file.
- src/lib/components/common/RichTextInput/Collaboration.ts:existing Content contract and concrete decoded-awareness records; the one old adapter compatibility gate stays explicit.

Validation is isolated in fork-owned src/lib/utils/airis/notes.ts. No server/API/schema/permission/dependency change. Overall193/244 remains; G14/13.11, voluntary pilot, real payment/receipt, physical phone, external Inbox/operator replies and real24h/72h/14d windows remain open.
