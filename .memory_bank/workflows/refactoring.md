# Refactoring Process

## 1. Preparation

- [ ] Define the refactoring goal and non-goals
- [ ] Identify what must NOT change (public behavior, API contracts, data model)
- [ ] Create a branch from the base branch (usually `main`): `refactor/short-description`
- [ ] Log task update per **[../guides/task_updates.md](../guides/task_updates.md)**

## 2. Safety Net

- [ ] Ensure relevant tests exist before refactoring
- [ ] If missing, add tests first (or include as the first commit)

## 3. Refactor Incrementally

- [ ] Small steps with frequent local verification
- [ ] Prefer mechanical refactors (rename, extract, move) before logic changes
- [ ] Run relevant tests before each commit (or at least after each meaningful step)
- [ ] Keep diffs reviewable

## 4. Verification

- [ ] Backend tests: `pytest`
- [ ] Frontend tests: `npm run test:frontend`
- [ ] E2E tests (when relevant): `npm run test:e2e`

## 5. Code Quality

- [ ] Backend formatting: `black .`
- [ ] Backend linting: `npm run lint:backend` (pylint)
- [ ] Frontend formatting: `npm run format`
- [ ] Frontend linting/typecheck: `npm run lint:frontend` and `npm run check`

## 6. Documentation

- [ ] Update docs if you changed structure, patterns, or dev commands

## 7. Completion

- [ ] Log task status update per **[../guides/task_updates.md](../guides/task_updates.md)** to "Done"
- [ ] Use detailed commit message template from **[../guides/commit_messages.md](../guides/commit_messages.md)**
- [ ] Create commit(s) with Conventional Commits messages (`refactor: ...`)
- [ ] Push the branch: `git push -u origin refactor/short-description`
- [ ] Open a PR with:
  - Motivation (why refactor)
  - Scope (what changed)
  - Proof behavior is unchanged (tests + any manual checks)
