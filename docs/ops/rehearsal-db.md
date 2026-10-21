# Rehearsal database for the .cloud -> v2 migration (MIG-07, AZ-30)

A production-like PostgreSQL 16 that is separate from every other stack, built to rehearse three things: a green full run of the data migration, a tested rollback, and a delta run. It is driven by one script, `deploy/rehearsal/rehearsal-db.sh`, with the compose file `deploy/rehearsal/compose.rehearsal.yaml` behind it. The migration commands themselves (`staging:load`, `migrate:*`) and their rules are in `docs/architecture/v2-migration-runbook.md`; this page only supplies the environment and the order of steps.

**Personal data (PDPA).** The anonymised dump is pseudonymised data about minors. It stays outside the repo (the script refuses a path inside it), on a full-disk-encrypted machine, is kept 7 days at most and is deleted as soon as the load and the reconciliation succeed (migration runbook section 0, rule 4, and section 9 below). Report any suspected incident to the lead at once.

## 1. What it creates

| Object | Name (default) | Purpose |
|---|---|---|
| Target database | `pp_rehearsal` | The v2 database. Migrated with all `apps/api/prisma/migrations`. `migrate:*` reads `staging_cloud` from it and writes v2 tables to it. |
| Staging database | `pp_rehearsal_staging` | Where `staging:load` runs. The loader refuses any database whose name does not end in `_staging`. |
| Source database | `pp_rehearsal_source` | A restore of the anonymised `pg_dump` (only for the PostgreSQL route). |
| Read-only role | `pp_staging_reader` | `CLOUD_SOURCE_URL` role: SELECT only, checked by the script and again by the loader. Password generated into the state dir. |
| Snapshots | `pp_rehearsal__snap_<name>` or `<state dir>/snapshots/<name>.dump` | Rollback points. |
| State dir | `~/.local/state/pp-rehearsal/<host>-<port>-<db>/` (mode 700, outside the repo) | Reader password, `IC_HASH_KEY`, row-count files, `timings.log`. Nothing secret is in the repo or on a command line. |

Every database and the role carry the comment `pp-rehearsal:v1`. The script drops only objects that carry it, so a typo in `PP_REHEARSAL_DB` cannot drop a real database.

Why a staging DB and a target DB: `migrate:core` reads `staging_cloud` from the same database it writes to (`DATABASE_URL`), but `staging:load` only runs on a `*_staging` database. `stage` loads in the staging database and copies the two staging schemas (`staging_cloud`, `archive_cloud`) into the target. Staging is dropped and recreated per rehearsal; it never serves the API.

## 2. Prerequisites

- A machine with full-disk encryption, at least 4 GB RAM and free disk of about 5 times the dump size.
- PostgreSQL client tools 16 on the host: `psql`, `pg_dump`, `pg_restore` (`postgresql-client-16`).
- Node 22 and `npm ci` in the repo root (for `staging:load` and `migrate:*`).
- Docker mode only: Docker with Compose v2.
- Host mode only: a PostgreSQL 16 server and a role with `CREATEDB` and `CREATEROLE`.
- The anonymised dump from the lead (never from a PR, chat or CI), with its checksum (mandatory; `load-dump` fails without it): the `.sha256` sidecar, a `pg_dump -Fc` file (`x.dump` + `x.dump.sha256`), a `pg_dump -Fd` directory (+ `SHA256SUMS` inside), or a `pp-staging-dump/1` directory.

## 3. Configuration (names only)

Docker mode (default): `cp deploy/rehearsal/.env.rehearsal.example deploy/rehearsal/.env.rehearsal` (git-ignored), then set `POSTGRES_PASSWORD` to `openssl rand -hex 24` (letters and digits only).

