
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
