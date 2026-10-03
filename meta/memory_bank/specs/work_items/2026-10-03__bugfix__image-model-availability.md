# Image model availability before billing

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/image-model-availability
- SDD Spec: meta/sdd/specs/active/airis-image-model-availability-2026-10-03-432.json
- Created: 2026-10-03
- Updated: 2026-10-03

## Context

Shared image generation/edit functions reach wallet preflight without checking the configured model override or its grants. A disabled model with an active rate can trigger a payment prompt. Public pricing-config can also recommend disabled/private/unpriced models independently of its rate catalogue. Required before promising an image example in product email. Governing rules: ../model_management_flow.md.

## Goal / Acceptance Criteria

- [x] Reproduce rejection failures before the change with providers and wallet calls blocked.
- [x] Disabled models, including inactive bases, return HTTP 403 model_disabled before image retrieval, billing or provider execution through shared generation/edit boundaries.
- [x] Active models require existing owner/read/base grants for all non-admin roles; missing records remain admin-only. Hidden active models remain callable when authorized.
- [x] Named image engines expose generation only when the configured/default model is accessible; /api/config makes no provider requests.
- [x] Public popular/recommended IDs require registered active public visible models with an active rate for the recommended modality.
- [x] SQLite and PostgreSQL tests cover actual grants and successful image billing/release.
- [ ] Exact source review, CI, integration and production acceptance; denied images create no image hold/charge/usage.

## Implementation / Scope

Add an Airis helper delegating access control to check_model_access, with explicit lifecycle checks. Thin hooks run outside billing exception conversion. Filter public recommendation IDs asynchronously with existing model helpers and run_in_threadpool for legacy rates. Named engines retain OpenAI/Gemini defaults. Automatic1111 resolves its real checkpoint at the operation boundary; config keeps its feature flag because it must not contact providers. No activation, grants, rates, balance or migrations changed. Existing global switches and feature permissions remain at entry points.

## Dependencies

No dependencies added/replaced. Keep pinned FastAPI 0.136.3 and SQLAlchemy 2.0.50 for current production compatibility. Reviewed official HTTPException and SQLAlchemy 2 async guidance. FastAPI registry reports 0.139.0; dependency upgrades remain separate work items with release-note review, lockfile update and full verification. No new library API used.

## Upstream impact

- routers/images.py: shared access hooks and concrete user/return annotations.
- main.py: configured model keys and authenticated availability hook.
- routers/billing.py: asynchronous public recommendation filter.
- tests: additive regressions; image billing fixture registers a public active model.

## Verification

Docker Compose-first, isolated databases, disabled SMTP and provider credentials. Pre-fix reproduction, image/access/config/public-pricing regressions, backend suite and changed-file lint/format. Record existing quality baselines. Production acceptance checks feature visibility and public pricing without real money or model activation.

## Risks / Rollback

Non-admin image use requires a registered accessible model, matching text access. Admin retains unregistered legacy access, but cannot use disabled records. Reload refreshes cached feature availability. Roll back to verified previous immutable image; no migration.

## Completion Checklist

- [ ] SDD check-complete and complete-spec
- [ ] Branch update with tests, risks and Done date

## Verification results before integration

- Pre-fix: 15 image/feature and 7 recommendation failures reproduce the bypass.
- Docker SQLite: 64 expanded checks passed; final full backend suite 682 passed / 3 skipped, including edit-override and missing-user regressions.
- Docker PostgreSQL: 61 focused tests passed with real grants, model records and wallet charge/release invariants.
- New helpers/tests pass Ruff and Black. Full Ruff: 6475 diagnostics versus 6476 in the baseline, zero additions; full Black check identifies 71 pre-existing files needing formatting. No broad formatting changes made.
- Self-review: five runtime files; no new dependencies, SQL, synchronous request I/O, migrations or activation writes. Shared boundaries cover routes, chat and built-in tools; config never discovers providers. Public recommendations require matching priced modalities. Disabled-base and cyclic-base guards prevent chained bypasses.
- CI and immutable candidate/production acceptance pending.

## CI baseline reconciliation

Existing backend lint rejects changed legacy files with hundreds of unchanged diagnostics. The CI gate now compares identical source lines to the PR base using the same installed Ruff and each revision's configuration. A prior diagnostic can exempt only one matching code/message/column on its unchanged line. New files, changed lines, changed codes/columns and duplicate diagnostics fail; removed errors cannot offset new errors elsewhere. Six independent standard-library tests cover this gate; Docker comparison of changed files reports 346 current / 347 base / zero new diagnostics. Complete baseline/current/new diagnostics remain uploaded artifacts. No Ruff rules, source suppressions or application strictness are relaxed. CI tooling is additive in scripts/ci with a thin lint-backend.yml hook; the full quality criterion remains open.

Frontend source is unchanged. Default concurrent verification hit module-loading timeouts and a terminated type-check; rerun uses two test workers with no file parallelism, without relaxing assertions or timeouts. Frontend ESLint retains its existing1540 diagnostics.

Final frontend verification:236/236 tests passed across49 files; complete type check4419 errors/177 warnings and ESLint1540 match the unchanged frontend baseline. The first resource-limited run is retained as evidence; the successful rerun kept assertions and timeouts unchanged. Full quality remains open.
