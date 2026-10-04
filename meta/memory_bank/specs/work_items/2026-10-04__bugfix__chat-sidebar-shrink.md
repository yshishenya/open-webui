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
- [ ] A regression assertion fails on the prior artifact and passes on the fixed artifact.
- [ ] Collapsed rail/button stay within the viewport; the visible button opens history in all three long guide scenarios, before and after reload, in desktop Chromium and narrow Firefox.
- [ ] Complete paths preserve exact free quota, payment credit, return navigation and one captured email; no new page errors or type/style diagnostics.
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
