
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

- [ ] **[BUG][IMAGES]** Договор и жизненный цикл настроек изображений
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__image-settings-lifecycle.md
  - Owner: Codex
  - Started: 2026-10-10
  - Summary: Разбираются 46 diagnostics, ошибки JSON/сохранения и оба FileReader; сохраняются денежные пути и production.

- [x] [BUG] Настройки изображений — приняты и отправлены исходники.
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__image-settings-lifecycle.md
  - Owner: Codex
  - Done: 2026-10-10
  - Summary: 20 исходных отказов воспроизведены; общий JSON API переиспользует Audio timeout/abort; params/workflow/pending/uploads защищены. 40 адресных + 34 соседних, 1667 общих; types 1275/87, ESLint 804, новых диагностик 0. Общий зелёный допуск и рабочий выпуск остаются открытыми.

Настройки изображений: runtime SHA `e27cda8bddb11958504452ab6f46e5a1c6cac5a4`; 9/9 браузерных сценариев, 1755 frozen Git blobs, SDD 3/3. План остаётся 198/244, цель active; выпуск не выполнен.

- [ ] [BUG] Сохранность настроек интерфейса и общего saveSettings.
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__interface-preference-safety.md
  - Owner: Codex
  - Started: 2026-10-10
  - Summary: Воспроизведение фонового файла, отмены черновиков и гонки частичных настроек; финальная цель active198/244.

Настройки интерфейса: приняты итоговые 122 адресных/соседних и 1687/1687 общих тестов (157 файлов); types1212/86, ESLint780, новых0. Браузер11/11, console0/0; 1756 frozen/backend542/protected21/production12соседей сохранены. Общий зелёный допуск/выпуск остаются открытыми.

- [x] [BUG] Настройки интерфейса — исходники приняты и отправлены.
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__interface-preference-safety.md
  - Owner: Codex
  - Done: 2026-10-10
  - Summary: Runtime78f4650a7d605198da01dbb673b4b73ae2a9b41f, 1756 Git blobs; 122/1687 тестов, браузер11/11, types1212/86, ESLint780, новых0. SDD3/3,216валидных; собственные пустые тома удалены. Частная приёмка синхронизируется после docs push; план198/244 и production gates открыты.

- [ ] [BUG] Выбор эмодзи и сохранность недавних предпочтений.
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__emoji-preference-safety.md
  - Owner: Codex
  - Started: 2026-10-10
  - Summary: Отложенный save отклоняется без catch; таймер не освобождается. У VirtualList неверный height и отсутствующий rowHeight; пять callers изучены.

- [x] [BUG] Выбор эмодзи — исходники приняты и отправлены.
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__emoji-preference-safety.md
  - Owner: Codex
  - Done: 2026-10-10
  - Summary: Runtime `878e48231bd8037ea6266455dcb175d6742e69a1`,1758 Git blobs;13/1700 тестов,браузер8/8,types1183/86,ESLint780,новых0. SDD2/2,217валидных;пустые собственные тома удалены. План198/244 и производственный допуск открыты.

- [x] [BUG] Управление функциями без потери состояния принято в исходниках.
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__function-management-safety.md
  - Owner: Codex
  - Done: 2026-10-10
  - Summary: Runtime a31bffdcd6cb92efcc493a9219f0792b05fd6006,1761 Git blobs;35/1735 тестов,браузер9/9,types1148/86,ESLint769,новых0. SDD3/3,218валидных;свои пустые тома удалены. План198/244,production/финальная цель открыты.

- [x] [BUG] Импорт по ссылке и завершение Modal — принято в исходниках.
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__source-import-modal-safety.md
  - Owner: Codex
  - Summary: 17 исходных отказов; импорт валидирует/копирует ответ, отменяет позднюю загрузку и ожидает редактор. Общий Modal безопасно удаляет listeners/portal и сохраняет блокировку прокрутки других окон; оба callers передают signal, tools URL API использует requestJSON.
  - Tests: focused43/43,frontend1756/1756/161файл,browser9/9,console0/0;types1148/86→1140/85,ESLint769→762,новых0. SDD3/3,219specs,1762frozenGitblobs;backend542/protected21/production12соседей сохранены.
  - Source: `9b1ef88dbee6ec2585250a7049ad0044506bb2bd` pushed and verified;production revision c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908 healthy/restarts0. Общие types/lint,PR/CI/production и A/B ещё не приняты;план198/244,цельactive.
  - Done: 2026-10-10 (приёмка исходников; интеграция ожидается)

