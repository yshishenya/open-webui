- [x] [BUG] Проверять тип запросов модели перед поиском в интернете и файлах
  - Spec: meta/memory_bank/specs/work_items/2026-10-15**bugfix**web-search.md
  - Owner: Codex
  - Done: 2026-10-15
  - Summary: Существующая схема SearchForm проверяет запросы до кэша и поиска документов. При ошибке используется исходный вопрос; новых парсеров, настроек и зависимостей нет.
  - Tests: 55 сценариев до/после; 1193 серверных теста, 0 ошибок/пропусков; Black без изменений, новых замечаний Ruff нет. Выпуска нет; общая проверка качества открыта.

- [x] Простая подготовка описания изображения
  - Spec: meta/memory_bank/specs/work_items/2026-10-15**refactor**chat-images.md
  - Owner: Codex
  - Done: 2026-10-15
  - Summary: Отделить подготовку описания и повторный разбор ошибки без изменения событий, оплаты и отмены.
  - Tests: 35 сценариев до/после, 1225 серверных тестов, новых замечаний Ruff нет; общая проверка качества и выпуск открыты.

- [x] Простые фоновые задачи чата
  - Spec: meta/memory_bank/specs/work_items/2026-10-15**refactor**background-chat.md
  - Owner: Codex
  - Done: 2026-10-15
  - Summary: Перенести очистку содержимого, продолжения, заголовок и теги в существующем порядке, без новой подсистемы.
  - Tests: 23 сценария до/после, 1248 серверных тестов, новых замечаний Ruff нет; общая проверка качества и выпуск открыты.

- [x] Простые этапы подготовки запроса чата
  - Spec: meta/memory_bank/specs/work_items/2026-10-15**refactor**chat-payload.md
  - Owner: Codex
  - Done: 2026-10-15
  - Summary: Перенести существующие этапы без новой подсистемы; сохранить права, инструменты, историю и события.
  - Tests: 48 сценариев до/после, 1296 серверных тестов, AST эквивалентен; новых замечаний Ruff всей ветки 0, 474 прежних остаются; выпуск открыт.

- [x] **[BUG]** Команда проверки перед PR
  - Spec: meta/memory_bank/specs/work_items/2026-10-15**bugfix**preflight-command.md
  - Owner: Codex
  - Done: 2026-10-15
  - Summary: Одна npm command объединяет существующие frontend test/check/lint/build, без новых зависимостей; backend и E2E отдельно.
  - Tests: Docker Compose preflight — 2600 passed/unhandled0/types0/0/ESLint0/Vite build0; исправлены только fixture четырёх тестов.

- [ ] **[OPS]** Единый кандидат выпуска
  - Spec: `meta/memory_bank/specs/work_items/2026-10-15__ops__release-candidate.md`
  - Owner: Codex
  - Started: 2026-10-15
  - Summary: Чистая сборка и существующие проверки на одном образе; без переработки приложения.
  - Tests: В процессе; CI PR368 пока не показывает запусков.

- [ ] **[BUG]** Новый чат и очистка принятого запроса
  - Spec: `meta/memory_bank/specs/work_items/2026-10-15__bugfix__composer-lifecycle.md`
  - Owner: Codex
  - Started: 2026-10-15
  - Summary: Воспроизведение на кандидате124, минимальная правка без зависимостей; production сохраняется.

- [x] **[BUG]** Current URL and accepted composer remount lifecycle verified
  - Spec: `meta/memory_bank/specs/work_items/2026-10-15__bugfix__composer-lifecycle.md`
  - Owner: Codex
  - Done: 2026-10-15
  - Summary: Minimal Chat.svelte fix on source2d65f0e7006906aa8f7e6c547e0c43cccc536547; frontend2603/types0/ESLint0/build0; clean image125 runtime parity accepted, browser147 passed/4ordinary external-model skips, mandatory86/86. SDD125 closed2/2. Independent repeat failed native check with SIGILL132 again; release remains unaccepted. Fresh staged/exact-command diagnostics and all runtime repetitions passed, without establishing the root cause. CI/deploy and real pilot remain open. No new runtime dependencies or abstraction.

- [ ] **[OPS]** Независимая сборка125 и блокировка CI
  - Spec: `meta/memory_bank/specs/work_items/2026-10-15__ops__release-candidate.md`
  - Owner: Codex
  - Started: 2026-10-15
  - Summary: dev-p4 собрал тот же source2d65 без изменений; штатные native операции прошли, все4915 compiled файлов/Python/OS/backend/static/models совпали с проверенным125. Повторяемость принята; причина P4 SIGILL неизвестна.
  - Tests: frontend2603, backend1296 по точному паритету, browser147/mandatory86; CI/security на точном SHA и выпуск остаются открыты. Production healthy/restarts0, чужие21файл и соседи сохранены.

- [x] **[BUG]** Приёмка замечаний CodeQL
  - Spec: `meta/memory_bank/specs/work_items/2026-10-15__bugfix__security-acceptance.md`
  - Owner: Codex
  - Started: 2026-10-15
  - Summary: Actions включены через GitHub; штатный CI запущен на8ad. CodeQL выявил23 замечания, проверяются конкретные пути и минимальные исправления. Выпуск остаётся закрыт.

  - Update: Из23 CodeQL замечаний7 реальных исправлены в общих функциях;16 проверенных ложных срабатываний классифицированы индивидуально без отключения правил. Compose frontend2604/backend1297 прошли, новых Ruff замечаний0; новый точный SHA/CodeQL и чистый образ126 остаются открыты.

  - Done: 2026-10-15
  - Tests: Все обязательные CI на1efbbaadab212f73552e594316dd80a1a34c6841 прошли, CodeQL0PR alerts, actionable7 fixed без dismiss; SDD126 завершён2/2. Первый чистый образ проверен, repeat/browser/deploy открыты.
