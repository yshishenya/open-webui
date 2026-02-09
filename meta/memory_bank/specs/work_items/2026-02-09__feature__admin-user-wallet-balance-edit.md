# Admin UI: редактирование баланса пользователя

## Meta

- Type: feature
- Status: done
- Owner: Codex
- Branch: airis_b2c
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/admin-wallet-balance-edit-2026-02-09-001.json`
- Created: 2026-02-09
- Updated: 2026-02-09

## Context

Сейчас администратор может менять подписку пользователя, но не может корректировать баланс кошелька из админки.
В результате ручные корректировки (компенсации, бонусы, исправления ошибок) требуют обходных сценариев и не имеют
прозрачного операционного интерфейса.

## Goal / Acceptance Criteria

- [x] Админ видит текущий wallet-баланс пользователя в модале редактирования пользователя.
- [x] Админ может выполнить корректировку баланса (дельтой) для topup и/или included части.
- [x] Каждая корректировка проходит через ledger и оставляет audit trail (кто, что, почему, до/после).
- [x] API корректировки доступен только админам и валидирует входные данные (reason, non-zero delta, user existence).
- [x] Добавлены backend/frontend тесты на критичные пути и ошибки.

## Non-goals

- Реализация массовых корректировок баланса по списку пользователей.
- Отдельная страница аналитики кошелька в админке.
- Изменение базовой модели тарификации/списания (hold/settle flow).

## Scope (what changes)

- Backend:
  - Новые admin endpoints для чтения кошелька пользователя и корректировки баланса.
  - Новая операция в `wallet_service` для корректировки баланса через `LedgerEntryType.ADJUSTMENT`.
  - Аудит действий администратора для wallet adjust.
- Frontend:
  - Раздел wallet в `EditUserModal` (текущие остатки + форма корректировки + reason).
  - API-клиент для новых admin billing endpoints.
- Config/Env:
  - Без новых env переменных (используются существующие billing flags).
- Data model / migrations:
  - Миграции не требуются (используются существующие таблицы wallet/ledger/audit).

## Implementation Notes

- Key files/entrypoints:
  - `backend/open_webui/routers/admin_billing.py`
  - `backend/open_webui/utils/wallet.py`
  - `backend/open_webui/models/audit.py`
  - `src/lib/apis/admin/billing.ts`
  - `src/lib/components/admin/Users/UserList/EditUserModal.svelte`
- API changes:
  - `GET /api/v1/admin/billing/users/{user_id}/wallet`
  - `POST /api/v1/admin/billing/users/{user_id}/wallet/adjust`
- Edge cases:
  - Нулевая корректировка (оба delta = 0) запрещена.
  - Пустой `reason` запрещен.
  - Повторный запрос с тем же `idempotency_key` должен быть идемпотентным.
  - Поведение при недостатке/отрицательных остатках фиксируется как явное бизнес-правило в реализации.

## Upstream impact

If this work touches upstream-owned files, list them here and explain why (and how the diff is minimized):

- Upstream-owned files touched:
  - `backend/open_webui/utils/wallet.py` (если классифицируется как upstream-owned в конкретной синхронизации)
- Why unavoidable:
  - Корректировка баланса должна использовать единый доменный wallet flow с блокировкой строки и ledger entry.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Основные API изменения в fork-owned `admin_billing.py`.
  - Локализованные изменения в wallet service без реорганизации существующего кода.
  - Без рефакторингов вне области задачи.

## Verification

Docker Compose-first commands (adjust if needed):

- Backend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_admin_billing_wallet_adjust.py open_webui/test/apps/webui/utils/test_wallet_service.py"`
- Backend lint (ruff): `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps pytools "python -m pip install -U pip >/dev/null && python -m pip install -q 'ruff>=0.1' && ruff check backend/open_webui/routers/admin_billing.py backend/open_webui/utils/wallet.py backend/open_webui/models/audit.py"`
- Frontend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run src/lib/components/admin/Users/UserList/EditUserModal.svelte src/lib/apis/admin/billing.ts"`
- Frontend typecheck: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run check"`
- Frontend lint: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run lint:frontend"`
- E2E (when relevant): `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps e2e "npm ci && npm run test:e2e -- e2e/billing_wallet.spec.ts"`

Execution result (2026-02-09):

- ✅ Backend: `pytest -q open_webui/test/apps/webui/routers/test_admin_billing_wallet_adjust.py` (6 passed), `pytest -q open_webui/test/apps/webui/utils/test_wallet_service.py::TestWalletService::test_adjust_balances_*` (3 passed), `pytest -q open_webui/test/apps/webui/routers/test_billing_subscription.py` (1 passed)
- ✅ Backend lint: `ruff check` for touched backend files passed
- ✅ Frontend: `vitest --run src/lib/utils/airis/admin_billing_user_wallet.test.ts` (5 passed), targeted eslint for touched frontend files passed
- ⚠️ Frontend global `npm run check` currently fails on large pre-existing baseline TS/Svelte issues unrelated to this work item

## Task Entry (for branch_updates/current_tasks)

Use this snippet in `meta/memory_bank/branch_updates/<YYYY-MM-DD>-<branch-slug>.md` and later in `meta/memory_bank/current_tasks.md`:

- [x] **[UI][BILLING][ADMIN]** Admin: user wallet balance adjustment
  - Spec: `meta/memory_bank/specs/work_items/2026-02-09__feature__admin-user-wallet-balance-edit.md`
  - Owner: Codex
  - Branch: `airis_b2c`
  - Done: 2026-02-09
  - Summary: Добавить admin-only чтение/корректировку wallet-баланса пользователя в Edit User modal с ledger + audit trail.
  - Tests: backend targeted pytest + ruff, frontend targeted vitest + eslint
  - Risks: Medium (финансовая корректность и права доступа)

## Risks / Rollback

- Risks:
  - Некорректный delta или отсутствие идемпотентности может привести к двойному начислению/списанию.
  - Ошибка в правах доступа может открыть финансовые операции не-админам.
- Rollback plan:
  - Отключить UI-кнопку корректировки и вернуть изменения API/Wallet service отдельным revert-commit.
  - Проверить ledger/audit записи за период релиза и вручную скорректировать при необходимости.
