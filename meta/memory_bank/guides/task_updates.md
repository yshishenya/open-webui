# Task Updates Workflow (No Conflicts)

To avoid merge conflicts in `meta/memory_bank/current_tasks.md`, use **work item specs + branch updates + consolidation**.

## 1) On non-integration branches

Do **not** edit `meta/memory_bank/current_tasks.md`.
This rule applies to `feature/*`, `bugfix/*`, `refactor/*`, `docs/*`, and `codex/*`.

### 1.1 Create a work item spec (required)

Create a dedicated spec file for the change (one file per task on non-integration branches):

```
meta/memory_bank/specs/work_items/YYYY-MM-DD__<type>__<slug>.md
```

Use the template:

```
meta/memory_bank/specs/work_items/_template.md
```

### 1.1.1 Non-trivial work: create SDD JSON and cross-link (required)

For non-trivial work items:

- Create SDD JSON under `meta/sdd/specs/{pending,active,completed}/` using `meta/tools/sdd ...`
- In the work item spec (MD), add `SDD Spec: <path>`
- In the SDD JSON spec, set `metadata.work_item_spec` back to the work item spec path

### 1.1.2 SDD lifecycle discipline (required for non-trivial work)

When an SDD spec is linked to the work item:

1. Create/activate:
   - `meta/tools/sdd create "<name>" --json`
   - `meta/tools/sdd activate-spec <spec_id> --json` (if still in `pending`)
2. During implementation:
   - Update task statuses (`update-status`, `complete-task`)
   - Keep progress consistent (`meta/tools/sdd progress <spec_id> --json`)
3. Before marking branch entry/work item as `Done`:
   - `meta/tools/sdd check-complete <spec_id> --json`
   - `meta/tools/sdd complete-spec <spec_id> --json`
4. Optional:
   - `meta/tools/sdd move-spec <spec_id> archived --json` for long-term archive

### 1.2 Append a branch update entry (with spec link)

Instead, append updates to a branch log:

```
meta/memory_bank/branch_updates/<YYYY-MM-DD>-<branch-slug>.md
```

Example:

```
meta/memory_bank/branch_updates/2026-02-02-feature-billing-wallet.md
```

**Branch slug rule (worktree-safe)**

Branch names commonly contain `/` (e.g. `feature/billing-wallet`). Do **not** put `/` in filenames.
Use a filesystem-safe slug:

- Replace `/` with `-`
- Optionally replace spaces with `-` (if any)

Examples:

- `feature/billing-wallet` → `feature-billing-wallet`
- `bugfix/fix-oauth-config` → `bugfix-fix-oauth-config`

Use the same task format as `current_tasks.md` (checkboxes + details).

**Required fields for entries that will be consolidated:**

- `Spec: <path>` (point to the work item spec)
- `Owner: <name/agent>`
- `Summary: <1-2 lines>`
- `Done: YYYY-MM-DD` (when completed) or `Started: YYYY-MM-DD` (when in progress)

## Entry format (copy/paste safe)

To make consolidation deterministic (and avoid “style drift”), use the template:

- `meta/memory_bank/branch_updates/_template.md`

During consolidation on the integration branch, copy the entry into `meta/memory_bank/current_tasks.md` and keep at minimum:

- the checkbox line
- `Spec: ...`
- `Summary: ...`
- `Owner: ...`
- `Done:` / `Started:`

## 2) On the integration branch (e.g. `airis_b2c`)

1. Merge your feature branch as usual.
2. Keep `airis_b2c` as the default PR target for day-to-day work; do not open direct feature/bugfix/refactor/docs PRs to `main`.
3. Open each `meta/memory_bank/branch_updates/*.md` file.
4. Copy the entries into `meta/memory_bank/current_tasks.md` (correct section + status) and keep the `Spec:` link.
5. Delete the processed `branch_updates` files.
6. Commit the consolidation.

## Why this works

`current_tasks.md` is a single shared file. Multiple branches editing it causes frequent conflicts.
Work item specs are “one file per task” and rarely conflict; branch logs isolate status updates and make consolidation deterministic.
