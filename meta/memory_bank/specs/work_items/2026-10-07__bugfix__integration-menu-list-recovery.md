# AIRIS integration menu list recovery

- Type: bugfix
- Workflow: bug_fix / workflow-compliance
- Status: release accepted
- Owner: Codex
- Branch: `codex/bugfix/integration-menu-list-recovery`
- Created: 2026-10-07
- SDD Spec: `meta/sdd/specs/completed/airis-integration-menu-list-recovery-2026-10-07-001.json`

## Cause and scope

GET /tools/ and /skills/ may reject or return null after failure. The shared
IntegrationsMenu initializer can index null for a direct server, call Object.keys
on null, leave stale menu records or clear selected skill IDs after failed loading.
Declare existing nullable list stores from ToolUserResponse/SkillUserResponse and
rebuild visible menu dictionaries on each initialization. Catch real list failures,
preserve unknown selections on failure and filter IDs only after an authoritative
successful list. Preserve OAuth authentication flags and direct server indices.

## Measurable acceptance

- [x] Trace all store writers/readers, API schema fields and menu actions.
- [x] Regression fails on baseline for rejected/null tools, direct server after
      failure, stale-record reopening and selected-skill loss.
- [x] Failed loads finish without rejected init or infinite spinner, show a
      user-safe localized error and preserve selections. Retry recovers normally.
- [x] Successful empty/changed lists clear stale records and unavailable IDs;
      inactive skills excluded, OAuth flags/valves/direct IDs preserved.
- [x] Full frontend suite passes; type/lint delta has zero new diagnostics;
      menu/contracts/stores/test ESLint 0; unchanged parent diagnostics and formatting clean, no suppressions/Any/dependencies.
- [x] Chromium and narrow Firefox actual compiled menu opening/toggling/retry pass.
- [x] Exact source CI, identical source/merge trees, candidate path pack and
      guarded frontend release accepted with backend/static/ENV/money preserved.
- [x] SDD closed; private plan reconciliation follows documentation merge; global G14/13.11 and real pilot gates
      remain open unless their full criteria are independently met.

## Upstream impact and rollback

Response shapes in existing fork-owned frontend-contracts.ts; thin store annotations.
Shared upstream menu receives the minimum initializer/error/typing fixes and touched
file lint cleanup. No backend/schema/dependency changes. Any runtime change requires
frontend release with verified backup/migration/rollback and image/config/health proof.

## Verified implementation, 2026-10-07

Baseline regression: 4 failures / 2 passes. Fixed regression: 6/6; complete
frontend suite 825/825. Compiled Chromium/390px Firefox: 14/14, page errors 0.
Tools and skills rebuild each opening; failed/null loads retain selected IDs,
show localized messages and allow retry/direct tools. Empty successful lists
filter IDs; OAuth and valves metadata, active skills and direct indices preserved.
Forward closeOnOutsideClick to the existing Dropdown; remove two unused model
props and their sole parent call. No dependency/backend/schema change.
Types 3303→3258, warnings129→127, ESLint1218→1200, normalized new diagnostics0.
The broad legacy diagnostics and G14/13.11 remain open. Compiled menu uses real
Dropdown/Tooltip/Switch/icons with isolated API/store fixtures; no production
account, generation, payment or pilot acceptance is claimed by those tests.

## Accepted source and production release

[PR335](https://github.com/yshishenya/open-webui/pull/335): source `f6b6f457e0a273a3e3c82cd99c3d458797d7b297`,
merge `4b073da154860553c5e5d9b393dca71bbd5b3bc1`; trees identical. Ten applicable CI checks successful,
dependency-review skipped; CodeRabbit disabled for this base branch, independent
human review not claimed. Billing job log initially returned HTTP502; its completed
job and later log were retrieved successfully. Broad baseline debt remains open.

Tag `integration-menu-f6b6f457e-20261007`, registry/server identity
`sha256:1a28ac2bddb74fba9cd2276b0821f3d2410fd6957a7d4c54627e956726ac0712`. Exact4914 frontend/427 backend hashes accepted; same backend
source `6a2b5394518d4ac5bfc7e64039cc4db934a66107`,3955 deployed static assets and
analytics env.js retained.24/24 Chromium/Firefox candidate onboarding/payment paths
passed with no skips; six public endpoints returned200 and frontend version matches.
Those fixture cases do not replace ordinary production account, real phone or pilot.

Guarded release: verified database/data/config backup, hard Alembic gate, rollback,
unchanged environment/configuration,12 permanent neighbors, data mount and money
hashes.131 wallets,36 payments,5982 ledger entries and0 transactions preserved.
Healthy/restarts0;10.61GiB free. Default image pin updated atomically without
recreation; only intended .env image tag changes after runtime acceptance.
Backup `/opt/backups/airis/20261007T043552Z-integration-menu-f6b6f457e-20261007`.
Rollback `airis:rollback-20261007T043552Z-integration-menu-f6b6f457e-20261007`.
One old backup was relocated with11 file hashes/sizes and archive/dump readability
verification; current and preceding rollback copies retained.

Retained rejected preparation attempts: offline Pyodide fetch, premature build
configuration read, browser fixture selectors, SDD missing file_path metadata,
release-id preparation assertion and JUnit report-path guard. These were fixed
before production operation; early Docker health starting retained separately,
final health accepted. No diagnostic suppression or dependency downgrade.

Read-only follow-up confirms terminal service effective idle timeout30minutes;
that setting does not identify the actor or cause of an earlier terminal deletion.
The initializer probe of Controls/Valves separately reproduces rejected/null list
loading; direct server response contracts and this sibling are next items, not
part of this accepted release.

SDD3/3 completed. Overall goal remains active and plan198/244. GlobalG14/13.11,
real Inbox/replies/both operators, phone, independent usefulness, voluntary pilot,
real24h/72h/14d mature cohorts and one historical payment remain open.
