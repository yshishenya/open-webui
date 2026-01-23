# B2C Монетизация AIris Chat (кошелёк + подписка + PAYG)

## Цель
Внедрить двухкошелёчную модель (included + top-up), прозрачное ценообразование по моделям/модальностям и оплату “в рублях” с поддержкой подписок, пополнений, авто-пополнения и лимитов стоимости ответа. Основные сценарии: подписка с включённым балансом и скидкой, PAYG-пополнение кошелька, защита от перерасхода, история списаний, админ-управление тарифами и rate card.

## Этапы внедрения (по приоритету)
- **Этап 1: PAYG first (кошелёк + топапы + rate card + hold/settle)**
  - Включить кошелёк, ledger, rate card, оценку/hold/settle.
  - Запустить планы Free и PAYG (без включённого баланса/скидок/годовых; Start/Plus/Pro пока скрыть или оставить выключенными).
  - Топап-пакеты, auto-topup, лимиты max_reply_cost/daily_cap, публичные планы/цены.
  - UI: баланс, история (ledger), estimate-бейдж, блокировки при нехватке средств.
- **Этап 2: Подписки (included + скидки + годовые)**
  - Активировать Start/Plus/Pro, annual скидку, начисление included, discount на списания.
  - Auto-renew/dunning, proration при смене плана, отчёты ARPU.
  - Расширить UI подписок и администратора.
## Текущее состояние (важное)
- Есть тарифы/подписки/usage/транзакции в SQLAlchemy (`backend/open_webui/models/billing.py`, миграция `b2f8a9c1d5e3_add_billing_tables.py`).
- YooKassa интеграция для разовых платежей за план (`billing.py` router, `utils/billing.py`, `utils/yookassa.py`), вебхуки обновляют транзакцию и создают/реновят подписку.
- Квоты токенов/запросов проверяются только для активных подписок в текстовом пайплайне (`routers/openai.py` + `utils/billing_integration.py`); usage пишется post factum, без hold/settle.
- UI: `/billing/plans`, `/billing/dashboard`, публичный `/pricing`; админ CRUD тарифов + статистика. Нет кошелька, нет rate card, нет PAYG, нет лимитов стоимости ответа.

## Ключевые пробелы vs целевая модель
- Нет кошелька (kopeks), нет top-up/auto top-up, нет included vs top-up кошельков.
- Нет rate card по моделям/модальностям, нет расчёта стоимости, нет hold/settle.
- Нет квот/учёта по изображениям/TTS, нет трекинга usage для пользователей без подписки (PAYG).
- Подписки только “цена за период”, без включённого баланса/скидки/tiers; нет годовых скидок.
- Нет лимитов стоимости ответа/дневных лимитов; нет ledger событий (charge/topup/hold/refund).
- YooKassa без сохранения платёжного метода/auto-renew; пополнений PAYG нет.
- UI не показывает баланс, цены запроса, лимиты; нет admin rate card/ручных корректировок.

## План работ (детально по слоям)

### 1) Схема данных и миграции (PostgreSQL/SQLite)
- Добавить таблицы:
  - `wallets(id, user_id, currency, balance_topup_kopeks, balance_included_kopeks, included_expires_at, max_reply_cost_kopeks, daily_cap_kopeks, daily_spent_kopeks, daily_reset_at, auto_topup_enabled, auto_topup_threshold_kopeks, auto_topup_amount_kopeks, auto_topup_fail_count, auto_topup_last_failed_at, created_at, updated_at)`, уникальный ключ `(user_id, currency)`.
  - `pricing_rate_card(id, model_id, model_tier, modality, unit, raw_cost_per_unit_kopeks, platform_factor, fixed_fee_kopeks, min_charge_kopeks, rounding_rules_json, version, effective_from, effective_to, provider, is_default, is_active)` + отдельная таблица версий `rate_card_version(id, version, effective_from, created_at)` или жёсткая ссылка на `pricing_rate_card.id` в usage.
  - `usage_events(id, user_id, chat_id, message_id, request_id, model_id, modality, provider, measured_units_json, cost_raw_kopeks, cost_charged_kopeks, is_estimated, estimate_reason, pricing_version, pricing_rate_card_id, plan_id, subscription_id, wallet_id, wallet_snapshot_json, created_at)`.
  - `ledger_entries(id, user_id, wallet_id, currency, type, amount_kopeks, balance_included_after, balance_topup_after, reference_id, reference_type, idempotency_key, hold_expires_at, expires_at, metadata_json, created_at)`, type ∈ {hold, charge, refund, topup, subscription_credit, adjustment, release}.
  - `payments(id, provider, status, kind, amount_kopeks, currency, idempotency_key, provider_payment_id, payment_method_id, status_details, metadata_json, raw_payload_json, user_id, wallet_id, subscription_id, created_at, updated_at)`.
  - `promo_codes(code, bonus_kopeks, expires_at, usage_limit, per_user_limit, metadata_json)`.
- Расширить существующие таблицы:
  - `plans`: `price_kopeks`, `included_kopeks_per_period`, `discount_percent`, `model_tiers_allowed` (json), квоты по модальностям (`images_per_period`, `tts_seconds_per_period`), `max_reply_cost_kopeks`, `daily_cap_kopeks`, `is_annual` флаг.
  - `subscriptions`: `auto_renew`, `last_payment_id`, `wallet_id`, `payment_method_id`, `next_plan_id`, `cancel_at_period_end` оставить.
  - `transactions`: оставить для совместимости UI, но постепенно заменить данными из `ledger_entries`/`payments`.
  - `user.info`: сохранить `billing_contact_email`/`billing_contact_phone` (для receipt).
- Написать Alembic миграцию: создание новых таблиц, перенос price→kopeks (оставить `price` для UI, добавить `price_kopeks` как источник истины), бэкап старых значений, индексы по `user_id/status/created_at/model_id`, создание wallets для всех пользователей. Новая схема — единственный источник данных (без dual-write), при необходимости временно отдаём read-only совместимые ответы.

