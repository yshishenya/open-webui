# Пользователи: список и подтверждённое удаление

Status: Done
Workflow: bug_fix
Owner: Codex
SDD Spec: meta/sdd/specs/completed/airis-admin-users-2026-10-10-039.json

- [x] Воспроизвести переключение страницы при неудачном удалении и устаревшую загрузку; проследить4callers getUsers.
- [x] Тип списка соответствует серверу, сохранённый пользователь не требует password; использовать GroupMember и requestJSON.
- [x] Удаление меняет страницу только после подтверждения; чтение/поиск отменяются при замене и уничтожении списка.
- [x] Сохранить поиск/сортировку/роли/модальные формы и banner-договор; общий stored Banner не менять.
- [x] Целевые/полные проверки, новых диагностик0, чужие данные сохранены.
- [x] SDD/документация/commit/push и частные планы; выпуск и реальные критерии A/B отдельно.

Причина: page меняется до проверки ответа удаления; чтение не имеет срока
жизни. Использовать существующий AbortController/requestJSON, без повтора
DELETE. Display Banner допускает отсутствие stored id/timestamp; прежняя
sanitizedHtml action заменяет локальное DOM HTML-вставление. Новых зависимостей
нет. Upstream impact: users API, UserList, Banner и только типы EditUserModal.

Docker Compose: одинаковые tests до/после, настоящий DOM, полный frontend/
types/lint; backend evidence reused только по точным совпадающим хешам.
Отдельный commit допускает откат. Evidence:
/Users/yshishenya/.codex/private-artifacts/airis-admin-users-20261010.


## Локальная приёмка

На одинаковых14тестах исходный вариант2passed/12failed, после14/14;
три настоящих DOM-сценария проверяют список без config, native sorting,
image fallback, отмену при уничтожении и inline Banner. Собственные17/17,
с соседними формами групп/Navbar44/44. Поиск сохраняет прежние300мс debounce,
сразу отменяя старое чтение. Неудачный DELETE не меняет страницу; повтора
DELETE нет. Подтверждённый DELETE переключает только опустевшую страницу.

getUsers использует requestJSON/GroupMember, сохраняет GET/auth/filter/page
и полную запись ответа. Display Banner допускает отсутствие stored id/
timestamp; общий persisted Banner не меняется. Текст Markdown и закрытие
сохранены; sanitizedHtml переиспользована, сырой журнал Banner удалён.
EditUserModal содержит только2изменения типов: emitted script JS, шаблон,
стили и все callbacks, включая денежные, совпадают с прежними по байтам.

Полный frontend2141/2141, failed/pending/todo0; собственные17включены.
232актуальные CI lintцели0/0, оба новых тестовых файла отдельно проходят
ESLint/Prettier. Types618/68→593/68, ESLint545→544, новых диагностик0.
Все6886файлов заморожены на общих этапах. Backend1064/25warnings reused
после565хешей: нового backend-прогона нет. Production/ENV/config/mounts/
12соседей,21чужойфайл и262тома сохранены, собственных контейнеров нет.
Новые сборки/образы/deploy не выполнялись. Общие quality/PR/CI/интеграция/
выпуск и реальные критерии A/B остаются открытыми.
