# Повторное восстановление ID Метрики без замены текущего интерфейса

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/metrica-runtime-env-20261004
- SDD Spec: meta/sdd/specs/completed/airis-metrica-env-recovery-2026-10-04-001.json
- Created: 2026-10-04
- Updated: 2026-10-04

## Context

Прочитан чат «Восстановить Метрику продукта»: прежние исправления, default allow,
серверная воронка и отчёты завершены и объединены. Документ metrica-local-task.md
от 30 сентября является историей. Актуальная integration:
`cd41a2603516c3fe4e84dfe6c074dbfdba306653`; frontend production:
`90674f905141b76ce129387ce98dbdb7b56fede8`. Исходники frontend одинаковы.

Production image `mail-admin-90674f905-on-mail-observer-20261004`, registry digest
`sha256:9b102cb8cf8caa55f1b82eb527488f60d924a0d2e77fe7ff207658f10cc65f3f`.
После этой frontend-сборки env.js содержит только PUBLIC_OPEN_WEBUI_API_PORT=8081.
В чистом браузере consent=null, уведомление говорит о сборе по умолчанию,
но тег Метрики отсутствует и запросов к провайдеру нет. Старую сборку не выкатывать.

## Goal / Acceptance Criteria

- [x] Прочитать предыдущий чат, актуальную integration, воспроизвести сбой.
- [x] Собрать на Mac linux/amd64 поверх точного текущего digest; заменить только env.js.
- [x] Сверить все frontend/backend файлы, слои, runtime configuration и версии.
- [x] Пройти backup/checksum/disk/migration/CAS/rollback gates, пересоздать только airis.
- [x] Подтвердить default allow, один initial hit, SPA, CTA, безопасный payload и запрет.
- [x] Проверить доступные provider reports; явно указать ограничения настоящих оплат.

## Scope / Upstream impact

Runtime: добавить PUBLIC_YANDEX_METRICA_ID=111392024 в существующий env.js,
сохранив все его прежние значения; backend, остальные compiled assets и version.json
не заменять. Образ составной; общий source SHA не доказывает его серверную часть.
Новых зависимостей и миграций нет. Tilda, airis.you, Chatra исключены.

Deployment: отдельная короткая проверка compiled env.js и тонкий вызов из
scripts/deploy_guarded.sh перед миграцией; настроенный текущий счётчик должен
присутствовать в кандидате. Это предотвращает повторную потерю ID при выкладке.
Все альтернативные операционные выкладки также должны запускать эту проверку.

## Verification / Rollback

Один runnable check: scripts/check_metrica_image.sh IMAGE 111392024.
Текущий образ должен его провалить, исправленный — пройти.
Браузерная проверка выполняется на актуальном сайте и isolated env.js preview.
Ни фиктивных пользователей, ни покупок, ни повторных upload конверсий не создавать.
Rollback — фактически текущий image с сохранёнными Compose/env; CAS перед переключением.
Запретить сборку на сервере, удаление чужих ресурсов и изменение незакоммиченных файлов.

## Evidence

### Сборка и изолированная проверка

- Образ собран 04.10.2026 на Mac через Docker Desktop, linux/amd64:
  `yshishenya/yshishenya:metrica-env-on-mail-admin-20261004`.
  Registry digest `sha256:1a013df1a42d245d54f84f9af510d6a4a4142c3ae5477f395fe0d515810e3653`.
- SHA256 всех 4904 файлов `/app/build` сверены. Состав совпадает; изменён только
  `_app/env.js`. `_app/version.json` сохраняет `90674f905141b76ce129387ce98dbdb7b56fede8`.
  Сохранены все исходные слои, прежние labels и Config; добавлен один COPY-слой.
- Runnable check отвергает исходный образ и неправильный ID; кандидат 111392024 проходит.
  `bash -n` и `git diff --check` пройдены. SDD0 errors / 0 warnings.
