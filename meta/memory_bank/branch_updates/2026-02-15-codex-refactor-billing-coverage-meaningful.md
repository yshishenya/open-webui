### Done

- [x] **[REFACTOR][BILLING][TESTS]** Billing coverage gate >=85% with meaningful assertions
  - Spec: `meta/memory_bank/specs/work_items/2026-02-15__refactor__billing-coverage-meaningful-85.md`
  - Owner: codex (gpt-5.3-codex)
  - Branch: `codex/refactor/billing-coverage-meaningful`
  - Done: 2026-02-15
  - Summary: Add behavior-level tests to raise/secure billing module coverage without shallow line-hits.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "python -m pip install -q aiosmtplib email-validator pytest-asyncio && pytest -q open_webui/test/apps/webui/routers/test_billing_router_helpers.py open_webui/test/apps/webui/routers/test_billing_router_additional_paths.py"`, targeted billing coverage run (gate PASS)
  - Risks: Low-Medium (CI-only failures if tests are brittle; mitigate via API-level assertions).