#### DDL/индексы (детализация для миграции)
- `wallets`:
  - `id` PK (uuid), `user_id` FK → users.id, `currency` (TEXT, default `BILLING_DEFAULT_CURRENCY`), unique (`user_id`,`currency`).
  - Балансы: `balance_topup_kopeks` BIGINT NOT NULL DEFAULT 0, `balance_included_kopeks` BIGINT NOT NULL DEFAULT 0.
  - Лимиты: `max_reply_cost_kopeks`, `daily_cap_kopeks`, `daily_spent_kopeks` (BIGINT, default 0), `daily_reset_at` (BIGINT).
  - Auto-topup: `auto_topup_enabled` BOOL default false, `auto_topup_threshold_kopeks`, `auto_topup_amount_kopeks`, `auto_topup_fail_count` INT default 0, `auto_topup_last_failed_at` BIGINT.
  - `included_expires_at`, `created_at`, `updated_at` BIGINT; индекс по `user_id`.
- `pricing_rate_card`:
  - PK `id` (uuid), поля из спецификации + `version` (TEXT) или FK `rate_card_version_id`.
  - Uniq: (`model_id`,`modality`,`unit`,`version`,`effective_from`); индекс по (`is_active`,`effective_from`).
  - Опциональная таблица `rate_card_version(id, version, effective_from, created_at)` с FK из rate_card.
- `usage_events`:
  - PK `id` (uuid); FK: `user_id`, `wallet_id`, `plan_id`, `subscription_id`, `pricing_rate_card_id`.
  - Уникальность `request_id` (+`modality`) и индекс по (`user_id`,`created_at`).
  - Стоимости: `cost_raw_kopeks`, `cost_charged_kopeks` BIGINT NOT NULL DEFAULT 0; `is_estimated` BOOL; `pricing_version` TEXT; `wallet_snapshot_json` JSON.
- `ledger_entries`:
  - PK `id` (uuid); FK: `user_id`, `wallet_id`; `currency` TEXT CHECK == wallet.
  - `type` ENUM {hold, charge, refund, topup, subscription_credit, adjustment, release}.
  - `amount_kopeks` BIGINT (знак означает приход/расход); `balance_included_after`, `balance_topup_after` BIGINT; `reference_id`, `reference_type`, `idempotency_key`.
  - Уникальность `(reference_type, reference_id, type)` и/или `(idempotency_key)`; индексы по (`user_id`,`created_at`), (`wallet_id`,`type`).
  - `hold_expires_at` для hold, `expires_at` для topup (TTL, по умолчанию 365 дней через конфиг).
- `payments`:
  - PK `id` (uuid); FK: `user_id`, `wallet_id`, `subscription_id`.
  - Уникальный `provider_payment_id`; уникальный `idempotency_key`.
  - `status` ENUM (pending/succeeded/failed/canceled), `kind` ENUM (topup/subscription/adjustment), суммы в копейках.
  - Индексы по (`provider`,`provider_payment_id`), (`user_id`,`created_at`), (`status`,`created_at`).
- `promo_codes`:
  - PK `code`; `bonus_kopeks`, `expires_at`, `usage_limit`, `per_user_limit`, `metadata_json`; индекс по `expires_at`.
- Расширения `plans`/`subscriptions`/`users`:
  - `plans.price_kopeks` NOT NULL (source of truth), `price` оставляем как Decimal для UI.
  - `plans.included_kopeks_per_period`, `discount_percent` (NUMERIC), `model_tiers_allowed` JSON, `images_per_period`, `tts_seconds_per_period`, `max_reply_cost_kopeks`, `daily_cap_kopeks`, `is_annual`.
  - `subscriptions.auto_renew` BOOL default false, `wallet_id` FK, `payment_method_id`, `next_plan_id`, `last_payment_id`.
  - `users.billing_contact_email/phone` (nullable) для receipt, индекс по email если нужен для валидации платежей.

### 2) Сервис ценообразования и биллинга (backend/utils)
- Новый модуль `utils/pricing.py`: загрузка rate card, формула `(raw_cost × platform_factor × (1 - discount) + fixed_fee)`, поддержка модальностей text/image/tts, округление до копеек.
  - Правило округления: по умолчанию `ceil` до 1 копейки, минимум `min_charge_kopeks` из rate card.
  - Для локальных моделей допускаем `raw_cost_per_unit_kopeks = 0`, но можно задавать `fixed_fee_kopeks` за инфраструктуру.
- Версионирование rate card: хранить явный `rate_card_version` (версия + `effective_from`) и ссылку `pricing_rate_card_id` в usage; обновление цен создаёт новую версию, не правим старые строки.
- Новый сервис `wallet_service`: операции hold/settle/release, списание included→topup, idempotency по `reference_id`.
- Расширить `BillingService`:
  - Расчёт estimate (min/max) до запроса с учётом max_tokens/limit пользователя.
  - Hold перед запросом, отказ при нехватке средств/квоты/лимита ответа.
  - Settle после факта usage: фиксация `usage_events`, запись `ledger_entries`, возврат разницы.
  - Применение скидки плана и списание included баланса за счёт подписки.
  - Применение квот по картинкам/TTS и списание денег, если квота исчерпана.
  - Дневной лимит/`max_reply_cost` per user.
  - Промокоды: начисление бонуса в wallet.
  - Политика смены плана (best practice):
    - Апгрейд: вступает в силу сразу, перерасчёт по дням с кредитом за остаток текущего периода.
    - Дауngrade: вступает в силу в конце периода (scheduled), included начисляется на новый период.
    - Top-up баланс не трогаем, все движения отражаем в `ledger_entries`.
    - Формула pro-rate: `credit = old_price * remaining_days / period_days`, `charge = new_price * remaining_days / period_days`.
- Фолбэк при отсутствии `usage` от провайдера: списание по estimate, пометка `is_estimated`, лог warning и сохранение причины.
- Обновить `billing_integration.py`:
  - Поддержка модальностей: text (tokens), images (count/size), TTS (chars/seconds).
  - Preflight: вызвать estimate+hold, прокинуть limit в пайплайн; в finalize — settle.
  - Трекать usage для пользователей без подписки (PAYG).

### 3) Платежи и кошелёк (YooKassa)
- Расширить `utils/yookassa.py`: сценарии top-up (разовые), возможный one-click/recurring token если YooKassa поддерживает (уточнить).
- Роуты `billing.py`:
  - `/billing/topup` (создание платежа с пакетами 199/499/999/1999/4999 ₽, metadata kind=topup).
  - `/billing/auto-topup` toggle/update.
  - `/billing/balance` возврат балансов/лимитов.
  - `/billing/estimate` получение оценки перед запросом (для UI бейджа).
  - `/billing/settings` (max_reply_cost, daily_cap).
