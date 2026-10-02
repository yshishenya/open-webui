# Daily email capacity release acceptance

Status: Done
Owner: Codex
Branch: `codex/bugfix/email-capacity-live-fixture`
Implementation Spec: [Daily capacity](2026-10-02__bugfix__email-daily-capacity.md)
SDD Spec: `meta/sdd/specs/completed/airis-daily-email-capacity-2026-10-02-104.json`

## Result and measurable proof

- [x] PR151 merged. Required CI passed on frozen source `cda7e35cd9ff68877de323e87a4ff8eeb0948d86`; merge `ebdd406ae2371faff311ed3f002807ad189a095a` has no runtime/config difference.
- [x] Source and exact candidate image:613 backend checks passed/3 PostgreSQL-only skips; isolated PostgreSQL89 passed. Format/lint/config/SDD policy passed.
- [x] Atomic minute60/40 and UTC-day100/50 reservations; rejected requests roll back both. Existing minute reservations seed the first day. Restart, midnight, cleanup, headroom, zero product and DB failures checked.
- [x] Proven-unsent capacity refusal defers300 seconds without spending an SMTP attempt. Existing owner, expiry, consent, accepted/unknown/submitted protections remain; ordinary SMTP failures retain bounded retries.
- [x] Fresh database-copy migration and previous-image compatibility:71 tables/15282 rows preserved. No migration or financial mutation introduced.
- [x] Guarded release completed;416 backend/7006 retained frontend file hashes match. Environment, volumes, networks, ports, command and15 neighboring containers preserved.
- [x] Live read-only checks confirm100/50, unchanged Reply-To, all optional mail controls disabled, no queue rows. Live isolated SQLite queue checks32 passed/1 PostgreSQL-only skip, using mocked SMTP and a separate test database.
- [x] Daily implementation SDD6/6 completed. Follow-up fixes two reproduced test assumptions: synthetic SMTP port and current claim time after asynchronous reconciliation. Runtime/config remain unchanged; the accepted production image is retained.
- [ ] Separate final gates: real pilot, actual delivery, real24h/72h/14-day windows and mature cohort. Control checks are not pilot evidence.

Image: `yshishenya/yshishenya:daily-capacity-cda7e35cd-on-funnel-20261002`.
Registry digest: `sha256:fefb5833ee0613bc018cb9da76412cd6b31897ea205e525868789426c6f8cfb7`.

## Limits and upstream impact

The day is fixed UTC. Across any rolling24h the app can reserve at most200 total/100 product sends; other SMTP clients are outside app accounting. Reservations do not prove receipt. Direct account/password mail retains its existing refusal result; durable deferral applies to queued jobs.

Acceptance/follow-up documentation and fork-owned tests only. No new runtime dependency, schema, service or upstream-owned runtime change.
