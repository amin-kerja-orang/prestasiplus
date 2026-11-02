# R1 operator checklist (one page)

## Go-live timeline (target 22:00 MYT, 2026-11-02)

**Candidate: BASE-214 `61b788c5`** (`feature/v3-bijak-r1` `61b788c55`) = BASE-205 product code + CI fixes BASE-206/207 + the frontend CI fix BASE-209 (including + 2 icons in `src/theme/ds-icons.ts`: `footprints`, `file-x`) + the REQ-B-090 Kontrak fix (BASE-213) + e2e @api (BASE-214, an e2e-only seed fixture behind `E2E_DEMO_SECONDARY` and stale @api specs; not product code) + docs. **CI on BASE-214 is PENDING** (sign-off 6.7: `[CI BASE-214: ____ (run ____)]`, `[E2E@API: ____ (run ____)]`). Owner confirmation Q21 ("Proceed deploy") is conditional on CI green on BASE-214, a human operator running this page, and REQ-B-080 plus a full backup and a restore test before migrate. A person runs every command; teams A and B touch no server. No secrets, hosts or addresses are written here. Section numbers point at [r1-runbook.md](r1-runbook.md). Durations are estimates unless marked "rehearsal".

### A. Can start now (before CI is green; nothing here deploys or migrates)

| # | Step | Where | Duration |
|---|---|---|---|
| A1 | Full backup (`deploy/vps/backup/backup.sh --tag pre-deploy --no-files`) and a restore test into a scratch database, never the live one | section 1 below, first item; runbook section 0 item 1 | estimate: 20 to 40 min, depends on the database size |
| A2 | REQ-B-080: confirm on the server `THROTTLE_GLOBAL_PER_MINUTE=3000` and `TRUST_PROXY_HOPS=1` (the VPS overlay forces 1) | section 1 below, the REQ-B-080 item; runbook section 6 | estimate: 5 min |
| A3 | `pg_trgm` is available and the migrate role has the CREATE privilege (`pg_available_extensions`, `has_database_privilege`) | section 1 below; runbook 2.4 item 3 | estimate: 5 min |
| A4 | Wallet tiers: `select count(*) from tiers;` must be 4, else `deploy.sh --seed-reference` | runbook section 0 item 6 | estimate: 5 min |
| A5 | Stimulus group layout check (runbook 3.7 SELECT, expect 0 rows) and the other pre-live SELECTs of section 1 below (no demo accounts, six-digit accounts with an IC hash, null `blueprint_id` papers 3.7d) | runbook 3.7, 3.7d | estimate: 10 min |
| A6 | Announce and fix the maintenance window; no blocking sessions | section 1 below; runbook 2.4 | estimate: 10 min (the window itself is B2) |
| A7 | Prepare the build of BASE-214 (`export PP_IMAGE_TAG=$(git rev-parse --short=12 HEAD); $PC build api migrate frontend`); build only, no deploy | section 1 below | rehearsal: about 11 min |

### B. Only after CI is green on BASE-214 (e2e@api and the frontend and API verify jobs)

| # | Step | Where | Duration |
|---|---|---|---|
| B1 | `migrate deploy` through `deploy/vps/deploy.sh` with `lock_timeout` 5 s via `options=-c%20lock_timeout%3D5s` in the migrate `DATABASE_URL` (removed afterwards) | section 2 below; runbook 2.1, 2.4 | rehearsal: the write-blocking window is about 21 s at 408k rows (the whole `migrate deploy` 0104 to 0110: 21.3 s cold); production size not measured |
| B2 | Failed-migration detection SELECT (0 rows expected; any row means stop and go to section 4 below) | section 3 below; runbook 2.4, 8 | estimate: 2 min |
| B3 | `VACUUM ANALYZE question_versions` when 0100 is in this deploy, and `ANALYZE question_versions` after 0106/0107, right after `deploy.sh` ends | section 2 below; runbook 2.2, 2.4 item 4 | estimate: 1 to 5 min |
| B4 | Deploy the built images (done by `deploy.sh`); `GET /api/ready` 200 and `GET /api/health` 200 | section 6 below | estimate: 5 min |
| B5 | DSKP load (dry run, real run, verify) and the blueprints (an Admin Pusat creates each Kontrak and presses Sahkan, runbook 5.2) if the runbook lists them post-migrate | runbook sections 4 and 5; section 6 below | estimate: 30 to 60 min for the load and blueprints; depends on the data |
| B6 | Smoke: login count, one Jana Kertas, one Latih Tubi SPM draw | runbook section 1 step 7; 3.6, 5.5 | estimate: 10 min |
| B7 | The owner rotates the M02 default passwords on live, then confirms; only then sign-off 6.8 is ticked | sign-off 6.8 | owner action |

