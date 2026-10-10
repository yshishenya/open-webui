# AIRIS — безопасная загрузка и сохранение настроек инструментов/функций

## Meta
- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/active/airis-valves-modal-safety-2026-10-10-019.json

## Goal / Acceptance Criteria
Продолжение общих frontend условий G14/13.11. Финальная цель A/B сохраняется.
- [x] Воспроизвести исходные отказы на настоящих обработчиках/API во всех четырёх режимах; проверить трёх callers и серверные GET/POST/null договоры.
- [x] Сохранение не меняет черновик до ответа, использует сохранённый сервером ответ, содержит отказ и освобождает ожидание. Массивы/defaults/multiselect сохраняют различия.
- [x] Закрытие/destroy/смена id/type/userValves отменяют запрос и отбрасывают прежний ответ; загрузка имеет завершение и явный повтор после отказа, без неявного POST retry.
- [x] Все 12 admin/user valve adapters используют общую проверку values/spec, optional AbortSignal, ограничение 25 секунд и явные сетевые ошибки; прежние HTTP error/null/body/auth договоры сохранены.
- [x] Повторный submit и редактирование во время сохранения заблокированы; события save/close соответствуют результатам, базовая доступность сохранена.
- [ ] Frozen Docker/frontend/type/lint/browser проверки без новых диагностик; сохранность, SDD, source push и частные документы подтверждены.

## Scope / upstream impact
Общий workspace/common/ValvesModal, одна native required-граница в common/Valves (2 прямых потребителя), 6 admin и 6 user valve adapters в tools/functions, существующий fork-owned userValves request helper. Не вводить зависимостей/Any/подавлений. GetFunctions/CRUD/редакторы и chat Controls Valves не объявлять исправленными этой партией; прямые callers и helper consumers изучены. Backend/access policy не меняются. HTTP отказы становятся безопасным Error со status; приватный detail не показывается и не журналируется.

Обнаруженное в браузере расширение: native required блокирует допустимый пустой массив; сохранены исходные checkValidity=false/29 первоначальных отказов и отдельный регрессионный отказ. Scalar required остаётся прежним, minItems/другие ограничения остаются у сервера.

## Verification
База f3321023dfed53bd2132483570570343b51ab64d; frontend1756/161, types1140/85, ESLint762. Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-valves-modal-20261010. Backend542/protected21/12productionсоседей сохраняются. План198/244 и финальная цельactive.

## Verified source acceptance
- Before: 29/30 failures on actual component/adapters, ordinary load control passed. Actual browser/native validity and one added regression test separately failed for empty arrays.
- Final focused133/133 (59 new +74 adjacent); full1815/1815,162files,failed/pending/todo0. Types1140/85→1127/85,ESLint762, no new diagnostics; all13Modal errors removed, scoped ESLint passed.
- Browser15/15,console0/0: actual Modal/Valves/widgets/focus-trap with controlled API/stores. Four modes/server result,refusal/retry,draft/multiselect/default/empty arrays,native fieldset/duplicate submit,late values/spec/save,id changes,close/reopen/destroy/Escape passed. No map mounted, no full-root/provider/production claim.
- First1814 full run retained in superseded; renderer change followed its confirmed completion. Only final frozen1815 run accepted. Initial fixture build/stores, reserved Window.closed and overlapping dropdown navigation corrected; those results excluded.
- Frozen1763files;backend542/protected21/production12neighbors preserved. Backend1063 reused by unchanged bytes,no new backend run. Production2026-10-10T04:21:30.169727+00:00 healthy/restarts0,revisionc0ea9dd7823a89e21a8bd58f1e8eef6fe930b908 unchanged.

## Limits and remaining release gates
Abort cannot reverse an already accepted server-side settings write. HTTP errors expose status rather than private detail; scalar required remains unchanged; server schema/minItems still enforce values. GetFunctions, remaining CRUD/API/editors and other chat Controls lifecycle are outside this work item. Whole-repo types/lint remain red; PR/CI/integration/clean build/production and real A/B criteria remain pending. Plan198/244,46open,goalactive.
