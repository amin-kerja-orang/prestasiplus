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
3. Env (names; details `r1-uat-env-changes.md`; back up the files first). `prod.env`: `PP_UPLOAD_FILES_MB=32`, `PP_UPLOAD_BIG_MB=336`, `PP_RELEASE_SHA=<40 hex>`, `VITE_PROTOTYPE_SCOPE=on`, and `PP_ALLOW_DB_REBUILD=yes`, `PP_REBUILD_ALLOWED_DB=<the UAT POSTGRES_DB value>` and `PP_REBUILD_ALLOWED_DOMAIN=uat.prestasiplus.cloud` (TEMPORARY, all three: remove them when the rebuild is accepted; production must never carry them; section 8, G3). `PP_STAGE_EXPECT` stays unset (the script derives the expected table counts from the release DDL: archive_cloud 45, staging_cloud 89). `api.env`: `OCR_ENGINE=tesseract`, `OCR_LANG_DIR=/opt/tessdata`, DELETE the `AI_PROVIDER=mock` line (unset + tesseract = the real segmenter; the intake-env check fails while it is set), `PUPIL_DEFAULT_PASSWORD`; `prod.env`: `PP_JOBS_WORKER_ENABLED` unset or `true` (what each does: `r1-uat-env-changes.md` section 1). `etl.env`: KP-7 above.
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

What it does, in order (each step is logged with `STEP-TIME`, the first failure stops it and prints the rollback command): 1 images present for the tag; 2 fresh pre-rebuild backup, sha256 and `pg_restore --list` checked (refuses otherwise; the api is still up); 3 stop api (and its jobs worker); 4 archive and empty the old files volume; 5 drop and create the database; 6 `db-roles.sh apply`; 7 `prisma migrate deploy` 0001 to HEAD (112 migrations; the count is compared with the release folders); 8 roles apply and check; 9 reference seed (curriculum included, production mode); 10 stage the dump (throwaway cluster, copy into `staging_cloud` / `archive_cloud`); 11 ETL pass 1: `migrate:all --apply` (with `--files-dir`), `migrate:questions` plan, dry-run, apply, `migrate:structured` (with `--files-dir`: it ends with the picture pass), `migrate:papers`, `migrate:link-questions`; 12 `migrate:verify`; 13 ETL pass 2, which must insert and update 0 rows; 14 repairs and checks; 15 drop `staging_cloud`; 16 start api, frontend, edge and run the health checks; 17 record the release (`current.tag`, `previous.tag`, `history.log`).

**Terbit pass (V2-published papers stay published).** `--terbit` makes each ETL pass run `migrate:terbit --apply` right after `migrate:papers --apply`, in the same window (api stopped). `migrate:terbit` boots the Nest application context, which needs the decorator metadata that only the API build (vite + SWC) emits, so it is not run through tsx: it is the second bundle of the API build, `dist/migrate-terbit.js` (`apps/api/vite.build.terbit.config.ts`, run by `npm run build -w @pp/api` after the main bundle), and `slot.sh etl migrate:terbit` runs it with `node` from `/app/apps/api` of the migrate image (the same image the other `migrate:*` commands use; env from `api.env` + `etl.env`, `FILE_STORAGE_DIR` set to a scratch path). By hand after a papers apply: `deploy/vps/migration/slot.sh etl migrate:terbit --apply` (a dry-run, no `--apply`, only counts the candidates). It publishes through `BuilderService.publish` with the audited legacy override, writes `papers-terbit-<run>.csv` (ids, outcome and the gate BM lines) to the reports folder and is idempotent (only papers still `draft` are offered). V2 papers with no duration load untimed and publish (V2 parity, migration `0266`).

Exit 0 = clean. Exit 4 = finished, the stack is up, but some checks or repairs reported FAIL: the list is printed; the PO decides go or no-go (section 3). Any other exit = stopped; read the printed state (database untouched, or dropped and partly rebuilt with the api stopped).

## 3. Go / no-go

