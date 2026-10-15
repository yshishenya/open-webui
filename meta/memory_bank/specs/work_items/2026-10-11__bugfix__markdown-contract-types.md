# Типы существующих расширений Markdown

Status: Done (local acceptance; release pending)
Workflow: bug_fix
Owner: Codex
SDD Spec: meta/sdd/specs/completed/airis-markdown-contract-types-2026-10-11-056.json

- [x] Проследить Markdown.svelte, общий markedExtension в utils и все пять расширений; проверить официальный Marked 9.1.6 и закреплённые типы.
- [x] Описать используемые токены и контекст через существующие типы; сохранить текст/HTML/lexer, удалить только неиспользуемый внутренний аргумент, сохранить публичные options как в существующем katex через void и неиспользуемый commands.ts.
- [x] Сравнить исполняемый код и реальные результаты lexer, пройти общий frontend/check/ESLint, закрыть SDD и отправить изменения.

Новых зависимостей, новых слоёв разбора или исправления алгоритмов нет.
Модуль common/RichTextInput/commands.ts не импортируется и не загружается
динамически; действующие команды чата и канала сохраняются.
Marked lheading исторически возвращает paragraph перед details; совместимый
узкий cast на границе встроенного callback заменяет старое as any. Проверить
поведение на настоящем закреплённом lexer. Не подменять paragraph на heading
ради формально узкого встроенного типа.
Upstream impact: пять src/lib/utils/marked/* и удаляемый
src/lib/components/common/RichTextInput/commands.ts.
Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-markdown-contract-types-20261011.
План 198/244; цель active; выпуск и реальные A/B открыты.

Marked 9.1.6: официальные Tokenizer/Instance исходники проверены по gitHead 86e0eb5485a950b5ddbe542c1c239245f15e3415. Latest 18.1.0; сохранить прежний согласованный lexer/renderer runtime. Обновлять группу отдельно с проверкой всех Markdown/KaTeX/custom-token контрактов. В промежуточном check уточнение lheading выявило widened level:block; исправлено as const до общего принятого прогона. Публичные options не интерпретируются и сохранены через существующий katex pattern void options.

Итог: 5 модулей совпадают по emitted JS после перечисленных изменений непрочитанных аргументов; 25 настоящих lexer/parser примеров одинаковы; 4/4 целевых, 2338/2338 frontend. Types 245/56, ESLint 382, новых 0; 283 цели CI без замечаний. Backend 1064 по 565 хешам; production/12 соседей/21 чужой файл/262 тома сохранены. SDD 2/2; выпуск/общие проверки и A/B открыты.
