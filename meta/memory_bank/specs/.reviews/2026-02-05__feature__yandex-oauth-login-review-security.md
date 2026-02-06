# Plan Review (Security): Yandex OAuth login

- Spec: `meta/memory_bank/specs/work_items/2026-02-05__feature__yandex-oauth-login.md`
- Review type: security (plus general completeness)
- Date: 2026-02-05
- Tooling: `sdd` CLI not available in this environment (`sdd list-review-tools` fails), so this is a single-agent review (no multi-model consultation).

## High-level assessment

The spec is directionally solid: it reuses the existing Authlib-based OAuth manager and only adds thin API hooks for the already-used frontend routes (`/api/v1/oauth/yandex/*`). The biggest remaining work is provider-specific **userinfo normalization** so the shared flow can reliably extract `sub/email/name` for Yandex.

## Risk Flags

### CRITICAL — Token is intentionally non-HttpOnly for generic OAuth

The shared `OAuthManager.handle_callback` sets the `token` cookie with `httponly=False` (frontend reads it and writes to `localStorage`). This is an XSS amplification risk.

- Why it matters: any XSS on the WebUI origin can exfiltrate JWT and impersonate users.
- Recommendation (spec-level): explicitly acknowledge this trade-off as “existing platform behavior”, and ensure we do not add any new JS injection surfaces in the Yandex path. Consider a follow-up hardening work item (HttpOnly + server-side session) if product allows.

### HIGH — Redirect URI mismatch is the most common production breaker

Two callback routes will exist:
- generic: `/oauth/yandex/login/callback`
- russian alias: `/api/v1/oauth/yandex/callback` (expected by current UI + docs)

If `YANDEX_REDIRECT_URI` doesn’t match the configured callback in Yandex app settings **exactly**, login will fail.

- Recommendation: add an explicit “must equal” checklist line in Acceptance Criteria and in `.qoder/RUSSIAN_OAUTH_SETUP.md`.

### HIGH — Email trust / merge-by-email semantics

`OAUTH_MERGE_ACCOUNTS_BY_EMAIL=true` merges accounts based on email alone (OAuth provider may not verify email in all ecosystems). This is already present behavior but worth calling out.

- Recommendation: in spec, state that merge-by-email is an optional risk trade-off; keep default behavior unchanged.

## Missing Information

### HIGH — Add a representative Yandex `userinfo` payload example

Normalization rules are correct in spirit, but the spec should include at least one sample JSON payload (fields + types) to lock in implementation and tests.

- Recommendation: paste a redacted example (real response from `https://login.yandex.ru/info`) and explicitly confirm:
  - `id` type (`str` vs `int`) and whether it is stable
  - email field (`default_email` vs alternatives like `emails`)
  - name fields precedence

### MEDIUM — Avatar mapping decision (MVP vs follow-up)

The spec lists avatar as optional but doesn’t choose.

- Recommendation: decide one of:
  - “MVP: skip avatar; default `/user.png`”
  - “MVP: best-effort avatar; document exact URL template”

## Design Concerns

### HIGH — Prefer wiring tests over Authlib integration mocks

The optional integration test suggestion (“stubs/mocks for Authlib client methods”) can be time-consuming.

- Recommendation: instead, add a small router wiring test that monkeypatches:
  - `app.state.oauth_manager.handle_login`
  - `app.state.oauth_manager.handle_callback`
  and asserts:
  - endpoint exists and returns 302
  - correct provider argument (`"yandex"`) is passed

This validates our thin-hook contract without binding to Authlib internals.

### MEDIUM — Ensure `sub` stored as string

Yandex `id` may be numeric; storing `sub` as a string avoids subtle mismatches.

- Recommendation: add to spec: “`sub` is normalized to `str` before persistence.”

### LOW — Consider adding `?format=json` to Yandex userinfo endpoint

Some providers require explicit format parameters.

- Recommendation: confirm with real response; if needed, adjust `userinfo_endpoint` to include `format=json`.

## Feasibility Questions

### MEDIUM — Detached HEAD workflow risk

Current branch is `HEAD (detached)`.

- Recommendation: before implementation, create a proper branch per workflow (e.g. `feature/yandex-oauth`), and keep task updates in `meta/memory_bank/branch_updates/...`.

## Enhancement Suggestions

- Add a short “Smoke test: expected redirects + cookies” section that includes:
  - expected `Location` values
  - which cookies must be set (`token`, optional `oauth_session_id`)
- Add “fallback debugging path” note: `/oauth/yandex/login` can be used to isolate frontend-vs-backend issues once claims are fixed.

## Clarification Requests

- Should successful login always land on `/auth` (to run the existing oauthCallbackHandler), or should we redirect to `/home` after the token is persisted? Current plan relies on `/auth`; confirm that’s desired UX.