1. Exit status and the `SUMMARY` table; the failed-check list.
2. Reconciliation: counts of the dump (`manifest.json`) against the ETL `recon` lines (users 7,026, schools 10,207, chapters 686, classrooms 12 of 33 eligible 13, and so on). Reports are in `PP_MIGRATION_OUT` (`recon-*.md`); they hold counts only. Delete the files that hold ids of people within 7 days (`core-login-gaps-*.json`, restricted id files).
3. `second pass: N apply runs, rows inserted or updated: 0`.
4. Database: `select count(*) from tiers` = 4; `from users where email ilike '%@demo.test'` = 0; `from spm_subject_configs` = 19; chapters 1,311 of which 569 inactive (the auto-created Tingkatan 1-3 chapters); migrations 112, none unfinished; `deploy/vps/db-roles.sh check` passes.
5. Checks that are expected to say FAIL today and what they mean (rehearsal): `smoke-readonly.sql` F3/F6/F10 (roster accounts not flagged: accepted by KP-7); X3 now judges only the UNEXPLAINED rejects: besides the deleted-user orphans, unique keys and ledger sign, the V2 data defects that `migrate:verify` proves against computed expectations (`questions` options / options.body / is_correct, `exam_questions` is_correct / options / stem, `paper_blueprints` duration_minutes, `paper_document_pages` path, `question_files`) count as explained, using the latest apply run of each loader, exactly as verify does (the list in the SQL mirrors the keys in `bank-checks.ts`; a reject with any other reason or column stays X3 FAIL, and so does one accepted only through `PP_VERIFY_ACCEPT_REJECTS`); Z0 (the count of FAIL rows); `chapters-t1-t3` now FAILs only for a pair V2 served (it has non-auto-created Bab) that has no active Bab; pairs whose chapters are all the inactive auto-created T1-T3 ones, or that have none, are INFO lines plus one "for the curriculum owner" list (expected, 569 hidden chapters; the curriculum owner activates real ones); `intake-env (api image)` runs in the api image and must PASS once the env edits of section 1 step 3 are done (`AI_PROVIDER` removed, `OCR_*`, worker flag); `support-contact` prints `PENDING PO ITEM` (PO decision KP-12): V2 holds no support e-mail, WhatsApp or hours, so the contact stays empty until Central Admin fills it in at Tetapan > Hubungi Sokongan. It is NOT a failed check (exit stays 0) and the run lists it under "PENDING PO ITEM(S)" at the end; it still FAILs when the table cannot be read or the endpoint is broken; `intake-av` (S-3) FAILs when `INTAKE_TEACHER_ENABLED` is on in `api.env` and ClamAV is not live (section 8); `terbit-published` is skipped with a note unless `--terbit` was given, then it must PASS (every V2-published paper not held at load is published). Anything else new is a STOP.
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
Typed confirmation again. It verifies the dump (sha256, `pg_restore --list`), stops the api, drops and recreates the database, `pg_restore`, roles apply and check, restores the archived uploads (only the archive written by the SAME run as the dump: see section 8, C-2), starts the PREVIOUS release (`rebuild-prev.tag`), runs the health checks. Rehearsed: 52 s on a near-empty database; UAT's 166 MB dump took 123 s to restore in the 2 Nov drill. Writes after the backup are lost. Needs PO approval.

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

## 8. Guards added after review, and how they are tested

