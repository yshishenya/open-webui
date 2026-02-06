# Rate card: models list empty when only provider models exist

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: bugfix/rate-card-no-models
- Created: 2026-02-03
- Updated: 2026-02-03

## Context

Админ-страница `admin/billing/models` (Rate Card) загружает список моделей только из workspace/DB base models (`/api/v1/models/base`), т.е. из таблицы `model` с `base_model_id == null`.

Если модели доступны в системе только как provider base models (из `/api/models/base`) и ещё не “зафиксированы” в БД как workspace-override, то `/api/v1/models/base` возвращает пустой массив — и таблица Rate Card оказывается пустой, хотя модели реально доступны в чатах.

## Goal / Acceptance Criteria

- [ ] Страница Rate Card показывает базовые модели из `/api/models/base` даже если в БД нет base моделей.
- [ ] Если админ сохраняет rate cards/lead magnet для модели без workspace-записи, создаётся base model запись в БД (чтобы дальше работали операции, завязанные на `Models.get_base_models()`).
- [ ] Поведение остаётся обратимо и не требует ручного pre-seed моделей.

## Non-goals

- Не меняем правила доступа (access_control) глобально и не вводим новые роли/permissions.
- Не меняем backend-валидацию XLSX import/export в этом PR (она по-прежнему использует `Models.get_base_models()` как “known models”).

## Scope (what changes)

- Frontend:
  - `src/routes/(app)/admin/billing/models/+page.svelte`: загрузка моделей как merge `getModels(..., base=true)` + `getBaseModels()` и авто-upsert base model записи при save.

## Implementation Notes

- Root cause:
  - `src/routes/(app)/admin/billing/models/+page.svelte` вызывал только `getBaseModels()` → `/api/v1/models/base` → `Models.get_base_models()` (DB).
- Fix strategy:
  - В UI берём provider base models через `getModels(token, null, true)` (это `/api/models/base`), накладываем workspace overrides из `getBaseModels()`.
  - При `Save` делаем `createNewModel(..., base_model_id: null)` для модели, если её ещё нет в workspace (по id).

## Upstream impact

- Upstream-owned files touched:
  - `src/routes/(app)/admin/billing/models/+page.svelte`
- Why unavoidable:
  - Это entrypoint страницы, где сейчас выбирается неверный источник данных.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Только локальная правка загрузки данных и небольшой helper; без рефакторинга структуры страницы.

## Verification

- Frontend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run -T --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run"`

## Task Entry (for branch_updates/current_tasks)

- [ ] **[BUG]** Rate card page shows no models for provider-only setup
  - Spec: `meta/memory_bank/specs/work_items/2026-02-03__bugfix__rate-card-no-models.md`
  - Owner: Codex
  - Branch: `bugfix/rate-card-no-models`
  - Started: 2026-02-03
  - Summary: Merge provider base models with workspace overrides; auto-create missing base model records on save.
  - Tests: `npm run docker:test:frontend`
  - Risks: Возможное изменение видимости моделей зависит от текущих access_control правил; создание workspace-записи выполняется только при явном Save админом.

## Risks / Rollback

- Risks:
  - Создание base model записи в БД может повлиять на access control/видимость моделей в окружениях, где access control enforced. Снижаем риск тем, что создаём запись только при явном сохранении админом.
- Rollback plan:
  - Откатить изменения в `src/routes/(app)/admin/billing/models/+page.svelte`; при необходимости удалить созданные base model записи из таблицы `model` (для затронутых id).
