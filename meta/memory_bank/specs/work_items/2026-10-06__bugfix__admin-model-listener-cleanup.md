# Admin model listener lifetime

## Meta

- Type: bugfix
- Status: completed
- Owner: Codex
- Branch: codex/bugfix/admin-model-listener-cleanup
- SDD Spec: meta/sdd/specs/completed/airis-admin-model-listener-cleanup-2026-10-06-001.json
- Created: 2026-10-06

## Context

The Models settings page returns teardown from async onMount. Svelte only accepts a synchronous teardown; all three keydown/keyup/blur listeners survive page unmount. Actual callback reproduction confirms three remain. A pending init can also install them after the page closes. This is measured quality debt under the complete onboarding goal; this repair alone closes no numbered plan item.

## Goal / Acceptance Criteria

- [x] A synchronous teardown leaves exactly zero listeners after unmount; three mount/unmount cycles never accumulate listeners.
- [x] Successful live initialization installs exactly three listeners; Shift down/up and blur retain existing behavior.
- [x] Initialization finishing after unmount installs zero listeners.
- [x] Failed initialization installs zero listeners and reports exactly one user-safe error while mounted; after unmount it reports none.
- [x] Actual callback tests fail before and pass after; Docker suite and compiled Chromium/Firefox navigation pass without new diagnostics.
- [x] Exact-source CI, merge tree, current-base overlay and guarded production acceptance complete.

## Scope / Implementation

Only Models.svelte lifecycle callback, regression tests and work records. Return teardown synchronously, guard delayed initialization with one local disposed flag, and use existing toast/error translation. Keep the existing initialization API and sortable destruction boundary. No dependencies, API, schema, access or configuration changes.

## Upstream impact

Models.svelte owns these listeners; change its hook directly because there is no shared extension point. Keep the surrounding component and every mutation handler unchanged. Reuse Svelte's native lifecycle; no lifecycle abstraction.

## Reference / Compatibility

Repo lock Svelte5.56.0; current stable5.57.1 confirmed from npm registry. Existing onMount API is retained; no new integration or dependency version introduced. Official lifecycle docs confirm async callbacks always return Promise and cannot supply teardown. Dependency upgrade is separate work.

## Verification / Release

Actual lifecycle block with deferred init/refusal/repeated visits; existing Docker frontend suite and mapped check/lint comparison. Compiled admin navigation in Chromium and Firefox390px. Accept current production snapshot and candidate bytes/environment before guarded backup/Alembic/only-airis rollout. Full G14 and all external human/pilot criteria remain open.

## Risks / Rollback

Preserve registration after successful initialization and prevent late registration after teardown. Current production immutable image remains the rollback candidate. No claim that broader component state is typed or the voluntary pilot has started.

## Accepted Result — 2026-10-06

Source PR291:95acc99b236402ea44c70039d483a20d1700bb31; merge7053cb2199556702192cfd1669a5af8330493118. Source/precomputed/merged tree09d15f9b16653ff4f813fb794d63b36a508f7d15 match. Exact-source CI12successful checks/1expected dependency-review skip; independent CodeRabbit review is disabled.

Actual callback tests4/4, final-source Docker606/606 across87files. Before fix3cases fail with2unhandled refusals. Compiled final candidate Chromium/Firefox3902/2:three visits return all window listeners to baseline; modifier keyup/blur each add one while mounted; delayed init installs none after teardown; page errors0. The three lifecycle handlers are measured separately from nested component keydown handlers. Fixture preparation uses existing settings API and actual modal tabs. Initial direct-route, changelog-overlap, overbroad listener count and startup-before-health failures remain unaccepted diagnostic evidence.

Type errors3496→3493, warnings157; ESLint1330→1330; zero new mapped findings. Client/server compiled output matches outside the corrected lifecycle. A followup changes only E2E setup; runtime/unit/dependency equality confirmed. No backend/schema/dependency changes.

Production digest sha256:45973b3b42310ec95469c4405dc911173fec7ed743b4dd8def4c3857b8c1a3d6 accepted:4914frontend/426Pythonfiles match,57base layers and environment preserved. Backup checksums, archive/dump readability and hard Alembic gate passed; revisiono1a020261003. Healthy/restarts0;13neighbors preserved; only rendered image pin changed and pin did not recreate the container. Public version/guide/auth/compiled Metrica111392024 and ordinary authenticated chat/history/saved answer/empty input/wallet0RUB accepted, console errors0, new agent generation requests0. Initial container state starting is retained as intermediate; final healthy state is accepted.

Full onboarding goal remains active, numbered plan193/244 unchanged. Whole-project quality, external Inbox/support response/access, independent usefulness, physical device, real payment/receipt and voluntary pilot24h/72h/14d retain separate criteria. Private operational manifests and customer data remain outside GitHub.
