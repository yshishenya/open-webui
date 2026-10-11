# AIRIS — типы Pipelines и удаление неиспользуемого кода

- Workflow: refactoring
- Status: locally accepted
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD: N/A — только стираемые типы, неиспользуемые локальные присваивания/параметр catch и неиспользуемые CSS-селекторы.

## Объём и критерии

- [x] Пять explicit any Pipelines заменены: FileList, формат списка серверов из backend /pipelines/list, существующий Model и ValveValues/ValveSpec для редактора.
- [x] Type assertions описывают прежние переходы между значениями JSON, строковым редактором и типами стандартных контролов. Они не являются новой валидацией данных и не скрывают изменение поведения.
- [x] В Images удалены только два неиспользуемых присваивания loaded и неиспользуемый параметр catch. В AddTextContentModal удалены только CSS для отсутствующих .tabs и input[type=number]; активные spin-button правила сохранены.
- [x] Client/server компиляция сохраняет JS/CSS Pipelines побайтно. В Images допускаются только заявленные удаления; остальной JS/CSS прежний. AddTextContentModal совпадает после удаления ровно трёх комментариев unused, которыми компилятор помечает неработающие правила; скомпилированные правила и разметка прежние.
- [x] Полный frontend проходит, новых type/lint ошибок нет; scoped lint и Prettier проходят. Backend переиспользован только после проверки прежних 565 хешей. Все существующие SDD валидны.
- [x] Production, 21 чужой tracked-файл и тома сохранены, test containers удалены. Commit/push подтверждены на source/remote SHA; номерные пункты бизнес-плана не закрываются.

Upstream impact: три существующих компонента. Новых зависимостей, запросов, сервисов, проверок JSON, изменений API, schema или действий пользователя нет. Model/ValveValues/ValveSpec уже существуют; дополнительные поля схемы описывают используемые title/description/enum. Начальные null и прежнее заполнение после API остаются. Svelte 5.56.0 / TypeScript 5.9.3 — принятый lock, новых библиотечных API нет. API Pipelines proxy сохраняет поля внешнего provider; типы описывают только те поля, которые читает форма.

Проверки: Docker Compose, существующие сеть и frontend-том, project airis-pipelines-types-072. Полный набор frontend; check; lint; сравнение компиляции; полная SDD-проверка. Рабочая цель остаётся active, план 198/244; общие проверки, PR/CI, интеграция, выпуск и реальная A/B приёмка ещё открыты.

## Принятый результат

Пять explicit any устранены. Шесть client/server сравнений прошли: весь JS трёх компонентов после только заявленных удалений совпадает побайтно, JS/CSS Pipelines совпадают без нормализации, CSS Images прежний. Активные CSS-правила AddTextContentModal и хеши прежние; удалены ровно три комментария, которыми компилятор помечал unused CSS. Разметка, двусторонние привязки полей, значения JSON, действия и запросы сохранены.

Frontend 2419/2419, failed/pending/todo 0. Types 146/34 → 146/30, ESLint 229 → 219; новых ошибок 0. Scoped lint 0, Prettier pass. Будущий PR CI: 336 целей, 19 ошибок остаются; общие проверки ещё не проходят.

Backend 1064/25 переиспользован после проверки 565 хешей, нового прогона нет. Все 264 SDD валидны. Production healthy/restarts 0 на прежнем c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908; image/env/config/mounts и 12 соседей сохранены. 21 чужой tracked-файл и 262 тома прежние, новых томов и тестовых контейнеров 0. Полный набор исполнялся на 6965 замороженных файлах; после него меняются только две финальные Markdown-записи, приложение не менялось.

Доказательства: `/Users/yshishenya/.codex/private-artifacts/airis-pipelines-types-20261011`. Source/remote SHA после commit/push фиксируется в source-remote-receipt.json. Выпуска нет. План 198/244, цель active; PR/CI, интеграция, образ/выпуск и реальные A/B проверки открыты. Откат — revert commit; схема данных и API прежние.
