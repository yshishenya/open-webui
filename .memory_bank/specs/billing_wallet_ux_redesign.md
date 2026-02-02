# billing_wallet_ux_redesign
- Date: 2026-02-01
- Owner/Agent: Codex
- Links: N/A

## Summary
- Change: Redesign the billing wallet page into a single, user-friendly flow with a unified timeline, and remove the separate settings page.
- Outcome: Faster top-up, clearer spend controls, and understandable “why charged” history with free/paid usage in one place.
- Constraints/assumptions: Frontend-only; use existing APIs and stores; no new backend fields or endpoints.
 - UX principles: progressive disclosure, action-first layout, minimal jargon, clear cost source labeling.

## Context / Problem
- Why: The current wallet experience is long, fragmented, and uses billing terminology that is hard to interpret.
- Current pain: Duplicate settings screen, lead-magnet info without model list, history split into tabs, and limited context for charges.
- If bug: N/A (design/UX change).

## Goals / Non-goals
Goals:
- Simplify the wallet into 5–6 clear sections with a primary “Top up” CTA.
- Show free (lead magnet) limits and included models in a way users understand.
- Provide a unified activity timeline with clear labels and cost context.
- Keep all existing functionality (top-up, auto-topup, limits, contacts, history).
- Ensure mobile-first usability (CTA visible early, readable cards).
- Reduce cognitive load for new users while keeping advanced controls discoverable.
- Make cost source explicit (wallet vs included vs free) to avoid “where did money go?” confusion.
Non-goals:
- No backend/API changes or new notifications logic.
- No new analytics, forecasts, or pricing estimator blocks.
- No changes to subscription plans UI beyond a compact summary block.

## Behavior (AS-IS → TO-BE)
AS-IS:
- Wallet page shows multiple cards (balance, lead magnet, top-up, auto-topup, spend controls, contacts, latest activity).
- Free usage history is separate under “History” in a tab and not visible in wallet.
- Settings page duplicates spend limits and contacts.
- Lead magnet block does not show which models are included.

TO-BE:
- Wallet becomes a single flow with ordered sections:
  1) Header summary (balance + CTA + optional plan badge).
  2) Top-up actions and custom amount.
  3) Auto-topup (toggle → reveal threshold/amount + save).
  4) Spend controls (max reply + daily cap).
  5) Lead magnet limits + “Какие модели входят” list.
  6) Unified timeline preview (last 6 items) with “Вся история”.
  7) Contacts for receipts.
- History page uses the same unified timeline with filters: Все / Платные / Бесплатные / Пополнения.
- `billing/settings` is deprecated and redirects to `/billing/balance` (no UI there).

Edge cases / failures:
- Lead magnet disabled → hide the block entirely.
- Lead magnet enabled but no models flagged → hide the “models included” button and show a neutral hint.
- Models store not ready → show “Список недоступен” instead of opening the list.
- No activity → show empty state text (wallet + history).
- Auto-topup disabled by backend after max failures → toggle is off + show banner text.
- API errors (balance, ledger, usage) → show retry CTA for that section only.
- Usage event `is_estimated=true` or `cost_charged_kopeks=0` (payg) → label as “Оценка / Не списано” and use neutral color.

Concurrency/idempotency:
- N/A (frontend-only; existing backend idempotency remains unchanged).

## Decisions (and why)
- Single unified timeline: reduces mental load and avoids “where is my free usage?” confusion. Type chips and color coding make it readable.
- Use models store (`/api/models`) to list lead-magnet models via `model.info.meta.lead_magnet` (no new API).
- Do not show “80% notifications” checkbox (no backend support; avoid dead settings).
- Deprecate `billing/settings` and redirect to Wallet to avoid duplicate sources of truth.

Alternatives rejected:
- Separate tabs for paid vs free on wallet: increases navigation friction and hides important info.
- Fetching allowlist from a new endpoint: not needed; already available in models store.

## Design
Flow/components:
- Wallet page sections (in order):
  - Header summary: balance (wallet + included), CTA “Пополнить”, secondary “Лимиты”.
  - Top-up: fixed packages + custom amount input + submit.
  - Auto-topup: toggle, threshold, amount, save. Show fail banner if disabled.
  - Spend controls: max reply + daily cap, save button.
  - Lead magnet: progress bars + reset date + “Какие модели входят”.
  - Timeline preview: last 6 items + “Вся история”.
  - Contacts: email + phone, save.

User journeys (primary personas):
- New user (нулевой баланс): видит баланс + CTA “Пополнить”, быстрые суммы, без сложных настроек.
- Free user (lead magnet): видит остатки и понятную дату сброса, кнопку с моделями.
- Cost‑sensitive user: быстро находит лимиты, понимает эффект “остановим запросы”.
- Power user: включает авто‑пополнение, настраивает порог и сумму за 1 проход.

Unified timeline (shared component):
- Data sources:
  - Usage events: `getUsageEvents(token)` (no billing_source filter) → includes PAYG + lead_magnet.
  - Ledger entries: `getLedger(token)` → include only non-usage types (topup, refund, adjustment, subscription_credit).
