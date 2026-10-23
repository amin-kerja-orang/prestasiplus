# Production migration slot on the VPS, 29-30 Oct 2026 (MIG08-PREP)

- **Owner:** half AZ (AZ-DevOps). **Item:** MIG08-PREP, from the LEAD DECISION of 22 Oct 2026, 10:30 MYT on #109:
  MIG-08 "all defaults".
- **What this is.** The cutover plan (`docs/ops/v2-cutover-plan.md`, half AM, lands with #124) says WHAT runs WHEN.
  This document says HOW the half-AZ steps run on the production VPS: the production `stage` step for raw data, the
  restore points, point-in-time recovery, the `.cloud` pointer page, the timings to fill in, and the go/no-go hooks.
  Step ids (A4, B5, ...) and criterion numbers are the cutover plan's.
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
| 9 Load strategy | **A**: full load on 29 Oct, then the delta inside the freeze | Phase A and Phase B below |
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
docker compose run --help | grep -q -- --env-from-file || echo "Compose too old for slot.sh load: update the plugin"
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

**Timers during the night sittings.** The nightly backup at 02:15 would wait for the slot's lock and then alert
"BACKUP SKIPPED". From B0 to B13, stop the timers (`sudo systemctl stop pp-backup.timer pp-restore-drill.timer`). Start
them again at B13, and take one manual `backup.sh` then. The restore points cover the window.

## 2. The production `stage` step (A4/A5 and B0/B4/B5)

The rehearsal "stage" pattern, with production rules:

- **Throwaway cluster.** A `postgres:16-alpine` container (`PP_STAGE_CONTAINER`, default `pp-stage-throwaway`):
  - on the compose network, so the `migrate` image reaches it by name;
  - data dir `PP_STAGE_DIR/pgdata` (encrypted volume);
  - `archive_mode=off`, `wal_level=minimal`;
  - no backups, no replica, never reached by the API;
  - database `<POSTGRES_DB>_staging`, because the loader refuses any other name;
  - the password is random per run, kept in a 600 file, and never on a command line.
- **Load.** `staging:load --from <dir>` runs in the `migrate` image with `NODE_ENV=development` and
  `PP_ALLOW_STAGING_RESET=1`, against the throwaway database only. The loader refuses production by design.
- **Copy.** The two schemas go from the throwaway cluster into the target with `pg_dump -Fc -n staging_cloud -n
  archive_cloud | pg_restore`, after the old copies in the target are dropped. The pipe stays on this host
  (container to container), so no network transfer is involved. The table counts must be equal. The cutover plan
  expects 83 tables in `staging_cloud` and 35 in `archive_cloud`; the script warns on any other number.
- **Destroy.** The container and its data dir are removed right after the copy. The receiver's `.gpg` file and the
  extracted directory are deleted as soon as the load has succeeded (cutover plan, 3.1 step 4).

```
deploy/vps/migration/slot.sh throwaway-up                          # A4 (after pre_etl) / B0
deploy/vps/migration/slot.sh load --from /srv/pretasiplus/stage/<dump dir>   # A5 / B4 (D_load)
#   B4 freeze proof (half AM): max(updated_at) <= T-freeze per staged table, read in the throwaway db
deploy/vps/migration/slot.sh copy                                  # A5 / B5 (D_copy): first write to the target in Phase B
deploy/vps/migration/slot.sh throwaway-down
deploy/vps/migration/slot.sh wipe-dump /srv/pretasiplus/stage/<dump dir> /srv/pretasiplus/stage/<dump>.tar.gpg
```

The hand-over before `load` is in the cutover plan, section 3.3, and is not repeated here. The receiving host is
this VPS. Decrypt into `PP_STAGE_DIR` (`gpg --decrypt <file> | tar -x -C /srv/pretasiplus/stage`), run the listing
check, and compare the sha256 of the `.gpg` file.

**ETL commands.** These run in the `migrate` image. The guards are set per run, never in `api.env`:

```
deploy/vps/migration/slot.sh etl staging:profile                                  # A6
deploy/vps/migration/slot.sh etl migrate:all --dry-run --as-of=2026-10-29          # A7
deploy/vps/migration/slot.sh etl migrate:all --apply --as-of=2026-10-29            # A9  (+ PP_ALLOW_MIGRATE_APPLY=1)
deploy/vps/migration/slot.sh etl migrate:delta --since=<T-dump1> --as-of=2026-10-29          # A11 dry-run, B6
deploy/vps/migration/slot.sh etl migrate:delta --since=<T-dump1> --as-of=2026-10-29 --apply  # A11 apply, B7
deploy/vps/migration/slot.sh etl migrate:verify                                   # B8 (repeat)
deploy/vps/migration/slot.sh etl migrate:rollback --confirm=<db> [--apply]        # 6.3 R-b (both gates, every run)
```

- Every run gets `NODE_ENV=production` and `PP_MIGRATE_TARGET_DB=<POSTGRES_DB>`.
- `PP_ALLOW_MIGRATE_APPLY=1` is added only when `--apply` is given.
- `migrate:rollback` always gets `PP_ALLOW_MIGRATE_ROLLBACK=1` and `PP_ALLOW_MIGRATE_APPLY=1`, because the cutover plan
  (6.3) needs both for its dry-run too.
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
| `pre_etl` | A4, 29 Oct 08:00, before any `.cloud` data reaches the server | no | refused if `staging_cloud` exists | kept; normal retention |
| `pre_delta` | A12, the verified T-1 state | **yes** (`staging_cloud` T-1 copy) | none | `purge-raw`, by 6 Nov |
| `post_switch` | 6.3, after the switch, when v2 writes are stopped for a rollback: kept for analysis | yes, while `staging_cloud` exists | none | `purge-raw`, by 6 Nov (the LEAD may keep a copy without `staging_cloud` for analysis) |
| `post_drop` | Section 7, right after `drop schema staging_cloud cascade` | no | refused if `staging_cloud` exists | kept |

```
deploy/vps/migration/restore-point.sh take pre_etl --operator "<role or handle>"
deploy/vps/migration/restore-point.sh verify pre_delta
deploy/vps/migration/restore-point.sh restore pre_delta     # 6.3 R-a: stops api+frontend, drop/create, pg_restore; typed db name
deploy/vps/migration/restore-point.sh purge-raw --after post_drop
deploy/vps/migration/restore-point.sh raw-check             # every copy that may still hold raw .cloud data
```

A `restore` **drops the production database first** and takes no dump of its current state. When the current state
may matter later (for example the writes made after the switch), take `restore-point.sh take post_switch` first; the
rollback row of section 6 already does this.

A `restore` leaves `api` and `frontend` stopped. The operator checks the counts. Then the cutover plan says what
comes next: R-a is a new final dump plus a delta; after R-b, `migrate:all --apply`.

**Routine backups leave `staging_cloud` out.** `backup.sh` now dumps with `--exclude-schema=staging_cloud`
(`PP_BACKUP_EXCLUDE_SCHEMAS`). So the raw copy never reaches nightly, weekly or off-site copies. `archive_cloud` stays
in them: it is kept for 12 months, decision Q12 A. The restore drill compares public tables, so it is unaffected.

**Raw-data retention has no automatic expiry, so there is a reminder.** Raw `.cloud` data sits in the `pre_delta`
(and `post_switch`) restore points, in `staging_cloud` inside the production database, and in the PITR base backups
and archived WAL from the slot. Nothing deletes these by itself: the section 7 clean-up does, by hand, by 6 Nov
(`PP_RAW_PURGE_BY`). `restore-point.sh raw-check` lists every copy still present: kept `raw_data=yes` points, the
`staging_cloud` schema, and the base backups older than the newest `post_drop` point (all of them while there is no
`post_drop`; none before any raw data reached the host). Before `PP_RAW_PURGE_BY` it only reports. From that day on each
copy is a `RAW RETENTION OVERDUE` warning and it exits 1. It runs:

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
| A4, right after `pre_etl` | `pitr.sh base --label pre_etl` | Short replay for any time on 29-30 Oct |
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
- **The `.cloud` operator (half AM)** places it on `.cloud` at B11, as the operational switch. The team changes no `.cloud` code or data. The operator
  removes it again on a rollback after the switch (6.3), when `.cloud` is unfrozen.
- **Smoke check:** at B12, the pointer page loads on the `.cloud` address and its button opens the v2 login.

## 6. Command sheet by step

| Step | Half AZ on the host | Half-AM operator on the host |
|---|---|---|
| P3/P4 (27 Oct) | release deployed; `pitr.sh base`; `pitr.sh restore-test`; `restore-drill.sh` | |
| P6 (28 Oct) | this whole sheet on a restored **copy** (a scratch VPS or the rehearsal box), timed | same |
| A3 | receives the `.gpg`, checks the sha256, decrypts into `PP_STAGE_DIR` | |
| A4 | `restore-point.sh take pre_etl`; `pitr.sh base --label pre_etl`; `slot.sh throwaway-up` | |
| A5 | `slot.sh load --from ...`; `slot.sh copy`; `slot.sh throwaway-down`; `slot.sh wipe-dump ...` | |
| A6-A11 | watches `docker stats`, disk, `pitr.sh status` | `slot.sh etl staging:profile`, `migrate:all` dry-run, then `--apply`, then the `migrate:delta` idempotency run |
| A12 | `restore-point.sh take pre_delta`; `slot.sh gonogo` | recomputes the budget |
| B0 | timers stopped; `slot.sh gonogo`; `restore-point.sh verify pre_delta`; `slot.sh throwaway-up` | |
| B3-B5 | receive, decrypt, `slot.sh load`, `copy`, `throwaway-down`, `wipe-dump` | B4 freeze proof |
| B6-B8 | watches | `slot.sh etl migrate:delta` dry-run, then `--apply`, then `migrate:verify` |
| B9 | `slot.sh gonogo` output pasted (as text) for the LEAD | verify counts as text |
| B11 | the v2 address goes live (it already serves; announce it); pointer page handed to the `.cloud` operator (half AM) | |
| B12-B13 | smoke with v2-born accounts; timers started again; one `backup.sh` | SQL checks |
| Rollback after the switch | maintenance (stop api), `restore-point.sh take post_switch`, then the plan's switch-back | `.cloud` unfreeze (owner), pointer page removed (the `.cloud` operator) |
| By 6 Nov | `drop schema staging_cloud cascade` (with the LEAD), `restore-point.sh take post_drop`, `pitr.sh base --label post_drop`, `restore-point.sh purge-raw --after post_drop`, `pitr.sh cleanup --keep-from <post_drop base>` | report files deleted |

## 7. Timings (fill from MIG-07, P6, A11 and the night)

Placeholders are the cutover plan's (section 4.3). Write minutes, and the source of each figure. `r` = rows per second.

| Item | Cutover step | Placeholder | MIG-07 (#133) | P6 (28 Oct, copy) | A11 / Phase A (29 Oct) | Night of 30 Oct |
|---|---|---|---|---|---|---|
| `D_dump` (`dump:cloud`) | A2 / B2 | 25 | | | | |
| `D_xfer` (encrypt, transfer, checksum, wipe) | A3 / B3 | 15 | | | | |
| decrypt + listing check on the VPS | A3 / B3 | (in `D_xfer`) | | | | |
| `throwaway-up` | A4 / B0 | 1 | | | | |
| `D_load` (`slot.sh load`) | A5 / B4 | 20 | | | | |
| `D_copy` (`slot.sh copy`) | A5 / B5 | 10 | | | | |
| `restore-point take pre_etl` / `pre_delta` | A4 / A12 | `D_snap` | | | | |
| `pitr.sh base` | A4 | | | | | |
| `migrate:all --dry-run` (core) | A7 | `N_core / r` | | | | |
| `migrate:all --apply` | A9 | `2 x N / r` | | | | |
| `migrate:delta` dry-run + apply (idempotency) | A11 | `2 x N / r` | | | measured `r` = | |
| `D_dry` (delta dry-run) | B6 | `N_core / r` | | | | |
| `D_apply` (delta apply) | B7 | `2 x N / r` | | | | |
| `D_verify` + read-only smoke | B8 | 20 | | | | |
| `D_switch` (address live + pointer page placed) | B11 | 20 | | | | |
| `restore-point restore pre_delta` | 6.3 R-a | `<min>` | | | | |
| `migrate:rollback --apply` | 6.3 R-b | `<min>` | | | | |
| switch back (pointer page removed, unfreeze) | 6.3 | `<min>` | | | | |
| **Window `W` = 1.25 x sum (B1 to B11), at most 240** | P7 / A12 | 1.25 x (145 + ETL) | | | | |

If `W` is over 240 minutes at A12, MIG-08 items 2 and 9 are revisited, as the LEAD decision says.

## 8. Go/no-go hooks (infrastructure part)

`deploy/vps/migration/slot.sh gonogo` prints one text line per check: names, counts and ages only, no data. Paste it
into the issue at A12, B0 and B9.

| Line | Cutover plan criterion | No-go when |
|---|---|---|
| `restore point pre_etl / pre_delta present, sha256 ok` | 8 (backups before the first write) | either one is missing or damaged |
| `PITR on, last archived WAL ..., failed_count N` | 8 (PITR on) | `archive_mode=off` without the LEAD's written waiver, or `failed_count` growing |
| `stage: archive_cloud:N staging_cloud:M` | 13 and 4.1 B5 (the copy happened) | counts differ from the throwaway cluster |
| `backup: newest dump is N h old` | 8, and section 16 of the runbook | more than 24 h, or none |
| `disk: N% free on the backup volume` | runbook section 16 | 30 % or less |
| `api: /api/ready through the edge` | 9 (before the switch: health) | not 200 |
| `throwaway: none running` | 3.1 step 4 (destroyed after the copy) | still running after B5 |
| `reports: <dir> ready (owner uid 1000, mode 700)` | none (the ETL steps need it) | missing or wrong owner/mode: every `etl` step would stop |
| `raw data: RAW CHECK ...` | none: cutover plan section 7 (information) | never a no-go; after 6 Nov it must read `RAW CHECK OK` |

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
  - `load` refuses an anonymised, a synthetic, an unmarked, a `large_integers` and a `.partial` dump;
  - `load` builds the `compose run` line (`NODE_ENV=development`, `PP_ALLOW_STAGING_RESET=1`, URL through an env file);
  - `copy` gives equal table counts and warns when they are not 83/35;
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
   data is there from A9 (29 Oct). Sign-in still needs a password, and the address is not announced until the pointer
   page. If the LEAD wants v2 closed until B11, an edge allow-list (team addresses only) is a small follow-up on the
   edge config. It is not built here.
4. **Restore points are on-host only** (raw data must not go off-site). A disk loss on the VPS between A5 and the
   clean-up loses them. The off-site nightly copies (without `staging_cloud`) and `pre_etl` remain.
