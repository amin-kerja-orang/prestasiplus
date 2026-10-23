# MIG-07 real-data pass: procedure for the dump operator

For the human dump operator, running ALONE on the rehearsal environment (#117, `deploy/rehearsal/rehearsal-db.sh`). It rehearses the 01:00 night sitting on the AM-10 anonymised dump. It is never run in a cloud session, and the dump never goes to GitHub or a cloud session. Synthetic results to compare with: `docs/ops/mig07-rehearsal-report.md` (P2.3 and P3.6).

## 1. Prerequisites

- The AM-10 anonymised dump (a `pp-staging-dump/1` directory) on the rehearsal host, outside the repo, with its attestation (`"anonymised": true` in `manifest.json`) and its checksum (`<dump>.sha256` or `SHA256SUMS` inside). Rules for the dump: `docs/ops/cloud-dump-procedure.md` (#125).
- The rehearsal env file, exported before the first call. Names only: `PP_REHEARSAL_MODE`, `PP_REHEARSAL_ADMIN_URL`, `PP_REHEARSAL_STATE_DIR`, `PP_REHEARSAL_MIGRATE`, and optionally `PP_REHEARSAL_DB` (must be `pp_rehearsal` or `pp_rehearsal_<a-z0-9>`). See `docs/ops/rehearsal-db.md` section 3.
- #122, #123, #133 and #125 merged, and the checkout at the merged head with `npm ci` and `npm run db:generate -w @pp/api` done.
- `deploy/rehearsal/rehearsal-db.sh up` done (all schema migrations applied).
- Optional, for the files step: the storage export directory with `SHA256SUMS`, and an empty absolute directory for the v2 file storage.

## 2. Commands

All from the repo root. `<...>` are placeholders; the values stay on the host.

```bash
set -a; . <rehearsal-env-file>; set +a
export MIG07_DUMP=<dump-dir> MIG07_AS_OF=<YYYY-MM-DD, today> MIG07_LOG_DIR=<log-dir outside the repo>
# optional: MIG07_FILES_DIR=<export-dir> MIG07_STORAGE_DIR=<empty-abs-dir>   MIG07_CONTENT_OWNER=<id>|none
S=apps/api/scripts/rehearsal/mig07-rehearse.sh

MIG07_TAG=night-1 $S night   # 1. seed, no-user check, load, stage, snapshot pre_etl, migrate:all dry-run + apply, migrate:verify
# 2. the check: section 4; the timings are in $MIG07_LOG_DIR/night-1.timings.tsv
$S night-rollback            # 3. restore pre_etl, ROLLBACK VERIFIED, migrated tables back to 0
deploy/rehearsal/rehearsal-db.sh reset --yes   # 4. a second night needs a new pre_etl (the name is taken); reset also runs up
MIG07_TAG=night-2 MIG07_CONTENT_OWNER=<id printed by run 1> $S night   # 5. the same sitting again
# optional, any time after a night or a night-rollback (it reads the staged archive tables):
$S archive                   # Q9 export, migrate:archive-minimise dry-run + apply, export CSV files deleted again
```

- Any non-zero step stops the phase and prints only the step name, the exit code and the log path. `night` never rolls back by itself: you decide, then run `night-rollback`.
- Do not use `migrate:verify` to confirm a rollback: on an empty target it exits 1. `night-rollback` checks `ROLLBACK VERIFIED` and the table counts instead.
- Content owner: it must be an active v2 admin and none exists before the load. With `MIG07_CONTENT_OWNER` unset, `night` runs a scout (core dry-run and apply, read the lowest active admin id, restore `pre_etl`) and prints the id. That costs a few seconds on synthetic data. Whether the go-live sitting scouts or takes a given id is a LEAD decision (open question on #123/#124).
- `archive` deletes the Q9 CSV files again because this is a rehearsal. At go-live the CSV is kept, with the same retention and access as the dump and outside GitHub (LEAD decision 19, #109 6340542912).
- Use a different `MIG07_TAG` per run: a run truncates the timings file of its own tag.
- Logs of this pass can carry row values in reject or error text. Never paste from them.

## 3. What to record

Counts and timings only:
- `night.timings.tsv` (step, seconds, WAL bytes, exit code), plus the `night-rollback` and `archive` steps.
- From the `all-apply` and `verify` logs: per entity read, loaded, rejected; the verify summary line (`N entities, M checks`).
- The rejects-by-reason table (counts, no values). Never select the `offending` or `legacy_id` columns:
  ```bash
  deploy/rehearsal/rehearsal-db.sh exec target -- bash -c 'psql "$DATABASE_URL" -Atq -c "$1"' _ \
    "select r.reason, count(*) from etl_rejects r join etl_runs u on u.id = r.run_id where u.mode = 'apply' and u.status = 'succeeded' group by 1 order by 2 desc"
  ```
- Rollback: the `ROLLBACK VERIFIED` line and the table counts printed by `night-rollback`.
- `archive` (if run): the `table | column | rows set to NULL` counts.

## 4. Go / no-go checks

| Check | Go | No-go or question |
|---|---|---|
| `verify` step | exit 0 | exit 1: stop, run `night-rollback`, report the failing check names (no values) |
| Any other step | exit 0 | non-zero: stop at that step name |
| Reject rate per entity | close to the synthetic profile (P2.3, P3.6) | a large difference is a question for #123 and the owning developer, not a silent pass; real data will differ in shape |
| Time per step | the sum, plus `snapshot` and the scout, fits the 01:00 window of #109 / #124 | over the window: report it; this host is not the production hardware |
| `deleted_at_source` lines | n/a: one load, no earlier load to compare with | a value here means the staging was loaded twice: stop and ask |
| Rollback | `ROLLBACK VERIFIED` and all migrated tables 0 | anything else: stop, report |

## 5. Post on #109 (aggregates only)

```
MIG-07 real-data pass (rehearsal #117), <date>, host class <cpu/ram/disk, no names>
Code: <merged head short sha>; dump: AM-10 anonymised, <row total per big table>
Steps (s / exit): seed <> / <>, load-dump <>, stage <>, snapshot <>, all-dry-run <>, all-apply <>, verify <>
Total: <s>; window: <s>
Verify: <exit>, <N entities, M checks>
Rejects by reason: ORPHAN_PARENT <n>, UNKNOWN_ENUM <n>, INVALID_VALUE <n>, DUPLICATE_KEY <n>, UNSUPPORTED <n>
Reject rate per entity: <entity %, ...> (synthetic: <...>)
Rollback: ROLLBACK VERIFIED yes/no; migrated tables 0 yes/no
Archive (optional): export <n> reports / <n> submissions, minimise rows set to NULL <n>
Go / no-go: <your call and why>
```

Do NOT post: any row, id, name, e-mail, IC number, school-level detail, a log file or a pasted error line, the dump path, a hostname, a URL, a credential, a screenshot of a log. Counts, timings, exit codes and reason names only.

## 6. Clean-up

1. `$S clean` (with the same `MIG07_LOG_DIR`) removes this script's logs and timings. Run it before `down` if the log dir is under the state dir.
2. `deploy/rehearsal/rehearsal-db.sh down --yes` within 7 days of loading the dump.
3. Wipe the dump and its copies as `docs/ops/cloud-dump-procedure.md` (#125) says. Remove the `.migration-out` folder of the checkout (verify and export files).

## 7. What this pass cannot prove

- **Production hardware and timing.** This host differs (fsync, disk, CPU); the 27 Oct production-like timed rehearsal with AZ-DevOps covers it.
- **`--dump` snapshot timing.** The script takes `pre_etl` as a template copy (seconds). A `pg_dump` snapshot takes longer and is not measured here.
- **The real `.cloud` freeze and export.** Freeze duration, the export itself, and the source under load are outside this pass.
- **Content owner at go-live** for a different dump than this one (ids follow load order), and the AM-09 `classrooms` / `referrals` verify mismatch (report P3.5 note 6), which is open with #123.
