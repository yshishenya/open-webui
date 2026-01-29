Goal (критерии успеха):

- Fix billing dashboard page so content loads instead of an endless spinner.

Constraints/Assumptions:

- Follow AGENTS.md ledger rules and coding instructions; bug-fix workflow from Memory Bank; environment has danger-full-access, approval requests disallowed (policy "never").
- Billing-related frontend/backend files are group-readable but not group-writable (need permission change to edit).

Key decisions:

- None yet.

State:

- Done:
  - Previous session: duplicate-email guards added to VK/Yandex OAuth flows (kept for continuity).
- Now:
  - Investigating billing dashboard spinner/no-content issue; billing UI/API files now readable via group permissions.
- Next:
  - Reproduce issue, identify root cause, implement fix, add/regenerate tests if applicable.

Open questions (UNCONFIRMED если нужно):

- UNCONFIRMED: Existing automated tests for billing dashboard UI?

Working set (files/ids/commands):

- .memory_bank/current_tasks.md
- src/routes/(app)/billing/dashboard/+page.svelte
- src/lib/apis/billing/index.ts
- backend/open_webui/routers/billing.py
- backend/open_webui/utils/billing.py
