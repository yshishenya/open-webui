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
