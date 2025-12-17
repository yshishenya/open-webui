# Technology Stack

## Project Overview
**Airis** - a private fork of Open WebUI, a full-featured web interface for Large Language Models (LLMs) with integrated billing system and multi-provider AI support.

---

## Core Stack

### Backend
- **Language**: Python 3.11+
- **Web Framework**: FastAPI 0.123.0 (async-first, high-performance API framework)
- **Server**: Uvicorn 0.37.0 with uvloop (ASGI server)
- **Async Runtime**: asyncio with async/await patterns

### Frontend
- **Framework**: SvelteKit 2.5.27 (meta-framework for Svelte)
- **Language**: TypeScript 5.5.4
- **UI Library**: Svelte 5.0.0 (reactive UI framework)
- **Build Tool**: Vite 5.4.14
- **Styling**: Tailwind CSS 4.0.0 + PostCSS
- **Node**: 18.13.0 - 22.x.x (required range)

### Database
- **Default**: SQLite (embedded, for development)
- **Production**: PostgreSQL 16-alpine
- **ORM**:
  - SQLAlchemy 2.0.38 (primary, with async support)
  - Peewee 3.18.3 (legacy, for backward compatibility)
- **Migrations**: Alembic 1.17.2

### Caching & Sessions
- **Redis**: In-memory data store
  - Session management (starsessions[redis] 2.2.1)
  - Caching (aiocache)
  - Pub/Sub messaging
  - Rate limiting

---

## Data Validation & Serialization

### Python
- **Pydantic 2.12.5**: Runtime data validation and settings management
- **Pydantic Settings 2.0**: Environment variables management

### TypeScript
- Native TypeScript interfaces for type safety
- Zod validation (implicitly via form validation)

---

## Authentication & Security

### Auth Stack
- **JWT**: PyJWT 2.10.1 with crypto support
- **OAuth/OIDC**: Authlib 1.6.5
- **JWT Legacy**: python-jose 3.5.0
- **Password Hashing**:
  - bcrypt 5.0.0
  - argon2-cffi 25.1.0
- **Encryption**: cryptography library
- **CORS**: Starlette middleware
- **Sessions**: itsdangerous 2.2.0

---

## HTTP & WebSocket

### Backend
- **HTTP Client**: httpx 0.28.1 (async, with http2, socks, brotli, zstd support)
- **Async HTTP**: aiohttp 3.12.15
- **Sync HTTP**: requests 2.32.5 (fallback)
- **WebSocket**: python-socketio 5.15.0 (real-time communication)
- **Compression**: starlette-compress 1.6.1

### Frontend
- **WebSocket**: socket.io-client 4.2.0
- **HTTP**: Native fetch API (async/await)

---

## AI/ML Integrations

### LLM Providers
- **OpenAI**: openai (GPT-4, GPT-3.5, embeddings)
- **Anthropic**: anthropic (Claude models)
- **Google AI**:
  - google-genai 1.52.0
  - google-generativeai 0.8.5
- **Ollama**: Direct integration via HTTP API
- **LangChain**: langchain 0.3.27 + langchain-community 0.3.29

### ML Libraries
- **Tokenization**: tiktoken (OpenAI tokenizer)
- **Embeddings**:
  - sentence-transformers 5.1.2
  - transformers 4.57.3
- **Vector Search**: pgvector 0.4.1 (PostgreSQL extension)
- **Model Context Protocol**: mcp 1.22.0

### On-Device AI (Frontend)
- **Transformers.js**: @huggingface/transformers 3.0.0 (browser inference)
- **MediaPipe**: @mediapipe/tasks-vision 0.10.17 (vision tasks)
- **Pyodide**: pyodide 0.28.2 + @pyscript/core 0.4.32 (Python in browser)

---

## Payment & Billing

### Payment Gateway
- **Provider**: YooKassa (Russian payment aggregator)
- **Integration**: Custom async client (utils/yookassa.py)
- **Features**:
  - One-time payments
  - Recurring subscriptions
  - Webhook handling with signature verification
  - Multi-currency support (default: RUB)

### Billing System
- **Models**: Plan, Subscription, Usage, Transaction, AuditLog
- **Quotas**: Tokens (input/output), requests, images, audio minutes
- **Enforcement**: Middleware-based quota checks
- **Audit**: Complete admin action logging

