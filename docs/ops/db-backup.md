# Database backup and restore drill (BE-33)

Backs up the PostgreSQL `db` service (`pgdata` volume) with `pg_dump` custom format (`-Fc`) and proves the backup is usable with a restore into a throwaway database.

**Personal data warning (PDPA).** A backup contains the personal data of minors (students, parents, teachers). Access is restricted to the lead and the named operator. A backup is never shared, emailed, uploaded to chat or issue trackers, or copied to a personal device. A suspected leak or a copy on an unencrypted disk is reported to the lead immediately (same rule as `docs/architecture/v2-migration-runbook.md` section 0).

## Files

| File | Purpose |
|---|---|
| `scripts/db-backup.mjs` | `npm run db:backup`: dump, checksum, retention |
| `scripts/db-restore-check.mjs` | `npm run db:restore-check`: restore into `<db>_restorecheck`, run sanity queries, drop it |
| `scripts/lib/db-ops.mjs` | shared helpers (repo-path guard, docker exec) |

Both scripts run `pg_dump` / `pg_restore` / `psql` **inside the db container** (`docker compose exec -T db`). They use the container's own `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` (from `.env.db`), so no password is read, printed or placed on a command line by the scripts. Node 22 and Docker are the only host requirements (Windows PowerShell, Git Bash and Linux all work). The stack must be running: `npm run stack:up` or `docker compose up -d db`.

## Back up

```
npm run db:backup
npm run db:backup -- --dir "E:\pp-backups" --keep 30 --max-age-days 60
```

| Option | Env var | Default | Meaning |
|---|---|---|---|
| `--dir` | `BACKUP_DIR` | `~/pp-backups` (`%USERPROFILE%\pp-backups` on Windows) | Destination. **Refused if inside the repo** (symlinks resolved). Created with mode 700. |
| `--keep` | `BACKUP_KEEP` | 14 | Keep the newest N backups. Minimum 1. |
| `--max-age-days` | `BACKUP_MAX_AGE_DAYS` | 0 (off) | Also delete backups older than D days. |
| `--container` | `DB_CONTAINER` | compose service `db` | Use `docker exec` on a named container instead (for drills or a differently named stack). |

Output: `pp-backup-<UTC timestamp>.dump` plus `pp-backup-<UTC timestamp>.dump.sha256`, then the size and sha256 on screen. The script writes to a `.partial` file, checks the `PGDMP` header, then renames; on any failure it deletes the partial file and exits non-zero (2 bad option, 3 refused path/target, 1 other). Retention runs after a successful backup, only touches `pp-backup-*.dump` files in that directory, and never deletes the newest one.

Schedule it (the lead decides the cadence; suggested daily): Windows Task Scheduler running `npm run db:backup` in the repo folder, or on Linux a cron entry `0 2 * * * cd /srv/pp && npm run db:backup`. Check the exit code and the log of the task; a failed backup must raise an alert.

## Where backups go, and protection

- Outside the repo, on an **encrypted volume**: BitLocker on Windows (`manage-bde -status D:` must show "Protection On"), LUKS on Linux. Without full-disk encryption do not store backups (migration runbook rule 5).
- `.gitignore` and the `no-dumps.yml` CI guard block `*.dump` and `*.sql.gz` in git; the scripts also refuse a destination inside the repo.
- Keep at least one copy on a **second encrypted device or an encrypted off-site location** approved by the lead; each copy follows the same retention and is listed by the lead.
- Restrict the folder: owner only (`chmod 700`; on Windows remove inherited access and grant only the operator, as file modes are not enforced there).
- The `.dump` is not encrypted by itself. If a copy must travel, encrypt it first (for example `gpg --symmetric --cipher-algo AES256`) and send the passphrase through a different channel.
- Retention default: newest 14. Real-data copies made for migration rehearsals follow the shorter 7-day rule in the migration runbook.

## Restore check (drill)

```
npm run db:restore-check                       # newest backup in the default folder
npm run db:restore-check -- --file "E:\pp-backups\pp-backup-20261020T080707Z.dump"
```

What it does: verifies the `.sha256` sidecar, creates a new database `<POSTGRES_DB>_restorecheck` on the same server, runs `pg_restore --exit-on-error` into it, prints the number of public tables, the row count of `_prisma_migrations`, and the row counts of the core tables that exist (`users`, `schools`, `sessions`, `audit_events`, `questions`), then drops the database. It prints `RESTORE CHECK PASSED` and exits 0 only if all of that worked.

Guards: the target name must be lowercase and end in `_restorecheck` and must differ from the main database (otherwise exit 3, nothing is touched); it refuses if the target already exists; it never writes to the main database (it only connects to it to run `create database` / `drop database` for the throwaway name). Use `--keep-db` to inspect the restored copy, then `docker compose exec db psql -U <user> -d postgres -c "drop database <name>_restorecheck"`.

A backup that has not passed a restore check is not trusted.

## Real restore (disaster recovery)

This replaces production data. It needs the lead's explicit confirmation first.

1. Stop writers: `docker compose stop api frontend` (keep `db` running).
2. Take a fresh safety backup of the current state if the database is still readable (`npm run db:backup`).
3. Run `npm run db:restore-check -- --file <the backup>` to prove the chosen file restores. Verify the sha256 against the value recorded when the backup was made.
4. Recreate the main database from the file. Copy the file to a temporary location the container can read (for example `docker compose cp <file> db:/tmp/restore.dump`; `/tmp` is a tmpfs), then:
   ```
   docker compose exec db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d postgres -c "drop database \"$POSTGRES_DB\" with (force)" -c "create database \"$POSTGRES_DB\""'
   docker compose exec db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error /tmp/restore.dump'
   docker compose exec db rm /tmp/restore.dump
   ```
5. Start the stack again (`docker compose up -d`); the `migrate` job runs `prisma migrate deploy` and applies any migration newer than the backup. Check `GET /api/ready` and a login.
6. Record the incident (what, when, which backup, data loss window) and tell the lead.

Uploaded files live in the separate `apifiles` volume and are not part of this dump; back that volume up with the same storage rules if uploads matter.

## Monthly restore drill

Once a month (first working day), the operator:

1. Runs `npm run db:backup` and then `npm run db:restore-check` on the **newest scheduled backup** (not the one just made), and checks the sha256.
2. Confirms the row counts look sane against the live system (users and `_prisma_migrations` are not zero and not wildly different from production).
3. Confirms the backup folder is on an encrypted volume, permissions are restricted, and the number of copies matches the lead's list.
4. Writes one line in the ops log: date, backup file name, sha256, table count, `_prisma_migrations` rows, result, operator.
5. Reports any failure to the lead the same day; a failed drill blocks releases until a good backup exists.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `service "db" is not running` | Start it: `docker compose up -d db`. |
| `Refusing to use a path inside the repository` | Choose `--dir` outside the repo folder. |
| `Refusing target ...` | Restore target must end in `_restorecheck`; do not override. |
| `Checksum mismatch` | File changed or truncated after creation; do not use it, restore from another copy. |
| `pg_restore failed ... role does not exist` | Dumps are made with `--no-owner`; if you used a different tool, add `--no-owner` to the restore. |
| Docker not found | Install Docker Desktop (Windows) or the Docker engine; the scripts call `docker` from `PATH`. |

## Environment keys

None required. Optional: `BACKUP_DIR`, `BACKUP_KEEP`, `BACKUP_MAX_AGE_DAYS`, `DB_CONTAINER` (read by the scripts from the shell environment only; they are not part of `.env.api`).
