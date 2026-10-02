# History utility contracts

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/history-utility-contracts
- SDD Spec: meta/sdd/specs/active/airis-history-utility-contracts-2026-10-02-213.json

## Cause and scope

Shared history helpers have untyped graph arguments and empty dictionaries inferred without string keys. The strict checker reports unknown messages and implicit any throughout their graph operations. Existing conversion callers are Chat and shared chat; sanitation is called during Chat load; ancestor lists are used by chat responses, input, artifacts, search, sidebar and export menus. Caller contracts must retain message-specific metadata.

## Acceptance

- [x] Trace all caller imports and invocations before editing.
- [x] Add concrete graph contracts, no new any or suppression.
- [x] Preserve conversion and repair, including nullable current ID and custom metadata.
- [x] Emitted JavaScript of the complete module is byte-identical.
- [x] Docker tests and changed-file formatting/lint pass; zero new caller diagnostics.
- [ ] Exact-source CI and merge accepted; global failing checks remain explicitly open.

## Compatibility and upstream impact

One existing upstream utility module receives annotations only. Reuse pinned TypeScript5.9.3 and DOM/standard library types. Prior shared utility work established the compiler compatibility constraint: TypeScript7.0.2 requires a separate parser/lint upgrade. No dependencies or runtime behavior change; no production restart is needed when emitted code is identical.

## Verification and rollback

Extract actual helper initializers with the installed TypeScript compiler, exercise branch conversion/recovery and verify generic metadata types. Compare whole-module emitted code, Docker frontend suite, full strict/lint snapshots and untouched diagnostic delta. Revert this source commit for rollback; production configuration stays accepted.

## Bounded implementation

Conversion retains generic message metadata while declaring IDs, parent and children arrays. Repair declares only graph/completion fields it reads; all original malformed-node guards and recovery phases remain. Children non-null assertions follow the existing loop that creates arrays for every remaining node. The nullable current ID assertion affects only dictionary indexing; the original missing-current fallback remains and is tested.

The ancestor list helper was investigated separately: its generic type exposes missing caller-side message schemas across existing Chat/input/export consumers. It is excluded from this change to preserve the zero-new-caller-diagnostics gate. No runtime or additional component change is introduced for that larger follow-up.

## Source verification

Old source passes3 runtime controls and fails1 strict contract check; final source passes4/4. Full Docker frontend193/193 across43 files. Whole-module emitted JavaScript is byte-identical, including comments. Changed-file Prettier/ESLint pass. Full strict4721→4686 errors,215 warnings; full ESLint1601 errors retained. Zero new strict or lint messages, including all callers. An initial generic signature rejected metadata-only message literals; the contract test caught it and the final generic intersection retains those fields. The incomplete stdout diagnostic snapshot is excluded; the accepted strict log is captured inside Docker directly to a file and includes a verified completion footer. SDD validates with zero errors/warnings. CI/merge remains pending; no production runtime change is needed.
