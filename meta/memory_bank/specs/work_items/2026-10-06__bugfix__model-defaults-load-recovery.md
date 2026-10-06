# Model defaults initial-load recovery

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/model-defaults-load-recovery
- SDD Spec: meta/sdd/specs/completed/airis-model-defaults-load-recovery-2026-10-06-001.json
- Created: 2026-10-06

## Cause and scope

ModelDefaultsPanel.init leaves loading=true and rejects from its async onMount after getModelsConfig refusal. A null result renders empty settings as though loaded. Only the parent Models mounts this panel; initial load and explicit retry share the same init handler. Keep the existing component/API, safe translated error and native Retry button. No dependencies, backend or schema changes.

## Measurable criteria

- [x] Rejection and null read: loading=false, exactly1 safe error,0 writes and no fake editable defaults.
- [x] Busy read is not duplicated; Retry loads confirmed current configuration and suggestions.
- [x] Existing save refusal/draft/order tests continue passing.
- [x] Full Docker/frontend checks, no new mapped diagnostics, compiled Chromium/Firefox refusal/retry with0pageerrors.
- [x] Exact-source CI/merge and current-base immutable candidate, backup and guarded production acceptance.

## Upstream impact and limits

Only ModelDefaultsPanel.svelte lifecycle/error presentation changes; reuse its init and existing local state. Failed initial loading blocks editing rather than presenting empty saved settings. This does not close general G14 or real pilot/human acceptance gates.

## Source verification

Original actual handlers:3 new failures/13 existing passes. After correction:16/16 handler cases and622/622 Docker frontend across88files; changed runtime/test/e2e ESLint passes. Types3493/151 and ESLint1322 unchanged,0new mapped diagnostics. Initial Docker setup reached address-pool exhaustion and was repaired by reusing existing external network/dependency volumes; no network/volume/process removed. A new nullable test-state diagnostic was repaired; initial3494 result retained as unaccepted, corrected3493 accepted. Compiled browser, exact-source CI/merge and production remain pending.

## Production acceptance

Source `4fc6657fa31f45855ac38f5561ae9c24629a9e60`, merge `fee43563c4260df696ca3dfcdd8269106288c832`; source/precomputed/merged tree `5f3bd4701eb5b81c3fad0b6ddff392fe6c4985c1` match. All applicable source CI passed; expected dependency-review skip only. CodeRabbit review is disabled. Compiled Chromium/Firefox390px2/2, six refusal/retry stages each, pageerrors0; final handlers16/16, Docker622/622. Canonical SDD126/0errors/0warnings and tracked Markdown587/0broken before closeout.

Runtime immutable digest `sha256:d1739c816361f4c658789f7edb486adbc88f8e117e6ca9c65f69eaaed30633e7`:4914 frontend/426Python equal to candidate, ENV/compiled Metrica111392024/13neighbors preserved. Backup, hashes, archive/pg_restore and hard Alembic gate passed; revision `o1a020261003`, healthy/restarts0. Compose image pin changes only rendered image, no further recreation. Public source/guide/auth and authenticated ordinary saved chat, free Luna/zero RUB/files verified; console errors0, agent generations0. Initial source-map packaging was rejected and corrected to preserve existing private-map policy before browser/production acceptance.

General G14/13.11 remains open:3493 type errors/151warnings and1322 ESLint findings. This correction closes no numbered onboarding task;193/244 and final goalactive. Independent usefulness, physical phone, real payment/receipt, external Inbox/replies and voluntary24h/72h/14d pilot require separate evidence.