- **G3 (S-1).** `PP_DOMAIN` is read from `prod.env` only: `rebuild-db.sh` unsets an inherited `PP_DOMAIN`, and `pp_cfg PP_DOMAIN` (lib.sh) ignores the environment for every deploy script. The value is lower-cased, trimmed and stripped of ALL trailing dots before the deny list (`prestasiplus.cloud`, `www.`, `admin.`, `prestasiplus.my`, `www.prestasiplus.my`, the example host, empty). The database name is refused when it is `postgres`, a template, a V2 or production name (`prestasiplus_prod`, `prestasiplus_production`, `prestasiplus_cloud`, `prestasiplus_live`, `prestasi_plus`, `pios_my`). Extra deny lists can be set in `prod.env` only: `PP_REBUILD_DENY_DOMAINS` and `PP_REBUILD_DENY_DBS` (comma lists). Ask the platform owner to add the real V3 production database name to `PP_REBUILD_DENY_DBS` if it is none of the names above. The deny lists are read as plain words (never globbed, `*` is just a word).
- **G3 positive allowlist (X-2).** A rebuild also needs `PP_REBUILD_ALLOWED_DB` and `PP_REBUILD_ALLOWED_DOMAIN` in the `prod.env` FILE (never the shell). Both must equal `POSTGRES_DB` (`db.env`) and `PP_DOMAIN`; if either is unset or different the script refuses with exit 3 (fails closed). A `PP_DOMAIN` that is not a plain host name (a `:` port, `/`, a blank) is refused, and so is every host below `prestasiplus.cloud` or `prestasiplus.my`, with ONE exception: `uat.prestasiplus.cloud` passes the wildcard deny only when `PP_DOMAIN` and `PP_REBUILD_ALLOWED_DOMAIN` are both exactly that name. The exact production names (`prestasiplus.cloud`, `www.`, `admin.`) are never exempt. **UAT `prod.env` needs these two lines:** `PP_REBUILD_ALLOWED_DB=<the UAT POSTGRES_DB value from db.env>` and `PP_REBUILD_ALLOWED_DOMAIN=uat.prestasiplus.cloud`. Remove them together with `PP_ALLOW_DB_REBUILD=yes` when the rebuild is accepted. Production never carries any of the three. A rebuild is also refused up front (G3, before anything changes) when `prod.env` carries `PP_VERIFY_ACCEPT_REJECTS` or `PP_VERIFY_ACCEPT_REJECTS_FILE`.
- **G6 (S-2).** The dump manifest is refused when `anonymised` or `synthetic` is anything but `false` (`true`, `"true"`, `1`): an anonymised dump gives every account the known password `Demo1234` (`anonymise/passwords.ts`). Load the RAW `dump:cloud --raw` output only.
- **C-2 stale files archive.** Every rebuild run deletes `rebuild-files-archive.path` (and its `.run` sidecar) in `PP_STATE_DIR` before step 1. Step 4 with `--files-archive archive` writes the archive path and `rebuild-files-archive.run` (the run id); step 2 writes `rebuild-backup.run`. `--restore-backup` unpacks the files archive only when the archive's run id equals the backup's run id AND `rebuild-backup.path` names the dump being restored; otherwise it stops with exit 3 BEFORE stopping the api or dropping anything (to restore the database only, delete `rebuild-files-archive.path` by hand). After a run with `keep` or `wipe` there is no archive, and the restore leaves the files volume alone.
- **S-3 teacher uploads and ClamAV.** `INTAKE_TEACHER_ENABLED=true` is refused by the G5 preflight (`deploy.sh --dry-run`, so also the rebuild dry-run) and by step 14 of the rebuild (`intake-av`) unless uploads can be scanned: see section 8.1 for the conditions and the enablement steps. `r1-uat-env-changes.md` says UAT `api.env` carries `INTAKE_TEACHER_ENABLED=true`: set it to `false` before the dry run unless ClamAV is already live.
- **migrate:verify allowlist (X-3, M-1).** Optional `PP_VERIFY_ACCEPT_REJECTS` / `PP_VERIFY_ACCEPT_REJECTS_FILE` are one-run waivers taken from the PROCESS ENVIRONMENT of the `slot.sh etl migrate:verify` command only, never from `prod.env`: `slot.sh` refuses to run verify (exit 2) when `prod.env` carries either key, and prints a `WARNING` line when one is set. Items are `entity|reason|column=maxN`, for example `PP_VERIFY_ACCEPT_REJECTS='exam_questions|INVALID_VALUE|stem=3' deploy/vps/migration/slot.sh etl migrate:verify`. Format in `r1-runbook.md` section 6 and `.env.example`. The explained-key list in `docs/ops/sql/smoke-readonly.sql` X3 (between the `EXPLAINED-KEYS` markers) is tied to `EXPLAINED_REJECT_KEYS` by the unit test `apps/api/test/migration/verify/smoke-explained-keys.spec.ts`.
- **Tests (C-5, X-2, X-3).** `deploy/test/test-rebuild-db.sh`: plain bash with a stub `docker` and `curl` on PATH (the repo has no bats). Covers G1, G2, G3 (case, whitespace, trailing dots, ports, environment override, database names, extra deny lists never globbed, the positive allowlist and the UAT exception), G6 (anonymised or synthetic manifest), the C-2 stale-archive refusal and the new-run removal, the pass-2 non-zero gate (`step_etl2`), the S-3 check, the scanner health gate, and `slot.sh etl` (allowlist pass-through from the environment only, prod.env refusal, apply without `staging_cloud` refused). Run it in the Linux container: `docker compose -p pp-ops -f deploy/test/compose.be-test.yaml run --rm --entrypoint bash runner /src/deploy/test/test-rebuild-db.sh`, then `docker compose -p pp-ops -f deploy/test/compose.be-test.yaml down -v`. It changes nothing on any host.

