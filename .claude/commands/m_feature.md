---
description: Execute new feature development workflow following Memory Bank standards
argument-hint: [feature description]
allowed-tools: Read(*), Edit(*), Write(*), Bash(*), Grep(*), Glob(*), TodoWrite(*)
---

You received the command /m_feature. This means we are starting work on a new feature.

Your task: $ARGUMENTS.

Execute the following procedure:

1.  Find the corresponding work item spec in `meta/memory_bank/specs/work_items/` (or create one if missing for non-trivial work).
    If the work is non-trivial, also create/locate the SDD spec under `meta/sdd/specs/{pending,active,completed}/`.
    Cross-link MD <-> JSON (`SDD Spec:` in the work item spec, and `metadata.work_item_spec` in the SDD spec).
2.  Carefully study `meta/memory_bank/workflows/new_feature.md`.
3.  Follow the process described there step by step.
4.  Be sure to check `meta/memory_bank/tech_stack.md` before adding any dependencies.
5.  Track status updates per `meta/memory_bank/guides/task_updates.md`:
    - On non-integration branches: append to `meta/memory_bank/branch_updates/*` (do not edit `meta/memory_bank/current_tasks.md`)
    - On integration branch: consolidate into `meta/memory_bank/current_tasks.md`
6.  Upon completion of all work, update:
    - `meta/memory_bank/tech_stack.md` (if dependencies were added)
    - Create/update a guide in `meta/memory_bank/guides/` (if this is a new subsystem)

Start with the first step.
