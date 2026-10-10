
- [x] [BUG] Сохранность поиска и операций истории
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__history-response-ownership.md
  - Owner: Codex
  - Summary: 9 исходных отказов; общая причина — асинхронные ответы без владельца выбора/редактирования. Проверки качества и сохранности обязательны.
  - Done: 2026-10-10
  - Verification: 11 исходных отказов;31 адресных/1317 полных frontend,0failed/pending/todo. Types88 removed/new0,ESLintnew0;frozen1734,backend542,protected21,production13 preserved. SDD2/2. Общие gates и новый выпуск остаются открытыми.

- [ ] **[BUG]** Сохранение терминалов и исполнение инструментов
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__terminal-save-tool-execution.md
  - Owner: Codex
  - Started: 2026-10-10
  - Summary: Проверен разрыв await/persistence и путь socket → browser → external tool; начинаются отдельные reproduction tests, status/timeout, custom headers и сохранность callback.

- [x] **[BUG]** Сохранение терминалов и исполнение инструментов принято в исходниках
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__terminal-save-tool-execution.md
  - Owner: Codex
  - Done: 2026-10-10
  - Summary: 30 исходных отказов;42 новых адресных/50 соседних/1507 общих frontend пройдены на1747 замороженных файлах. Types1324/87 без новых;ESLint822→815 без новых. Backend542/protected21/production12 соседей сохранены. Source `17b165dae50a30d46272c0c2bed744ddc69e0022` отправлен, SDD3/3 закрыта; общего зелёного gate и нового выпуска нет.

- [ ] **[BUG]** Маршрутизация RPC своей сессии перед фильтром временного чата
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__session-rpc-routing.md
  - Owner: Codex
  - Started: 2026-10-10
  - Summary: Настоящий root handler теряет matching-session запросы другого temporary/local чата. Проверяется общий путь трёх RPC типов и сохранность фильтра уведомлений.

- [x] **[BUG]** Маршрутизация запросов своей сессии принята в исходниках
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__session-rpc-routing.md
  - Owner: Codex
  - Done: 2026-10-10
  - Summary: 19 исходных отказов; 38 новых адресных, 11 соседних и 1545 общих frontend тестов прошли на 1748 замороженных файлах. Types 1324/87 и ESLint 815 без новых диагностик. Backend 542, protected 21, production и 12 соседей сохранены. Source `69d18dc2dcf7dedfb64b9542d19d834851cad3e0` отправлен; SDD 2/2 закрыта. Общие gates, выпуск и реальная приёмка остаются открытыми.

- [ ] **[BUG]** Целостность прямого потока ответа
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__direct-completion-stream.md
  - Owner: Codex
  - Started: 2026-10-10
  - Summary: В настоящем root handler подтверждены разорванная строка и второй callback после ack. Проверяется общий путь API/stream/socket/backend; повторов провайдера и новой зависимости не требуется.

- [x] **[BUG]** Целостность прямого потока ответа принята в исходниках
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__direct-completion-stream.md
  - Owner: Codex
  - Done: 2026-10-10
  - Summary: 18 исходных отказов; 21 адресная, 49 соседних и 1566 общих frontend проверок прошли на 1749 замороженных файлах. Types 1324/87 и ESLint 815 без новых диагностик. Сохранены backend 542, protected 21, production и 12 соседей. Source `40d5026a4b397e07e94874af6fe9f51e34c01dd1` отправлен; SDD 2/2 закрыта. Общие gates, выпуск и реальная приёмка остаются открытыми. Подтверждён следующий отдельный дефект Python host.

- [x] **[BUG][PYTHON]** Завершение Python RPC и ошибок загрузки файлов
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__python-host-lifecycle.md
  - Owner: Codex
  - Done: 2026-10-10
  - Summary: 23 исходных отказа; 34 адресных и 1600 общих тестов проходят. Types1322/87 и ESLint813 без новых диагностик; исходники отправлены, SDD3/3 закрыта. Production/12 соседей/21 чужой файл сохранены; выпуск, runtime concurrency и конечные gates открыты.

- [ ] **[BUG][PYTHON]** Последовательное выполнение общих Python runtime
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__python-runtime-queue.md
  - Owner: Codex
  - Started: 2026-10-10
  - Summary: В обоих обработчиках воспроизведён чужой stdout; проверяются queue, bootstrap и файловые отказы. Конечные gates открыты.

- [x] **[BUG][PYTHON]** Очередь Python принята в исходниках
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__python-runtime-queue.md
  - Owner: Codex
  - Done: 2026-10-10
  - Summary: 18исходных отказов;21адресная/69соседних/1621общая проверка;1751замороженный файл. Types1321/87,ESLint809,новых0. 17реальных браузерных сценариев приняты;2дополнительных Blackformatter провалены из-за click. Source `b390771760f595a9030e7d9b0a46d4b6a7184285` отправлен;SDD3/3 закрыта. Конечные gates открыты.

- [ ] **[BUG][PYTHON]** Сохранение зависимостей подготовленных Pythonпакетов
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__python-prepared-packages.md
  - Owner: Codex
  - Started: 2026-10-10
  - Summary: Подтверждён missingclick в обоих режимах;исправляется общий prepare-путь без обновленияruntime.

- [x] **[BUG][PYTHON]** Подготовка пакетов принята в исходниках
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__python-prepared-packages.md
  - Owner: Codex
  - Done: 2026-10-10
  - Summary: 6 адресных / 1627 общих проверок; types 1321/87, ESLint 809, новых 0. Два профиля прошли по 19 браузерных сценариев; 17 roots / 49 зависимостей / 63 файла, SHA256 и сохранённые версии, повтор идентичен. Source `028ea3b0e3208c13b3ca3e1c0e5ce1f2fa6798c9` отправлен; SDD 3/3 закрыта. Production / 12 соседей / 21 чужой файл сохранены. Общие gates и выпуск открыты.
