# Настройка биллинга и ЮKassa

Это руководство описывает настройку системы биллинга для B2C версии Airis.

## Обзор

Airis billing состоит из двух независимых режимов (feature flags):

- `ENABLE_BILLING_WALLET=true` — кошелек (PAYG) + списание по rate cards + пополнения через YooKassa.
- `ENABLE_BILLING_SUBSCRIPTIONS=true` — подписки и тарифные планы (обычно выключено).

Дополнительно:

- `LEAD_MAGNET_ENABLED=true` — "lead magnet" квоты на ограниченный набор моделей.

Что реально поддерживается в коде:

- ✅ YooKassa: платежи, webhooks
- ✅ Wallet (баланс, ledger, история транзакций)
- ✅ Rate cards / public pricing endpoints для публичных страниц
- ✅ Подписки/планы (только если включить `ENABLE_BILLING_SUBSCRIPTIONS`)

## 1. Настройка ЮKassa

### Шаг 1: Регистрация в ЮKassa

1. Зарегистрируйтесь на https://yookassa.ru
2. Пройдите процесс верификации
3. Создайте магазин

### Шаг 2: Получение API ключей

1. Войдите в личный кабинет ЮКassa
2. Перейдите в раздел "Настройки" → "API и Webhook"
3. Скопируйте:
   - **Shop ID** (идентификатор магазина)
   - **Secret Key** (секретный ключ)

### Шаг 3: Настройка Webhook

1. В разделе "Настройки" → "Уведомления"
2. Добавьте URL для webhook: `https://ваш-домен.ru/api/v1/billing/webhook/yookassa`
3. Выберите события:
   - `payment.succeeded` - успешная оплата
   - `payment.canceled` - отмена платежа
   - `payment.waiting_for_capture` - ожидание подтверждения
4. Скопируйте **Webhook Secret** (опционально, для верификации)

## 2. Конфигурация Airis

### Переменные окружения

Добавьте в `.env` файл (ориентируйтесь на `.env.example`):

```bash
####################################
# Billing & YooKassa Configuration
####################################

ENABLE_BILLING_WALLET=true
ENABLE_BILLING_SUBSCRIPTIONS=false
LEAD_MAGNET_ENABLED=false

BILLING_DEFAULT_CURRENCY=RUB
BILLING_RATE_CARD_VERSION=2025-01
BILLING_HOLD_TTL_SECONDS=900
BILLING_TOPUP_TTL_DAYS=365
BILLING_TOPUP_PACKAGES_KOPEKS=100000,150000,500000,1000000

YOOKASSA_SHOP_ID=...
YOOKASSA_SECRET_KEY=...
YOOKASSA_WEBHOOK_SECRET=...
YOOKASSA_API_URL=https://api.yookassa.ru/v3

# Webhook URL настраивается в кабинете YooKassa (это не env var бэка)
# Укажите endpoint: https://ваш-домен.ru/api/v1/billing/webhook/yookassa
```

### Проверка конфигурации

После запуска Airis проверьте логи:

```bash
docker compose logs -f airis
```

Должна появиться строка:

```
INFO: YooKassa billing client initialized
```

Если не настроено:

```
INFO: YooKassa billing not configured (set YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY to enable)
```

## 3. Создание тарифных планов

### Через API

Важно: endpoints управления планами доступны только при `ENABLE_BILLING_SUBSCRIPTIONS=true`.

```bash
# Авторизуйтесь как admin
curl -X POST "http://localhost:3000/api/v1/billing/plans" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pro",
    "name_ru": "Профессиональный",
    "description": "Advanced features and higher quotas",
    "description_ru": "Расширенные возможности и увеличенные квоты",
    "price": 990.00,
    "currency": "RUB",
    "interval": "month",
    "quotas": {
      "tokens_input": 1000000,
      "tokens_output": 500000,
      "requests": 10000
    },
    "features": [
      "gpt4_access",
      "claude_access",
      "priority_support"
    ],
    "is_active": true,
    "display_order": 1
  }'
```

### Через Python скрипт

Важно: это пример для subscriptions режима.

Создайте файл `setup_plans.py`:

```python
import time
from open_webui.models.billing import PlanModel, Plans

# Pro план
pro_plan = PlanModel(
    id="pro",
    name="Pro",
    name_ru="Профессиональный",
    description="Advanced features and higher quotas",
    description_ru="Расширенные возможности и увеличенные квоты",
    price=990.0,
    currency="RUB",
    interval="month",
    quotas={
        "tokens_input": 1000000,
        "tokens_output": 500000,
        "requests": 10000,
    },
    features=["gpt4_access", "claude_access"],
    is_active=True,
    display_order=1,
    created_at=int(time.time()),
    updated_at=int(time.time()),
)

# Сохранение
Plans.create_plan(pro_plan)
print("План создан!")
```

## 4. API Endpoints

### Для пользователей