### 8.1 Teacher intake and ClamAV (backlog #78)

Teacher DOCX/XLSX/PDF submissions are enabled only when uploads are virus-scanned. The API streams every intake upload, teacher and admin, to clamd (INSTREAM) before anything is stored.

- An infected file is rejected: 422, a BM message, and the audit event `intake.file_infected`.
- If the scanner is missing, unreachable or slow, the upload is rejected with 503 `UPLOAD_SCAN_UNAVAILABLE`. It is never accepted unscanned.

To enable on UAT:

1. **Server memory.** clamd needs about 1.5 to 2 GB RAM and about 300 MB of disk for the signatures (volume `clamdb`). Check `free -m` first. The container limit is `PP_CLAMAV_MEM` (default 2g), on top of the API (2g), the db (2g) and edge. If less than 2 GB is free, do not enable it.
2. **`prod.env`:** add `clamav` to `PP_PROFILES`, comma-separated with what is already there (for example `monitoring,clamav`).
3. **`api.env`:** set `CLAMAV_HOST=clamav`, `CLAMAV_PORT=3310`, optionally `CLAMAV_TIMEOUT_MS=30000` and `CLAMAV_MAX_STREAM_MB=32`, then `INTAKE_TEACHER_ENABLED=true`. `CLAMAV_MAX_STREAM_MB` must equal `PP_CLAMAV_MAX_STREAM_MB` in prod.env (default 32, the clamd StreamMaxLength). The API refuses to boot if `INTAKE_MAX_FILE_MB` (default 30) is larger.
4. **Deploy with `deploy.sh`.** The preflight (`pp_intake_av_problem`) refuses `INTAKE_TEACHER_ENABLED=true` unless the build contains the scan code (the `CLAMAV_SCAN_ENABLED` marker in the API env schema), `clamav` is in `PP_PROFILES` and `CLAMAV_HOST` is set in api.env (the rebuild also checks at step 14 that the clamav container runs). After the start, the health gate (`pp_health_checks`) also waits up to 6 minutes for `/api/ready` to show `"scanner":"ok"`. If it does not, the deploy FAILS and the rollback instructions print; `deploy.sh` does not roll back by itself (`fail_deploy` only reports), so the new build stays up with the flag on and uploads are refused (fail closed) until you act. On the first start clamd needs a few minutes to download the signatures. These checks are configuration-level plus one readiness probe: see the limits in `r1-runbook.md` (preflight limits).
5. **Verify by hand:**
   - `curl -s https://<host>/api/ready` shows `"scanner":"ok"`. `down` means clamd is unreachable; `disabled` means `CLAMAV_HOST` is empty.
   - As a teacher, upload a clean DOCX: it is accepted.
   - Upload a file made from the EICAR test string, typed by hand into a text file renamed .docx or embedded in a PDF (never commit it): expect the virus message.
   - Stop clamav and upload again: expect the 503 "cuba lagi" message.
   - Upload a file larger than 32 MB: it is refused with "Fail terlalu besar untuk diimbas".
6. **Request time:** ten files in one request are scanned one after the other. Keep (files x scan time) below the edge's 300 s.

**Rollback:** set `INTAKE_TEACHER_ENABLED=false`, and teachers get 403 again. clamav can stay running or be removed from `PP_PROFILES`. A deploy rollback (`rollback.sh`) to a build from before #78 is refused (exit 3, nothing changed) while `INTAKE_TEACHER_ENABLED` is true: set it to `false` first. `rollback.sh` finds out by running the target image once (`grep` for the `CLAMAV_SCAN_ENABLED` marker in `dist/main.js`); in pull mode it pulls the image first.

**Residual risk until enablement.** With `INTAKE_TEACHER_ENABLED=false` and no `CLAMAV_HOST`, admin Office/PDF uploads are not scanned, which is the same as before #78. Setting `CLAMAV_HOST` makes scanning required for every intake upload, admin included. The ClamAV enablement deploy should therefore follow soon after the 11 Nov deploy.

## 9. Staged V2 clone: order, final step and raw purge (KP-22, KP-23)

