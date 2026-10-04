# Collapsible: valid detail attributes and disclosure contracts

## Meta

- Type: bugfix
- Status: completed
- Owner: Codex
- Branch: codex/bugfix/collapsible-attributes
- SDD Spec: meta/sdd/specs/completed/airis-collapsible-attributes-2026-10-04-001.json
- Created: 2026-10-04

## Context / root cause

Shared Collapsible infers title/attributes as null-only and uses an unsafe Function callback. Ten actual consumer files plus one unused-import consumer were inspected; common/Folder is an additional actual consumer omitted from the preceding analysis. Structured output and Markdown producers supply string attributes, including duration. Dayjs1.11.20 correctly handles numeric strings70/120 with a unit; that hypothesis is refuted. Invalid duration instead reaches humanize and displays a month; negative values falsely claim less than a second. Attribute data can come from model-generated Markdown and saved messages.

## Goal / measurable acceptance

- [x] A regression mounted against the actual baseline component fails for malformed/negative/non-finite duration; correct labels remain for valid string/numeric boundaries and absent/zero values.
- [x] Shared title, attributes, localization context and onChange have concrete compatible types; no descriptor mutation and no new type diagnostics in consumers.
- [x] Disabled state, button aria-expanded, callback, slotted header/content, grow/hide and reasoning/code-interpreter completion behavior remain correct.
- [x] Focused and full frontend tests pass; all changed files pass strict ESLint and formatting; full diagnostic comparison against3763 errors/160 warnings/1396 ESLint adds zero diagnostics.
- [x] Compiled browser behavior, exact-source CI/merge and guarded production identity/health/configuration verified before production completion.

## Scope / upstream impact

Only shared upstream common/Collapsible.svelte and additive regression tests/docs. Remove unused decode/uuid/id; describe actual nullable title and used attributes; normalize duration once, fall back to existing Thought label if it is not usable. Preserve all slots, transitions, accessibility guards, callback and completion logic. Controls/ChatControls remain separate follow-up because their model/stop contracts need complete tracing. No dependencies/API/schema/config changes.

## Dependencies

Installed dayjs1.11.20, latest stable1.11.23 verified via npm registry; official duration creation documentation confirms a number with a unit. Keep the existing project pin for this focused repair. Upgrade through the existing dependency work item with release-note review and full acceptance, not within a display repair.

## Verification / rollback

Compose-created frontend tools container; actual mounted component regressions, full Vitest, check/lint and mapped diagnostic delta. Existing compiled candidate/backend fixture and guarded deploy with fresh baseline, verified backup and retained rollback. Full goal G01–G17 remains active; plan192/244 is unchanged until a complete numbered criterion has evidence.

## Source checks

Baseline05ad7e0f8: malformed/negative/Infinity duration regressions fail3/16, without unhandled errors. Final25 mounted checks (valid string/numeric boundaries, running/completed/code interpreter, Russian locale, callback and disabled) and547/547 frontend tests in79files pass. Strict changed-file ESLint/Prettier pass. Fullcheck3763/160→3743/160:20removed,0new,4existing dir-prop signatures refined. FullESLint1396→1393:3removed,0new. Overall full-project checks remain red.

Compiled candidate c9a8c940893a91e9c33c0bacbdba349b4cde6ad2 passes16/16 full paths in Chromium and Firefox390px. Four additional browser proofs cover real saved Markdown, Enter/Space/content-click/disabled behavior, Controls system/advanced sections, Sidebar section/recursive folders, and Playground grow editor;0pageerrors. CI head b5bf88b25d9bbcad3a32869d54fd59ace9421c7c has10 successful checks and dependency-review skipped. CodeRabbit review is disabled, not an independent approval. Source SDD3/3 completed. Registry/server candidate4914 frontend and425 backend hashes match the local candidate. Final documentation head/merge and guarded production acceptance are recorded below.

## Production acceptance — 2026-10-05 Europe/Istanbul

PR259 head99db133c292c46882083bdefba5a246d245b669c merged as4d465592eed5c0f61a734bde06462bd880006cab. Ten unique successful CI gates; dependency-review skipped; an additional enforce-base-branch success is a duplicate observation. Full merge tree and5file hashes match. Runtime source c9a8c940893a91e9c33c0bacbdba349b4cde6ad2 is unchanged by the documentation commits.

Guarded release image digest sha256:ec640118de267ba613fd8a03d0a9e8f1330dba32b4f4bc6051cdd749b27c9c96 accepted:4914frontend/425backendPython hashes,layers,image environment,labels and platform match the tested candidate. Healthy/0restarts;runtime environment,13neighbors,analytics dynamic environment and full three-file Compose preserved. Verified backup,hard migration,retained rollback and10GiB disk gate pass. Image was atomically persisted;default Compose matches the accepted runtime. Existing production chat renders2messages,empty visible input,0console errors;pointer/Enter disclosure accepted,0new messages/payments. Other duration boundaries/slots were tested on byte-identical compiled assets.

Full-project types/lint remain3743errors/160warnings/1393ESLint. Full onboarding goal remains active;pilot has no eligible opted-in users and has not started. No claims of external delivery,real payment/receipt,physical-phone acceptance,user usefulness or mature24h/72h/14d data. Controls/ChatControls remain a separate follow-up.