- Вебхуки: idempotency по `payment_id`, при `payment.succeeded` — create ledger topup или subscription_credit (annual/monthly начисление included).
- При создании платежей: передавать `receipt` (если требуется 54‑ФЗ) и валидировать контакт пользователя.
- Планы с годовой оплатой: отдельные планы (`is_annual=true`), начисление included на период, скидка 16% в цене.
- Автопродление подписки: если возможен сохранённый метод — авто-платёж; иначе напоминание (не делаем пока автосписание, если YooKassa не даёт).

### 4) Интеграция в пайплайны OpenWebUI
- Текст (`routers/openai.py`): preflight estimate→hold по лимиту, учёт `max_reply_cost` и дневного лимита; settle после ответа/stream завершения; обработать таймаут/отмену → release hold.
- Изображения (`routers/images.py`): встроить расчет цены по rate card (model+size+count), квоты на изображения, hold/settle, блокировка при нехватке средств.
- TTS (ищем соответствующий роут) и STT при необходимости: считать по символам/секундам, квоты, hold/settle.
- Функции/инструменты: минимально — считать как текст (tokens) или фикс-фии, если есть дорогие операции.
- Ошибки: при отказе биллинга возвращать 402/429 с кодом и предложением пополнить.
- При отсутствии `usage` в streaming: фиксируем estimate, пишем предупреждение в логи/контейнер.

### 5) Админ-функции
- Admin API/UI:
  - CRUD rate card (модели, модальности, факторы, fixed_fee, rounding).
  - Страница Model Pricing: список моделей, цены, статусы, массовые операции.
  - Управление планами: поля included_kopeks, discount_percent, allowed tiers, квоты по картинкам/TTS, годовые версии.
  - Настройка Free плана через UI: price=0, tiers=Economy, лимиты/квоты, daily_cap.
  - Просмотр кошельков и ledger, ручные корректировки/рефанды (audit log).
  - Промокоды: создание/деактивация, статистика использования.
  - Отчёты: выручка по видам платежей (subscription/topup), ARPU, расход по моделям/модальностям.

### 6) Пользовательский UI/UX
- Баланс/кошелёк:
  - Страница с балансом (included vs top-up), срок сгорания included, быстрые суммы пополнения, авто-topup toggle, промокод, статусы платежей.
  - История операций: ledger (charges/topups/holds/refunds), фильтр по чатам/датам/типам.
- Подписки:
  - Карточки Start/Plus/Pro (и годовые) с включённым балансом/скидкой, квоты по модальностям, кнопки “докупка”.
  - Настройки лимитов: max cost per reply, дневной лимит.
- В чате:
  - Бейдж “~X ₽” перед отправкой (данные `/billing/estimate`).
  - Предупреждение о длинном контексте, блок/апсейл при нехватке средств/квот.
  - Счётчик/лимит картинок/TTS по плану.
- Публичный `/pricing`: отразить новую сетку (Free/Start/Plus/Pro/PAYG, годовые -16%).
- Единый источник цен: все UI (внутренние страницы и будущий лендинг) получают планы и цены через `/billing/plans/public` и не хардкодят стоимость.

### 7) Фоновые задачи
- Крон/APS: сгорание included в конце периода, чистка expired holds, напоминания о низком балансе/дневном лимите, деактивация auto_topup при повторных фейлах платежа.
- Дневная агрегация usage по пользователям/моделям для аналитики.

### 8) Наблюдаемость и безопасность
- Логирование всех биллинг-операций (structured), алерты на fail вебхуков/hold/settle.
- Метрики: число hold/denied, средний чек, отказов по лимиту, расходы по модальностям.
- Audit log уже есть — расширить на новые admin действия и ручные корректировки.

### 9) Тестирование
- Юнит-тесты: pricing (rounding/discount), hold/settle с недостатком средств, очередность списаний included→topup, промокоды.
- Интеграционные: платежный webhook idempotency, auto-topup сценарий, отказ по лимиту/дневному лимиту, PAYG без подписки.
- E2E (Playwright/Vitest): покупка top-up, оценка стоимости в чате, блокировка при нехватке баланса, отображение ledger/баланса.

### 10) Миграции/роллаут
- Миграция данных тарифов/подписок в копейки, создание годовых планов с -16%.
- Seed rate card (базовые цены на text/image/TTS) и дефолтные пакеты пополнений.
- Временно держать фича-флаг биллинга новой модели; параллельный режим “старый квоты” → “новый кошелёк” с принудительным переведением пользователей.
- Пошагово:
  1. Применить миграции таблиц.
  2. Создать кошельки всем существующим пользователям (нулевой баланс).
  3. Бэкоф/перенос истории: конвертировать существующие `billing_transaction`/usage в `ledger_entries`/`usage_events` для целостной истории UI.
  3. **Этап 1 (PAYG)**: включить `plans/public` с Free+PAYG, estimate→hold/settle, топапы/auto-topup, ledger UI.
  4. Включить PAYG пополнения (без подписок).
  5. Переключить UI на `plans/public` и показать balances.
  6. Постепенно заменить `billing_transaction` в UI на `ledger_entries` (история операций).
  7. **Этап 2 (подписки)**: включить Start/Plus/Pro/Annual, начисления included, скидки, auto-renew/dunning, proration.

## Детализация: данные, транзакции, идемпотентность

### A) Инварианты и правила учёта
- Все деньги храним в копейках (int); Decimal используем только для отображения.
- Любая финансовая операция фиксируется в `ledger_entries` и не редактируется.
- Баланс пользователя = последний снапшот из `wallets`, сверяется с суммой ledger (периодически).
- Списание всегда идёт в порядке: included → topup.
- `included` сгорает в конце периода, `topup` живёт 12 месяцев (рекомендованный best practice).
- Любая запись в `usage_events` хранит ценовую версию (`pricing_version`) и флаг `is_estimated`.
- В `usage_events.wallet_snapshot_json` фиксировать балансы до/после списания для аудита.
- Дневной лимит считается по локальному времени пользователя (берём `user.timezone`, иначе UTC).
- Сброс `daily_cap`: плановый джоб в 00:00 локального времени пользователя (или UTC, если timezone не указан).
- Квоты по модальностям:
  - По умолчанию считаем как “included лимит”; при наличии topup допускаем перерасход.
  - Для жёстких ограничений использовать флаг `hard_quota` в plan metadata.

