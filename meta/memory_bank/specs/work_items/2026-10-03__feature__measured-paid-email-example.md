# AIRIS measured example in the optional paid email

- Type: feature
- Status: active
- Owner: Codex
- Branch: codex/feature/paid-email-example
- Created: 2026-10-03
- SDD Spec: meta/sdd/specs/active/airis-measured-paid-email-exam-2026-10-03-701.json

## Goal and acceptance

Complete plan11.08 with one measured planning example in paid_value_72h, using the already accepted guide evidence.

- [x] HTML and plain text describe the same task, observed clarity difference, date and measured costs0.42/12.06RUB.
- [x] Both formats distinguish actual provider responses on a test wallet from real payment; one example does not guarantee general superiority or current prices. Full outputs/conditions and public pricing are linked.
- [x] Without foreground success, opt-in or valid verified address, the queue still makes zero optional SMTP submissions. Existing later credit/payment-priority/frequency gates remain effective.
- [x] Template rendering, full backend tests and relevant PostgreSQL checks pass on the exact source; narrow/desktop HTML is readable.
- [ ] Immutable candidate starts healthy, exact-source CI passes and guarded production release preserves settings, neighboring services and rollback/backup.

## Scope / upstream impact

Change only fork-owned paid_value_72h HTML/text, its existing tests and documentation. Reuse existing Jinja templates, fixed guide comparison and sender guards. No new module, dependency, API, migration or provider requests. No upstream files touched. Keep queue/A/B disabled and dry-run/pilot-only unchanged.

## Verification and rollback

Compare figures and date with accepted guide JSON. Verify actual rendered MIME parts and transport suppression using existing fixtures; check privacy/escaping, one primary guide link and separate pricing link. Use Docker Compose and a frozen linux/amd64 image, including layer-depth startup check. Guarded deploy retains the verified backup,10GiB floor and previous image. A real phone, human usefulness, real money/receipt, external delivery and calendar pilot remain open.

## Verified source checks

687 backend tests passed (3 existing skips in SQLite mode);52/52 focused mail/queue/lifecycle tests passed on PostgreSQL with the repo psycopg driver. All three blocked paid-email paths make0SMTP submissions; the success path renders both measured MIME parts with Reply-To/unsubscribe and submits once. Four email widths320/390/768/1440 passed with no horizontal overflow; changed-file Ruff and template formatting passed. No frontend application changes; retain236 frontend tests and12 guide scenarios from the unchanged accepted image.
