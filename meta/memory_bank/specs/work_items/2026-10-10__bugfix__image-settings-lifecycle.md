# AIRIS — договор и жизненный цикл настроек изображений

## Meta
- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/active/airis-image-settings-lifecycle-2026-10-10-014.json

## Goal
Продолжение G14 / 13.11: настройки изображений используют фактический договор ImagesConfig, не зависают при ошибках JSON и сети, не выдают ложное сохранение/проверку и безопасно читают оба файла ComfyUI. Типы и ошибки проверяются для всех связанных вызовов.

## Acceptance Criteria
- [x] В настоящих обработчиках воспроизведены неверный JSON, spinner и очистка неправильного объекта FileReader; изучен backend и все callers.
- [x] Генерация и редактирование используют один путь чтения файлов с проверкой выбора, результата, отказа и завершения компонента.
- [x] Параметры и workflow проверяются до POST; отказ сохраняет введённые данные и переключатели; finally завершает состояние сохранения.
- [x] Договор API типизирован по ImagesConfig и моделям; отсутствуют новые Any, подавления и изменения платных запросов генерации.
- [x] Ошибки конфигурационного HTTP и отмена явные; поздние ответы не меняют закрытый компонент; проверка не сообщает успех после отказа сохранения.
- [ ] Общие Docker проверки без новых диагностик; исходники отправлены, SDD/частные документы подтверждены, production и чужие файлы сохранены.

## Evidence and callers
ImagesConfig описан backend/open_webui/routers/images.py:232; API getConfig/updateConfig/verifyConfigUrl/getImageGenerationModels используются администраторской формой Images.svelte. imageGenerations/imageEdits используются также playground/Images и chat/ResponseMessage; их денежный и серверный путь сохраняется. Audio уже имеет requestAudioJSON с deadline, отменой и разбором ответа: прежде чем создавать аналог, рассматривается его переиспользование. Выявлены типы null/params/node_ids и однотипные обработчики обоих workflow.

## Upstream impact
Планируются точные договоры API и минимальные hooks формы. Нет изменения layout, новой зависимости или смены provider. Общие помощники AIRIS переиспользуются. Фактический список файлов и проверки дополняется после воспроизведения.

## Limits
Source acceptance не заменяет общий зелёный gate, интеграцию, production или пользовательский пилот. Исходный общий результат: 1627 frontend tests, types 1321/87, ESLint 809.

## Evidence
/Users/yshishenya/.codex/private-artifacts/airis-image-settings-20261010

## Source verification — 10.10.2026
- Before: 20/20 настоящих обработчиков дали отказ; FileReader-модель скорректирована для настоящего асинхронного read/error до принятой проверки.
- После: 40 проверок изображений + 34 соседних Audio/speech; полный набор 1667/1667, 156 файлов, отказов и ожидающих 0.
- Проверены неверный JSON, параметры-массивы/null/scalar, пустой конфиг, сохранение переключателя при отказе credentials, два сохранения, HTTP отказ/повтор, false verify, поздние ответы, модели и оба upload.
- Types 1321/87 → 1275/87: сняты все 46 ошибок Images.svelte; ESLint 809 → 804. Новых диагностик 0; отдельная проверка пяти изменённых файлов без ошибок.
- 1755 исходников зафиксированы и проверены до/после каждого общего прогона. Backend/платные imageGenerations/imageEdits неизменны; нет новых dependencies, Any или подавлений.
- Реальный компонентный script и API проверяются также в изолированной браузерной странице с native File/input. Это не приёмка полного Svelte UI или production.

## Upstream impact — actual
src/lib/apis/images/index.ts: точные типы и общий ограниченный JSON-запрос четырёх действующих API. src/lib/apis/audio/index.ts: existing requestAudioJSON перенесён в src/lib/utils/airis/request_json.ts без смены deadline/ошибок Audio; его четыре callers используют общий путь. src/lib/components/admin/Settings/Images.svelte: typed draft, immutable validation/payload, loading/finally, отмена/поздние ответы и единый upload вместо двух FileReader. Кнопка проверки edit ComfyUI удалена: backend проверяет лишь generation, подтверждать edit через неё было неверно. Backend API не расширялся. Вёрстка остальных полей сохранена; Steps использует native number/min/step.
