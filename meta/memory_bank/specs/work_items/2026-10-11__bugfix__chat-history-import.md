# AIRIS — безопасное чтение истории чатов

- Workflow: bug_fix
- Status: locally accepted; PR/CI/release pending
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-chat-history-import-2026-10-11-080.json

## Критерии

- [x] DataControls → importChats → /chats/import и refreshChatList прослежены. Серверная проверка прав сохраняется; существующее преобразование ChatGPT переиспользуется.
- [x] Воспроизвести повреждённый JSON/отказ чтения/API, повторную отправку, позднее чтение после уничтожения компонента и вывод содержимого/заголовков в консоль.
- [x] Native file.text(), один importing guard, сброс input для повторного выбора того же файла; не отправлять позднее чтение и не обновлять другой сеанс. Обработать ошибки действий страницы.
- [x] Сохранить AIRIS wrapped/legacy, метаданные/папку/даты и ChatGPT mixed metadata, роли/сообщения/модели/даты. Проверять внешнюю форму данных до отправки; backend остаётся окончательной проверкой.
- [x] Targeted/full frontend, типы/lint без новых замечаний; scoped lint/формат и компиляция проходят.
- [x] Production/чужие данные/тома сохранены; commit/push и план198/244, цель active.

Upstream impact: DataControls.svelte — typed context, native reading, safe errors; src/lib/utils/index.ts — только удаление private данных из существующих журналов ChatGPT converter. Разбор/нормализация внешнего JSON изолированы в fork-owned chat_import.ts; новое преобразование, формат файлов, схема/библиотека/сервис не вводятся. Уже отправленный импорт не отменяется закрытием окна. Реальных импортов/удалений тесты не выполняют.

Доказательства: `/Users/yshishenya/.codex/private-artifacts/airis-chat-history-import-20261011`. Общие проверки/PR/CI/собранный интерфейс/выпуск/настоящие A/B остаются открытыми. Откат revert commit.

Уточнение после первого полного прогона2488/2488: доказана оставшаяся смена сеанса во время refreshChatList/loadNextChatListPage — оба случая принимают прежний ответ. Guard добавляется в общий store, без отдельного механизма отмены/новой библиотеки; две store-регрессии до0/2. Upstream impact дополнен src/lib/stores/chatList.ts: только snapshot текущего token и две проверки перед публикацией результата. Первый полный прогон сохранён отдельно; после этого изменения обязательный полный прогон повторяется.

## Принятые проверки

Первоначальные11 сценариев:1 pass/10 fail; дополнительно две store-регрессии0/2. После27/27 focused и2490/2490 full, failed/pending/todo0. Types101→92/24, ESLint191 без изменения, новых0; scoped lint/формат6 файлов pass,352 цели будущего CI без замечаний.2 client/server компиляции/CSS сохранены;269 SDD valid/эта спецификация3/3 completed. Backend1064/25 reused после565 свежих хешей; нового backend прогона нет. Production/image/env/config/mounts/12 соседей/21 чужой файл/262 тома сохранены; тестовых контейнеров0.

- [ ] Общие проверки, PR/CI, проверка собранного интерфейса и выпуск.
- [ ] Настоящие A/B и внешняя приёмка; основной план198/244, цель active.
