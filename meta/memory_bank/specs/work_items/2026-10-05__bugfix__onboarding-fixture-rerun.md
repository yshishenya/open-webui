# Repeatable onboarding browser fixture setup

## Meta

- Type: bugfix (test infrastructure only, small guard change)
- Status: in progress
- Owner: Codex
- Branch: codex/bugfix/onboarding-fixture-rerun
- Created: 2026-10-05

## Confirmed defect

The global setup queries the base model list for airis-constructor-form. That model derives from gpt-5.6-luna and is absent from the base list. A second run against the same disposable fixture tries creating an existing model and fails at created.ok(), before any browser scenario runs.

## Minimal fix

Use the existing GET /api/v1/models/model?id=airis-constructor-form endpoint. Create only on 404; fail on any other unsuccessful response. Preserve existing authentication, model payload and fixture-only hostname guard. No application runtime, provider, dependency, schema or permissions change; no SDD required for this small test-only correction.

## Measurable acceptance

- [x] Reproduce second setup failure with an existing derived model.
- [x] Fresh fixture creates the missing model exactly once; second setup succeeds without recreating it.
- [x] Run compiled browser scenarios with the corrected setup; 0 failures and no application source delta.
- [ ] Focused formatter/lint checks and exact-head CI pass; merge tree equals source tree.

## Upstream impact

Only e2e/onboarding-paths.setup.ts changes its model existence query and error guard. Release images are unaffected.

## Local verification

Fresh setup followed by immediate repeat: Chromium and Firefox each pass twice (2/2 + 2/2); same disposable model remains valid. Docker Compose focused Prettier and ESLint pass. Full compiled candidate suite: 20/20. Exact-head CI and merge verification remain pending.
