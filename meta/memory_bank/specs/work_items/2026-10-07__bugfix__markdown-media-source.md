# Markdown video/audio source extraction

- Type: bugfix
- Status: active
- Workflow: bug_fix
- Owner: Codex
- Branch: `codex/bugfix/markdown-media-source`
- Created: 2026-10-07
- SDD Spec: `meta/sdd/specs/active/airis-markdown-media-source-2026-10-07-001.json`

## Root cause and scope

replaceTokens emits a video src attribute. HTMLToken reads only inner text, so saved
Markdown responses display markup instead of a player. Accepted compiled source
0b43a8ce6 fails the player assertion in Chromium and Firefox. Audio uses the same
incorrect parser. Both Markdown block and inline consumers use HTMLToken.

Use the existing DOMPurify and native DOM attribute access in a fork-owned helper;
keep two thin hooks in HTMLToken. Preserve safe legacy inner-text sources and code
exclusions. URI sanitization must also cover legacy text promoted into src.

## Measurable acceptance

- [x] Actual component regression fails on baseline, passes for video/audio src attributes, legacy text, escaped query strings, empty and unsafe sources.
- [x] Helper/test checks pass; existing component diagnostics introduce no new messages; complete frontend suite passes; zero new normalized type/lint diagnostics.
- [ ] Compiled Chromium/Firefox display actual players after load/reload; video file token and code exclusion pass with zero page errors.
- [ ] Full onboarding/payment paths pass against the exact candidate.
- [ ] Source/CI/merge/image/file identity and guarded production health/data preservation accepted before closure.

## Dependencies

No new or changed dependency. Existing DOMPurify pinned 3.4.11; official tagged
README confirms DOM-node input and RETURN_DOM_FRAGMENT. Latest stable at verification is
3.4.16. This reuses the existing sanitizer without expanding its protocol policy;
a dependency upgrade belongs to a separate full sanitization-compatibility task.

## Upstream impact

HTMLToken.svelte: replace only the repeated source regexes with shared helper calls.
Fork-owned helper and actual component regression avoid caller-specific patches.
No backend, migration, external sending, quota or payment behavior changes.

## Verification and rollback

Docker Compose frontend tests, changed-file formatting/ESLint, full types/ESLint
comparison, frozen compiled candidate and full-path fixture. Production uses current
runtime CAS, backup/readability/migration/disk/health gates and retained rollback.
Global G14/13.11 and human/calendar criteria remain independently open.

## Source checks

Baseline component: 16 failures/8 passes; separate closing-tag check 2 failures/24 passes. Fixed component 26/26; full frontend 770/770 (95 files). Helper/test/E2E ESLint and formatting pass. CI required removing four old component lint messages: use the existing token ID for players, remove the unused audio-only suppression and document cross-origin iframe height fallback. Global ESLint 1227 and types 3362/130 remain failing, zero new normalized diagnostics. Runtime diff also consumes standalone native media closing tokens; code spans/fences remain outside HTMLToken.

## Browser environment and test fixture

First candidate media test proved playback in Firefox; Chromium reports no H.264 support and cannot load the existing H.264 guide. Both support VP8. A 745-byte standard VP8 fixture (1-second 16x16 black clip, no personal data) checks native load/play/reload in both. Unsafe-source browser assertions check the visible opening tag and zero players; consumed closing tags are not expected as text. The initial unsuccessful browser output is retained as evidence, not accepted as a passing run.
