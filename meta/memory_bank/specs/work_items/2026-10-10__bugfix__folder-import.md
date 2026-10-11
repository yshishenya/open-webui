# Папки и импорт чатов

Status: Done (local source acceptance; release pending)
Workflow: bug_fix
Owner: Codex
SDD Spec: meta/sdd/specs/completed/airis-folder-import-2026-10-10-042.json

- [x] Воспроизвести частичный импорт, массив вместо чата и оставшиеся обработчики после уничтожения.
- [x] Проверять весь файл до отправки; использовать один существующий batch POST, сохранить поля/квоты/права.
- [x] Переиспользовать folder types и requestJSON; закрыть отложенные чтения/ошибки, исправить доступность кнопки.
- [x] Полный frontend/type/lint, новых диагностик0; SDD, источник, commit/push и частные планы.

Upstream impact: common/Folder, Sidebar/Section, Folders, RecursiveFolder, Sidebar и только importChats в chats API.
Существующий сервер принимает массив в одной транзакции чатов, затем отдельно
записывает сообщения; полную атомарность сообщений не заявляем. Без backend/
миграций/новых зависимостей. Sparse registry и folder types уже используются
в Sidebar — только вынести их для повторного использования.
Evidence: /Users/yshishenya/.codex/private-artifacts/airis-folder-import-20261010.
Production, PR/CI и реальные A/B отдельно; локальные проверки не закрывают
номерные пункты основного плана.

Одинаковые27новых тестов: before5pass/22fail, after27/27; с кошельком и соседями75/75.
Итоговый frontend2203/2203,failed/pending/todo0. Types557/63→528/63,
ESLint538→533,new0;239актуальных CI lintцелей0/0, два новых testfiles0/0.
Backend1064/25warnings reused по565совпавшим хешам, нового запуска нет.
Первый общий прогон остановлен до исправления двух unused test parameters;
второй выявил несовместимый union компонентов в тесте (исправлен);
третий2202/2203 завершился старым wallet5s timeout. Тест byte-identical прошлой
приёмке, targeted75/75; итоговый полный запуск на тех же исходниках2203/2203.
Не увеличивали timeout и не ослабляли проверки. Scope7appfiles, два testfiles;
стили/прочие методы chats API сохранены. Заморожены6898файлов.
Productionhealthy/restarts0, ENV/config/mounts/12соседей сохранены;
21чужойфайл/262тома сохранены. SDD0423/3. PR/CI/выпуск/A/B отдельно.
План198/244,46открытых; цельactive; новых номерных закрытий0.
