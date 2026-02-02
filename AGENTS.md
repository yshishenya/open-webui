# Claude Code Configuration for Airis

## At the Start of ANY Work Session

**MANDATORY** perform the following actions:

1. Read the **`.memory_bank/README.md`** file completely.
2. Follow the mandatory reading sequence instructions from this file:
   - **[Tech Stack](.memory_bank/tech_stack.md)**: Learn which technologies, libraries and versions we use
   - **[Coding Standards](.memory_bank/guides/coding_standards.md)**: Formatting rules, naming conventions and best practices
   - **[Current Tasks](.memory_bank/current_tasks.md)**: List of active tasks and current team focus
3. Follow links to relevant documents depending on task type:
   - For new features → study specification in `.memory_bank/specs/`
   - For bugs → study workflow `.memory_bank/workflows/bug_fix.md`
   - For technology questions → check `.memory_bank/tech_stack.md`

---

## About the Project: Airis

**Airis** - Chat with LLM

### Key Project Features:

#### 1. Backend Architecture

- Backend: **Python** (3.11-3.12)
- **Framework**: FastAPI
- Async-first: I/O via async/await where applicable
- Routers live in `backend/open_webui/routers/`; services/helpers in `backend/open_webui/utils/`

#### 2. AI/LLM Integration

- Multi-provider support (OpenAI/Anthropic/Google/Ollama)
- Prefer provider clients already used in the repo
- Wrap unstable external calls with retries/timeouts where appropriate

#### 3. Async/Await Patterns

**CRITICALLY IMPORTANT:**

- All I/O operations (HTTP requests, database queries) MUST be asynchronous
- Use `async def` and `await` for all functions with I/O
- For HTTP requests use **httpx**, NOT requests
- **FORBIDDEN** to block event loop with synchronous calls

Correct approach example:

```python
import httpx

async def fetch_data(url: str) -> dict[str, object]:
    """Asynchronously fetch JSON payload."""
    async with httpx.AsyncClient() as client:
        response = await client.get(url, timeout=10.0)
        response.raise_for_status()
        return response.json()
```

#### 4. External API Integrations

- Prefer existing provider clients and patterns already used in the repo
- Centralize non-trivial integrations in `backend/open_webui/utils/`
- Include error handling according to `.memory_bank/patterns/error_handling.md`
- Never log secrets; log context (request id/user id) where available

#### 5. Application-Specific Patterns

**When working with the application:**

- Use FastAPI routers for API endpoints (see `backend/open_webui/routers/`)
- Prefer service/helper functions in `backend/open_webui/utils/` for business logic
- Handle errors gracefully: return user-safe `HTTPException` details; log the real error
- Keep feature flags and config in environment variables (see `.env.example`, `backend/open_webui/env.py`)
- Avoid blocking the event loop; use async I/O where available

#### 6. Data Processing & Storage

- **PostgreSQL** for production data; SQLite used in dev/tests where configured
- **Redis** for caching/sessions and other features
- Billing and other persistence models are under `backend/open_webui/models/`
- Use migrations (Alembic) for database schema changes
- Data validation via Pydantic models in routers/services

---

## Self-Documentation Principle

**IMPORTANT**: You not only read from Memory Bank, but also **update it**.

When performing tasks you MUST:

- **Worktree-safe docs workflow (no conflicts):**
  - **On any non-integration branch** (`feature/*`, `bugfix/*`, `refactor/*`, `docs/*`) **do not edit** `.memory_bank/current_tasks.md`.
  - Create a **work item spec** (one file per task) under `.memory_bank/specs/work_items/` (see `.memory_bank/specs/README.md`).
  - Append status updates to `.memory_bank/branch_updates/<YYYY-MM-DD>-<branch-slug>.md` and include `Spec: <path>` linking the work item spec.
  - **Only on the integration branch** (e.g. `airis_b2c`), consolidate `branch_updates` into `.memory_bank/current_tasks.md` and delete processed branch logs.
  - **Do not edit shared “plan/strategy” specs from multiple branches**; create a new work item spec that references the plan and captures deltas.
  - Follow `.memory_bank/guides/task_updates.md` for the full workflow (including branch name sanitizing for worktrees).
- **Workflow compliance gate (mandatory):**
  - Identify the task type and load the matching workflow doc before making changes.
  - If any mandatory step cannot be completed, stop and ask the user before proceeding.
  - In the first response, state the chosen workflow and the steps you will follow.
  - In the final response, include a short checklist of workflow steps (Completed/Pending).
