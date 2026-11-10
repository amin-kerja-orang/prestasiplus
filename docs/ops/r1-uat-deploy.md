# R1 UAT cutover runsheet: rebuild the UAT database from empty, filled from the V2 dump

Replaces the earlier "deploy 0092 on top of the existing data" sheet. Decision KP-2 (PO): the UAT database is rebuilt from empty and filled from a fresh V2 (.cloud) dump, full replace. Operator: a human, on `uat.prestasiplus.cloud` as `ppdeploy`. AI agents do not run these commands. Not touched: prestasiplus.cloud, DNS, the V2 server. No secret is written here: values come from the PO and the platform secret store.

Rehearsal evidence: T-A4, 10 Nov 2026, local UAT-like stack (own compose project, CA-signed edge certificate, a Linux ops container running the real scripts, real V2 data of 10 Nov: the full small tables plus a 3,000-question sample, and earlier one FULL load up to the ETL pass 1). Windows Docker Desktop VM, 7.7 GB RAM shared with other jobs. Section 7 has the timings and what is proven.

## 0. Decisions

Fixed: KP-2 rebuild from empty; `OCR_ENGINE=tesseract` (`OCR_LANG_DIR=/opt/tessdata`); upload limits 32 / 336 MB; roster passwords are NOT forced to reset (KP-7: leave `PP_MIGRATE_ROSTER_FORCE_RESET` unset and remove or empty `PP_MIGRATE_ROSTER_DEFAULT_HASHES` in `etl.env`; the ETL then prints the warning "PP_MIGRATE_ROSTER_DEFAULT_HASHES is unset or empty", expected).

PO decisions needed at release time (nothing is done about them by the script):
1. `PUPIL_DEFAULT_PASSWORD` (api.env, SECRET): required. Without it teacher "Cipta Pelajar" (`POST /api/guru/students`) answers 500. The PO supplies the value (8+ characters, long, random) at release; secret store only.
2. A manual restore drill right before the rebuild (PO approval at release; stops the api 1 to 3 minutes). The last drill (2 Nov) is older than the current schema and had no named operator.
3. An off-host copy of the final pre-rebuild backup (`PP_OFFSITE_KIND=none` today).
4. UAT raw `.cloud` retention is overdue (`PP_RAW_PURGE_BY=2026-11-06`: PITR base `20261027T064728Z`, its WAL, 3 raw copies, restore points `pre_etl` / `pre_delta`). Purge or move the date: PO decision. Not done by this sheet.
5. Repairs that write after a PO-approved dry-run report: `flag-stimulus`, `trim-duplicate-stem` (script option `--approve`).
6. Accept the loader results listed in section 7 (rejects, held questions) as the starting data.

## 1. Before the window

1. Checkout: `git -C /opt/pretasiplus fetch origin && git -C /opt/pretasiplus checkout --detach <SHA>`; `git status --porcelain --untracked-files=no` empty. Note the running tag: `cat /var/lib/pretasiplus-deploy/current.tag`.
2. Shell: `cd /opt/pretasiplus; export PP_IMAGE_TAG=$(git rev-parse --short=12 HEAD); PC="docker compose -f compose.yaml -f deploy/vps/compose.prod.yaml --env-file /etc/pretasiplus/prod.env"`.
3. Env (names; details `r1-uat-env-changes.md`; back up the files first). `prod.env`: `PP_UPLOAD_FILES_MB=32`, `PP_UPLOAD_BIG_MB=336`, `PP_RELEASE_SHA=<40 hex>`, `VITE_PROTOTYPE_SCOPE=on`, and `PP_ALLOW_DB_REBUILD=yes` (TEMPORARY: remove it when the rebuild is accepted; production must never carry it). `PP_STAGE_EXPECT` stays unset (the script derives the expected table counts from the release DDL: archive_cloud 45, staging_cloud 89). `api.env`: `OCR_ENGINE=tesseract`, `OCR_LANG_DIR=/opt/tessdata`, DELETE the `AI_PROVIDER=mock` line (unset + tesseract = the real segmenter; the intake-env check fails while it is set), `PUPIL_DEFAULT_PASSWORD`; `prod.env`: `PP_JOBS_WORKER_ENABLED` unset or `true` (what each does: `r1-uat-env-changes.md` section 1). `etl.env`: KP-7 above.
4. Inputs, outside the repo, mode 700, readable by uid 1000 for the files (`setfacl -R -m u:1000:rX`): `DUMP` = the raw `pp-staging-dump/1` directory (`dump:cloud --raw`, procedure `cloud-dump-procedure.md` section 12; manifest `"raw": true`, no `.partial`; 10 Nov dump 756 MB, 98 files); `FILES` = V2 storage export with `SHA256SUMS` (paths relative, no leading `./`; 10,316 files, 2.4 GB). Check free space: backup volume at least 5 GB and the stage dir at least 5 x the dump size. `PP_MIGRATION_OUT` exists, owner uid 1000, mode 700 (`slot.sh gonogo` prints it).
5. Build before the downtime (UAT stays up): `$PC config --images | grep pretasiplus-api:` must NOT show the running tag (building would overwrite the rollback image); then `$PC build api migrate frontend`.
6. Dry run: `deploy/vps/rebuild-db.sh --rebuild-db --dump-dir "$DUMP" --files-dir "$FILES" --dry-run`. Expect `G5 deploy preflight passed` and `DRY-RUN: all checks passed`. It changes nothing.
7. PO items 2 and 3 of section 0, if approved.

