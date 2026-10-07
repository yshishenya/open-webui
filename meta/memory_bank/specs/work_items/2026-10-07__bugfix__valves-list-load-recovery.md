# AIRIS valves list load recovery

- Type: bugfix
- Workflow: bug_fix / workflow-compliance
- Owner: Codex
- Status: in progress
- Branch: `codex/bugfix/valves-list-load-recovery`
- Created: 2026-10-07
- SDD Spec: `meta/sdd/specs/active/airis-valves-list-load-recovery-2026-10-07-001.json`

## Cause and scope

Controls/Valves initializes shared nullable tool/function lists without handling
rejected API calls, leaving loading=true and preventing a sibling list request.
A null list finishes loading but crashes the select template. Recover each list
independently, retain null as unknown, show localized errors and retry on reopen.
Render nullable lists safely; avoid sorting the shared function list in place.
Trace the sole Controls caller, list stores, API clients and server responses.
This work item covers list initialization and selection rendering. Detailed
valve schema/value load-save contracts remain a separate existing legacy block.

## Measurable acceptance

- [x] Actual initializer regression fails on baseline for reject/null.
- [x] Each failed list finishes loading, displays a user-safe error, leaves the
      sibling usable and retries only unknown lists on reopen.
- [x] Successful empty lists remain cached; server tools excluded; functions
      sorted for display without mutating store order.
- [x] Full frontend suite passes, compiled Chromium/390px Firefox cases pass,
      zero new normalized type/lint errors, touched file lint clean.
- [ ] Exact source CI and identical merge trees accepted.
- [ ] Candidate path pack and guarded production release accepted with
      backend/static/ENV/money/mounts/neighbors preserved.
- [ ] SDD closed and private plan reconciled; overall final-goal gates kept honest.

## Upstream impact and rollback

Minimal shared Controls/Valves loading and null-render guards, unused imports and
indices removed. Reuse existing stores/APIs/notifications. English/Russian error
translations; one regression. No backend/schema/dependency changes. Release only
with exact image identity, verified backup, Alembic and retained rollback.

## Source verification, 2026-10-07

Actual initializer baseline 4 failures/1 pass; fixed 5/5. Full frontend 830/830
(101 files). Actual compiled Controls/Valves with real shared Valves/Spinner
children: 18/18 Chromium/390px Firefox checks, page errors0, controlled list API
fixtures. Reject/null independently recover, sibling remains selectable, retry
refetches only unknown lists; server tools excluded and function store order
preserved. Types3258→3256, warnings127 unchanged, ESLint1200→1192; normalized
new diagnostics0, component/test lint0 and format clean. Existing detailed
valve value/schema type errors remain explicit legacy debt. No user browser
generation/payment/profile mutation, no pilot claim.
