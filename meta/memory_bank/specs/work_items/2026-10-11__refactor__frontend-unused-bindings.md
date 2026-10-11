# AIRIS — неиспользуемые объявления интерфейса

- Workflow: refactoring
- Status: locally done
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-frontend-unused-bindings-2026-10-11-064.json

Убрать 26 подтверждённых замечаний no-unused-vars в 10 компонентах из целей будущего CI. Только unused imports/locals/parameters/index; не менять props, обработчики, запросы, permissions, строки и CSS. Existing Svelte5.56/TS5.9 locked runtime; новых dependencies/modules нет.

- [x] Прочитать компоненты, найти родителей и сверить actual ESLint diagnostics.
- [x] Удалить только согласованный набор bindings; проверить скомпилированную разницу и публичные props.
- [x] Полные frontend/type/lint/format; новых замечаний0, сохранение production/21чужого файла/томов.
- [x] SDD, документация, commit/push и совпадение tested source.
- [ ] Общий выпуск и настоящие критерии A/B.

Upstream impact: удаления в 10 существующих компонентах, отдельная runtime подсистема не создаётся. Точный набор в private edits.json; изменение загрузки удалённых импортов проверять по настоящему compiled output и исходникам модулей.

Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-frontend-unused-bindings-20261011 . План198/244, цельactive.

## Принятый результат

Удалены26 подтверждённых no-unused-vars: imports, локальные context/dispatcher, параметры пустых defaults/событий, unused each index и filename. Публичные имена/типы props в10 компонентах совпадают. CSS совпадает в20client/server outputs. Полный JS не идентичен: различаются только просмотренные imports/unused calls/parameters и имя generated SSR index; после исключения именно этих отличий оставшийся compiled код совпадает. UserProfileImage сохраняет загрузку constants/APIutils; удалённые Badge/GarbageBin являются компонентами без модульных действий, Tooltip уже загружается родителем FileNav. Проверены настоящие реализации getContext/createEventDispatcher: удалённые результаты не использовались. Ответ VoiceRecording — обычный literal/JSON; filename не использовался.

Frontend2379/2379, failed/pending/todo0; types178/34 без изменений. Общий ESLint302→276, новых0; будущий CI331цель:95→69. Scoped10файлов:26 прежних any/compile ошибок, unused0; Prettierpass. Scoped/general lint остаётся unsuccessful, suppressions не добавлялись. Новых тестов механического удаления нет; существующий полный набор и compiled comparison использованы как проверка.

В private checker исправлено использование '$$index' в replacement string (JavaScript сворачивал $$ в $); приложение для исправления checker не менялось. При сборе CI targets первоначально лишние tests отсеяны по настоящему workflow regex; итог331цель совпадает с предыдущим набором. Первоначальный SDD CLI default medium без задач приведён кsimple двум задачам доactivate.

Backend1064/25 reused по565 совпавшим source/config хешам; нового backendrun нет. Productionc0ea9dd7823a89e21a8bd58f1e8eef6fe930b908 healthy/restarts0; image/config/env/mounts,12соседей,21чужойфайл и262тома сохранены, новыхтомов/тестовыхконтейнеров0. Browser/SMTP/payment/deploy вэтойпартии не выполнялись. SDD завершена локально; delivery receipt фиксирует commit/push и соответствие принятому source. План198/244, цельactive.
