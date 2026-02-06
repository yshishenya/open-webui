# План реализации PAYG + Lead Magnet

Источник требований: `meta/memory_bank/specs/payg_lead_magnet_policy.md`  
Статус: in progress (core flow implemented)  
Дата: 2026-01-19

## 0) Принятые решения

- Политика превышения квоты: hard gate по max-оценке. Если remaining < max_estimate → сразу PAYG.
- TTS/STT лимиты: квоты в секундах. Preflight: оценка (TTS по длине текста, STT по длительности файла). Settle: фактическая длительность при наличии, иначе оценка.
- Пересчёт циклов: lazy-recalc на первом запросе после изменения конфигурации (версионирование config).
- Хранилище lead magnet: отдельная таблица `billing_lead_magnet_state`.
- Порядок списания: lead magnet всегда приоритетен, пользователь не переключает на PAYG вручную.
- При отсутствии rate card: запрос блокируется даже при lead magnet.
- Пользовательский UI: estimate показывает “Бесплатно” (shadow cost не показываем пользователю).
- Подписки: оставляем backend эндпоинты, но выключаем флагом и скрываем пользовательский UI/роуты. PAYG + lead magnet — основной флоу.
- Админ‑UI lead magnet: размещаем в разделе Billing (новая вкладка/секция рядом с планами/моделями).

## 1) Аудит текущей реализации (по файлам)

### Backend

- `backend/open_webui/models/billing_models.py`
  - Quotas и Usage привязаны к подписке, нет lead-magnet метрик (tts/stt).
  - `UsageMetric` содержит `audio_minutes`, но нет `tts_seconds`/`stt_seconds`.
- `backend/open_webui/models/billing_tables.py`
  - `assign_free_plan_to_user` и `get_free_plan` завязаны на price=0.
  - `get_plan_subscribers_with_usage` считает usage только для подписок.
- `backend/open_webui/models/billing_wallet.py`
  - `UsageEvent` не хранит `billing_source` (lead_magnet vs payg).
  - Нет таблицы/модели для состояния lead magnet.
- `backend/open_webui/utils/billing.py`
  - `check_quota` и `track_usage` работают только при наличии подписки.
  - `get_user_billing_info` строится вокруг подписки и quotas.
- `backend/open_webui/utils/billing_integration.py`
  - `check_and_enforce_quota` и `track_model_usage` пропускают пользователей без подписки.
  - `preflight_estimate_hold`/`preflight_single_rate_hold` всегда PAYG (wallet hold).
  - `settle_*` всегда списывает кошелёк, нет free-path.
- `backend/open_webui/routers/billing.py`
  - `/plans`, `/subscription/*`, `/subscription/free` — пользовательский флоу подписок.
  - `/usage/*` и `/me` показывают usage только через подписку.
  - `/estimate` использует только wallet и не знает про lead magnet.
- `backend/open_webui/routers/openai.py`
  - До запроса вызывается `check_and_enforce_quota`, затем всегда PAYG hold.
- `backend/open_webui/routers/images.py`, `backend/open_webui/routers/audio.py`
  - Аналогично PAYG hold/settle; STT пока не тарифицируется.
- `backend/open_webui/routers/oauth_russian.py`
  - При регистрации назначается free план подписки (конфликтует с PAYG default).
- `backend/open_webui/env.py`, `backend/open_webui/config.py`
  - Нет персистентных настроек lead magnet (enabled, cycle_days, quotas).
- Миграции: `b2f8a9c1d5e3_*`, `c9d7e2a1b4f0_*`
  - Нет таблиц/полей под lead magnet.

### Frontend

- `src/lib/apis/billing/index.ts`
  - `BillingInfo` отражает подписку/usage, нет lead magnet полей.
  - `EstimateResponse` не содержит `billing_source`.
- `src/routes/(app)/billing/plans/+page.svelte`
  - UI подписок + активация free плана.
- `src/routes/(app)/billing/dashboard/+page.svelte`
  - Полностью “subscription-centric”.
- `src/routes/(app)/billing/balance|history|settings`
  - Wallet UI есть, но нет lead magnet блока/прогресса.
