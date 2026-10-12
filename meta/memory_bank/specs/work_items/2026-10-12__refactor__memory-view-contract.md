# AIRIS — общий тип записи памяти

- Type: refactor
- Status: Done (source verification; production goal active)
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-memory-view-contract-2026-10-12-103.json

G14 требует нулевой общей проверки. Перенести существующее описание полей списка в API и переиспользовать его в форме через JSDoc. Nullable path соответствует MemoryModel. Для saveSettings переиспользовать Partial<Settings>. Сохранить API запросы, обработку ошибок, создание/редактирование/удаление записей; никаких новых зависимостей или абстракций.

- [x] Сверить сервер, единственного родителя и редактор; внести только типы.
- [x] Сравнить исполняемую компиляцию, проверить frontend, сохранить данные; закрыть SDD, commit/push.

Upstream impact: memories API и два существующих компонента персонализации; только описания типов/JSDoc. Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-memory-view-contract-20261012. Откат: revert commit. Production и общая цель требуют отдельной приёмки.

Проверено: 2598/2598 frontend, types0/0, ESLint10→8/new0; scoped3/цели ветки456/форматирование чистые. 5 сравнений API/client/server дают одинаковый исполняемый код/CSS/warnings. Это изменения типов, поэтому новый тест поведения не добавлялся: исполняемый код совпадает, существующий полный набор пройден.

Backend/config563 и package manifests совпадают с принятой базой; нового backend запуска нет. 1169 версий временной копии зависимостей совпадают с lockfile; исходный том только чтение, временный удалён. Начальная распаковка DOMPurify не нашла файл по ошибочному пути /verified; путь исправлен на /proof и integrity проверен до тестов. Production healthy/restarts0,12 соседей,21 чужой файл/262 тома сохранены. Commit/push — в указанную ветку; PR/общая CI/production остаются обязательными шагами общей цели. План198/244,цельactive.
