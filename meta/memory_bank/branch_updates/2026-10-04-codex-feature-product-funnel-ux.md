- [ ] **[FEATURE][ANALYTICS]** Понятное окно воронки продукта
  - Spec: meta/memory_bank/specs/work_items/2026-10-04__feature__product-funnel-ux.md
  - Owner: Codex
  - Branch: codex/feature/product-funnel-ux
  - Started: 2026-10-04
  - Summary: Довести согласованное окно воронки от реализации до выпуска и проверки в продакшене; использовать объединённый PR212 без изменения чужой рабочей копии.
  - Tests: Финальная версия frontend 298/59 файлов, backend Docker 897 passed / 4 PostgreSQL-only skips, browser static 10/10; build, целевой lint, SDD и diff-check успешны.
  - Risks: Устаревшие ответы и разные основания отчётов; реальные платежи/рассылки вне проверки.

## Перед выпуском

Реализация и локальная проверка готовы; commit/PR/merge/deploy не выполнены. Проверка исходного SHA 634342b74fe4098528818d0641a16feeaea51461: 4398 ошибок типов / 176 предупреждений совпадают с финальным кодом, новых диагностик нет; 1532 прежние ошибки ESLint; Black требует форматирования 409 неизменённых backend-файлов. Целевой ESLint зелёный. Запрошено решение пользователя о прежнем долге; CI/пороги не ослаблялись. Прерванные OOM прогоны не засчитаны, подробности в Spec. Prod не изменён.

## Повторная проверка

- Spec: meta/memory_bank/specs/work_items/2026-10-04__feature__product-funnel-ux.md
- Owner: Codex
- Started: 2026-10-04
- Summary: База обновлена до cbbe9ab57dd4000018b6d6fe165aa237a6408a30 без конфликтов. Самостоятельный обзор автора выделил методику в компонент; независимый обзор не выполнен.
- Tests: Docker frontend 318/60 файлов; четыре прежних PostgreSQL-only пропуска закрыты; на новой базе отчёты 17 passed + отдельно PostgreSQL 1 passed. Финальные build/browser 10/10 успешны. На новой базе и финальном коде 4376 errors/176 warnings идентичны; ESLint 1529 ошибок в обоих случаях. Целевой lint, Prettier, diff-check, SDD успешны.
- Pending: Решение по прежнему долгу, независимый обзор и выпуск текущего замороженного SHA. Commit/PR/merge/deploy не выполнены, production не изменён. Временные контейнеры остановлены.
- 2026-10-04: user authorized documented inherited-quality exception without weakening mandatory CI and independent review. Original source acd456891; integrating exact74a4ed6f7, preserving per-source paths/attention/hash diagnostics. Lorentz found one UTC-midnight P2, fixed with dynamic load validation and regression. Full release acceptance remains in progress.
  - Spec: meta/memory_bank/specs/work_items/2026-10-04__feature__product-funnel-ux.md
