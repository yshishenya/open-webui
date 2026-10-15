# Настройки документов и объявлений

Status: Done (local acceptance; global release pending)
Workflow: bug_fix
Owner: Codex
SDD Spec: meta/sdd/specs/completed/airis-document-settings-2026-10-11-044.json

- [x] Проследить контракты API, формы и все места вызова; воспроизвести ранний Success при reset и отсутствие очистки Sortable.
- [x] Исправить ожидание reset; HTTP-отказ не повторяет запрос и не сообщает Success. Сохранить успешный null-ответ существующего endpoint.
- [x] Переиспользовать Banner, модели API и контекст i18n; конкретный тип редактируемой формы документов. Никаких новых библиотек или сервисов.
- [x] Полные frontend/type/lint и проверка сохранности; новых диагностик 0; SDD/commit/push и частные планы.

Upstream impact: Documents.svelte (await reset и типы формы/событий),
Interface/Banners.svelte (существующий Banner/Sortable и освобождение экземпляра),
retrieval/index.ts (тип embedding payload по текущей серверной форме, reset helper).
Сервер/миграции/зависимости не меняются. Настоящую очистку рабочего хранилища
не выполнять: проверка опасной операции использует контролируемый API.
Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-document-settings-20261011.
Локальные проверки не закрывают production/A/B и календарные окна.

Дополнительно воспроизведено в настоящем смонтированном Banners: Sortable не создаётся при первом показе, поскольку реактивное условие не зависит от bound DOM element. Два случая до минимальной правки дают0/2; элемент добавлен в то же условие без нового lifecycle слоя.

Локальная приёмка:11/11новых,31/31целевых,2247/2247frontend; прежняя версия2pass/9fail.
Types489/63→457/63,ESLint533→517; новых диагностик0.
244CI lintцелей и2новыхtestfiles0/0; форматирование прошло.
Backend1064/25warnings reused по565хешам; нового прогона нет.
Production healthy/restarts0,12соседей,21чужойфайл/262тома сохранены.
SDD0443/3closed. Общее качество/PR/CI/выпуск/A/B остаются открыты.
