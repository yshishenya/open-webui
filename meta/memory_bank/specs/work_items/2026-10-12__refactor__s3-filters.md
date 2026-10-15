# AIRIS — простые фильтры документов S3

- Type: refactor
- Status: Done
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-s3-filters-2026-10-12-112.json

Устранить четыре замечания C901 в search/query/get/_matches_filter. Сохранить выбор документов и ключей удаления, порядок результатов/операторов, короткое вычисление логических условий, пустые и неверные значения, отсутствие полей, пределы, пагинацию, ошибки и сообщения журнала. Два небольших pure helper: сравнение поля и общая обработка одинаковых ошибок search/get/query; новые классы, зависимости, AWS запросы и миграции не нужны. Сохранять успешный search; не менять insert/upsert/delete/reset и общие contracts.

- [x] Прочитать весь S3 module, query/get/delete, facade и consumers; один runnable regression до правки, native SDK stubbed reads/deletes и дифференциальное сравнение.
- [x] Минимальная правка; полный backend/четыре свежие PostgreSQL базы, Black/Ruff/CI, сохранность, завершение SDD, commit/push.

Upstream impact: только четыре существующих метода и два естественных pure helper в upstream-owned retrieval/vector/dbs/s3vector.py; новый test. Ни новых I/O, ни универсального языка фильтров или таблиц предикатов. Async facade и прежний sync client boundary сохраняются. Все изменённые функции получают конкретные type hints, без Any. Boto3 1.42.62/существующий botocore/pytest сохраняются; новых интеграций и вызовов API нет. SDK Stubber уже доступен вместе с текущим SDK. Cloud/provider/production completion не подтверждается подменёнными ответами.

Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-s3-filters-112-20261012. Baseline21c7235687ee927e915c7cebbc861f9962b1bb04:1068backend/25warnings,Black0diff,Ruff489/CI13. Откат:revert commit. План198/244,цельactive;выпуск отдельно после всех обязательных gate.

Уточнение после чтения: search/query/get повторяют обработку NotFound/AccessDenied. Общий маленький helper убирает эту копию и сохраняет уровни/сообщения журналов и повторное возбуждение остальных ошибок. Это не новый слой или универсальный обработчик.

Приёмка:10480filter/5080native result-request-error-log/400unequal-query сравнений совпали. NativeBoto3Stubber regression до/после, дополнительный search-error regression до search-правки. AST прочего модуля прежний. Модуль короче на31строку; новые классы/зависимости/I/O/подавления отсутствуют. 1069backend/0ошибок/пропусков/25прежнихwarnings,4свежиеPostgreSQL базы. Black469unchanged;Ruff489→485/new0;scopeCI6→2/new0;branch270files6432→451/new13→10. Frontend5040хешей прежние,2600tests/types0/0/ESLint0 переиспользованы. Production healthy/restarts0;образ/env/config/mount и12из14прежнихсоседей сохранены;два внешних terminalконтейнера исчезли между read-only снимками,причина неизвестна,серверных изменений задачей нет. 21чужойфайл/262тома/33networkIDs/config/attachments сохранены. Своиcontainers/network/полныеbaselineкопии удалены. Draft search-C90111 correctly failed source gate; конечный gate новых замечаний не содержит, правила сохранены. План198/244,цельactive,выпуска нет.
