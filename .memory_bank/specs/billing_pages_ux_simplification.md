# billing_pages_ux_simplification
- Date: 2026-02-02
- Owner/Agent: Codex
- Links: N/A

## Summary
- Change: Redesign all billing pages (Wallet, History, Plans) to be action-first, simpler, and more scannable; collapse advanced settings; add low-balance state; add analytics events.
- Outcome: Users top up faster, understand balance/charges, and find advanced controls only when needed.
- Constraints/assumptions: Frontend-only; reuse existing APIs/stores; keep separate Save actions for auto-topup and settings; low-balance threshold = 100 RUB (10000 kopeks); no new dependencies.

## Context / Problem
- Why: Billing pages are currently dense and read like a settings dashboard, not a quick “wallet” flow.
- Current pain: Primary action (top up) competes with advanced settings; advanced blocks are rarely used; low-balance state is not explicit; history context is buried; headers and semantics are inconsistent across billing pages.
- If bug: N/A

## Goals / Non-goals
Goals:
- Make top-up the dominant first action on Wallet.
- Reduce cognitive load via progressive disclosure (advanced settings collapsed).
- Add explicit low-balance state with clear CTA.
- Keep free limits visible and understandable when enabled.
- Make History filter state shareable via URL query.
- Align headers and visual hierarchy across Wallet, History, Plans.
- Add analytics for key billing actions.
Non-goals:
- Backend/API changes or new billing logic.
- Changes to pricing rules or subscription billing behavior.
- New notification/alert system.

## Behavior (AS-IS → TO-BE)
AS-IS:
- Wallet shows many equal-weight cards (balance, lead magnet, top-up, auto-topup, spend controls, contacts, latest activity).
- Advanced settings are always visible, increasing clutter.
- Low balance has no explicit state.
- History exists as a separate page; filter state is not in URL.
- Plans page exists for admins with inconsistent header semantics.

TO-BE:
- Billing layout applies consistent header semantics (h1 + subtitle) across Wallet/History/Plans.
- Wallet page order (top → bottom):
  1) Balance summary hero with low-balance indicator + primary Top up CTA.
  2) Quick top-up (packages + custom amount) placed immediately under hero.
  3) Free limits (lead magnet) card when enabled.
  4) Advanced settings (collapsed by default): auto-topup, spend limits, receipt contacts.
  5) Latest activity preview (last 6 items) + link to full history.
- Advanced settings behavior:
  - Collapsed by default.
  - Auto-expand if any advanced setting is already configured:
    - auto_topup_enabled is true, or
    - max_reply_cost_kopeks/daily_cap_kopeks is set, or
    - billing_contact_email/phone is set.
  - Toggle is explicit (button “Manage limits & auto-topup”) and tracked by analytics.
- Low-balance state:
  - If totalBalance < 10000 kopeks, show “Low balance” badge and highlight Top up CTA.
- History page:
  - Uses unified timeline; filters are reflected in URL `?filter=all|paid|free|topups`.
  - Invalid/missing filter defaults to `all` without error.
- Plans page:
  - Keep admin-only access, but align header semantics and add concise helper copy.
- `/billing/settings` and `/billing/dashboard` continue redirecting to `/billing/balance`.

Edge cases / failures:
- Balance API error → show retry state; other sections hidden.
- Lead magnet disabled → hide the free limits card entirely.
- Lead magnet enabled but zero quotas → show “No free limits configured”.
- Auto-topup failed 3+ times → show existing warning and keep toggle off.
- Daily cap not set → show “Not set” and hide progress.
- Timeline empty → show empty state copy.

Concurrency/idempotency:
- N/A (frontend-only; existing backend behavior unchanged).

## Decisions (and why)
- Collapsible advanced settings (rarely used): reduces clutter for the majority who only top up; auto-expand prevents hiding active settings.
- Low-balance threshold fixed at 100 RUB: explicit requirement and simple, deterministic state.
- Separate Save actions remain: avoids partial failures across unrelated endpoints.

Alternatives rejected:
- Separate settings page: keeps navigation friction and hides core actions.
- Combined “Save all” button: increases error coupling and UX complexity.

