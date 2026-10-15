# AIRIS — простой внешний загрузчик документов

- Type: refactor
- Status: Done
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-external-loader-2026-10-12-110.json

Убрать один C901 без новых функций, классов или зависимостей: removesuffix удаляет только один завершающий slash; list comprehension возвращает прежние Document objects в прежнем порядке. Остаются прежние сетевой вызов, headers, bytes, исключения, типы и модели. Удалять все slash через rstrip нельзя: это изменит прежний URL.

- [x] Прочитать весь loader/headers и пути Loader.load/aload/get_content_from_url; один новый тест до изменения, сравнение запросов/ответов/ошибок baseline/current.
- [x] Минимальная правка; полный backend на четырёх свежих PostgreSQL-базах, Black/Ruff/CI, сохранность, завершение SDD и commit/push.

Upstream impact: два выражения в существующем upstream-owned external_document.py и новый test. Синхронный requests/file I/O остаётся на прежней sync границе; Loader.aload/get_content_from_url используют существующее asyncio.to_thread. Ничего не добавляется в async runtime. Входной URL — str; нет миграций, новых Any или зависимостей. LangChain Document и pytest уже используются в проекте.

Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-external-loader-110-20261012. Baselinece60a84b7947907661e6b4ca6b348283b87583ea:1066 backend/25 warnings,Black0diff,Ruff491/CI15. Откат:revert commit. Общая цель active, план198/244; выпуск отдельно после финальных gate.

Приёмка: 1067 backend, 0 ошибок/пропусков, 25 прежних предупреждений; четыре свежие PostgreSQL-базы. Один тест до/после; 304 сравнения запросов, documents и exceptions, включая native JWT/legacy headers, совпали. AST всего module совпадает после двух заявленных замен. Black467unchanged; Ruff491 → 490,new0; scopeCI1 → 0, branchCI15 → 14. Frontend5040хешей прежние. Production и 15 прежних соседей/21чужойфайл/262тома/32network IDs сохранены. Builtin bridge пересоздана19:33:32 до собственного стенда, настройки/подключения прежние; причина неизвестна, task не рестартовалDocker/bridge. Новый Status в33сетях — runtime observation. Временные службы/сеть/полныеCIкопии удалены. Цель active, план198/244, выпуска не было.