---

## Frontend UI Components

### Core UI
- **Component Library**: bits-ui 0.21.15 (headless components)
- **Rich Text Editor**: TipTap 3.0.7 (ProseMirror-based)
  - Extensions: tables, code blocks, images, YouTube, mentions, file handling
- **Code Editor**: CodeMirror 6.0.1
  - Languages: JavaScript, Python, Elixir, HCL
  - Theme: One Dark
- **Markdown**: marked 9.1.0 + turndown 7.2.0 (MD ↔ HTML)
- **Diagrams**: mermaid 11.10.1
- **Math**: katex 0.16.22
- **Charts**: chart.js 4.5.0
- **Maps**: leaflet 1.9.4
- **Drag & Drop**: sortablejs 1.15.6
- **Notifications**: svelte-sonner 0.3.19
- **Tooltips**: tippy.js 6.3.7
- **Zoom/Pan**: panzoom 9.4.3
- **Flow Charts**: @xyflow/svelte 0.1.19

### Document Processing
- **PDF**:
  - Frontend: pdfjs-dist 5.4.149 (viewer)
  - Backend: Generate with jsPDF or server-side tools
- **Images**:
  - HEIC conversion: heic2any 0.0.4
  - Screenshot: html2canvas-pro 1.5.11
- **File Saving**: file-saver 2.0.5

### Collaboration
- **Real-time Editing**:
  - Yjs 13.6.27 (CRDT for sync)
  - y-prosemirror 1.3.7 (ProseMirror binding)
  - prosemirror-collab 1.3.1

---

## Code Quality & Testing

### Python
- **Linting**: pylint, ruff 0.1+ (fast Python linter)
- **Formatting**: black (line length: 88-100)
- **Type Checking**: mypy 1.7+ (strict mode)
- **Testing**:
  - pytest 7.4+
  - pytest-asyncio 0.21+ (async test support)
  - pytest-cov 4.1+ (coverage reporting)
  - pytest-mock (mocking)
- **Minimum Coverage**: 80%

### TypeScript/JavaScript
- **Linting**: ESLint 8.56.0 + @typescript-eslint
- **Formatting**: Prettier 3.3.3
- **Testing**: Vitest 1.6.1
- **E2E Testing**: Cypress 13.15.0
- **Type Checking**: svelte-check 4.0.0

### Pre-commit
- black, ruff, mypy hooks
- Prettier, ESLint hooks
- Auto-fix on commit

---

## Background Jobs & Scheduling

- **Scheduler**: APScheduler 3.10.4
- **Tasks**: Periodic cleanup, subscription renewals, usage aggregation
- **Execution**: Restricted Python environment (RestrictedPython 8.0)

---

## Storage & Files

### Backend
- **Async File I/O**: aiofiles
- **Multipart Upload**: python-multipart 0.0.20
- **Storage**: Local filesystem or S3-compatible

### Frontend
- **IndexedDB**: idb 7.1.1 (client-side storage)
- **Blob Handling**: file-saver, heic2any

---

## Logging & Monitoring

### Logging
- **Library**: loguru 0.7.3 (structured logging)
- **Levels**: DEBUG, INFO, WARNING, ERROR, CRITICAL
- **Format**: Structured JSON logs with context
- **Configuration**: Per-module log levels via env vars

### Example:
```python
from loguru import logger

logger.info("Processing payment", user_id=user.id, amount=100)
logger.error("Payment failed", error=str(e), exc_info=True)
```

---

## Development Tools

### Package Management
- **Python**: pip + requirements.txt (no Poetry in this project)
- **Node**: npm 6.0.0+

### Containerization
- **Docker**: Multi-stage builds
- **Docker Compose**: Local development setup
- **Base Images**:
  - PostgreSQL: postgres:16-alpine
  - Application: ghcr.io/open-webui/open-webui

### Environment Variables
- Managed via `.env` file
- Loaded by Pydantic Settings
- Never committed to Git

---

## Database Schema Management

### Migrations
- **Tool**: Alembic 1.17.2
- **Location**: backend/open_webui/migrations/versions/
- **Naming**: `{revision}_{description}.py`
- **Example**: b2f8a9c1d5e3_add_billing_tables.py

