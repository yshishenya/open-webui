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
      window handlers, three drop handlers, two socket handlers and one folder handler
      are removed exactly once at teardown.
- [x] If teardown precedes tick, zero late Sortable instances are created. If tick
      finishes first, the owned Sortable instance is destroyed once.
- [ ] Repeated mount/unmount leaves zero owned handlers/subscriptions; live sidebar
      opening and pin ordering still work.
- [ ] Full frontend tests, scoped formatting/lint and required browser paths pass
      for exact source; global type/lint diagnostics do not increase.
- [ ] Commit/review/guarded release and production image/content/data/config/money
      preservation are proved; update private plan without claiming pilot acceptance.

## Scope and implementation

Keep onMount synchronous, move only the tick-dependent initialization into a guarded
continuation, include width cleanup in the existing unsubscriber list and destroy
the one owned Sortable instance. Reuse installed lifecycle/Sortable APIs. No new
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

Deferred initialization must not run after unmount. Check both tick orderings and
repeated lifetime cycles. Roll back the application image through guarded deploy;
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
