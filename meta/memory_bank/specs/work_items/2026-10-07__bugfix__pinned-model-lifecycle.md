# Pinned model lifecycle and settings failure recovery

- Type: bugfix
- Status: completed
- Workflow: bug_fix
- Owner: Codex
- Branch: `codex/bugfix/pinned-model-lifecycle`
- Created: 2026-10-07
- SDD Spec: `meta/sdd/specs/completed/airis-pinned-model-lifecycle-2026-10-07-001.json`

## Cause and scope

Sidebar mounts PinnedModelList for stored/default pinned models. Its async onMount awaits settings persistence before installing the subscription; failure prevents initialization and leaving during the wait can install a late subscription/Sortable. Sortable instance has no owned destruction. Reorder/unpin failures have no user-safe error path and reorder mutates the store array directly. All three settings-write paths will use the existing API with one settling helper; this is a local persistence operation, not a new service. Backend config exposes default_pinned_models as comma-separated string/null, not the current frontend string[] declaration.

## Measurable acceptance

- [x] Rejected/null writes produce one safe error while mounted and zero unhandled rejections; initialization and subsequent settings updates still work.
- [x] Destroy before async initialization finishes leaves zero subscriptions/Sortable instances; normal destroy removes both exactly once.
- [x] Default/stale pins, reordering and unpin retain intended ids and unrelated settings; a successful retry persists the exact sequence. Missing drag id/index changes zero settings.
- [x] Correct backend string/null contract without runtime configuration change. Existing Sortable/native stores reused, no dependencies or suppression.
- [x] Exact-source Docker tests and diagnostic comparison accepted; compiled Chromium/Firefox and guarded production preservation accepted before completion.

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

SDD CI rejected the wrapper-generated four-digit suffix; rename only the spec id/file
to the existing three-digit project policy, retaining hierarchy and journal.


## Runtime acceptance — 2026-10-07

PR317 source `45024188eccc85126fdacbeda233cd9f56be9800`, merge
`12fe943968b45e8aa2e3b402ed693a19f904bbfe`: identical trees, all applicable CI
success; dependency-review skipped, automated external review disabled.
Compiled Chromium/Firefox8/8 with0pageerrors, actual Sortable onUpdate callback,
narrow startup/unpin390px and sorting/lifecycle1280px. Full onboarding/payment
paths24/24 in one Docker run; provider/payment/SMTP are local controlled fixtures.
Physical pointer drag/phone and real external delivery are not inferred.

Guarded production accepted: exact candidate frontend4914/Python427, unchanged
backend/environment/compose/migrations/money and12 neighboring services, healthy
with0restarts. Temporary user terminal disappeared before deployment and later
started again through ordinary app use; its cause of disappearance is unknown.
Image selection pinned without another container recreation; backup/rollback retained.
Ordinary account guide/button-prefill/free model/wallet accepted; pin persists across
reload and list remount, selector-menu unpin restores all prior account settings.
Sidebar Shift unpin is verified on compiled candidate; native live Input unsupported.

SDD3/3 closed through wrapper. These docs do not require another runtime release.
Global frontend type/lint debt and full onboarding human/calendar acceptance remain
open; this item does not claim the overall goal complete.
