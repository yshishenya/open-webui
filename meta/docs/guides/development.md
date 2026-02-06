# Development Workflow

## 1) Follow the workflow gate

- Read [Memory Bank](../../memory_bank/README.md) and follow its mandatory reading sequence.
- Pick the appropriate workflow from `meta/memory_bank/workflows/` (new feature / bugfix / refactor / code review).

## 2) Keep upstream diffs small

- Prefer additive fork logic in `src/lib/utils/airis/*` (frontend) and small helpers under `backend/open_webui/utils/` (backend).
- If you must touch upstream-owned files, keep the diff minimal and record “Upstream impact” in the work item spec.

## 3) Docker-first commands (canonical)

The repo exposes wrapper scripts in `package.json` to reduce command drift:

- Backend:
  - Tests: `npm run docker:test:backend`
  - Format: `npm run docker:format:backend`
  - Lint (ruff): `npm run docker:lint:backend`
- Frontend:
  - Tests: `npm run docker:test:frontend`
  - Typecheck: `npm run docker:check:frontend`
  - Lint: `npm run docker:lint:frontend`
  - Format: `npm run docker:format:frontend`

## 4) Task updates (Memory Bank)

- Non-trivial work: create a work item spec under `meta/memory_bank/specs/work_items/`.
- On feature branches: log status in `meta/memory_bank/branch_updates/` and consolidate on integration branch (see `meta/memory_bank/guides/task_updates.md`).
