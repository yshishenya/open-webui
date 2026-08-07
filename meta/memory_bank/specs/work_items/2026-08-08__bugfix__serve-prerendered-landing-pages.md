# Serve prerendered landing pages

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/fix-wallet-topup-clarity
- SDD Spec (JSON, required for non-trivial): N/A (small targeted fallback fix)
- Created: 2026-08-08
- Updated: 2026-08-08

## Context

The frontend build contains route-specific prerendered HTML files, but the backend SPA static fallback only looked for `index.html`. Direct production requests therefore received the application shell instead of the landing page HTML.

## Goal / Acceptance Criteria

- [x] Direct requests to one-segment prerendered routes serve `<route>.html`.
- [x] Unknown routes continue to fall back to `index.html`.
- [x] JavaScript asset 404 behavior remains unchanged.

## Non-goals

- No changes to route content, frontend navigation, or API behavior.

## Scope (what changes)

- Backend:
  - Resolve adapter-static route HTML before the existing SPA fallback.

## Implementation Notes

- Key files/entrypoints:
  - `backend/open_webui/main.py:SPAStaticFiles`
- Edge cases:
  - Only one-segment extensionless paths are mapped, avoiding asset and nested API paths.

## Upstream impact

- Upstream-owned files touched:
  - `backend/open_webui/main.py`
- Why unavoidable:
  - The backend owns production static-file fallback behavior.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Small guarded lookup before the existing fallback; all other behavior is unchanged.

## Verification

- `npm run build:vite`
- Production smoke check: `curl -fsS https://chat.airis.you/welcome` contains the prerendered landing `<h1>`.

## Risks / Rollback

- Risks:
  - None expected; missing route HTML falls through to the existing SPA shell.
- Rollback plan:
  - Revert the single `SPAStaticFiles` change and redeploy the previous image.

## Completion Checklist

- [x] Implementation completed.
- [ ] Production route smoke check completed after redeploy.