- [x] [BUG] Настройки инструментов и функций — принято в исходниках.
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__valves-modal-safety.md
  - Owner: Codex
  - Summary: Черновик и 4 режима сохраняются,12API отменяются/имеют25sbody deadline. Late load/schema/save отбрасываются;явный повтор,edit lock,server response и пустые array сохранены.
  - Tests: 29 initial failures +1 native-array failure;focused133/133,full1815/1815/162files,browser15/15,console0/0. Types1140/85→1127/85,ESLint762,новых0. Backend542/protected21/production12соседей сохранены.
  - Source: `4554df21c7887b185dce632e793fdef88d7da4eb`,remote/frozen1763blobs verified,SDD3/3,220specs;whole types/lint/CI/PR/production и A/B pending;план198/244,цельactive.
  - Done: 2026-10-10 (исходники приняты, интеграция ожидается)

- [x] **[BUG]** Function catalog rejects refusals without clearing cached state
  - Spec: `meta/memory_bank/specs/work_items/2026-10-10__bugfix__functions-catalog-errors.md`
  - Owner: Codex
  - Branch: `codex/bugfix/chat-dispatch-replay`
  - Done: 2026-10-10
  - Summary: Seven original callers traced; shared requestJSON rejects network/JSON/container failure, cached state preserved, existing admin/editor cancellation reused, redundant admin prefetch removed. Runtime/remote `7d2d026674dcf289248380aab03846432b12928e`.
  - Tests: final full1835/1835,163 files; focused106/106 extracted; browser15/15,console0/0. Types1127/85 and ESLint762;new0. SDD3/3;preservation and5612 frozen Git blobs verified. Own proof cleanup only;262 other volumes preserved.
  - Risks: Local source acceptance; broader type/lint/backend gates, PR/CI/integration/clean build/deploy and real A/B criteria remain pending. No editor/Tools lifecycle or full-root claim.

- [ ] **[BUG]** Tools API and management preserve accepted state on refusal
  - Spec: `meta/memory_bank/specs/work_items/2026-10-10__bugfix__tools-management-safety.md`
  - Owner: Codex
  - Branch: `codex/bugfix/chat-dispatch-replay`
  - Started: 2026-10-10
  - Summary: Trace all legacy tools API callers; reproduce lifecycle/import/refresh refusals before shared correction.
  - Tests: In progress.
  - Risks: Source-only acceptance; global release and external A/B gates stay open.

- [x] **[BUG]** Tools API and management — source accepted
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__tools-management-safety.md
  - Owner: Codex
  - Done: 2026-10-10
  - Summary: Existing requestJSON/parser reused; explicit refusals, validated partial import, accepted delete/OAuth state, no duplicate writes or late lifecycle publication. Runtime `881e145b077981b53f11a2fb73c37189a45a7eea` pushed.
  - Tests: Frozen full1888/1888,focused100/100,browser18/18,console0/0;types1098/85,ESLint754,new0;backend542/primary21/production12neighbors preserved. SDD3/3completed.
  - Risks: Source acceptance only; broader quality, PR/CI/integration/build/deploy and real A/B criteria remain open. Plan198/244,goalactive.

- [ ] **[BUG]** Skills API/management refuse safely
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__skills-management-safety.md
  - Owner: Codex
  - Started: 2026-10-10
  - Summary: Trace actual server contracts and consumers; reproduce swallowed errors, late events, partial import and toggle/delete state before fixing shared causes.

- [x] **[BUG]** Skills API/management — source accepted
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__skills-management-safety.md
  - Owner: Codex
  - Done: 2026-10-10
  - Summary: Existing requestJSON/grant parser reused; validated full imports, preserved Markdown, contained refusals/partial acceptance, duplicate operations and late events. Editor loading/inactive state/metadata preserved. Runtime `3ac78da26bf0f9d38d41a71e310024d6f5ca097d` pushed.
  - Tests: Frozen full 1958/1958, focused 142/142, browser 23/23, console 0/0; types 1059/85, ESLint 742, new 0; backend 542/primary 21/production 12 neighbors preserved. SDD 3/3 complete.
  - Risks: Source acceptance only; global quality, PR/CI/integration/build/deploy and real A/B criteria pending. Plan 198/244, goal active.

