# AIRIS — типы данных чата и списков выбора

- Workflow: refactoring
- Status: locally accepted; global checks / PR / CI / release pending
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay

## Критерии

- [x] Проследить родителей Controls/ToolServersModal/SkillsModal/истории/TagSelector/ShareChatModal и существующие данные ChatAttachment/ModelParams/SavedChat/ToolListItem/SkillListItem/SelectOption.
- [x] Переиспользовать эти типы и Readable<I18n>; API, обработчики и сохранение данных прежние. Контракт AccessControl unknown сохранён.
- [x] Удалить только неиспользуемый onMount и чистое чтение локальной chat в ShareChatModal. Null assertions стираются, новые проверки/молчаливые выходы не вводятся.
- [x] Скомпилированные client/server JS и CSS совпадают после точных удалений; полный frontend проходит, новых ошибок0; scoped lint/формат проходят.
- [x] Подтвердить production/чужую работу/тома, commit/push и обновление плана198/244; цель active.

Upstream impact: семь компонентов; только существующие типы, стираемые assertions и два точных удаления неиспользуемого кода. Полная цепочка EmbeddedChatHistoryDropdown → EmbeddedChatHistoryItem описана SavedChat. Права доступа и публикация чата не меняются; реальной публикации в рамках этой работы нет. Два опасных прежних случая (заблокированное window.open и legacy models=null в выключенном community пути) не скрываются новыми guard; исполняемый код сохраняется. При необходимости отдельного исправления сначала воспроизведение.

Новых зависимостей, схем, сервисов, валидации или изменений контрактов API нет. SDD для механического изменения типов без нового поведения не требуется. Новые тесты, повторяющие типы, не нужны: сравниваем исполняемый код и выполняем существующие сценарии.

Доказательства: `/Users/yshishenya/.codex/private-artifacts/airis-chat-list-selection-types-20261011`. Общие проверки/PR/CI/выпуск и реальные A/B отдельно. Откат — revert commit.

## Принятый результат

2443/2443 frontend, failed/pending/todo0. Types145 →124/24, ESLint199 →195, новых0. Все14 сравнений client/server JS/CSS прошли после точных удалений. Scoped lint0/Prettier pass; будущий CI343 целей0 ошибок.266 SDD валидны; backend1064/25 переиспользован после565 свежих хешей. Production healthy/restarts0;12 соседей/21 чужой файл/262 тома сохранены. Выпуска нет.

- [ ] Общие проверки/PR/CI/интеграция/выпуск и реальные A/B; план198/244, цель active.
