# File attachment opening and removal

## Meta

- Type: bugfix
- Status: implementation verified; source/candidate/production gates pending
- Owner: Codex
- Branch: codex/bugfix/file-item-interactions
- SDD Spec: meta/sdd/specs/completed/airis-file-item-interactions-2026-10-04-001.json
- Created: 2026-10-04

## Context and reproduction

The actual shared FileItem server renderer nests the remove button inside the open button. Native browser parsing moves the remove button outside the open control, and Svelte reports node_invalid_placement_ssr. An omitted name renders as the literal undefined. The shared component is consumed by chat input, chat controls, channel input/messages and notes. Their real descriptors permit absent name/type/size and upload placeholder file=''. The existing modal mutates the uploaded file/context descriptor; preserve that behavior.

## Goal / Acceptance Criteria

- [x] The actual component has zero invalid nested-button warnings; native parsed server markup retains two separate buttons in one attachment card.
- [x] Open emits one click; remove emits one dismiss and zero open; both controls are native keyboard-focusable buttons with a meaningful name. Focus exposes the remove action as hover does.
- [x] Missing name displays the translated File label; encoded and malformed names remain readable. Placeholder and uploaded descriptor props are concrete and optional where actual callers omit them.
- [x] Relevant regression fails on the baseline and passes on the fix; full frontend tests and changed-file lint pass, type/lint delta fully accounted, unknown extensions retained.
- [ ] Exact-head CI/source delivery, compiled browser acceptance, candidate build and guarded production release verified; user files/text and environment preserved.

## Scope / Upstream impact

Minimal repair in existing shared FileItem.svelte and the existing fork-owned attachment descriptor if uploaded data needs a known optional field. Reuse native button behavior, existing translations, modal and dispatch. No new package/API/database/config, no unrelated Controls cleanup. Trace every current caller before editing. Other image URL and Controls defects remain independent work under G14.

## Verification / Risks

Compose-created frontend tools: regression before/after, full Vitest/check/lint, original-line diagnostic comparison. Actual server compilation/native parsed markup plus browser interaction and candidate acceptance. Production uses the established guarded release with 10GiB/backup/rollback/environment/neighbour checks. G01-G17 and the full 192/244 plan remain active; this behavior fix does not independently satisfy the real pilot.

## Verified implementation

All five targeted cases fail on the baseline and pass after the repair, including actual compact and normal layouts and missing/encoded/malformed names. Full frontend498/498 in75files. Check3799→3789errors/164→163warnings:11 diagnostic removals, no refinements or additions. Full ESLint1419→1416, three removed and no new messages; changed-file ESLint is clean. Overall quality remains red.

Actual complete component server compilation/native parsed HTML has zero warnings and two independent buttons in the same card. Chrome actual compiled component at narrow390×844 plus initial larger layout: native Enter/Space open2/remove2, remove causes zero additional opens, focus exposes removal and retains an auto outline, user text unchanged and console errors0. Modal child display is stubbed in unit/SSR isolation and not opened in the component browser; integrated modal/upload behavior and compiled candidate remain separate runtime gates.

The existing FileModelResponse data is dict|null; shared descriptor preserves that optional shape and unknown extension keys. Native placeholder file='' is narrowed before content access. No API/database/dependency/environment changes. SDD covers completed source/regression/component verification; exact-head source acceptance and guarded candidate/production gates remain open above. Existing indentation is retained to avoid unrelated upstream formatting changes.
