# AIRIS clean production image

## Meta

- Type: refactor
- Status: done
- Owner: Codex
- Branch: codex/refactor/clean-production-image
- SDD Spec: meta/sdd/specs/completed/airis-clean-production-image-2026-10-09-001.json
- Created: 2026-10-09
- Updated: 2026-10-09

## Context

The accepted chat-list release preserves production behavior but its application layers inherit older application releases. The next release must use the project multi-stage Dockerfile and fresh platform images. Mac storage briefly fell below 50 GiB during an unrelated Parallels disk operation; it recovered to 133 GiB without modifying that VM. P4_codex has 67 GB available and is a native amd64 build host.

The accepted Python 3.11.16 runtime has torch 2.9.1+cpu, torchvision 0.24.1+cpu and torchaudio 2.11.0+cpu. A real torchaudio import fails with undefined symbol torch_library_impl although pip check reports no broken requirements. Official PyTorch instructions pair torch 2.9.1, torchvision 0.24.1 and torchaudio 2.9.1. Preserve the remaining accepted versions; dependency upgrades are separate work.

## Goal / Acceptance Criteria

- [x] Freeze source, image digests, installed dependency versions and required public asset hashes before building; no production data enters the build context.
- [x] Build linux/amd64 from the project Dockerfile and immutable Node/Python platform images, with no prior AIRIS application image in FROM.
- [x] Install a hash-verified lock of the accepted runtime dependencies, changing only the incompatible torchaudio version; pip check and real torch/vision/audio imports pass.
- [x] Repeat the build using the same inputs; report package and application byte parity and any OS/model-resource limits precisely.
- [x] Verify backend/frontend and required browser paths against the candidate, migration rehearsal, compiled public measurement IDs, guide resources and source provenance.
- [x] Publish reviewed source, deploy with guarded backup/health checks and verify exact image/files, money, mounts, configuration and neighboring services.
- [x] Remove completed temporary build materials; preserve reports, hashes, source, working data and production backups in private storage.

## Scope and implementation

Reuse Dockerfile, existing deploy_guarded.sh and existing tests. Add a CPU production dependency lock and small optional Dockerfile hooks for frozen dependency/model/static inputs; the upstream install path remains available. Freeze transitives from the accepted runtime rather than implicitly upgrading them during a clean build. A CPU lock must reject CUDA builds. Public asset inspection found 3893 tracked resources, 62 frozen Pyodide/WASM resources (61 generated files and the accepted Pyodide lock) and compiled env.js. All 62 frozen resources were retrieved from the accepted public release and verified by SHA256. Accepted model resources (153 files, 27 links) contain only embedding/Whisper/tiktoken/NLTK caches; the clean platform build restores the verified artifact without inheriting an AIRIS application layer. No backend business logic, database schema, consent, mail dispatch or payment change.

## Upstream impact

Dockerfile receives minimal optional build arguments and installation hooks. AIRIS lock and verification documentation are fork-owned. No new runtime dependency. Existing older versions remain for compatibility; upgrade the full dependency graph in a separate reviewed work item after this behavior-preserving release.

## Verification

Native amd64 remote Docker build; hash-verified package installation; pip check; real native imports and audio operation; full backend/frontend tests and required browser paths through the existing isolated Compose test services. Compare full check/lint diagnostics with the accepted baseline rather than claiming the existing quality debt is green. Guarded production migration, backup and content checks remain required.

## Risks / Rollback

Clean system libraries/model resources can differ from the layered release. Freeze build inputs and inspect differences before rollout. Preserve current immutable image and fresh verified backup; rollback the application image through the existing guarded workflow without automatic database downgrade. Do not modify foreign worktrees, volumes, VM state or personal backups.

## References

- https://pytorch.org/get-started/previous-versions/
- https://docs.docker.com/build/building/best-practices/
- Main private onboarding plan: 198/244, 46 numbered tasks open. This packaging task does not by itself close human acceptance or calendar pilot criteria.

## Accepted release — 2026-10-09

Application source `c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908`, PR365,
merge `c1c69b308e1cbe49b2c31f8af1e84f808ff49c39`; source and merge trees match.
Exact-head CI: 13 success and one skipped. CodeRabbit review was skipped because
reviews are disabled for this base; the recorded source review is Codex's own.

Accepted image `yshishenya/yshishenya:clean-c0ea9dd782-20261009`, digest
`sha256:1dd96829dfc0189ea08d95cdc429f533580d78e6a5443214f065ae0ae008fac5`.
Final backend: 1017 passed, zero skipped, including 10 PostgreSQL cases on four
fresh databases. Frontend: 946 passed. Browser: 42 Chromium + 42 Firefox at 390px,
zero failures/skips. Migration rehearsal and financial preservation passed.
The first final backend run reused a reporting database and failed with
DuplicateTable; the complete rerun used fresh databases and changed no test code.

Two builds match all 351 Python package versions, 529 backend source files,
4916 compiled frontend files, 62 frozen browser resources, model files/links and
system package versions. Whole-image byte identity is not claimed: build metadata
digests differ, and OS mirrors remain mutable. Native imports, resampling and NMS
passed inside production. Both embedding models produced 384 dimensions; tiktoken,
NLTK and Whisper CPU inference passed with local_files_only/offline settings.

The immutable image contains all 153 model-resource files and 27 links. The live
volume lacks 26 service metadata files that were already absent in the verified
pre-release backup. All 49 expected model files in the volume and 27 links match;
no runtime cache files were copied, removed or unlocked.

Guarded deployment, new verified backup and public health/version/env/guide/assets
passed. Production is healthy with zero restarts. Financial hashes, the data mount,
configuration and 12 neighboring services match. Runtime environment changes only
WEBUI_BUILD_VERSION. Image pin changes only WEBUI_IMAGE and WEBUI_DOCKER_TAG in the
server configuration, without recreating the container. Recovery image and current
backups remain available. Completed build inputs and exact intermediate tags were
removed with no volume deletion; reports, checksums, private checks and required
production backups are retained.

Global frontend checks remain 2293 type errors/108 warnings and 1020 lint errors.
This packaging acceptance does not close the overall quality gate, physical-device
acceptance, real payment/mail/operator acceptance or calendar pilot conditions.
Main private plan remains 198/244, with 46 numbered tasks open.
