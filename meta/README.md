# Project Meta: Docs, Plans, and Specs (Single Root)

This directory is the **single home** for project-specific process documentation, plans, and specs.
(In this repo: **Airis**, a private fork of Open WebUI.)

## Start Here

- **Memory Bank (source of truth)**: `memory_bank/README.md`
  - Mandatory reading sequence, workflows, patterns, task updates.
- **Project docs (sharded)**: `docs/README.md`
  - Architecture/guides/reference (runtime + development).
- **SDD (Spec-Driven Development)**: `sdd/README.md`
  - How to use SDD in this repo (via wrapper).
- **Universal workflow (reusable)**: `memory_bank/guides/universal_ai_workflow.md`
  - A stable, project-agnostic workflow for AI-assisted development.

## Tools

- SDD wrapper (always uses `sdd/specs`): `tools/sdd`
- Markdown link checker: `python3 tools/check_markdown_links.py`
- Task updates helper: `tools/merge_task_updates.sh`
- Git hooks setup: `tools/setup_git_hooks.sh`
