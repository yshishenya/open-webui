# AIRIS — завершение общей проверки frontend

- Type: bugfix/refactor
- Status: Done (source verification; production goal active)
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-frontend-gate-2026-10-12-104.json

G14 требует frontend types/ESLint без ошибок. Устранить последние8: описать только используемую поверхность уже загружаемых Google SDK, удалить неиспользуемый глобальный TippyInstance, переиспользовать ModelParams в AdvancedParams. Native Google callback данные остаются unknown с существующей проверкой полей. Для списка вместо пустого catch проверить актуальную позицию и list item до NodeSelection/ghost/listeners; реальные ошибки dispatch не скрывать.

- [x] Прочитать потоки и официальные API установленной версии; воспроизвести устаревшую ручку и проверить существующие циклы AdvancedParams до изменения.
- [x] Внести минимальные правки, проверить реальные компоненты/редактор и общий frontend, сохранить данные; закрыть SDD, commit/push.

Upstream impact: app.d.ts, существующий Google picker, AdvancedParams и listDragHandlePlugin. Новых зависимостей/архитектуры/форматов данных нет. Google SDK публикуются без версии по существующим URL: типы описывают лишь реально используемые методы; runtime загрузчик и политика OAuth не меняются. Установленные ProseMirror/Svelte сверить с latest и сохранить совместимые версии с отдельным будущим обновлением при необходимости. Доказательства/официальные документы: /Users/yshishenya/.codex/private-artifacts/airis-frontend-gate-104-20261012. Откат: revert commit; production требует отдельной приёмки.

Версии проверены12.10: ProseMirror state1.4.4 — latest; view1.41.6/latest1.42.6,model1.25.4/latest1.25.12,Svelte5.56.0/latest5.57.2. Совместимость: сохранить принятые native editor/compiler версии для этой правки; обновление view/model/Svelte выполнять отдельно с проверкой widget positions, выделения, перетаскивания и компиляции. SDK types — только применяемые methods; script URL остаются прежними, Google callback fields проверяются на runtime. Стираемое приведение gapi в onload необходимо, потому что внешний script изменяет глобальную переменную после typeof-проверки; исполняемый код loader сравнивается с прежним.

Проверено: до изменения1failure устаревшей ручки (NaN dragging), AdvancedParams baseline1/1passed. После9/9 focused и2600/2600 frontend; types0/0,общий ESLint8→0/new0,scoped6/цели ветки462/форматирование чистые. Native EditorView проверяет допустимую/undefined/NaN/отрицательную/не-list/out-of-bounds позицию; документ не меняется. Native Svelte проверяет цикл тегов/stop/custom/top_k границы. Это native компоненты в jsdom, отдельный настоящий браузер104 не запускался.

Два exact compilation сравнения (SDK и ambient globals) сохраняют executable JS. AdvancedParams client/server сохраняет остальной JS/CSS/warnings после явного исключения2 изменённых Array.isArray guards; прежние циклы валидных значений проходят до и после. Новый guard списка/удаление catch — реальная правка поведения, не объявляется byte-equivalent. Backend/config563 и manifests совпадают с принятой базой; нового backend pytest запуска нет. Свежий Ruff0.17.0:547diagnostics/144файла,201C901;118safe/92unsafe fixes. Полный backend gate не принят; правила не ослаблялись.

Production healthy/restarts0,12 соседей,21 чужой файл/262 тома сохранены. Временная копия1169 пакетов соответствует lockfile; исходный том использован только для чтения, временный удалён после проверок. Временный Ruff устанавливался только в контейнер и читал источник read-only. Общая цель active,план198/244; PR/CI/финальная приёмка единой версии/production остаются открытыми.
