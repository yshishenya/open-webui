# Выбор вложений в чате: существующие типы и имя старого файла

Status: Done (local; release pending)
Owner: Codex
Branch: codex/bugfix/chat-dispatch-replay
Workflow: bug_fix + refactoring
SDD Spec: meta/sdd/specs/completed/airis-chat-attachment-types-2026-10-10-033.json

## Цель и критерии

- [x] Воспроизвести неправильную подпись файла с null/отсутствующим meta.name.
- [x] Для подписи, подсказки и выбора использовать meta.name либо filename.
- [x] Переиспользовать KnowledgeListItem, KnowledgeFile, ChatTitleIdResponse и Writable<i18n>.
- [x] Сохранить параметры поиска, пагинацию, защиту поздних ответов, выбранные записи и исключение текущего чата.
- [x] Целевые mounted-тесты и полный frontend проходят; новых type/lint диагностик 0.
- [x] Сравнение compiled JS/CSS: различия только в fallback имени и удалении неиспользуемых переменных.
- [x] SDD завершена; commit/push/частный план имеют проверенные исходники.

## Поток и Upstream impact

InputMenu использует Knowledge/Files/Chats и добавляет выбранную запись в files
со status=processed. Knowledge API уже возвращает KnowledgeListItem и
KnowledgeFile; серверные FileMeta и FileModelResponse допускают null metadata.
searchFiles вызывают только InputMenu/Files и FilesModal: оба вызова проверены.
Существующий KnowledgeFile соответствует ответу /files/search; переиспользуем
его для return type без изменения запроса, ошибок и обработки ответа.
Chat API уже типизирован ChatTitleIdResponse; текущий chatId исключается.

Изменяются три upstream-компонента и две строки API (type-only import/return).
В Knowledge fallback нужен в трёх существующих местах одного пути. Чужие
компоненты, функции выбора, данные, доступ, оплата и квоты не меняются.
Зависимости/службы/миграции/новые общие типы не нужны. Установленные Svelte,
i18next и TypeScript используются в прежних точках, без новой интеграции.

## Проверки и откат

Docker Compose: mounted Knowledge/Files/Chats до/после, общий frontend,
types/ESLint, scoped Prettier. Сравнить emitted код; нормализовать только
заявленный fallback и удалённые unused bindings в исходном эталоне.
Backend1064 можно переиспользовать только после совпадения543файлов.
Сверить production/config/ENV/mounts/соседей,21чужой файл/тома.
Откат ограниченным коммитом. Критерии production A/B остаются открытыми.

Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-chat-attachment-types-20261010.

## Проверенный результат

- До правки mounted-проверки:2passed/1failed, отсутствовала кнопка legacy.pdf.
  После правки3/3; null metadata, null name и сохранённое имя покрыты.
- Настоящий Knowledge-компонент в браузере:1сценарий,4выбора (collection и
  три файла), кириллица сохранена,0ошибок/предупреждений консоли. Ответы API
  подготовлены локально, стили стенда упрощены; это не production-вход.
- Полный frontend2077/2077, failed/pending/todo0;6865файлов сверены
  до/после каждого общего этапа. Приложение после проверки не менялось.
- Types727/85→698/85, снято29; ESLint681→673, снято8; новых диагностик0.
- Runtime API-функции идентичен. Compiled JS/CSS трёх компонентов совпали
  после нормализации только fallback, unused callback args/loop index и const.
- Первый целевой прогон после правки выявил конфликт имени i18n type/value
  в Svelte; импорт переименован I18n до успешного целевого и общего прогонов.
  Ошибка сохранена в preliminary; она не выдана за результат продукта.
- Backend1064/25warnings переиспользован после сверки543файлов и
  pyproject/uv.lock/Compose; нового backend-прогона нет.
- Production c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908 healthy/restarts0;
  ENV/config/mounts/12соседей совпали.21чужой файл/262тома сохранены;
  новых томов/своих контейнеров0. Собственный браузер/HTTP8777 закрыты.
- SDD0333/3 завершена. Commit/push и частная синхронизация выполняются
  после проверки документации.

Общие types/ESLint/backend quality, PR/CI/интеграция/чистая сборка/выпуск
и реальные критерии A/B остаются открытыми. План198/244,46открытых; цельactive.
