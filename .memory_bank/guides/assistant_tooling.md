# Assistant Tooling (Codex + OpenCode)

This project uses the same workflow rules across different coding assistants. The canonical rules live in `AGENTS.md` and the Memory Bank.

## Codex (this CLI)

- **Rules**: `AGENTS.md` (project root)
- **Skills**: `.codex/skills/`
  - Workflow compliance skill: `.codex/skills/workflow-compliance/SKILL.md`

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