- [x] [BUG] Prompts: API refusals, draft preservation and management
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__prompts-management-safety.md
  - Owner: Codex
  - Started: 2026-10-10
  - Summary: Reproduce actual API/editor failures, reuse requestJSON and existing validation; source acceptance before release.

  - Done: 2026-10-10 (Prompts source acceptance; production release pending)
  - Acceptance: frontend 2013/2013 (166 files), related 185/185, browser 21/21,
    console 0/0; types 1059→1001, lint 742→723, new diagnostics 0.
  - Preservation: 5618 frozen source blobs, backend 542, primary 21, production
    healthy/restarts 0 and 12 neighbors unchanged; all 262 volumes preserved.
  - Runtime: fcca5208491f40223da33a9e7daecb60b2a30337; plan 198/244, 46 open, goal active.

- [x] [BUG] Billing plan forms: source acceptance; release gates pending
  Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__billing-plan-forms.md
  Owner: Codex
  Started: 2026-10-10
  Done: 2026-10-10
  Summary: 2024 frontend, 12 focused, 7 PostgreSQL, 1064 backend, 8 browser; preserve subscriber guards and record whole quality/thread-warning limits.

- [x] [BUG] Sparse save/native activity test lifecycle accepted
  Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__sparse-save-test-lifecycle.md
  Owner: Codex
  Started: 2026-10-10
  Done: 2026-10-10
  Summary: Native calls 23/23 completed; strict backend 1064/0 thread errors; SQLite/PostgreSQL 38 each. App unchanged; release criteria remain open.

- [x] **[BUG]** Действия со списком чатов и папок
  - Spec: `meta/memory_bank/specs/work_items/2026-10-10__bugfix__sidebar-actions-safety.md`
  - Owner: Codex
  - Branch: `codex/bugfix/chat-dispatch-replay`
  - Started: 2026-10-10
  - Done: 2026-10-10
  - Summary: Генерация ожидает сохранение, снимает занятость при отказе, не дублирует запрос; уточнены существующие типы/DOM и массивы детей.
  - Tests: Целевые23/23; frontend2037/2037; types939/85 и ESLint723, новых0; backend1064 переиспользован после сверки543файлов.
  - Risks: Общие проверки качества/выпуск ещё открыты; новых зависимостей/миграций нет.

- [x] **[BUG]** Соответствие номеров и фрагментов источникам ответа
  - Spec: `meta/memory_bank/specs/work_items/2026-10-10__bugfix__citation-integrity.md`
  - Owner: Codex
  - Branch: `codex/bugfix/chat-dispatch-replay`
  - Started: 2026-10-10
  - Summary: Проверить одинаковые подписи разных источников, пропуски метаданных/оценок и общий путь модального/встроенного просмотра.

  - Done: 2026-10-10 (исходники; выпуск ожидает общих проверок)
  - Acceptance: 11/11 целевых, 2048/2048 frontend, 9/9 браузер, console0/0;
    types939/85→891/85, ESLint723→710, новых0. Backend1064 переиспользован,
    543 файла неизменны; новый backend запуск не выполнялся.
  - Summary: Одна groupCitations по id сохраняет позиции метаданных/оценок;
    исправлены legacy номера и URL встроенных источников/русских фрагментов.
  - Preservation: Production/12 прежних соседей/21 чужой файл/262 тома сохранены;
    внешний новый terminal-container не меняли; свои браузер/HTTP/сборка убраны.
  - Risks: Общие quality/PR/CI/выпуск и реальные критерии остаются открытыми.

- [x] **[REFACTOR]** Типы компонентов сообщений, оценок и выполнения кода
  - Spec: `meta/memory_bank/specs/work_items/2026-10-10__refactor__response-leaf-types.md`
  - Owner: Codex
  - Started: 2026-10-10
  - Summary: Переиспользовать существующие контракты и подтвердить идентичный JS/CSS.

  - Done: 2026-10-10 (исходники; выпуск ожидает общих проверок)
  - Tests: Пять compiledJS/CSS идентичны,frontend2048/2048;
    types891/85→834/85,ESLint710→710,новых0;SDD0283/3.
  - Preservation: Backend543/1064reused,production13соседей/healthy/restarts0,
    21чужой файл/262тома сохранены,новыхтомов0.
  - Risks: Общие quality/выпуск и реальные A/Bкритерии открыты;план198/244.

