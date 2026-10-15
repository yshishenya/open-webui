# Skills: explicit API refusals and safe management

Status: Done (source acceptance; release pending)
Owner: Codex
Branch: codex/bugfix/chat-dispatch-replay
SDD Spec: meta/sdd/specs/completed/airis-skills-management-safety-2026-10-10-022.json

- [x] Trace every Skills API consumer and server response; reproduce refusals.
- [x] Reuse requestJSON/types/grant validation, preserve methods/defaults/pagination.
- [x] Validate complete JSON before writes; preserve Markdown editor path and grant semantics.
- [x] Stop partial import; one delete/toggle per id, preserve accepted writes through refresh failure.
- [x] Cancel owned work, remove listeners and prevent late file/list/clone/export effects.
- [x] Contain all API callers; editor submit must recover loading on refusal.
- [x] Frozen full frontend/types/lint, browser of affected actual code, preservation.
- [x] Complete SDD, commit/push and private checklist evidence; global release remains open.

## Upstream impact

Skills API/component/editor and minimal existing consumers. Reuse existing helpers;
no new dependencies, Any, suppressions, retry queues, infrastructure or abstractions.
Existing server contracts remain authoritative, including nullable records and metadata.

## Verification and boundary

Compose-first regression and full tests, diagnostic comparison and browser with
controlled external boundaries. Backend unchanged: verify hashes and production.
Source acceptance does not prove integration, image, production or real A/B criteria.

## Risk / rollback

Errors now reject; trace and contain every consumer. An abort cannot undo an accepted
write. Partial import requires list review before retry. Rollback bounded runtime commit.

## Final source acceptance — 2026-10-10

- Runtime source/remote: `3ac78da26bf0f9d38d41a71e310024d6f5ca097d`; 5616 frozen Git blobs match.
- Original management/API: 30 failed / 4 positive controls; original editor:
  2 failed / 3 passed / 33 intentionally filtered tests (explicit test selection).
  Superseded rig parsing error is retained separately and is not product evidence.
- Final full frontend: 1958/1958, 165 files, failed/pending/todo 0.
  Focused 142/142 extracted from final full, 4 files. Browser 23/23, console 0/0.
- Actual compiled Skills/SkillEditor/SkillMenu/Switch/Dropdown/Tooltip/ConfirmDialog,
  actual API/parser/requestJSON, native file input, exact frontmatter/name helpers.
  Fetch/stores/navigation/download controlled, AccessControlModal placeholder.
  Real permission callback/API acceptance checked separately in tests.
- Types 1098/85 → 1059/85, ESLint 754 → 742; new diagnostics 0.
- Every original API consumer traced, including unchanged command and workspace
  list callers with existing refusal boundaries. Shared page and list shapes checked.
- Backend 542 / unrelated primary 21 / production neighbors 12 preserved;
  healthy/restarts 0, production revision unchanged. Historical backend 1063 reused;
  no new backend test run. Two own empty volumes verified read-only and removed;
  262 other volumes preserved. Own browser/HTTP/generated bundle closed/removed.
- SDD 3/3 complete; source self-review and Git diff checks completed.
- Proof: `/Users/yshishenya/.codex/private-artifacts/airis-skills-management-20261010`.

Plan 198/244, 46 open, no numbered closures; goal active. Global types/lint/backend,
PR/CI/integration/clean build/deploy and real provider/payment/mail/volunteers/calendar
criteria remain open. Broader command/editor lifecycle is outside this acceptance.