- `src/routes/pricing/+page.svelte`
  - Публичные планы (включая PAYG как подписку).
- `src/lib/components/chat/MessageInput.svelte`
  - Estimate показывает цену, нет “бесплатно” или lead magnet статуса.
- `src/lib/components/chat/ModelSelector/*`
  - Нет бейджа “Lead magnet (free)” у моделей.
- `src/lib/components/workspace/Models/ModelEditor.svelte`
  - Нет поля для флага lead magnet в meta.
- `src/lib/components/admin/billing/PlanForm.svelte`, `src/routes/(app)/admin/billing/*`
  - Управление планами подписок, нет UI для lead magnet настроек.
- `src/lib/i18n/locales/*/translation.json`
  - Нет строк для lead magnet, кошелька (новый копирайт).

### Tests

- `backend/open_webui/test/apps/webui/utils/test_billing_integration.py`
  - Проверяет PAYG hold/settle, нет сценариев lead magnet.
- `backend/open_webui/test/apps/webui/routers/test_*_billing.py`
  - Только PAYG (wallet) сценарии.
- `e2e/billing_wallet.spec.ts`
  - Wallet UI, нет lead magnet сценариев.

## 2) Что нужно убрать / переделать / дописать

### Убрать/скрыть

- Автоматическое назначение free подписки при регистрации.
- UI-элементы “Free plan activation” и PAYG как подписку (удалены).
- Публичная витрина, показывающая PAYG как подписку (заменить на “Кошелёк”).
- Пользовательский роут `/billing/plans` (admin-only).

### Переделать

- `check_and_enforce_quota` и `get_user_billing_info` — сделать независимыми от подписки и учитывать lead magnet.
- `preflight_*` и `settle_*` — добавить free-path при lead magnet.
- `estimate` — показывать “free”/lead_magnet и fallback к PAYG.
- UI Billing Dashboard — центрировать вокруг “Кошелёк + Lead magnet”, подписки оставить как optional (на будущее).

### Дописать

- Хранилище lead magnet state (таблица или user.settings).
- Персистентная конфигурация lead magnet (enabled, cycle_days, quotas).
- Lead magnet admin UI (квоты, цикл).
- Флаг модели “Lead magnet (free)” в model editor.
- Новые тесты (unit + integration + e2e).

## 3) Предлагаемая архитектура (предварительно)

### 3.1 Хранилище состояния lead magnet

Рекомендуется отдельная таблица:
`billing_lead_magnet_state`:

- `id` (uuid), `user_id` (unique)
- `cycle_start`, `cycle_end`
- `tokens_input_used`, `tokens_output_used`, `images_used`, `tts_seconds_used`, `stt_seconds_used`
- `created_at`, `updated_at`
  Причины: удобные транзакции/локи, проще пересчитывать при изменениях, без json-«мешанины».

### 3.2 Источник конфигурации

Использовать `PersistentConfig` (config.py):

- `LEAD_MAGNET_ENABLED` (bool)
- `LEAD_MAGNET_CYCLE_DAYS` (int)
- `LEAD_MAGNET_QUOTAS` (dict: tokens_input, tokens_output, images, tts_seconds, stt_seconds)
  Админ UI работает через новые API endpoints.

### 3.3 Источник allowlist моделей

Использовать флаг `model.meta.lead_magnet = true` (checkbox в ModelEditor).  
Allowlist = все модели с этим флагом.

### 3.4 Логика решения (per request)

1. Если lead magnet выключен или модель не отмечена — PAYG.
2. Если lead magnet включён и модель отмечена:
   - Проверить remaining quotas.
   - Если remaining >= max-оценки — free-path (lead magnet).
   - Если remaining < max-оценки — fallback в PAYG.

### 3.5 Аудит/аналитика

Добавить `billing_source` в `billing_usage_event`:

- `lead_magnet` или `payg`
  Для lead_magnet писать `cost_raw_kopeks`, `cost_charged_kopeks=0`.

## 4) Детальный план работ (чеклист)

### Этап 0: Подготовка