### B) Конкурентные запросы и атомарность
- Все операции hold/settle/release выполняются в одной транзакции с `SELECT ... FOR UPDATE` по строке `wallets`.
- Идемпотентность:
  - `ledger_entries`: уникальный ключ `(reference_type, reference_id, type)` + `idempotency_key`.
  - `payments`: уникальный `provider_payment_id`.
  - `usage_events`: уникальный `request_id` (или `message_id`) + `modality`.
  - Клиент всегда передаёт `request_id` (UUID) в metadata запроса.
- Любой повторный webhook не меняет баланс второй раз (idempotency).

### C) Политика hold/settle
- Preflight:
  - Рассчитать estimate (min/max).
  - `max_estimate_kopeks` → hold (reduce available funds).
  - Если средств/квот нет → 402/429 с кодом ошибки.
  - Доступный баланс = included + topup - активные hold.
- SQLite dev-режим: нет `SELECT ... FOR UPDATE`, поэтому используем IMMEDIATE транзакции/прикладные локи для исключения двойных hold в тестах.
- Postflight:
  - Считаем фактическую стоимость.
  - Списываем фактическую сумму (`charge`), разницу возвращаем (`release`).
  - Если usage отсутствует: `charge = estimate`, `is_estimated = true`, warning в лог.
- Очистка:
  - `hold_expires_at` + job на release “зависших” hold.

## Детализация: оценка стоимости (estimate)
- Источник входа:
  - Для текста: `max_tokens`/`max_output_tokens` и текущий контекст.
  - Для изображений: размер/количество/модель.
  - Для TTS: длина текста (символы) или ожидаемые секунды.
- Алгоритм:
  - `prompt_tokens_estimate = estimate_tokens_from_messages`.
  - `completion_tokens_estimate = max_tokens` или лимит модели (если задан).
  - `min_estimate` = только prompt + минимальный output.
  - `max_estimate` = prompt + max output.
  - UI показывает диапазон, hold делаем по max.
- Фолбэк:
  - Если usage не пришёл — фиксируем `max_estimate`, пишем warning с `request_id`, `provider`, `model_id`.
 - Учитывать добавки:
   - system prompt, retrieved контекст (RAG), tool calls, вложения (если сериализуются в prompt).

## Детализация: маппинг usage по провайдерам
- Базовые поля: `prompt_tokens`, `completion_tokens`, `total_tokens`.
- Дополнительно учитывать:
  - `reasoning_tokens` (если есть, суммировать в output).
  - `cached_tokens` (можно тарифицировать дешевле через отдельный unit).
  - `audio_tokens`/`audio_seconds` (для TTS/STT).
- `measured_units_json` хранит сырой usage для аудита.
- Если usage отсутствует или невалиден → fallback на estimate и `is_estimated=true`.

## Детализация: модельные tiers и единый источник цен
- Маппинг модели → pricing key:
  - Используем `model.base_model_id` как ключ, если есть.
  - Дополняем `model.meta.billing` полями `billing_model_id`, `billing_tier`, `billing_modality`.
  - `pricing_rate_card.model_id` хранит `billing_model_id` (единый ключ для цены).
- Rate card версионируем: `version` + `effective_from`.
- Обновление цен:
  - Любой UI (billing, pricing, будущий лендинг) читает `/billing/plans/public`.
  - Никаких хардкодов цен во фронтенде; только серверные данные.
  - Для лендинга: кэширование публичного прайса (Redis/HTTP cache), обновление при изменении плана.
  - Использовать `Cache-Control`/ETag, чтобы CDN/лендинг подтягивал актуальные цены без релиза.
- Доступ по tiers:
  - Проверять `model_tiers_allowed` плана до запроса.
  - Если tier запрещён → 403 с апсейлом.
 - Управление ценами моделей:
   - Новая модель появляется в списке “Unpriced models”.
   - Админ назначает tier/modality/unit и цену, либо применяет tier default.
   - Деактивация модели = `is_active=false` (soft delete).
   - Изменение цены = новая версия rate card с `effective_from`.
   - Публичная витрина цен моделей (если нужна):
     - `GET /billing/models/pricing/public` с кэшем и версионированием.
     - Кэш TTL 5–15 минут + ETag для лендинга/CDN.

## Детализация: API контракты (черновики)

### Пользовательские
- `GET /billing/plans/public`
  - Возвращает публичные планы, включая `price_kopeks`, `included_kopeks`, `discount_percent`, `max_reply_cost_kopeks`, `daily_cap_kopeks`.
- `GET /billing/models/pricing/public` (опционально)
  - Публичный список цен моделей с кэшем и версионированием.
- `GET /billing/balance`
  - `{ balance_topup_kopeks, balance_included_kopeks, included_expires_at, daily_cap_kopeks, daily_spent_kopeks }`
- `POST /billing/estimate`
  - Вход: `{ model_id, modality, payload, max_reply_cost_kopeks? }`
  - Выход: `{ min_kopeks, max_kopeks, is_allowed, reason? }`
  - Ошибки: `402` (insufficient_funds), `429` (quota_exceeded), `400` (invalid_model).
- `POST /billing/topup`
  - Вход: `{ amount_kopeks, return_url }`
  - Выход: `{ payment_id, confirmation_url }`
  - Ошибки: `400` (invalid_amount), `503` (payment_provider_unavailable).
  - При обязательном receipt: `400` (missing_contact).
- `POST /billing/auto-topup`
  - Вход: `{ enabled, threshold_kopeks, amount_kopeks }`
- `GET /billing/ledger`
  - Пагинация + фильтры по type/date/chat_id.
  - Типы: `hold`, `charge`, `release`, `topup`, `subscription_credit`, `refund`, `adjustment`.
- `POST /billing/settings`
  - Вход: `{ max_reply_cost_kopeks, daily_cap_kopeks, billing_contact_email?, billing_contact_phone? }`

