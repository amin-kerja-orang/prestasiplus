# v2 migration runbook: .cloud staging and profiling (BE-27)

- **Status:** first stage only (staging load and profiling). BE-28 to BE-30 append their stages here.
- **Scope:** `prestasiplus.cloud` is the only source. `staging_my` is a named, empty extension point (OD-13).
- **Design:** `docs/architecture/v2-backend-plan.md` section 14, `docs/architecture/v2-data-migration.md`.

## 0. Rules that never change

1. **Dumps are not committed.** `.migration-out/`, `*.dump` and `*.sql.gz` are git-ignored (BE-34), and a CI step fails when one is tracked or when any file under `apps/api/test/migration/` is over 1 MB.
2. **Dumps are not attached to pull requests**, issues, chat or CI artifacts. They travel out-of-band from the lead only (OD-2).
3. **Dumps are deleted after the rehearsal.** Delete everything listed in section 6 once the rehearsal report is accepted, and in any case within the maximum retention period below.
4. **Maximum retention (decided by the lead):** 30 days for synthetic fixtures and profiling artefacts. **Real data dumps (BE-28, BE-30) are deleted as soon as the load and the reconciliation succeed, and kept 7 days at most**, encrypted at rest, whichever comes first. The **custodian is the lead**: the lead issues the dump, keeps the list of every machine that holds a copy, and confirms the deletion.
5. **Full-disk encryption at rest is required** on every machine, volume or server that holds a dump, a restored database, a staging database or a report. Without it, do not load the data.
6. **Nobody connects to prestasiplus.cloud or prestasiplus.my from a development machine.** There are no credentials in the repo, in `.env.*` examples, in tests or in logs. The loader reads either a dump directory or a restore of the anonymised dump that the lead provides.
7. **Do not type a connection string with a password on the command line** or into shell history. Put `CLOUD_SOURCE_URL` in a file readable only by you (for example `chmod 600 .env.migration`, git-ignored, outside the repo if you can) and load it from there: `set -a; . ./.env.migration; set +a`. Never `export CLOUD_SOURCE_URL=...` by hand and never echo it.
8. **A suspected PDPA incident is reported to the lead immediately** (a dump or report sent to the wrong place, a copy on an unencrypted disk, a credential in a log or chat, a copy that outlived the retention period). Do not try to clean up first and report later.
9. **Profile reports hold aggregates only.** No name, e-mail, phone, IC number, username or free text. Still, keep them under `.migration-out/` and out of PRs; share counts in the PR text, not files.

## 1. Inputs

`staging:load` takes exactly one input.

| Input | How | Notes |
|---|---|---|
| Dump directory | `--from <dir>` | The format below. The synthetic fixture `apps/api/test/migration/fixtures/cloud-tiny/` is one. |
| Read-only database | `CLOUD_SOURCE_URL` (+ optional `--source-schema`, default `public`) | A PostgreSQL restore of the anonymised dump. The role **must be read-only** (section 3). A host that is not loopback (the URL host and any `host=` parameter are both judged) needs `?sslmode=require` or `?sslmode=verify-full` in the URL, otherwise the loader refuses. **Use `sslmode=verify-full` for any real remote source**: `require` encrypts but does not check who answers. |

The target is `DATABASE_URL`: a scratch database, never one that serves the API. `staging_cloud` and `archive_cloud` are dropped and recreated in it on every run, so `staging:load` refuses unless **all three** hold (it aborts before any DDL, prints the reasons and exits with code 4; the check runs before the source connection is opened):

1. the database name ends in `_staging`, or is listed in `PP_STAGING_DB_ALLOWLIST` (comma separated);
2. `PP_ALLOW_STAGING_RESET=1` is set;
3. `NODE_ENV` is not `production` or `prod` (any letter case).

Example: create a database `pp_migration_staging`, point `DATABASE_URL` at it and run with `PP_ALLOW_STAGING_RESET=1`.

### Dump directory format `pp-staging-dump/1`

Working format until OD-2 is answered; the lead confirms or replaces it when the real anonymised dump is produced (BE-35 emits the same shape).

- `manifest.json`: `{ "format": "pp-staging-dump/1", "source": "cloud", "tables": { "<table>": { "rows": <n>, "file": "<table>.ndjson" } } }`. `file` is required when `rows` is above 0 and must be a plain file name. Every entry must be an object.
- `<table>.ndjson`: one JSON object per line, keys are the .cloud column names, SQL NULL is JSON `null`, json columns are nested JSON, timestamps are ISO 8601, dates are `YYYY-MM-DD`.
- Table names are the final .cloud names (`exam_papers` is the canonical paper table; the old one is `teacher_reference_papers`).
- The loader checks rows read against the manifest and fails on a mismatch. A table missing from the manifest is created empty and reported as absent.