- [x] Зафиксировать решения по политике “оценка vs превышение”.
- [x] Определить место UI для lead magnet настроек (admin billing).

### Этап 1: БД и модели

- [x] Добавить таблицу `billing_lead_magnet_state` + модели (SQLAlchemy + Pydantic).
- [x] Добавить `billing_source` в `billing_usage_event` (модель + миграция).
- [x] Вести tts/stt метрики в lead magnet state (отдельно от UsageMetric).
- [x] Миграция Alembic (create table + alter usage_event).

### Этап 2: Конфиг lead magnet

- [x] Добавить `PersistentConfig` ключи в `backend/open_webui/config.py`.
- [x] Добавить API endpoints для admin: GET/POST lead magnet config.
- [x] Логика “recalculate cycles” при изменении конфигов.

### Этап 3: Backend бизнес-логика

- [x] Новый `utils/lead_magnet.py` (state load/init, reset, consume, remaining).
- [x] Изменить `billing_integration.py`:
  - [x] Добавить `BillingSource` enum.
  - [x] В `preflight_estimate_hold`/`preflight_single_rate_hold` — определить lead magnet и создать “free” контекст.
  - [x] В `settle_*` — если lead magnet, записать usage_event с `billing_source=lead_magnet`, cost_charged=0 и инкрементить lead magnet usage.
  - [x] Добавить fallback к PAYG при отсутствии квот.
- [x] В `billing.py`:
  - [x] `get_user_billing_info` возвращает lead magnet блок + wallet.
  - [x] `check_quota`/`enforce_quota` учитывают lead magnet (или вынос в отдельную проверку).
- [x] В `routers/billing.py`:
  - [x] Новые эндпоинты `/api/v1/billing/lead-magnet` (status/usage/reset info).
  - [x] `/api/v1/billing/estimate` возвращает billing_source + free/paid.
  - [x] `/api/v1/billing/me` расширить lead magnet секцией.
  - [x] `/api/v1/billing/subscription/free` убрать/скрыть (или legacy флаг).
- [x] В `routers/oauth_russian.py`: убрать назначение free плана при регистрации.

### Этап 4: Интеграция в пайплайны

- [x] `routers/openai.py`: заменить текущий `check_and_enforce_quota` на lead magnet aware вариант.
- [x] `routers/images.py`: lead magnet path для images.
- [x] `routers/audio.py`: lead magnet path для TTS + добавить STT тарификацию.

### Этап 5: UI/UX

- [x] Новый блок Lead Magnet в `billing/dashboard` (оставшийся лимит, прогресс, reset).
- [x] Обновить `billing/plans`:
  - [x] Страница редиректит на dashboard, если подписки выключены.
  - [x] Подписки остаются как legacy-флоу, PAYG скрыт.
- [x] `billing/balance` — добавить блок lead magnet (remaining + reset).
- [x] `pricing` — заменить PAYG plan на “Кошелёк” блок с понятным описанием.
- [x] `MessageInput` — поддержать “free/lead_magnet” в estimate badge + tooltip.
- [x] `ModelSelector` — бейдж “Lead magnet (free)” для флагнутых моделей.
- [x] Admin UI:
  - [x] Форма lead magnet config (квоты, цикл).
  - [x] ModelEditor: чекбокс “Lead magnet (free)” (meta).
- [ ] i18n строки для новых UI текстов (ru/en).

### Этап 6: Тесты

- [x] Unit: lead magnet state (init, reset, consume, recalc).
- [x] Integration: lead magnet free-path, fallback PAYG, cycle reset.
- [x] Router tests: `/api/v1/billing/lead-magnet`, `/api/v1/billing/estimate` с billing_source.
- [x] UI (Playwright): отображение lead magnet + wallet, model badge.

### Этап 7: Роллаут

- [x] Включить lead magnet по умолчанию в локальном окружении, проверить поведение.
- [ ] Мониторинг: число lead_magnet vs payg, ошибки reset/recalc (production).

## 5) Открытые вопросы

- Нужна ли отдельная аналитика по lead magnet usage в админке (отчёт/таблица)?
