# Onboarding data retention
This policy describes first-party records. Data held by SMTP/analytics/AI/payment
providers follows their own contract and deletion process; local cleanup is not
a promise that provider history has been erased.

## Purpose, clock and expiry
Intervals are elapsed UTC seconds, not local calendar-day rounding.
Cleanup is hourly and paged. Eligibility expires at the exact boundary
(`timestamp <= now - period`); backlog drains in later bounded passes.

| Data | Purpose | Retention/start | Expiry/minimum evidence |
| --- | --- | --- | --- |
| Browser advertising attribution | Explain advertising source |90days from each touch's occurred_at; explicit denied clears it | Existing browser policy;30days in the plan was a proposal |
| Server first/last advertising touch | Same attribution |90days from each occurred_at; metadata without a touch timestamp uses granted_at | Clear expired dictionary under Identity lock; renewed last touch does not extend first touch |
| Analytics event details and terminal delivery | Diagnostics and completed delivery proof |90days from event occurred_at | Delete together only when no pending/uploaded/uncertain delivery exists; expired source facts cannot recreate events/jobs |
| Pending/uploaded/uncertain analytics delivery | Resolve durable delivery, including non-idempotent upload | Until explicit resolution/revoke/account deletion | Never silently delete unresolved jobs by age; then ordinary event retention applies |
| Analytics identity/browser binding/ClientID/lifetime markers | Consent ownership, cross-device continuity and prevent repeated first-events | Account/browser identity lifecycle; lifetime stores only first-event name/time | Revoke clears attribution/events/clientID; minimal identity/lifetime persists for replay suppression; account deletion purges local identity/bindings |
| TaskSuccess and server recovery checkpoint | Authoritative completed foreground operation and idempotency | While source account exists | Account deletion removes success facts; age-only deletion would recreate false first-success on saved-message replay |
| Attached EmailDelivery | Scenario receipt, rolling rate limits and payment replay suppression | While source account exists | Content-free row has no address/body/token; unique source/type/scenario receipt survives scheduler restarts |
| Orphan terminal EmailDelivery | Short operational record after account unlink |30days from updated_at (unlink or final state change) | Delete accepted/suppressed/expired/non-retryable failed; FK lost links make retained scope fractions unavailable; source money records unchanged |
| Unknown/live/retryable email | Resolve uncertain submission without duplicate sends | Until explicit resolution; account unlink blocks dispatch | Excluded from age deletion even when orphan; not declared anonymously safe merely because user_id is NULL |
| Product preference | Current choice and address binding | Account lifecycle | Existing account deletion/unlink rules |
| Preference event history | Evidence of consent/withdrawal/blocked address | Existing730days from created_at | Existing bounded event cleanup; address hash remains personal data |
| Unsubscribe token | Public authenticated-by-capability unsubscribe | Existing180days from token creation/expires_at | GET passive; expires_at boundary; expired tokens removed |
| Suppression lookup | Block bounce/complaint addresses | Existing365day lookback | Underlying audit event retains730days; do not confuse lookup window with physical deletion |
| Closed scope member/scenario/decision detail | Diagnostic and pilot denominators, eligibility and delivery associations |730days from closed_at | Bounded deletion under Scope lock only with no running run; report explicitly returns history-retention-expired, no conversion zeros |
| Open scope detail | Current declared group and sources | Until closure, then730days | Never age-delete a running/open scope; scope must be closed to start its clock |
| Scope/run/command receipt metadata | Prevent repeated administrative declare/start; audit frozen bounds | While command actor exists; scope header/run metadata has no account reference | Keep immutable bounds/count/run and replay key/hash; remove command when actor is absent and its created_at is at least30days old; existing actor keys never expire. Closed scope cannot be restarted |
| Payment/Wallet/Ledger/Transaction and first-payment/refund source | Monetary/accounting truth and source classification | Existing statutory/product rules | This cleanup neither updates nor deletes money/source records |
| Backups | Recovery from release or data loss | Existing operations retention | Not removed by scheduler; bounded cleanup affects active DB only |

## Report behavior
The730day boundary applies before any row is physically deleted, so partially
drained history cannot masquerade as a complete cohort. API returns410 with a
safe explicit reason. Open scopes and cohorts within retention keep their
existing snapshot/coverage behavior. Orphan email deletion within that period
is reported as a lost delivery link and yields unavailable fractions.

## Scheduling and locks
Reuse `cleanup_product_email_records` and its independent hourly scheduler.
All added DB I/O is async ORM. Analytics locks Identity before delivery deletion;
scope cleanup locks Scope before child history. Two instances may run safely.
Each physical-delete class is limited to1000 rows per pass; advertising identity
scans use an in-memory keyset cursor which restarts from the beginning after
process restart or end of traversal. Do not treat a cursor as durable source truth.

## Operational acceptance
Before release, inspect age-selection counts without DML, save a checked DB
backup, test exact boundary-1/0/+1, repeated cleanup and two workers on SQLite
and PostgreSQL. Prove no live/unknown job loss, no replay sends and no money
change. Keep full01.16 open until actual image and production behavior match.

