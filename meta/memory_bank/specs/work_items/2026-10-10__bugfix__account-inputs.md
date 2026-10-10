# Поле пароля и срок жизни фотографии профиля

Status: Done (local source acceptance; release pending)
Workflow: bug_fix
Owner: Codex
SDD Spec: meta/sdd/specs/completed/airis-account-inputs-2026-10-10-040.json

- [x] Воспроизвести потерю заданной подписи поля и подмену нового выбора запоздавшей фотографией/Gravatar; проследить все callers.
- [x] Передать ariaLabel как aria-label самому input, сохранить форму/показ пароля/автозаполнение.
- [x] Отмена, новый выбор и уничтожение не допускают старых результатов; ошибки сохраняют фотографию и дают безопасное сообщение.
- [x] Сохранить250px cover crop, WebP0.8, remove/initials и оба вида компонента; переиспользовать requestJSON и SessionUser.
- [x] Целевые/полные проверки, новых диагностик0, сохранность; SDD/commit/push/частные планы.

Upstream impact: SensitiveInput/UserProfileImage и по одному имени свойства
в AddUserModal/EditUserModal; только getGravatarUrl в utils
API. Чтение URL через requestJSON с URLSearchParams и отменой; повторов нет.
Не создавать сервис фотографий или новую зависимость. Существующую проверку
Canvas адаптировать к сроку жизни, сохраняя её прежние assertions.

Docker Compose: одинаковые проверки до/после, настоящий DOM, полный frontend/
types/lint; backend evidence reused только по совпадающим хешам. Отдельный
commit допускает откат. Production/внешний Gravatar и критерии A/B отдельно.
Evidence: /Users/yshishenya/.codex/private-artifacts/airis-account-inputs-20261010.

Целевые проверки:18/18, одинаковые16новых до1passed/15failed.
Строковый export alias не передаёт свойство; выбран существующий ariaLabel
контракт компонентов, два вызова заменяют только имя свойства.
Служебный локальный photo object сохраняет revision/reader/controller без
отложенной реактивности: немедленное уничтожение читает текущее состояние.
Оба вида Gravatar проверены на успех/отказ; ошибок с деталями наружу нет.

В AddUserModal удалены неиспользуемый onMount и3неиспользуемых CSS selector;
emitted script JS совпал, CSS rules совпали после нормализации scope/comments.
Первый полный прогон2157/2157 сохранён в preliminary: новый тестовый cleanup
возвращал VitestUtils вместоvoid, исправлено; прежние4lint замечания формы
также устранены. Финальная полная приёмка повторяется на новых хешах.

Финальный полный frontend2157/2157,failed/pending/todo0;
235CI lintцелей0/0. Types593/68→576/64,ESLint544→540,new0.
Backend1064 reused по565хешам, новая серверная проверка не запускалась.
Заморожены6890файлов. Production18:12:31Z c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908
healthy/restarts0; ENV/config/mounts/12соседей/21чужойфайл/262тома сохранены.
Новый образ/deploy/внешний Gravatar/реальные критерии A/B не выполнялись.
Полные check/lint пока возвращают1 из-за прежнего общего долга.
План198/244,46открытых; новых номерных закрытий0, цельactive.
