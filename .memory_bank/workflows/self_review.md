# Self Review Checklist

Use this checklist before requesting review or merging.

## 1. Behavior

- [ ] Change matches requirements / acceptance criteria
- [ ] No accidental breaking changes
- [ ] Error handling is explicit and user-safe

## 2. Tests

- [ ] Backend tests pass: `pytest`
- [ ] Frontend tests pass: `npm run test:frontend`
- [ ] E2E tests pass when relevant: `npm run test:e2e`

## 3. Code Quality

- [ ] Backend formatted: `black .`
- [ ] Backend linted: `npm run lint:backend` (pylint)
- [ ] Frontend formatted: `npm run format`
- [ ] Frontend linted: `npm run lint:frontend`
- [ ] Frontend typecheck passes: `npm run check`

## 4. Security

- [ ] No secrets in code/logs
- [ ] No PII leaks
- [ ] External calls have timeouts + sane failure modes

## 5. Documentation

- [ ] Updated Memory Bank files if something became outdated
- [ ] Updated user-facing docs (billing/deploy/etc.) if needed
