# Stop sequences: preserve whole strings and Unicode at provider boundaries

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/stop-sequence-encoding
- SDD Spec: meta/sdd/specs/completed/airis-stop-sequence-decoding-2026-10-05-001.json
- Created: 2026-10-05

## Context / root cause

AdvancedParams has five consumers. Main Chat normalizes its UI string/array, General and ModelEditor save arrays; Playground sends its UI values and admin defaults save directly. Backend ModelParams permits both a string and array through extra fields/custom_params. Both actual provider converters decode stop by iterating its value, so a stringEND becomes three stop tokens. Their UTF-8/unicode_escape conversion also corrupts literal Russian/Chinese/accented/emoji text even in arrays. A backslash in a string is processed alone and can fail. All converter callers traced: OpenAI model, Ollama generate/chat/OpenAI compatibility and function pipes. This is a real shared request-boundary defect; avoid changing UI comma rules or unrelated settings while repairing it.

## Goal / measurable acceptance

- [x] Regression calls both actual OpenAI/Ollama payload converters and fails on baseline for whole-string and Unicode cases.
- [x] Shared fork-owned decoder preserves whole string as one sequence, sequence order, Unicode and established escaped controls; empty/list/null behavior follows current mapping boundary.
- [x] Malformed types are rejected; no conversion to characters or invented fallback; valid comma-containing API string remains one sequence.
- [x] Both mapper hooks use the same decoder, including custom_params override. No unrelated params, money, consent, queue or provider URL changes.
- [x] Focused/full backend and applicable PostgreSQL paths, lint/format, frontend regressions and exact-head CI pass; no new app dependency.
- [x] Merge and separately guarded release prove current source/image/files/config/health and browser mandatory paths. Full goal remains active until all original criteria are proved.

## Scope / upstream impact

Thin import and two mapping hooks in upstream utils/payload.py; additive utils/airis/stop_sequences.py and one regression file. Stdlib re selects original escape tokens, unicode_escape decodes those tokens; no dependency/config/migration/API addition. Retain the legacy supported unicode_escape syntax by decoding original escape tokens without re-encoding literal Unicode. Main Chat stop conversion and UI parameters remain unchanged. Rollback: restore preceding source/image through guarded release with fresh backup/disk baseline; production mutation occurs only after candidate verification.

## Initial verification plan (historical)

Compose-first isolated SQLite, offline runtime/noSMTP/API keys and existing external network. Regression uses actual mapper imports. Compare baseline2044e76c48893eee10bc4e0223f5dc4cb718b7d2; initial whole-string decodingEND yieldsE/N/D and literalСТОП is mojibake. Exact provider regression pending. Keep complete objective G01–G17 and plan192/244; no pilot/delivery/payment evidence is implied by decoder tests.

## Initial source results before PR (historical)

Actual mapper regression20failed/10passed on baseline,30/30passed after repair. Full backend930passed/5PostgreSQL-onlyskips,0errors. Five skip identities match prior full PostgreSQL acceptance and those test sources are byte-identical; PostgreSQL has not been rerun for this decoder-only change and historical acceptance is kept distinct. New helper/test strict Ruff pass; upstream payloadRuff11→10 with0new through repository line-mapped checker. Black--target-versionpy311 checks all3files,gitdiffcheck passes. Codec behavior checked against officialPython3.11codec documentation: raw_unicode_escape leaves original backslashes and encodes other code points losslessly; unicode_escape decodes Latin-1, explaining the old UTF-8 corruption. Python3.11.16 runtime; no app dependency added. Candidate/release, exact-head CI pending. Frontend547/547passed; no src or dependency change.

## Additional edge acceptance (historical pre-release snapshot)

Pre-merge audit reproduced a second defect in the initial raw_unicode_escape implementation: literal backslash followed by Cyrillic became a textual Unicode escape. Both actual mappers failed2/46edge checks before repair and pass46/46after. Decode only original escape tokens through stdlib re/unicode_escape; preserve unknown non-ASCII escapes and reject malformed/truncated escapes. Exhaustive30940nonemptyASCII strings of length1–4 match Python unicode_escape with0mismatches. Full updated backend946passed/5samePostgreSQL-onlyskips/0errors; Black3files and repository lint gate10current/11base/0new pass. Frontend547tests were already run on the identical frontend sources. Previous frozen frontend build8a2724fc3 failed at default2GiBNode heap; do not release it. Fresh frozen source and sufficient heap pending.

## Final source and production acceptance

Source5c471189fc8e91615b88728806956d2c613a8021; PR262 merge4498289cb828b311b79832e750711ee26afc846c, complete Git tree equal.12CIchecks success/1dependency-review skip; CodeRabbit disabled is not an independent review.46actual-mapper tests,946fullbackendpassed/5unchangedPostgreSQL-onlyskips,30940ASCIIcodec comparisons/0mismatches,547frontendtests on identical UI. No persistence/schema dependency changed; PostgreSQL-only historical acceptance remains explicitly separate. Both compiled image forms passed16browser paths in Chromium/Firefox390px.

Guarded release accepted: immutable digestsha256:5b761e0091d309028390ffc10046c7b2128e0bfe75b8d86a19965365baaaf23d;4914frontend/426Python files match. Only payload.py and the new decoder changed in runtime backend; frontend includes accepted PR261. Delta packaging copies272changed/newfrontend files and removes260obsolete ones,15,385,801bytes of changed frontend, retaining unchanged assets. It is byte-equivalent to the initial full-copy candidate and avoids redundant large layers.

Fresh verified backup, hard Alembic gate, source/platform/digest/ENV/config guards and image rollback retained. Container healthy with0restarts; all12preflightneighbors preserved, one additional normal production container observed separately. Full3-fileCompose default pinned to accepted image; its only configuration change is image selection. Disk guard10GiB retained. Saved authenticated chat renders2messages, emptyinput, control close/reopen,0consoleerrors; no request/payment submitted. SDD2/2closed. Full G01–G17 remains active; general frontend type/lint debt and actual pilot/delivery/payment/hardware acceptance are not claimed complete.

Release documentation: [stop-sequence-release-acceptance](2026-10-05__docs__stop-sequence-release-acceptance.md).
