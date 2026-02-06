# Rate card XLSX import: provider-only models + i18n placeholders

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: airis_b2c
- Created: 2026-02-03
- Updated: 2026-02-03

## Context

При импорте прайс-листа (rate cards) из XLSX в режиме preview/apply показывались предупреждения
`Model does not exist in the system; row skipped` для моделей, которые доступны в системе как provider base models
(`/api/models/base`), но ещё не сохранены как base models в workspace DB (`/api/v1/models/base`).

На UI в модалке импорта также отображались не подставленные плейсхолдеры (`{count}`, `{shown}`, `{total}`) и была
дублирующая строка-сводка поверх карточек-счётчиков.

## Goal / Acceptance Criteria

- [x] XLSX import preview/apply считает provider base models “известными” и не выдаёт `unknown_model` для них.
- [x] Apply auto-creates missing base model записи в БД для импортируемых provider-only моделей (по явному действию админа).
- [x] UI показывает корректные значения для плейсхолдеров и не дублирует сводку.

## Non-goals

- Не меняем формат XLSX шаблона/колонки.
- Не добавляем новые зависимости.

## Scope (what changes)

- Backend:
  - `backend/open_webui/routers/admin_billing_rate_card.py`: расширен список “known models” для import-xlsx через provider base models + auto-create base model на apply.
  - `backend/open_webui/test/apps/webui/routers/test_admin_billing_rate_card_xlsx.py`: тест на provider-only модель без записи в БД.
- Frontend:
  - `src/routes/(app)/admin/billing/models/+page.svelte`: исправлены i18n keys для i18next interpolation, убрана дублирующая summary строка в Step 2.
  - `src/lib/i18n/locales/en-US/translation.json`, `src/lib/i18n/locales/ru-RU/translation.json`: ключи с плейсхолдерами приведены к `{{var}}` стилю.

## Implementation Notes

- Root cause (XLSX warnings):
  - backend import-xlsx использовал только `Models.get_base_models()` (workspace DB), игнорируя provider base models.
- Fix:
  - import-xlsx (preview/apply) добавляет ids из `get_all_base_models(request)` в known ids.
  - apply дополнительно upsert-ит missing base model записи для импортируемых моделей (без side effects в preview).
- i18n placeholders:
  - i18next ожидает `{{var}}`, поэтому строки с `{var}` не интерполировались.

## Upstream impact

- Upstream-owned files touched:
  - `src/routes/(app)/admin/billing/models/+page.svelte`
- Why unavoidable:
  - Это entrypoint страницы импорта, где формируются i18n keys и рендерится Step 2.
- Minimization strategy:
  - Локальная правка строк/ключей и удаление одной дублирующей строки без рефакторинга структуры страницы.

## Verification

- Backend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_admin_billing_rate_card_xlsx.py"`
- Frontend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run"`

## Risks / Rollback

- Risks:
  - Apply теперь может создавать base model записи для provider-only моделей по явному действию админа (ожидаемое поведение).
- Rollback plan:
  - Откатить изменения в `backend/open_webui/routers/admin_billing_rate_card.py` и `src/routes/(app)/admin/billing/models/+page.svelte`.
