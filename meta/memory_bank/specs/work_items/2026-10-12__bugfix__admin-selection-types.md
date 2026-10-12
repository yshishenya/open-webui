# AIRIS — типы выбора в административных настройках

- Type: bugfix
- Status: completed (source only)
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-admin-selection-types-2026-10-12-097.json

Цель: устранить19 общих ESLint замечаний в Events/Interface без изменения runtime. Действующие API групп, поиска/сведений пользователей и базовых моделей сверены с backend. Использовать GroupDetails, UserInfoResponse, WorkspaceModel, Model и i18next; не вводить новую схему, преобразователь или зависимость. Действующие поиск, права, сохранение и обработка ошибок остаются прежними.

- [x] Переиспользовать готовые типы; удалить только неиспользуемый settings import.
- [x] Проверить compilation/типы/полный frontend/lint; закрыть SDD, commit/push.

Upstream impact: два компонента административных настроек, только стираемые объявления и мёртвый импорт. Откат: revert commit. Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-admin-selection-types-20261012. Общий план198/244, цель active; выпуск и настоящие A/B открыты.

Результат: frontend2585/2585,types0/15,ESLint92→73,new0;scoped2/CI408/format чистые.4 сравнения compilation;7030 файлов заморожены. Backend563/manifests сверены,1064/25,Ruff547/Blackdiff0 переиспользованы. Production healthy/restarts0,12 соседей/21 чужой файл/262 тома сохранены. Нового выпуска нет; общий план198/244.
