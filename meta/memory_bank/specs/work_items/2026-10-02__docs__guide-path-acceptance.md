# Guide entry path acceptance

## Meta

- Type: docs
- Status: done
- Owner: Codex
- Branch: codex/docs/guide-path-acceptance
- SDD Spec: N/A (existing configuration and acceptance documentation; no application code change)
- Created: 2026-10-02
- Updated: 2026-10-02

## Context

The guide must preserve its prepared task across sign-in and remain discoverable from the chat. The existing banner renders sanitized Markdown links; its optional URL field is not used for this entry path.

## Goal / Acceptance Criteria

- [x] All three guide examples preserve the full draft across a fresh authorized provider sign-in, choose the intended free model, and require explicit submission.
- [x] Three completed foreground responses match measured provider usage and free quota, with zero monetary ledger entries during the isolated acceptance window.
- [x] The existing support banner also offers a Markdown guide link; the original support text and all other banner fields are preserved.
- [x] Ordinary-account browser acceptance confirms the banner link opens the guide on desktop and a narrow viewport.
- [x] Configuration snapshots and conditional rollback instructions are retained privately; documentation contains no credentials or account identifiers.

## Scope / Implementation

Reuse `GET/POST /api/v1/configs/banners` and `src/lib/components/common/Banner.svelte`. Save the previous array, require exactly one intended support banner, verify raw configuration and API agreement, and re-read immediately before the update to detect concurrent changes. Update only that banner's Markdown content. Compare the returned and fresh-read arrays with the exact expected array. Never retry an uncertain POST blindly; read the saved state first.

## Upstream impact

No upstream application files, dependencies, migrations, or runtime image changes. Existing API and Markdown rendering provide the entire feature.

## Verification

- Read-only production acceptance: three guide tasks through fresh sign-in, measured usage, free quota, zero monetary mutations.
- Existing banner API: before/after array preservation and exact read-back.
- Browser: desktop and narrow-screen guide link, no horizontal overflow, guide reached.
- Docs-only formatting and link checks. Existing source tests remain the evidence for unchanged application code; no redundant test suite is introduced for text configuration.

## Risks / Rollback

The banner API replaces the full array. Save the original array and abort if it changes before submission. For rollback, require the current array to equal this change's expected array before restoring the saved array through the same admin API. Concurrent later edits must be preserved.

## Completion

- [x] Acceptance criteria recorded with private proofs.
- [x] Branch update completed; docs committed and pushed with PR targeting airis_b2c.
