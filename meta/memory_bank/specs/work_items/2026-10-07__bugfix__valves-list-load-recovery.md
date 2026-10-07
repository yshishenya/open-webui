# AIRIS valves list load recovery

- Type: bugfix
- Workflow: bug_fix / workflow-compliance
- Owner: Codex
- Status: release accepted
- Branch: `codex/bugfix/valves-list-load-recovery`
- Created: 2026-10-07
- SDD Spec: `meta/sdd/specs/completed/airis-valves-list-load-recovery-2026-10-07-001.json`

## Cause and scope

Controls/Valves initializes shared nullable tool/function lists without handling
rejected API calls, leaving loading=true and preventing a sibling list request.
A null list finishes loading but crashes the select template. Recover each list
independently, retain null as unknown, show localized errors and retry on reopen.
Render nullable lists safely; avoid sorting the shared function list in place.
Trace the sole Controls caller, list stores, API clients and server responses.
This work item covers list initialization and selection rendering. Detailed
valve schema/value load-save contracts remain a separate existing legacy block.

## Measurable acceptance

- [x] Actual initializer regression fails on baseline for reject/null.
- [x] Each failed list finishes loading, displays a user-safe error, leaves the
      sibling usable and retries only unknown lists on reopen.
- [x] Successful empty lists remain cached; server tools excluded; functions
      sorted for display without mutating store order.
- [x] Full frontend suite passes, compiled Chromium/390px Firefox cases pass,
      zero new normalized type/lint errors, touched file lint clean.
- [x] Exact source CI and identical merge trees accepted.
- [x] Candidate path pack and guarded production release accepted with
      backend/static/ENV/money/mounts/neighbors preserved.
- [x] SDD closed; private plan reconciliation follows documentation merge; overall final-goal gates kept honest.

## Upstream impact and rollback

Minimal shared Controls/Valves loading and null-render guards, unused imports and
indices removed. Reuse existing stores/APIs/notifications. English/Russian error
translations; one regression. No backend/schema/dependency changes. Release only
with exact image identity, verified backup, Alembic and retained rollback.

## Source verification, 2026-10-07

Actual initializer baseline 4 failures/1 pass; fixed 5/5. Full frontend 830/830
(101 files). Actual compiled Controls/Valves with real shared Valves/Spinner
children: 18/18 Chromium/390px Firefox checks, page errors0, controlled list API
fixtures. Reject/null independently recover, sibling remains selectable, retry
refetches only unknown lists; server tools excluded and function store order
preserved. Types3258→3256, warnings127 unchanged, ESLint1200→1192; normalized
new diagnostics0, component/test lint0 and format clean. Existing detailed
valve value/schema type errors remain explicit legacy debt. No user browser
generation/payment/profile mutation, no pilot claim.

## Accepted source and production release

[PR337](https://github.com/yshishenya/open-webui/pull/337): source `eb4ff5fb21c4e94d8fb380279f4e3a2a618545d6`,
merge `69288117da3a0bf3ae12afb99f147fa4c720ac8d`; trees identical, all ten applicable CI successful; dependency-review
skipped. CodeRabbit disabled for the base; no independent human review claimed.
The completed billing job log retrieved; pr-fast is not a full backend suite claim.

Image `yshishenya/yshishenya:valves-list-eb4ff5fb2-20261007`, registry/server identity
`sha256:70a5cdc3889b5eeee07b0b8011fb09312b34b01d8fda82077bf3aad40037f24a`;4914 frontend/427 backend hashes match candidate/server image.
Same backend source6a2b5394518d4ac5bfc7e64039cc4db934a66107,3955 static files
and analytics env.js preserved. Six public endpoints200, frontend version matches.
Those endpoint and fixture checks do not establish ordinary account or human pilot
acceptance. Local Docker config ID differs from registry/server identity and is
verified through exact RepoDigest and file contents, not equated blindly.

Verified new backup `/opt/backups/airis/20261007T050930Z-valves-list-eb4ff5fb2-20261007`,
hard Alembic gate/current revisiono1a020261003, rollback `airis:rollback-20261007T050930Z-valves-list-eb4ff5fb2-20261007`.
ENV/compose configs,12 neighbors,data mount and monetary hashes preserved.
131 Wallet/36 Payment/5982 LedgerEntry/0 Transaction unchanged; healthy/restarts0,
10.34GiB free. Default image pin changes only intended .env hash with no recreate.
Old backup20261004T133525Z-chat-sidebar-c5fd97644-on-return-20261004 relocated
to Mac:11 files/1567180043bytes,SHA256,size,tar,pg_restore verified before
server CAS and exact deletion; current and preceding backups retained.

Retained rejected preparation: premature packaging, mistaken local-ID equality,
missing runner config and SDD argument/name warnings. First post-release file
probe accidentally ran outside container and returned0/0; rejected manifest
retained. Correct container probe verifies all4914/427; no guard weakened.

Read-only actual detail-loader transpilation separately reproduces three legacy
failures: rejected values, rejected schema, null values with array schema leave
loading=true. This is the next separate block, not compiled UI acceptance.

SDD3/3 completed. Overall goal active, plan198/244;globalG14/13.11 and real
Inbox/replies/both operators, physical phone, independent usefulness, voluntary
pilot/24h/72h/14d mature cohorts and historical payment provenance remain open.
Fresh pilot check140ordinary/10new7d,127no_consent/13inactive,0participants/0queue;
A/B/product/queue disabled,dry-run/pilot-only true,SMTPfalse,DML0.