Still owed before the sign-off is complete: CI green on BASE-214, the M02 rotation (6.8), and the written acceptances of OCR AC-R1-14.2, limits 4.1 to 4.4, Q15/Q16 and copy row 42 (marked "deploy diteruskan atas arahan pemilik; penerimaan bertulis masih tertunggak"; not accepted).

Short form of [r1-runbook.md](r1-runbook.md) (section numbers below point there). A human with deploy rights runs this, after the lead's explicit confirmation. Placeholders only: `<DATABASE_URL>`, `<migrate_role>` (the role `prisma migrate deploy` connects as), `<pid>`. No secrets on this page.

**Rehearsed locally (runbook 2.4, 2.5):** `deploy.sh`, the compose path, the roles, the API as `pp_app`, every W1 case. **Not exercised:** a real VPS, Let's Encrypt, `ppdeploy` permissions, `PP_PG_ARCHIVE_MODE=on`, an old API running during the migrate, real data, Kontrak and Sahkan in the app. Shell setup for `$PC` and `$PSQL`: [r1-release-notes.md](r1-release-notes.md), top. The migration rehearsal (REQ-B-083: local Postgres 16, 409k `question_versions`, base `87466acc`) covered the normal apply (20.3 s total, 0106 16.6 s), revert, re-apply, `/api/ready` and the reference seed.

## 1. Pre-deploy

- [ ] Full dump: `deploy/vps/backup/backup.sh --tag pre-deploy --no-files` (`deploy.sh` step 2 takes another). Restore tested: `deploy/vps/backup/restore-drill.sh` (needs Node 22 on the host and stops the api) or a throwaway restore. 0100 cannot be undone in place.
- [ ] Images built before the window: `export PP_IMAGE_TAG=$(git rev-parse --short=12 HEAD); $PC build api migrate frontend`. A network failure in `npm ci` changes nothing; run it again.
- [ ] Maintenance window agreed; `options=-c%20lock_timeout%3D5s` added to `DATABASE_URL` in `migrate.env`, removed afterwards (runbook 2.4). **The role default does not survive `deploy.sh`** (step 4 resets it). The option makes the database cancel a waiting file whole; W1 below applies whenever the migrate client dies.
- [ ] No blocking sessions, with `$PSQL` (a DDL holder also hangs the backup of step 2 with no message): `SELECT pid, usename, state, xact_start, left(query, 80) FROM pg_stat_activity WHERE state <> 'idle' AND pid <> pg_backend_pid() ORDER BY xact_start;`
- [ ] `pg_trgm` is available (2.4 item 3): `SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name = 'pg_trgm';` returns 1 row.
- [ ] Migrate role may create it, with `$PSQL`; it must return `t` (name the role: `$PSQL` is the superuser):
  `SELECT has_database_privilege('pp_owner', current_database(), 'CREATE');`
