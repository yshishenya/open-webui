# Задача для open-webui_local: собрать, выкатить и проверить Метрику продукта

## Запрос и полномочия пользователя

Восстановить сбор Яндекс Метрики в `https://chat.airis.you`, донастроить продукт,
собрать на компьютере пользователя и выкатить готовый Docker-образ на production.
Пользователь уже разрешил сборку, публикацию и выкладку; не запрашивать повторно
разрешение на эти шаги. Последнее уточнение: **Tilda не трогаем**. Не менять
`airis.you`, Tilda, её Метрику или Chatra. Наличие отдельного лендинга без Метрики
не блокирует восстановление продукта. Пользователь поручил создать этот локальный
чат и передать всю информацию. Серверный чат не имеет инструментов create_thread,
handoff_thread или send_message_to_thread; этот файл — подготовленная передача,
а не подтверждение создания/запуска локального чата.

Локальный проект: `open-webui_local`,
`/Users/yshishenya/Documents/projects/open-webui`;
app projectId `bf5a88e2-3c41-4724-85ab-5ca87331e1c8`, hostId `local`.

## Что делать

1. Прочитать обязательные project instructions/Memory Bank. Проверить локальный
   Git status и Docker Desktop. Сохранить чужие изменения, не делать reset/clean.
   Получить актуальную ветку и использовать отдельный worktree или archive context.
2. Собрать frontend **на Mac**, опубликовать production образ `linux/amd64`.
   Готовые команды: `meta/docs/releases/metrica-local-build.md`.
   Backend взять из точного текущего production digest; backend/БД не меняются.
   Не использовать `.svelte-kit` или `build` от неуспешных серверных сборок.
3. Проверить compiled env.js (ID 111392024), revision/version marker,
   архитектуру и registry digest. Код уже проверен scoped тестами; выполнять
   дополнительные проверки по изменению и результату сборки.
4. По локальному SSH config определить доступ к production (`AIris` — имя remote
   connection в приложении; actual SSH alias может отличаться). Перед переключением
   сверить реально запущенный image и env/config, пройти backup/migration/disk
   gates и обеспечить rollback. На сервере только pull/import и Compose rollout,
   никакого build. Пересоздать только `airis` с `--no-build --no-deps`.
5. Проверить публичный env.js, healthy, /health, браузерный consent, доставку
   PageView и SPA переходов, приватность, цели CTA и отзыв согласия. Не создавать
   фиктивные production пользователей или покупки ради тестов.
6. Если есть авторизованный доступ к кабинету Метрики, сверить ID, адрес продукта,
   domain/IP/robot filters, цели и ecommerce; проверить появление визита в отчёте.
   Если доступа нет, всё равно завершить доступные build/deploy/network проверки
   и отдельно указать, что отчёт кабинета не проверен. Не запрашивать пароль/токен
   в сообщении. OAuth secret для login не является Management API token.
7. Обновить work item, branch_updates и SDD на своей ветке. Не редактировать
   current_tasks.md вне integration branch. Не закрывать live task без evidence.
   Выполнить project PR/release workflow, если доступен GitHub API. GitHub тексты
   на русском, PR base `airis_b2c`; продукт использует CalVer. Release notes пока
   черновик `meta/docs/releases/v2026.09.30.1.md`, окончательную версию проверить.

## Git и документы

- Серверный актуальный worktree: `/opt/projects/airis-metrica-audit`.
- Ветка: `codex/bugfix/metrica-audit-20260930`, pushed в `yshishenya/open-webui`.
- База: `a78b95932936c97651baefe9955f7b8dfdb42d86` (integration `airis_b2c`).
- Код исправлений: `a5ccb3c8717a05ab7fd1409e7e74209715f7729d`.
- Документы локальной сборки: `9cd97580801eab29ebf3c81cadead01f5e5fde4d`;
  этот task и уточнение scope находятся в последующем commit ветки.
- Work item:
  `meta/memory_bank/specs/work_items/2026-09-30__bugfix__yandex-metrica-production-audit.md`.
- Guide: `meta/memory_bank/guides/yandex_metrica.md`.
- Branch log:
  `meta/memory_bank/branch_updates/2026-09-30-codex-bugfix-metrica-audit-20260930.md`.
- SDD: `meta/sdd/specs/active/yandex-metrica-production-audit-2026-09-30-001.json`,
  2/3 задач завершены; третья live task pending. Старые ссылки на публикацию Tilda
  считать историей: последнее указание пользователя исключает её из scope.
- `/opt/projects/open-webui` на сервере — старый checkout с чужими изменениями;
  не сбрасывать, не делать git pull без оценки конфликтов, не копировать туда build.

## Причины и исправления

Production env.js и `/app/build/_app/env.js` имеют пустой measurement ID.
SvelteKit `adapter-static` фиксирует `$env/dynamic/public` при сборке, runtime
env/рестарт не помогут. ID 111392024 предусмотрен `deploy/targets/prod.env.example`
и историческими work items; кабинеты пока не доступны, API без auth даёт 401.

Исправлены `.github/workflows/docker.yaml`, `src/lib/utils/analytics.ts`,
`src/lib/components/analytics/AnalyticsBootstrap.svelte` и analytics tests:

- CI передаёт `PUBLIC_YANDEX_METRICA_ID` и `PUBLIC_GA_MEASUREMENT_ID` из vars.
- init: `defer:true`, `sendTitle:false`, `webvisor:false`, `trackLinks:false`,
  `trackHash:false`; один явный hit вместо automatic+manual duplicate.
- Только разрешённые campaign query; приватные query/hash исключены.
- Campaign сохранён в памяти до consent через ранние redirects, persistence
  начинается после согласия. Реферер очищен от query/hash.
- Дедупликация просмотров по pathname, anchor transitions не дают PageView.

8/8 focused Vitest tests, scoped ESLint, TS/Svelte Prettier и diff-check passed
через Docker Compose. Regression первоначально падал до исправления.
Полный `npm run check` failed: 8363 errors / 226 warnings в 350 файлах;
диагностик в изменённых analytics files нет. Не объявлять full-green validation.
CI YAML parsed; full workflow Prettier также failing на исходном HEAD.
Backend/БД не менялись, backend tests не запускались.

## Production snapshot и ресурсы

Состояние перед передачей: контейнер `airis`, healthy, restart count 1,
image `yshishenya/yshishenya:a78b95932936c97651baefe9955f7b8dfdb42d86`,
digest `sha256:67360084aec6e582998835285b68704af278dd1c165886f6f56f3697882558c7`.
`https://chat.airis.you/health` → `{"status":true}`. Новая выкладка не выполнена,
готового нового образа нет. Обязательно повторно сверить перед rollout.

- Data volume `open-webui_airis`, mount `/app/backend/data`, размер около 1.6 GB.
- PostgreSQL около 75 MB, host port3000 → container8080.
- `.env` сервера содержит stale image tag `mail-deliverability-20260815-v3`;
  для rollback ориентироваться на реально запущенный image, не этот tag.
- Compose env совпадал с running env; image ref mismatch был единственным отличием.
- Свободно около 7.3 GB; guarded deploy floor по умолчанию 10 GB. Не отключать
  gate молча. Удалять только собственные временные ресурсы или обосновать настройку
  floor после расчёта image/backup capacity; чужие volumes/images не удалять.
- Две серверные build попытки упали OOM (134/137); после local-build требования
  серверные сборки не запускались. Temporary swap отключён и файл удалён.
- Собственный volume `airis-metrica-audit_airis-frontend-node-modules`, browser image
  `mcr.microsoft.com/playwright:v1.62.1-jammy`. В worktree есть ignored partial build,
  `.metrica-build.log`, copied `static/pyodide`; это не готовые deploy артефакты.
- Docker Hub credentials есть на сервере, доступ на Mac надо проверить отдельно.
- SSH Git deploy key позволяет push; серверный GitHub API/gh auth отсутствует.

## Rollout и browser smoke

Штатные скрипты: `scripts/deploy_guarded.sh`, `scripts/deploy_prod.sh`,
`scripts/deploy_target.sh`; docs `docs/DEPLOY_PROD.md`.
`deploy_prod.sh` выполняет local build/push, но его unguarded rollout заменять
guarded этапом. `.env.deploy.prod` на сервере отсутствует; локальные настройки
могут существовать. У guarded script заранее проверить service-only rollout:
не применять `--remove-orphans` ко всем работающим сервисам.

На сервере подготовлены (не запускались) `/tmp/airis-metrica-rollout/Dockerfile`
и `/tmp/airis-metrica-rollout/guarded-local.sh` (REMOTE часть guarded script,
service-only `--no-deps`). Проверить их перед использованием.

Готовый Playwright smoke `/tmp/airis-metrica-rollout/browser.cjs` запускается
без сборки на сервере после rollout:

```bash
docker run --rm --memory=700m --memory-swap=700m --cpus=1 --network host \
  -v /tmp/airis-metrica-rollout:/audit \
  -v /opt/projects/airis-metrica-audit:/work \
  -v airis-metrica-audit_airis-frontend-node-modules:/work/node_modules \
  -w /work mcr.microsoft.com/playwright:v1.62.1-jammy \
  node /audit/browser.cjs after
```

Baseline продукта уже проверен: даже после разрешения нет тега/запросов.
Mode after ещё не исполнялся: проверяет отсутствие provider до consent, один
tag после, один initial watch, сохранение diagnostic UTM, отсутствие private query,
response200 и пишет screenshot `/tmp/airis-metrica-rollout/product-after.png`.
Дополнить SPA transitions/CTA/consent revoke, в том числе проверку содержимого
payload на приватные данные. Response200 не равен подтверждённому отчёту:
provider filters могут исключать диагностический визит; обычные отчёты ~10–15min.

Цели уже есть в коде: landing_cta_click (внутренний /welcome),
lead_signup_form_viewed/started/completed, activation_first_prompt/response,
billing_topup_payment_created, revenue_topup_completed, onboarding_completed.
Проверять существующие перед созданием; first activation — sessionStorage,
не lifetime unique. Revenue зависит от consent/blockers/возврата после платежа.
Полный server-side revenue — отдельная задача, не расширять этот bugfix.

Официальная документация и выводы приведены в guide. При необходимости curl к
yandex.ru запускать с `--noproxy '*'` (proxy раньше давал SSL error). Tilda в
оставшихся документах — исторические findings; её не менять.
