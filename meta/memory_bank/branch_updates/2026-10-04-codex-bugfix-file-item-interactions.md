- [x] **[BUG][FILES]** Preserve independent attachment opening and removal
  - Spec: `meta/memory_bank/specs/work_items/2026-10-04__bugfix__file-item-interactions.md`
  - Owner: Codex
  - Started: 2026-10-04
  - Done: 2026-10-04
  - Summary: Reproduce invalid nested buttons and undefined attachment names; repair shared native controls with regression and guarded runtime acceptance.

    04.10.2026: implementation verified. Five before/after regressions, full498/498frontend/75files; types3799→3789/164→163 and ESLint1419→1416, no new diagnostics. Actual SSR/native HTML valid; Chrome normal/compact controls use native Enter/Space, open2/remove2, text/focus preserved and console0. SDD3/3 valid. Source CI and full candidate/production acceptance remain pending; no live runtime changed.

    04.10.2026: final acceptance. PR254 source cbe249152ac2aad0d2516abd1dd7a8b7dcd5dc62 / merge ee3779ae5eead2957fc08a990afd1d20a2a11b4a, ten unique CI success / one dependency-review skip, eight files and whole tree identical. Compiled full paths16/16; actual uploaded text preview and keyboard removal preserve the draft. Fixture indexing warning is recorded and indexing is not accepted. Production digest3f749a61, frontend4913/backend425 hashes, healthy/restarts0, environment/12service-neighbors/fullCompose/Metrica/backup/migration/rollback/defaultImage preserved. User-terminal changes before and after deployment are recorded separately. Plan192/244, full goal active; overall quality and real pilot remain pending.
