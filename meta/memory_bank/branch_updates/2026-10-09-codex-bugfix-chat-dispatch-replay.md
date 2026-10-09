- [ ] **[BUG] Долговечная защита от повторного запуска**
  - Spec: [chat-dispatch-replay](../specs/work_items/2026-10-09__bugfix__chat-dispatch-replay.md)
  - Owner: Codex
  - Started: 2026-10-09
  - Summary: Реальный повтор HTTP и ошибка регистрации task могут дать второй provider запуск; цель — один durable owner/operation, повтор того же ack и ноль слепых повторов unknown.

  - Update: 2026-10-09 — серверная задача SDD 1/2 выполнена. API/JWT/PostgreSQL и SQLite 25/25, backend 1051/0 skip; два процесса имеют одного владельца. Black 462, Ruff 547/новых 0. Интерфейс не менялся; стабильное восстановление полной операции браузера и полный выпуск остаются открытыми. Работа целиком In Progress.

  - Update: 2026-10-09 — проверен браузерный журнал полной исходной операции, GET receipt и восстановление обычного чата без повторного POST. Backend 1055/0 skip; PostgreSQL/SQLite 29/29; frontend 1247/136 файлов, затронутые 84. До исправления потерянное подтверждение меняло payload/IDs; два дополнительных дефекта черновика/большой истории тоже воспроизведены. Native Chrome проверил Storage/Locks, изоляцию и запись 769 байт при посторонних 6 МиБ. Новых типов/ESLint/Ruff 0, общий gate красный. Source stage частичный: временный результат, backing chat заметки, настоящий provider/billing, CI/интеграция/выпуск открыты. SDD 1/2 active, план 198/244, цель active; production сохранён.

  - Update: 2026-10-09 — защита создания чата заметки использует первичный ключ существующей chat таблицы и UUID5 user/note/operation; оба GET/POST callers проходят через fork-owned helper. Настоящий HTTP до исправления дал два чата; четыре client сценария потерянного UUID/позднего ответа тоже упали до правки. PostgreSQL37, SQLite37, frontend1253/136 файлов/затронутые117, Black464; type1666/103, ESLint970, Ruff547/новых0. Native Chrome проверил сохранение и изоляцию UUID. Полный финальный backend на отдельных пустых PostgreSQL fixtures прошёл1063/0skip/25warnings/UnhandledThread0; текст черновика до модели, временный результат и настоящий production/provider/billing остаются открытыми. SDD1/2 active, цельactive, план198/244.
