# Member selector contracts

- Type: refactor
- Status: in progress
- Owner: Codex
- Branch: codex/refactor/member-selector-contracts
- SDD Spec: meta/sdd/specs/active/airis-member-selector-contracts-2026-10-09-016.json
- Base: origin/airis_b2c;explicit fast-forward dependency886d50b3feae448833807b9eb24add4f95844d39.

## Goal / measurable acceptance

G14 source work. Reuse existing UserInfoResponse/GroupDetails for shared MemberSelector data and sparse selected-item dictionaries.35 existing type errors arise from inferred null/empty arrays/objects. Three callers traced:AddAccessModal,AddMembersModal,Sidebar ChannelModal. Their bound ids are string arrays. User info/search and group-list backend responses traced;no API/runtime change needed. AccessControl consumes the same API;its separate legacy rights logic is outside this mechanical component refactor.

- [x] Complete compiled component equality after removal of unused imports/template indices/pagination;search300ms debounce,loading/mount order,selection/removal/exclusion,labels/profile,used public props andbound ids preserved.
- [x] Remove local type errors without adding diagnostics;remove the unused pagination prop after proving none of its three callers passes or reads it.
- [x] Full frontend passes,own format,backend454 byte equality,1520 source hashes/protected primary/runtime andneighbor preservation verified.
- [ ] Source/remote/Git objects match;source SDD/documentation completed.
- [ ] General zero-error/preflight/PR/integration/same-SHA full tests/image/production/real A/B acceptance.

## Scope / upstream impact

One upstream-owned component:annotations reuse fork-owned GroupDetails andexisting users API UserInfoResponse. Sparse maps use Partial<Record> to reflect missing entries. Delete only unused imports,unused each indices andunused pagination property. No new dependencies,abstractions,requests,backend/schema/config changes. Delete the unused pagination property:all three direct callers were read and none uses it;no repository type/ref getter caller exists. No search/selection/rights behavior change;compiled equality after removing unused bindings is the primary mechanical-refactor check.

Evidence: /Users/yshishenya/.codex/private-artifacts/airis-member-selector-contracts-20261009.

## Source verification — 09.10.2026

Full Docker frontend1046/1046,128 files. Types2013→1978,warnings105→104;ESLint992→986. Exact diagnostic multiset comparison:removed35 local type errors/1unused-export warning/6local lint errors;new0. Own formatting passes. Entire compiled component including template is byte-equal after deleting only three unused imports,two unused each indices andunused pagination prop. All three callers inspected;none uses pagination. Public used props/bound ids andsearch/loading/selection behavior preserved. No new tests for erased type annotations;existing native profile14-case regression is included in the full1046. Existing test-set native LinkPreview/jsdom warnings remain documented in the prior profile-stage work item;not suppressed.

1520 tested source files frozen:1066 frontend/454 backend. Backend is byte-identical to previous1025-pass/no-skip evidence;backend/Black/Ruff not rerun in this frontend-only stage. General same-SHA full release validation remains required.21 protected primary files preserved. Production11:47:32.989183UTC:c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908,healthy,restarts0;image/env/config/mounts unchanged. Of14 prior neighbors,12 remain byte-equal;two transient terminals are no longer present:/terminals-bbc5e661e106-airis-default and/terminals-c2c31ccaacff-airis-default. No additions or changes to other neighbors. Initial strict14-neighbor comparison failed on these removals;exact identities/delta recorded afterward. This stage performed only read-only remote captures and did not remove or change containers. Do not attribute these external removals to this source change.

General zero-error/preflight/PR/integration/image/production gates and real A/B remain pending. Numbered plan198/244,46open,new closures0;goalactive.
