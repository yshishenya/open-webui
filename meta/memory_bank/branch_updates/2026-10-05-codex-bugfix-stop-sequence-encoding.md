- [x] **[BUG]** Preserve stop sequence strings and Unicode for all provider converters
  - Spec: `meta/memory_bank/specs/work_items/2026-10-05__bugfix__stop-sequence-decoding.md`
  - Owner: Codex
  - Branch: `codex/bugfix/stop-sequence-encoding`
  - Started: 2026-10-05
  - Done: 2026-10-05
  - Summary: Trace confirms both provider mappers iterate strings and corrupt Unicode; reuse one fork-owned decoder.
  - Tests: Actual mapper30/30after20failbaseline; backend930passed/5knownskips; frontend547/547; strict new-file Ruff/Black; payload0new diagnostics. Candidate/CI/release pending.
  - Risks: Escaped syntax must remain compatible; invalid types must fail explicitly.

- 2026-10-05: Additional edge audit: initial decoder corrupted backslash+Cyrillic;2/46failed before,46/46pass after escape-only stdlib decoder.30940ASCII cases/0mismatches; full backend946pass/5sameknownskips,lint0new,Black3pass. Exact-head CI/candidate/release remain pending; initial frontend build failed2GiBheap.

- Final acceptance: PR262 merged4498289cb828b311b79832e750711ee26afc846c; exactsource5c471189fc8e91615b88728806956d2c613a8021;12CI success/1skip. SDD2/2closed; productiondigest5b761e0091d309028390ffc10046c7b2128e0bfe75b8d86a19965365baaaf23d,4914frontend/426Python hashes,16compiledpaths and saved chat accepted.12originalneighbors/ENV preserved; default Compose pinned. Wholegoal still active.
