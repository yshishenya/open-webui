# Prompts: explicit refusals and preservation of drafts

Status: Done (source acceptance; production release pending)
Owner: Codex
Branch: codex/bugfix/chat-dispatch-replay
SDD Spec: meta/sdd/specs/completed/airis-prompts-management-safety-2026-10-10-023.json

- [x] Trace server contracts and every original API consumer; reproduce errors.
- [x] Reuse requestJSON and grant validation; retain methods, defaults and pagination.
- [x] Preserve drafts/history on failure; close editor only after confirmed save.
- [x] Validate import before writes; prevent repeated writes and late list effects.
- [x] Check targeted/full frontend, types/lint, browser and preservation.
- [x] Complete SDD, commit/push and update private plan evidence.

## Upstream impact

Prompts API, manager, editor, edit route and menus only. Existing helpers and
platform APIs; no dependencies, retry machinery or new subsystems. Backend unchanged.

## Acceptance / limits

Run regression before and after fix. Source checks and controlled browser acceptance
cannot close production, real payment/provider/mail/pilot/calendar criteria.
An aborted request cannot undo a write already accepted by the server; partial
import must show the accepted count and stop rather than retry writes.

## Risk / rollback

All request errors reject; callers must contain refusals. Preserve nullable server
records and existing metadata/access defaults. Rollback the bounded runtime commit.

## Final source acceptance — 2026-10-10

- Runtime source/remote: `fcca5208491f40223da33a9e7daecb60b2a30337`; 5618 frozen Git blobs match.
- Original API/editor regression: 22 failed / 3 passed. Original manager:
  8 failed (actual source and native FileReader boundary; filtered cases excluded).
  Superseded rig extraction failures are diagnostic artifacts, not product evidence.
- Final full frontend: 2013/2013, 166 files, failed/pending/todo 0.
  Direct focused 74/74; related 185/185 (Prompts, function import, Skills, Tools)
  extracted from the final full run. Browser 21/21, console errors/warnings 0/0.
- Types 1059/85 → 1001/85; ESLint 742 → 723; new diagnostics 0.
- Actual compiled manager/editor/edit route/menus/Switch/Modal/Textarea/Tags;
  actual adapters/requestJSON/parser and native files; controlled fetch/stores/
  navigation/download/copy. AccessControlModal placeholder; actual access callback
  refusal/write-order verified in regression tests, not the placeholder.
- All original API consumers traced. Commands and workspace list already catch
  refusals. Unused diff/history-entry adapters covered as client contracts; this
  acceptance does not prove their server routing or broader navigation lifecycle.
- Source self-review/Git diff checks completed. No dependencies, retries or backend
  changes. Backend 542, unrelated primary 21, production image/config/12 neighbors
  preserved; healthy/restarts 0, revision unchanged. Historical backend 1063 reused,
  no new backend test run. All 262 Docker volumes preserved (default data volumes
  predate this turn). Own browser/HTTP/generated bundle removed; logs kept.
- SDD 3/3 complete; schema validation recorded after staging this spec.
- Proof: `/Users/yshishenya/.codex/private-artifacts/airis-prompts-management-20261010`.

Global plan remains 198/244, 46 open; no numbered closure from local source checks.
Whole types/lint, backend/PostgreSQL release gate, PR/CI/integration/clean build/
staging/deployment and real provider/payment/mail/pilot/calendar acceptance remain.
