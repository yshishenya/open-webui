# AIRIS — неиспользуемые объявления

- Type: bugfix
- Status: completed
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-unused-declarations-2026-10-12-095.json

ESLint111:8 ошибок в четырёх компонентах вызваны мёртвыми imports/declarations. Удалить большой неиспользуемый строковый шаблон FunctionEditor, два невызываемых calendar helpers и dispatcher без вызовов. Сохранить активные шаблоны, обработчики, разметку, API и все callback payloads. Default onSave описать существующим FunctionForm; сам no-op не нуждается в параметре. Новых модулей/зависимостей/тестов удаления не вводить.

- [x] Удалить только проверенные мёртвые объявления; сохранить contract всех потребителей.
- [x] Проверить compilation/CSS, полный frontend/types/lint; закрыть SDD и отправить коммит.

Upstream impact: четыре существующих компонента; удаление мёртвого кода и JSDoc действующего callback. Общий план198/244 и реальные A/B остаются открытыми. Откат: revert commit. Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-unused-declarations-20261012.

Принято: приложение4 добавления/167 удалений; frontend2585/2585,types0/15,ESLint111→103,new0;scoped4/CI401/format чистые.8 сравнений retained JS/CSS/предупреждений; только явно перечисленные мёртвые declarations и параметр пустого callback исключены при сравнении, все source edits точно сверены.7026 frozen files проверены до/после каждого запуска. Backend563 и manifests совпадают с1064/25; fresh094 Ruff547/Black diff0 переиспользованы, новых backend/браузерных прогонов нет. Production/12 соседей/21 чужой файл/262 тома сохранены; выпуска нет. План198/244, цельactive; общие проверки/PR/CI/выпуск/реальные A/B открыты.
