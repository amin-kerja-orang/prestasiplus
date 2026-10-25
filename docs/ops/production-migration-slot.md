# Production migration slot on the VPS, 29-30 Oct 2026 (MIG08-PREP)

- **Owner:** half AZ (AZ-DevOps). **Item:** MIG08-PREP, from the LEAD DECISION of 22 Oct 2026, 10:30 MYT on #109:
  MIG-08 "all defaults".
- **What this is.** The cutover plan (`docs/ops/v2-cutover-plan.md`, half AM, lands with #124) says WHAT runs WHEN.
  This document says HOW the half-AZ steps run on the production VPS: the production `stage` step for raw data, the
  restore points, point-in-time recovery, the `.cloud` pointer page, the timings to fill in, and the go/no-go hooks.
  Step ids (A5, B5, C5, ...) and criterion numbers are the cutover plan's, in the numbering of its section 4.0
  (one night on 29 Oct: B0 to B10 run `migrate:all`, the DNS switch is C3 on 30 Oct; no delta at night).
- **Builds on:** the production runbook [production-vps.md](production-vps.md) (#116; sections 3, 7, 8, 9, 16 and 20),
  the AZ-30 rehearsal environment (`deploy/rehearsal/rehearsal-db.sh`, #117), the AM-10 dump tools (#125) and the
  orchestrator (#123).
- **Times** are MYT (UTC+8), with UTC in brackets.
- **Not run on any real server.** Section 9 lists what was rehearsed and how.

## 0. Decisions this follows (MIG-08 "all defaults", 22 Oct)

| MIG-08 item | Decision | What half AZ does |
|---|---|---|
| 7 Who types `migrate:*` | The half-AM operator, with AZ-DevOps on the host | AZ runs `slot.sh` (stage, restore points, PITR). The half-AM operator types the `slot.sh etl ...` lines. Credentials stay on the host (`/etc/pretasiplus/*.env`); no agent holds them |
| 8 Switch | **A**: v2 on its own address, and a pointer page on `.cloud` | Half AZ prepares the static page (section 5). The `.cloud` operator (half AM) places it on `.cloud`. Nothing on `.cloud` is changed by the team |
| 9 Load strategy | One night (cutover plan 4.0): freeze, export, `migrate:all` from B1 to B9; `migrate:delta` is rehearsal / replan only (plan 4.7) | Pre-night A5 and the night B0 to B10 below |
| 10 Platform | VPS, restore points `pre_etl`, `pre_delta` and `post_switch` (`pg_dump -Fc`), plus PITR | Sections 3 and 4 |
| 14 Where the raw dump is staged | **A**: a throwaway cluster | Section 2 |
| 2, 9 | Revisit if the MIG-07 timings do not fit the window | Section 7 table |

**Raw data, separate path.** Production loads the **raw** `dump:cloud` output, because the ETL refuses anonymised
data in production. The AZ-30 rehearsal script stays as it is: it accepts only attested anonymised or synthetic
dumps, and only with `NODE_ENV=development`. The production path is a different script,
`deploy/vps/migration/slot.sh`, and it refuses the reverse case:

- it refuses a dump that is not marked `"raw": true`;
- it refuses a dump marked `anonymised` or `synthetic`;
- it refuses a manifest with `large_integers`. Integers of 2^53 or more would not survive `JSON.parse`; this is
  finding N1 on #124.

The one exception is the A4 rehearsal on a scratch host (never production): `slot.sh load --from <fixture dir>
--synthetic-scratch` (A4-OVERRIDE, #315) loads a `fixtures:generate` fixture (top-level `"synthetic": true`, nothing
else) when the `prod.env` FILE says `PP_SCRATCH_HOST=yes` and `PP_OFFSITE_KIND=none` and the host name (`hostname -s`)
is typed in a terminal; a variable exported in the shell does not count, and `python3` is needed. It leaves the
marker `SYNTHETIC-LOADED` in `PP_STAGE_DIR` (`load`, `slot.sh:244`); `copy` adds `SYNTHETIC-IN-TARGET` there (`:271`). On a host
not marked scratch, `copy` and `etl --apply` then refuse the data (exit 3, `:219,221,355`), and on a scratch host `gonogo` always ends
`gonogo: NO-GO (scratch host or synthetic stage data)` with exit 3. `throwaway-up` clears the stage marker; a copy
from a raw stage clears the target marker. `deploy/vps/migration/test-scratch-override.sh` tests it with stubs.

## 1. Host preparation (T-5 d to T-2 d)

All as `ppdeploy` unless `sudo` is shown. The values go in `/etc/pretasiplus/prod.env` (see `.env.prod.example`, block
"PITR and the migration slot").

```
# folders: encrypted volume for all of them
sudo install -d -o 70 -g 70 -m 700 /var/backups/pretasiplus/wal /var/backups/pretasiplus/wal/wal /var/backups/pretasiplus/wal/base
sudo install -d -o ppdeploy -g ppdeploy -m 700 /srv/pretasiplus/stage
sudo install -d -o 1000 -g 1000 -m 700 /srv/pretasiplus/migration-out    # uid 1000 = node in the migrate image (PP_MIGRATE_UID)
# prod.env: PP_PG_ARCHIVE_MODE=on, PP_PG_ARCHIVE_TIMEOUT=1800, PP_WAL_ARCHIVE_DIR, PP_BACKUP_EXCLUDE_SCHEMAS=staging_cloud,
#           PP_STAGE_DIR, PP_STAGE_MEM, PP_STAGE_CPUS, PP_MIGRATION_OUT, PP_MIGRATE_UID=1000, PP_RAW_PURGE_BY=2026-11-06
docker compose run --help | grep -q -- --env-from-file || echo "Compose too old for slot.sh load/etl: update the plugin"
sudo deploy/vps/db-roles.sh secrets      # etl.env (pp_etl) for slot.sh etl, migrate.env (pp_owner); runbook production-vps.md 3.1
deploy/vps/deploy.sh --dry-run            # refuses a WAL folder that is missing, not uid 70, not mode 700, or in the checkout
deploy/vps/deploy.sh                      # turning archive_mode on restarts the db once (before go-live, no users)
deploy/vps/migration/pitr.sh base --label first
deploy/vps/migration/pitr.sh status       # archived > 0, failed 0
```

`ppdeploy` is made with `adduser`, so its uid is whatever was free (often not 1000). That is why the reports folder
is created here with `sudo` for the image's user: `slot.sh etl` never changes its owner or mode, it only checks them
(owner `PP_MIGRATE_UID`, mode 700) and stops with the `sudo install` line above when they are wrong. `gonogo` prints
the same check as its `reports:` line. The reports are then readable with `sudo` only.

**Dependencies.** Half AM supplies these; the slot cannot run without them:

- **D1:** #122, #123 and #125 merged and in the release, so that the `migrate` image (Dockerfile target `build`, which
  holds the sources, `tsx` and `node_modules`) carries `staging:load`, `staging:profile` and `migrate:*`.
- **D2:** `staging:load` accepts a raw manifest. This is the AM-10 round 6 DB test on #125.
- **D3:** the cutover plan's P6 rehearsal on a fresh copy, including this procedure.

**Disk.** Leave free, on the backup volume:

- 3 x the database size for the restore points;
- WAL for at least 7 days. The full load writes about 2 x the loaded data into WAL, compressed by gzip;
- 5 x the dump size on `PP_STAGE_DIR` (the cutover plan, step B0).

The `gonogo` line "disk" checks the backup volume.

**Timers during the night.** The nightly backup at 02:15 would wait for the slot's lock and then alert "BACKUP
SKIPPED", and `pp-cert-renew.timer` (03:40 and 15:40 host time) would do the same. At B0, first run one manual
`deploy/vps/backup/backup.sh` (so the newest dump is a few hours old at B9, not about 28 h: `gonogo` prints
`NO-GO (older than 24 h)` past 24 h), then stop the timers
(`sudo systemctl stop pp-backup.timer pp-restore-drill.timer pp-cert-renew.timer`). Start all three again at B10. The
restore points cover the window. (The plan rows for B0 and B10 are half AM's, MIG-08b.)

## 2. The production `stage` step (B0, B4, B5)

The rehearsal "stage" pattern, with production rules:

- **Throwaway cluster.** A `postgres:16-alpine` container (`PP_STAGE_CONTAINER`, default `pp-stage-throwaway`):
  - on the compose network, so the `migrate` image reaches it by name;
  - data dir `PP_STAGE_DIR/pgdata` (encrypted volume);
  - `archive_mode=off`, `wal_level=minimal`;
  - no backups, no replica, never reached by the API;
  - database `<POSTGRES_DB>_staging`, because the loader refuses any other name;
  - the password is random per run, kept in a 600 file, and never on a command line.
- **Load.** `staging:load --from <dir>` runs in the `migrate` image with `NODE_ENV=development` and
  `PP_ALLOW_STAGING_RESET=1`, against the throwaway database only. The loader refuses production by design. It runs
  as the calling user (`--user $(id -u):$(id -g)`), because the extract is `mkdir -m 700` and owned by the operator,
  whose uid is not always 1000.
- **Copy.** The two schemas go from the throwaway cluster into the target with `pg_dump -Fc -n staging_cloud -n
  archive_cloud | pg_restore`, after the old copies in the target are dropped. The pipe stays on this host
  (container to container), so no network transfer is involved. The table counts must be equal. The cutover plan
  expects 89 tables in `staging_cloud` and 38 in `archive_cloud`; any other number is a STOP (exit 4,
  `STAGE COPY COUNTS DIFFER`), unless the LEAD approved another pair in `PP_STAGE_EXPECT`.
- **Roles (P3, DB-ROLES #227).** The drop, the restore and every read of the target in `slot.sh` run as the stage-only
  role `pp_stager`, over the db container's local socket (no password). `copy` runs `deploy/vps/db-roles.sh apply`
  before the drop (an older copy made by another role becomes `pp_stager`'s) and after the restore (`pp_etl` gets
  `UPDATE` on `archive_cloud` for `migrate:archive-minimise`).
- **Destroy.** The container and its data dir are removed right after the copy. The receiver's `.gpg` file and the
  extracted directory are deleted as soon as the load has succeeded (cutover plan, 3.1 step 4).

```
deploy/vps/migration/slot.sh throwaway-up                          # B0
deploy/vps/migration/slot.sh load --from /srv/pretasiplus/stage/<dump dir>   # B4 (D_load)
#   B4 freeze proof (half AM): max(updated_at) <= T-freeze per staged table, read in the throwaway db
deploy/vps/migration/slot.sh copy                                  # B5 (D_copy): the first raw data in the target
deploy/vps/migration/slot.sh throwaway-down                        # B5
deploy/vps/migration/slot.sh wipe-dump /srv/pretasiplus/stage/<dump dir> /srv/pretasiplus/stage/<dump>.tar.gpg   # B5
deploy/vps/migration/slot.sh wipe-dump <dir> [<file>.gpg] --missing-ok   # the plan's STOP block only
```

`wipe-dump` exits 3 when a named path does not exist ("nothing was deleted"), so a wrong path can never print
`DUMP COPIES DELETED`. Only the STOP block, which runs whatever was or was not created, adds `--missing-ok`; it then
prints `DUMP COPIES NOT PRESENT` for paths that are already gone.

The hand-over before `load` is in the cutover plan, section 3.3, and is not repeated here. The receiving host is
this VPS. Decrypt into `PP_STAGE_DIR` (`gpg --decrypt <file> | tar -x -C /srv/pretasiplus/stage`), run the listing
check, and compare the sha256 of the `.gpg` file.

**ETL commands.** These run in the `migrate` image. The guards are set per run, never in `api.env`:

```
deploy/vps/migration/slot.sh etl staging:profile                                  # B6
deploy/vps/migration/slot.sh etl migrate:all --dry-run --as-of=2026-10-29 --files-dir=<files export>   # B6
deploy/vps/migration/slot.sh etl migrate:all --apply --as-of=2026-10-29 --files-dir=<files export>     # B7 (+ apply gate, uploads volume)
deploy/vps/migration/slot.sh etl migrate:verify                                   # B8
deploy/vps/migration/slot.sh etl migrate:questions --as-of=2026-10-29 [--apply]   # B11 (plan 4.8), after B8, before C5; dry-run first
deploy/vps/migration/slot.sh etl migrate:export-question-reports                  # C5, the Q9 export first
deploy/vps/migration/slot.sh etl migrate:archive-minimise --confirm <db> [--apply] # C5 (apply gate in both modes)
deploy/vps/migration/slot.sh etl migrate:link-questions [--apply]                 # C6, optional
deploy/vps/migration/slot.sh etl migrate:rollback --confirm <db> [--apply]        # 6.3 R-b (both gates, every run)
deploy/vps/migration/slot.sh etl migrate:delta --since=<T-dump1> --as-of=... [--apply]  # rehearsal / replan only (plan 4.7)
```

- **Accepted commands and stops.** `etl` takes only `staging:profile`, `migrate:all`, `migrate:delta`, `migrate:verify`,
  `migrate:rollback`, `migrate:questions`, `migrate:link-questions`, `migrate:export-question-reports` and
  `migrate:archive-minimise`; anything else (including the standalone `migrate:core` and `migrate:activity`) exits 2
  (`slot.sh:336-337`). Other stops: exit 3 for a missing `etl.env`, a `PP_MIGRATION_OUT` with the wrong owner or mode,
  no release sha for `migrate:all` / `migrate:delta`, and (with `--apply`) no `staging_cloud` in the target; exit 3
  for `copy`, and for `etl` only with `--apply`, when the stage or the target holds a synthetic fixture and the host is not
  marked scratch; exit 75 when another
  operation holds the shared lock after the wait of `PP_LOCK_WAIT` (1800 s). Every `migrate:*` command accepts the
  `--out-dir` that `etl` appends (ORCH-FLAGS; migration runbook, "Unknown flags are refused").
- **Role.** Every `etl` run connects as the migration role `pp_etl`: `compose run --env-from-file etl.env`, whose
  `DATABASE_URL` overrides the `migrate` service's `env_file` (`api.env`, then `migrate.env` = `pp_owner`). `etl`
  stops (exit 3) when `etl.env` is missing (`sudo deploy/vps/db-roles.sh secrets`).
  `etl.env` also carries one line `PP_MIGRATE_ROSTER_DEFAULT_HASHES=<value from the LEAD's credentials>` (name only here; never write
  the value in the repo, an issue or a chat). It must be there for **every** `migrate:*` run, B6 to B11, with the same value: it is
  part of the core input hash (`load/activity/preflight.ts:166-168`), so `migrate:questions` (B11) exits 2 when it differs from
  the one of the core apply; unset, smoke row F10 FAILs and `Z0` is 1 or more at B8 (a STOP). `db-roles.sh secrets` keeps other
  lines of an existing `etl.env` (`db-roles.sh:127-131`). `slot.sh etl` logs its own env list, not the file, so the value is not logged.
- Every run gets `NODE_ENV=production` and `PP_MIGRATE_TARGET_DB=<POSTGRES_DB>`; every `migrate:*` run also gets
  `PP_GIT_SHA=<release sha>` (`PP_RELEASE_SHA`, else `git rev-parse HEAD` of the checkout), so `etl_runs.git_sha` is
  recorded: the image has no `.git`. `migrate:all` and `migrate:delta` refuse to run without a 40-character sha.
- `PP_ALLOW_MIGRATE_APPLY=1` is added only when `--apply` is given, except for `migrate:archive-minimise` (its dry-run
  checks the gate too) and `migrate:rollback`, which always get it. `migrate:rollback` also always gets
  `PP_ALLOW_MIGRATE_ROLLBACK=1`, because the cutover plan (6.3) needs both for its dry-run too.
- The "no `staging_cloud`" pre-check runs only for `migrate:all` / `migrate:delta` with `--apply`, so
  `migrate:link-questions`, `migrate:archive-minimise` and `migrate:rollback` still run after the section 7 drop.
- **Reports.** `migrate:*` write to `<repo root>/.migration-out` by default, which is `/app/.migration-out` on the
  image's read-only root file system. `etl` therefore appends `--out-dir /app/apps/api/.migration-out` (the mounted
  `PP_MIGRATION_OUT`) unless the operator gave one. (The alternative, a #123 default change to `apps/api/.migration-out`
  so the flag is not needed, is the LEAD's choice; with it the appended flag is harmless.) `staging:profile` already
  writes there.
- **Files (P5).** `--files-dir <host dir>` is mounted read-only at `/files` and the flag is rewritten. Before the run,
  `etl` checks that uid `PP_MIGRATE_UID` can read `<host dir>/SHA256SUMS` (the extract is made under `umask 077`: give
  read access with the printed `setfacl` line). With `--apply` the api uploads volume (compose volume `apifiles`) is
  mounted at `/var/lib/pretasiplus/files` and `FILE_STORAGE_DIR` is set to it, as for the api.
- The standalone `migrate:core` and `migrate:activity` are refused, because they take no source lock (cutover plan
  4.1).
- Reports land in `PP_MIGRATION_OUT`, mounted as `apps/api/.migration-out`. They hold aggregates and surrogate ids,
  plus the deleted-at-source ids file, which is real data. Never copy them into GitHub or chat. Deletion dates are in
  the cutover plan, section 7.

## 3. Restore points

`deploy/vps/migration/restore-point.sh` covers `take`, `list`, `verify`, `restore`, `purge-raw` and `raw-check`:

- **What a point is:** a full `pg_dump -Fc` of the database, `staging_cloud` included, plus a sha256 and a line in
  `restore-points/custody.tsv`. The line gives the time, the name, the file, the sha256, the size, whether the point
  holds raw data and the WAL position.
- **Where they live:** only in `PP_BACKUP_DIR/restore-points/`. They are **never off-site**, and the `backup.sh`
  retention does not touch them.

| Name | When (cutover plan) | Holds raw `.cloud` data | Guard in the script | Deleted |
|---|---|---|---|---|
| `pre_etl` | A5 (28 Oct), after the final schema migrations, before any `.cloud` data reaches the server | no | refused if `staging_cloud` exists | kept; normal retention |
| `pre_delta` | A5, right after `pre_etl`: the same state (`gonogo` checks both; the name is kept for a replan with a delta, plan 4.7) | no (yes only if a replan takes it after a load) | none | kept; `purge-raw` if it holds raw data |
| `post_switch` | 6.3, after the switch, when v2 writes are stopped for a rollback: kept for analysis | yes, while `staging_cloud` exists | none | `purge-raw`, by 6 Nov (the LEAD may keep a copy without `staging_cloud` for analysis) |
| `post_drop` | Section 7, right after `drop schema staging_cloud cascade` | no | refused if `staging_cloud` exists | kept |

```
deploy/vps/migration/restore-point.sh take pre_etl --operator "<role or handle>"
deploy/vps/migration/restore-point.sh take pre_delta --operator "<role or handle>"
deploy/vps/migration/restore-point.sh verify pre_etl --expect-migrations repo   # A5, B0: exit 3 when the point's applied
                                                                                # migrations differ from the release's folders
deploy/vps/migration/restore-point.sh restore pre_etl       # 6.3: stops api+frontend, drop/create, pg_restore, db-roles.sh apply; typed db name
deploy/vps/migration/restore-point.sh purge-raw --after post_drop
deploy/vps/migration/restore-point.sh raw-check             # every copy that may still hold raw .cloud data
```

A `restore` **drops the production database first** and takes no dump of its current state. When the current state
may matter later (for example the writes made after the switch), take `restore-point.sh take post_switch` first; the
rollback row of section 6 already does this.

After `pg_restore`, `restore` runs `deploy/vps/db-roles.sh apply`: the restored objects belong to the superuser, and
the roles of P3 get their ownership and grants back before anything starts. A `restore` leaves `api` and `frontend` stopped. The operator checks the counts. Then the cutover plan says what
comes next (section 6.3).

**Routine backups leave `staging_cloud` out.** `backup.sh` now dumps with `--exclude-schema=staging_cloud`
(`PP_BACKUP_EXCLUDE_SCHEMAS`). So the raw copy never reaches nightly, weekly or off-site copies. `archive_cloud` stays
in them: it is kept for 12 months, decision Q12 A. The restore drill compares public tables, so it is unaffected.

**Raw-data retention has no automatic expiry, so there is a reminder.** Raw `.cloud` data sits in any restore point
taken while `staging_cloud` exists (`post_switch`, or a replan's `pre_delta`), in `staging_cloud` inside the production database, and in the PITR base backups
and archived WAL from the slot. Nothing deletes these by itself: the section 7 clean-up does, by hand, by 6 Nov
(`PP_RAW_PURGE_BY`). `restore-point.sh raw-check` lists every copy still present: kept `raw_data=yes` points, the
`staging_cloud` schema, and the base backups older than the newest `post_drop` point (all of them while there is no
`post_drop`; none before any raw data reached the host). Before `PP_RAW_PURGE_BY` it only reports. From that day on each
copy is a `RAW RETENTION OVERDUE` warning and it exits 1. When a check could not run (db down, the archive folder not
listable) it never prints `RAW CHECK OK`: it prints `RAW CHECK INCOMPLETE` and exits 2 (overdue copies still exit 1).
It runs:

- every night at the end of `backup.sh`, which sends `pp_alert` "RAW DATA RETENTION OVERDUE" on exit 1 (the backup
  itself is not failed);
- in `pitr.sh status`;
- as the `raw data:` line of `slot.sh gonogo`.

## 4. Point-in-time recovery (WAL archiving)

- **How it is set up.** `compose.prod.yaml` starts Postgres with:
  - `archive_mode=${PP_PG_ARCHIVE_MODE}` (`on` in production);
  - `archive_timeout=${PP_PG_ARCHIVE_TIMEOUT}` (1800 s = the worst-case data loss of a PITR restore);
  - an `archive_command` that gzips each finished segment into `/walarchive/wal`, which is `PP_WAL_ARCHIVE_DIR` on the
    host.
- **`deploy/vps/migration/pitr.sh`:**
  - `status`: the archiver counters, size and base backups, then `restore-point.sh raw-check`;
  - `base`: `pg_basebackup -Ft -z -X none` into `/walarchive/base/<UTC>`;
  - `restore-test --target-time`: replays into a scratch container with no network (same `max_connections` as
    production, which recovery requires), prints the counts, and destroys
    it;
  - `cleanup --keep-from <base>`: `pg_archivecleanup`, plus removal of the older base backups.
  - `--base` and `--keep-from` take only a stamp of the form `20261030T010000Z`.
- **The archive folder.** `deploy.sh` refuses `PP_WAL_ARCHIVE_DIR` unless it exists, is owned by uid 70, has mode 700
  and is outside the checkout. The WAL holds every row written, raw `.cloud` data included during the slot.

| When | Command | Why |
|---|---|---|
| First deploy (T-2 d) | `pitr.sh base --label first` | Start of the archive |
| T-2 d, after a few hours of WAL | `pitr.sh restore-test --target-time "<UTC>"` | Cutover plan P4 / criterion 8: PITR proven |
| A5, right after `pre_etl` | `pitr.sh base --label pre_etl` | Short replay for any time on 29-30 Oct |
| Weekly (Sunday, after the backup; by hand until a timer is added) | `pitr.sh base`, then `pitr.sh cleanup --keep-from <previous week's base>` | Routine retention: two weeks of PITR |
| Clean-up (by 6 Nov), after `post_drop` | `pitr.sh base --label post_drop`, then `pitr.sh cleanup --keep-from <that base>` | Deletes every WAL segment and base backup that held the raw `staging_cloud` copy (cutover plan section 7) |

A **real** PITR restore of production is a LEAD decision. It uses the same steps as `restore-test`, on a new data
dir: stop the api, start the db container on the restored dir, check, then switch. It loses every write after the
target time. Use a restore point when one fits; PITR is for a moment between two restore points.

## 5. The `.cloud` pointer page (switch option A)

`deploy/cutover/pointer-page/` holds the page and its render script:

- `index.template.html`: one static page in BM. It has no script, no external file, no cookies and no tracking. It
  gives the new address, a "Pergi ke PrestasiPlus" button, what to do when the old password is refused (Lupa Kata
  Laluan → Reset Melalui No IC, or the teacher or school admin, as AM-18 A says), and the Meja Bantuan contact. It
  works at 320, 375, 768 and 1280 px in light and dark mode.
- `render.sh`: fills in the address and contact, checks them, and prints the sha256.

```
deploy/cutover/pointer-page/render.sh --url https://<v2 host>/ --support-email <role mailbox> \
  --support-whatsapp <digits> --out /tmp/pointer/index.html
```

- **The LEAD** approves the BM text, together with the notice to schools, and supplies the address and contact
  values.
- **Half AZ** renders the page at T-1 d and hands the file and its sha256 to the `.cloud` operator (half AM).
  This hands over custody of a public page; it holds no secret.
- **The `.cloud` operator (half AM)** places it on `.cloud` at the switch (C3), as the operational switch. The team changes no `.cloud` code or data. The operator
  removes it again on a rollback after the switch (6.3), when `.cloud` is unfrozen.
- **Smoke check:** right after C3, the pointer page loads on the `.cloud` address and its button opens the v2 login.

## 6. Command sheet by step

Step ids are the cutover plan's section 4.0 (the old ids A4, A12 and B11 to B13 map as shown there).

| Step | Half AZ on the host | Half-AM / dump operator on the host |
|---|---|---|
| A3 (26 Oct) | release deployed dark; `db-roles.sh secrets` + `deploy.sh` (roles, P3); `pitr.sh base --label first` | |
| A4 (27 Oct) | `pitr.sh restore-test`; `restore-drill.sh`; this whole sheet on a restored **copy** (P6), timed | same |
| A5 (28 Oct) | after the final schema migrations: `restore-point.sh take pre_etl`, `take pre_delta`, `verify pre_etl --expect-migrations repo` (and `pre_delta`); `pitr.sh base --label pre_etl`; `slot.sh gonogo` | |
| B0 (29 Oct 00:00) | one manual `backup.sh`; timers stopped (`pp-backup`, `pp-restore-drill`, `pp-cert-renew`); `slot.sh gonogo`; `slot.sh throwaway-up` | (the dump operator runs the card alone) |
| B3 | receive, check the sha256, decrypt into `PP_STAGE_DIR` | |
| B4-B5 | `slot.sh load`, `copy` (89/38 or STOP), `throwaway-down`, `wipe-dump` | B4 freeze proof |
| B6-B8 | watches `docker stats`, disk, `pitr.sh status` | `slot.sh etl staging:profile`, `migrate:all --dry-run`, `--apply` (with `--files-dir`), `migrate:verify` |
| B9 | `slot.sh gonogo` output pasted (as text); the last line must be `gonogo: complete` | verify counts as text |
| B10 | timers started again (all three) | morning report |
| B11 (29 Oct, daylight, plan 4.8) | | `slot.sh etl migrate:questions`, then `--apply`, then `migrate:verify` (before C5 and `post_drop`) |
| STOP block | `slot.sh wipe-dump ... --missing-ok` | the plan's common block |
| C3 (30 Oct) | the v2 address goes live; pointer page handed to the `.cloud` operator (half AM) | |
| C2-C4 | smoke with v2-born accounts; monitoring | SQL checks |
| Rollback after the switch | maintenance (stop api), `restore-point.sh take post_switch`, then the plan's switch-back | `.cloud` unfreeze (owner), pointer page removed (the `.cloud` operator) |
| C5 (by 6 Nov) | | `slot.sh etl migrate:export-question-reports`, then `migrate:archive-minimise` |
| By 6 Nov | `drop schema staging_cloud cascade` (with the LEAD), `restore-point.sh take post_drop`, `pitr.sh base --label post_drop`, `restore-point.sh purge-raw --after post_drop`, `pitr.sh cleanup --keep-from <post_drop base>` | report files deleted |

## 7. Timings (fill from MIG-07, A1, A4 and the night)

Placeholders are the cutover plan's (section 4.3). Write minutes, and the source of each figure. `r` = rows per second.

| Item | Cutover step | Placeholder | MIG-07 (#133) | A1 (24 Oct) | A4 / P6 (27 Oct, copy) | Night of 29 Oct |
|---|---|---|---|---|---|---|
| `D_dump` (`dump:cloud`) | B2 | 25 | | | | |
| `D_xfer` (encrypt, transfer, checksum, wipe) | B3 | 15 | | | | |
| decrypt + listing check on the VPS | B3 | (in `D_xfer`) | | | | |
| `throwaway-up` | B0 | 1 | | | | |
| `D_load` (`slot.sh load`) | B4 | 20 | | | | |
| `D_copy` (`slot.sh copy`, two `db-roles.sh apply`) | B5 | 10 | | | | |
| `restore-point take pre_etl` / `pre_delta` | A5 | `D_snap` | | | | |
| `pitr.sh base` | A5 | | | | | |
| `D_profile_dry` (`staging:profile` + `migrate:all --dry-run`) | B6 | `N_core / r` | | | | |
| `D_apply` (`migrate:all --apply`) | B7 | `2 x N / r` | | | | |
| `D_verify` + read-only smoke | B8 | 20 | | | | |
| `restore-point restore pre_etl` | 6.3 | `<min>` | | | | |
| `migrate:rollback --apply` | 6.3 | `<min>` | | | | |
| **Window `W` = 1.25 x sum (B1 to B9), at most 360** | P7 | 1.25 x (125 + ETL) | | | | |

If `W` does not fit the night window (cutover plan 4.3, default 6 h), the LEAD decides before G6 (P7).

## 8. Go/no-go hooks (infrastructure part)

`deploy/vps/migration/slot.sh gonogo` prints one text line per check: names, counts and ages only, no data. Paste it
into the issue at A5, B0 and B9. Its last line is `gonogo: complete (every check above ran)`: a run cut short (db
down, `set -e`) has no `NO-GO` line but also no end line, so it never reads as clean.

| Line | Cutover plan criterion | No-go when |
|---|---|---|
| `restore point pre_etl / pre_delta present, sha256 ok, migrations equal the release` | 8 (backups before the first write, taken after the final schema migrations) | either one is missing, damaged, or holds another number of applied migrations than `apps/api/prisma/migrations` (`verify --expect-migrations repo`) |
| `PITR on, last archived WAL ..., failed_count N` | 8 (PITR on) | `PITR off ... -> NO-GO at night` (a written waiver is possible in daylight only), or `failed_count` growing |
| `stage: archive_cloud:N staging_cloud:M` | 13 and 4.1 B5 (the copy happened) | counts differ from the throwaway cluster |
| `backup: newest dump is N h old` | 8, and section 16 of the runbook | more than 24 h (`-> NO-GO (older than 24 h)`), or none |
| `disk: N% free on the backup volume` | runbook section 16 | 30 % or less |
| `stage disk: N GiB free on <PP_STAGE_DIR>` | 3.1 / B0 (5 x the dump size) | compared by hand with the dump size (no automatic NO-GO) |
| `api: /api/ready through the edge` | 9 (before the switch: health) | not 200 |
| `throwaway: none running` | 3.1 step 4 (destroyed after the copy) | still running after B5 |
| `reports: <dir> ready (owner uid 1000, mode 700)` | none (the ETL steps need it) | missing or wrong owner/mode: every `etl` step would stop |
| `raw data: RAW CHECK ...` | none: cutover plan section 7 (information) | never a no-go; after 6 Nov it must read `RAW CHECK OK` (`RAW CHECK INCOMPLETE` = could not check) |
| `gonogo: complete (every check above ran)` | the B9 checklist | missing: the run stopped half way, treat as NO-GO |
| `host: PP_SCRATCH_HOST=yes in <prod.env> (A4 scratch host)  -> NO-GO on production`, `stage data: SYNTHETIC fixture loaded ...`, `target data: SYNTHETIC copy in the target ...` | none (A4 only) | any of them on the production host is a no-go; on the A4 scratch host they are expected |
| `gonogo: NO-GO (scratch host or synthetic stage data)`, exit 3 | none (A4 only) | replaces the `complete` line; expected on the A4 scratch host only, a no-go anywhere else |

These criteria are checked by people, not by the script:

- 10, rollback rehearsed: the timings in section 7;
- 11, housekeeping plan dated: section 6, last row;
- the uploads gate and the certificate rows of the runbook, section 16.

## 9. Rehearsed here, and what is not

**Rehearsed** in this sandbox, with fictitious data only. There is no Docker daemon here, so the docker CLI was
replaced by a stand-in that maps `docker compose exec db` and `docker exec <throwaway>` onto a local PostgreSQL 16:

- **`restore-point.sh`:** take `pre_etl` (`raw_data=no`), take `pre_delta` (`raw_data=yes`, `staging_cloud` inside),
  verify, `restore pre_etl` (the later write is gone, `staging_cloud` is gone), `restore pre_delta` (the stage is
  back), both guards refuse correctly, `post_drop`, and `purge-raw` (deletes `pre_delta` and marks it deleted in
  custody).
- **`slot.sh`:**
  - `load` refuses an anonymised, a synthetic, an unmarked, a `large_integers` and a `.partial` dump (the scratch
    override above is covered by `deploy/vps/migration/test-scratch-override.sh`);
  - `load` builds the `compose run` line (`NODE_ENV=development`, `PP_ALLOW_STAGING_RESET=1`, URL through an env file);
  - `copy` gives equal table counts and warned when they are not 89/38 (a STOP since round 4);
  - the `etl` env composition is right (the apply gate only with `--apply`, both gates for rollback, `migrate:core`
    refused);
  - `gonogo` lines, `throwaway-down`, `wipe-dump`;
  - the shared lock refuses a second operation.
- **`backup.sh`:** the nightly dump has 0 `staging_cloud` entries and keeps `archive_cloud`.
- **Review fixes (stand-in docker, fictitious custody file):** `etl` stops with the `sudo install` line when the
  reports folder is missing or has the wrong owner or mode, and runs when it is right; `raw-check` reports before
  `PP_RAW_PURGE_BY` (exit 0), warns and exits 1 after it (raw point, `staging_cloud`, base backup older than
  `post_drop`), and is OK when no raw data was ever there; `purge-raw` leaves a custody path outside `restore-points/`
  in place; `pitr.sh` refuses `--keep-from ../x`.
- **PITR, run natively** with the exact `archive_command`, `pg_basebackup -Ft -z -X none` and the restore settings of
  `pitr.sh`:
  - 4 segments archived, 0 failed;
  - replay to a target time between two inserts gave exactly the expected 1,500 of 3,000 rows ("recovery stopping
    before commit"), then promoted;
  - `pg_archivecleanup -x .gz` keyed on the `.backup` history file of the base label removed the older segments.
- **Pointer page:** rendered; `render.sh` refuses `http://`, an HTML break-out attempt and a path inside the repo; no
  horizontal scroll at 320, 375, 768 or 1280 px.
- **Static checks:** `shellcheck -x` clean; `docker compose config -q` with the overlay renders the archive settings
  and the `/walarchive` mount.

- **Round 4 (AZ, 23 Oct; base `ad46031b` with DB-ROLES #227, AM1-3's PC-4 patches):** a local PG16 cluster with
  `pg_hba` like the image (socket and loopback trust), the 36 release migrations, and the real
  `deploy/vps/db-roles.sh apply` (real `apply.sql`); the stand-in docker maps `compose exec db` and the throwaway
  `docker exec` onto it:
  - `copy` restores as `pp_stager` over the socket: both schemas end up owned by `pp_stager`, `pp_etl` has `SELECT` on
    `staging_cloud` and `UPDATE` on `archive_cloud`, `pp_app` has nothing on them; an older copy owned by the superuser
    is handed over and dropped; a 3/2 count stops with exit 4 unless `PP_STAGE_EXPECT` names it;
  - `restore-point.sh take` / `verify --expect-migrations repo` (36 = 36) / `--expect-migrations 35` (exit 3) /
    `restore pre_etl --yes`, after which `public` and its 197 tables are `pp_owner`'s again with the grants of P3;
  - `raw-check` with the db down: `RAW CHECK INCOMPLETE`, exit 2 (exit 1 when an overdue copy is also found);
  - `wipe-dump` on a missing path exits 3, with `--missing-ok` prints `DUMP COPIES NOT PRESENT`; `gonogo` prints the
    migration check, `NO-GO (older than 24 h)`, the stage disk line and `gonogo: complete`.
- **Round 4, real Docker Engine and Compose v5.6.1** (no registry access, so the `migrate` image was a stub that prints
  its uid, argv, environment and mounts): `slot.sh etl migrate:all --apply --files-dir <dir>` through
  `compose.yaml` + `compose.prod.yaml` ran as uid 1000 with `DATABASE_URL` of **`pp_etl`** (so `--env-from-file
  etl.env` overrides the service's `api.env` / `migrate.env`), `--files-dir /files --out-dir
  /app/apps/api/.migration-out`, `FILE_STORAGE_DIR`, `PP_GIT_SHA`, and the reports folder, `/files` and the uploads
  volume mounted; `migrate:rollback` got both gates; `load` ran as the caller's uid with the throwaway URL.

**Not run, so unproven until P6 on a real host:**

- the real containers: the throwaway `docker run`, `compose run` of the `migrate` image with the ETL scripts (needs D1
  and D2), the `pg_basebackup` replication connection inside the db container, and `restore-test` in a scratch
  container;
- the uid 70 folder ownership with the real image;
- the real dump size, the times of section 7, and the disk headroom.

## 10. Open points

1. **D1 to D3** (section 1) are half AM's. The slot cannot run without #122, #123 and #125 in the release.
2. **Who freezes `.cloud`.** The LEAD DECISION text names the half-AM `.cloud` operator. The cutover plan's default 5 A names the `.cloud`
   owner. AM1-3 raised this on #124; half AM aligns it.
3. **v2 is reachable before the switch.** Under option A the v2 address serves from the first deploy, and the migrated
   data is there from B7 (29 Oct). Sign-in still needs a password, and the address is not announced until the pointer
   page. If the LEAD wants v2 closed until the switch (C3), an edge allow-list (team addresses only) is a small follow-up on the
   edge config. It is not built here.
4. **Restore points are on-host only** (raw data must not go off-site). A disk loss on the VPS between B5 and the
   clean-up loses them. The off-site nightly copies (without `staging_cloud`) and `pre_etl` remain.
5. **F1, the reports folder (LEAD).** `slot.sh etl` appends `--out-dir /app/apps/api/.migration-out` (this PR). The
   alternative is a #123 default change (`orchestrate.ts` and `verify/render.ts` resolve `apps/api/.migration-out`),
   AM1-3's note on #166. Either works; with both, the appended flag names the same folder. The choice stays the LEAD's.
