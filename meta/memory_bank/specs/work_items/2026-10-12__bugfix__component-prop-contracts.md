# AIRIS — свойства существующих компонентов

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- Created: 2026-10-12
- SDD Spec: meta/sdd/specs/completed/airis-component-prop-contracts-2026-10-12-091.json

Пять компонентов дают семь из оставшихся десяти ошибок типов. ManifestModal не описывает funding_url; AIMenu объявляет callback без аргумента, но передаёт boolean; Textarea требует числовые rows; ToolCallDisplay передаёт два id, которые Image не объявляет и не выводит. Все потребители и существующий Textarea/Dropdown/Image изучены.

- [x] Согласовать существующие свойства; проверить сохранение вывода и обработчиков, удалить неиспользуемые imports/стили ManifestModal.
- [x] Пройти полный frontend/types/lint/format и компиляцию; подтвердить сохранность исходников/production; SDD, commit/push.

Upstream impact: ManifestModal.svelte, AIMenu.svelte, ToolCallDisplay.svelte, Account.svelte, General.svelte. Минимальные свойства и стираемые типы; новые помощники и зависимости не нужны. Удалённые id уже игнорировались Image. Числа rows передаются нативному textarea. Неиспользуемые стили ManifestModal относятся к отсутствующим input/.tabs. Откат: revert commit.

Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-component-prop-contracts-20261012. Backend, деньги и API не меняются; общие проверки, PR/CI, выпуск/A/B остаются открытыми.

AIMenu не имеет потребителей в src/tests; неизменная внешняя className ссылка объявлена export const по существующему NoteMenu. Ни один потребитель не теряет изменяемое свойство. Неиспользуемый catch binding ToolCallDisplay удалён. Сравнение scripts допускает только эти два точных стирания и удаление неиспользуемого dispatcher. Удалённые CSS ManifestModal уже выводились компилятором исключительно комментариями; действующие CSS проверяются без этих комментариев.

Исходные четыре DOM-проверки уже проходили: это исправление типов, не восстановление ранее сломанных изображений/ссылок. До правки семь ошибок зафиксированы принятым typecheck090 и побайтово сохранёнными файлами. После25/25 targeted, включая21 прежнюю проверку Account/General/API. Scoped6/PR377/format clean;10client/server компиляций,5сравнений прежних scripts; действующие CSS сохранены.

Приёмка:2582/2582full,25targeted;types10→3/17,ESLint177→167,new0;scoped6/PR377/format clean;10компиляций/CSS,5прежних scripts сохранены. Backend1064/25 reused после565fresh hashes. Production healthy/restarts0,12соседей/21чужой файл/262тома сохранены;containers0/new volumes0. Общие проверки/PR/CI/выпуск/A/B остаются открытыми.
