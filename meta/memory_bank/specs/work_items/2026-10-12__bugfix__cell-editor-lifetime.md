# AIRIS — освобождение редактора ячейки

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- Created: 2026-10-12
- SDD Spec: meta/sdd/specs/completed/airis-cell-editor-lifetime-2026-10-12-088.json

CellEditor возвращает cleanup из async onMount; Svelte не вызывает его. После загрузки остаётся наблюдатель темы; закрытие до загрузки приводит к обращению к null editor, отказ языка оставляет отвергнутый Promise. Единственный потребитель — NotebookView; change/run/cancel и содержимое/тема должны сохраниться.

- [x] Воспроизвести три случая: обычное закрытие, закрытие во время загрузки, отказ языка; исправить существующий lifecycle.
- [x] Пройти targeted/full frontend/type/lint/format, проверить компиляцию/CSS и сохранность; завершить SDD/commit/push.

Upstream impact: только CellEditor.svelte, существующие onMount/CodeMirror. Без новых зависимостей, менеджеров ресурсов, флагов, повтора загрузки, изменения сервера или денег. Откат: revert commit. Production/A/B остаются открытыми.

Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-cell-editor-lifetime-20261012.

До3/3 failed на исходном CellEditor с окончательным тестом, после7/7 targeted (3новых/4existing NotebookView/Navbar). Исправлено асинхронное возвращение cleanup, удалён дублирующий onDestroy; editor=null защищает поздний language result. Фокус доступен сразу, язык загружается отдельно, отказ не ломает редактор. Change/run/cancel проверены. Первоначальный probe теста после правки слишком рано проверял межконтекстные Promise; заменён ожиданием одного оборота event loop через stdlib setImmediate, исходный отказ сохранён.

Приёмка:2557/2557 full без ошибок/пропусков;types31→30/24,ESLint178 прежние,new0;scoped2/PR371/format clean;2компиляции/CSS сохранены. Backend1064/25 reused после565 свежих хешей, нового backend/browser запуска нет. Production healthy/restarts0;12соседей/21чужой файл/262тома сохранены, временные containers удалены. SDD2/2 completed. Общие проверки,PR/CI,выпуск/A/B остаются открытыми.
