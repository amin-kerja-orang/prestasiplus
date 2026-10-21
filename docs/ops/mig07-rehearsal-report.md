# MIG-07 rehearsal report: .cloud to v2 data migration, first pass on SYNTHETIC data

- **Item:** MIG-07 (#109, P0), first pass. Date of the run: 2026-10-21.
- **Data:** synthetic only (`fixtures:generate --size medium --seed 7`, BE-35). Amin's anonymised real dump (AM-10) does not exist yet, so nothing here proves behaviour on real data volumes or real value shapes.
- **Code under test:** branch `be/AM-MIG-07-rehearsal` = `feature/v2-backend` + AM-08 (`migrate:activity`, PR #122) + AZ-30 (rehearsal environment, PR #117). One run also used `origin/be/AM-09-migrate-orchestration` (`migrate:verify`, `migrate:delta`) from a temporary detached worktree.
- **Verdict**

| Part | Result |
|---|---|
| Full run on the branch as committed | **Mechanically green, silently wrong.** Every command exits 0 and every reconciliation row says `ok`, but `migrate:core` and `migrate:activity` read only about half of the rows of every table with more than 1,000 rows (problem 1). Not usable for go/no-go. |
| Full run with the 3-line fix to problem 1 (applied in a scratch copy only, no file under `apps/api/src` was edited) | **Green.** All 20,000 users and all 120,000 attempts are read. |
| Rollback | **Pass**, twice (`ROLLBACK VERIFIED`, DB back to pre-ETL, dry-runs repeated). |
| Delta (core + activity, and AM-09 `migrate:delta`) | **Pass on idempotency and on changed/added rows** (second apply: 0 inserted, 0 updated). **Source deletes are not propagated** (by design, plan 14.5 item 4), and AM-09 `migrate:verify` then reports `fail` (problem 5). |

## 1. Environment

| Item | Value |
|---|---|
| Machine | 4 vCPU Intel Xeon 2.80 GHz, 15 GB RAM, Linux 6.18 (Firecracker VM), root disk 252 GB, no full-disk encryption (synthetic data only) |
| Software | Node 22.22.0, npm 10.9.4, PostgreSQL 16.15 server and client (Ubuntu 24.04 packages) |
| Database server | A separate throwaway cluster: data dir `/var/tmp/pp-reh-pg/data`, port `55433` (loopback), unix socket dir `/var/tmp/pp-reh-pg`, `--auth=trust`, no password anywhere. Left running. Port 55432 was not touched. |
| Admin role | `pp_reh_admin`: `LOGIN CREATEDB CREATEROLE`, not a superuser. Host mode (`PP_REHEARSAL_MODE=host`), migrations by psql (`PP_REHEARSAL_MIGRATE=psql`): 33 of 33 applied. |
| Settings (server flags) | `shared_buffers=1GB`, `work_mem=16MB`, `maintenance_work_mem=256MB`, `max_connections=100`, `wal_compression=on`, `log_min_duration_statement=500`; defaults otherwise (`fsync`, `synchronous_commit`, `full_page_writes` on, `wal_level=replica`, `max_wal_size=1GB`, UTC) |
| Dump | `pp-staging-dump/1`, 45 files, 71 MB on disk, 366,026 rows in 118 tables, manifest `"synthetic": true` |
| Delta dump | the same dump after a scripted change (section 6), checksum sidecar written by hand |

The VM does not let the `postgres` OS user write to `/tmp`, so the socket dir is `/var/tmp/pp-reh-pg` instead of `/tmp`. The script only uses TCP, so this changes nothing.

## 2. Commands (exact)

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

`apps/api/scripts/rehearsal/mig07-rehearse.sh full | rollback | delta` runs the steps above with a per-step log, duration and WAL bytes (`MIG07_*` variables are described in its header). It was used for the fixed-code full run, the delta phase and the second rollback.

## 3. Full run (fixed code): timings and sizes

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

## 4. Full run (fixed code): row counts per entity

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

### Reject reasons (runs 2 and 4, counts)

| Reason | Count | Main causes (entity, column, value) |
|---|---:|---|
| ORPHAN_PARENT | 142,942 | `practice_answers` 117,177 (education_level_id, practice_session_id, chapter_id, topic_id, user_id); `enrolments` 15,679 (classroom_id); `challenge_completions` 7,690; `coin_ledger` 600; `users` 200; `topics`/`chapters`/`subject_levels` 68; others small |
| UNKNOWN_ENUM | 38,612 | `coin_ledger.source` `battle` and `gift` (30,236); `practice_sessions.mode` `kuiz` (7,867) plus the planted `mod_tidak_dikenali` (99); `coin_ledger.type` planted unknown (200); `users.role` planted unknown (200); `education_levels.stage` `secondary` (2); `banners.type` `info` (3); `challenges` (5) |
| INVALID_VALUE | 3,186 | `classrooms.education_level_id` (800, all); `support_tickets.body` (1,523); `feedback.score` (758); `referrals` (100); `articles.content` (5) |
| UNSUPPORTED | 404 | `school_subscriptions` (400), `tiers` (4) |

Reading: part of this is the planted anomalies (as intended). Most of it is not: the synthetic fixture and the ETL value maps do not agree (enum values `kuiz`, `battle`, `gift`, level stage `secondary`, empty `classrooms.education_level_id`, parentless chapters/topics, empty ticket body and feedback score). So only 2,823 of 120,000 attempts and 0 classrooms/enrolments reach v2. This pass proves the machinery and the timing of the read, not the load path of those entities. Which side is right (fixture or ETL map) is for the BE-35 and BE-28/29 owners to decide (problem 4). Notes printed by the activity stage: `wallets.tier_unmapped` 15,179, `practice_answers.difficulty_unparsed` 3,322, drift `wallet_ledger_mismatch` 15,179 and `streak_days_mismatch` 14,674.

## 5. Rollback

| Run | Step | Seconds | Result |
|---|---|---:|---|
| 1 (committed code, truncated data) | `restore-snapshot pre_etl --yes` | 5.2 | `ROLLBACK VERIFIED: every table of pp_rehearsal has the snapshot's row count again (28 table(s) differed before the rollback)`, `MIGRATION CHECK PASSED: 33 of 33` |
| 2 (after the full chain **and** the delta) | `mig07-rehearse.sh rollback` | 4.2 | same verdict, 29 tables differed before the rollback |

After each rollback: `migrate:core --dry-run` runs again and gives the same per-entity numbers as before the ETL, and `migrate:activity --dry-run` is refused by its preflight (exit 2, "no migrated users in etl_id_map. run migrate:core --apply first"), which shows the v2 side is empty again. The v2 `users` count and `etl_id_map` count were both 0 after the second rollback, with 20,000 staged users still present. The snapshot is a template copy in the same server (fast, 3 to 5 s); the dump-based snapshot (`snapshot <name> --dump`) and the AM-09 `migrate:rollback` (delete loaded rows) were **not** exercised here.

## 6. Delta

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

## 7. Problems found

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

## 8. What remains for the real-data run

- Fix problem 1 on `feature/v2-backend` (and the AM-08/AM-09 branches) before any further rehearsal; repeat this pass on the fixed code from a clean checkout.
- AM-10: Amin's anonymised real dump (`pg_dump -Fc` or `pp-staging-dump/1` with `"anonymised": true` and its checksum). Rehearse on a full-disk-encrypted machine, with the `.anonymised` attestation, keep at most 7 days and delete afterwards.
- AZ VPS sizing (#116): re-run with the real PostgreSQL settings and hardware (this VM: 4 vCPU, 15 GB, `shared_buffers` 1 GB). The activity stage was CPU-light on the Node side (about 5 s of CPU per 240 s), so the bottleneck is per-row round trips, not memory; ask whether batching is wanted before the real volume (the freeze window scales roughly linearly with rows).
- AM-09 `migrate:all` / `migrate:verify` / `migrate:rollback` as the primary path once merged; decision on problem 5; the lead's go/no-go sign-off line in the runbook.
- Fixture/ETL alignment (problem 4) so that a synthetic rehearsal exercises the whole load path; the real dump will show the true reject profile.
- A production-mode guard rehearsal (`NODE_ENV=production`, `PP_MIGRATE_TARGET_DB`) once a non-anonymised-flagged target exists.
- WAL, backups and replicas: none on the rehearsal cluster; the restore drill from a real backup (`docs/ops/db-backup.md`) is still separate.

## 9. Teardown and what was left

- `rehearsal-db.sh down --yes` ran: databases `pp_rehearsal`, `pp_rehearsal_staging`, the snapshots and the read-only role are gone. The synthetic dumps, the delta generator copy, scratch scripts and the state directory contents were deleted.
- Left running by design: the throwaway cluster (data dir `/var/tmp/pp-reh-pg/data`, port 55433, socket dir `/var/tmp/pp-reh-pg`, role `pp_reh_admin`, trust auth, loopback only). Stop it with `sudo -u postgres /usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/pp-reh-pg/data stop`.
- Logs of every step (no personal data, counts and surrogate ids only) stay under `/home/user/prestasiplus/.scratch/AM1-Dev1/mig07/logs/` (git-excluded), together with the verified patch of problem 1 (`mig07-orderby-fix.patch`).
