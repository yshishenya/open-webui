# PAYG Default + Lead Magnet Policy

Status: approved requirements (no implementation yet)

## Goals
- PAYG is the default billing mode for all users (no subscription on signup).
- Lead magnet grants free access to a curated set of models with quotas.
- Lead magnet quotas reset every X days (configurable). X can be 30 for monthly.
- If lead magnet quotas are exhausted, allow PAYG fallback on the same models.
- Admin can configure quotas, cycle length, and the allowed model list.
- Lead magnet applies to both existing and new users, and stays active indefinitely.
- Provide clear conversion nudges when quotas are nearly exhausted.

## Non-Goals
- This spec does not define subscription plans or pricing model changes.
- This spec does not implement UI or backend changes.

## Definitions
- PAYG: pay-as-you-go wallet mode using holds/settles. UI label: "Кошелёк".
- Lead magnet: free usage bucket with quotas that resets on a cycle.
- Quota cycle: a rolling period of X days with independent usage counters.
- Lead-magnet model: a model explicitly flagged as free/lead-magnet in admin.

## Admin Configuration (UI + persistent config)
Required admin settings:
- lead_magnet.enabled (bool)
- lead_magnet.cycle_days (int, X days)
- lead_magnet.quotas:
  - tokens_input
  - tokens_output
  - images
  - tts_seconds
  - stt_seconds
- lead_magnet.model_allowlist (derived from model flags in admin UI)

Admin model editor:
- Add a checkbox/flag: "Lead magnet (free)".
- Only flagged models can consume lead-magnet quotas.

## User State
Store per-user lead-magnet state (user settings or a dedicated table):
- lead_magnet_cycle_start (epoch seconds)
- lead_magnet_cycle_end (epoch seconds)
- lead_magnet_usage:
  - tokens_input
  - tokens_output
  - images
  - tts_seconds
  - stt_seconds

## Quota Cycle Rules
- Cycle starts on first eligible request to a lead-magnet model.
- If now >= cycle_end, reset usage to zero and start a new cycle:
  - cycle_start = now
  - cycle_end = now + cycle_days * 86400
- Remaining quota = max_quota - usage (clamped at 0).
- No hard cap on number of cycles; cycles repeat forever.

## Admin Changes (Immediate Recalculation)
When admin changes quotas or cycle_days:
- Recalculate immediately for all users with lead-magnet state.
- Update cycle_end = cycle_start + cycle_days * 86400.
- If new cycle_end <= now, roll to a new cycle and reset usage to 0.
- Update max quotas; if used > new max, remaining becomes 0.

## Runtime Decision Flow (per request)
1) Determine model_id (or engine model) for the request.
2) Check if model is flagged as lead-magnet:
   - If no, use PAYG wallet flow.
3) Ensure cycle is initialized and valid (reset if needed).
4) If remaining quota for the relevant metric > 0:
   - Allow request for free.
   - Increment lead_magnet_usage for that metric.
   - Record billing_source = "lead_magnet".
5) If remaining quota is 0:
   - Fallback to PAYG wallet:
     - If wallet has funds, proceed with hold/settle.
     - If insufficient funds, block and show top-up CTA.
   - Record billing_source = "payg".

Lead magnet eligibility:
- Applies to all users (existing and new) without a separate enrollment step.
- Remains active even after top-ups or other payments.

## Metric Mapping
- Chat completions:
  - tokens_input and tokens_output.
- Image generation:
  - images (count).
- TTS:
  - tts_seconds (derived from output length or provider usage).
- STT:
  - stt_seconds (derived from audio duration).

## UI/UX Requirements
- Billing page shows:
  - Lead magnet remaining quotas + next reset time.
  - Wallet balance ("Кошелёк", internal PAYG).
- Model list shows "Free (lead magnet)" badge for flagged models.
- On quota exhaustion with zero balance:
  - Show top-up modal or CTA with clear messaging.
- Show simple approximations where possible (e.g., "approx. messages" or "approx. minutes").
- Soft conversion nudges:
  - Notify at 70% and 90% quota usage.
  - Offer a small starter top-up package.
- Copy guidelines:
  - "Кошелёк" (section title)
  - "Оплата по факту через кошелёк" (subtitle/tooltip)
  - "Пополнить кошелёк" (primary CTA)

## Analytics and Logging
- Tag usage events with billing_source = lead_magnet | payg.
- Track "shadow cost" for lead-magnet requests for reporting.

## Compatibility Notes
- If subscriptions exist in future:
  - Subscription quotas take precedence over lead-magnet.
  - PAYG still acts as fallback for overages if allowed by policy.