- [ ] `THROTTLE_GLOBAL_PER_MINUTE=3000` in `api.env` (REQ-B-080; unset = 300 and only a preflight warning). `TRUST_PROXY_HOPS`: nothing to set on the VPS, the overlay forces 1. After the deploy: `$PC exec -T api sh -c 'echo "$THROTTLE_GLOBAL_PER_MINUTE $TRUST_PROXY_HOPS"'` shows `3000 1`.
- [ ] No demo accounts, with `$PSQL`: `select count(*) from users where email ilike '%@demo.test';` must be **0**. Otherwise **stop**: the production bundle carries the demo password (runbook section 0 item 8).
- [ ] Six-digit `@prestasiplus.my` accounts holding an IC hash, with `$PSQL`: `select count(*) from users where email ~ '^[0-9]{6}@prestasiplus\.my$' and ic_hash is not null;` Above 0: **the owner decides before live** (runbook section 0 item 9).
- [ ] No CDN or extra proxy in front of the edge: `PP_DOMAIN=$(grep '^PP_DOMAIN=' /etc/pretasiplus/prod.env | cut -d= -f2)`, then `dig +short "$PP_DOMAIN"` (or `getent ahostsv4`) gives only the VPS address and `curl -sI "https://$PP_DOMAIN/" | grep -iE '^(via|cf-ray|x-cache|x-served-by|x-amz-cf-id):'` prints nothing. Otherwise **stop**: clients would share one throttle address (runbook section 0 item 10).
- [ ] Pre-migration counts recorded (runbook 3.1).
- [ ] Wallet tiers (runbook section 0 item 6): `select count(*) from tiers;` must be **4**. If it is not 4, run `deploy/vps/deploy.sh --seed-reference` (reference modules only, not the demo seed that item 5 forbids) before the API takes traffic; on a first install, right after `deploy.sh` (no schema before it, and the deploy does not pause). `/api/ready` stays 200 with empty tiers, so this count is the only guard. `spm_subject_configs` is 0 until `subjects` exist: run the seed again after they do (19 when all 19 subject codes exist).
- [ ] Stimulus group layout (runbook section 0 item 7): run the SELECT of 3.7 on the target. 0 rows is expected; any row means that paper is re-composed in the builder before go-live.

## 2. Deploy

- [ ] `deploy/vps/deploy.sh --dry-run`, then `deploy/vps/deploy.sh` (type the domain). Order and list: runbook 2.1. Expect 0105 to hold a lock on `question_versions` for under a second; 0106 about 17 to 20 s at 409k rows (writes wait, reads do not).
- [ ] Right after `deploy.sh` ends (it does not pause between migrations), with `$PSQL`: `VACUUM ANALYZE question_versions;` when 0100 was in this deploy (runbook 2.2), and `ANALYZE question_versions;` (runbook 2.4 item 4).

## Where a deployer gets stuck (detail: runbook 2.5)

- **No pause before traffic.** `deploy.sh` can finish with `tiers` = 0 and `/api/ready` 200: on a first install run `deploy.sh --seed-reference` at once.
- **The seed can load 0 SPM rows.** With no `subjects` it still prints 4 modules; run it again after subjects exist: `spm_subject_configs` has one row per configured subject whose code exists, 19 when all 19 codes exist.
- **Build before the window** (11 minutes here, inside the window otherwise; a network failure in `npm ci` is safe to re-run): `export PP_IMAGE_TAG=$(git rev-parse --short=12 HEAD); $PC build api migrate frontend`.
- **Step 2 hangs silently** behind an ACCESS EXCLUSIVE holder; the last line is `backup start`. Run the activity check first.
- **Step 8 fails with healthy containers** on a certificate problem: read the curl line; a re-run recovers.
- **After a step 5 failure** the old API still serves, `/api/ready` is 503, and `deploy.sh` answers P3009 until `resolve`. Go to section 3.
- **`--seed-reference` with no image for the tag** builds it first and needs the db running.

## 3. Detect a failed migration

`prisma migrate status` does **not** name a failed migration and can exit 0. Run this with `$PSQL`; any row means a migration is unfinished:

```sql
SELECT migration_name, started_at, finished_at, rolled_back_at, logs FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;
```

`migrate deploy` then answers P3009 and `/api/ready` answers 503 until it is fixed. Recover promptly (runbook 2.4 and section 8).

