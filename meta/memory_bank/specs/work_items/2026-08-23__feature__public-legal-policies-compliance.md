# Public legal policies compliance refresh

## Meta

- Type: feature
- Status: done
- Owner: Codex
- Branch: `codex/feature/legal-policies-2026`
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/airis-public-legal-policies-2026-08-23-001.json`
- Created: 2026-08-23
- Updated: 2026-08-23

## Context

The live AIRIS privacy policy is dated 2026-02-05 and does not fully describe the current
processing model. It also overstates security controls, omits current Russian processors,
and conflicts with the product path that sends chat content to a configured AI provider.

## Goal / Acceptance Criteria

- [x] The privacy policy identifies the operator and describes subjects, data categories,
      purposes, legal bases, operations, retention, localization, recipients, security,
      data-subject rights, deletion, and cross-border conditions.
- [x] The consent, cookie policy, subprocessors page, and B2B DPA template use the same
      processing model and do not contain contradictory claims.
- [x] Account and payment data are distinguished from user-provided chat content sent to
      the selected AI provider.
- [x] Analytics does not persist attribution before consent, and users can revisit their
      analytics choice.
- [x] Material legal-document versions are updated consistently and protected by a focused
      regression test.

## Non-goals

- Creating internal operator orders, destruction logs, incident registers, or signed vendor
  agreements.
- Deploying the changes or submitting/changing the Roskomnadzor notification.
- Representing this engineering review as final advice from Russian legal counsel.

## Scope (what changes)

- Backend:
  - Update the tracked privacy-policy version.
  - Ensure signup and Telegram completion record all required legal documents.
- Frontend:
  - Rewrite `/privacy`, `/documents/consent`, `/documents/cookies`,
    `/documents/subprocessors`, and `/documents/dpa`.
  - Fix the analytics consent boundary and add a persistent way to reopen analytics settings.
  - Add a focused legal-policy regression test.
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `src/routes/privacy/+page.svelte`
  - `src/routes/documents/{consent,cookies,subprocessors,dpa}/+page.svelte`
  - `src/lib/components/analytics/{AnalyticsConsent,AnalyticsBootstrap}.svelte`
  - `backend/open_webui/utils/airis/legal_docs.py`
- API changes:
  - None.
- Edge cases:
  - Foreign AI providers receive request content, not AIRIS account/payment records
    automatically; user-entered content can nevertheless contain personal data.
  - Google Analytics remains inactive while its public measurement ID is empty.
- Signup and Telegram consent checkboxes explicitly link the personal-data consent
  document; the shared acceptance recorder stores that required document with the
  existing terms/privacy acceptance.
- The full residential postal address was added after the user's explicit approval on
  2026-08-23.
- Public policies intentionally describe infrastructure and external services by functional
  categories. They do not publish hosting names, gateway domains, IP addresses, exact
  infrastructure addresses, or the location of a particular technical gateway. The required
  Russian database localization and the conditional cross-border-transfer warning remain.

## Upstream impact

- Upstream-owned files touched:
  - None expected; changes stay in AIRIS public/legal and analytics modules.
- Why unavoidable:
  - N/A.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Reuse existing routes, acceptance tracking, and analytics consent helpers.

## Verification

- Focused backend signup/legal pytest with isolated SQLite database: 4 passed.
- Focused Vitest suite for legal-policy and analytics behavior: 3 files, 9 tests passed.
- The regression suite verifies the approved operator postal address in the privacy policy,
  consent, and DPA, plus the generalized infrastructure categories, the cross-border warning,
  and the absence of hosting names, gateway domains, IP addresses, exact infrastructure
  addresses, and a particular gateway location from the public legal pack.
- ESLint for all changed frontend files: passed.
- Prettier for all changed frontend files: passed.
- Black for both changed backend files: passed.
- Ruff for both changed backend files with the repository's existing `Q000` conflict ignored:
  passed.
- Production frontend build: passed in 6m 5s.
- `git diff --check`: passed.
- Local browser smoke: all five public legal pages rendered with synchronized versions and
  processing routes; analytics rejection, reopening settings, and absence of loaded counters
  were verified; no console errors were observed.
- Follow-up source check: internal service and billing records link the live LiteLLM server to
  VDSka.ru; Google-indexed snippets from the official VDSka offer and contacts pages identify
  ИП Левин Антон Александрович, ИНН 771877161189, and the Moscow address published in the
  vendor list. ARIN's live RDAP record identifies EGIHosting as the US registrant of the server
  IP range. The VDSka pages themselves returned `ERR_CONNECTION_CLOSED`, so their indexed
  snippets remain indirect evidence until direct access is restored.

## Remaining factual and legal approvals

- Reconcile the Roskomnadzor statement that cross-border transfer is not performed with the
  product scenario where a user places personal data in content sent to a foreign AI provider.
- Reconfirm the VDSka offer and contact details directly when the official pages are reachable.
- Obtain final review from Russian privacy counsel.
- Internal orders, the personal-data protection regulation, destruction records, incident
  response plan, and processor agreements remain outside this code work item.

## Task Entry (for branch_updates/current_tasks)

- [x] **[LEGAL][PRIVACY]** Refresh AIRIS public legal policies
  - Spec: `meta/memory_bank/specs/work_items/2026-08-23__feature__public-legal-policies-compliance.md`
  - Owner: Codex
  - Branch: `codex/feature/legal-policies-2026`
  - Done: 2026-08-23
  - Summary: Align the public legal pack with current data flows, Russian localization, analytics consent, and category-level recipient disclosures without publishing infrastructure details.
  - Tests: Focused backend pytest 4 passed; Vitest 3 files/9 tests; ESLint, Prettier, Black,
    focused Ruff, production build, `git diff --check`, and five-route browser smoke passed.
  - Risks: Legal wording and Roskomnadzor cross-border disclosures require final factual/legal approval.

## Risks / Rollback

- Risks:
  - Public wording creates operational commitments and exposes any remaining mismatch with
    the Roskomnadzor notification.
- Rollback plan:
  - Revert the isolated legal-policy commit; no schema or configuration rollback is needed.

## Completion Checklist

- [x] `meta/tools/sdd check-complete airis-public-legal-policies-2026-08-23-001 --json`
- [x] `meta/tools/sdd complete-spec airis-public-legal-policies-2026-08-23-001 --json`
- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)
