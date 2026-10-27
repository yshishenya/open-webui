# Preserve billing configuration drafts (audit Q02)

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/billing-contact-errors-20261027
- SDD Spec: meta/sdd/specs/active/billing-unsaved-draft-safety-2-2026-10-27-2356.json
- Created: 2026-10-27
- Updated: 2026-10-27

## Context

Independent exact-b2e4 tracing reproduced: no unsaved-navigation protection in billing forms; successful plan requests discard newer input; new-plan responses can redirect after unmount; price failure reinitializes and loses the draft, and late success closes newer editor input. Original audit Q02 explicitly requires these boundaries, not a speculative new feature.

## Goal / Acceptance Criteria

- [x] Wallet settings, free access, plan create/edit and price editor warn before draft-discarding navigation/reload; harmless same-component query transitions remain allowed.
- [x] Cancelling navigation prevents the root frontend-update reload from bypassing the warning.
- [x] Plan saves remember sent values, retain newer edits, ignore obsolete responses and never create a second plan when updating a just-created plan.
- [x] Price close/failure/late success never silently loses newer input; uncertain/partial writes are reconciled before further writes, without blind retry.
- [ ] Focused regressions, full final-source preflight, independent review, ordinary PR/CI/merge and guarded production acceptance are documented separately.

## Scope / Non-goals

Use SvelteKit's existing navigation lifecycle and native unload confirmation, local comparisons and existing API methods. No general draft storage framework, dependency upgrade, commercial-rule/API/schema change or production financial test writes.

## Framework compatibility

Verified package-lock: SvelteKit 2.68.0 / Svelte 5.56.0. Read official tagged Kit client lifecycle source and 2.68.0 release notes on 2026-10-27. Registry latest is Kit 3.1.0 / Svelte 5.57.3. Keep existing pinned versions for this bounded correction: migrating the whole application across a Kit major version would expand auth/router/build risk. No new integration/dependency is introduced. Upgrade path: separate framework-compatibility work item with full auth/navigation/build regression before adopting Kit 3 and the current stable Svelte patch.

## Upstream impact

Fork-owned billing modules/routes/tests. Root `src/routes/+layout.svelte` needs a thin lifecycle ordering correction so its existing forced-update reload cannot run before leaf navigation guards accept departure; no unrelated root reformatting.

`src/lib/components/common/Modal.svelte`: optional synchronous `beforeClose` hook (default accept) at Escape/backdrop boundaries. Existing callers keep their behavior. Escape deactivation is owned by the existing close handler so rejecting a close does not release the focus trap.

## Implementation checkpoint (2026-10-28 local)

120 focused frontend regressions passed across seven files. Native unload confirmation is delegated to SvelteKit; internal departure uses the translated native confirm dialog. Price saves capture editor session and submitted draft; failures never reinitialize the draft. Further writes are disabled until an explicit current-price reload, with confirmation before replacing the visible draft. Input entered during that reload is retained. This intentionally avoids replaying an uncertain partial price write.

Independent review and full exact-commit preflight are still pending. No changes in this branch have been released yet.

## Verification / Rollback

Reproduce each loss in existing mounted-component tests plus narrow real root-callback test; run the established Docker verification image and lock proof. Existing local stock Node Alpine lacks Bash and is unsuitable for the whole frontend suite. Review new browser checks on disposable fixtures only. Revert the scoped commit through the guarded release path; no database restore or monetary correction needed.
