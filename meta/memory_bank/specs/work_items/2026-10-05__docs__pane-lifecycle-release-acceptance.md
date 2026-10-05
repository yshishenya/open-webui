# Pane lifecycle and terminal selection release acceptance

## Meta

- Type: docs
- Status: done
- Owner: Codex
- Branch: codex/docs/pane-lifecycle-acceptance
- Created: 2026-10-05
- Related SDD: `meta/sdd/specs/completed/airis-chat-controls-pane-lifecycle-2026-10-05-001.json` (2/2)
- Related implementation: [pane lifecycle bug fix](2026-10-05__bugfix__chat-controls-pane-lifecycle.md)

## Result

An open pane was lost when returning from the mobile drawer to desktop. After repairing pane recreation, a production check with a selected terminal exposed a second defect: a manually closed pane reopened on every desktop breakpoint. Keep initial pane collapse separate from a manual close, guard unavailable/zero-width containers and PaneAPI, and run terminal selection logic only on selection changes.

## Source and candidate verification

- [x] Mounted baseline reproduces lost open state. First fix: 6/6; two selected-terminal cases reproduce the adjacent defect (2 failed / 6 passed), final fix: 8/8.
- [x] Complete frontend: 555/555. Full type check: 3733 errors / 159 warnings; 0 new mapped diagnostics versus original baseline, 9 removed. Full ESLint: 1384 pre-existing errors / 0 new diagnostics; focused changed files pass. General checks remain open.
- [x] PR264 source c81f1997656c307c1f073a16a895f77317c154b5 and PR265 source aa68736a977668e9a44eed1c9bd9612be6c6225a each have 10 successful CI checks / 1 dependency-review skip and equal merge trees. CodeRabbit is disabled, not an independent review.
- [x] Final compiled candidate passes 20/20 browser paths in Chromium and Firefox at 390 px: 16 mandatory onboarding paths plus open/closed responsive paths with and without a selected terminal.
- [x] PR266 fixes a separate repeat-setup defect: query the derived constructor model by ID; create only on 404. Fresh and immediate repeat pass 2/2 + 2/2; 10 successful CI / 1 skip; equal source/merge trees and 0 executable app changes. No deployment required for test setup.
- [x] Published/pulled image matches production files, configuration and environment.
- [x] Production open Files panel preserves width/tab/history/input across 1280 → 390 → 1280.
- [x] Manually closed panel remains closed across the same breakpoint with an actual selected terminal; reopening works.
- [x] Fresh backup, rollback, 10 GiB guard, migration, all 3 Compose files and original neighbors are verified.
- [x] SDD 2/2 complete after full production acceptance.

## Limits

Complete onboarding objective and G14 remain open. Controlled fixtures do not prove external Inbox placement, real payments/receipts, physical phone behavior, voluntary usefulness or actual 24h/72h/14d pilot windows. FileNav itself is unchanged; loading a file list does not close all navigation/reactivity/accessibility checks.

## Upstream Impact

Implementation changes the existing ChatControls lifecycle/selection callback and two type-only parent bindings. No dependency, backend, schema or permission change. This acceptance PR changes documentation only.

## Accepted production

Image `yshishenya/yshishenya:terminal-pane-aa68736a9-20261005`, digest `sha256:5dedd55efc12d36f63f4e384c8b90b91bfe6b193d97444c786c7f15e197878b8`. Candidate, registry and production sets match: 4,914 frontend / 426 Python files, layers, labels, platform and image environment. Backend is identical to the previously accepted release. Production is healthy with 0 restarts; runtime environment and all 13 initial neighbors are preserved. Default configuration using all 3 Compose files selects the accepted image; .env changes only image selection with mode 0600. Compiled Metrica environment and frontend version match public files. Fresh backup, retained rollback and hard Alembic gate are verified; available disk after release: 25.791 GiB.

At 1280 → 390 → 1280, open Files retains exact width 346.359375 px. A manually closed panel remains closed with a real selected terminal; reopening works. Saved chat retains 2 messages and empty input, with 0 fresh console errors and 0 submitted requests/payments. Viewport and sidebar restored. Original SDD completed after this acceptance. Private receipts and backups are retained outside the public repository.
