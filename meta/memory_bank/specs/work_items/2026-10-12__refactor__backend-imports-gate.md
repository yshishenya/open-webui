# AIRIS — повторные импорты и их размещение

- Type: refactor
- Status: Done (source acceptance; production goal active)
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-backend-imports-2026-10-12-106.json

Цель: устранить17из38реальных CI замечаний накопленной ветки. Девятьфайлов:4миграции,chat_messages/chats/prompts,retrieval/utils,middleware. Удалить повторные SQLAlchemy/Document/JSONResponse imports; упорядочить только необходимые блоки; перенести поздние imports и создание logger. Два повторных имени endpoint остаются отдельной правкой с приёмкой route names/внешних вызовов,19complexity остаются открытыми. Новых modules/dependencies/runtime функций нет.

- [x] Проверить все импортируемые объекты/порядок/потребителей; реальные cold imports до/после; сохранить executable non-import AST и тождество bindings.
- [x] Полный backend с PostgreSQL,Black/Ruff/настоящийCI checker относительно integration,сохранность production/данных; закрытьSDD,commit/push.

Upstream impact:9существующих Pythonфайлов,толькоimports/logger placement. Текст upgrade/downgrade и остальные функции не меняются. Внешние API/DB/финансы/права сохраняются. Сортировка первых imports chat_messages затрагивает порядок инициализации: реальные cold imports и полныйbackend обязательны. SQLAlchemy.exists и sqlalchemy.sql.exists,FastAPI/Starlette JSONResponse должны быть native-identical. Повторный Document берётся из того же langchain_core.documents; существующий доступ кmodel/provider не расширяется. Logger создаётся после imports,до любых применений; его использование другими modules при импортировании проверено.

Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-backend-imports-106-20261012. Baseline105:1064backend/25warnings,Black0diff,Ruff526,CI38new,frontend2600/types0/0/ESLint0. Compose-source read-only,принятый immutable image,отдельная временнаяsubnet/PostgreSQLtmpfs. Откат:revert commit. Общая цельactive,план198/244; эта партия не считается выпуском.

Принято12.10:9modules действительно загружаются в отдельных процессах до(точныйHEAD105) и после,без предварительного прогреваSQLAlchemy/FastAPI alias probe. Executable non-import AST всех9файлов совпадает; набор и тождество native import bindings совпадают в одной прогретойmodulecache. Это разные проверки; тождество cache не объявляется доказательством любой возможной последовательности imports. Migration upgrade/downgrade bodies не менялись; нового применения миграций наproduction нет.

Полныйbackend1064passed/0failures/errors/skips,25прежнихwarnings (толькоRerankCompressor source line1702→1693); прежнийshutdownswigwarning сохранён. Black26.10.1:465unchanged/0diff. ОбщийRuff0.17.0:526→497/138files,new0. ScopeCI9files:97→68/new0;6checker tests passed. ВесьbranchCI265files относительноd579f5c02926cace8c8da60434ce1c39c7284361:6432→463/new38→21; осталось19C901/2F811. 17CI blockers и29общих замечаний устранены,правила не ослаблены.

Frontend5040хешей совпали с принятой104/105версией (2600tests,types0/0,ESLint0),повторного запусканет. Productionrevision/env/config/mount/restarts0/healthy и12соседей совпали;21чужойфайл/262тома/33сети сохранены; собственнаясеть/контейнеры/CIbaseкопии удалены. ПрямойSSH оборвался до обмена протоколом; повторнаяread-only сверка через существующийKVN jump прошла,server config не менялся. Перваяnativeподготовка с пустымDATABASE_URL не прошла,сохранена отдельно; исправлена толькосреда проверки(sqlite/tmp,миграцииoff),сбой продукта не заявляется.

Следующий ограниченный блок — два повторных handler names с сохранениемroute names/OpenAPI/внешних вызовов; затем19сложных функций. Общийbackend gate497/CI21 ифинальнаяцель открыты,план198/244,новыхномерныхзакрытий0,выпуска нет.
