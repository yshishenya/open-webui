# Branch Updates — feature/billing-balance-topup-presets

## Done

- [x] **[UI][BILLING]** Update wallet top-up presets to 100/500/1000/2000 RUB
  - Spec: `meta/memory_bank/specs/work_items/2026-03-05__feature__billing-balance-topup-presets.md`
  - Owner: Codex
  - Branch: `feature/billing-balance-topup-presets`
  - Done: 2026-03-05
  - Summary: Aligned backend/public-config defaults and `/billing/balance` fallback presets to `100/500/1000/2000` RUB.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/vitest ]; then npm ci --legacy-peer-deps; fi; npm run test:frontend -- --run 'src/routes/(app)/billing/balance/billing-balance.test.ts' 'src/lib/utils/airis/billing_return_url.test.ts' 'src/lib/utils/airis/return_to.test.ts'"`, `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_billing_topup.py open_webui/test/apps/webui/routers/test_billing_public_pricing.py open_webui/test/apps/webui/routers/test_billing_core_paths.py"`
  - Risks: Low (configuration/value-only change)

- [x] **[CONFIG][UI]** Wire and document `ENABLE_PUBLIC_ACTIVE_USERS_COUNT`
  - Spec: `meta/memory_bank/specs/work_items/2026-03-05__feature__active-users-count-flag-wiring.md`
  - Owner: Codex
  - Branch: `feature/billing-balance-topup-presets`
  - Done: 2026-03-05
  - Summary: Added env templates + compose passthrough + backend comments for "Active Users" visibility flag and set local `.env` value to disable public visibility.
  - Tests: `docker compose -f docker-compose.yaml config >/tmp/docker-compose.resolved.yaml`, `python -c "import ast, pathlib; [ast.parse(pathlib.Path(p).read_text()) for p in ['backend/open_webui/env.py','backend/open_webui/main.py']]; print('OK')"`, `rg -n "ENABLE_PUBLIC_ACTIVE_USERS_COUNT" .env .env.example .env.etalon .env.etalon.example docker-compose.yaml backend/open_webui/env.py backend/open_webui/main.py`
  - Risks: Low (config/docs-only; admins still see counter by design)
