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

- `docs/architecture/v2-data-migration.md` sections 2 (mapping), 4.0 to 4.2, 4.8, 5 (risks: passwords, IC, faith, rosters, orphans), 6.1 steps 1 and 2, 7 (Q1 to Q8)
- `docs/requirements/v2-cloud-gap.md`
- v2 schema from BE-03, 05, 08, 17, 25 (`apps/api/prisma/schema/*.prisma`)
- BE-27 outputs (`staging_cloud`, profile report)

## Outputs

- `apps/api/src/migration/transform/{reference,users,classes,subscriptions}.ts`: one module per group with an explicit **mapping table per enum column** (values from the profile report; unknown values go to `migration_rejects`, never guessed)
- `apps/api/src/migration/load/**`: batched `COPY`/insert, per-table checkpoint in `migration_runs`, idempotent upsert by `legacy_source` + `legacy_id`
- `apps/api/prisma/schema/migration.prisma` + migration: `migration_runs`, `migration_rejects`, `migration_id_map`
- CLI: `migrate:core --dry-run | --apply`
- Reconciliation report: source count, loaded, rejected, per table
- Tests with synthetic fixtures under `apps/api/test/migration/core/**`

## Endpoints

None.

## DB tables touched

v2: `users`, `user_roles`, `user_scopes`, `schools`, `school_subscriptions`, `parent_links`, `classrooms`, `enrolments`, `education_levels`, `subjects`, `chapters`, `topics`, `settings`. Reads `staging_cloud.*`.

## Acceptance criteria

1. Each .cloud account becomes a v2 user with a one-item role list; role mapping uses the seven .cloud codes; an unknown role value goes to `migration_rejects`, not to a default role.
2. Password hashes: `$2y$` copied as bcrypt-compatible; non-bcrypt hashes flagged `must_reset_password`; accounts with the known shared roster default hash (detected by hash equality computed at runtime from a value passed by the lead, never stored in the repo) are flagged `must_reset_password`. No plaintext anywhere; Sanctum tokens and `remember_token` are not migrated.
3. IC: hashed and masked at extract, the clear value never reaches a v2 table, a log or the reject table. `faith` is dropped (Q7).
4. `pegawai_ppd` accounts receive `user_scopes` derived from the officer's school (district) per D31a; accounts that cannot be derived are listed in the report.
5. Orphans (users pointing to missing schools, rosters to missing users) are quarantined and counted; nothing is silently dropped.
6. Dry-run makes no writes; apply twice in a row changes nothing (idempotent); reconciliation counts add up (loaded + rejected = source).
7. The roster seed JSON files of the old reference repo are never read or copied (they may contain real data).
8. Migrated and seeded data can coexist (legacy ids do not collide with identity ids).

## Test commands

```
npm run be:test -- apps/api/test/migration/core
npm run be:verify
npm run migrate:core -- --dry-run     # against fixtures only
```

## Programme update (2026-10-19)

- Programme update: use `legacy_source` + `legacy_id` (text) instead of `legacy_cloud_id`, and the `etl_runs`, `etl_checkpoints`, `etl_id_map`, `etl_rejects`, `etl_recon` tables of BE-34 instead of defining `migration_*` tables. Implement the matrix rows marked BE-28 in plan section 14.7.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-28 (migration-etl-core). Work in this repo clone on branch be/BE-28-migration-etl-core, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-28-migration-etl-core.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-28 following docs/architecture/v2-data-migration.md exactly (do not redesign). Use the open-question defaults of its section 7 only where noted and list each default you relied on in the PR. Never write to the source, never log personal data, never store plaintext passwords or IC. Everything is tested with synthetic fixtures. Needs a security review.
```
