# Channel input variable source

## Meta

- Type: bugfix
- Status: done
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
- [x] Exact-source CI/merge accepted; deployed frontend matches the validated candidate.

## Scope / Upstream Impact

`src/lib/components/channel/MessageInput.svelte`: use the existing content state and remove the already unused match binding. `src/lib/utils/index.ts`: annotate the existing parser's input/output only. No new utility, dependency, event, endpoint or template interpretation. The regression test runs the actual extracted insertion handler and parser with editor/DOM boundaries substituted; it is not full RichTextInput/browser acceptance.

## Verification

Docker Compose frontend tests and svelte-check; Prettier and changed-file ESLint delta against baseline. The runnable handler test must fail on the former identifier and retain passing ordinary-chat controls. Final production browser acceptance is recorded separately.

## Risks / Rollback

Low: content must reflect the editor's onChange updates before inspection. Existing tick boundaries are preserved. Revert this source change; no configuration or database changes.

## Local acceptance

Combined source based on accepted PR170 merge118593fea32ea3aa93742fe79e71e08c1fbc8be3: Docker 171/171, regression5/5, Prettier passed. Strict check4730→4722 errors with warnings217→215; ESLint1621→1601 errors/0 warnings. No new untouched-file or test diagnostics and no new lint message. Changed channel/helper/test files have zero lint errors. Full strict/lint gates stay open. Shared types SDD212 completion is included as documentation of the already accepted PR170.

CI initially exposed all19 existing channel lint errors. Remove unused imports/callback arguments/bindings, type existing callbacks and variable maps, remove the unused showFormattingToolbar prop (no caller passes it), and preserve the caller id prop as a data-input-id DOM hook for scoped editor verification. Both callers still supply their unchanged id values. No new dependency/rule suppression; all tick, input and substitution algorithms remain.

## Accepted delivery

PR171 accepted source `e27097f82da6cebc9e170b41139415b16952f068`, merge `a702825db181e4e2f5ef080b906b86d5362dd73c`; all 12 observed statuses satisfied (dependency-review skipped; CodeRabbit review skipped, not a human review). Docker 171/171 and the five handler regression cases passed. The frozen production candidate passed 12 existing wallet/free-quota/recovery/guide browser cases and one real channel RichTextInput check: slash-template substitution, preservation of an existing unresolved variable, and editor focus. The browser check covers the editor flow; the handler regression separately asserts the scroll branch.

The accepted frontend was deployed and all 5757 live frontend file hashes matched the frozen build; 476 immutable backend file hashes retained, runtime configuration retained and health passed with zero restarts. Docker executed source checks and browser tests. Build used official checksum-verified Node22.23.3 on macOS after Docker VM memory exhaustion; Docker source checks used Node22.16.0. Existing global strict/lint failures remain documented (4722 errors/215 warnings and 1601 lint errors); no new diagnostics.