- [ ] **[REFACTOR]** Типы общих функций чатов, языка и OpenAPI
  - Spec: `meta/memory_bank/specs/work_items/2026-10-10__refactor__shared-utility-types.md`
  - Owner: Codex
  - Started: 2026-10-10
  - Summary: Описать прежние JSONконтракты, переиспользовать типы истории и документированный hashexport.

- [x] **[REFACTOR][TYPES]** Типы общих функций импорта, языка, переменных и OpenAPI
  - Spec: `meta/memory_bank/specs/work_items/2026-10-10__refactor__shared-utility-types.md`
  - Owner: Codex
  - Done: 2026-10-10
  - Summary: Устранены 21 прежняя ошибка типов; тела функций сохранены, named sha256 равен прежней функции. Без новых зависимостей и подавлений.
  - Tests: helpers 7/7; полный frontend 2055/2055; types 834/85 → 813/85, ESLint 710, новых замечаний 0; backend 1064 переиспользован после сверки 543 файлов.
  - Risks: Общие проверки и выпуск пока открыты; production и чужие данные сохранены.

- [ ] **[BUG][TYPES]** Панель чата и схема сообщений: контракт и показ ошибок
  - Spec: `meta/memory_bank/specs/work_items/2026-10-10__bugfix__chat-overview-contracts.md`
  - Owner: Codex
  - Started: 2026-10-10
  - Summary: Проследить передачу данных; переиспользовать существующие типы, исправить показ ошибок и отсутствие пользователя без новых зависимостей.

- [x] **[BUG][TYPES]** Панель чата и схема сообщений: типы и показ ошибок
  - Spec: `meta/memory_bank/specs/work_items/2026-10-10__bugfix__chat-overview-contracts.md`
  - Owner: Codex
  - Done: 2026-10-10
  - Summary: Переиспользованы типы истории и native графа; показ обоих форматов ошибки и отсутствие пользователя исправлены. Без выбранной модели необязательная emoji не запрашивается.
  - Tests: 36/36 связанных; полный frontend 2060/2060; браузер 7/7, console 0/0; types 813/85 → 781/85, ESLint 710 → 709, новых замечаний 0; backend 1064 переиспользован после сверки 543 файлов.
  - Risks: Общие проверки и выпуск открыты; production и чужие данные сохранены.

- [x] **[BUG] Выгрузка чатов и очистка PDF в обоих меню**
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__chat-menu-export.md
  - Owner: Codex
  - Started: 2026-10-10
  - Summary: Воспроизводим legacy-выгрузку и отказы PDF; используем прежние helpers и finally, без новой подсистемы.

  - Done: 2026-10-10
  - Tests: 16/16 целевых, 2072/2072 общих, браузер 6/6; types 752/85, ESLint 681, новых замечаний 0.
  - Release: Общие проверки качества и выпуск остаются открытыми.

- [x] **[REFACTOR] Подсказки и пустой экран чата**
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__refactor__chat-entry-types.md
  - Owner: Codex
  - Started: 2026-10-10
  - Summary: Переиспользовать типы модели и ввода; сохранить фильтрацию и вставку подсказки; убрать неиспользуемую передачу toolServers.

  - Done: 2026-10-10
  - Tests: 3/3 целевых до/после, 2074/2074 общих; 4 compiled JS/CSS идентичны; types727/85, ESLint681, новых замечаний0.
  - Release: Общие проверки качества и критерии A/B остаются открытыми.


- [x] **[BUG][TYPES]** Выбор вложений и имена старых файлов
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__chat-attachment-menu.md
  - Owner: Codex
  - Started: 2026-10-10
  - Summary: Старые файлы используют filename; существующие record types переиспользованы. Mounted3/3,frontend2077/2077,браузер1сценарий/4выбора; новых диагностик0.
  - Done: 2026-10-10
  - Tests: types698/85,ESLint673; общие gates остаются открытыми.
  - Risks: Production release pending; план198/244,цельactive.


