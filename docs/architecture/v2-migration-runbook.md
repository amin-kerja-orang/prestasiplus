# v2 migration runbook: .cloud staging and profiling (BE-27)

- **Status:** first stage only (staging load and profiling). BE-28 to BE-30 append their stages here.
- **Scope:** `prestasiplus.cloud` is the only source. `staging_my` is a named, empty extension point (OD-13).
- **Design:** `docs/architecture/v2-backend-plan.md` section 14, `docs/architecture/v2-data-migration.md`.

## 0. Rules that never change

1. **Dumps are not committed.** `.migration-out/`, `*.dump` and `*.sql.gz` are git-ignored (BE-34), and a CI step fails when one is tracked or when any file under `apps/api/test/migration/` is over 1 MB.
2. **Dumps are not attached to pull requests**, issues, chat or CI artifacts. They travel out-of-band from the lead only (OD-2).
3. **Dumps are deleted after the rehearsal.** Delete the dump directory, the restored database, and `.migration-out/` once the rehearsal report is accepted (section 5).
4. **Nobody connects to prestasiplus.cloud or prestasiplus.my from a development machine.** There are no credentials in the repo, in `.env.*` examples, in tests or in logs. The loader reads either a dump directory or a restore of the anonymised dump that the lead provides.
5. **Profile reports hold aggregates only.** No name, e-mail, phone, IC number, username or free text. Still, keep them under `.migration-out/` and out of PRs; share counts in the PR text, not files.

## 1. Inputs

`staging:load` takes exactly one input.

| Input | How | Notes |
|---|---|---|
| Dump directory | `--from <dir>` | The format below. The synthetic fixture `apps/api/test/migration/fixtures/cloud-tiny/` is one. |
| Read-only database | `CLOUD_SOURCE_URL` (+ optional `--source-schema`, default `public`) | A PostgreSQL restore of the anonymised dump. The role **must be read-only**; the loader refuses otherwise (section 3). |

The target is `DATABASE_URL` (a scratch database, never a database that serves the API): `staging_cloud` and `archive_cloud` are dropped and recreated in it on every run.

### Dump directory format `pp-staging-dump/1`

Working format until OD-2 is answered; the lead confirms or replaces it when the real anonymised dump is produced (BE-35 emits the same shape).

- `manifest.json`: `{ "format": "pp-staging-dump/1", "source": "cloud", "tables": { "<table>": { "rows": <n>, "file": "<table>.ndjson" } } }`. `file` is required when `rows` is above 0 and must be a plain file name.
- `<table>.ndjson`: one JSON object per line, keys are the .cloud column names, SQL NULL is JSON `null`, json columns are nested JSON, timestamps are ISO 8601, dates are `YYYY-MM-DD`.
- Table names are the final .cloud names (`exam_papers` is the canonical paper table; the old one is `teacher_reference_papers`).
- The loader checks rows read against the manifest and fails on a mismatch. A table missing from the manifest is created empty and reported as absent.

## 2. Stages

Run from the repository root. `npm run staging:* -w @pp/api -- <flags>`.

| Stage | Command | Result |
|---|---|---|
| Regenerate DDL (developers only) | `npm run staging:ddl -w @pp/api` | Rewrites `apps/api/src/migration/ddl/staging_cloud.sql` from `ddl/spec.ts`. A test fails if they differ. |
| Load | `npm run staging:load -w @pp/api -- --from <dump dir>` or `CLOUD_SOURCE_URL=... npm run staging:load -w @pp/api` | 83 tables in `staging_cloud`, 35 question-bank tables in `archive_cloud`, one transaction. Repeatable. |
| Profile | `npm run staging:profile -w @pp/api -- --out <path containing .migration-out>` | `profile-<date>.md` and `.json` (default `./.migration-out`). |

Flags of `staging:load`: `--source cloud` (`my` is accepted as a name and refused as not implemented), `--allow-extra-columns` (see below), `--source-schema <name>`.

Exit codes: 0 ok, 1 failed, 2 usage or configuration error, 3 the source role can write (nothing was read).

Behaviour to know:

- **Raw mirror.** Types are permissive (`text`, `bigint`, `numeric`, `timestamptz`, `date`, `jsonb`); the only constraint is the primary key, so orphans and duplicates load and are counted by the profile. Pivot tables have no key at all. Each row also gets `_loaded_at` and `_row_hash`.
- **Strict columns.** A dump column that `staging_cloud.sql` does not define fails the load and names the column (never a value). Extend `ddl/spec.ts`, run `staging:ddl`, review the diff. `--allow-extra-columns` drops them with a warning. The column lists in the spec come from `v2-data-migration.md`; they are completed against the first real schema export.
- **Atomic.** A failed load rolls back and leaves the previous staging schemas as they were.
- **Messages.** Errors carry table names, column names, counts and SQLSTATE codes. A database message that could echo a value is never printed.

## 3. The read-only source

`CLOUD_SOURCE_URL` is the only way the tools reach a database holding .cloud data. On connect, before any table is read, the loader checks the connected role and aborts with exit code 3 when it has any of:

- superuser, `CREATEDB` or `CREATEROLE`;
- `CREATE` on the database or on a non-system schema;
- `INSERT`, `UPDATE` (also on a single column), `DELETE` or `TRUNCATE` on any relation outside the system schemas.

Reads then run inside `BEGIN READ ONLY`. The source must not be the target database. Create the role like this on the restored copy (placeholder values only):

```sql
create role pp_staging_reader login password '<generate and keep outside the repo>';
grant connect on database <restored_db> to pp_staging_reader;
grant usage on schema public to pp_staging_reader;
grant select on all tables in schema public to pp_staging_reader;
```

## 4. Reading the profile

Per table: row count; null ratio per column; for enum-like columns the distinct values with counts (first 50, and the total distinct count); orphan count for each declared foreign key; duplicates for `users.email` (case-insensitive) and `(school_id, username)`; histogram of password-hash prefixes (`$2y$`, `$argon2id$`, `(other)`, `(empty)`, `(null)`). The enum lists feed the mapping tables of BE-28 and BE-29 (`UNKNOWN_ENUM` rejects). An enum value that looks personal (contains `@`, 7 or more digits in a row, or over 40 characters) is shown as `[masked]`.

## 5. Cleaning up after the rehearsal

1. Drop the staging schemas: `drop schema staging_cloud cascade; drop schema archive_cloud cascade;` (or drop the scratch database).
2. Delete the dump directory and any restored read-only database, and the encrypted copy you received, from every machine and backup.
3. Delete `.migration-out/`.
4. Confirm to the lead that the data is gone.

## 6. Known gaps (BE-27)

- OD-2 (how real data reaches the programme) is open: everything is built and tested against the synthetic fixture. The `pp-staging-dump/1` format and the PostgreSQL restore route are working assumptions.
- A direct MySQL connection is not supported; the production database is MySQL, so the lead restores or converts the anonymised dump to PostgreSQL (or to the NDJSON directory) first.
- The nine lookup tables of the canonical question model are not copied (not migrated, no archive need identified).
