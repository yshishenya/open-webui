# AIRIS — минимальные исправления backend для выпуска

- Type: refactor
- Status: Done (source verification; production goal active)
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay (продолжение существующей ветки цели)
- SDD Spec: meta/sdd/specs/completed/airis-backend-mechanical-2026-10-12-105.json

Цель: убрать 21 проверенное механическое замечание Ruff без изменения пользовательского поведения. 14 строк без подстановок становятся обычными строками; 5 аннотаций с future annotations теряют избыточные кавычки; один open использует существующий режим чтения по умолчанию; одни лишние скобки удаляются. Новых зависимостей нет. Сортировка импортов, сравнения ORM, enum и сложные функции требуют отдельной проверки и сюда не входят.

- [x] Сверить диагностику и потоки, сохранить исходники, доказать эквивалентность Python AST после только разрешённых преобразований.
- [x] Пройти весь backend с PostgreSQL, повторить Ruff/Black, сверить неизменность frontend и сохранность данных; закрыть SDD, commit/push.

Upstream impact: 13 существующих Python файлов; только перечисленные преобразования, без переносов/новых модулей/изменения API. Аннотации при future annotations разрешаются в прежние типы; их сырые строковые представления меняются, побайтовая идентичность не заявляется. Потребители inspect/get_type_hints просмотрены, зависимости от лишних кавычек не обнаружены. Существующий parameterized SQL сохраняет текст и :tag_id. Существующий синхронный путь import_legacy_config_json не расширяется.

Проверки: Compose с принятым образом sha256:91327e28991ec1e2429f1d65c2d5bc908759a16bb7263beda6e655798f4fdac9, источник read-only, отдельная временная сеть и PostgreSQL в tmpfs; полный pytest с -W error::pytest.PytestUnhandledThreadExceptionWarning. Ruff 0.17.0 и Black только читают источник. Frontend не запускать повторно при совпадении хешей принятой версии104. Исходный Ruff547/144files, frontend2600/2600,types0/0,ESLint0. Откат: revert commit. Эта проверка не закрывает общий backend gate или production цель.

Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-backend-mechanical-105-20261012.

Проверено12.10: 21 diagnostics/13files, Python3.11 normalized AST совпадает после только разрешённых преобразований. Полный backend1064/1064,0fail/errors/skips;25warnings побайтно совпадают с прежним отчётом. Четыре PostgreSQL базы действительно включены;6явно именованных PostgreSQL/конкурентных случаев перечислены в acceptance.json. Остальные основной backend случаи не объявляются PostgreSQL-тестами. Black26.10.1:465unchanged/0diff. Ruff0.17.0:547→526/142files,новых0. Настоящий CI delta для13файлов:111→89/new0;6тестов самого checker passed. Частичная baseline-копия checker содержит дополнительное I001 на неизменном import block config.py:1; оно отсутствует в полном исходном отчёте. Поэтому снижение продукта считается только по полному547→526, а scope используется для new0.

Полная CI delta всей накопленной ветки относительно d579f5c02926cace8c8da60434ce1c39c7284361:265Python files,6432→492 diagnostics,38new (19C901,11F811,5I001,3E402). Все38строк совпадают с HEAD до этой партии; эта партия их не добавляет. Общий backend gate и PR остаются открытыми. Следующий приоритет — реальные38CI замечаний с проверкой причин, включая повторные импорты; весь526отчёт сохраняется без ослабления правил.

Frontend source/static/manifests5040хешей совпадают с принятой104версией (2600tests,types0/0,ESLint0), повторный запуск не потребовался. Production healthy/restarts0,12соседей/21чужойфайл/262тома сохранены; own PostgreSQL/container/network и временнаяCIкопия удалены. Две ошибки подготовки сохранены: стандартный Docker pool исчерпан (использована свободная собственная subnet), bare pytest не добавляет package path (python -m pytest прошёл); Ruff cache исправлен --no-cache. Это не дефекты продукта и не успешные проверки. Публикация продукта не выполнялась,план198/244,цельactive.
