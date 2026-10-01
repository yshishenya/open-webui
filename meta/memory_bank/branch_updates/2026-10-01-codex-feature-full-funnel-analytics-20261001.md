- [ ] **[ANALYTICS]** Полная воронка Airis
  - Spec: meta/memory_bank/specs/work_items/2026-10-01__feature__full-funnel-analytics.md
  - Owner: Codex
  - Branch: codex/feature/full-funnel-analytics-20261001
  - Started: 2026-10-01
  - Summary: Определены критерии приёмки; выполняется согласование модели, событий, финансового подтверждения и доставки.
  - Tests: Pending

- Реализованы согласие/отзыв, привязка устройств и аккаунта, lifetime-маркеры,
  серверные финансовые события/возвраты, постоянная очередь и отчёт 7/30 дней.
- Независимая проверка исправила дубли объединённых устройств, replay после
  повторного согласия, старые аккаунты в привлечении и разное окно этапов отчёта.
- Проверки: backend analytics/report 19/19; existing billing 58/58; frontend
  финальный полный прогон 139/139; Playwright 2/2; frontend production build passed.
- Upgrade/downgrade новой миграции passed. Полный typecheck имеет старые ошибки;
  scoped проверка не нашла ошибок в новых модулях. Preflight script отсутствует;
  исключение для PR явно разрешено пользователем ранее.
- Метрика: сохранение 6 новых целей подтверждено. Production rollout и получение
  новых server-side событий внешними провайдерами пока не подтверждены.

- PR: https://github.com/yshishenya/open-webui/pull/130 (draft, airis_b2c).
- PostHog Team 2 / Dashboard 3: создано 9 отчётов; все QueryRunner запросы passed;
  реальное контрольное событие принято по HTTPS и найдено в хранилище.
- Метрика: виджет первой подтверждённой оплаты сохранён на «Эффективность трафика».
- CI SDD/frontend lint/migration/gitleaks/JS CodeQL passed. Backend collection
  имеет 34 старые ошибки отсутствующего langchain_community в upstream CI image;
  файлы импорта/requirements/workflow совпадают с integration baseline. Ruff
  billing router: 338 violations и в HEAD, и в baseline; собственные новые строки
  исправлены, массовое форматирование не выполнялось.
- Production healthy, но свободно около 3.1 GiB при gate 10 GiB. Начато копирование
  7 старых backup на Mac; серверные экземпляры сохранены до полного checksum
  и restore-list контроля и разрешения на удаление дубликатов.
- OAuth Метрики не найден. Новая production версия ещё не выложена; цель остаётся
  active, AC13/15 открыты. Реальная денежная приёмка не выполнялась.

- При платежном событии готовность server transport обновляется даже в уже открытой
  вкладке; regression на изменение false→true passed, весь frontend 139/139.
