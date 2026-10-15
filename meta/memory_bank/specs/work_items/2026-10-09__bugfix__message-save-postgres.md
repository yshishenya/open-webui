# [BUG] Проверка сохранения сообщений через API и PostgreSQL

Status: source-complete; release-pending
Owner: Codex
Started: 2026-10-09
SDD Spec: meta/sdd/specs/completed/airis-message-save-postgres-2026-10-09-025.json

Продолжение message-edit-save-result; база airis_b2c d579f5c02926cace8c8da60434ce1c39c7284361, явная зависимость 5f8ecc15496e91b861efee2090a7e16193e01dae. Полная цель A/B G01–G17 остаётся active.

- [x] Проверить настоящий API с JWT без подмены авторизации и PostgreSQL16 после штатных миграций.
- [x] Сверить sparse user/assistant edit, structured output, очистку content/files/output, legacy projection, соседнюю ветку и parent/children.
- [x] После подтверждённой записи повторить copy с тем же id: ровно4 сообщения, без второй копии; сверить JSON чата и normalized rows.
- [x] Чужой JWT, отсутствующий chat, malformed input и отсутствие JWT: отказ без изменений.
- [x] Привязать результаты к hashes исходников, проверить форматирование/линтер, сохранить отчёт и очистить собственный tmpfs стенд.
- [x] Commit/push исходников и сверка remote/1530Git blobs; CAS-обновление закрытого плана отдельным receipt без вымышленных номерных закрытий.

Причина подтверждена: два заблокированных PostgreSQL писателя с ответами200 потеряли New B в JSON истории при сохранении New B в normalized rows. Перед исправлением concurrent-before.json содержит history[New A,Old B] иrows[New A,New B].

Upstream impact: router/chats.py заменяет прежнее чтение/merge/запись и best-effort reconcile тонким вызовом fork-owned utils/airis/chat_save.py. helper блокирует строку по id/user_id, объединяет patch и записывает обе формы в одной транзакции; отказ normalized записи откатывает всё. Общий ChatMessages.upsert_message получает явный commit=False для caller-owned session; обычные callers сохраняют прежний commit. Генерационный Chats.upsert_message_to_chat_by_id_and_message_id также блокирует строку перед чтением, чтобы сериализоваться с editor. Runtime зависимостей и миграций0.

Приёмка расширена на одновременные API edits, одинаковый copy-id и API edit с общей точкой записи генерации. Это не настоящий LLM поток. Конфликт одного target между устройствами, произвольные устаревшие полные history snapshots и другие старые read/modify/write методы не объявлены решёнными. ASGI API-проверка не заменяет браузер/production, реальную генерацию и платёж.

Evidence: /Users/yshishenya/.codex/private-artifacts/airis-message-save-postgres-20261009

Совместимость зависимостей: используем закреплённый SQLAlchemy2.0.50 и существующий psycopg3.3.4 принятого образа; зависимости не добавлены и не заменены. PyPI на09.10 показывает SQLAlchemy2.1.4; обновлениеORM требует отдельного изменения runtime/lock, всех миграций и полной платёжной/provider регрессии. В этом исправлении сохраняется принятый runtime2.0, официальный API блокировок/flush/commit2.0 прочитан; путь обновления — отдельный проверенный кандидат2.1 с теми же production gates. Версии реально установленного образа: installed-versions.log, официальные источники: official-docs.json.

Проверено09.10:1026 backend tests/0fail/0skip; PostgreSQL API1 сценарий с несколькими записями/readback/проверкой прав;3/3 синхронизированных конкурентных сценария edits/copy/stream-write. Перед исправлением2ответа200 потеряли соседа. Повтор copy-id оставляет ровно4messages; история и normalized rows совпадают. Ошибки normalized write и title validation откатывают историю. Строгое совпадение Alembic heads o1a020261003, PostgreSQL16.457Python файлов заморожены поSHA256;frontend1073 совпадают с предыдущими1181tests и не проверялись повторно. Black457 проходит; Ruff547→547, новых диагностик0, существующая сложность upsert16→17. Types1666/103 иESLint970 из прежней проверки не заменяют G14.

Промежуточные неудачи сохранены: первоначальный тест требовал отсутствующие пустые ключи parentId/childrenIds; первый pytools запуск не смог создать Docker сеть (использован существующий external network); новый SDD id генератора имел неверный формат и исправлен в собственном незакоммиченном файле; Ruff baseline cache требовал записи вroкаталог (повтор с--no-cache); повтор suite на reused reporting fixture упал DuplicateTable(user), окончательный suite1026/0skip выполнен с4новыми пустыми базами. Промежуточные результаты не приняты за окончательные.

Source delivery и image/production приёмка — отдельные шаги. Реальный API здесьASGI/TestClient сJWT иPostgreSQL, без auth/dependency overrides; отдельный case stream использует настоящий общий метод записи, а не LLM провайдера. G01/G05/финальная A/B цель не закрыты.

Исходники `a7a378afed59baac304ee1b0572e48bd7da3c098` отправлены в`codex/bugfix/message-save-postgres`, remote совпал,1530testedGit blobs совпали. SDD2/2 завершён; production`c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908` healthy/restarts0,окружение/подключения/12соседей и21защищённый файл сохранены. Собственный PostgreSQL tmpfs контейнер удалён после приёмки; резервные копии/общие сеть икэши не изменены. PR/интеграция/выпуск и настоящая браузерная/LLM приёмка остаются открытыми. План198/244,новыхномерныхзакрытий0,цельactive.
