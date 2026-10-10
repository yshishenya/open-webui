# AIRIS — сохранность настроек интерфейса

## Meta
- Type: bugfix
- Status: source accepted; release pending
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-interface-preference-safety-2026-10-10-015.json

## Goal / Acceptance Criteria
Продолжение общего допуска G14 / 13.11; конечная цель A/B сохраняется.
- [x] Воспроизведены ошибки FileReader, изменения общих объектов до Save и конкурирующие сохранения; все callers изучены.
- [x] Фон: отмена/ошибка/поздний результат не теряют прежние данные, настоящий input очищается, закрытый компонент не сохраняет файл.
- [x] Оба окна имеют отдельный черновик; отмена сохраняет исходный объект; Save ждёт результат и остаётся открытым при отказе.
- [x] Общий saveSettings последовательно сохраняет частичные обновления, сохраняя предыдущие успешные поля после ошибки; автокопирование не читает частный буфер.
- [x] Типы Settings/размеров/quick actions совпадают с действительными потребителями; нет новых Any/подавлений/зависимостей.
- [x] Общие Docker проверки без новых ошибок, браузер и сохранность подтверждены; исходники отправлены.
- Частная итоговая приёмка записывается после отправки документации посредством CAS; общий выпуск остаётся открытым.

## Evidence and callers
Interface передаёт частичные Settings в SettingsModal.saveSettings; этот же путь обслуживает General/Audio/Notifications и настройки подключений. ManageImageCompressionModal и ManageFloatingActionButtonsModal имеют единственного caller Interface и сейчас изменяют переданные объекты. FloatingButtons потребляет сохранённые quick actions из ContentRenderer; фон и численные размеры потребляются чатами/каналами. Чтение Clipboard в toggleResponseAutoCopy не подтверждает разрешение записи; настоящая запись выполняется существующим copyToClipboard.

## Upstream impact
Минимальные изменения договоров stores/frontend-contracts и действительных Svelte callers. Общий порядок сохранения исправляется в SettingsModal, вместо отдельных очередей на переключателях. Валидация/файлы используют native FileReader/structuredClone и существующий getErrorMessage. Подробный список дополняется после проверки.

## Verification
Воспроизведение до исправления; Docker адресные/соседние и общий frontend/types/lint на frozen source; isolated browser, сохранность 542 backend / 21 primary / production и 12 соседей. Общая база 1667 tests, types 1275/87, lint 804. Production/пилот/окна A/B этим не закрываются.

## Evidence
/Users/yshishenya/.codex/private-artifacts/airis-interface-preferences-20261010

## Root fix and verification
Общий SettingsModal.saveSettings теперь берёт неизменную копию поступивших данных и вычисляет полный snapshot только после окончания предыдущего запроса. Отказ остаётся у caller, очередь восстанавливается для следующего выбора. Контракт касается callers общего saveSettings; отдельные вызовы updateUserSettings из других экранов не объявляются частью этой очереди.

Users.updateUserSettings использует существующий requestJSON: исходный endpoint/payload сохранён, deadline 60s охватывает тело ответа, ошибки HTTP явные, автоматических повторов нет. Все 13 мест вызова изучены; они сохраняют ui либо keybindings и не требуют прежнего неявного any/ошибки error.detail.

Interface использует общий persistSettings для обработки отказов; только подтверждённое сохранение закрывает форму. Автокопирование сохраняет выбранный флаг, а фактическая запись выполняется существующим copyToClipboard без предварительного чтения содержимого. Отложенная геолокация игнорируется при отключении и завершении компонента. FileReader сохраняется между вызовами для отмены и сравнения; error/null/ArrayBuffer/прежний reader не сохраняют URL. При отказе HTTP прежний фон остаётся.

Оба модальных окна открывают отдельный structuredClone на переходе show=false→true, сохраняют копию черновика с await, защищают повторный Save и закрытие другого открытия. Сохранение размера обновляет также локальный imageCompressionSize, чтобы основной Save не возвращал прежний размер. FloatingAction типизирован до действительного FloatingButtons-потребителя; Settings допускает string|null фона, number|null масштаба и boolean широкого режима. Подписка config в SettingsModal возвращает штатный cleanup onMount.

Изменения касаются Settings/Frontend contracts, Interface, двух управляющих окон, FloatingButtons, SettingsModal и одного Users API; новая зависимость не вводится. Изменение Modal size/class при первоначальном редактировании исправлено до frozen прогона. Первый общий прогон имел две ошибки в проверочном файле; исправлен только он, application/браузерные исходники сохранились. Итоговые результаты записываются отдельно после общего прогона.


## Final frozen verification
12/12 исходных отказов; 20 новых Interface и 102 соседних проверки, выделенные из итогового общего JSON: 1687/1687, 157 файлов, failed/pending/todo=0. Types 1275/87 → 1212/86; ESLint 804 → 780; новых диагностик 0, изменённые файлы без диагностик. 11/11 браузерных сценариев, console errors/warnings=0; настоящий script/API/native FileReader, отдельный HTTP fixture. Исправления последнего тестового файла не изменили приложение; receipt фиксирует границу переиспользования браузера.

1756 frozen файлов проверены; backend 542/protected 21/production/12 соседей сохранены. Backend 1063 переиспользованы, нового прогона нет. Общие types/lint остаются красными; source acceptance не закрывает G14, production или реальную пользовательскую приёмку.

Runtime source/remote: `78f4650a7d605198da01dbb673b4b73ae2a9b41f`. 1756 Git blobs совпали. SDD 3/3 закрыта; 216 tracked SDD валидны. Свои браузер/сервер/контейнеры остановлены; оба пустых собственных тома проверены read-only и удалены без force/prune.
