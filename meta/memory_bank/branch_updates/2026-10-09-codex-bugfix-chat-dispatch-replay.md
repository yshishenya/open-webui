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

  - Update: 2026-10-09 — начата проверка собранного UI, исходный e922b4fdce отправлен и сверён. Новая регрессия готовности поля воспроизвела пустой guide q при loading=true; изменение ещё не выпущено. Доказательства: airis-chat-dispatch-mounted-20261009.

  - Update: 2026-10-09 — подтверждено пустое поле guide q в настоящем собранном Chrome после входа. Поле теперь монтируется после restore, перед заполнением q/desktop/preset. Frontend1271/137/0failed/0skipped; type1666/103, ESLint970/новых0; backend464 SHA256 и21 защищённый файл сохранены, production healthy/restarts0. После-правки browser и полный выпуск открыты, SDD1/2, цельactive, план198/244. Evidence: airis-chat-dispatch-mounted-20261009.

  - Update: 2026-10-09 — собранный e922:3/3 guide пусты после успешного входа; runtime правка fcf844f13 отправлена,1600 blobs сверены. Добавляются6 реальных browser проверок reload/accepted/absent/note/temp на desktop и390px. Unknown GET явно подменяется только для клиентского отказа; production и общий план198/244 сохранены.

### Начальное содержимое редактора черновика — в работе

- [x] Полный собранный Chrome подтвердил пустое поле после reload ordinary accepted/absent и temporary accepted/unknown. Начальный raw draft загружался до монтирования MessageInput; RichTextInput не получал начальное содержимое и создавался пустым.
- [x] Общая минимальная правка: существующий JSON Content RichTextInput получает plain text document из prompt; строки не проходят HTML/Markdown или подстановку переменных. Все три caller restoreDraft используют одно поле. Новых зависимостей и повторных таймеров нет.
- [ ] Полный frontend и типы/ESLint, новая сборка, повтор обоих браузеров и сохранность source/production проверяются. Ошибка file selector в новом тесте исправлена отдельно; она не считается дефектом продукта.
- [ ] SDD task-2-1, внешний provider/списания, временный потерянный результат, CI/PR/интеграция/production и пилот остаются открытыми. План198/244 сохраняется; новых номерных закрытий нет.

Spec: meta/memory_bank/specs/work_items/2026-10-09**bugfix**chat-dispatch-replay.md
Owner: Codex
Started: 2026-10-09

- [x] Исходники начального содержимого проверены: frontend1271/137 файлов, failed0/skipped0; type1666/103, ESLint970/новых0. E2E types/ESLint/Prettier/diff проходят. Backend464 hashes совпали с прежним1063. Защищённые21 файла и production env/config/mounts/12 соседей сохранены; healthy/restarts0. После-правки собранный browser остаётся открытым.

### Смонтированный черновик и повтор — принят локальный этап

- [x] Собранный runtime `7dd73b88daa1719911bf47056c4d43016517dd12`; итоговые тесты `ad4a0e9c9ef4429e2af05c6391e02a77bed8bb65`. Между ними изменён только новый E2E: валидный PNG, контракт uploaded file/image/png, существующий identity transport перехвата заметки. Все1078 frontend/464 backend hashes совпали.
- [x] Подтверждены28 различных сценариев:14 Chrome и14 Firefox390. Полный прогон25pass/2fail/1error;24 неизменённых случая переиспользованы после сравнения тел/helpers/fixtures/runtime,4 затронутых случая повторены на свежей БД и прошли. Это совокупная приёмка24+4, не один зелёный28-case запуск.
- [x]6007 символов с настоящим загруженным изображением пережили reload; accepted draft не вернулся. Lost accepted восстанавливается без второго POST; absent повторяет исходное тело/UUID, provider/usage/success ровно1,17input/3output,ledger0. Note creation повторяет UUID/chatid и сохраняет черновик;2 ответам соответствуют2usage/2chats. Temporary accepted/unknown не повторяются слепо; journal остаётся в sessionStorage своей вкладки.
- [x] Guide3/3 в каждом браузере, ошибка провайдера без расхода, переменная конструктора ordinary/embedded, checkout/credit/history/service-email replay проходят. В принятых случаях0pageerror/failed/skipped. Провайдер/SMTP/payment — локальные fixtures, не внешний рабочий путь.
- [x] Frontend1271/137файлов,0failed/0skipped; types1666/103 и ESLint970/новых0. E2E types/lint/format pass. Backend464 совпали с принятым1063. Production healthy/restarts0;env/config/mounts/12neighbours и protected21 сохранены.
- [ ] Общие gates красные: в затронутых файлах кандидата59 ESLint ошибок/15файлов. CI/PR/интеграция, чистый production образ/выпуск, внешние provider/payment/mail, временный потерянный ответ и пилот остаются открытыми. SDD1/2 active; план198/244, новых номерных закрытий0, цельactive.

Upstream impact: Chat.svelte завершает loading перед заполнением q/preset; MessageInput.svelte передаёт существующему JSON редактору буквальное начальное содержимое. API контрактов и зависимостей не добавлено. Доказательства: `.codex/private-artifacts/airis-chat-dispatch-mounted-20261009` на локальном Mac; mounted-final-acceptance.json, draft-test-reuse-proof.json, JUnit архивов draft-first/draft-final, compiled4915 hashes.

Spec: meta/memory_bank/specs/work_items/2026-10-09**bugfix**chat-dispatch-replay.md
Owner: Codex
Started: 2026-10-09