## 2. Stages

Run from the repository root. `npm run staging:* -w @pp/api -- <flags>`.

| Stage | Command | Result |
|---|---|---|
| Regenerate DDL (developers only) | `npm run staging:ddl -w @pp/api` | Rewrites `apps/api/src/migration/ddl/staging_cloud.sql` from `ddl/spec.ts`. A test fails if they differ. |
| Load | `npm run staging:load -w @pp/api -- --from <dump dir>` or, with `CLOUD_SOURCE_URL` set from the restricted file, `npm run staging:load -w @pp/api` | 83 tables in `staging_cloud`, 35 question-bank tables in `archive_cloud`, one transaction. Repeatable. |
| Profile | `npm run staging:profile -w @pp/api -- --out <path containing .migration-out>` | `profile-<date>.md` and `.json` (default `./.migration-out`). |

Flags of `staging:load`: `--source cloud` (`my` is accepted as a name and refused as not implemented, anything else is a usage error), `--allow-extra-columns` (see below), `--source-schema <name>`. The load always replaces **both** schemas with all tables: there is no partial load or partial rerun, and `--tables` is refused on `staging:load` (usage error, exit 2). To redo a load, run it again in full. `staging:profile` accepts `--tables a,b` to profile only those tables (no duplicates).

Exit codes: 0 ok, 1 failed, 2 usage or configuration error, 3 the source role can write (nothing was read), 4 the destructive-reset guard refused (nothing was changed).

Behaviour to know:

- **Raw mirror.** Types are permissive (`text`, `bigint`, `numeric`, `timestamptz`, `date`, `jsonb`); the only constraint is the primary key, so orphans and duplicates load and are counted by the profile. Pivot tables have no key at all. Each row also gets `_loaded_at` and `_row_hash`.
- **Strict columns.** A dump column that `staging_cloud.sql` does not define fails the load and names the column (never a value; a name that is not a plain identifier is only counted). Extend `ddl/spec.ts`, run `staging:ddl`, review the diff. `--allow-extra-columns` drops them with a warning. The column lists in the spec come from `v2-data-migration.md`; they are completed against the first real schema export.
- **Data minimisation.** `users.remember_token` and `users.parent_invite_token` are written as NULL at load time (columns marked `redact` in `ddl/spec.ts`); the secret values never reach staging. Non-secret invite metadata (recipient link in `parent_student`, school, dates, status) is kept. See the open question for BE-28 in section 7.
- **Atomic.** A failed load rolls back and leaves the previous staging schemas as they were.
- **Messages.** Errors carry table names, column names, counts and SQLSTATE codes. A database message that could echo a value is never printed.

## 3. The read-only source

`CLOUD_SOURCE_URL` is the only way the tools reach a database holding .cloud data. On connect, before any table is read, the loader checks the connected role **and every role it is a member of (also without INHERIT)** and aborts with exit code 3 when it has any of:

- superuser, `CREATEDB` or `CREATEROLE`;
- membership of `pg_write_server_files`, `pg_read_server_files`, `pg_execute_server_program` or `pg_write_all_data`;
- `CREATE` on the database or on a non-system schema;
- `INSERT`, `UPDATE` (also on a single column), `DELETE` or `TRUNCATE` on any relation outside the system schemas;
- `USAGE` or `UPDATE` on any sequence;
- `EXECUTE` on a `SECURITY DEFINER` function in a non-system schema (note: `EXECUTE` is granted to PUBLIC by default, so revoke it or do not create such functions in the restore).

`TEMP` on the database is only reported as a warning, not refused: PostgreSQL grants it to PUBLIC by default, it only creates session-local objects that cannot touch source tables, and the reads run in `BEGIN READ ONLY`. Refusing it would reject every default role for no gain.

The source and the target are compared through the servers (database name plus system identifier, or address and port), so a differently spelled URL for the target database is still refused.

Create the role like this on the restored copy (placeholder values only):

```sql
revoke create on schema public from public;   -- PostgreSQL 14 and older grant CREATE on public to everyone
create role pp_staging_reader login password '<generate and keep outside the repo>';
grant connect on database <restored_db> to pp_staging_reader;
grant usage on schema public to pp_staging_reader;
grant select on all tables in schema public to pp_staging_reader;
```

On PostgreSQL 14 or older the default `PUBLIC` grant `CREATE ON SCHEMA public` makes every role fail the check, so the `revoke` above is required there (PostgreSQL 15 and later do not grant it).

