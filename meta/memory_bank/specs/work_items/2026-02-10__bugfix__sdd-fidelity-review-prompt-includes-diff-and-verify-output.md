# SDD fidelity-review: include git diff + verification outputs in prompt

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/chat-black-screen-generate-image
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-10
- Updated: 2026-02-10

## Context

`sdd fidelity-review` иногда выдавал `unknown/partial` не потому что имплементация плохая, а потому что prompt был без доказательств:

- Git diff собирался как `git diff HEAD -- <file>` (только unstaged). Если изменения уже закоммичены и рабочее дерево чистое, prompt содержал `*No changes detected*`.
- Verify-часть в спеках была оформлена (команды в verify-ноды), но в prompt не попадал ни результат, ни вывод.
- AI consultation для Codex часто падал по таймауту 30s на больших prompt’ах (diff + build output).
- Парсер response иногда понижал `pass -> partial` из-за наивных эвристик (например, JSON-ключ `"issues"` или строки типа `"No blocking issues"` считались “проблемами”).

Это ломало пользу `fidelity-review`: вместо реального “соответствует/не соответствует” мы получали `unknown/partial` без причины.

## Goal / Acceptance Criteria

- [x] Prompt включает **PR-style diff** (committed changes видны) для task/phase/files scope: `git diff <base-branch>...HEAD`.
- [x] Prompt включает **verify evidence** из spec verify-ноды:
  - command + expected
  - output/errors (если `verification_result` не записан, команда выполняется автоматически).
- [x] Default timeout для `sdd-fidelity-review` увеличен до 600s (project-scoped `.claude/ai_config.yaml`), чтобы Codex успевал отвечать на большие prompt’ы.
- [x] Парсинг structured JSON ответа не понижает `pass` в `partial` из-за JSON-ключей/ложных “no/not” эвристик.
- [x] Прогон на реальном спеке бага (`chat-responsemessage-generatingimage-2026-02-10-001`) даёт `consensus_verdict=pass`.

## Non-goals

- Менять формат SDD JSON specs или требования к verify-нодам.
- Гарантировать 100% “умную” интерпретацию build logs (мы лишь прикладываем output, дальше решает модель).

## Scope (what changes)

- Tooling (local, SDD toolkit):
  - `sdd_fidelity_review/review.py`: diff через `<base>...HEAD`, include verify command output, fallback для Spec Title.
  - `common/integrations.py`: увеличен timeout для прямого выполнения verify-команд (docker/build/install).
  - `sdd_fidelity_review/consultation.py`: фиксы эвристик негативных статусов + исключение false downgrade `pass -> partial` для JSON.
- Repo config:
  - `.claude/ai_config.yaml`: `sdd-fidelity-review.consultation.timeout_seconds: 600`.
  - `.gitignore`: игнорировать `.fidelity-reviews/` (локальные артефакты старых запусков).

## Upstream impact

- Upstream-owned files touched:
  - None (только fork-owned meta/config + локальный tooling вне репо).

## Verification

- Fidelity review (real spec):
  - `meta/tools/sdd fidelity-review chat-responsemessage-generatingimage-2026-02-10-001 --phase phase-1 --ai-tools codex --consensus-threshold 1 --base-branch airis_b2c --format json`
  - Expected: `consensus.consensus_verdict == "pass"`, и JSON-артефакт сохранён в `meta/sdd/specs/.fidelity-reviews/`.

## Task Entry (for branch_updates/current_tasks)

- [x] **[BUG][SDD]** Fidelity-review prompt includes git diff + verify outputs
  - Spec: `meta/memory_bank/specs/work_items/2026-02-10__bugfix__sdd-fidelity-review-prompt-includes-diff-and-verify-output.md`
  - Owner: Codex
  - Branch: `codex/bugfix/chat-black-screen-generate-image`
  - Done: 2026-02-10
  - Summary: Исправлены diff/verify evidence в prompt и таймауты/парсинг, чтобы `sdd fidelity-review` давал валидный verdict на закоммиченных изменениях.
  - Tests: `meta/tools/sdd fidelity-review ... --format json` (includes docker vitest + docker vite build evidence)
  - Risks: Low (tooling/config only; не влияет на runtime приложения)

## Risks / Rollback

- Risks:
  - Verify-команды могут занимать заметное время (docker build/tests); добавлен увеличенный timeout для команд.
  - Увеличенный consultation timeout может дольше “висеть” при реальных проблемах провайдера.
- Rollback plan:
  - Откатить изменения в локальном SDD toolkit файлах + удалить `timeout_seconds` из `.claude/ai_config.yaml` при необходимости.

