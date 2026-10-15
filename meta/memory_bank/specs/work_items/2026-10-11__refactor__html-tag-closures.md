# Явное закрытие обычных HTML-тегов

Status: Done (mechanical local acceptance; common gates remain open)
Workflow: refactoring
Owner: Codex
SDD Spec: meta/sdd/specs/completed/airis-html-tag-closures-2026-10-11-058.json

- [x] По настоящим warnings Svelte5.56.0 зафиксирован21тег в17файлах; изучены все меняющиеся элементы и их атрибуты/обработчики.
- [x] Изменить только self-closing non-void теги: textarea/button/div/span/iframe/audio; void HTML/компоненты не менять.
- [x] Сверить весь скомпилированный JavaScript client/server и CSS до/после; атрибуты, обработчики, scripts и содержимое сохраняются.
- [x] Пройти полный frontend, типы/ESLint без новых замечаний, оформить результат и commit/push.

Используется установленный Svelte compiler, новых зависимостей/компонентов нет.
Это синтаксическая правка без новой функциональности или изменения запросов.
Новые тестовые сценарии продукта не нужны: прямое сравнение результата compiler
должно подтвердить отсутствие изменения исполняемого кода/стилей.
Upstream impact:17 существующих Svelte-компонентов по files.json; только21
явное закрытие HTML-элементов, остающиеся проблемы типов/правил не маскировать.
Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-html-tag-closures-20261011.
План198/244,цельactive; общие проверки/выпуск/реальные A/B открыты.

Проверка всего client/server JavaScript и CSS:17/17 модулей побайтно одинаковы;21исходное предупреждение selfclosing исчезло.

Полный frontend2350/2350, failed/pending/todo0. Types223/56 → 223/35;
ESLint382 → 361, новых0. Форматирование17файлов прошло.
304цели CI и17текущих файлов ещё имеют46 прежних замечаний; этот lint не
объявляется зелёным. Общие типы и lint тоже не пройдены, выпуск открыт.
Backend1064 reused/565hashes, нового прогона нет. SDD0582/2.
Production healthy/restarts0;12соседей/21чужойфайл/262тома сохранены.
