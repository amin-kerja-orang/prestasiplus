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

The commands below run on a rehearsal or staging database that holds an imported dump. Run them from the repository root as `npm run <script> -w @pp/api -- <flags>`. The source is always `cloud`. `--dry-run` is the default of every command; nothing is written until `--apply` is given.

**Environment (names only; values come from a restricted file or the platform secret store, section 0 rule 7):**

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | all | The rehearsal database. Its name ends in `_staging`. It holds `staging_cloud`, `archive_cloud` and the v2 tables. |
| `CLOUD_SOURCE_URL` | `staging:load` | Only when loading from a read-only restore instead of `--from <dump dir>`. Read-only role (section 3). |
| `PP_ALLOW_STAGING_RESET=1` | `staging:load` | Allows the drop and re-create of the staging schemas (section 1). |
| `PP_STAGING_DB_ALLOWLIST` | `staging:load` | Only if the database name does not end in `_staging`. |
| `PP_ALLOW_MIGRATE_APPLY=1` | `--apply`, `migrate:rollback` | Without it every apply is refused. |
| `PP_MIGRATE_TARGET_DB` | `--apply`, `migrate:rollback` | Required when `NODE_ENV` is `production` or `prod`; must equal `current_database()`. |
| `IC_HASH_KEY` | `migrate:core` | Else `SESSION_SECRET` outside production. Keep the key stable across the full run and the delta run, otherwise IC hashes differ. |
| `PP_MIGRATE_ROSTER_DEFAULT_HASHES` | `migrate:core` | Optional. The lead's list of shared roster default hashes. Never logged. |
| `NODE_ENV` | all | `production` on a production host, so the anonymised-data and wrong-database guards apply. |

**Sequence.**

| Step | Command | Expected result |
|---|---|---|
| 1. Load | `npm run staging:load -w @pp/api -- --from <dump dir>` | Exit 0. 83 tables in `staging_cloud`, 35 in `archive_cloud` (section 2). |
| 2. Profile | `npm run staging:profile -w @pp/api` | `profile-<date>.md/.json` in `.migration-out/`. Read the orphan, duplicate and enum counts. |
| 3. Dry-run | `npm run migrate:all -w @pp/api -- --as-of=<YYYY-MM-DD>` | Core dry-run, then the activity dry-run only if a core apply on the same staged data exists, otherwise "skipped". Nothing is written. |
| 4. Apply | `PP_ALLOW_MIGRATE_APPLY=1 npm run migrate:all -w @pp/api -- --apply --as-of=<same date>` | Per stage, core then activity: a dry-run, then the apply with identical options only if the dry-run succeeded. Stops at the first failed stage. |
| 5. Verify | runs at the end of `migrate:all --apply`; to repeat: `npm run migrate:verify -w @pp/api` | Writes `.migration-out/recon-<runs>-<stamp>.json` and `.md`. Exit 1 unless the status is `pass`. |
| 6. Link (optional) | `npm run migrate:link-questions -w @pp/api` then, after reading it, `-- --apply` | See below. Cutover never waits for it. |

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
| Accepted drift | Streak, mastery and rankings are recomputed in v2 and differ from .cloud by design (data-migration section 5, "Derived data drift"). Listed, not failed. |

`pass` means every entity row is `ok` and no check is `mismatch`. Ledger, correct-sum and drift rows are `reported` and never fail the run, so the lead must read them (section 14).

**Optional: `migrate:link-questions` (MIG-09).** Run it only after the new question bank is loaded. It sets `practice_answers.question_id` when exactly one new-bank question matches (source paper natural key plus number label, else content hash). It never overwrites a non-null `question_id`, never changes correctness or dimensions, and lists ambiguous and unmatched surrogate ids. Unmatched rows stay `NULL` and still count in every statistic (data-migration section 3.3). Dry-run first. Flags: `--apply`, `--batch-size=N`.

## 13. Rehearsal checklist (BE-30, AC5)

Tick each box and record the evidence in the PR or the issue as text (counts, exit codes, timings), never as an attached file (section 0). Owner roles: **lead** (the lead), **devops** (devops-engineer), **be** (backend-developer).

**A. Preconditions**

- [ ] 1. Rehearsal database name ends in `_staging`; `NODE_ENV` is not production. Owner: devops. Evidence: the database name and the `staging:load` guard output.
- [ ] 2. Disk encryption confirmed on every machine and volume that holds the dump (section 0, rule 5). Owner: lead. Evidence: a confirmation line.
- [ ] 3. Source role proven read-only by privileges, not trust (section 3): `staging:load` from the restore passes the role check (not exit 3). Owner: devops. Evidence: exit code 0 and the role-check line.
- [ ] 4. Git sha of the code under test, and the `etl_runs.git_sha` that will record it. Owner: be. Evidence: the sha.
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