## 4. Reading the profile

Per table: row count; null ratio per column; for enum-like columns the distinct values with counts (first 50, and the total distinct count); orphan count for each declared foreign key; duplicates for `users.email` (case-insensitive) and `(school_id, username)`; histogram of password-hash prefixes (`$2y$`, `$argon2id$`, `(other)`, `(empty)`, `(null)`). The enum lists feed the mapping tables of BE-28 and BE-29 (`UNKNOWN_ENUM` rejects).

An enum value is shown only if it matches `^[A-Za-z0-9_.:/-]{1,40}$` and contains at most 4 digits in total; every other value is shown as `[masked]`. This is deliberately strict: a multi-word value such as a state name with a space is masked too, so for such columns the report gives counts only. If the mapping tables need those spellings, the lead reads them from the data directly.

Report files are written with mode 0600 in a 0700 directory, only under a `.migration-out` folder that sits inside the working directory or the repository root (symbolic links are resolved first, and an existing report that is a symbolic link is refused).

Known precision limits of the numbers:

- On the PostgreSQL source path (`CLOUD_SOURCE_URL`) ids travel as JSON numbers, so a `bigint` id above 2^53 (9,007,199,254,740,991) would lose precision. .cloud ids are auto-increment and far below that; if a larger id ever appears, use the dump directory with ids written as exact JSON numbers or strings, and tell the lead.
- The `(school_id, username)` duplicate check groups rows whose `school_id` is NULL together, whereas MySQL's unique index treats NULLs as distinct. The count can therefore be higher than what MySQL considers a violation; read it as "same username without a school".

## 5. Cleaning up after the rehearsal

Delete all of the following, then confirm to the lead that the data is gone:

1. The staging schemas: `drop schema staging_cloud cascade; drop schema archive_cloud cascade;`, or better, drop the whole scratch database.
2. The dump directory, the encrypted dump file you received, and any restored read-only database.
3. **Write-ahead log (WAL) and backups:** archived WAL, base backups, snapshots and replicas of the server that held the data. Dropping a table does not remove it from them.
4. **Temporary and spill files:** the restore tool's temp directory, database `temp_tablespaces`, editor swap or recovery files, shell history that contains a URL, and the recycle bin / trash.
5. `.migration-out/` and any report copied elsewhere.
6. The restricted file that held `CLOUD_SOURCE_URL`, and the `pp_staging_reader` role.

## 6. Retention and custody (summary)

30 days for synthetic and profiling artefacts, 7 days at most (and deleted as soon as load and reconcile succeed) for real dumps, custodian is the lead, encrypted disks only (section 0). The lead keeps the list of copies and signs off the deletion in section 5.

## 7. Decisions and open questions (BE-27)

Decided by the lead:

1. **Retention:** see section 0, rule 4.
2. **Masked place names:** multi-word state or district names are masked in the profile (section 4). This over-masking is accepted for now. **Open for later:** add a state/district allowlist, because these are public geographic anchors, not personal data.
3. **Pending parent invites (BE-28):** re-issue them with a new token during the ETL; never carry the legacy token. Staging stores `parent_invite_token` as NULL by design, so the ETL cannot copy it even by mistake. BE-28 picks which pending invites to re-issue from the non-secret metadata (recipient, school, created and expiry dates, status).
4. **Column lists:** the table spec follows `v2-data-migration.md` section 1 only and will be completed after a real schema export. Accepted.
5. **No direct MySQL source:** the only routes are NDJSON dumps (`pp-staging-dump/1`) or a PostgreSQL restore. There is no live MySQL connection, and none will be added.
6. **Duplicate e-mail check:** case-insensitive (MySQL collation). Confirmed.

Still open or assumed:

- OD-2 (how real data reaches the programme) is open: everything is built and tested against the synthetic fixture. The `pp-staging-dump/1` format and the PostgreSQL restore route are working assumptions.
- The nine lookup tables of the canonical question model are not copied (not migrated, no archive need identified).

## 8. Lead: producing an anonymised dump (BE-35)

Only the lead runs the anonymiser on real data (OD-18), on the lead's PC, on an encrypted disk. Developers and agents never do; they use the synthetic fixtures of section 9. The tool is built and tested against synthetic data only.

**What it does.** It reads the raw .cloud data (a dump directory in the `pp-staging-dump/1` format, or a read-only restore through `CLOUD_SOURCE_URL`) and writes a new `pp-staging-dump/1` directory that `staging:load` takes as it is. Structure, ids, foreign keys, enum values, dates, null ratios and row counts are kept; every personal value is replaced:

