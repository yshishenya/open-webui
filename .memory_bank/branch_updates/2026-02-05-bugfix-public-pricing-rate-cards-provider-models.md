# Branch Updates: bugfix/public-pricing-rate-cards-provider-models

- [x] **[BUG]** Landing pricing: show rate cards for provider-only models
  - Spec: `.memory_bank/specs/work_items/2026-02-05__bugfix__public-pricing-rate-cards-provider-models.md`
  - Owner: Codex
  - Branch: `bugfix/public-pricing-rate-cards-provider-models`
  - Done: 2026-02-05
  - Summary: Public `/billing/public/rate-cards` merges provider base models with workspace overrides so `/pricing`
    shows prices.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_billing_public_pricing.py"`
  - Risks: Low (provider model fetch adds some work; failures degrade gracefully).

