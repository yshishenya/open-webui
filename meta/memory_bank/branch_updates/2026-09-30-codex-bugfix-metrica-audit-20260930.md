- [ ] **[BUG][ANALYTICS]** Аудит и восстановление подключения Яндекс Метрики
  - Spec: `meta/memory_bank/specs/work_items/2026-09-30__bugfix__yandex-metrica-production-audit.md`
  - Owner: Codex
  - Branch: codex/bugfix/metrica-audit-20260930
  - Started: 2026-09-30
  - Summary: Аудит завершён, подготовлены CI build args и исправления SPA/privacy/UTM. Live восстановление требует настроек Tilda/Метрики, подтверждённого ID, пересборки и публикации; SDD остаётся active.
  - Tests: Read-only HTTPS/Docker; 7/7 scoped Vitest, ESLint, source Prettier и diff-check passed; CI YAML parsed. Full typecheck failed (8363 errors / 226 warnings вне изменённых analytics файлов), YAML formatting также failing на исходном HEAD.
  - Risks: Provider settings/report delivery и deploy не проверены; данные до восстановления тега невозможно получить из frontend задним числом.

## 2026-09-30 — локальная сборка обязательна; live task pending

- Spec: `meta/memory_bank/specs/work_items/2026-09-30__bugfix__yandex-metrica-production-audit.md`
- Исправления pushed: a5ccb3c87; 8/8 focused tests, scoped ESLint passed.
- Browser baseline: Tilda и product не загружают Метрику; Chatra script Tilda сломан.
- Серверные frontend build попытки завершились OOM (134/137), rollout не выполнен.
  После указания пользователя собирать на Mac серверные сборки не запускались,
  temporary swap удалён. Production image прежний, healthy и /health=true.
- Локальный проект найден; local command executor этого чата недоступен.
  Готовы команды в `meta/docs/releases/metrica-local-build.md`.
- Tilda, кабинет Метрики, GitHub API и реальный local build требуют доступа.
  Release notes — черновик; live task и SDD остаются незавершёнными.

## 2026-09-30 — Tilda исключена, подготовлена локальная задача

- Spec: `meta/memory_bank/specs/work_items/2026-09-30__bugfix__yandex-metrica-production-audit.md`
- Пользователь: Tilda не трогать; создать локальный чат open-webui_local и передать задачу.
- Подтверждён local project; в tools отсутствуют create_thread/handoff/send_message.
  Чат не создан. Полный handoff сохранён в `meta/docs/releases/metrica-local-task.md`.
- Product image прежний, healthy, restart count1; live task pending.

- [ ] **[BUG][OPS][METRICA]** Локальная сборка и защищённая выкладка продукта
  - Spec: `meta/memory_bank/specs/work_items/2026-09-30__bugfix__yandex-metrica-production-audit.md`
  - Owner: Codex local
  - Started: 2026-09-30
  - Summary: Создан отдельный локальный worktree; пользовательские изменения сохранены. Production digest подтверждён, healthy; свободно 6.4 GiB. Первая локальная сборка остановилась на Docker Hub metadata timeout до npm/build; выполняется отдельный pull базового Node image. Tilda исключена из работы.

- [ ] **[BUG][METRICA]** Подготовлен production-образ и подтверждён кабинет
  - Spec: `meta/memory_bank/specs/work_items/2026-09-30__bugfix__yandex-metrica-production-audit.md`
  - Owner: Codex local
  - Started: 2026-09-30
  - Summary: Frontend собран на Mac; compiled ID/version и linux/amd64 подтверждены. 8/8 Vitest и scoped ESLint прошли повторно через Docker Compose. Cabinet ID/domain/filters/ecommerce проверены; создана только отсутствующая цель просмотра регистрации. Публикация образа выполняется; rollout ещё не начат.

- [ ] **[BUG][PRIVACY][METRICA]** Защитить служебный URL инициализации
  - Spec: `meta/memory_bank/specs/work_items/2026-09-30__bugfix__yandex-metrica-production-audit.md`
  - Owner: Codex local
  - Started: 2026-09-30
  - Summary: Live smoke выявил query leak в deferred settings request; первый candidate откатан на healthy baseline. Общая инициализация теперь получает очищенные url/referrer. Regression доказан; повторная сборка и live acceptance выполняются.


### Дополнительная проверка карты кликов на Mac

Предварительный browser smoke образа e36e97e59 до переключения production
выявил `clmap` с полным URL, включая диагностические private query/hash.
Карта кликов отключена в общем adapter (`clickmap:false`); исходный production
остаётся healthy после отката первого кандидата. Regression сначала упал
(1 failed / 7 passed), после изменения 8/8 tests, scoped ESLint и Prettier
прошли через Docker Compose. Следующий кандидат проходит preview до rollout.


- [x] [BUG] Метрика продукта собрана на Mac, выложена и проверена.
  - Spec: meta/memory_bank/specs/work_items/2026-09-30__bugfix__yandex-metrica-production-audit.md
  - Owner: Codex
  - Done: 2026-10-01
  - Summary: source 041343b4b4f1a7587c94055d366e9e4ff22357d0, digest a22be5ea8e29d5f864d60fc32bbf6ca319acaa2bd0c1968acabbdc457630765b; guarded rollout и live privacy/consent/SPA/CTA/revoke прошли; кабинет подтвердил финальную кампанию (1 визит, 5 просмотров). SDD закрыт. PR #129 открыт, release draft; backend billing CI не собирается из-за отсутствующего langchain_community. Tilda/Chatra не изменялись.
