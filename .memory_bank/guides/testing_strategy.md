# Testing Strategy

This repository is an Airis fork of Open WebUI.

## Test Layers

- Unit tests: business logic, helpers, small services.
- Integration tests: routers + DB + billing flows.
- E2E tests: critical user scenarios with Playwright.

## Commands

This project is **Docker Compose-first** (especially for Codex Actions). Prefer running commands inside containers.

### Backend (Python)

- Run tests:
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest"`

### Frontend (SvelteKit)

- Unit tests (Vitest):
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/vitest ]; then npm ci --legacy-peer-deps; fi; npm run test:frontend"`
- Typecheck (svelte-check):
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/svelte-check ]; then npm ci --legacy-peer-deps; fi; npm run check"`
- Lint (ESLint):
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/eslint ]; then npm ci --legacy-peer-deps; fi; npm run lint:frontend"`

### E2E

- Run E2E tests:
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps e2e "npm ci && npm run test:e2e"`

## Coverage

- Target: 80%+ on critical paths.
- Prefer meaningful assertions over chasing a number.

## Best Practices

- Test behavior, not implementation.
- Keep tests deterministic: avoid real network calls and time-dependent logic.
- For billing, always cover:
  - happy path
  - insufficient funds / quota exceeded
  - disabled feature flags (wallet/subscriptions/lead magnet)
  - malformed requests
