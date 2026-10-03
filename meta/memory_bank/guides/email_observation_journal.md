# Durable email observation journal

The journal records a declared population and real observations of send eligibility. It contains no message text, address, token or provider response. Rule version: `send_eligibility_v1`. Initial storage release: PR203, migration `o1j020261003`.

## Storage and ownership

- `models/email_observation_schema.py`: five additive tables, foreign keys, constraints and indexes.
- `models/email_observation.py`: async storage primitives. Callers own an independent AsyncSession and the outer commit/rollback. No storage operation enqueues or sends email.
- `utils/airis/email_eligibility.py`: authoritative read-only business decision. Its ready result is separate from release/pilot/dry-run/transport permission.

Use `declare_scope` to freeze ordinary members, including unverified accounts and members without product consent. Declare registration/payment windows explicitly. Duplicate, missing, nonordinary and out-of-window identities are rejected. Canonical account scenario key is onboarding_v1; a payment scenario key equals the internal Payment.id. A deleted source can only update its already-known orphan history.

`claim_observation_run` starts one live run per scope or reclaims an expired lease. It records actual observation start once. Never supply artificial historical time on production. `observation_page` reads up to100members; `save_observation_page` validates owner/lease/sequence and saves decisions/events/cursor/counts within a savepoint. Commit only after the whole page succeeds. A caught page error cannot retain partial journal changes. Interrupted runs retain their cursor; a stale owner cannot write after reclaim. `fail_observation_run` records an incomplete run with a bounded safe reason.

The original scenario window/source identity and first_eligible_at are immutable. Identical decisions add no transition event. Changed reasons/defer times add one new revision. Late opt-out preserves the earlier first-positive fact. Deleted user/payment/job foreign keys become NULL; linked_at retains evidence of a lost delivery link, and a replacement job cannot impersonate it.

## Interpretation and rollout boundary

A completed run proves every declared member was visited. It does not prove continuous observation between passes or that the caller supplied every relevant scenario. Empty tables or no completed runs do not imply zero eligible people.

The storage release creates no scopes and enables no observer or dispatch. Existing administrative reports retain null eligibility denominators until observer, queue association and coverage-aware reporting are separately implemented and accepted. New history cannot reconstruct old unobserved eligibility. Actual SMTP acceptance does not prove external delivery or Inbox placement.

Future dispatch integration must calculate eligibility through the shared helper and save first-positive plus new exact-scenario queue association in one transaction. Release/pilot/dry-run/consent/address permissions must still be checked immediately before SMTP. Monetary transactions finish separately; journal failure must never undo payment credit.

## Verification

Run the full backend suite using the project's Docker Compose workflow. Focused tests: `test_email_observation_storage.py` and `test_email_observation_identity.py`. Set `EMAIL_DELIVERY_TEST_DATABASE_URL` only to an isolated PostgreSQL database to exercise actual lease/write concurrency. Tests drop their own tables; never point them at production.

Acceptance covers migration upgrade/downgrade/repeat,250members in100+100+50pages, interruption/reclaim, whole-page rollback, concurrent writers, immutable first-positive history, source identity, deleted links and0monetary/SMTP mutations. Production acceptance compares old schemas/source fingerprints and verifies all new journal tables remain empty.

Rollback the container to the retained previous image if necessary. The migration is additive, so older application code ignores the new tables. Do not automatically downgrade a production database or delete historical rows as part of an application rollback.
