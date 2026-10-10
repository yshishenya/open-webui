# Tools: preserve accepted state and report refused operations

Status: Done (source acceptance; production release pending)
Owner: Codex
Branch: codex/bugfix/chat-dispatch-replay
SDD Spec: meta/sdd/specs/completed/airis-tools-management-safety-2026-10-10-021.json

Eight legacy tools API methods resolve null after network/JSON errors. Tools list
has an async onMount cleanup, late publications and false import success after
failed writes. Trace every caller before changing the shared API.

- [x] Reproduce actual API, listener lifetime, delete refresh and import failures.
- [x] Reuse requestJSON, existing list/permission types and import validation.
- [x] Preserve accepted deletes/partial imports; one action per id, no automatic POST retries.
- [x] Cancel list/component work; contain late values and file reads, remove unused Share '#'.
- [x] Preserve store state in chat/editor/menu/layout consumers and contain API refusals.
- [x] Frozen full tests, whole type/lint comparison, affected browser checks and preservation.
- [x] Complete SDD, commit/push and record private plan evidence without closing release gates.

## Upstream impact

Minimal tools API/component hooks and callers; metadata, access grants, payloads,
empty lists, endpoint methods and auth contracts retained. Existing helpers are
reused. No new dependencies, Any, suppressions or speculative abstractions.
The single OAuth DELETE adapter used by the integrations menu also reuses requestJSON
and requires true before reporting a confirmed disconnect. Its network/JSON/null/false
refusals reproduce 4 failures before the fix, with 8 positive controls.
Code editors and unrelated OAuth lifetimes are not declared fully repaired here.

## Verification and release boundary

Docker Compose-first full frontend/check/lint, failing-before tests, browser of actual
affected code with controlled APIs. Backend unchanged: verify preservation;
historical backend tests do not prove current release acceptance. All global
quality gates, exact-SHA CI/integration, clean build/production and real A/B
provider/payment/mail/volunteer/calendar criteria remain open.

## Risk / rollback

Errors now reject; all original consumers must contain them. An aborted request
does not undo a server-accepted write. Report partial acceptance and never retry
automatically. Roll back the bounded runtime commit when necessary.

## Final source acceptance — 2026-10-10

- Before:26failed/2controls;OAuth4failed/8controls;DELETEconfirmation4failed/37controls.
- Final frozen fullfrontend1888/1888,164files;focused100/100 extracted from full,5files.
- Types1127/85→1098/85,ESLint762→754;newdiagnostics0. Globalqualitygates remain red.
- Browser18/18,console0/0:actualTools/ToolMenu/Dropdown/Tooltip/ConfirmDialog/nativeinput,
  actualToolsAPI/requestJSON/parser;controlledfetch/stores/navigation/download,
  unrelatedmodalplaceholders. OAuth actualcallback/API separately verified.
- Runtime source/remote: `881e145b077981b53f11a2fb73c37189a45a7eea`;5614frozenGitblobs match.
- Backend542/protectedprimary21/production12neighbors preserved;healthy/restarts0.
  Backend1063historical reuse only; no new backend run.
- Ownbrowser/HTTP/build closed/removed;2ownemptyvolumes verifiedread-onlyandremoved,
  262other volumespreserved. Allsource and tests received a bounded self-review.
- Proof: `/Users/yshishenya/.codex/private-artifacts/airis-tools-management-20261010`.

Source accepted and pushed. SDD3/3complete. Plan198/244 unchanged, goalactive.
PR/CI, integration, allqualitygates, cleanbuild/deploy and realA/B acceptance pending.
