# Legal docs + acceptance tracking (AIRIS)

## Meta

- Type: feature
- Status: done
- Owner: Codex
- Branch: airis_b2c
- Created: 2026-02-05
- Updated: 2026-02-05
- Done: 2026-02-05

## Context

AIRIS is a consumer + business SaaS with PAYG billing. We need a publishable set of legal documents and an auditable
acceptance mechanism (versioned, with basic proof data) so that:

- Users accept the offer/terms before using the product.
- The product can enforce acceptance (UI gate + backend state) and re-accept on updates.
- We have a minimal public “documents pack” required for launch.

This work is **not legal advice** and must be reviewed by a qualified РФ lawyer before going live.

## Goal / Acceptance Criteria

- [x] Publish a full “Лицензионный договор‑оферта” as the main terms page (canonical `/terms`).
- [x] Add compatibility routes:
  - [x] `/documents/contract` redirects to `/terms`
  - [x] `/documents/privacy` redirects to `/privacy`
  - [x] `/prices` redirects to `/pricing`
- [x] Add public legal docs pages under `/documents/*` (templates acceptable, but complete structure and placeholders):
  - [x] Consent to personal data processing
  - [x] DPA / поручение обработки ПДн (B2B)
  - [x] Cookie notice/policy
  - [x] Returns/termination policy (B2C)
  - [x] Acceptable Use Policy
  - [x] Subprocessors / AI providers list (with countries/roles; can be “subject to change”)
- [x] Backend records legal acceptance events with:
  - `user_id`, `doc_key`, `doc_version`, `accepted_at`, `ip`, `user_agent`, `method`
- [x] Signup (email/password) requires accepting terms + privacy; Telegram completion requires the same.
- [x] App UI blocks loading core app data until required legal docs are accepted; provides an acceptance overlay.
- [x] Remove/disable “inactive balance forfeiture” clause from terms (former `5.6` concept).
- [x] Ensure B2C carve-outs (ЗоЗПП) in terms: no limitation of consumer rights (jurisdiction/claims, etc.).

## Non-goals

- Filing Roskomnadzor notice, producing internal приказ/реестр ПДн (tracked as a launch checklist item only).
- Implementing fiscalization/54‑ФЗ (tracked as launch checklist item only).
- Building full legal version-archive tooling (only current version + acceptance log).
- Changing provider/business strategy (we document reality, we don’t “make it legal” by wording).

## Scope (what changes)

- Frontend:
  - Update `/terms` to full оферта text + add missing legal sections.
  - Update `/privacy` for consistency and add references to subprocessors page.
  - Add `/documents/*` pages + minimal index.
  - Add acceptance checkbox to signup and a logged-in “legal acceptance gate” overlay.
- Backend:
  - Add DB table for legal acceptance events.
  - Add `/api/v1/legal/*` endpoints to read requirements/status and submit acceptance.
  - Update signup and Telegram completion endpoints to require acceptance and record events.
- Data model / migrations:
  - New `legal_document_acceptance` table.
  - Add `privacy_accepted_at` to `user` table (keep existing `terms_accepted_at`).

## Implementation Notes

- Key files/entrypoints:
  - Frontend routes: `src/routes/terms/+page.svelte`, `src/routes/privacy/+page.svelte`, `src/routes/documents/**`
  - Signup UI: `src/routes/auth/+page.svelte`, `src/lib/apis/auths/index.ts`
  - App gate: `src/routes/(app)/+layout.svelte` + new overlay component
  - Backend router include: `backend/open_webui/main.py`
  - Backend routers: `backend/open_webui/routers/legal.py`, `backend/open_webui/routers/auths.py`,
    `backend/open_webui/routers/oauth_russian.py`
- API changes:
  - `POST /api/v1/auths/signup`: requires new boolean(s) for legal acceptance.
  - New endpoints under `/api/v1/legal`.
- Edge cases:
  - OAuth-created users without acceptance are allowed to sign in, but are blocked by the UI gate until acceptance.
  - Admin/headless users: do not break bootstrap flows; acceptance can be forced later via UI.
  - Do not log secrets; acceptance logs store only IP/UA/method/version.

## Upstream impact

- Upstream-owned files touched:
  - `backend/open_webui/main.py` (router include)
  - `backend/open_webui/routers/auths.py` (signup acceptance enforcement)
  - `backend/open_webui/routers/oauth_russian.py` (Telegram completion acceptance logging; avoid auto-accept in OAuth)
  - `backend/open_webui/models/users.py` (add `privacy_accepted_at` column to ORM/Pydantic)
  - `src/routes/auth/+page.svelte` and `src/routes/(app)/+layout.svelte` (UI gate + signup checkbox)
- Why unavoidable:
  - Enforcement must happen in the signup/onboarding and app bootstrap flows.
- Minimization strategy:
  - Keep new logic in additive modules (`backend/open_webui/utils/airis/`, `backend/open_webui/models/legal.py`,
    `src/lib/apis/legal/`, `src/lib/components/layout/Overlay/LegalAcceptanceGate.svelte`), and only wire via thin hooks.

## Verification

- Backend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm -T airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_legal.py open_webui/test/apps/webui/routers/test_auths.py"`
- Frontend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps -T airis-frontend sh -lc "npm run test:frontend -- --run"`

## Task Entry (for current_tasks)

- [x] **[LEGAL]** Publish оферта + acceptance tracking
  - Spec: `.memory_bank/specs/work_items/2026-02-05__feature__legal-offer-docs-acceptance.md`
  - Owner: Codex
  - Branch: `airis_b2c`
  - Done: 2026-02-05
  - Summary: Canonical `/terms` оферта + `/documents/*` legal pack; versioned acceptance logging and UI gate.
  - Tests: `pytest`, `npm run test:frontend -- --run` (docker compose)
  - Risks: Legal wording must be reviewed by counsel; acceptance gating could affect onboarding if misconfigured.

## Risks / Rollback

- Risks:
  - Incorrect legal wording or over-promises vs real provider behaviour.
  - Blocking users if acceptance gate is mis-triggered.
- Rollback plan:
  - Disable enforcement in UI gate (feature flag) and/or relax backend checks, keeping documents accessible.
  - Keep acceptance table additive (safe to leave in DB even if UI gate is disabled).
