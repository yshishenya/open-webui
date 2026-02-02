---
description: Quick repo triage (status/diff/log)
agent: plan
---

Working tree:
!`git status --porcelain`

Recent commits:
!`git log --oneline -10`

Diff stats:
!`git diff --stat`

Based on the above, summarize what changed, what looks unrelated, and propose a minimal next-step plan.
