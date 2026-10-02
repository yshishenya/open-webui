# Повторная сквозная приёмка аналитики Airis

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: `codex/bugfix/analytics-report-cache-20261002`
- SDD Spec: `meta/sdd/specs/completed/airis-analytics-repeat-acceptance-2026-10-02-001.json`
- Created: 2026-10-02
- Updated: 2026-10-02

## Context and goal

Пользователь просит закончить план и перепроверить результат после изменения
умолчания аналитики. Проверить текущую техническую цепочку первого наблюдаемого
визита → регистрации → использования → подтверждённой оплаты/возврата,
сохранность отказов, доставки и отчётов. Опора — предыдущие спецификации
[полной воронки](2026-10-01__feature__full-funnel-analytics.md),
[default allow](2026-10-02__bugfix__analytics-default-allow.md) и
[отчёта платежных попыток](2026-10-02__docs__payment-funnel-release-acceptance.md).

## Acceptance criteria

- [x] AC01: текущий образ сохраняет проверенную сборку default allow и серверные модули аналитики; health и конфигурация назначений корректны.
- [x] AC02: новые посетители допускаются без клика; старый запрет, повреждённое/недоступное хранилище, незавершённый отзыв и несохранённый отказ блокируют сбор; сохранены проверенные регрессии.
- [x] AC03: серверная цепочка регистрации, полезного использования, оплаты и возврата проверена независимо; актуальные применимые CI успешны.
- [x] AC04: PostHog и Метрика подтверждают обработку контрольных событий, запросы панели исполняются; загрузка Метрики проверяется только GET, без дубля.
- [x] AC05: текущий административный отчёт проверен; анонимный/обычный пользователь не получает данные; вывод содержит только агрегаты и корректные зрелые знаменатели.
- [x] AC07: исправлен запрет кэширования административного ответа; регрессия красная до/зелёная после, CI и guarded rollout подтверждены.
- [x] AC06: итоги и границы доказательств сохранены, независимо просмотрены, опубликованы в PR к `airis_b2c`; текущая техническая приёмка отделена от настоящей покупки/возврата и будущих зрелых групп.

## Scope and upstream impact

Обнаружен live GET административного отчёта200 без Cache-Control. Добавляется
`Response` и `Cache-Control: no-store` в fork-owned router, как в существующем
отчёте писем, с проверкой7/30 через FastAPI. Нет новых зависимостей или схемы.
При выявлении ошибки — отдельная диагностика по bug_fix до изменения кода.
Исправление требует однофайлового backend-слоя поверх текущей рабочей основы,
backup, CAS, миграционного gate и HTTPS проверки после выкладки. Составной образ нельзя
выдавать за сборку всего репозитория из одного SHA.

## Verification

Сверка точных файлов работающего контейнера; GitHub CI и исходных регрессий;
readonly API/ORM/кабинеты провайдеров и административный интерфейс.
Контрольная загрузка `1211156457` не отправляется повторно. Настоящих новых
платежей, возвратов и фиктивных пользователей не создавать.

## Evidence

### Исходная сверка до исправления

- Integration3247cf4c04401dca922024b425bb580881de6b47; SDD36992459080,
  Migration36992459086, Security36992459157 successful. Default allow billing
  confidence36989527990 successful. Серверные модули финансовой цепочки не изменились.
- Production `email-groups-15aba5209-on-analytics-20261002`, image ID и registry
  digest `sha256:f715d5d6407497a8677c0e1a4b5560fafe974405b1a0524ac3699f41b7160ca2`.
  Health healthy/restarts0, migrationq1c020261002. Все938 compiled frontend файлов
  совпали с build23176a55c96f62a3191f2eb4afeac63097b6b465, девять backend-файлов
  аналитики совпали с исходниками. Составной образ сохраняет параллельные email changes.
- Контракт default allow и156frontend/6E2E регрессий проверен по неизменённым
  исходникам и предыдущей приёмке; в этом проходе эти наборы не запускались повторно.
- Live Метрика GET:1211156457 PROCESSED/linked_quantity1;
  report totals1visit/1goal, sampled=false. Никакого нового POST.
- PostHog Team2/dashboard3: все9Insight19–27 выполнены без ошибки; repeat filter
  `is_first_payment=[false]`; session recording выключен. В хранилище6first visits,
  4wallet views,2technical delivery checks. Это весь провайдерский диапазон, а не
  равенство текущему внутреннему журналу после отзывов/исторических проверок.
