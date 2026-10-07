# AIRIS: complete release gate audit

## Meta

- Type: docs
- Status: done
- Owner: Codex
- Branch: codex/docs/onboarding-release-gate-audit
- SDD Spec: meta/sdd/specs/completed/airis-release-gate-audit-2026-10-07-001.json
- Created: 2026-10-07
- Updated: 2026-10-07

## Context

Scoped CI and frontend fixes have not completed the full onboarding-retention acceptance. Re-establish the remaining mandatory implementation checks and the concrete launch prerequisites before making further changes.

## Goal / Acceptance Criteria

- [x] Record every required check for the exact integration source; distinguish failures and skips from success.
- [x] Exercise PostgreSQL-only mandatory cases against isolated disposable databases, with no production URL or SMTP.
- [x] Map all 25 mandatory scenarios and remaining A/B/G14/G15 prerequisites to evidence and explicit missing facts.
- [x] Rank the next actions by their contribution to the final user path, with measurable completion conditions.
- [x] Preserve runtime, production settings, financial data, unrelated tracked edits, and private evidence.
- [x] Publish only aggregate findings; keep identifiers, source diagnostics and operator evidence private.

## Scope

Fork-owned documentation and its branch update. No application, dependency, schema or release-configuration changes.

## Upstream impact

None. Existing Compose/test/observation mechanisms are reused. Full formatting is inspected on a disposable source snapshot; broad formatting changes are not committed as an audit.

## Verification

Full backend pytest with the four existing disposable PostgreSQL boundaries; Black, Ruff; full frontend tests/check/lint; accepted compiled-image E2E evidence mapped to unchanged runtime hashes. Read-only production identity and pilot counts, SHA256 preservation of protected files, Markdown links and SDD validation. A failed global check leaves G14 open.

## Risks / Rollback

No runtime mutation or deployment. Only task-owned test containers/network may be removed. Existing dependency volumes and unrelated services remain.

## Measured result

Frozen integration source: `a2e219d3692e034addec44af61a9cb71b78e0a4f`.

| Check                               | Result                                                              | Acceptance                                                             |
| ----------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Full backend pytest                 | 1017 passed, 0 failed/errors/skipped; 25 warnings retained          | Passed; four disposable PostgreSQL boundaries provided                 |
| Full frontend Vitest                | 861 passed in 103 files                                             | Passed                                                                 |
| Frontend type check                 | 3245 errors, 121 warnings in 247 files                              | Failed; no rules weakened                                              |
| Frontend ESLint                     | 1180 errors, 0 warnings                                             | Failed                                                                 |
| Full backend Ruff                   | 6466 diagnostics, Ruff 0.16.10                                      | Failed                                                                 |
| Full Black on disposable copy       | 69 files reformatted, 383 unchanged                                 | Formatting operation succeeded; original tree still has 69 differences |
| Default E2E discovery               | 92 cases, 25 files; 31 cases in 11 files require onboarding fixture | Discovery only, full default execution not claimed                     |
| Compiled-image mandatory full paths | Accepted 24/24, 0 failures/errors/skips                             | Reused evidence for byte-identical runtime/tests; no new execution     |
| Frozen source preservation          | 6503 archived files unchanged after checks                          | Passed                                                                 |

Full pytest includes all previously conditional PostgreSQL assertions in this run, including account deletion and retention locks. Main application-test persistence remains isolated SQLite where existing tests select it. This is not a claim that all 1017 tests use PostgreSQL.

## Mandatory scenario map

The current backend run proves the listed server assertions. Browser evidence is separately bound to the already accepted image. Human and elapsed-time conditions remain open.