**Order.** The clone runs in stages with `deploy/vps/migration/slot.sh etl`. `migrate:core` (stage 1: users, schools, classes) runs before `migrate:activity` (stage 6: practice, wallets, gifts, articles and the other activity entities). Nothing enforces this order: the operator does. Both take the `etl:source:cloud` lock; exit 2 can mean "busy" (see `production-migration-slot.md`, section 2).

**At the start of EACH stage (stage 1 to stage 6), before the stage runs:** copy the pre-stage dump that `backup.sh` just wrote, and its checksum, to a folder that normal retention never touches:

```
d=/var/backups/pretasiplus/staged-clone/stage-<N>
install -d -m 700 "$d"
f=$(ls -1t /var/backups/pretasiplus/pp-backup-*.dump | head -n1)     # the pre-stage dump, check its time stamp first
cp -p "$f" "$f.sha256" "$d/" && (cd "$d" && sha256sum -c "$(basename "$f").sha256")
```

`backup.sh` retention only looks at the top level of `PP_BACKUP_DIR` (`find -maxdepth 1`), so the `staged-clone/` subfolder is never rotated away. The copy is a whole-database dump, so it holds personal data and, once raw data is in the database, raw `.cloud` data: it is purged with the rest (table below).

**Check step of each stage.** After each stage, run the verify for that stage's sector (`slot.sh` passes the flags to `migrate:verify` unchanged):

| Stage | What it loads | Check after the stage |
|---|---|---|
| 1 | core (users, schools, classes) | `deploy/vps/migration/slot.sh etl migrate:verify --sector core` |
| 2 | questions | `deploy/vps/migration/slot.sh etl migrate:verify --sector questions` |
| 3 | structured | `deploy/vps/migration/slot.sh etl migrate:verify --sector structured` |
| 4 | papers | `deploy/vps/migration/slot.sh etl migrate:verify --sector papers` |
| 5 | terbit | `deploy/vps/migration/slot.sh etl migrate:verify --sector terbit` |
| 6 | activity | `deploy/vps/migration/slot.sh etl migrate:verify --sector activity` |

`migrate:verify` also takes `--entities a,b` to check named entities only. Entities outside the stage's sector show "not in this stage" and do not fail the run. After stage 6, run ONE final full `deploy/vps/migration/slot.sh etl migrate:verify` with no flag: it must pass before the final step below.

**Operator rules learned on 11-12 Nov** (details and reasons: `r1-staged-clone-plan.md`, section 5):

- Manual `docker compose up/run` of api, frontend or migrate must pass `PP_IMAGE_TAG=$(cat /var/lib/pretasiplus-deploy/current.tag)`; the `:prod` default is a stale build. After any restart, `docker inspect -f '{{.Config.Image}}' pretasiplus-api-1` must equal `current.tag` and `/api/ready` must list `worker`. `slot.sh etl` and `load` refuse `prod`, `local` and `latest`.
- Commands inside a script fed by `ssh ... "bash -s" < script` that read stdin (`backup.sh`, `deploy.sh --dry-run`, `docker exec -i`, `psql`) need `</dev/null`, or they swallow the rest of the script.
- One named owner for UAT writes. Before each stage check `tmux ls`, `who`, running slot/backup/deploy/pg processes, non-idle `pg_stat_activity` and `max(_loaded_at)` of `staging_cloud.users`; if staging changed, re-run stage 1 before going on.
- The stage-1 `updated` count follows the loader's own comparison, not `updated_at` (V2 does not bump it on login). The G-5 verify check fails after stage 2 until stage 3 runs, and smoke block E activity failures after a deletion cascade stay until stage 6; neither is a no-go by itself.

**Retention decision (PO, KP-23).** The raw V2 dump and the per-stage dumps on UAT are kept until the staged clone is complete and verified, then DELETED 7 days after stage 6 finishes.

**Step 0, at stage 1: set a PROVISIONAL purge date.** `PP_RAW_PURGE_BY` defaults to 2026-11-06, which is already past, so as soon as raw data is on the host `restore-point.sh raw-check` exits 1 every night and `backup.sh` sends "RAW DATA RETENTION OVERDUE". At the start of stage 1 set `PP_RAW_PURGE_BY=<planned stage-6 date + 7 days>` in `prod.env`. When stage 6 passes, reset it to the actual date + 7 days (final step below). `raw-check` also lists the copied pre-stage dumps in `staged-clone/` as raw copies.

