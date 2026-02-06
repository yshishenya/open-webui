---
description: Execute refactoring workflow following Airis Memory Bank standards
argument-hint: [refactor goal / scope]
allowed-tools: Read(*), Edit(*), Write(*), Bash(*), Grep(*), Glob(*), TodoWrite(*)
---

You received the command /m_refactor. This means we are starting refactoring work.

Your task: $ARGUMENTS.

Execute the following procedure:

1.  Carefully study `meta/memory_bank/workflows/refactoring.md`.
2.  Follow the process described there step by step.
3.  For non-trivial refactors:
    - Create a work item spec under `meta/memory_bank/specs/work_items/`
    - Track status in `meta/memory_bank/branch_updates/*` (do not edit `meta/memory_bank/current_tasks.md` on non-integration branches)
4.  Run verification via Docker Compose-first commands per `meta/memory_bank/guides/testing_strategy.md`.

Start with the first step.

