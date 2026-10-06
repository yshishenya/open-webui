# Recover model editor after an unsuccessful save

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: `codex/bugfix/model-editor-save-recovery`
- SDD Spec: `meta/sdd/specs/active/airis-model-editor-save-recovery-2026-10-06-001.json`
- Created: 2026-10-06

## Reproduction and cause

The actual submitHandler, executed with valid ID/name/base and empty description, changes description to null on the first submit. The create callback resolves after duplicate ID or API failure, leaving the editor open. The second submit throws null.trim() before onSubmit, leaving loading=true. An edit callback rejection also leaves loading=true. Reproduced in Docker against base138df1cd68ba1c32cea53113e122ec50a053e772: second callback never reached; both buttons stay blocked.

All three consumers were traced: workspace create, workspace edit, and admin model settings. The fix belongs in their shared ModelEditor. The admin upsert path already catches its API failures; changing its success/navigation behavior is separate work.

## Measurable acceptance

- [x] Execute actual handler regression: empty/whitespace/null/absent descriptions permit two attempts after unsuccessful create; no trim error, loading=false.
- [x] Rejected edit callback gives one error notification, restores loading=false and permits successful retry; no unhandled rejection.
- [x] Validation failures still prevent callback; nonempty description and selected controls reach callback unchanged.
- [ ] Full Docker tests pass; mapped type/lint diagnostics add zero. Compile and exercise the actual component in a browser.
- [ ] Exact-source CI/merged files accepted; guarded production overlay preserves current backend/configuration and passes live acceptance.

## Scope and upstream impact

Small null-safe normalization and callback error/finally handling in upstream ModelEditor.svelte; keep existing parent contracts. Add one regression test following existing actual-handler TS AST/VM tests. No dependencies, backend, API, schema, or billing changes. Do not reformat the entire editor or include unrelated type cleanup. Production uses a fresh overlay from the current image, never an old full rollout.

## Verification and rollback

Docker frontend focused/full tests, type/lint differential against frozen base, compiled browser retry scenarios, image manifests and guarded backup/CAS/migration/health release. Rollback restores the previous application image; database remains unchanged. Whole G14 and external pilot acceptance remain open until independently proved.

## Local results

Six regressions fail on the original handler and pass after the fix. Docker588/588 in85files. Final mapped types3503/158 and ESLint1348 unchanged,0new. A test-only undefined narrowing error was corrected before freezing source. Compiled browser and guarded release acceptance pending; no production changes yet.
