# SDD fidelity review model fallbacks (Codex/OpenCode)

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/admin-wallet-adjustment-rub-input
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-10
- Updated: 2026-02-10

## Context

`sdd fidelity-review` в текущем окружении нестабильно работал для предпочитаемых моделей:
- `gpt-5.3-codex` недоступна / отдаёт ошибку доступа (используем `gpt-5.2-codex`).
- `openrouter/moonshotai/kimi-k2.5:free` падал с 401 при отсутствии OpenRouter credentials.

Нужен fail-safe, чтобы запуск не ломался и автоматически переходил на рабочие модели.

## Goal / Acceptance Criteria

- [x] В Codex provider реализован fallback `gpt-5.3-codex -> gpt-5.2-codex` по маркеру ошибки доступа к модели.
- [x] В OpenCode provider реализован fallback `openrouter/*` (включая Kimi) -> `opencode/big-pickle` по маркеру auth 401.
- [x] В результате `provider.generate(...)` возвращает успешный ответ с `model_fallback` metadata для обоих сценариев.
- [x] Проектный `.claude/ai_config.yaml` содержит `sdd-fidelity-review` конфигурацию с приоритетом `codex`, `opencode`.

## Scope (what changes)

- Config/Env:
  - Обновлён `.claude/ai_config.yaml` (`sdd-fidelity-review`).
  - Обновлён `.gitignore` (игнорировать `meta/sdd/specs/.fidelity-reviews/` как генерируемые артефакты).
- Tooling (local):
  - Обновлён Codex provider fallback logic.
  - Обновлён OpenCode provider fallback logic.

## Implementation Notes

- Key files/entrypoints:
  - `/Users/yshishenya/.codex/tools/claude-sdd-toolkit/src/claude_skills/claude_skills/common/providers/codex.py`
  - `/Users/yshishenya/.codex/tools/claude-sdd-toolkit/src/claude_skills/claude_skills/common/providers/opencode.py`
  - `.claude/ai_config.yaml`
- Fallback behavior:
  - Codex: retry once с `gpt-5.2-codex`, если `gpt-5.3-codex` недоступна.
  - OpenCode: retry once с `opencode/big-pickle`, если OpenRouter модель возвращает auth 401.

## Upstream impact

- Upstream-owned files touched:
  - None (repo config + local tooling only).

## Verification

- Syntax:
  - `python -m py_compile /Users/yshishenya/.codex/tools/claude-sdd-toolkit/src/claude_skills/claude_skills/common/providers/codex.py`
  - `python -m py_compile /Users/yshishenya/.codex/tools/claude-sdd-toolkit/src/claude_skills/claude_skills/common/providers/opencode.py`
- Provider smoke checks:
  - Codex fallback:
    - `PYTHONPATH=/Users/yshishenya/.codex/tools/claude-sdd-toolkit/src/claude_skills python - <<'PY' ... model='gpt-5.3-codex' ...`
    - Result: `model_fqn=codex:gpt-5.2-codex`, `model_fallback={'requested':'gpt-5.3-codex','used':'gpt-5.2-codex'}`.
  - OpenCode fallback:
    - `PYTHONPATH=/Users/yshishenya/.codex/tools/claude-sdd-toolkit/src/claude_skills python - <<'PY' ... model='openrouter/moonshotai/kimi-k2.5:free' ...`
    - Result: `model_fqn=opencode:opencode/big-pickle`, `model_fallback={'requested':'openrouter/moonshotai/kimi-k2.5:free','used':'opencode/big-pickle'}`.

## Task Entry (for branch_updates/current_tasks)

- [x] **[BUG][SDD][AI-CONFIG]** Fidelity review fallback for model availability/auth issues
  - Spec: `meta/memory_bank/specs/work_items/2026-02-10__bugfix__sdd-fidelity-review-model-fallbacks.md`
  - Owner: Codex
  - Branch: `codex/bugfix/admin-wallet-adjustment-rub-input`
  - Done: 2026-02-10
  - Summary: Добавлены автоматические fallback-механизмы для Codex/OpenCode при ошибках модели/авторизации; обновлён проектный `ai_config`.
  - Tests: py_compile + provider smoke checks
  - Risks: Low (локальные tooling/config изменения)
