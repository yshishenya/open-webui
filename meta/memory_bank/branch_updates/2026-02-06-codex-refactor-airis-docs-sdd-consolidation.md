# Branch Updates: codex/refactor/airis-docs-sdd-consolidation

- [x] **[REFACTOR][DOCS][SDD]** Consolidate Airis docs + plans + specs under `meta/`
  - Spec: `meta/memory_bank/specs/work_items/2026-02-06__refactor__airis-docs-sdd-consolidation.md`
  - Owner: Codex
  - Branch: `codex/refactor/airis-docs-sdd-consolidation`
  - Done: 2026-02-06
  - Summary: Move Memory Bank, SDD specs, Airis docs, and process scripts into `meta/`; add SDD wrapper + guardrails; fix path references.
  - Tests: `python3 meta/tools/check_markdown_links.py`, `meta/tools/sdd find-specs --json`, `meta/tools/sdd list-specs --json`, `meta/tools/sdd schema --json`
  - Risks: Medium (large mechanical move; mitigated by wrapper + link checking + grep).
