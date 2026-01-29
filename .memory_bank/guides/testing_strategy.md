# Testing Strategy

This repository is an Airis fork of Open WebUI.

## Test Layers

- Unit tests: business logic, helpers, small services.
- Integration tests: routers + DB + billing flows.
- E2E tests: critical user scenarios with Playwright.

## Commands

### Backend (Python)

- Run tests: `pytest`

### Frontend (SvelteKit)

- Unit tests (Vitest): `npm run test:frontend`
- Typecheck (svelte-check): `npm run check`
- Lint (ESLint): `npm run lint:frontend`

### E2E

- Run E2E tests: `npm run test:e2e`

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
