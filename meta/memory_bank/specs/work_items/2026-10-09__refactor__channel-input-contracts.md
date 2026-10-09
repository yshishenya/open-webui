# Channel input contracts

## Meta

- Type: refactor
- Status: done (source scope)
- Owner: Codex
- Branch: codex/refactor/channel-input-contracts
- SDD Spec: meta/sdd/specs/completed/airis-channel-input-contracts-2026-10-09-013.json
- Created: 2026-10-09
- Base: origin/airis_b2c d579f5c02926cace8c8da60434ce1c39c7284361; explicit fast-forward dependency 1aee1c4638bc1d592a978bf0b2e9161b0177b4f6.

## Goal / measurable acceptance

G14 source work for onboarding-retention. Reuse ChatAttachment, Settings, FrontendConfig, CommandSelection/Upload, RichTextContent and TipTap MentionOptions instead of implicit any in channel input.

- [x] Remove all 41 existing channel MessageInput type diagnostics without new diagnostics elsewhere.
- [x] Preserve valid upload metadata, image compression limits, process=false for images, file deduplication and launch scheduling.
- [x] No channel: no upload, optimistic item removed, visible error. Invalid FileReader result: visible error, no fetch/upload.
- [x] Execute actual handlers with meaningful regression checks; existing capture/variables/loading/reload tests retained.
- [x] Full frontend tests pass; lint diagnostics do not increase; own files formatted; backend bytes identical.
- [x] Source committed, pushed and checked against remote; documentation/SDD closed for source scope.
- [ ] General zero-error release gate, integration, same-SHA full matrix, image, production and real pilot acceptance.

## Scope / non-goals

One existing channel input plus one actual-handler regression file. API, schema, billing, dependencies and production unchanged. Preserve forEach async launch scheduling, both channel compression flags and nullish dimension defaults. Missing DOM references get narrow availability guards. Legacy touch/clipboard support retained through explicit optional property types. No new runtime abstractions.

## Upstream impact

src/lib/components/channel/MessageInput.svelte: existing contracts/type annotations and narrow nullable guards. Keep layout/CSS/actions intact. A lowercase dir attribute implements the existing HTML direction setting.

## Verification / risks

Docker Compose using accepted cache/network. Compare diagnostic multisets with dependency, run complete frontend and relevant handler tests; freeze SHA256 source snapshot. No backend code changes: retain prior backend evidence only after byte equality; fresh full same-SHA backend/E2E remains mandatory for release. Preserve primary dirty files and production state. The largest risk is accidental upload/compression behavior change; check actual extracted handlers with success/error/null cases before committing.

Evidence: /Users/yshishenya/.codex/private-artifacts/airis-channel-input-contracts-20261009.

## Source acceptance — 09.10.2026

- Source: b55eaecf9a0f7ea0edb061f57824dd0a3603fe18, pushed to codex/refactor/channel-input-contracts; no PR/integration/deploy.
- Final identical regression: original 4 failures / 16 passes; fixed 20/20. Actual file and emoji handlers are extracted from the component AST and executed; this does not prove production layout. Related capture/loading/unavailable/reload checks: 88/88. Full frontend: 1032/1032, 127 files, zero test skips.
- Types: 2093 to 2052 errors; 108 warnings unchanged. Exactly 41 diagnostics removed from channel MessageInput; new diagnostics zero. The initial estimate of 44 was corrected after exact counting. ESLint 1012, exact diagnostic multiset unchanged. Own formatting passes.
- Existing NoteEditor already provides the correct number/empty-string compression pattern; reused it. Empty/zero dimensions, configuration caps, both channel flags and HEIC process=false verified. Entire erased instance script is identical after accounting for three guards and equivalent dimension coercion. Optional DOM guards and lowercase HTML direction are narrow template changes; legacy clipboard/touch fallback retained.
- TipTap pinned 3.20.2; official Mention/Suggestion documentation and registry latest 3.31.4 read. No dependencies introduced/replaced. Any upgrade is a separate compatibility task.
- SHA256 freeze: 1065 frontend / 454 backend files. Backend identical to prior 1025-pass/no-skip stage; backend tests/Black/Ruff not rerun in this frontend-only stage. General release still requires a fresh same-SHA backend/frontend/E2E matrix.
- Production 11:03:16.884713 UTC: c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908, healthy, restarts0. Image/config/env/mounts/12neighbors preserved. 21 primary files retained. No image build, browser action, AI call or production mutation.
- SDD2/2 source tasks complete. Own canonical013 filename corrected after the CLI generated a four-digit suffix. The initial name-only validate lookup failed; explicit-path/schema validation is used for the completed spec. No shared SDD/current_tasks edits.
- Plan198/244; numbered launch criteria closed0; goalactive. Remaining general quality, preflight/PR/integration/candidate/production and real mail/payment/pilot conditions stay open.
