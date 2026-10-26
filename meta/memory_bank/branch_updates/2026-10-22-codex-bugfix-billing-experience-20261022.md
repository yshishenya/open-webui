- [ ] **[BUG][BILLING][UX]** Исправления по полному аудиту биллинга и безопасный выпуск
  - Spec: `meta/memory_bank/specs/work_items/2026-10-22__bugfix__billing-experience-implementation.md`
  - Owner: Codex
  - Branch: `codex/bugfix/billing-experience-20261022`
  - Started: 2026-10-22
  - Summary: Владелец разрешил исправления и выпуск. Основа c63de6eb38afaac786fad5bf6df7338d15b074b3; исходный аудит30 пунктов/62 семейства, данные и коммерческие условия защищены. Реализация начата, завершение не заявлено.
  - Tests: Промежуточные проверки: svelte-check 0 ошибок/0 предупреждений; 37 адресных frontend-тестов прошли (ReportingRecords, EditUserModal, уведомления об источнике оплаты). Backend reporting PostgreSQL 22 passed. Полный backend: 1320 passed/10 skipped/1 failed — сценарий ранее начатой оплаты подписки ещё исправляется. Итоговый повтор всех проверок обязателен.
  - Risks: Денежные пути/подписки/импорт/production; изолированные проверки, независимый обзор и защищённый выпуск обязательны. Реальные денежные операции не являются тестами.

