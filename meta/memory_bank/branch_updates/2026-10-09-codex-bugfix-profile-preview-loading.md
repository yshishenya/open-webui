- [ ] **[BUG][PROFILE]** Profile preview loading
  - Spec: meta/memory_bank/specs/work_items/2026-10-09__bugfix__profile-preview-loading.md
  - Owner: Codex
  - Branch: codex/bugfix/profile-preview-loading
  - Started: 2026-10-09
  - Summary: Reproduce/fix missing user-mention open state and shared stale profile loading; reuse exact profile contracts; full release remains open.

- [x] Reproduction and shared lifecycle/open-binding fix verified:original9 fail/5 pass,fixed14/14;full frontend1046/128. Types2013/105;ESLint992;new diagnostics0. Exact contracts reuse SessionUser/GroupDetails/LinkPreview props. Source delivery in progress;release not complete.
  - Spec: meta/memory_bank/specs/work_items/2026-10-09__bugfix__profile-preview-loading.md
  - Owner: Codex
  - Summary: Both native parent paths load profiles;stale/closed/null/disposed results are rejected;failed/abandoned requests retry on reopen,successful same-id loads remain cached.
  - Started: 2026-10-09

- [x] Source stage complete and pushed: `2bea931bde541cab2c23ca0707ed78732e389bbd`;1520 Git blobs matched,189 valid SDD specs,source tasks3/3. Temporary runners0;shared cache/network,21 primary files,production and14 neighbors preserved. General release gates and real A/B remain open.
  - Spec: meta/memory_bank/specs/work_items/2026-10-09__bugfix__profile-preview-loading.md
  - Owner: Codex
  - Summary: Source verified1046/128;types2013/105 andESLint992,new0. No integration,image build or deployment.
  - Done: 2026-10-09
