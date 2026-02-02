# Assistant Tooling (Codex + OpenCode)

This project uses the same workflow rules across different coding assistants. The canonical rules live in `AGENTS.md` and the Memory Bank.

## Codex (this CLI)

- **Rules**: `AGENTS.md` (project root)
- **Skills**: `.codex/skills/`
  - Workflow compliance skill: `.codex/skills/workflow-compliance/SKILL.md`
- **Worktrees + Local Environments**
  - Codex worktrees live outside the repo (typically under `~/.codex/worktrees/...`).
  - Setup scripts should not assume `../open-webui/...` paths; derive the main checkout from `git rev-parse --git-common-dir` or rely on `$PWD` when `$wt` is empty.
  - Airis requires **Python >= 3.11**; if you choose a local-venv workflow and `python3` resolves to macOS `/usr/bin/python3` (often 3.9), `pip install -r backend/requirements.txt` will fail (e.g. `uvicorn==0.40.0`).
  - For a Docker-first workflow, prefer running tests/linters via `docker compose` Actions and avoid local dependency installs in worktrees.
  - Codex-specific helper services for Actions live in `.codex/docker-compose.codex.yaml` (e.g. `pytools`, `e2e`) and are composed on top of `docker-compose.yaml` + `docker-compose.dev.yaml`.

## OpenCode

- **Rules**: `AGENTS.md` (project root) + optional global rules in `~/.config/opencode/AGENTS.md`
- **Auto-loaded docs**: `opencode.json` (project root) `instructions` list
- **Custom commands**: `.opencode/commands/` (project) and `~/.config/opencode/commands/` (global)
- **Custom agents**: `.opencode/agents/` (project) and `~/.config/opencode/agents/` (global)
- **Skills**: `.opencode/skills/` (project) and `~/.config/opencode/skills/` (global)
  - Workflow compliance skill: `.opencode/skills/workflow-compliance/SKILL.md`

## Notes

- `opencode.json` is used to auto-load the mandatory Memory Bank docs because OpenCode does not expand file references in `AGENTS.md`.
- When updating workflow rules, keep Codex and OpenCode skills in sync.
