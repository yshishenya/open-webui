# Combined quality candidate

Workflow: refactoring. Branch: `codex/refactor/combined-quality-candidate`.
SDD Spec: meta/sdd/specs/active/airis-combined-quality-candida-2026-10-09-823.json

## Final goal and purpose

Combine the separately accepted backend quality, channel-store contracts and sidebar/wallet behavior into one measurable source. The overall onboarding-retention goal remains active198/244 and requires full production/mail/payment/pilot/cohort acceptance. This source assembly must not be counted as completed general quality or release.

## Dependencies

Integration: d579f5c02926cace8c8da60434ce1c39c7284361.
Backend:9a3943e69b55af2d62f067808c3f337ff3077b6f.
Channel:a513eac065cd4491a330a945928b4c18f1cf0463.
Sidebar/wallet:34b6e676fe9998e4da80de36a485f66c968c3753 (PR367 remains independent and unmerged).

## Acceptance

- [x] Merge dependencies without unrelated edits/conflicts; backend453 files exactly equal backend dependency, frontend application files exactly equal the owning channel/sidebar dependencies.
- [x] Normalize four new quality SDD IDs to the existing three-digit convention, preserve task states and cross-links; validate every source SDD JSON against the repository schema and existing work item paths.
- [x] Full backend with four fresh PostgreSQL fixtures and frontend pass on the combined source; no source edits during/after tests.
- [x] Measure full check/ESLint/Ruff/Black on this combined tree; do not sum independent branch results.
- [x] Channel modules emit identical JavaScript to integration; sidebar/wallet files match accepted34b6 source. No dependency/config/native-audio changes.
- [x] Primary21 protected files and production preserved; temporary sources/databases removed after checks.
- [x] Commit/push and prove final453+frontend source hashes equal the pre-test snapshot; preserve precise proof and diagnostics for further fixes.
- [ ] General quality errors0; clean candidate image, combined browser/native/runtime acceptance, CI, review/merge/deploy/live accepted.

## Upstream impact

No additional application edits in this assembly. Merge the existing thin typed store/API declarations, sidebar cleanup and wallet layout fix with mechanical backend annotation/format updates. Documentation only normalizes four branch-owned SDD identifiers and their work item references; shared current_tasks and private plans are not committed. All remaining source-quality issues stay visible.

## Verification scope

Full Docker Compose backend/frontend tests and complete lint/type measurements. Source ownership checks and erased TypeScript parity are required. Historical standalone browser/native results remain attributed to34b6; a clean image and fresh combined browser/native acceptance are still required before release. Avoid building repeated images while general source gates remain red.

## Combined source measurements

Application source: e41890faec89c217f73466296482539371263f39, three explicit dependency merges, zero conflicts. Every backend Python file equals the accepted backend dependency; all eight owned frontend files equal their channel/sidebar owner. Two channel modules emit byte-identical JavaScript to integration with TypeScript 5.9.3. All 453 backend and 1061 tracked frontend hashes match the snapshot captured before full tests.

Docker Compose backend:1017 passed,0 failures/errors/skips,113.618 seconds; four fresh PostgreSQL databases. Frontend:952 passed across123 files. Black:453 unchanged. Full combined checks:2271 type errors/108 warnings, ESLint1020 errors, Ruff1034 errors. These are measured together, not summed from separate branches. General quality and release remain pending. The complete structured diagnostics are retained privately for the next fixes.

All174 source SDD specs validate against schema/strict IDs/existing work items. Hidden .reviews/.fidelity-reviews JSON files are reports, not specs; the initial private checker mistakenly included them and failed with KeyError, then was corrected to the existing source-check scope. Four new quality IDs were normalized without changing their task states. New combined SDD remains active; do not mark the overall work complete.

Production read2026-10-09T05:29:12.483133UTC:source c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908, healthy, restarts0; image/environment/config/mounts/neighbors unchanged. All21 protected primary files preserved. The temporary PostgreSQL container and four tmpfs databases were removed; persistent volumes deleted0. No dependency/config/native audio verifier changes.

PR367 remains at34b6e676fe9998e4da80de36a485f66c968c3753. The required connector returned checks[]/jobs[], only skipped CodeRabbit; the reason for missing results is unknown. No new PR/merge/deploy, and historical browser/native acceptance still belongs to34b6. A clean image and new combined browser/native/runtime acceptance remain mandatory before release.

Private evidence: /Users/yshishenya/.codex/private-artifacts/airis-combined-quality-candidate-20261009. Overall onboarding plan198/244; new numbered closures0.

Source assembly/documentation c662f26267fc637f0e742461a34eee8549cf9025 pushed and remote SHA verified. SDD2/3 tasks completed; general quality/image/browser/native/CI/release task remains pending. Final documentation-only commit preserves the same application snapshot.
