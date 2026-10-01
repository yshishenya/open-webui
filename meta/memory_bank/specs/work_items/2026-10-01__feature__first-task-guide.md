# AIRIS first task guide

## Meta

- Type: feature
- Status: done — source and local verification; production acceptance pending
- Owner: Codex
- Branch: codex/feature/first-task-guide
- SDD Spec: meta/sdd/specs/completed/airis-first-task-guide-2026-10-01-001.json
- Created: 2026-10-01
- Updated: 2026-10-02

## Context

New users need a readable start page and a ready-to-edit first request. An unavailable model named in a link currently falls back to a default model; that can unexpectedly change the price.

## Goal / Acceptance Criteria

- [x] Public /guide works without login or analytics consent; three examples and follow-ups remain readable when configuration fails.
- [x] Examples preserve q, model and submit=false through signup/login; no automatic request.
- [x] A missing or hidden explicitly requested model leaves selection empty with a clear message, rather than selecting a default model.
- [x] Free quotas, cycle and top-up amounts use existing public configuration; wallet fallback after quota exhaustion is explained.
- [x] Guide is reachable from public navigation, welcome footer, contact and chat help.
- [x] Docker frontend checks and desktop/mobile browser checks recorded; release and human acceptance tracked separately.

## Scope

Add a public page using PublicPageLayout, existing billing clients and welcomeNavigation. No dependencies, database changes or new API. Implementation covers guide tasks 06.06–06.15, 06.17–06.19 of the local product plan. Three tasks: write a letter, understand a topic, plan a week. Each includes a follow-up and result checklist. Video and human acceptance are separate work.

## Implementation Notes

Use gpt-5.6-luna explicitly in example URLs. The page does not promise that every request is free: eligibility and remaining quotas are server-controlled, and existing billing falls back to wallet. Public configuration failure must not block the text or task links. Query parameters carry the draft; session storage is a best-effort backup.

## Dependency compatibility

Checked package-lock.json and npm latest metadata on 2026-10-01: Svelte 5.56.0 (latest 5.57.1), SvelteKit 2.68.0 (latest 3.0.0), Vitest 1.6.1 (latest 5.0.3), Playwright 1.62.1 (latest 1.63.0). Retain existing pins for this additive page: Kit/Vitest major upgrades require an independent compatibility pass across the fork and Node support. Upgrade path: dedicated dependency work item with full build/test checks. No new or replaced dependency.

Official docs read: https://svelte.dev/docs/svelte/legacy-reactive-assignments and https://svelte.dev/docs/kit/page-options ; current Svelte release notes checked. Legacy reactive statements and existing static-page options remain supported. New Kit major release notes require a separate migration; do not combine it with guide delivery.

## Upstream impact

- src/lib/components/chat/Chat.svelte: thin hook to fork-owned explicit-model resolver; retain existing model-selector UI and default behavior when no model is requested. The unavailable-model message uses the existing English/Russian translation mechanism.
- src/lib/components/layout/Sidebar/UserMenu.svelte: one guide link in existing help section. To keep changed-file lint passing, also remove an already unused navigation function and correct two existing accessibility/HTML diagnostics in the same file (group role and explicit span closing tag).
- All other changes are Airis public pages/helpers/tests/docs; no unrelated formatting.

## Verification

Docker Compose-first: focused/full frontend Vitest, changed-file Prettier/ESLint, svelte-check, Vite production build; Playwright public page and auth/prefill/model-unavailable scenarios. Backend runtime is unchanged; backend tests are not required for this UI-only change.

## Verification results

- Full frontend Vitest: 33 files / 130 tests passed. Changed-file ESLint passed.
- Chromium: 7/7 guide scenarios passed with real local signup/login and mocked model catalog/public billing configuration. The login test now uses the actual signup-to-signin switch; changing only mode while form=signup remained in the URL tested the wrong state. No auth runtime change was necessary.
- Common baseline: svelte-check reports 8,360 errors / 224 warnings in 349 files; full frontend lint fails inside @typescript-eslint/no-unused-vars on the existing FileNav/FilePreview.svelte. These checks are not green. No new diagnostics were found in the new guide/navigation/model resolver. The localized message and final production build passed; Firefox 7/7 passed on that build. Final Chromium 7/7 passed on the same final build.
- Compose Vite builds with source maps enabled exceeded the 4 GiB Node heap / Docker Desktop memory limit. Final production build passed using the existing production setting AIRIS_VITE_SOURCEMAP=false and 4 GiB heap; no build-tool change.
- Public guide is Russian, consistent with the existing public pages. Chat model-unavailable message is localized in English/Russian.
- Manual source review: existing helpers reused, no auth/backend/schema/dependency changes, explicit model selection never falls back, native modified link clicks retained, no new analytics SDK, bounded public configuration loading.

The repository has no npm preflight script. Its existing Docker test/lint/typecheck/build checks were used; baseline failures above remain disclosed, so the PR starts as a draft. Backend checks are not applicable because runtime backend/schema are unchanged.

## Remaining release gates

Production rollout, real ordinary-account answers/follow-ups, video/subtitles, Telegram placement and representative-user acceptance are independent open gates. The current production runtime includes concurrent analytics changes, so a full image from the integration branch must not replace it. Prepare a frontend-only layer over the current immutable runtime, preserving the current analytics frontend source and configuration before deployment.

## Risks / Rollback

Explicit model links no longer silently choose a different model. Ordinary chat defaults remain unchanged. Revert the guide commit to roll back. Production release and ordinary-account LLM output verification are independent gates and must not be inferred from mocks.

## Completion Checklist

- [x] SDD check-complete and complete-spec
- [x] Branch status and verification updated
- [ ] Commit and PR to airis_b2c
