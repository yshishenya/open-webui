# Airis branding cleanup follow-up

## Meta

- Type: refactor
- Status: active
- Owner: Codex
- Branch: codex/refactor/airis-brand-cleanup-followup
- SDD Spec (JSON, required for non-trivial): N/A (mechanical branding cleanup)
- Created: 2026-08-08
- Updated: 2026-08-08

## Context

The main Airis rebrand is already merged into `airis_b2c`, but a follow-up scan found
remaining user-visible `WebUI` labels in fallback screens, settings, connection tooltips,
localizations, backend error messages, and outbound user-agent labels.

## Goal / Acceptance Criteria

- [ ] Replace remaining user-facing Open WebUI/WebUI labels with Airis.
- [ ] Keep translation keys and values consistent across supported locales.
- [ ] Preserve compatibility identifiers, package/module names, environment variables,
      headers, MIME types, third-party product names, legal files, and historical records.
- [ ] Verify the frontend, backend syntax, diff quality, PR, merge, and production health.

## Non-goals

- Do not rename the `open_webui` Python package or `OPEN_WEBUI_*`/`WEBUI_*` compatibility
  contracts.
- Do not change legal attribution, licenses, historical changelogs/migrations, or upstream
  service endpoints without a separate product/legal decision.

## Scope (what changes)

- Backend: Runtime messages, OAuth client display name, memory prompt, and outbound
  user-agent branding.
- Frontend: Fallback/access screens, settings labels/tooltips, function templates, and
  locale translation keys/values.
- Config/Env: No contract changes.
- Data model / migrations: None.

## Implementation Notes

- Key files/entrypoints: `src/lib/i18n/locales/*/translation.json`, affected Svelte
  components, backend routers/utilities, and `TROUBLESHOOTING.md`.
- API changes: None.
- Edge cases: `stable-diffusion-webui` and technical compatibility strings remain unchanged.

## Upstream impact

- Upstream-owned files touched: Minimal text-only changes in existing UI/backend files.
- Why unavoidable: These strings are rendered to Airis users or sent as the application
  identity to external providers.
- Minimization strategy (thin hooks / additive modules / guarded behavior): Text-only edits;
  no control flow, API, storage, or dependency changes.

## Verification

- `git diff --check`
- Locale JSON parse check
- Docker frontend tests/check/lint where available
- Backend syntax check and targeted tests
- Residual-brand scan with compatibility exclusions

## Risks / Rollback

- Risks: Translation keys are changed mechanically and must remain aligned with all locale
  files.
- Rollback plan: Revert the follow-up commits; no schema or data changes are included.

## Completion Checklist

- [ ] Branch update entry completed.
- [ ] PR merged into `airis_b2c`.
- [ ] Production image deployed and health verified.
