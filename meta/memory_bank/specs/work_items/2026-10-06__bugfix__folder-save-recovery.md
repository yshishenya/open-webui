# Recover failed folder saves without losing the draft

## Meta

- Type: bugfix
- Status: completed
- Owner: Codex
- Branch: `codex/bugfix/folder-save-recovery`
- SDD Spec: `meta/sdd/specs/completed/airis-folder-save-recovery-2026-10-06-001.json`
- Created: 2026-10-06
- Updated: 2026-10-06

## Context

Compiled source 2ad5970573451a0a117f467c201d508a3ae7d5f8 reproduces a failed rename in Chromium and Firefox: the write returns HTTP500, the server retains the original name, but the dialog closes and discards the draft. Existing parent callbacks swallow errors and return undefined, which the shared modal treats as success. A genuinely rejected callback also leaves loading enabled indefinitely.

All five consumers were traced: Sidebar creation; FolderTitle edit/create-child; RecursiveFolder edit/create-child. This branch was created from integration and advances to the committed PR272/273 dependency. Their candidate remains frozen; this additional fix must receive its own source and release acceptance.

## Goal / Acceptance Criteria

- [x] All five consumers retain the dialog and draft after a failed write or rejected callback; the save control becomes available again.
- [x] Empty or whitespace-only names make zero writes and retain the dialog.
- [x] A successful retry makes exactly one write and closes; repeated submit while pending makes zero additional writes.
- [x] Confirmed creation remains successful when subsequent list refresh fails; reopening/retry must not duplicate the saved folder.
- [x] Failed root creation removes its optimistic placeholder; metadata/data/parent remain unchanged in the draft.
- [x] Mounted regressions and browser scenarios fail before repair and pass after it, with zero new type/lint diagnostics.
- [x] Commit/push, exact-source CI, integration, image and production acceptance are independently recorded.

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

## Required changed-file CI follow-up

The CI check on35227 reports seven existing lint errors in the touched RecursiveFolder consumer. Remove only unused imports, variables, callback parameters and a stale Svelte suppression. All six changed frontend files now pass ESLint in Compose. Full frontend tests are rerunning with one worker after the unrestricted run was killed by local memory pressure; browser acceptance remains pending. Frozen525 candidate is superseded for release by this final source.

## Final source and production acceptance

[PR274](https://github.com/yshishenya/open-webui/pull/274) is merged. Final source `c6e57eb059f599441137868f88e09e9f2edf8bed`, integration merge `658bb54d27bbae098e8fc6f06f6812416c111cc3`; frozen source and integration tree match. All required CI checks on the source are successful; dependency review is an expected skip without changed dependencies. CodeRabbit reports reviews disabled for this base, not an independent review.

- [x] Docker Compose frontend tests:567/567 in81 files, including10 mounted regressions; unrestricted run exceeded local memory, completed single-worker run is authoritative.
- [x] Final compiled candidate:32/32 browser cases,0 page errors in Chromium and narrow Firefox. All five failed-save consumers cover whitespace, failed write, enabled retry, parent and exactly one successful write. Root creation preserves confirmed success after refresh failure.
- [x] Changed-file ESLint passes for all six files. Full types:3584→3567 errors,158 warnings,0 added diagnostics; final cleanup produces the same diagnostics. Existing application-wide type/style debt remains open. The initial full ESLint count1360 precedes the seven-line-error cleanup; no unmeasured final count is claimed.
- [x] Guarded production release passed backup SHA256/readability and Alembic. Registry digest `sha256:a11bb79b937d5ba9f81626fed7856affb01c6ff8d9061bbabe8a91389e7110e4`; all4914 frontend/426 Python files match the candidate. Runtime environment and12 initial neighbors are preserved; healthy,0 restarts.
- [x] Permanent Compose image pin changes only the rendered application image; the running container remains unchanged. Public version/env/guide/captions match candidate bytes and compiled Metrica is preserved.
- [x] An ordinary user with0 ₽ creates a control folder, retains a whitespace draft, receives a real HTTP400 on a conflicting rename, keeps an editable draft and successfully retries. Both newly created empty test folders are removed after proving no chats or children; no existing folder was changed. All-five HTTP500 coverage remains on the isolated candidate.

The first release attempt stopped before recreating the application: the server image store exposes manifest digest as image Id, whereas the local store exposes config digest. Manifest/config, complete Config/RootFS and all files matched. The guard was corrected to the proven server identity; the retry retained every backup, CAS, migration and rollback gate. Initial public checks during startup failed and are excluded from the final accepted healthy checks.

Linked SDD is completed3/3. This fixes the folder failure and releases the PR272/273/274 combined changes; it does not close overall G14/13.11, voluntary mail pilot, real money/receipt, physical-phone or mature-cohort acceptance.
