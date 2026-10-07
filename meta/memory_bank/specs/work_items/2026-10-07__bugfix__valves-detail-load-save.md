# AIRIS user valve detail load and save recovery

- Type: bugfix
- Workflow: bug_fix / workflow-compliance
- Owner: Codex
- Status: in progress
- Branch: `codex/bugfix/valves-detail-load-save`
- Created: 2026-10-07
- SDD Spec: `meta/sdd/specs/active/airis-valves-detail-load-save-2026-10-07-001.json`

## Cause and scope

Actual Controls/Valves loader leaves loading=true on rejected values/schema and
null values with array schema. Six user valve API calls swallow network errors
as null. Server legitimately returns null for unset values or absent UserValves;
HTTP/network/JSON failures must remain rejected. Trace all callers (Controls,
workspace modal, MessageInput, admin functions/tools), server endpoints and
persistence. This work covers user valve API error propagation and Controls
load/save lifecycle. Existing workspace modal catches rejected loads and closes;
its admin API/lifecycle behavior is not changed by this release.

## Measurable acceptance

- [x] Baseline rejects/null array reproduced; network failures swallowed in all six APIs.
- [x] Values/schema failures finish loading, show localized safe error, permit retry, write zero updates.
- [x] Successful null values preserve defaults; null schema means no settings.
- [x] Latest selection owns values/schema; close/unmount invalidate pending work; old load/save replies cannot replace current data.
- [x] Debounce remains bound to selection; no cross-tool updates, no duplicate form/timer submission.
- [x] Arrays roundtrip without modifying editor state; null/default and multiselect preserved; repeated saves work.
- [x] Full frontend and compiled Chromium/mobile Firefox pass; no new normalized diagnostics, targeted lint clean.
- [ ] Exact source/CI, candidate paths, preserved production backend/static/ENV/data/money and rollback accepted.
- [ ] SDD and private acceptance closed after release; overall onboarding criteria remain separate.

## Upstream impact

Minimal Controls hooks and six user API wrappers route through one fork-owned
helper. Two modal null-normalization hooks preserve its existing behavior; a JSDoc annotation corrects the shared renderer prop contract. No backend, schema, dependencies or authorization changes. Existing
Svelte5.56.0 legacy APIs retained (latest5.57.2 verified); upgrade is separate and
requires full compatibility checks. Official pinned lifecycle/reactivity docs
read. Reuse current fetch timeout pattern and notifications. Server successful
null remains authoritative; its legacy model helpers cannot distinguish missing
values from an internal read error without changing their backend contract.

## Validation and rollback

Keep baseline facts; actual compiled component with real shared Valves/Spinner,
controlled API boundaries and no production user mutations. Exact release digest,
verified backup, Alembic, only airis recreate and retained rollback required.

## Source verification in progress

API baseline12 failures/6passes; fixed18/18, expanded API/codec27/27 and actual
transpiled component methods4/4. Full frontend861/861 in103files. Compiled
Controls with real Valves/Spinner children and controlled APIs:54/54 initially;
extended multiselect/default/same-id reopen accepted66/66. Types3256→3245,
127warnings unchanged;ESLint1192→1189,normalized new diagnostics0. Touched
Controls/helper/tests lint clean. Existing tools API line234 any[] is unchanged
legacy lint debt. Targeted nullable normalization in workspace modal and JSDoc
renderer prop typing avoid new caller errors; no suppressions or weakening.

Retained rejected checks: first API test collection lacked a browser location
boundary; mocked constants and reran baseline12/6. Early diagnostic parsed
uncompleted output; rejected and final completed diagnostic accepted. First
compiled submit case found duplicate timer/save event; guard saving in debounce
fixed it and54checks passed. Expanded multiselect locator initially used visible
selected text instead of existing aria-label; corrected fixture locator.
