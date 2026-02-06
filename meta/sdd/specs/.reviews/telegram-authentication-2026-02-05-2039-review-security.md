# Specification Review Report

**Spec**: Telegram authentication (signin + signup + account linking) (`telegram-authentication-2026-02-05-2039`)
**Review Type**: Security
**Date**: 2026-02-05 21:57:36
**Models Consulted**: 1 (codex)

---

```markdown
# Synthesis

## Overall Assessment
- **Consensus Level**: Weak (only the codex review was provided)

## Critical Blockers
Issues that must be fixed before implementation (identified by multiple models):
- None (single review only; no cross-model consensus to highlight)

## Major Suggestions
Significant improvements that enhance quality, maintainability, or design:
- **Security** Reinstate CSRF/state binding for link/unlink – flagged by: codex  
  - Description: `/api/v1/auths/telegram/link` and `/auths/telegram/link` (DELETE) lack the state token + session binding mandated for login/signup, so any ambient session cookie can authorize link/unlink actions.  
  - Recommended fix: Require the same one-time, session-bound state (or equivalent CSRF nonce) for link/unlink flows, burn the state after use, and consider adding an interactive confirmation step.
- **Security** Clamp configurable auth-date TTL – flagged by: codex  
  - Description: `TELEGRAM_AUTH_MAX_AGE_SECONDS` can be misconfigured to extreme or unsafe values, undermining replay protections.  
  - Recommended fix: Enforce hard-coded server limits (e.g., 30–120 s range) and ignore/reject unsafe admin-provided values.
- **Security** Add audit logging for Telegram events – flagged by: codex  
  - Description: Spec lacks requirements to log successful/failed sign-in, signup, link, unlink, or duplicate-link attempts, limiting incident response.  
  - Recommended fix: Document structured security logging (user id, Telegram id, outcome, reason) while excluding sensitive tokens.
- **Security** Rate-limit new Telegram endpoints – flagged by: codex  
  - Description: No throttling is specified for state issuance, login/signup submissions, or link/unlink routes, enabling brute force and DoS attempts.  
  - Recommended fix: Define per-IP/user limits (and backoff on repeated failures) leveraging existing auth throttle infrastructure.
- **Security** Explicit burn-after-use for state tokens – flagged by: codex  
  - Description: Spec stores state in the session but never mandates deletion/rotation after use, leaving room for replay from the same session.  
  - Recommended fix: Require immediate state removal or regeneration after every success or failure.

## Questions for Author
Clarifications needed (common questions across models):
- **Security** Session cookie attributes – flagged by: codex  
  - Context: CSRF protection depends on the `owui-session` cookie behavior, yet attributes (HttpOnly, Secure, SameSite) are unspecified; confirming them ensures the Telegram flow balances security with local-dev usability.

## Design Strengths
What the spec does well (areas of agreement):
- **Security** Solid verification baseline – noted by: codex  
  - Why this is effective: Mandated server-side HMAC verification, auth-date TTL with skew checks, server-only handling of bot tokens, and uniqueness constraints on Telegram IDs provide strong foundational defenses.

## Points of Agreement
- Not applicable; only the codex review is available, so no multi-model agreements can be inferred.

## Points of Disagreement
- None observed because only one review was provided. No conflicts to resolve.

## Synthesis Notes
- Central theme: codex emphasizes tightening CSRF defenses, replay windows, observability, and abuse throttling around the Telegram flows.
- Actionable next steps: add CSRF/state requirements for link/unlink endpoints, constrain TTL configuration, specify logging/rate limits/state lifecycle, and document session cookie guarantees to close the identified gaps.
```

---

## 📝 Individual Model Reviews

### codex

Used `security-best-practices` skill to apply FastAPI + frontend security guidance to this review.

# Review Summary

## Critical Blockers
Issues that must be fixed before implementation can begin.

