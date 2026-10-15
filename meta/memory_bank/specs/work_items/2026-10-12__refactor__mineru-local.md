# AIRIS — простой разбор MinerU Local API

- Type: refactor
- Status: Done
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-mineru-local-2026-10-12-113.json

Устранить C90112 в _load_local_api: один маленький pure helper формирует прежнее подробное сообщение HTTPError; next(iter(results.values())) получает первый результат без полной копии списка. Сохранить multipart filename/bytes/data/timeout, параметры/порядок, первый документ, metadata, все HTTP codes/details, JSON/raw body fallback, отсутствие файла, ошибки и logger messages. Новых классов, зависимостей, I/O, migrations и ослаблений правил нет. Cloud API, polling, ZIP и constructor остаются прежними.

- [x] Прочитать весь module, load/local/cloud и реальные Loader.aload/route callers; один runnable regression до изменения, differential requests/results/errors/logs baseline/current.
- [x] Минимальная правка; полный backend/четыре свежие PostgreSQL базы, Black/Ruff/CI, сохранность, завершение SDD, commit/push.

Upstream impact: один существующий метод и маленький helper в upstream-owned loaders/mineru.py плюс новый test. Requests.Response/HTTPError и LangChain Document используются в существующем runtime; новые API/dependencies не вводятся. Все изменённые functions имеют concrete hints без Any. Helper parses in-memory response; новых blocking calls нет. Loader.aload использует asyncio.to_thread для прежнего sync Loader.load. Native requests.Response и файлы проверяются с подменённым POST; реальные parser/provider writes не заявляются.

Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-mineru-local-113-20261012. Baselineba7dff2ce65d530d67b9a3b8cd33634e93dd3871:1069backend/25warnings,Black0diff,Ruff485/CI10. Откат:revert commit. План198/244,цельactive;выпуск отдельно после всех обязательных gate.

Приёмка:один regression до/после;4962native request-document-error-log сравнений совпали. Multipart/params/bytes/timeout/первый результат/HTTPcodes/details/JSON-or-rawbody/None guard сохранены. AST прочего модуля прежний,новых зависимостей/I/O/классов нет. 1070backend/0ошибок/пропусков/25прежнихwarnings;4свежиеPostgreSQL базы. Black470unchanged;Ruff485→484/new0;scopeCI3→2/new0;branch271files6432→450/new10→9. Frontend5040хешей прежние,2600tests/types0/0/ESLint0 переиспользованы. Production/env/config/image/mount/healthy/restarts0/12прежнихсоседей/21чужойфайл/262тома/33networkIDs/config/attachments сохранены. Два новых внешних terminal-контейнера обнаружены;оставлены без изменений,серверных изменений задачей нет. Своиcontainers/network/полныеbaselineкопии удалены. Цельactive,план198/244,выпуска нет.
