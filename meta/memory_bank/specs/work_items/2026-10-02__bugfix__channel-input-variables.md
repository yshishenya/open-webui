# Channel input variable source

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/channel-input-variables
- SDD Spec: N/A (a local identifier correction and an existing helper signature; no new subsystem or contract behavior)
- Created: 2026-10-02
- Updated: 2026-10-02

## Context / Root Cause

Channel text insertion searches browser `prompt` instead of the editor content. RegExp.exec silently coerces that function to a string, yielding no template variable matches and forcing the editor to scroll even when variables remain. Ordinary chat correctly reads its own prompt string. The editor onChange callback updates the channel `content` after insertion, command replacement and variable substitution.

## Goal / Acceptance Criteria

- [x] Trace every helper call and all channel insertion paths before editing.
- [x] Reproduce the wrong scroll branch using the actual handler and parser (two failing cases, three passing controls).
- [x] Inspect current editor content after insertion and variable handling; preserve chat behavior.
- [x] Declare concrete helper and changed handler contracts without suppression or dependencies.
- [x] Regression cases pass for insertion, command replacement and variable resolution in channel and chat.
- [x] Docker frontend tests, formatting, lint delta and strict diagnostic delta recorded.
- [ ] Exact-source CI/merge accepted; production acceptance remains a separate release gate.

## Scope / Upstream Impact

`src/lib/components/channel/MessageInput.svelte`: use the existing content state and remove the already unused match binding. `src/lib/utils/index.ts`: annotate the existing parser's input/output only. No new utility, dependency, event, endpoint or template interpretation. The regression test runs the actual extracted insertion handler and parser with editor/DOM boundaries substituted; it is not full RichTextInput/browser acceptance.

## Verification

Docker Compose frontend tests and svelte-check; Prettier and changed-file ESLint delta against baseline. The runnable handler test must fail on the former identifier and retain passing ordinary-chat controls. Final production browser acceptance is recorded separately.

## Risks / Rollback

Low: content must reflect the editor's onChange updates before inspection. Existing tick boundaries are preserved. Revert this source change; no configuration or database changes.

## Local acceptance

Combined source based on accepted PR170 merge118593fea32ea3aa93742fe79e71e08c1fbc8be3: Docker171/171, regression5/5, Prettier passed. Strict check4730→4729 errors with217 warnings unchanged; ESLint1621→1620 errors/0 warnings. No new untouched-file or test diagnostics and no new lint message. Existing channel lint19 errors remain. Full strict/lint gates stay open. Shared types SDD212 completion is included as documentation of the already accepted PR170.
