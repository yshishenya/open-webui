# AIRIS — нативные связи и свойства отображения

- Type: bugfix
- Status: completed (source checks)
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-native-display-contracts-2026-10-12-100.json

Причины: StatusItem считает urls первым, а реальная панель показывает items первым; число сайтов расходится при обоих полях. Использовать тот же порядок и пустой массив как запасное значение, готовый ChatStatus/i18next и явные queries/count. Для Tags связать combobox со своим listbox и указать aria-selected; уникальный браузерный id на mount, прежние события сохранены. Удалить11 неиспользуемых свойств после проверки всех потребителей: strokeWidth восьми заливных иконок, iconColor, className RecordMenu, hasFiles BulkActionBar вместе с единственным мёртвым вычислением/передачей FileNav.

- [x] Воспроизвести расхождение количества и отсутствующие нативные связи; внести минимальные исправления и проверить все потребители свойств.
- [x] Проверить реальные компоненты, сохранение CSS/вывода, полный frontend/types/lint; закрыть SDD и отправить коммит.

Upstream impact:15 существующих файлов, без новых модулей или зависимостей. Откат: revert commit. Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-native-display-contracts-20261012. Финальная цель и production A/B остаются открытыми.

Результат: до0/2, после2focused/2592full;types0/2 (два пустых CSS rulesets JsonTreeView),ESLint45→28/new0,scoped17/CI441/format clean,CSS28/SSR18. Сервер/данные сохранены; общие проверки и браузерная приёмка рабочего выпуска открыты.
