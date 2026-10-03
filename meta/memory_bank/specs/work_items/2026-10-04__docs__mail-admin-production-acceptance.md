# AIRIS — приёмка административной диагностики почты

Тип: документация выпуска. Статус: принято 04.10.2026. Ветка: codex/docs/mail-admin-production-acceptance, от airis_b2c после PR207. Процесс: new_feature/code_review. Реализация и завершённая SDD: [рабочая спецификация](2026-10-03__feature__mail-observation-admin-controls.md), [SDD](../../../sdd/specs/completed/airis-mail-observation-admin-2026-10-03-001.json).

## Идентичность и предел результата

- [x] PR207: https://github.com/yshishenya/open-webui/pull/207; source `90674f905141b76ce129387ce98dbdb7b56fede8`; merge `cd41a2603516c3fe4e84dfe6c074dbfdba306653`.
- [x] Образ `yshishenya/yshishenya:mail-admin-90674f905-on-mail-observer-20261004`; registry digest `sha256:9b102cb8cf8caa55f1b82eb527488f60d924a0d2e77fe7ff207658f10cc65f3f`; linux/amd64, 8 слоёв.
- [x] public `/_app/version.json` содержит полный source SHA; health200/status=true; production healthy/restarts0.
- [x] Изолированный кандидат и рабочий сервер проверены отдельно. Диагностические группы не являются добровольным пилотом и не дают знаменатель рассылки.

## Проверки source и образа

- [x] Точный образ: полный backend 810passed/4PostgreSQL-only skips/ 25 warnings; отдельный PostgreSQL 97passed/ 4 warnings. PostgreSQL выполнялся в изолированной БД, без тестовых удалений в production.
- [x] Frontend 251passed/ 51 files, целевые15включены. Проверены создание/повтор/busy/потеряответа/последовательныестраницы/закрытие и существующие пользовательские пути.
- [x] Black10файлов без изменений; Ruff0ошибок; целевой ESLint0ошибок. Общий frontend-долг 4419errors/ 177 warnings по типам и1540ESLint errors сохраняется; G14не закрыт.
- [x]14CIточногоsource:13success,1dependency-review skipped. CodeRabbit: `Review skipped: reviews are disabled for this base branch`. Это не независимый обзор.
- [x] Кандидат через настоящий HTTP:31обычныйучастник,25+6 страниц,186сценариев, все6 маршрутов401/no-store дляanonymous/ordinary, replay/conflict/cursor/closure и безопасная422ошибка.
- [x] Кандидат через браузер: группа1участник/6сценариев, проход завершён, закрытие сохранено,0consoleerrors. Сегодняшняя регистрация включается за счёт верхней границы min(end-of-day,now).
- [x]4904 frontendхеша совпали с рабочим образом; из старых5759файлов отсутствуют только855source maps, потерянных статических ресурсов0.489 immutable backendхешей совпали; изменяемый site.webmanifest совпадает с проверенным frontendstatic.

## Защищённый выпуск и сохранность

- [x] Предыдущий процесс остановился после создания резервной копии до миграции и замены контейнера. Подтверждены отсутствие живого процесса, старыйimage/container, прежнийAlembichead и неизменные настройки; повторного выпуска вслепую не было.
- [x] Копия `/opt/backups/airis/20261003T213555Z-mail-admin-90674f905-on-mail-observer-20261004` повторно проверена поSHA256; tarчитается, pg_restore--list успешен. Выпуск продолжен с этого проверенного шага.
- [x] HardAlembicgate прошёл, head `o1a020261003`. Все77старыхсхем неизменны; добавлена только пустая commandtable.
- [x] До диагностического примера сохранены отпечатки всех прежних5таблиц журнала, включая870 наблюдений/870 событий.
- [x] До и после примера совпадают все sourcefingerprints:36Payment,5827LedgerEntry,0EmailDelivery,2EmailPreference,9EmailPreferenceEvent,0unsubscribetokens.
- [x] Старое подмножество журнала после новой группы побайтно совпадает с исходным:1scope/139 members/2runs/870observations/870events.
- [x] Все14соседнихID,ENV,тома,сети,порты,команды иrestartpolicy сохранены. `.env` изменён только вimageselector. Свободно 12,349,784KiB после выпуска.
- [x] queue=false,releaseA/B=false,dry_run=true,pilot_only=true,pilotIDsпусты; Reply-To support@airis.you, From yan@airis.you.

## Настоящий API и браузер production

- [x] Новая явно диагностическая группа139 обычных участников; два завершённых прохода по6страниц/870сценариев,0потерянныхисточников.
- [x] Повтор declaration возвращает ту же группу; повтор start и completedstart тот жеrun; повторclosure сохраняет первоначальный результат. Всего3commandreceipts,2новыхruns; второй проход не добавил одинаковых событий.
- [x] Новая группа закрыта; старыйGETнеизменен. Общие итоги2scope/278member/4run/1740observations/1740events/3commands.
- [x] Каждый из6 маршрутов проверен дляanonymous иordinary:12ответов401/no-store. Административные успешные ответы такжеno-store.
- [x] Обычный вошедший аккаунт открывает кошелёк из руководства; баланс0, суммы500/1000/2000, бесплатные операции и лимит видны. Покупка не выполнялась. Публичные guide, видео, текст и version доступны. Прямой переход обычного пользователя в /admin/analytics вернул его в чат; ошибок консоли 0.
- [x] Диагностика не вызывалаSMTP/dispatch и не писала деньги/согласия/очередь. Существующая авторизация может обновлять last_active_at администратора/проверочного пользователя; это не изменение роли/адреса/подтверждения/согласия.0DML заявляется только для отдельного readonlyprobe.

## Поддержка, остановка, откат и доказательства

- [x] [Инструкция администратора](../../guides/email_observation_journal.md): последовательно продолжать страницы, после неопределённого ответа перечитатьcursor, сохранитьключповтора, дождаться180секунд приживойчужойаренде, закрыватьгруппуссохранениемистории.
- [x] Откат только контейнера на `airis:rollback-20261003T213555Z-mail-admin-90674f905-on-mail-observer-20261004`, прежние3 Composeфайла; проверитьhealth и неизменность настроек перед сохранениемselector. БД автоматически не понижать, историю/receiptsнеудалять.
- [x] Проверенные локальные копии24 файлов двух старых выпусков сохранены наMac. Удалены только их повторно проверенные серверные экземпляры; свежая копия и последниеjournal/observerкопии сохранены.

Артефакты: `/Users/yshishenya/.codex/private-artifacts/airis-mail-observation-admin-20261003`. Основные: `ci-final.json`, `candidate-full.log`, `candidate-postgres.log`, `candidate-api-proof.json`, `candidate-ui-closed.png`, `deploy-resume-verified.log`, `live-verify.log`, `migration-production-proof.json`, `production-admin-diagnostic-proof.json`, `production-admin-access-proof.json`, `diagnostic-isolation-proof.json`, `public-proof.json`, `production-wallet.png`, `local-proof-manifest.json`. Артефакты с runtime/config/sourcefingerprints остаются частными; секреты в git не добавляются.

Общий план остаётся189/244. Следующий обязательный блок — атомарная связь наблюдения с очередью, отчёт с явной полнотой, затем настоящий добровольный пилот и окна24h/72h/14d. Реальная внешняя доставка/ответподдержки, деньги/чек, физическийтелефон и независимаяполезность остаются открытыми. Финальная цель активна.
