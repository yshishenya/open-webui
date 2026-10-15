# AIRIS — существующие контракты расписаний

- Type: bugfix
- Status: completed
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-scheduling-contracts-2026-10-12-094.json

Общий ESLint содержит 136 ошибок. В календаре и расписаниях 24 any и одно устаревшее подавление ошибки file-saver. Сопоставить реальные Python-модели/ответы и существующие frontend типы: FolderListItem, Config.features, ComponentProps и декларацию file-saver. Контекст automationsLayout уже используется тремя компонентами: описать его один раз через свойства двух действующих компонентов кнопок. Существующие поля meta/data остаются расширяемыми unknown-словарями с точными известными полями; никакой новой службы или обработки данных.

- [x] Согласовать типы API и всех текущих потребителей без изменения wire данных и обработчиков.
- [x] Компиляция/формат/lint, общий frontend и types; сохранить доказательства, закрыть SDD и отправить коммит.

Upstream impact: два клиента API, три компонента и три страницы расписаний; только стираемые типы и удаление устаревшего ts-ignore. Новый fork-owned файл содержит лишь общий тип уже работающего контекста. Проверки на exact source; общий план/серверные проверки/PR/CI/выпуск/реальные A/B остаются открытыми. Откат: revert commit. Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-scheduling-contracts-20261012.

Принято: 2585/2585 frontend, types 0/15, ESLint 136→111, новых диагностик 0; scoped9 и CI397 lint/format чистые. 14 сравнений компиляции: JS/CSS совпадает, кроме точного удаления старого ts-ignore комментария в двух вариантах +page. Новый модуль стирается в export {}; runtime не добавлен. Backend563 и manifests сверены; переиспользован 1064/25, нового backend-прогона нет. Свежий Ruff0.17.0:547, Black26.10.1:diff0/465 файлов. Production/12 соседей/21 чужой файл/262 тома сохранены; выпуска нет. Общий план198/244 и цель active.
