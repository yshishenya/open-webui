# AIRIS — контракты административных настроек и просмотра доступа

- Type: refactor
- Status: Done (source verification; production goal active)
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-admin-config-contracts-2026-10-12-102.json

План G14 требует общей проверки без ошибок. Вместо any описать реальные AdminConfig/OAuthConfigForm и preview-ответы серверов, переиспользовать GroupDetails/PermissionSettingsInput/i18next. Общие поля previews живут в имеющемся frontend-contracts; одинаковые AdminSettings General/Authentication заменить единым API контрактом. Сохранить тела запросов, nullable/optional поля и поведение доступа. Если nullable OAuth флаг несовместим с Switch, принимать null как начальное выключенное значение без записи false обратно в конфигурацию; действие пользователя устанавливает boolean.

- [x] Прочитать все затронутые потоки/потребителей, сверить установленный bits-ui/API и серверные поля; внести минимальные изменения.
- [x] Проверить компиляцию стираемых типов, native nullable switch и полный frontend; сохранить данные, закрыть SDD, commit/push.

Upstream impact: API auths/users/groups; Authentication/General/UserPreviewModal/GroupPreviewPanel; Switch только если подтверждена нужда. Fork-owned frontend-contracts переиспользуется. Новых зависимостей нет. Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-admin-config-contracts-20261012. Откат: revert commit. Общая цель active; production A/B требуют отдельной приёмки.

Проверено: 2598/2598 frontend tests; nullable Switch 1/1 до и после адаптера; types 0 errors/0 warnings; общий ESLint 16→10, новых ошибок нет. Scoped 10 и 454 цели проверки ветки — без ошибок, форматирование чистое. 12 сравнений компиляции API/четырёх экранов/shared types подтвердили одинаковый исполняемый код; Switch проверен настоящим компонентом bits-ui.

Среда: две свежие npm ci завершились ECONNRESET. Для проверки использована копия существующих зависимостей в отдельном временном томе, актуальный DOMPurify 3.4.16 проверен по integrity lockfile; версии 1169 установленных пакетов совпадают. Исходный том сохранён, временный удалён. Backend/config 563 файла совпадают с принятой базой; новый запуск backend не выполнялся. Production healthy/restarts 0, соседние 12 контейнеров, 21 чужой файл и 262 тома сохранены. Новых зависимостей и выпуска production нет; план 198/244, цель active.
