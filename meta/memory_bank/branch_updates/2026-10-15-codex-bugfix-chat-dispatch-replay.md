- [x] [BUG] Проверять тип запросов модели перед поиском в интернете и файлах
  - Spec: meta/memory_bank/specs/work_items/2026-10-15__bugfix__web-search.md
  - Owner: Codex
  - Done: 2026-10-15
  - Summary: Существующая схема SearchForm проверяет запросы до кэша и поиска документов. При ошибке используется исходный вопрос; новых парсеров, настроек и зависимостей нет.
  - Tests: 55 сценариев до/после; 1193 серверных теста, 0 ошибок/пропусков; Black без изменений, новых замечаний Ruff нет. Выпуска нет; общая проверка качества открыта.

- [x] Простая подготовка описания изображения
  - Spec: meta/memory_bank/specs/work_items/2026-10-15__refactor__chat-images.md
  - Owner: Codex
  - Done: 2026-10-15
  - Summary: Отделить подготовку описания и повторный разбор ошибки без изменения событий, оплаты и отмены.
  - Tests: 35 сценариев до/после, 1225 серверных тестов, новых замечаний Ruff нет; общая проверка качества и выпуск открыты.

- [x] Простые фоновые задачи чата
  - Spec: meta/memory_bank/specs/work_items/2026-10-15__refactor__background-chat.md
  - Owner: Codex
  - Done: 2026-10-15
  - Summary: Перенести очистку содержимого, продолжения, заголовок и теги в существующем порядке, без новой подсистемы.
  - Tests: 23 сценария до/после, 1248 серверных тестов, новых замечаний Ruff нет; общая проверка качества и выпуск открыты.

- [x] Простые этапы подготовки запроса чата
  - Spec: meta/memory_bank/specs/work_items/2026-10-15__refactor__chat-payload.md
  - Owner: Codex
  - Done: 2026-10-15
  - Summary: Перенести существующие этапы без новой подсистемы; сохранить права, инструменты, историю и события.
  - Tests: 48 сценариев до/после, 1296 серверных тестов, AST эквивалентен; новых замечаний Ruff всей ветки 0, 474 прежних остаются; выпуск открыт.

- [x] **[BUG]** Команда проверки перед PR
  - Spec: meta/memory_bank/specs/work_items/2026-10-15__bugfix__preflight-command.md
  - Owner: Codex
  - Done: 2026-10-15
  - Summary: Одна npm command объединяет существующие frontend test/check/lint/build, без новых зависимостей; backend и E2E отдельно.
  - Tests: Docker Compose preflight — 2600 passed/unhandled0/types0/0/ESLint0/Vite build0; исправлены только fixture четырёх тестов.

- [ ] **[OPS]** Единый кандидат выпуска
  - Spec: meta/memory_bank/specs/work_items/2026-10-15__ops__release-candidate.md
  - Owner: Codex
  - Started: 2026-10-15
  - Summary: Чистая сборка и существующие проверки на одном образе; без переработки приложения.
  - Tests: В процессе; CI PR368 пока не показывает запусков.

- [ ] **[BUG]** Новый чат и очистка принятого запроса
  - Spec: meta/memory_bank/specs/work_items/2026-10-15__bugfix__composer-lifecycle.md
  - Owner: Codex
  - Started: 2026-10-15
  - Summary: Воспроизведение на кандидате124, минимальная правка без зависимостей; production сохраняется.