## Design
Flow/components:
- Wallet hero (new or refactored section):
  - Title, subtitle, total balance, breakdown (wallet/plan), low-balance badge when < 100 RUB.
  - Primary CTA: “Top up”. Secondary CTA: “View history”.
- Quick top-up section: reuse `WalletTopupSection` but place directly after hero.
- Free limits: reuse `WalletLeadMagnetSection` with current model list behavior.
- Advanced settings accordion (new wrapper component recommended):
  - Contains `WalletAutoTopupSection`, `WalletSpendControls`, `WalletContactsSection`.
  - Toggle text: “Manage limits & auto-topup”.
  - Use existing `src/lib/components/common/Collapsible.svelte` (or local state + button) to avoid new deps; ensure accessible toggle.
- History page:
  - `UnifiedTimeline` with filter chips; filter state synced to URL.
- Plans page:
  - Header uses `<h1>` and short helper text; grid unchanged.

Contracts (if any): API / events + examples
- Existing endpoints only:
  - GET `/api/v1/billing/balance`
  - GET `/api/v1/billing/lead-magnet`
  - GET `/api/v1/billing/ledger?limit&skip`
  - GET `/api/v1/billing/usage-events?limit&skip`
  - POST `/api/v1/billing/auto-topup`
  - POST `/api/v1/billing/settings`
  - GET `/api/v1/users/me`
- Analytics: use `trackEvent` from `src/lib/utils/analytics.ts`.
  - `billing_wallet_view` (on page load after balance attempt) { status: 'success' | 'error' }
  - `billing_wallet_topup_package_click` (on package click) { amount_kopeks }
  - `billing_wallet_topup_custom_submit` (on valid custom submit) { amount_kopeks }
  - `billing_wallet_advanced_toggle` (on toggle) { open: boolean }
  - `billing_wallet_auto_topup_save` (on successful save) { enabled, threshold_kopeks, amount_kopeks }
  - `billing_wallet_limits_save` (on successful save) { max_reply_cost_kopeks, daily_cap_kopeks }
  - `billing_wallet_contacts_save` (on successful save) { has_email: boolean, has_phone: boolean }
  - `billing_wallet_history_click` (on “View history” CTA)
  - `billing_history_view` (on page load) { filter }
  - `billing_history_filter_change` (on user filter click) { filter }
  - `billing_plans_view` (on page load) { status: 'loaded' | 'empty' | 'unauthorized' }

Data (if any): schema + migrations + compatibility
- N/A (frontend-only).

Security/validation/logging rules:
- Keep numeric parsing/validation behavior for money inputs.
- Do not log secrets; analytics payloads must avoid PII beyond booleans/numbers.
- Preserve existing error toasts and HTTP error handling.

Copy (EN/RU):
- Low balance badge: `Low balance` / `Низкий баланс`
- Low balance helper (optional, under badge): `Top up to keep working` / `Пополните, чтобы продолжить работу`
- Wallet hero subtitle (if changed): `Top up and control spending` / `Пополняйте баланс и контролируйте расходы`
- Advanced toggle label: `Manage limits & auto-topup` / `Лимиты и автопополнение`
- Advanced toggle helper (small text): `Rarely used settings` / `Редко используемые настройки`
- Advanced toggle collapsed CTA (optional): `Show settings` / `Показать настройки`
- Hero secondary CTA: `View history` / `История`
- History subtitle: `All activity in one place` / `Вся активность в одном месте`
- Loading verbs with ellipsis: `Loading…`, `Saving…`, `Processing…` / `Загрузка…`, `Сохранение…`, `Обработка…`

## Implementation Plan (ordered checklist)
1. Update wallet page layout to new section order and hero/CTA hierarchy.
2. Implement advanced settings collapse behavior (auto-expand when configured).
3. Add low-balance state based on total balance < 10000 kopeks.
4. Update History page to sync filter state with URL query param.
5. Align headers on Wallet/History/Plans to `<h1>` with helper subtitle copy.
6. Add analytics event tracking for wallet/history/plans actions.
7. Add accessibility/form improvements (labels, name/autocomplete, loading ellipsis) in billing components.
8. Update i18n strings (en/ru) for new labels and states.
9. Address pre-existing `npm run check` failures (TypeScript/svelte-check) or log a follow-up task if out of scope for this change.

