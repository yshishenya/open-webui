# Clean AIRIS CPU production builds

Build from the repository multi-stage Dockerfile. Use the frozen platform image
digests, `package-lock.json`, `backend/requirements-production.lock`, the prepared
static manifest and the verified model-resource archive. Do not use an earlier
AIRIS application release as `FROM`.

## Inputs

- An exact reviewed source SHA and clean Git archive; exclude private documents,
  production data, environment files and credentials from the context.
- `AIRIS_NODE_IMAGE` and `AIRIS_PYTHON_IMAGE`: immutable platform image digests.
  The first CPU profile keeps Python 3.11.16 and Node 22 Alpine 3.20 for compatibility.
- `AIRIS_PRODUCTION_LOCK=true`: 351 accepted Python distributions, each with a
  fixed artifact URL and SHA256. torch/vision/audio use the supported 2.9.1 trio.
  This amd64 CPU profile rejects CUDA. Other architectures use the default path.
- `AIRIS_PREPARED_STATIC=true`: prepare all files listed in
  `static/.airis-production.sha256` from the accepted release, verify them, then
  use the existing Vite build. The default build still runs Pyodide preparation.
- `AIRIS_PREPARED_MODELS=true`: put the verified archive and checksum in
  `airis-build-resources/`. Only model/tokenizer/NLTK caches are allowed. Check the
  archive entries and extracted file manifest before use. Keep the generated
  archive outside Git. Preserve `USE_SLIM=false` for the accepted full profile.
- `BUILD_HASH`: reviewed full source SHA. Pass both public measurement IDs
  explicitly; runtime environment variables cannot repair a compiled missing ID.

## Checks

1. Check build-host disk/memory before copying or building. On Mac keep 80 GB
   available; below 50 GB use a suitable server or resolve owned accumulation.
2. Verify input hashes on the build host before starting. Use native amd64 when
   available. Record Dockerfile, lock, platform digests and all build arguments.
3. The CPU lock build runs `python -m pip check` and `python check_native_audio.py`.
   The latter exercises native resampling and image NMS; package metadata alone
   did not detect the previous incompatible torchaudio library.
4. Compare installed distributions with the lock and accepted runtime. Review
   every change. Do not update transitives incidentally during packaging.
5. Run existing backend/frontend and relevant browser suites, including the
   PostgreSQL-specific queue/preferences/success/report cases. Keep global lint
   debt distinct from focused validation; do not weaken rules to claim a pass.
6. Compare the candidate's application source, static resources, guide and
   measurement IDs with the frozen inputs. Repeat using the same inputs and
   report package/application parity. Record system package versions; mutable
   distribution mirrors prevent claiming universal byte-identical OS rebuilding.
7. Rehearse migrations on a disposable copy and release through
   `scripts/deploy_guarded.sh`. Retain the current application image and verified
   private backup; verify health, exact image/content, configuration, mounts,
   money and neighboring services after the release.
8. Remove completed temporary contexts and resources. Keep final logs, manifests,
   versions and checksums. Store required production backups in verified private
   storage. Do not delete user data, volumes, worktrees or VM state as cache.

## Dependency upgrades

This profile preserves accepted versions to isolate packaging from dependency
upgrades. Upgrade the complete torch/vision/audio trio together. Regenerate the
artifact lock on the target Python/platform with reviewed constraints and hashes,
then repeat native imports, full tests and candidate acceptance. Do not treat the
project-wide `uv.lock` as this deployment profile: it resolves a different torch
version and platform graph.

Official references: [uv locking environments](https://docs.astral.sh/uv/pip/compile/),
[PyTorch supported version combinations](https://pytorch.org/get-started/previous-versions/),
[Docker build recommendations](https://docs.docker.com/build/building/best-practices/).

## Accepted profile — 2026-10-09

- Source: `c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908` (PR365).
- Node: `node:22-alpine3.20@sha256:2289fb1fba0f4633b08ec47b94a89c7e20b829fc5679f9b7b298eaa2f1ed8b7e`.
- Python: `python:3.11.16-slim-bookworm@sha256:a36c24f9cbdf4fd0f52d67f0823eeac19c2028c637cecc392d97f980d4fec56b`.
- Image: `yshishenya/yshishenya:clean-c0ea9dd782-20261009`, digest
  `sha256:1dd96829dfc0189ea08d95cdc429f533580d78e6a5443214f065ae0ae008fac5`.
- Manifest: `sha256:f632875618184dccd9f5654e3243458aa459f4126e07c1d6172de16bd7494fca`.

Two independent builds matched all compiled application files, Python and system
package versions, frozen browser resources and model files/links. Their image build
metadata digests differ; do not claim whole-image byte identity. Repeat native
operations in the running production container because a mounted data directory
can replace image-owned model resources. Offline/local_files_only checks confirmed
both embedding models, tiktoken, NLTK and Whisper CPU inference.

The accepted runtime lacks 26 cache service metadata files present in the image.
They were already absent before deployment; all expected weights and links match.
Treat runtime/image differences as acceptable only after comparison with the
verified pre-release backup and an exact reviewed allowlist. Do not relax the
immutable image manifest or copy files into a live cache to satisfy the checker.

Image pinning changes only the two Compose image selector fields and does not
recreate an already verified container. Check that the resolved Compose image
matches the accepted reference and that every other configuration byte is preserved.
