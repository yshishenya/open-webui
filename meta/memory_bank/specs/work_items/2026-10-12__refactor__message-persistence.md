# AIRIS — простое обновление сообщений и восстановление истории

- Type: refactor
- Status: Done
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-message-persistence-2026-10-12-108.json

Устранить два C901 в ChatMessageTable без новых abstractions/helpers/dependencies. Обновление обычных полей — цикл по прежнему точному набору, четырёх aliases — отдельный цикл с существующим DB_TO_JSON_KEY_MAP. При восстановлении: простой dictionary comprehension сохраняет только non-null/external columns; setdefault создаёт leaf childrenIds. Порядок идентификаторов/полей, usage/info, ссылки parent/children и None-versus-empty сохраняются.

- [x] Прочитать весь module/все callers, добавить одну meaningful регрессию sparse updates/aliases/history; пройти её до правки на SQLite/PostgreSQL, доказать прежний контракт.
- [x] Минимально изменить два метода, пройти regression/полный backend/real PostgreSQL row-lock sparse-save cases/CI delta/Black; сохранить данные,закрытьSDD,commit/push.

Upstream impact: один существующий model и один existing test module. Lock path, success checkpoints, normalize/merge usage, commit/flush, insertion иисключения неизменны. Конкретный список обновляемых полей не расширяется до произвольных setattr из пользовательских данных. CamelCase fallback прежнийtruthy-or,явноеfalse/[]/null обычныхполей остаются явнымизначениями;отсутствующие поля не очищаются. created_at/chat_id/user_id/переданныеклиентомcheckpoint не обновляются. Existing tests уже покрываютatomiccommit/rollback/повторы/долговечныйsuccess/concurrentappend/clear. Нет новых функцийAny/DBcontracts.

Проверки: existingpytest fixtures без новогоframework;1test до/посленаSQLite/PostgreSQL. Differential acceptance тела обоихметодов изbaseline/current сsyntheticDBboundary иреальнымиORM/Pydanticobjects проверяет одинаковыеoutputs/rowstates/calltrace; это не PostgreSQL-lock proof. Existing check_chat_sparse_save_postgres.py отдельно проверяет реальныеwriters/rowlocks. Fullbackend сохраняет -Werror::pytest.PytestUnhandledThreadExceptionWarning. Frontendhashreuse,sourcefreeze,productionpreservation.

Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-message-persistence-108-20261012. Baseline107:1064tests,25warnings,Ruff495/CI19C901,Black0diff,frontend2600/types0/0/ESLint0. Откат:revertcommit. Общаяцельactive,план198/244;productiongoal не закрывается.


Приёмка 12.10.2026: 1065 тестов backend, 0 ошибок и пропусков, 25 прежних предупреждений. Новый тест прошёл до и после изменения на SQLite и PostgreSQL. Сравнение 776 вариантов записи и 8 вариантов истории совпало; отдельная проверка настоящих блокировок PostgreSQL прошла 3/3 сценария. Black: 465 файлов без изменений; Ruff: 495 → 493, новых замечаний нет. Проверка изменений относительно integration: 17 оставшихся C901 (было 19), правила не ослаблены. Frontend: 5040 хешей совпали с проверенной версией. Production, 12 соседних контейнеров, 21 чужой файл, 262 тома и 33 существующие сети сохранены. Собственные временные контейнеры, сеть и полные копии исходников для сравнения удалены. Выпуска не было; цель active, план 198/244.