### Админские
- `POST /admin/billing/rate-card` (CRUD)
- `POST /admin/billing/rate-card/sync-models` (создать placeholder для моделей без цены)
- `POST /admin/billing/plans` (расширенные поля)
- `POST /admin/billing/users/{id}/adjust` (ручная корректировка)
- `POST /admin/billing/promo` (CRUD промокодов)
 - `GET /admin/billing/models/pricing` (таблица цен по моделям)

## Детализация: сценарии и edge-cases

### Чат (текст, streaming)
1. Пользователь нажимает Send.
2. Preflight estimate + hold.
3. Streaming завершён → получаем usage.
4. Если usage отсутствует → charge=estimate, warn log.
5. Ledger фиксирует hold/charge/release.
6. Если запрос отменён пользователем/ошибся провайдер → release hold.

### Генерация изображений
1. Preflight: размер/кол-во → estimate.
2. Hold → запрос к провайдеру.
3. Ответ → charge по факту.
4. Ошибка генерации → release hold.

### Подписка
1. Пользователь выбирает план.
2. Создаётся платёж с metadata plan_id.
3. Webhook payment.succeeded → создаём/обновляем подписку, начисляем included.
4. Если paid, но подписка не создана → retry job.
5. Renewal failed → статус `past_due`, grace period N дней, ограничения/только PAYG.

### Смена плана
1. Апгрейд: сразу пересчитать период, применить pro-rate credit/charge.
2. Дауngrade: поставить `cancel_at_period_end` + `next_plan_id`.
3. На следующий период активировать новый план и начислить included.

### Auto-topup
1. Баланс ниже порога.
2. Создать платёж на сумму auto_topup_amount.
3. Если платёж failed → выключить auto_topup после N попыток и уведомить.

### Возврат/chargeback
1. Webhook refund → ledger refund (плюс).
2. Если refund касается подписки → не увеличивать included, только вернуть topup.
3. Chargeback → выключить auto-renew и передать в ручную проверку.

## Детализация: UI
- Чат: бейдж диапазона цены, блокировка при превышении лимитов, кнопки “пополнить/перейти на план”.
- Баланс: отображать 2 кошелька, историю и статус авто-topup.
- Подписки: ясно показать included баланс и скидку.
- Настройки биллинга: email/телефон для receipt (54‑ФЗ).
- Админ: редактирование rate card и предпросмотр цен.
  - Админ Model Pricing:
    - Таблица: model_id, display_name, tier, modality, unit, price, status, effective_from.
    - Кнопки: “Add price”, “Deactivate”, “Apply tier defaults”.
    - Фильтр: Unpriced models.
- Уведомления (UX):
  - Low balance / баланс < порога.
  - Истекает top-up (12 мес) / истекает включённый баланс.
  - Ошибка авто-платежа / переход в `past_due`.
  - Превышение daily_cap или max_reply_cost.

## Детализация: безопасность, комплаенс, логирование
- Webhook подписи YooKassa — обязательная проверка; при ошибке возвращать 401.
- Логи без PII/секретов, только `user_id`, `payment_id`, `request_id`.
- Любые ручные корректировки пишем в `audit_log` с `changes`.
- Включить rate limit на публичные billing endpoints.
- Все warnings по `is_estimated` пишем в лог с меткой `BILLING_ESTIMATE_ONLY`.
  - Логируем на уровне WARNING (видно в контейнерных логах).
 - Разграничение доступа: все admin endpoints только для `admin`.
- Ретеншн ledger/usage_events — минимум 24 месяца (для фин. аудита).
 - Фискализация (54‑ФЗ):
   - Передавать `receipt` в YooKassa (наименование услуги, сумма, ставка НДС).
   - Хранить email/телефон покупателя в профиле (запрашивать при первом платеже).
   - Если receipt обязателен — блокировать платеж с понятным сообщением.
 - Маскирование PII в raw payloads:
   - Очищать `raw_payload_json` от email/телефона/паспортных данных.

## Детализация: мониторинг и алерты
- Метрики:
  - `billing.hold.count`, `billing.hold.released`, `billing.hold.expired`.
  - `billing.charge.total_kopeks`, `billing.topup.total_kopeks`.
  - `billing.usage.estimated.count` (missing usage fallback).
  - `billing.webhook.errors`.
- Алерты:
  - Резкий рост `usage.estimated`.
  - Ошибки webhooks > X/час.
  - Несоответствие ledger vs wallet.
  - Резкий рост refund/chargeback.

## Детализация: онбординг и free access
- При регистрации: создать `wallets` и активировать lead magnet (без free plan).
- Lead magnet: модель‑allowlist + квоты на tokens/requests/images/tts по циклу.
- Для “гостя” без подписки: разрешать PAYG при наличии topup, иначе блок и апсейл.
- Привилегированный доступ выдаётся админом через планы с quotas = null (безлимит).

## Детализация: тестовая матрица
- PAYG: успешное пополнение → списание → история ledger.
- Подписка: покупка → начисление included → расход included → переход на topup.
- Streaming без usage: estimate-charge + warning log.
- Лимиты: max_reply_cost, daily_cap, quotas images/TTS.
- Автопополнение: успех/ошибка/N неудач → отключение.
- Dunning: ошибка автоплатежа → grace period → ограничения → cancel.
- Receipt: платеж без контакта → блок.
- Auto-topup retries: хранить счётчик фейлов и `last_failed_at`, ограничивать попытки в сутки и отключать при превышении.

## Детализация: что и где менять в коде

### Backend (Python/FastAPI)
- `backend/open_webui/models/billing.py`
  - Добавить новые SQLAlchemy модели (wallets, rate card, ledger, payments, usage_events, promo_codes).
  - Если файл превысит 500 строк — вынести в `models/billing_wallet.py`, `models/billing_pricing.py`.
- `backend/open_webui/utils/billing.py`
  - Вынести расчёт цены в `utils/pricing.py`.
  - Добавить `WalletService`/`LedgerService` для hold/settle/idempotency.
  - Обновить `get_user_billing_info` под кошельки и ledger.
- `backend/open_webui/utils/billing_integration.py`
  - Preflight/hold + finalize/settle для text/image/tts.
  - Фолбэк на estimate при отсутствии usage.
- `backend/open_webui/routers/billing.py`
  - Новые endpoints: balance, estimate, topup, auto-topup, ledger, settings.
  - Расширить `/billing/plans/public` для цены и лимитов.
  - Опционально: `/billing/models/pricing/public`.
