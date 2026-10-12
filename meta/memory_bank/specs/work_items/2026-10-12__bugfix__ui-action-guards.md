# AIRIS — действия при неполных данных и смене папки

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- Created: 2026-10-12
- SDD Spec: meta/sdd/specs/completed/airis-ui-action-guards-2026-10-12-087.json

FolderTitle после await может применить результат к другой выбранной папке либо обратиться к null; export смешивает источник и имя. Parent onDelete всегда сбрасывает выбранную папку. Закрытие Changelog зависит от config/storage/network; popup blocked ломает общий FileItem. PlanForm сравнивает optional значение с null так, что отсутствие исходного плана открывает небезопасную ветку.

- [x] Воспроизвести реальные обработчики/отображение и изучить всех потребителей.
- [x] Минимальные guards/snapshot в существующих функциях; сохранить API, права, формат экспорта и HTML sanitation.
- [x] Полные frontend/type/lint/format проверки; сверить source/runtime/данные, закрыть SDD, commit/push и план.

Upstream impact:5 существующих компонентов — локальная защита nullable/late action/popup; без зависимостей, сервисов, миграций и повторов. Откат: revert commit. Production/A/B остаются открытыми.

Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-ui-action-guards-20261012.

Воспроизведение: до 2/16 passed,14 failed; после 27/27 targeted passed (22 новых и5 существующих). Защита смены/закрытия папки проверена после обоих await при изменении имени и значка. Все обработчики и единственный parent callback проверены по действующему исходнику; PlanForm/FileItem также смонтированы в DOM. Форматирование FileItem/PlanForm включает исправление прежнего отступа/переноса по существующему Prettier. Новые зависимости и изменения серверного кода отсутствуют. Общая приёмка в процессе.

Приёмка: 2554/2554 frontend без ошибок/пропусков; check 43→31 ошибок/24 предупреждения, ESLint178 прежние, новых диагностик0. Scoped7 и PR371 lint0; форматирование прошло;10 client/server компиляций, CSS/предупреждения сохранены. Backend1064/25 reused после565 свежих хешей, нового backend/browser запуска нет. Production healthy/restarts0,12 соседей,21 чужой файл и262 тома сохранены; временные контейнеры удалены. Общие проверки, PR/CI и настоящий выпуск/A/B остаются открытыми.
