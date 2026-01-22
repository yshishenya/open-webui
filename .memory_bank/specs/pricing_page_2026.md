# Спецификация: страница /pricing (2026)

## Цель
Объяснить модель оплаты простым языком (пополнение баланса → списания только за использование → без подписки), показать бесплатный старт, дать ориентир по стоимости и прозрачные ставки по моделям из Rate Card, обеспечить CTA для гостя/авторизованного.

## Источники данных
- **Rate Card**: единственный источник ставок по моделям (3–50 моделей). Возвращает ставки по модальностям, provider, capabilities, updated_at.
- **Конфиг/бэк**:
  - суммы пополнения (фиксированные)
  - бесплатные лимиты (lead magnet quotas)
  - список популярных моделей
  - рекомендованные модели для калькулятора

## Секции (порядок)
1. Header (sticky)
2. Hero (оплата по использованию + CTA + суммы пополнения + карточка «Как устроена оплата»)
3. Estimator (#estimator, soft фон)
4. Free start (#free, белый фон)
5. Rates table (#rates, soft фон)
6. Calculation (#calculation, белый фон)
7. FAQ (#faq, белый фон)
8. Final CTA (#cta, контрастный фон + суммы пополнения)
9. Footer

## Ключевой копирайт
- «Пополняете баланс» / «Списания только за использование» / «Без подписки и ежемесячных платежей» / «История списаний в личном кабинете».
- Запрещено: «PAYG», «Платите по факту», «Цена до отправки».

## Rate Card API (публичный)
- Возвращает `currency`, `updated_at`, список `models`.
- Модель включает `id`, `display_name`, `provider`, `capabilities`, `rates`.
- `rates` может содержать `null` для неподдерживаемых функций (UI показывает «—»).

## Pricing Config API (публичный)
- `topup_amounts_rub`: массив фиксированных сумм пополнения
- `free_limits`: текстовые лимиты, изображения, tts/stt (в минутах)
- `popular_model_ids`
- `recommended_model_ids` (text/image/audio)

## Поведение и фоллбеки
- Если Rate Card недоступен: таблица ставок показывает сообщение, Estimator скрывает суммы (или «—»), CTA остаются.
- updatedAt отображается в блоке ставок.
- Таблица ставок: поиск, фильтры, «Показать все модели».

## Аналитика
- pricing_hero_primary_click
- pricing_hero_secondary_click
- pricing_topup_amounts_visible
- pricing_estimator_tab_change
- pricing_estimator_change (debounce)
- pricing_estimator_preset_click
- pricing_rates_expand_all_click
- pricing_rates_search
- pricing_rates_filter_change
- pricing_faq_open (question_id)
- pricing_final_cta_click

## Acceptance criteria
- На странице нет «PAYG», «платите по факту», «цена до отправки».
- Суммы пополнения явно показаны минимум в 2 местах (Hero + Final CTA).
- RatesTable показывает 3–50 моделей из Rate Card, с null → «—».
- При ошибке Rate Card есть fallback, страница не ломается.
- CTA меняется по статусу (guest/authed).
- Бесплатные лимиты из единого источника.
