# AIRIS — отсутствующие значения на входе действий

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- Created: 2026-10-12
- SDD Spec: meta/sdd/specs/completed/airis-nullable-action-inputs-2026-10-12-090.json

Пять существующих файлов дают 11 ошибок типов. Worker озвучивания обращается к необязательному wasm и error.message у неизвестной ошибки; выбор терминала допускает отсутствующий id; скачивание получает nullable путь; окно пользователя разыменовывает nullable props. AlertRenderer уже возвращает false для токена без текста, но не сужает тип.

- [x] Воспроизвести отсутствующие значения и успешные действия; добавить минимальные проверки в действующие обработчики.
- [x] Проверить весь frontend, типы, lint/format, компиляцию; подтвердить сохранность данных; закрыть SDD, commit/push.

Upstream impact: kokoro.worker.ts, TerminalMenu.svelte, FileNav.svelte, EditUserModal.svelte, AlertRenderer.svelte. Проверки в общих обработчиках, безопасные nullable props, существующий тип KokoroTTS. Без новой системы состояний, помощников, зависимостей и изменения протоколов/API. Backend и платёжные операции не меняются. Откат: revert commit.

Зависимости: kokoro-js pinned/latest stable 1.2.1; Transformers.js pinned 3.8.1, latest stable 4.3.1 (npm проверен 12.10.2026). Официальный README Kokoro подтверждает from_pretrained/generate; документация env v3 и установленные declarations определяют optional wasm. Совместимость: сохраняем установленную v3, которую использует Kokoro 1.2.1; переход на v4 — отдельное обновление с проверкой browser inference, а не часть проверки отсутствующих значений.

Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-nullable-action-inputs-20261012. Общий план, PR/CI, выпуск и реальные критерии A/B остаются открытыми.

Воспроизведение: 6/12 passed, 6 failed на исходном коде (id, nullable путь, optional wasm, null/undefined ошибка, nullable props). Первый probe ошибочно искал обработчик FileNav в module script; исправлен выбор instance script, повторный запуск воспроизвёл падение endsWith. После правки 30/30 targeted, включая 18 прежних сценариев. Scoped 6 / PR 374 lint и форматирование проходят. В worker устранено старое prefer-const без изменения выбора модели. Изменения форматирования EditUserModal требуются действующим formatter; CSS отличается только хвостовыми пробелами. Backend 565 файлов сверены, прежние 1064 теста / 25 warnings переиспользованы; нового backend run нет.

Первый полный запуск:2578/2578 passed; проверка типов дополнительно обнаружила две неточные декларации тестовых mocks. Исправлены конкретными типами AudioResult/SpeechModel; runtime теста и проверки не изменены. Повторный полный запуск использует окончательные исходники.

Приёмка:2578/2578 full без failed/pending/todo; types21→10/24, ESLint178→177, новых0. Scoped6/PR374/format clean; 8компиляций/CSS и прежние warnings сохранены. Backend1064/25 reused после565fresh hashes. Production healthy/restarts0,12соседей/21чужой файл/262тома сохранены, test containers0/new volumes0; выпуска нет. Новый browser/backend run не заявляется.
