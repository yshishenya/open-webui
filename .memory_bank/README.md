# Memory Bank: Single Source of Truth for Airis

This Memory Bank is the central knowledge repository for the **Airis** project (private fork of Open WebUI). Before starting any task, you **must** review this file and follow the relevant links.

---

## Mandatory Reading Sequence Before ANY Task

1. **[Tech Stack](./tech_stack.md)**: Learn which technologies, libraries, and versions we use
2. **[Coding Standards](./guides/coding_standards.md)**: Review formatting rules, naming conventions, and best practices
3. **[Current Tasks](./current_tasks.md)**: Check the list of active tasks to understand the team's current focus

---

## Knowledge System Map

### 1. About the Project (Context "WHY")
- **[Product Brief](./product_brief.md)**: Business goals, target audience, key features
  - **Purpose**: Understand *what* we are building and *for whom*
  - **Contents**: Multi-provider AI chat, billing system, RAG, custom tools, admin panel
  - **Target Users**: AI enthusiasts, developers, content creators, businesses

### 2. Technical Foundation (Context "HOW")

#### Core Technologies
- **[Tech Stack](./tech_stack.md)**: Complete list of frameworks, libraries, and their versions
  - **Backend**: Python 3.11+, FastAPI 0.123.0, SQLAlchemy + Peewee, Redis
  - **Frontend**: SvelteKit 2.5.27, TypeScript 5.5.4, Tailwind CSS 4.0.0
  - **Database**: PostgreSQL 16 (production), SQLite (development)
  - **Billing**: YooKassa integration for payments
  - **AI**: OpenAI, Anthropic, Google GenAI, Ollama, LangChain
  - **IMPORTANT**: Prohibited to add new dependencies without updating this file

#### Architectural Patterns
- **[API Standards](./patterns/api_standards.md)**: API design standards
  - RESTful conventions
  - FastAPI router structure
  - Pydantic request/response models
  - Authentication & authorization (JWT)
  - Webhooks (YooKassa, payment processing)

- **[Error Handling](./patterns/error_handling.md)**: Error handling patterns
  - Exception hierarchy
  - HTTPException usage
  - Retry strategies with exponential backoff
  - Circuit breaker pattern
  - Graceful degradation
  - Structured logging with Loguru

#### Development Guides
- **[Coding Standards](./guides/coding_standards.md)**: Coding standards for Python and TypeScript/Svelte
  - Python: PEP 8, type hints, FastAPI patterns, Pydantic models
  - TypeScript: Naming conventions, Svelte component structure, API clients
  - Security best practices
  - Testing guidelines

- **[Testing Strategy](./guides/testing_strategy.md)**: Testing strategy
  - Unit tests with pytest (Python) and Vitest (TypeScript)
  - Integration tests
  - E2E tests with Cypress
  - Minimum 80% code coverage

### 3. Processes and Tasks (Context "WHAT TO DO")

#### Workflows
Step-by-step instructions for standard tasks. Choose the appropriate workflow for your current task:

- **[New Feature Development](./workflows/new_feature.md)**: Process for adding new features
  - Requirements gathering
  - Design and planning
  - Implementation
  - Testing
  - Code review
  - Deployment

- **[Bug Fix](./workflows/bug_fix.md)**: Process for fixing bugs
  - Bug reproduction
  - Root cause analysis
  - Fix implementation
  - Testing
  - Regression prevention

- **[Code Review](./workflows/code_review.md)**: Code review checklist
  - Code quality checks
  - Security review
  - Performance considerations
  - Documentation review

- **[Refactoring](./workflows/refactoring.md)**: Safe refactoring process
  - Identify refactoring opportunities
  - Plan changes
  - Implement incrementally
  - Verify no behavior changes

#### Specifications
- **[Specifications](./specs/)**: Detailed technical specifications for new features
  - Created when planning major features
  - Include requirements, design, API contracts
  - Reference from workflows

---

## Project Philosophy

### Core Principles

1. **AI-First**: Multi-provider LLM support with unified interface
2. **Asynchronous**: All I/O operations are async for maximum performance
3. **Type Safety**: Strict typing (Python type hints, TypeScript) to prevent errors early
4. **Modularity**: Clear separation of concerns (routers, models, utils, services)
5. **Self-Hosted**: Full data control, no vendor lock-in
6. **Extensibility**: Custom functions, tools, pipelines

### Architecture Overview

```
Airis Architecture
├── Backend (Python/FastAPI)
│   ├── Routers (API endpoints)
│   ├── Models (Database ORM)
│   ├── Utils (Business logic, services)
│   ├── Socket (WebSocket for real-time)
│   └── Migrations (Alembic DB migrations)
│
├── Frontend (Svelte/TypeScript)
│   ├── Routes (SvelteKit pages)
│   ├── Components (Reusable UI)
│   ├── APIs (API clients)
│   ├── Stores (Global state)
│   └── i18n (Internationalization)
│
└── Infrastructure
    ├── PostgreSQL (Primary database)
    ├── Redis (Caching, sessions)
    ├── YooKassa (Payment processing)
    └── AI Providers (OpenAI, Anthropic, Google, Ollama)
```

---

## Working Rules

### Rule 1: Document Architectural Changes
If you make changes that affect architecture or add a new dependency, you **must** update the corresponding document in Memory Bank:
- New dependency → Update `tech_stack.md`
- New API pattern → Update `patterns/api_standards.md`
- New error handling → Update `patterns/error_handling.md`
- Architectural decision → Add to `specs/` or relevant guide