Parallel:
- Analytics wiring can be implemented alongside UI changes.
- History URL sync can be done independently of wallet layout.

Strict order:
- Wallet layout + advanced collapse before analytics (ensures correct events/targets).

## Affected Files
- CREATE: `src/lib/components/billing/WalletAdvancedSettings.svelte` — collapsed advanced container for auto-topup/limits/contacts.
- UPDATE: `src/routes/(app)/billing/balance/+page.svelte` — reorder sections, hero + low-balance state, analytics hooks.
- UPDATE: `src/routes/(app)/billing/history/+page.svelte` — URL-synced filters, header semantics, analytics.
- UPDATE: `src/routes/(app)/billing/plans/+page.svelte` — header semantics, analytics.
- UPDATE: `src/routes/(app)/billing/+layout.svelte` — ensure consistent nav label focus if needed.
- UPDATE: `src/lib/components/billing/WalletTopupSection.svelte` — analytics hooks + form a11y.
- UPDATE: `src/lib/components/billing/WalletAutoTopupSection.svelte` — a11y, labels, loading ellipsis.
- UPDATE: `src/lib/components/billing/WalletSpendControls.svelte` — a11y, loading ellipsis, daily cap helper.
- UPDATE: `src/lib/components/billing/WalletContactsSection.svelte` — a11y, loading ellipsis.
- UPDATE: `src/lib/components/billing/UnifiedTimeline.svelte` — optional external filter control/URL sync support.
- UPDATE: `src/lib/i18n/locales/en-US/translation.json` — new copy.
- UPDATE: `src/lib/i18n/locales/ru-RU/translation.json` — new copy.

## Testing / Acceptance
Tests: manual UI validation; optional `npm run test:frontend`.
Acceptance criteria (DoD):
- [ ] Wallet opens with balance hero and a clear Top up CTA above the fold (desktop + mobile).
- [ ] Low-balance badge appears when total balance < 100 RUB.
- [ ] Quick top-up packages and custom amount still work and redirect to payment.
- [ ] Advanced settings are collapsed by default and auto-expand when any advanced setting is already set.
- [ ] Auto-topup, limits, and contacts can be saved independently (existing API calls preserved).
- [ ] Lead magnet card appears only when enabled and shows reset date + models list toggle.
- [ ] Latest activity preview shows last 6 items and links to History.
- [ ] History filters update URL query param and rehydrate correctly on reload.
- [ ] Billing headers (Wallet/History/Plans) use `<h1>` semantics and consistent subtitle styling.
- [ ] Analytics events fire for wallet view, topup actions, advanced toggle, history filter change, and plans view.
- [ ] `npm run check` passes or a follow-up task is recorded for the existing TypeScript/svelte-check errors (see Risks).

## Rollout / Rollback (if prod)
Rollout:
- Frontend deploy only.
Rollback:
- Revert billing UI changes; no data migrations required.

## Observability
- Logs: N/A.
- Metrics: analytics events listed above.
- Alerts: N/A.

## Risks / Open Questions / TBD
Risks:
- Collapsed advanced settings may reduce discoverability; mitigated by auto-expansion when configured and clear toggle.
- Low-balance threshold fixed at 100 RUB may be too low; adjust if needed based on analytics.
- `npm run check` currently fails due to pre-existing TypeScript/svelte-check errors (not introduced by this change). Known hotspots: `src/lib/utils/marked/katex-extension.ts`, `src/lib/utils/index.ts`, `src/lib/components/admin/Settings/Connections.svelte` (full list in latest `npm run check` output).
Open questions:
- TBD: None.

## Quick start
1. Start files/modules: `src/routes/(app)/billing/balance/+page.svelte`, `src/lib/components/billing/UnifiedTimeline.svelte`.
2. Commands: `npm run check` (optional), `npm run test:frontend` (optional).
3. Local setup: standard frontend dev server.
4. Manual verification: wallet load, topup flow, advanced toggle, limits save, history filters.
