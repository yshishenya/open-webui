# Пустые контакты для чеков не являются ошибкой

- Type: bugfix
- Status: completed (technical release)
- Owner: Codex
- Branch: codex/bugfix/billing-empty-contacts
- SDD Spec: meta/sdd/specs/completed/analytics-billing-ui-2026-10-04-118.json

## Goal / Acceptance Criteria

На существующем аккаунте без сохранённой информации экран настроек показывает пустые доступные поля контактов. Ошибка HTTP по-прежнему блокирует редактирование; данные существующего аккаунта сохраняются. Никакие контакты и финансовые настройки при проверке не записываются.

## Cause / fix

GET /users/user/info успешно отвечал 200 null при отсутствии user.info. Единственный frontend caller считает null ошибкой загрузки. Нормализовать отсутствие информации в пустой объект в общем endpoint. Переиспользовать существующий HTTP тест пользователя: пустое состояние проверяет {}, заполненное — прежние данные.

## Upstream impact

Нормализация ответа и конкретные type hints в upstream users.py: nullable response contract уже разрешает объект. Все callers проверены: getUserInfo используется только балансом. Записи в базе и ответ с существующими данными не меняются. Новых зависимостей и миграций нет.

## Verification / Rollout

Тест старого exact image падает на 200 null вместо {}. Два HTTP теста с исправлением прошли; заполненная информация сохраняется. Ещё требуется exact backend overlay; frontend bytes неизменны. Далее независимая проверка, PR/CI, guarded deployment и live browser с пустыми полями.

## Завершение

PR220 merged 76a2c58b13b6cd9e3192ff32fe0fd1f489cdc0e4. Source d33ac79d021b68a2071b5c965fe11caa3742075b, immutable digest fb0583cc0667c693c0acf38f1b7ee36526ebd219d57be9dfdb84f6b17554b3f8. Старый образ падает на обновлённом тесте; два теста exact нового образа прошли. Независимая проверка без блокеров; PR-fast, release-heavy, merge-medium и остальной CI прошли. Опубликовано и подтверждено в существующем обычном аккаунте: пустые поля доступны, ложной ошибки нет, сохранение отключено до изменения. Контакты и финансовые настройки не записывались. Black unchanged; Ruff 9 inherited findings exactly equal to baseline.
