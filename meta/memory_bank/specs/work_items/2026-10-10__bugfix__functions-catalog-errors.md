# Function catalog: explicit failure without losing state

Status: Source acceptance complete; release pending
Owner: Codex
Branch: codex/bugfix/chat-dispatch-replay
SDD Spec: meta/sdd/specs/completed/airis-functions-catalog-errors-2026-10-10-020.json

## Problem and scope

GET /functions/ catches network/JSON errors as `err.detail`, logs the raw error,
and resolves null when detail is absent. Seven consumers include chat defaults,
model editor, chat control settings, administration and create/edit routes.
A failure can overwrite a catalog or interrupt initialization after a successful write.

- [x] Reproduce network/JSON/container failures and refusal handling in all callers.
- [x] Reuse requestJSON and existing FunctionListItem; preserve GET/body/auth and empty list.
- [x] Preserve the previous store on rejection; show the existing translated notice.
- [x] Remove the redundant admin route fetch: Functions already owns list initialization.
- [x] Frozen full frontend tests and diagnostics comparison, affected browser checks.
- [x] Record preservation and exact pushed source; complete SDD and branch update.

## Upstream impact

Minimal edits to the functions API and its seven callers. No dependencies,
automatic retries, infrastructure or new shared abstraction. Existing cancellation
signals are reused where available. Function editor lifecycle and remaining tools
CRUD are separate work; no claim that they are fully repaired by this catalog fix.

## Verification / release boundary

Docker Compose-first frontend tests/check/lint; compare against accepted parent
diagnostics without suppressions. Browser acceptance of affected actual code with
controlled API is local evidence, not production/payment/pilot acceptance.
Backend is unchanged; preservation evidence is required. Global red diagnostics
remain open. PR/CI, integration, clean build/deploy and full A/B acceptance remain
required before the overall onboarding goal is complete.

## Risks / rollback

Catalog failures now reject instead of silently returning null. All existing callers
must contain this refusal. Preserve cached state; do not retry an accepted write.
Revert the bounded runtime commit to roll back this source change.

## Measured acceptance

Runtime/remote: `7d2d026674dcf289248380aab03846432b12928e`. Parent reproduction:12 failed/6 passed; after:1835/1835 full,163 files,106/106 focused extracted from final full run,15/15 browser,console0/0. Frozen5612 source files and Git blobs match. Types1127/85 and ESLint762: new diagnostics0; global gates remain red.

Browser uses compiled admin route/Functions/widgets and actual getFunctions/requestJSON; five other callers execute exact extracted statements. Fetch/stores/navigation/unrelated modals are controlled. No full-root/provider/production claim.

First full1834/1 exposed a stale nullable API stub; recovery test now uses actual getFunctions. A later1835/0 run exposed2type/2lint errors in tests; corrected without suppressions. Only final frozen run is accepted. Earlier fixture extraction error and superseded runs are excluded.

Backend542 files,21 protected primary files and runtime/neighbors preserved. No new backend run; existing1063 is historical evidence only. Own browser/HTTP/bundle and two empty proof volumes cleaned;262 other volumes preserved. SDD3/3 complete.

- [ ] Global frontend/backend gates, exact-SHA PR/CI and integration.
- [ ] Clean production image, guarded rollout and full A/B external acceptance.

Next confirmed source defect: eight legacy Tools API methods resolve null after a synthetic network refusal. That independent path is outside this source acceptance.
