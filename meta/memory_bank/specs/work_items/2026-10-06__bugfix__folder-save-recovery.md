# Recover failed folder saves without losing the draft

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: `codex/bugfix/folder-save-recovery`
- SDD Spec: `meta/sdd/specs/active/airis-folder-save-recovery-2026-10-06-0021.json`
- Created: 2026-10-06
- Updated: 2026-10-06

## Context

Compiled source 2ad5970573451a0a117f467c201d508a3ae7d5f8 reproduces a failed rename in Chromium and Firefox: the write returns HTTP500, the server retains the original name, but the dialog closes and discards the draft. Existing parent callbacks swallow errors and return undefined, which the shared modal treats as success. A genuinely rejected callback also leaves loading enabled indefinitely.

All five consumers were traced: Sidebar creation; FolderTitle edit/create-child; RecursiveFolder edit/create-child. This branch was created from integration and advances to the committed PR272/273 dependency. Their candidate remains frozen; this additional fix must receive its own source and release acceptance.

## Goal / Acceptance Criteria

- [ ] All five consumers retain the dialog and draft after a failed write or rejected callback; the save control becomes available again.
- [ ] Empty or whitespace-only names make zero writes and retain the dialog.
- [ ] A successful retry makes exactly one write and closes; repeated submit while pending makes zero additional writes.
- [ ] Confirmed creation remains successful when subsequent list refresh fails; reopening/retry must not duplicate the saved folder.
- [ ] Failed root creation removes its optimistic placeholder; metadata/data/parent remain unchanged in the draft.
- [ ] Mounted regressions and browser scenarios fail before repair and pass after it, with zero new type/lint diagnostics.
- [ ] Commit/push, exact-source CI, integration, image and production acceptance are independently recorded.

## Implementation Notes

Reuse the existing folder payload type and explicit boolean results from the five callbacks. The shared modal closes only on success and releases loading in finally. Each consumer reports persistence failure as false; post-write refresh failures must not convert an accepted write into retryable failure. No dependency, backend, schema or configuration changes.

## Upstream impact

Minimal hooks in FolderModal, Sidebar, FolderTitle and RecursiveFolder are unavoidable: the current callback contract hides the result of the actual write. Export the existing FolderForm type without a new abstraction. Keep unrelated folder operations unchanged.

## Verification

Docker Compose mounted/full frontend tests, changed-file lint/format, full type/lint comparison against frozen combined source. Compiled or mounted real browser checks for all five consumers and retry/reconciliation. Existing application-wide quality debt keeps G14/13.11 open.

## Risks / Rollback

Callback failures now leave the dialog open; confirmed writes still close it. Revert this change to roll back without a migration. Do not release using the frozen PR273 image, which lacks this repair.

## Source verification in progress

- Mounted baseline:3 failures/7 passes and1 unhandled rejection; repaired component:10/10 passes. Full Docker frontend:567/567 tests.
- Full types3584→3567 errors/158 warnings;0 new diagnostics. Full ESLint1360→1360 errors;0 new diagnostics. Application-wide commands retain their existing failures.
- Browser baseline:2/2 failed on compiled combined source after a real failed write; both preserve server data but close the draft. Combined candidate previously passed22/22 canonical/supplemental scenarios; no claim that those cover failed saves.
- This source remains active until all five consumer browser cases, CI and production acceptance complete.
