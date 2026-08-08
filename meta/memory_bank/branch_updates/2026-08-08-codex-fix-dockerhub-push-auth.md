### Done

- [x] **[BUG][DEPLOY][REGISTRY]** Add Docker Hub credential preflight and document the permanent fix
  - Spec: `meta/memory_bank/specs/work_items/2026-08-08__bugfix__dockerhub-push-auth-preflight.md`
  - Owner: Codex
  - Branch: `codex/fix-dockerhub-push-auth`
  - Done: 2026-08-08
  - Summary: Root cause was missing Docker Hub credentials on the build host while prod had a separate credential; deploy now fails before build and documents PAT login plus offline fallback.
  - Tests: bash syntax check; deploy dry-run; safe missing-credential reproduction; git diff check.
  - Risks: Low; deploy tooling and documentation only.
