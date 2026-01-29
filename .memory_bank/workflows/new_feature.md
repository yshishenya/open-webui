# New Feature Development Process

## 1. Preparation

### 1.1 Branch Setup

- [ ] Create a branch from the base branch (usually `main`) following the template `feature/short-description`
  - Example: `feature/add-public-pricing-config`

### 1.2 Task Tracking

- [ ] Add/update the task in **[../current_tasks.md](../current_tasks.md)**
- [ ] Set status to "In Progress"

### 1.3 Requirements

- [ ] Clarify goal, scope, and acceptance criteria
- [ ] For larger features: create/update a spec in **[../specs/](../specs/)**

## 2. Design

- [ ] Identify existing components to reuse (avoid re-inventing)
- [ ] Map required API changes + UI changes
- [ ] Confirm environment variables and configuration impacts

## 3. Implementation

- [ ] Implement incrementally (small reviewable steps)
- [ ] Follow **[../guides/coding_standards.md](../guides/coding_standards.md)**
- [ ] Follow **[../patterns/api_standards.md](../patterns/api_standards.md)** for new endpoints
- [ ] Follow **[../patterns/error_handling.md](../patterns/error_handling.md)** for external calls and failure modes

## 4. Testing

- [ ] Backend unit/integration tests: `pytest`
- [ ] Frontend unit tests: `npm run test:frontend`
- [ ] E2E tests (when relevant): `npm run test:e2e`
- [ ] Keep coverage in mind; focus on critical paths and error cases

## 5. Code Quality

- [ ] Backend formatting: `black .`
- [ ] Backend linting: `npm run lint:backend` (pylint)
- [ ] Frontend formatting: `npm run format`
- [ ] Frontend linting/typecheck: `npm run lint:frontend` and `npm run check`

## 6. Documentation

- [ ] Update Memory Bank docs if architecture/commands/config changed
- [ ] Update user/deploy/billing docs if feature affects them

## 7. Completion

- [ ] Update task status in **[../current_tasks.md](../current_tasks.md)** to "Done"
- [ ] Create commit(s) with Conventional Commits messages (`feat: ...`, `docs: ...`)
- [ ] Push branch and open PR