**Final step, once stage 6 and the final full verify have passed.**

1. Reset the purge date in `prod.env` from the provisional value to the real one: `PP_RAW_PURGE_BY=<date stage 6 finished + 7 days>` (`YYYY-MM-DD`, for example `date -u -d '+7 days' +%F` run on the day stage 6 passed). From that date `restore-point.sh raw-check` turns every remaining raw copy into a `RAW RETENTION OVERDUE` warning (exit 1), and the nightly `backup.sh` sends the alert "RAW DATA RETENTION OVERDUE". Before that date it only reports.
2. Do nothing else until the date; the copies stay as the fallback for the 7 days.

**Purge, on or after `PP_RAW_PURGE_BY`** (an operator on the UAT host as `ppdeploy`; needs the PO's go-ahead, and it is irreversible):

| What | Where | Command |
|---|---|---|
| The raw V2 dump and each per-stage dump (directories with `manifest.json`), and any `.tar.gpg` of them | wherever the stages were extracted (`PP_STAGE_DIR`, for example `/srv/pretasiplus/stage/<dump dir>`, and the `--dump-dir` given to `rebuild-db.sh`) | `deploy/vps/migration/slot.sh wipe-dump <dump dir> [<file>.gpg]` for each one. It overwrites, deletes, and exits 3 when a path does not exist (nothing deleted). `npm run dump:wipe` is the same step for the machine that ran `dump:cloud` |
| The copied pre-stage dumps and their `.sha256` | `/var/backups/pretasiplus/staged-clone/stage-<N>/` (N = 1 to 6) | `shred -u -n 1 -z <file>` for each file (or `rm` where shred is not possible, as `wipe-dump` does), then `rmdir` the stage folders and `staged-clone` itself |
| The files export given to `--files-dir` (raw uploads) | the host folder of the export | **It is the only input of the picture release pass: do not delete it before the last `migrate:structured --files-dir` repair run has been done and its "held pictures explained" count checked** (the held count should match what the verify report explains; `r1-runbook.md` section 11.2). Then delete the folder by hand: `rm -r <files export>` after checking the path with `ls` (outside the repo) |
| The throwaway staging cluster, if still present | `PP_STAGE_DIR/pgdata`, container `pp-stage-throwaway` | `deploy/vps/migration/slot.sh throwaway-down` |
| `staging_cloud` (raw `.cloud` copy) in the UAT database | the database | `deploy/vps/migration/slot.sh drop-staging`: asks you to type the database name (a terminal is required), holds `PP_LOCK_FILE`, drops `staging_cloud` only and checks that it is gone. (`rebuild-db.sh` already drops it at step 15 unless `--keep-staging` was used.) `archive_cloud` is the minimised archive kept by decision Q12 A (12 months): it is not part of this purge unless the PO says so |
| Restore points that hold raw data (`raw_data=yes`) and the PITR base backups and WAL from the clone window | `PP_BACKUP_DIR/restore-points`, `/walarchive/base` | after the schema is dropped: `restore-point.sh take post_drop`, then `restore-point.sh purge-raw --after post_drop` (asks for the database name), and `pitr.sh base --label post_drop` then `pitr.sh cleanup --keep-from <that base>` if PITR is on (see `production-migration-slot.md`, sections 3 and 4) |
| The deleted-at-source ids file in the reports folder (real data) | `PP_MIGRATION_OUT` | delete it by hand; the other reports hold aggregates and surrogate ids only |

**Verify that they are gone.**

- `deploy/vps/migration/restore-point.sh raw-check` prints `RAW CHECK OK: no copy of raw .cloud data found` and exits 0 (exit 1 lists what is left, exit 2 means a check could not run: fix that first).
- `deploy/vps/migration/slot.sh gonogo` shows the `raw data:` line with the same result, and `throwaway: none running`.
- `ls` of each dump directory, the files export, `PP_STAGE_DIR` and `/var/backups/pretasiplus/staged-clone` shows them absent (`wipe-dump` also logs `DUMP COPIES DELETED`).
- `select count(*) from information_schema.schemata where schema_name = 'staging_cloud';` gives 0.
- `restore-points/custody.tsv` shows the raw points with status `deleted`.
- Record the date and the operator name in the cutover notes.
