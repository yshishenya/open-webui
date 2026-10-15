# Administrative model contracts and lifecycle guards

- Type: bugfix
- Status: source stage complete; release pending
- Owner: Codex
- Branch: codex/bugfix/admin-model-contracts
- SDD Spec: meta/sdd/specs/completed/airis-admin-model-contracts-2026-10-09-018.json
- Base: origin/airis_b2c; explicit fast-forward dependency27faf127f7e4c137b461edd18f5042e3f4dae630.

## Goal / measurable acceptance

G14 source work. Admin Models currently has64 type errors. Read full handler flow and markup, model/config API contracts, ModelDefaultsPanel, ModelEditor and menu interfaces. Only Settings uses this Models component; get/setModelsConfig have exactly two callers (this component and ModelDefaultsPanel). Catalog Model, ModelMeta/ModelParams and AccessControlModal props already exist;reuse them instead of a second model schema. Server ModelsConfigForm permits nullable strings and nullable order-list entries;retain that actual contract. Both shared API functions keep existing request/error/serialization behavior.

- [x] Reproduce empty file-selection/import and detached/reloaded reorder behavior through actual source handlers.
- [x] Prevent missing FileList/invalid reader/non-array JSON import and detached/reloaded reorder;valid imports/reorders preserve payloads and local order. No real import/delete/model settings mutation in verification.
- [x] Exact existing model/config/Sortable/component instance types;no new diagnostics,suppressions or dependencies.
- [x] Full frontend,own format,compiled-equivalence outside explicit guards;backend/primary/runtime/neighbor preservation andfrozen source evidence.
- [x] Commit/push/remote/Git-object match;source SDD completed.
- [ ] General zero-error/preflight/PR/integration/fresh same-SHA full tests/image/production/realA/B acceptance.

## Scope / upstream impact

Admin Settings/Models.svelte and configs API only,plus one actual-handler regression. Minimal typed contracts andlocal guards;metadata extensions retained. No backend/schema/config change,no new abstraction. Preserve bulk enable/disable/visibility,privacy grants,defaults rollback,settings-store refresh,sorting andclone/export semantics. Compiled equality must account only for explicit import/reorder safeguards andremoved unused imports.

Evidence: /Users/yshishenya/.codex/private-artifacts/airis-admin-model-contracts-20261009.

## Source verification — 09.10.2026

Actual compiled handlers:original15-case baseline6fail/9pass;expanded final17-case harness againstoriginal source8fail/9pass. Fixed17/17. Coverage includes missing/cancelled selection,null reader target/result,buffer,JSON null/object/malformed,valid/rejected import,missing/same reorder index,detached/reloaded reorder,valid reorder,andpending hide/privacy afterreload. No appserver,real imports orsettings mutations in these tests. Additional races found during typing:hide/privacy resumes afterawait withmodels=null;safe optional mapping retainsnull andexisting catalog refresh/toast behavior.

Full Docker frontend1063/1063,129files. Types1978→1914,warnings104unchanged;ESLint986exactly unchanged.64errors removed,new0. Whole compiled script/template matchesoriginal afteronly explicit lifecycle/import safeguards andnative image currentTarget;API get/setModelsConfig erased JS exactly matchesoriginal. A compiled comparison exposed an unintended FileList default change nullvsundefined;original undefined initialization restored,comparison passed. A new test's self-referencing parameter type was corrected;final full check includes that correction. Final source frozen1521files:frontend1067/backend454. Backend byte-identical toprevious1025-pass/no-skip proof;backend/Black/Ruff notrerun here. Full same-SHA release tests remain required.

Shared config response matches server ModelsConfigForm,including nullable defaults/nullable order entries/open metadata/params dictionaries. Settings list uses existing Model/ModelMeta andAccessControlModal prop types;it accepts the existing anyone principal without narrowing grant behavior. This clone's Sortable declaration provides constructor/destroy only,no event namespace. Three-field native callback type follows official SortableJS1.15.7 README:itemHTMLElement,oldIndex/newIndexnumber|undefined. Repo-pinned1.15.7 matches official latest stable release1.15.7,prereleasefalse;README/release evidence saved. No dependency installation orambient declaration expansion.

Production12:04:08.912025UTC:c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908,healthy,restarts0;image/env/config/mounts andall12 neighbors identical tolatest baseline.21protected primary files unchanged. Remote actions read-only. General zero-error/preflight/PR/integration/image/production gates andrealA/B remain open;numbered plan198/244,46open,new closures0;goalactive.

Source delivery:`3a562b8513a6d204fb08eeb9025633883a745214` pushed to codex/bugfix/admin-model-contracts;remote SHA andall1521 tested Git blobs match. Source SDD2/2 complete;all191 specs schema-valid. Temporary runners0;persistent fixture volumes created0;shared cache/network preserved. Full release gates remain pending.
