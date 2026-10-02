- [ ] Durable email delivery
  - Spec: `meta/memory_bank/specs/work_items/2026-10-02__feature__email-delivery-queue.md`
  - Owner: Codex
  - Started: 2026-10-02
  - Summary: Reuse scheduler/SMTP with durable claims, explicit unknown outcomes, account frequency checks and shared transport capacity. Default-off pilot flags; cancellation and fact reconciliation.

CI review: the queue hook caused the existing scheduler file to enter changed-file Ruff validation. Fixed its ten inherited findings without disabling checks: module-qualified clock access, union annotations, one equivalent subdaily interval expression, extracted existing feature polling and one filtered payload update. Added five regression cases for clock alignment/preview and scheduler independence/failure isolation. Backend548 passed, PostgreSQL74 previously passed; final changed-file Ruff clean. Production/pilot gates remain pending.