| Variable | Default | Meaning |
|---|---|---|
| `PP_REHEARSAL_MODE` | `docker` | `docker` (container from the compose file) or `host` (an existing Postgres 16). |
| `PP_REHEARSAL_ADMIN_URL` | - | Host mode: `postgresql://ROLE[:PASSWORD]@HOST:PORT/postgres`. A non-loopback host needs `?sslmode=require` (better `verify-full`). Set it from a 600 file, not by hand (runbook rule 7). |
| `PP_REHEARSAL_DB` | `pp_rehearsal` | Target name; `<name>_staging` and `<name>_source` derive from it. |
| `PP_REHEARSAL_PORT` | `55433` | Docker: loopback port. |
| `PP_REHEARSAL_ENV_FILE` | `deploy/rehearsal/.env.rehearsal` | Docker mode settings file. |
| `PP_REHEARSAL_STATE_DIR` | `~/.local/state/pp-rehearsal` | Must be outside the repo. |
| `PP_REHEARSAL_MIGRATE` | `prisma` (docker), `psql` (host) | How `up` applies migrations (section 8). |
| `PP_REHEARSAL_READER_ROLE` | `pp_staging_reader` | Name of the read-only role for the source restore (`CLOUD_SOURCE_URL`). |
| `PP_REHEARSAL_SOURCE_SCHEMA` | `public` | Schema of the restored dump that holds the .cloud tables. |
| `PP_REHEARSAL_RESTORE_JOBS` | `2` | `pg_restore -j`. |
| `PP_PG_*` | see `.env.rehearsal.example` | Postgres tuning. Set to the real production VPS values. |

Flags (before any `--`): `--dry-run` prints the plan and changes nothing; `--yes` confirms a destructive step (`restore-snapshot`, `reset`, `down`); `--dump` makes a snapshot a dump file; `--keep-volume` (docker `down`); `--sha256 <hex>` (the expected hash, when there is no sidecar) or `--no-sha-check` (skip the integrity check on purpose; prints a warning) for `load-dump`.

## 4. Full run (copy-paste)

Run from the repo root. `RDB=deploy/rehearsal/rehearsal-db.sh`. Add `--dry-run` to any line to see what it would do.

```bash
RDB=deploy/rehearsal/rehearsal-db.sh
# host mode only:  export PP_REHEARSAL_MODE=host; set -a; . /secure/path/rehearsal.env; set +a   (file holds PP_REHEARSAL_ADMIN_URL)

# 1. Empty database with ALL migrations applied and verified (applied == folders)
$RDB up
$RDB status

# 2. Accept the anonymised dump (outside the repo; the sha256 sidecar is REQUIRED: no sidecar -> pass --sha256 <hex>)
$RDB load-dump /secure/path/anon-YYYYMMDD.dump

# 3. staging:load from the read-only restore, then copy staging_cloud + archive_cloud into the target
$RDB stage

# 4. Rollback point of the target (staged, not migrated)
$RDB snapshot pre_etl

# 5. Dry-run, then apply. Reads staging_cloud, writes v2 tables, in the target.
$RDB exec target -- npm run migrate:core -w @pp/api -- --dry-run
PP_ALLOW_MIGRATE_APPLY=1 $RDB exec target -- npm run migrate:core -w @pp/api -- --apply
#   BE-29/BE-30 stages (migrate:<name>, migrate:all, migrate:verify) follow the same pattern as they land:
#   $RDB exec target -- npm run migrate:verify -w @pp/api
```

Rules the commands above rely on (from the migration runbook, enforced by the tools):