## 2. Cutover (one command)

```
cd /opt/pretasiplus
deploy/vps/rebuild-db.sh --rebuild-db --dump-dir "$DUMP" --files-dir "$FILES" --verify-soft [--pause-after-plan]
```
It asks you to type the database name, then the domain, in a terminal. `--verify-soft` is needed today (section 7: the full `migrate:verify` has no expectations for the new loaders yet). `--pause-after-plan` stops after the rajah plan so the PO can read it (the plan file is in `PP_MIGRATION_OUT`). Do not run anything else against the stack while it runs: one lock is held.

What it does, in order (each step is logged with `STEP-TIME`, the first failure stops it and prints the rollback command): 1 images present for the tag; 2 fresh pre-rebuild backup, sha256 and `pg_restore --list` checked (refuses otherwise; the api is still up); 3 stop api (and its jobs worker); 4 archive and empty the old files volume; 5 drop and create the database; 6 `db-roles.sh apply`; 7 `prisma migrate deploy` 0001 to HEAD (112 migrations; the count is compared with the release folders); 8 roles apply and check; 9 reference seed (curriculum included, production mode); 10 stage the dump (throwaway cluster, copy into `staging_cloud` / `archive_cloud`); 11 ETL pass 1: `migrate:all --apply` (with `--files-dir`), `migrate:questions` plan, dry-run, apply, `migrate:structured`, `migrate:papers`, `migrate:link-questions`; 12 `migrate:verify`; 13 ETL pass 2, which must insert and update 0 rows; 14 repairs and checks; 15 drop `staging_cloud`; 16 start api, frontend, edge and run the health checks; 17 record the release (`current.tag`, `previous.tag`, `history.log`).

**Terbit pass (V2-published papers stay published).** `--terbit` makes each ETL pass run `migrate:terbit --apply` right after `migrate:papers --apply`, in the same window (api stopped). `migrate:terbit` boots the Nest application context, which needs the decorator metadata that only the API build (vite + SWC) emits, so it is not run through tsx: it is the second bundle of the API build, `dist/migrate-terbit.js` (`apps/api/vite.build.terbit.config.ts`, run by `npm run build -w @pp/api` after the main bundle), and `slot.sh etl migrate:terbit` runs it with `node` from `/app/apps/api` of the migrate image (the same image the other `migrate:*` commands use; env from `api.env` + `etl.env`, `FILE_STORAGE_DIR` set to a scratch path). By hand after a papers apply: `deploy/vps/migration/slot.sh etl migrate:terbit --apply` (a dry-run, no `--apply`, only counts the candidates). It publishes through `BuilderService.publish` with the audited legacy override, writes `papers-terbit-<run>.csv` (ids, outcome and the gate BM lines) to the reports folder and is idempotent (only papers still `draft` are offered). V2 papers with no duration load untimed and publish (V2 parity, migration `0266`).