- Live внутренний журнал:2first visits/1wallet view;3PostHog deliveries delivered.
  HTTPS report7/30:admin200, anonymous/ordinary401, invalid window422. Только
  агрегаты, зрелый знаменатель0, conversion=null. Администратор проверен коротким
  токеном существующего аккаунта; права и данные не менялись. Повторный просмотр
  страницы в native browser после слоёв не подтверждён; техническая приёмка API
  не выдаётся за такой просмотр.
- YooKassa HTTP notifications: правильный URL; succeeded/waiting_for_capture/
  canceled/refund.succeeded сохранены. Реальной финансовой операции не было.
- Live `Cache-Control` отсутствовал. Регрессия на FastAPI200 упала `None != no-store`;
  после scoped Response header:5tests pass, Ruff/diffcheckpass. Выполнение Docker Compose.

### Исправление кэширования

- Runtime source `e007096adfcd552ac80ddb6919c80eba73c2c670`; PR HEAD
  `9eec5ea8252ad7560c173cede1ab337387b1fc39` сохраняет тот же router по байтам.
- Candidate `report-nostore-e007096ad-on-groups-20261002`, registry digest
  `sha256:a1a8d57f22e3fc85f5461919aaabbc932271369dc90042efad4097c576cc2fed`.
  Все97base layers сохранены; единственный COPY — fork-owned report router.
  Environment/Cmd/Entrypoint/WorkingDir/User/Volumes/Healthcheck совпадают с основой.
  Router SHA256 `5268b3412b6b9a0033d37c67369d339ec1fac1dae1042b7a47635ce608781426`.
- Frozen-image full backend:615passed/3PostgreSQL-only skips/26warnings. Первые
  попытки full collection остановились из-за неверных тестовых Fernet keys;
  исправлен только изолированный Compose environment, приложение не менялось.
- Предыдущая актуальная резервная копия email-groups полностью скопирована
  в приватный каталог Mac; размеры/SHA256/tar/pg_restore и повторный remote
  manifest сверены. Удалён только server-дубликат проверенного архива; dump/config
  сохранены. Свежая резервная копия
  `/opt/backups/airis/20261002T102700Z-report-nostore-e007096ad-on-groups-20261002`
  проверена, полностью скопирована в приватный Mac-каталог
  `/Users/yshishenya/.codex/private-artifacts/airis-report-nostore-backup-20261002/20261002T102700Z-report-nostore-e007096ad-on-groups-20261002`;
  сохранён rollback image. Удалён только проверенный server-дубликат data archive.
- GitHub CI для9eec5ea8252ad7560c173cede1ab337387b1fc39: backend36994686654,
  Billing36994686705, Migration36994686730, Security36994686664, SDD36994686667,
  backend/frontend lint successful. Billing summary проверен прямо:3/3suitespass,
  каждыйexit0. На финальном HEAD остаются проверки метаданных и аннотации теста.
- Guarded rollout завершён: новый registry digest совпал, hard Alembic gate
  прошёл, revisionq1c020261002 сохранён; healthy; environment, volumes, ports,
  command, networks и16соседних container IDs сохранены. Изменены только два
  image keys `.env` атомарной заменой после CAS; dirty server checkout не трогали.
- После выкладки8analytics modules совпали с frozen source, все938frontend
  compiled files снова совпали с23176a55c. Live HTTPS7/30: admin200/no-store,
  anonymous/member401; агрегаты совпали с независимым ORM расчётом, приватных
  идентификаторов нет, immature conversion=null; invalid window422.
- Native administrator browser UI после этих слоёв не проверен: доступная
  пользовательская сессия имеет обычные права. Права не повышались; подтверждён
  рабочий административный HTTPS API, а не личный просмотр страницы.

### Ограничения доказательств

Полная живая новая цепочка с настоящей покупкой/возвратом не выполнялась.
Данные30дневных новых групп ещё не накопились; это календарное ожидание,
а не готовая финальная конверсия. Метрика связывает офлайн события в21дневном
окне; отказавшиеся и блокируемые посетители не наблюдаются. Подробная причина
отмены платежа отсутствует в источнике. Общие известные typecheck/Ruff и
отсутствующий preflight имеют ранее согласованное исключение. Пилот продуктовых
писем — отдельный план; глобальное включение рассылки не входит в эту приёмку.

## Completion checklist

- [x] SDD check-complete / complete-spec.
- [x] Branch update Done; independent review complete; PR158 final integration tracked in GitHub.
