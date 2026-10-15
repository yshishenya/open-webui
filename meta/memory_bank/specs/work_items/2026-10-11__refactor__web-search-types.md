# AIRIS — типы настроек веб-поиска

- Workflow: refactoring
- Status: locally accepted; PR/CI/release pending
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay

## Объём

- [x] Прослежены оба родителя, GET/updateRAGConfig и backend WebConfig. Описать только реально используемые поля, включая nullable и смешанные формы.
- [x] Заменить два any и удалить неиспользуемые models/toast/res; преобразования списков, timeout и Linkup JSON сохраняются целиком.
- [x] Проверить стирание типов, полное совпадение compiled client/server JS/CSS после точных удалений; полный frontend и отсутствие новых type/lint ошибок.
- [x] Подтвердить сохранность production/чужой работы/томов, commit/push и синхронизацию плана.

Upstream impact: только admin/Settings/WebSearch.svelte; локальные типы и удаление неиспользуемого кода. API/payload/URL/schema/валидация не меняются, новых зависимостей нет. Стираемые assertions описывают прежние формы привязок; не добавляют проверки или молчаливый возврат. Timeout PLAYWRIGHT и FIRECRAWL сохраняют старые преобразования. SDD для механического изменения типов без нового поведения не требуется. Новые тесты, повторяющие описание типов, не нужны: проверяем полученный JavaScript и существующие сценарии.

Доказательства: `/Users/yshishenya/.codex/private-artifacts/airis-web-search-types-20261011`. План198/244; цель active; PR/CI/выпуск отдельно. Откат — revert commit.

Проверено: 2426/2426 full, failed/pending/todo0; types145/25 прежние, ESLint206 → 201 новых0; scoped lint0/Prettier pass. После удаления models/toast/res и стирания типов client/server JavaScript и CSS совпадают полностью. Все265 SDD валидны. Будущий CI337 целей/2 ошибки; более широкий прогон383 целей сохранён отдельно. Backend1064/25 переиспользован по565 хешам. Production healthy/restarts0, прежние image/env/config/mounts и12 соседей;21 чужой файл и262 тома сохранены. Новых томов/оставшихся тестовых контейнеров0, выпуска нет. План198/244; цель active.
