# MIG-07 rehearsal report: .cloud to v2 data migration, SYNTHETIC data (passes 1–4)

- **Item:** MIG-07 (#109, P0), passes 1–3. Date of the runs: 2026-10-21 (passes 1 and 2), 2026-10-22 (pass 3).
- **Data:** synthetic only (`fixtures:generate --size medium --seed 7`, BE-35). The anonymised real dump (AM-10, made by the dump operator) does not exist yet, so nothing here proves behaviour on real data volumes or real value shapes.
- **Code under test:** branch `be/AM-MIG-07-rehearsal` = `feature/v2-backend` + AM-08 (`migrate:activity`, PR #122) + AZ-30 (rehearsal environment, PR #117). One run also used `origin/be/AM-09-migrate-orchestration` (`migrate:verify`, `migrate:delta`) from a temporary detached worktree.
- **Passes:** pass 1 ran on the code before the paging fix; pass 2 (same day) re-ran everything on the fixed branch (`f8c519fe`). Pass 1 is kept below unchanged, except that its sections are demoted one heading level.

# Pass 3 (orchestrator, AM-09)

Run 2026-10-22, synthetic medium seed 7 (20,000 users), on a local merge of this branch (`b73d0dc2`) and AM-09 `be/AM-09-migrate-orchestration` `1c6da999` (not pushed). Same separate Postgres 16 cluster (port `<rehearsal-port>`), AZ-30 host mode, explicit `--as-of=2026-10-22`. The first attempt (pass 3a) stopped at the delta verify, and its second delta apply was cut by a container restart. The delta phase was then re-run on 2026-10-22 (pass 3b, section P3.3) after the AM-09 fixes for problems D and E, on a local merge of this branch (`21413f4e`) and `be/AM-09-migrate-orchestration` `cdb2f0f2` (not pushed), starting from the `after_full` snapshot; the re-run completed every step (logs: counts only, in the author's scratch folder). Pass 3 is not reproducible from this branch alone: it ran on those unpushed local merges, and `mig07-rehearse.sh` cannot run `migrate:all` or `migrate:delta`. The exact commands are in P3.4.

## P3.1 Verdict

| Part | Result |
|---|---|
| Reference seed, load, stage, snapshot | ok (seed 3.4 s, load-dump 11.7 s, stage 3.3 s) |
| `migrate:all` dry-run / apply | **green**, 8.1 s / **526.7 s**; WAL about 492 MB |
| `migrate:verify` on the full state | **pass** (3.4 s) |
| AC9 `--files-dir` (banner images, synthetic export with `SHA256SUMS`) | **ok**: copied 2, rejected 1 (`unlisted`, planted), second apply copied nothing |
| Rollback | **ok**: AM-09 `migrate:rollback --apply` succeeded (19 s); AZ-30 `restore-snapshot` to `pre_etl` and `after_full`: `ROLLBACK VERIFIED`, `MIGRATION CHECK PASSED` 33/33 |
| Source lock during `migrate:delta --apply` | **ok**, confirmed again in pass 3b (same exits: 2, 2, 4): standalone `migrate:activity` and `migrate:core` refused (exit 2, about 3 s); a second `migrate:delta` refused (exit 4) |
| `migrate:delta` dry-run / apply / second apply | **green** (pass 3b): dry-run 12.3 s; apply 513.4 s with its verify step passed (`37 entities, 20 checks`); second apply 514.9 s, **0 inserted / 0 updated** on every entity (idempotent). Pass 3a: apply stopped at verify (problems D and E). |
| `migrate:verify` after the delta | **pass** (4.8 s; `37 entities, 20 checks`) |

## P3.2 New problems

| # | Problem | Owner | Status |
|---|---|---|---|
| D | `feedback` after the delta: target 1520, loaded 1517. The 3 extra v2 rows belong to 3 users deleted at the source; their feedback rows are still staged (no cascade), BE-29 now rejects them, and verify's deleted-at-source key for `feedback` (`verify/deleted.ts:102`) checks only the feedback row, so it counts 0 deleted. Fix: the key also requires the parent user. BE-29 also changes its reject reason to `ORPHAN_PARENT user_id` (was `UNKNOWN_ENUM role`) in #122. | AM1-2 (#123) | **fixed** in #123 `cdb2f0f2`; delta re-run green (pass 3b) |
| E | Answers per subject after the delta: subject 14 staged 10,415 vs v2 10,416; "none" 1 vs 0 (totals equal). Answer legacy 39986 belongs to a session deleted at the source and its question is not in the archive; BE-29 kept it with the v2 session's subject; verify (`verify/checks.ts:121,127`) falls back to the staged session, which is gone. Fix: fall back to the v2 session's subject. | AM1-2 (#123) | **fixed** in #123 `cdb2f0f2`; delta re-run green (pass 3b) |

D and E are fixed; the delta phase was re-run (P3.3).

## P3.3 Delta re-run (pass 3b)

Run 2026-10-22 from the `after_full` snapshot, with the code described in the Pass 3 intro.

| Step | Seconds | Result |
|---|---:|---|
| Restore `after_full` | 16.7 | `ROLLBACK VERIFIED`, 33/33 migrations |
| Load delta dump | 19.5 | |
| Stage | 3.8 | |
| `migrate:delta` dry-run | 12.3 | |
| `migrate:delta` apply | 513.4 | verify step passed |
| `migrate:delta` second apply | 514.9 | 0 inserted / 0 updated |
| `migrate:verify` | 4.8 | pass, `37 entities, 20 checks` |
| `status` | 0.9 | |

Delta input (dry-run, changed staging rows): users 300, schools 15, practice_sessions 800, coin_transactions 300, question_attempts 70,217, mood_checkins 14,653.

First delta apply, inserted / updated / unchanged:

| Stage | Entity | Inserted | Updated | Unchanged |
|---|---|---:|---:|---:|
| core | schools | 5 | 10 | 390 |
| core | users | 100 | 197 | 19,354 |
| core | classrooms | 2 | 0 | 280 |
| core | enrolments | 37 | 0 | 5,319 |
| core | other entities | 0 | 0 | |
| activity | coin_ledger | 238 | 0 | 45,337 |
| activity | practice_sessions | 492 | 176 | 23,318 |
| activity | streaks | 0 | 384 | 14,795 |
| activity | referral_codes | 100 | 197 | 19,354 |
| activity | referrals | 0 | 1 | 935 |
| activity | other entities | 0 | 0 | |

Deleted at source (reported; the delta never deletes v2 rows): users 49, practice_sessions 120, referral_codes 49, feedback 3.

- **Problem D closed.** Feedback after the fix: eligible 1,538, loaded 1,517, rejected 21, v2 target 1,520 = 1,517 + 3 deleted at source.
- **Problem E closed.** Answers per subject: ok.

Reported checks (reported, not failures; identical before and after the second apply; synthetic-data artefacts of the generator, to re-read on the real dump):

- Wallet balance against ledger sum differs for 15,096 users.
- Sum of `practice_sessions.correct` is 143,228 against 22,509 correct answer rows.
- Stored `streak_days` against recomputed differs for 14,674 users (accepted drift).

Notes:

- (c) **Changed sessions: SQL 153 against 176 updated (pass 2, P2.5).** `mig07-make-delta.mjs` sets a new `updated_at` on every changed session and raises `correct` by one capped at `total_questions`. `migrate:activity` writes `updated_at` into the v2 row (`transform/practice.ts`, `stamps`), and a row counts as updated when its `legacy_hash` over all written values differs (`kit/upsert.ts`). So every changed session that loads counts as updated (176), while the SQL diff compared `correct_count` only, which differs for the 153 sessions whose `correct` was below `total_questions`. Check on the dumps: of the 300 changed sessions, 41 were already at `total_questions` (only `updated_at` changes) and 259 were raised; 180 of the 300 have a mode that loads (24 and 156), so the 23 and 153 are those two groups minus 1 and 3 sessions rejected for another reason (reject reasons of these 4 not checked). The ETL does not re-derive session fields from answers (`transformSession` reads the session row only).
- (a) Each delta run prints "warning: cannot verify --as-of against the first load".
- (b) **The second, no-op delta apply takes as long as the first (515 s vs 513 s on 20k users).** The run time does not depend on the number of changed rows (the delta re-reads every staged row), so on the real volume the delta window in the cutover plan (MIG-08) must be sized from the full-volume time, not from the number of changed rows. Owner of the cutover sizing: MIG-08.

Still open: OD-24 (`battle`/`spm` modes rejected by design), the real-data pass (AM-10 dump with the storage export and `SHA256SUMS`), VPS sizing (#116), and delta time scales with total rows, not changed rows (P3.3 note b).

## P3.4 Pass 3 commands (manual)

The code was a local merge of this branch with #123 (AM-09 `be/AM-09-migrate-orchestration`). These commands become phases of `mig07-rehearse.sh` once #123 merges. Placeholders: `<rehearsal-db.sh>` = `deploy/rehearsal/rehearsal-db.sh`; environment as in section 2 of pass 1 (`PP_REHEARSAL_MODE=host`, `PP_REHEARSAL_ADMIN_URL`, `PP_REHEARSAL_STATE_DIR`, `PP_REHEARSAL_MIGRATE=psql`), exported before the first call. `<as-of>` is the day of the first load (pass 3: 2026-10-22) and is the same on every call. All from the repo root.

```bash
# prep
<rehearsal-db.sh> up
<rehearsal-db.sh> exec target -- env NODE_ENV=production npm run db:seed -w @pp/api -- --profile=migration
<rehearsal-db.sh> load-dump <dump-dir> ; <rehearsal-db.sh> stage ; <rehearsal-db.sh> snapshot pre_etl
# find a content owner (an active, not suspended admin), by a scout core apply, then back to pre_etl
<rehearsal-db.sh> exec target -- npm run migrate:core -w @pp/api -- --dry-run --as-of=<as-of>
PP_ALLOW_MIGRATE_APPLY=1 <rehearsal-db.sh> exec target -- npm run migrate:core -w @pp/api -- --apply --as-of=<as-of>
#   <content-owner-id> = select u.id from users u join user_roles r on r.user_id = u.id
#                        where r.role::text = 'admin' and u.is_active and not u.is_suspended order by u.id limit 1
<rehearsal-db.sh> restore-snapshot pre_etl --yes
# full run
<rehearsal-db.sh> exec target -- npm run migrate:all -w @pp/api -- --dry-run --as-of=<as-of> --content-owner=<content-owner-id>
PP_ALLOW_MIGRATE_APPLY=1 <rehearsal-db.sh> exec target -- npm run migrate:all -w @pp/api -- --apply --as-of=<as-of> --content-owner=<content-owner-id>
<rehearsal-db.sh> exec target -- npm run migrate:verify -w @pp/api
<rehearsal-db.sh> status ; <rehearsal-db.sh> snapshot after_full
# AC9 files (banners): <files-export-dir> holds the export with SHA256SUMS; FILE_STORAGE_DIR is a scratch directory
<rehearsal-db.sh> exec target -- env FILE_STORAGE_DIR=<storage-dir> npm run migrate:activity -w @pp/api -- --dry-run --as-of=<as-of> --core-as-of=<as-of> --content-owner=<content-owner-id> --table=banners --files-dir=<files-export-dir>
PP_ALLOW_MIGRATE_APPLY=1 <rehearsal-db.sh> exec target -- env FILE_STORAGE_DIR=<storage-dir> npm run migrate:activity -w @pp/api -- --apply --as-of=<as-of> --core-as-of=<as-of> --content-owner=<content-owner-id> --table=banners --files-dir=<files-export-dir>
# (the dry-run and the apply of the files step were then repeated once to prove a second apply copies nothing)
# rollback (AM-09; the three env vars are those of the AM-09 header, needed also for the dry-run; checked in pass 4), then the AZ-30 restores
PP_ALLOW_MIGRATE_ROLLBACK=1 PP_ALLOW_MIGRATE_APPLY=1 PP_MIGRATE_TARGET_DB=pp_rehearsal <rehearsal-db.sh> exec target -- npm run migrate:rollback -w @pp/api -- --dry-run --confirm=pp_rehearsal
PP_ALLOW_MIGRATE_ROLLBACK=1 PP_ALLOW_MIGRATE_APPLY=1 PP_MIGRATE_TARGET_DB=pp_rehearsal <rehearsal-db.sh> exec target -- npm run migrate:rollback -w @pp/api -- --apply --confirm=pp_rehearsal
<rehearsal-db.sh> restore-snapshot after_full --yes ; <rehearsal-db.sh> restore-snapshot pre_etl --yes ; <rehearsal-db.sh> restore-snapshot after_full --yes
# delta (second dump, same <as-of>; --since is the date before the first change)
<rehearsal-db.sh> load-dump <delta-dump-dir> ; <rehearsal-db.sh> stage
DA="--since=2026-08-31T00:00:00Z --as-of=<as-of> --content-owner=<content-owner-id>"
<rehearsal-db.sh> exec target -- npm run migrate:delta -w @pp/api -- $DA
PP_ALLOW_MIGRATE_APPLY=1 <rehearsal-db.sh> exec target -- npm run migrate:delta -w @pp/api -- $DA --apply &    # run in the background
# lock probe, once pg_locks shows a granted advisory lock and the apply has run a few seconds: each of these must be refused
<rehearsal-db.sh> exec target -- npm run migrate:activity -w @pp/api -- --dry-run --as-of=<as-of> --core-as-of=<as-of> --content-owner=<content-owner-id>   # exit 2
<rehearsal-db.sh> exec target -- npm run migrate:core -w @pp/api -- --dry-run --as-of=<as-of>                                                              # exit 2
<rehearsal-db.sh> exec target -- npm run migrate:delta -w @pp/api -- $DA                                                                                    # exit 4
wait
PP_ALLOW_MIGRATE_APPLY=1 <rehearsal-db.sh> exec target -- npm run migrate:delta -w @pp/api -- $DA --apply    # second apply: 0 inserted / 0 updated
<rehearsal-db.sh> exec target -- npm run migrate:verify -w @pp/api ; <rehearsal-db.sh> status
```

The env vars of the `migrate:rollback` apply are taken from the AM-09 header (`orchestrate.ts`); pass 4 (P3.5) ran them on #123 `39879801` and found that `PP_MIGRATE_TARGET_DB` is required there too.

# Pass 4 (stop and roll back, solo night session)

## P3.5 Stop and roll back (pass 4, solo night session)

Why: there is no deputy (LEAD decision, #109 item 16). The operator runs the 01:00 cutover alone, and any threshold breach or failed verify step means stop and roll back by the written MIG-08 runbook (#124). This section rehearses that path on synthetic data and records measured numbers for #124. It does not replace the runbook.

- **Run:** 2026-10-22, synthetic medium seed 7 (20,000 users), same Postgres 16 cluster as pass 3 (host mode, `fsync` off, template-copy snapshots: timings are lower than on a production-like server, and a `--dump` snapshot was not timed).
- **Code under test:** this branch `f6377a20` (#133) merged locally with `be/AM-09-migrate-orchestration` `39879801` (#123); not pushed. The tree has 36 migrations (the pass 3 snapshots hold 33; see note 1).
- **Breach dump:** `mig07-make-delta.mjs <medium dump> <breach dump> --delete users=1200` (new option, see the script header): the normal delta (200 changed, 100 added, 50 deleted users) plus the 1,200 highest-id non-admin source users deleted. Source users 20,000 to 18,850. It is a synthetic stand-in for "a truncated or wrong re-stage".
- **Thresholds in force (AM-09 `verify/types.ts`):** `deleted_at_source_ratio:<entity>` fails when deleted at source is more than 100 rows AND more than 5 % of the entity's target rows (`maxDeletedRows` 100, `maxDeletedRatio` 0.05).

### Commands in the order an operator runs them

Placeholders as in P3.4; `<breach-dump>` stands for whichever dump is being staged. `<db>` = `pp_rehearsal`. All from the repo root. Rollback of the delta by snapshot is (b); (a) is AM-09.

```bash
# 0. before the delta window: a snapshot of the migrated state (this is what (b) restores)
<rehearsal-db.sh> snapshot pre_delta

# 1. load and stage the freeze dump, then the dry-run
<rehearsal-db.sh> load-dump <delta-dump-dir> ; <rehearsal-db.sh> stage
DA="--since=<since> --as-of=<as-of> --content-owner=<content-owner-id>"
<rehearsal-db.sh> exec target -- npm run migrate:delta -w @pp/api -- $DA

# 2. optional early stop, read-only (about 5 s): grep the verify output for the ratio check
<rehearsal-db.sh> exec target -- npm run migrate:verify -w @pp/api | grep deleted_at_source_ratio     # a hit means stop

# 3. apply (its built-in verify decides the exit code)
PP_ALLOW_MIGRATE_APPLY=1 <rehearsal-db.sh> exec target -- npm run migrate:delta -w @pp/api -- $DA --apply ; echo "exit $?"

# 4. any non-zero exit or any threshold breach: stop and roll back
#    (b) full database snapshot (recommended)
<rehearsal-db.sh> restore-snapshot pre_delta --yes
<rehearsal-db.sh> exec target -- npm run migrate:verify -w @pp/api ; echo "exit $?"      # must be 0
#    (a) AM-09 rollback (deletes EVERY migrated row, not only the delta); three variables are required, also for --dry-run
PP_ALLOW_MIGRATE_ROLLBACK=1 PP_ALLOW_MIGRATE_APPLY=1 PP_MIGRATE_TARGET_DB=<db> <rehearsal-db.sh> exec target -- npm run migrate:rollback -w @pp/api -- --dry-run --confirm=<db>
PP_ALLOW_MIGRATE_ROLLBACK=1 PP_ALLOW_MIGRATE_APPLY=1 PP_MIGRATE_TARGET_DB=<db> <rehearsal-db.sh> exec target -- npm run migrate:rollback -w @pp/api -- --apply --confirm=<db>
```

### Timings (seconds, one run each; WAL in MB in brackets where it matters)

| Step | Seconds | Exit |
|---|---:|---:|
| Restore `after_full` (with the 33-migration check failure, note 1) | 26.7 | 1 (restore done, `ROLLBACK VERIFIED`) |
| `up` (applies the 3 new migrations) | 3 | 0 |
| Snapshot `pre_delta` (template copy, 197 tables) | 2.4 | 0 |
| **Scenario A** load breach dump / stage | 18.7 / 4.6 | 0 / 0 |
| A: `migrate:delta` dry-run | 10.5 | 0 |
| A: `migrate:delta --apply`, start to verify failure (WAL 135 MB) | **681.7** | **1** |
| A: standalone `migrate:verify` on the post-A state | 7.6 | 1 |
| A: early stop, `migrate:verify` after stage and before the apply (breach dump) | 5.2 | 1 |
| A: same, normal delta dump (no breach) | 6.1 | 1 (note 4) |
| Snapshot `post_a` (setup for (b) only) | 1.8 | 0 |
| **(a)** `migrate:rollback --dry-run` | 36.6 | 0 |
| **(a)** `migrate:rollback --apply` | 31.7 | 0 |
| (a) `migrate:verify` afterwards | 4.0 | 1 (note 3) |
| (a) `migrate:delta` dry-run afterwards | 3.2 | 2 |
| **(b)** `restore-snapshot pre_delta` (from the post-A state; `post_a` restore 3.6 s as setup) | **2.9** | 0 |
| (b) `migrate:verify` afterwards | 5.8 | 0 |
| **Scenario B** load normal delta / stage / dry-run | 17.7 / 4.2 / 9.4 | 0 |
| B: `migrate:delta --apply` (verify inside passed) | 668.0 | 0 |
| B: `migrate:verify` before tampering | 4.8 | 0 |
| B: `migrate:verify` after one migrated row deleted by hand | 5.4 | **1** |
| B: `restore-snapshot pre_delta` | 3.5 | 0 |
| B: `migrate:verify` afterwards | 5.9 | 0 |

From the start of the A load to the verify failure: 18.7 + 4.6 + 10.5 + 681.7 = 715.5 s (about 12 min). Compared with the 01:00 window: a rollback by snapshot adds 3 s here; by AM-09 about 32 s plus a full re-run (about 527 s for `migrate:all`, P3.1) to return to the pre-delta state.

### Scenario A: deleted-at-source breach

Exit code 1. Failing lines (apply log, exact):

```
migrate:delta verify: failed
verify fail: 37 entities, 23 checks, runs 8,10
classrooms | 800 | 800 | 291 | 509 | 0 | 319 | mismatch
referrals | 1132 | 1132 | 912 | 220 | 0 | 936 | mismatch
check counts deleted_at_source_ratio:users: mismatch expected=<= 985 actual=1220
check counts deleted_at_source:users: reported expected=0 actual=1220
check counts deleted_at_source_ratio:referral_codes: mismatch expected=<= 985 actual=1220
check counts deleted_at_source:referral_codes: reported expected=0 actual=1220
migrate:delta stopped: stage verify (verify) failed.
```

Other `deleted_at_source` lines (reported only): practice_sessions 120, referrals 13, feedback 97. `expected=<= 985` is 5 % of the 19,700 target users. Two entity rows are also `mismatch` (classrooms: v2 319 against loaded 291; referrals: v2 936 against loaded 912; the cause was not analysed). The standalone `migrate:verify` on the post-A state printed the same lines and exited 1.

**The apply is committed when verify fails.** The delta (core and activity) is already in v2 at that point; exit 1 means "data written, gate failed", so the operator must roll back, not just stop.

**What the dry-run shows (answer to "can the operator stop before `--apply`").** The `migrate:delta` dry-run does NOT show the breach: it prints no deleted-at-source count and no comparison with the previous load; the only hint is the `source` column of `users` (18,850 instead of 20,050 in the normal delta), which an operator would have to know in advance. `migrate:verify` run after `stage` and before `--apply` does show it (`deleted_at_source_ratio:users`, 5.2 s, exit 1, no v2 write), so step 2 above is a usable early stop; it exits 1 on a normal delta too (note 4), so the operator must read the `_ratio` line, not just the exit code. Finding for #123: the dry-run could print the same deleted-at-source figures.

What the operator sees and does:

1. `migrate:delta --apply` runs about 11 min, then prints `migrate:delta verify: failed` and the `_ratio` lines, and exits 1.
2. Stop. Do not re-run the delta. Note the time and the two `_ratio` lines.
3. Roll back by (b), then confirm (criteria below). Do not wake anyone (item 16): record the result for the LEAD's morning review. The cause is either a wrong re-stage or a source that really lost 6 % of its users.

### Rollback (a) AM-09 `migrate:rollback --apply` from the state after A

Exit 0, `migrate:rollback apply on "pp_rehearsal": succeeded`, 31.7 s. It deletes every row loaded from the source, not only the delta: users 19,700, schools 405, classrooms 319, enrolments 6,058, practice_sessions 24,106, practice_answers 67,522, coin_ledger 45,575, wallets 15,179, referral_codes 19,700, `etl_id_map` 44,637. Eight lines warn that adopted seed rows were deleted too (`subject_levels`, `achievements`, `topics`, `chapters`, `education_levels`, `subjects`, `ppds`, `jpns`: "re-run the idempotent seeds").

Row counts of the 10 main tables after (a), against the snapshots:

| Table | After (a) | `pre_delta` | `pre_etl` |
|---|---:|---:|---:|
| users | 0 | 19,600 | 0 |
| schools | 0 | 400 | 0 |
| classrooms | 0 | 280 | 0 |
| enrolments | 0 | 5,319 | 0 |
| parent_links | 0 | 1,591 | 0 |
| practice_sessions | 0 | 23,614 | 0 |
| practice_answers | 0 | 67,522 | 0 |
| coin_ledger | 0 | 45,337 | 0 |
| wallets | 0 | 15,179 | 0 |
| referral_codes | 0 | 19,600 | 0 |
| `etl_id_map` | 0 | 44,001 | 0 |

So (a) returns to the pre-ETL state (equal to `pre_etl` on all data tables; 33 tables differ from `pre_delta`), not to the pre-delta state. Only ETL bookkeeping stays (`etl_runs` 10, `etl_checkpoints` 62, `etl_recon` 174, `etl_rejects` 385,734) and `_prisma_migrations` (36 against 33). Confirmation by `ROLLBACK VERIFIED` does not exist for (a) (that line is printed by `restore-snapshot` only). `migrate:verify` afterwards exits 1 (every entity `mismatch`, target 0, plus `distinct states versus JPN rows` expected 3 actual 0 and `distinct (state, district) pairs versus PPD rows` expected 15 actual 0), because it rebuilds its figures from the runs that are still recorded; it is not a confirmation. `migrate:delta` afterwards is refused: `No earlier succeeded migrate:core --apply run with loaded users: run migrate:all --apply first.` (exit 2).

Refusals met on the way (all exit 2, nothing changed): without `PP_ALLOW_MIGRATE_APPLY=1` even `--dry-run` prints `Refusing --apply: set PP_ALLOW_MIGRATE_APPLY=1 to allow writes by the migration kit.` (misleading for a dry-run); without `PP_ALLOW_MIGRATE_ROLLBACK=1`: `Refusing rollback: set PP_ALLOW_MIGRATE_ROLLBACK=1 ...`; without `PP_MIGRATE_TARGET_DB`: `Refusing rollback: PP_MIGRATE_TARGET_DB must equal the connected database name ("pp_rehearsal") in every environment.` The pass 3 command line in P3.4 lacked the third variable (it ran on an earlier #123 head); P3.4 is corrected.

### Rollback (b) `restore-snapshot pre_delta --yes` from the state after A

Exit 0, 2.9 s: `ROLLBACK VERIFIED: every table of pp_rehearsal has the snapshot's row count again (13 table(s) differed before the rollback)` and `MIGRATION CHECK PASSED: 36 of 36`. `migrate:verify` afterwards: exit 0, `verify pass: 37 entities, 16 checks`. Row counts of the 10 main tables and `etl_id_map` equal the `pre_delta` `.counts` exactly (diff 0 on all; 0 of 197 tables differ).

**Recommendation for the runbook (MIG-08): use (b).** It is the full database snapshot: it returns to exactly the pre-delta state (which (a) cannot, it returns to pre-ETL and needs a full re-run of about 527 s plus the delta), it needs one command with one confirmation, and it has its own proof (`ROLLBACK VERIFIED`, counts per table). Caveats: (b) discards anything written to the database after the snapshot (at the cutover the snapshot must be taken in the freeze window, right before the apply), and the 2.9 s is a template copy on a small synthetic database with `fsync` off; a `--dump` snapshot or the real volume will be slower and was not timed. Use (a) only if no snapshot exists.

### Scenario B: verify fails without a threshold

From `pre_delta`: normal delta loaded, staged, applied (668.0 s, built-in verify passed, exit 0), `migrate:verify` exit 0. Then, as a realistic stand-in for a v2 row lost after the load, one migrated row was deleted by hand (`delete from banners where id = (select id from banners where legacy_source = 'cloud' order by id limit 1)`).

`migrate:verify`: exit 1, 5.4 s, `verify fail: 37 entities, 20 checks, runs 8,10`, failing line:

```
banners | 3 | 3 | 3 | 0 | 0 | 2 | mismatch
```

There is no `check ...` line for it; the failure is the `mismatch` status in the entity table (target 2 against loaded 3). The operator rule is therefore "exit code 1 from `migrate:verify` means stop", not "look for a `check` line". Rollback by (b): exit 0, 3.5 s, `ROLLBACK VERIFIED` (14 tables differed before), `MIGRATION CHECK PASSED`; `migrate:verify` afterwards exit 0 (`16 checks`); the 10 main tables equal `pre_delta`, 0 of 197 tables differ.

What the operator sees and does: `migrate:verify` (or the apply's built-in verify) exits 1 and prints the entity with `mismatch`; stop; roll back by (b); confirm; do not hand-fix v2 rows.

### Rollback confirmed (criteria for #124)

For (b), all of these:

1. `restore-snapshot` exit 0 with `ROLLBACK VERIFIED` and `MIGRATION CHECK PASSED`.
2. `migrate:verify` exit 0 (`verify pass: ...`).
3. Row counts of the main tables (users, schools, classrooms, enrolments, parent_links, practice_sessions, practice_answers, coin_ledger, wallets, referral_codes) and `etl_id_map` equal the snapshot's `.counts` file.
4. The log lines and times are written down.

For (a), instead: rollback exit 0 `succeeded`, `etl_id_map` and the main tables 0 (equal `pre_etl`), and the operator knows the state is pre-ETL (a full `migrate:all` is needed); `migrate:verify` is NOT a criterion (it exits 1).

### 4b check against pass 3b (LEAD item 4b)

Threshold under test: delta inserted + updated within 5 % / 100 rows of the delta (dry-run) report. Source: P3 logs `42-delta-dry-run` and `43-delta-apply`. The delta dry-run reports inserted / updated only for the 13 core entities; the activity stage is skipped in the dry-run whenever a core table changed (always, in a real delta), so for the 24 activity entities there is no dry-run figure to compare (finding for #123: the activity part of the delta cannot be checked before `--apply`).

| Entity | Dry-run ins + upd | Apply ins + upd | Diff rows | Diff % | Within 5 % / 100 |
|---|---:|---:|---:|---:|---|
| schools | 5 + 10 = 15 | 15 | 0 | 0 | yes |
| users | 100 + 197 = 297 | 297 | 0 | 0 | yes |
| classrooms | 2 + 0 = 2 | 2 | 0 | 0 | yes |
| enrolments | 37 + 0 = 37 | 37 | 0 | 0 | yes |
| other 9 core entities | 0 | 0 | 0 | 0 | yes |
| activity entities (coin_ledger 238, practice_sessions 668, streaks 384, referral_codes 297, referrals 1, others 0) | not available | see left | - | - | cannot be checked |

The same equality held in the pass 4 runs (scenario B, and scenario A where the breach changed classrooms to 39 + 11 and enrolments to 739 in both dry-run and apply). As an indirect bound only: the dry-run's "rows with `updated_at` > since" were users 300, schools 15, practice_sessions 800, coin_transactions 300; apply inserted + updated were users 297, schools 15, practice_sessions 668, coin_ledger 238 (rejected rows and different row grain, so not a like-for-like check).

Deleted at source (pass 3b, `46-verify`) against target rows, and the two readings of "> 5 % and > 100":

| Entity | Deleted at source | Target rows | % of target | "> 5 % AND > 100" (AM-09 default) | "> 5 % OR > 100" (whichever first) |
|---|---:|---:|---:|---|---|
| users | 49 | 19,700 | 0.25 | ok | ok |
| referral_codes | 49 | 19,700 | 0.25 | ok | ok |
| practice_sessions | 120 | 24,106 | 0.50 | ok | **breach** (120 > 100) |
| feedback | 3 | 1,520 | 0.20 | ok | ok |

Under the AM-09 default (AND, `verify/index.ts`: `deleted.count > maxRows && deleted.count > maxRatio * target`) no entity breaches. Under the OR reading `practice_sessions` would fail on pass 3b data with a 0.5 % deletion rate, so the LEAD should decide which reading item 4b means. With AND the effective ceiling is the larger of 100 rows and 5 % of the target (985 for 19,700 users), so a small entity never fails on percentage alone (a table of 200 rows can lose 100 rows, 50 %, and pass). Pass 4 confirms that the AND rule catches a large breach: 1,220 users deleted (6.2 %) failed it.

### Notes

1. **Snapshot against newer code.** The pass 3 snapshots (`pre_etl`, `after_full`) hold 33 migrations; this tree has 36 (#176). `restore-snapshot` restores the data and then prints `MIGRATION CHECK FAILED: 33 applied, 36 in apps/api/prisma/migrations` (exit 1). For this run `up` applied the 3 migrations and `pre_delta` was taken afterwards. At the cutover, take the snapshot after the schema migrations; a snapshot from before them cannot be restored without a new `migrate deploy`.
2. A rollback needs `PP_ALLOW_MIGRATE_ROLLBACK`, `PP_ALLOW_MIGRATE_APPLY` and `PP_MIGRATE_TARGET_DB` (above).
3. After (a), `migrate:verify` exit 1 is expected and must not be read as "rollback failed".
4. `migrate:verify` run between `stage` and `--apply` exits 1 even for a normal delta (entities such as `schools`, `users` show `mismatch` because the staged source rows changed since the recorded runs). The only line that separates a breach is `deleted_at_source_ratio:<entity>`.
5. The two scenarios ran once each. Times come from a local cluster with `fsync` off; the delta apply took 668 to 682 s here against 513 s in pass 3b on the same data, so expect a spread of about 30 %.

# Pass 2 (fixed code)

## P2.1 Verdict

| Part | Result |
|---|---|
| Full run | **Green and complete.** `migrate:core` reads all 20,000 users and `migrate:activity` all 120,000 attempts; every reconciliation row `ok`; AM-09 `migrate:verify` on the full state: `pass`, 37 entities, 16 checks. |
| Rollback | **Pass**, twice (from the full state and from the post-delta state): `ROLLBACK VERIFIED`, v2 empty again, core dry-run repeated, activity dry-run refused by its preflight. |
| Delta | **Pass on idempotency, changed rows and added rows**, now including added sessions (492 inserted; pass 1 inserted none). Source deletes are still not propagated. AM-09 `migrate:delta` stops at its verify step with `fail` (problems A and B below). |
| `seed_reference` step (new in `mig07-rehearse.sh`) | **Works** on the first try, 3.6 s: `db:seed --profile=migration` in `NODE_ENV=production` ran 3 reference modules (`core-school-packages`, `spm-subject-configs`, `core-marketplace-categories`), 4 `school_packages` rows, 0 demo users; the demo modules were skipped by the runner. |

Setup differences against pass 1: same dump size and seed (medium, seed 7, 20,000 users, 366,026 rows, now 46 files with the generator's own `SHA256SUMS`, no hand-made checksum), same cluster (PostgreSQL 16.15, port `<rehearsal-port>`), explicit `--as-of=2026-10-21` on every core and activity call (`--core-as-of` too for activity), `etl_runs.git_sha` filled (`f8c519fe`). AM-09 (`origin/be/AM-09-migrate-orchestration` at `7e27577f`) does not contain the AM-08 fixes yet, so a temporary detached worktree merged `2174ec58` and `32182fb0` into it (the only conflict was a docs file; nothing committed or kept).

## P2.2 Full run: timings (seconds)

| Step | Pass 1 (scratch-patched, old fixture) | Pass 2 | WAL pass 2 |
|---|---:|---:|---:|
| `up` | 6.4 | 5.8 | n/a |
| `seed-reference` | not run | 3.6 | 5 KB |
| `load-dump` | 14.6 | 11.4 | 96 MB |
| `stage` | 3.9 | 3.1 | 63 MB |
| `snapshot pre_etl` | 3.2 | 3.3 | 45 MB |
| `migrate:core` dry-run / apply | 5.6 / 6.1 | 5.3 / 5.6 | 54 / 52 MB |
| `migrate:activity` dry-run / apply | 244.1 / 239.4 | 273.6 / 217.5 | 177 / 200 MB |
| Whole chain | about 523 | about 529 | |

Target database after the apply: 274 MB (pass 1: 253 MB); staging database 86 MB. The activity stage is again the long pole (more rows now load, so it writes more WAL).

## P2.3 Full run: rows per entity, pass 1 against pass 2

Read = source, loaded = inserted + updated + unchanged, rejected = `etl_rejects`. All rows `ok` in both passes. "P1" is the scratch-patched first pass on the old fixture.

| Stage | Entity | Read | Loaded P1 | Loaded P2 | Rejected P1 | Rejected P2 |
|---|---|---:|---:|---:|---:|---:|
| core | education_levels | 4 | 2 | 4 | 2 | 0 |
| core | subjects | 6 | 6 | 6 | 0 | 0 |
| core | chapters | 18 | 9 | 18 | 9 | 0 |
| core | topics | 54 | 4 | 52 | 50 | 2 |
| core | subject_levels | 18 | 9 | 18 | 9 | 0 |
| core | jpns / ppds | 3 / 15 | 3 / 15 | 3 / 15 | 0 | 0 |
| core | schools | 400 | 400 | 400 | 0 | 0 |
| core | users | 20,000 | 19,600 | 19,600 | 400 | 400 |
| core | parent_links | 1,713 | 1,591 | 1,591 | 122 | 122 |
| core | classrooms | 800 | 0 | 280 | 800 | 520 |
| core | enrolments | 15,679 | 0 | 5,319 | 15,679 | 10,360 |
| core | school_subscriptions | 400 | 0 | 400 | 400 | 0 |
| activity | tiers | 4 | 0 | 0 | 4 | 4 |
| activity | challenges | 5 | 0 | 0 | 5 | 5 |
| activity | achievements | 6 | 6 | 6 | 0 | 0 |
| activity | wallets | 15,379 | 15,179 | 15,179 | 200 | 200 |
| activity | coin_ledger | 46,137 | 15,101 | 45,337 | 31,036 | 800 |
| activity | practice_sessions | 40,000 | 31,521 | 23,614 | 8,479 | 16,386 |
| activity | practice_answers | 120,000 | 2,823 | 67,522 | 117,177 | 52,478 |
| activity | streaks | 15,379 | 15,179 | 15,179 | 0 | 0 |
| activity | exam_attempts | 3,076 | 3,036 | 3,036 | 40 | 40 |
| activity | challenge_completions | 7,690 | 0 | 0 | 7,690 | 7,690 |
| activity | user_achievements | 7,689 | 7,590 | 7,590 | 99 | 99 |
| activity | referral_codes / referrals | 20,000 / 1,158 | 19,600 / 936 | 19,600 / 936 | 400 / 222 | 400 / 222 |
| activity | articles | 5 | 0 | 0 | 5 | 5 |
| activity | banners | 3 | 0 | 3 | 3 | 0 |
| activity | support_tickets | 1,538 | 0 | 0 | 1,538 | 1,538 |
| activity | feedback | 1,538 | 763 | 1,520 | 775 | 18 |
| activity | notes, videos, audio_kbat_sets, timeline_posts, spm_targets, gamification_settings | 0 | 0 | 0 | 0 | 0 |

### Reject reasons, pass 2 (runs 2 and 4 together)

| Reason | Count | Top entity, column (value) |
|---|---:|---|
| ORPHAN_PARENT | 72,818 | `practice_answers.practice_session_id` 48,324 (the session was rejected); `enrolments.classroom_id` 10,154 and `.student_id` 166; `challenge_completions.challenge_id` 7,589 (challenges are rejected); `practice_answers.topic_id` 2,599 and `.user_id` 1,555; `coin_ledger.user_id` 600; `practice_sessions.user_id` 513; `referral_codes.user_id` 400; planted: `users.school_id` 200, `wallets.user_id` 200 |
| UNKNOWN_ENUM | 16,273 | `practice_sessions.mode` `battle` 7,890 and `spm` 7,884 (printed as `mode_rejected.battle` / `.spm`); planted `users.role` 200, `coin_ledger.type` 200, `practice_sessions.mode` `mod_tidak_dikenali` 99 |
| INVALID_VALUE | 2,154 | `support_tickets.body` 1,523 (empty); `classrooms.education_level_id` 520; `referrals.referred_by` 100; `challenges.target_value` 5; `articles.content` 5; `feedback.score` 1 |
| DUPLICATE_KEY | 40 | `enrolments` |
| UNSUPPORTED | 4 | `tiers.label_ms` (no v2 tier rows are seeded by any seed, BE-11) |

What the new fixture fixed: ledger sources, levels, `education_levels`/`chapters`/`subject_levels`/`school_subscriptions` (0 rejected), banners and feedback, so 45,337 of 46,137 ledger rows and 67,522 of 120,000 attempts now load. Notes: `practice_answers.difficulty_unparsed` 115,213, `question_not_in_archive` 167, `wallets.tier_unmapped` 15,179, drift `wallet_ledger_mismatch` 15,179 and `streak_days_mismatch` 14,674.

## P2.4 Rollback

| Step | Seconds | Result |
|---|---:|---|
| `snapshot full_done` (full state) | 5 | taken for the delta route |
| `restore-snapshot pre_etl --yes` (from the full state) | 5.5 | `ROLLBACK VERIFIED ... (33 table(s) differed before the rollback)`, `MIGRATION CHECK PASSED: 33 of 33` |
| `migrate:core --dry-run` after the rollback | 5.3 | same per-entity numbers as before the ETL |
| `migrate:activity --dry-run` after the rollback | n/a | refused, exit 2: "no migrated users in etl_id_map. run migrate:core --apply first" |
| `restore-snapshot full_done --yes` | 6 | verified; v2 had 19,600 users and 67,522 answers again |
| `restore-snapshot pre_etl --yes` after the whole delta (second test) | 4.4 | `ROLLBACK VERIFIED` (33 tables differed), core dry-run 5.9 s, activity preflight refused as above |

## P2.5 Delta

Delta dump from `apps/api/scripts/rehearsal/mig07-make-delta.mjs` (users 200 changed, 100 added, 50 deleted; schools 10 changed, 5 added; practice_sessions 300 changed, 500 added, 200 deleted; coin_transactions 300 added; checksum sidecar by hand, the script does not write one).

| Step | First pass | Second pass |
|---|---:|---:|
| `snapshot after_full` / `load-dump` / `stage` | 6.0 / 12.3 / 3.2 | n/a |
| core dry-run / apply | 4.5 / 4.9 | 4.6 / 5.1 |
| activity dry-run / apply | 204.4 / 204.9 | 203.0 / 204.6 |

Row-level SQL diff, database after the delta against the `after_full` snapshot (legacy id keyed):

| Table | Before | After | Inserted | Changed | Unchanged | Removed from v2 |
|---|---:|---:|---:|---:|---:|---:|
| users | 19,600 | 19,700 | 100 | 197 | 19,403 | 0 |
| schools | 400 | 405 | 5 | 10 | 390 | 0 |
| practice_sessions (correct_count) | 23,614 | 24,106 | 492 | 153 | 23,461 | 0 |

The 153 changed `practice_sessions` counts `correct_count` only; AM-09 reports 176 updated because `updated_at` also changes (explained in P3.3 note c).

AM-09 `migrate:delta --since=2026-08-31T00:00:00Z --as-of=2026-10-21` on a restored `after_full` (inserted / updated / unchanged from its report; entities not listed 0 / 0 / unchanged): schools 5 / 10 / 390; users 100 / 197 / 19,354; classrooms 2 / 0 / 280; enrolments 37 / 0 / 5,319; coin_ledger 238 / 0 / 45,337; practice_sessions 492 / 176 / 23,318; streaks 0 / 384 / 14,795; referral_codes 100 / 197 / 19,354; referrals 0 / 1 / 935. **Second `migrate:delta --apply`: 0 inserted and 0 updated in every entity** (idempotent). Durations: dry-run 4.9 s (activity skipped by design), apply 409.7 s, second apply 434.0 s, `migrate:verify` 1.9 to 2.0 s. The 2 classrooms and 37 enrolments inserted by the delta are explained in problem C: class levels are derived from the pupils present at run time, so deleting pupils made two previously rejected classes placeable. Runbook wording: "A classroom's level is derived from the pupils present in the source at the time of the run. After a delta that deletes or changes pupils, `migrate:core --apply` may insert previously rejected classrooms (with their rosters) or change the level of loaded ones. The next apply on the same input changes nothing."

The 50 deleted users and 200 deleted sessions stay in v2 (not propagated, by design). After the delta `migrate:verify` is `fail`: `users` 19,651 loaded against 19,700 in v2, `referral_codes` the same, `practice_sessions` 23,986 against 24,106, `feedback` 1,517 against 1,520, the per-role check, and a new distribution check (`practice answers per subject`: staging subject 8 has 10,415 answers, v2 10,416; staging "no subject" 1, v2 0). On the full state the same verify passes.

## P2.6 Bug list and status after pass 2

| # | Problem (pass 1 numbering) | Status |
|---|---|---|
| 1 | Keyset paging sorted by the text alias (`load/source.ts`, `activity/catalogue-steps.ts`, `activity/exam-steps.ts`) | **Fixed** (`2174ec58`); verified: 20,000 users and 120,000 attempts read |
| 2 | Generator wrote no checksum | **Fixed** (`SHA256SUMS` written). Still open: manifest has `"synthetic": true` but not `"anonymised": true` (the script accepts synthetic) |
| 3 | `fixtures:generate` output must be inside the repo; the rehearsal script refuses a dump inside it | **Open**: the dump was again generated in the worktree `.migration-out` and moved out |
| 4 | Fixture and ETL value maps disagree | **Mostly fixed** (a6a915b4, 32182fb0). Still open, see P2.3: `mode` `battle`/`spm` rejected as UNKNOWN_ENUM for 15,774 sessions (cascades to 48,324 answers), `classrooms.education_level_id` empty (520), `support_tickets.body` empty (1,523), `challenges.target_value` (5), `articles.content` (5), `tiers.label_ms` (4). Whether the fixture or the ETL is right needs an owner decision |
| 5 | `migrate:verify` fails after a delta with source deletes | **Open** (unchanged; now also `feedback`, and a new distribution mismatch, problem B) |
| 6 | `etl_runs.git_sha` empty | **Fixed** (`f8c519fe` recorded for all runs) |
| 7 | `rehearsal-db.sh:663` prints `shared_buffers = 1310728kB` | **Open** (AZ file) |
| 8 | `etl_rejects` re-inserted every run | **Open** (not measured again) |
| 9 | `--as-of` defaults differ by timezone | **Fixed in AM-08/AM-09** (Malaysia date); this pass passed it explicitly anyway |
| 10 | Not tested: production-mode apply, `migrate:rollback`, `migrate:all`, `migrate:link-questions`, dump snapshots | **Open**, still not tested |
| A | New: AM-09 does not yet contain the AM-08 fixes (`2174ec58`, `32182fb0`); run as is it has the paging bug | Open until AM-09 is merged with AM-08 |
| B | New: AM-09 `migrate:verify` "practice answers per subject" shows a one-answer mismatch after a delta (staging "no subject" 1, v2 subject 8 +1); it passes on the full state, so a delta update seems to fill the subject of an answer that had none | Open, for the AM-09/AM-08 owners |
| C | New: the delta inserts 2 classrooms and 37 enrolments although none changed in the dump | **Explained: correct behaviour, not a bug.** A classroom's level has no .cloud column; it is derived from the pupils in staging (`transform/classes.ts:59` `deriveClassGrade`, `load/class-steps.ts:35-59`). The delta deletes users 17000-17049, so the most common grade changes for 6 classes; two of them (264, 294) now map to a grade that has a v2 level and load with their rosters (they were `INVALID_VALUE education_level_id` before). Identity is stable (legacy id = staging classroom id; enrolments keyed by classroom and student), the next apply converges. Pinned by `test/migration/core/class-delta.db.spec.ts`. Open design question for the LEAD: freeze the level of an already loaded class? |

## P2.7 What remains for the real-data run

Unchanged from the first pass (section 8 of pass 1), minus the paging fix: AM-10 dump on an encrypted machine, VPS sizing (#116) and settings, AM-09 merged with AM-08 and its verify/delta-delete decision (problems 5, A, B, C), the production-mode guard rehearsal, a dump-form snapshot restore, and the remaining fixture/ETL alignment (problem 4).

## P2.8 Teardown

`rehearsal-db.sh down --yes` ran; the dumps, the delta dump, scratch diff files, the state directory contents and the temporary AM-09 worktree were deleted. The throwaway cluster (data dir `<data-dir>`, port `<rehearsal-port>`, role `pp_reh_admin`, trust auth, loopback) is still running with only `postgres` and the templates. Step logs for pass 2 are under `<scratch>/logs/P2` and `<scratch>/logs/P2C` (git-excluded, counts only; synthetic data, so no retention limit applies to them).

# Pass 1 (before the paging fix)

- **Verdict**

| Part | Result |
|---|---|
| Full run on the branch as committed | **Mechanically green, silently wrong.** Every command exits 0 and every reconciliation row says `ok`, but `migrate:core` and `migrate:activity` read only about half of the rows of every table with more than 1,000 rows (problem 1). Not usable for go/no-go. |
| Full run with the 3-line fix to problem 1 (applied in a scratch copy only, no file under `apps/api/src` was edited) | **Green.** All 20,000 users and all 120,000 attempts are read. |
| Rollback | **Pass**, twice (`ROLLBACK VERIFIED`, DB back to pre-ETL, dry-runs repeated). |
| Delta (core + activity, and AM-09 `migrate:delta`) | **Pass on idempotency and on changed/added rows** (second apply: 0 inserted, 0 updated). **Source deletes are not propagated** (by design, plan 14.5 item 4), and AM-09 `migrate:verify` then reports `fail` (problem 5). |


### 1. Environment

| Item | Value |
|---|---|
| Machine | 4 vCPU Intel Xeon 2.80 GHz, 15 GB RAM, Linux 6.18 (Firecracker VM), root disk 252 GB, no full-disk encryption (synthetic data only) |
| Software | Node 22.22.0, npm 10.9.4, PostgreSQL 16.15 server and client (Ubuntu 24.04 packages) |
| Database server | A separate throwaway cluster: data dir `<data-dir>`, port `<rehearsal-port>` (loopback), unix socket dir `<data-dir>/..`, `--auth=trust`, no password anywhere. Left running. The default local Postgres port was not touched. |
| Admin role | `pp_reh_admin`: `LOGIN CREATEDB CREATEROLE`, not a superuser. Host mode (`PP_REHEARSAL_MODE=host`), migrations by psql (`PP_REHEARSAL_MIGRATE=psql`): 33 of 33 applied. |
| Settings (server flags) | `shared_buffers=1GB`, `work_mem=16MB`, `maintenance_work_mem=256MB`, `max_connections=100`, `wal_compression=on`, `log_min_duration_statement=500`; defaults otherwise (`fsync`, `synchronous_commit`, `full_page_writes` on, `wal_level=replica`, `max_wal_size=1GB`, UTC) |
| Dump | `pp-staging-dump/1`, 45 files, 71 MB on disk, 366,026 rows in 118 tables, manifest `"synthetic": true` |
| Delta dump | the same dump after a scripted change (section 6), checksum sidecar written by hand |

The VM does not let the `postgres` OS user write to `/tmp`, so the socket dir is a directory next to the data dir instead of `/tmp`. The script only uses TCP, so this changes nothing.

### 2. Commands (exact)

All from the repo root; `RDB=deploy/rehearsal/rehearsal-db.sh`. Environment from a 600 file outside the repo (`PP_REHEARSAL_MODE`, `PP_REHEARSAL_ADMIN_URL`, `PP_REHEARSAL_STATE_DIR`, `PP_REHEARSAL_MIGRATE`).

```bash
npm run fixtures:generate -w @pp/api -- --size medium --seed 7 --out <repo>/.migration-out/fixtures/medium-7   # then mv out of the repo (problem 3)
# checksum sidecar: <dump>.sha256 with the "directory" formula of rehearsal-db.sh sha_check
$RDB up ; $RDB load-dump <dump> ; $RDB stage ; $RDB snapshot pre_etl
$RDB exec target -- npm run migrate:core -w @pp/api -- --dry-run
PP_ALLOW_MIGRATE_APPLY=1 $RDB exec target -- npm run migrate:core -w @pp/api -- --apply
$RDB exec target -- npm run migrate:activity -w @pp/api -- --dry-run --content-owner <v2 admin user id>
PP_ALLOW_MIGRATE_APPLY=1 $RDB exec target -- npm run migrate:activity -w @pp/api -- --apply --content-owner <same id>
$RDB status
$RDB restore-snapshot pre_etl --yes
# delta
node apps/api/scripts/rehearsal/mig07-make-delta.mjs <dump> <delta dump>   # + sidecar
$RDB snapshot after_full ; $RDB load-dump <delta dump> ; $RDB stage ; (core, activity dry-run and apply, twice)
# AM-09 (separate detached worktree, same DB)
$RDB exec target -- npm run migrate:verify -w @pp/api
$RDB exec target -- npm run migrate:delta -w @pp/api -- --since=2026-08-31T00:00:00Z --as-of=2026-10-21 --content-owner=<id> [--apply]
$RDB down --yes
```

`apps/api/scripts/rehearsal/mig07-rehearse.sh full | rollback | delta | clean` runs the steps above with a per-step log, duration and WAL bytes (`MIG07_*` variables are described in its header). `clean` deletes the script's own logs and timings (see the retention rule in section 9). It was used for the fixed-code full run, the delta phase and the second rollback.

### 3. Full run (scratch-patched code): timings and sizes

| Step | Seconds | WAL written |
|---|---:|---:|
| `up` (create DBs and role, apply 33 migrations) | 6.4 | n/a |
| `load-dump` (PII scan, `staging:load` of 366,026 rows) | 14.6 | 96 MB |
| `stage` (copy `staging_cloud` + `archive_cloud` into the target) | 3.9 | 64 MB |
| `snapshot pre_etl` (template copy) | 3.2 | 44 MB |
| `migrate:core --dry-run` | 5.6 | 51 MB |
| `migrate:core --apply` | 6.1 | 49 MB |
| `migrate:activity --dry-run` | 244.1 | 135 MB |
| `migrate:activity --apply` | 239.4 | 151 MB |
| **Whole chain** | **about 523** | |

Peak throughput about 10,000 rows/s for core and about 1,400 rows/s for activity (the activity stage is the long pole: roughly 330,000 rows read per pass; the 120,000-row `question_attempts` dominates). Database sizes (`status`): target 20 MB after `up`, 253 MB after the full apply, 362 MB after the delta; staging DB 86 MB; staging copy inside the target 82 MB. `etl_rejects` is the biggest v2-side table (48 MB after 2 runs; every run, dry-run included, re-inserts all its reject rows, about 170,000 per activity pass; see problem 8). Largest source table by load: `question_attempts` (120,000 rows, 24 MB of ndjson).

### 4. Full run (scratch-patched code): row counts per entity

Source is the staged row count, loaded = inserted + updated + unchanged, rejected = rows in `etl_rejects`. Reconciliation status was `ok` for every entity in all runs. Dry-run and apply are identical.

| Stage | Entity | Source | Loaded | Rejected |
|---|---|---:|---:|---:|
| core | education_levels | 4 | 2 | 2 |
| core | subjects | 6 | 6 | 0 |
| core | chapters | 18 | 9 | 9 |
| core | topics | 54 | 4 | 50 |
| core | subject_levels | 18 | 9 | 9 |
| core | jpns / ppds | 3 / 15 | 3 / 15 | 0 |
| core | schools | 400 | 400 | 0 |
| core | users | 20,000 | 19,600 | 400 |
| core | parent_links | 1,713 | 1,591 | 122 |
| core | classrooms | 800 | 0 | 800 |
| core | enrolments | 15,679 | 0 | 15,679 |
| core | school_subscriptions | 400 | 0 | 400 |
| activity | tiers / challenges | 4 / 5 | 0 / 0 | 4 / 5 |
| activity | achievements | 6 | 6 | 0 |
| activity | wallets | 15,379 | 15,179 | 200 |
| activity | coin_ledger | 46,137 | 15,101 | 31,036 |
| activity | practice_sessions | 40,000 | 31,521 | 8,479 |
| activity | practice_answers | 120,000 | 2,823 | 117,177 |
| activity | streaks | 15,379 | 15,179 | 0 |
| activity | exam_attempts | 3,076 | 3,036 | 40 |
| activity | challenge_completions | 7,690 | 0 | 7,690 |
| activity | user_achievements | 7,689 | 7,590 | 99 |
| activity | referral_codes / referrals | 20,000 / 1,158 | 19,600 / 936 | 400 / 222 |
| activity | articles / banners | 5 / 3 | 0 / 0 | 5 / 3 |
| activity | support_tickets / feedback | 1,538 / 1,538 | 0 / 763 | 1,538 / 775 |
| activity | notes, videos, audio_kbat_sets, timeline_posts, spm_targets, gamification_settings | 0 | 0 | 0 |

`migrate:verify` (AM-09) on this state: `pass`, 37 entities, 16 checks.

#### Reject reasons (runs 2 and 4, counts)

| Reason | Count | Main causes (entity, column, value) |
|---|---:|---|
| ORPHAN_PARENT | 142,942 | `practice_answers` 117,177 (education_level_id, practice_session_id, chapter_id, topic_id, user_id); `enrolments` 15,679 (classroom_id); `challenge_completions` 7,690; `coin_ledger` 600; `users` 200; `topics`/`chapters`/`subject_levels` 68; others small |
| UNKNOWN_ENUM | 38,612 | `coin_ledger.source` `battle` and `gift` (30,236); `practice_sessions.mode` `kuiz` (7,867) plus the planted `mod_tidak_dikenali` (99); `coin_ledger.type` planted unknown (200); `users.role` planted unknown (200); `education_levels.stage` `secondary` (2); `banners.type` `info` (3); `challenges` (5) |
| INVALID_VALUE | 3,186 | `classrooms.education_level_id` (800, all); `support_tickets.body` (1,523); `feedback.score` (758); `referrals` (100); `articles.content` (5) |
| UNSUPPORTED | 404 | `school_subscriptions` (400), `tiers` (4) |

Reading: part of this is the planted anomalies (as intended). Most of it is not: the synthetic fixture and the ETL value maps do not agree (enum values `kuiz`, `battle`, `gift`, level stage `secondary`, empty `classrooms.education_level_id`, parentless chapters/topics, empty ticket body and feedback score). So only 2,823 of 120,000 attempts and 0 classrooms/enrolments reach v2. This pass proves the machinery and the timing of the read, not the load path of those entities. Which side is right (fixture or ETL map) is for the BE-35 and BE-28/29 owners to decide (problem 4). Notes printed by the activity stage: `wallets.tier_unmapped` 15,179, `practice_answers.difficulty_unparsed` 3,322, drift `wallet_ledger_mismatch` 15,179 and `streak_days_mismatch` 14,674.

### 5. Rollback

| Run | Step | Seconds | Result |
|---|---|---:|---|
| 1 (committed code, truncated data) | `restore-snapshot pre_etl --yes` | 5.2 | `ROLLBACK VERIFIED: every table of pp_rehearsal has the snapshot's row count again (28 table(s) differed before the rollback)`, `MIGRATION CHECK PASSED: 33 of 33` |
| 2 (after the full chain **and** the delta) | `mig07-rehearse.sh rollback` | 4.2 | same verdict, 29 tables differed before the rollback |

After each rollback: `migrate:core --dry-run` runs again and gives the same per-entity numbers as before the ETL, and `migrate:activity --dry-run` is refused by its preflight (exit 2, "no migrated users in etl_id_map. run migrate:core --apply first"), which shows the v2 side is empty again. The v2 `users` count and `etl_id_map` count were both 0 after the second rollback, with 20,000 staged users still present. The snapshot is a template copy in the same server (fast, 3 to 5 s); the dump-based snapshot (`snapshot <name> --dump`) and the AM-09 `migrate:rollback` (delete loaded rows) were **not** exercised here.

### 6. Delta

Delta dump made by `apps/api/scripts/rehearsal/mig07-make-delta.mjs` from the first dump: users 200 changed + 100 added + 50 deleted; schools 10 changed + 5 added; practice_sessions 300 changed + 500 added + 200 deleted; coin_transactions 300 added.

Sequence (all with `--as-of=2026-10-21`, the first load's day): `snapshot after_full` (5.4 s), `load-dump` (13.6 s), `stage` (3.7 s), then core and activity dry-run and apply, twice.

| Pass | core dry-run | core apply | activity dry-run | activity apply |
|---|---:|---:|---:|---:|
| delta 1 (seconds) | 5.1 | 6.0 | 230.4 | 226.9 |
| delta 2 (seconds) | 4.7 | 5.0 | 211.3 | 221.9 |

Freeze-window estimate for this volume: about 24 s of load and stage plus about 8 min for the ETL (or about 16 min if the full dry-run + apply of each stage is repeated, as AM-09 `migrate:delta --apply` does).

Row-level evidence from SQL (database after the delta compared with the `after_full` snapshot, rows keyed by legacy id):

| Table | Before | After | Inserted | Changed | Unchanged | Removed from v2 |
|---|---:|---:|---:|---:|---:|---:|
| users | 19,600 | 19,700 | 100 | 197 | 19,403 | 0 |
| schools | 400 | 405 | 5 | 10 | 390 | 0 |
| practice_sessions (correct_count) | 31,521 | 31,521 | 0 | 208 | 31,313 | 0 |

AM-09 `migrate:delta` on a restored `after_full` (inserted / updated / unchanged from its own report): schools 5 / 10 / 390; users 100 / 197 / 19,354 (sum 19,651 = loaded); referral_codes 100 / 197 / 19,354; coin_ledger 238 / 0 / 15,101; practice_sessions 0 / 236 / 31,127; referrals 0 / 1 / 935; every other entity 0 / 0 / unchanged. Its delta report also lists the staged tables with rows newer than `--since`. **Second `migrate:delta --apply` right after: 0 inserted and 0 updated in every entity** (idempotent). Core dry-run before the apply printed the same split. The changed or added rows that do not appear in these counts (3 of the 200 changed users, 62 of the 300 new ledger rows, all new sessions, which copy a `kuiz` row) are rejected by the same value mismatches as in section 4.

Source deletes (50 users, 200 sessions) are **not** propagated: v2 keeps those rows (users 19,700 against 19,651 loaded from source). That is the documented behaviour (plan 14.5 item 4) but see problem 5.

AM-09 timings: `migrate:delta` dry-run 4.8 s (activity skipped by design because core tables changed), `migrate:delta --apply` 413 s, second apply 414 s, `migrate:verify` 1.4 to 1.8 s.

### 7. Problems found

Severity is my judgement; owners decide.

1. **Blocker: silent row loss, `ORDER BY "id"` sorts by the text alias.** `apps/api/src/migration/load/source.ts:32` (`readById`), `apps/api/src/migration/load/activity/catalogue-steps.ts:84` (`readExpanded`) and `apps/api/src/migration/load/activity/exam-steps.ts:30` (`readExamAttempts`). The select list is `"id"::text AS "id"`, so `ORDER BY "id"` resolves to the output column (text) while the paging predicate `"id" > $1::bigint` uses the numeric input column. Page 1 is the first 1,000 ids in text order (1, 10, 100, 1000, 10000, ...), the next page starts after its last id numerically, and everything in between is skipped. A table with 1,000 rows or fewer is unaffected, so unit tests and `tiny`/`small` fixtures never see it. Effect on this run: `users` read 10,102 of 20,000, `question_attempts` 20,103 of 120,000, and the reconciliation still said `ok` because `eligible = read`. Fix (verified here in a scratch copy): `ORDER BY "id"::bigint`. Recommended: also make the reconcile compare `read` with the staged row count so a short read is a mismatch, and add a test with more than one page (page size 2, ids 1 to 25). The same patch applies cleanly on the AM-09 branch.
2. **`fixtures:generate` writes `"synthetic": true`, not `"anonymised": true`, and no checksum.** `apps/api/src/migration/fixtures/generate.ts:512` (manifest) and no `SHA256SUMS`. `rehearsal-db.sh` accepts `synthetic`, but the checksum must be made by hand (formula in `mig07-make-delta.mjs` header). The generator should write `SHA256SUMS` (or a sidecar).
3. **Output-path rules contradict each other.** `apps/api/src/migration/profile/render.ts:102` (used by `fixtures:generate`) requires the output under the working directory or repo root inside a `.migration-out` folder, while `rehearsal-db.sh` refuses any dump inside the repo. The dump had to be generated in the worktree and moved out. Allow an outside path with a `.migration-out` component, or document the move in `rehearsal-db.md`.
4. **Fixture and ETL maps disagree** (section 4). BE-35 and BE-28/29 owners should align them (which enum values, which `education_level_id`, parentless chapters/topics, `classrooms`, ticket body, feedback score) so the next rehearsal exercises the practice, class and wallet load paths and not 97.6% of the attempts rejected.
5. **AM-09 `migrate:verify` fails after a delta that has source deletes.** `apps/api/src/migration/verify/checks.ts:73-103` and the entity target counts: v2 holds 19,700 users against 19,651 loaded (and 31,521 sessions against 31,363), so `users`, `practice_sessions`, `referral_codes` and the per-role check are `mismatch`, `migrate:delta` stops with "stage verify failed" although core and activity applied and are idempotent. Either verify must expect the source deletes (an `expected_delta` or a "removed from source" count) or the runbook must say the delta verify is read as "fail for deletes only"; the lead needs this decision before the freeze window.
6. **`etl_runs.git_sha` is always empty.** `apps/api/src/migration/load/command.ts:35` and `load/activity/command.ts` never pass `gitSha` to `runCore`/the runner (`load/index.ts:108,131`). The audit trail cannot say which code made a run.
7. **`rehearsal-db.sh status` prints wrong `shared_buffers`.** `deploy/rehearsal/rehearsal-db.sh:663` concatenates `setting||unit`, giving `1310728kB` for 131072 x 8kB (1 GB). Use `current_setting(name)`. (AZ file, not edited.)
8. **`etl_rejects` grows with every run, dry-runs included** (about 170,000 rows per activity pass here, 48 MB after two runs). On the real dump the table can become the largest v2 table of the freeze window; consider purging dry-run rejects or capping the stored rows (BE-28/29 design decision).
9. **Documentation gap:** the `--as-of` default is the UTC date for core and the Malaysia date for activity (`load/activity/command.ts:45`), so a rehearsal that crosses 16:00 UTC uses different days. Always pass the same explicit `--as-of`. This run did (delta) after noticing it.
10. Not tested: `NODE_ENV=production` apply with synthetic data (only the first guard, "PP_MIGRATE_TARGET_DB must equal the connected database", refused with exit 2), `migrate:rollback`, `migrate:all`, `migrate:link-questions`, dump-form snapshots, `PP_REHEARSAL_MIGRATE=prisma` (the schema engine cannot be downloaded here).

### 8. What remains for the real-data run

- Fix problem 1 on `feature/v2-backend` (and the AM-08/AM-09 branches) before any further rehearsal; repeat this pass on the fixed code from a clean checkout.
- AM-10: the anonymised real dump (made by the dump operator) (`pg_dump -Fc` or `pp-staging-dump/1` with `"anonymised": true` and its checksum). Rehearse on a full-disk-encrypted machine, with the `.anonymised` attestation, keep at most 7 days and delete afterwards.
- AZ VPS sizing (#116): re-run with the real PostgreSQL settings and hardware (this VM: 4 vCPU, 15 GB, `shared_buffers` 1 GB). The activity stage was CPU-light on the Node side (about 5 s of CPU per 240 s), so the bottleneck is per-row round trips, not memory; ask whether batching is wanted before the real volume (the freeze window scales roughly linearly with rows).
- AM-09 `migrate:all` / `migrate:verify` / `migrate:rollback` as the primary path once merged; decision on problem 5; the lead's go/no-go sign-off line in the runbook.
- Fixture/ETL alignment (problem 4) so that a synthetic rehearsal exercises the whole load path; the real dump will show the true reject profile.
- A production-mode guard rehearsal (`NODE_ENV=production`, `PP_MIGRATE_TARGET_DB`) once a non-anonymised-flagged target exists.
- WAL, backups and replicas: none on the rehearsal cluster; the restore drill from a real backup (`docs/ops/db-backup.md`) is still separate.

### 9. Teardown and what was left

- `rehearsal-db.sh down --yes` ran: databases `pp_rehearsal`, `pp_rehearsal_staging`, the snapshots and the read-only role are gone. The synthetic dumps, the delta generator copy, scratch scripts and the state directory contents were deleted.
- Left running by design: the throwaway cluster (data dir `<data-dir>`, port `<rehearsal-port>`, socket dir next to the data dir, role `pp_reh_admin`, trust auth, loopback only). Stop it with `sudo -u postgres /usr/lib/postgresql/16/bin/pg_ctl -D <data-dir> stop`.
- **Retention of step logs.** `mig07-rehearse.sh clean` deletes the script's step logs and timings (only `*.log` and `*.timings.tsv` in its log dir, default `$PP_REHEARSAL_STATE_DIR/mig07-logs`; it never touches the databases, snapshots or the rest of the state dir). For the real-data pass the logs fall under the same 7-day retention rule as the dump (`docs/ops/rehearsal-db.md` section 9, migration runbook section 0 rule 4): they can carry row values from reject and error output, so keep only the counts and timings that are needed in a report, run `clean`, then `rehearsal-db.sh down --yes` (which removes the databases, snapshots and the state dir), all within 7 days of the load. On a failed step the script prints only the step name, the exit code and the log path, never log lines.
- Logs of every step of this synthetic pass (no personal data, counts and surrogate ids only) stay under `<scratch>/logs/` (git-excluded), together with the verified patch of problem 1 (`mig07-orderby-fix.patch`). They are synthetic, so the 7-day rule above does not apply to them.