- [ ] 18. Change or add a few rows in the staged data (or take a second dump), record `T-dump2`, run `staging:load`, then `migrate:delta --since=<T-dump1>` (dry-run), then `--apply`, then `migrate:verify`. Owner: be. Evidence: duration, the delta report (rows with `updated_at` after `--since` against inserted and updated), verify `pass`.

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
| 5 | Orphan scan | The v2-side foreign key scan reports 0. | The count. |
| 6 | Timings in the window | Full run, delta run and rollback each finish within the cutover window of `<to be set in MIG-08>`. | Three durations. |
| 7 | Idempotent | A second apply and a repeated delta change no row. | Recon counts. |
| 8 | Smoke on the migrated database | The conformance suite (`npm run be:test -- apps/api/test/conformance`) and the e2e smoke pass against the migrated database. A roster account and a self-registered account can both reach the first-login flow. | The real tail of the test output. |
| 9 | Rollback proven | Section 16 was run once and the counts equal the snapshot. | The comparison. |
| 10 | Housekeeping | Dumps and reports of this rehearsal are deleted (section 18) or have a dated deletion plan within 7 days (section 0, rule 4). | The deletion line. |

Any "no" is a no-go. The lead may waive a criterion only in writing in the issue, with the reason.

## 15. Freeze window and delta run (BE-30)

**Why a freeze.** The delta run re-reads the whole fresh dump. It does not propagate deletes (there is no soft delete in .cloud), so a row removed in .cloud after the first load would stay in v2. The freeze keeps .cloud from changing between the final dump and the switch, so the final state is complete and nothing is deleted behind our back. The upsert skips unchanged rows by `legacy_hash`, so only changed and new rows are written. The extract has no `updated_at` filter because the streak, wallet and JPN/PPD steps aggregate across rows.

**Who.** `.cloud` is never modified by us. The freeze is an operational decision (maintenance mode or a stop of writes) of the .cloud owner. We only ask for it and are told when it starts and ends.

| Step | Action | Owner | Evidence |
|---|---|---|---|
| T-0 | Freeze of .cloud writes starts. Record the time. | `<MIG-08 owner>` with the .cloud owner | Timestamp. |
| T+1 | Final dump (raw, then anonymised for a rehearsal; for the real cutover per OD-2 and `<MIG-08 owner>`). Record the dump time `T-dump-final`. | lead | Timestamp. |
| T+2 | `staging:load` of the final dump on the target database. | devops | Exit 0, counts against the manifest. |
| T+3 | Precondition: an earlier `migrate:all --apply` succeeded. Delta dry-run: `npm run migrate:delta -w @pp/api -- --since=<time of the previous dump> --as-of=<same date as the full run>`. | be / devops | Exit 0, delta report. |
| T+4 | Delta apply: `PP_ALLOW_MIGRATE_APPLY=1 npm run migrate:delta -w @pp/api -- --since=<same> --as-of=<same> --apply`. | devops | Exit 0, duration. |
| T+5 | `migrate:verify` (also run by the delta). Go/no-go of section 14. | lead | `pass`, sign-off line. |
| T+6 | Switch (the v2 system serves users). If no-go, section 16. | `<MIG-08 owner>` | Timestamp. |

Notes.

- `--since` is the time of the **previous** dump (the one already loaded), in ISO 8601. It feeds the delta report only: rows with `updated_at > since` per staged table against inserted and updated per entity. A large gap between the two numbers needs an explanation (for example rows changed by aggregation steps).
- Use the same `--as-of`, `--batch-size`, `--content-owner` and `IC_HASH_KEY` as the full run; a different value changes hashes and rewrites rows.
- A source delete made before the freeze but after the previous dump is not removed in v2. Record such rows if the .cloud owner knows of any.
- The detailed cutover timeline (30 Oct) is MIG-08 and will live in a later section or document.

## 16. Rollback (BE-30)

**When.** Any no-go in section 14 after the apply, or after the switch, for example: `migrate:verify` fails; the orphan scan is above 0; users report that logins or their data are wrong; the timings would not fit the window; a PDPA incident (section 0, rule 8) touches the loaded data. The lead decides.

**Procedure A: rehearsal database.** Drop the database, or the target schema, and re-create it from the migrations (`DATABASE_URL` points at the scratch `_staging` database). This is the simplest and is the default for a rehearsal.

**Procedure B: shared database** (a database with other data, or with v2-born rows).

1. Stop writes to the migrated data if the switch already happened (`<MIG-08 owner>`).
2. Dry-run: `npm run migrate:rollback -w @pp/api -- --confirm=<database name>`. It counts the rows per table and deletes nothing. Read the counts.
3. Apply: `PP_ALLOW_MIGRATE_APPLY=1 npm run migrate:rollback -w @pp/api -- --confirm=<database name> --apply`. In production also set `PP_MIGRATE_TARGET_DB=<database name>`. `--confirm` must equal `current_database()`, otherwise it is refused (exit 2).

