# Folder modal load lifecycle

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: `codex/bugfix/folder-modal-load`
- SDD Spec: `meta/sdd/specs/completed/airis-folder-modal-load-lifecycle-2026-10-05-001.json`
- Created: 2026-10-05
- Updated: 2026-10-05

## Context

The compiled browser acceptance for PR272 exposed early typing being overwritten by a pending folder GET. All five consumers use the same FolderModal: Sidebar creation, FolderTitle edit/create-child and RecursiveFolder edit/create-child. The modal exposes mutable defaults before GET finishes, assigns responses regardless of the current folder/open state, and dereferences null after a failed GET. Its reactive block tracks only show, so changing folderId while open does not load the selected folder.

PR272 source `512dda5de0816016f0a6b1726e02d4589bc44259` and candidate remain frozen. This branch starts at integration `9af6f47b2e4035d21245bac2cdb047bb6b29509f`; it changes the shared modal independently. Merge and release require current CI and source/image acceptance.

## Goal / Acceptance Criteria

- [x] Pending GET permits zero edits and zero submissions; after loading, a rename preserves metadata and data.
- [x] A folder change while open loads the selected folder; zero stale responses overwrite it.
- [x] Escape/close/reopen and component destruction invalidate pending responses.
- [x] Null/rejected GET causes one error notice and closes safely; reopening works without a null dereference.
- [x] New/nested folder creation needs zero GETs and retains the current parent.
- [x] Regression cases fail on the baseline and pass after repair, with zero new type/lint errors.
- [ ] Changes are committed and pushed; CI/merge/production status are reported separately.

## Implementation Notes

Use existing Svelte lifecycle/reactivity and native inert/disabled controls. Keep a request generation inside the component to discard old results, including after destruction. Focus only this modal's bound input after the accepted response. Reuse existing API and i18n messages; introduce zero dependencies and zero backend/schema/config changes.

## Upstream impact

Only upstream-owned `src/lib/components/layout/Sidebar/Folders/FolderModal.svelte` needs runtime changes because every affected consumer routes through it. Keep the patch local to initialization, submission guard and form availability; no shared Modal changes or consumer guards. The new adjacent mounted regression test uses the existing Vitest/jsdom infrastructure.

## Verification

Docker Compose frontend tests, changed-file ESLint/Prettier, complete frontend tests and baseline comparison of full `npm run check` / `npm run lint:frontend`. Reproduce delayed/null/old responses on the mounted component. Existing application-wide quality debt keeps G14/13.11 open. No payment, SMTP or production mutation is part of reproduction.

## Risks / Rollback

Failing loads now close the modal instead of permitting edits to empty defaults. Closing and reopening retries through the existing entry point. Revert this component commit to roll back; no persistence migration. PR272 must be reconciled when integration advances; do not silently overwrite its typed callback/import corrections.

## Local acceptance

- Final mounted regression:7/7 pass; baseline6 failures/1 pass and2 null dereferences. The final harness waits for queued load/focus microtasks before checking stale responses; the earlier shorter wait returned before those responses completed. Chromium/Firefox independently exercise close/reopen.
- Complete frontend suite:562/562 tests in81 files. Changed component/test ESLint pass.
- Strict app check:3643→3641 errors,159 warnings unchanged,0 new diagnostics. Full ESLint:1384→1378 errors,0 new messages. Full commands still exit1 on existing debt; no claim of a clean application-wide gate.
- Browser source fixture:4/4 scenarios each in Chromium154 and Firefox156;0 page errors,1 submitted rename in each. Pending native inert/disabled controls, preserved data, switch-folder stale response, Escape/reopen and null closure verified. APIs were mocked; this is not production acceptance.
- Full emitted client/server output differs; a production release is required after CI and integration. Source snapshot/candidate of PR272 is unchanged.
- Runtime/API/schema/config dependencies added:0. Remaining pre-existing submit callback rejection behavior is outside this load repair and remains unaccepted.
