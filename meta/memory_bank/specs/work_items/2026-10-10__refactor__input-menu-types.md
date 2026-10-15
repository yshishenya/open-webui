# Типы обработчиков меню вложений

Status: Done (local; release pending)
Workflow: refactoring
Owner: Codex
SDD Spec: meta/sdd/specs/completed/airis-input-menu-types-2026-10-10-034.json

## Цель и критерии

- [x] Проследить InputMenu, единственный вызывающий MessageInput и четыре меню выбора.
- [x] Проверить настоящие обработчики выбора/дублей и native file change до/после.
- [x] Переиспользовать ChatAttachment и точные типы callback по существующим вызовам.
- [x] Сохранить boolean/undefined разрешение загрузки, camera target и web data.
- [x] Удалить только unused imports; emitted JS/CSS совпадают после этой нормализации.
- [x] Полный frontend проходит, новых type/ESLint диагностик 0; чужие данные сохранены.
- [x] SDD завершена, commit/push и частные планы сверены.

## Поток и Upstream impact

InputMenu вызывается только MessageInput. Последний хранит ChatAttachment[],
обрабатывает File[] через inputFilesHandler и передаёт upload событие
{type:string,data:unknown}; web data — массив URL. Выбранные записи четырёх
дочерних меню имеют id; InputMenu использует только id и сохраняет всю запись
со status=processed. Повторный id ничего не меняет. Настоящий input[type=file]
передаёт FileList через event.target; стираемое уточнение типа не меняет target.
Разрешение загрузки может быть undefined; прежняя проверка по истинности
сохраняется. Google Drive уже импортирует единственный родитель MessageInput.

Один upstream-компонент получает типы и удаление unused imports. Публичные
callback, доступ, storage, данные, native camera и выбор провайдера прежние.
Новых общих типов/пакетов/служб/настроек нет. Используются прежние Svelte,
TypeScript, i18next и существующий ChatAttachment; новые API не вводятся.

## Проверки и откат

Docker Compose: реальные извлечённые обработчики, прежние mounted-проверки
Knowledge/Files/Chats, compiled JS/CSS, полный frontend/types/ESLint и
scoped Prettier. Backend1064 только после сверки543файлов и конфигурации.
Production/ENV/config/mounts/соседи,21чужой файл/тома сохраняются.
Откат ограниченным коммитом. Общий план198/244 и production A/B остаются открытыми.

Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-input-menu-types-20261010.

## Проверенный результат

- Настоящие извлечённые обработчики и mounted-меню:4/4 до/после. Полная
  запись и status=processed сохранены; duplicate id и пустой FileList не
  вызывают повторной загрузки; кириллица и метаданные остаются в записи.
- Compiled JS/CSS совпали после удаления только unused imports из эталона.
  Сохранились event.target, optional chain, truthiness boolean/undefined
  разрешения загрузки и реальные web/OneDrive callback arguments.
- Итоговый frontend2078/2078, failed/pending/todo0; все4целевых случая
  прошли также в итоговом общем запуске.6868файлов сверены на каждом этапе.
- Types698/85→692/85, снято6; ESLint673→655, снято18; новых диагностик0.
- Первоначальный новый handler-тест не запускался из-за http import.meta.url
  в jsdom. Уточнён путь к реальному компоненту, до/после повторены одинаково;
  прежний файл восстанавливался только в собственной копии с проверкой bytes.
- Первый общий прогон выявил новое no-non-null-asserted-optional-chain.
  Уточнён FileList через стираемый тип; optional chain сохранён. Все общие
  проверки повторены на итоговом source. Предварительный прогон сохранён
  отдельно и не принят. Backend1064/25warnings переиспользован после сверки
  543файлов/конфигурации; нового backend-прогона нет.
- Production c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908 healthy/restarts0;
  ENV/config/mounts/12соседей,21чужой файл/262тома сохранены. Новых
  томов/своих контейнеров0. Новый браузер/образ/выпуск не создавались.
- SDD0343/3 завершена. Commit/push и частная синхронизация следуют после
  проверки документации. Приложение после принятого прогона не менялось.

По действующему .github/workflows/lint-frontend.yml ветка имеет220изменённых
frontend-целей;17изних содержат50оставшихся замечаний. Следующий приоритет —
этот список обязательного CI, а не произвольные вторичные функции. Аудит
сохранён в pr-lint-target-audit.json. Integration base на origin и сервере
Git совпал: d579f5c02926cace8c8da60434ce1c39c7284361.

Общий долг types/ESLint/backend quality, PR/CI/интеграция/сборка/выпуск
и реальные критерии A/B остаются открытыми. План198/244,46открытых; цельactive.
