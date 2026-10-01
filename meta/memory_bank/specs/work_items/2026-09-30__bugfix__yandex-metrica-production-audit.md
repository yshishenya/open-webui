# Восстановление Яндекс Метрики продукта chat.airis.you

## Meta

- Type: bugfix
- Status: completed
- Owner: Codex
- Branch: codex/bugfix/metrica-audit-20260930
- SDD Spec: meta/sdd/specs/completed/yandex-metrica-production-audit-2026-09-30-001.json
- Created: 2026-09-30
- Updated: 2026-09-30

## Context

Пользователь видит пустую статистику при реальной активности. Задача включает
только продукт `chat.airis.you`: сборку на Mac, публикацию готового образа,
защищённую выкладку и проверку Метрики. Tilda, `airis.you` и Chatra исключены.
Ниже сохранены исторические результаты исходного аудита.

## Goal / Acceptance Criteria

- [x] Проверить подключение на обоих опубликованных сайтах по публичным ресурсам.
- [x] Проверить сборку, согласие, просмотры, цели и ecommerce в коде по документации.
- [x] Подготовить минимальное исправление подтверждённых ошибок и регрессионную проверку.
- [x] Сохранить evidence, ограничения проверки и инструкции по настройке.
- [x] Выложить продукт и проверить live отправку; подтвердить финальную кампанию в кабинете.
- Tilda исключена пользователем из оставшейся работы; её публикация не входит в acceptance criteria.

## Findings

- Лендинг работает на Tilda (заголовки `x-tilda-server`, `x-tilda-imprint`), а не
  на Svelte-странице `/welcome`. HTML содержит Tilda stats, но не Метрику или GTM.
- Публичный `https://chat.airis.you/_app/env.js` и файл внутри работающего образа
  содержат пустые `PUBLIC_YANDEX_METRICA_ID` и `PUBLIC_GA_MEASUREMENT_ID`.
  Пустой ID отключает `initializeYandex`; consent не может исправить отсутствие ID.
- `adapter-static` публикует env.js при сборке. Dockerfile и Compose имеют build
  args; GitHub Actions Docker workflow передаёт только BUILD_HASH и variant args.
- `init` без `defer` отправляет автоматический просмотр; затем adapter вызывает
  ручной `hit`. Это даёт дубли первого просмотра и может передать исходный query.
- Исторический work item `2026-08-07__feature__privacy-safe-web-analytics.md`
  содержит запись о созданном счётчике и его целях. Текущий доступ к кабинету
  Яндекса/Tilda не предоставлен; настройки, ID и фактические отчёты требуют
  повторной проверки в кабинете, историческая запись не является live evidence.

## Scope

- Передать публичные measurement IDs из repository variables в Docker build CI.
- Отключить автоматический initial hit (`defer: true`) в общем adapter.
- Сохранить разрешённые campaign query в ручном hit; убрать приватные query/hash.
- Отключить Webvisor и автоматические внешние links в продукте, исключить hash-дубли.
- Добавить тест точного initial hit без query и сохранившегося consent gate.
- Написать руководство по build/runtime, Tilda и проверке настроек/воронки.
- Новых зависимостей и изменений backend/БД нет.

## Upstream impact

- `.github/workflows/docker.yaml`: две строки build args; точка сборки frontend.
- `src/lib/utils/analytics.ts`: одна опция init; общий adapter уже существует.
- Остальные изменения: тест и fork-owned документация.
- `src/lib/components/analytics/AnalyticsBootstrap.svelte`: одна строка dedup key
  для исключения anchor-переходов; это существующий Airis component.

## Verification

- Read-only HTTPS: HTML и headers обоих доменов, product env.js.
- Read-only Docker: image tag, env.js, compiled adapter; без данных пользователей.
- Docker Compose в отдельном project `airis-metrica-audit`: scoped Vitest,
  frontend lint/typecheck; форматирование только затронутых файлов.
- Не отправлять искусственные цели и покупки в production.

### Результаты

- Регрессионный тест до исправления: 1 failed / 6 passed (нет `defer: true`).
- После исправления и regression проверки campaign redirect: 8/8 tests passed в `analytics.test.ts` и `analyticsConsent.test.ts`.
- Scoped ESLint, Prettier для всех изменённых TS/Svelte и `git diff --check`: passed.
- CI YAML parsed через js-yaml; оба measurement build args присутствуют.
- Prettier всего `.github/workflows/docker.yaml`: failed; исходная версия HEAD
  также не проходит. Файл не переформатирован, diff ограничен двумя строками.
- Полный `npm run check`: failed, 8363 errors / 226 warnings в 350 файлах;
  диагностик для изменённых analytics файлов нет. Это не full-green validation.
