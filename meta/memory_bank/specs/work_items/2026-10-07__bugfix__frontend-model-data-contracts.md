# Common model catalog contracts and rendering acceptance

## Meta

- Type: bugfix
- Status: source acceptance renewed; publication and runtime release pending
- Owner: Codex
- Branch: codex/bugfix/frontend-model-data-contracts
- SDD Spec: meta/sdd/specs/completed/airis-frontend-model-data-contracts-2026-10-07-001.json
- Created: 2026-10-07
- Updated: 2026-10-07

## Context and goal

Catalog API, store and consumers describe incompatible model data. Backend catalog builders return partial arena/default metadata and omit preset params; raw Ollama details are nested. Direct providers may return a list, data envelope or null and omit owner/name. Share an accurate concrete catalog contract while keeping full editor configuration separate. Preserve requests, prefixes/tags, metadata precedence, dedup order, visibility and billing.

CI on c98aef7c137975b4b6fb33ba047897bd2d0f14a4 rejected 16 baseline lint errors in three touched files. That candidate's local acceptance was insufficient. Renew acceptance with clean changed-file lint and independently test necessary runtime corrections. The earlier ten-identical-modules/no-rollout conclusion is superseded.

## Acceptance criteria

- [x] Trace catalog/direct-provider/raw Ollama variants and callers; describe accurate absent/null forms without adding Any or suppressions.
- [x] Reuse a fork-owned common catalog contract in API/store/selector/editor/consumers; keep full ModelConfig separate. Preserve legacy string/array suggestion titles.
- [x] Remove all 16 touched-file lint failures without weakening rules; every changed source/test file has zero lint errors.
- [x] Static contract rejects original untyped API in five cases, corrected API in zero. Eight existing app modules have identical transformed JS; changed Svelte CSS stays identical.
- [x] Check real mounted ChatPlaceholder model selection, suggestion callback and catalog-update HTML; preserve formatting and remove unsafe nodes/attributes. Check empty/plain/nested/multiple/unmatched details through the actual parser.
- [x] Full frontend 864/864; type errors 3234 to 3189 and warnings 121 to 118; new normalized diagnostics zero. Full lint 1180 to 1164; format/diff clean.
- [ ] Exact-head CI, source/merge identity and private evidence recorded.
- [ ] Build from current integration, verify immutable candidate and required browser paths; preserve production backend/config/env/static data in guarded frontend release.

## Scope and upstream impact

Fork-owned model-types/model-data.typecheck and sanitized_html action carry new logic. Minimal type hooks touch API/store/selector/editor/placeholders/filter menu. ChatPlaceholder replaces raw HTML with DOMPurify's fragment action/update; tooltip sanitation stays unchanged. Its app-layout slot is gated on loaded=false during SSR and loaded only becomes true in browser bootstrap from onMount. Public SSR stays enabled and untouched; this action is explicitly browser-only.

ContentRenderer's only caller is ResponseMessage and passes none of the removed history/messageId/selectedModels props. Remove those unused props and unused imports/context; empty callbacks retain explicit external parameter contracts. The details parser changes while(true) to equivalent for(;;), with the same break/return behavior. Suggestions receives its existing event contract; no callback behavior changes. Catalog refresh still selects the last model as before. No raw getOllamaModels management API, authentication, billing, persisted data or deployment configuration change.

## Verification and dependency policy

Docker Compose full frontend/check/lint plus static contract/compiler comparison and actual component/parser tests. Existing Svelte 5.56.0, DOMPurify 3.4.11, TypeScript 5.9.3, esbuild 0.25.12 and svelte-check 4.4.5 stay pinned. Official Svelte action and DOMPurify fragment docs/version release notes reviewed; latest observed Svelte 5.57.2 and DOMPurify 3.4.16. No dependency is introduced or replaced. Preserve current compatibility for this correction; upgrades require separate sanitizer/SvelteKit/full-test acceptance. Docs: https://svelte.dev/docs/svelte/use and https://github.com/cure53/DOMPurify#usage.

## Risks and rollback

Types do not validate arbitrary provider payloads. New HTML action must only be used in browser-mounted content; public SSR requires normal Svelte markup. Preserve all unrelated primary checkout files and private evidence. A reverted isolated source commit or previous immutable image provides rollback; no database migration is introduced. Overall quality and real pilot acceptance remain open.
