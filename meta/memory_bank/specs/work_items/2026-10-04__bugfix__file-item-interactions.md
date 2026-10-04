# File attachment opening and removal

## Meta

- Type: bugfix
- Status: completed; source, compiled candidate and production accepted
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
- [x] Exact-head CI/source delivery, compiled browser acceptance, candidate build and guarded production release verified; user files/text and environment preserved.

## Scope / Upstream impact

Minimal repair in existing shared FileItem.svelte and the existing fork-owned attachment descriptor if uploaded data needs a known optional field. Reuse native button behavior, existing translations, modal and dispatch. No new package/API/database/config, no unrelated Controls cleanup. Trace every current caller before editing. Other image URL and Controls defects remain independent work under G14.

## Verification / Risks

Compose-created frontend tools: regression before/after, full Vitest/check/lint, original-line diagnostic comparison. Actual server compilation/native parsed markup plus browser interaction and candidate acceptance. Production uses the established guarded release with 10GiB/backup/rollback/environment/neighbour checks. G01-G17 and the full 192/244 plan remain active; this behavior fix does not independently satisfy the real pilot.

## Verified implementation

All five targeted cases fail on the baseline and pass after the repair, including actual compact and normal layouts and missing/encoded/malformed names. Full frontend498/498 in75files. Check3799→3789errors/164→163warnings:11 diagnostic removals, no refinements or additions. Full ESLint1419→1416, three removed and no new messages; changed-file ESLint is clean. Overall quality remains red.

Actual complete component server compilation/native parsed HTML has zero warnings and two independent buttons in the same card. Chrome actual compiled component at narrow390×844 plus initial larger layout: native Enter/Space open2/remove2, remove causes zero additional opens, focus exposes removal and retains an auto outline, user text unchanged and console errors0. Modal child display is stubbed in unit/SSR isolation and not opened in the component browser; integrated modal/upload behavior and compiled candidate remain separate runtime gates.

The existing FileModelResponse data is dict|null; shared descriptor preserves that optional shape and unknown extension keys. Native placeholder file='' is narrowed before content access. No API/database/dependency/environment changes. SDD covers completed source/regression/component verification; final source, candidate and production acceptance is recorded below. Existing indentation is retained to avoid unrelated upstream formatting changes.

## Final runtime acceptance

PR254 merged source cbe249152ac2aad0d2516abd1dd7a8b7dcd5dc62 as ee3779ae5eead2957fc08a990afd1d20a2a11b4a on 2026-10-04T17:27:51Z. Ten unique CI checks succeeded and dependency-review was skipped. All eight changed files and the complete source tree match the merge. CodeRabbit reviews are disabled for this base branch; its status does not establish a review.

The compiled candidate passed all 16 existing full-path scenarios in Chromium and narrow Firefox. Actual upload, text extraction, FileItemModal preview, full-content toggle, keyboard dismissal and preservation of the draft were additionally checked in the real compiled application. This additional upload check used the disposable fixture administrator; the full-path suite used ordinary accounts. The fixture has no loaded embedding model and reports that warning: this evidence accepts file storage/extraction/preview, not document indexing. No page or console errors occurred.

Production image yshishenya/yshishenya:file-item-cbe249152-20261004 has registry digest sha256:3f749a619657943b8545964e4610873393853e0e8dd9f1a1c35d8df8352133d5. Registry, server candidate and running container match on 4913 frontend files and 425 backend Python files, image environment, layers and source labels. The accepted dynamic public environment module and Metrica counter were preserved. Local and server engines expose different image IDs; each was checked against its own accepted identity and the registry digest.

The guarded deployment passed backup checksums/archive/pg_restore, the hard PostgreSQL Alembic gate, health and rollback checks. Only airis was recreated. The 12 service neighbors in the refreshed preflight and application environment were preserved. An earlier user terminal disappeared before deployment; its cause was not inferred. A new user terminal created when opening the browser was recorded separately. The default Compose image was persisted atomically, changing only the two existing image selection keys. Free disk space remained above 10GiB.

The public HTTPS health check succeeded; the container is healthy with zero restarts. A previously saved production chat opens with its visible messages and an empty input, without console errors. No new model request or payment was submitted. Actual upload/modal interaction was accepted on the identical candidate and was not repeated on production.

One older backup was copied to the operator Mac; all 12 files, sizes, SHA256, the data archive and 371 PostgreSQL archive entries were verified. Local and server files were checked again before deleting only that server copy. The two latest prior server recovery points were retained, and this release created a new one.

The full onboarding objective remains active at 192/244. Overall type/lint debt remains 3789 errors, 163 warnings and 1416 ESLint errors; none was added by this repair. The read-only pilot observer at 2026-10-04T18:05:44Z found 139 ordinary accounts, 16 new within seven days, no eligible consent, no queued mail, no SMTP call and no observer DML. Release flags remain disabled; no real pilot or calendar window has been accepted.