- Exclude ledger types: hold, release, charge.
- Merge items by `created_at` desc and render one list.
- Pagination: fetch equal page sizes from both sources (e.g., 20/20), merge-sort by `created_at`, render top N (e.g., 20). Keep leftover items in buffer; on “Load more”, top up from the source whose next item is newest. Avoid over-fetching by tracking independent `skip` for ledger/usage.

Mapping to timeline items:
- UsageEvent →
  - kind: `usage` (billing_source=payg) or `free` (billing_source=lead_magnet)
  - title: `Списание` / `Бесплатное использование`
  - subtitle: `{model_name || model_id} · {modality} · {units}`
  - amount: `cost_charged_kopeks` (0 for free)
  - sign: negative for payg; “Free” label for lead_magnet.
- LedgerEntry →
  - kind: topup/refund/adjustment/subscription_credit
  - title: `Пополнение` / `Возврат` / `Корректировка` / `Кредит плана`
  - subtitle: date + optional reference_id short
  - amount: `amount_kopeks` (use sign + color)

Lead magnet “models included”:
- Source: `$models` store (loaded via `/api/models` in app layout).
- Filter: `model.info?.meta?.lead_magnet === true`.
- Display: list of model names or IDs in a small modal/tooltip (limit to 5 + “Показать все”).
- If list empty → hide button.

Contracts (if any): API / events + examples
- Existing endpoints only:
  - GET `/api/v1/billing/balance`
  - GET `/api/v1/billing/lead-magnet`
  - GET `/api/v1/billing/ledger?limit&skip`
  - GET `/api/v1/billing/usage-events?limit&skip`
  - POST `/api/v1/billing/auto-topup`
  - POST `/api/v1/billing/settings`
  - GET `/api/v1/users/me`
  - GET `/api/models` (already loaded in store)
- No new backend contracts.

Data (if any): schema + migrations + compatibility
- N/A (no schema changes).

Security/validation/logging rules:
- Validate money inputs client-side (numeric, non-negative).
- Preserve existing API error handling and toasts.
- No sensitive data logged.

## Implementation Plan (ordered checklist)
1. Create reusable timeline component for merged usage + ledger items.
2. Update wallet page layout to new section order and CTA hierarchy.
3. Integrate lead magnet models list from `$models` store.
4. Update history page to reuse the timeline component with filters.
5. Deprecate `billing/settings` route (redirect to `/billing/balance`).
6. Update i18n strings for new labels and empty states.
7. Log task update per `.memory_bank/guides/task_updates.md` with spec completion entry.

Parallel:
- Build timeline component and update history page UI.
- Update wallet layout and copy.

Strict order:
- Timeline component before wiring wallet/history.
- Redirect `billing/settings` after wallet fields are moved.

## Affected Files
- CREATE: `src/lib/components/billing/UnifiedTimeline.svelte` — merged timeline renderer.
- UPDATE: `src/routes/(app)/billing/balance/+page.svelte` — new layout, merged timeline preview.
- UPDATE: `src/routes/(app)/billing/history/+page.svelte` — use unified timeline + filters.
- UPDATE: `src/routes/(app)/billing/settings/+page.svelte` — redirect to `/billing/balance`.
- UPDATE: `src/lib/i18n/locales/ru-RU/translation.json` — new copy.
- UPDATE: `src/lib/i18n/locales/en-US/translation.json` — new copy.
- UPDATE: `.memory_bank/guides/task_updates.md` — mark spec done.

## Testing / Acceptance
Tests: manual UI validation (frontend only).
Acceptance criteria (DoD):
- [ ] Wallet shows balance + “Пополнить” CTA on first screen (desktop and mobile).
- [ ] Top-up packages and custom amount work; errors are shown for invalid input.
- [ ] Auto-topup fields appear only when toggle is on; backend auto-disable state is visible.
- [ ] Spend limits and contacts save correctly from wallet (no separate settings needed).
- [ ] Lead magnet block shows progress + reset date; model list is available when flagged.
- [ ] Timeline shows payg + free usage + topups in one list with correct signs and colors.
- [ ] Estimated usage is labeled and does not look like a paid charge.
- [ ] Model names render from store; fallback to model_id if missing.
- [ ] `/billing/history` shows the same timeline with filters and pagination (stable order).
- [ ] `/billing/settings` redirects to `/billing/balance`.
- [ ] Dark mode remains readable (contrast OK).

## Rollout / Rollback (if prod)
Rollout:
- Frontend deploy only; no backend changes.
Rollback:
- Revert wallet/history UI changes and restore settings route content.

## Observability
- Logs: N/A (no new logging).
- Metrics: N/A (no new metrics).
- Alerts: N/A.

## Risks / Open Questions / TBD
Risks:
- Merging ledger + usage events may confuse if items are not labeled clearly; mitigate with explicit labels and color coding.
- If models store is not loaded, model list will be unavailable; provide fallback UI.
Open questions:
- None.

## Quick start
1. Start files/modules: `src/routes/(app)/billing/balance/+page.svelte`, `src/routes/(app)/billing/history/+page.svelte`.
2. Commands: `npm run check` (optional), `npm run lint:frontend` (optional).
3. Local setup: standard frontend dev server.
4. Manual verification: wallet load, top-up flow, auto-topup toggle, limits save, timeline entries.
