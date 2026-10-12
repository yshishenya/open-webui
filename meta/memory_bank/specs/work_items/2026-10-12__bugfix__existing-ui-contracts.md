# AIRIS — действующие контракты малых представлений

- Type: bugfix
- Status: completed (source only)
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-existing-ui-contracts-2026-10-12-096.json

Из общего ESLint103 убрать10 any и один неиспользуемый import в пяти компонентах. Переиспользовать callback contracts MarkdownTokens, включая промежуточный Markdown forwarding, OutputDetailToken, ChatAttachment и существующий тип i18n. Счётчик workspace получает действующие JSON-ответы: total или массив с length; описать эти поля без смены порядка fallback. Не менять отправку/редактирование очереди, Markdown, статистику, запросы/права и отображение.

- [x] Согласовать типы с настоящими потребителями; никаких новых runtime helpers/зависимостей.
- [x] Проверить сохранение compiled JS/CSS, полный frontend/types/lint; закрыть SDD и отправить коммит.

Upstream impact: пять существующих компонентов; стираемые типы и удаление одного мёртвого import. Общий план198/244 и реальные A/B открыты. Откат: revert commit. Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-existing-ui-contracts-20261012.

Проверка выявила пять ошибок в промежуточном Markdown: его default callbacks были выведены как no-args. JSDoc переиспользует действующие свойства MarkdownTokens; StructuredOutputRenderer берёт тот же контракт без круговой связи с ContentRenderer. Runtime не меняется.

Результат: frontend2585/2585,types0/15,ESLint103→92,new0;scoped5/CI406/format чистые.10 сравнений compilation; backend563/manifests сверены,1064/25,Ruff547/Blackdiff0 переиспользованы. Сервер healthy/restarts0; данные/21 чужой файл/262 тома сохранены. Выпуска и новых номерных закрытий нет; общий план198/244.
