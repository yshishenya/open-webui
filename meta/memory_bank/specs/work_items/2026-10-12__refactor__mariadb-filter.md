# AIRIS — простые фильтры MariaDB

- Type: refactor
- Status: Done
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-mariadb-filter-2026-10-12-111.json

Убрать повторную обработку $and/$or и ручной цикл $in в одном существующем методе, сохранив точный SQL, скобки, placeholders, порядок str-параметров, приоритет $and, пустые/неверные значения и ошибки. Новых функций, классов, зависимостей, SQL-контрактов и миграций нет. Вход object с прежним narrowing; результат tuple[str, list[str]], без изменённых Any.

- [x] Прочитать модуль, рекурсию, search/query/delete и async facade; один runnable regression до изменения, сравнение baseline/current.
- [x] Минимальная правка; полный backend с четырьмя свежими PostgreSQL-базами, Black/Ruff/CI, сохранность, завершение SDD, commit/push.

Upstream impact: только _build_filter_sql_qmark в upstream-owned retrieval/vector/dbs/mariadb_vector.py и новый test. Query/search/delete сохраняют привязку значений через qmark; новая SQL интерполяция не вводится. Pure helper не выполняет I/O; sync calls остаются за существующим asyncio.to_thread. Никаких реальных MariaDB/AWS/production writes или deletes при проверке.

Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-mariadb-filter-111-20261012. Baseline c6ffeb42313eb8fdb934c512c82e2c93f621ae01: 1067 backend, 25 warnings, Ruff490/CI14. Откат: revert commit. План198/244 и цель active; выпуск требует отдельной полной приёмки.

Приёмка: один тест до/после;1125 сравнений фильтров и9 nativecaller сравнений на DBAPI doubles совпали; AST вне одного метода прежний. Настоящая MariaDB не проверялась. 1068backend/0ошибок/пропусков/25прежнихwarnings,4свежиеPostgreSQL базы. Black468unchanged;Ruff490→489/new0;scopeCI5→4/new0;branch269files6432→455/new14→13. Frontend5040хешей прежние,2600tests/types0/0/ESLint0 переиспользованы. Production healthy/restarts0,конфигурация/образ/14из15 прежнихсоседей/21чужойфайл/262тома/33networkIDs/config/attachments сохранены. Один внешний terminal-контейнер исчез между read-only снимками;причина неизвестна,задача не выполняла серверных изменений. Своиcontainers/network/полныеbaselineкопии удалены. Цельactive,план198/244,выпуска нет.
