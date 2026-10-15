# AIRIS — безопасный HTML предпросмотра и лицензии

- Workflow: refactoring; исправление доступности стандартной кнопкой
- Status: locally accepted; PR/CI/release pending
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-html-previews-2026-10-11-074.json

## Объём и критерии

- [x] Прослежены FileItemModal из FileItem/FilesModal и General из двух экранов настроек. Существующая очистка HTML через DOMPurify уже работает; речь о переиспользовании общего action, не о доказанной прежней уязвимости.
- [x] Три HTML-вставки заменены существующим sanitizedHtml. Предварительная очистка строк Excel/DOCX сохранена, очистка лицензии остаётся на границе DOM. Контент, таблицы, ссылки, обновление и пустые состояния проверены.
- [x] Название файла — обычная кнопка type=button с прежним обработчиком открытия, вместо ссылки href=#. Путь файла, внешняя ссылка и не-файловый элемент проверены.
- [x] Удалены неиспользуемые getBanners/catch binding; два any в General заменены Readable<I18n> и локальным типом фактически редактируемых полей AdminConfig. Остальные поля полученного объекта сохраняются при отправке.
- [x] Существующие сценарии и полный frontend проходят, новых type/lint ошибок нет; CSS сохранён, SDD валиден и завершён.
- [x] Чужая работа, production и тома сохранены. Commit/push подтверждены; план 198/244 и цель active.

Upstream impact: General и FileItemModal; тонкое подключение существующего fork-owned action, стандартная кнопка и стираемые типы. Новых сервисов/зависимостей/URL/API/schema/проверок настроек нет. В FileItemModal сохраняются получение/выбор листа, преобразование DOCX, обработка ошибок и прежняя очистка строк. Результат action появляется при монтировании в браузере; root SSR включён, но FileItemModal у обоих родителей первоначально закрыт, а General имеет adminConfig=null до onMount; в исходной версии этот HTML также не появлялся в начальном SSR. Нового HTML-обработчика не создаём.

Svelte 5.56.0 / TypeScript 5.9.3 / DOMPurify из принятого lock; новый API библиотек не вводится. Тип AdminSettings описывает поля формы из backend AdminConfig, не валидирует ответ заново. FOLDER_MAX_FILE_COUNT сохраняет прежние string/number/null; привязка number описывается стираемым assertion.

Проверки: Docker Compose; реальные компоненты, существующий action, заглушки внешних конвертеров и API; вредоносные атрибуты/ссылки, таблицы, смена листа и лицензии, открытие файлов, отправка прежнего payload. Полный frontend/check/lint/Prettier/SDD; backend переиспользуется только по прежним 565 хешам. Доказательства: `/Users/yshishenya/.codex/private-artifacts/airis-html-previews-20261011`. Откат — revert commit. PR/CI, интеграция и выпуск отдельны.

Принятые проверки: 10/10 targeted; 2426/2426 full, failed/pending/todo 0; types 145/26 → 145/25, ESLint 214 → 206, новых 0. Scoped lint 0/Prettier pass; будущий CI 337 целей/7 ошибок. Четыре client/server компиляции: CSS прежний, script после стирания типов и заявленных удалений совпадает; HTML/action и кнопка — намеренные изменения разметки. Все 265 SDD валидны, этот SDD завершён. Backend 1064/25 переиспользован по 565 хешам, нового прогона нет. Production healthy/restarts 0 и 12 соседей сохранены, 21 чужой файл и 262 тома прежние. Версия не выпускалась; план 198/244.
