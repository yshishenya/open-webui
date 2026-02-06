# Code Review Fixes: Recent Commits (2026-02-05..2026-02-06)

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/code-review-fixes-2026-02-06
- Created: 2026-02-06
- Updated: 2026-02-06

## Context

User requested a careful end-to-end code review of the most recent commits (dated 2026-02-05 and
2026-02-06 on `airis_b2c`), followed by fixes for all issues found.

This work item tracks:

- Findings discovered while reviewing the commit range.
- The minimal-risk fixes applied on a dedicated branch.

## Goal / Acceptance Criteria

- [x] Review findings are documented with severity and file references.
- [x] All actionable findings are fixed (or explicitly documented as "won't fix" with rationale).
- [x] No new dependencies added without updating `meta/memory_bank/tech_stack.md`.
- [x] Fork diff remains minimal: prefer additive changes and thin hooks.
- [x] Relevant automated tests pass (see Verification).

## Non-goals

- Re-architecting existing flows (auth/billing/chat UX) beyond bugfix-level changes.
- Large refactors or formatting-only churn in upstream-owned files.
- Changing public contracts unless required to fix correctness/security issues.

## Scope (what changes)

- Backend:
  - Fix correctness/security issues found in recent auth/billing changes.
  - Tighten validation/error handling where needed.
- Frontend:
  - Fix UX/data-flow issues for billing blocked recovery and Telegram auth UI.
  - Ensure return-to / deep link handling is safe (no open-redirect).
- Config/Env:
  - Validate new env vars are documented and wired consistently.
- Docs:
  - Update Memory Bank only if needed to reflect behavior changes or new config.

## Implementation Notes

- Review range (initial): commits dated 2026-02-05..2026-02-06 on `airis_b2c`.
- High-risk areas:
  - Telegram Login Widget auth (HMAC/TTL/replay) and account link/unlink.
  - Return-to-chat flow from billing blocked surfaces (open redirect / state loss).
  - Billing settings caps validation and any server-side enforcement alignment.

## Upstream impact

This work item may touch upstream-owned files, but changes should be minimized and ideally routed
through fork-owned helpers when possible.

- Upstream-owned files touched:
  - `backend/open_webui/routers/auths.py` (Telegram signup/linking flow; signout cookie handling)
  - `backend/open_webui/models/users.py` (correctness fix in `get_user_by_oauth_sub`)
  - `backend/open_webui/test/apps/webui/routers/test_auths.py` (regression coverage for auth endpoints)
  - `src/routes/auth/+page.svelte` (Telegram signup gating + safer redirect handling)
  - `src/routes/welcome/+page.svelte` (safer redirect handling)
  - `src/lib/apis/auths/index.ts` (Telegram signup payload: legal acceptances)
  - `src/lib/components/chat/Chat.svelte` (remove debug logging)
  - `src/lib/components/chat/Settings/Account.svelte` (remove debug logging + i18n strings for Telegram state)
  - `src/lib/i18n/locales/en-US/translation.json` (new i18n keys)
  - `src/lib/i18n/locales/ru-RU/translation.json` (new i18n keys)
  - `meta/docs/guides/telegram-auth.md` (operator documentation for Telegram auth)
- Why unavoidable:
  - Security/correctness fixes required touching the auth router and auth pages directly (terms/privacy acceptance
    enforcement for Telegram signup and open-redirect hardening for `redirect` query param).
  - Correctness fix required adjusting DB query logic in `Users.get_user_by_oauth_sub`.
- Minimization strategy:
  - Prefer additive helpers under `src/lib/utils/airis/*` and small hook-style edits elsewhere.
  - Keep Airis-specific logic isolated in `src/lib/utils/airis/return_to.ts` and call it from routes.

## Verification

Run the fastest meaningful checks for the touched areas (Docker Compose-first):

- Backend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest"`
- Backend lint (ruff): `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps pytools "python -m pip install -U pip >/dev/null && python -m pip install -q 'ruff>=0.1' && ruff check backend"`
- Frontend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend"`
- Frontend typecheck: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run check"`
- Frontend lint: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run lint:frontend"`

Verification executed for this work item:

- Backend tests (targeted): `pytest -q open_webui/test/util/test_telegram_auth.py open_webui/test/apps/webui/routers/test_auths.py` (19 passed)
- Backend lint (ruff): `ruff check` for modified backend files only (full `ruff check backend` fails with many
  pre-existing issues outside this work item scope)
- Frontend tests (targeted): `npm run test:frontend -- --run src/lib/utils/airis/return_to.test.ts` (4 passed)
- Frontend typecheck: attempted; fails with thousands of pre-existing errors (`npm run check`)

## Task Entry (for branch_updates/current_tasks)

- [x] **[REVIEW]** Fix issues found in latest commits (2026-02-05..2026-02-06)
  - Spec: `meta/memory_bank/specs/work_items/2026-02-06__bugfix__code-review-fixes-recent-commits.md`
  - Owner: Codex
  - Branch: `codex/bugfix/code-review-fixes-2026-02-06`
  - Started: 2026-02-06
  - Done: 2026-02-06
  - Summary: Careful code review of recent auth/billing/landing changes and apply minimal-risk fixes.
  - Tests: `pytest (targeted)` + `vitest (targeted)`
  - Risks: Medium (touches auth + billing UX; security-sensitive surfaces).

## Risks / Rollback

- Risks:
  - Fixes in auth flows can break sign-in/linking in subtle ways if validation changes are too strict.
  - Return-to-chat / deep links can introduce open-redirect risks if not constrained.
- Rollback plan:
  - Keep changes small and localized; revert individual commits if a regression is found.