- `staging:load` needs a `*_staging` database, `PP_ALLOW_STAGING_RESET=1` and `NODE_ENV` not production. `stage` and `load-dump` set these for `<db>_staging` only. Exit codes: 3 the source role can write, 4 reset guard refused.
- `--apply` needs `PP_ALLOW_MIGRATE_APPLY=1` and a passing `--dry-run` on the same input first. After any rollback the dry-run must be repeated.
- `PP_MIGRATE_TARGET_DB` (must equal the connected database) is demanded only when `NODE_ENV=production`. The rehearsal cannot run in production mode, because the ETL refuses anonymised or synthetic data there. Rehearse that guard once with a synthetic fixture: `NODE_ENV=production PP_MIGRATE_TARGET_DB=<db> PP_ALLOW_MIGRATE_APPLY=1 ... --apply`, or at least check the refusal without `PP_MIGRATE_TARGET_DB`.
- Script flags such as `--dry-run` and `--with-source` go BEFORE the `--`; everything after the `--` belongs to the command, so the `--dry-run` / `--apply` at the end of the lines above are the ETL's own flags. To preview what the script would run: `$RDB exec target --dry-run -- npm run migrate:core -w @pp/api -- --dry-run` (a `--dry-run` after the first `--` is NOT seen by the script).
- `exec` adds `DATABASE_URL`, `CLOUD_SOURCE_URL` (with `--with-source`) and a stable `IC_HASH_KEY` (from the state dir, unless you set one) to the child process environment only (never its command line). A symlinked dump path is resolved first, so a link into the repo is refused.
- A `pp-staging-dump/1` directory goes in at step 2 straight into the staging database, and `stage` then only does the copy. The latest `load-dump` decides the route `stage` takes.

## 5. Verify

After step 5: every reconciliation row must be `ok` (counts: source, eligible, loaded, rejected). Spot checks:

```bash
$RDB status                                           # migrations n of n, schemas present, sizes
$RDB exec target -- npm run migrate:verify -w @pp/api # once BE-30 is merged
```

## 6. Rollback test

```bash
$RDB snapshot pre_etl                # done in step 4 (needs no other sessions on the target; or: snapshot pre_etl --dump)
# ...migrate:* --apply runs...
$RDB restore-snapshot pre_etl --yes  # drops the target, recreates it from the snapshot
```

The script records exact row counts of every public table at snapshot time and compares after the restore. Pass criterion: `ROLLBACK VERIFIED: every table ... has the snapshot's row count again (N table(s) differed before the rollback)` and `MIGRATION CHECK PASSED`. Record the restore time. Then repeat `--dry-run` before the next `--apply`. The template copy is fastest but lives in the same server; for the "restore from a real backup" drill use `snapshot <name> --dump` (a `pg_dump -Fc` file with a checksum, restored with `pg_restore`) and also the production drill in `docs/ops/db-backup.md`. The source database is untouched by a rollback (the reader role cannot write; the script proves it at load time).

## 7. Delta rehearsal

Simulates the freeze-window run. Ask the lead for a second anonymised dump taken after a known set of changes (made with a new key, so the fakes differ: say so, and compare counts, not identities), or change a few rows in the source restore by hand as the admin role.

```bash
$RDB snapshot after_full --dump         # optional second rollback point
$RDB load-dump /secure/path/anon-delta.dump
$RDB stage                              # replaces staging_cloud / archive_cloud in the target
$RDB exec target -- npm run migrate:core -w @pp/api -- --dry-run
PP_ALLOW_MIGRATE_APPLY=1 $RDB exec target -- npm run migrate:core -w @pp/api -- --apply
# BE-30: $RDB exec target -- npm run migrate:delta -w @pp/api -- --dry-run   then --apply, run twice (idempotent)
```

`load-dump` recreates the source database, `stage` reloads staging in full (the loader has no partial reload). Record the time of each step: the freeze window is their sum.

## 8. Hosts without the Docker image (host mode, psql path)

`PP_REHEARSAL_MIGRATE=psql` (default in host mode) applies each `apps/api/prisma/migrations/*/migration.sql` in name order with `psql -1` (one transaction per migration) and, in the same transaction, inserts the Prisma bookkeeping row into `_prisma_migrations` (`checksum` = sha256 of the file, `applied_steps_count` 1). This is what the test suite does (`apps/api/test/support/global-setup.ts`) plus the bookkeeping, so `prisma migrate deploy` later sees every migration as applied and `GET /api/ready` reports `migrations: applied`. The row format was checked against the table Prisma creates and the readers in this repo, but not against a live Prisma engine in the AZ-30 rehearsal; if the first `prisma migrate deploy` reports a checksum difference, the checkout line endings differ (CRLF) from the files that were applied. The Docker `migrate` image (`prisma migrate deploy`) stays the primary path; use `PP_REHEARSAL_MIGRATE=prisma` with a working Prisma on the host to get it in host mode.

