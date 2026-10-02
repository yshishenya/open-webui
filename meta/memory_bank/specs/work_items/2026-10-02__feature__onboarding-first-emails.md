# AIRIS welcome and first-task reminder

Status: In Progress
Owner: Codex
SDD Spec: `meta/sdd/specs/active/airis-first-onboarding-emails-2026-10-02-645.json`

## Goal and measurable acceptance

Use the released queue for one consented welcome and one eligible first-task reminder across enabled registration paths. Repair lifecycle/trust gaps before allowing those paths to send. This step implements release A scenarios; cohort reporting and real calendar pilot remain separate final-goal gates.

- [ ] New email/VK/VK ID/Yandex accounts use a durable, compatible account lifecycle; existing disabled credentials never reactivate.
- [ ] Client-supplied social email/identity never establishes verified address, links an existing account or bypasses provider proof. Missing authoritative information fails safely or uses separate explicit address verification.
- [ ] New/late consent and address verification within seven days create at most one welcome; old accounts and repeat login/verification/reconciliation create zero duplicates.
- [ ] Missing consent, inactive/admin/deleted account, technical/unverified/suppressed address submit zero product messages.
- [ ] Both welcome and activation templates have tested HTML and text, safe escaped names, working support/guide links and common one-click opt-out headers/footer.
- [ ] Primary welcome links to the existing ready letter task in `/guide#example-letter`; no duplicate prompt catalogue, automatic send or hidden paid selection.
- [ ] Activation is due no earlier than both registration+24h and accepted welcome+24h, before registration+7d; successful foreground work suppresses it during reconciliation and final permission.
- [ ] Missing/failed/unknown welcome never silently triggers activation; valid deferred work respects expiry and rolling frequency.
- [ ] Template version selects actual versioned assets; a copy edit never creates a second cycle key.
- [ ] Compose backend/PostgreSQL, template and browser handoff checks pass on frozen source and image; real SMTP control passes with correct Reply-To/opt-out. Existing product releases remain gated until pilot/report requirements are met.

## Evidence and reuse

Queue infrastructure is released from PR141; consent/success/guide are already available. Reuse EmailService, provider clients, Auths transaction helpers, consent events, bounded reconciliation and existing guide navigation. Do not introduce brokers, providers, dependencies, another guide or a new auth framework.

Discovered gaps: VK callbacks directly insert a User without the credential lifecycle used by email/shared OAuth. Product permission requires active Auth, so a valid VK account can remain ineligible. VK ID accepts browser-supplied identity/email as fallbacks when authoritative userinfo is incomplete. Shared Yandex OAuth creates Auth but does not establish verified email. Review authoritative contracts before deciding whether provider email is trusted; unknown verification must not become consent or proof of address.

Official Yandex user-information documentation describes default_email as the default contact address, without an explicit verified attribute. Until a sufficient authoritative contract is established, use existing email verification rather than inventing a verification flag. Review VK official SDK/API contract and actual server userinfo boundary. Existing pinned clients are reused; no dependency introduced/replaced.

## Upstream impact

Keep copy/render/scenario and account/trust helpers in fork-owned modules. Minimal hooks may be required in existing OAuth callbacks and address/consent boundaries; preserve public auth/billing contracts and existing user IDs. New VK creation should reuse the existing Auths lifecycle. Existing accounts require authenticated provider proof before any missing credential repair; never reset an existing credential or disabled state. No broad historical activation/consent backfill.

## Verification and release

Test email confirmation, VK/VK ID server-vs-client claims, shared OAuth/Yandex, account linking/repeated login, missing credential and disabled credential, late consent/verification, explicit no-consent and unknown provider status. Repeat queue replay/concurrency/24h boundaries and success arriving before DATA. Render both formats with HTML-injection inputs and forbidden origins; check primary task through ordinary browser auth with manual submission. Freeze source, keep compatible backup/rollback and perform default-off controlled SMTP acceptance. Actual 24h pilot and human acceptance stay pending until observed.

## Implementation and local acceptance

Official VK SDK `UserInfoResult.user` is partial and exposes contact email without a verification flag. Both VK paths now create the existing Auth/User pair; existing VK identities may repair a missing credential only after provider proof, with the user row locked. Disabled credentials are refused. VK ID ignores browser email/identity fallbacks, requires server user_info identity/email and checks provider HTTP status. New VK/Yandex addresses use the existing verification token and service email; existing attached identities and user IDs are preserved, without historical product consent. Contact email alone cannot attach VK/Yandex to an existing account. Address verification is serialized and reused while an unexpired token exists.

The worker selects shipped versioned templates, fails an unsupported/missing version before SMTP, and uses the existing guide anchor as its sole primary task. Reconciliation excludes activation after successful foreground work; the existing final permission check remains authoritative. Existing welcome idempotency, seven-day cutoff, 24-hour windows, opt-out and service headroom are reused.

Touching the existing OAuth files exposed inherited Ruff violations (quotes/imports, optional types, long lines and oversized functions). CI lints every touched file. No rules/CI/ignore changes were made: the existing provider reads, role/group parsing, profile updates, session cookies and logout stages were separated into typed functions while preserving their order and errors. This increases the upstream diff; future sync should prefer upstream equivalents of these stages. Added regression checks cover role allow/deny, group claim parsing, logout protocol/no-user behavior and rotated signing keys.

Local checks: final full Compose backend 567 passed / 3 PostgreSQL-only skipped; isolated PostgreSQL first-email/queue checks 43 passed. Ruff passes on all touched backend files. A final complete run and frozen-image checks precede release. No database schema or dependencies changed. Calendar pilot, browser acceptance and production SMTP remain open gates.

## OAuth security review correction

The first PR scan reported ten clear-text logging findings in the shared OAuth file. Provider claims (roles/groups), raw token/userinfo, response bodies and exception text must not enter logs or error redirects. Removed those payloads, retained operation context, local identifiers and exception class, and made callback messages safe. The regression check injects a private fixture marker into roles, email, token and provider exceptions; it fails against the previous frozen image. The previous image is superseded and must not be released. No scanning rule, severity or suppression was changed. Frozen source/image checks and CI must be rerun before release.
