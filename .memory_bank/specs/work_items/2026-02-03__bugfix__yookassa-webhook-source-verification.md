# Work Item Spec: YooKassa webhook source verification (IP allowlist)

- Type: bugfix
- Date: 2026-02-03
- Owner: Codex
- Scope: backend

## Problem

The codebase has a `verify_webhook()` implementation that assumes YooKassa sends a request
signature header and that the signature is `HMAC-SHA256(hex)` of the raw body.

YooKassa docs for *incoming notifications* emphasize verifying the notification by:

1) Validating the payment/refund status via YooKassa API (fetch the object by id), and
2) Verifying the source IP address is within YooKassa documented ranges.

The current signature verification is best-effort (only runs if a signature header exists),
but it is easy to misinterpret as an official security mechanism.

## Goals

- Implement official, docs-aligned verification guardrail: optional IP allowlist enforcement.
- Keep backward compatibility and avoid breaking deployments behind proxies.
- Keep existing provider-side verification (`get_payment()`) as the main correctness gate.

## Non-goals

- Removing or redefining YooKassa API verification logic for payments/refunds.
- Introducing new dependencies.
- Enforcing IP allowlist by default (can break proxy setups).

## Proposed change

- Add env toggles:
  - `YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST` (default `false`)
  - `YOOKASSA_WEBHOOK_TRUST_X_FORWARDED_FOR` (default `false`)
  - `YOOKASSA_WEBHOOK_ALLOWED_IP_RANGES` (optional, comma-separated extras)
- Add `is_yookassa_webhook_source_ip()` helper in `utils/yookassa.py` with YooKassa default
  ranges baked in (can be extended via env).
- In `routers/billing.py` webhook endpoint, if enforcement enabled:
  - Resolve client IP (`X-Forwarded-For` if trusted, else `request.client.host`)
  - Reject if IP is not in allowlist
- Update docstrings/comments to clarify that signature verification is not an official YooKassa
  mechanism unless the provider explicitly documents it.

## Verification plan

- Automated tests:
  - When allowlist enforcement is enabled and `X-Forwarded-For` is trusted:
    - request with allowed IP passes (200)
    - request with non-allowed IP fails (401)
- Run via Docker Compose: `pytest -q`