## 4. Recovery: the migrate client died while 0105 was running or waiting (W1)

Use this whenever the migrate client (the process, its container or SSH session) died during 0105, **whatever the timeout** (a `lock_timeout` or none). Do **not** run `resolve --rolled-back` first: the server may have committed 0105, and `deploy` would then fail with 42701 (`column "last_editor" already exists`).

1. Find and stop the stale session, **before you touch any blocker** (ending a blocker first lets the file commit). With `$PSQL`:
   `SELECT pid, usename, state, wait_event_type, left(query, 40) FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND state <> 'idle' AND usename = 'pp_owner';` then `SELECT pg_terminate_backend(<pid>);`
   Filter on the role only: the query text is cut at 1 kB and Prisma sets no application name. Reads and writes of `question_versions` are blocked until this ends. **Re-run the lookup: 0 rows before step 2.**
2. Check what 0105 left (read-only):
   - `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'question_versions' AND column_name IN ('last_editor', 'declared_marks');`
   - `SELECT conname, convalidated FROM pg_constraint WHERE conrelid = 'question_versions'::regclass AND conname IN ('ck_question_versions_last_editor', 'ck_question_versions_declared_marks');`
3. Both columns and both validated constraints present: `$PC run --rm --no-deps -w /app/apps/api migrate npx prisma migrate resolve --applied 0105_gate_facts` (the backfill is kept), then `deploy/vps/deploy.sh`.
   None present: the same command with `--rolled-back`, then `deploy/vps/deploy.sh`. `PP_IMAGE_TAG` = the failed release's tag.
   Some but not all (or a constraint not validated): run the `DROP ... IF EXISTS` revert in runbook 2.4 (Recovery step 2), then the rolled-back path. **Never run that revert when both columns and both validated constraints are present.**
4. Re-run the detection query (0 rows) and check `/api/ready`.

All cases tested: runbook 2.4 table. Chose `--rolled-back` on a complete 0105 by mistake? `deploy` fails 42701; `--applied` still recovers it (tested).

For a lock timeout while the client is still connected, the database cancels 0105 whole; use the normal recovery in runbook 2.4 (terminate the blocker, run the W1 step 2 object check, then `resolve --rolled-back` when it shows absent, and `deploy`).

## 5. Rollback

- Past 0100: restore the pre-deploy dump with the previous API/FE build ([r1-release-notes.md](r1-release-notes.md) 6.2; commands: production-vps.md section 8). After a dump restore do **not** run `prisma migrate resolve` (P3011).
- Reverting only 0104 to 0107 by hand (runbook 2.3): reverse SQL plus `DELETE FROM _prisma_migrations ...`, with the old API/FE build back. **0110 stays applied by design** (no reverse).

## 6. Post-deploy

- [ ] `GET /api/ready` answers 200 (`db` up, `migrations` applied) and `GET /api/health` 200.
- [ ] Detection query of section 3 returns 0 rows.
- [ ] Schema checks 3.5d and 3.5e; servable counts 3.6.
- [ ] DSKP load (runbook section 4). First: `education_levels` has T4, T5 and `subjects` has at least the 11 base codes (release notes 3.1); the loader cannot create levels or those subjects. `$PC run --rm --no-deps migrate npm run dskp:load -w @pp/api -- --dry-run --create-missing-subjects`, the same without `--dry-run`, then the dry run again: every insert column 0.
- [ ] Blueprints (needs an Admin Pusat account: from the data, or `admin:bootstrap`, production-vps.md section 21; and the real trial papers and skema): an Admin Pusat creates each in Kontrak and presses Sahkan, in the order of runbook 5.2 (section 5; order of work step 6).
- [ ] Smoke (runbook section 1 step 7; sections 3.6 and 5.5; release notes 6.1): login count, one Jana Kertas, one Latih Tubi SPM draw.
- [ ] Record the date, the build, the migration list applied and who ran it.
