- [x] **[REFACTOR][DEPLOY]** Build AIRIS from a clean reproducible production base
  - Spec: `meta/memory_bank/specs/work_items/2026-10-09__refactor__clean-production-image.md`
  - Owner: Codex
  - Branch: codex/refactor/clean-production-image
  - Done: 2026-10-09
  - Summary: Built and released a clean CPU image from frozen platform/dependency/resource inputs, corrected incompatible torchaudio, and verified production preservation.
  - Tests: Final 1017 backend tests (10 PostgreSQL cases), 946 frontend tests and 84 browser cases passed; repeat package/application parity, migration, production native/model operations and guarded release acceptance passed.
  - Risks: Global type/lint and real pilot gates remain open; whole-image byte identity is not claimed.

- Preview CPU build completed from frozen platform digests. Native imports, resampling and NMS passed; full backend with four isolated PostgreSQL databases is running. Frontend: 946/946 passed; full type/lint baseline remains 2293/1020 errors.
- Eight older production backups (88 files, 12,564,515,196 bytes) were moved to private P4 storage, verified by SHA256/size/archive and dump readability, and removed from the source under the deployment lock. Seven recent backups retained; production image/configuration/mounts and 12 neighbors preserved.

- Final acceptance: PR365 source c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908 and
  merge c1c69b308e1cbe49b2c31f8af1e84f808ff49c39 have equal trees. The clean
  production image is healthy/restarts 0; native/model operations, content, money,
  data mount, configuration and 12 neighbors are verified. Pin did not recreate
  the container. Final tests: 1017 backend including 10 real PostgreSQL cases,
  946 frontend and 84 browser cases; no failures/skips. Completed temporary build
  inputs and two exact intermediate tags removed; reports and required backups
  retained. Global type/lint quality and real pilot acceptance remain open.
- Acceptance documentation is published separately on
  codex/docs/clean-production-image-acceptance; it does not change frozen
  application source or require another production rollout.