```bash
# Wallet (если ENABLE_BILLING_WALLET=true)
GET /api/v1/billing/balance
GET /api/v1/billing/ledger
GET /api/v1/billing/transactions
GET /api/v1/billing/usage-events
POST /api/v1/billing/topup
POST /api/v1/billing/auto-topup
POST /api/v1/billing/settings

# Subscriptions / plans (если ENABLE_BILLING_SUBSCRIPTIONS=true)
GET /api/v1/billing/plans
GET /api/v1/billing/subscription
POST /api/v1/billing/payment
POST /api/v1/billing/subscription/cancel
POST /api/v1/billing/subscription/resume

# Misc
POST /api/v1/billing/usage/check
GET /api/v1/billing/me

# Public endpoints (для лендинга /pricing)
GET /api/v1/billing/public/lead-magnet
GET /api/v1/billing/public/pricing-config
GET /api/v1/billing/public/rate-cards
```

### Для администраторов

```bash
# Создать новый план
POST /api/v1/billing/plans
```

## 5. Как работает система

В Airis есть 3 независимых источника биллинга (billing_source):

- `lead_magnet` — бесплатные квоты на ограниченный список моделей.
- `payg` — кошелек (wallet): hold -> settle, списания по rate cards.
- `subscription` — подписки/планы (если включены).

### 1. Preflight / ограничения перед запросом

Перед каждым запросом к модели система определяет, как именно будет списание:

- если модель разрешена для lead magnet и есть доступные квоты → используется `lead_magnet` (hold в кошельке не делается)
- иначе (PAYG) → проверяется кошелек: лимиты, daily cap, max reply cost, затем создается hold

Ошибки, которые может вернуть preflight:

- `402 Payment Required` (`insufficient_funds`, `max_reply_cost_exceeded`)
- `429 Too Many Requests` (`daily_cap_exceeded`)
- `422 Unprocessable Content` (`modality_disabled`)

### 2. Списание и трекинг

После генерации ответа:

- для `lead_magnet`: списываются единицы из lead-magnet state (`tokens_*`, `images`, `tts_seconds`, `stt_seconds`)
- для `payg`: hold конвертируется в settle (списание с кошелька) и пишется usage event / ledger
- для `subscription` (если включено): usage пишется в usage tracking; квоты берутся из плана

### 3. Оплата / пополнение (wallet)

1. Пользователь делает top-up (создается платеж YooKassa)
2. Пользователь переходит на страницу оплаты YooKassa
3. YooKassa отправляет webhook на `/api/v1/billing/webhook/yookassa`
4. Бэк подтверждает оплату и зачисляет средства в кошелек

Подписки работают отдельным флоу и доступны только при `ENABLE_BILLING_SUBSCRIPTIONS=true`.

## 6. База данных

Схема включает:

- подписки/планы (если включены): `billing_plan`, `billing_subscription`, `billing_usage`, `billing_transaction`
- кошелек/PAYG: wallet/ledger/payments/rate cards/usage events (см. модели billing wallet)
- lead magnet: lead magnet state (использование квот по циклам)

Миграции применяются автоматически при запуске.

## 7. Безопасность

✅ **Webhook верификация** - HMAC-SHA256 подпись
✅ **Проверка квот** - перед каждым запросом
✅ **Транзакционность** - атомарные операции
✅ **Логирование** - все операции логируются

## 8. Тестирование

### Тестовый режим ЮКassa

1. В личном кабинете ЮКassa включите "Тестовый режим"
2. Используйте тестовые карты:
   - Успешная оплата: `5555 5555 5555 4444`
   - Отклонение: `5555 5555 5555 5599`

### Локальное тестирование webhook

Используйте ngrok для локальной разработки:

```bash
ngrok http 3000
# Используйте HTTPS URL в настройках ЮКassa
```

## 9. Мониторинг

Проверяйте логи:

```bash
# Все логи биллинга
docker compose logs -f airis | grep BILLING

# Webhook события
docker compose logs -f airis | grep "webhook"

# Ошибки квот
docker compose logs -f airis | grep "quota"
```

## 10. Troubleshooting

### Проблема: Webhook не приходят

- ✅ Проверьте URL в настройках ЮКassa
- ✅ Убедитесь что домен доступен извне
- ✅ Проверьте логи: `grep webhook`

### Проблема: Квоты не работают

Зависит от режима:

- lead magnet: проверьте `LEAD_MAGNET_ENABLED=true` и что у модели стоит `meta.lead_magnet=true`
- subscriptions: проверьте `ENABLE_BILLING_SUBSCRIPTIONS=true` и что у плана заданы `quotas`

Полезные логи: `grep -i "lead magnet\|quota\|billing"`

### Проблема: Usage / списания не видны

- PAYG wallet: проверьте, что `ENABLE_BILLING_WALLET=true` и что запросы не падают в `insufficient_funds`
- Lead magnet: проверьте `/api/v1/billing/lead-magnet` (user) или `/api/v1/billing/public/lead-magnet` (public), а также `/api/v1/billing/usage-events`
- Подписки: проверьте, что subscriptions включены и у пользователя есть subscription

## Поддержка

При возникновении проблем:

1. Проверьте логи
2. Убедитесь что все переменные окружения заданы
3. Проверьте миграции: `docker compose exec airis alembic current`