- `backend/open_webui/routers/admin_billing.py`
  - CRUD rate card, promo codes, корректировки кошелька.
  - Список цен моделей для админки.
- `backend/open_webui/utils/yookassa.py`
  - Поддержка сохранённого payment_method (если доступно), auto-topup flow.
- `backend/open_webui/migrations/versions/`
  - Новая миграция со всеми новыми таблицами и полями.
- `backend/open_webui/utils/plan_templates.py`
  - Новые поля для планов (included/discount/limits/annual).
  - Обязательный seed для `free` (price=0, ограниченные tiers/квоты).
- Переходный режим: без dual-write; при необходимости краткосрочно отдаём read-only совместимые ответы в старом формате, но данные храним только в новой схеме.

### Frontend (Svelte/TypeScript)
- `src/lib/apis/billing/index.ts`
  - Новые типы: `Balance`, `LedgerEntry`, `Estimate`.
  - Новые методы: `getBalance`, `getEstimate`, `getLedger`, `topup`, `updateAutoTopup`, `updateBillingSettings`.
- `src/routes/(app)/billing/`
  - Добавить вкладки: `balance`, `history` (ledger), `settings`.
  - Обновить `dashboard` под новый баланс.
  - В `settings` добавить поля billing contact (email/phone).
- `src/routes/pricing/+page.svelte`
  - Перевести на `/billing/plans/public`.
- `src/routes/(app)/admin/billing/models/`
  - Страница Model Pricing (таблица цен моделей).
- Admin меню: добавить пункты Billing → Plans, Ledger/Balance (если нужно), Model Pricing.
- `src/lib/components/`
  - Компонент бейджа стоимости (estimate) для чата.
- `src/routes/(app)/c/[id]` (чат)
  - Генерировать `request_id` на каждый запрос и передавать в backend для идемпотентности.
- `src/lib/i18n/locales/{en-US,ru-RU}/translation.json`
  - Новые строки для кошелька/лимитов/ошибок.

## Детализация: конфигурация и фича-флаги
- `ENABLE_BILLING_WALLET=true` — включает новый кошелёк/ledger.
- `BILLING_DEFAULT_CURRENCY=RUB`.
- `BILLING_RATE_CARD_VERSION=2025-01`.
- `BILLING_HOLD_TTL_SECONDS=900`.
- `BILLING_MAX_DAILY_SPEND_DEFAULT_KOPEKS` — дефолт для новых пользователей.
- `BILLING_GRACE_PERIOD_DAYS=3`.
- `BILLING_TOPUP_TTL_DAYS=365` — срок жизни top-up баланса.
- `BILLING_TOPUP_PACKAGES_KOPEKS=19900,49900,99900,199900,499900`.
- Фича-флаг для поэтапного включения: сначала только estimate, потом hold/settle.

## Стартовые значения (MVP, редактируются через админку)

### A) Тарифы (рекомендованные)
- Этап 1: активны только Free и PAYG, остальные планы создаются, но скрыты/неактивны до запуска подписок.
- Free:
  - price: `0`
  - included: `0`
  - discount: `0%`
  - tiers: `Economy`
  - quotas: `tokens_input=100k`, `tokens_output=50k`, `requests=200`, `images=2`, `tts_seconds=300`
  - max_reply_cost: `2000` (20 ₽), daily_cap: `5000` (50 ₽)
- Start:
  - price: `29900`, included: `30000`, discount: `10%`
  - tiers: `Economy + Standard`
  - quotas: `images=20`, `tts_seconds=1800`
  - max_reply_cost: `5000` (50 ₽), daily_cap: `30000` (300 ₽)
- Plus:
  - price: `59900`, included: `70000`, discount: `20%`
  - tiers: `Economy + Standard + Premium`
  - quotas: `images=60`, `tts_seconds=7200`
  - max_reply_cost: `10000` (100 ₽), daily_cap: `70000` (700 ₽)
- Pro:
  - price: `169000`, included: `220000`, discount: `30%`
  - tiers: `All`
  - quotas: `images=200`, `tts_seconds=21600`
  - max_reply_cost: `20000` (200 ₽), daily_cap: `200000` (2000 ₽)
- PAYG (отдельный план):
  - price: `0`, included: `0`, discount: `0%`
  - tiers: `Economy + Standard` (можно расширить по мере данных)
  - лимиты задаются через `max_reply_cost` и `daily_cap`

### B) Годовые планы
- Цена: `monthly * 12 * 0.84` (‑16%).
- Included: `monthly_included * 12`.
- Остальные лимиты и tiers такие же, как у monthly.

### C) Rate card (стартовые правила)
- Единицы тарификации:
  - `token_in` и `token_out` (за 1000 токенов).
  - `image_1024` (1 изображение 1024px).
  - `tts_char` или `tts_sec` (выбрать одно для MVP).
- Platform factor по умолчанию:
  - text: `1.30`
  - images: `1.60`
  - tts: `1.25`
- Min charge:
  - text: `1` копейка
  - images: `500` копеек (5 ₽) как инфраструктурная надбавка
  - tts: `10` копеек
- Raw cost:
  - заполняется по фактической себестоимости провайдера (через админку);
  - для локальных моделей — `0`, но допускается `fixed_fee_kopeks`.

### D) Авто‑topup (дефолт)
- Этап 1: выключен по умолчанию, ручное включение.
- Рекомендация: `threshold=10000` (100 ₽), `amount=49900` (499 ₽), максимум 2 пополнения/день.
- Этап 2: допускается автопополнение вместе с авто-renew подписок при наличии payment_method.

### E) Модельные tiers (предложение)
- Economy: GPT-3.5/Haiku/Mini/Flash/OSS 7–8B, старые open models.
- Standard: GPT-4o-mini/Gemini Flash/Claude Sonnet-lite, OSS 14–32B.
- Premium: GPT-4o/Sonnet/Gemini Pro, OSS ≥70B.
- Ultra: GPT-4.1/Claude Opus/o1, будущие top-модели.

### F) Публичные витрины (TTL)
- `/billing/plans/public`: ETag + Cache-Control max-age=300s.
- `/billing/models/pricing/public` (если включим): ETag + max-age=300–900s.


## Решения/вводные, которые надо уточнить
1. Уточнить реальную себестоимость по ключевым моделям для заполнения raw_cost.
2. Проверить лимиты на старте после первых 2–4 недель данных.

