# AIRIS: уведомления панели и доступ к аккаунту

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- Created: 2026-10-12
- SDD Spec: meta/sdd/specs/completed/airis-navbar-access-inputs-2026-10-12-083.json

Продолжение устранения обязательных ошибок перед выпуском A/B. Navbar принимает persisted JSON как string[] без проверки формы: null/object/number ломают spread при наличии уведомлений. Null в temporaryChatEnabled — существующее одноразовое отключение настройки temporaryChatByDefault, используется в initNewChat; сохраняем его. AccountPending получает nullable name/email из auths/admin/details; необходим точный тип и безопасное чтение optional config.

- [x] Воспроизвести повреждённые persisted данные и проверить всех потребителей временного режима.
- [x] Минимально проверить массив строк, сохранить закрытие уведомления при недоступном storage; исправить типы null/optional без изменения режима и доступа.
- [x] Проверки исходного/скомпилированного кода, полный frontend, типы/линт/формат без новых замечаний; документация/commit/push.

Upstream impact: Navbar.svelte — проверка данных localStorage и nullable config; AccountPending.svelte и auths/index.ts — тип существующего ответа; stores/index.ts — boolean|null вместо boolean. Новых зависимостей/подсистем/API/миграций нет. Основную копию/current_tasks не менять. Production выпуск и настоящая приёмка A/B остаются отдельными открытыми пунктами. Откат — revert commit.

Доказательства: `/Users/yshishenya/.codex/private-artifacts/airis-navbar-access-20261012`.

До исправления:3 targeted —1 pass/2 fail;3 compiled-browser page errors (persisted null/object, denied write). После:3 targeted pass;28 compiled-browser checks/page errors0. Временный null opt-out сохранён. AccountPending переиспользует существующий sanitizedHtml вместо прямого @html: содержимое очищается DOMPurify, Markdown и custom/default тексты проверены в browser fixture. Это browser-mounted overlay; публичного SSR содержимого здесь нет.4 client/server компиляции/CSS проверяются повторно на финальном коде.

Итог:2515/2515 full,3/3 targeted,28 compiled-browser/page errors0; types69→60/24, ESLint188→186,new0. Scoped5/futureCI358/format clean.4 client/server компиляции/CSS identical; store и auths API после удаления типов дают прежний JavaScript. Backend1064/25 переиспользован после565 свежих хешей, нового backend запуска нет. Production healthy/restarts0;21 чужой файл,262 тома и12 соседей сохранены. Временные browser/HTTP/build и2 созданных Compose пустых тома удалены после проверки. Source/remote/clean проверяются квитанцией после commit. Общие проверки, PR/CI, интеграция, выпуск и настоящие A/B pending. План198/244; цель active.
