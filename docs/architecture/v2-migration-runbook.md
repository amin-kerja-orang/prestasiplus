# v2 migration runbook: .cloud staging and profiling (BE-27)

- **Status:** first stage only (staging load and profiling). BE-28 to BE-30 append their stages here.
- **Scope:** `prestasiplus.cloud` is the only source. `staging_my` is a named, empty extension point (OD-13).
- **Design:** `docs/architecture/v2-backend-plan.md` section 14, `docs/architecture/v2-data-migration.md`.

## 0. Rules that never change

1. **Dumps are not committed.** `.migration-out/`, `*.dump` and `*.sql.gz` are git-ignored (BE-34), and a CI step fails when one is tracked or when any file under `apps/api/test/migration/` is over 1 MB.
2. **Dumps are not attached to pull requests**, issues, chat or CI artifacts. They travel out-of-band from the lead only (OD-2).
3. **Dumps are deleted after the rehearsal.** Delete everything listed in section 6 once the rehearsal report is accepted, and in any case within the maximum retention period below.
4. **Maximum retention (decided by the lead):** 30 days for synthetic fixtures and profiling artefacts. **Real data dumps (BE-28, BE-30) are deleted as soon as the load and the reconciliation succeed, and kept 7 days at most**, encrypted at rest, whichever comes first. The **custodian is the lead**: the lead issues the dump, keeps the list of every machine that holds a copy, and confirms the deletion.

   **Exception (Q12 A): `archive_cloud` is kept 12 months** after the cutover, although it is real data. Purpose: the question backfill and disputes only (data-migration section 3.3, item 5). Conditions, all required: (a) a **dated deletion** at cutover + 12 months, recorded as a dated line in the issue (no data), with the date written down at the cutover; (b) access only for a **named role with a read-only grant** (`SELECT` on the schema), never an application role, and nothing in the API reads it; its access is **logged** (`log_connections` and statement logging or `pgaudit` for that role), the logs are kept per the security policy and **reviewed monthly**; (c) **encrypted backups only**, and the schema is dropped from every backup chain at the deletion date (section 5, item 3); (d) **never copied to a non-production database**, a laptop, a fixture or a PR; (e) the rest of rule 4 (dumps, `staging_cloud`, reports) is unchanged. Tables that hold personal references (the five minimised below): `question_reports` (`user_id`, `reason`), `question_submissions` (`user_id`), `question_imports` (`user_id`), `spm_sets` (`user_id`), `teacher_reference_documents` (`user_id`).
   **Minimisation of those tables: Decided (LEAD, 22 Oct, #109).** After the open reports are exported, reviewed by hand and handed over (section 17a, items 1 to 6), the operator runs `migrate:archive-minimise` (section 17a, item 1a): `user_id` becomes NULL in the five user-linked tables above, `question_reports.reason` becomes NULL, and `_row_hash` is nulled as well. After the apply, `reason` exists only in the hand-over CSV. The backfill and disputes need the question rows, not the reporter, so nothing the exception is meant for is lost. The command is refused before the export has run. **The `question_submissions` CSV of section 17a is kept** (LEAD decision, 22 Oct), with the same retention and access as the dump: outside GitHub, deleted with the dump copies within 7 days.
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
| `pseudonym:phone` | phone | `00` + 13 digits (a domestic Malaysian number never starts with `00`). `+60 12-345 6789` and `012-3456789` are the same person and get one fake. |
| `pseudonym:ic` | IC number | `YY00DD-00-NNNN` (month 00 and place code 00 do not exist). The NRIC has no check digit, so the shape is made invalid instead. Only 8 digits are free, so a collision is resolved by a deterministic re-hash (same input, same fake, within a run and across runs over the same source order); the run aborts only after 50 failed attempts in a row. |
| `pseudonym:username` / `code` / `opaque` / `ip` | usernames, join and referral codes, Google ids, visitor ids, client uuids, battle tokens, audit subject ids, IP addresses | fakes of the same kind; IPs come from the documentation ranges |
| `pseudonym:path` | upload paths (`media_assets.path`, `paper_documents.path`, `paper_document_pages.image_path`, `banners.image_path`, `audio_kbat.audio_path`, `teacher_reference_documents.path`) | `files/<20 letters and digits>.<extension of the original>` |
| `hash-password-dummy` | `users.password` | **Only for the roles `pelajar`, `guru`, `ibu_bapa`** (config key `dummyPasswordRoles`): the hash of the documented dummy password `Demo1234`, keeping the hash class (`$2y$`/`$2b$` bcrypt, argon2id; plain text becomes `not-a-hash-anonymised`), so developers can log in as a student, teacher or parent. **Every other role (admin, admin_sekolah, pegawai_ppd, penaja, an unknown role, no role) gets the unusable `not-a-hash-anonymised`**, so the dump never holds a known admin password. NULL and empty stay as they are. |
| `null` | `remember_token`, `parent_invite_token` | NULL (BE-27 M4) |
| `scrub-text` | tickets, notes, mood notes, chat, comments, setting values, json answers | `Teks anonim.` (json keeps its shape; numbers and booleans stay) |
| `keep` | ids, foreign keys, enums, numbers, dates, public content | unchanged |

The same input and key always give the same fake, in every table, so relations, duplicates and uniqueness survive. Another key gives other fakes. NULL stays NULL and an empty string stays empty, so null ratios are unchanged. Timestamps and date-only columns are kept as they are (day-boundary logic needs them).

**The rules are default deny.** `apps/api/src/migration/anonymise/anon.config.json` lists a rule for every column of `ddl/spec.ts`. A column without a rule (for example after the spec grows) makes the tool exit 4 before it reads a single row, and names the column. A column in the input that the DDL does not have fails the run too. Review the file before the first real run (section 11).

**The key.** `ANON_HMAC_KEY_FILE` (a file outside the repository; on POSIX mode 600) or, discouraged, `ANON_HMAC_KEY` (at least 32 characters). **Never pass `ANON_HMAC_KEY` inline on the command line: it ends up in shell history. Use the file form** (the tool warns when the inline form is used). Without a key the tool refuses to run. The key is never written to the repository, a log line, an output file, a chat or a PR.

**The key is NEW for every rehearsal (decided by the lead). Never reuse a key.** This prevents cross-rehearsal de-anonymisation (two dumps made with one key can be joined on their fakes) and limits the damage if one key leaks. Create it, use it for that one rehearsal's dump(s), and delete it with the dump (section 10).

- Linux/macOS: `head -c 48 /dev/urandom | base64 > ~/pp-anon.key; chmod 600 ~/pp-anon.key`
- Windows PowerShell (the lead PC), a file in your user profile on the encrypted disk:

```powershell
$b = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
$f = "$env:USERPROFILE\pp-anon-$(Get-Date -Format yyyyMMdd).key"
New-Item -ItemType File -Path $f | Out-Null                       # 1. an empty file
icacls $f /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null # 2. lock it down BEFORE the key is written
[Convert]::ToBase64String($b) | Set-Content -NoNewline -Path $f    # 3. write the key
$env:ANON_HMAC_KEY_FILE = $f   # this shell only; the key text never appears on a command line
```

On Windows the tool cannot check or set file permissions, so it prints "File permissions are not enforced on Windows; keep the key and the output in your user profile on an encrypted disk." Do exactly that, and keep the `.migration-out` output in your user profile too.

**Steps.**

1. Put the raw dump or restore on the lead PC. It never enters the repository (`.migration-out/`, `*.dump` and `*.sql.gz` are git-ignored and a CI step fails on them).
2. From the repository root, for a dump directory: `ANON_HMAC_KEY_FILE=<path> npm run anonymise:run -w @pp/api -- --source <raw dump dir> --out <path inside a .migration-out folder>/anon-<date>`. For a read-only restore: set `CLOUD_SOURCE_URL` from a restricted file (rule 7 of section 0), then use `--source pg` (a connection string on the command line is refused). The source role must be read-only (section 3). The tool never writes to the source.
3. The output path must not exist yet (or be an empty directory), sit inside a `.migration-out` folder (the same guard as the profile report), and not be inside the source. The tool writes into `<out>.partial` and renames it to `<out>` **only after the leak scan passed**; on any error the `.partial` directory is removed entirely. Files are written with mode 600 (not enforced on Windows). **After any non-zero exit, check that nothing is left**: neither `<out>` nor `<out>.partial` should exist (a hard kill, for example a power cut, can leave a `.partial`; delete it, a stale one is refused on the next run).
4. The tool then **scans its own output** (leak scan): any e-mail other than `example.test`, any Malaysian mobile or landline number, any 12-digit IC with a valid date, and any original value it replaced (looked up by salted hash: whole values, and multi-word names inside longer text) fails the run with exit 5, logs `table.column`, the kind and the hit count, and **deletes the output**. If a kept column holds personal data, change its rule in the config to `scrub-text`, `null` or a pseudonym and run again; never edit the output by hand. If a hit is a harmless coincidence (an original value that legitimately equals a public value in a kept column), the lead may list that column in `leakScan.allow` in the config (`["table.column"]`, empty by default). It tolerates only original-value hits, logs the count, and never silences an e-mail, phone or IC pattern hit.
   The final step (remove an empty `<out>`, then rename `<out>.partial` to `<out>`) is not atomic. If it fails (for example the target is in use, `<out>` is a file, or it is on another volume) the run exits 1, the partial output is deleted and nothing leaks; repeat the run.
   Memory: the originals index holds one salted hash per replaced value (several per name), so it grows with the number of replaced values; on a dump with millions of personal values allow some hundreds of MB of RAM.
5. Check the result: `npm run anonymise:scan -w @pp/api -- --dir <output>` (patterns only), then `staging:load --from <output>` and `staging:profile` on a scratch `_staging` database (section 2). The profile should show the same orphans, duplicates and hash classes as the raw data would.
6. Hand over out-of-band and encrypted (for example a passphrase-protected archive from a tool you trust, the passphrase sent by a different channel). Never GitHub, never a PR, issue or chat attachment, never a CI artifact. Share counts in text, not files.

The log carries table names and counts only. Exit codes: 0 ok, 1 failed, 2 usage or configuration (also no key), 3 the source role can write, 4 default deny, 5 leak scan.

**Where the dump may be loaded.** An anonymised dump carries `"anonymised": true` in its manifest (fixtures carry `"synthetic": true`); its student, teacher and parent accounts have a published dummy password. It must **never be loaded into a non-staging database**. `staging:load` already refuses a database that is not a `_staging` database (or on the allow-list), and now also refuses a dump with either marker when `NODE_ENV` is `production` or `prod` (any case; exit 4, nothing changed). The BE-28 ETL (which reads staging, not the dump) must also refuse to run in production against anonymised or synthetic data (section 11, dependencies).

The production refusal depends on `NODE_ENV` being set to `production` or `prod` (any case) on the host. **If `NODE_ENV` is unset, only the `_staging` database-name guard and `PP_ALLOW_STAGING_RESET` apply.** Always set `NODE_ENV=production` on production hosts. The marker fails closed: an `anonymised` or `synthetic` key with any value other than a strict JSON `false` (`true`, `"true"`, `1`, `"yes"`, an object) counts as marked; only an absent key or `false` is unmarked.

**Linkability.** Ids and timestamps are kept, so they match the raw source: never share the dump with anyone who also has raw data.

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

To check any dump or fixture for personal-looking data without re-running the anonymiser: `npm run anonymise:scan -w @pp/api -- --dir <dump dir>`. For a synthetic fixture add `--allow-email-domains contoh.invalid`, because fixture e-mails use that reserved domain (the scan otherwise accepts only `example.test`). A fixture dump has `"synthetic": true` in its manifest, so `staging:load` refuses it in production.

Never put real data, a real name, a dump or a key in a fixture, a test or a PR.

## 10. Deleting dumps (BE-35)

Everything the anonymiser touches is deleted after the rehearsal. In addition to section 5:

1. The **raw dump or restore** the lead used as the source, and the `pp_staging_reader` role.
2. The **anonymised output directory**, the encrypted archive that was shared, and every copy that anyone received. Treat an anonymised dump as real data for retention: it is pseudonymised, not anonymous, because the lead holds the key. Keep it 7 days at most and delete it as soon as the load and the reconciliation succeed (section 0, rule 4).
3. The **key file** (`ANON_HMAC_KEY_FILE`) and any shell history or environment that held `ANON_HMAC_KEY`. Deleting the key makes the fakes permanently unlinkable to the people. A key is used for one rehearsal only and is never reused (section 8).
   Also delete any `<out>.partial` directory that a failed run left behind.
4. Every staging database and report made from the dump (section 5, items 1 to 5).
5. Synthetic fixtures under `.migration-out/fixtures/` may stay up to 30 days; they hold no personal data.

The lead confirms the deletion in writing (section 6).

For the deletion after the real cutover (including `staging_cloud`, `archive_cloud` and the `etl_*` tables) see section 18.

## 11. Anonymiser: decisions and open points (BE-35)

**Confirmed by the lead (2026-10-20):**

- **OD-2:** the hand-over format is `pp-staging-dump/1` plus a PostgreSQL restore.
- **Retention:** an anonymised dump is treated as real data (pseudonymised, not anonymous): 7 days at most, section 10.
- **Pseudonymised columns:** schools (name and code) are pseudonymised, `users.faith` is a constant (`tidak_dinyatakan`), `settings.value` is scrubbed. **The lead reviews `anon.config.json` before the first real run.**
- **The key is new for every rehearsal and is never reused** (section 8).

**Required review of kept free text (the lead, on the real dump, before sharing).** The kept columns below can hold free text. Rule: **no real person's name may appear in a shared dump.** The lead samples these columns on the real data (and the anonymised output) and looks specifically for REAL PERSONS' NAMES (a teacher, parent or pupil named in a note, comment or title), and changes the rule to `scrub-text` or `null` for any column that has one:
`notes.body`, `notes.title`, `questions.body`, `question_options.body`, `structured_questions.body`, `structured_rubric_points.body`, `pksk_questions.body`, `stimuli.body`, `part_options.body`, `part_answer_keys.value`, `articles.title`, `videos.title`, `banners.title`, `gifts.name`, `teacher_badges.name`, `achievements.name`, `achievements.criteria`, `challenges` and `interventions` free fields (`mood_before`, `mood_after`), `chapters.title`, `topics.name`, `exam_papers.title`, `paper_sections.title`, `paper_blueprints.name`, `blueprint_sections.title`, `users.kelas`, `users.teaching_subject`, `audio_kbat.title`, `banners.target`, `videos.url`, `games.config` (json), `question_snapshots.content` (json), `exam_attempts.section_scores`, `exam_attempts.section_selections` and `exam_attempts.served_composition` (json), `question_attempts.selected_option` (in `ddl/spec.ts` it is plain text, not an enum; it is expected to be an option letter such as A to D, but the spec does not say so, so sample it: a student-typed value would be a leak), plus anything student-written that a future column adds (student notes, feedback and comment text are already scrubbed: `student_notes.*`, `feedback.comment`, `mood_checkins.note`, `support_tickets.*`, `chatbot_messages.body`).

**Dependencies on other cards (open until done):**

- **BE-28 (ETL):** must refuse to run in production when the staging data comes from an anonymised or synthetic manifest (the load records the marker; BE-28 must check it before it writes any v2 table).
- **BE-33 (auth hardening):** refuse a login in production whose stored password hash equals the published dummy hash (the `Demo1234` bcrypt or argon2id hash in `anonymise/passwords.ts`). BE-35 does not touch auth code.
- Open question for the auth owner: should the hash comparison be a startup check that fails when a production database holds the dummy hash, or a login-time refusal, or both?

Decisions and assumptions:
1. **Quasi-identifiers.** Ids and timestamps are kept (relations and day-boundary logic need them), so they match the raw source. Never share the dump with anyone who also has raw data. `practice_sessions.client_uuid`, `audit_logs.subject_id`, `notifications.title` and `notifications.target`, `users.spm_targets` and all upload paths are replaced (path fakes keep the extension).
2. **Privileged passwords.** Only `pelajar`, `guru` and `ibu_bapa` accounts get the usable dummy hash; all other roles get an unusable value (section 8).
3. **Free text is scrubbed, not filtered.** A name inside a free-text column is gone because the whole text is replaced. `settings.value` is scrubbed too (it may hold keys), so numeric settings the ETL might need are lost in the dump.
5. **Leak-scan precision.** Single words of a name are not matched alone (common words and surnames would flag public content); whole values and multi-word names are. A kept column that contains a phone, IC or e-mail shape fails the run even if it is harmless (fail closed).
6. **Phone and IC shapes** follow Malaysian formats; a foreign number in a kept column would not be recognised by the patterns, only by the original-value lookup.
7. **Json keys** are kept (only string values are scrubbed). If a json column ever carries personal data in its keys, give it `null`.
8. The column lists come from `ddl/spec.ts`, which will be completed against the first real schema export (section 7, item 4): re-check the config then (the tool refuses until every new column has a rule).

**Follow-up (recorded, LEAD approved keeping both for now):** BE-27's `test/migration/fixtures/generate-tiny.ts` and `cloud-tiny/` duplicate the BE-35 generator's `tiny` size. Retire them once the BE-27 tests are moved to `tiny/`. The extraction of `prepareOutputDir` in `profile/render.ts` stays.

## 12. Full run and verification (BE-30)

The commands below run on a rehearsal or staging database that holds an imported dump. Run them from the repository root as `npm run <script> -w @pp/api -- <flags>`. The source is always `cloud`. `--dry-run` is the default of every command; no v2 data table is written until `--apply` is given. Dry-runs do write `etl_runs`, `etl_recon` and `etl_rejects` rows and report files under `.migration-out/`.

**Environment (names only; values come from a restricted file or the platform secret store, section 0 rule 7):**

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | all | The rehearsal database. Its name ends in `_staging`. It holds `staging_cloud`, `archive_cloud` and the v2 tables. |
| `CLOUD_SOURCE_URL` | `staging:load` | Only when loading from a read-only restore instead of `--from <dump dir>`. Read-only role (section 3). |
| `PP_ALLOW_STAGING_RESET=1` | `staging:load` | Allows the drop and re-create of the staging schemas (section 1). |
| `PP_STAGING_DB_ALLOWLIST` | `staging:load` | Only if the database name does not end in `_staging`. |
| `PP_ALLOW_MIGRATE_APPLY=1` | `--apply`, `migrate:rollback` | Without it every apply is refused. `migrate:rollback` needs it in dry-run too. |
| `PP_ALLOW_MIGRATE_ROLLBACK=1` | `migrate:rollback` | Extra gate for the rollback, dry-run included, in every environment. Set it only for the rollback command, in that shell. |
| `PP_MIGRATE_TARGET_DB` | `--apply`, `migrate:rollback` | For `--apply`: required when `NODE_ENV` is `production` or `prod`. For `migrate:rollback`: **required in every environment**, dry-run included. Must equal `current_database()`. |
| `IC_HASH_KEY` | `migrate:core` | Else `SESSION_SECRET` outside production. Keep the key stable across the full run and the delta run, otherwise IC hashes differ. |
| `PP_MIGRATE_ROSTER_DEFAULT_HASHES` | `migrate:core` | Optional. The lead's list of shared roster default hashes. Never logged. |
| `NODE_ENV` | all | `production` on a production host, so the anonymised-data and wrong-database guards apply. |
| `PP_GIT_SHA` (or `GIT_SHA`) | `migrate:all`, `migrate:delta`, `migrate:core`, `migrate:activity` | The commit recorded in `etl_runs.git_sha`. Read first; otherwise `git rev-parse HEAD` of the working directory is used. A value that is not 7 to 64 hex characters is ignored. **In a container the runtime image has no `.git` (`.dockerignore`), so `git_sha` is NULL unless it is set:** pass `PP_GIT_SHA=$(git rev-parse HEAD)` of the release checkout into the run (on the VPS through `slot.sh etl`, #166). |

**Sequence.**

| Step | Command | Expected result |
|---|---|---|
| 1. Load | `npm run staging:load -w @pp/api -- --from <dump dir>` | Exit 0. 83 tables in `staging_cloud`, 35 in `archive_cloud` (section 2). |
| 2. Profile | `npm run staging:profile -w @pp/api` | `profile-<date>.md/.json` in `.migration-out/`. Read the orphan, duplicate and enum counts. |
| 3. Dry-run | `npm run migrate:all -w @pp/api -- --as-of=<YYYY-MM-DD>` | Core dry-run, then the activity dry-run only if a core apply on the same staged data exists, otherwise "skipped". No v2 data table is written. |
| 4. Apply | `PP_ALLOW_MIGRATE_APPLY=1 npm run migrate:all -w @pp/api -- --apply --as-of=<same date>` | Per stage, core then activity: a dry-run, then the apply with identical options only if the dry-run succeeded. Stops at the first failed stage. |
| 5. Verify | runs at the end of `migrate:all --apply`; to repeat: `npm run migrate:verify -w @pp/api` | Writes `.migration-out/recon-<runs>-<stamp>.json` and `.md`. Exit 1 unless the status is `pass`. |
| 6. Link (optional) | `npm run migrate:link-questions -w @pp/api` then, after reading it, `-- --apply` | See below. Cutover never waits for it. |

**Content files (BE-29 AC9).** `migrate:all` and `migrate:delta` take `--files-dir=<export dir outside the repo>` and pass it unchanged to the activity dry-run and its apply (section 19). The export's `SHA256SUMS` is part of the activity input hash, and the orchestrator gives the dry-run and the apply the same value. Pass the freeze export to `migrate:delta` too, or files added at .cloud after the first export are not copied. Without the flag no file is migrated and the activity report says `files: not migrated (no --files-dir)`.

**One source lock; which commands to use.** `migrate:all`, `migrate:delta`, `migrate:rollback` and `migrate:link-questions --apply` share an advisory lock `etl:source:<source>`; a second `migrate:all`, `migrate:delta` or `migrate:link-questions --apply` started while the lock is held exits 4, and `migrate:rollback` refuses with exit 2 (no change). The standalone `migrate:core` and `migrate:activity` take the same lock since AM-08 `3f59b61` (they exit 2 when it is held; section 19). The kit runner itself does not, so a script that calls `runCore`/`runActivity` directly bypasses it. Rule: on the rehearsal and production databases operators use **only** `migrate:all` and `migrate:delta` for loading, and never start a load while a rollback runs. `migrate:delta` refuses (exit 2) when the database has no migrated users (for example after a rollback): run `migrate:all --apply` first.

Optional flags of `migrate:all` (and of `migrate:delta`): `--as-of=YYYY-MM-DD` (the day used for date-dependent rules; give the same value in every run of one rehearsal), `--batch-size=N`, `--content-owner=<v2 user id>`, `--out-dir=<.migration-out path>`.

Exit codes (all commands): 0 ok, 1 failed or reconciliation mismatch, 2 usage or guard (for example a missing `PP_ALLOW_MIGRATE_APPLY=1`), 3 apply refused, 4 another run is active.

**Reading the recon report.** One row per entity: `source`, `eligible`, `loaded`, `rejected`, `expected_delta`, `target count`, `status`. Then the checks:

| Check | What to read |
|---|---|
| Users per role per school | Counts equal the eligible users. |
| Answers per subject | The distribution of the migrated answers per subject. |
| Ledger sums | `coin_transactions` sums against wallet balances. **Reported, never corrected** (data-migration section 5, "Ledger integrity"). The lead reads and accepts each difference. |
| Practice correct-sum | `practice_sessions.correct` against the count of correct answer rows. Reported. |
| JPN/PPD distinct pairs | Distinct (state, district) pairs against the derived JPN/PPD rows. |
| Orphan scan | A v2-side foreign key scan. The expected value is 0. |
| Deleted at source | After a delta on a re-staged dump: v2 rows whose source row no longer exists, counted per entity as `deletedAtSource` (md column "Deleted at source"). See below. |
| Accepted drift | Streak, mastery and rankings are recomputed in v2 and differ from .cloud by design (data-migration section 5, "Derived data drift"). Listed, not failed. |

`pass` means every entity row is `ok` and no check is `mismatch`. Ledger, correct-sum, drift and deleted-at-source rows are `reported` and never fail the run, so the lead must read them (section 14).

**Deleted at source.** A delta never deletes v2 rows (section 15), so after a delta on a re-staged dump a v2 table can hold more rows of the source than the run loaded. Verify measures that difference directly: the v2 rows with `legacy_source = 'cloud'` whose legacy id the current staging no longer produces.

- An entity is `ok` when `target count - deleted at source = loaded`.
- A child row whose parent was deleted at source counts as deleted at source too, even when its own staging row remains (feedback follows its user: staging has no cascade and the load rejects the orphan).
- Each entity with deletes adds a check named `deleted_at_source:<entity>` with status `reported`; on its own it does not fail the gate (see the ratio check below).
- The surrogate legacy ids (200 per entity at most) are **not** in the recon json or md, which stay aggregate-only (30-day rule). They go to a separate file `.migration-out/deleted-at-source-<stamp>-<rand>.json` (mode 0600) and are never printed to the console. **That file is real data**: it holds legacy user ids and parent:child pairs of minors. Delete it at most 7 days after the lead has read it for the go/no-go, and never put it in GitHub, chat or e-mail (section 0, rule 4; section 18).
- **A large count fails the gate.** The check `deleted_at_source_ratio:<entity>` **fails** verify when an entity's deleted-at-source count is above 5 % of its target count **and** above 100 rows. It catches a truncated or wrong re-stage. These thresholds are proposed defaults; **the lead confirms them in the cutover plan (#124, section 8, item 4)**. On a failure, check the re-staged dump before anything else.
- The staging-versus-v2 checks and the derived counts leave these rows out, so a source delete alone never makes a comparison fail, while a real mismatch still does.
- The entities `jpns`, `ppds`, `gamification_settings`, `challenge_completions` and `spm_targets` are derived or have no stable single key, so they show n/a and the plain rule (`target count = loaded`) applies.
- **Caveat: classes.** If a pupil deleted at the source was the only pupil of a class, the derived class level changes and the class can then be rejected. That class shows as a **real mismatch** on `classrooms`, not as a source delete. Read it as a mismatch and investigate it; do not explain it away as a delete.

**Optional: `migrate:link-questions` (MIG-09).** Run it only after the new question bank is loaded. It sets `practice_answers.question_id` when exactly one new-bank question matches (source paper natural key plus number label, else content hash). It never overwrites a non-null `question_id`, never changes correctness or dimensions, and lists ambiguous and unmatched surrogate ids. Unmatched rows stay `NULL` and still count in every statistic (data-migration section 3.3). Dry-run first. Flags: `--apply`, `--batch-size=N`.

## 13. Rehearsal checklist (BE-30, AC5)

Tick each box and record the evidence in the PR or the issue as text (counts, exit codes, timings), never as an attached file (section 0). Owner roles: **lead** (the lead), **devops** (devops-engineer), **be** (backend-developer).

**A. Preconditions**

- [ ] 1. Rehearsal database name ends in `_staging`; `NODE_ENV` is not production. Owner: devops. Evidence: the database name and the `staging:load` guard output.
- [ ] 2. Disk encryption confirmed on every machine and volume that holds the dump (section 0, rule 5). Owner: lead. Evidence: a confirmation line.
- [ ] 3. Source role proven read-only by privileges, not trust (section 3): `staging:load` from the restore passes the role check (not exit 3). Owner: devops. Evidence: exit code 0 and the role-check line.
- [ ] 4. Git sha of the code under test, and the `etl_runs.git_sha` that will record it (equal to it; in a container only when `PP_GIT_SHA` is passed, section 12). Owner: be. Evidence: the sha.
- [ ] 5. Fresh anonymisation key for this rehearsal (section 8); it is never reused. Owner: lead. Evidence: a confirmation line (no key).
- [ ] 6. Pre-migration snapshot of per-table counts of every migratable table (`SELECT count(*)` per table), kept as text. Owner: be. Evidence: the counts (used by section 16).

**B. Freeze (simulated)**

- [ ] 7. Record the dump time `T-dump1` (ISO 8601) and pretend the .cloud freeze starts. No change is made to .cloud (section 15). Owner: lead. Evidence: the timestamp.

**C. Dump import**

- [ ] 8. `staging:load` of the anonymised dump. Owner: devops. Evidence: exit 0, row counts against the manifest, duration.
- [ ] 9. `staging:profile`; reject and orphan expectations noted before the ETL runs. Owner: be. Evidence: orphan and duplicate counts, enum lists reviewed.

**D. Dry-run**

- [ ] 10. `migrate:all` (dry-run). Owner: be. Evidence: exit 0, the per-entity table, reject counts by reason.
- [ ] 11. Reject reasons reviewed: every reason count has an explanation (section 14, item 2). Owner: lead. Evidence: the list.

**E. Apply and verify**

- [ ] 12. `migrate:all --apply` with `PP_ALLOW_MIGRATE_APPLY=1`. Owner: devops. Evidence: exit 0, duration of the full run.
- [ ] 13. `migrate:verify` status `pass`; the report is stored under `.migration-out/` only. Owner: be. Evidence: the status, the entity count and the check counts (aggregates).
- [ ] 14. Ledger, correct-sum and drift rows read and accepted. Owner: lead. Evidence: a line per check.
- [ ] 15. Smoke on the migrated database: conformance suite and e2e smoke (section 14, item 8). Owner: be. Evidence: the real tail of the test output.
- [ ] 16. Idempotency: `migrate:all --apply` a second time changes no row (all `unchanged`). Owner: be. Evidence: the recon counts.
- [ ] 17. Optional: `migrate:link-questions` dry-run and, if wanted, apply. Owner: be. Evidence: linked, ambiguous and unmatched counts.

**F. Timed delta run (section 15)**

- [ ] 18. Change or add a few rows in the staged data (or take a second dump), record `T-dump2`, run `staging:load`, then `migrate:delta --since=<T-dump1> --as-of=<first load's date>` (dry-run; `--as-of` is required, exit 2 without it), then the same with `--apply`, then `migrate:verify`. Owner: be. Evidence: duration, the delta report (rows with `updated_at` after `--since` against inserted and updated), verify `pass`.

**G. Timed rollback (section 16)**

- [ ] 19. `migrate:rollback --confirm=<database name>` (dry-run), then `--apply`. Owner: devops. Evidence: duration, rows deleted per table.
- [ ] 20. Per-table counts equal the snapshot of item 6 and `legacy_source = 'cloud'` counts are 0. Owner: be. Evidence: the comparison.
- [ ] 21. Run the apply again from the rolled-back state, to prove the way forward after a rollback (or recreate the database). Owner: devops. Evidence: verify `pass`.

**H. Go/no-go and sign-off**

- [ ] 22. Every criterion of section 14 is met, with the evidence above. Owner: lead.
- [ ] 23. Dump and report deletion done (section 18, which extends section 10) and confirmed in writing. Owner: lead.
- [ ] 24. Sign-off line (the lead fills it in the PR): `Rehearsal <date>, git sha <sha>, go / no-go: <decision>, signed: <lead>`.

## 14. Go/no-go criteria

All of these must hold. A criterion with no evidence counts as not met.

| # | Criterion | Measure | Evidence |
|---|---|---|---|
| 1 | Verification passes | `migrate:verify` status is `pass`: every entity `ok`, no check `mismatch`. | Status line and the count of entities and checks. |
| 2 | Rejects explained | Every `etl_rejects` reason count (`UNKNOWN_ENUM`, `ORPHAN_PARENT`, `DUPLICATE_KEY`, `INVALID_VALUE`, `UNSUPPORTED`) per entity is listed and reviewed by the lead. No unexplained reason. | The list of reason and count, in the issue as text. |
| 3 | No lost users or schools | `ORPHAN_PARENT` rejects on `users` and `schools` are 0. | The count. |
| 4 | Ledger and drift accepted | Each ledger-sum, correct-sum and accepted-drift row is read and accepted by the lead; nothing was corrected to make totals agree. | One accepted line per row. |
| 4a | Deleted at source read | Verify has no `deleted_at_source_ratio:<entity>` failure (above 5 % of the target count AND above 100 rows; thresholds decided by the LEAD on 22 Oct, #109; a breach is a STOP, see the stop conditions below). Every `deleted_at_source` count (section 12) is read and listed for the lead, per entity, count only. Requests to erase personal data (PDPA) among them are a **decision of the lead**, see the cutover plan (#124); this runbook does not decide them. | The list of entity and count, in the issue as text. The ids file is deleted within 7 days of reading (section 18). |
| 5 | Orphan scan | The v2-side foreign key scan reports 0. | The count. |
| 6 | Timings in the window | Full run (`migrate:all --apply` plus `migrate:verify`, the go-live path) and rollback each finish within the cutover window of the cutover plan (`docs/ops/v2-cutover-plan.md`, #124, section 4 latest times). A delta run is timed too, but only when a delta is run (rehearsals, replan). | The durations. |
| 7 | Idempotent | A second apply and a repeated delta change no row. | Recon counts. |
| 8 | Smoke on the migrated database | The conformance suite (`npm run be:test -- apps/api/test/conformance`) and the e2e smoke pass against the migrated database. A roster account and a self-registered account can both reach the first-login flow. | The real tail of the test output. |
| 9 | Rollback proven | Section 16 was run once (Procedure B, restore point) and the counts equal the restore point. | The comparison. |
| 10 | Housekeeping | Dumps and reports of this rehearsal are deleted (section 18) or have a dated deletion plan within 7 days (section 0, rule 4). | The deletion line. |

Any "no" is a no-go. The lead may waive a criterion only in writing in the issue, with the reason. **Exception for the night session:** the lead is not reachable at 01:00 and nobody waives anything; any "no" is a STOP (below).

### Stop conditions: one operator, 01:00 night session (decided by the LEAD, 22 Oct, #109)

There is no deputy. One person, the dump operator, runs the 01:00 night session alone. No one is woken. **Every row in this table is a STOP: stop, do not retry, do not fix forward, and go to the rollback procedure in section 16 (Procedure B, restore point by default).** The LEAD reviews in the morning (30 Oct).

| # | Stop condition | How the operator sees it |
|---|---|---|
| S1 | Threshold breach, check 4b: `deleted_at_source_ratio:<entity>` fails, i.e. the count is above 5 % of the entity's target AND above 100 rows. | `migrate:verify` lists the failing check. |
| S2 | Threshold breach, delta check, **per entity**: inserted + updated against the staged rows changed since `T-dump1` differ by more than 5 % AND more than 100 rows. **Applies only when a delta runs** (rehearsals, a replan); on the go-live path (one full load under the freeze, no delta) S2 does not occur and S1 is the check. | The delta report (section 15, notes). Read the `deleted_at_source_ratio:<entity>` lines and the `mismatch` rows of `migrate:verify`, not only the exit code: a delta dry-run skips the activity stage when core tables changed, and does not show a deleted-at-source breach (MIG-07 pass 4, #133, P3.5). |
| S3 | `migrate:verify` status is anything other than `pass`. | The status line. |
| S4 | Any non-zero exit code of any command in the night session. | `echo $?` after each command. |
| S5 | A lock is refused (exit 4: the source lock is held by another run). | Exit code 4. |
| S6 | A guard refuses (exit 2 or 3: missing variable or `--confirm` mismatch, empty database, read-only role proof failed). | Exit code 2 or 3. |
| S7 | A time box is exceeded: any step finishes after its latest time in the cutover plan (`docs/ops/v2-cutover-plan.md`, #124) section 4 latest times. | The clock against the plan. |

Note on 4b and the delta check: the rule is AND, as in the code (default AND; the LEAD was asked on #109 whether it should be OR; this runbook follows the code until the LEAD answers). Rows deleted at .cloud (decision 15) are only listed in the reconciliation report and never deleted in v2; they are a STOP only through S1.

Timings for planning the time box, from the MIG-07 rehearsal (#133, `docs/ops/mig07-rehearsal-report.md` (#133), synthetic 20k users): `migrate:delta --apply` 513 s in pass 3b and 668 to 682 s in pass 4 (a spread of about 30 %), a no-op delta 515 s. A `pre_delta` restore took 3 s in pass 4 (template copy, `fsync` off; the real `--dump` restore must be timed on the VPS, #116). These delta timings matter only when a delta is run (rehearsals, replan), not on the go-live path.

## 15. Freeze window, go-live night and delta run (BE-30)

**Go-live plan (LEAD, 22 Oct, #109, binding).** 26 Oct: the production VPS is set up dark. 27 Oct: second rehearsal, production-like and timed. 28 Oct: G6 go/no-go by the LEAD. **29 Oct 01:00 MYT:** freeze `.cloud`, then the T-1 export, then `migrate:all --apply` to production, then `migrate:verify`; any breach means stop and roll back. The dump operator does this alone, by this runbook. **30 Oct:** the LEAD's morning review, the DNS switch by the LEAD, and opening to users.

So the cutover is **one night sitting: a full first load into production under the freeze, with no separate delta at go-live.** The delta (`migrate:delta`) stays documented below for rehearsals and for a possible replan (a T-1 load followed by a freeze delta on a later night); it is not on the go-live path.

**Why a freeze.** The load re-reads the whole fresh dump. It does not propagate deletes (there is no soft delete in .cloud), so a row removed in .cloud after the load would stay out of sync. The freeze keeps .cloud from changing between the export and the end of the night, so the loaded state is complete and nothing is deleted behind our back. The upsert skips unchanged rows by `legacy_hash`. The extract has no `updated_at` filter because the streak, wallet and JPN/PPD steps aggregate across rows.

**Who.** `.cloud` is never modified by us. The freeze is an operational decision (maintenance mode or a stop of writes) of the .cloud owner. We only ask for it and are told when it starts and ends.

### Go-live night (29 Oct, 01:00 MYT)

Before the night (26 to 28 Oct, with the LEAD's go/no-go): the release is deployed and `prisma migrate deploy` has run on the production database; take the restore point `pre_etl` **after** these schema migrations (`deploy/vps/migration/restore-point.sh take pre_etl`, #166, pending merge) and `verify` it. **Check that the restore point's migration count equals the number of directories in `prisma/migrations` of the release sha.** A 33-migration snapshot restored on a 36-migration tree failed its migration check in MIG-07 pass 4 (#133, P3.5). If the count differs, run `prisma migrate deploy` and take `pre_etl` again.

| Step | Action | Owner | Evidence |
|---|---|---|---|
| N0 | Pre-checks: restore point `pre_etl` verified, migration count equal to the release sha; v2 is dark (api and frontend not public); the stop conditions of section 14 are on the desk. | dump operator | Check lines, as text. |
| N1 (01:00) | Freeze of .cloud writes starts. Record the time. | .cloud owner, told to the dump operator | Timestamp. |
| N2 | T-1 export (the dump, per OD-2) and `staging:load` into the production staging schema. Record the dump time. | dump operator | Exit 0, counts against the manifest. |
| N3 | `PP_ALLOW_MIGRATE_APPLY=1 npm run migrate:all -w @pp/api -- --apply` with the same `--as-of`, `--batch-size`, `--content-owner` and `IC_HASH_KEY` as the plan sets (checklist item 12). | dump operator | Exit 0, duration. |
| N4 | `npm run migrate:verify -w @pp/api`. Go/no-go of section 14 (every criterion is read; any "no" is a STOP). | dump operator | `pass`, entity and check counts. |
| N5 | Stop. Post the aggregates on #109 (section 16). **v2 stays dark**: no restart, no switch. | dump operator | The post. |
| 30 Oct | The LEAD's morning review (section 14 evidence, #109). The LEAD does the DNS switch and opens v2 to users. Smoke checks (section 17) follow the switch. | LEAD | Sign-off line. |

**Night session (01:00).** The dump operator runs N0 to N5 alone, with the stop conditions of section 14 open on the desk. After every command read the exit code and compare the clock with the cutover plan (`docs/ops/v2-cutover-plan.md`, #124) section 4 latest times. Any stop condition means: stop, do not retry, run the rollback (section 16, Procedure B: restore `pre_etl`). Nobody is called; the operator posts the aggregates on #109 for the LEAD to read in the morning (section 16). If the rollback runs, unfreeze `.cloud` (B1, step 6) and the cutover is re-planned by the LEAD.

### Delta run (rehearsals and a possible replan only)

Used when a T-1 load is followed by a freeze delta on a later night. The rollback point of that path is `pre_delta` (the verified T-1 state, taken after the schema migrations); on the go-live path above, `pre_delta` does not exist.

| Step | Action | Owner | Evidence |
|---|---|---|---|
| T-0 | Freeze of .cloud writes starts. Record the time. | `<MIG-08 owner>` with the .cloud owner | Timestamp. |
| T+1 | Final dump (raw, then anonymised for a rehearsal). Record the dump time `T-dump-final`. | lead | Timestamp. |
| T+2 | `staging:load` of the final dump on the target database. | devops | Exit 0, counts against the manifest. |
| T+3 | Precondition: an earlier `migrate:all --apply` succeeded. Delta dry-run: `npm run migrate:delta -w @pp/api -- --since=<time of the previous dump> --as-of=<the first load's date>`. | be / devops | Exit 0, delta report. The activity stage may show "skipped" (see the notes). |
| T+4 | Delta apply: `PP_ALLOW_MIGRATE_APPLY=1 npm run migrate:delta -w @pp/api -- --since=<same> --as-of=<same> --apply`. | devops | Exit 0, duration. |
| T+5 | `migrate:verify` (also run by the delta). Go/no-go of section 14. | lead | `pass`, sign-off line. |
| T+6 | Switch (the v2 system serves users). If no-go, section 16. | `<MIG-08 owner>` | Timestamp. |

Notes.

- `--since` is the time of the **previous** dump (the one already loaded), in ISO 8601. It feeds the delta report only: rows with `updated_at > since` per staged table against inserted and updated per entity. A large gap between the two numbers needs an explanation (for example rows changed by aggregation steps).
- **`--as-of` is required for `migrate:delta` and must equal the `--as-of` of the first load**, because it feeds the transform; do not rely on the default (today's date), which would differ on another day. Use the same `--batch-size`, `--content-owner` and `IC_HASH_KEY` as well; a different value changes hashes and rewrites rows.
- **A delta dry-run can skip the activity stage.** When a core input table changed in the new dump, the activity preflight needs the new core apply, so the dry-run reports activity as "skipped". This is expected. The dry-run also does not show a deleted-at-source breach (it prints no deleted-at-source count), and `migrate:verify` between `staging:load` and `--apply` can exit 1 for a normal delta (`mismatch` rows such as `schools`, `users`); read the `deleted_at_source_ratio:<entity>` lines and the `mismatch` rows, not only the exit code (MIG-07 pass 4, #133). The `--apply` path runs core dry-run, core apply, activity dry-run, activity apply, in that order, so the activity stage still runs in full.
- **Deviation from plan 14.5, item 4** (`--since` loads only newer rows). The delta here is a hash-diff re-run of core and activity on the re-staged freeze dump, not a filtered extract. Reason: the streak, wallet and JPN/PPD steps aggregate across many rows, and an extract filtered by `updated_at` would corrupt them. `legacy_hash` already makes unchanged rows a no-op, so only changed and new rows are written. `--since` feeds the delta report only. The plan text and BE-30 AC2 wording ("incremental by `updated_at`") should be read in this sense.
- **Deletes are not propagated.** A source delete made after the previous dump is not removed in v2 (there is no soft delete in .cloud, and the delta never deletes). That is one reason for the freeze. After the delta, `migrate:verify` shows these rows per entity as "Deleted at source" (`deletedAtSource`, section 12); they are `reported` and the lead reads them in the go/no-go (section 14, item 4a); a very large count (above 5 % of the target AND above 100 rows, decided by the LEAD on 22 Oct) fails verify and is a STOP (section 14), because it points to a truncated or wrong re-stage. The surrogate ids are in a separate real-data file (section 12), not in the recon report. Rows deleted at .cloud are only listed in the reconciliation report and never deleted in v2 (LEAD decision, 22 Oct). Erasure requests among them are a lead decision (cutover plan #124). Record any source deletes the .cloud owner knows of.
- **Source lock and empty database.** `migrate:delta` takes the source lock (a second run exits 4) and exits 2 when the database has no migrated users, for example after a rollback: run `migrate:all --apply` first. Do not use the standalone `migrate:core` or `migrate:activity` for the delta (section 12).
- **`--as-of` cannot be checked.** The runner keeps only an input hash and the staged data was just replaced, so every delta prints and records the warning "cannot verify --as-of against the first load". The operator must type the first load's value; write it down at the first load (checklist item 12).
- The detailed cutover timeline is in the cutover plan (`docs/ops/v2-cutover-plan.md`, #124) and the production slot runbook (#166, pending merge).

## 16. Rollback (BE-30)

**When.** Any no-go in section 14 after the apply, or after go-live (go-live is the LEAD opening v2 to users on 30 Oct, after the DNS switch), for example: `migrate:verify` fails; the orphan scan is above 0; users report that logins or their data are wrong; the timings would not fit the window; a PDPA incident (section 0, rule 8) touches the loaded data. The lead decides; in the 01:00 night session there is nobody to ask, so every stop condition of section 14 triggers this rollback by itself and the dump operator runs it alone. **Never after go-live without a decision of the lead** (once users write v2 data, the rollback refuses or releases rows, see below). This applies to the post-go-live clean-up too: a failed `migrate:archive-minimise` (section 17a, item 1a) is not a reason to roll back.

**Procedure A: rehearsal database.** Drop the database, or the target schema, and re-create it from the migrations (`DATABASE_URL` points at the scratch `_staging` database). This is the simplest and is the default for a rehearsal.

**Procedure B: shared database** (a database with other data, or with v2-born rows). This is the procedure of the night session. Pick **B2 (restore point) by default**; use **B1 (`migrate:rollback`) only as the fallback when no usable restore point exists** (none taken, or its migration count differs from the release). The rollback point of the go-live path is `pre_etl`, taken after the schema migrations. `pre_delta` applies only if a delta is ever run (section 15). Timings from the MIG-07 rehearsal (#133, `docs/ops/mig07-rehearsal-report.md` (#133), synthetic 20k users): `migrate:rollback --apply` 19 s; restore `pre_etl` 5.5 s and 4.4 s; restore `after_full` 16.7 s; restore `pre_delta` 3 s in pass 4 (template copy, `fsync` off; the real `--dump` restore must be timed on the VPS, #116); delta apply 513 to 682 s on 20k users.

**B2: restore of a restore point (night default)**

Restore points are made by `deploy/vps/migration/restore-point.sh` (#166, pending merge): `pre_etl` before any .cloud data reaches the server, `pre_delta` the verified T-1 state before a delta (only if one is run), `post_switch` after a switch-back, `post_drop` after the `staging_cloud` drop. Usage (its header): `take NAME`, `list`, `verify NAME`, `restore NAME [--yes]`. **Rule: take each restore point after the final schema migrations (`prisma migrate deploy`).** A 33-migration snapshot restored on a 36-migration tree failed its migration check in MIG-07 pass 4 (#133, P3.5). Before the night, check that the restore point's migration count equals the count of `prisma/migrations` at the release sha. On the go-live path restore `pre_etl`; after a delta failure restore `pre_delta`.

1. Stop as in B1, step 1. *Confirm:* nothing running.
2. `deploy/vps/migration/restore-point.sh verify pre_etl`. *Confirm:* exit 0 and the line `RESTORE POINT OK: pre_etl file=<file> sha256 matches, <n> tables with data`.
3. `deploy/vps/migration/restore-point.sh restore pre_etl --yes`. It stops api and frontend, drops and recreates the database and restores the dump. *Confirm:* exit 0 and the line `RESTORED: pre_etl (<file>) in <N> s. api and frontend stay stopped: check the counts, then follow the cutover plan section 6.3 (rollback.sh / deploy.sh).`
4. Prove the result ("Prove the result" below, per-table row counts). *Confirm:* the restore exited 0 and the row counts equal the restore point's counts (`legacy_source = 'cloud'` counts are 0). `migrate:verify` is not the proof for `pre_etl`: it exits 1 on an unmigrated state by design. For a `pre_delta` restore (a migrated state), `migrate:verify` exits 0 with `verify pass` (MIG-07 pass 4, #133). The lines `ROLLBACK VERIFIED` and `MIGRATION CHECK PASSED n of n` belong to the MIG-07 rehearsal script (`restore-snapshot`), not to production: do not wait for them on the VPS.
5. **Services stay stopped; no restart at night.** The restore leaves api and frontend stopped. Before the DNS switch v2 is not public, and v2 must stay dark until the LEAD's morning review on 30 Oct, so the operator does **not** restart them. The LEAD decides in the morning. Restart, on the LEAD's instruction only: `deploy/vps/rollback.sh <TAG>` (#166; it restarts api and frontend on that image tag, runs no `migrate` and does not touch the database) or `deploy/vps/deploy.sh` for the release. *Confirm (after a restart):* `/api/ready` returns 200.
6. Unfreeze `.cloud` (B1, step 6) and post on #109. After this restore a new `staging:load` recreates `archive_cloud`: apply the deletion rule of section 18.

**B1: `migrate:rollback` (fallback when no restore point exists)**

**B1 removes ALL migrated rows (it goes back to `pre_etl`).** It deletes every migrated row, not only those of the failed step.

1. Stop. Nothing else may run: no load, no delta, no verify. Stop writes to the migrated data if the switch already happened (`<MIG-08 owner>`). *Confirm:* no unfinished apply run for the source in `etl_runs` (status `running`); if one is left by a crash, mark it `failed` first (see Concurrency below).
2. Dry-run: `PP_ALLOW_MIGRATE_ROLLBACK=1 PP_ALLOW_MIGRATE_APPLY=1 PP_MIGRATE_TARGET_DB=<database name> npm run migrate:rollback -w @pp/api -- --confirm=<database name>`. All three variables are needed in **every** environment, also for the dry-run, and `--confirm` and `PP_MIGRATE_TARGET_DB` must both equal `current_database()`. It counts the rows per table and changes nothing, but it runs the DELETEs and then rolls them back, so it **takes row locks** on the migrated tables: run it in a quiet window (no load, no heavy traffic). *Confirm:* exit 0, per-table counts printed, no refusal named.
3. Apply: the same command with `--apply` added. A missing or wrong variable, or a `--confirm` that is not the database name, is refused (exit 2). *Confirm:* exit 0 and the report with the deleted counts (about 19 s in the rehearsal).
4. If the report prints `released` or warnings for reference tables, run `npm run be:db:seed`. *Confirm:* exit 0.
5. Prove the result ("Prove the result" below). *Confirm:* the per-table counts equal the snapshot, and the `legacy_source = 'cloud'` counts are 0.
6. Unfreeze: the dump operator unfreezes `.cloud` after a rollback and before any switch. *Confirm:* the dump operator notes the time; `.cloud` accepts writes again.
7. Post on #109 (below).

**What to post on #109 for the LEAD to read in the morning (aggregates only; no ids, no data):** the timestamps (start, stop, rollback done); the step reached; the stop condition hit (S1 to S7); the exit code; the `migrate:verify` status line; the entity and check counts; and the line "rollback done, verified by <check>" (the check is the restore exit code plus the row counts, or the `migrate:rollback` counts).

What it does: in one transaction it deletes every row with `legacy_source = 'cloud'` from every migratable table, children first, and the `etl_id_map` rows of the source. Rows born in v2 are never deleted. `etl_runs`, `etl_recon`, `etl_rejects` and `etl_checkpoints` are kept as the audit trail.

Migrated rows that other data depends on:

- **Refusal (no change).** If a v2-born row references a migrated row in a non-reference table (users, practice rows and similar), the rollback **refuses**, names the table and the referencing column, and changes nothing. The lead decides how to handle those rows; nothing is forced.
- **Released seed rows.** In reference tables whose loader adopts seed rows (levels, subjects, chapters, topics, geography, tiers, achievements, settings), an adopted row that something references is **released**: its legacy pair (`legacy_source`, `legacy_id`) is set to NULL and the row stays. The report prints these as `released`, per table. An adopted row that nothing references cannot be told from an inserted one and is deleted. The values the ETL wrote into released rows are not restored.
- **After a rollback on a shared database, re-run the idempotent seeds** (`npm run be:db:seed`) to restore the seed rows, and only then compare the counts (below).
- **`coin_ledger`** is append-only (trigger). Its rows are not deleted one by one; they go with their user through the user cascade, and the rollback checks that no migrated ledger row is left.
- **Concurrency.** The rollback takes the source lock (advisory lock `etl:source:cloud`, shared with `migrate:all`, `migrate:delta` and `migrate:link-questions --apply`; those exit 4 while the rollback holds it, and a rollback started while another command holds it exits 2 with no change) and **refuses** (no change) while an apply run of the source is `running` in `etl_runs`. A crashed run stays `running`: confirm no load is active, mark that run `failed`, then retry. **Never run a load during a rollback**, and use only `migrate:all` and `migrate:delta` (section 12). After a rollback, `migrate:delta` refuses (exit 2) because no migrated users exist: run `migrate:all --apply` first.
- **Unfinished apply runs.** In the same transaction the rollback closes the source's unfinished apply runs (status `failed`) and deletes their checkpoints, so the next apply starts fresh from the first batch. No operator step is needed; the run rows themselves stay in `etl_runs` as the audit trail. (A run still marked `running` is refused, see Concurrency.)
- **Warnings.** The report prints `warnings`, including one for every reference table with deleted rows (they may be adopted seed rows: re-run the seeds, above). Read them before the apply.

**Prove the result.** Do not re-run `migrate:verify`; it reads the loaded data and would report mismatches by design. Instead:

1. Compare the per-table counts with the pre-migration snapshot (checklist item 6). They must be equal.
2. For every migratable table: `SELECT count(*) FROM <table> WHERE legacy_source = 'cloud';` must return 0.
3. `SELECT count(*) FROM etl_id_map WHERE legacy_source = 'cloud';` must return 0.
4. Record the counts and the duration as text in the issue.

**The source stays untouched.** `.cloud` is unfrozen by the dump operator after a rollback and before the switch (B1, step 6). The migration reads `staging_cloud`, which is a copy, and the dump or restore is read only through a role that is proven read-only by its privileges (section 3: the load aborts with exit 3 if the role could write). Nothing in rollback touches .cloud or `.my`. After a rollback the cutover can be tried again from `staging:load`.

## 17. Post-cutover verification (BE-30)

1. **Archive the verify report.** The final `.migration-out/recon-<runs>-<stamp>.json/.md` holds aggregates and surrogate ids only, and `.migration-out/` is git-ignored. Keep it in the lead's encrypted storage only until both the rehearsal sign-off and the cutover sign-off are done, 30 days at most, then delete it (same rule as section 18). Never attach it to a PR, an issue or a CI artifact; put the counts in text. If a report holds anything other than aggregates, treat it as a PDPA incident (section 0, rule 8).
2. **Smoke checks** on the production system after the switch: health endpoint green; a student, a teacher, a parent and an admin each log in with their own account; the dashboards show non-empty history for a sample of accounts; the wallet balance of a sample matches the reported ledger rows; JPN/PPD pickers list the derived rows. Record pass or fail only.
3. **First login.** Roster accounts (those with a `username`) are forced to reset the password on first login. Accounts whose legacy hash is not bcrypt, or equals a shared default hash, are forced to reset too (data-migration section 5, "Passwords and hashes"). Everyone logs in again; no legacy token was migrated. Expect a spike in password-reset requests and tell support.
4. **Accepted drift.** Streak, mastery and rankings differ from .cloud by design. Tell support which figures can change.
5. **Backfill.** `migrate:link-questions` (section 12) can be run any time after the cutover. Cutover does not wait for it.
6. **.cloud stays read-only** after the cutover and is not modified by us (D28a).

### 17a. Open question reports export (Q9 A)

Decision Q9 A (data-migration 3.3 item 4): `question_reports` is not migrated, but the reports that are still open go to the content team as a file. Closed reports are dropped.

1. **Command** (read-only; needs `archive_cloud` and, for the subject code and chapter number, `staging_cloud`, so run it after `staging:load` and before `staging_cloud` is dropped, section 18; `archive_cloud` itself is kept 12 months, Q12 A): `npm run migrate:export-question-reports -w @pp/api -- [--out-dir <.migration-out path>]`. There is no `--apply`; passing it exits 2. It writes `.migration-out/question-reports-open-<stamp>.csv`, `question-submissions-open-<stamp>.csv` (teacher submissions: id, status and date only, there is no content to export) and `question-reports-open-<stamp>.summary.json` (mode 0600, never replaces an existing file) and prints only counts per status and the two paths, never a row. **Every run writes another set of files** (the stamp is the run time): delete the older set at once, so exactly one copy exists.
2. **Columns:** legacy report id, legacy question id, source paper natural key and number label (the BE-29 snapshot join, so the content team can find the question in the new bank), subject code, chapter number, topic id, status, reason, created date (Malaysia calendar date, no time). The reporter is never exported: no user id, name, e-mail or school. Identifier cells are empty when the question is not in the archive or has no canonical bridge.
3. **"Open" is a working assumption** until the status values are profiled (MIG-01): `baru`, `menunggu`, `pending`, `open`, `new` (case and spaces ignored). The summary and the console list the count of every status with `exported` yes or no. If a value that means open is listed as `no`, tell the owner of the command before the hand-over; do not edit the file by hand.
4. **The file holds personal data.** `reason` is free text written by the reporter, who can be a minor. The command minimises it: e-mail addresses, Malaysian phone numbers and 12-digit IC / MyKad numbers become `[dihapus]`, and the text is cut at 1,000 characters (marked `[dipotong]`). A name or an address written in words cannot be detected, so the file is still personal data. Treat it like a dump copy (section 0): lead's encrypted storage only; hand it to the content team lead over the agreed encrypted channel; never in GitHub (PR, issue, CI artifact), chat or e-mail body. Cells whose first non-blank character is `=`, `+`, `-` or `@` are prefixed with `'` so a spreadsheet does not run them as formulas; open the file with a text/CSV import, not by double-click.
1a. **Minimise `archive_cloud` after the export, the manual review (item 6) and the hand-over of the CSV (decided by the LEAD, 22 Oct, #109).** The minimise runs after go-live, so it comes after item 6: once it has been applied, `reason` exists only in the CSV, so the CSV must be reviewed and handed over first. Run only after the export of item 1 has run; before it, the command is refused. Dry-run first: `PP_ALLOW_MIGRATE_APPLY=1 PP_MIGRATE_TARGET_DB=<db> npm run migrate:archive-minimise -w @pp/api -- --confirm <db> --export-summary <.migration-out/question-reports-open-<stamp>.summary.json>`; read the counts; then the same command with `--apply`. Same environment gates as `migrate:rollback` (`PP_ALLOW_MIGRATE_APPLY=1`, `PP_MIGRATE_TARGET_DB=<db>`), flags as in the command header. It sets `user_id` to NULL in `question_reports`, `question_submissions`, `question_imports`, `spm_sets` and `teacher_reference_documents`, sets `question_reports.reason` to NULL, and nulls `_row_hash` as well. **Expected output: counts only**, per table the number of rows with a `user_id` set (dry-run) and the number of rows changed (apply), plus the `reason` count for `question_reports`; never a row. Confirm it worked: exit 0, and a second dry-run reports 0 left in every table. **A failed minimise is not a STOP of the night and never sends the operator to Procedure B.** The minimise runs after go-live, and section 16 forbids a rollback after go-live without a decision of the LEAD. On a non-zero exit: stop the minimise only, do not roll back, report the exit code and the counts to the LEAD on #109, and retry by a date the LEAD sets (proposed: within 2 days). Until it succeeds, `archive_cloud` still holds the reporters' `user_id` and `reason`: keep access restricted as in section 0, rule 4. Record the counts as text in the issue.
5. **Custody and deletion:** the lead is the custodian. Retention is **at hand-over to the content team, or 7 days after the export at the latest, whichever comes first** (section 0, rule 4: real-data copies, not the 30 days of the aggregate-only reports). On the day of hand-over the lead deletes both CSVs and the summary from their storage and every working copy, and asks the content team to delete theirs after triage (their copy is not kept longer than the triage). Record the deletion date as text in the issue (section 18).
6. **Manual review before hand-over.** The command removes only e-mail addresses, phone numbers and IC numbers. Before the file leaves the lead's storage, the lead (or the named recipient on the lead's behalf) reads the CSV by hand for names and social handles that the scrubber cannot catch, and, if it finds any, does not edit the file by hand: it asks the owner of the command for a re-export with that column dropped, then deletes the earlier set (item 1). Open submissions (`question_submissions`) go in a **second, metadata-only CSV** (no reporter, no free text). **It is kept (LEAD decision, 22 Oct)** with the same retention and access as the dump: outside GitHub, deleted with the dump copies within 7 days.
7. If the file or a copy was exposed outside this chain, or outlived the retention above, treat it as a PDPA incident (section 0, rule 8).

## 18. Deletion of dumps after cutover (BE-30)

Extends sections 5 and 10. Timing follows section 0, rule 4: delete as soon as the load and reconciliation succeed, and within 7 days at most.

| Delete | Who | When |
|---|---|---|
| Raw dump or restore, anonymised dump directory, the encrypted archive and every copy that was handed out, the `pp_staging_reader` role | lead (custodian) | After the final verify is `pass` and signed off. |
| The key file `ANON_HMAC_KEY_FILE` and any history that held a key | lead | With the dump. |
| `staging_cloud` schema (`drop schema staging_cloud cascade;`) | devops | **Hard deadline: at most 7 days after the cutover** (section 0, rule 4; section 14, item 10). Until then it is the input for a re-run or a rollback retry, so keep it, but no longer. The lead records the drop date as a dated line in the issue (no data). |
| `.migration-out/question-reports-open-*.csv`, `question-submissions-open-*.csv` and `question-reports-open-*.summary.json` (open question reports export, section 17a; the reports CSV holds the reporters' redacted free text; the `question_submissions` CSV is kept with the same retention and access as the dump, LEAD decision 22 Oct) and every older set from a re-run | lead | **At hand-over to the content team, or 7 days after the export, whichever is first.** Not the 30-day report rule: this file is real personal data. |
| `.migration-out/deleted-at-source-<stamp>-<rand>.json` (legacy user ids and parent:child pairs of minors: real data) | lead | **At most 7 days after the lead has read it for the go/no-go** (section 0, rule 4). Not the 30-day report rule. Never in GitHub or chat. |
| `.migration-out/` profiles and the recon report (aggregates and surrogate ids only); the restricted `CLOUD_SOURCE_URL` file | lead, devops | **Report rule (one rule, also in section 17, item 1):** the aggregate-only recon report stays in the lead's encrypted storage until both the rehearsal sign-off and the cutover sign-off are done, 30 days at most, then it is deleted. Never in GitHub (PR, issue, artifact). The numbers go into the issue as text. The `CLOUD_SOURCE_URL` file goes with the dump. |
| Restore points under `restore-points/` (#166, pending merge; never off-site): `pre_delta`, `post_switch` and `post_drop`, and `pre_etl` **if it was taken after real data arrived** (check the `raw_data` column of `restore-point.sh list`; a `pre_etl` taken before any .cloud data reached the server holds none). They hold real, unminimised data (`staging_cloud`, and `archive_cloud` with `user_id` and `reason`). | devops, with the LEAD | **Within 7 days of the cutover, or by a stated date the LEAD writes in the issue.** `restore-point.sh purge-raw --after post_drop` deletes the `raw_data=yes` points older than the verified `post_drop` point; delete `post_drop` itself by the same date unless the LEAD keeps it. Record the deletion in the issue. |
| Write-ahead log, base backups, snapshots and replicas of the server that held the dump; temporary and spill files (section 5, items 3 and 4) | devops | With the dump. |

**After any restore or any `staging:load` (which recreates `archive_cloud`), re-run the Q9 export (section 17a, item 1), then `migrate:archive-minimise` (item 1a).** A restore or a new load brings back the unminimised `user_id` and `reason`.

**Kept:**

| Keep | Why | For how long |
|---|---|---|
| `archive_cloud` (legacy and canonical question tables) | Read-only archive that supports the backfill and disputes (data-migration section 3.3, item 5). Not served by the API. **Real data: exception to section 0, rule 4 (Q12 A).** | Cutover + 12 months, then drop it (and from every backup chain). Write the dated deletion line in the issue at the cutover. Conditions: read-only grant for one named role (no application role) with access logging (`log_connections`, statement logging or `pgaudit`; logs kept per the security policy and reviewed monthly), encrypted backups only, never copied to a non-production database. **Minimisation decided (LEAD, 22 Oct):** after the section 17a export, `npm run migrate:archive-minimise -w @pp/api -- --confirm <db> --export-summary <.migration-out/question-reports-open-<stamp>.summary.json>` (section 17a, item 1a; run after the manual review and hand-over) nulls `user_id` in `question_reports`, `question_submissions`, `question_imports`, `spm_sets` and `teacher_reference_documents`, nulls `question_reports.reason`, and nulls `_row_hash` as well. |
| `etl_runs`, `etl_recon`, `etl_rejects` (and `etl_checkpoints`) | Audit trail of the migration. Holds counts, reason codes and surrogate ids, no personal values. | With the database. |
| `etl_id_map` | Needed by the backfill and by any later delta. Do not delete it after a successful cutover. | With the database. |

**Record the deletion.** The lead writes a dated line in the issue with no data in it, for example: `<date>: raw dump, anonymised dump, key file, staging_cloud, reports, open-reports and open-submissions CSVs and summary (all runs) and the deleted-at-source ids file deleted; WAL and backups of <machine label> checked; archive_cloud kept until <date>; signed <lead>`. Each machine on the lead's list of copies (section 0, rule 4) gets a tick.

## 19. `migrate:activity` (BE-29): operator notes

- **Always pass `--as-of` (and `--core-as-of`) explicitly.** The input hash that links a dry-run to its `--apply` (and a resume to the interrupted run) includes `--as-of`. When the flag is left out, the default is today's Kuala Lumpur calendar day, so a dry-run on one day and an apply after midnight (or a resume that crosses midnight) hash differently and `--apply` is refused ("no passing dry-run found for input hash ..."). Give the same `--as-of=YYYY-MM-DD` to the dry-run, the apply and every resume. Pass `--core-as-of` with the date `migrate:core` ran with when it differs.
- **Runs made before MIG-07 must be re-run.** The staged-table digest in the input hash changed from `md5(string_agg(...))` to a constant-memory form (row count plus a sum of 60-bit slices of `md5(_row_hash)`, shared by `migrate:core` and `migrate:activity`; it stays within memory and Postgres's 1 GB text limit at real volume). A hash stored by an earlier run no longer matches, so redo `migrate:core` dry-run, then `--apply` (there were no production runs).
- **Standalone commands take the source lock.** `migrate:core` and `migrate:activity` (dry-run and apply) take the same per-source advisory lock as the orchestrator (`etl:source:<source>`, e.g. `etl:source:cloud`); if another run holds it the command exits 2 ("another migration run holds the lock for source cloud") before any work and writes no `etl_runs` row. The lock is released when the command ends, also after a failure.
- **Unknown flags and positional arguments are refused** (exit 2, the message names the flag): a typo such as `--talbe=wallets` never silently selects the full entity set.
- **`blocked by spec: <entity> 0/<n>`** in the report means the entity has `n` source rows and none was loaded because the staging spec still lacks a column its v2 table needs (articles, notes, videos, audio sets, support tickets). A green run does not mean those tables are filled; the line and the `note blocked_by_spec.<entity>` counter go away once the spec carries the column and rows load.
- **Rejected rows:** an exam attempt whose score is above its maximum (or whose maximum is not above 0) is rejected `INVALID_VALUE` on `score`; a ledger row with a negative `balance_after` is rejected `INVALID_VALUE` on `balance_after`. Nothing is clamped.

### 19.1 Content files: `--files-dir` (BE-29 AC9, BE-MIG-09)

`migrate:activity` never reads the .cloud storage. File migration is on only when you pass `--files-dir=<dir>`:

1. **Export once, read-only.** The operator copies the .cloud storage files that the staged rows point to into one local directory, together with the AM-10 dump. The directory lives **outside the repository** (the command refuses a directory inside the working tree, or one that contains it), on an **encrypted disk**, and is **deleted with the dump** when the migration is signed off (section 10). It is untrusted input: symbolic links are refused, nothing outside it is read.
2. **Generate `SHA256SUMS` ON THE .cloud SERVER at export time** (by the operator, read-only, from the live storage) and let it travel with the export. A manifest made from the exported copy proves nothing about tampering or corruption in transit. Format: sha256sum, paths relative to the export directory, the same text the staged column holds, for example from the storage root `find . -type f -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS` (then copy it into the export directory and remove its own line if it lists itself). Names that need sha256sum escaping (a line starting with `\`) are refused, so the export must avoid such file names; otherwise the run fails closed with the manifest line number. A directory without a valid `SHA256SUMS` is refused (fail closed). The manifest is part of the input hash, so a dry-run does not authorise an apply on a changed manifest.
3. **Run with the same flag every time:** `npm run migrate:activity -w @pp/api -- --dry-run --as-of=YYYY-MM-DD --core-as-of=YYYY-MM-DD --files-dir=<dir>`, then `--apply` with the same flags. An apply also needs `FILE_STORAGE_DIR` (the absolute path of the v2 file storage, separate from the export). A dry-run verifies every file and writes nothing.

What is migrated: **`banners.image_path`** into `banners.image_file_id` (purpose `cms_image`, same size cap, type check and sanitising as an upload). Not staged, so not migrated: article images, note and video files, ticket attachments. `audio_kbat.audio_path` is staged but has no single v2 target (the v2 set keeps audio inside authored `sections` the spec does not carry); it is counted, not copied.

Rules per file: the path must be a plain relative path; the file must be listed and its SHA-256 must equal the listed one; it is copied to the storage first and the reference is written afterwards, in the same batch. If the batch fails, the objects it copied are removed again; when a re-run replaces a file (the source changed), the old object is removed after the commit. A missing, unlisted, unsafe (traversal, absolute, symlink), oversized, wrongly typed or checksum-mismatched file is rejected `INVALID_VALUE` on `image_path`: the banner row is not loaded (a banner already loaded keeps its earlier value) and no dangling reference exists. Fix the export and re-run. A re-run copies nothing already present (the object key holds the source SHA-256 and the legacy id).

The report prints `files: ...` (counts only; notes `files.banners.image_path.copied|present|rejected.<cause>`, causes `path`, `unlisted`, `missing`, `unsafe`, `size`, `checksum`, `type`). Without the flag: `files: not migrated (no --files-dir) <n> references` and every file reference stays unset. Logs and rejects never carry a path, a file name or content.
