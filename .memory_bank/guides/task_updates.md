# Task Updates Workflow (No Conflicts)

To avoid merge conflicts in `.memory_bank/current_tasks.md`, use a branch log + consolidation flow.

## 1) On feature/bugfix branches

Do **not** edit `.memory_bank/current_tasks.md`.

Instead, append updates to a branch log:

```
.memory_bank/branch_updates/<YYYY-MM-DD>-<branch>.md
```

Example:

```
.memory_bank/branch_updates/2026-02-02-feature-billing-wallet.md
```

Use the same task format as `current_tasks.md` (checkboxes + details).

## 2) On the integration branch (e.g. `airis_b2c`)

1. Merge your feature branch as usual.
2. Open each `.memory_bank/branch_updates/*.md` file.
3. Copy the entries into `.memory_bank/current_tasks.md` (correct section + status).
4. Delete the processed `branch_updates` files.
5. Commit the consolidation.

## Why this works

`current_tasks.md` is a single shared file. Multiple branches editing it causes frequent conflicts.
Branch logs isolate changes and make consolidation deterministic.
