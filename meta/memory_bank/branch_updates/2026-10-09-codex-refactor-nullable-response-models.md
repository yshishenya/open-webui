- [ ] **[REFACTOR]** Preserve nullable FastAPI response contracts
  - Spec: meta/memory_bank/specs/work_items/2026-10-09**refactor**nullable-response-models.md
  - Owner: Codex
  - Started: 2026-10-09
  - Summary: Remaining 28 Optional runtime response declarations; exact source/API/response serialization preservation and full tests. General quality/CI/release remains open.

  - Source: 9ecf29a1159daa063685d8cd94388322a228a5f8, committed and pushed.
  - Checks: UP045 zero; Ruff 1624 -> 1596, zero added; 453 AST/Black checks; exact API/schema/tool parity and 140 response cases; backend 1017/1017, frontend 946/946. General frontend check 2293/108, ESLint 1020 and independent release remain open. SDD 2/3.
