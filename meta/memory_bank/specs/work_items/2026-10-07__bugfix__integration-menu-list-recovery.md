# AIRIS integration menu list recovery

- Type: bugfix
- Workflow: bug_fix / workflow-compliance
- Status: in progress
- Owner: Codex
- Branch: `codex/bugfix/integration-menu-list-recovery`
- Created: 2026-10-07
- SDD Spec: `meta/sdd/specs/active/airis-integration-menu-list-recovery-2026-10-07-001.json`

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
- [ ] Exact source CI, identical source/merge trees, candidate path pack and
      guarded frontend release accepted with backend/static/ENV/money preserved.
- [ ] SDD closed and private plan updated; global G14/13.11 and real pilot gates
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
