# Admin model listener lifetime

## Meta
- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/admin-model-listener-cleanup
- SDD Spec: meta/sdd/specs/active/airis-admin-model-listener-cleanup-2026-10-06-001.json
- Created: 2026-10-06

## Context
The Models settings page returns teardown from async onMount. Svelte only accepts a synchronous teardown; all three keydown/keyup/blur listeners survive page unmount. Actual callback reproduction confirms three remain. A pending init can also install them after the page closes. This is measured quality debt under the complete onboarding goal; this repair alone closes no numbered plan item.

## Goal / Acceptance Criteria
- [ ] A synchronous teardown leaves exactly zero listeners after unmount; three mount/unmount cycles never accumulate listeners.
- [ ] Successful live initialization installs exactly three listeners; Shift down/up and blur retain existing behavior.
- [ ] Initialization finishing after unmount installs zero listeners.
- [ ] Failed initialization installs zero listeners and reports exactly one user-safe error while mounted; after unmount it reports none.
- [ ] Actual callback tests fail before and pass after; Docker suite and compiled Chromium/Firefox navigation pass without new diagnostics.
- [ ] Exact-source CI, merge tree, current-base overlay and guarded production acceptance complete.

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
