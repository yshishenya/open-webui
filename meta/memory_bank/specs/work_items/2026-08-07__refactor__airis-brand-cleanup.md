# Airis brand cleanup

## Meta

- Type: refactor
- Status: done
- Owner: Codex
- Branch: codex/feature/billing-balance-history-simplify
- SDD Spec (JSON, required for non-trivial): N/A (mechanical branding cleanup)
- Created: 2026-08-07
- Updated: 2026-08-07

## Context

The application still exposes Open WebUI branding and links to upstream Open WebUI resources in user-facing screens. Airis needs a consistent product identity without breaking upstream-compatible package names, API contracts, or environment variables.

## Goal / Acceptance Criteria

- [x] User-facing UI and runtime defaults use Airis instead of Open WebUI/AIris.
- [x] User-facing links to the old Open WebUI website, documentation, and GitHub project are removed.
- [x] Upstream-compatible `open_webui` package paths, API headers, and environment variable names remain unchanged.
- [x] Frontend tests pass; type/lint checks are blocked by pre-existing repository errors.

## Non-goals

- Renaming the Python package, database keys, API headers, or compatibility environment variables.
- Rebranding third-party products or changing their attribution outside the UI links removed for the requested Git cleanup.
- Changing community sharing behavior beyond removing unavailable upstream destinations from the UI.

## Scope (what changes)

- Backend:
  - Set Airis as the default runtime application name and update user-facing email/error text.
- Frontend:
  - Update brand strings, notifications, translations, manifests, and old upstream links.
  - Remove old upstream community/marketplace destinations from UI actions.
- Config/Env:
  - Preserve compatibility variable names; only defaults and user-facing values change.
- Data model / migrations:
  - None.

## Implementation Notes

- Keep `WEBUI_*`, `OPEN_WEBUI_*`, `open_webui`, `required_open_webui_version`, and `X-OpenWebUI-*` identifiers where they are compatibility contracts.
- Preserve compatibility identifiers and unrelated third-party assets; remove old project links from rendered UI and update checks.

## Upstream impact

- Upstream-owned files touched:
  - `src/**` and selected backend templates/defaults containing user-facing upstream branding.
- Why unavoidable:
  - These are the actual rendered labels, titles, notifications, emails, and links seen by users.
- Minimization strategy:
  - Mechanical string/default updates only; compatibility identifiers and internal package paths remain unchanged.

## Verification

- `git diff --check` — passed
- JSON parse for all `src/lib/i18n/locales/*/translation.json` — passed
- Frontend tests — 27 files, 104 tests passed
- Frontend `svelte-check` / ESLint — blocked by pre-existing repository errors
- `rg` scan for old user-facing brand strings and old Open WebUI URLs — passed

## Task Entry (for branch_updates/current_tasks)

- [x] **[REFACTOR][BRAND][UI]** Clean old Open WebUI branding and links from the Airis interface
  - Spec: `meta/memory_bank/specs/work_items/2026-08-07__refactor__airis-brand-cleanup.md`
  - Owner: Codex
  - Branch: `codex/feature/billing-balance-history-simplify`
  - Started: 2026-08-07
  - Done: 2026-08-07
  - Summary: Replace user-facing Open WebUI/AIris branding with Airis and remove old upstream website/GitHub destinations while preserving compatibility identifiers.
  - Tests: locale JSON parse and `git diff --check` passed; frontend tests passed (27 files, 104 tests); type/lint checks blocked by existing errors.
  - Risks: Medium (mechanical updates span locale files and shared settings screens).

## Risks / Rollback

- Risks:
  - Locale key changes must stay synchronized with frontend i18n calls.
- Rollback plan:
  - Revert only the branding cleanup diff; no data migration is involved.

## Completion Checklist

- [x] Branch update entry moved to `Done` with required fields.
