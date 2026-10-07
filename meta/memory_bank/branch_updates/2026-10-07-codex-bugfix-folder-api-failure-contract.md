- [ ] **[BUG][CHAT]** Preserve folder API failures and loaded folders
  - Spec: `meta/memory_bank/specs/work_items/2026-10-07__bugfix__folder-api-failure-contract.md`
  - Owner: Codex
  - Branch: `codex/bugfix/folder-api-failure-contract`
  - Started: 2026-10-07
  - Summary: Fix the aborted-request null-sort crash detected in the mandatory Firefox free-task path, retaining loaded folder data.
  - Tests: In progress; original compiled failure trace retained.
  - Risks: Formerly swallowed transport failures now reject; inspect every caller.

- 2026-10-07: Source fix and focused regression accepted13/13; fullfrontend881/881. Check3040→3005/118warnings; fullESLint1158unchanged/0newdiagnostics. Compiledbrowser/productionpending,SDDactive. OriginalFirefoxtrace retained.

- 2026-10-07: CI follow-up removes31existing violations without disabling rules. Actual # suggestion null-cache regression fails before fix; compiled case expanded to #/@. Local disk/Docker recovered with705verified APFS clones; backups/77containeridentities/249volumes preserved. Exact-source checks/browser acceptance remain in progress;SDDactive.

- Final follow-up source checks:883/883frontend,107files;folderregressions15/15. Check3004errors/118warnings,0new,36removedfrominitial3040. FullESLint1127errors,31removed;all14changedruntime/test/configfiles ESLint0errors/0warnings. Globalqualitygate remainsopen. Browsercandidate and productionpending.

- 2026-10-07: Chromium full run32/33 exposed a test setup gap: Sidebar fetches folders only after opening; both authenticated config features and folder permission were enabled in the retained trace. Reused openSidebar in the permanent test and match knowledge search by URL.pathname. Focused compiled Chromium1/1 and Firefox390px1/1 pass with real aborted GET, #/@ search and subsequent folder recovery; full exact-source rerun pending. No runtime code or assertions weakened.