Exit 0 = clean. Exit 4 = finished, the stack is up, but some checks or repairs reported FAIL: the list is printed; the PO decides go or no-go (section 3). Any other exit = stopped; read the printed state (database untouched, or dropped and partly rebuilt with the api stopped).

## 3. Go / no-go

1. Exit status and the `SUMMARY` table; the failed-check list.
2. Reconciliation: counts of the dump (`manifest.json`) against the ETL `recon` lines (users 7,026, schools 10,207, chapters 686, classrooms 12 of 33 eligible 13, and so on). Reports are in `PP_MIGRATION_OUT` (`recon-*.md`); they hold counts only. Delete the files that hold ids of people within 7 days (`core-login-gaps-*.json`, restricted id files).
3. `second pass: N apply runs, rows inserted or updated: 0`.
4. Database: `select count(*) from tiers` = 4; `from users where email ilike '%@demo.test'` = 0; `from spm_subject_configs` = 19; chapters 1,311 of which 569 inactive (the auto-created Tingkatan 1-3 chapters); migrations 112, none unfinished; `deploy/vps/db-roles.sh check` passes.
5. Checks that are expected to say FAIL today and what they mean (rehearsal): `smoke-readonly.sql` F3/F6/F10 (roster accounts not flagged: accepted by KP-7), X3 (reject share above its threshold: the loader results of section 7), Z0 (the count of those); `chapters-t1-t3` now FAILs only for a pair V2 served (it has non-auto-created Bab) that has no active Bab; pairs whose chapters are all the inactive auto-created T1-T3 ones, or that have none, are INFO lines plus one "for the curriculum owner" list (expected, 569 hidden chapters; the curriculum owner activates real ones); `intake-env (api image)` runs in the api image and must PASS once the env edits of section 1 step 3 are done (`AI_PROVIDER` removed, `OCR_*`, worker flag); `support-contact` FAIL = PENDING PO INPUT (V2 holds no support e-mail, WhatsApp or hours, so nothing is migrated: the admin saves them in `/admin/settings` after the PO gives the values); `terbit-published` is skipped with a note unless `--terbit` was given, then it must PASS (every V2-published paper not held at load is published). Anything else new is a STOP.
6. `curl -s -o /dev/null -w '%{http_code}\n' https://uat.prestasiplus.cloud/api/ready` and `/api/health` give 200; `$PC exec -T api sh -c 'echo "$THROTTLE_GLOBAL_PER_MINUTE $TRUST_PROXY_HOPS"'` gives `3000 1`.

## 4. Smoke per role (the old UAT accounts are gone with the old database: use V2 accounts given by the PO; migrated passwords are unchanged, KP-7)

- Pupil: log in, dashboard, Latih Tubi and a chapter quiz to the result.
- Teacher: log in, `/guru/monitoring` (pupil numbers equal the class lists), "Cipta Pelajar" creates a pupil (proves `PUPIL_DEFAULT_PASSWORD`), intake of one PDF (scanned, OCR) to the draft.
- School admin: log in, command centre shows the school and its pupils.
- Admin: log in, Kurikulum (569 inactive chapters visible for curation), Bank Soalan counts, Kontrak, Pratonton Kolam, Jana Kertas through Mod Pelajar (needs a Disahkan blueprint; 4 blueprints were migrated).
- Parent, sponsor and PPD accounts are refused with `Peranan ini belum menggunakan sistem ini.` (scope on).

## 5. Rollback

Before step 5 nothing in the database changed: start the api again (`$PC up -d --wait --no-deps api`), restore `prod.env` if wanted. After it:
```
deploy/vps/rebuild-db.sh --rebuild-db --restore-backup "<the pre-rebuild dump, path in the log and in /var/lib/pretasiplus-deploy/rebuild-backup.path>"
```
Typed confirmation again. It verifies the dump (sha256, `pg_restore --list`), stops the api, drops and recreates the database, `pg_restore`, roles apply and check, restores the archived uploads, starts the PREVIOUS release (`rebuild-prev.tag`), runs the health checks. Rehearsed: 52 s on a near-empty database; UAT's 166 MB dump took 123 s to restore in the 2 Nov drill. Writes after the backup are lost. Needs PO approval.

## 6. After acceptance

