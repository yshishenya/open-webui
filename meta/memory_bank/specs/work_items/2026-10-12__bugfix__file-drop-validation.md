# AIRIS — проверка данных переноса файлов

- Type: bugfix
- Status: completed (source checks)
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-file-drop-validation-2026-10-12-099.json

Причина: четыре получателя читают JSON без проверки формы; неверный массив/идентификатор попадает в callback перемещения. Пустые catch скрывают отказ. Оба терминальных получателя и оба получателя базы знаний используют один небольшой fork-owned parser. Он возвращает только массив непустых строк или один непустой идентификатор; неверный пакет не вызывает перемещение. Форматы path/paths/fileId/dirId, существующие API и права доступа сохраняются. PointerEvent уже наследует MouseEvent: cast any не нужен. Удалить три мёртвых импорта и устаревший ignore.

- [x] Воспроизвести неверные данные в настоящих компонентах и исправить все получатели.
- [x] Проверить верные/неверные данные, полный frontend/types/lint; сохранить сервер/данные, закрыть SDD и отправить коммит.

Upstream impact: четыре компонента, тонкий вызов нового helper без новых зависимостей. Откат: revert commit. Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-file-drop-validation-20261012. Общая цель active; выпуска пока нет.

Результат: до0/4, после5focused/2590full;types0/15,ESLint55→45/new0,scoped7/CI426/format clean,CSS8. Сервер/данные сохранены; общий lint и браузерная приёмка рабочего выпуска остаются открытыми.
