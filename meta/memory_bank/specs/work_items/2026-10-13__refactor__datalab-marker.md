# AIRIS — простые этапы DatalabMarker

- Type: refactor
- Status: Done
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-datalab-marker-2026-10-13-117.json

Цель: убрать новое C90122 в load без изменения поведения. Перенести существующее ожидание результата и формирование Document в два метода текущего класса. Не менять запрос, 300 попыток с интервалом 2 секунды, приоритет ошибок, формат, metadata и запись результата. check_marker_request_status использует другой URL и контракт ошибок и не заменяет существующее ожидание. Loader.aload уже выполняет sync loader через asyncio.to_thread.

- [x] Один runnable regression до/после: native requests.Response/HTTPError, настоящий временный файл, direct/poll, payload, content/metadata/images, ошибки и нефатальная запись.
- [x] Минимальная правка; Docker Compose backend/четыре свежие PostgreSQL, Black/Ruff/CI, сохранность, SDD, commit/push.

Upstream impact: только retrieval/loaders/datalab_marker.py; два частных метода в существующем классе. Constructor, MIME/status method и callers остаются прежними по AST. Новых классов, зависимостей, настроек и I/O нет. Существующий requests 2.32.5 не заменяется в этом переносе; обновление клиента отдельно от механического изменения. Настоящий провайдер не используется.

Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-datalab-marker-117-20261013. Baseline 1acda9051e4e01d868fb9415f5e08128cd6d1b43:1074backend/25warnings,Black0diff,Ruff481/newCI6. Откат: revert commit. План198/244,цельactive; выпуск после общего gate.

Приёмка:28native сценариев до/после;AST после обратной подстановки совпал. Backend1102/0ошибок/пропусков/25прежнихwarnings,4свежиеPostgreSQL базы. Black474unchanged;Ruff481→480/new0;scopeCI3→2/new0;branch275files6436→446/new6→5. Frontend5149hashes/2600tests/types0/0/ESLint0 reused. Production healthy/restarts0/image/env/config/mount/14соседей,21чужойtracked-файл,262тома и33networkIDs/config/attachments сохранены. Своиcontainers/network/полныеbaselineкопии удалены. Реальный provider/выпуск не проверялись;общийPR/CI/quality gate впереди. План198/244,цельactive.
