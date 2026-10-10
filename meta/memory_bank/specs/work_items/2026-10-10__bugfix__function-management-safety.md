# AIRIS — управление функциями без потери состояния

## Meta
- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/active/airis-function-management-safety-2026-10-10-017.json

## Goal / Acceptance Criteria
Продолжение G14 / 13.11; финальная цель A/B сохраняется.
- [x] Воспроизвести утечку async onMount, отказ переключения и ложный успех импорта; изучить все callers API/FunctionMenu и backend договоры.
- [x] Обработчики удаляются синхронным cleanup; поздний load/импорт после destroy не записывает состояние и не начинает новый POST.
- [x] Переключатели и удаление принимают серверный результат, блокируют пересечение действий одного id, обрабатывают ошибки и сохраняют прежнее состояние при отказе.
- [x] JSON импорт полностью проверяется до первого POST; empty/invalid/duplicate/file failure не пишут; подтверждение arbitrary code сохранено; частичный результат не считается полным успехом.
- [x] API CRUD/list/URL/export имеют точные типы, deadline60s/abort/явные HTTP ошибки; GET/POST/DELETE/body и user-valves договоры сохранены.
- [ ] Docker адресные/общие checks без новых диагностик, браузер/сохранность/SDD/source push подтверждены; private acceptance синхронизирована.

## Scope and upstream impact
Functions, единственный FunctionMenu caller; отдельный fork-owned parser; типы/backend response. Для network повторно используется requestJSON; добавляется только optional method GET/POST/DELETE для существующих bodyless mutations. GetFunctions и admin/user valves API остаются отдельными путями этой партии; их существующие callers изучены. Unsupported Community URL '#' не превращается в публикацию. Новых зависимостей нет.

## Verification
Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-function-management-20261010
До/после: настоящие component scripts и native inputs; общий frozen frontend/type/lint. Backend542/primary21/production12соседей сохраняются. Производственный выпуск и реальные критерии A/B этим не закрываются.


## Проверенные результаты
- Исходный компонент: 7 выбранных отказов воспроизведены; остальные 15 случаев фильтра этого запуска не являются проверкой старого компонента. Отдельно 9 настоящих исходных API-функций проглатывали сетевой отказ и возвращали null; source SHA256 сохранён. Начальный 16-failure отчёт сохранён отдельно.
- Приняты 35/35 адресных и 1735/1735 общих frontend тестов, 160 файлов; failed/pending/todo=0. Заморожены 1761 исходный файл.
- Types1183/86→1148/86, ESLint780→769; новых диагностик0. Все 34 ошибки Functions и одна FunctionMenu устранены.
- Браузер9/9: настоящий Functions/FunctionMenu/Switch/Dropdown/Tooltip/ConfirmDialog/native file input. API/stores/navigation управляемые, несвязанные модальные окна заменены проверочными. Console0/0. Это локальная проверка компонента.
- Сохранены backend542, protected21, production revision c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908, healthy/restarts0 и12соседей. Backend1063 переиспользованы; нового backend прогона нет.
- Два собственных пустых тома проверены read-only и удалены безforce/prune; остальные тома сохранены. Браузер/HTTP закрыты; сгенерированный browser bundle удалён, генератор и хеши сохранены.

## Ограничения и дальнейшая приёмка
Клиент проверяет структуру всего массива, Unicode-идентификаторы и дубли по lower(); точная версия Unicode и исполнение кода проверяются сервером. Импорт не транзакционный: ранее принятые функции при позднем серверном отказе остаются; число показано, автоматического повтора нет. Abort не обещает отмену уже принятой сервером записи. После каждого результата файл сбрасывается для явного повторного выбора.

GetFunctions, admin/user valves, редакторы и ImportModal не объявляются исправленными этим изменением. Общие types/lint остаются красными; PR/CI/интеграция/чистый образ/production ещё открыты. План198/244, новых номерных закрытий0, финальная цель active; реальные provider/payment/mail, телефон/добровольцы и окна24h/72h/14d требуют отдельных доказательств.