- Backend/БД не изменены, backend tests не запускались. Browser baseline обоих сайтов выполнен:
  тега/запросов нет даже при granted consent продукта. Network delivery нового
  образа ещё не проверена: сборка и публикация не завершены.
- Во время full typecheck обнаружено высокое потребление RAM; две последующие bounded
  frontend build попытки на сервере завершились OOM (exit 134 / 137). После нагрузки
  `/health` отвечает успешно, Docker health healthy. Деплой вручную не запускался.

## Guide

`meta/memory_bank/guides/yandex_metrica.md`: evidence, build-time ID, Tilda,
общие домены, consent, privacy, цели, ecommerce, ограничения атрибуции и
приоритеты донастройки со ссылками на официальную документацию.

## Исторические ограничения до локальной сборки

Production rebuild/deploy и Tilda publish ещё не выполнены. Для завершения live
настройки нужны подтверждённый счётчик, доступ к настройкам Яндекса и Tilda,
repository variable и публикация образа с заполненным ID. Guide фиксирует точный
порядок. Откат: revert patch и пересборка; согласие остаётся обязательным.

## Уточнение сборки и rollout — 2026-09-30

- Пользователь требует собирать на своём компьютере, выкатывать готовый Docker-образ.
  После уточнения серверные сборки не запускались. Временный swap отключён и удалён.
- Production не переключался: image `a78b95932936c97651baefe9955f7b8dfdb42d86`,
  digest `sha256:67360084aec6e582998835285b68704af278dd1c165886f6f56f3697882558c7`,
  Docker healthy, публичный `/health` возвращает `{"status":true}`.
- Код исправлений: `a5ccb3c8717a05ab7fd1409e7e74209715f7729d`, pushed.
- Локальный проект найден через app: `/Users/yshishenya/Documents/projects/open-webui`;
  инструменты этого чата исполняют команды только на remote host AIris. Нет
  callable local executor/handoff. Доступ к Tilda/Метрике также отсутствует.
- В `deploy/targets/prod.env.example` предусмотрен счётчик 111392024. Management
  API без авторизации отвечает 401; настройки и отчёты не проверены.
- `meta/docs/releases/metrica-local-build.md` содержит команды локальной сборки
  существующего frontend stage и overlay над immutable production backend,
  архитектуру linux/amd64, проверки compiled ID и порядок guarded rollout.
  Команды проверены синтаксически; локальная сборка ещё не исполнялась.
- `meta/docs/releases/v2026.09.30.1.md` — черновик release notes, не опубликованный
  релиз. Tag, GitHub Release, PR, image push и rollout ещё не выполнены.
- Дополнительно найден сломанный inline Chatra script в Tilda: инструкция
  исправления в guide, опубликованный лендинг пока не изменён.
- Live task остаётся pending; SDD не закрывать до rollout и provider evidence.

## Последнее уточнение scope и передача в локальный проект

Пользователь исключил Tilda из задачи и поручил создать чат в open-webui_local
с полной передачей контекста для локальной сборки и Docker rollout продукта.
Tilda findings остаются историей аудита; не изменять её страницы, настройки,
Chatra и цели. Отсутствие доступа к Tilda не блокирует product rollout.

Полная задача: `meta/docs/releases/metrica-local-task.md`. Локальный projectId
подтверждён через app. Инструменты create_thread/handoff_thread/send_message_to_thread
не предоставлены этой сессии: чат не создан и задача не запущена. Сборка, публикация
и rollout также остаются pending.

## Локальное продолжение — 2026-09-30

- Worktree: `/Users/yshishenya/Documents/projects/open-webui-metrica`; исходный грязный checkout сохранён.
- Runtime source `a5ccb3c8717a05ab7fd1409e7e74209715f7729d`: между ним и текущей веткой нет изменений frontend/build inputs.
- Frontend stage успешно собран на Mac: compiled ID `111392024`, version marker равен полному source SHA; build размер 186 MiB.
- Повторные focused Vitest: 8/8 passed; scoped ESLint passed; Docker Compose повторяет проверку в собранном frontend image.
- GitHub repository variable `PUBLIC_YANDEX_METRICA_ID=111392024` задана и перечитана.
- Кабинет доступен: Airis — chat.airis.you, ID 111392024; адрес `chat.airis.you`, только указанный домен, без поддоменов.
- Фильтр: оставить URL сайта и дополнительных адресов. IP-фильтров нет; собственные визиты не исключены, фильтрация роботов по поведению выключена.
- Ecommerce включён, контейнер `dataLayer`. Основные цели существуют по исходным событиям: CTA, signup started/completed, login, first prompt/response, topup created/completed, onboarding. Код отправляет исходные события и aliases; дубли целей не создавались.
- Добавлена недостающая цель `lead_signup_form_viewed`, ID 666115354, название «Просмотр формы регистрации».
- Production env/config comparison: нет различий ключей окружения; stale image tag в .env не равен running image. Rollback использует running image.
- Disk calculation: 6.4 GiB available; app data 1.55 GiB (верхняя оценка backup), existing build 186 MiB; frontend-only layer около 186 MiB, backend layers уже на сервере. MIN_FREE_GB=5 для этой выкладки обоснован резервом более 3 GiB после backup/layer; gate остаётся включён. Чужие ресурсы не удаляются.
- Пользователь разрешил PR с отсутствующей `npm run preflight` и известными ошибками полного typecheck; ограничения перечислить явно.

