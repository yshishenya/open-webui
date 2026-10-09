# [BUG] Долговечная защита от повторного запуска генерации

Status: In Progress
Owner: Codex
Started: 2026-10-09
SDD Spec: meta/sdd/specs/active/airis-chat-dispatch-replay-2026-10-09-027.json

База airis_b2c d579f5c02926cace8c8da60434ce1c39c7284361; явная зависимость send-acknowledgement bf138fd4317d13e389b8687e595ffcb591ff3c70. Полная A/B цель остаётся active, план 198/244.

Причины: main.chat_completion создаёт новые chat/task ids на повторе одного payload, operation_id используется только для записи завершённого успеха; общая tasks.create_task запускает coroutine до подтверждения регистрации Redis. При ошибке регистрации модель уже может начать работу, а браузер получает отказ и повторяет запрос. Existing administrative command receipts и dialect_insert дают готовый ORM образец уникального владения; таблица TaskSuccess не может быть использована как журнал начала, поскольку это нарушает критерий завершённого полезного результата.

- [x] До исправления реальный API/JWT/PostgreSQL воспроизводит две отправки одинакового operation_id с разными chat/task ids; граница провайдера подменена и явно отмечена.
- [x] Ошибка регистрации Redis запускает ноль coroutines; общий create_task сохраняет обычное поведение остальных трёх callers.
- [x] Долговечная уникальная запись owner/operation появляется до любых provider side effects. Одновременные запросы имеют одного владельца; повтор принятого запроса возвращает тот же ack и даёт ноль новых запусков/чатов.
- [x] Неопределённый запуск после смерти процесса или отказа БД/регистрации не повторяется вслепую; одинаковый operation_id с другим значимым payload даёт отказ без побочных действий.
- [x] Обычный пользователь не читает/не переиспользует чужую запись. Валидация UUID, auth, ownership, legacy/internal/direct callers сохранены.
- [ ] Браузер повторяет полную исходную операцию с теми же user/assistant ids и operation_id после потерянного HTTP ответа; новые пользовательские намерения получают новые операции. Регистрация, regeneration, continue, временный и встроенный чат проверены по своим контрактам.
- [ ] SQLite/PostgreSQL, два конкурентных caller, перезапуск/неопределённый результат, миграция, provider/billing/success invariants и полные проверки принятого дерева пройдены; source/remote hashes сверены.
- [ ] CI/PR, clean image, fresh browser/provider/native acceptance, production release и полный набор G01–G17 остаются отдельной приёмкой.

Upstream impact: тонкий общий hook main.chat_completion; корректный порядок регистрации общего tasks.create_task; минимальные hooks Chat.svelte/airis client helper. Fork-owned ORM journal и service используют существующий dialect_insert/get_async_db. Без новых runtime dependencies; новая таблица требует Alembic migration и принятой PostgreSQL проверки. Нельзя заменять долговечное владение локальным Map, Redis TTL или одной записью TaskSuccess.

Evidence: /Users/yshishenya/.codex/private-artifacts/airis-chat-dispatch-replay-20261009

## Принятый серверный этап — 09.10.2026

- [x] Два исходных сценария действительно воспроизвели дефект: API создал два чата/две задачи; при отказе Redis coroutine начала работу. Ошибки collection и подготовки fixture не засчитаны за воспроизведение.
- [x] Общий обработчик защищён commit записи владения до заголовка/провайдера; повтор подтверждённого запроса не создаёт новых задач. Тело прежнего обработчика и остальной main модуль совпали по Python AST.
- [x] 25 сценариев на PostgreSQL и 25 на SQLite; полный backend 1051/0 skip. Новые тесты не подавляют исключения/предупреждения и используют настоящую авторизацию.
- [x] Два независимых процесса PostgreSQL: один владелец; новое чтение получает прежнее подтверждение. Миграция d1c020261009 принята; удаление аккаунта удаляет запись через FK.
- [x] Black: 462 файла; Ruff: 547 прежних диагностик, новых 0. Общий контроль качества остаётся красным.
- [x] Все 1074 src файла и 54 внешних tests файла совпали с принятой предыдущей проверкой 1224 frontend tests; поэтому интерфейсные тесты/типы/ESLint здесь не повторялись.
- [ ] Вторая SDD задача остаётся открытой: полная приёмка восстановления браузера и настоящие provider/billing проверки. Исходный браузерный дефект подтверждён; проверенный ниже этап сохраняет UUID и исходное содержимое.
- [ ] Работа целиком не объявлена Done; CI/PR/интеграция/образ/выпуск и G01–G17 остаются открытыми. План 198/244 не изменён.

