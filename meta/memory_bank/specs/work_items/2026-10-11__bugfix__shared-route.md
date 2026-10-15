# AIRIS — загрузка общего чата

- Type: bugfix
- Status: locally done
- Workflow: bug_fix
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-shared-route-2026-10-11-063.json
- Created: 2026-10-11

[BUG] Route /s/[id] принимает старый ответ после смены ссылки/ухода; старая ошибка отправляет на главную даже после успешной новой загрузки. Actual-source 3/3 red перед правкой. Также UserInfoResponse ошибочно ожидается как SessionUser, а processing/messages не являются props Messages.

- [x] Проследить все callers getChatByShareId/cloneSharedChatById и Messages → Message → UserMessage, backend ChatResponse.
- [x] Воспроизвести замену новой ссылки, старую ошибку и ответ после уничтожения страницы.
- [x] Только текущая загрузка записывает данные/показывает страницу/перенаправляет; onDestroy прекращает собственные продолжения.
- [x] Сохранить anonymous view, settings/model загрузку после входа, legacy history, дубли model slots, право клонирования и серверные ограничения.
- [x] Уточнить существующие SavedChat/UserInfoResponse/Message display contracts без выдуманных permissions.
- [x] Проверить настоящий script, runtime JS/CSS Messages и полные frontend/type/lint/format; новых замечаний 0.
- [x] Проверить browser route lifecycle с управляемыми API, сохранить production/чужую работу, закрыть локальную SDD и commit/push.
- [ ] Общие выпуск и реальные A/B.

Решение: один локальный номер загрузки и проверка current share id/destruction, штатные Svelte lifecycle/tick. Существующие API, типы и helper преобразования истории. Новых runtime modules, request managers, зависимостей, backend/schema/mail/billing нет.

Совместимость: существующий accepted lock Svelte 5.56.0/TypeScript 5.9.3; ранее изученные https://svelte.dev/docs/svelte/lifecycle-hooks . Зависимости не заменяются.

Upstream impact: один route loader, тонкое объявление display-user в Messages, объявления двух API response types и optional stored timestamp. Родительские permission/clone проверки сохраняются.

Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-shared-route-20261011 . План 198/244, цель active.

Окончательная проверка: frontend 2379/2379, actual-script 11/11, browser route 7/7 с Messages stub и локальными API. Messages client/server JS/CSS и API JS побайтно прежние. Types 178/34 (было 191/34), ESLint 302 (было 306), новых 0; scoped 5 файлов lint 0/0, Prettier pass. Будущий CI lint: 331 цель, 95 прежних замечаний. Backend 1064/25 переиспользован по 565 совпавшим хешам, нового запуска нет. Production и 12 соседей/21 чужой файл/262 тома сохранены; тестовый стенд и кэш убраны. Выпуск остаётся открытым.
