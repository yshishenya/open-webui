# AIRIS — последовательное выполнение Python и файловых запросов

## Meta
- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/active/airis-python-runtime-queue-2026-10-10-012.json

## Goal
Продолжение G14/13.11: оба общих Python runtime выполняют сообщения последовательно, чтобы каждый запрос получил только собственные stdout/stderr/result. Ошибка подготовки или файловой операции даёт один явный ответ и не ломает следующие запросы. Успех записи в persistent FS подтверждается завершённой синхронизацией.

## Acceptance Criteria
- [x] В обоих настоящих обработчиках воспроизведено смешивание вывода; проверены пакеты, FS и отказы bootstrap.
- [x] Native/sandbox сообщения выполняются по порядку; FS не вмешивается в активный код; очередь продолжается после отказа.
- [x] Ошибки bootstrap/upload/list/read/delete/mkdir/sync возвращаются явно с исходным id/type, без ложного успеха и вывода частных данных в журнал.
- [x] Синхронизация IndexedDB завершается до ответа и следующей операции; fs:read передаёт только выбранные байты.
- [x] Старые execute безtype и три потребителя (root/CodeBlock/CodeEditor), FileNav и sandbox source/sandbox flags сохранены.
- [ ] Общие проверки на замороженных исходниках без новых диагностик; production, backend и чужие файлы сохранены; коммит/push/SDD/частные документы подтверждены.

## Root cause and callers
Async message listeners допускают одновременные runPythonAsync при общих переменных вывода. Native worker также копирует произвольные поля сообщения в self и не возвращает отказ инициализации; FS errors могут выглядеть пустым списком или успешным удалением. Файловая синхронизация запускается без ожидания. Все потребители createPyodideWorker: root, CodeBlock, CodeEditor, FileNav; native и sandbox используют собственный общий interpreter. Выбранные пакеты передаются только в полеpackages, дополнительных context callers нет. Типы и ошибочные ответы FileNav исправлены и приняты в предыдущей партии.

## Upstream impact
Минимальная очередь Promise в существующих обработчиках обоих runtime, без новой зависимости или RPC слоя. Native typed request и явная FS синхронизация; sandbox сохраняет allow-scripts, parent/source guards и непостоянную FS. Root/Backend/Billing не меняются.

## Dependency compatibility and limits
Проверен repo/installed Pyodide314.0.3, официальные docs/release notes прочитаны в предыдущей партии; npm latest314.0.7. Принятая версия и статические артефакты сохраняются. Внешнее обновление — отдельная задача вместе с обоими режимами. Контролируемый runPythonAsync не считается настоящим Pyodide; фактическая браузерная проверка фиксируется отдельно. Полный выпуск, provider/деньги/mail/пилот/сроки остаются открытыми.

## Evidence
/Users/yshishenya/.codex/private-artifacts/airis-python-runtime-20261010

## Source acceptance — 10.10.2026
18 исходных отказов из21; после исправления21адресная/69соседних/1621общая проверка проходят,154файла,failed/pending/todo0. Types1322/87→1321/87;ESLint813→809;новых0. 1751замороженный исходник проверен перед/после прогонов и браузера. Настоящий Pyodide314.0.3/Python3.14.2:17браузерных сценариев прошли,2дополнительных форматирования провалены из-за отсутствующего click в подготовленных пакетах. Словари0/false сохраняются в обоих режимах; дополнительных находок0. Проверка — отдельная локальная страница,не полный root/backend и не production release. Backend542/protected21/production12соседей сохранены;1063backend проверки переиспользованы,нового прогона нет. Общиеtypes/lint красные.