Протокол и границы: meta/memory_bank/guides/chat_dispatch_replay.md. Строгое ограничение: это защита от повторного запуска одного ключа, а не доказательство гарантированно готового ответа после любого сбоя. Неопределённая регистрация Redis может оставить запись без живой задачи; проверка/восстановление не должны перезапускать провайдера вслепую.

Зависимости не добавлялись и не заменялись. Проверен установленный SQLAlchemy 2.0.50, Alembic 1.18.4, Redis 8.0.1; прочитаны официальные async/ON CONFLICT docs ветки 2.0. PyPI сообщает stable SQLAlchemy 2.1.4. Используем существующий dialect_insert и принятый runtime 2.0.50 для совместимости всей ORM/lock; переход на 2.1 — отдельное обновление lock и всего набора миграций/ORM/биллинга, не часть исправления повторной отправки.

## Проверенный браузерный этап — 09.10.2026

- [x] До исправления проверка потерянного подтверждения упала: повтор менял исходное тело и идентификаторы. Локальный журнал теперь сохраняет усиленное фактическое тело до POST, включая параметры и метаданные; session_id берётся после переподключения. Новое продолжение ответа получает новую операцию.
- [x] Авторизованное GET чтение состояния операции не резервирует запись и не запускает модель; чужой аккаунт видит absent, отказ БД возвращает безопасный 503, ответ запрещён кэшированию. PostgreSQL/SQLite: 29/29; полный backend: 1055/0 skip.
- [x] Native Web Locks защищают начальную запись в localStorage; повтор в другом окне не перезаписывает её. Обычная операция переживает перезагрузку/смену аккаунта. Временная операция остаётся в sessionStorage своей вкладки. Отказ чтения/записи, повреждение записи или отсутствие Locks останавливают отправку.
- [x] После принятия читаются сохранённый чат и актуальные task ids; исходные queueIds удаляются, новые элементы очереди сохраняются. Неопределённый запуск и принятое состояние без результата/активных задач не вызывают новый POST.
- [x] При восстановлении очищается только совпадающий исходный текст/вложения; новый черновик сохраняется. Обычный журнал хранит сообщения текущей операции вместо всей истории. Обе ошибки подтверждены до исправления; 84 затронутых сценария проходят. Проверка Chrome с посторонней веткой 6 МиБ сохранила запись 769 байт.
- [x] Ключи прямых tool servers в журнал не записываются; сохраняются SHA256, повтор использует только неизменённые текущие настройки. Явные credentials в оставшемся теле/истории запрещают сохранение. Полный набор frontend: 1247/136 файлов; Black: 463 файла; типов 1666/103, ESLint 970, Ruff 547 — новых диагностик 0.
- [x] Fresh production 17:05:30 UTC: revision c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908, healthy, restarts 0; environment/config/mounts и 12 соседей совпали. Все 21 защищённых файла основной копии сохранены. Production этого этапа не менялся.
- [ ] Принятый временный ответ после потерянных событий/перезагрузки пока не извлекается: повтор блокируется и показывается объяснение. Ограничение остаётся до отдельной полной приёмки, не считается готовым восстановлением.
- [ ] Создание backing chat заметки имело повтор после потерянного ответа; исправление исходников проверяется в следующем разделе. Рабочий выпуск и сохранение черновика до модели ещё не приняты.
- [ ] Полная проверка Chat.svelte через настоящую модель, квоту и списание, CI/PR, интеграция, чистый образ и выпуск остаются открытыми. Общая цель active, SDD 1/2, план 198/244. Новых номерных закрытий нет.

Evidence: /Users/yshishenya/.codex/private-artifacts/airis-chat-dispatch-client-20261009. Проверяемый итог: verify-checks.py, test-acceptance.json, tested-source-snapshot.json; raw XML/JSON/logs и native Chrome snapshots. Native harness проверяет настоящий helper и браузерные Storage/Locks, без провайдера и биллинга. Исторические тесты сервера 1051 заменены актуальным полным прогоном 1055.

Upstream impact браузера: Chat.svelte содержит привязки состояния, Locks и восстановления к текущему actor/token/history/scope, панель проверки и общие hooks отправки; независимый журнал/валидация/digests вынесены в utils/airis/chat_dispatch.ts, GET клиент — apis/airis/chat_dispatch.ts. Никаких controllers, новых dependencies или изменений OpenAI API contract. main.py подключает один fork-owned GET router.

## Исправление создания чата заметки — в работе

Следующая граница task-2-1: createNoteChatById до запуска модели. Настоящий HTTP/JWT тест подтвердил два различных чата при повторе одного operation_id. Дополнительные проверки прежнего NoteEditor подтвердили потерю идентификатора операции и изменение текущего аккаунта/заметки/черновика поздним ответом: четыре сценария упали до исправления.