- Create/update documentation in `.memory_bank/guides/` when implementing new subsystems
- Update `.memory_bank/tech_stack.md` when adding new dependencies
- Create new patterns in `.memory_bank/patterns/` when making architectural decisions
- Add specifications in `.memory_bank/specs/` for new features

---

## Workflow Selection: Choosing the Right Process

Before starting any task, determine its type and choose the corresponding workflow:

### 1. New Feature

**When to use**: Adding new capability to the bot
**Workflow**: `.memory_bank/workflows/new_feature.md`
**Examples**:

- Adding new bot command
- Integration with new external API
- Creating new report type

### 2. Bug Fix

**When to use**: Something doesn't work as expected
**Workflow**: `.memory_bank/workflows/bug_fix.md`
**Examples**:

- Bot doesn't respond to command
- Error in data processing
- Incorrect logic in existing function

### 3. Code Review

**When to use**: Quality check before merge
**Workflow**: `.memory_bank/workflows/code_review.md`
**What to check**:

- Compliance with coding standards
- Correct async/await usage
- Error handling
- Type hints
- Tests

---

## Forbidden Actions

**NEVER** do the following:

1. **Don't add new dependencies** without updating `.memory_bank/tech_stack.md`
2. **Don't violate patterns** from `.memory_bank/patterns/`
3. **Don't reinvent** what already exists in the project
4. **Don't use `Any`** in type hints - always specify concrete types
5. **Don't do synchronous I/O** in asynchronous code
6. **Don't store secrets** in code - only via environment variables
7. **Don't write SQL manually** - use ORM or parameterized queries
8. **Don't ignore errors** through empty `except` blocks

---

## Mandatory Checks Before Starting Work

Before writing code ALWAYS check:

1. **Tech Stack** (`.memory_bank/tech_stack.md`):

   - Which libraries are allowed for this task?
   - Which practices are forbidden?

2. **Existing Components**:

   - Does this functionality already exist?
   - Which modules can be reused?

3. **Patterns** (`.memory_bank/patterns/`):

   - How to properly handle errors in this project?
   - Which API standards to use?

4. **Current Tasks + Task Updates** (`.memory_bank/current_tasks.md`, `.memory_bank/guides/task_updates.md`):
   - Does my task conflict with others?
   - Log status updates per task_updates (branch_updates on feature/bugfix; consolidate on integration).

---

## When Context is Lost

If you feel context was lost or compressed:

1. Use `/refresh_context` command (if available)
2. Re-read `.memory_bank/README.md`
3. Study recent commits to understand current state:
   ```bash
   git log --oneline -10
   ```
4. Check current project status:
   ```bash
   git status
   ```

---

## Type Safety Requirements

- All new/modified functions must have type hints.
- Avoid `Any` unless there is a strong reason.

---

## Testing Requirements

This repo is **Docker Compose-first** (especially for Codex Actions).

- Backend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest"`
- Frontend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/vitest ]; then npm ci --legacy-peer-deps; fi; npm run test:frontend"`
- E2E tests when relevant: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps e2e "npm ci && npm run test:e2e"`

---

## Error Handling Requirements

- Wrap external calls with timeouts and explicit error handling.
- Return user-safe `HTTPException` details; log the real error.

---

## Logging Standards

- Prefer standard `logging` (it is routed into Loguru via `backend/open_webui/utils/logger.py`).
- Never log secrets.

---

## Environment Configuration

- All configuration is via environment variables (see `.env.example`, `backend/open_webui/env.py`).
- Never commit `.env`.

---

## Git Workflow

- Branch naming: `feature/...`, `bugfix/...`, `docs/...`
- Before committing:
  - Backend tests + format: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest && black ."`
  - Backend lint (ruff): use Codex Action `ruff (docker)` or run `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps pytools "python -m pip install -U pip >/dev/null && python -m pip install -q 'ruff>=0.1' && ruff check backend"`
  - Frontend: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/eslint ]; then npm ci --legacy-peer-deps; fi; npm run test:frontend && npm run check && npm run lint:frontend"`
 - Commit messages must follow the detailed template in `.memory_bank/guides/commit_messages.md`
 - Run `scripts/setup_git_hooks.sh` once per clone to enforce commit message policy automatically

**Main Principle**: If unsure - ask the user or re-read documentation in Memory Bank.