### Indexes
- User lookups: user_id, email
- Billing: subscription status, payment status, usage periods
- Performance: created_at, updated_at timestamps

---

## Internationalization (i18n)

### Backend
- Multi-language support for billing (EN/RU)
- Database fields: name, name_ru, description, description_ru

### Frontend
- **Library**: i18next 23.10.0
- **Detection**: i18next-browser-languagedetector 7.2.0
- **Dynamic Loading**: i18next-resources-to-backend 1.2.0
- **Locales**: src/lib/i18n/locales/{en-US,ru-RU}/translation.json
- **Parser**: i18next-parser 9.0.1

---

## Security Best Practices

### Enforced Rules
1. **No secrets in code** - all via environment variables
2. **Input validation** - Pydantic for all inputs
3. **SQL injection prevention** - ORM only, parameterized queries
4. **Password security** - bcrypt/argon2, never plain text
5. **HTTPS only** - all external API calls
6. **CORS configuration** - explicit allowed origins
7. **XSS prevention** - DOMPurify 3.2.6 (HTML sanitization)
8. **Dependencies** - regular updates and security audits

---

## Performance Optimization

### Backend
- **Async I/O**: All database and HTTP operations async
- **Connection Pooling**:
  - Database: SQLAlchemy pool (configurable size)
  - HTTP: httpx connection pooling
- **Caching**: Redis for frequently accessed data
- **Compression**: Gzip/Brotli middleware
- **Rate Limiting**: Per-user, per-endpoint limits

### Frontend
- **Code Splitting**: Vite automatic chunking
- **Lazy Loading**: Dynamic imports for routes
- **Bundle Size**: Tree-shaking, minimal dependencies
- **Static Assets**: CDN-ready (via adapter-static)

---

## Forbidden Practices

### Backend
1. Synchronous I/O in async code (blocks event loop)
2. Using `Any` type hints (defeats type safety)
3. Raw SQL without parameterization (SQL injection risk)
4. Empty exception handlers (`except: pass`)
5. Storing secrets in code or Git
6. Blocking operations in request handlers

### Frontend
1. Inline styles (use Tailwind classes)
2. Direct DOM manipulation (use Svelte reactivity)
3. Untyped API calls (use TypeScript interfaces)
4. Large bundle imports (lazy load when possible)

---

## Project Structure

```
airis/
├── backend/
│   ├── open_webui/
│   │   ├── routers/           # FastAPI endpoints
│   │   ├── models/            # SQLAlchemy/Peewee models
│   │   ├── utils/             # Business logic & services
│   │   ├── internal/          # Infrastructure (DB, config)
│   │   ├── migrations/        # Alembic migrations
│   │   ├── socket/            # WebSocket handlers
│   │   └── storage/           # File storage
│   ├── requirements.txt       # Python dependencies
│   └── start.sh               # Startup script
│
├── src/
│   ├── routes/                # SvelteKit pages
│   │   ├── (app)/             # Protected routes
│   │   │   ├── admin/         # Admin panel
│   │   │   ├── billing/       # User billing
│   │   │   ├── workspace/     # Content management
│   │   │   └── c/[id]/        # Chat page
│   │   ├── auth/              # Authentication
│   │   └── api/               # API routes
│   ├── lib/
│   │   ├── apis/              # API clients
│   │   ├── components/        # Svelte components
│   │   ├── stores/            # Global state
│   │   ├── utils/             # Helper functions
│   │   └── i18n/              # Translations
│   └── app.html               # HTML template
│
├── package.json               # Node dependencies
├── tsconfig.json              # TypeScript config
├── tailwind.config.js         # Tailwind config
├── vite.config.js             # Vite config
├── docker-compose.yaml        # Docker setup
└── .env                       # Environment variables (not in Git)
```

---

## Version Control

### Git Workflow
- **Branch Naming**:
  - `feature/{description}` - New features
  - `bugfix/{description}` - Bug fixes
  - `hotfix/{description}` - Production fixes
  - `docs/{description}` - Documentation
  - `refactor/{description}` - Code refactoring

### Commit Messages (Conventional Commits)
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style (formatting, no logic change)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

---

## Last Updated
**Date**: 2025-12-11
**Python Version**: 3.11+
**Node Version**: 18.13.0 - 22.x.x
**Framework**: FastAPI 0.123.0 + SvelteKit 2.5.27
