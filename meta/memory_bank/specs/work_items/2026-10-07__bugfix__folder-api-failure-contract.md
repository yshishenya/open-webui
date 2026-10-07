# Preserve folder API failures and loaded state

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: `codex/bugfix/folder-api-failure-contract`
- Created: 2026-10-07
- SDD Spec: `meta/sdd/specs/active/airis-folder-api-failure-contract-2026-10-07-001.json`

## Context

The combined PR345/346 compiled candidate passed Chromium32/32 and Firefox31/32. Firefox's first free task raised `TypeError: can't access property "sort", nt is null` in Sidebar.initFolders after an aborted folders request. The API stores only err.detail, so transport/abort/parse errors become fulfilled null responses. All eleven folder endpoints have this cause; shared-list failures fabricate an empty list instead. Source CI and packaging acceptance remain separate from browser and production acceptance.

## Goal / Acceptance Criteria

- [x] All eleven endpoints reject network, abort, response parse, and HTTP failures; HTTP detail preserved, including empty detail.
- [x] Successful response data and existing request method/body/query/auth contracts preserved.
- [x] Failed list reload retains existing owned/shared folder state; command mounts catch failures without page errors.
- [x] Regression fails on original API and passes after fix; full frontend tests pass; no new type/lint diagnostics or disabled rules.
- [ ] Compiled Chromium and Firefox mandatory paths pass, including deliberately aborted folder requests; source and image identity recorded.
- [ ] Source branch committed/pushed and PR checked on exact SHA. Production acceptance recorded separately.

## Scope / Implementation

Reuse FolderListItem, SelectedFolder and chat response types. Fix rejection at the common folders API boundary and add the minimum guards to actual list consumers. Existing automation consumers already retain state via catch→null. No new dependency, schema, API route, retry framework or feature flag.

## Upstream impact

`src/lib/apis/folders/index.ts` needs its local failure conversion corrected in every endpoint. `Sidebar.svelte` and the two command selectors need narrow failure guards to prevent cache clearing/unhandled promises. Shared-folder chat pagination needs to retain successful pages and retry on failure. No unrelated component reformatting or changes to backend permissions.

## Verification

Docker Compose uses the existing frontend dependency volume and isolated network; focused real API regression, full Vitest, scoped ESLint/Prettier, full check/lint diagnostic comparison, compiled browser tests against disposable databases. CI read only via Code Review. Evidence: `/Users/yshishenya/.codex/private-artifacts/airis-folder-api-failure-contract-20261007`.

## Risks / Rollback

Previously swallowed failures will now reach catch handlers. All consumers must be traced. Revert this source change if needed; preserve accepted production PR344 until a new candidate passes all gates. Main plan remains198/244; no business/pilot criteria closed by technical checks.

## Source verification at 2026-10-07

Original regression:11failed/1passed. Fixed API and actual Sidebar retention/retry regression:13/13. Full frontend:881/881,107files. Check3040→3005 errors,118warnings,35removed/0new; ESLint1158→1158,0new. Entire type/lint gates remain failing and G14 remains open. API/new test scoped lint0. Existing component formatting mismatches retained to avoid unrelated upstream changes. `npm run preflight` is absent in this repository; actual Compose verification used. No backend/schema changes.

FolderShareModal reuses the folder API grant contract; FolderModal retains arbitrary saved records and arrays, reading only required optional fields. Grants/data are neither filtered nor rewritten by the type correction. Folder title keeps the successful mutation response if a subsequent refresh fails. Every getFolders caller traced:Sidebar,AtCommands,Knowledge,AutomationModal,AutomationEditor,automationspage. Automation callers already catch→null and retain state. Shared-folder chat consumers retain successful pages and allow retry; selected model autosave now handles rejected requests.

SDD remains active until downstream compiled browser acceptance; source publication and deployment are separate pending gates. New permanent browser case is included in the existing onboarding config; the combined candidate must pass66cases including the previous private model-editor case.

## CI follow-up and local runtime recovery

CI on b518f9c0289fba90ae002e2c2795278ccb736c66 rejected 31 existing lint errors across the four touched suggestion/shared-folder components. Reused Model, ChatAttachment, SelectedFolder, folder/chat API response and existing typed i18n context; removed proven unused imports/state and an unused accessibility suppression. No lint rules weakened or saved payload filtered. The # suggestion loader also dereferenced null folders after transport failure: the actual-handler regression failed1/15 before the cache guard; both # and @ paths are now included in the compiled abort/recovery case.

Local packaging encountered disk full and Docker stopped. 705 identical large verification assets were replaced with independent APFS clones, with SHA256 checks before/after every replacement and original metadata retained. No backup content deleted. Free space recovered from633511936 to15577333760bytes; Docker daemon restored. 77 baseline container identities and249volumes remain; two pre-existing service states differ from the earlier baseline, so unchanged runtime is not claimed. Production remains the accepted PR344 image, healthy/restarts0, environment/config/mounts and12neighbors preserved at2026-10-07T10:55:31Z.

Source/browser/image/production acceptance remain separate. SDD stays active until compiled validation is accepted; no numbered business-plan criteria close from these technical checks.

- Final follow-up source checks:883/883frontend,107files;folderregressions15/15. Check3004errors/118warnings,0new,36removedfrominitial3040. FullESLint1127errors,31removed;all14changedruntime/test/configfiles ESLint0errors/0warnings. Globalqualitygate remainsopen. Browsercandidate and productionpending.

- 2026-10-07: Chromium full run32/33 exposed a test setup gap: Sidebar fetches folders only after opening; both authenticated config features and folder permission were enabled in the retained trace. Reused openSidebar in the permanent test and match knowledge search by URL.pathname. Focused compiled Chromium1/1 and Firefox390px1/1 pass with real aborted GET, #/@ search and subsequent folder recovery; full exact-source rerun pending. No runtime code or assertions weakened.