| ID  | Required scenario                                    | Implementation evidence                                | Remaining evidence                                  |
| --- | ---------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| 01  | Email signup without verification                    | onboarding_lifecycle / product_email_preferences       | New pilot signup and external verification          |
| 02  | Verification plus consent; repeated verification     | onboarding_lifecycle                                   | A real consenting participant                       |
| 03  | New trusted VK/Yandex address                        | onboarding_first_emails                                | Real provider creation, beyond controlled responses |
| 04  | Repeated OAuth login or provider link                | onboarding_first_emails                                | New-account provider acceptance                     |
| 05  | Technical address, absent consent or blocked account | product_email_preferences / email_delivery_queue       | Pilot recipient audit                               |
| 06  | Ordinary, streaming and temporary completion         | task_success                                           | Independent usefulness is separate                  |
| 07  | Empty, failed, canceled or internal completion       | task_success                                           | Covered by current backend run                      |
| 08  | Multiple models, replay and devices                  | task_success / onboarding_lifecycle                    | Real device acceptance is separate                  |
| 09  | Success immediately before 24h send                  | onboarding_lifecycle                                   | Real 24h window                                     |
| 10  | Late verification and ten-day downtime               | onboarding_lifecycle                                   | Test clock does not begin pilot                     |
| 11  | Opt-out after claim and passive scanner GET          | product_email_preferences / onboarding_lifecycle       | External unsubscribe journey                        |
| 12  | Two workers, restart and expired ownership           | email_delivery_queue                                   | Current PostgreSQL assertions passed                |
| 13  | SMTP accepted followed by QUIT error                 | email                                                  | External Inbox is separate                          |
| 14  | Timeout after DATA or failed accepted persistence    | email / email_delivery_queue                           | Pilot unknown-outcome observation                   |
| 15  | Concurrent different jobs for one account            | email_delivery_queue                                   | Current PostgreSQL assertions passed                |
| 16  | Provider succeeded before matching ledger            | email_delivery_queue / billing_topup                   | Real matching payment and receipt                   |
| 17  | Webhook replay, reconcile and lost enqueue           | billing_topup / onboarding_payment_feedback            | New real payment path                               |
| 18  | Later credit cancels both branches                   | onboarding_payment_feedback                            | Real 72h observation                                |
| 19  | Multiple canceled/pending payments                   | email_delivery_queue / onboarding_payment_feedback     | Real naturally occurring eligible branch            |
| 20  | Mail unavailable during payment                      | onboarding_payment_feedback                            | Real external delivery is separate                  |
| 21  | Forwarded, expired and foreign links                 | product_email_preferences / onboarding_first_emails    | No individual attribution tokens introduced         |
| 22  | Guide, login, explicit free answer and quota         | Accepted compiled-image full paths: Chromium/Firefox   | Physical phone and independent users                |
| 23  | Checkout, balance, history and one notice            | Accepted compiled-image full paths: Chromium/Firefox   | Real provider purchase and physical phone           |
| 24  | Immature 24h, 7d and 14d denominators                | onboarding_report / email_scope_report                 | First real mature cohort                            |
| 25  | Denied external analytics preserves primary path     | Accepted compiled-image full paths / analytics backend | Independent real journey                            |

## Concrete next work

1. **E2E routing:** default discovery includes 31 fixture-dependent cases while the default Compose service exposes the ordinary app and uses the common authentication setup. These cases require the guarded `onboarding-paths` host, wrapper routes and fixture admin/model setup. Reconcile native Playwright suite/config routing and Compose targets, preserving all cases and their assertions. Finish when every mandatory case reaches its intended isolated service and the selected complete suites pass with no unexplained skips. This is a configuration finding, not a claimed new product/browser failure.
2. **Full frontend quality:** repair shared API/data contracts and their callers, then the remaining component annotations. Retain strict checks, input validation and meaningful failure paths. Finish at 0 type errors and 0 ESLint errors with at least the current 861 tests passing. Warnings remain individually explained or corrected.
3. **Full backend quality:** separate formatting/import/type-syntax changes from behavioral lint findings. Current leading counts: Q000 3500, UP045 1357, UP006 353, F401 295, C901 201. Trace callers before behavioral edits; compare runtime output for changes meant to preserve behavior. Finish at 0 Ruff diagnostics, 0 Black diff and a passing full backend run including all PostgreSQL-only cases.
4. **Final implementation acceptance:** rerun complete checks on one exact source, verify the assembled candidate and only then deploy changed runtime through the existing guarded process. Audit-only changes need no deployment.
5. **Real pilot:** verify external Inbox/headers/reply/unsubscribe and both support operators, real device/provider paths and independent usefulness. Declare a new voluntary participant group and actual dates; then observe real 24h/72h/14d windows. Product opt-in alone cannot prove voluntary research participation.

The general implementation criterion and pilot are not complete. Do not substitute additional sidebar/settings fixes, scoped CI, elapsed test clocks or test users for these remaining conditions. Choose product repairs only from a measured mandatory-path failure.

## Failed preparation and limits

Docker host/none networks returned a null IPAM config; preparation stopped before creating the test network or Compose file. Two dependent check commands therefore did not run tests. After handling this inventory shape, a non-overlapping internal test network was created; no other network was deleted. Initial Ruff attempted a cache in a read-only source mount and failed before diagnostics. An intermediate fresh helper lacked Ruff; the final helper installed the same current tool and used `--no-cache`, with all rules preserved. An unsupported SDD metadata command was rejected; metadata was linked in the saved JSON and subsequently validated. Initial CI then rejected the CLI-generated spec ID format; the ID and file name were normalized to the mandatory three-digit suffix, without weakening policy.

Accepted production source/image/configuration remained unchanged during the audit. Read-only pilot observation showed no participants and no queued jobs; A/B and dispatch remained off. No accounts, consent, payment, mail or production settings were changed. External delivery, both operators, physical phone, independent usefulness, voluntary participants, real observation windows, mature cohort and legacy payment provenance still require their own evidence.

## Completion boundary

This work completes an audit, not the overall onboarding goal. The numbered checklist remains 198/244. All required implementation checks must pass before G14 can close; all real pilot evidence must exist before A/B acceptance can close. Detailed diagnostics and operator evidence remain private; only aggregates are published here.
