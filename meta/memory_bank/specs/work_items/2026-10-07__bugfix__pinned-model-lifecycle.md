# Pinned model lifecycle and settings failure recovery

- Type: bugfix
- Status: active
- Workflow: bug_fix
- Owner: Codex
- Branch: `codex/bugfix/pinned-model-lifecycle`
- Created: 2026-10-07
- SDD Spec: `meta/sdd/specs/active/airis-pinned-model-lifecycle-2-2026-10-07-0202.json`

## Cause and scope

Sidebar mounts PinnedModelList for stored/default pinned models. Its async onMount awaits settings persistence before installing the subscription; failure prevents initialization and leaving during the wait can install a late subscription/Sortable. Sortable instance has no owned destruction. Reorder/unpin failures have no user-safe error path and reorder mutates the store array directly. All three settings-write paths will use the existing API with one settling helper; this is a local persistence operation, not a new service. Backend config exposes default_pinned_models as comma-separated string/null, not the current frontend string[] declaration.

## Measurable acceptance

- [ ] Rejected/null writes produce one safe error while mounted and zero unhandled rejections; initialization and subsequent settings updates still work.
- [ ] Destroy before async initialization finishes leaves zero subscriptions/Sortable instances; normal destroy removes both exactly once.
- [ ] Default/stale pins, reordering and unpin retain intended ids and unrelated settings; a successful retry persists the exact sequence. Missing drag id/index changes zero settings.
- [ ] Correct backend string/null contract without runtime configuration change. Existing Sortable/native stores reused, no dependencies or suppression.
- [ ] Exact-source Docker tests and diagnostic comparison accepted; compiled Chromium/Firefox and guarded production preservation accepted before completion.

## Upstream impact

Minimal lifecycle/error handling in existing PinnedModelList.svelte and concrete props/accessibility in its PinnedModelItem.svelte, with fork-owned regression and frontend contract correction. No new subsystem, routes, data migration, money or email sending changes. Do not overwrite user/foreign pending edits. Overall G14 and complete onboarding goal remain open.


## Local acceptance — 2026-10-07

Actual component-script and template-handler regression22/22; baseline21fail/1pass
with1unhandled unpin rejection. Full Docker frontend731/731. Correct the existing
public-config fixture to the server string/null contract. All six changed source/test
files pass Prettier and ESLint. Full type diagnostics3379→3369, warnings131 unchanged,
zero new normalized message; existing global debt remains open. Full ESLint1236→1231,
zero changed-file messages. Declare only installed Sortable constructor/destroy API;
no dependency, rule disable or new service. Reuse optimistic settings semantics:
failure keeps local intent and emits a safe error, persistence success is not assumed.
Source CI, compiled browser and production acceptance remain pending.
