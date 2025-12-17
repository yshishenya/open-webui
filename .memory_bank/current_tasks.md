# Current Tasks

This file tracks active development tasks for the Airis project. Update this file regularly as tasks progress through the workflow.

---

## Recently Completed (Last 7 Days)

- [x] **[BILLING-01]** Implement billing system with YooKassa integration
  - Created database models (Plan, Subscription, Usage, Transaction, AuditLog)
  - Implemented backend API (user billing + admin billing)
  - Built frontend UI (plans catalog, dashboard, admin panel)
  - Added quota enforcement middleware
  - Integrated payment webhooks

- [x] **[BILLING-02]** Add audit logging for admin actions
  - Created AuditLog model with action enums
  - Implemented logging in all admin endpoints
  - Added audit log viewer in admin panel

- [x] **[DOCS-02]** Set up Memory Bank documentation structure
  - Created comprehensive project documentation
  - Documented tech stack, coding standards, patterns
  - Added workflows for common development tasks

---

## In Progress

### High Priority

- [ ] **[BILLING-03]** Test billing system end-to-end
  - Test plan subscription flow
  - Test payment processing and webhooks
  - Test quota enforcement
  - Verify audit logging
  - **Owner**: TBD
  - **Target**: Week of 2025-12-16

- [ ] **[BILLING-04]** Add usage analytics dashboard
  - Show usage trends over time
  - Display quota utilization charts
  - Add cost projections
  - **Owner**: TBD
  - **Target**: 2025-12-20

### Medium Priority

- [ ] **[FEATURE-01]** Improve AI model switching UX
  - Add model comparison UI
  - Show model capabilities and pricing
  - Implement model recommendations
  - **Owner**: TBD
  - **Target**: Q1 2026

- [ ] **[FEATURE-02]** Enhance knowledge base with vector search
  - Optimize embedding generation
  - Improve search relevance
  - Add multi-document reasoning
  - **Owner**: TBD
  - **Target**: Q1 2026

### Low Priority

- [ ] **[DOCS-03]** Add API documentation for billing endpoints
  - Document all billing API endpoints
  - Add request/response examples
  - Create integration guide
  - **Owner**: TBD
  - **Target**: 2026-01-15

- [ ] **[UI-01]** Improve mobile responsiveness
  - Optimize chat interface for mobile
  - Fix billing UI on small screens
  - Test on various devices
  - **Owner**: TBD
  - **Target**: Q1 2026

---

## Backlog

### Features
- **[FEATURE-03]** Multi-user workspaces with shared billing
- **[FEATURE-04]** API platform for third-party integrations
- **[FEATURE-05]** AI agents with multi-step reasoning
- **[FEATURE-06]** Workflow automation builder
- **[FEATURE-07]** Custom model fine-tuning integration
- **[FEATURE-08]** Mobile apps (iOS/Android)

### Technical Improvements
- **[TECH-01]** Add comprehensive test suite (backend + frontend)
- **[TECH-02]** Set up CI/CD pipeline
- **[TECH-03]** Implement caching strategy with Redis
- **[TECH-04]** Add performance monitoring (Prometheus/Grafana)
- **[TECH-05]** Set up error tracking (Sentry)
- **[TECH-06]** Database query optimization
- **[TECH-07]** Add rate limiting per endpoint

### Documentation
- **[DOCS-04]** User guide for billing features
- **[DOCS-05]** Developer onboarding guide
- **[DOCS-06]** Deployment guide (Docker/Kubernetes)
- **[DOCS-07]** API reference documentation

---

## Blocked

_No blocked tasks currently_

---

## Task Workflow

### Status Definitions
- **To Do**: Task defined but not yet started
- **In Progress**: Actively being worked on
- **Blocked**: Waiting on external dependency or decision
- **Done**: Completed and merged to main branch

### Priority Levels
- **High**: Critical for current release or blocking other work
- **Medium**: Important but not urgent
- **Low**: Nice to have, can be deferred

### Task Format
```
- [ ] **[CATEGORY-ID]** Task title
  - Description point 1
  - Description point 2
  - **Owner**: Developer name or TBD
  - **Target**: Completion date or milestone
```

---

## Notes

### Recent Architectural Decisions
1. **Billing System Architecture** (2025-12-10)
   - Chose YooKassa for Russian market support
   - Implemented quota enforcement at middleware level
   - Used Peewee ORM for consistency with existing codebase
   - Added comprehensive audit logging for compliance

2. **Frontend Framework** (2025-12-10)
   - Using Svelte 5 with SvelteKit 2
   - Tailwind CSS 4 for styling
   - TypeScript for type safety
   - Component-based architecture

3. **AI Provider Strategy** (2025-12-10)
   - Multi-provider support (OpenAI, Anthropic, Google, Ollama)
   - Fallback mechanisms for provider failures
   - Quota tracking per provider and model

### Upcoming Decisions Needed
- [ ] Choose monitoring/observability solution
- [ ] Define testing strategy and coverage targets
- [ ] Plan mobile app architecture
- [ ] Decide on internationalization strategy beyond EN/RU

---

**Last Updated**: 2025-12-11
**Project Version**: 0.6.41
**Active Contributors**: 1 (maintainer)
