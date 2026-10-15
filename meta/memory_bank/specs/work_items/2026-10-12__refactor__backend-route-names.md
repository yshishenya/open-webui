# AIRIS — уникальные имена Python обработчиков

- Type: refactor
- Status: Done (source acceptance; production goal active)
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-backend-route-names-2026-10-12-107.json

Устранить два F811 в routers/files.py и routers/functions.py. Первые определения переименовать в get_file_content/list_functions; decorator name сохраняет прежнее внешнее имя. Вторые определения и их экспортируемые символы остаются прежними: images вызывает второй файловый обработчик, url_path_for выбирает первую подходящую именованную route. Добавить конкретные аннотации изменённым функциям из существующих моделей. Никаких wrapper/helper/alias/dependencies.

- [x] Native FastAPI до/после: полный OpenAPI/route metadata, 12 HTTP случаев, прямой вызов images и генерация прежних ссылок; bodies/оставшиеся symbols сохраняются.
- [x] Полный backend с PostgreSQL, Black/Ruff/настоящий CI delta, frontend hash reuse, сохранность данных; закрыть SDD, commit/push.

Upstream impact: только два router файла. Доступ, содержимое ответов, PDF inline/attachment, text stream, response_model и экспорт code/valves не меняются. Добавленные UserModel/Response/сервисный return type должны сохранять OpenAPI. Новых интеграций и версий библиотек нет: используется существующий native FastAPI name параметр. Тестовые dependency overrides проверяют обработчики, а не реальный вход; сохранность настоящих auth dependencies проверяется по route metadata. Миграции/production не затрагиваются.

Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-backend-route-names-107-20261012. Baseline106: 1064 backend, 25 warnings, Black0diff, Ruff497, CI21 (19C901/2F811), frontend2600/types0/0/ESLint0. Compose-first, source read-only, отдельная временная сеть/PostgreSQLtmpfs. Откат: revert commit. Цель active, план198/244.

Принято12.10: native FastAPI0.136.3/Starlette1.6.0 из принятого образа. 12HTTP случаев до/после прошли; body/headers/status,полный OpenAPI29paths и31route contracts совпадают побайтно после JSON-нормализации. Имена маршрутов/operation IDs,ответы/схемы,реальные auth/DB dependency call identities сохранены. PDFinline/attachment,download,textfallback,missing/denied404;functions pluginsoff/on,list скрывает code/valves,export запрещён обычномуuser и возвращаетcode/valvesadmin. Для обработки используются native роутеры/ASGI,данные/services/вход подменены fixture: это не реальныйlogin/провайдер. Прямой вызов images на второйhandler иurl_path_for старыхroute names сохранены. SourceAST совпадает после исключения только двух заявленныхимён/decoratorname иannotations/одногоexistingtypeimport;тела функций не менялись. Permanenttest не добавлен для простого переименования; runnablenativeproof остаётся.

Полныйbackend1064passed/0fail/errors/skips,25прежнихwarnings совпадают после нормализации source line (functions.py сдвинутна3строки);shutdownswigwarning прежний. ЧетыреPostgreSQLбазы реально включены,основныеSQLiteтесты не названы PostgreSQL. Black26.10.1:465unchanged/0diff. ОбщийRuff0.17.0:497→495,new0. ScopeCI2files:6→4/new0;checker6/6. ВесьbranchCI265files относительноd579f5c02926cace8c8da60434ce1c39c7284361:6432→461,new21→19,всеоставшиесяC901. Общийbackendgate495 иCI19 открыты,подавленийправилнет.

Frontend5040хешей совпали с принятой104/106версией (2600tests,types0/0,ESLint0),повторногозапусканет. Production revision/env/config/mount/healthy/restarts0/12соседей совпали через существующийKVNSSHjump;21чужойфайл/262тома/32customnetwork IDs сохранены. Все33прежнихимениnetwork присутствуют; builtin bridge пересоздана18:34:50,изменилисьтолькоId/Created,конфигурация/подключениясовпали. Причинапересозданиянеустановлена,taskнеперезапускалDocker инеизменялbridge. Собственныеcontainers/network иполныеCIbaseкопии удалены. Публикацииприложениянет,план198/244,цельactive. Следующий блок —19сложных функций с проверкой вызывающихпутей ипрежнего поведения,безgenericframework.
