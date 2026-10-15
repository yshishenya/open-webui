# Profile preview loading

## Meta

- Type: bugfix
- Status: source stage complete; release pending
- Owner: Codex
- Branch: codex/bugfix/profile-preview-loading
- SDD Spec: meta/sdd/specs/completed/airis-profile-preview-loading-2026-10-09-015.json
- Created: 2026-10-09
- Base: origin/airis_b2c d579f5c02926cace8c8da60434ce1c39c7284361; explicit fast-forward dependency 85015155b82fb7fac43ebe7ac0a94bde075e068c.

## Context / root cause

G14 source work. ProfilePreview forwards openPreview; MentionToken uses a separate LinkPreview.Root without binding/forwarding its open state, while shared UserStatusLinkPreview only requests when openPreview=true. The shared loader retains old user data on a changed id, compares only the requested id (ABA stale-response risk), and retains failed/pending ids across close/reopen. These are related root-level loading/lifecycle defects, not a styling task.

## Goal / measurable acceptance

- [x] Reproduce user mention opening and stale/retry/lifecycle failures in actual compiled components before fixes.
- [x] Both parent paths open the shared profile; no closed/non-user mention request.
- [x] The displayed profile belongs to the current id; overlapping/repeated ids, closure, null id and destruction reject stale results.
- [x] Success is cached for same-id reopen; a failed/abandoned load can retry on reopen without a reactive loop.
- [x] Reuse exact backend UserInfoResponse fields and installed LinkPreview prop types; eliminate local type errors without new diagnostics elsewhere.
- [x] Full frontend and relevant regressions pass; own formatting; backend byte equality and protected state verified.
- [x] Source committed/pushed/remote-matched; linked documentation/SDD completed for source scope.
- [ ] General zero-error gate/preflight/PR/integration/same-SHA backend/frontend/E2E/image/production/real A/B acceptance.

## Scope / upstream impact

Shared UserStatusLinkPreview lifecycle and thin MentionToken open binding; accurate profile/position types in UserStatus/ProfilePreview and users API. All direct parents/API consumers traced (profiles in admin/channel/member selector/messages and user mentions). No new dependency/schema/backend/config change. Keep the single-open ProfilePreview behavior. A native LinkPreview component test replaces only profile display and external API calls; full layout/public-production acceptance stays separate.

## Verification / risks

Docker Compose-first, same regression on original/fixed components. Test actual native LinkPreview opening and compiled Svelte scheduling plus id/cache/disposal races. Full frontend/check/lint diagnostic comparisons; freeze source and match remote Git objects. Pure type/template corrections must preserve compiled behavior. Backend hashes retain old proof only on identical bytes; fresh full release matrix required. Read-only production capture, exact neighbor delta and 21 protected primary files. No AI calls or personal data fixtures.

Evidence: /Users/yshishenya/.codex/private-artifacts/airis-profile-preview-loading-20261009.

## Source verification — 09.10.2026

Original native component regression: 9 failures/5 passes,14 cases; fixed14/14. The final formatted harness reproduces the same original9/5. Native bits-ui Root/Trigger/Portal are used; only API requests and unrelated profile display are substituted. Invalid stores in the first harness were corrected before application edits and are not counted as product failures.

Full Docker frontend:1046/1046,128 files. Types2043→2013, warnings108→105;ESLint1006→992. Diagnostic multisets:new0,removed30 type errors/3 span warnings/14 lint errors. Own six-file formatting passes. No dependencies or suppressions added. Existing native LinkPreview lifecycle emits Svelte derived_inert warnings under jsdom,including post-disposal reads;no warning suppression. Production UI acceptance and warning-free release gate remain open.

Entire compiled ProfilePreview (including single-open module) and erased users API are unchanged after unused imports. Compiled UserStatus matches after two explicit nullable fallbacks (tooltip text/groups);three span closure corrections preserve compiled markup. Lifecycle/open-binding fixes are intentional runtime changes verified by regressions. Existing skill/model/channel mention routing and labels remain unchanged for valid tokens.

1520 source files frozen by SHA256:1066 frontend/454 backend. Backend is byte-identical to the previous1025-pass/no-skip proof;backend/Black/Ruff not rerun in this frontend-only stage. Fresh same-SHA full release checks remain required.21 protected primary files are unchanged. Production11:35:00.626077UTC:c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908,healthy,restarts0;image/env/config/mounts and all14 neighboring containers unchanged. This stage performed read-only remote inspection.

Dependency compatibility:installed bits-ui2.16.3 API and official repository README/changelog reviewed;latest stable2.19.5. No new integration or upgrade;preserve pinned tested dependencies,upgrade separately with full acceptance. Official documentation site returned403;official repository material fetched200. marked9.1.6 remains unchanged.

General zero-error/preflight/PR/integration/image/deployment gates and real A/B conditions remain pending. Numbered plan198/244,46 open,new closures0. The SDD covers this source-stage delivery only.

Source delivery: `2bea931bde541cab2c23ca0707ed78732e389bbd` pushed to codex/bugfix/profile-preview-loading;remote SHA and all1520 tested Git blobs match. Source SDD3/3 complete;all189 specs schema-valid. Temporary frontend/pytools runners0;no persistent fixture volumes created. Existing shared cache(created2026-10-01) and network preserved. Source scope reviewed against bug_fix/code_review;general release checklist remains pending.
