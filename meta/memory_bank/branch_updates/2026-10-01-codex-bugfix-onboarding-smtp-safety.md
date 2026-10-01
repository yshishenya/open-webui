# Branch updates — 2026-10-01

- [ ] **[BUG][ONBOARDING][SMTP]** Исправить небезопасные повторы общего почтового транспорта
  - Spec: `meta/memory_bank/specs/work_items/2026-10-01__bugfix__onboarding-smtp-safety.md`
  - Owner: Codex
  - Branch: `codex/bugfix/onboarding-smtp-safety`
  - Started: 2026-10-01
  - Summary: Отдельная рабочая папка от актуальной airis_b2c; воспроизведение дубля после QUIT, явные accepted/failed/unknown, заголовки и безопасная диагностика. Служебные bool-контракты сохранены; отправка реальных писем не требуется для регрессии.
  - Tests: In progress — Docker Compose, подменённый SMTP.
  - Risks: Inbox и рабочий Reply-To проверяются отдельным действием; unknown нельзя повторять вслепую.

- [x] **[BUG][ONBOARDING][SMTP]** Код и локальная проверка транспорта завершены
  - Spec: `meta/memory_bank/specs/work_items/2026-10-01__bugfix__onboarding-smtp-safety.md`
  - Owner: Codex
  - Branch: `codex/bugfix/onboarding-smtp-safety`
  - Done: 2026-10-01
  - Summary: Accepted отделён от QUIT, unknown не повторяется вслепую, повтор ограничен доказанными временными сбоями. Добавлены Date/Message-ID, optional Reply-To, закрытие соединений и безопасные логи; сохранён bool API. В плане закрыты 13 подтверждённых пунктов подготовки и кода.
  - Tests: До фикса три регрессии failed; после — 20 почтовых passed и полный backend 407 passed; после форматирования email/auth 32 passed. Ruff/Black изменённых файлов, py_compile, diff --check и SDD проходят.
  - Risks: Общий backend Ruff имеет 6743 прежние ошибки вне изменённых файлов. Frontend: 119 passed, один suite collection error; check 8363 errors, ESLint existing plugin crash. Server rollout, настоящий Reply-To и Inbox пока не подтверждены; весь выпуск A остаётся активным.

- [ ] **[BUG][CI]** Восстановить зависимости для backend-pytest
  - Spec: `meta/memory_bank/specs/work_items/2026-10-01__bugfix__onboarding-smtp-safety.md`
  - Owner: Codex
  - Started: 2026-10-01
  - Summary: GitHub CI обходит dev startup и устанавливает неполный набор пакетов в upstream-образ; pytest падает на collection. Перед тестами устанавливается существующий requirements.txt, без изменения зависимостей.
  - Tests: Проверка Compose и повторный GitHub CI.

- [x] **[BUG][SMTP]** Compose передаёт SMTP_REPLY_TO в контейнер
  - Spec: `meta/memory_bank/specs/work_items/2026-10-01__bugfix__onboarding-smtp-safety.md`
  - Owner: Codex
  - Done: 2026-10-01
  - Summary: Добавлен отсутствующий mapping ENV; пустой default сохраняет существующее поведение. Проверяется цепочка Compose → EmailService → MIME Header без SMTP.

- [x] **[BUG][SMTP]** Тексты шаблонов согласованы с настроенным каналом ответов
  - Spec: `meta/memory_bank/specs/work_items/2026-10-01__bugfix__onboarding-smtp-safety.md`
  - Owner: Codex
  - Done: 2026-10-01
  - Summary: Убран запрет отвечать в 14 шаблонах; приглашение ответить появляется при настроенном Reply-To. Общий renderer передаёт настройку; 27 почтовых тестов проходят.
