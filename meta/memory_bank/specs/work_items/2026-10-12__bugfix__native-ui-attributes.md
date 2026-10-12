# AIRIS — нативные атрибуты интерфейса

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- Created: 2026-10-12
- SDD Spec: meta/sdd/specs/completed/airis-native-ui-attributes-2026-10-12-089.json

В пяти компонентах девять ошибок typecheck: allowFullscreen вместо allowfullscreen, for у div и повторный id двух select, type у textarea/неточный тип onSubmit, class у Clipboard, верхний регистр dir в Channel Message. Все действующие потребители и соседние реализации изучены; политики iframe/история/сохранение подключений/ввод URL остаются прежними.

- [x] Проверить реальные DOM-контролы/обработчики; исправить существующую разметку без новых helpers/зависимостей.
- [x] Пройти полный frontend/type/lint/format; подтвердить компиляцию/CSS/неизменные обработчики, сохранность данных; SDD/commit/push.

Upstream impact:5 перечисленных компонентов; HTML label/атрибуты, существующий className, существующая схема направления текста. Без изменений API, сервера, миграций, повторов или системы форм. Откат:revert commit. Общие проверки и production/A/B остаются открытыми.

Доказательства:/Users/yshishenya/.codex/private-artifacts/airis-native-ui-attributes-20261012.

Воспроизведение: исправленный DOM-тест на исходнике6/9 passed,3failed — подписи, textarea type, отсутствие dir при пустой настройке. Fullscreentrue/false URL/HTML работали до исправления; запись нативного атрибута устраняет typecheck. После67/67 targeted:9новых DOM и58существующих, включая14reload cases. Из старой проверки сообщения удалялись все импорты; добавлен простой readable({}) fixture для нового реактивного обращения к settings,14сценариев сохранены. Первые probes с преждевременным ожиданием iframe/недостающим fixture сохранены отдельно. Scoped7/PR371 lint/format проходят.10компиляций/CSS и6сравнений прежних scripts прошли; единственное добавление в script — значение направления, проверенное реальным DOM.

Приёмка:2566/2566 full без ошибок/пропусков;types30→21/24,ESLint178 прежние,new0;scoped7/PR371/format clean;10компиляций/CSS и6прежних scripts сохранены. Backend1064/25 reused после565 свежих хешей; нового backend/browser запуска нет. Production healthy/restarts0;12соседей/21чужой файл/262тома сохранены, временные containers удалены. SDD2/2 completed. Общие проверки,PR/CI,выпуск/A/B остаются открытыми.
