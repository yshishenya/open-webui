# Attachment source resolution

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/attachment-image-sources
- SDD Spec: meta/sdd/specs/active/airis-attachment-image-sources-2026-10-04-2119.json
- Created: 2026-10-04

## Context and root cause

Chat and channel inputs plus channel messages call startsWith on an optional attachment URL. Restored drafts and desktop query attachments bypass the normal upload producer and can omit that URL. Saved chat view/edit has optional chaining but creates /files/undefined or /files/null. Channel messages compute the URL before inspecting the attachment type, so an ordinary document can also break the whole message.

Normal uploads set url to the uploaded ID and content_type from server metadata. Backend /files/{id} returns JSON metadata; /files/{id}/content serves media under existing authorization. The older explicit-URL contract and data/http passthrough must remain compatible. Unknown descriptors must not mutate user drafts or broaden the Image allowlist.

## Goal / acceptance criteria

- [x] All five actual source expressions handle omitted/null/empty URL without throwing or producing undefined/null paths.
- [x] A known ID without a URL resolves to authorized file content; no address/ID yields an empty string consumed by the existing image placeholder.
- [x] Existing data/http URLs and explicit ID/content_type behavior remain unchanged; channel video and document rendering still work.
- [ ] Actual consumer regressions fail on baseline and pass after repair; full frontend tests pass, no new type/lint diagnostics, compiled browser scenarios pass.
- [ ] Source CI/merge, candidate and guarded production identity/health/configuration verified; full onboarding goal remains open.

## Scope and upstream impact

One small fork-owned resolver in src/lib/utils/airis with thin calls in chat/MessageInput, chat/Messages/UserMessage, channel/MessageInput and channel/Messages/Message. Replace all five duplicate expressions and use exact native equality for the optional modal type. Retain existing Image safety policy, uploads, draft storage, file preview, API, database and dependencies. No broad component formatting.

## Verification / rollback

Use Compose-created frontend tools for actual expression regressions, full Vitest, check and lint; compare against baseline 3789 errors/163 warnings/1416 ESLint. Browser checks use the compiled candidate and existing real backend fixture. Guarded release preserves the environment, neighbors and recovery point with the existing disk limit. Roll back to the current accepted image if runtime acceptance fails. Controlled checks do not establish a real pilot, money, external delivery or answer usefulness.

## Source verification

Five actual consumer cases fail before the repair; all seven targeted checks and 505/505 frontend tests in 76 files pass after it. Check3789→3785 errors, warnings163 unchanged: four removed, zero new or refined diagnostics. ESLint1416 unchanged; new helper/test scoped lint passes. Overall quality gates remain red. Compiled candidate, exact-source CI and production acceptance remain pending.
