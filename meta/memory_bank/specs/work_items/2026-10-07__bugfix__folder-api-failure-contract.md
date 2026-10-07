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
