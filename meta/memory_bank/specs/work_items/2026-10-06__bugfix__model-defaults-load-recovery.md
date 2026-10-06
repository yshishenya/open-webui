# Model defaults initial-load recovery

- Type: bugfix
- Status: in progress
- Owner: Codex
- Branch: codex/bugfix/model-defaults-load-recovery
- SDD Spec: meta/sdd/specs/active/airis-model-defaults-load-recovery-2026-10-06-001.json
- Created: 2026-10-06

## Cause and scope

ModelDefaultsPanel.init leaves loading=true and rejects from its async onMount after getModelsConfig refusal. A null result renders empty settings as though loaded. Only the parent Models mounts this panel; initial load and explicit retry share the same init handler. Keep the existing component/API, safe translated error and native Retry button. No dependencies, backend or schema changes.

## Measurable criteria

- [x] Rejection and null read: loading=false, exactly1 safe error,0 writes and no fake editable defaults.
- [x] Busy read is not duplicated; Retry loads confirmed current configuration and suggestions.
- [x] Existing save refusal/draft/order tests continue passing.
- [ ] Full Docker/frontend checks, no new mapped diagnostics, compiled Chromium/Firefox refusal/retry with0pageerrors.
- [ ] Exact-source CI/merge and current-base immutable candidate, backup and guarded production acceptance.

## Upstream impact and limits

Only ModelDefaultsPanel.svelte lifecycle/error presentation changes; reuse its init and existing local state. Failed initial loading blocks editing rather than presenting empty saved settings. This does not close general G14 or real pilot/human acceptance gates.

## Source verification

Original actual handlers:3 new failures/13 existing passes. After correction:16/16 handler cases and622/622 Docker frontend across88files; changed runtime/test/e2e ESLint passes. Types3493/151 and ESLint1322 unchanged,0new mapped diagnostics. Initial Docker setup reached address-pool exhaustion and was repaired by reusing existing external network/dependency volumes; no network/volume/process removed. A new nullable test-state diagnostic was repaired; initial3494 result retained as unaccepted, corrected3493 accepted. Compiled browser, exact-source CI/merge and production remain pending.
