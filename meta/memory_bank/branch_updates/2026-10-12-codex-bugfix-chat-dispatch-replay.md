
- [x] **[BUG]** Navbar/access input guards (083)
  - Spec: `meta/memory_bank/specs/work_items/2026-10-12__bugfix__navbar-access-inputs.md`
  - Owner: Codex
  - Done: 2026-10-12
  - Summary: Проверить persisted баннеры; сохранить null sentinel временного режима и уточнить nullable конфигурацию/ответ администратора. Минимальный frontend diff без новых зависимостей.
  - Tests:3 targeted/28 compiled-browser/2515 full pass,page errors0; types60/24, ESLint186,new0; scoped/futureCI358/format pass;4 compilations/CSS/store+API JS preserved;272 SDD validate after staging. Production/data unchanged; no release.

- [x] **[REFACTOR]** Model/quota existing types (084)
  - Spec: `meta/memory_bank/specs/work_items/2026-10-12__refactor__model-quota-types.md`
  - Owner: Codex
  - Done: 2026-10-12
  - Summary: Уточнить7 ошибок через уже объявленные ComponentProps/LeadMagnetUsage без изменения поведения; проверить compiled JS/CSS.
  - Tests:2515 full;4 compiled JS/CSS comparisons pass;types53/24,ESLint184,new0;scoped2/futureCI360/format clean;272 SDD valid. Backend reused after565 hashes; production/data preserved; no release.

- [x] **[BUG]** Shared response/file status inputs (085)
  - Spec: `meta/memory_bank/specs/work_items/2026-10-12__bugfix__stream-file-status.md`
  - Owner: Codex
  - Done: 2026-10-12
  - Summary: Отказ проверки статуса не должен возвращать файл как готовый; readers закрываются; wire usage/metadata и multipart сохраняются; private logs убираются.
  - Tests:17 focused/22 combined/18 browser/2532 full pass; types51/24,ESLint183,new0;scoped6/futureCI363/format clean; backend565hashes reused,production/data preserved; no release.

- [x] **[REFACTOR]** Existing types in small UI components (086)
  - Spec: `meta/memory_bank/specs/work_items/2026-10-12__refactor__small-ui-types.md`
  - Owner: Codex
  - Done: 2026-10-12
  - Summary: Уточнить существующие типы обновления/модели/поиска/изображения; сохранить исполняемый JavaScript/CSS, без новых функций.
  - Tests:2532 full;8 compiled JS/CSS comparisons;types43/24,ESLint178,new0;scoped5/futureCI367/format clean;273 existing SDD valid;production/data preserved,no release.

- [x] **[BUG]** UI action guards for missing and changing data (087)
  - Spec: `meta/memory_bank/specs/work_items/2026-10-12__bugfix__ui-action-guards.md`
  - Owner: Codex
  - Done: 2026-10-12
  - Summary: Сохранён источник действий папки; безопасное закрытие Changelog, заблокированные popup FileItem и отсутствующие квоты PlanForm.
  - Tests:27targeted/2554full pass;10compilations/CSS;types31/24,ESLint178,new0;scoped7/PR371/format clean. SDD3/3 completed;production/data preserved. Выпуска нет, цельactive.

- [x] **[BUG]** Cell editor lifecycle (088)
  - Spec: `meta/memory_bank/specs/work_items/2026-10-12__bugfix__cell-editor-lifetime.md`
  - Owner: Codex
  - Done: 2026-10-12
  - Summary: Синхронный cleanup освобождает редактор/наблюдатель, поздняя загрузка языка безопасна, отказ сохраняет редактирование. Без флагов/менеджеров/повторов/зависимостей.
  - Tests:7targeted/2557full pass;2компиляции/CSS;types30/24,ESLint178,new0;scoped2/PR371/format clean;backend565hashes reused,production/data preserved. SDD2/2 completed,выпуска нет,цельactive.