### Browser выявил дополнительный дефект; выполнен откат

Первый candidate опубликован и прошёл backup/migration/health, но network smoke
нашёл приватный query в init settings request (`nohit`), включая redirect /watch/ID/1.
`defer` отключает просмотр, но не служебную доставку URL. Выполнен service-only
rollback на сохранённый baseline; контейнер healthy, исходный backend сохранён.
В общем initializeYandex добавлены безопасные `url`/`referrer`, использующие те же
правила, что явный hit. Regression на init URL упал до исправления (1 failed/5 passed),
после — 8/8 analytics/consent и scoped ESLint passed. При подсчёте PageView нужно
отличать nohit settings и их HTTP redirect от просмотра с browser-info pv:1.


### Дополнительная проверка карты кликов на Mac

Предварительный browser smoke образа e36e97e59 до переключения production
выявил `clmap` с полным URL, включая диагностические private query/hash.
Карта кликов отключена в общем adapter (`clickmap:false`); исходный production
остаётся healthy после отката первого кандидата. Regression сначала упал
(1 failed / 7 passed), после изменения 8/8 tests, scoped ESLint и Prettier
прошли через Docker Compose. Следующий кандидат проходит preview до rollout.


## Итоговая проверка — 2026-10-01 (UTC 2026-09-30)

- Frontend собран на Mac из `041343b4b4f1a7587c94055d366e9e4ff22357d0`.
- `linux/amd64` образ `yshishenya/yshishenya:041343b4b-metrica-20260930`,
  digest `sha256:a22be5ea8e29d5f864d60fc32bbf6ca319acaa2bd0c1968acabbdc457630765b`.
  Backend base, все его слои, Env и Cmd сохранены.
- Guarded service-only rollout завершён после fresh backup, checksum/tar/pg_restore
  и hard Alembic gates; revision `b4c5d6e7f8a9` не изменилась.
  Backup `/opt/backups/airis/20260930T210510Z-041343b4b-metrica-20260930`;
  предыдущий образ сохранён для отката. Порог диска 4 GiB обоснован: перед gate
  около 4.5 GiB, backup около 1.5 GiB, после rollout около 3.1 GiB.
- Public env.js ID 111392024 и version.json exact source SHA подтверждены.
  Docker healthy, restart 0, health true. В `.env` изменён только image tag
  в двух существующих строках, приватная копия сохранена; Compose/running env
  совпадают, том `open-webui_airis` сохранён.
- Строгие preview и live browser проверки прошли: consent, один initial hit,
  UTM, anchor dedup, SPA, CTA, только campaign query во всех просмотрах,
  отсутствие private query/hash во всех provider requests, отсутствие
  clmap/webvisor, provider 200, revoke+reload+no delivery+attribution cleared.
- Кабинет ID/domain/IP/robot filters/ecommerce сверены. Создана только цель
  `lead_signup_form_viewed` (666115354). В отчёте финальной live-кампании
  `rollout_20260930_live_v3` — 1 визит, 5 просмотров, 1 посетитель, 26 секунд.
  CTA и просмотр формы также имеют достижения в отчёте конверсий.
- В браузере пользователя восстановлен исходный отказ: UI подтверждает
  «Сейчас аналитика запрещена». Фиктивных пользователей и покупок не создавали.
- PR https://github.com/yshishenya/open-webui/pull/129 открыт на `airis_b2c`.
  Source-SHA CI lint/migration/SDD/CodeQL/gitleaks прошёл; billing-confidence
  имеет ошибку collection backend: отсутствует `langchain_community`.
  Frontend billing 11/11 и e2e billing 10/10 прошли. Полный typecheck и
  отсутствие preflight остаются согласованными ограничениями.
- GitHub Release v2026.09.30.1 создан как draft до устранения CI/слияния:
  https://github.com/yshishenya/open-webui/releases
- SDD live task completed, check-complete и complete-spec успешно выполнены.
  Слияние PR и публикация release остаются pending; техническая выкладка
  и проверка Метрики завершены. Tilda/airis.you/Chatra не изменялись.
