# AIRIS — простая проверка серверов инструментов

- Type: refactor
- Status: Done
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-tool-verification-2026-10-13-118.json

Цель: убрать новое C90128 из verify_tool_servers_config. Один частный async helper вместо двух одинаковых auth/header blocks; второй — существующий OAuth discovery block. Сохранить None/пустые/необработанные bearer/session/system OAuth tokens, custom-header override, URL, timeout/TLS, Pydantic OAuthMetadata, errors, MCP disconnect и native HTTP payload. OAuth-token exception по прежнему даёт соединение без токена, но теперь журналируется общим debug без секретов вместо пустого except.

Shared build_tool_server_headers не подходит: добавляет cookie/user forwarding, иначе получает OAuth и обрабатывает пустые токены. bearer_auth_header обрезает пробелы; здесь требуется прежняя передача токена. Registration metadata helper продолжает поиск после ошибки, меняет scope и имеет иной timeout; reuse изменил бы публичный контракт.

- [x] Runnable regression до/после: native FastAPI/Pydantic/aiohttp/httpx, локальный HTTP server; MCP boundary controlled, auth/custom headers/discovery/error/disconnect/admin guard.
- [x] Минимальная правка; полный Docker Compose backend/4свежиеPostgreSQL,Black/Ruff/CI,сохранность,SDD,commit/push.

Upstream impact: только routers/configs.py, два небольших async helpers и вызовы в прежней route. Остальные API/functions по AST прежние. Новых классов/зависимостей/настроек/I/O нет. Функция используется AddToolServerModal через POST /configs/tool_servers/verify. Настоящие пользовательские токены/внешний MCP provider не используются.

Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-tool-verification-118-20261013. Baseline82d1fc26ab3de8e437499a541f280936cbd76859:1102backend/25warnings,Black0diff,Ruff480,newCI5. Откат:revert commit. План198/244,цельactive;выпуск после общего gate.

Версии проверены в immutable runtime: aiohttp3.13.5,MCP1.27.2,httpx0.28.1,FastAPI0.136.3,Pydantic2.13.4. Прочитаны официальные aiohttp3.13.5 web/changes и MCP1.27.2 OAuth schema; latest stable aiohttp3.14.5/MCP2.3.0 сверены с PyPI и release notes. Compatibility exception: сохранить принятые версии при переносе существующего API. MCP2.3.0 требует httpx2>=2.10.0; обновить MCP/httpx transport/callers отдельно с native protocol и OAuth acceptance, aiohttp обновлять вместе с полным сетевым regression. Новых интеграций/dependencies здесь нет.

Приёмка завершена15.10:36native HTTP/auth/discovery/lifecycle сценариев до/после,прочийAST прежний. Кодкорочена17строк. Backend1138/0ошибок/пропусков/25прежнихwarnings;4свежиеPostgreSQL базы. Black475unchanged;Ruff480→479/new0;scopeCI1→0,new0;branch276files6436→445,new5→4. Frontend5149hashes/2600tests/types0/0/ESLint0 reused. Production healthy/restarts0/image/env/config/mount/12соседей,21чужойtracked-файл,262тома и33networkIDs/config/attachments сохранены. Своиcontainers/network/полныеbaselineкопииудалены. Реальный MCP provider/новыйвыпускнепроверялись;общийPR/CI/qualitygateвпереди. План198/244,цельactive.