Remove `PP_ALLOW_DB_REBUILD=yes` from `prod.env`. Wipe the raw dump: `deploy/vps/migration/slot.sh wipe-dump "$DUMP"` and the files copy when no longer needed. `staging_cloud` was dropped by step 15 (use `--keep-staging` only if the PO wants it for a delta; then the retention date applies). Reports of the repair scripts are under `PP_MIGRATION_OUT/uat-ops` (counts only). Record the PO decision on the raw retention (section 0, item 4).

## 7. Timings and rehearsal results

Local, loaded host (shared VM, no dedicated cores). UAT has 4+ cores and no contention: expect equal or faster; the questions steps are single-process and database bound.

| Step | Measured | UAT estimate |
|---|---|---|
| 0 preflight | 2 s | 5 s |
| 1 images (already built) | 1 s | 1 s; build before the window: api about 5 min cold, migrate 27 s, frontend 45 s |
| 2 backup + verify | 4 s on an empty database | UAT dump 166 MB: 1 to 3 min |
| 3 stop api, 4 files archive, 5 drop/create, 6 roles | 2 + 4 + 1 + 1 s | under 1 min |
| 7 migrate 0001 to HEAD (112) | 26 to 28 s | 30 to 60 s |
| 8 roles + check, 9 seed | 5 s, 26 to 29 s | 1 min |
| 10 stage (load + copy), full dump | 144 s (load 94, copy 43) | 2 to 3 min |
| 11 ETL pass 1, FULL data (451,518 V2 questions) | 1,859 s: all 77, questions plan 70 / dry-run 588 / apply 867, structured 26+25, papers 17+23 | 20 to 30 min |
| 12 migrate:verify | 37 s | 1 min |
| 13 ETL pass 2 | sample 370 s; full estimated 25 to 30 min (the dry-runs and applies run again, nothing is written) | 20 to 30 min |
| 14 repairs and checks | 134 s on the sample; the backfills scale with questions and answers | 3 to 10 min |
| 15 drop staging, 16 start + health, 17 record | 1 + 24 + 0 s | 1 min |
| Total | sample run 1,197 s | plan 75 to 90 min for the window (api down from step 3); add 30 min of PO checks |

Assumptions: the full pass 1 was measured once on the full dump and then stopped; passes 2 and the repairs are scaled from the sample run. The UAT database may take longer on the first apply (cold cache).

Proven in the rehearsal: guards G1 to G4, G6 (negative tests: no flag, no opt-in, deny-listed domain, wrong typed name or domain, a pipe on a non-rehearsal host, wrong dump directory; nothing changed in any of them), G5 preflight and G7 backup verification, stop, drop/create, roles before and after, migrate 112, seed including the curriculum fix, stage, ETL pass 1 with every loader that exists today, second pass inserting and updating 0 rows, `migrate:verify` (hard mode fails, see below), repairs, staging drop, start with edge TLS health checks, release recording, rollback (restore, previous release started, health checks).

Not proven or still hooks: (a) the full `migrate:verify` after questions, structured and papers fails (`questions` target 450,819 against loaded 448,804; the new entities have no target count): verify does not know the new loaders yet. `--verify-soft` records it as a failed check. Owner: migration developers. (b) `migrate:questions` has no `--files-dir`, so 7,178 questions with an image are loaded held (`held_image`); question images are not copied until T-B9-5. (c) `paper_documents` (254) and pages are not migrated (file migration off). (d) `rewards` 50 of 50, `exam_questions` 5,704 of 5,704 and `reward_redemptions` 7 of 7 are rejected by the loaders, 32 of 36 blueprints are rejected, `questions.chapter_missing` 448,804 (questions load without a chapter), post-load flag `stimulus_missing` 13,315: the data owners decide. (e) `structured` and `papers` run through their `cli.ts` entry points (no npm alias). `--terbit` was not run. (f) The repair order follows the T-B1 runbook (trim before flag), not the proposed order of `r1-uat-rebuild-prep.md` section 5; `trim-duplicate-stem` runs as a dry-run check (the loader no longer duplicates the stem). (g) `intake-env` now runs in the api image (`intake_env_check` in `rebuild-db.sh`), not the migrate image.
