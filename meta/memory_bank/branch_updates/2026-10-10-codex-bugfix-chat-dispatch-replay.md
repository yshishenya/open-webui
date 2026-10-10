
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
