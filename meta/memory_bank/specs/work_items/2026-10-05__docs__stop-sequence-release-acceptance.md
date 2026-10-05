# Stop sequence and ChatControls release acceptance

## Meta

- Type: docs
- Status: done
- Owner: Codex
- Branch: codex/docs/stop-sequence-release-acceptance
- Created / Done: 2026-10-05
- Related implementation: [stop sequence bug fix](2026-10-05__bugfix__stop-sequence-decoding.md)
- Related SDD: `meta/sdd/specs/completed/airis-stop-sequence-decoding-2026-10-05-001.json` (2/2 completed)

## Result and measurable acceptance

- [x] Both OpenAI/Ollama mappers preserve whole string stop sequences and literal Unicode, including Unicode next to a backslash. Supported escapes decode once; malformed types/escapes fail. Frontend comma interpretation is unchanged.
- [x] Actual mappers pass 46 cases. Baseline failed 20/30 cases; the initial repair failed 2/46 edge cases. All 30,940 nonempty ASCII strings of length 1–4 agree with stdlib decoding, with 0 mismatches.
- [x] Full backend: 946 passed, 5 known PostgreSQL-only skips, 0 errors. Persistence test sources and skip identities are unchanged; historical PostgreSQL acceptance is separate from fresh runs. Frontend: 547 passed on identical frontend sources.
- [x] Black passes for 3 Python files. New helper/test strict Ruff passes; mapped payload diagnostics: 10 current / 11 base / 0 new. General frontend type/lint debt remains open. No dependency added.
- [x] Source `5c471189fc8e91615b88728806956d2c613a8021`: 12 successful CI checks, 1 dependency-review skip. [PR262](https://github.com/yshishenya/open-webui/pull/262) merged as `4498289cb828b311b79832e750711ee26afc846c`, with equal complete Git trees. Disabled CodeRabbit review is not independent review evidence.
- [x] Frozen frontend includes PR261. Full-copy and delta candidates have identical 4,914 frontend / 426 Python files, image environment, labels and platform. Each compiled candidate passes 16 mandatory browser paths in Chromium/Firefox at 390 px.
- [x] Published and pulled image `yshishenya/yshishenya:stop-sequences-5c471189f-delta-20261005`, digest `sha256:5b761e0091d309028390ffc10046c7b2128e0bfe75b8d86a19965365baaaf23d`, matches candidate files and accepted configuration on production.
- [x] Fresh backup verified; hard Alembic gate passed. Guard retains a 10 GiB minimum, source/image/config/environment checks, all 3 Compose files, only-airis recreation and image rollback. Latest prior backups retained; older backups moved only after size/hash and archive/dump readability checks.
- [x] Production healthy, 0 restarts. All 12 original neighbor identities/states are unchanged. Runtime environment and dynamic analytics env.js preserved. One additional production container appeared separately.
- [x] Full Compose default selects the accepted image. Atomic .env update with mode 0600 changes only image selection. Effective runtime environment is preserved. Public health is true and frontend version is `5c471189f`.
- [x] Authenticated saved chat: 2 messages, empty input, controls close/reopen, 0 console errors; 0 new requests / 0 payments submitted.
- [x] Original SDD closed, 2/2 tasks. This documentation changes no executable code, dependency, migration or setting.

## Packaging

Final image reuses unchanged base assets, copies 272 changed/new frontend files (15,385,801 bytes) and removes 260 obsolete paths. Backend overlay contains only payload.py and the new decoder. Full file, environment, label and platform comparisons prove equivalence with the initial full-copy candidate. The smaller delta layer was successfully pushed and pulled from the registry.

## Limits

Controlled SMTP/payment/browser fixtures do not prove real payments, fiscal receipts, Inbox placement, physical phone behavior or real 24h/72h/14d pilot windows. The complete onboarding objective remains active. G14 and the full product goal remain open.

## Upstream Impact

This documentation adds no runtime diff. Implementation has one import and two mapper hooks in payload.py, plus an additive decoder/test. Accepted PR261 ChatControls changes are included in the release; FileNav remains unchanged.