What it does: in one transaction it deletes every row with `legacy_source = 'cloud'` from every migratable table, children first, and the `etl_id_map` rows of the source. Rows born in v2 are never deleted. If a v2-born row references a migrated row, the rollback **aborts** and changes nothing; the lead decides how to handle those rows (nothing is forced). `etl_runs`, `etl_recon` and `etl_rejects` are kept as the audit trail.

**Prove the result.** Do not re-run `migrate:verify`; it reads the loaded data and would report mismatches by design. Instead:

1. Compare the per-table counts with the pre-migration snapshot (checklist item 6). They must be equal.
2. For every migratable table: `SELECT count(*) FROM <table> WHERE legacy_source = 'cloud';` must return 0.
3. `SELECT count(*) FROM etl_id_map WHERE legacy_source = 'cloud';` must return 0.
4. Record the counts and the duration as text in the issue.

**The source stays untouched.** The migration reads `staging_cloud`, which is a copy, and the dump or restore is read only through a role that is proven read-only by its privileges (section 3: the load aborts with exit 3 if the role could write). Nothing in rollback touches .cloud or `.my`. After a rollback the cutover can be tried again from `staging:load`.

## 17. Post-cutover verification (BE-30)

1. **Archive the verify report.** The final `.migration-out/recon-<runs>-<stamp>.json/.md` holds aggregates and surrogate ids only, and `.migration-out/` is git-ignored. Keep it in the lead's encrypted storage. Never attach it to a PR or an issue; put the counts in text. If a report holds anything other than aggregates, treat it as a PDPA incident (section 0, rule 8).
2. **Smoke checks** on the production system after the switch: health endpoint green; a student, a teacher, a parent and an admin each log in with their own account; the dashboards show non-empty history for a sample of accounts; the wallet balance of a sample matches the reported ledger rows; JPN/PPD pickers list the derived rows. Record pass or fail only.
3. **First login.** Roster accounts (those with a `username`) are forced to reset the password on first login. Accounts whose legacy hash is not bcrypt, or equals a shared default hash, are forced to reset too (data-migration section 5, "Passwords and hashes"). Everyone logs in again; no legacy token was migrated. Expect a spike in password-reset requests and tell support.
4. **Accepted drift.** Streak, mastery and rankings differ from .cloud by design. Tell support which figures can change.
5. **Backfill.** `migrate:link-questions` (section 12) can be run any time after the cutover. Cutover does not wait for it.
6. **.cloud stays read-only** after the cutover and is not modified by us (D28a).

## 18. Deletion of dumps after cutover (BE-30)

Extends sections 5 and 10. Timing follows section 0, rule 4: delete as soon as the load and reconciliation succeed, and within 7 days at most.

| Delete | Who | When |
|---|---|---|
| Raw dump or restore, anonymised dump directory, the encrypted archive and every copy that was handed out, the `pp_staging_reader` role | lead (custodian) | After the final verify is `pass` and signed off. |
| The key file `ANON_HMAC_KEY_FILE` and any history that held a key | lead | With the dump. |
| `staging_cloud` schema (`drop schema staging_cloud cascade;`) | devops | After the sign-off and after the rollback window has closed. Until then it is the input for a re-run, so keep it. |
| `.migration-out/` reports and profiles that contain surrogate ids; the restricted `CLOUD_SOURCE_URL` file | lead, devops | After the numbers were copied into the issue as text. |
| Write-ahead log, base backups, snapshots and replicas of the server that held the dump; temporary and spill files (section 5, items 3 and 4) | devops | With the dump. |

**Kept:**

| Keep | Why | For how long |
|---|---|---|
| `archive_cloud` (legacy and canonical question tables) | Read-only archive that supports the backfill and disputes (data-migration section 3.3, item 5). Not served by the API. | The retention period in data-migration 3.3 item 5 (default 12 months), then delete. |
| `etl_runs`, `etl_recon`, `etl_rejects` (and `etl_checkpoints`) | Audit trail of the migration. Holds counts, reason codes and surrogate ids, no personal values. | With the database. |
| `etl_id_map` | Needed by the backfill and by any later delta. Do not delete it after a successful cutover. | With the database. |

**Record the deletion.** The lead writes a dated line in the issue with no data in it, for example: `<date>: raw dump, anonymised dump, key file, staging_cloud, reports deleted; WAL and backups of <machine label> checked; archive_cloud kept until <date>; signed <lead>`. Each machine on the lead's list of copies (section 0, rule 4) gets a tick.