- [x] **[REFACTOR]** Типы обработчиков меню вложений
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__refactor__input-menu-types.md
  - Owner: Codex
  - Started: 2026-10-10
  - Summary: Выбор/native file callbacks сохранены; compiled код совпал после unused import removal. Frontend2078/2078,новых диагностик0.
  - Done: 2026-10-10
  - Tests: Целевые4/4,types692/85,ESLint655; SDD0343/3.
  - Risks: CI50remarks/17changed files и production release pending; план198/244,цельactive.

- [x] **[REFACTOR][FRONTEND]** Обязательные замечания изменённых файлов
  - Spec: `meta/memory_bank/specs/work_items/2026-10-10__refactor__required-frontend-lint.md`
  - Owner: Codex
  - Done: 2026-10-10
  - Summary: Scoped lint220/220без диагностик; все50замечаний17файлов сняты. Frontend2083/2083,22compiled pairs,5realhandlers; types690/76 и ESLint605, новых0. Общий долг/выпуск/A/B остаются открытыми.

- [ ] **[FRONTEND][CI]** Дополнительные цели после правок callers
  - Spec: `meta/memory_bank/specs/work_items/2026-10-10__refactor__required-frontend-lint.md`
  - Owner: Codex
  - Started: 2026-10-10
  - Summary: После commit реальный список222цели;19прежних замечаний в NotebookView/Navbar теперь блокируют changed-file CI. Первоначальные50замечаний17файлов сняты; полный CI не принят.

- [x] **[REFACTOR][CI]** Блокнот и верхняя панель чата
  - Spec: `meta/memory_bank/specs/work_items/2026-10-10__refactor__notebook-navbar.md`
  - Owner: Codex
  - Started: 2026-10-10
  - Summary: Снять19оставшихся замечаний двух caller targets; переиспользовать existing HTML action и сохранить реальное поведение.

  - Done: 2026-10-10
  - Tests: Четыре целевые проверки; frontend2087/2087; актуальные222lintцели0/0; types687/74,ESLint586,новых0. Navbar compiled совпал; Notebook CSS/11callbacks сохранены. SDD0363/3.
  - Risks: Общий долг качества/PR/CI/выпуск/A/B открыты; production/чужие данные сохранены. Дополнительные19замечаний callers из предыдущей записи сняты этим блоком.


- [x] **[BUG][FRONTEND]** Отказ и отмена тестового чата
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__playground-response.md
  - Owner: Codex
  - Started: 2026-10-10
  - Summary: Проверить зависший loading и отмену обоих playground handlers; переиспользовать controller/finally и существующие типы, без повторов POST.

  - Done: 2026-10-10
  - Tests: Исходные handlers2/15 → 17/17, реальный DOM1/1, целевые44/44; frontend2105/2105;226lintцелей0/0; types654/68,ESLint556,новых0 после исправления optionalmessages и полного повторного прогона. ChildJS2/CSS4/callbacks4 сохранены после заявленного unused removal. SDD0373/3.
  - Risks: Общий долг/CI/интеграция/production/A/B открыты; план198/244 и цельactive. Production/21чужойфайл/262тома сохранены.

- [x] [BUG] Оценки: список, выгрузка и подробности
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__admin-feedback.md
  - Owner: Codex
  - Done: 2026-10-10
  - Summary: CSV/rating0/username/snapshot и отмена устаревшего чтения исправлены через requestJSON. Целевые19/19,frontend2124/2124,229lintцелей0/0; types618/68,ESLint545,new0. Production/21чужойфайл/262тома сохранены. Общие quality/release/A/B открыты.

- [x] [BUG] Пользователи: список и подтверждённое удаление
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__admin-users.md
  - Owner: Codex
  - Done: 2026-10-10
  - Summary: DELETE не меняет страницу при отказе, чтение/поиск отменяются; getUsers/requestJSON/GroupMember и Banner/sanitizedHtml переиспользованы. Own17/17,targeted44/44,frontend2141/2141;232lintцели0/0,types593/68,ESLint544,new0. Денежные callbacks/production/чужие21файла/262тома сохранены; release/A/B открыты.
