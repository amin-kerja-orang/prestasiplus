# 27 Oct timed rehearsal (A4 / P6) and night window budget (P7): .cloud to v2 (MIG-08 addendum)

- **Status:** draft for the LEAD. **Nothing here has been run.** Every command, flag, variable, exit code and output line below was checked against the code or the docs named next to it; where something is not implemented or not known it is marked **Perlu pengesahan** with the person who confirms. Nothing is started without the LEAD's explicit confirmation.
- **Slug:** `v2-cutover-plan` (addendum). **Item:** half AM step 5 of MIG-08: plan steps A4 / P6 and P7 (budget, section 4.3). Docs only.
- **Builds on:** [cutover plan](v2-cutover-plan.md) sections 3 (P1, P5, P6, P7, P8), 3.1, 3.3, 4.0, 4.1 (A4, A5), 4.3, 4.6 (night card), 4.7, 5 and 6; the first sheet [A1 real-data rehearsal](rehearsal-a1-24oct.md); [rehearsal DB recipe](rehearsal-db.md); [migration runbook](../architecture/v2-migration-runbook.md) sections 12 to 18 (on branch `be/AM-09-migrate-orchestration` until PR #123 is merged); `docs/ops/cloud-dump-procedure.md` (PR #125); `docs/ops/production-migration-slot.md` and `deploy/vps/migration/slot.sh`, `restore-point.sh`, `pitr.sh` (PR #166); [backup and restore drill](db-backup.md); MIG-07 reports (`docs/ops/mig07-rehearsal-report.md`, branch `be/AM-MIG-07-rehearsal`).
- **Time convention:** every time is Malaysia time (MYT, UTC+8) with UTC in brackets. Durations are in seconds or minutes as stated.
- **Marker:** "Perlu pengesahan" means not decided or not verified yet; it is to be confirmed by the person named.
- **Privacy:** this repo is public. Roles only; no host names, addresses, names, secrets or row values. Placeholders: `<db>`, `<dump dir>`, `<extract dir>`, `<restricted dir>`, `<files export>`.

## 1. What A4 is for

A4 is the second rehearsal of the whole night, production-like and timed (plan P6). It has two jobs:

1. Time every step of the night (plan P1 and section 4.3), so the budget of section 9 can replace the 3,611 rows/s placeholder (P7).
2. Prove the two production guards, the restore of a restore point, the night card read end to end, and the read-only smoke on a restored copy.

It runs on **27 Oct**, on the release sha that the LEAD re-pinned at A2 (code freeze, 25 Oct). If the ETL or the schema changed after A1, A1 is repeated at that sha too (P2).

**Roles.** The half AM migration operator runs the ETL lines and owns the budget (P7 owner is AM). Half AZ DevOps runs the host, `slot.sh`, `restore-point.sh` and the scratch copy. The dump operator provides the 24 Oct clock readings and reads the night card as the night operator. QA runs the e2e smoke on the restored copy. The LEAD gives the start, reads the result and decides on P7. No agent session runs these steps or sees the data.

## 2. Two tracks: where each figure comes from

The code does not let one environment time everything. This is the reason (verified in the code):

- `slot.sh load` refuses a dump that is not marked `"raw": true`, or is marked `anonymised` or `synthetic` (`slot.sh`, `manifest_check`). The 24 Oct dump is marked anonymised, and `fixtures:generate` writes `"synthetic": true` (`fixtures/generate.ts:512`).
- `slot.sh etl` always runs with `NODE_ENV=production` and `PP_MIGRATE_TARGET_DB=<db>` (`slot.sh`, `cmd_etl`), and the ETL refuses staged data that holds the known dummy password hashes in production (`load/index.ts`, `assertNotSyntheticInProduction`). The anonymised dump holds them, so `slot.sh etl migrate:all` on that data is refused by design.
- `rehearsal-db.sh` forces `NODE_ENV=development` and accepts only attested anonymised or synthetic dumps.

So the 24 Oct dump (real shape and volume, anonymised) can only be loaded and migrated through `rehearsal-db.sh`. The scripts of the night (`slot.sh`, `restore-point.sh`) can only be exercised with data that is marked raw and holds no dummy hash.

| Track | Where | Data | Gives |
|---|---|---|---|
| **R** (rehearsal) | The rehearsal DB with production-like Postgres settings (recipe section 3: set `PP_PG_*` to the real VPS values; `status` must not print the `fsync` warning, else the figures are not valid for P7) | The 24 Oct AM-10 dump, extracted on the rehearsal host | `D_load`, `D_copy`, `D_profile_dry`, `D_apply`, `D_verify`, the rates `r_B6` and `r_B7`, rejects, snapshot and restore timings, the two guard refusals |
| **S** (slot) | A scratch VPS (a restored copy of the target, never production) | A **raw-marked fixture** (see below) at fixture volume | `throwaway-up` and `-down`, `D_load` and `D_copy` through `slot.sh`, restore points (`take`, `verify`, `restore`), `gonogo`, the production-mode run at fixture scale, the e2e smoke target, the night card read end to end |

**Rule for each figure:** take the larger (slower) of Track R and Track S for a step that exists on both, and say which one it was. Track R decides everything that scales with the number of rows; Track S decides the fixed cost of the scripts.

**Raw-marked fixture (Track S).** `fixtures:generate --size medium --seed 7 --out <dir inside a .migration-out folder>` writes a synthetic dump (20,000 users, about 366,000 rows in MIG-07) whose manifest says `"synthetic": true`, so `slot.sh load` refuses it. A fixture whose manifest carries `"raw": true` and neither `anonymised` nor `synthetic` is loadable. Its password values are filler (`fakeHash` in `fixtures/generate.ts`), not the dummy hashes, so in production mode the ETL will **accept** it. That makes it a safe end-to-end rehearsal of production mode at fixture scale on the scratch VPS, and it means this fixture can **not** be used for the guard refusal below.
**Perlu pengesahan (half AM, half AZ):** how the raw-marked fixture is produced (a hand edit of the manifest key is the only way with today's code), and that the LEAD accepts a fixture that carries a `raw` marker on a scratch host. `fixtures:generate` has no raw option.

## 3. Preconditions

| # | Precondition | Evidence |
|---|---|---|
| P-1 | A1 green at the release sha (or repeated at it). | The A1 evidence block (A1 sheet, section 11). |
| P-2 | Release sha re-pinned at A2 and the checkout at that sha; PRs #122, #123, #125 and #166 are in it. | `git rev-parse HEAD`; `grep -c` of the script names as in A1.0. |
| P-3 | The 24 Oct dump is still on the rehearsal host as the extracted directory (kept until the end of A4, A1 sheet section 10), inside 7 days (until 31 Oct). | Custody line; `du -sh`. |
| P-4 | The clock readings of the 24 Oct sitting (A1 sheet, I9). | The dump operator's list. |
| P-5 | `dump:check` was run by the dump operator (P8) and "rules OK" was received. Its line `Schema: <x> of <y> spec tables present, <rows> rows.` gives **N_night**, the best estimate of the night's rows (a number only; the report stays on the operator PC). | The number `N_night`. |
| P-6 | Track S host: a scratch VPS or a restored copy of the target, encrypted disk, `db.env`, the compose stack, the `migrate` image at the release sha, `PP_STAGE_DIR`, `PP_MIGRATION_OUT`; free disk at least 5 times the dump size on `PP_STAGE_DIR` (plan B0) and the 3 times database size for restore points (`production-migration-slot.md` section 1). **Perlu pengesahan (half AZ):** scratch VPS or the rehearsal box for Track S, and its size against production. | A confirmation line. |
| P-7 | A3 is done (26 Oct): roles of P3, `IC_HASH_KEY` and the other names of P5 exist (names only). | The P3 and P5 evidence. |
| P-8 | The maximum night window is set (default 6 hours); the LEAD confirms it on 27 Oct (plan 4.3). | A dated line. |
| P-9 | The read-only SQL checks of plan 4.5 part 1 exist as a file (half AM prepares them). **Perlu pengesahan (half AM):** the file is a deliverable for A4; without it criterion 9 cannot be shown. | The file's name and a count of statements. |
| P-10 | The e2e smoke command and how it points at the restored copy. **Perlu pengesahan (QA, half AZ):** the plan names the smoke but not the command; the repo has `npm run test:e2e` (Playwright). | The command line (no values). |

## 4. Timing sheet

One row per timed item. Fill every cell. `Rows` is the number of rows the step handles; `Rate` is rows per second where the step is a row-moving step. `Source of figure` says where the number comes from: **R** (Track R), **S** (Track S), **24** (the 24 Oct sitting), **MIG-07** (a measured figure from `mig07-rehearsal-report.md`, for comparison only).

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
| T09 | `D_load`: `staging:load` | B4 | Track S: `S load --from <dump dir>`; Track R: `rehearsal-db.sh load-dump` | | | | 0 | | | R and S | R includes the pattern scan; subtract it if it was timed alone. |
| T10 | Freeze proof SQL (rehearsed with `T` = the dump's end time) | B4 | read-only query per staged table with `updated_at` | | | | | tables | | R | **Perlu pengesahan (half AZ):** the one-line form. |
| T11 | `D_copy`: stage copy | B5 | Track S: `S copy`; Track R: `rehearsal-db.sh stage` | | | | 0 | | | R and S | `STAGE COPY PASSED`, 83 and 35. |
| T12 | Throwaway down and wipe | B5 | `S throwaway-down`; `S wipe-dump <extract dir>/raw <restricted dir>/<name>` | | | | 0 | | | S | `THROWAWAY DESTROYED`, `DUMP COPIES DELETED`. |
| T13 | `staging:profile` | B6 | `rehearsal-db.sh exec target -- npm run staging:profile -w @pp/api`; Track S: `S etl staging:profile` | | | | 0 | | | R and S | |
| T14 | `D_profile_dry`: `migrate:all --dry-run` (first load: core only) | B6 | see section 5 | | | | 0 | `N_core` | `r_core_dry` | R (and S) | Activity "skipped". |
| T15 | `D_apply`: `migrate:all --apply` (includes the verify) | B7 | see section 5 | | | | 0 | `N_core + N_act` | `r_B7` | R (and S) | Four stage runs from `etl_runs`. |
| T15a | of which: core dry-run, core apply, activity dry-run, activity apply | B7 | query (a) of the A1 sheet, A1.11 | | | | | | | R | Seconds per run. |
| T16 | `D_verify`: `migrate:verify` | B8 | `migrate:verify` | | | | 0 | | | R (and S) | `verify pass`. |
| T17 | Read-only SQL checks of plan 4.5 part 1 | B8 | the file of P-9, against the restored copy | | | | | checks | | R or S | All equal the verify report? |
| T18 | `slot.sh gonogo` read by the rule | B0, B9 | `S gonogo` | | | | 0 | | | S | No `NO-GO`, `MISSING`, `PITR off`; `api` line `-> 200`. |
| T19 | Restore point `pre_etl`: take and verify, after the final schema migrations | A5 | `R take pre_etl --operator "<role>"`; `R verify pre_etl` | | | | 0 | bytes | | S | `RESTORE POINT TAKEN`, `RESTORE POINT OK`; migration count (section 7). |
| T20 | **Restore of a restore point, small (the night's Case 2):** `restore pre_etl` | 4.6 Case 2 | `R restore pre_etl --yes` | | | | 0 | | | S | `RESTORED: pre_etl ... in <N> s`. |
| T21 | Restore of a **large** point (migrated and staged state; the replan case): take `pre_delta` after T15, then restore it | 6.3 | `R take pre_delta --operator "<role>"`; `R restore pre_delta --yes` | | | | 0 | bytes | | S and R | Track R: `restore-snapshot after_full --yes`, and the dump form `restore-snapshot <name> --yes`. |
| T22 | `migrate:rollback` dry-run and apply (fallback R-b) | 6.3 | see section 5 | | | | 0 | deleted | | R | Counts only. |
| T23 | Idempotency run: `migrate:delta` dry-run, apply, verify (**replan only**) | 4.7 | see section 5 | | | | 0 | | `r` | R | All `unchanged`. |
| T24 | Delta with changed rows (**replan only**) | 4.7 | needs a second dump | | | | | | | | **Not planned**; the plan marks it replan only. |
| T25 | The night card read end to end | 4.6 | section 8 | | | | n/a | defects | | | Minutes and a defect count. |
| T26 | e2e smoke on a restored copy (not in `W`) | P6 | the command of P-10 | | | | 0 | | | S | Test output tail as text. |
| T27 | Guard refusal 1: synthetic-data guard | P6 | section 6 | | | | 2 | | | R | Accepted = failed. |
| T28 | Guard refusal 2: target guard | P6 | section 6 | | | | 2 | | | R | Accepted = failed. |

`D_freeze` (20 min) and `D_gonogo` (15 min) are fixed by the plan and are not timed.

## 5. Commands

Same helpers as the A1 sheet, section 5 (`RDB`, `DB`, `ASOF=2026-10-29`, `step`, `q`). Track S uses `S=deploy/vps/migration/slot.sh` and `R=deploy/vps/migration/restore-point.sh` on the scratch VPS. **Track R steps follow the A1 sheet exactly** (A1.2 to A1.15) on a fresh `up` and a fresh load: the A1 sheet gives the expected output, the red conditions and the evidence queries; A4 adds what follows.

### 5.1 D_xfer on the real-size dump (T03 to T07)

The operator PC copy of the 24 Oct dump was wiped at the sitting (AM-10 step 8). At A4 the source is the extracted directory on the rehearsal host. The figure used for the budget is the larger of the 24 Oct readings and this repeat.

```bash
# on the host that holds <extract dir>; <work> is a new directory with mode 700, outside the repo
name="pp-rehearsal-xfer-<stamp>.tar.gz.gpg"; out="<work>/$name"
step t03-encrypt bash -c 'set -o pipefail; tar -C <extract dir> -czf - anon | gpg --symmetric --cipher-algo AES256 -o "$1"' _ "$out"
step t04-listing bash -c 'set -o pipefail; gpg --decrypt "$1" | tar -tzf - | wc -l' _ "$out"      # equals the entries of anon plus 1
sha256sum "$out"
step t05-scp scp "$out" <user>@<receiver host>:<restricted dir>/
# on the receiver: sha256sum <restricted dir>/$name  (the operator compares)
# on the receiver: mkdir -m 700 <extract dir 2>
step t06-extract bash -c 'set -o pipefail; gpg --decrypt <restricted dir>/"$1" | tar -xzf - -C <extract dir 2>' _ "$name"
```

The forms are those of plan 4.6 B3 with the anonymised directory `anon` in place of `raw files`; the passphrase is fresh, typed on the receiver, never in a file or a chat, and destroyed with the `.gpg` file (plan 3.3 item 5). The `gpg` prompts for the passphrase, so `step` will wait for you. After T06, wipe both `.gpg` files and `<work>` (section 11). T07 is the 24 Oct reading of `dump:wipe` (AM-10 step 8).

### 5.2 Track S: the script path on the scratch VPS

Order is the card's (plan 4.6 and A5). `--files-dir` is not used in this track unless a files fixture exists (see the open points).

```bash
# A5 analogue: restore points first (they refuse to be taken after staging_cloud exists)
R take pre_etl   --operator "<role>"        # T19: RESTORE POINT TAKEN: pre_etl file=... bytes=... sha256=... tables_with_data=<n> raw_data=no ... duration_s=<n>
R take pre_delta --operator "<role>"        # same state; the plan asks for it (A5 item 2; Perlu pengesahan, plan 3.1 gap a)
R verify pre_etl                            # RESTORE POINT OK: pre_etl file=... sha256 matches, <n> tables with data
# B0
S gonogo                                    # T18, read by the rule of plan 4.6
S throwaway-up                              # T08: THROWAWAY UP: container ..., database <db>_staging, ... archive_mode=off
# B4, B5 with the raw-marked fixture (section 2)
S load --from <fixture dir>                 # T09: LOAD DONE: archive_cloud:35 staging_cloud:83 in <db>_staging, duration_s=<n>
S copy                                      # T11: STAGE COPY PASSED: archive_cloud:35 staging_cloud:83 ..., duration_s=<n>
S throwaway-down                            # T12: THROWAWAY DESTROYED: container ... removed
S wipe-dump <fixture dir> <fixture .gpg, if any>   # DUMP COPIES DELETED: ...
# B6, B7, B8 in production mode (set by slot.sh; the fixture is accepted by the guard, see section 2)
S etl staging:profile                       # T13: ETL STEP staging:profile exit=0 duration_s=<n>
S etl migrate:all --dry-run --as-of=2026-10-29      # T14: ETL STEP migrate:all exit=0
S etl migrate:all --apply   --as-of=2026-10-29      # T15: ETL STEP migrate:all exit=0 (slot.sh adds PP_ALLOW_MIGRATE_APPLY=1)
S etl migrate:verify                        # T16: exit 0 and a line verify pass
S gonogo                                    # B9 analogue: throwaway: none running; stage: archive_cloud:35 staging_cloud:83
```

Expected strings are from `slot.sh` and `restore-point.sh`. The line `ETL STEP <cmd> exit=<rc> duration_s=<n> (reports in <dir>)` is printed for every `S etl`. A `S etl ... --apply` without `staging_cloud` in the target is refused with exit 3 ("no staging_cloud in the target: run copy first"). `S etl` refuses `migrate:core` and `migrate:activity` (exit 2).

For T21 and T20 (restores on the scratch VPS, after T15 and T16 and the smokes):

```bash
R take pre_delta --operator "<role>"        # a second point, now with the migrated and staged state: the large point (raw_data=yes: it holds staging_cloud)
R restore pre_delta --yes                   # T21: RESTORED: pre_delta (...) in <N> s. api and frontend stay stopped ...
S etl migrate:verify                        # a restored migrated point must give exit 0 and verify pass
R restore pre_etl --yes                     # T20: the night's Case 2 shape (restore of the small point over a large database)
```

`R restore` stops `api` and `frontend`, drops and recreates the database, restores the dump, starts nothing, and asks for the typed database name unless `--yes` is given (the LEAD pre-approves `--yes` at G6). On the scratch copy `--yes` is for the rehearsal only. The raw-flag points `pre_delta` (if taken after the copy) are on the deletion list: `purge-raw` runs after a `post_drop` point (not part of A4).

### 5.3 Track R: B6, B7, B8 and T22 to T23 with the real-shape data

As the A1 sheet, A1.7 to A1.13 and the optional O1 to O3, with these changes: production-like settings (section 2), the `--as-of` of the night, and one more recorded item per step: **peak RSS** (`/usr/bin/time -v` before `npm`) and **WAL** (`pg_current_wal_lsn()` before and after the apply, A1 sheet A1.11 d).

### 5.4 Per-run seconds and rows (for the rates)

Query (a) of the A1 sheet, A1.11, gives per run: stage, seconds, `rows_read`, `rows_loaded`, `rows_rejected`. From it:

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

- **Preferred:** the rehearsal DB at the state `pre_etl` with the stage of the 24 Oct anonymised dump (Track R). No change to any data. After the main Track R sequence, `restore-snapshot pre_etl --yes` returns to that state.
- **Alternative (a fixture):** a rehearsal DB staged from a synthetic fixture, with one planted row: `update staging_cloud.users set password = 'not-a-hash-anonymised' where id = (select min(id) from staging_cloud.users)` (as the unit tests do), run as the admin role on the rehearsal DB only, and restored from `pre_etl` afterwards.

Both guards sit in front of any write. Their order in the code: the CLI's apply guard first (`kit/apply-guard.ts`, called from `cli.ts` for every `--apply`), then the lock, then the core dry-run, where the synthetic-data guard runs (`runCore`, before the runner creates an `etl_runs` row).

**Before each refusal** (state check; write the seven numbers down; at the `pre_etl` state the five `etl_*` tables and `users` are 0):

```bash
q "select 'etl_runs', count(*) from etl_runs union all select 'etl_recon', count(*) from etl_recon union all select 'etl_rejects', count(*) from etl_rejects union all select 'etl_checkpoints', count(*) from etl_checkpoints union all select 'etl_id_map', count(*) from etl_id_map union all select 'users', count(*) from public.users union all select 'schools', count(*) from public.schools"
```

### 6.1 Refusal 1: the synthetic-data guard

```bash
step guard1 "$RDB" exec target -- env NODE_ENV=production "PP_MIGRATE_TARGET_DB=$DB" PP_ALLOW_MIGRATE_APPLY=1 npm run migrate:all -w @pp/api -- --apply --as-of="$ASOF"
```

(Shape of `rehearsal-db.md` section 4: `exec` forces `NODE_ENV=development`, so `NODE_ENV=production` goes inside the command with `env`; `exec` supplies `IC_HASH_KEY` from the state dir.)

| Item | Expected (from the code) |
|---|---|
| Exit code | **2** (`SyntheticDataRefusedError` extends `ApplyGuardError`; `cli.ts` maps it to exit 2) |
| stdout | The line `--apply target: database "<db>" on <host>` (the target guard passed). Do not copy it; it holds a host name. No line `migrate:all core dry-run: run <id>`. |
| stderr | `Refusing to migrate in production: staging_cloud holds the dummy password hashes of an anonymised or synthetic dump.` |
| After | The same seven counts as before, all unchanged. In particular `etl_runs` has no new row (0 at the `pre_etl` state): the guard stopped the run before the runner created it. |

The same data in production mode is refused for `--dry-run` too (the guard is in `runCore`, whatever the mode); this is what B6 relies on ("the synthetic-data guard fails early"). Optional check: the same line with `--dry-run` instead of `--apply`, exit 2, same message, `etl_runs` still 0.

**Not a valid proof:** exit 1 with `IC_HASH_KEY is required in production to hash IC numbers.` (the key was missing: `IcHasher` is built before the guard); exit 0; any `run <id>` line; any change in the counts.

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

`slot.sh etl` sets `NODE_ENV=production` and `PP_MIGRATE_TARGET_DB=<db>` itself on every run, so refusal 2 cannot be shown through `slot.sh`; the composition of the variables is verified by reading `cmd_etl` and by the accepted production-mode dry-run on the fixture in Track S. Refusal 1 through `slot.sh` needs a stage with dummy hashes in the production-mode copy, which `slot.sh load` does not allow (section 2). Both refusals are therefore shown on Track R, with the identical code path (`cli.ts`, `kit/apply-guard.ts`, `load/index.ts`).

## 7. Restore time and the migration-count check on restore points

**Restore time: what to record for every restore** (T20, T21, and the Track R restores of the A1 sheet A1.15, O1, O3):

| Field | Source |
|---|---|
| Point name and form | Track R: template copy or `--dump` file; Track S: `restore-point.sh` custody line (`name`, `bytes`, `raw_data`) |
| Size of the point (bytes or `du`) | custody line, or the `snapshot ... written as a dump (<size>)` line |
| State being replaced (small or migrated and staged) | The caller |
| Duration (seconds) | Track S: `RESTORED: <name> (...) in <N> s`. Track R: `[time] restore-snapshot <name>: <s>s` |
| Exit code | `echo $?` |
| Result lines | Track R: `ROLLBACK VERIFIED ...` and `MIGRATION CHECK PASSED: <n> of <n> ...`. Track S: the `RESTORED` line; then the counts check |
| Services | Track S: `api` and `frontend` stay stopped; v2 stays dark; no restart at night (plan 4.6 Case 2 step 5) |
| Host settings | `fsync` on (the `status` warning absent): a restore timed with `fsync` off is not valid. MIG-07 used template copies with `fsync` off (3 to 6 s) and never timed a dump-form restore |

The restore does not enter `W` (it happens only after a STOP, and `.cloud` is unfrozen first, plan 4.6 Case 2 step 1). It is recorded to state the worst case from a STOP to a restored database, and as plan section 6.4 asks. MIG-07 figures for comparison only: restore `pre_etl` 5.5 s and 4.4 s, `after_full` 16.7 s, `migrate:rollback --apply` 19 s (synthetic, 20k users).

**Migration-count check on restore points (plan A5 item 2 and criterion 8).** A point taken before the final schema migrations fails the check on restore (MIG-07 pass 4: a 33-migration snapshot on a 36-migration tree gave `MIGRATION CHECK FAILED: 33 applied, 36 in apps/api/prisma/migrations`). The rule:

1. `F` = folders at the release sha: `ls -d apps/api/prisma/migrations/*/ | wc -l`.
2. `n` = migrations applied in the point's database state: the number of rows of `_prisma_migrations` with `finished_at` set and `rolled_back_at` null (the query `rehearsal-db.sh` itself uses: `select count(*) from _prisma_migrations where finished_at is not null and rolled_back_at is null`).
3. `n` must equal `F`, and the names must match (the script compares the lists with `diff`).
4. Record `n` and `F` as text for every point: at `R take` time (the state taken is the live state, so the query on the live database just before `take` is the point's `n`) and again after a test `R restore`.

Where it is automatic: Track R. `restore-snapshot` prints `MIGRATION CHECK PASSED: <n> of <n> migrations applied in '<db>'` or fails with `MIGRATION CHECK FAILED` (exit 1), and `status` prints `applied: <n> of <F> in the folder` before a snapshot (A1 sheet A1.6).
Where it is manual: Track S. `restore-point.sh` prints no migration count (`take`, `verify` and `restore` lines carry the name, size, sha256, tables-with-data count and seconds only). **Perlu pengesahan (half AZ):** the one-line way to run the count query on the VPS database (the scripts use the `db` container), and whether to add the count to the `take` line or to `custody.tsv` (the plan's A5 item 2 needs it as text). A possible read of a point without restoring it, not tried here: `pg_restore --data-only --table=_prisma_migrations --file=- <point file>` and count the data lines.

A new schema migration after a point is taken means the points are taken again (A5 item 2).

## 8. The night card read end to end (T25)

The dump operator, as the night operator, reads plan section 4.6 from B0 to B10, the B9 checklist, the stop table, the common block and the rollback cases, **in order, with the half AZ DevOps present**, and checks every command against the scripts at the release sha. Record the minutes and every defect. A defect is **blocking** (a G6 blocker) or **not blocking**.

Checks that the reading must close (each is a fact from the code or the plan; the third column is what was found when this sheet was written):

| # | Item of the card | Check | Found (from the code at the time of writing) |
|---|---|---|---|
| 1 | B0, B9 `S gonogo` | The lines `NO-GO`, `MISSING`, `PITR off`, `-> 200`, `throwaway: none running` exist in the output | Present in `slot.sh cmd_gonogo`. It checks `pre_delta` and prints `MISSING or damaged -> NO-GO` without one: `R take pre_delta` is needed (plan 3.1 gap a). |
| 2 | B6, B7 `--files-dir=<files export>` | The path is readable inside the `migrate` container | `migrate_run` mounts only `PP_MIGRATION_OUT` as `.migration-out`; no files mount and no `FILE_STORAGE_DIR` (plan P5, 3.1 gap c). **Blocking until solved and shown.** |
| 3 | B6, B7 `--content-owner` | A decision | The card has none; content rows are rejected without it (A1 sheet, A1.9). Needs the LEAD. |
| 4 | B4 freeze proof | A one-line read-only form | `slot.sh` has no subcommand for it (plan B4). Section 5 row T10. |
| 5 | Case 2 step 4 and A5 | The migration count of a point | `restore-point.sh` prints none (section 7). |
| 6 | C5 `migrate:archive-minimise` through `slot.sh etl` | The command is accepted | The accepted list is `staging:profile`, `migrate:all`, `migrate:delta`, `migrate:verify`, `migrate:rollback`, `migrate:link-questions`, `migrate:export-question-reports` (plan 3.1 gap b). Daylight step, not blocking the night. |
| 7 | Case 2 step 6 `S etl migrate:rollback --confirm <db>` | Both gates are set by the script | `cmd_etl` adds `PP_ALLOW_MIGRATE_ROLLBACK=1` and `PP_ALLOW_MIGRATE_APPLY=1` for the rollback, with `NODE_ENV=production` and `PP_MIGRATE_TARGET_DB`. The code accepts `--confirm <db>` and `--confirm=<db>`. |
| 8 | The B7 expected text | `ETL STEP migrate:all exit=0`; `verify pass: <n> entities, <m> checks` | Both strings exist (`slot.sh`; `orchestrate.ts printVerify`). |
| 9 | One source lock | The card says the standalone `migrate:core` and `migrate:activity` do not take the lock | **Outdated.** They take the same lock since AM-08 and exit 2 when it is held (`load/command.ts`, `load/activity/command.ts`, `kit/source-lock.ts`; runbook section 12 and 19). `migrate:all` / `migrate:delta` / `migrate:rollback` exit 4. The advice (use only `migrate:all`) stands. |
| 10 | Step ids of `slot.sh` and `production-migration-slot.md` | Match the plan's numbering (A4, A5, B0 to B10) | Still the old ids (A4, A12, B11 to B13); the plan says #166 must be updated or the mapping read. |
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
| `r_B6`, `r_B7` | The **slower** (lower) of the valid runs (A1 and A4). A run that was red does not count. If the runs differ by more than 30 %, say so to the LEAD: MIG-07 saw 527, 668, 718 and 964 s for the same apply on one host, so use the slowest and keep the others as the spread. A4 on production-like settings governs when it is the only valid run; A1 is a lower-bound check. |
| `rho`, `kappa` | From the run whose rate was used. |
| `D_dump` | The 24 Oct reading (T01, plus T02 if the files export was allowed). If a rehearsal MySQL source exists for a repeat at A4 (**Perlu pengesahan, half AZ and the `.cloud` owner**), the larger. AM-10 section 8 says the A4 repeat is against a synthetic or anonymised source, never the real `.cloud`; plan P6 says the figure comes from the 24 Oct sitting (the plan replaces the older AM-10 wording). |
| `D_xfer` | The sum T03 to T07: the larger of the 24 Oct readings and the A4 repeat (section 5.1) for each sub-step. |
| `D_load`, `D_copy` | The larger of Track R and Track S (T09, T11). Subtract the pattern scan from Track R `load-dump` only if it was timed alone. |
| `D_verify` | T16 plus T17 (verify and the read-only SQL checks); the larger of the runs; if P-9 is missing, the plan's 20 min stays and the budget is marked incomplete. |
| `N_night` | The `dump:check` total of P-5 (27 Oct), and the 24 Oct manifest total as a cross-check. **Perlu pengesahan (LEAD):** whether to add an allowance for rows added between 27 Oct and the night (the 25 % buffer covers time, not rows). |
| Fixed items | `D_freeze` 20 min and `D_gonogo` 15 min, as the plan. |

### 9.3 Fill-in table

All durations in minutes (seconds divided by 60). `Used` is the value that goes into the sum.

| Item | A1 | A4 (R) | A4 (S) | 24 Oct | Used | Source of the used value |
|---|---|---|---|---|---|---|
| `N_manifest` (rows) | | | n/a | | | |
| `N_night` (rows) | | | | n/a | | P-5 |
| `rho` | | | n/a | n/a | | |
| `kappa` | | | n/a | n/a | | |
| `r_B6` (rows/s) | | | n/a | n/a | | slower |
| `r_B7` (rows/s) | | | n/a | n/a | | slower |
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

### 9.4 Per-step latest times (second test)

`W` is a total. The card also has a latest time for every step (plan 4.6). With the buffer, the clock after each step must still be at or before the step's latest time. `C_k = 20 + 1.25 x (sum of the durations of B2 to step k)`, in minutes after `T` (01:00). Fill the duration column from the table above.

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
| B9 ends (`+ D_gonogo`) so B10 fits | | | 345 | 06:45 | |
| B10 close | 15 | | 360 | 07:00 | |

A step that does not fit means the LEAD either changes that latest time in the card, or moves the date, before G6.

### 9.5 Decision rule (P7)

- **`W` at most the maximum window and every row of 9.4 fits:** P7 is met. The half AM operator posts the sum, `W`, the margin and the largest `N_night` as text.
- **`W` above the maximum, or any row of 9.4 does not fit:** the LEAD decides on 27 Oct: **widen the window** (and change the latest times of the card), or **move the date**. Nothing is shortened by editing the ETL on the night. Plan 4.3 and P7.
- **The budget is incomplete** (a figure missing: the files export, the read-only SQL checks, a Track S step) and the missing item is not covered by a plan placeholder: the half AM operator says so in the post, and the LEAD decides whether to take the plan's placeholder for it.
- **Contradiction to resolve (Perlu pengesahan, LEAD):** plan 4.3 compares `W` (B1 to the end of B9) with 360 min, but the card lets B9 start as late as T+5:30 and takes 15 min, and then B10 needs 15 more minutes before T+6:00 (07:00). If both hold, `W` can be at most about 345 min. The sheet shows both margins.

### 9.6 Worked example (placeholders only; not a measurement)

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
| Cumulative `C_k` (9.4) | B2 51.3, B3 70.0, B4 95.0, B5 107.5, B6 136.4, B7 194.1, B8 219.1 | each is below its latest time (70, 95, 125, 140, 170, 300, 320) |

At these placeholders every row of 9.4 fits. The first row to fail would be B2: `D_dump` above 40 min fails it (`20 + 1.25 x 40 = 70`). This example shows the method. It says nothing about the real data.

## 10. Green and red for A4

**A4 is green** when: every red condition of the A1 sheet section 9 is absent for the A4 runs; both guard refusals were shown as in section 6; the restore of a restore point worked and the migration count equalled the folders (section 7); the night card was read and every blocking defect of section 8 is closed or has a dated owner before G6; the budget of section 9 is filled and the P7 rule holds (or the LEAD decided); the e2e smoke and the read-only SQL checks passed on a restored copy (not on production); the evidence below is posted.

**A4 is red** when any of these happens:

1. Any red condition of the A1 sheet section 9 on an A4 run, including a non-zero exit where 0 is expected and a `migrate:verify` that is not exit 0 with `verify pass`.
2. A guard refusal that is **accepted**, or refused for the wrong reason (section 6.3).
3. A restore of a restore point that fails, or a migration count `n` not equal to `F`.
4. `slot.sh gonogo` with `NO-GO`, `MISSING` or `PITR off` on the scratch copy at the point where it must be clean; `throwaway` still running after `S throwaway-down`.
5. The e2e smoke or a read-only SQL check differs from the verify report (trigger R4 shape).
6. A blocking defect in the night card (section 8) without an owner and a date.
7. Personal data in a post, a log or a copy outside the custody list (PDPA incident: tell the LEAD at once).

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
Budget: fixed <> min, ETL <> min, sum <>, W <>, margin to 360 <>, to 345 <>, N_night_max <>; per-step fit <all|list>
Smoke: e2e <pass|fail> (tail as text), read-only SQL checks <n of n equal>
Result: GREEN | RED (item <id>, reason <short>); P7: met | LEAD decision needed (widen | move)
```

## 11. Close of A4

- Wipe both `.gpg` files of 5.1 and `<work>` (overwrite with `shred -u -n 1 -z`, then remove), and destroy the passphrase notes.
- After A4: the extracted 24 Oct dump directory (and `files`) is deleted on the rehearsal host and **named at A5** (plan A5 item 7 and section 7): `find <extract dir> -type f -exec shred -u -n 1 -z {} +` then remove the directory, the pattern of `slot.sh wipe-dump` (**Perlu pengesahan (half AZ):** the exact command on the rehearsal host, as in the A1 sheet). On the scratch VPS: `S wipe-dump <dir> <file>` for the fixture, `S throwaway-down` (the cluster must not be left running), and drop the scratch copy.
- Rehearsal DB: `"$RDB" down --yes` after copying the timings (`"$RDB" status` prints `timings.log`).
- Restore points of the scratch copy: kept or deleted with the scratch host.
- Reports under `.migration-out/`: aggregates only; kept in the LEAD's storage at most 30 days, never in GitHub.
- One closing line to the LEAD, as in the A1 sheet section 10.

## 12. Open points raised by this sheet

| # | Perlu pengesahan | Who confirms |
|---|---|---|
| 1 | Track S host (scratch VPS or the rehearsal box) and its size. | Half AZ |
| 2 | How the raw-marked fixture is produced; accepting a `raw` marker on a scratch host. | Half AM, half AZ, LEAD |
| 3 | The plan says the guard test uses a synthetic fixture; by the code only dummy-hash data is refused. Use the anonymised stage (preferred) or plant the marker. | Half AM |
| 4 | `--files-dir` and `FILE_STORAGE_DIR` do not reach the `migrate` container (plan P5, 3.1 gap c). | Half AZ |
| 5 | `--content-owner` at the night (A1 sheet, A1.9). | LEAD, half AM |
| 6 | `migrate:archive-minimise` not in the `slot.sh etl` list (3.1 gap b). | Half AZ |
| 7 | The migration count of a restore point on the VPS (no output from `restore-point.sh`). | Half AZ |
| 8 | The freeze-proof one-line form. | Half AZ |
| 9 | The file of read-only SQL checks (plan 4.5 part 1). | Half AM |
| 10 | The e2e smoke command and target. | QA, half AZ |
| 11 | `D_xfer` source at A4 (host, not the operator PC); a rehearsal MySQL source for an A4 `dump:cloud` repeat. | Dump operator, half AZ, `.cloud` owner |
| 12 | Which limit applies to `W`: 360 or about 345 min; a row-growth allowance for `N_night`. | LEAD |
| 13 | `slot.sh` and #166 step ids against the plan's numbering. | Half AZ |
