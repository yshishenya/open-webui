---
date: "2026-02-05"
problem_type: "documentation"
severity: "medium"
symptoms:
  - "Memory Bank examples contradicted AGENTS.md rules (e.g. `Any` usage in type hints)."
  - "Task updates had unprocessed `.memory_bank/branch_updates/*` entries on integration branch."
  - "Docs command conventions drifted (`docker-compose` vs `docker compose`)."
root_cause: "doc-drift"
tags:
  - memory-bank
  - docs
  - workflow
  - consistency
---

# Memory Bank + Docs consistency cleanup

## Investigation steps

| Attempt | Hypothesis | Result |
|---------|------------|--------|
| Scan Memory Bank for contradictions | Examples may be stale vs AGENTS.md rules | ✅ Found `Any` in type-hint examples and inconsistent wording |
| Check `branch_updates/` on integration branch | Consolidation step might have been skipped | ✅ Found a completed entry that wasn’t copied into `current_tasks.md` |
| Grep docs for command drift | Different docs may show different compose syntax | ✅ Found `docker-compose` usage in `BILLING_SETUP.md` while the repo standard is `docker compose` |

## Fix

- Updated Memory Bank docs to remove `Any` from code examples and align wording with AGENTS rules.
- Consolidated the completed branch update entry into `.memory_bank/current_tasks.md` and removed the processed `branch_updates` file.
- Standardized Docker Compose command examples to `docker compose` in Airis billing setup docs.
- Added a sharded Airis docs section under `docs/airis/` to reduce future doc sprawl.

## Verification

- Ran a local markdown-relative-link check (no broken links):
  - `python3 scripts/check_markdown_links.py`

## Lessons learned

- Keep “rules” and “examples” in the same doc lifecycle; examples rot faster than rules.
- Consolidation on the integration branch should be a deliberate step, not incidental.
