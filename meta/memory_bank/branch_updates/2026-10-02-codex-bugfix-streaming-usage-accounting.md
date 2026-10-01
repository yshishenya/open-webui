- [x] **[BUG][BILLING]** Account for measured Responses API usage
  - Spec: `meta/memory_bank/specs/work_items/2026-10-02__bugfix__streaming-usage-accounting.md`
  - Owner: Codex
  - Branch: `codex/bugfix/streaming-usage-accounting`
  - Done: 2026-10-02
  - Summary: Trace confirmed nested Responses usage reaches chat history but is skipped by shared billing settlement. Normalize both provider formats and preserve fallback/cancellation.
  - Tests: Before fix: 2 regressions failed / Chat Completions passed; after fix: 418 backend tests passed; changed-file ruff and configured black passed; SDD has no errors. Repository-wide lint debt remains.
  - Risks: Monetary/quota accounting; historical events remain unchanged.

  - Closure: PR #133 merged after exact-head CI passed; released free usage matched provider measurements and quota deltas with zero charge. Prior estimates were preserved. SDD closed after production acceptance.
