
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

- [x] **[BUG]** Контракты представлений096 проверены
  - Spec: meta/memory_bank/specs/work_items/2026-10-12__bugfix__existing-ui-contracts.md
  - Owner: Codex
  - Done: 2026-10-12
  - Summary: 5 компонентов, готовые типы; runtime сохранён;2585 frontend,types0/15,ESLint92,new0. Общая цель active.

- [x] [BUG] Типы выбора в административных настройках.
  - Spec: meta/memory_bank/specs/work_items/2026-10-12__bugfix__admin-selection-types.md
  - Owner: Codex
  - Started: 2026-10-12
  - Done: 2026-10-12
  - Summary: 2 компонента; готовые типы/runtime сохранён;2585 frontend,types0/15,ESLint73/new0;scoped2/CI408/format чистые. Общая цель active.

- [x] [BUG] Оставшиеся мёртвые объявления и архивный список.
  - Spec: meta/memory_bank/specs/work_items/2026-10-12__bugfix__remaining-dead-bindings.md
  - Owner: Codex
  - Started: 2026-10-12
  - Done: 2026-10-12
  - Summary:18 замечаний устранены;frontend2585/2585,types0/15,ESLint55/new0;scoped11/CI419/format clean,compilation21/SSR7. Общая цель active;выпуска нет.

- [x] [BUG] Проверка данных переноса файлов.
  - Spec: meta/memory_bank/specs/work_items/2026-10-12__bugfix__file-drop-validation.md
  - Owner: Codex
  - Started: 2026-10-12
  - Done: 2026-10-12
  - Summary: общий parser и четыре получателя;5focused/2590full,types0/15,ESLint45/new0,scoped7/CI426 clean,CSS8. Production/данные сохранены;цельactive.

- [x] [BUG] Нативные связи и свойства отображения.
  - Spec: meta/memory_bank/specs/work_items/2026-10-12__bugfix__native-display-contracts.md
  - Owner: Codex
  - Started: 2026-10-12
  - Done: 2026-10-12
  - Summary:2focused/2592full,types0/2,ESLint28/new0,scoped17/CI441 clean,CSS28/SSR18. Production/данные сохранены;цельactive.

- [x] [BUG] Срок жизни просмотра и очищенная разметка.
  - Spec: meta/memory_bank/specs/work_items/2026-10-12__bugfix__preview-lifecycle.md
  - Owner: Codex
  - Started: 2026-10-12
  - Done: 2026-10-12
  - Summary:5focused/2597full,types0/0,ESLint16/new0,scoped8/CI449 clean;real PDF/KaTeX/SVG;DOMPurify3.4.16. Production/данные сохранены;цельactive.

- [x] Контракты административных настроек и просмотра доступа.
  - Spec: meta/memory_bank/specs/work_items/2026-10-12__refactor__admin-config-contracts.md
  - Owner: Codex
  - Started: 2026-10-12
  - Summary: реальные серверные поля/shared preview types; nullable/optional значения сохраняются.
  - Done: 2026-10-12
  - Acceptance: 1focused/2598full, types0/0, ESLint16→10/new0, scoped10/CI454/format clean;12compiled-identical. Production/данные сохранены;цельactive.

- [x] Общий тип записи памяти и контракт сохранения персонализации.
  - Spec: meta/memory_bank/specs/work_items/2026-10-12__refactor__memory-view-contract.md
  - Owner: Codex
  - Started: 2026-10-12
  - Summary: переиспользовать Settings и существующие поля Memory; исполняемый код сохраняется.
  - Done: 2026-10-12
  - Acceptance:2598full,types0/0,ESLint10→8/new0,scoped3/CI456/format clean,5compiled-identical. Production/данные сохранены;цельactive.

- [x] [BUG] Завершение frontend contracts и проверка устаревшей ручки списка.
  - Spec: meta/memory_bank/specs/work_items/2026-10-12__bugfix__frontend-gate.md
  - Owner: Codex
  - Started: 2026-10-12
  - Summary: последние8 ESLint diagnostics; сохранить runtime SDK и проверить актуальную позицию списка.
  - Done: 2026-10-12
  - Acceptance:9focused/2600full,types0/0,ESLint8→0,scoped6/CI462/format clean. Native stale handle failure исправлен, SDK executable preserved;fresh Ruff547. Production/данные сохранены;цельactive.

- [x] **[REFACTOR][BACKEND]** 21 механическое исправление для выпуска
  - Spec: meta/memory_bank/specs/work_items/2026-10-12__refactor__backend-mechanical-gate.md
  - Owner: Codex
  - Started: 2026-10-12
  - Summary: Строки, аннотации и лишние скобки; полный backend и доказательство эквивалентности, без новых подсистем.

  - Done: 2026-10-12
  - Verification: 1064backend/0skips,25прежнихwarnings;Black465unchanged,Ruff547→526/new0,scope CI13files/new0. Весь branch CI38new остаётся открытым;frontend5040хешей совпали. Production/данные сохранены;выпуска нет,цельactive.
