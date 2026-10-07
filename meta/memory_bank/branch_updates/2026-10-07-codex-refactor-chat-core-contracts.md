- [x] **[REFACTOR][CHAT]** Align shared chat/input/response/editor contracts
  - Spec: `meta/memory_bank/specs/work_items/2026-10-07__refactor__chat-core-contracts.md`
  - Owner: Codex
  - Started: 2026-10-07
  - Summary: Work through 295 main-path type diagnostics using existing shared contracts; source baseline b34184a147cc344d95336cd01923aebdc253dc91. Previous microphone release accepted; this refactor starts from integration 739994ee617040572d2c189770af59413d1c0371. No refactor production acceptance claimed.

- Source progress2026-10-07: core errors295→0, full types2942/113→2599/111; full ESLint1110→1097; normalized additions0. Frontend932/932 plus subsequent selection check1/1; frozen source/compiled browsers/CI/integration/production pending. Overall plan198/244 remains active.

Verification correction: the initial frozen-suite selection test identified a bound callback by function text and failed. It now identifies the original plugin spec callback; actual installed behavior rechecked. CI found a generated SDD id outside the required NNN naming convention; corrected without changing validation rules. Frozen source and CI will be repeated for the new SHA.

- Done: 2026-10-07
- Final summary: PR357/source62c57 merged with identical tree;933frontend,76compiled browser tests and applicable CI passed. Protected imagef12ac556 released;4915frontend/427Python hashes,496raw backend policy, money/ENV/mount/12neighbors/backup/rollback/public assets/pin accepted. First transient Firefox500 retained, root cause unconfirmed; full rerun passed. SDD4/4 complete. Global quality2599errors/111warnings and1097lint remain open; overall198/244 active.
