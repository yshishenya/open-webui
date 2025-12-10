# Настройка биллинга и ЮKassa

Это руководство описывает настройку системы биллинга для B2C версии AIris.

## Обзор

Система биллинга включает:
- ✅ Управление тарифными планами
- ✅ Подписки пользователей
- ✅ Интеграция с ЮKassa (платежный шлюз для России)
- ✅ Трекинг использования моделей (токены, запросы)
- ✅ Контроль квот
- ✅ История транзакций

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

## 2. Конфигурация AIris

### Переменные окружения

Добавьте в `.env` файл:

```bash
####################################
# Billing & YooKassa Configuration
####################################

# YooKassa Shop ID
YOOKASSA_SHOP_ID='ваш_shop_id'

# YooKassa Secret Key
YOOKASSA_SECRET_KEY='ваш_secret_key'

# YooKassa Webhook Secret (опционально, для безопасности)
YOOKASSA_WEBHOOK_SECRET='ваш_webhook_secret'

# YooKassa API URL (можно оставить по умолчанию)
YOOKASSA_API_URL='https://api.yookassa.ru/v3'
```

### Проверка конфигурации

После запуска AIris проверьте логи:

```bash
docker-compose logs -f airis
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

Создайте файл `setup_plans.py`:

```python
import time
from open_webui.models.billing import PlanModel, Plans

# Free план
free_plan = PlanModel(
    id="free",
    name="Free",
    name_ru="Бесплатный",
    description="Basic access to AI models",
    description_ru="Базовый доступ к AI моделям",
    price=0.0,
    currency="RUB",
    interval="month",
    quotas={
        "tokens_input": 100000,
        "tokens_output": 50000,
        "requests": 1000,
    },
    features=["gpt35_access"],
    is_active=True,
    display_order=0,
    created_at=int(time.time()),
    updated_at=int(time.time()),
)

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
Plans.create_plan(free_plan)
Plans.create_plan(pro_plan)
print("Планы созданы!")
```

## 4. API Endpoints

### Для пользователей

```bash
# Получить список планов
GET /api/v1/billing/plans

# Получить свою подписку
GET /api/v1/billing/subscription

# Создать платеж
POST /api/v1/billing/payment
{
  "plan_id": "pro",
  "return_url": "https://yourdomain.ru/billing/success"
}

# Отменить подписку
POST /api/v1/billing/subscription/cancel
{
  "immediate": false
}

# Получить использование
GET /api/v1/billing/usage/tokens_input

# Проверить квоту
POST /api/v1/billing/usage/check
{
  "metric": "tokens_input",
  "amount": 1000
}

# Полная информация о биллинге
GET /api/v1/billing/me
```

### Для администраторов

```bash
# Создать новый план
POST /api/v1/billing/plans
```

## 5. Как работает система

### 1. Проверка квот

Перед каждым запросом к модели:

```python
# Автоматически проверяется
if user.has_active_subscription:
    check_quota(user_id, metric="requests", amount=1)
    check_quota(user_id, metric="tokens_input", estimated_amount)
```

Если квота превышена → HTTP 429 Too Many Requests

### 2. Трекинг использования

После получения ответа от модели:

```python
# Автоматически сохраняется
track_usage(
    user_id=user.id,
    metric="tokens_input",
    amount=150,  # из response.usage.prompt_tokens
    model_id="gpt-4",
    chat_id="chat_123"
)
```

### 3. Оплата

1. Пользователь выбирает план
2. Создается платеж через ЮKassa
3. Пользователь перенаправляется на страницу оплаты
4. После оплаты ЮКassa отправляет webhook
5. Создается/продлевается подписка

## 6. База данных

Система создает 4 таблицы:

- `billing_plan` - тарифные планы
- `billing_subscription` - подписки пользователей
- `billing_usage` - использование ресурсов
- `billing_transaction` - история платежей

Миграция применяется автоматически при запуске.

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
docker-compose logs -f airis | grep BILLING

# Webhook события
docker-compose logs -f airis | grep "webhook"

# Ошибки квот
docker-compose logs -f airis | grep "quota"
```

## 10. Troubleshooting

### Проблема: Webhook не приходят

- ✅ Проверьте URL в настройках ЮКassa
- ✅ Убедитесь что домен доступен извне
- ✅ Проверьте логи: `grep webhook`

### Проблема: Квоты не работают

- ✅ У пользователя должна быть активная подписка
- ✅ Проверьте что план имеет quotas
- ✅ Проверьте логи: `grep quota`

### Проблема: Usage не трекается

- ✅ Трекинг только для пользователей с подпиской
- ✅ API должен возвращать `usage` в ответе
- ✅ Проверьте логи: `grep "Tracked.*tokens"`

## Поддержка

При возникновении проблем:
1. Проверьте логи
2. Убедитесь что все переменные окружения заданы
3. Проверьте миграции: `docker-compose exec airis alembic current`