- **[Security] Telegram link/unlink APIs omit CSRF/state binding**
  - **Description:** Spec task-2-3-4 (POST `/api/v1/auths/telegram/link`) and task-2-3-5 (DELETE `/api/v1/auths/telegram/link`) only mention “verified user” plus uniqueness/unlink behavior, and the frontend work in task-4-1-2 simply calls `telegramLink()`/`telegramUnlink()` from Settings without any mention of reusing the one-time state or another CSRF defense. By contrast, login/signup (task-2-3-2/3/6) explicitly require `state + signature + TTL` per the key decision “one-time state stored in server session (owui-session)”, so the omission for linking/unlinking leaves those endpoints authenticated solely by the victim’s session cookie.
  - **Impact:** An attacker can harvest a valid Telegram payload for their own account once, then lure any logged-in victim to a malicious page that auto-submits the payload to `/auths/telegram/link` using the victim’s session cookie. The backend would link the attacker’s Telegram ID to the victim account, enabling full account takeover via Telegram login. Similarly, unlink can be forced, disrupting legitimate access.
  - **Fix:** Require the same one-time server-stored state (or another CSRF token) on link/unlink flows, burn the state after use, and reject requests without a matching session-bound token. As defense in depth, ensure these endpoints also demand an interactive confirmation (e.g., re-auth or explicit UI nonce) so they cannot be triggered by cross-site requests that merely rely on ambient cookies.

## Major Suggestions
Significant improvements that enhance quality, maintainability, or design.

- **[Security] Configurable auth-date TTL needs a server-side ceiling**
  - **Description:** Task-1-1-1 introduces `TELEGRAM_AUTH_MAX_AGE_SECONDS` with a default of 600 s, but the spec never constrains the range. Operators could accidentally set this to hours/days (or `0`/negative) via PersistentConfig.
  - **Impact:** A large TTL reopens replay and phishing windows; disabling the TTL entirely negates Telegram’s signed-payload freshness guarantee.
  - **Fix:** Enforce a hard server-side clamp (e.g., 30–120 s hard minimum/maximum, irrespective of config) and reject/ignore unsafe values so attackers cannot talk admins into weakening the protection.

- **[Security] No audit trail for Telegram auth/link events**
  - **Description:** No phase mentions logging successful/failed Telegram sign-in, signup, link, unlink, or duplicate-link attempts.
  - **Impact:** Security teams cannot detect or investigate takeover attempts, replay spikes, or bot abuse involving Telegram identities.
  - **Fix:** Add explicit logging requirements (structured log entries with user id, telegram id, outcome, reason) and ensure sensitive fields (hash, bot token) stay out of logs.

- **[Security] Lack of rate limiting on new endpoints**
  - **Description:** None of the backend tasks or verification steps call for throttling GET `/auths/telegram/state`, the various POSTs, or link/unlink routes.
  - **Impact:** Attackers can brute-force state values, grind through signed payload guesses, or create resource-exhaustion DoS by spamming these endpoints because HMAC verification still consumes CPU.
  - **Fix:** Specify per-IP/user rate limits (and exponential backoff on repeated failures) for state issuance and all Telegram auth endpoints, ideally sharing the existing auth throttling framework if one exists.

## Minor Suggestions
Smaller improvements and optimizations.

- **[Security] State lifecycle needs explicit burn-after-use requirement**
  - **Description:** Task-2-3-2 only says “store state in request.session” while subsequent tasks rely on “state + signature + TTL”, but there is no written requirement to delete/rotate the state after a sign-in/sign-up attempt (success or failure).
  - **Fix:** Document that the backend must remove or rotate the session-bound state immediately after comparison so captured states cannot be replayed later from the same session.

## Questions
Clarifications needed or ambiguities to resolve.

- **[Security] Session cookie guarantees**
  - **Context:** The login-CSRF mitigation depends on the `owui-session` cookie surviving GET `/auths/telegram/state`, yet the spec only lists a break scenario about SameSite/Secure without defining the required flags.
  - **Needed:** Can you confirm the exact cookie attributes (HttpOnly, Secure, SameSite value) that will back this session so the Telegram flow remains CSRF-resistant without breaking local dev?

## Praise
What the spec does well.

- **[Security] Strong verification baseline**
  - **Why:** The spec thoughtfully calls out server-side HMAC verification via `telegram_auth.py`, enforces auth-date TTL with skew checks, keeps `TELEGRAM_BOT_TOKEN` server-only, and ensures Telegram IDs remain unique per account, which are solid foundations for a secure integration.

---