| Rule | Used for | Result |
|---|---|---|
| `pseudonym:name` / `org` | person names, school and company names | `Nama Anon <TOKEN>` / `Organisasi Anon <TOKEN>` |
| `pseudonym:email` | e-mail | `anon-<token>@example.test` (reserved domain). Case-insensitive: the case variants of one address stay one address. |
| `pseudonym:phone` | phone | `00` + 9 digits (a domestic Malaysian number never starts with `00`) |
| `pseudonym:ic` | IC number | `YY00DD-00-NNNN` (month 00 and place code 00 do not exist). The NRIC has no check digit, so the shape is made invalid instead. |
| `pseudonym:username` / `code` / `opaque` / `ip` | usernames, join and referral codes, Google ids and visitor ids, IP addresses | fakes of the same kind; IPs come from the documentation ranges |
| `hash-password-dummy` | `users.password` | the hash of the documented dummy password `Demo1234`, keeping the hash class (`$2y$`/`$2b$` bcrypt, argon2id; plain text becomes `not-a-hash-anonymised`; NULL and empty stay as they are) |
| `null` | `remember_token`, `parent_invite_token` | NULL (BE-27 M4) |
| `scrub-text` | tickets, notes, mood notes, chat, comments, setting values, json answers | `Teks anonim.` (json keeps its shape; numbers and booleans stay) |
| `keep` | ids, foreign keys, enums, numbers, dates, public content | unchanged |

The same input and key always give the same fake, in every table, so relations, duplicates and uniqueness survive. Another key gives other fakes. NULL stays NULL and an empty string stays empty, so null ratios are unchanged. Timestamps and date-only columns are kept as they are (day-boundary logic needs them).

**The rules are default deny.** `apps/api/src/migration/anonymise/anon.config.json` lists a rule for every column of `ddl/spec.ts`. A column without a rule (for example after the spec grows) makes the tool exit 4 before it reads a single row, and names the column. A column in the input that the DDL does not have fails the run too. Review the file before the first real run (section 11).

**The key.** `ANON_HMAC_KEY` (at least 32 characters) or `ANON_HMAC_KEY_FILE` (a file outside the repository, mode 600). Without a key the tool refuses to run. The key is never written to the repository, a log line, an output file, a chat or a PR. Create it once per rehearsal, for example `head -c 48 /dev/urandom | base64 > ~/pp-anon.key; chmod 600 ~/pp-anon.key`. Keep it on the encrypted disk only as long as the rehearsal needs the same fakes (a second run with the same key reproduces the same dump); delete it with the dump (section 10).

**Steps.**

1. Put the raw dump or restore on the lead PC. It never enters the repository (`.migration-out/`, `*.dump` and `*.sql.gz` are git-ignored and a CI step fails on them).
2. From the repository root, for a dump directory: `ANON_HMAC_KEY_FILE=<path> npm run anonymise:run -w @pp/api -- --source <raw dump dir> --out <path inside a .migration-out folder>/anon-<date>`. For a read-only restore: set `CLOUD_SOURCE_URL` from a restricted file (rule 7 of section 0), then use `--source pg` (a connection string on the command line is refused). The source role must be read-only (section 3). The tool never writes to the source.
3. The output directory must be new and empty, inside a `.migration-out` folder (the same guard as the profile report), and not inside the source. Files are written with mode 600.
4. The tool then **scans its own output** (leak scan): any e-mail other than `example.test`, any Malaysian mobile or landline number, any 12-digit IC with a valid date, and any original value it replaced (looked up by salted hash: whole values, and multi-word names inside longer text) fails the run with exit 5, names `table.column` and the kind, and **deletes the output**. If a kept column holds personal data, change its rule in the config to `scrub-text`, `null` or a pseudonym and run again; never edit the output by hand.
5. Check the result: `npm run anonymise:scan -w @pp/api -- --dir <output>` (patterns only), then `staging:load --from <output>` and `staging:profile` on a scratch `_staging` database (section 2). The profile should show the same orphans, duplicates and hash classes as the raw data would.
6. Hand over out-of-band and encrypted (for example a passphrase-protected archive from a tool you trust, the passphrase sent by a different channel). Never GitHub, never a PR, issue or chat attachment, never a CI artifact. Share counts in text, not files.

The log carries table names and counts only. Exit codes: 0 ok, 1 failed, 2 usage or configuration (also no key), 3 the source role can write, 4 default deny, 5 leak scan.

## 9. Developers: using fixtures (BE-35)

Everyone except the lead works on synthetic data. `fixtures:generate` writes a .cloud-shaped dump (`pp-staging-dump/1`, every table of `ddl/spec.ts` in the manifest) that `staging:load` takes as it is:

```
npm run fixtures:generate -w @pp/api -- --size tiny|small|medium --seed 7 [--out <dir>]
```

| Size | Users | Use |
|---|---|---|
| `tiny` | 100 | unit tests; the committed sample is `apps/api/test/migration/fixtures/tiny/` (seed 1, under 1 MB; a test regenerates it and compares) |
| `small` | 1,500 | CI and local checks (`test/migration/fixtures/staging.spec.ts` loads it and profiles it) |
| `medium` | 20,000 | local ETL timing |

Default output: `.migration-out/fixtures/<size>-<seed>`. The only other allowed place is a directory under `apps/api/test/migration/fixtures/` (and there no file may be over 1 MB). The same size and seed give byte-identical files. Everything is obviously fictitious (`Murid Contoh 00001`, `@contoh.invalid`, phones starting `00`, filler password hashes); a test checks the shapes and a deny-list of common real name words.

The generator plants the nasty cases on purpose and writes `anomalies.json` next to the dump (what was planted, and what a scan of the rows finds): orphans (`users.school_id`, `users.referred_by`, attempts without their legacy question or session, roster and parent rows without parents), case-variant and exact duplicate e-mails, duplicate `(school_id, username)`, unknown enum values (`users.role`, `coin_transactions.type`, `practice_sessions.mode`), non-bcrypt hashes (`$2b$`, argon2id, plain text, empty, NULL) and a shared default hash, roster users without e-mail, date-only edges (a stored UTC date one day before the Malaysia date, including exactly 00:00 Malaysia), referral cycles and self references, duplicate pivot rows, and the secrets the loader must drop. The BE-27 profiler reports the same counts (a test compares them).

To load and profile a fixture: create a scratch database whose name ends in `_staging`, then `PP_ALLOW_STAGING_RESET=1 DATABASE_URL=<scratch> npm run staging:load -w @pp/api -- --from .migration-out/fixtures/small-7` and `npm run staging:profile -w @pp/api`. To regenerate the committed sample after a generator change: `npm run fixtures:generate -w @pp/api -- --size tiny --seed 1 --out apps/api/test/migration/fixtures/tiny`.

Never put real data, a real name, a dump or a key in a fixture, a test or a PR.

## 10. Deleting dumps (BE-35)

Everything the anonymiser touches is deleted after the rehearsal. In addition to section 5:

1. The **raw dump or restore** the lead used as the source, and the `pp_staging_reader` role.
2. The **anonymised output directory**, the encrypted archive that was shared, and every copy that anyone received. Treat an anonymised dump as real data for retention: it is pseudonymised, not anonymous, because the lead holds the key. Keep it 7 days at most and delete it as soon as the load and the reconciliation succeed (section 0, rule 4).
3. The **key file** (`ANON_HMAC_KEY_FILE`) and any shell history or environment that held `ANON_HMAC_KEY`. Deleting the key makes the fakes permanently unlinkable to the people.
4. Every staging database and report made from the dump (section 5, items 1 to 5).
5. Synthetic fixtures under `.migration-out/fixtures/` may stay up to 30 days; they hold no personal data.

The lead confirms the deletion in writing (section 6).

## 11. Anonymiser: decisions and open points (BE-35)

Working assumptions, for the lead to confirm:

1. **Pseudonymised is treated as personal data** for retention (7 days at most, section 10).
2. **School names and codes are pseudonymised** (`Organisasi Anon`), although schools are public institutions. Set `schools.name` and `schools.code` to `keep` in the config if the ETL needs the real names.
3. **`users.faith` is replaced by a constant** (`tidak_dinyatakan`) as sensitive personal data; the documents do not say the ETL needs it.
4. **Free text is scrubbed, not filtered.** A name inside a free-text column is gone because the whole text is replaced. `settings.value` is scrubbed too (it may hold keys), so numeric settings the ETL might need are lost in the dump.
5. **Leak-scan precision.** Single words of a name are not matched alone (common words and surnames would flag public content); whole values and multi-word names are. A kept column that contains a phone, IC or e-mail shape fails the run even if it is harmless (fail closed).
6. **Phone and IC shapes** follow Malaysian formats; a foreign number in a kept column would not be recognised by the patterns, only by the original-value lookup.
7. **Json keys** are kept (only string values are scrubbed). If a json column ever carries personal data in its keys, give it `null`.
8. The column lists come from `ddl/spec.ts`, which will be completed against the first real schema export (section 7, item 4): re-check the config then (the tool refuses until every new column has a rule).