## 9. Teardown and deletion (PDPA)

```bash
$RDB down --yes        # docker: removes the container, network and the data volume. host: drops all rehearsal databases and the role.
```

Then, by hand, with the lead's confirmation (runbook sections 5 and 10): delete the dump file or directory and its sidecar; the key file; the `pp-staging-dump` copies; `.migration-out/`; restore temp files and `/tmp` leftovers; shell history lines containing a URL; for host mode the WAL, base backups and replicas of the server that held the data; and the trash. Snapshots made with `--dump` live in the state dir and are removed by `down`. Keep at most 7 days. Keep `timings.log` figures (no personal data) before running `down`, since `down` deletes the state dir.

## 10. Where it differs from real production

| Aspect | Rehearsal | Production |
|---|---|---|
| Hardware | Whatever the rehearsal machine is (settings parameterised) | The VPS (AZ-09 pack) |
| Postgres settings | `shared_buffers` 1GB, `work_mem` 16MB, `maintenance_work_mem` 256MB, 100 connections, UTC, `fsync` / `synchronous_commit` / `full_page_writes` on, `wal_level=replica`, `wal_compression`, `log_min_duration_statement` 500ms, compose defaults for a 4 GB box | Set to the real box; the script `status` prints what is active. Host mode shows the host's own settings and warns when `fsync` is off. |
| Table owner | The admin role owns every table | An application role with least privilege |
| Data | Anonymised; ids and timestamps kept; student, teacher, parent accounts share a dummy password | Real; `NODE_ENV=production` and the ETL refuses anonymised data |
| `PP_MIGRATE_TARGET_DB` guard | Not exercised (needs production mode) | Required |
| Backups, WAL archiving, TLS to the DB, monitoring | None (archive nothing: dump deletion) | Yes |
| API and frontend | Not started; no sessions on the DB (snapshots rely on that) | Running behind the freeze |
| Volume | Whatever the lead's dump holds | Full data |

## 11. Timings to record

`$RDB status` prints `timings.log`: `up`, `migrate`, `load-dump`, `staging:load`, `stage-copy`, `snapshot`, `restore-snapshot`. Add by hand: each `migrate:*` stage duration (from its output), dump size, database size after each stage (`status`), peak rows per second, the largest table's load time, and WAL generated by the run. Query it before and after the apply: `select pg_current_wal_lsn()` on both and subtract with `pg_wal_lsn_diff(after, before)`. Also note memory and disk use on the machine. These feed the freeze-window estimate and the go/no-go.

## 12. Troubleshooting

| Symptom | Fix |
|---|---|
| `MIGRATION CHECK FAILED` | Names printed are missing or extra; run `up` again (it only applies what is missing); a failed row in `_prisma_migrations` needs a manual look (same as `prisma migrate`). |
| `N other session(s) are connected` on `snapshot` | Stop the ETL/API/psql sessions, or use `--dump`. |
| `staging:load` exit 3 | The reader role has a write privilege; do not continue, report to the lead. |
| `staging:load` exit 4 | Database name does not end in `_staging` or `NODE_ENV=production` is set. |
| `exists but was not created by this tool` | The database or role name is already used by something else; choose another `PP_REHEARSAL_DB` / `PP_REHEARSAL_READER_ROLE`. |
| Dump kind not recognised | Plain `.sql` is not accepted; ask the lead for `pg_dump -Fc` (or `-Fd`) or a `pp-staging-dump/1` directory. |
