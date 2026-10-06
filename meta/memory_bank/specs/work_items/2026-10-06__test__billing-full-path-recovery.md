# Billing recovery through the real application

Status: Done (implementation verified; PR integration acceptance separate)
Workflow: code_review; use bug_fix only for a reproduced application defect.
Owner: Codex
Branch: `codex/test/billing-full-path-recovery`
SDD Spec: meta/sdd/specs/completed/airis-billing-full-path-recovery-2026-10-06-001.json

## Goal and measurable acceptance

Prove plan item 10.10 through the compiled AIRIS interface, real application
routers, PostgreSQL persistence and durable mail worker. Only the external
payment and SMTP protocols are disposable local substitutes.

- [x] Pending, canceled, provider mismatch and failed provider lookup give
      exactly 0 credited kopeks, 0 credit ledger entries and 0 credited messages.
- [x] Closing checkout before return still permits verified server notification
      to credit exactly 50000 kopeks with exactly one ledger entry.
- [x] Repeated notifications and concurrent reconciliations add 0 kopeks,
      0 ledger entries and 0 mail jobs beyond that first credit.
- [x] Failed provider lookup on return recovers through the existing interface;
      history shows exactly one RUB 500.00 credit after confirmation.
- [x] SMTP temporary refusal preserves the committed 50000 kopeks and one
      durable retry; repeated drains before due time do not attempt delivery.
      Recovery uses the same Message-ID and accepts exactly one message.
- [x] Both Chromium and Firefox at 390 px pass new scenarios plus existing
      guide, quota, editor/sidebar and checkout regressions, with 0 page errors.
- [x] Exact source reviewed and pushed; no app runtime or production change
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

## Results

SQLite 24/24 and PostgreSQL 24/24 passed in Chromium and Firefox at 390 px,
with zero skips and page errors. New recovery scenarios are 8 checks per
engine; 16 existing guide/quota/checkout checks also pass per engine.
Exact test-file hashes matched for both runs. PostgreSQL migrated to the
existing `o1a020261003` revision, without application/schema changes.

Temporary refusal leaves one first retry at due_at = updated_at + 300;
repeated early drain changes nothing. Explicit fixture scheduling permits
one later acceptance with the original Message-ID and attempt count 2;
accepted-job scheduling is rejected with 409. Forged callback amount/currency
and ownership do not replace authoritative provider facts.

Changed E2E TypeScript, ESLint and Prettier pass; wrapper Black/Ruff and SDD
schema pass. `npm run preflight` is absent from this repository; scoped
commands replace that unavailable entry point. Full frontend G14 baseline
is separate and remains open. Rejected diagnostics were fixture IP mismatch,
confusion of internal payment ID with provider ID, and shared module hooks;
all corrected inside tests, with final full clean runs above.

## Reproduce

Use the existing `e2e/onboarding-paths.config.ts` for both engines. Start the
compiled image with `.codex/docker-compose.onboarding-paths.yaml`, run its
`e2e` service with `npx playwright test --config e2e/onboarding-paths.config.ts`,
and stop only the owned app afterwards. For PostgreSQL, add
`.codex/docker-compose.onboarding-paths-postgres.yaml` to the same Compose
commands; the database is isolated, uses tmpfs, and publishes no host port.
Run engines sequentially if they share a network, avoiding two active
`onboarding-paths` DNS aliases. Set `ONBOARDING_WEBHOOK_ALLOWED_IP_RANGES`
to the actual disposable network CIDR plus `127.0.0.1/32` when its subnet
is outside the default 172.16.0.0/12 range. This is fixture configuration
only; token, source and custom HMAC checks remain enabled. This HMAC is an
application/proxy guard, not a claim that YooKassa provides such a signature.
