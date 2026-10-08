# AIRIS clean production image

## Meta

- Type: refactor
- Status: active
- Owner: Codex
- Branch: codex/refactor/clean-production-image
- SDD Spec: meta/sdd/specs/active/airis-clean-production-image-2026-10-09-001.json
- Created: 2026-10-09
- Updated: 2026-10-09

## Context

The accepted chat-list release preserves production behavior but its application layers inherit older application releases. The next release must use the project multi-stage Dockerfile and fresh platform images. Mac storage briefly fell below 50 GiB during an unrelated Parallels disk operation; it recovered to 133 GiB without modifying that VM. P4_codex has 67 GB available and is a native amd64 build host.

The accepted Python 3.11.16 runtime has torch 2.9.1+cpu, torchvision 0.24.1+cpu and torchaudio 2.11.0+cpu. A real torchaudio import fails with undefined symbol torch_library_impl although pip check reports no broken requirements. Official PyTorch instructions pair torch 2.9.1, torchvision 0.24.1 and torchaudio 2.9.1. Preserve the remaining accepted versions; dependency upgrades are separate work.

## Goal / Acceptance Criteria

- [x] Freeze source, image digests, installed dependency versions and required public asset hashes before building; no production data enters the build context.
- [ ] Build linux/amd64 from the project Dockerfile and immutable Node/Python platform images, with no prior AIRIS application image in FROM.
- [ ] Install a hash-verified lock of the accepted runtime dependencies, changing only the incompatible torchaudio version; pip check and real torch/vision/audio imports pass.
- [ ] Repeat the build using the same inputs; report package and application byte parity and any OS/model-resource limits precisely.
- [ ] Verify backend/frontend and required browser paths against the candidate, migration rehearsal, compiled public measurement IDs, guide resources and source provenance.
- [ ] Publish reviewed source, deploy with guarded backup/health checks and verify exact image/files, money, mounts, configuration and neighboring services.
- [ ] Remove completed temporary build materials; preserve reports, hashes, source, working data and production backups in private storage.

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
