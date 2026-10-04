# Пустые контакты для чеков не являются ошибкой

- Type: bugfix
- Status: in_progress
- Owner: Codex
- Branch: codex/bugfix/billing-empty-contacts
- SDD Spec: meta/sdd/specs/active/analytics-billing-ui-2026-10-04-118.json

## Goal / Acceptance Criteria

На существующем аккаунте без сохранённой информации экран настроек показывает пустые доступные поля контактов. Ошибка HTTP по-прежнему блокирует редактирование; данные существующего аккаунта сохраняются. Никакие контакты и финансовые настройки при проверке не записываются.

## Cause / fix

GET /users/user/info успешно отвечал 200 null при отсутствии user.info. Единственный frontend caller считает null ошибкой загрузки. Нормализовать отсутствие информации в пустой объект в общем endpoint. Переиспользовать существующий HTTP тест пользователя: пустое состояние проверяет {}, заполненное — прежние данные.

## Upstream impact

Нормализация ответа и конкретные type hints в upstream users.py: nullable response contract уже разрешает объект. Все callers проверены: getUserInfo используется только балансом. Записи в базе и ответ с существующими данными не меняются. Новых зависимостей и миграций нет.

## Verification / Rollout

Тест старого exact image падает на 200 null вместо {}. Два HTTP теста с исправлением прошли; заполненная информация сохраняется. Ещё требуется exact backend overlay; frontend bytes неизменны. Далее независимая проверка, PR/CI, guarded deployment и live browser с пустыми полями.