- [x] Все callers изучены: явный POST создаёт новый чат по пользовательскому намерению, GET открывает последний или создаёт первый. Оба используют общий fork-owned create_or_replay_note_chat и существующий primary key chat.id, без таблиц/миграций/dependencies.
- [x] UUID5 связывает user/note/client UUID. Повтор возвращает существующий чат; уникальность БД защищает гонку; конфликт метаданных/владельца отклоняется. Legacy POST без UUID сохраняет новый чат; первое GET создание имеет стабильный ключ.
- [x] Браузер сохраняет UUID по user/note до создания нового черновика под Web Lock; повтор использует тот же UUID. Отказ Storage не разрешает отправку. actor/token/note/draft сверяются после ожиданий; ключ снимается только после подтверждённого создания.
- [x] PostgreSQL: 37/0 skip; SQLite: 37/0 skip. Конкурентные GET/POST создали один чат; проверены разные actor/note/intents, сохранение изменённого title, чужой доступ/UUID/коллизия и безопасный 503. Авторизация настоящая, model boundary не вызывается.
- [x] 117 затронутых frontend сценариев; первый полный прогон 1253/136 файлов. Native Chrome подтвердил UUID после reload и во второй вкладке, отдельные user/note keys и новый UUID после подтверждённой очистки. Новые type/import замечания первого QA исправлены; окончательные типы1666/103, ESLint970, Ruff547 — новых0; Black464.
- [x] Окончательные runtime/test hashes сверены; полный backend на свежих PostgreSQL fixtures: 1063/0 skip, предупреждений25, UnhandledThread0. Source подготовлен к commit/push; удалённое совпадение фиксируется отдельным receipt.json. Первый full backend1063/0skip прошёл; повтор на прежней report базе дал DuplicateTable в подготовке financial test и UnhandledThread warning. Не ослабляли тест: создан отдельный пустой набор fixture DB, failed logs сохранены.
- [ ] Восстановление незавершённого черновика заметки до модели после reload ещё не проверено; существующий saveDraft/initEmbeddedDraft путь требует следующего прохода. Временный потерянный результат, настоящая модель/списание и production выпуск остаются открытыми.

Evidence: /Users/yshishenya/.codex/private-artifacts/airis-note-chat-create-replay-20261009. SDD остаётся 1/2 active, task-2-1 in_progress; план198/244 и конечная цельactive.

## Черновик до модели и его подтверждённая очистка — проверяемый этап исходников

В трёх настоящих on:submit callbacks clearDraft выполнялся до проверки/принятия. Все три регрессии до исправления потеряли запись sessionStorage при rejected submission; 62 прежних сценария прошли. Общая очистка переносится в submitHandler после accepted и проверки прежних actor/token/history/input/content/files.

Измеримые критерии следующего этапа:

- [x] 3/3 entry points после отказа сохраняют полный исходный draft; принятый исходный input снимается только после подтверждения; новые текст/вложения/настройки и другой аккаунт/чат не стираются.
- [x] Заметочный draft сохраняется по actor/operation UUID перед внешним созданием backing chat; отказ/повреждение/переполнение Storage даёт 0 созданий/0 provider запусков.
- [x] После reload и возврата к заметке восстанавливаются тот же raw prompt, attachments, model/tool selection и submitted note text; принятие backing chat переносит snapshot к chat scope до снятия note-operation key.
- [x] Model dispatch journal связывает принятую операцию с исходным raw composer snapshot, включая выбранный текст заметки; повтор accepted не оставляет старый snapshot для новой платной отправки после следующего reload.
- [x] Native browser Storage и реальные component handlers подтверждают reload, lost acknowledgement, accepted cleanup refusal, actor/scope changes, новые черновики; никаких слепых provider повторов.
- [ ] Полный frontend, качество/типы без новых диагностик, exact source/remote и защищённые данные/production сверены; commit/push, отдельный отчёт и CAS обновление плана завершены.

Evidence: /Users/yshishenya/.codex/private-artifacts/airis-chat-draft-recovery-20261009. Это часть task-2-1, SDD1/2 active; общий план198/244 и конечная A/B цельactive. Provider/billing/native production/pilot остаются обязательными.

