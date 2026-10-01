# Record streaming usage acceptance

- Type: docs
- Status: completed
- Owner: Codex
- Branch: codex/docs/streaming-usage-acceptance
- Created: 2026-10-02
- Updated: 2026-10-02
- Related work item: 2026-10-02__bugfix__streaming-usage-accounting.md
- SDD Spec: meta/sdd/specs/completed/airis-streaming-usage-2026-10-02-001.json

After the source fix merged in PR #133, a fresh free completion on the released runtime matched provider input/output measurements, the non-estimated settlement event and the exact quota deltas. Monetary charge was zero. Prior usage events remained unchanged. Update the bug checklist and close its SDD only after these checks pass.

- [x] Verify source checks and merged PR.
- [x] Verify fresh released free usage and unchanged historical events.
- [x] Close the related SDD and update its work item and branch log.
- [x] Validate SDD and whitespace; no runtime or dependency changes.

Upstream impact: documentation only. Private deployment configuration and account details are excluded.
