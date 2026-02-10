# Admin UI: корректировка кошелька (понятные названия + ввод в рублях)

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/admin-wallet-adjustment-rub-input
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-10
- Updated: 2026-02-10

## Context

В админке корректировка кошелька пользователя уже реализована, но UX сейчас слишком “технический”:

- подписи на английском (`Topup balance`, `Included balance`, `... delta (kopeks)`);
- ввод дельт в копейках (целым числом) вызывает ошибки и непонимание.

Это приводит к ошибкам оператора и лишним вопросам “что и куда вводить”.

## Goal / Acceptance Criteria

- [ ] Подписи и подсказки в админке (RU) понятны: что такое “Пополено” и “Включено”, и как они расходуются.
- [ ] Ввод корректировки делается в рублях (строкой, с поддержкой `,`/`.` как разделителя), без требования вводить копейки целыми.
- [ ] На API отправляются целые значения в копейках (совместимость с backend сохранена).
- [ ] Добавлены unit-тесты на парсинг/конвертацию “рубли → копейки”.
- [ ] Нет новых зависимостей.

## Non-goals

- Изменение backend контрактов или доменных правил списания.
- Массовая корректировка по списку пользователей.

## Scope (what changes)

- Backend:
  - Без изменений.
- Frontend:
  - `EditUserModal`: переименовать/перевести подписи кошелька, заменить ввод дельт с `kopeks` на ввод в рублях.
  - Добавить парсер суммы в рублях в `airis` helper и покрыть тестами.
  - Добавить RU i18n ключи для строк кошелька/ошибок.
- Config/Env:
  - Без изменений.
- Data model / migrations:
  - Не требуется.

## Implementation Notes

- Key files/entrypoints:
  - `src/lib/components/admin/Users/UserList/EditUserModal.svelte`
  - `src/lib/utils/airis/admin_billing_user_wallet.ts`
  - `src/lib/utils/airis/admin_billing_user_wallet.test.ts`
  - `src/lib/i18n/locales/ru-RU/translation.json`
- Parsing rules (UI):
  - Разрешить форматы: `1000`, `1000.50`, `1000,50`, `1 000,50`, `-50`, `-0,01`.
  - Запретить >2 знаков после разделителя.
- Edge cases:
  - Пустое поле дельты трактуется как `0`.
  - Запрос с обеими дельтами `0` запрещён (как и сейчас).

## Upstream impact

- Upstream-owned files touched:
  - `src/lib/components/admin/Users/UserList/EditUserModal.svelte`
- Why unavoidable:
  - Wallet UI находится внутри upstream модалки редактирования пользователя.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Логику парсинга/валидации держать в fork-owned `src/lib/utils/airis/*`.
  - В модалке менять только wallet-секцию (без рефакторинга остального файла).

## Verification

- Frontend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run src/lib/utils/airis/admin_billing_user_wallet.test.ts"`
- Frontend lint (targeted): `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npx eslint src/lib/components/admin/Users/UserList/EditUserModal.svelte src/lib/utils/airis/admin_billing_user_wallet.ts src/lib/utils/airis/admin_billing_user_wallet.test.ts"`

Execution result (2026-02-10):

- ✅ `vitest --run src/lib/utils/airis/admin_billing_user_wallet.test.ts`
- ✅ `eslint` (targeted) for touched files

## Task Entry (for branch_updates/current_tasks)

- [ ] **[BUG][UI][BILLING][ADMIN]** Admin wallet adjustment: RU copy + RUB deltas
  - Spec: `meta/memory_bank/specs/work_items/2026-02-10__bugfix__admin-wallet-adjustment-ui-rub-input.md`
  - Owner: Codex
  - Branch: `codex/bugfix/admin-wallet-adjustment-rub-input`
  - Started: 2026-02-10
  - Summary: Перевести и упростить wallet-корректировку в админке: понятные подписи + ввод суммы в рублях с конвертацией в копейки для API.
  - Tests: targeted vitest + targeted eslint
  - Risks: Low-Medium (операторский UX на финансовой операции)

## Risks / Rollback

- Risks:
  - Ошибка парсинга может привести к неверной сумме корректировки.
- Rollback plan:
  - Откатить UI/парсер и вернуть ввод в копейках (API/ledger не трогаем).
