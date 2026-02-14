# Prelaunch Global Code Review and Confidence Pipeline

## Meta

- Type: docs
- Status: done
- Owner: Codex
- Branch: HEAD (no branch)
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-11
- Updated: 2026-02-11

## Context

Before first broad user rollout, team requested a global quality audit with focus on billing/payments reliability because manual payment checks previously failed while tests looked green.

## Goal / Acceptance Criteria

- [x] Run and review backend/frontend/e2e billing-related tests.
- [x] Identify concrete gaps between current tests and real user flows.
- [x] Produce prioritized findings with file references.
- [x] Propose a practical end-to-end confidence pipeline for release gating.

## Non-goals

- No production code changes in this task.
- No CI workflow edits in this task.

## Scope (what changes)

- Backend:
  - Test execution and coverage audit for billing routers/services.
- Frontend:
  - Test execution audit for billing page/components and quality gates.
- Config/Env:
  - Review of current CI workflow coverage and disabled jobs.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `backend/open_webui/routers/billing.py`
  - `backend/open_webui/utils/billing.py`
  - `backend/open_webui/utils/yookassa.py`
  - `src/routes/(app)/billing/balance/+page.svelte`
  - `e2e/billing_wallet_recovery.spec.ts`
  - `.github/workflows/*.y*ml` and `*.disabled`
- API changes:
  - None.
- Edge cases:
  - E2E flow for low-balance with free-limit branch depends on model metadata availability.

## Upstream impact

- Upstream-owned files touched:
  - None.
- Why unavoidable:
  - N/A
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - N/A

## Verification

Executed commands (selected):

- Backend billing tests:
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_billing_topup.py open_webui/test/apps/webui/routers/test_billing_subscription.py open_webui/test/apps/webui/routers/test_billing_subscription_webhook.py"` (pass)
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm -e DATABASE_URL= airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_openai_chat_billing.py open_webui/test/apps/webui/routers/test_openai_chat_billing_lead_magnet.py open_webui/test/apps/webui/routers/test_openai_chat_billing_streaming.py open_webui/test/apps/webui/routers/test_billing_lead_magnet.py open_webui/test/apps/webui/routers/test_images_billing.py open_webui/test/apps/webui/routers/test_openai_speech_billing.py open_webui/test/apps/webui/routers/test_audio_billing.py"` (pass)
  - `docker exec airis bash -lc "cd /app/backend && python -m pip install -q pytest-cov && pytest -q --maxfail=1 --disable-warnings --cov=open_webui.routers.billing --cov=open_webui.utils.billing --cov-report=term-missing:skip-covered open_webui/test/apps/webui/routers/test_billing_topup.py open_webui/test/apps/webui/routers/test_billing_subscription.py open_webui/test/apps/webui/routers/test_billing_subscription_webhook.py"` (pass; coverage report captured)
- Frontend:
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/vitest ]; then npm ci --legacy-peer-deps; fi; npm run test:frontend -- --run"` (pass)
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/svelte-check ]; then npm ci --legacy-peer-deps; fi; npm run check"` (fails with large baseline debt)
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps pytools "python -m pip install -U pip >/dev/null && python -m pip install -q 'ruff>=0.1' && ruff check backend"` (fails with large baseline debt)
- E2E:
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml up -d --build airis-e2e` (ok)
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps e2e "npm ci && npm run test:e2e -- e2e/billing_wallet.spec.ts e2e/billing_wallet_recovery.spec.ts e2e/billing_lead_magnet.spec.ts"` (1 failure in recovery scenario)

## Task Entry (for branch_updates/current_tasks)

- [x] **[DOCS][REVIEW][PRELAUNCH]** Global billing confidence audit and release pipeline
  - Spec: `meta/memory_bank/specs/work_items/2026-02-11__docs__prelaunch-global-code-review-confidence-pipeline.md`
  - Owner: Codex
  - Branch: `HEAD (no branch)`
  - Done: 2026-02-11
  - Summary: Audited billing code/tests, reproduced e2e mismatch, collected backend coverage and CI gate gaps, and prepared confidence pipeline recommendations.
  - Tests: See Verification section.
  - Risks: Medium (billing launch confidence depends on closing identified test and gate gaps).

## Risks / Rollback

- Risks:
  - False confidence remains if e2e/payment provider boundary checks stay partial.
  - Disabled/non-blocking lint/type gates allow regressions into release branches.
- Rollback plan:
  - N/A (docs-only task).
