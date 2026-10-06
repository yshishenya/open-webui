# Billing recovery through the real application

Status: Active
Workflow: code_review; use bug_fix only for a reproduced application defect.
Owner: Codex
Branch: `codex/test/billing-full-path-recovery`
SDD Spec: meta/sdd/specs/active/airis-billing-full-path-recovery-2026-10-06-001.json

## Goal and measurable acceptance

Prove plan item 10.10 through the compiled AIRIS interface, real application
routers, PostgreSQL persistence and durable mail worker. Only the external
payment and SMTP protocols are disposable local substitutes.

- [ ] Pending, canceled, provider mismatch and failed provider lookup give
      exactly 0 credited kopeks, 0 credit ledger entries and 0 credited messages.
- [ ] Closing checkout before return still permits verified server notification
      to credit exactly 50000 kopeks with exactly one ledger entry.
- [ ] Repeated notifications and concurrent reconciliations add 0 kopeks,
      0 ledger entries and 0 mail jobs beyond that first credit.
- [ ] Failed provider lookup on return recovers through the existing interface;
      history shows exactly one RUB 500.00 credit after confirmation.
- [ ] SMTP temporary refusal preserves the committed 50000 kopeks and one
      durable retry; repeated drains before due time do not attempt delivery.
      Recovery uses the same Message-ID and accepts exactly one message.
- [ ] Both Chromium and Firefox at 390 px pass new scenarios plus existing
      guide, quota, editor/sidebar and checkout regressions, with 0 page errors.
- [ ] Exact source reviewed and pushed; no app runtime or production change
      unless a real defect is reproduced. Documentation records evidence limits.

## Implementation

Reuse the existing guarded `onboarding_paths.py` ASGI wrapper, account helpers,
compiled production image and existing Playwright dependency. Keep all fault
controls inside test files. Use an optional isolated PostgreSQL 16 Compose
override, with no published ports and tmpfs storage. Require fixture-only
webhook token, custom HMAC and source checks. Do not modify production guards.

The SMTP recovery test first verifies the real 300-second retry interval. It
then explicitly moves only its own proven-unsent first retry's due_at to now
through a guarded test endpoint; no global clock replacement, no modification
of attempts/status/Message-ID and no claim of elapsed real time.

## Boundaries and upstream impact

All changes are fork-owned tests, test Compose and task documents. Reuse the
pinned Playwright/browser image pairing; no dependency introduction or upgrade.
These results do not prove real YooKassa settlement/receipt, external Inbox,
operator replies, physical phone behavior or voluntary 24h/72h/14d pilot.
Private plan and correspondence stay outside Git. G10 and G14–G16 remain open
until their separate acceptance conditions are satisfied.

## Verification

Run the isolated two-browser suite against SQLite and PostgreSQL; verify
changed-file lint/format, schema and public document links. Review queue facts
before and after fault/recovery. Preserve traces of rejected diagnostic runs.
Record exact source, image identity and production read-only state separately.
