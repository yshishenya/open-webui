# Provider test facts — production acceptance

## Meta

- Type: docs
- Status: done
- Owner: Codex
- Branch: `codex/docs/provider-test-facts-production`
- SDD Spec: N/A — documentation of accepted implementation and rollout; no new implementation task.
- Created: 2026-10-06
- Updated: 2026-10-06

## Context

Record the accepted source, image and operational limits of the provider test flag fix. The implementation is described in [its work item](2026-10-06__bugfix__provider-payment-test-facts.md) and completed SDD `airis-provider-test-facts-2026-10-06-001`.

## Goal / Acceptance Criteria

- [x] Source/CI/integration identities agree; implementation and merged trees match.
- [x] The candidate and running image have the four expected backend changes and preserve the entire compiled frontend.
- [x] Backup, rollback, migration and health gates passed; runtime environment and unrelated services were preserved.
- [x] Read-only before/after financial snapshots match; no new provider payments/refunds/receipts or SMTP submissions were created by acceptance.
- [x] A fresh authenticated browser tab opens chat, free Luna, files and the guide; all three example links retain `submit=false` and the free model.
- [x] Remaining full-goal conditions stay explicit, with no unrelated checkbox closure.

## Accepted evidence

[PR304](https://github.com/yshishenya/open-webui/pull/304): source `6b06a68b35f6efa05566b9341ee018ad42387155`, merge `c7c0fd90644ade80436ba9721b5b5de1f8f55570`; both trees are identical. Eleven CI checks succeeded, dependency-review was skipped. CodeRabbit is disabled for the base branch and is not an independent review.

Corrected failing reproduction: 7 failed and 11 passed. Final isolated Compose: PostgreSQL127/127, SQLite126 with one PostgreSQL-only case separately passed. The compiled image itself passed PostgreSQL127/127 with only tests mounted; runtime code came from the image. Full backend CI:978 passed,5 skipped,183 warnings. Those five skips remain explicit and do not close full-goal verification. Changed-file Black/Ruff, SDD2/2, zero SDD validation errors/warnings and599 tracked Markdown files without broken links were verified before this documentation follow-up.

Production image `yshishenya/yshishenya:provider-test-facts-6b06a68b3-20261006`, digest `sha256:427964e516d9d87b1980e91fdb1d054086390c1a5084416aa65637939b166669`. Local, uploaded and running file manifests agree:4914 frontend files preserved;426 Python files, exactly four changed. All72 base layers and image environment preserved. Runtime environment,13 pre-existing neighboring containers and Alembic revision `o1a020261003` were retained; application healthy, restart counter0. Only the image pin was changed in the deployment configuration, without a second container recreation.

Guarded deployment acquired the existing lock, verified current runtime/configuration, created and checked backups with SHA256/data archive/PostgreSQL dump reader, checked immutable image/source, ran hard Alembic and recreated only the application with `--no-deps --no-build`. A rollback image and checked backup remain available. Read-only financial snapshots of wallets, payments, ledger entries and transactions match before/after; diagnostics issued only SELECT. Public health and compiled public environment match. A fresh ordinary-account tab retained history and free access at zero balance, showed files and opened the guide; three examples, free-model/no-submit links and zero console errors were confirmed. No new generation was requested.

## Scope / Upstream impact

This follow-up changes only documentation. No runtime, schema, dependencies, frontend or upstream-owned source changes; no new deployment is needed for this document.

## Limits / Next work

Unknown historical flags remain unknown. A known provider lookup exception is not explained by the flag fix; no financial record was relabeled by guess. Existing service notification contracts remain about actual wallet credit; real business metrics exclude explicit tests. Queue/product scenarios stay disabled, dry-run/pilot-only remain enabled, participants and queue entries remain zero. Product opt-in alone is not volunteer pilot evidence.

The implementation plan remains195/244,49 numbered items open. Real external Inbox/Reply-To access for both support operators, physical-phone acceptance, independent usefulness, historical receipt exception, a volunteer pilot with actual24h/72h/14d windows, mature cohort and existing full frontend quality debt retain their own criteria. This rollout does not close the overall goal.

## Verification / Risks / Rollback

Documentation checks are tracked separately from the already accepted source/image tests. Private primary correspondence, provider identifiers, credentials, raw financial records, server configurations and private acceptance logs are kept outside the public repository. The current immutable runtime remains accepted while this documentation is reviewed.