- Playwright1.62.1 в готовом browser Docker на production-host выполнил preview
  с подменой только env.js: default allow без записанного выбора,1 initial hit,
  Metrica ClientID, UTM,anchor dedup, SPA, CTA, private query/hash exclusion, revoke,
  сохранение запрета после reload. Все11 checks passed; provider watch 200.
  Установка browser tooling выполнена на Mac; на сервер переданы готовыеJS-пакеты.
- Авторизованный API Метрики подтвердил ID 111392024, site chat.airis.you, Active,
  существующие цели и ecommerce: dataLayer. Активный фильтр only_mirrors/include;
  preview-кампания `runtime_env_preview_20261004`: 1 visit / 5 pageviews, без sampling.
  Настройки code generator visor/clickmap остаются прежними; продукт передаёт
  явные `webvisor:false`, `clickmap:false`,что проверено по сетевым запросам.
- Backend и frontend исходники продукта не изменены; их полные наборы не
  перезапускались. Общий долг проверок типов/ESLint из текущей приёмки и
  отсутствие `npm run preflight` сохраняются; scoped verification относится
  к env-only образу и операционной проверке,не означает full-green приложения.

### Воспроизводимость

Взять текущий base digest из Context,извлечь `/app/build/_app/env.js` через
`docker create`/`docker cp`,сохранить все ключи и добавить 111392024.
Dockerfile содержит `FROM yshishenya/yshishenya@sha256:9b102cb8cf8caa55f1b82eb527488f60d924a0d2e77fe7ff207658f10cc65f3f`
и `COPY env.js /app/build/_app/env.js`; собрать на Mac `--platform linux/amd64`.
Проверить данным scripts/check_metrica_image.sh и сверить manifest всех файлов.
Любая новая frontend-сборка должна передавать PUBLIC_YANDEX_METRICA_ID=111392024
и пройти эту проверку до смены production. Runtime env/рестарт не заменяют compiled ID.


### Production rollout — 04.10.2026

- Guarded rollout завершён. Сервер только pulled готовый image; сборка на сервере
  не запускалась. Пересоздан только `airis` с `--no-build --no-deps`.
- Backup: `/opt/backups/airis/20261003T215530Z-metrica-env-on-mail-admin-20261004`;
  PostgreSQL dump, globals и data archive проверены SHA256, pg_restore listing и tar.
  Gate 10 GiB пройден после backup и pull; осталось около 10.3 GiB.
  Rollback tag `airis:rollback-20261003T215530Z-metrica-env-on-mail-admin-20261004` сохранён.
- Hard Alembic gate выполнен; head `o1a020261003` не изменился. CAS перед заменой
  подтвердил исходный image и контейнер, hashes среды и Compose.
- Новый образ имеет опубликованный digest `1a013df1…`, healthy, restart count 0;
  HTTPS `/health`200/{status:true}. Новый image сохранён в серверном `.env`.
- Все 4904 работающих frontend файлов побайтно совпали с локальным candidate manifest.
  Среда, том, порты, сети, команда, restart policy и 14 соседних контейнеров совпали
  с исходным snapshot. Нет изменения backend или исторической frontend-версии.
- Live Playwright без route-подмены прошёл все 11 сценариев. Provider tag и watch 200,
  ClientID доступен; запрет очищает атрибуцию и блокирует доставку после reload.
  Кампания `runtime_env_live_20261004`: авторизованный отчёт Метрики подтвердил
  1 визит и 5 просмотров; `sampled:false`. Подтверждено появление данных после live-выкладки.

### Границы

Исторический платёж без ClientID автоматически не объявляется восстановленным:
для его привязки нужен действительный браузерный идентификатор того пользователя.
Покупки/возвраты, создание аккаунтов и повторные upload конверсий не выполнялись.
Рабочий исходный каталог и соседние worktrees не редактировались; чужие изменения
сохранены. Новая защитная проверка будет доступна в integration после слияния PR;
в этой production-выкладке она уже выполнена до миграционного gate.
