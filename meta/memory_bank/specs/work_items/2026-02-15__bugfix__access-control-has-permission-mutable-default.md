# Access Control: Fix Mutable Default in has_permission()

## Meta

- Type: bugfix
- Status: done
- Owner: codex (gpt-5.3-codex)
- Branch: codex/bugfix/access-control-has-permission-default
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-15
- Updated: 2026-02-15

## Context

`open_webui.utils.access_control.has_permission()` currently uses a mutable default argument:

`default_permissions: Dict[str, Any] = {}`

The function then calls `fill_missing_permissions(...)`, which mutates the dict in-place. Because the default dict is shared across calls, this can leak state between requests and cause permission checks to behave inconsistently (and potentially insecurely).

## Goal / Acceptance Criteria

- [ ] `has_permission()` does not use a mutable default argument.
- [ ] Add a regression test that would fail on the old behavior (shared default across calls).
- [ ] Full backend test suite remains green.

## Non-goals

- Full typing cleanup of `open_webui/utils/access_control.py` (keep the diff minimal and localized).

## Scope (what changes)

- Backend:
  - Update `open_webui/utils/access_control.py` to use `None` default and initialize a fresh dict per call.
  - Avoid introducing new `Any` usages in modified signatures (prefer `object` where needed).
- Tests:
  - Add a unit regression test ensuring `has_permission()` does not cache/mutate defaults across calls.

## Upstream impact

- Upstream-owned files touched:
  - `backend/open_webui/utils/access_control.py`
- Why unavoidable:
  - Fix is in the permission helper itself.
- Minimization strategy:
  - Keep the change narrowly scoped to the mutable default + a targeted test.

## Verification

- Backend tests: `npm run docker:test:backend`

## Task Entry (for branch_updates/current_tasks)

- [ ] **[BUG]** Fix mutable default in access control has_permission()
  - Spec: `meta/memory_bank/specs/work_items/2026-02-15__bugfix__access-control-has-permission-mutable-default.md`
  - Owner: codex (gpt-5.3-codex)
  - Branch: `codex/bugfix/access-control-has-permission-default`
  - Started: 2026-02-15
  - Summary: Prevent cross-request state leakage in permission checks by removing mutable defaults and adding regression coverage.
  - Tests: pending
  - Risks: Low; localized change covered by tests.

## Risks / Rollback

- Risks:
  - Low; should only reduce surprising behavior.
- Rollback plan:
  - Revert this commit.
