- [ ] **[FEATURE][BILLING][ANALYTICS]** Понятные аналитика и деньги
  - Spec: meta/memory_bank/specs/work_items/2026-10-04**feature**analytics-billing-ui.md
  - Owner: Codex
  - Branch: codex/feature/analytics-billing-ui
  - Started: 2026-10-04
  - Summary: Реализация согласованного постраничного проекта: достоверная воронка и денежные состояния, рабочие экраны продукта/денег/клиентов, простой пользовательский баланс.
  - Tests: Pending; Docker Compose-first, целевые денежные сценарии, браузер и независимая проверка.
  - Risks: Даты и определения отчётов требуют согласования; права и реальные финансовые записи сохраняются.

## Integration check

- Backend reports: 19 focused Docker tests passed, including ordinary owner isolation and no-store.
- Frontend analytics scope: no new type errors; 88 inherited errors in 9 imported upstream files remain in the scoped run.
- Full Docker check/build hit SIGKILL from shared Docker memory pressure. Native copied dependencies have identical package-lock; Node 22 isolated runtime and source-map-disabled production build will be used for the complete artifact. Docker remains the test runner.
- Independent reviews identified and resolved period/group drift and message-scope mismatch. Wallet UTC pagination/race fixes and admin reactive customer/csv actions are in progress.

## Финальная интеграция

- Integration: fast-forward до `cf726e18fafcec88f4832d9b187697b479a6c75b`, включая PR210 и приёмку почтовой очереди. Production уже использует `mail-queue-95bf27b94-on-metrica-20261004`; базовый образ будет повторно сверяться перед выпуском.
- Независимая проверка: закрыт обход `ENABLE_ADMIN_CHAT_ACCESS`, 4 проверки HTTP прав; окно модели обновляется при смене дат/группы и игнорирует старый ответ, отдельная исполняемая проверка прошла.
- Tests: полный frontend после интеграции — 287/58 файлов. Backend, окончательная сборка и постраничная браузерная приёмка продолжаются.
- Приёмка с пятью нетехническими людьми не проводилась; время решения заданий остаётся гипотезой до этого испытания.

## Проверенный состав перед PR

- Backend: 850 passed / 4 PostgreSQL-only skips; все четыре отдельно прошли PostgreSQL 16. Billing coverage pack 220 passed; исходные пороги 85/65 и 85/70 пройдены.
- Frontend: 288 passed / 58 файлов при ограничении до двух работников в общем Docker окружении. Неудачный перегруженный прогон с тайм-аутами не засчитан.
- Typecheck: 4 398 errors / 176 warnings против 4 419 / 177 в исходной версии; после нормализации порядка union типов и путей node_modules новых диагностик нет. Мобильные подписи и синхронное форматирование денег исправлены.
- ESLint: 1 532 прежних диагностик src против 1 540 исходных; новых диагностик в src нет. Два замечания новых браузерных тестов устранены, целевой lint прошёл.
- Сборка production с PUBLIC_YANDEX_METRICA_ID=111392024 прошла. Для выпуска требуется новая сборка с SHA итогового коммита. Первый браузерный прогон: 16/18 пользовательских сценариев прошли, два тайм-аута на загрузке; последовательный повтор начат. Полная приёмка и публикация пока pending.
