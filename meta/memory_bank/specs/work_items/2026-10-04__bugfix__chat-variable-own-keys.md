# Chat variable own-key lookup

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/chat-variable-own-keys
- SDD Spec: meta/sdd/specs/completed/airis-chat-variable-own-keys-2026-10-04-001.json
- Created: 2026-10-04

## Context

The backend accepts constructor as a chat variable key. The frontend schema merge indexes a plain object and interprets its inherited constructor as an existing field, then throws TypeError: existing.modelIds is not iterable. Form completeness/default reads also accept inherited values instead of supplied own values. This affects submit gating and all three form entry paths in normal and embedded Chat.

## Goal / Acceptance Criteria

- [x] Regression checks fail on the accepted previous source for constructor fields and inherited values.
- [x] constructor fields merge without errors, require a real value and preserve explicit/default values.
- [x] Matching fields merge required flags; real shape conflicts still block sending; defaults false/0, empty values and missing models retain their behavior.
- [x] No new type/lint diagnostic; existing ModelMeta defines field types without any.
- [x] Relevant tests and full frontend suite pass; compiled/browser normal and embedded paths pass without model calls or user data changes.
- [x] Source accepted by exact-head CI, committed and pushed, then runtime candidate and production accepted separately.

## Scope and traced flow

Backend chat_variables.py validates lowercase keys and supplies key/type/required plus additional field properties. ModelMeta already describes this schema. Chat merges selected Model IDs, computes empty/missing/default state, gates submit, opens the modal from three input paths and saves results through updateChatById. InputVariablesModal normalizes own entries and submits a new object. Correct the shared schema dictionary and value lookup, retaining all other form behavior.

## Upstream impact

Chat.svelte: minimal own-key correction and concrete types in the existing form helpers. No new runtime module, dependency, API, billing or schema migration. Regression test reads the actual component helpers as existing tests do.

## Verification

Docker Compose regression test before/after, complete frontend tests, full type/lint comparison and strict changed-file formatting. Compare compiled code with type-erased correction scope. Test a built candidate with real local APIs in normal/embedded form paths, then guarded production acceptance. No real model request, payment, consent or email is needed for this form check.

## Risks / Rollback

An inherited property must never fill a required field or cause a false schema conflict. Explicit own values, including false/0 and the constructor property, must remain valid. Revert source and restore the previous accepted runtime image if candidate or live checks fail.

### Source checks, 2026-10-04

- Accepted baseline regression replay: six failures, four passes; corrected source: ten passes. The installed deep comparator runs in the same VM realm as the extracted helpers.
- Full frontend suite: 490/490 in 73 files.
- Full diagnostics: 3934 → 3922 errors, 164 warnings unchanged; twelve errors removed and zero new diagnostics after matching unchanged source lines. ESLint: all 1419 existing diagnostics unchanged. Global gates remain red and are not waived or reported as green.
- Added real compiled ordinary/embedded form scenarios using a disposable custom model. Empty required value must keep the form open, own value must survive reopening, and provider calls/successes/usage/ledger must remain unchanged.
- Executable client/server AST matches the expected own-key runtime correction alone. This is a runtime fix, requiring a new candidate and production validation.
- Evidence: private-artifacts/airis-chat-variable-own-keys-20261004/{baseline-own-keys-proof.json,frontend-tests.log,diagnostic-comparison.json,runtime-scope-proof.json}.

### Compiled candidate

Implementation source: fbca387589cc31d45a920954b9acaa645968a601. Final image: airis-chat-variable-candidate:fbca38758-r1. Production build flags: AIRIS_VITE_SOURCEMAP=false, APP_BUILD_HASH=the implementation SHA. All 4913 frontend files match the saved build; all 425 backend Python files, 27 base layers and image environment are preserved. Accepted compiled browser suite: 16/16 in Chromium desktop and Firefox 390x844. Required constructor values persist after reopening in ordinary and embedded chat; no model calls, successes, usage or ledger changes in these form scenarios. Existing guide, failed-provider and checkout/email replay paths also pass. SDD 3/3 completed and valid. Source CI/merge and production are separate final gates.

Build diagnosis: production flags were restored after rejecting unpublished builds with exhausted heap, Docker memory termination or debug/source-map settings. The accepted production build exited 0 with a 4864 MiB Node heap while the disposable application fixture was stopped. No server or shared container was stopped for these builds.

### Accepted source and production

PR250 accepted implementation fbca387589cc31d45a920954b9acaa645968a601, final head abd6ae886d49d561805e863f3068dc49b8d44d25, merge 127f7f930991e3b3e5b1086feffee0c6ebbd8ae5. Exact-head CI: 12 successful job records (10 unique checks), dependency-review skipped; CodeRabbit disabled for the base. All seven changed files match head/merge; runtime source is preserved through the documentation commit.

Production image bd9b53073bd4be7b87a89170d0ffa4a97f97527bd06c8bb2550fd5e3ab6f33e6 accepted 2026-10-04T15:32:08Z: healthy, zero restarts; all 4913 frontend and 425 backend Python files match. Runtime environment, configuration and 13 neighbors preserved through switching; default image then persisted as the sole rendered Compose change. New backup, archive checks, migration o1a020261003 and previous-image rollback retained; free space above 10 GiB. One older backup was moved to Mac with all 12 file sizes/SHA256 and archive readability verified before removing only its server copy. Production chat reload retains two existing messages and empty input with zero console errors or generation/payment actions.

Production currently has zero models with chat-variable schemas. The constructor form itself is accepted on the identical compiled image with real disposable APIs in ordinary/embedded chat and both browsers, separately from live file/UI acceptance. No production fixture model was added.

Overall onboarding goal remains active; global type/style gates, human participation and real elapsed pilot windows are still open. This bug does not close an additional numbered plan requirement.
