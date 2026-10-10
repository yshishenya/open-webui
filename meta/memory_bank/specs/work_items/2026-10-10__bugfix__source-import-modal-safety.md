# AIRIS — импорт исходного кода по ссылке и закрытие Modal

## Meta
- Type: bugfix
- Status: source-accepted
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-source-import-modal-safety-2026-10-10-018.json

## Goal / Acceptance Criteria
Продолжение G14/13.11; финальная цель A/B остаётся прежней.
- [x] Воспроизвести зависшее ожидание/ложный успех/поздний импорт и утечку Modal на настоящих обработчиках; проверить обоих ImportModal callers и контракт URL API.
- [x] Импорт имеет точные типы, проверку ответа, одну активную загрузку; отказ любого шага освобождает ожидание без ложного успеха и изменения исходного ответа.
- [x] Закрытие/destroy отменяют запрос и игнорируют поздний ответ; повторное открытие не принимает старый результат; передача в редактор подтверждается по завершению callback.
- [x] Общий Modal удаляет принадлежащие ему обработчики и узел безопасно, восстанавливает прокрутку с учётом других Modal; его прежние свойства/слоты/клавиатурный порядок сохраняются.
- [x] Tool URL API повторно использует requestJSON с deadline/abort/reject; оба тонких callers передают AbortSignal. Загрузка исходника не считается установкой функции/инструмента.
- [x] Docker адресные/общие проверки без новых диагностик, настоящий браузер, сохранность, SDD/source push и частный отчёт подтверждены.

## Scope / upstream impact
ImportModal, общий Modal, URL-загрузка tools, тонкие URL callbacks Functions/Tools. Новых зависимостей и backend изменений нет. Остальные function/tool API, ValvesModal и редакторы не объявляются исправленными этой партией; их отдельные пути прочитаны для определения границ.

## Verification
Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-source-import-modal-20261010.
База: 9b7624397aac3ad9ce29d74673d48fa5f174f0c8; frontend1735/160,types1148/86,ESLint769. Backend542/protected21/production12соседей сохраняются. Общие production и реальные A/B критерии остаются открытыми.

## Verified source acceptance
- Before: 17/18 failures on original components/adapters, normal close control passed. Tests execute actual Svelte scripts/reactive expressions and actual extracted frontmatter/name helpers; frozen objects use strict mode.
- After: 43/43 focused (21 new + 22 prior function-management), 1756/1756 frontend, 161 files; failed/pending/todo 0. Scoped ESLint passed. Types 1148/86 -> 1140/85, ESLint 769 -> 762, no new diagnostics. All ImportModal and Modal diagnostics removed. The first full run was interrupted before app edits to remove an accessibility suppression dependency; only the final frozen run is accepted.
- Browser: 9/9 on compiled actual ImportModal/Modal/Spinner/XMark/focus-trap, real extracted utility functions and controlled loaders/editor callbacks. Success/refusal/retry/cancel/late/reopen/destroy/nested Escape/out-of-order close/Tab/inside clicks passed; console 0 errors/0 warnings. Svelte's framework window pointer delegation listener is excluded from ownership checks; component and focus-trap listeners are checked. This is a component acceptance, not a production/root or arbitrary-code installation test.
- Direct common Modal imports: 63 matched callers (inventory in proof); only 2 ImportModal callers. Cleanup uses the owned portal element so a nullified Svelte binding cannot skip it. No global modal manager or dependencies. Existing unset scroll policy preserved after the last dialog closes.
- 1762 frozen files; 542 backend/protected21/12 production neighbors preserved. Existing backend1063 result reused, no new backend run. Production 2026-10-10T03:54:12.364787+00:00 healthy/restarts0, revision c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908. No production release of this source.

## Limits and next gates
Loading source is not installing/executing it. The server/editor remains responsible for full code validation; Unicode identifier behavior is unchanged. Cancelling an already invoked editor callback cannot reverse its accepted side effects; late loader responses never invoke it. GetFunctions, other tool/function API operations, ValvesModal and editors remain outside this work item. Whole-repository types/lint are still red; PR/CI/integration/clean build/production and real A/B acceptance remain pending. Plan198/244 and final goal active.

Runtime commit: 9b1ef88dbee6ec2585250a7049ad0044506bb2bd; pushed exact source and all 1762 frozen Git blobs verified. SDD3/3 completed; 219 tracked specs valid. Whole-goal acceptance remains pending as stated above.
