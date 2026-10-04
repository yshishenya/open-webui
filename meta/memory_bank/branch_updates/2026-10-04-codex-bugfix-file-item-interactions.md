- [ ] **[BUG][FILES]** Preserve independent attachment opening and removal
  - Spec: `meta/memory_bank/specs/work_items/2026-10-04__bugfix__file-item-interactions.md`
  - Owner: Codex
  - Started: 2026-10-04
  - Summary: Reproduce invalid nested buttons and undefined attachment names; repair shared native controls with regression and guarded runtime acceptance.

    04.10.2026: implementation verified. Five before/after regressions, full498/498frontend/75files; types3799→3789/164→163 and ESLint1419→1416, no new diagnostics. Actual SSR/native HTML valid; Chrome normal/compact controls use native Enter/Space, open2/remove2, text/focus preserved and console0. SDD3/3 valid. Source CI and full candidate/production acceptance remain pending; no live runtime changed.
