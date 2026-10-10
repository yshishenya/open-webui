# Обязательные замечания frontend перед выпуском

Status: Done (local; release pending)
Workflow: refactoring
Owner: Codex
SDD Spec: meta/sdd/specs/completed/airis-required-frontend-lint-2026-10-10-035.json

## Цель и критерии

- [x] Проследить 17 файлов с 50 замечаниями действующего CI и их callers.
- [x] До правок проверить настоящие stream/serializer/iframe/sync обработчики.
- [x] Устранить замечания без подавлений, новых зависимостей и ослабления правил.
- [x] Сохранить callbacks, загрузку/терминал, sandbox/CSP и данные.
- [x] Ошибку fs:sync явно зарегистрировать; обновление файлов продолжить.
- [x] Проверить все цели CI, полный frontend и отсутствие новых диагностик.
- [x] Проверить сохранность, завершить SDD, commit/push и частные планы.

## Границы и Upstream impact

Только реальные препятствия changed-file lint из .github/workflows/lint-frontend.yml.
Существующая рабочая ветка от airis_b2c продолжается. Не расширять функции.
Удаление ignored props требует удаления только forwarding у callers,
условия share/create остаются. NotebookOutput переносится из единственного
потребителя в API и переиспользуется. processResult получает unknown и
рекурсивный результат, без новых runtime guards. FullHeightIframe сохраняет
доверие к contentWindow, CSP и sandbox; закрытие script остаётся безопасным
для парсера Svelte. fs:sync ошибки регистрируются, прежний refresh сохраняется.
Upstream-owned файлы меняются минимально: типы, unused имена, корректные
парные HTML теги и журналирование двух прежде пустых catch.
Зависимостей и новых API нет; используются имеющиеся Svelte/TypeScript/Chart/Pyodide.

## Проверки и откат

Docker Compose: реальные handlers до/после, compiled JS/CSS с перечисленной
нормализацией, все changed-file lint цели, полный frontend/types/ESLint.
Backend переиспользуется только после сверки исходников и конфигурации.
Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-required-frontend-lint-20261010.
Откат отдельным коммитом. Production и A/B не закрываются локальным прогоном.

## Проверенный результат

- Все220целей действующего changed-file CI:0ошибок/0предупреждений;
  устранены все50замечаний17файлов. Правила проверки не менялись.
- 22изменённых исходника и вызывающих компонента: compiled JS/CSS
  совпал после явно перечисленной нормализации. Она допускает удаление
  unused imports/props/forwarding/indices/default callback arg, for(;;),
  две записи ошибки fs:sync и безопасную интерполяцию закрытия script.
  Типы стираются; HTML/CSP/sandbox/источники сообщений сохранены.
- Настоящие обработчики5/5 до/после: streamDONE/EOF/ошибка обработки,
  Python primitives/bigint/proxy/getter, iframe deps/same-origin gate,
  foreign source rejection/registration/payload/args, sync failure+refresh.
- Итоговый frontend2083/2083, failed/pending/todo0; все5целевых тестов
  подтверждены в общем запуске.6871файл заморожен на каждом этапе.
- Types692/85→690/76; ESLint655→605; новых диагностик0. Общие
  команды check/lint по-прежнему возвращают1из-за прежнего долга.
- Первый общий прогон выявил2новые type-ошибки: обязательный window.Chart
  и пропущенный AdminIntegrations caller в SettingsModal. Chart уточнён
  как optional; ignored forwarding удалён. Все общие проверки повторены.
  Предварительные результаты сохранены и не приняты.
- Backend1064/25warnings переиспользован после сверки557файлов
  backend/config; нового backend-прогона нет. Scoped Prettier прошёл.
- Production c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908 healthy/restarts0;
  ENV/config/mounts/12соседей,21чужой файл/262тома сохранены.
  Новых томов/своих оставленных контейнеров0. Browser/образ/deploy не создавались.
- SDD0353/3 завершена; commit/push и частные планы сверяются отдельно.

PR/CI/интеграция/чистая сборка/выпуск, общий долг качества и реальные
A/B/mail/payment/provider/пилот/календарные окна остаются открытыми.
План198/244,46открытых; этот блок не закрывает номерные production-пункты.
