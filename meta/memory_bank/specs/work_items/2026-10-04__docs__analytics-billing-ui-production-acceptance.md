# Приёмка опубликованной аналитики и биллинга Airis

## Meta

- Type: docs / release acceptance
- Status: completed (technical release)
- Owner: Codex
- Branch: codex/docs/analytics-billing-ui-production-acceptance
- Created: 2026-10-04
- Feature: [Понятные аналитика и деньги](2026-10-04__feature__analytics-billing-ui.md)
- SDD Spec: meta/sdd/specs/completed/analytics-billing-ui-2026-10-04-118.json

## Goal / Acceptance Criteria

Зафиксировать точную принятую версию, результаты проверок, публикацию и ограничения. Закрыть техническую задачу только после проверки работающего приложения. Испытание с пятью людьми остаётся отдельным непроведённым исследованием.

## Source and candidate

- Feature PR: https://github.com/yshishenya/open-webui/pull/212
- Frozen source: b8d4c718951710c4db3f81385f1c1754f0817c9c
- Merge: 58f583edd58b5e8b401c9ff0e12ed1b6a02a5a65
- Application source, tests and dependency locks are byte-identical between frozen and merged source. Merge preserves adjacent PR213 and PR214.
- Candidate: yshishenya/yshishenya:analytics-billing-ui-b8d4c7189-20261004@sha256:b93f4dc585b51b75bb4310c24e01daee98f126c2b52b5fb3c0cda289fc509dee
- Local config ID: sha256:f12a7e33fb37f781b98ec35a81d0852eff28d3e48d028a2c67bd75622d9f70a9
- Previous production: mail-report-b3c377cfe-on-mail-queue-20261004, registry digest a744b6f64c0e8c2a850e707497fc3995897fee5715948ab43fa06871025f37db.
- 4912 frontend files / 184701764 bytes verified, 11 runtime backend overlay files verified, all other backend files unchanged. Five mail-report files and runtime configuration preserved; 11 base + 2 new image layers verified. No new dependencies or migrations.

## Verification

- Exact candidate: backend 897 passed / 4 PostgreSQL-only skips; all four separately passed on PostgreSQL 16 in separate disposable databases.
- Exact candidate browser: 16 analytics/admin and 18 user billing scenarios passed against image runtime without source/build mounts. 19 pages; widths 360/390/768/1280, two themes, keyboard, dates/groups/models, populated financial records, errors and payment/credit transitions. Financial provider mutations mocked.
- Frontend 288 passed / 58 files. Frontend source is unchanged from that check; build repeated with frozen source SHA and Metrica 111392024.
- Earlier exact-image migration rehearsal: 78 tables / 20722 rows unchanged, head o1a020261003. All migration bytes are unchanged in replacement; server hard migration gate remains mandatory.
- Independent reporting, admin billing, user billing and release-base verification completed.
- Frozen-source PR-fast 37165453796 and release-heavy 37165452029 passed. Required feature merge-medium 37166007708 passed. PostgreSQL reporting fix release-heavy and merge-medium remain pending.

## Limitations

Inherited full typecheck, ESLint, Ruff and Black diagnostics remain under the user's explicit release exception. No added diagnostics in changed scopes. npm run preflight is absent; no thresholds or access checks were weakened.

Two invalid PostgreSQL harness attempts are excluded: a nonexistent asyncpg driver and migration tables sharing fixture databases. The final run uses installed psycopg and four distinct disposable databases; all four pass. Docker browser retry encountered confirmed OOM; accepted browser runs use Node 22 and installed Chrome while the application runs in Docker.

The five-person comprehension trial is not conducted. Production admin browser acceptance depends on an existing administrator session; local admin browser checks and production read-only report checks are distinct evidence.

## Upstream impact

Documentation and lifecycle records only; no application/source changes in this follow-up.

## Publication acceptance

Main UI published and healthy at b93f digest. PostgreSQL report acceptance exposed GroupingError; the one-file fix is merged in PR217 and was subsequently published after its release gates. Full data backup has 749 members, including cache/uploads/vector_db/static; all gzip data and tar headers read, SHA256 checked; linked to stable production container. Actual backup age and source are revalidated before deployment.

## PostgreSQL acceptance correction

