# BE-28 .cloud migration: ETL for reference data, identity and classes

| Field | Value |
|---|---|
| Size | L |
| Lane | PC-4 (folders: sessions.md section 5) |
| Priority | P1 |
| Wave | M |
| Depends on | BE-27, BE-05, BE-08, BE-17, BE-25; **open decision OD-10** (Q1 to Q3, Q6) |
| Parallel with | API cards after BE-17 |
| Owner module | migration (MIG-07 part 1) |
| Security review | required (passwords, IC, minors) |

## Goal

Transform and load the first groups of `v2-data-migration.md` section 6.1 from `staging_cloud` into the v2 tables: reference data (levels, subjects, chapters, topics, schools with derived JPN/PPD, packages, settings), users with roles and scopes, parent links, classrooms and rosters, subscriptions. Two-pass load, idempotent, with reconciliation counts.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/architecture/v2-data-migration.md` sections 2 (mapping), 4.0 to 4.2, 4.8, 5 (risks: passwords, IC, faith, rosters, orphans), 6.1 steps 1 and 2, 7 (Q1 to Q8); `docs/architecture/v2-backend-plan.md` section 14 (all) and the matrix rows marked BE-28 in 14.7
- `docs/requirements/v2-cloud-gap.md`
- v2 schema from BE-03, 05, 08, 17, 25 (`apps/api/prisma/schema/{identity,schools,curriculum,classes}.prisma`)
- BE-27 outputs (`staging_cloud`, profile report) and BE-34 outputs (`etl_*` tables, `upsertByLegacy`, runner)

## Outputs

- `apps/api/src/migration/transform/{reference,users,classes,subscriptions}.ts`: one module per group with an explicit **mapping table per enum column** (values from the profile report; unknown values go to `etl_rejects`, never guessed)
- `apps/api/src/migration/load/**`: batched `COPY`/insert through the BE-34 `upsertByLegacy` helper, per-table checkpoint in `etl_checkpoints`, idempotent by `legacy_source` + `legacy_id`
- No Prisma change: the control tables are BE-34's `etl_runs`, `etl_checkpoints`, `etl_id_map`, `etl_rejects`, `etl_recon` (plan 14.4); the target tables belong to other lanes and already have their `legacy_*` columns (plan 14.9)
- CLI (`apps/api/package.json` scripts, run as `npm run migrate:core -w @pp/api -- --dry-run | --apply`): `migrate:core`
- Reconciliation report: source count, loaded, rejected, per table (`etl_recon`, plan 14.6)
- Tests with synthetic fixtures under `apps/api/test/migration/core/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/migration/transform/**`, `apps/api/src/migration/load/**`, `apps/api/test/migration/core/**`.
- Prisma file(s): none (no schema change).
- Contract: none.
- Seeds: none.
- Tests: `apps/api/test/migration/core/**`.
- Other files: `apps/api/package.json` (script `migrate:core`).
- Append-only shared files (one line each, never reorder): `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: PC-4 writes no Prisma file here. It loads other lanes' tables by SQL through the BE-34 helper only, so it needs those tables to exist (hence the dependencies) and never edits their schema; a missing `legacy_*` column is a `cross-lane` issue to the owner.

## Endpoints

None.

## DB tables touched

v2 targets: `users`, `user_roles`, `user_scopes`, `schools`, `school_subscriptions`, `school_packages`, `parent_links`, `classrooms`, `enrolments`, `education_levels`, `subjects`, `chapters`, `topics`. Reads `staging_cloud.*`. Control tables: `etl_*`. (`settings` and `packages` rows of the inventory have no v2 table yet: see Open question 2.)

## Acceptance criteria

1. Each .cloud account becomes a v2 user with a one-item role list; role mapping uses the seven .cloud role codes of `v2-data-migration.md` section 4.1; an unknown role value goes to `etl_rejects` (`UNKNOWN_ENUM`), not to a default role (test with a planted value).
2. Password hashes: `$2y$` hashes are copied as bcrypt-compatible; non-bcrypt hashes are flagged `must_reset_password`; accounts whose hash equals the known shared roster default (the value is passed in by the lead at run time through an environment variable, never stored in the repo) are flagged `must_reset_password`. No plaintext anywhere; Sanctum tokens and `remember_token` are not migrated. Tests use generated hashes only.
3. IC is hashed and masked at extract; the clear value never reaches a v2 table, a log, a report or `etl_rejects` (DB dump + log-capture test). `faith` is dropped (Q7).
4. `pegawai_ppd` accounts receive `user_scopes` derived from the officer's school (district) per D31a; accounts that cannot be derived are listed in the report (count and ids only).
5. Orphans (users pointing to missing schools, rosters to missing users) are quarantined in `etl_rejects` (`ORPHAN_PARENT`) and counted; no row is silently dropped: for every table `source = loaded + rejected` (reconciliation test).
6. Dry-run writes nothing outside `etl_*`; `--apply` twice in a row changes nothing (row counts and a content hash); `--apply` without a passing dry-run on the same input hash exits non-zero (BE-34 behaviour).
7. The roster seed JSON files of the old reference repo are never read or copied (they may contain real data); a test fails if any such path is referenced in `apps/api/src/migration/**`.
8. Migrated and seeded data coexist: ids never collide, seeds do not touch `legacy_source = 'cloud'` rows (test loads fixtures, then runs `be:db:seed`, and counts rows).

## Test commands

```
npm run be:test -- apps/api/test/migration/core
npm run be:verify
npm run migrate:core -w @pp/api -- --dry-run     # against fixtures only
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green. Paste the real tail of the output in the PR.
3. This card has no HTTP endpoints, so it adds no conformance scenarios; after BE-31 merges, `npm run be:test -- apps/api/test/conformance` must still pass.
4. This card creates no tables; the migration-first checklist (plan section 14.9) does not apply, but no change may break `npm run be:lint:migration` (once BE-34 is merged).
5. Label `security-review` on the PR; list the security decisions and the tests that prove them.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. OD-10: answers to Q1 to Q3 and Q6 of `v2-data-migration.md` section 7 are needed before an `--apply` on real data; with fixtures use the documented defaults and list each default relied on in the PR.
2. `settings`, `packages` and similar system tables have no v2 owner card yet (Sistem stores are backlog). Working assumption: skip them and list them in the reconciliation report as not migrated.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-28 (migration-etl-core). Work in this repo clone on branch be/BE-28-migration-etl-core, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-28-migration-etl-core.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-28 following docs/architecture/v2-data-migration.md exactly (do not redesign). Use the BE-34 etl_* tables and upsertByLegacy helper and legacy_source/legacy_id columns; do not create migration_* tables or legacy_cloud_id columns. Use the open-question defaults of its section 7 only where noted and list each default you relied on in the PR. Never write to the source, never log personal data, never store plaintext passwords or IC. Everything is tested with synthetic fixtures. Needs a security review.
```
