- [ ] **[ANALYTICS]** Полная воронка Airis
  - Spec: `meta/memory_bank/specs/work_items/2026-10-01__feature__full-funnel-analytics.md`
  - Owner: Codex
  - Branch: codex/feature/full-funnel-analytics-20261001
  - Started: 2026-10-01
  - Summary: Реализация и выкладка выполнены; приёмка PostHog, отчёта администратора и уведомлений YooKassa подтверждена. Ожидается обработка контрольной конверсии Метрикой.
  - Tests: 25 analytics + 95 billing; 139 frontend; 2 browser; migration/build passed. Existing CI/typecheck limitations documented in spec.

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

### Production rollout and live checks

- Spec: `meta/memory_bank/specs/work_items/2026-10-01__feature__full-funnel-analytics.md`
- All seven backups transferred/validated; authorized duplicate deletion freed required disk. Latest backup and fresh rollout backup retained.
- Deployed source edbd07e149c4d340b84dfa031c714adf73e19fef; registry digest 24273c0692f2c6ce98f4a29964307e79db20e11b39cfb819d4e6409b7617e99a. Service-only rollout/migration/health/public version passed.
- Live consent, first-visit attribution, durable PostHog delivery and warehouse receipt, revoke purge, unauthenticated report denial, 7/30-day report calculation passed.
- Metrica OAuth prepared; create/permission grant awaits required browser action-time confirmation. Signed-in/full real financial acceptance remains unproven; SDD verification task stays in progress.

- 2026-10-01: Metrica OAuth authorized/connected; production healthy after restart. Added missing exact signup and technical goals; corrected four offline goal conditions preserving IDs. Packaged transport accepted genuine technical conversion upload 1211156457; processing/report linkage and signed-in acceptance remain open.
  Spec: `meta/memory_bank/specs/work_items/2026-10-01__feature__full-funnel-analytics.md`

- 2026-10-01: Existing-account linking/wallet smoke passed; non-admin access correctly denied. Concurrent SMTP deployment lost runtime provider environment; restored override preserving new image, verified healthy and matching analytics module hashes. Metrica processing, admin report and YooKassa refund notification setting remain open.
  Spec: `meta/memory_bank/specs/work_items/2026-10-01__feature__full-funnel-analytics.md`

- 2026-10-01: User supplied administrator and merchant sessions. Production 7/30-day report and existing-account exclusion verified. Correct YooKassa endpoint and refund.succeeded subscription confirmed in cabinet; no mutation needed. Metrica processed/report receipt and signed-in provider ClientID acceptance remain pending.
  Spec: `meta/memory_bank/specs/work_items/2026-10-01__feature__full-funnel-analytics.md`

- [x] [BUG] 2026-10-01: Prevent duplicate Metrica upload after status/reconciliation 4xx. Six regression cases fail before one-line request-method guard; 25 analytics checks pass after. Deployed as 360f62478-metrica-retry-20261001 preserving SMTP; exact module hash and healthy runtime verified. AC07 closed.
  - Owner: Codex
  - Done: 2026-10-01
  - Spec: `meta/memory_bank/specs/work_items/2026-10-01__feature__full-funnel-analytics.md`

- 2026-10-01: Final independent audit found no further required PostHog settings. Updated operational guide with connected OAuth, verified admin/merchant cabinets and local ORB limitation. CI for PR source head 360f62478 now passes 439 backend tests and all three billing-confidence suites; baseline backend lint remains red. Goal and SDD verification remain active pending Metrica processing/report receipt.
  Spec: `meta/memory_bank/specs/work_items/2026-10-01__feature__full-funnel-analytics.md`

- [ ] [BUG] 2026-10-02: Repair missing external delivery after provider configuration outage. Production wallet-view event exists without PostHog delivery. Independent source audit confirms recovery gap. Implementing consent/cutoff-bound repair, preserving existing delivery states and accepted upload IDs.
  - Owner: Codex
  - Started: 2026-10-02
  - Spec: `meta/memory_bank/specs/work_items/2026-10-01__feature__full-funnel-analytics.md`
