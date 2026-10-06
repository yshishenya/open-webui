- [x] **[BUG][DATA]** Bounded onboarding history retention
  - Spec: `meta/memory_bank/specs/work_items/2026-10-06__bugfix__onboarding-data-retention.md`
  - Owner: Codex
  - Branch: `codex/bugfix/onboarding-data-retention`
  - Done: 2026-10-06
  - Summary: Define lifecycle and reuse hourly cleanup without losing replay/source receipts; explicit unavailable expired reports.
  - Tests: PG242/242;SQLite234/8 PG-only passed on PG;actual image same;backend CI1007/10skipped;guarded production accepted.
  - Risks: Age deletions require checked backup; live/ambiguous sends and financial facts excluded.

