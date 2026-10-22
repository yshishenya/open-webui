# Guarded deploy: сохранение runtime Compose overlay

- Type: bugfix
- Status: locally verified; frozen for integration
- Owner: Codex
- Branch: codex/bugfix/billing-experience-20261022
- Created: 2026-10-22
- SDD Spec: N/A — небольшое исправление существующего скрипта без новых подсистем.
- Related: `2026-08-05__refactor__guarded-airis-deploy.md`

## Изменение

`scripts/deploy_guarded.sh` принимает операторскую переменную `PROD_COMPOSE_FILES`
со списком файлов через двоеточие. Если переменная не задана, остаются прежние
`docker-compose.yaml:docker-compose.prod.yml`. Для текущего runtime AIris оператор
должен передать
`PROD_COMPOSE_FILES='docker-compose.yaml:docker-compose.prod.yml:/opt/projects/airis-analytics-runtime/compose.yaml'`.
Относительные пути разрешаются в удалённом `PROD_PATH`, абсолютные сохраняются.
Явно пустой список, пустые элементы, переводы строк и отсутствующий на сервере
файл останавливают выполнение до операций с Docker и резервными копиями.
`--dry-run` показывает список, но не проверяет наличие удалённых файлов.

Список передаётся одним экранированным аргументом SSH → Bash, разбирается через
`IFS=:` и добавляется в массив `docker compose -f ...` без `eval`.
Один массив используется для config, миграции, запуска и отката; порядок overlay
сохраняется. `--no-deps`, отсутствие `--remove-orphans` и `umask 077` сохранены.

## Вызовы / границы

Прямой операторский вызов описан в `docs/DEPLOY_PROD.md`; автоматических вызовов
guarded-скрипта в CI/package scripts нет. `deploy_target.sh` вызывает отдельный
`deploy_prod.sh`; эти два скрипта не изменяются. Upstream impact: none.
Нет новых зависимостей, сборки, подключения к production или развёртывания.

## Проверки

`bash -n scripts/deploy_guarded.sh` и отдельный `bash -n` удалённого heredoc;
`tests/guarded-deploy-scope.test.ts`: прежние ограничения запуска/отката, два
файла по умолчанию, три файла с буквальными спецсимволами, некорректные списки,
отсутствующий файл. Тест запускает только setup до Docker и подменяет SSH
локальной функцией, без сетевых подключений.

Результат: оба `bash -n` успешны; Vitest 1.6.1 — 11/11 PASS, один процесс,
без Docker/установки зависимостей/сборки. Использован уже установленный runtime
из основной рабочей копии, root теста — текущая общая worktree. Конфигурация
Svelte/PostCSS не загружалась: это изолированный Node/Bash набор контрактов.
`git diff --check` успешен. Production-проверка и deploy не выполнялись.

## Передача статуса основному агенту

- [x] **[BUG]** Сохранение runtime Compose overlay в guarded deploy.
  - Spec: `meta/memory_bank/specs/work_items/2026-10-22__bugfix__guarded-deploy-compose-files.md`
  - Owner: Codex
  - Summary: операторский список Compose-файлов с проверкой и безопасной передачей; старый default сохранён.
  - Done: 2026-10-22 (локальная реализация и проверки, не выпуск).
