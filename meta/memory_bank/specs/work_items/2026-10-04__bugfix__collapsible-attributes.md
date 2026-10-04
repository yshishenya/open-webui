# Collapsible: valid detail attributes and disclosure contracts

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/collapsible-attributes
- SDD Spec: meta/sdd/specs/active/airis-collapsible-attributes-2026-10-04-2247.json
- Created: 2026-10-04

## Context / root cause

Shared Collapsible infers title/attributes as null-only and uses an unsafe Function callback. Ten actual consumer files plus one unused-import consumer were inspected; common/Folder is an additional actual consumer omitted from the preceding analysis. Structured output and Markdown producers supply string attributes, including duration. Dayjs1.11.20 correctly handles numeric strings70/120 with a unit; that hypothesis is refuted. Invalid duration instead reaches humanize and displays a month; negative values falsely claim less than a second. Attribute data can come from model-generated Markdown and saved messages.

## Goal / measurable acceptance

- [x] A regression mounted against the actual baseline component fails for malformed/negative/non-finite duration; correct labels remain for valid string/numeric boundaries and absent/zero values.
- [x] Shared title, attributes, localization context and onChange have concrete compatible types; no descriptor mutation and no new type diagnostics in consumers.
- [ ] Disabled state, button aria-expanded, callback, slotted header/content, grow/hide and reasoning/code-interpreter completion behavior remain correct.
- [x] Focused and full frontend tests pass; all changed files pass strict ESLint and formatting; full diagnostic comparison against3763 errors/160 warnings/1396 ESLint adds zero diagnostics.
- [ ] Compiled browser behavior, exact-source CI/merge and guarded production identity/health/configuration verified before production completion.

## Scope / upstream impact

Only shared upstream common/Collapsible.svelte and additive regression tests/docs. Remove unused decode/uuid/id; describe actual nullable title and used attributes; normalize duration once, fall back to existing Thought label if it is not usable. Preserve all slots, transitions, accessibility guards, callback and completion logic. Controls/ChatControls remain separate follow-up because their model/stop contracts need complete tracing. No dependencies/API/schema/config changes.

## Dependencies

Installed dayjs1.11.20, latest stable1.11.23 verified via npm registry; official duration creation documentation confirms a number with a unit. Keep the existing project pin for this focused repair. Upgrade through the existing dependency work item with release-note review and full acceptance, not within a display repair.

## Verification / rollback

Compose-created frontend tools container; actual mounted component regressions, full Vitest, check/lint and mapped diagnostic delta. Existing compiled candidate/backend fixture and guarded deploy with fresh baseline, verified backup and retained rollback. Full goal G01–G17 remains active; plan192/244 is unchanged until a complete numbered criterion has evidence.

## Source checks

Baseline05ad7e0f8: malformed/negative/Infinity duration regressions fail3/16, without unhandled errors. Final25 mounted checks (valid string/numeric boundaries, running/completed/code interpreter, Russian locale, callback and disabled) and547/547 frontend tests in79files pass. Strict changed-file ESLint/Prettier pass. Fullcheck3763/160→3743/160:20removed,0new,4existing dir-prop signatures refined. FullESLint1396→1393:3removed,0new. Overall full-project checks remain red. Slotted/grow/hide/browser/sourceCI/production acceptance pending.
