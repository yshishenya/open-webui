- [x] **[BUG][TEST]** Make onboarding fixture setup repeatable
  - Spec: `meta/memory_bank/specs/work_items/2026-10-05__bugfix__onboarding-fixture-rerun.md`
  - Owner: Codex
  - Branch: `codex/bugfix/onboarding-fixture-rerun`
  - Done: 2026-10-05
  - Summary: Query the derived model by ID; create only on 404 and fail on other API errors. Preserve fixture-only hostname guard.
  - Tests: Baseline second-run failure reproduced; fresh and repeated corrected setup 2/2 + 2/2; full compiled candidate 20/20; focused Prettier/ESLint pass. CI and merge pending.

- Final: PR266 source `752623941cc15cb9a0c780c660f2d20f0a3fe5d5`, merge `eb0cc76a7190221552cfab2e019f08f1dc344cf3`; 10 CI success / 1 skip, trees equal; app runtime unchanged.
