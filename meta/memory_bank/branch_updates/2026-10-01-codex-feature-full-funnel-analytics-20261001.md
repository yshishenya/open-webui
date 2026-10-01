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
  финальный полный прогон 138/138; Playwright 2/2; frontend production build passed.
- Upgrade/downgrade новой миграции passed. Полный typecheck имеет старые ошибки;
  scoped проверка не нашла ошибок в новых модулях. Preflight script отсутствует;
  исключение для PR явно разрешено пользователем ранее.
- Метрика: сохранение 6 новых целей подтверждено. Production rollout и получение
  новых server-side событий внешними провайдерами пока не подтверждены.
