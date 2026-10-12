# AIRIS — срок жизни просмотра и очищенная разметка

- Type: bugfix
- Status: done (source only)
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-preview-lifecycle-2026-10-12-101.json

Причины: PDFViewer не владеет незавершённой загрузкой/рендером, поздние ответы могут пережить закрытый просмотр, новый zoom запускает второй рендер того же canvas. Использовать собственные PDF.js loading/render tasks и отмену, простую проверку срока жизни после await, номер текущего рендера для отбрасывания старого результата. Сохранить загрузку с cookies, поиск/выделение текста, масштабирование и resetView. Native cancel у TextLayer не требует пустых catch. Формулы используют существующий sanitizedHtml; SVG переносит прежнюю политику DOMPurify в соседнее действие того же модуля, не меняя кнопки/панорамирование. Для копирования формулы добавить клавиатуру и нативные атрибуты. Удалить два пустых CSS правила JSON.

Исходные версии из lockfile: PDF.js5.5.207, KaTeX0.16.38, DOMPurify3.4.11, panzoom9.4.3, Svelte5.56.0. Проверить установленную среду/официальные API; DOMPurify обновлён до exact 3.4.16 с минимальным lock diff. Официальные release notes 3.4.14/3.4.15 указывают усиление risky-tag/XML защиты, относящееся к SVG style/foreignObject. PDF.js/KaTeX/panzoom оставлены по документированному ограничению совместимости; обновлять PDF main/worker/text CSS и mhchem отдельной задачей с браузерной проверкой. Tech Stack исправлен по фактическим версиям.

- [x] Воспроизвести ошибки, сверить API/всех потребителей, внести минимальные исправления.
- [x] Пройти адресные/настоящие браузерные/full frontend проверки; сохранить данные, закрыть SDD и отправить коммит.

Upstream impact: PDFViewer, KatexRenderer, SVGPanZoom, JsonTreeView; fork-owned sanitized_html и версия в docs. Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-preview-lifecycle-20261012. Откат: revert commit. Финальная цель и рабочие A/B остаются открытыми.

## Проверка

- До исправления 4/4 сценария падают: закрытая загрузка, abort fetch, отмена старого canvas render, клавиатура формулы. После 5/5 с SVG/MathML sanitation.
- Full frontend 2597/2597; svelte-check 0 errors/0 warnings; ESLint 28→16, новых 0; изменённые 8 исходных/тестовых файлов и 449 целей CI чистые, format clean.
- Настоящий браузер: PDF.js 5.5.207 с worker, canvas 1200→1500 при 125%, reset 100%, текст Hello PDF и закрытие/reopen; KaTeX 0.16.38 mhchem/MathML и копирование Enter/Space; SVG 240×120 со стилем/стрелкой, script удалён, drag/reset действуют. Ошибок после начала успешной проверки 0. Стенд использовал настоящие компоненты и зависимости, временный CSS задавал размер/расположение; это не проверка внешнего вида production.
- 563 backend/configuration файла сверены с прежним snapshot, нового backend запуска нет. Фронтенд manifest изменён (DOMPurify patch); runtimeDependenciesUnchanged=false.
- Production c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908 healthy/restarts0;12 соседних контейнеров,21 чужой файл и262 исходных тома сохранены. Временный volume/контейнер удалены; выпуска этой партии нет.
- SDD check-complete/complete-spec пройдены. Общая цель active;198/244 пунктов плана, PR/CI/выпуск и настоящая приёмка A/B продолжаются.
