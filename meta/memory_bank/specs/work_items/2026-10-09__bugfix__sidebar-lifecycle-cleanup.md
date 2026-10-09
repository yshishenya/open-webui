# AIRIS — освобождение ресурсов боковой панели

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/sidebar-lifecycle-cleanup
- SDD Spec: meta/sdd/specs/active/airis-sidebar-lifecycle-2026-10-09-001.json
- Created: 2026-10-09
- Updated: 2026-10-09

## Context

Sidebar returns its destructor from an async onMount callback. Svelte only registers
synchronous destructor returns, so teardown leaves window/drop/socket handlers and
mobile/showSidebar/settings subscriptions registered. The sidebarWidth subscription
also has no owner. Sortable is created after tick without a destruction guard.
Repeated mount/unmount can keep old sidebar behavior and refresh work active.
Official Svelte lifecycle docs and the installed 5.56.0 runtime confirm the contract.

## Goal / Acceptance Criteria

- [x] Execute the actual source callback and reproduce the ignored destructor before editing.
- [x] Mount returns a destructor synchronously; four owned store subscriptions, six
      window handlers, two socket handlers and one folder handler are removed exactly
      once at component teardown; each sidebar DOM node owns three drop handlers.
- [ ] Opening the sidebar after closed-at-login creates sorting; closing/reopening
      replaces the owned Sortable and drop handlers without leaving stale resources.
      Mobile changes disable/re-enable sorting for the actual live list.
- [ ] Repeated mount/unmount leaves zero owned handlers/subscriptions; live sidebar
      opening and pin ordering still work.
- [ ] Full frontend tests, scoped formatting/lint and required browser paths pass
      for exact source; global type/lint diagnostics do not increase.
- [ ] Commit/review/guarded release and production image/content/data/config/money
      preservation are proved; update private plan without claiming pilot acceptance.

## Scope and implementation

Keep onMount synchronous and include width cleanup in the existing unsubscriber
list. Native Svelte actions own Sortable on the actual pin-list node and drop
handlers on both collapsed/expanded sidebar nodes; teardown follows DOM replacement.
The sorting action updates when mobile mode changes. Reuse installed lifecycle/Sortable APIs. No new
runtime module, dependency, backend, schema, consent, payment or email change.

## Dependency compatibility

Existing pins: Svelte 5.56.0, TypeScript 5.9.3, Sortable 1.15.7. Registry latest
stable reads: Svelte 5.57.2, TypeScript 7.0.2, Sortable 1.15.7. Preserve the accepted
lock for this lifecycle-only bug fix; dependency upgrades require a separate work
item with official release notes, full source/build/native/browser compatibility
checks and regenerated accepted inputs. No new integration or dependency replacement.

## Upstream impact

Only the existing Sidebar lifecycle and Sortable initializer require a narrow
behavioral diff. The regression check is fork-owned and executes actual source,
using the existing AST/transpile test pattern. No reformatting or broad type cleanup.

## Verification

Docker Compose-first frontend suite, before/after actual-handler regression,
scoped lint/Prettier, full type/lint diagnostic comparison and browser sidebar/chat
paths. Rebuild from the accepted clean production profile and use guarded deploy.
Retain backup/rollback and preserve application data and neighboring services.

## Risks / Rollback

DOM replacement must release the previous element resources and create the new
ones, including closed-at-login and mobile transitions. Check repeated lifetime cycles. Roll back the application image through guarded deploy;
no database or account state rollback.

## References

- https://svelte.dev/docs/svelte/lifecycle-hooks
- https://github.com/sveltejs/svelte/releases/tag/svelte%405.56.0
- https://github.com/SortableJS/Sortable#destroy
- Main private plan remains 198/244, 46 numbered tasks open; this correction alone
  does not complete real pilot, delivery, device or calendar acceptance.

## Source verification — 2026-10-09

