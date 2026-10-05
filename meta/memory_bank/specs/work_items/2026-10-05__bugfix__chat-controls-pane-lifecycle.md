# Chat controls: pane lifecycle across responsive breakpoints

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/chat-controls-pane-lifecycle
- Created: 2026-10-05
- SDD Spec: meta/sdd/specs/completed/airis-chat-controls-pane-lifecycle-2026-10-05-001.json

## Goal

Preserve the current chat and open controls across the 1024 px drawer/pane breakpoint. Measure the actual mounted behavior before changing code. This follows the complete onboarding acceptance objective and its mandatory browser path; it does not replace physical-device or real-pilot evidence.

## Suspected cause and existing flow

ChatControls creates a new Pane with defaultSize=0 when largeScreen becomes true. The parent Chat opens the pane only on showControls store updates. Its media-query callback does not restore an already-open pane after recreation. openPane/onResize also assume a ready API and existing, nonzero-width container. Trace the one parent and library lifecycle before repairing any demonstrated failure. Unused generic Selector has no callers and is outside this work.

## Measurable acceptance

- [x] Reproduce an actual failure across desktop → drawer → desktop with open controls; retain the saved chat, draft and chosen tab.
- [x] Prove the library's bound pane API and callback order for the pinned version; document any compatibility constraint without upgrading dependencies.
- [x] Add the smallest regression covering the failed lifecycle, restoration and a closed panel; baseline fails, repair passes.
- [x] Open/closed state and existing width persist across the breakpoint; no exception for a detached/zero-width container or unavailable pane API.
- [x] Preserve ordinary controls, file access and conversation permissions, history, draft and submitted request count.
- [x] Pass applicable Compose frontend tests, mapped type/lint checks and exact-head CI; prove candidate/browser and production acceptance separately if executable code changes.

## Upstream impact

If needed, keep lifecycle guards inside the existing ChatControls component. Avoid unrelated FileNav, model, billing or permission changes. Add no dependency or abstraction. Create/cross-link implementation SDD before non-trivial code changes.

## Verification status

Production decoder and PR261 release remain accepted. The pane lifecycle defect is reproduced and repaired in source. Full objective G01–G17 and plan 192/244 remain active.

## Confirmed production reproduction

At 1280 px controls were open (341.21875 px). At 390 px the drawer remained open. Returning to 1280 px removed the controls-container; chat pane expanded to 1238 px. No console error, request or payment; the saved conversation and empty input persisted. Opening Controls again restores the panel. Browser viewport and sidebar were reset afterward. Screenshots/private receipts remain local.

Pinned paneforge 0.0.6 official source confirms that a bound PaneAPI is created and a defaultSize=0 pane starts collapsed. Current stable is 1.0.2; preserve the pinned library for compatibility with existing legacy Svelte bindings. Dependency upgrade requires a separate compatibility review, not this lifecycle fix.

## Source verification

The mounted regression failed before the fix (open state became false); all 6 cases pass after it. Complete frontend suite: 553 passed across 80 files. Full svelte-check: 3733 errors / 159 warnings versus 3742 / 159 baseline; mapped comparison proves 0 new diagnostics and 9 removed. Full ESLint: 1384 pre-existing errors, 0 new diagnostics; both changed runtime files and both test files have 0 ESLint findings. Repository-wide checks remain non-green; this task does not claim their general closure.

ChatControls distinguishes initial pane collapse from a user close and restores the previous open state after Svelte mounts the desktop pane. openPane validates the bound API, container width and saved positive size. The parent Chat uses PaneAPI for its binding (2-line type-only change); chatId is explicitly string|null. No application dependency, backend, database or permission changes.

Candidate compiled-path tests, public responsive acceptance, exact-head CI, immutable image identity, backup/rollback and environment preservation are still pending. npm run preflight is absent; existing Compose checks replace that unavailable script.

## Additional production acceptance finding

PR264 merged with 10 successful CI checks / 1 dependency-review skip; candidate passed 18 browser paths and was released. Public 1280 → 390 → 1280 retained the open Files tab, exact width (346.359375 px), saved chat and empty input. However, a manually closed panel reopened on return to desktop when a terminal was selected. Production acceptance is therefore incomplete; release task remains active.

Cause: the terminal-selection reactive block also depends directly on largeScreen, replaying showControls.set(default true) on every breakpoint. Two added mounted cases reproduce this with a selection made on desktop or mobile: baseline 2 failed / 6 passed. Keep selection handling dependent on the terminal/tab condition; read screen and preference inside the existing component callback so a breakpoint does not replay selection. Desktop selection still auto-opens; mobile selection stays closed.

After repair: 8/8 mounted cases and 555/555 full frontend tests pass. Full svelte-check remains 3733 errors / 159 warnings, 0 new mapped diagnostics versus the original baseline. Focused ESLint/Prettier pass. Follow-up exact-head CI, compiled browser paths and production verification remain required before closing this work item.

## Final acceptance — 2026-10-05

Both defects are accepted on production after PR265: 555/555 frontend, 20/20 compiled paths, 8/8 mounted cases; selected-terminal open state preserves exact width and manually closed state stays closed at 1280 → 390 → 1280. Saved messages/input retained; 0 new requests, payments or console errors. Exact image/files/configuration/environment, 13 neighbors, backup/rollback and migration verified. Original SDD 2/2 closed. Earlier pending statements above record intermediate stages; final [release acceptance](2026-10-05__docs__pane-lifecycle-release-acceptance.md) supersedes them. General frontend checks and complete onboarding objective remain open.
