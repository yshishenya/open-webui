# AIRIS user valve detail load and save recovery

- Type: bugfix
- Workflow: bug_fix / workflow-compliance
- Owner: Codex
- Status: completed
- Branch: `codex/bugfix/valves-detail-load-save`
- Created: 2026-10-07
- SDD Spec: `meta/sdd/specs/completed/airis-valves-detail-load-save-2026-10-07-001.json`

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
- [x] Exact source/CI, candidate paths, preserved production backend/static/ENV/data/money and rollback accepted.
- [x] SDD closed after release; private acceptance remains a separate local record. Overall onboarding criteria remain separate.

## Upstream impact

Minimal Controls hooks and six user API wrappers route through one fork-owned
helper. Two modal null-normalization hooks preserve its existing behavior; a JSDoc annotation corrects the shared renderer prop contract. CI-required cleanup removes only unused modal code/styles and specifies the existing tools access-grant payload type. No backend, schema, dependencies or authorization changes. Existing
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
Controls/helper/tests lint clean. CI on source9e870 rejected12 existing lint errors in touched files. Remove
unused modal imports/catch binding and component-scoped selectors that match no
elements; type updateToolAccessGrants using the actual AccessControlModal payload
(id optional, user/group/anyone, principal_id, read/write). No runtime permission
logic or backend contract changes. Recheck final source before release. Targeted nullable normalization in workspace modal and JSDoc
renderer prop typing avoid new caller errors; no suppressions or weakening.

Retained rejected checks: first API test collection lacked a browser location
boundary; mocked constants and reran baseline12/6. Early diagnostic parsed
uncompleted output; rejected and final completed diagnostic accepted. First
compiled submit case found duplicate timer/save event; guard saving in debounce
fixed it and54checks passed. Expanded multiselect locator initially used visible
selected text instead of existing aria-label; corrected fixture locator.

## Accepted release

[PR339](https://github.com/yshishenya/open-webui/pull/339): source `3668d5c7f6310535fe6469936683d33d1e55d0b7`, merge `dccf9fb9e13912b7127039a0d4708225b75deb78`; trees equal.11 applicable CI checks succeeded; dependency-review skipped. Full frontend861/861,66 compiled detail cases,18 list cases,24 candidate full-path cases accepted. Final types3245/warnings121 and ESLint1180 remain existing debt;new normalized diagnostics0. Local SDD0errors/0warnings after supplying required task file paths.

Production digest `sha256:f09649726d573dcffad433bbf0b64653784b90cc028d3c89a968b5c3c79a7d00`;4915frontend/427backend file hashes match;3955static and analytics preserved. Environment/configuration/data mount/12neighbors and money hashes preserved, healthy/restarts0. Verified backup and rollback retained; Alembic passed; default image pin without another recreate. This closes this bug only. General frontend gate and ordinary-user/phone/mail/pilot/cohort acceptance remain open.

Retained rejected verification: source9e870 failed changed-file CI; missing SDD file_path metadata fixed. Shared-network candidate run hit two DNS targets (old/new fixtures); isolated internal network accepted24/24 without source changes. Address-pool exhaustion resolved with a nonoverlapping private test subnet, no network deletion. Initial post-release Docker health snapshot starting rejected; next healthy snapshot accepted.