- Fix PR: https://github.com/yshishenya/open-webui/pull/217
- Frozen fix source: 0d30ff9d37451745eccbe2ab61cc86b6b819fb4f
- Fix merge: b076d595cd762c3ecd78745603e6b32dcb31fe0a
- Prepared image: yshishenya/yshishenya:billing-report-pg-0d30ff9d3-20261004@sha256:6ef4ffe37f2b665fd371d8274275714d6cb0bf71e5e874bff3900e6af203f57a
- PostgreSQL treated independently built SELECT/GROUP BY expressions as different bind parameters. Reusing each day expression fixes payments, refunds and usage. Existing full report test now also runs on PostgreSQL16; old exact image fails and fix exact image passes.
- 11 exact-image reporting checks passed, changed-file Ruff/Black passed, two affected browser scenarios passed. All other backend and frontend runtime bytes remain unchanged. Frontend version remains b8d4; backend OCI revision is 0d30.
- PR-fast 37167404478 and all applicable PR217 CI passed. Release-heavy 37167839071 and merge-medium 37167950171 passed.
- Merge preserves PR216 math tokenizer work; that unrelated frontend source is not rebuilt into this backend-only overlay. Deployed frontend remains the previously accepted b8d4 artifact.
- Fresh full application data backup: 749 members, 1535399211 bytes; gzip CRC, tar headers, SHA256 and before/after source identity passed. Full PostgreSQL custom dump/globals stored on operator workstation, pg_restore --list passed. Both backups must be younger than one hour at rollout.
- Independent release review passed after correcting rollback selector to retain complete tag@digest and requiring successful pg_restore list in database proof. Three Compose files, 10GiB free space, all environment/configuration checks and 13 neighboring containers are preserved.
- Production browser session still lacks administrator access: /admin/analytics redirects to chat. No role change or authentication bypass is used. Local image admin/browser checks and production read-only service checks are separate evidence.

## Reporting production acceptance

Guarded rollout of 6ef4 image completed at 01:42 UTC; container 681971902a784e581d8eae8c7f69bf252b7e04767e9af9b5dbcada5674a0d137 healthy with zero restarts. OCI backend revision 0d30, frontend version b8d4. Public health true. Alembic o1a020261003, environment/configuration and 13 neighbor identities preserved; exact image persisted.

Production read-only report probe passed: 24 read statements, no DML, 36 payments and 5827 ledger entries observed. Payment/refund/use daily series sums match report totals; net identity and mature funnel denominator hold. This proves service report execution, not an authenticated administrator browser session.

First attempt stopped before mutation for available disk below 10GiB. An exact temporary browser dependency archive was copied to the operator workstation and hash-verified before its remote copy was removed; no backups/application data were removed. The guard threshold stayed 10GiB and retry passed.

## Empty contacts follow-up

Live ordinary account had 200 null user info and disabled receipt fields. PR220 normalizes successful absent user info to {} with type hints; populated info remains unchanged and authentication remains required. Old-image HTTP regression fails; patched and exact-image checks both pass 2 tests. Independent review found no blockers. Existing users.py Ruff findings are identical to baseline (9); Black reports both changed files unchanged. Prepared contacts image digest fb0583cc0667c693c0acf38f1b7ee36526ebd219d57be9dfdb84f6b17554b3f8, source d33ac79d021b68a2071b5c965fe11caa3742075b. Exact comparison confirms only users.py changes over reporting image; frontend/backend other bytes and configuration preserved. This follow-up was subsequently released; see Final published acceptance.

Exact contacts image local browser: existing local account with no saved contact info shows enabled empty Email/Phone fields, no contact loading error, Save disabled until edits. No settings were saved. All remaining PR220 gates subsequently passed.

PR220 merged as 76a2c58b13b6cd9e3192ff32fe0fd1f489cdc0e4 after all applicable PR checks passed, including PR-fast 37169054934 and backend 37169054936. Backend/locks at merge are identical to frozen d33ac source. Adjacent math tokenizer and note-title PRs remain in source; this scoped backend overlay keeps the previously accepted frontend artifact and does not publish unrelated frontend changes. Contacts release-heavy 37169092794 passed. Required merge-medium 37169607761 passed; all merge CI passed.

## Final published acceptance

- Guarded contacts rollout completed: /opt/backups/airis/20261004T021102Z-billing-contacts-d33ac79d0-20261004. Final container db316f75ee8a111d666bdcf1d440f026f0325734a811676a9e55326f2994c1bf healthy, zero restarts. Exact fb0583 digest persisted; OCI backend revision d33ac, frontend version b8d4.
- All final source/merge CI passed. PR-fast 37169054934, release-heavy 37169092794, merge-medium 37169607761; backend/migrations/security/SDD merge checks passed.
- Full fresh application archive: 749 members; CRC/tar/SHA and stable 6ef4 source identity verified. New custom PostgreSQL dump/globals list and full stream read passed. Config/env, 13 neighbors, ports/volumes/networks/command and Alembic o1a020261003 preserved.
- Final live read-only report probe passed: 24 read statements, no DML; 36 payments / 5827 ledger entries observed, net identity, daily sums and mature funnel denominator verified.
- Final production ordinary browser: balance, history, settings and cost calculator load. Empty receipt contacts are enabled without loading error; Save disabled before edits. No settings saved or payment/refund performed.
- Local final image admin overview opened with current period/data and shared navigation; screenshot retained privately. Production admin browser session still redirects to chat; this separate live UI check is unperformed.
- SDD technical release task completed via complete-task, check-complete and complete-spec; timing/human trial remains explicitly unverified.
