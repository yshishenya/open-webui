# Общий вход: очистка обработчиков и поздние ответы

Status: Done (local acceptance; common release remains open)
Workflow: bug_fix
Owner: Codex
SDD Spec: meta/sdd/specs/completed/airis-app-bootstrap-lifecycle-2026-10-11-057.json

- [x] Проследить bootstrapApp, оба его входа (onMount/legal acceptance), все helpers и три потребителя version/единственный usage; проверить реальные ответы backend и DOM-кнопки.
- [x] Воспроизвести оставшийся keydown/подписки и записи после удаления; использовать onDestroy и небольшую коллекцию существующих cleanup callbacks, без нового менеджера.
- [x] Описать DB/legacy exports/version/usage/HTMLElement; сохранить экспорт истории и смысл 24 часов, убрать неподдерживаемый третий аргумент vi.mock.
- [x] Целевые и полные проверки, документировать upstream impact, закрыть SDD, commit/push и сохранить данные.

Защитить helpers и регистрацию обработчиков от продолжения после удаления
компонента. Все запросы остаются асинхронными; не вводить новую очередь,
контроллер запросов или механизм сессий. Не менять legal fail-closed,
редиректы/руководство/права, экспорт IndexedDB и квоту.
Upstream impact: app/+layout, API index, UserMenu и его существующий test,
text-scale. API типы описывают существующие model_ids/user_count и current/latest.
Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-app-bootstrap-lifecycle-20261011.
План 198/244; цель active; общий выпуск и реальные A/B открыты.

Воспроизведение исходного HEAD через readonly source override: 0/6,
все шесть падают по ожидаемой причине (повторный keydown, late stores,
стирание нового черновика/token, позднее legal gate/toast).
Первый expanded запуск имел только ошибку тестового окружения location;
она исправлена mock существующего constants, не считается регрессией.
Сохраняются legal fail-closed/401/accepted пути действующего компонента.
IDB 7.1.1 / Vitest 1.6.1 сохранены для совместимости; latest 8.0.4 / 5.0.3
проверены, официальные контракты закреплённых версий сохранены в доказательствах.
Обновлять зависимости отдельно с полной проверкой, здесь зависимостей нет.

Приёмка: 15/15 целевых и 2350/2350 общего frontend, failed/pending/todo0.
Общие типы 245/56 → 223/56, ESLint382; новых диагностик0.
287 действительных целей CI и 6 текущих файлов lint0/0, форматирование прошло.
3 type-only файла имеют одинаковый emitted script, markup UserMenu одинаков.
Пять прежних layout алгоритмов совпали; lifecycle проверен настоящим script
через AST/VM/EventTarget, без объявления браузерной/production приёмки.
Изначально ошибочно удалённые два импорта UserMenu восстановлены до принятого
повторного прогона; реальная кнопка очистки статуса проверена в jsdom.
Backend1064 reused: все565 исходных хешей совпали, нового прогона нет.
Production healthy/restarts0, 12 соседей,21чужойфайл,262тома сохранены.
SDD0572/2. Общие качество/PR/CI/интеграция/образ/выпуск и реальные A/B открыты.
