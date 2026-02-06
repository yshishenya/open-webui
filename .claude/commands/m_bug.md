---
description: Execute bug fix workflow following Memory Bank standards
argument-hint: [bug description]
allowed-tools: Read(*), Edit(*), Write(*), Bash(*), Grep(*), Glob(*), TodoWrite(*)
---

You received the command /m_bug. This means we are starting work on fixing a bug.

Your task: $ARGUMENTS.

Execute the following procedure:

1.  Carefully study `meta/memory_bank/workflows/bug_fix.md`.
2.  Follow the process described there step by step.
3.  Ask clarifying questions at each stage if something is unclear.
4.  Track status updates per `meta/memory_bank/guides/task_updates.md`:
    - On non-integration branches: append to `meta/memory_bank/branch_updates/*` (do not edit `meta/memory_bank/current_tasks.md`)
    - On integration branch: consolidate into `meta/memory_bank/current_tasks.md`

Start with the first step.
