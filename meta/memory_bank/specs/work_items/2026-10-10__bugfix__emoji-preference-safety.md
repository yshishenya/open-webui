# AIRIS — выбор эмодзи и сохранение недавних

## Meta
- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/active/airis-emoji-preference-safety-2026-10-10-016.json

## Goal / Acceptance Criteria
Продолжение общего допуска G14 / 13.11, конечная цель A/B сохраняется.
- [x] Воспроизвести отказ отложенного сохранения; изучить все пять использований и настоящий API.
- [x] Недавние выборы ограничены 30, без дублей; ошибка persistence обработана, выбор эмодзи остаётся доступным.
- [x] Удаление компонента освобождает таймер и отправляет последнюю ожидающую запись, если сессия прежняя; поздний отказ не обращается к интерфейсу.
- [x] Одновременно не выполняется более одного запроса данного компонента; быстрый следующий выбор сохраняется после текущего, даже при отказе.
- [x] Поиск и группировка строго типизированы; VirtualList соответствует действительному договору, без Any/подавлений/зависимостей.
- [ ] Docker адресные/общие проверки не дают новых диагностик, сохранность подтверждена; source отправлен, SDD закрыта, приёмка синхронизирована.

## Implementation / callers
EmojiPicker используется в UserStatusModal, FolderTitle, FormattingButtons и дважды в Channel/Messages/Message. Они принимают string|null; выбор должен срабатывать немедленно независимо от сохранения недавних. Backend заменяет ui целиком, поэтому сохраняется полный снимок текущих Settings. Scope очереди ограничен компонентом; конкуренция других вкладок не объявляется решённой.

## Upstream impact
EmojiPicker: типы существующих JSON словарей и строк, native setTimeout cleanup, явный catch; декларация существующего VirtualList точно отражает установленную3.0.1. Фиксируется height CSSstring; rowHeight отсутствует в API, переменная высота строк сохраняется.

## Verification
Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-emoji-preferences-20261010
До исправления используется настоящий script, controlled timers/API; после — Docker Vitest/общие check/lint, browser по необходимости. Backend/primary21/production12соседей сохраняются. Производственный выпуск/реальные окна этим не закрываются.


## Verification notes
Восемь отказов воспроизведены в принятом before на 12 сценариях настоящего script с controlled timers/API; дополнительный тест лимита30 включён в конечный прогон. Первоначальный тест ожидал только два microtasks и мог блокироваться на втором запросе; принятому fixture дано штатное ожидание setImmediate и отдельные promise handles. Первый общий1700/1700 прогон исключён после браузерной находки: выбор закрывал список без сброса поиска. Сброс добавлен в действительный selectEmoji; проверка выбранного текста расширена, общий frozen прогон повторяется.

В браузере скомпилирован настоящий EmojiPicker/Dropdown/Tooltip и установленный VirtualList, использованы настоящие SVG; stubs заменяют stores/usersAPI/transitions. Приняты8 сценариев, console0/0. Первая попытка использовала неоднозначный role locator двух вложенных кнопок; исправлен только browser harness на наблюдённый #open. Браузер не подтверждает полный root/backend/production.

## Final frozen results
1700/1700 frontend,158 файлов;13/13 адресных выделены из общего JSON,failed/pending/todo0. Types1212/86→1183/86;ESLint780→780;новых диагностик0,изменённые файлы без diagnostic errors. 1758 frozen файлов,backend542/protected21/production12соседей сохранены;1063 backend проверки переиспользованы. Production2026-10-10T02:28:20.386097+00:00 healthy/restarts0,revisionc0ea9dd7823a89e21a8bd58f1e8eef6fe930b908. Общие gates всё ещё красные,новый выпуск не выполнялся.