Финальная проверка источников: 8 воспроизведённых регрессий до правки (3 submit callbacks, 2 Storage, 1 navigation autosave, 1 actor switch, 1 приоритет бесплатной модели URL). Native Chrome на отдельном helper подтвердил6007 символов/image/settings, reload/transfer/refusal/selective consume. Backend464 файла неизменны; переиспользуется1063/0skip после сверки всех SHA256. Фактический финальный frontend/type/lint результат и точный commit/remote фиксируются в receipt/test-acceptance.json; общий контроль качества и полный work item остаются открытыми. Legacy чаты мигрируются после проверки owner, общий старый home draft сохраняется без автоматической привязки к новому аккаунту.

Явно выбранная модель URL применяется после восстановления черновика и снимает старое упоминание платной модели. До исправления настоящий initNewChat выбрал paid вместо model; submit=false не запускает отправку. Недоступный явный выбор остаётся пустым, без подстановки модели из прежнего черновика.

Принятое дерево: frontend1270/137 файлов/0failed, type1666/103 и ESLint970/новых0; Prettier и git diff --check проходят. SDD validate нашёл отсутствующий metadata.file_path у обеих задач; пути заполнены через update-task-metadata, validate теперь0errors/0warnings. Lifecycle остаётся1/2 active. Git доставка и CAS отчёт фиксируются отдельными receipt.json и private-goal-sync.json; production не выпускался.

## Смонтированный интерфейс — в работе

Source e922b4fdce4ecc2f2ace799b46f088980ffeb290 отправлен, 1600 Git blobs сверены. Проверяется временный собранный frontend и текущий backend с принятыми зависимостями, без выпуска на production. Новая регрессия настоящего initNewChat показала пустой q: loading оставался true при setTextWithRetries, новое поле не могло смонтироваться. Browser до правки проверяется по трём существующим guide сценариям. Требуется сначала восстановить draft, затем смонтировать composer и только потом заполнить/отправить явный q. Native/AST проверки прежнего этапа не считались полной браузерной приёмкой.

Evidence: /Users/yshishenya/.codex/private-artifacts/airis-chat-dispatch-mounted-20261009. Общая цель active, SDD1/2, план198/244.

### Готовность поля первой задачи — исходники проверены

- [x] Реальный initNewChat с настоящим setTextWithRetries воспроизвёл пустой q до правки: expected empty to be guide. В собранном e922 Chrome после настоящего входа первый guide сценарий также получил пустое поле; это дефект интерфейса, не ошибка подготовки аккаунта.
- [x] Минимальная правка переносит loading=false и tick после восстановления draft/параметров, перед заполнением desktop event/q/preset. Новых зависимостей и контрактов нет; upstream impact: перестановка одного присваивания и ожидание существующего tick в Chat.svelte.
- [x] Полный frontend1271/137 файлов/0failed/0skipped. Типы1666/103 и ESLint970, новых диагностик0. Prettier и git diff --check проходят. Backend464 SHA256 совпали с принятым1063/0skip; protected21 и production/environment/config/mounts/neighbors сохранены.
- [ ] После-правки собранный browser, draft/replay/note/temporary, CI/PR/интеграция/чистый образ/production ещё не приняты. Текущий commit доказывает доставку исходников; общий план198/244, SDD1/2 active, конечная цельactive.

Evidence: airis-chat-dispatch-mounted-20261009/verify-source.py, test-acceptance.json, frontend-full.json, draft-guide-mount-before.json и browser trace до правки. Выбор тестов ^guide сначала дал No tests found; этот запуск не засчитан воспроизведением. Повтор с корректным фильтром исполняет3 настоящих сценария. Сборка первого frontend выполнена с чистого pinned Node digest; backend runtime dependencies взяты из принятого clean image только для временного стенда, новым production образом это не считается.

### Полная проверка собранного чата — в работе

- [x] Собранный e922 воспроизвёл пустое поле во всех3 guide сценариях; trace/screenshot/error-context сохранены, вход и аккаунт прошли.
- [x] Исправление готовности поля fcf844f13cf199f42f4c22ee216da126ca7cefd8 отправлено; remote совпал,1600 Git blobs сверены.
- [ ] Новые браузерные проверки полного черновика6007символов/image, обычного accepted/absent восстановления без дубля, повторного создания чата заметки, безопасного временного accepted/unknown. Два существующих browser проекта: Chrome desktop и Firefox390. Для unknown подменяется только статус GET; accepted и absent используют настоящий HTTP/backend/DB и контролируемый provider fixture.

Evidence: airis-chat-dispatch-mounted-20261009. Runtime/dependencies не изменяются; e2e использует прежний account/SMTP/payment fixture. Сборка после правки проверяет все6739 tracked source hashes, кроме одной static/pyodide/pyodide-lock.json, заменённой принятым frozen browser ресурсом и отдельно проверенной по manifest. Generated fixture traces исключены из build context после сохранения проверенного архива.

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