Before editing, both actual-source lifecycle cases failed: mount returned a
Promise rather than a synchronous destructor. After the minimal correction, all
three cases pass: normal teardown, teardown before tick and initialization failure.
Four store subscriptions, six window handlers, three drop handlers, two socket
handlers and the folder refresh hook are released; Sortable cleanup runs only
for the live instance. Scoped ESLint passed. Full frontend: 949/949 in 122 files,
zero failures/skips. Full check: 2293 -> 2292 errors, 108 warnings; ESLint remains
1020 errors, with zero new normalized diagnostics. Two pre-existing untouched
markup indentation differences remain in Sidebar; unrelated formatting was restored.
Backend/schema/dependencies are byte-identical to the accepted source. Candidate
image, browser acceptance, source CI/review and production release remain pending.

## Browser-discovered DOM replacement — 2026-10-09

Candidate31e was rejected: Chromium42/43; drag ordering did not change after
closed-at-login sidebar opening. The component remained mounted while the actual
sidebar/pin-list nodes appeared or were replaced. Initial-only setup missed the
new list and retained handlers on the old node. Use native Svelte actions for
node lifetimes, preserve synchronous component cleanup. Updated actual-source
regression passes3/3, each exercising21 cycles; full checks and new candidate
browser/release acceptance are still pending. The first failed trace/log/XML is
preserved in the private proof root. Do not release the rejected candidate.

Updated source checks:949/949 frontend tests,122 files; new actual-source checks
fail3/3 on rejected31e and pass3/3 on the action-based correction,21 cycles each.
Full check2292→2290 errors,108 warnings; full ESLint1020 unchanged. Normalized
diagnostic delta0 additions; scoped lint passes. Only the same two pre-existing
untouched markup indentation differences remain. Browser and release are pending.

## Hidden pin ordering — actual-source reproduction

Actual Sortable callback fails with stored [notes,automations,calendar] and
a hidden automations item: dropping notes after calendar leaves visible order
[notes,calendar]. DOM indices and full stored-array indices describe different
positions. Read the reordered visible DOM ids and replace only visible slots
in the existing settings array. Hidden ids/slots and other settings are preserved.
Candidatea2e is superseded; it must not be released. A fourth permanent check
reproduces this behavior; the browser case now uses a hidden middle slot.

Final pin-order source checks:950/950 frontend in122 files,4/4 actual-source
regressions. Full check2290→2289 errors/108 warnings, ESLint1020 unchanged,
normalized additions0. Scoped lint passes, formatting differs only in the same
two old untouched markup locations. Hidden middle slot is preserved and visible
order is [calendar,notes]. New source/CI/clean candidate/browser/release pending.

## Candidate verification — exact source f21d22bb341ceb2e1890d49814dc2994fca0ce66

The first focused browser attempt failed in the second navigation cycle: its
document marker was captured outside the loop, while the existing root
beforeNavigate deliberately reloads public-to-app navigation. The trace contains
one document request for that return; app-to-guide navigation stayed in the same
document. Preserve the teardown assertion before return, capture each cycle's
own marker and additionally assert the intentional document replacement on return.
Application code and candidate image were unchanged. Corrected focused case
passes five cycles; full Chromium passes43/43, zero failures/skips. Firefox390px
and production acceptance remain pending.

Clean candidate native/file/package checks passed:351 Python packages,529 backend
files,62 frozen static files,153 model files and27 links; native torch/vision/audio
operations passed. Exact-head CI completed11 success/1 skipped; CodeRabbit reviews
are disabled for the base, so no independent review is claimed. Global quality
gates remain open. The initial failed trace/log/XML and corrected runnable check
are retained privately.

## Full Firefox findings and next source

f21 Firefox390px:41/43. One private check expected a sidebar node while the
mobile sidebar was closed; corrected expectation checks0 before opening and1
after. A separate real wallet loading shift236px is reproduced by a controlled
native pointer check; fix/test tracked in2026-10-09__bugfix__wallet-period-layout.md.
f21 is rejected and must not be published or released. Updated full source suite
951/951,0fail/skip; check2289/108 and lint1020 with normalized additions0.
New exact source, CI, native and44+44 browser acceptance remain pending.

## Wallet API refusal regression

d0e passed focused4/4 and Chromium44/44, but is rejected: delayed503
moves the top-up preset58px between native down/up. The error branch
removed amount slots. Retain those nodes and use one grid cell to reserve
natural caption height for loading, success and retry. Component failures
reproduced before; after6/6 focused source cases and952/952 frontend pass.
New candidate needs focused6/full90/cold native3; release remains pending.
