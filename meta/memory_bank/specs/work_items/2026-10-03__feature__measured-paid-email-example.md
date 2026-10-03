# AIRIS measured example in the optional paid email

- Type: feature
- Status: completed
- Owner: Codex
- Branch: codex/feature/paid-email-example
- Created: 2026-10-03
- SDD Spec: meta/sdd/specs/completed/airis-measured-paid-email-exam-2026-10-03-701.json

## Goal and acceptance

Complete plan11.08 with one measured planning example in paid_value_72h, using the already accepted guide evidence.

- [x] HTML and plain text describe the same task, observed clarity difference, date and measured costs0.42/12.06RUB.
- [x] Both formats distinguish actual provider responses on a test wallet from real payment; one example does not guarantee general superiority or current prices. Full outputs/conditions and public pricing are linked.
- [x] Without foreground success, opt-in or valid verified address, the queue still makes zero optional SMTP submissions. Existing later credit/payment-priority/frequency gates remain effective.
- [x] Template rendering, full backend tests and relevant PostgreSQL checks pass on the exact source; narrow/desktop HTML is readable.
- [x] Immutable candidate starts healthy, exact-source CI passes and guarded production release preserves settings, neighboring services and rollback/backup.

## Scope / upstream impact

Change only fork-owned paid_value_72h HTML/text, its existing tests and documentation. Reuse existing Jinja templates, fixed guide comparison and sender guards. No new module, dependency, API, migration or provider requests. No upstream files touched. Keep queue/A/B disabled and dry-run/pilot-only unchanged.

## Verification and rollback

Compare figures and date with accepted guide JSON. Verify actual rendered MIME parts and transport suppression using existing fixtures; check privacy/escaping, one primary guide link and separate pricing link. Use Docker Compose and a frozen linux/amd64 image, including layer-depth startup check. Guarded deploy retains the verified backup,10GiB floor and previous image. A real phone, human usefulness, real money/receipt, external delivery and calendar pilot remain open.

## Verified source checks

687 backend tests passed (3 existing skips in SQLite mode);52/52 focused mail/queue/lifecycle tests passed on PostgreSQL with the repo psycopg driver. All three blocked paid-email paths make0SMTP submissions; the success path renders both measured MIME parts with Reply-To/unsubscribe and submits once. Four email widths320/390/768/1440 passed with no horizontal overflow; changed-file Ruff and template formatting passed. No frontend application changes; retain236 frontend tests and12 guide scenarios from the unchanged accepted image.

## Production acceptance — 2026-10-03

Source `f831136d1aeda7e099ef3e9cb44d9384aff29680`, PR197 merge `7ec2b6ba594349313928f150d175d89e53165a32`. Released immutable linux/amd64 digest `sha256:a8fa1d90de1db3f5a2742649d51e5833838cf9e4390102134b3968915af79b02`;127 layers. Verified5759 frontend and478 immutable backend hashes, configuration and14 neighboring container identities;restarts0, healthy public endpoint, Alembic `q1c020261002`. Backup checksums, archive and database dump validated;free disk remains above10GiB. Queue/A/B disabled, dry-run/pilot-only retained with empty participant set.

687 backend tests passed,3 PostgreSQL-only skips;52 focused PostgreSQL cases passed on source and frozen candidate;four email widths have no overflow. Every executed exact-source CI check passed;dependency review skipped and CodeRabbit did not review. A stale expected-base pin in the operational helper stopped the first attempt before production mutation;corrected against the verified live base before retry. This acceptance covers content and release;real delivery, independent usefulness and calendar pilot remain separate requirements.
