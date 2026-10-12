# AIRIS — типы просмотра файлов

- Type: bugfix
- Status: completed
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- Created: 2026-10-12
- SDD Spec: meta/sdd/specs/completed/airis-file-viewer-types-2026-10-12-092.json

Остались три ошибки общего typecheck: нет declarations sql.js и side-effect mhchem, GarbageBin получает class вместо className. FilesModal также содержит any и недоступную с клавиатуры строку. Используем KnowledgeFile/KnowledgeFileDisplay из существующего API и стандартные объявления sql.js, разделяем открытие/удаление нативными кнопками. Новые API/службы/загрузка моделей не нужны.

- [x] Проверить текущие библиотечные контракты; исправить типы и нативные действия, проверить сохранение поиска/сортировки/удаления и просмотра SQLite.
- [x] Полный frontend/type/lint/format, компиляция, зависимости и сохранность; SDD, commit/push.

Upstream impact: FilesModal.svelte, SqliteView.svelte; существующая разметка/типы. Runtime библиотек, SQL-запросы и API сохраняются. Для mhchem нужен только пустой контракт side-effect импорта. Dev dependency @types/sql.js1.4.11 — latest stable проверен npm12.10; sql.js pinned1.14.1/latest1.14.2, KaTeX pinned0.16.38/latest0.19.0. Runtime версии сохраняются для совместимости принятого wasm/static и Markdown; их обновление — отдельная задача с согласованными ресурсами. Официальный README sql.js и DefinitelyTyped изучены. Новые объявления не исполняются в приложении.

Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-file-viewer-types-20261012. Общие lint/backend/PR/CI/выпуск и реальные A/B остаются открытыми. Откат: revert commit; восстановить прежний lockfile штатным npm.

Реальные проверки: открытие, подтверждение/Shift-удаление, сортировка/поиск; SQLite с TEXT/INTEGER/BLOB/NULL, произвольным запросом, ошибкой SQL и закрытием. В jsdom отключена отсутствующая браузерная анимация; ConfirmDialog не изменён. Все пять затронутых проверок прошли. CSS совпадает в четырёх компиляциях; handlers отличаются только удалением unused catch, явным if вместо short-circuit и безопасным предупреждением при close. Backend: 563 исходных файла совпадают, два frontend manifests меняют только dev-типы; результат 1064/25 переиспользован, нового backend запуска нет.

Итог: 2585/2585 frontend, 5/5 targeted, type errors 3 → 0 (15 предупреждений), ESLint 167 → 148; новых диагностик 0. Затронутые четыре файла и 380 будущих CI-целей: lint/формат без ошибок. Рабочий сервер healthy, версия/окружение/конфигурация/12 соседей сохранены; 21 чужой файл и 262 тома сохранены. Выпуска не было; общие lint/backend/PR/CI и реальные A/B остаются открытыми.
