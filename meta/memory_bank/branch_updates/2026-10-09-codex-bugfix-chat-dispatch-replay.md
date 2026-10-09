- [ ] **[BUG] Долговечная защита от повторного запуска**
  - Spec: [chat-dispatch-replay](../specs/work_items/2026-10-09__bugfix__chat-dispatch-replay.md)
  - Owner: Codex
  - Started: 2026-10-09
  - Summary: Реальный повтор HTTP и ошибка регистрации task могут дать второй provider запуск; цель — один durable owner/operation, повтор того же ack и ноль слепых повторов unknown.

  - Update: 2026-10-09 — серверная задача SDD 1/2 выполнена. API/JWT/PostgreSQL и SQLite 25/25, backend 1051/0 skip; два процесса имеют одного владельца. Black 462, Ruff 547/новых 0. Интерфейс не менялся; стабильное восстановление полной операции браузера и полный выпуск остаются открытыми. Работа целиком In Progress.

  - Update: 2026-10-09 — проверен браузерный журнал полной исходной операции, GET receipt и восстановление обычного чата без повторного POST. Backend 1055/0 skip; PostgreSQL/SQLite 29/29; frontend 1247/136 файлов, затронутые 84. До исправления потерянное подтверждение меняло payload/IDs; два дополнительных дефекта черновика/большой истории тоже воспроизведены. Native Chrome проверил Storage/Locks, изоляцию и запись 769 байт при посторонних 6 МиБ. Новых типов/ESLint/Ruff 0, общий gate красный. Source stage частичный: временный результат, backing chat заметки, настоящий provider/billing, CI/интеграция/выпуск открыты. SDD 1/2 active, план 198/244, цель active; production сохранён.

  - Update: 2026-10-09 — защита создания чата заметки использует первичный ключ существующей chat таблицы и UUID5 user/note/operation; оба GET/POST callers проходят через fork-owned helper. Настоящий HTTP до исправления дал два чата; четыре client сценария потерянного UUID/позднего ответа тоже упали до правки. PostgreSQL37, SQLite37, frontend1253/136 файлов/затронутые117, Black464; type1666/103, ESLint970, Ruff547/новых0. Native Chrome проверил сохранение и изоляцию UUID. Полный финальный backend на отдельных пустых PostgreSQL fixtures прошёл1063/0skip/25warnings/UnhandledThread0; текст черновика до модели, временный результат и настоящий production/provider/billing остаются открытыми. SDD1/2 active, цельactive, план198/244.

  - Update: 2026-10-09 — начат следующий проход черновиков до модели. Три реальные submit callbacks подтвердили удаление sessionStorage до accepted: before62pass/3fail. Сохраняем исходную запись до подтверждения; затем нужны отдельный actor/note-operation scope, reload/transfer к backing chat и связь model receipt с raw composer. Исправление ещё не закоммичено, production не меняется; SDD1/2 и цельactive.

- [ ] [BUG] Проверяется полный этап черновика: три входа, scoped sessionStorage, перенос заметки, связь raw snapshot с pending dispatch и selective cleanup. Дополнительные регрессии до правки подтвердили отказ Storage (2), порядок загрузки/автосохранения (1) и смену аккаунта при ожидании emitter (1). Native Chrome подтвердил 6007 символов, image/settings, reload, перенос, отказ очистки и отсутствие принятого вопроса после reload. Финальное дерево и commit/push ещё проверяются; production не менялся, план198/244, SDD1/2 active.
      Spec: [chat-dispatch-replay](../specs/work_items/2026-10-09__bugfix__chat-dispatch-replay.md)
      Owner: Codex
      Started: 2026-10-09
  - Update: 2026-10-09 — итоговый frontend1270/137 файлов, 0failed; 8 регрессий до исправления. Явная модель URL перекрывает сохранённый paid draft и atSelectedModel; unavailable не подменяется, submit=false не отправляет. Типы1666/103, ESLint970/новых0; SDD validate0/0 после заполнения двух metadata.file_path. Серверные464 SHA256 и21 защищённый файл совпали; production healthy/restarts0, изменений нет. Exact-source/remote доставка и частный CAS отчёт фиксируются в proof airis-chat-draft-recovery-20261009; SDD1/2 active, план198/244.
