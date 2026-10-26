### In progress

- [ ] **[OPS]** Проверить Proton после сообщения HOSTKEY о разблокировке
  - Spec: `meta/memory_bank/specs/work_items/2026-10-23__ops__proton-delivery-followup.md`
  - Owner: Codex
  - Branch: `codex/docs/release-127-acceptance`
  - Started: 2026-10-26
  - Summary: HOSTKEY сообщил о разблокировке и закрыл запрос, но TCP/25 к Proton из AIris по-прежнему недоступен. Девять других доменов прошли защищённое соединение; с KVN доступны пять из шести адресов Proton. Отправлена просьба повторно открыть обращение с текущими доказательствами.
  - Tests: свежий DNS, SMTP/EHLO/проверенный STARTTLS без MAIL/RCPT/DATA; TCP из Mailu/AIris/KVN; адресат и подтверждение отправки Gmail; git diff --check.
  - Risks: маршрут и свежий пользовательский путь Proton не приняты; новый reset не создавался. Приложение и состав пилота сохранены.
