# Billing: Scenario-based end-to-end tests (wallet PAYG + topup + lead magnet)

## Meta

- Type: feature
- Status: done
- Owner: Codex
- Branch: `codex/feature/billing-scenarios-e2e-tests`
- Created: 2026-02-05
- Updated: 2026-02-05

## Context

We need high-confidence automated coverage that the billing system:

- correctly places **holds**, **settles** charges, and writes **usage events**
- correctly blocks requests when funds are insufficient or limits are exceeded
- behaves correctly when balance hits **zero** and after a **top-up** becomes available again
- supports **lead magnet** flows (free quotas) without charging wallet funds

The goal is not to test every combination, but to cover the full **state machine** and all **failure modes** with a minimal deterministic matrix.

## Goal / Acceptance Criteria

- [x] Add scenario-matrix integration tests that validate wallet balance transitions, ledger entries, and usage events for text (OpenAI-compatible chat completions).
- [x] Cover “insufficient funds → top-up → success” for wallet PAYG.
- [x] Cover lead magnet allowed/denied behavior for text requests.
- [x] Cover streaming and “usage missing” (estimated charge) behavior.
- [x] Add **one** Playwright UI smoke: wallet/topup wiring + lead magnet section visibility (mocked API only).
- [x] Keep tests deterministic (no real external network, no real YooKassa calls).

## Non-goals

- Full combinatorial “all flags x all caps x all modalities” explosion.
- Subscription mode (`ENABLE_BILLING_SUBSCRIPTIONS`) coverage (explicitly out of scope).
- UI-heavy coverage beyond minimal high-value flows (backend integration tests are the primary confidence layer).

## Scope (what changes)

- Backend:
  - Add new backend integration tests for `/openai/chat/completions` billing behavior (PAYG + lead magnet).
  - Add test helpers for faking OpenAI-compatible provider responses (JSON and SSE).
- Frontend:
  - One minimal Playwright scenario to ensure UX wiring for “no funds → top up” + lead magnet visibility doesn’t regress.
- Config/Env:
  - None (tests will monkeypatch feature flags and config vars).
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - Billing state transitions:
    - `backend/open_webui/utils/billing_integration.py` (`preflight_estimate_hold`, `track_*`, `settle_billing_usage`)
    - `backend/open_webui/utils/wallet.py` (`hold_funds`, `settle_hold`, `apply_topup`)
  - API entrypoint:
    - `backend/open_webui/routers/openai.py` (`/openai/chat/completions`)
- Test strategy:
  - Prefer backend integration tests (FastAPI TestClient + real DB reset) as the “truth layer”.
  - Validate invariants via DB queries for `Wallet`, `LedgerEntry`, `UsageEvent`.
  - Fake external provider (`aiohttp.ClientSession`) to return:
    - non-streaming JSON response with `usage` (normal settle)
    - streaming SSE with final chunk containing `usage` (streaming settle)
    - error responses / exceptions (release hold)
- Scenario matrix (minimal state-machine coverage):
  - PAYG success (hold > 0, settle, correct balances)
  - PAYG insufficient funds (402)
  - PAYG max reply cost exceeded (402, specific error payload)
  - PAYG daily cap exceeded (429, specific error payload)
  - Provider error after hold (release occurs, balance restored)
  - Streaming with usage (settle occurs)
  - Streaming without usage (estimated charge, `estimate_reason=usage_missing`)
  - Lead magnet allowed (no hold/charge, usage event with `billing_source=lead_magnet`, wallet unchanged)
  - Lead magnet denied then PAYG (normal hold/charge)
  - Balance depleted → top-up applied → success

## Upstream impact

- Upstream-owned files touched:
  - None expected (additive tests + test helpers).
- Why unavoidable:
  - N/A
- Minimization strategy:
  - Keep changes additive under `backend/open_webui/test/...` and `e2e/...` only.

## Verification

- Backend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q backend/open_webui/test/apps/webui/routers/test_openai_chat_billing.py"`
- Full backend suite (optional before merge): `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest"`
- E2E (only if Phase UI is implemented): `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps e2e "npm ci && npm run test:e2e"`

**Executed (2026-02-05):**

- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run -T --rm -e DATABASE_URL= airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_openai_chat_billing.py open_webui/test/apps/webui/routers/test_openai_chat_billing_lead_magnet.py open_webui/test/apps/webui/routers/test_openai_chat_billing_streaming.py"`
- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml up -d airis-e2e`
- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps e2e "npm ci && npm run test:e2e -- e2e/billing_wallet_recovery.spec.ts"`

**Planned (UI smoke):**

- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps e2e "npm ci && npm run test:e2e -- --grep billing wallet recovery"`

## Task Entry (for branch_updates/current_tasks)

- [x] **[BILLING][TEST]** Scenario-based billing E2E tests (wallet PAYG + topup + lead magnet)
  - Spec: `meta/memory_bank/specs/work_items/2026-02-05__feature__billing-scenarios-e2e-tests.md`
  - Owner: Codex
  - Branch: `codex/feature/billing-scenarios-e2e-tests`
  - Started: 2026-02-05
  - Done: 2026-02-05
  - Summary: Add deterministic integration tests covering holds/charges/releases, insufficient funds, lead magnet, top-up recovery, and streaming usage.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run -T --rm -e DATABASE_URL= airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_openai_chat_billing.py open_webui/test/apps/webui/routers/test_openai_chat_billing_lead_magnet.py open_webui/test/apps/webui/routers/test_openai_chat_billing_streaming.py"`
  - Risks: Medium (mocks for OpenAI router; guard against brittle coupling to OpenAI router internals)

## Risks / Rollback

- Risks:
  - Router mocking can become brittle if OpenAI router logic changes; mitigate by centralizing fakes in a helper module and asserting on stable DB invariants.
- Rollback plan:
  - Revert added test files/helpers; production code remains untouched.