- [x] **[BUG]** Native UI attributes (089)
  - Spec: `meta/memory_bank/specs/work_items/2026-10-12__bugfix__native-ui-attributes.md`
  - Owner: Codex
  - Done: 2026-10-12
  - Summary: Подписи связаны с нужными полями; нативные iframe/textarea/dir и прежний className Clipboard исправлены. API/обработчики/CSS сохранены; без helpers/зависимостей.
  - Tests:67targeted/2566full pass;10компиляций/CSS,6scripts unchanged;types21/24,ESLint178,new0;scoped7/PR371/format clean;backend565hashes reused,production/data preserved. SDD2/2 completed,выпуска нет,цельactive.

- [x] **[BUG][UI]** Безопасно обработать отсутствующие значения действий
  - Spec: meta/memory_bank/specs/work_items/2026-10-12__bugfix__nullable-action-inputs.md
  - Owner: Codex
  - Done: 2026-10-12
  - Summary: Простые guards в существующих обработчиках;30targeted/2578full pass;types10/24,ESLint177,new0;scoped6/PR374/format clean,8компиляций/CSS;production/данные сохранены,выпуска нет.

- [x] **[BUG][UI]** Согласовать свойства существующих компонентов
  - Spec: meta/memory_bank/specs/work_items/2026-10-12__bugfix__component-prop-contracts.md
  - Owner: Codex
  - Done: 2026-10-12
  - Summary: 25targeted/2582full pass;types3/17,ESLint167,new0;scoped6/PR377/format clean,10компиляций/CSS,5прежних scripts;production/данные сохранены,выпуска нет.

- [ ] **[BUG][UI]** Типы просмотра файлов и нативные действия
  - Spec: meta/memory_bank/specs/work_items/2026-10-12__bugfix__file-viewer-types.md
  - Owner: Codex
  - Started: 2026-10-12
  - Summary: Закрыть три ошибки declarations/className; переиспользовать типы API и standard sql.js declarations, сохранить действия файлов.

- [x] [BUG] Типы просмотра файлов — выполнено.
  - Spec: meta/memory_bank/specs/work_items/2026-10-12__bugfix__file-viewer-types.md
  - Owner: Codex
  - Done: 2026-10-12
  - Summary: 2585/2585 frontend, 5/5 targeted; types 0/15, ESLint 148, новых 0. Четыре компиляции/CSS и два script сравнения; dev-only sql.js types, runtime и сервер сохранены.

- [x] [BUG] Неиспользуемые импорты.
  - Spec: meta/memory_bank/specs/work_items/2026-10-12__bugfix__unused-imports.md
  - Owner: Codex
  - Done: 2026-10-12
  - Summary: удалены 12 unused import bindings из восьми файлов. 16 компиляций сохраняют JS body/CSS, 2585/2585 frontend; types 0/15, ESLint 136, новых 0. Lint/формат 8/388 без ошибок. Сервер/данные сохранены, выпуска нет.

- [x] [BUG] Существующие контракты расписаний.
  - Spec: meta/memory_bank/specs/work_items/2026-10-12__bugfix__scheduling-contracts.md
  - Owner: Codex
  - Done: 2026-10-12
  - Summary: Existing API/context typed;2585 frontend,types0/15,ESLint111/new0,scoped9/CI397 clean,14 compiled comparisons;backend563 reuse1064/25. Fresh Ruff547/Black diff0. Production/data preserved;release and real A/B pending.

- [x] [BUG] Неиспользуемые объявления.
  - Spec: meta/memory_bank/specs/work_items/2026-10-12__bugfix__unused-declarations.md
  - Owner: Codex
  - Done: 2026-10-12
  - Summary:4 добавления/167 удалений приложения;active handlers и payloads сохранены.2585 frontend,types0/15,ESLint103/new0,scoped4/CI401 clean,8 retained compiled comparisons;backend563 reuse1064/25. Production/data preserved;release and real A/B pending.
