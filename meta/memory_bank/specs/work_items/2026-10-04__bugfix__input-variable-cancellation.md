# AIRIS — отмена общей формы переменных

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: `codex/bugfix/input-variable-cancellation`
- SDD Spec: `meta/sdd/specs/completed/airis-input-variable-cancel-2026-10-04-001.json`
- Created: 2026-10-04
- Updated: 2026-10-04

## Context / Root cause

Cancel закрывает общую форму, но inputVariableHandler в чате/канале разрешает Promise только onSave. Все3 потребителя прослежены; Chat.svelte/saveChatVariables не ждёт этот Promise. Продолжение setText через Chat.onSelect может автоматически отправить выбранный шаблон. Возвращать обычный текст после Cancel нельзя: это запускает отменённую отправку.

База ad6e1e911 содержит PR226 и независимые изменения аналитики/кошелька. Завершённая база:406 тестов,4225/174 типов,1503 ESLint.10 mounted cases воспроизводят неразрешённый Promise в обоих полях и5 способах закрытия, без ошибок окружения.

## Goal / Acceptance Criteria

- [x] Настоящая форма/реальные обработчики: Cancel/Close/Escape/outside/unmount,10 failed cases.
- [x] Каждый способ отмены разрешает ожидание ровно один раз сnull;0 замен переменных и0 вызовов продолжения/отправки.
- [x] Save проходит ровно один раз;0 отмен после Save; черновик остаётся.
- [x] Новый программный запрос завершает прежний; поздний старый callback не заменяет значения.
- [x] Полные тесты/типы/ESLint завершены,0 новых диагностик; изменённые файлы проходят строгий ESLint/форматирование.
- [x] Настоящий браузер и exact-source CI/merge приняты.

## Scope / Upstream impact

Общий InputVariablesModal: необязательный onCancel и переход show=false/удаление; Save снимает ожидание отмены. Минимальные hooks в chat/channel MessageInput возвращаютnull и прекращают обработку. Все способы закрытия уже используют show=false; не переписывать Modal или отдельные кнопки. Третий потребитель Chat.svelte/saveChatVariables совместим. Шаблоны, backend/API, деньги, почта и миграции сохраняются.

Svelte lock5.56.0, TypeScript5.9.3/Vitest1.6.1/jsdom27.4.0; существующие reactive statements/onDestroy. Latest5.57.1 проверен предыдущим блоком; обновление отдельно с полными проверками/upstream review. Официальная документация lifecycle/reactivity читается перед реализацией. Новых зависимостей нет.

## Non-goals / Risks / Rollback

Общая типизация чата, редизайн, все4225 базовых диагностик. G14/production частичным исправлением не закрываются. Отмена оставляет шаблон в текущем черновике; долговечный offline draft не заявляется. Откат отдельного source PR.

## Verification / Completion

Docker Compose-first: mounted regression, полный Vitest1 worker, typecheck1536MiB/полный ESLint и сравнение завершённых диагностик; настоящий браузер. Проверить3 потребителей, Save и запрет продолжения обоих setText/insertTextAtCursor. CI по exact SHA; SDD check-complete/complete-spec и branch update после merge; частный план по доказательствам.

### 04.10.2026 — приёмка исправления

31 новый регрессионный сценарий; полный Docker Vitest437/437 в66 файлах. Браузер:28 сочетаний chat/channel × set/insert × Cancel/Close/Escape/outside/Save/Clear/Destroy,0 pageerror, наблюдение400ms после закрытия. Настоящая общая форма и точные тела обработчиков; редактор, разбор шаблона и предварительная обработка заменены тестовыми объектами. Это не проверка рабочего сервера или полного редактора.

Дополнительно воспроизведены2 ошибки уничтожения с поздно назначенным callback и3 ошибки отмены после отказа Save. Текущий обработчик отмены сохраняется при открытии; владелец завершает ожидание даже до первого отображения. При отказе замены переменных значения и флаг завершения не публикуются, окно остаётся доступным для отмены; исключение не маскируется успехом.

Полные типы4225/174 и ESLint1503 завершены; сравнение всех4399 сообщений типов и1503 сообщений ESLint с базой:0 добавлено/0 удалено. Все6 изменённых исходников/тестов проходят строгие ESLint/Prettier. Вpackage.json нет preflight; выполнены предусмотренные проектом Docker-команды вместо отсутствующей команды. Общий долг сохраняется, G14 не закрыт. Backend/DB/dependencies не изменялись. SDD2/3; exact-source CI/merge ещё ожидаются.

### 04.10.2026 — исходники приняты

PR229: source89b8692010caa2df934d0dc4ff260e537dd25a3e, merge3d421e035f6ec6a6fe45e4ff717ff760632a171f.10 CI проверок success/1 dependency-review skip; CodeRabbit сообщает review disabled для базы и не является независимым обзором. Все6 исходников/тестов SHA256-identical после объединения. SDD3/3, check-complete/complete-spec пройдены.

Полный backend точного source:900 passed/5 PostgreSQL-only skips; отдельная одноразовая PostgreSQL16 через штатный psycopg3.3.4:11 passed/0 skipped, включены все5 пропущенных сценариев и6 lifecycle cases. Первый проверочный запуск ошибочно использовал отсутствующий asyncpg и исключён; зависимости не добавлялись. Сборка frontend изgit archive source89b869201 успешно проходит со штатной4096MiB; первая1536MiB упала на heap limit и исключена. Это приёмка исходников/сборки, выпуск на рабочий сервер и весь G14 остаются отдельными шагами.
