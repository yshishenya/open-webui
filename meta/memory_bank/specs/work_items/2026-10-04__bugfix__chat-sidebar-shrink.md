# Keep the collapsed chat sidebar on screen

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/chat-sidebar-shrink
- SDD Spec: meta/sdd/specs/active/airis-chat-sidebar-shrink-2026-10-04-1600.json
- Created: 2026-10-04

## Problem and measurable goal

In a saved long guide conversation at desktop width 1280, collapsing the sidebar moves its 42-pixel rail to x=-42 and its opening button to x=-38. The chat root retains the full 1280-pixel width with min-width:auto; the flex parent aligns overflowing content to the right. A user cannot click the offscreen opening button.

- [x] Reproduce on the accepted application and record geometry without sending new messages.
- [x] A regression assertion fails on the prior artifact and passes on the fixed artifact.
- [x] Collapsed rail/button stay within the viewport; the visible button opens history in all three long guide scenarios, before and after reload, in desktop Chromium and narrow Firefox.
- [x] Complete paths preserve exact free quota, payment credit, return navigation and one captured email; no new page errors or type/style diagnostics.
- [ ] Exact source CI, accepted artifact and production browser behavior recorded; temporary viewport restored.

## Trace and minimum implementation

The root Chat component is used by the home and saved-chat routes and embedded note chat. Reuse its existing Tailwind sizing. Inspect the flex ancestors and constrain only the automatic minimum width that prevents shrinking; keep message and pane behavior unchanged. No JavaScript, dependency, API or backend change.

Strengthen the existing complete-path sidebar helper: assert the opening button is inside the viewport and click it directly. A keyboard shortcut must not hide a failed pointer path. Retain the existing local external-protocol fixtures and ordinary disposable accounts.

## Upstream impact

One sizing class in upstream-owned Chat.svelte if verified necessary; the flex root owns this constraint. No component moves or formatting changes. Existing fork-owned E2E helper gains the regression assertion.

## Verification and limits

Docker Compose-first complete browser paths against the prior and fixed compiled artifacts; frontend tests, changed-file formatting/style, full type/style delta, unchanged backend hashes and exact CI. Preserve existing quality debt and real-world pilot conditions. No production payment, consent or message submission is needed to test this layout.

## Risks / rollback

Check empty chat, long saved title, expanded sidebar, narrow viewport and embedded note root. Roll back to the accepted prior image if health or layout acceptance fails. Keep the established deployment backup/configuration/analytics gates.

## Local acceptance — 2026-10-04

Prior compiled regression fails with the opening button at x=-38. Runtime source `c5fd97644940c159ae46094f4986bbe5f95de624`, local candidate `sha256:c85cb08571417d0c23f774edd5ce1994252062168ac8b60ba3a1c50ba6615f77`: 10/10 complete paths and 2/2 empty/embedded note cases in Chromium and Firefox, no skips or page errors. The visible button opens history before and after reload in all three guide tasks. The added note test sends no requests to the model and creates no usage, successes or money entries.

All 4913 compiled frontend files and 425 backend Python files match the candidate proof; 25 inherited layers and image environment remain unchanged. Build version matches the exact source. The accepted dynamic public environment module is preserved from the deployed base, with identical hash; the compiled code uses the existing dynamic public settings. An initial build was killed during chunk rendering and left stale output; its candidate was rejected and removed before testing or publication. Stopping only the owned test application allowed the full rebuild to complete.

Docker frontend: 480 tests in 72 files pass. Strict E2E style and diff checks pass. Full types retain 3967 errors/164 warnings and full style 1419 errors; normalized type diagnostics match exactly, zero added or removed. Runtime code diff is one Tailwind sizing class; APIs, backend and dependencies are unchanged. Source CI and production acceptance remain pending.
