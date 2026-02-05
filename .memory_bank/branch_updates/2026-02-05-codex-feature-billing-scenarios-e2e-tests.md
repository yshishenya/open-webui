# Branch updates: codex-feature-billing-scenarios-e2e-tests

- [x] **[BILLING][TEST]** Scenario-based billing E2E tests (wallet PAYG + topup + lead magnet)
  - Spec: `.memory_bank/specs/work_items/2026-02-05__feature__billing-scenarios-e2e-tests.md`
  - Owner: Codex
  - Branch: `codex/feature/billing-scenarios-e2e-tests`
  - Started: 2026-02-05
  - Done: 2026-02-05
  - Summary: Add deterministic integration tests covering holds/charges/releases, insufficient funds, lead magnet, top-up recovery, and streaming usage.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run -T --rm -e DATABASE_URL= airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_openai_chat_billing.py open_webui/test/apps/webui/routers/test_openai_chat_billing_lead_magnet.py open_webui/test/apps/webui/routers/test_openai_chat_billing_streaming.py"`, `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml up -d airis-e2e`, `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps e2e "npm run test:e2e -- e2e/billing_wallet_recovery.spec.ts"`
  - Risks: Medium (mocks for OpenAI router; guard against brittle coupling to OpenAI router internals)
