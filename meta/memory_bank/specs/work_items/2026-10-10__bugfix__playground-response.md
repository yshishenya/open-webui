# Тестовый чат: отказ ответа и отмена

Status: Done
Workflow: bug_fix
Owner: Codex
SDD Spec: meta/sdd/specs/completed/airis-playground-response-2026-10-10-037.json

## Цель и критерии

- [x] Проследить оба режима playground, Message/экспорт/параметры и все три chatCompletion callers.
- [x] Воспроизвести зависшую загрузку при отказе запроса/чтения и ожидание следующего chunk при отмене.
- [x] Один прежний AbortController отменяет и ожидание ответа, и чтение; finally сбрасывает состояние без повторной отправки.
- [x] Реальные message/parameter types переиспользованы; нет Any/подавлений/новых зависимостей.
- [x] Частичный текст, роли, системное сообщение, параметры, экспорт/редактирование/удаление сохранены.
- [x] Реальные handlers обоих режимов проходят проверки; полный frontend и все обязательные lintцели проходят, новых диагностик0.
- [x] Сохранность и SDD подтверждены; проверенный блок подготовлен к commit/push и синхронизации частных планов. Production/A/B отдельно.

## Решение и Upstream impact

chatCompletion уже возвращает Response и свой AbortController. Передать
ему необязательный ранее созданный controller, сохраняя default и tuple
для прямого запроса из root layout. Оба playground submit используют его
до ожидания HTTP, отменяют при действии пользователя и сбрасывают loading
в finally. Отказ/пустое тело дают безопасную ошибку без сырых provider данных;
reader lock освобождается в finally. Повторных POST нет.
Переиспользовать GenerationParams и ChatHistoryMessage/ChatHistory для
существующих данных. Минимальные hooks в upstream API/четырёх компонентах,
без нового runtime-helper или пакета. Локальные контролируемые ответы
не заменяют внешний provider/production/payments или браузерную приёмку.

## Проверки и откат

Docker Compose: реальные обработчики до/после, обычный текст/ошибки/отмена,
scoped lint всех актуальных targets, Prettier, полный frontend/types/ESLint.
Backend reused только после сверки неизменённых исходников/config.
Отдельный commit допускает откат. Evidence:
/Users/yshishenya/.codex/private-artifacts/airis-playground-response-20261010.

## Локальный результат

На одинаковых окончательных тестах исходный вариант: 2 прошли / 15 отказов;
после правок: 17/17 реальных обработчиков плюс 1/1 настоящего DOM-компонента.
API/default-controller/root direct caller: ещё 26/26; всего целевые 44/44.
Запрос/204-body/late-read failure, pending HTTP/read cancellation, concurrent
Run, отсутствие textarea и DONE без закрытия HTTP проверены без второго POST.
Частичный текст сохраняется; тип содержимого проверяется перед добавлением.
Контролируемые ответы и ожидания — тестовые; внешнего provider/браузера нет.
Редактирование и удаление настоящих сообщений проверены в DOM.
Frontend 2105/2105, failed/pending/todo0; все 18 новых случаев есть в полном наборе.
Все 226 актуальных changed-file lint целей: 0/0; Prettier прошёл.
Types 687/74 → 654/68; ESLint 586 → 556; новых диагностик0.
Первый общий прогон с9новыми замечаниями optional messages не принят;
локальный массив уточнён через NonNullable, все общие этапы повторены.
Два child JS, четыре emitted CSS и четыре остальных callbacks совпадают
после только заявленного удаления unused imports/context/event args/двух
unused CSS selectors. Эквивалентность response handlers не заявляется.
Все 6878 файлов заморожены и сверены на общих этапах.
Backend 1064/25 warnings reused после сверки 565 backend/config файлов;
нового backend-прогона нет. Production healthy/restarts0, 12 соседей,
21 чужой файл и 262 тома сохранены. Образ/deploy не создавались.
Общие quality gates, интеграция/выпуск и A/B остаются открытыми.