## Принятые решения (на этот этап)
- Политика смены плана: апгрейд сразу с пропорциональным кредитом, даунгрейд в конце периода.
- Отсутствие `usage` от провайдера: списываем по estimate, фиксируем `is_estimated`, пишем warning в логи.
- Цены и тарифы должны обновляться централизованно: API `plans/public` — единственный источник для всех экранов и будущего лендинга.
- Тарификация дополнительных операций (RAG/embeddings/tools/files) — откладываем на следующий этап.
- На Этапе 1 тарификация embeddings/tools/files выключена (фича-флаг), включаем позже отдельным unit/fixed-fee.
- YooKassa: реализуем сохранение payment_method для auto-renew/auto-topup при наличии поддержки, иначе fallback на ручные платежи + уведомления.
- Top-up по умолчанию живёт 12 месяцев (параметризуем).

## Чек-лист реализации (BILLING-05)
- [x] Закрыть пробелы спецификации (кошелёк PK/FK, версионирование rate card, без dual-write, auto-topup fail tracking, SQLite locking).
- [x] Финализировать DDL/индексы: wallets/ledger/usage_events/payments/pricing_rate_card/promo + расширения plans/subscriptions/users; явные FK, unique, expires_at для top-up.
- [x] Alembic миграция: создать новые таблицы, добавить поля в существующие, перенести price→price_kopeks, создать кошельки всем пользователям, индексы; миграция хранит только новую схему (без dual-write).
- [ ] Seed: базовые планы (Free, PAYG, Start/Plus/Pro + годовые) + rate card defaults сделаны; топап-пакеты заданы через ENV, остаётся договориться о финальных значениях.
- [ ] Backend сервисы:
  - [x] pricing.py (rounding/discount/versioning), wallet/ledger (hold/charge/release), admin rate card CRUD/sync.
  - [x] billing_integration preflight/finalize (hold/settle + usage_events).
  - [x] YooKassa top-up + payments/ledger integration + auto-topup flow.
- [x] Пайплайны: текст/images/TTS hold/settle + usage_events интегрированы, лимиты max_reply_cost/daily_cap учтены.
- [x] Frontend: API клиенты (balance/estimate/ledger/topup/settings), UI (balance/history/settings, чатовый estimate badge, admin model pricing, pricing page → plans/public), i18n строки.
- [ ] Тесты: unit + router (pricing, wallet flows, promo; done: single-rate hold/settle image/TTS + OpenAI speech, preflight guardrails, release-on-error, wallet service, pricing unit, topup webhook idempotency/status, charge-exceeds-hold), integration (YK webhook idempotency, auto-topup, лимиты), E2E (top-up, estimate, блокировки), покрытие ≥80%.
- [ ] Роллаут: последовательность включения фича-флагов (estimate → hold/settle → подписки), мониторинг, обратное отключение фичей при сбоях.

## Backend дизайн (MVP PAYG + подготовка подписок)

### Сервисы и модули
- `utils/pricing.py`:
  - Интерфейс: `get_rate_card(model_id, modality, unit, as_of)`; `estimate_cost(units, rate, plan_discount_percent) -> (min,max)`; `round_cost` по правилам rate card; поддержка `fixed_fee_kopeks`, `min_charge_kopeks`, `platform_factor`.
  - Версионирование: возвращает `pricing_rate_card_id` и `version` для записи в `usage_events`.
  - Поддерживаем модальности text/image/tts; units: `token_in`, `token_out`, `image_1024`, `tts_char|tts_sec`.
- `utils/wallet.py` (или подмодуль в `utils/billing.py`):
  - `hold(wallet_id, amount, reference_id/type, expires_at)` — уменьшает доступный баланс (included→topup), пишет ledger `hold`.
  - `settle(wallet_id, hold_reference, actual_amount)` — пишет `charge` и `release` разницы; если actual > hold — отказ/доп. проверка.
  - `release_hold(wallet_id, hold_reference)` — возврат hold.
  - `apply_topup(wallet_id, amount, payment_id, expires_at)` — ledger `topup`, обновляет баланс.
  - Все операции в транзакции с блокировкой строки кошелька; SQLite — IMMEDIATE транзакция.
  - Idempotency: уникальные `(reference_type, reference_id, type)` и `idempotency_key`.
- `utils/billing.py`:
  - `get_user_billing_info` обновить под кошелёк/лимиты.
  - Логика discount/included: списание included перед topup, применение `discount_percent` плана при settle.
  - Промокоды: начисление бонуса в wallet (ledger `adjustment` или `promo` внутри metadata).
- `utils/billing_integration.py`:
  - `preflight_estimate_hold(user, request)` → estimate (pricing) + лимиты max_reply_cost/daily_cap + tiers; создаёт `request_id` if absent.
  - `finalize_settle(user, request_id, usage)` → settle/charge, запись `usage_events`, `is_estimated` при отсутствии usage.
  - Поддержка text/images/TTS; images — расчёт по размеру/кол-ву; TTS — chars/seconds.
- `utils/yookassa.py`:
  - Метод `create_topup_payment(amount_kopeks, return_url, metadata {kind:topup, wallet_id, user_id})`.
  - Метод `create_subscription_payment` (для этапа 2).
  - Хранение `payment_method_id` (если поддержано) для будущего auto-topup/renew.

### API контракты (MVP PAYG)
- Пользовательские:
  - `GET /billing/balance` → `{ balance_topup_kopeks, balance_included_kopeks, included_expires_at, daily_cap_kopeks, daily_spent_kopeks, max_reply_cost_kopeks, currency }`.
  - `POST /billing/estimate` → `{ min_kopeks, max_kopeks, is_allowed, reason?, pricing_rate_card_id, pricing_version }`.
  - `POST /billing/topup` → `{ payment_id, confirmation_url }` (сумма из списка пакетов).
  - `POST /billing/auto-topup` → toggle/update threshold/amount.
  - `GET /billing/ledger` → пагинация/фильтры type/date; source `ledger_entries`.
  - `POST /billing/settings` → update `max_reply_cost_kopeks`, `daily_cap_kopeks`, billing contacts.