### Rule 2: Track Task Progress
Before starting work on a task, always check `current_tasks.md` and update the task status:
- **To Do** → **In Progress** (when you start)
- **In Progress** → **Done** (when you complete)
- Add new tasks as they arise

### Rule 3: Follow Established Patterns
Always follow patterns from `patterns/` and standards from `guides/`:
- API design → `patterns/api_standards.md`
- Error handling → `patterns/error_handling.md`
- Coding style → `guides/coding_standards.md`
- If in doubt → Ask or propose new pattern

### Rule 4: Document External Integrations
All external integrations must be documented and follow API standards:
- Create client class following `patterns/api_standards.md`
- Add error handling per `patterns/error_handling.md`
- Document in `tech_stack.md`
- Add configuration to environment variables

---

## Quick Start for New Contributors

### First Time Setup
1. Read [Product Brief](./product_brief.md) - understand what we're building
2. Read [Tech Stack](./tech_stack.md) - learn the technologies
3. Read [Coding Standards](./guides/coding_standards.md) - learn our conventions
4. Check [Current Tasks](./current_tasks.md) - see what's being worked on

### Before Writing Code
1. Check if similar functionality exists
2. Review relevant patterns in `patterns/`
3. Choose appropriate workflow from `workflows/`
4. Update task status in `current_tasks.md`

### After Writing Code
1. Run tests: `pytest` (backend), `npm test` (frontend)
2. Format code: `black .` (Python), `npm run format` (TypeScript)
3. Type check: `mypy .` (Python), `npm run check` (TypeScript)
4. Update relevant documentation in Memory Bank
5. Request code review following `workflows/code_review.md`

---

## Key Features of Airis

### 1. Multi-Provider AI Integration
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude)
- Google (Gemini)
- Ollama (local models)
- LangChain orchestration

### 2. Billing System
- YooKassa payment integration
- Flexible subscription plans
- Usage tracking (tokens, requests, images, audio)
- Quota enforcement
- Admin dashboard with analytics
- Audit logging for compliance

### 3. Knowledge Base (RAG)
- Document upload and embedding
- Semantic search with pgvector
- Context injection into prompts
- Collections for organization

### 4. Custom Tools & Functions
- JavaScript/Python function execution
- Browser-based code editor (CodeMirror)
- Tool library and sharing
- API integrations

### 5. Advanced Chat Features
- Multi-modal support (text, images, audio, files)
- Real-time collaboration (Yjs CRDT)
- Chat history and search
- Conversation branching
- Public sharing

### 6. Admin Panel
- User management
- Billing plan management
- System configuration
- Audit logs
- LLM evaluation tools

---

## Common Workflows

### Adding a New Feature
```bash
1. Read workflows/new_feature.md
2. Create specification in specs/
3. Update current_tasks.md (add task, set to "In Progress")
4. Implement following coding_standards.md
5. Write tests (minimum 80% coverage)
6. Update relevant documentation
7. Request code review
8. Update current_tasks.md (set to "Done")
```

### Fixing a Bug
```bash
1. Read workflows/bug_fix.md
2. Reproduce the bug
3. Update current_tasks.md (add bug task)
4. Fix following error_handling.md patterns
5. Add regression test
6. Update current_tasks.md (set to "Done")
```

### Integrating External API
```bash
1. Read patterns/api_standards.md
2. Create client class in utils/ or integrations/
3. Implement error handling per patterns/error_handling.md
4. Add configuration to .env.example
5. Update tech_stack.md with new dependency
6. Write unit tests
7. Document usage in relevant guide
```

---

## Troubleshooting

### When Context is Lost
If you feel context was lost or compressed:
1. Use `/refresh_context` slash command (if available)
2. Re-read `.memory_bank/README.md` (this file)
3. Review recent commits: `git log --oneline -10`
4. Check current project state: `git status`

### When Unsure About Architecture
1. Check `tech_stack.md` for allowed technologies
2. Review `patterns/` for established patterns
3. Look at similar existing code in the project
4. Consult `product_brief.md` for project goals

### When Documentation is Outdated
1. Update the relevant file in `.memory_bank/`
2. Add a note in the commit message: `docs: update memory bank - [file changed]`
3. Notify team of significant changes

---

## Project Status

**Current Version**: 0.6.41
**Status**: Active Development
**Last Memory Bank Update**: 2025-12-11
**Active Contributors**: 1 (project maintainer)

---

## Frequently Asked Questions

### Q: Do I need to read all documentation before starting?
**A**: At minimum, read:
1. [Product Brief](./product_brief.md) - what we're building
2. [Tech Stack](./tech_stack.md) - what we're using
3. [Coding Standards](./guides/coding_standards.md) - how we code

Then read relevant workflow based on your task type.

### Q: What if I want to add a new technology/library?
**A**:
1. Check if it aligns with project philosophy
2. Propose it in a discussion (if team exists) or document reasoning
3. Update `tech_stack.md` after approval
4. Update relevant guides if it changes development patterns

### Q: How do I handle errors in this project?
**A**: Follow `patterns/error_handling.md`:
- Use FastAPI's HTTPException for API errors
- Implement retry with backoff for transient errors
- Log all errors with context using Loguru
- Never expose internal details to users

### Q: What's the testing strategy?
**A**: See `guides/testing_strategy.md`:
- Unit tests: pytest (Python), Vitest (TypeScript)
- Minimum 80% code coverage
- Integration tests for critical flows
- E2E tests for user journeys

---

**Remember**: Memory Bank is a living document. Update it as the project evolves. When in doubt, consult Memory Bank first, then ask.

**Main Principle**: If unsure — check Memory Bank, then ask the project owner.