- [ ] **[BUG][BILLING][UX]** Состояние после заморозки кода, 2026-10-22
  - Spec: `meta/memory_bank/specs/work_items/2026-10-22__bugfix__billing-experience-implementation.md`
  - Owner: Codex
  - Branch: `codex/bugfix/billing-experience-20261022`
  - Started: 2026-10-22
  - Summary: Реализация и независимый обзор завершены для task-1-1…task-1-6 и task-2-1 (7/10 completed). Общая проверка task-2-2 остаётся in_progress; релизные task-3-1/task-3-2 pending. Рабочая ветка fast-forward до b924d097b (docs PR #384), не релиз исправлений биллинга.
  - Tests: По результату главного агента полный backend root — 1394 passed/13 skipped, журнал `backend-all-final.log`. Ранее были apps/webui 567 passed/4 skipped, PostgreSQL 154 passed/1 reporting skip и отдельно reporting PostgreSQL 25 passed без пропусков. Frontend preflight пока running; итоговые браузерные/Compose confidence проверки не подтверждены.
  - History: Прежние красные результаты сохранены: frontend 2683 passed с 3 ошибками сбора suites; backend 1320 passed/10 skipped/1 failed; coverage.tracer из noexec tmpfs /tmp и внутренний сбой резервного PyTracer. Последующий успешный запуск покрытия не стирает эти инструментальные отказы; пороги не снижались.
  - Risks: Финальный SHA не проверен; коммит/PR исправлений, CI, слияние, выпуск и production-приёмка не закрыты. Изменена только документация, код остаётся заморожен.

- [ ] **[BUG][BILLING][UX]** PR385 и завершение подготовительных проверок
  - Spec: `meta/memory_bank/specs/work_items/2026-10-22__bugfix__billing-experience-implementation.md`
  - Owner: Codex
  - Started: 2026-10-22
  - Summary: Реализация зафиксирована в4dc35fe0cb5037a08a4c36c16ed4f4d83b7b8040, PR385 вairis_b2c. Исправление формата нового SDD-ID только документальное; CI не ослаблен.
  - Tests: Полный preflight PASS (2773/252, типы0/0, ESLint, build), дополнительные11 deploy-контрактов PASS; billing UI21/21 PASS. Schema+policy для318 SDD:0/0. Настоящие confidence tiers и CI нового SHA ещё ожидаются.
  - Risks: Не слито и не выпущено. Перед выпуском обязательны точный SHA, место на сервере, закрытая свежая копия, восстановление/миграции и обе роли в production.

- [ ] **[BUG][BILLING][CI]** Исправление тестового окружения analytics
  - Spec: `meta/memory_bank/specs/work_items/2026-10-22__bugfix__billing-experience-implementation.md`
  - Owner: Codex
  - Started: 2026-10-22
  - Summary: CI2b прошёл backend/frontend/wallet/billing UI, но analytics39/43. Найдены отсутствующий тестовый счётчик и гонка восстановления storage в тесте; исправлены только Compose и ожидание E2E, приложение не менялось.
  - Tests: Compose config подтверждает фиктивный счётчик99999999 и пустой GA; diff-check PASS. Новый CI и реальные три confidence tier обязательны. Образ2b проверен по source/static/packages/native, PostgreSQL restore/migration PASS. Старый незавершённый прогон сохраняется отдельно.
  - Risks: Выпуск остаётся закрыт до зелёных проверок нового SHA. Production не обновлялся; очищен только один восстанавливаемый неиспользуемый образ, контент/конфигурация сохранены.

- [ ] **[BUG][BILLING][CI]** Изоляция БД теста создания оплаты
  - Spec: `meta/memory_bank/specs/work_items/2026-10-22__bugfix__billing-experience-implementation.md`
  - Owner: Codex
  - Started: 2026-10-22
  - Summary: CI1076 прошёл полностью, но независимый merge-medium обнаружил зависимость service-core от подписки user_1, оставленной quota. Класс подключён к существующему сбросу БД AbstractPostgresTest; приложение и денежные защиты не меняются.
  - Tests: Красный результат198 passed/3 skipped/1 failed сохранён. Адресное воспроизведение и полный повтор на новом SHA обязательны; успех CI1076 не подменяет их.
  - Verification: Старый1076 воспроизвёл1 passed/1 failed; исправленный quota→core17/17, полный coverage279 passed/3 skipped. Пороги router89,39/77,67% и service88,60/81,18% прошли без снижения; Black/Ruff/diff-check и независимый обзор PASS. Новый commit/CI/tiers остаются обязательными.
  - Risks: Слияние и выпуск остаются закрыты до нового CI и трёх уровней confidence.

- [ ] **[BUG][BILLING][PROD]** Точный SHA проверен и слит; защищённый выпуск продолжается
  - Spec: `meta/memory_bank/specs/work_items/2026-10-22__bugfix__billing-experience-implementation.md`
  - Owner: Codex
  - Started: 2026-10-23
  - Summary: PR385 слит без обхода защит вc38616a0b8dbb235e5cfecaa09e730ab63643b57; дерево совпадает сe48. Финальный чистый образ опубликован после повторной компиляции и проверки ресурсов/пакетов/native/миграции. Первая попытка остановилась до миграции из-за порога10GiB; сохранены её копия и журнал. После удаления только проверенных восстановимых неиспользуемых образов запущена новая попытка со свежей копией20261023T131945Z-billing-c38616a0b8db-2087114.
  - Tests: CI merge SHA39709565674/39709565660 success;1397 backend passed/10 existing skips. Три confidence tier e48:5/5,6/6,7/7; независимый PostgreSQL167 passed/0 skipped. Предрелизная сверка новой копии и mounted cache:49 файлов/27 ссылок совпали; только прежние26 служебных metadata-отсутствий. Девять offline deploy-helper проверок повторены успешно.
  - Risks: До подтверждения guarded completion и ручной production-приёмки задача не закрыта. VoiceOver исключён владельцем, настоящий200%/обе роли и итоговая матрица остаются отдельными условиями. Текущий/предыдущий рабочие образы, копии, контент, тома и соседние сервисы сохранены.

## Production acceptance follow-up — 2026-10-23

- [ ] [BUG] Довести найденные при production-проходе UI-регрессии и повторить выпуск.
  - Spec: meta/memory_bank/specs/work_items/2026-10-22__bugfix__billing-experience-implementation.md
  - Owner: Codex
  - Started: 2026-10-23
  - Summary: c386 успешно выпущен с проверенной закрытой копией; продолжаются
    адресные исправления SPA-навигации, мобильных планов, переводов и достоверного
    отображения срока подписки. Нужны проверки нового SHA, follow-up PR/выпуск
    и повторная приёмка обеих ролей. Денежные тестовые действия не выполняются.

- [ ] [BUG] Защитить повтор пополнения за границей24ч и атомарность импорта цен.
  - Spec: meta/memory_bank/specs/work_items/2026-10-22__bugfix__billing-experience-implementation.md
  - Owner: Codex
  - Started: 2026-10-23
  - Summary: Изолированные PostgreSQL-регрессии подтвердили новую Payment после
    истечения окна повтора и частично сохранённую цену при сбое второй записи.
    Добавлены отказ для незавершённой старой оплаты и единая транзакция импорта.
  - Tests: Красные проверки сохранены отдельно; полный targeted green прогон
    выполняется. CI39967117475 success относится только к прежнему a035.
  - Risks: Новый backend/переводы ещё не проверены на итоговом SHA/образе и не
    выпущены. Production остаётся c386; подписки выключены, реальные деньги не менялись.

- [ ] [BUG] Свести оставшиеся проверки истории цен, выгрузок и ошибок загрузки.
  - Spec: meta/memory_bank/specs/work_items/2026-10-22__bugfix__billing-experience-implementation.md
  - Owner: Codex
  - Started: 2026-10-26
  - Summary: CI39970347515 exact-f1 success. Готовы адресные G3/G4 регрессии;
    исправлены ложные empty/unknown-subscription состояния планов. U03 подготовлен,
    но ещё не исполнен. Следуют чистый общий SHA, независимый обзор/preflight,
    три confidence уровня, follow-up PR и защищённый выпуск.
  - Tests: G3 UI5/5+PostgreSQL2/2; G4 HTTP6/6+UI9/9 на отдельных снимках.
    Эти результаты не заменяют итоговые проверки общего SHA и production обеих ролей.
  - Risks: Подписки остаются выключенными; новая коммерция и реальные денежные
    тестовые операции не разрешены. Человеческое исследование/чек не исключены
    без ответа владельца; VoiceOver исключён, настоящий200% остаётся pending.

- [ ] [BUG] Устранить два замечания CI follow-up PR387 без ослабления проверок.
  - Spec: meta/memory_bank/specs/work_items/2026-10-22__bugfix__billing-experience-implementation.md
  - Owner: Codex
  - Started: 2026-10-26
  - Summary: a976 прошёл frontend preflight2836, Backend CI1411/10 skips,
    отдельные139 регрессий и U03 в двух браузерах. CI PR387 выявил C90111>10
    и I001. Удалён лишний внешний if перед пустым циклом helper, импорты
    исправлены по актуальному Ruff; новая версия повторно проверяется.
  - Risks: Production остаётся c386, выпуск и приёмка обеих ролей не завершены.
