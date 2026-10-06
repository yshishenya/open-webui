# Recover model editor after an unsuccessful save

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: `codex/bugfix/model-editor-save-recovery`
- SDD Spec: `meta/sdd/specs/completed/airis-model-editor-save-recovery-2026-10-06-001.json`
- Created: 2026-10-06

## Reproduction and cause

The actual submitHandler, executed with valid ID/name/base and empty description, changes description to null on the first submit. The create callback resolves after duplicate ID or API failure, leaving the editor open. The second submit throws null.trim() before onSubmit, leaving loading=true. An edit callback rejection also leaves loading=true. Reproduced in Docker against base138df1cd68ba1c32cea53113e122ec50a053e772: second callback never reached; both buttons stay blocked.

All three consumers were traced: workspace create, workspace edit, and admin model settings. The fix belongs in their shared ModelEditor. The admin upsert path already catches its API failures; changing its success/navigation behavior is separate work.

## Measurable acceptance

- [x] Execute actual handler regression: empty/whitespace/null/absent descriptions permit two attempts after unsuccessful create; no trim error, loading=false.
- [x] Rejected edit callback gives one error notification, restores loading=false and permits successful retry; no unhandled rejection.
- [x] Validation failures still prevent callback; nonempty description and selected controls reach callback unchanged.
- [x] Full Docker tests pass; mapped type/lint diagnostics add zero. Compile and exercise the actual component in a browser.
- [x] Exact-source CI/merged files accepted; guarded production overlay preserves current backend/configuration and passes live acceptance.

## Scope and upstream impact

Small null-safe normalization and callback error/finally handling in upstream ModelEditor.svelte; keep existing parent contracts. Add one regression test following existing actual-handler TS AST/VM tests. No dependencies, backend, API, schema, or billing changes. Do not reformat the entire editor or include unrelated type cleanup. Production uses a fresh overlay from the current image, never an old full rollout.

## Verification and rollback

Docker frontend focused/full tests, type/lint differential against frozen base, compiled browser retry scenarios, image manifests and guarded backup/CAS/migration/health release. Rollback restores the previous application image; database remains unchanged. Whole G14 and external pilot acceptance remain open until independently proved.

## Final acceptance

PR287 source `4e9d85fe96f19b7dfc0a14a9b8965aa3dc775bde`, merge `3765fa2111807994c7394bc31f364500bf02eeca`; source, merged and precomputed trees `9997cf920a8ce5c52f686ae7a73af7dbec6aee19` match. Exact-source CI: 11 successful checks, one expected dependency-review skip. CodeRabbit independent review was skipped because disabled for this integration branch.

Six actual-handler regressions failed before the fix and pass afterwards. Full Docker frontend: 588/588 in 85 files. Compiled browser: 4/4 create/edit server refusal and retry cases in Chromium and Firefox at 390px, persisted description/instruction verified and no page errors. The fresh administrator changelog modal is dismissed before operating the editor. The final test-only follow-up preserves all executable sources, unit tests and dependencies from the previously verified source; the final compiled image was checked again.

Types 3503→3502, warnings 158→157; ESLint 1348→1335. Zero new mapped diagnostics. The first CI detected 13 pre-existing editor lint findings and a test-only script extraction regex: use the exact known TS opener, existing concrete data projections, explicit textarea closing tag, and remove three unused pieces. Full emitted output comparisons preserve other production-source behavior. Broader metadata typing and whole-project G14 remain open; the overall type/lint commands still fail due existing debt.

Production digest `sha256:08a888a424240e03d5d118b5b0d1a82551478b530cb5ba0c92d17c1ca5973d5a` uses the accepted current base `sha256:9e2546496befb39906d45958daa476ff9e2b00f758f0d7f1eff75cef4f0dc25e`. All 4914 frontend files and 426 Python files match the candidate and server-pulled immutable image. Base layers, image/runtime environment and Metrica 111392024 preserved; no public source maps. Backup checksums, readable archive/dump, hard Alembic gate and health passed; revision `o1a020261003`, healthy with zero restarts, all 13 existing neighbors preserved. Compose defaults changed only the selected image and retained the running container. Public source/env and read-only authenticated chat reload verified. SDD 2/2 completed.

The separate administrator upsert helper swallows create/update API failures and closes the editor without error notification; executing its actual helper and parent callback reproduces this. It remains unresolved by PR287. Real external Inbox/support responses, voluntary usefulness, physical phone, real payment/receipt and voluntary pilot 24h/72h/14d still require separate evidence; this release does not close the full product goal.
