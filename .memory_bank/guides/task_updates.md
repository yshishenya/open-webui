# Task Updates Workflow (No Conflicts)

To avoid merge conflicts in `.memory_bank/current_tasks.md`, use **work item specs + branch updates + consolidation**.

## 1) On feature/bugfix branches

Do **not** edit `.memory_bank/current_tasks.md`.

### 1.1 Create a work item spec (recommended)

Create a dedicated spec file for the change (one file per task):

```
.memory_bank/specs/work_items/YYYY-MM-DD__<type>__<slug>.md
```

Use the template:

```
.memory_bank/specs/work_items/_template.md
```

### 1.2 Append a branch update entry (with spec link)

Instead, append updates to a branch log:

```
.memory_bank/branch_updates/<YYYY-MM-DD>-<branch-slug>.md
```

Example:

```
.memory_bank/branch_updates/2026-02-02-feature-billing-wallet.md
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
- `Done: YYYY-MM-DD` (when completed)

## 2) On the integration branch (e.g. `airis_b2c`)

1. Merge your feature branch as usual.
2. Open each `.memory_bank/branch_updates/*.md` file.
3. Copy the entries into `.memory_bank/current_tasks.md` (correct section + status) and keep the `Spec:` link.
4. Delete the processed `branch_updates` files.
5. Commit the consolidation.

## Why this works

`current_tasks.md` is a single shared file. Multiple branches editing it causes frequent conflicts.
Work item specs are “one file per task” and rarely conflict; branch logs isolate status updates and make consolidation deterministic.