- Админ:
  - `POST /admin/billing/rate-card` CRUD.
  - `POST /admin/billing/rate-card/sync-models` — создать placeholders для непрайсованных моделей.
  - `POST /admin/billing/plans` — расширенные поля (included/discount/tiers/quotas/annual).
  - `POST /admin/billing/promo` CRUD.
  - `GET /admin/billing/models/pricing` — таблица цен.

### Платёжный поток (top-up)
1) `POST /billing/topup` → создаём платеж (YooKassa) с metadata `{kind: "topup", wallet_id, user_id}`; валидируем контакт для receipt.
2) Пользователь платит; webhook `payment.succeeded`:
   - Idempotency по `provider_payment_id`.
   - Находит wallet (по metadata) → ledger `topup` с `expires_at` (TTL 12 мес), обновляет баланс.
3) Если webhook повторяется → нет двойного списания (idempotency).

### Ограничения и лимиты
- `max_reply_cost_kopeks` и `daily_cap_kopeks` читаем из `wallets` (пользовательские настройки или дефолты); проверяем в preflight.
- Доступные модели: по `model_tiers_allowed` плана (или PAYG плана).
- Недостаток средств/лимитов → 402/429 с кодом для UI апсейла.

### Логи/метрики
- Логируем `request_id`, `wallet_id`, `pricing_rate_card_id`, `is_estimated`.
- Метрики: hold/denied, charge totals, topup totals, estimated_usage_count, webhook_errors.

### Разграничение и безопасность
- Все billing endpoints за аутентификацией; admin — только роль admin.
- YooKassa webhooks — проверка подписи; без PII в логах.

## Frontend план
- API клиенты (`src/lib/apis/billing/index.ts`):
  - Методы: `getBalance`, `getEstimate`, `getLedger`, `topup`, `updateAutoTopup`, `updateBillingSettings`, `getPlansPublic` (новые поля цены/лимитов), опционально `getModelPricingPublic`.
  - Типы: `Balance`, `LedgerEntry`, `Estimate`, расширенный `Plan` (price_kopeks, included_kopeks, discount_percent, max_reply_cost_kopeks, daily_cap_kopeks, model_tiers_allowed, quotas по модальностям).
- Пользовательский UI:
  - `/billing` страницы: вкладки `balance` (кошелёк, auto-topup toggle, промокод поле), `history` (ledger с фильтрами), `settings` (лимиты max_reply_cost/daily_cap + контакты для receipt), обновлённый dashboard.
  - `/pricing` публичная страница — берёт данные из `/billing/plans/public`, отображает Free/PAYG/Start/Plus/Pro + годовые (скидка -16%), без хардкодов цен.
  - Чат (`routes/(app)/c/[id]`): генерировать `request_id`, отображать бейдж estimate `~X ₽` перед отправкой, блок/апсейл при 402/429 (недостаток средств/квот/лимитов).
  - Показать лимиты/квоты по картинкам/TTS, если доступны в плане.
- Админ UI:
  - Раздел Model Pricing (`/admin/billing/models`): таблица с model_id, tier, modality, unit, price, status, effective_from, фильтр “Unpriced”.
  - Расширение планов: редактирование included/discount/tiers/квоты по модальностям, годовые флаги.
  - Промокоды: CRUD интерфейс.
- i18n:
  - Добавить строки для кошелька, авто-topup, лимитов, ошибок 402/429, estimate badge, ledger типов.
- Фича-флаги/UX:
  - Флаг `ENABLE_BILLING_WALLET` — включает UI кошелька/ledger/estimate.
  - Блоки/апсейлы в чатах при нехватке средств/лимитов с кнопками “Пополнить”/“Выбрать план”.

## Пайплайны (интеграция в OpenWebUI)
- Текст (`routers/openai.py`):
  - Preflight: `POST /billing/estimate` → проверка лимитов/tiers → `hold` через billing_integration; прокидываем лимит токенов из estimate.
  - Финализация: получить usage (tokens); если нет usage — charge=estimate, `is_estimated=true`.
  - Обработка отмен/таймаутов → `release_hold`.
- Изображения (`routers/images.py`):
  - Estimate по модели/размеру/количеству; hold перед запросом; settle по факту или по estimate при ошибке.
- TTS/STT (соответствующие роуты):
  - Estimate по символам/секундам; hold/settle аналогично.
- Общие ошибки:
  - Недостаток средств/лимита: 402 (insufficient_funds) / 429 (quota_exceeded) с reason для UI.
  - Отсутствие usage: warning log `BILLING_ESTIMATE_ONLY`, `is_estimated=true`.

## Тесты и роллаут
- Unit:
  - pricing: rounding/min_charge/fixed_fee/discount, выбор версии rate card.
  - wallet/ledger: hold/settle/release, порядок списания included→topup, превышение hold, idempotency ключи.
  - promo: начисление бонуса, лимиты per_user/usage_limit.
  - лимиты: max_reply_cost/daily_cap расчёт доступного остатка.
- Integration:
  - YooKassa webhook idempotency (payment.succeeded повторно не удваивает баланс).
  - Auto-topup: порог → платёж → зачисление; повторные фейлы → отключение.
  - PAYG без подписки: успешный запрос при наличии топапа; отказ при 0 балансе; дневной лимит.
  - Image/TTS сценарии с hold/settle и fallback на estimate при ошибке.
- E2E (Playwright/Vitest):
  - Покупка top-up пакета, отображение в балансе/ledger.
  - Estimate badge в чате, блокировка при нехватке средств, кнопка “Пополнить”.
  - Ledger фильтры, auto-topup toggle, обновление лимитов в settings.
- Покрытие: ≥80% для нового кода (pytest + Vitest/Playwright по необходимости).
- Роллаут/фича-флаги:
  - ENV: `ENABLE_BILLING_WALLET`, `BILLING_RATE_CARD_VERSION`, `BILLING_HOLD_TTL_SECONDS`, `BILLING_MAX_DAILY_SPEND_DEFAULT_KOPEKS`.
  - Этапность: включить `/billing/plans/public` + estimate (без hold), затем hold/settle для text/images/TTS, затем подписки/annual.
  - Откат: флагом отключить hold/settle → вернуть только estimate, блокировать платные запросы, если критичные ошибки.
  - Мониторинг: алерты на webhook errors, рост `usage.estimated`, рассинхрон ledger vs wallet, рост отказов 402/429.
