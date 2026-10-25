# 27 Oct timed rehearsal (A4 / P6) and night window budget (P7): .cloud to v2 (MIG-08 addendum)

- **Status:** draft for the LEAD. **Dress-rehearsed in part (23 Oct, synthetic data, local PostgreSQL 16 in host mode): the `D_xfer` forms of section 5.1 (encrypt, listing, extract) and both guard refusals of section 6. Track S (`slot.sh`, `restore-point.sh`) and everything else has not been run.** **A4-DRY (24 Oct, synthetic medium fixture seed 7, local PostgreSQL 16 in host mode, 4 CPU, 15 GB RAM, tip `a1eda500`): the whole Track R sequence of section 5.3 (T09, T11, T11a, T13 to T16, T15q, T17, `snapshot after_full`, T23, T22, restores, T27, T28) ran to its expected exit codes; the mismatches it found are fixed in this sheet and in the A1 sheet (q helper `--`, query (a), the T17 form, the T15q notes, the section 6 option labels, the `core-login-gaps` file).** Every command, flag, variable, exit code and output line below was checked against the code or the docs named next to it; where something is not implemented or not known it is marked **Perlu pengesahan** with the person who confirms. Nothing is started without the LEAD's explicit confirmation. **Track S statements were re-checked on 23 Oct against #166 head `a9fefff4`** (`slot.sh`, `restore-point.sh`, `pitr.sh`, `lib.sh`, `production-migration-slot.md`, `.env.prod.example`, `db-roles.sh`); if #166 moves again, re-check them.
- **Slug:** `v2-cutover-plan` (addendum). **Item:** half AM step 5 of MIG-08: plan steps A4 / P6 and P7 (budget, section 4.3). Docs only.
- **Builds on:** [cutover plan](v2-cutover-plan.md) sections 3 (P1, P5, P6, P7, P8), 3.1, 3.3, 4.0, 4.1 (A4, A5), 4.3, 4.6 (night card), 4.7, 5 and 6; the first sheet [A1 real-data rehearsal](rehearsal-a1-24oct.md); [rehearsal DB recipe](rehearsal-db.md); [migration runbook](../architecture/v2-migration-runbook.md) sections 12 to 18 (PR #123, merged on 23 Oct at `1f7ddb26`); `docs/ops/cloud-dump-procedure.md` (PR #125); `docs/ops/production-migration-slot.md` and `deploy/vps/migration/slot.sh`, `restore-point.sh`, `pitr.sh` (PR #166); [backup and restore drill](db-backup.md); MIG-07 reports (`docs/ops/mig07-rehearsal-report.md`, branch `be/AM-MIG-07-rehearsal`).
- **Time convention:** every time is Malaysia time (MYT, UTC+8) with UTC in brackets. Durations are in seconds or minutes as stated.
- **Marker:** "Perlu pengesahan" means not decided or not verified yet; it is to be confirmed by the person named.
- **Privacy:** this repo is public. Roles only; no host names, addresses, names, secrets or row values. Placeholders: `<db>`, `<dump dir>`, `<extract dir>`, `<restricted dir>`, `<files export>`.

## 1. What A4 is for

A4 is the second rehearsal of the whole night, production-like and timed (plan P6). It has two jobs:

1. Time every step of the night (plan P1 and section 4.3), so the budget of section 9 can replace the 3,611 rows/s placeholder (P7).
2. Prove the two production guards, the restore of a restore point, the night card read end to end, and the read-only smoke on a restored copy.

It runs on **27 Oct**, on the release sha that the LEAD re-pinned at A2 (code freeze, 25 Oct). If the ETL or the schema changed after A1, A1 is repeated at that sha too (P2).

**Roles.** The half AM migration operator runs the ETL lines and owns the budget (P7 owner is AM). Half AZ DevOps runs the host, `slot.sh`, `restore-point.sh` and the scratch copy. The dump operator provides the 24 Oct clock readings and reads the night card as the night operator. QA runs the e2e smoke on the Track S synthetic copy (never on Track R). The LEAD gives the start, reads the result and decides on P7. No agent session runs these steps or sees the data.

## 2. Two tracks: where each figure comes from

The code does not let one environment time everything. This is the reason (verified in the code):

- `slot.sh load` refuses a dump that is not marked `"raw": true`, or is marked `anonymised` or `synthetic` (`slot.sh`, `manifest_check`, `:146-149`; re-checked at `a9fefff4`, unchanged; it also refuses a `large_integers` note and `.partial` files, `:150-153`). The 24 Oct dump is marked anonymised, and `fixtures:generate` writes `"synthetic": true` (`fixtures/generate.ts`, the `manifest.json` it writes: `synthetic: true`, with the comment "`synthetic`, not `anonymised`").
- `slot.sh etl` runs with `NODE_ENV=production` and `PP_MIGRATE_TARGET_DB=<db>` (`slot.sh`, `cmd_etl`; `staging:profile` gets `NODE_ENV=production` only, `slot.sh:288`), and the ETL refuses staged data that holds the known dummy password hashes in production (`load/index.ts`, `assertNotSyntheticInProduction`). The anonymised dump holds them, so `slot.sh etl migrate:all` on that data is refused by design.
- `rehearsal-db.sh` forces `NODE_ENV=development` and accepts only attested anonymised or synthetic dumps.

So the 24 Oct dump (real shape and volume, anonymised) can only be loaded and migrated through `rehearsal-db.sh`. The scripts of the night (`slot.sh`, `restore-point.sh`) can only be exercised with data that is marked raw and holds no dummy hash.

| Track | Where | Data | Gives |
|---|---|---|---|
| **R** (rehearsal) | The rehearsal DB with production-like Postgres settings (recipe section 3: set `PP_PG_*` to the real VPS values; `status` must not print the `fsync` warning, else the figures are not valid for P7. `PP_PG_*` is read only by the Docker compose file: in host mode `rehearsal-db.sh` does not set it and `status` prints the host server's own settings, so half AZ sets them in the server's `postgresql.conf` instead) | The 24 Oct AM-10 dump, extracted on the rehearsal host | `D_load`, `D_copy`, `D_profile_dry`, `D_apply`, `D_verify`, the rates `r_B6` and `r_B7`, rejects, snapshot and restore timings, the two guard refusals |
| **S** (slot) | A scratch VPS (a restored copy of the target, never production) | A **Track S fixture** (see below) at fixture volume | `throwaway-up` and `-down`, `D_load` and `D_copy` through `slot.sh`, restore points (`take`, `verify`, `restore`), `gonogo`, the production-mode run at fixture scale, the e2e smoke target, the night card read end to end |

**Host class (fill in; no host names).** P7 is only as good as the host the rates came from:

| Host | CPU cores | RAM (GB) | Disk type | `fsync` | `PP_PG_*` set to the VPS values | Same class as the VPS? |
|---|---|---|---|---|---|---|
| Track R host | | | | | | |
| Track S host | | | | | | |
| Production VPS (AZ-09 pack; half AZ states it) | | | | on | n/a | n/a |

**Rule:** if the Track R host is faster than the VPS in CPU, disk or RAM, or its Postgres settings differ, then `r_B6` and `r_B7` are upper bounds and **P7 is provisional**. The post says "P7 provisional", and the LEAD decides whether to accept it, to repeat the Track R timing on a VPS-class host, or to apply a margin the LEAD names. A Track R host that is slower than or equal to the VPS keeps P7 firm.

**Rule for each figure:** take the larger (slower) of Track R and Track S for a step that exists on both, and say which one it was. Track R decides everything that scales with the number of rows; Track S decides the fixed cost of the scripts.

**Track S fixture.** `fixtures:generate --size medium --seed 7 --out <dir inside a .migration-out folder>` writes a synthetic dump (20,000 users, 127 tables, about 366,000 rows in MIG-07; 366,026 in the 23 Oct dress rehearsal; 366,075 at `a1eda500`) whose manifest says `"synthetic": true`, so `slot.sh load` refuses it, by design. `fixtures:generate` has no option for a loadable fixture. A scratch-only override in `slot.sh load` (one that refuses a production host) is requested on #166; until it exists, Track S `load` and every step after it cannot be rehearsed with a fixture: those rows are marked **BLOCKED until #166 has a scratch-only override** in section 4 and 5.2. Its password values are filler (`fakeHash` in `fixtures/generate.ts`), not the dummy hashes, so this fixture can **not** be used for the guard refusal below.

**The fixture must leave the checkout before `slot.sh load`.** `fixtures:generate` writes only inside a `.migration-out` folder of the checkout (an `--out` without a `.migration-out` segment stops with `The output directory must be inside a ".migration-out" folder (it is git-ignored).`, and one outside the checkout with `The output directory must be under the working directory or the repository root.`; `profile/render.ts` `prepareOutputDir`; `npm run -w @pp/api` runs in `apps/api`, so give `--out .migration-out/<fixture>`, a relative path, to get `<checkout>/apps/api/.migration-out/<fixture>` as the copy line below expects), but `slot.sh load` and `slot.sh wipe-dump` refuse any path inside the checkout (`pp_assert_outside_repo`, `deploy/vps/lib.sh`: "refusing a path inside the repository", exit 3). So: generate, then copy to a new directory outside the checkout and delete the first copy:

```bash
mkdir -m 700 <fixture dir outside the checkout>
cp -a <checkout>/apps/api/.migration-out/<fixture>/. <fixture dir outside the checkout>/
rm -rf <checkout>/apps/api/.migration-out/<fixture>
```

`<fixture dir outside the checkout>` is the `<fixture dir>` of section 5.2 and is on the encrypted volume; the data is synthetic, but it is wiped with `S wipe-dump` at the close like a dump.
**Perlu pengesahan (half AZ, LEAD):** the scratch-only override of `slot.sh load` requested on #166, and the LEAD's acceptance of it on a scratch host.

**Roster default hashes on Track S (optional, R32; only once the override exists and Q10 is in the release).** Put one line `PP_MIGRATE_ROSTER_DEFAULT_HASHES=<the fixture's shared default hash>` in the scratch `etl.env`, never on the command line (`slot.sh etl` logs its env list). Expect `note rosterDefaultHashes: 1` and `note rosterDefaultHashesWarning: 0`; smoke row F10 then reads `ok`. Keep the same value for every later `migrate:delta` / activity run: it is part of the core input hash that the activity preflight recomputes. On Track R (anonymised dump) the variable stays unset and the warning is expected (A1 sheet section 9, amber).

## 3. Preconditions

| # | Precondition | Evidence |
|---|---|---|
| P-1 | A1 green at the release sha (or repeated at it). | The A1 evidence block (A1 sheet, section 11). |
| P-2 | Release sha re-pinned at A2 and the checkout at that sha; PRs #122, #160, #123, #125 and #166 are in it. | `git rev-parse HEAD`; `grep -c` of the script names as in A1.0. |
| P-3 | An anonymised dump is on the rehearsal host: under the default of the A1 sheet I8 (the A1 extracted directory is deleted at the A1 close-out) the fresh hand-over of a **second AM-10 sitting on 27 Oct**, which plan 4.1 does not schedule; or, if the LEAD chose the alternative, the A1 extracted directory kept until the end of A4; inside 7 days of its sitting (until 31 Oct). | Custody line; `du -sh`. |
| P-3a | Only under the default of I8: the second sitting is booked by the LEAD for 27 Oct, with a time-box, the `pp_dump_ro` unlock and lock arranged with the data owner, and the option-file deletion or account lock of AM-10 section 3 step 8 (c) planned. | The LEAD's dated booking line (no values). |
| P-4 | The clock readings of the 24 Oct sitting (A1 sheet, I9). | The dump operator's list. |
| P-5 | `dump:check` was run by the dump operator (P8) and "rules OK" was received. Its line `Schema: <x> of <y> spec tables present, <rows> rows.` gives **N_night**, the best estimate of the night's rows (a number only; the report stays on the operator PC). | The number `N_night`. |
| P-6 | Track S host: a scratch VPS or a restored copy of the target, encrypted disk, `db.env`, the compose stack, the `migrate` image at the release sha, `PP_STAGE_DIR`, `PP_MIGRATION_OUT`; and, as `slot.sh` at `a9fefff4` checks them: `etl.env` (role `pp_etl`) in `PP_ENV_DIR`, else every `S etl` stops with exit 3 (`migrate_run`, `slot.sh:106`; made by `sudo deploy/vps/db-roles.sh secrets`); the database roles of PR #227 created by `deploy/vps/db-roles.sh apply`, because `S gonogo`, `S copy` and the `--apply` check of `S etl` read the target as `pp_stager` over the db socket (`slot.sh:76-79`), `S copy` runs `apply` itself before the drop and after the restore (`slot.sh:193,199`) and `R restore` runs it after `pg_restore` (`restore-point.sh:189`), so a restored copy of the target made before the roles existed needs `apply` once (**Perlu pengesahan (half AZ):** that the scratch copy has the roles); a Compose plugin that has `--env-from-file` (`production-migration-slot.md:49`); the release sha for `S etl migrate:all` and `migrate:delta`, dry-run too: `PP_RELEASE_SHA` (40 hex characters) in `prod.env`, or a git checkout at the release sha (`git rev-parse HEAD` of `PP_REPO`), else exit 3 "cannot determine the release sha" (`slot.sh:312-321`, F14; the other `S etl` commands only warn, `staging:profile` does not need it); `PP_MIGRATION_OUT` owned by uid `PP_MIGRATE_UID` (default 1000) with mode 700 (`check_out_dir`, `slot.sh:85-93`; no chmod, exit 3 with the `sudo install -d` line); free disk at least 5 times the dump size on `PP_STAGE_DIR` (plan B0) and the 3 times database size for restore points (`production-migration-slot.md` section 1). **`S gonogo` must be clean on the scratch copy, so also** (the checks of `slot.sh cmd_gonogo`): PITR on (`archive_mode` not off; base backup taken with `deploy/vps/migration/pitr.sh base --label first`, `pitr.sh status` shows archived above 0 and failed 0), else the line is `PITR off`; at least one backup `pp-backup-*.dump` in the backup folder and younger than 24 h (take one with `deploy/vps/backup/backup.sh --no-offsite`), else `backup: NO dump found  -> NO-GO` (the script prints the age; the plan's reading rule needs under 24 h); more than 30 % free disk on the backup volume; `/api/ready` through the edge returns 200 (the stack is up); the two points `pre_etl` and `pre_delta` verified with `--expect-migrations repo` (F8, `slot.sh:335`: each point must hold as many applied migrations as the folders of `apps/api/prisma/migrations` in the checkout, so take them after the final schema migrations, else `restore point <name> MISSING, damaged or older than the release migrations  -> NO-GO`); the reports folder ready (the `reports:` line, `slot.sh:360-362`). **Perlu pengesahan (half AZ):** scratch VPS or the rehearsal box for Track S, and its size against production. | A confirmation line and the first `S gonogo` lines. |
| P-7 | A3 is done (26 Oct): roles of P3, `IC_HASH_KEY` and the other names of P5 exist (names only). | The P3 and P5 evidence. |
| P-8 | The maximum night window is set (default 6 hours); the LEAD confirms it on 27 Oct (plan 4.3). | A dated line. |
| P-9 | The read-only SQL checks of plan 4.5 part 1 exist as a file: [`docs/ops/sql/smoke-readonly.sql`](sql/smoke-readonly.sql) (AM1-3, R25). One `BEGIN TRANSACTION READ ONLY` / one `SELECT` / `ROLLBACK`, so any write fails; it prints rows `check_id \| description \| value \| expected \| ok` with `ok` = `ok`, `FAIL` or `info`, and the last row `Z0` is the FAIL count. Aggregates only. Without `staging_cloud` (after the drop) the staging comparisons (B1, B2, D1, D2) show `info` `n/a`. 89 rows on the synthetic fixture (1.8 s). Rows F3 to F10 are the C5 forced-change gate (AM1-1's predicates folded in). F3, F4, F5, F8, F9 and F10 compare with the run's `etl_runs.counters->'notes'` and show `info` on a build without those notes (before Q10 merges). F6 (derivable but not flagged = 0) and F7 (NULL hashes as expected) are `ok`/`FAIL` on any build. F3 to F7 show `info` `n/a` without `staging_cloud`, and F4/F5 show `info` when `countsFromCommittedRows` = 1. So before Q10 only F6 and F7 can turn red. Once Q10 is in the release, F10 = `FAIL` is expected on Track R (the anonymised dump runs with `PP_MIGRATE_ROSTER_DEFAULT_HASHES` unset) and is recorded as amber (R32, A1 sheet section 9). **Gate:** at A1/A4 on Track R, `Z0` = 0 before Q10, and after it `Z0` = 1 with F10 as the only `FAIL`; on Track S with the `etl.env` line of the roster paragraph set, F10 is `ok`, so `Z0` = 0; at the night (B8), `Z0` must be 0 (F10 stays strict on purpose). | The file's sha at the release; the `Z0` value. |
| P-10 | The e2e smoke command and how it points at the restored copy. It runs on the Track S synthetic copy only. On Track R only read-only SQL counts are allowed, and the API and the frontend are never started on that DB (its accounts share the dummy password). **Perlu pengesahan (QA, half AZ):** the plan names the smoke but not the command; the repo has `npm run test:e2e` (Playwright). | The command line (no values). |
| P-11 | The Track S host carries **no production secret and no offsite backup**: its own `IC_HASH_KEY`, database secrets and API secrets, all different from production; no S3 or other offsite credentials in its env files; backup timers off, or `backup.sh --no-offsite` only. | Names only: the list of variable names present and a yes/no per item; never a value. |

## 4. Timing sheet

One row per timed item. Fill every cell; the only blanks allowed are cells marked n/a and row T24. `Rows` is the number of rows the step handles; `Rate` is rows per second where the step is a row-moving step. `Source of figure` says where the number comes from: **R** (Track R), **S** (Track S), **24** (the 24 Oct sitting), **MIG-07** (a measured figure from `mig07-rehearsal-report.md`, for comparison only).

| ID | Step | Plan id (B-step) | Command (full forms in section 5) | Start | End | Duration | Exit | Rows | Rate | Source | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T01 | `D_dump`: the `dump:cloud` part of `dump:produce` (and `dump:check`, which reads no rows) | B2 | `dump:produce` at the 24 Oct sitting; clock readings, no per-phase output | | | | 0 | | | 24 | Boundary: the line `Done: ... RAW personal data`. |
| T02 | `D_dump`, files: banner export with `SHA256SUMS` | B2 | AM-10 section 8.1 (`ssh ... find ... sha256sum`, copy without symlinks) | | | | | files | | 24 | Only if allowed (A1 sheet, I4). Else "not measured". |
| T03 | `D_xfer`: encrypt | B3 | `tar \| gpg --symmetric --cipher-algo AES256` | | | | 0 | | | 24 and R | Size of the `.gpg`. |
| T04 | `D_xfer`: mandatory listing check | B3 | `gpg --decrypt \| tar -tzf - \| wc -l` | | | | 0 | | | 24 and R | Count equals entries plus directories. |
| T05 | `D_xfer`: `sha256sum`, `scp`, remote `sha256sum`, compare | B3 | as the card | | | | | | MB/s | 24 and S | The two values equal? |
| T06 | `D_xfer`: decrypt and extract on the receiving host | B3 | `gpg --decrypt \| tar -xzf - -C <extract dir>` | | | | 0 | | | S | `manifest.json` exists. |
| T07 | `D_xfer`: wipe of the operator copy | B3 | `dump:wipe --dir "$work"` | | | | 0 | | | 24 | "local copies deleted". |
| T08 | Throwaway cluster up | B0 | `S throwaway-up` | | | | 0 | | | S | `THROWAWAY UP`. |
| T09 | `D_load`: `staging:load` | B4 | Track S: `S load --from <dump dir>`; Track R: `rehearsal-db.sh load-dump` | | | | 0 | | | R and S | R includes the pattern scan; subtract it if it was timed alone. **BLOCKED (Track S part) until #166 has a scratch-only override.** |
| T10 | Freeze proof SQL (rehearsed with `T` = the dump's end time) | B4 | read-only query per staged table with `updated_at` | | | | | tables | | R | **Perlu pengesahan (half AZ):** the one-line form. |
| T11 | `D_copy`: stage copy | B5 | Track S: `S copy`; Track R: `rehearsal-db.sh stage` | | | | 0 | | | R and S | `STAGE COPY PASSED`, 89 and 38 (the counts after FIT-FIX, the `.cloud` schema fit, which also sets the `slot.sh` `PP_STAGE_EXPECT` default to `archive_cloud:38 staging_cloud:89`; on a checkout without FIT-FIX the default is still 35/83 and `copy` stops with exit 4). On Track S `copy` runs `db-roles.sh apply` twice (before the drop and after the restore) and drops and restores as `pp_stager` (`slot.sh:193-199`), so those seconds are inside the row. Other lines: `STAGE COPY COUNTS DIFFER: ... (expected archive_cloud:38 staging_cloud:89): STOP ...` (exit 4, `:203-204`), `STAGE COPY FAILED` (`:201`). **BLOCKED (Track S part) until #166 has a scratch-only override.** |
| T11a | `ANALYZE` after the stage copy (planner statistics; A1 sheet A1.5) | B5 to B6 | `q "ANALYZE"` (Track R); on Track S through the target `psql` (**Perlu pengesahan (half AZ):** a `slot.sh` form: at `a9fefff4` there is still none; `slot.sh` has no `ANALYZE` and `cmd_copy` does not run one, `slot.sh:186-206`; `target_psql` is an internal function, not a subcommand, and runs as `pp_stager`, which owns only `staging_cloud` and `archive_cloud`, `slot.sh:74-79`) | | | | 0 | | | R and S | Seconds; part of `D_copy` in the budget. |
| T12 | Throwaway down and wipe | B5 | `S throwaway-down`; `S wipe-dump <extract dir 2>/anon` (the `.gpg` is already wiped after T06, section 5.1, so it is not named) and `S wipe-dump <fixture dir>`, then `ls` of each path | | | | 0 | | | S | `THROWAWAY DESTROYED`, `DUMP COPIES DELETED`. The `ls` must say "No such file or directory". At `a9fefff4` `slot.sh wipe-dump` exits 3 for a path that is not there (`wipe-dump: <path> does not exist: nothing was deleted`) unless `--missing-ok` is given (STOP block only, then it prints `DUMP COPIES NOT PRESENT`), so name only paths that still exist and never print `DUMP COPIES DELETED` for a wrong path (`slot.sh:233-239,249-250`). The directory must hold a `manifest.json`, else exit 2 (`:241`). The fixture wipe is **BLOCKED until #166 has a scratch-only override** (nothing was loaded); `S throwaway-down` and the wipe of `<extract dir 2>/anon` can run. |
| T13 | `staging:profile` | B6 | `rehearsal-db.sh exec target -- npm run staging:profile -w @pp/api`; Track S: `S etl staging:profile` | | | | 0 | | | R and S | **BLOCKED (Track S part) until #166 has a scratch-only override.** |
| T14 | `D_profile_dry`: `migrate:all --dry-run` (first load: core only) | B6 | see section 5 | | | | 0 | `N_core` | `r_core_dry` | R (and S) | Activity "skipped". **BLOCKED (Track S part) until #166 has a scratch-only override.** |
| T15 | `D_apply`: `migrate:all --apply` (includes the verify) | B7 | see section 5 | | | | 0 | `N_core + N_act` | `r_B7` | R (and S) | Four stage runs from `etl_runs`. **BLOCKED (Track S part) until #166 has a scratch-only override.** Check the activity note `challenges.difficulty_unmapped`: 0 expected (FIT-FIX OQ5; a non-zero count means .cloud stores difficulty words other than easy/medium/hard, so those challenges became `medium`: report it). |
| T15a | of which: core dry-run, core apply, activity dry-run, activity apply | B7 | query (a) of the A1 sheet, A1.11 | | | | | | | R | Seconds per run. |
| T15q | `D_questions` (QLOAD, plan **B11**: daylight after the B10 close, **outside `W`**; LEAD decision 24 Oct 03:35 MYT, #113 6373295943; cutover plan 4.8 and runbook section 12 step 7 on #261): `migrate:questions` dry-run, then `PP_ALLOW_MIGRATE_APPLY=1 ... migrate:questions --apply`, then `migrate:verify`, a no-op re-run of the apply, and `migrate:rollback` coverage (A4 extra, plan 4.8) | after T16, before `snapshot after_full` (section 5.3 order), as an extra step | Track R: `"$RDB" exec target -- npm run migrate:questions -w @pp/api -- --as-of="$ASOF"`, then the same with `env PP_ALLOW_MIGRATE_APPLY=1` and `--apply`; Track S: `S etl migrate:questions` (#261 adds it to the `slot.sh etl` allow-list, `slot.sh:257` on #261) | | | | 0 | questions read / loaded / rejected | | R (and S) | **Precondition:** #261 merged and in the release sha, and the A4 dump made **after** `dump:grants` was re-run for the three new columns (`questions.explanation` and `questions.image_path`, on the tip since #258; `question_options.image_path`, which comes with #261) and re-staged; else `migrate:questions` refuses (missing columns) and the row is "not run". Exit 4 when the source lock is held. Record the exit codes, the recon (loaded, rejected by reason), the `html_stripped` / `explanation_html_stripped` / `body_has_html` counters and the held-with-image count (text only), and the seconds of the dry-run, the apply, the no-op re-run and the rollback (#261 synthetic 100k: 18 s / 19 s / 4 s / 8 s). On the anonymised dump `image_path` is a pseudonym, so the image copy is not exercised. A1 runs without QLOAD. **Dress run (24 Oct, `a1eda500`, 4,000 archive questions, so the seconds are not comparable): dry-run exit 0 `migrate:questions dry-run: run <id> succeeded` (3 s), apply exit 0 `migrate:questions apply: run <id> succeeded` plus `analyzed 7 tables: ...` (3 s), `migrate:verify` exit 0 with the `questions` row `ok` (it reads `not-run` before the apply), no-op apply exit 0 (2 s), no-op dry-run exit 0 (2 s). The counters print only when above 0 (a fixture shows `difficulty_missing`, `excluded.status.diarkib`, `topic_chapter_mismatch`, `topic_unmapped`; the `html_stripped` family appears only on data that has the tags). The no-op re-run still prints `loaded` = the first run's `loaded` and keeps only the `excluded.*` notes, so "loads nothing" is read from the `report:` file of the re-run (`counters.questions`: `inserted` 0, `updated` 0, `unchanged` = loaded; counts only), not from the table. After `migrate:rollback --apply` a fresh dry-run exits 2 with ``Preflight failed: no migrated users in etl_id_map. run `migrate:core --apply` first.`` (the id maps are gone); record that exit code as the proof of the removal.** |
| T16 | `D_verify`: `migrate:verify` | B8 | `migrate:verify` | | | | 0 | | | R (and S) | `verify pass`. **BLOCKED (Track S part) until #166 has a scratch-only override.** |
| T17 | Read-only SQL checks of plan 4.5 part 1 | B8 | `q "$(cat docs/ops/sql/smoke-readonly.sql)"` (works only with the `q` helper of the A1 sheet that has `--` before `"$1"`; the older helper stops with `node: bad option` and exit 9) or `psql -X -v ON_ERROR_STOP=1 -f` the file, against the restored copy | | | | 0 | checks | | R (read-only SQL counts only) or S | `Z0` = 0 FAIL, or on Track R with Q10 in the release `Z0` = 1 with F10 as the only `FAIL` (amber, R32; P-9); at the night `Z0` must be 0. Post the count of `ok` / `FAIL` / `info` rows and the check ids of any `FAIL` (no values). Synthetic data shows deliberate fixture FAILs on criteria 2 and 3. **Dress run (24 Oct, `a1eda500`, Track R fixture after QLOAD): 89 rows = 68 `ok` + 17 `info` (A4, A7, A8, C1 to C3, D3, D4, F1, F2, U1, U2, X1.*) + 4 `FAIL`: F10 (expected on Track R), X2 (200 ORPHAN_PARENT on users), X3 (19 entities over the reject threshold) and the total row Z0 (value 3); 2 s.** **BLOCKED (Track S part) until #166 has a scratch-only override.** |
| T18 | `slot.sh gonogo` read by the rule | B0, B9 | `S gonogo` | | | | 0 | | | S | No `NO-GO`, `MISSING`, `PITR off`; `api` line `-> 200`; `throwaway: none running`; `reports: <dir> ready (owner uid 1000, mode 700)`; the last line `gonogo: complete (every check above ran)` (absent = the run stopped half way = NO-GO, `slot.sh:363-364`). The two `criterion 8` lines read `restore point <name> present, sha256 ok, migrations equal the release` (F8, `--expect-migrations repo`). The `raw data:` line is information, never a NO-GO: strings in section 5.2. A bare scratch VPS prints `PITR off` and `NO dump found -> NO-GO`: that is a P-6 failure, fix it first. |
| T19 | Restore point `pre_etl`: take and verify, after the final schema migrations | A5 | `R take pre_etl --operator "<role>"`; `R verify pre_etl --expect-migrations repo` | | | | 0 | bytes | | S | `RESTORE POINT TAKEN`, `RESTORE POINT OK: pre_etl ... migrations=<m> (equals the release: <F>)` (`R verify pre_etl --expect-migrations repo`, `restore-point.sh:169`); migration count (section 7). |
| T20 | **Restore of a restore point, small (the night's Case 2):** `restore pre_etl` | 4.6 Case 2 | `R restore pre_etl` (typed database name) | | | | 0 | | | S | `RESTORED: pre_etl ... in <N> s`; `<N>` includes the `db-roles.sh apply` after `pg_restore` (`restore-point.sh:189-190`). **BLOCKED until #166 has a scratch-only override** (the Case 2 shape needs the migrated and staged state of T15). |
| T21 | Restore of a **large** point (migrated and staged state; the replan case): take `pre_delta` after T15, then restore it | 6.3 | `R take pre_delta --operator "<role>"`; `R restore pre_delta` (typed database name) | | | | 0 | bytes | | S and R | Track R: `restore-snapshot after_full --yes`, and the dump form `restore-snapshot <name> --yes`. **BLOCKED (Track S part) until #166 has a scratch-only override.** |
| T22 | `migrate:rollback` dry-run and apply (fallback R-b) | 6.3 | see section 5 | | | | 0 | deleted | | R | Counts only. |
| T23 | Idempotency run: `migrate:delta` dry-run, apply, verify (**mandatory**: plan P1 lists the delta dry-run and apply among the timings; not in `W`) | 4.7 | section 5.3; needs the migrated state, so it runs **before** T22 | | | | 0 | | `r` | R | All `unchanged`. If T23 cannot run, the MIG-07 figures (delta apply 513 s in pass 3b, a no-op delta 515 s, 20k synthetic users) stand in and are labelled so in the post. |
| T24 | Delta with changed rows (**replan only**) | 4.7 | needs a second dump | n/a | n/a | n/a | n/a | n/a | n/a | n/a | **Not planned**; no second dump exists. Covered by T23. |
| T25 | The night card read end to end | 4.6 | section 8 | | | | n/a | defects | | | Minutes and a defect count. |
| T26 | e2e smoke on a Track S restored copy of synthetic data (not in `W`) | P6 | the command of P-10 | | | | 0 | | | S | Pass or fail and counts only, never a failure tail; no trace, screenshot or video is kept. **BLOCKED until #166 has a scratch-only override** (it needs the migrated Track S copy). |
| T27 | Guard refusal 1: synthetic-data guard | P6 | section 6 | | | | 2 | | | R | Accepted = failed. |
| T28 | Guard refusal 2: target guard | P6 | section 6 | | | | 2 | | | R | Accepted = failed. |
| T29 | Unfreeze of `.cloud` (plan 6.4) | 4.6 Case 1 and 2 step 2 | the `.cloud` maintenance-switch unfreeze (`.cloud` owner's command) | n/a | n/a | n/a | n/a | n/a | n/a | n/a | **Not measurable at A4**: `.cloud` is live and is never frozen or switched in a rehearsal. The plan 6.4 placeholder stays; **Perlu pengesahan (`.cloud` owner, LEAD):** whether the owner can state or time the unfreeze on a non-production instance. |
| T30 | Switch-back (plan 6.4) | 6.3 | DNS switch-back | n/a | n/a | n/a | n/a | n/a | n/a | n/a | **Timed in P9 on 28 Oct**, not at A4 (plan P9: "Switch and switch-back durations"). |

`D_freeze` (20 min) and `D_gonogo` (15 min) are fixed by the plan and are not timed.

**Without the `slot.sh` override A4 can still turn green:** T01 to T08 (the transfer forms and `S throwaway-up`), T09, T11, T13 to T17 and T21 on **Track R** only, T10, T12 (`S throwaway-down` and the wipe of `<extract dir 2>/anon`), T18 (the first `S gonogo`), T19 (`R take` and `R verify` of `pre_etl` before any staging), T22, T23, T25, T27 and T28. **BLOCKED** until the override exists: the Track S halves of T09, T11, T13 to T17 and T21, the fixture wipe of T12, T20, T26, the closing `S gonogo` of 5.2, and the real-role `S etl` pass. T24, T29 and T30 are n/a. A blocked row is reported as BLOCKED, not as failed. **Perlu pengesahan (LEAD):** whether A4 can be green with them blocked, and so whether P7 uses the Track R figures alone for those steps.

## 5. Commands

Same helpers as the A1 sheet, section 5 (`RDB`, `DB`, `ASOF=2026-10-29`, `step`, `q`). Track S uses two shell functions on the scratch VPS, defined once from the repository root: `S() { deploy/vps/migration/slot.sh "$@"; }` and `R() { deploy/vps/migration/restore-point.sh "$@"; }` (plain variables `S=...` would not run as commands: `S: command not found`, exit 127). **Track R steps follow the A1 sheet exactly** (A1.2 to A1.15) on a fresh `up` and a fresh load: the A1 sheet gives the expected output, the red conditions and the evidence queries; A4 adds what follows.

### 5.1 D_xfer on the real-size dump (T03 to T07)

The operator PC copy of the 24 Oct dump was wiped at the sitting (AM-10 step 8). At A4 the source is the extracted directory on the rehearsal host (the fresh hand-over, or the A1 directory if the LEAD kept it, A1 sheet I8). The figure used for the budget is the larger of the 24 Oct readings and this repeat.

```bash
# on the host that holds <extract dir>; <work> is a new directory with mode 700, outside the repo
umask 077
name="pp-rehearsal-xfer-<stamp>.tar.gz.gpg"; out="<work>/$name"
step t03-encrypt bash -c 'set -o pipefail; tar -C <extract dir> -czf - anon | gpg --symmetric --cipher-algo AES256 -o "$1"' _ "$out"
step t04-listing bash -c 'set -o pipefail; gpg --decrypt "$1" | tar -tzf - | wc -l' _ "$out"      # equals the entries of anon plus 1
sha256sum "$out"
# on the receiver, before the scp: mkdir -m 700 <restricted dir>
step t05-scp scp "$out" <user>@<receiver host>:<restricted dir>/
# on the receiver: sha256sum <restricted dir>/$name  (the operator compares)
# on the receiver: mkdir -m 700 <extract dir 2>   (umask 077 first)
step t06-extract bash -c 'set -o pipefail; gpg --decrypt <restricted dir>/"$1" | tar -xzf - -C <extract dir 2>' _ "$name"
```

The forms are those of plan 4.6 B3 with the anonymised directory `anon` in place of `raw files`; the passphrase is fresh, typed on the receiver, never in a file or a chat, and destroyed with the `.gpg` file (plan 3.3 item 5). The `gpg` prompts for the passphrase, so `step` will wait for you. After T06, wipe both `.gpg` files and `<work>`; `<extract dir 2>/anon` is wiped at T12 (`S wipe-dump`, B5) and checked again with `ls` at the close (section 11). All of them are on the custody list of the A1 sheet I8. T07 is the 24 Oct reading of `dump:wipe` (AM-10 step 8).

### 5.2 Track S: the script path on the scratch VPS

**Pre-step (mandatory, before any `R` or `S` command).** `R restore` drops and recreates the database named in `db.env`, so the operator first proves that this host is the scratch host and not production:

```bash
hostname -s                                                     # the host
grep -E '^(POSTGRES_DB|POSTGRES_USER)=' "${PP_ENV_DIR:-/etc/pretasiplus}/db.env"    # the database and the role; never print POSTGRES_PASSWORD
```

Both lines are read aloud to half AZ DevOps and compared with the **written production list** (host, database and role names, kept by half AZ outside the repo). The scratch database name must differ from the production one. Any match stops A4 (red, section 10) and nothing is started. **Perlu pengesahan (half AZ):** the production list.

Order is the card's (plan 4.6 and A5). `--files-dir` is not used in this track unless a files fixture exists (see the open points).

```bash
S() { deploy/vps/migration/slot.sh "$@"; }; R() { deploy/vps/migration/restore-point.sh "$@"; }   # once, from the repository root
# A5 analogue: restore points first (they refuse to be taken after staging_cloud exists)
R take pre_etl   --operator "<role>"        # T19: RESTORE POINT TAKEN: pre_etl file=... bytes=... sha256=... tables_with_data=<n> raw_data=no ... duration_s=<n>
R take pre_delta --operator "<role>"        # same state; the plan asks for it (A5 item 2; Perlu pengesahan, plan 3.1 gap a)
R verify pre_etl --expect-migrations repo   # RESTORE POINT OK: pre_etl file=... sha256 matches, <n> tables with data, migrations=<m> (equals the release: <F>)
R verify pre_delta --expect-migrations repo # same line for pre_delta (S gonogo runs both)
# B0
S gonogo                                    # T18, read by the rule of plan 4.6
S throwaway-up                              # T08: THROWAWAY UP: container ..., database <db>_staging, ... archive_mode=off
# From `S load` to the last `S gonogo` the rows are BLOCKED until #166 has a scratch-only override: `slot.sh load` refuses a synthetic fixture (section 2). Kept as the target order.
S load --from <fixture dir>                 # <fixture dir> = the copy OUTSIDE the checkout (section 2). T09: LOAD DONE: archive_cloud:38 staging_cloud:89 in <db>_staging, duration_s=<n>
S copy                                      # T11: STAGE COPY PASSED: archive_cloud:38 staging_cloud:89, duration_s=<n> (a count other than the expected one: STAGE COPY COUNTS DIFFER ... (expected archive_cloud:38 staging_cloud:89), exit 4)
S throwaway-down                            # T12: THROWAWAY DESTROYED: container ... removed
S wipe-dump <fixture dir> <fixture .gpg, if any>   # DUMP COPIES DELETED: ...; then ls of both paths (a path that is not there exits 3; only --missing-ok skips it, with DUMP COPIES NOT PRESENT)
# B6, B7, B8 in production mode (set by slot.sh); BLOCKED like the lines above
S etl staging:profile                       # T13: ETL STEP staging:profile exit=0 duration_s=<n>
S etl migrate:all --dry-run --as-of=2026-10-29      # T14: ETL STEP migrate:all exit=0
S etl migrate:all --apply   --as-of=2026-10-29      # T15: ETL STEP migrate:all exit=0 (slot.sh adds PP_ALLOW_MIGRATE_APPLY=1)
S etl migrate:verify                        # T16: exit 0 and a line verify pass
S gonogo                                    # B9 analogue: throwaway: none running; stage: archive_cloud:38 staging_cloud:89
```

Expected strings are from `slot.sh` and `restore-point.sh` at `a9fefff4`. The line `ETL STEP <cmd> exit=<rc> duration_s=<n> (reports in <dir>)` is printed for every `S etl` that reached the run (`slot.sh:326`); the line before it, `etl: <cmd> <args> (env: ...)`, lists the variables set, including `PP_GIT_SHA=<40 hex>` (`:324`). `S etl` stops before the run with: exit 2 for `migrate:core` and `migrate:activity` (`:257`); exit 3 `no staging_cloud in the target: run copy first` for `migrate:all` and `migrate:delta` with `--apply` only (`:281-287`); exit 3 `cannot determine the release sha (set PP_RELEASE_SHA to the 40-character sha): etl_runs.git_sha would be NULL` for `migrate:all` and `migrate:delta` in every mode (F14, `:317`; the other commands except `staging:profile` print `WARN: no release sha (PP_RELEASE_SHA / git): PP_GIT_SHA not passed`, `:318`); exit 3 `<dir>/etl.env is missing: sudo deploy/vps/db-roles.sh secrets, then deploy/vps/db-roles.sh apply` (`:106`); exit 3 `PP_MIGRATION_OUT <dir> is <owner:mode>, needs owner:mode <uid>:700: sudo install -d ...` (`:92`). With `--files-dir` it also needs `SHA256SUMS` readable by `PP_MIGRATE_UID` (exit 3, `:299-300`). `S etl` accepts also `migrate:archive-minimise` (`:256`).

`S gonogo` lines (`slot.sh:330-365`): `criterion 8: restore point <name> present, sha256 ok, migrations equal the release` or `... MISSING, damaged or older than the release migrations  -> NO-GO`; `criterion 8: PITR on, last archived WAL <w> at <t>, failed_count <n>` or `criterion 8: PITR off (archive_mode=off): restore points only  -> NO-GO at night ...`; `stage: archive_cloud:38 staging_cloud:89 in the target ...`; `backup: newest dump <f> is <n> h old` or `backup: NO dump found  -> NO-GO`; `disk: <n>% free on the backup volume`; `stage disk: <n> GiB free on <dir>`; `api: /api/ready through the edge -> <code>`; `throwaway: none running`; `raw data: <last line of raw-check>`; `reports: <dir> ready (owner uid 1000, mode 700)`; `gonogo: complete (every check above ran)`.

`R raw-check` (also the `raw data:` line of `S gonogo`, and printed by `pitr.sh status`; `restore-point.sh:229-269`): before `PP_RAW_PURGE_BY` (default 2026-11-06, so on 27 Oct) it exits 0 with `RAW CHECK OK: no copy of raw .cloud data found (restore points, staging_cloud, PITR base backups)` or `RAW CHECK: <n> copy(ies), due by 2026-11-06`; on Track S after the copy the staged schema counts as a copy, which is expected, not a defect. From that day each copy is a `WARN: RAW RETENTION OVERDUE` line and it exits 1 (`RAW CHECK OVERDUE: <n> copy(ies) past <date>`). `RAW CHECK INCOMPLETE: <n> copy(ies) found so far, due by <date>; some checks could not run (see the warnings)` exits 2: a check could not run (db down, archive folder unreadable); report it, it is not a pass.

Every `S etl` run (B6 to B8: `staging:profile`, `migrate:all --dry-run`, `migrate:verify`, and the rest) now connects as the migration role `pp_etl`: `compose run --env-from-file etl.env` replaces the service's `api.env` and `migrate.env` (`migrate_run`, `slot.sh:104-108`, DB-ROLES #227). So the Track S ETL run itself is the real-role pass; the scratch admin role is not used for it. The denials of the stage-only role `pp_stager` (the statements it must not be able to run) are recorded as exit codes and fixed refusal lines only. This pass is BLOCKED like the rest of Track S ETL. A1 and Track R run the ETL as the rehearsal admin and prove nothing about grants: `rehearsal-db.sh exec` also hands the child `PP_REHEARSAL_ADMIN_URL`, `PGPASSWORD` and `PGUSER` from the shell (checked in the dress rehearsal), so `env -u PP_REHEARSAL_ADMIN_URL` alone would not remove the admin credentials and is not added. **Perlu pengesahan (half AZ):** the statement list.

For T21 and T20 (restores on the scratch VPS, after T15 and T16 and the smokes; BLOCKED until #166 has a scratch-only override, like T15):

```bash
R take pre_delta --operator "<role>"        # a second point, now with the migrated and staged state: the large point (raw_data=yes: it holds staging_cloud)
R restore pre_delta                         # T21 (typed database name): RESTORED: pre_delta (...) in <N> s. api and frontend stay stopped ...
S etl migrate:verify                        # a restored migrated point must give exit 0 and verify pass
R restore pre_etl                           # T20 (typed database name): the night's Case 2 shape (restore of the small point over a large database)
```

`R restore` stops `api` and `frontend`, drops and recreates the database, restores the dump, runs `db-roles.sh apply` (the restored objects belong to the superuser; `restore-point.sh:184-189`), starts nothing, and asks for the typed database name unless `--yes` is given (the LEAD pre-approves `--yes` at G6). On the scratch copy the operator types the name (a terminal is needed); `--yes` is used in one deliberate pass only, which rehearses G6 and is marked as such in the timing sheet. The raw-flag points `pre_delta` (if taken after the copy) are on the deletion list: `purge-raw` runs after a `post_drop` point (not part of A4).

### 5.3 Track R: B6, B7, B8 and T22 to T23 with the real-shape data

As the A1 sheet, A1.7 to A1.13 and O1 to O3, with these changes. **Order:** T13 to T16, then **T15q**, then `snapshot after_full`, then **T23** (the idempotency run needs the migrated state: `migrate:delta` exits 2 when the database has no migrated users, `orchestrate.ts` `assertFirstLoadExists`), then T22 (rollback), then the restores (`restore-snapshot after_full` and the dump form, T21). **T15q sits between T16 and `snapshot after_full`** (so `after_full` holds the questions, the delta of T23 and the rollback of T22 run on the loaded bank, the rollback prints `questions` and `question_versions` rows, and the "fresh dry-run after the rollback" of plan 4.8 is the exit 2 of the T15q row, run right after T22). Take query (a) of the A1 sheet right after T15 (and before T15q and T23: later runs add rows to it). `/usr/bin/time` was not installed on the dress host (package `time`), so install it on the Track R host first or record peak RSS as not measured. Type `--as-of=2026-10-29` exactly: `migrate:all` ignores an unknown flag (A1 sheet I5). Other changes: production-like settings (section 2), the `--as-of` of the night, and one more recorded item per step: **peak RSS** (`/usr/bin/time -v` before `npm`) and **WAL** (`pg_current_wal_lsn()` before and after the apply, A1 sheet A1.11 d). Also post the forced-change count of A1 sheet A1.11 (e) (`flagged of migrated`, by reason; counts only), the input to BUG AM2-A1. On Track R only read-only SQL counts are run; the API and the frontend are never started on its DB.

### 5.4 Per-run seconds and rows (for the rates)

Query (a) of the A1 sheet, A1.11 (taken before T15q and T23; its `stage` column reads `core`, `activity` or `questions`), gives per run: stage, seconds, `rows_read`, `rows_loaded`, `rows_rejected`. From it:

| Symbol | Formula |
|---|---|
| `N_core`, `N_act` | `rows_read` of the core and activity apply runs |
| `N_read` | `N_core + N_act` |
| `rho` | `N_read / N_manifest` |
| `kappa` | `N_core / N_read` |
| `r_B6` | `N_core / (s(T13) + s(core dry-run of T14))` |
| `r_B7` | `2 x N_read / s(T15)` |

## 6. The two guard refusals (plan P6)

**Why this section is more than a copy of the plan.** The plan says the production guard is exercised "with a synthetic fixture" and that the run "must be refused by the synthetic-data guard". By the code, the synthetic-data guard (`assertNotSyntheticInProduction`, `load/index.ts:72-86`) refuses only when `staging_cloud.users` holds one of five known dummy password values: the bcrypt dummy in the `2y`, `2a` and `2b` forms, the argon2 dummy, or the text `not-a-hash-anonymised`. The AM-10 anonymised dump holds them (it replaces every non-empty password with one of them, `anonymise/passwords.ts`); the output of `fixtures:generate` does **not** (its passwords are filler). The unit tests prove the guard by planting `not-a-hash-anonymised` into one fixture user (`test/migration/core/core.db.spec.ts`, `activity/guards.spec.ts`). So a plain synthetic fixture would be **accepted** and the rehearsal would fail for the wrong reason.

**Data to use (choose one, record which):**

- **Option (a), preferred:** the rehearsal DB at the state `pre_etl` with the stage of the 24 Oct anonymised dump (Track R). No change to any data. After the main Track R sequence, `restore-snapshot pre_etl --yes` returns to that state.
- **Option (b), a fixture (dress-rehearsed 24 Oct on Track R, exit 2 with the fixed line):** a rehearsal DB staged from a synthetic fixture, with one planted row: `update staging_cloud.users set password = 'not-a-hash-anonymised' where id = (select min(id) from staging_cloud.users)` (as the unit tests do), run as the admin role on the rehearsal DB only, and restored from `pre_etl` afterwards.

Both guards sit in front of any write. Their order in the code: the CLI's apply guard first (`kit/apply-guard.ts`, called from `cli.ts` for every `--apply`), then the lock, then the core dry-run, where the synthetic-data guard runs (`runCore`, before the runner creates an `etl_runs` row).

**Before each refusal** (state check; write the seven numbers down; at the `pre_etl` state the five `etl_*` tables and `users` are 0):

```bash
q "select 'etl_runs', count(*) from etl_runs union all select 'etl_recon', count(*) from etl_recon union all select 'etl_rejects', count(*) from etl_rejects union all select 'etl_checkpoints', count(*) from etl_checkpoints union all select 'etl_id_map', count(*) from etl_id_map union all select 'users', count(*) from public.users union all select 'schools', count(*) from public.schools"
```

### 6.1 Refusal 1: the synthetic-data guard

**Data.** Track R: the stage of the 24 Oct anonymised dump, option (a), nothing planted. Track S: option (b) only (the `fixtures:generate` output holds filler hashes, not the marker), and only once #166 has the scratch-only override of `slot.sh load`; until then the Track S form is BLOCKED and Track R carries the proof (same code path).

**Preconditions (both tracks, in this order; any miss = stop, not a pass).**
1. The target is the rehearsal DB or the scratch copy, never production: `q "select current_database()"` prints `$DB` (Track S: the scratch name and host written at P-6, initialled by half AZ). No API or session is connected.
2. State `pre_etl` (staged, not migrated). Write down the seven counts of this section; `etl_runs` is 0.
3. The marker is in the stage (read-only; the pattern is the documented public dummy of `anonymise/passwords.ts`, not a secret). The result must be at least 1:

```bash
q "select count(*) from staging_cloud.users where password = 'not-a-hash-anonymised' or password like '\$2_\$10\$1BYJgcHHYPQGKg8zT39ARe/w5AeZ41OVkDbo33Yy8S.1BexZs1KEC' or password like '\$argon2id\$v=19\$m=19456,t=2,p=1\$rh2l5K/3jj9wZ18JnsWzBA\$%'"
```

On Track R the 24 Oct stage gives at least 1 with no change. On Track S it gives 0 on the fixture: plant one row first, on the scratch copy only (as the scratch admin through the T11a `psql` form; **Perlu pengesahan (half AZ):** that form). The original value is kept inside `staging_cloud`:

```sql
create table staging_cloud.zz_guard_plant as select id, password from staging_cloud.users order by id limit 1;
update staging_cloud.users u set password = 'not-a-hash-anonymised' from staging_cloud.zz_guard_plant p where u.id = p.id;
```

**Command.** Track R (`NODE_ENV=production` inside the command; `exec` supplies `IC_HASH_KEY`). Track S (`slot.sh etl` already sets `NODE_ENV=production` and `PP_MIGRATE_TARGET_DB`; `--dry-run` is enough, the guard runs in `runCore` in every mode):

```bash
step guard1 "$RDB" exec target -- env NODE_ENV=production "PP_MIGRATE_TARGET_DB=$DB" PP_ALLOW_MIGRATE_APPLY=1 npm run migrate:all -w @pp/api -- --apply --as-of="$ASOF"   # Track R
step guard1s S etl migrate:all --dry-run --as-of="$ASOF"   # Track S, scratch only
```

| Item | Expected (from the code) |
|---|---|
| Exit code | **2**. Track S: the line `ETL STEP migrate:all exit=2 duration_s=<n> ...` |
| stderr | `Refusing to migrate in production: staging_cloud holds the dummy password hashes of an anonymised or synthetic dump.` |
| stdout | Track R: `--apply target: database "<db>" on <host>` (do not copy it). Track S `--dry-run`: no such line. Both: no `migrate:all core dry-run: run <id>` line. |
| Written nothing | The seven counts equal the "before" numbers (`etl_runs` still 0: the guard stops before the runner creates the row). `count(*)` of `staging_cloud.users` equal before and after. |

**Remove (Track S only, right after the counts).** Put the original back and drop the helper; the marker count must then be 0. Track R: nothing to remove (after the main sequence, `restore-snapshot pre_etl --yes` as before).

```sql
update staging_cloud.users u set password = p.password from staging_cloud.zz_guard_plant p where u.id = p.id;
drop table staging_cloud.zz_guard_plant;
```

**Record:** data used (R anonymised stage / S planted), marker count, exit code, the fixed stderr line, the seven counts before and after, plant removed yes/no. **Not a valid proof:** exit 1 (`IC_HASH_KEY is required in production ...`), exit 0, any `run <id>` line, any count change, or a marker count of 0 before the run.

*Why (AM1-3, R29):* `assertNotSyntheticInProduction` (`load/index.ts:72-86`) reads only `staging_cloud.users.password` (`:77-80`) against `SYNTHETIC_PASSWORDS` (`:65`) when `NODE_ENV` is production (`:69,76`). The anonymiser rule `hash-password-dummy` (`anon.config.json:19`, `anonymise/passwords.ts:35-44`) writes those values, and `staging:load`/`stage` copy the column unchanged. `fixtures:generate` writes `fakeHash`/`DEFAULT_HASH` (`fixtures/generate.ts:39,95-97`), which are not in the list; `runCore` calls the guard at `:122`, before an `etl_runs` row exists.

### 6.2 Refusal 2: the target guard (no `PP_MIGRATE_TARGET_DB`)

```bash
step guard2 "$RDB" exec target -- env -u PP_MIGRATE_TARGET_DB NODE_ENV=production PP_ALLOW_MIGRATE_APPLY=1 npm run migrate:all -w @pp/api -- --apply --as-of="$ASOF"
```

`env -u PP_MIGRATE_TARGET_DB` makes sure a variable exported in your shell does not leak in (`rehearsal-db.sh exec` clears only `CLOUD_SOURCE_URL` and `PP_STAGING_DB_ALLOWLIST`).

| Item | Expected |
|---|---|
| Exit code | **2** (`ApplyGuardError`, `kit/apply-guard.ts:41-45`) |
| stdout | **No** `--apply target:` line (the guard threw before it) |
| stderr | `Refusing --apply in production: PP_MIGRATE_TARGET_DB must equal the connected database name ("<db>") on <host>.` (do not copy the host) |
| After | The seven counts unchanged; no new `etl_runs` row; no lock was taken |

Optional third and fourth lines of the same table (each must also exit 2 and change nothing): `PP_MIGRATE_TARGET_DB=some_other_database` gives the same message; without `PP_ALLOW_MIGRATE_APPLY` the message is `Refusing --apply: set PP_ALLOW_MIGRATE_APPLY=1 to allow writes by the migration kit.`

### 6.3 Verdict and the production form

**Accepted = failed rehearsal.** If either command exits 0 or 1, prints a `run <id>` line, or changes any count, A4 is red (section 10) and the fix is a developer task. The refusals are recorded as the text of the table: exit code, the fixed line, the seven counts before and after.

`slot.sh etl` sets `NODE_ENV=production` and `PP_MIGRATE_TARGET_DB=<db>` itself on every run except `staging:profile` (`NODE_ENV` only, `slot.sh:259,288`), so refusal 2 cannot be shown through `slot.sh`; the composition of the variables is verified by reading `cmd_etl`; a production-mode dry-run through `slot.sh` is BLOCKED (section 2). Refusal 1 through `slot.sh` needs a stage with dummy hashes in the production-mode copy, which `slot.sh load` does not allow (section 2). Both refusals are therefore shown on Track R, with the identical code path (`cli.ts`, `kit/apply-guard.ts`, `load/index.ts`).

## 7. Restore time and the migration-count check on restore points

**Restore time: what to record for every restore** (T20, T21, and the Track R restores of the A1 sheet A1.15, O1, O3):

| Field | Source |
|---|---|
| Point name and form | Track R: template copy or `--dump` file; Track S: `restore-point.sh` custody line (`name`, `bytes`, `raw_data`) |
| Size of the point (bytes or `du`) | custody line, or the `snapshot ... written as a dump (<size>)` line |
| State being replaced (small or migrated and staged) | The caller |
| Duration (seconds) | Track S: `RESTORED: <name> (...) in <N> s`; `<N>` runs from before the stop of `api` and `frontend` to after the `db-roles.sh apply` that follows `pg_restore` (`restore-point.sh:180,189-190`). Track R: `[time] restore-snapshot <name>: <s>s` |
| Exit code | `echo $?` |
| Result lines | Track R: `ROLLBACK VERIFIED ...` and `MIGRATION CHECK PASSED: <n> of <n> ...`. Track S: the `RESTORED` line; then the counts check |
| Services | Track S: `api` and `frontend` stay stopped; v2 stays dark; no restart at night (plan 4.6 Case 2 step 5) |
| Host settings | `fsync` on (the `status` warning absent): a restore timed with `fsync` off is not valid. MIG-07 used template copies with `fsync` off (3 to 6 s) and never timed a dump-form restore |

The restore does not enter `W` (it happens only after a STOP, and `.cloud` is unfrozen first, plan 4.6 Case 2 step 1). It is recorded to state the worst case from a STOP to a restored database, and as plan section 6.4 asks. Plan 6.4 also lists the unfreeze and the switch-back: the unfreeze of the real `.cloud` cannot be measured at A4 and the switch-back is timed in P9 on 28 Oct (rows T29 and T30). MIG-07 figures for comparison only: restore `pre_etl` 5.5 s and 4.4 s, `after_full` 16.7 s, `migrate:rollback --apply` 19 s (synthetic, 20k users).

**Migration-count check on restore points (plan A5 item 2 and criterion 8).** A point taken before the final schema migrations fails the check on restore (MIG-07 pass 4: a 33-migration snapshot on a 36-migration tree gave `MIGRATION CHECK FAILED: 33 applied, 36 in apps/api/prisma/migrations`). The rule:

1. `F` = folders at the release sha: `ls -d apps/api/prisma/migrations/*/ | wc -l`.
2. `n` = migrations applied in the point's database state: the number of rows of `_prisma_migrations` with `finished_at` set and `rolled_back_at` null (the query `rehearsal-db.sh` itself uses: `select count(*) from _prisma_migrations where finished_at is not null and rolled_back_at is null`).
3. `n` must equal `F`, and the names must match (the script compares the lists with `diff`).
4. Record `n` and `F` as text for every point: at `R take` time (the state taken is the live state, so the query on the live database just before `take` is the point's `n`) and again after a test `R restore`.

Where it is automatic: Track R. `restore-snapshot` prints `MIGRATION CHECK PASSED: <n> of <n> migrations applied in '<db>'` or fails with `MIGRATION CHECK FAILED` (exit 1), and `status` prints `applied: <n> of <F> in the folder` before a snapshot (A1 sheet A1.6).
Where it is partly automatic: Track S. At `a9fefff4` `restore-point.sh verify <name>` counts the applied migrations inside the point file (`pg_restore --data-only -t _prisma_migrations`, rows with `finished_at` set and `rolled_back_at` null; `restore-point.sh:116-121`) and prints `RESTORE POINT OK: <name> file=... sha256 matches, <n> tables with data, migrations=<m>`. With `--expect-migrations repo` it compares `<m>` with the number of folders in `apps/api/prisma/migrations` of the checkout and prints `... migrations=<m> (equals the release: <F>)`, or stops with exit 3 `MIGRATION CHECK FAILED: <name> holds <m> applied migrations, the release has <F>: take the point again after the final schema migrations` (`:161-169`). It compares counts only, not names. `S gonogo` runs this for `pre_etl` and `pre_delta` (F8, `slot.sh:335`). `take` and `restore` lines still carry no count (name, size, sha256, tables-with-data count and seconds only). Record `<m>` and `<F>` from the `verify` line for every point, after `take`. **Perlu pengesahan (half AZ):** the one-line way to run the count query on the live VPS database after a test `R restore` (the scripts use the `db` container), and whether the count must also be on the `take` line or in `custody.tsv` (the plan's A5 item 2 needs it as text; the `verify` line may be enough).

A new schema migration after a point is taken means the points are taken again (A5 item 2).

## 8. The night card read end to end (T25)

The dump operator, as the night operator, reads plan section 4.6 from B0 to B10, the B9 checklist, the stop table, the common block and the rollback cases, **in order, with the half AZ DevOps present**, and checks every command against the scripts at the release sha. Record the minutes and every defect. A defect is **blocking** (a G6 blocker) or **not blocking**.

Checks that the reading must close (each is a fact from the code or the plan; the third column is what was found when this sheet was written):

| # | Item of the card | Check | Found (from the code at the time of writing) |
|---|---|---|---|
| 1 | B0, B9 `S gonogo` | The lines `NO-GO`, `MISSING`, `PITR off`, `-> 200`, `throwaway: none running` exist in the output | Present in `slot.sh cmd_gonogo` (`:330-365`, plus `raw data:`, `reports:` and the end line `gonogo: complete (every check above ran)`). It checks `pre_etl` and `pre_delta` with `verify --expect-migrations repo` (F8, `:335`) and prints `MISSING, damaged or older than the release migrations  -> NO-GO` without one or with another migration count: `R take pre_delta` is needed (plan 3.1 gap a) and both points are taken after the final schema migrations. |
| 2 | B6, B7 `--files-dir=<files export>` | The path is readable inside the `migrate` container | At `a9fefff4` `cmd_etl` mounts `--files-dir <host dir>` read-only at `/files` (after a readability check of `SHA256SUMS` for uid `PP_MIGRATE_UID`), and with `--apply` also the api uploads volume (compose volume `apifiles`, found exactly once) at `/var/lib/pretasiplus/files` with `FILE_STORAGE_DIR` set (`slot.sh:293-309`; plan P5, 3.1 gap c). Solved in code, not yet shown on a run: **blocking until shown.** **Perlu pengesahan (half AZ).** |
| 3 | B6, B7 `--content-owner` | A decision | The card has none; content rows are rejected without it (A1 sheet, A1.9). Needs the LEAD. |
| 4 | B4 freeze proof | A one-line read-only form | `slot.sh` has no subcommand for it (plan B4). Section 5 row T10. |
| 5 | Case 2 step 4 and A5 | The migration count of a point | `restore-point.sh verify` prints `migrations=<m>` and, with `--expect-migrations repo`, `(equals the release: <F>)` (`:169`); `take` and `restore` print none (section 7). Closed for `verify`. |
| 6 | C5 `migrate:archive-minimise` through `slot.sh etl` | The command is accepted | At `a9fefff4` the accepted list also has `migrate:archive-minimise` (`slot.sh:256`; it gets `PP_ALLOW_MIGRATE_APPLY=1` in every mode, `:277`): `staging:profile`, `migrate:all`, `migrate:delta`, `migrate:verify`, `migrate:rollback`, `migrate:link-questions`, `migrate:export-question-reports`, `migrate:archive-minimise` (plan 3.1 gap b, closed). Daylight step, not blocking the night. |
| 7 | Case 2 step 6 `S etl migrate:rollback --confirm <db>` | Both gates are set by the script | `cmd_etl` adds `PP_ALLOW_MIGRATE_ROLLBACK=1` and `PP_ALLOW_MIGRATE_APPLY=1` for the rollback, with `NODE_ENV=production` and `PP_MIGRATE_TARGET_DB`. The code accepts `--confirm <db>` and `--confirm=<db>`. |
| 8 | The B7 expected text | `ETL STEP migrate:all exit=0`; `verify pass: <n> entities, <m> checks` | Both strings exist (`slot.sh`; `orchestrate.ts printVerify`). |
| 9 | One source lock | The card says the standalone `migrate:core` and `migrate:activity` do not take the lock | **Outdated.** They take the same lock since AM-08 and exit 2 when it is held (`load/command.ts`, `load/activity/command.ts`, `kit/source-lock.ts`; runbook section 12 and 19). `migrate:all` and `migrate:delta` exit 4 when it is held; `migrate:rollback` exits **2** (it throws `RollbackRefusedError`, which extends `ApplyGuardError`, `verify/rollback.ts:141`, and `cli.ts` maps `ApplyGuardError` to exit 2). The advice (use only `migrate:all`) stands. |
| 10 | Step ids of `slot.sh` and `production-migration-slot.md` | Match the plan's numbering (A4, A5, B0 to B10) | Updated at `a9fefff4` (F13): the `slot.sh` header and `production-migration-slot.md` (header, sections 6 and 8) use the plan's section 4.0 ids (`slot.sh` header: A5, B0, B4 to B9, C5, C6; the doc: A3 to A5, B0 to B10, C3); the old ids A12 and B11 to B13 appear only in the sentence that says they map as the plan shows (`production-migration-slot.md:278`), and no longer in `slot.sh`, `restore-point.sh` or `pitr.sh`. Closed; re-check if #166 moves. |
| 11 | Every **Perlu pengesahan** of the card (VPS access, the `.cloud` maintenance switch, the pre-arranged unlock and lock of `pp_dump_ro`, shell access and the secret store, how `--files-dir` and `FILE_STORAGE_DIR` reach `S etl`) | Each is answered or the night is a no-go | Plan 4.6, "Before the night": if any is missing at G6, the night is a no-go. |

## 9. Window budget (P7, plan section 4.3)

The budget replaces the 3,611 rows/s placeholder with measured figures. `W` is computed by the half AM migration operator (P7 owner is AM) on 27 Oct, and the LEAD decides.

### 9.1 Formula (restated from plan 4.3)

```
sum = D_freeze (20 min, fixed)
    + D_dump + D_xfer + D_load + D_copy
    + D_profile_dry + D_apply + D_verify (incl. the read-only smoke)
    + D_gonogo (15 min, fixed)
W   = 1.25 x sum                 (the 25 % buffer is inside the window)
D_profile_dry ~ N_core / r       D_apply ~ 2 x N / r
```

Here `N` is the number of source rows the ETL reads and `r` is rows per second. This sheet fixes the units so that measured and projected values are the same thing:

```
N_read        rows read in one full pass = N_core + N_act            (sum of etl_recon.source_count of the apply runs)
rho             N_read / N_manifest                                     (measured; about 1)
kappa             N_core / N_read                                         (measured)
r_B6          N_core / (s(staging:profile) + s(first core dry-run))   rows per second, B6 pass
r_B7          2 x N_read / s(migrate:all --apply)                     rows per second, B7 (the 2 = dry-run plus apply)
For the night: N_read_night = rho x N_night      (N_night = rows of the latest dump:check, P-5)
D_profile_dry = kappa x N_read_night / r_B6
D_apply       = 2 x N_read_night / r_B7
```

At the placeholders (`rho = 1`, `kappa = 1`, `r_B6 = r_B7 = 3,611`) this is exactly the plan's `D_profile_dry = N / r` and `D_apply = 2 x N / r`, so the plan's illustration table stays valid.

### 9.2 Which value to use

| Quantity | Rule |
|---|---|
| `r_B6`, `r_B7` | The **slower** (lower) of the valid runs (A1 and A4). A run that was red does not count. If the runs differ by more than 30 %, say so to the LEAD: MIG-07 saw 527 s (pass 3), 718 s and 964 s (pass 5) for the same `migrate:all --apply` on one host, about 1.8 times between the fastest and the slowest (the 668 to 682 s of pass 4 were `migrate:delta --apply` runs), so use the slowest and keep the others as the spread. A4 on production-like settings governs when it is the only valid run; A1 is a lower-bound check. |
| `rho`, `kappa` | From the run whose rate was used. |
| Sanity check against MIG-07 | MIG-07 pass 3 ran the full `migrate:all --apply` in 526.7 s (`mig07-rehearsal-report.md` P3.1) on a dump of 366,026 rows (P2.1) whose activity stage reads about 330,000 rows per pass (pass 1, section 3, note on peak throughput). Two passes over 366,026 rows in 526.7 s is `r_B7` of about 1,390 rows/s (about 1,250 rows/s counting the activity rows alone), roughly 0.35 to 0.4 of the 3,611 placeholder, on a local cluster with `fsync` off. If the A1 and A4 rates are far above that, find out why before trusting them; if they are near it, the largest `N` of the plan (11.7 million) is too high (at 1,390 rows/s and the same fixed 125 min it is about 4.5 million). This is an illustration from synthetic data, not a measurement of `.cloud`. |
| `D_dump` | The 24 Oct reading (T01, plus T02 if the files export was allowed). If a rehearsal MySQL source exists for a repeat at A4 (**Perlu pengesahan, half AZ and the `.cloud` owner**), the larger. AM-10 section 8 says the A4 repeat is against a synthetic or anonymised source, never the real `.cloud`; plan P6 says the figure comes from the 24 Oct sitting (the plan replaces the older AM-10 wording). |
| `D_xfer` | The sum T03 to T07: the larger of the 24 Oct readings and the A4 repeat (section 5.1) for each sub-step. |
| `D_load`, `D_copy` | The larger of Track R and Track S (T09, T11). Subtract the pattern scan from Track R `load-dump` only if it was timed alone. |
| `D_verify` | T16 plus T17 (verify and the read-only SQL checks); the larger of the runs; if P-9 is missing, the plan's 20 min stays and the budget is marked incomplete. |
| `N_night` | The `dump:check` total of P-5 (27 Oct), and the 24 Oct manifest total as a cross-check. **Perlu pengesahan (LEAD):** whether to add an allowance for rows added between 27 Oct and the night (the 25 % buffer covers time, not rows). |
| Fixed items | `D_freeze` 20 min and `D_gonogo` 15 min, as the plan. |
| Scaling to the night's size (an **assumption**, stated as such) | Track S runs on a fixture, and `D_xfer` may run on a different size than the night. Scale **linearly**: row-moving Track S steps (`D_load`, `D_copy`, restore points) by `N_night / N_fixture` (rows) or by bytes of `staging_cloud` plus `archive_cloud`, whichever is larger; `D_xfer` sub-steps (encrypt, listing check, `scp`, extract) by bytes: `night dump bytes / measured bytes`, with the night's bytes estimated from the 24 Oct dump (`du -sh`) plus the files export if it is included. Fixed costs (container start, checks) are not scaled. If the scaled Track S figure and the Track R figure of the same step differ by more than 30 %, use the larger and tell the LEAD. Record the scale factor in the fill-in table. |

### 9.3 Fill-in table

All durations in minutes (seconds divided by 60). `Used` is the value that goes into the sum. The table is the template for the real A1/A4 values and stays empty until then; the **synthetic, provisional** figures of 23 Oct are in the separate block 9.3a and must not be copied into it.

| Item | A1 | A4 (R) | A4 (S) | 24 Oct | Used | Source of the used value |
|---|---|---|---|---|---|---|
| `N_manifest` (rows) | | | n/a | | | |
| `N_night` (rows) | | | | n/a | | P-5 |
| `rho` | | | n/a | n/a | | |
| `kappa` | | | n/a | n/a | | |
| `r_B6` (rows/s) | | | n/a | n/a | | slower |
| `r_B7` (rows/s) | | | n/a | n/a | | slower |
| Scale factor applied (Track S rows, bytes; `D_xfer` bytes) | n/a | n/a | | | | section 9.2 |
| `D_freeze` | fixed | fixed | fixed | fixed | 20 | plan |
| `D_dump` | n/a | n/a | n/a | | | T01 (+T02) |
| `D_xfer` | n/a | | | | | T03 to T07 |
| `D_load` | | | | n/a | | larger |
| `D_copy` | | | | n/a | | larger |
| `D_profile_dry` (computed) | | | | n/a | | `kappa x N_read_night / r_B6` |
| `D_apply` (computed) | | | | n/a | | `2 x N_read_night / r_B7` |
| `D_verify` (with smoke) | | | | n/a | | larger |
| `D_gonogo` | fixed | fixed | fixed | fixed | 15 | plan |
| **`sum`** | | | | | | |
| **`W = 1.25 x sum`** | | | | | | |
| `D_questions` (QLOAD, B11, T15q) | | | | n/a | | **outside `W`**: daylight after B10 (cutover plan 4.8); recorded for the B11 slot, not added to the sum |
| Maximum window (default 360 min) | | | | | 360 | LEAD confirms (P-8) |
| **Margin = 360 - `W`** | | | | | | |
| Margin to 345 (`B9` ends so that `B10` fits in the 15 min before T+6:00) | | | | | | **Perlu pengesahan (LEAD):** which limit applies |
| Largest `N_night` that fits | | | | | | see below |
| Restore time, small point (T20), not in `W` | | | | | | |
| Restore time, large point (T21), not in `W` | | | | | | |
| `migrate:rollback --apply` (T22), not in `W` | | | | | | |

**Largest `N_night` that fits:** with `Fixed = D_freeze + D_dump + D_xfer + D_load + D_copy + D_verify + D_gonogo` (minutes) and `ETL_max = (360 / 1.25 - Fixed) x 60` (seconds),

```
N_night_max = ETL_max / ( rho x ( kappa / r_B6 + 2 / r_B7 ) )
```

(replace 360 by 345 for the stricter limit). If `ETL_max` is zero or negative, nothing fits: the fixed part alone is over the window. Each minute taken off `Fixed` adds `60 / ( rho x ( kappa / r_B6 + 2 / r_B7 ) )` rows; at the placeholders that is about 72,000 rows per minute, as the plan says.

### 9.3a Provisional, synthetic (23 Oct): a first W before A4

**Every number in this block is synthetic, provisional.** It is a first reading for the LEAD, not a measurement of `.cloud` or of the VPS. The real `N_night` comes from the 24 Oct `dump:check` / manifest (P-5) and the real rates from the A1 and A4 runs; when they exist, this block is replaced by the table of 9.3.

**Inputs (synthetic, provisional).** All on the synthetic medium fixture as generated before FIT-FIX (118 tables then; the stage after #258 has 127, `N_manifest` = 366,026 rows, 20,000 users), on 4 vCPU / 15 GiB cloud VMs with a local PostgreSQL 16 (not production hardware, `fsync` on, default tuning):

| Source | Figures |
|---|---|
| A1 dress rehearsal, 23 Oct (this sheet's author) | `load-dump` 11 s; stage copy 3 s; `staging:profile` 1 s; `migrate:all --dry-run` 8 s; `migrate:all --apply` 490 s (first, quiet run) and 558 s (busy machine); `migrate:verify` 5 s; restore `pre_etl` 2 s; `migrate:rollback --apply` 17 s; `N_core` 39,110, `N_act` 295,786, `N_read` 334,896, `rho` 0.915, `kappa` 0.117; `r_core_apply` 8,502, `r_act_apply` 1,092, `r_overall` 1,216, `r_B7` 1,200 to 1,367 rows/s |
| AM1-1 integration run, 23 Oct (#113) | `migrate:all --apply` 610.9 s on about 366k rows (the slowest, used below); WAL about 499 MB; verify 4.4 s; restore 1.6 to 2.2 s |
| AM1-3 AM-10 dress rehearsal (#113 comment 6365605536) | `dump:cloud` 4.1 s for 366,026 rows / 96.2 MB raw (about 89,000 rows/s, about 11 s per million rows); `D_xfer` 4.6 s (about 5 s per 100 MB raw; loopback network; synthetic text compresses about 13:1, so real data will be slower) |

**Step 1: seconds at the synthetic N (366,026 rows), synthetic, provisional.**

| Item | Seconds | Where from |
|---|---|---|
| `D_dump` | 4.1 | AM1-3 |
| `D_xfer` | 4.6 | AM1-3 |
| `D_load` | 11 | A1 `load-dump` (scan plus load) |
| `D_copy` | 3 | A1 stage copy |
| `D_profile_dry` | 9 | A1 command seconds: profile 1 + dry-run 8 (the sheet's `r_B6` form, 39,110 / (1 + 5.2) = 6,308 rows/s, counts run seconds only) |
| `D_apply` | 610.9 | AM1-1, slowest of 490 / 558 / 610.9 (about 1,096 rows/s by the `r_B7` form, 2 x 334,896 / 610.9) |
| `D_verify` | 5 | A1 (AM1-1: 4.4); the read-only SQL checks and the smoke (P-9) are not measured here |
| ETL and transfer part | 647.6 s = 10.79 min | sum of the seven rows |

`sum` = `D_freeze` 20 + 10.79 + `D_gonogo` 15 = 45.79 min. **`W` = 1.25 x 45.79 = 57.2 min (0.95 h) at N = 366,026, synthetic, provisional.** Margin to 360 = 302.8 min; to 345 = 287.8 min.

**Step 2: cost per million rows (scaling by rows, an assumption: section 9.2), synthetic, provisional.** Factor = 1,000,000 / 366,026 = 2.7321. The seconds of Step 1 are per manifest row, so `rho` and `kappa` are already inside them.

| Row-scaled step | Seconds per million rows | Calculation |
|---|---|---|
| dump | 11.2 | 4.1 x 2.7321 |
| xfer | 12.6 | 4.6 x 2.7321 (by bytes: 96.2 MB per 366,026 rows is 263 MB per million, about 13 s) |
| load | 30.0 | 11 x 2.7321 |
| copy | 8.2 | 3 x 2.7321 |
| profile + dry-run | 24.6 | 9 x 2.7321 |
| apply (610.9 s, conservative) | 1,669.0 | 610.9 x 2.7321 |
| verify | 13.7 | 5 x 2.7321 (verify is probably less than linear; kept linear) |
| **Total** | **1,769.3 s = 29.49 min per million rows** | sum |

**Step 3: `W` as a function of N (millions of rows, `N_M`), synthetic, provisional.**

```
W(N_M) = 1.25 x (35 + 29.49 x N_M) = 43.75 + 36.86 x N_M      minutes
N_max(limit) = (limit - 43.75) / 36.86                          millions of rows
check: N_M = 0.366026 gives 43.75 + 13.49 = 57.2 min (Step 1)
```

| N | W (min) | Calculation | Fits 360? | Fits 345? |
|---|---|---|---|---|
| 1,000,000 | 80.6 (1 h 21) | 43.75 + 36.86 x 1 | yes | yes |
| 3,000,000 | 154.3 (2 h 34) | 43.75 + 36.86 x 3 | yes | yes |
| 5,000,000 | 228.0 (3 h 48) | 43.75 + 36.86 x 5 | yes | yes |
| `N_max` for 360 min | | (360 - 43.75) / 36.86 = **8.58 million rows** | | |
| `N_max` for 345 min (advisory) | | (345 - 43.75) / 36.86 = **8.17 million rows** | | |

Sensitivity of the apply figure (same arithmetic): with 558 s, `W` = 43.75 + 33.85 x `N_M` and `N_max` = 9.34 / 8.90 million; with the quiet 490 s run, `W` = 43.75 + 29.98 x `N_M` and `N_max` = 10.55 / 10.05 million (limits 360 / 345).

**Step 4: the same with the plan's placeholders for the steps that synthetic data cannot represent (a more careful reading), synthetic, provisional.** Synthetic text compresses about 13:1 and moves on loopback, so the dump, transfer, load, copy and verify figures above are surely too small for real data. Here the non-ETL steps keep the plan's placeholders of 9.6 (`D_freeze` 20, `D_dump` 25, `D_xfer` 15, `D_load` 20, `D_copy` 10, `D_verify` 20, `D_gonogo` 15 = 125 min fixed) and only `D_profile_dry` + `D_apply` use the measured figures: (24.6 + 1,669.0) s per million rows = 28.23 min.

```
W(N_M) = 1.25 x (125 + 28.23 x N_M) = 156.25 + 35.28 x N_M      minutes
```

| N | W (min) | Calculation |
|---|---|---|
| 1,000,000 | 191.5 (3 h 12) | 156.25 + 35.28 |
| 3,000,000 | 262.1 (4 h 22) | 156.25 + 35.28 x 3 |
| 5,000,000 | 332.7 (5 h 33) | 156.25 + 35.28 x 5 |
| `N_max` for 360 min | | (360 - 156.25) / 35.28 = **5.77 million rows** |
| `N_max` for 345 min (advisory) | | (345 - 156.25) / 35.28 = **5.35 million rows** |

**For the LEAD, in one sentence (synthetic, provisional):** on synthetic data at the measured speeds, the whole night comes to about 57 minutes at 366,026 rows and grows to about 154 minutes at 3 million and 228 minutes at 5 million rows, so it fits the 6 hour window up to about 8.2 to 8.6 million rows (about 5.3 to 5.8 million rows if the non-ETL steps take the plan's placeholder times), and the real answer waits for the real `N_night` from the 24 Oct `dump:check` and the real rates from A1 and A4.

This block is not the P7 decision (section 9.5): it rests on synthetic text, loopback transfer, a different host and a linear scaling assumption, and the 3,611 rows/s placeholder is not used in it.

### 9.4 Per-step latest times (advisory: a proposal for the LEAD, not a plan rule)

Plan 4.3 and P7 test only the total `W`. This table is **not** in the plan. It is an extra reading the half AM operator offers, because the card (plan 4.6) also has a latest time for every step. It uses the same convention as `W`: the 25 % buffer applies to every duration, including `D_freeze`. `C_k = 1.25 x (20 + sum of the durations of B2 to step k)`, in minutes after `T` (01:00); `C_B9end` therefore equals `W`. Fill the duration column from the table above.

| Step | Duration used (min) | Cumulative `C_k` | Latest (minutes after T) | Latest (MYT) | Fits? |
|---|---|---|---|---|---|
| B2 `D_dump` | | | 70 | 02:10 | |
| B3 `D_xfer` | | | 95 | 02:35 | |
| B4 `D_load` | | | 125 | 03:05 | |
| B5 `D_copy` | | | 140 | 03:20 | |
| B6 `D_profile_dry` | | | 170 | 03:50 | |
| B7 `D_apply` | | | 300 | 06:00 | |
| B8 `D_verify` | | | 320 | 06:20 | |
| B9 must **start** by | (`C_B8`) | | 330 | 06:30 | |
| B9 ends (`+ D_gonogo`) so B10 fits | | (`= W`) | 345 | 06:45 | |
| B10 close | 15 | | 360 | 07:00 | |

A row that does not fit is reported to the LEAD, who may change that latest time in the card before G6. It does not by itself make P7 unmet.

### 9.5 Decision rule (P7)

- **`W` at most the maximum window:** P7 is met. The half AM operator posts the sum, `W`, the margin and the largest `N_night` as text.
- **`W` above the maximum:** the LEAD decides on 27 Oct: **widen the window**, or **move the date**. Nothing is shortened by editing the ETL on the night. This is the plan's P7 rule (plan 4.3 and P7) and nothing more.
- **Advisory only:** the per-step reading of 9.4 and the 345 min line are reported with the post. The LEAD may use them to change a latest time of the card; they are not a decision trigger.
- **The budget is incomplete** (a figure missing: the files export, the read-only SQL checks, a Track S step) and the missing item is not covered by a plan placeholder: the half AM operator says so in the post, and the LEAD decides whether to take the plan's placeholder for it.
- **Contradiction to resolve (Perlu pengesahan, LEAD):** plan 4.3 compares `W` (B1 to the end of B9) with 360 min, but the card lets B9 start as late as T+5:30 and takes 15 min, and then B10 needs 15 more minutes before T+6:00 (07:00). If both hold, `W` can be at most about 345 min. The sheet shows both margins.

### 9.6 Worked example (placeholders only; not a measurement)

Kept as the plan's own illustration with the 3,611 rows/s placeholder. The block 9.3a gives the same calculation with the measured synthetic figures of 23 Oct, labelled synthetic, provisional.

Uses only the plan's placeholders: `r_B6 = r_B7 = 3,611 rows/s`, `rho = 1`, `kappa = 1`, `D_freeze = 20`, `D_dump = 25`, `D_xfer = 15`, `D_load = 20`, `D_copy = 10`, `D_verify = 20`, `D_gonogo = 15` (fixed total 125 min), and an example `N_night = 5,000,000` rows (an example, not an observed count).

| Item | Calculation | Result |
|---|---|---|
| `D_profile_dry` | `5,000,000 / 3,611` = 1,384.6 s | 23.1 min |
| `D_apply` | `2 x 5,000,000 / 3,611` = 2,769.3 s | 46.2 min |
| ETL part | 23.1 + 46.2 | 69.2 min (the plan's table: about 69) |
| `sum` | 125 + 69.2 | 194.2 min |
| `W` | `1.25 x 194.2` | 242.8 min (4 h 03 min) |
| Margin to 360 | 360 - 242.8 | 117.2 min |
| Margin to 345 | 345 - 242.8 | 102.2 min |
| `ETL_max` | `(360 / 1.25 - 125) x 60` = (288 - 125) x 60 | 9,780 s (163 min) |
| `N_night_max` | `9,780 / (3 / 3,611)` | 11,771,860 rows (the plan says "about 11.7 million") |
| Cumulative `C_k` (9.4, advisory) | B2 56.3, B3 75.0, B4 100.0, B5 112.5, B6 141.4, B7 199.0, B8 224.0, B9 end 242.8 (= `W`) | each is below its latest time (70, 95, 125, 140, 170, 300, 320, 345) |

At these placeholders every row of 9.4 fits (no scaling is applied in the example: scale factor 1). The first row to fail would be B2: `D_dump` above 36 min (`1.25 x (20 + 36) = 70`). This example shows the method. It says nothing about the real data.

## 10. Green and red for A4

**A4 is green** when: every red condition of the A1 sheet section 9 is absent for the A4 runs; both guard refusals were shown as in section 6; the restore of a restore point worked and the migration count equalled the folders (section 7); the night card was read and every blocking defect of section 8 is closed or has a dated owner before G6; the budget of section 9 is filled and the P7 rule holds (or the LEAD decided); the e2e smoke and the read-only SQL checks passed on a restored copy of Track S synthetic data (not on production, not on Track R); the evidence below is posted.

**A4 is red** when any of these happens:

1. Any red condition of the A1 sheet section 9 on an A4 run, including a non-zero exit where 0 is expected and a `migrate:verify` that is not exit 0 with `verify pass`.
2. A guard refusal that is **accepted**, or refused for the wrong reason (section 6.3).
3. A restore of a restore point that fails, or a migration count `n` not equal to `F`.
4. `slot.sh gonogo` with `NO-GO`, `MISSING` or `PITR off` on the scratch copy after P-6 holds, at the point where it must be clean; `throwaway` still running after `S throwaway-down`.
5. The e2e smoke or a read-only SQL check differs from the verify report (trigger R4 shape).
6. A blocking defect in the night card (section 8) without an owner and a date.
7. Personal data in a post, a log or a copy outside the custody list (PDPA incident: tell the LEAD at once).
8. The pre-step of 5.2 matches production, or a Track S restore ran with `--yes` outside the one deliberate G6 pass.

**What to do on red:** as the A1 sheet section 9: stop, keep aggregates, tell the LEAD and the owning role (ETL: backend developer of half AM; scripts and host: half AZ DevOps; dump: the dump operator), post on the cutover issue (#109) and, for host items, to half AZ on #113 (**Perlu pengesahan (LEAD):** routing), fix as a developer task on a PR, repeat the affected track. A4 is the last rehearsal before G6 (28 Oct). **A red A4 that cannot turn green before 28 Oct 18:00 is a no-go for G6, and the LEAD moves the date** (plan A4 and P7). A change to the ETL after A4 means A1 and A4 are repeated at the new sha (P2).

**Evidence to post (text, aggregates only), on #109:**

```
A4 timed rehearsal <date>, release sha <short sha> (A2 re-pin), track R host class <cpu / ram / disk>, track S host class <cpu / ram / disk>
Settings: fsync on <yes|no>, PP_PG_* production values <yes|no>; migrations applied <n> of folder <F>
Timings (s / exit): D_dump (24 Oct) <>, files <>; D_xfer: encrypt <>, listing <>, scp <>, extract <>, wipe <>;
  throwaway-up <>, D_load R <> S <>, freeze proof <>, D_copy R <> S <>, throwaway-down+wipe <>;
  profile <>, dry-run <>, apply <> (core dry <>, core apply <>, act dry <>, act apply <>), verify <>, SQL checks <>, gonogo <>;
  R take pre_etl <>, restore pre_etl <>, restore large point <>, rollback dry <> apply <>, idempotency dry <> apply <>; night card read <> min, defects <> (blocking <>)
Rows: N_manifest <>, N_night <>, N_core <>, N_act <>, rho <>, kappa <>; rates r_B6 <>, r_B7 <> (placeholder 3,611)
Verify: exit <>, verify pass <yes|no>, <n> entities, <m> checks; rejects by reason <>; entities above threshold <list|none>
Guards: refusal 1 exit <2>, line <fixed text>, counts unchanged <yes|no>; refusal 2 exit <2>, line <fixed text>, counts unchanged <yes|no>
Restore: duration small <>, large <>, dump-form <>; migration count n <> of F <>
Budget: fixed <> min, ETL <> min, sum <>, W <>, margin to 360 <>, to 345 <>, N_night_max <>; per-step fit (advisory) <all|list>
Smoke: e2e (Track S synthetic copy) <pass|fail>, <counts>; read-only SQL checks ok <n> / FAIL <n> (ids <list>) / info <n>, Z0 <n>
Result: GREEN | RED (item <id>, reason <short>); P7: met | LEAD decision needed (widen | move)
```

## 11. Close of A4

- Wipe both `.gpg` files of 5.1 and `<work>`, and check with `ls` that `<extract dir 2>/anon` is gone after T12 (wipe it now if not) (overwrite with `shred -u -n 1 -z`, then remove), destroy the passphrase notes, and show each deletion with `ls`. They are on the custody list (A1 sheet I8) and in the deletion comment on #109.
- After A4: every dump directory still on the rehearsal host (the fresh hand-over of A4, `<extract dir 2>/anon`, and the A1 directory and `files` if the LEAD kept it) is deleted and **named at A5** (plan A5 item 7 and section 7): `find <extract dir> -type f -exec shred -u -n 1 -z {} +` then remove the directory, the pattern of `slot.sh wipe-dump` (**Perlu pengesahan (half AZ):** the exact command on the rehearsal host, as in the A1 sheet). On the scratch VPS: `S wipe-dump <dir> <file>` for the fixture, `S throwaway-down` (the cluster must not be left running), and drop the scratch copy.
- Rehearsal DB: `"$RDB" down --yes` after copying the timings (`"$RDB" status` prints `timings.log`).
- Restore points of the scratch copy: kept or deleted with the scratch host.
- Reports under `.migration-out/`: aggregates only; kept in the LEAD's storage at most 30 days, never in GitHub. A `deleted-at-source-*.json`, if one is produced, holds real legacy ids: mode 600, at most 7 days, never moved into report storage, on the custody list. A `core-login-gaps-*.json` (printed as `restricted id file ...` by every core apply of `migrate:all` and `migrate:delta`) holds legacy user ids as well: mode 600, at most 7 days, same rules.
- One closing line to the LEAD, as in the A1 sheet section 10.

## 12. Open points raised by this sheet

| # | Perlu pengesahan | Who confirms |
|---|---|---|
| 1 | Track S host (scratch VPS or the rehearsal box) and its size. | Half AZ |
| 2 | The scratch-only override of `slot.sh load` for a fixture (requested on #166), and accepting it on a scratch host. | Half AZ, LEAD |
| 3 | The plan says the guard test uses a synthetic fixture; by the code only dummy-hash data is refused. Use the anonymised stage (preferred) or plant the marker. | Half AM |
| 4 | `--files-dir` and `FILE_STORAGE_DIR` reach the `migrate` container in code at `a9fefff4` (`slot.sh:293-309`); show it on a run. | Half AZ |
| 5 | `--content-owner` at the night (A1 sheet, A1.9). | LEAD, half AM |
| 6 | ~~`migrate:archive-minimise` not in the `slot.sh etl` list (3.1 gap b).~~ Done at `a9fefff4` (`slot.sh:256`). | Half AZ |
| 7 | The migration count of a restore point on the VPS: `verify` prints it now; open is the live count after a test restore and whether `take` or `custody.tsv` must carry it. | Half AZ |
| 8 | The freeze-proof one-line form. | Half AZ |
| 9 | ~~The file of read-only SQL checks (plan 4.5 part 1).~~ Done: `docs/ops/sql/smoke-readonly.sql` (R25). | Half AM |
| 10 | The e2e smoke command and target. | QA, half AZ |
| 11 | `D_xfer` source at A4 (host, not the operator PC); a rehearsal MySQL source for an A4 `dump:cloud` repeat. | Dump operator, half AZ, `.cloud` owner |
| 12 | Which limit applies to `W`: 360 or about 345 min; a row-growth allowance for `N_night`. | LEAD |
| 13 | ~~`slot.sh` and #166 step ids against the plan's numbering; `wipe-dump` printing `DUMP COPIES DELETED` for a missing directory.~~ Both done at `a9fefff4` (`slot.sh` header; `slot.sh:233-239`). | Half AZ |
| 14 | The written production list (host, database, role) for the pre-step of 5.2, and the statement list for the stage-only role denials. | Half AZ |
