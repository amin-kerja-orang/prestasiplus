# v2 cutover plan: .cloud to v2, go-live 30 Oct 2026 (MIG-08)

- **Status:** proposal for LEAD approval. Open decisions are in section 8. Nothing here has been run.
- **Slug:** `v2-cutover-plan`. **Item:** MIG-08 (P0). Docs only.
- **Builds on:** [migration runbook](../architecture/v2-migration-runbook.md) sections 0 to 18 (sections 12 to 18 arrive with PR #123; until it is merged they exist only on that branch), [data migration design](../architecture/v2-data-migration.md) (risk "Cutover", section 5; load order, section 6.1), [backend plan](../architecture/v2-backend-plan.md) sections 14.5 to 14.8, [backup and restore drill](db-backup.md), [go-live checklist](go-live-bijak-spm.md), and the roles in [AGENT-SYNC](../plan/AGENT-SYNC.md) ("Halves"). It also uses the LEAD's "all defaults" answers on the MIG-03 decisions (21 Oct 2026) (PR #114), the half AZ rehearsal environment (PR #117: `docs/ops/rehearsal-db.md` and `deploy/rehearsal/rehearsal-db.sh`), and the AM-10 dump tools (in progress, section 3.2).
- **Time convention:** every time is Malaysia time (MYT, UTC+8) with UTC in brackets. `.cloud` `DATETIME` values are read as +08:00 (decision DT-1 A).
- **Marker:** "Perlu pengesahan" means not decided yet; it is to be confirmed by the person named, or by the LEAD.

This plan does not repeat the runbook. Where it says "runbook 14", read section 14 of the migration runbook.

## 1. Purpose and scope

**Purpose.** Move the user data of the old system `.cloud` (MySQL) into the v2 backend (PostgreSQL 16) with a short, rehearsed freeze of `.cloud` writes, so v2 goes live for Bijak SPM on **30 Oct 2026** with the existing users, schools, classes and history, and so the go-live can be stopped or reversed on measurable triggers.

**What moves.** The entities in the load order of data-migration 6.1 and the matrix in backend plan 14.7, loaded by `migrate:all` (first load, T-1) and `migrate:delta` (final catch-up, inside the freeze). Question-bound working state, structured and exam answers, and the other items decided in MIG-03 are dropped or archived as decided there. Streak, mastery and rankings are recomputed and differ by design (runbook 17).

**What never happens.**

- `.cloud` is never modified by the team. The `.cloud` operator (who that is: open decision 5) only switches it to read-only or maintenance mode and back. This is an operational switch with no change to its code or data (decision D28a). No agent session has access to `.cloud` or holds its credentials.
- `prestasiplus.my` is not touched and is not a source (`staging_my` stays an empty extension point).
- No dump, report or secret goes into the repo, a PR, an issue, chat or a CI artifact (runbook 0).
- Nothing in this plan is executed without the LEAD's explicit confirmation. The production deploy needs the LEAD's approval (gate G6).

## 2. Roles (RACI)

R = does it, A = accountable (one per row), C = consulted, I = informed.

| Role | Who | Responsibility in the cutover |
|---|---|---|
| LEAD | `azarulhakim` | Go/no-go and rollback decisions, merges, approves the production deploy, receives the deletion confirmations. |
| `.cloud` operator | **Perlu pengesahan** (open decision 5). Proposed: Amin (`aminfaudzi`), who holds the read-only server access | Switches `.cloud` to read-only or maintenance mode and lifts it again (also on an abort); proves no write happens after the freeze. Does not change `.cloud` code or data. |
| Dump operator | Amin (`aminfaudzi`), decided (OD-18 A); the LEAD approves | Runs the `.cloud` export on his machine (section 3.2), encrypted hand-over. Runs `.cloud` side communication if the LEAD agrees (open decision 6). |
| Half AZ DevOps | half AZ | Production database and VPS, backups and PITR, restore points, the production `stage` step, deploys, DNS or app switch, monitoring. |
| Half AM migration operator | half AM | Runs `staging:profile` and `migrate:*` against the production target, reads and reports the verify output and rejects. Who types the commands is **Perlu pengesahan** (open decision 7; proposed: the half AM migration operator with half AZ DevOps on the host); the production credentials stay with a human and in the platform secret store, never with an agent. |
| QA | half AZ (G5 owner) | Smoke after the switch (runbook 17 item 2) and the conformance suite. |

| Step | LEAD | Dump op. (Amin) | `.cloud` op. | AZ DevOps | AM operator | QA |
|---|---|---|---|---|---|---|
| Approve this plan, window and thresholds | A/R | C | C | C | C | I |
| Preconditions (section 3) | A | R (his items) | R (his items) | R | R | C |
| First dump (T-1) and final dump | A (approves) | R | C | I | I | I |
| Encrypted hand-over and checksum | I | R | | R | I | |
| Restore points and backups | I | | | A/R | C | |
| Production `stage` step | I | | | A/R | C | |
| `migrate:all`, `migrate:delta`, `migrate:verify` | I | | | C (guards, env) | A/R | |
| Freeze and unfreeze `.cloud` | A (asks) | C | R | | | |
| Go/no-go at the decision point | A/R | C | C | C | C (reads verify) | C |
| Switch to v2 | A (approves) | | C | R | C | I |
| Smoke (G5) | A | | | C | C | R |
| Rollback | A/R (decides) | | R (unfreeze) | R (restore, switch back) | R (rollback command) | I |
| Notice to schools and users | A | **Perlu pengesahan** (open decision 6) | | | | |
| Deletion of dumps, retention (section 7) | A/R (custodian) | R (his copies) | | R (production host) | R (reports) | |

## 3. Preconditions (T-5 days to T-1)

All must be met and evidenced as text before the freeze is announced as "go". A precondition with no evidence counts as not met. The LEAD checks the list at the end of 29 Oct (step A11 in section 4).

| # | Precondition | Due | Owner | Evidence |
|---|---|---|---|---|
| P1 | **MIG-07 rehearsal green** (D61: before 25 Oct) with timings for: export (`dump:cloud`) on Amin's machine, hand-over, `staging:load`, stage copy, `migrate:all --apply`, `migrate:verify`, delta dry-run and apply (runbook 13 item 18), `migrate:rollback` (item 19), restore of a snapshot. Runbook 14 met on the rehearsal. | 25 Oct | AZ, AM | The timing figures and exit codes as text. |
| P2 | PRs **#122** (AM-08, ETL throughput) and **#123** (AM-09, orchestration) merged by the LEAD. The git sha the rehearsal ran is the release sha, or the rehearsal is repeated after any ETL change. | 25 Oct | LEAD | The two shas. |
| P3 | Production database migrated to the tip with `prisma migrate deploy`; applied migrations equal the number of folders; `/api/ready` reports migrations applied; v2 is **not public** yet. | 27 Oct | AZ | The counts. |
| P4 | Backups and PITR on for the production database; a restore drill passed on it ([db-backup](db-backup.md)). A backup that has not passed a restore check is not trusted. | 27 Oct | AZ | Drill result, backup timestamp. |
| P5 | Secrets in the platform secret store, never in the repo: `DATABASE_URL`, `IC_HASH_KEY` (one value for T-1 and the delta; a copy kept by the LEAD, because a different key changes IC hashes), `PP_MIGRATE_TARGET_DB` and `PP_ALLOW_MIGRATE_APPLY` set per run only, not permanently. CI tokens have no production access. | 27 Oct | AZ, LEAD | A confirmation line per name (no value). |
| P6 | **Production `stage` step ready** (section 3.1) and **a rehearsal of the whole final procedure end to end on a fresh copy**, including the dump path of section 3.2: Amin runs the export on the live read-only account (`dump:produce` for the rehearsal, raw to anonymised, since the rehearsal environment refuses raw data; the `dump:cloud` export part timed on its own), encrypted hand-over and checksum, `staging:load`, stage copy, T-1 load, freeze simulation, final-dump path, delta dry-run and apply, verify, rollback, restore-point restore. The full conformance suite and e2e smoke run here against a restored **copy** of the target, never against production. Every duration recorded. | 28 Oct | AZ, AM, Amin | Timings against section 4.3; test output tail. |
| P7 | **Window budget computed** (section 4.3) from P1 and P6 and within the maximum window. If not, the LEAD decides on 28 Oct: widen the window, drop the standalone delta dry-run, or move the date. | 28 Oct | AM | The sum and the margin. |
| P8 | `.cloud` operator: written freeze procedure (how `.cloud` is made read-only and how he proves no write happens after it) and unfreeze procedure. Amin: `dump:cloud` timed on his machine, disk encryption on every machine that will hold a dump (runbook 0 rule 5), time-zone check recorded in the dump check report (DT-1). | 28 Oct | `.cloud` operator, Amin | A confirmation line per item. |
| P9 | Switch method decided and rehearsed (open decision 8). If DNS is used, the time-to-live is lowered at least 24 h before. The switch-back path (section 6) is rehearsed too. | 28 Oct | AZ | Switch and switch-back durations. |
| P10 | **Notice to schools and users**: date and time window of the freeze, that `.cloud` is read-only during it, that everyone must sign in again and that roster accounts and accounts with a legacy password must set a new password (runbook 17 item 3), and where to get help. First notice at T-5 days (25 Oct), reminder on 29 Oct and a notice when the freeze starts and ends. Who sends it: **Perlu pengesahan** (open decision 6; proposal: Amin, who has the `.cloud` user channels). Wording is approved by the LEAD. | 25 Oct | Perlu pengesahan | The sent text and time. |
| P11 | Production smoke accounts exist in v2 (student, teacher, parent, admin; created in v2, not migrated; removed or kept by the LEAD's choice after the cutover) and the QA smoke list is fixed (runbook 17 item 2). | 28 Oct | QA | The account list (roles only) and the checklist. |
| P12 | People on call for the whole window and the rollback decision deadline, with a contact list kept outside the repo. Support is told to expect a spike in password-reset requests. | 29 Oct | LEAD | Names in the LEAD's own notes. |
| P13 | The LEAD approves the go for the T-1 load (A1). | 29 Oct | LEAD | A dated line in the issue. |

### 3.1 How the production `stage` step differs from the rehearsal

The rehearsal environment (`up`, `load-dump`, `stage`, `snapshot`, `restore-snapshot`) solves one problem: `staging:load` refuses a database whose name does not end in `_staging`, but `migrate:*` reads `staging_cloud` from the same database it writes to. `stage` loads into a separate `<db>_staging` database and copies the `staging_cloud` and `archive_cloud` schemas into the target with `pg_dump -Fc -n staging_cloud -n archive_cloud | pg_restore`, after dropping the old copies in the target. Production uses the same pattern:

1. A scratch database named `<production db>_staging` on the production server (or on a server half AZ names), never serving the API.
2. `staging:load --from <pp-staging-dump/1 directory>` there with `PP_ALLOW_STAGING_RESET=1` and `NODE_ENV` not `production` (the loader refuses production). No read-only PostgreSQL restore is involved on this route.
3. Copy the two schemas into the production target database; compare table counts (83 in `staging_cloud`, 35 in `archive_cloud`, runbook 12 step 1).
4. Drop the scratch database right after the copy (the copy in the target is the one kept, section 7).

Three points are **not** covered by the rehearsal script and need half AZ (who own deploys and the VPS):

- The script is built for anonymised data: `load-dump` refuses a dump without an anonymisation attestation, scans for personal data and drops a hit, and `exec` forces `NODE_ENV=development`. The cutover loads **real** data, and the ETL refuses anonymised or synthetic data when `NODE_ENV=production`. So the production step needs its own path for the raw dump directory (section 3.2), with `NODE_ENV=production` and `PP_MIGRATE_TARGET_DB` for `migrate:*`, and `NODE_ENV` not production for `staging:load` only.
- The production database platform is not decided (go-live checklist D-2: managed database or VPS; open decision 10). The restore-point mechanism in section 4 (template copy, `pg_dump -Fc` or platform PITR) depends on it. Perlu pengesahan.
- Role and server hardening for a server that holds real personal data of minors for the migration period (no superuser role, encrypted disk, WAL and backup handling in runbook 5).

### 3.2 Input format and the dump tools (AM-10)

- `.cloud` is MySQL. The ETL has no direct MySQL source (runbook 7 item 5). `staging:load` takes exactly one of: a `pp-staging-dump/1` directory (`--from`) or a read-only PostgreSQL restore.
- The tools that turn `.cloud` into `pp-staging-dump/1` are being built in AM-10 (AM1-3, in progress):
  - `dump:cloud`: raw export from a read-only MySQL account; the credentials come from a mode 600 option file outside the repo; one consistent snapshot; `DATETIME` values get `+08:00` (DT-1).
  - `dump:produce`: raw, then anonymise, then leak scan. Used for rehearsals only.
- **Production uses the raw `dump:cloud` output**, because the ETL refuses anonymised data in production. Rehearsals use `dump:produce` output, because the rehearsal environment refuses raw data.
- The exact flags and file names are **Perlu pengesahan (AM-10)**; this plan names none. The steps below say "export" for `dump:cloud`.
- `D_dump` in the duration formula (section 4.3) is the export time of `dump:cloud`. It is measured in P6, and again on the T-1 run (A2), where the real figure for the final export is known to within the data growth of one day.
- Custody is unchanged: Amin runs the export on his machine (OD-18 A, decided), the output is encrypted, handed over out of band, never in GitHub (runbook 0).

## 4. Timeline for 30 Oct

**Reference clock.** `T` = start of the `.cloud` freeze. Proposed default: **30 Oct 2026 01:00 MYT (29 Oct 17:00 UTC)**, chosen so the window ends before the school morning. This is for LEAD approval (open decision 1); traffic figures for `.cloud` are **Perlu pengesahan** (Amin can read them from the `.cloud` side). All later times below follow from that default. `T-1` = 29 Oct. First-load `--as-of` = **2026-10-29** (the MYT date of the first dump) and is reused in every later run. Date-dependent rules (for example subscription expiry) are therefore judged as of 29 Oct, one day before the go-live; this effect is accepted. `T-dump1` = the start time of the first dump, recorded in ISO 8601 with +08:00; it is the `--since` of the delta.

### 4.1 Steps

Commands are the `npm run <script> -w @pp/api -- <flags>` forms of runbook 12; secrets come from the secret store (P5). "Latest start" is the abort rule: if the step has not started by then, stop and apply section 6.

**Phase A: first load on production (T-1, 29 Oct, v2 not public, `.cloud` live)**

| Step | Start | Owner | Command or action | Expected duration | Evidence | Abort rule |
|---|---|---|---|---|---|---|
| A1 | 29 Oct 09:00 MYT (01:00 UTC) | LEAD | Confirms P1 to P12 and gives the go for the T-1 load. | 15 min | Dated line in the issue. | Any precondition unmet: no load; replan (section 6.5). |
| A2 | 09:15 (01:15) | Amin | Export (`dump:cloud`, raw; flags Perlu pengesahan (AM-10)) of live `.cloud` from the read-only account: one consistent snapshot, no freeze. Records `T-dump1` (snapshot start, ISO 8601, +08:00). Output: a `pp-staging-dump/1` directory. | `D_dump` (MIG-07) | `T-dump1`, manifest counts, checksum. | Dump not finished by 13:00 (05:00): no load today; the T-1 load can move to 30 Oct only by LEAD decision. |
| A3 | after A2 | Amin, AZ | Encrypted hand-over to the production host; sha256 check; custody list updated (runbook 0 rule 4). | `D_xfer` | Checksum match. | Mismatch: hand over again once; second mismatch: stop. |
| A4 | after A3 | AZ | Backup of the production database (`pg_dump -Fc` with checksum, PITR marker time) = restore point **`pre_etl`**. | `D_snap` | Backup name, size, PITR time. | No restore point: no apply. |
| A5 | after A4 | AZ | Production `stage` step (section 3.1): `staging:load --from <dump dir>`, copy of the two schemas into the target. | `D_load + D_copy` | Exit 0, table counts, counts against the manifest. | Exit 3 (source role could write) or 4: stop, report to the LEAD. |
| A6 | after A5 | AM | `staging:profile`; read orphan, duplicate and enum counts. | `D_profile` | Counts as text. | Unknown enum values that are not in the reviewed list: LEAD reads them before A7. |
| A7 | after A6 | AM | `NODE_ENV=production npm run migrate:all -w @pp/api -- --dry-run --as-of=2026-10-29` (production mode, so the synthetic-data guard fails early). On a first load only the **core** dry-run runs; the activity dry-run is skipped ("needs migrate:core --apply first"). | about `N_core / r` (4.3) | Exit 0, per-entity table for core, reject counts by reason. | Exit not 0, or the guard refuses: stop; the fix is a developer task, not an edit in production. |
| A8 | after A7 | LEAD | Reviews the **core** reject reasons of A7 against the thresholds of section 5. Activity rejects do not exist yet; they first appear at A9 and are read at A10. | 30 min | The reviewed list. | Over threshold or unexplained: no apply; replan. |
| A9 | after A8 | AM, AZ | `PP_ALLOW_MIGRATE_APPLY=1` and `PP_MIGRATE_TARGET_DB=<db>` with `NODE_ENV=production`: `migrate:all --apply --as-of=2026-10-29` (runs verify at the end). | about `2 x N / r` (4.3) | Exit 0, run ids, duration. | Latest start 16:00 (08:00 UTC). A failed stage stops the run (exit 1): section 6. |
| A10 | after A9 | AM, LEAD | `migrate:verify` is `pass`; the LEAD reads the **activity** reject reasons (first visible now) and the whole reject table against section 5, and accepts the ledger, correct-sum and drift rows (runbook 14 items 1 to 4). AZ then takes restore point **`pre_delta`** (the verified T-1 state). | 45 min | Status line, accepted lines, backup name. | Verify not `pass`, or rejects over the threshold: trigger R1. `.cloud` is not frozen yet, so there is no service impact; restore `pre_etl` (section 6.3) and replan. |
| A11 | 29 Oct 18:00 MYT (10:00 UTC) | LEAD | Go or no-go for the freeze: A10 green, P1 to P12 met, notice sent. After a go, the T-1 dump copy on the production host is deleted (runbook 0 rule 4: the load and reconciliation succeeded); Amin deletes his T-1 copy once the LEAD confirms. | 15 min | Dated go line. | No-go: `.cloud` is untouched, nothing to undo; replan. |

**Phase B: freeze window (T-0, 30 Oct)**

| Step | Start | Owner | Command or action | Expected duration | Evidence | Abort rule |
|---|---|---|---|---|---|---|
| B0 | T-60 min: 30 Oct 00:00 MYT (29 Oct 16:00 UTC) | LEAD, AZ | Pre-flight: people present; disk space free on the production host at least 5 times the dump size; last backup and PITR healthy; `pre_delta` is still current (v2 has had no writes since A10: table counts equal). The LEAD says "go freeze". | 30 min | Counts equal, backup time. | Anything red: do not freeze. |
| B1 | **T+0:00 = 01:00 MYT (17:00 UTC)** | `.cloud` operator | Switches `.cloud` to read-only or maintenance mode and proves no write happens after it (his procedure, P8). Records `T-freeze`. | 15 min | Timestamp and his confirmation line. | Not confirmed by T+0:20: lift the freeze, stop (nothing changed in v2). |
| B2 | T+0:20 = 01:20 (17:20) | Amin | Final export (`dump:cloud`, raw; flags Perlu pengesahan (AM-10)). Records `T-dump-final`. | `D_dump` (= `D_dump_final`) | Timestamp, manifest, checksum. | Latest finish T+1:10 (02:10 MYT, 18:10 UTC): else section 6 trigger R2. |
| B3 | after B2 | Amin, AZ | Encrypted hand-over and sha256 check. | `D_xfer` | Checksum match. | As A3. |
| B4 | after B3 | AZ | Production `stage` step with the final dump (replaces `staging_cloud` and `archive_cloud` in the target). | `D_load + D_copy` | Exit 0, counts against the manifest. | Latest finish T+1:45 (02:45, 18:45 UTC). |
| B5 | after B4 | AM | Delta dry-run: `NODE_ENV=production npm run migrate:delta -w @pp/api -- --since=<T-dump1> --as-of=2026-10-29` (production mode, so the synthetic-data guard fails early). The activity stage may show "skipped" (runbook 15, notes). Optional: skipped if the LEAD chose to drop it (open decision 13). | `D_dry` | Exit 0, delta report. | Exit not 0: section 6. |
| B6 | after B5 | AM, AZ | Delta apply: `PP_ALLOW_MIGRATE_APPLY=1` and `PP_MIGRATE_TARGET_DB=<db>`, `NODE_ENV=production`: `migrate:delta --since=<T-dump1> --as-of=2026-10-29 --apply`. | `D_apply` | Exit 0, duration, inserted, updated and unchanged per entity. | Latest start T+2:15 (03:15, 19:15 UTC). |
| B7 | after B6 | AM, QA | Read `migrate:verify` (run by the delta; repeat if wanted). Read-only smoke on the production target before the switch: health and ready endpoints and a few read-only calls, no writes. Send the numbers to the LEAD as text. | `D_verify` + 10 min | Status, entity and check counts, reject counts by reason. | Verify not `pass`: no-go. |
| B8 | **T+3:00 = 04:00 MYT (20:00 UTC) at the latest** | LEAD | Go/no-go (section 5). | 15 min | The decision line with the criteria table. | No decision by T+3:00 is a no-go. |
| B9 | after a go | AZ | Switch (section 4.4). | `D_switch` | Timestamp of the switch. | Switch not complete by **T+4:00 = 05:00 MYT (21:00 UTC)**: the window is over; section 6 trigger R3. |
| B10 | after B9 | QA, AM | Smoke (G5): runbook 17 item 2, the conformance suite, a roster account and a self-registered account reaching the first-login flow. | 30 min | Pass or fail per check. | A failed check is trigger R4 (section 6). |
| B11 | after B10 | `.cloud` operator, LEAD | `.cloud` stays read-only, never written again (D28a). Notice "v2 is live" is sent. The window is closed; hypercare starts. | 15 min | Timestamp. | |
| B12 | later, optional | AM | `migrate:link-questions` dry-run, then `--apply` (runbook 12). Cutover never waits for it. | | Linked, ambiguous and unmatched counts. | |

### 4.2 Why the freeze includes nearly a full pass

The delta is a re-run of core and activity on the whole fresh dump (runbook 15; deviation from backend plan 14.5 item 4). It reads and transforms every row; only unchanged rows are skipped when writing (by `legacy_hash`). So the delta takes close to a full run, not a few minutes. The delta apply itself runs a dry-run and an apply for each of the two stages, and B5 adds a standalone dry-run. These figures must come from MIG-07 item 18, not from a guess.

### 4.3 Duration budget

Formula for the freeze window `W` (from B1 to the end of the switch):

```
W = (T_B0_to_B1 handshake)
  + D_dump + D_xfer + D_load + D_copy        (D_dump = D_dump_final, the export time of section 3.2)
  + D_dry + D_apply + D_verify
  + D_gonogo (15 min) + D_switch
  + buffer (25 % of the sum)
D_dry   ~ N_core / r_dry
D_apply ~ 2 x N / r_apply          (core and activity, each a dry-run plus an apply)
```

`N` = number of source rows the ETL reads (known from the first dump profile, AM-10, and the manifest counts of A2). `r` = rows per second. The only measured rate today is **3,611 rows/s** (AM-08, AC7, 1M rows, synthetic data, laptop-class VM). Real data, the production disk and the network will differ. **Use 3,611 only as a placeholder; replace it with the MIG-07 and P6 figures.** Unchanged rows are not written, so `r_apply` on a delta may be higher than the first-load rate. Do not assume it.

| Item | Source of the figure | Placeholder |
|---|---|---|
| `D_dump` (= `D_dump_final`, the `dump:cloud` export time), `D_xfer` | Amin's timed export (P6, P8, MIG-07) | `<min>` |
| `D_load`, `D_copy` | MIG-07 `timings.log` (`stage-copy` and the loader) | `<min>` |
| `D_dry`, `D_apply`, `D_verify` | MIG-07 checklist item 18 | `<min>` |
| `D_switch` | P9 rehearsal | `<min>` |
| Restore time | MIG-07 item 19 and P6 | `<min>` |

Illustration of the ETL part only, at the placeholder rate (these row counts are examples, not observed counts):

| `N` rows | One pass `N / 3,611` | Three passes (B5 and B6 together, worst case) |
|---|---|---|
| 1,000,000 | about 4.6 min | about 14 min |
| 5,000,000 | about 23 min | about 69 min |
| 10,000,000 | about 46 min | about 139 min |

Rule (P7): the computed `W` must be at most the maximum window. **Proposed maximum window: 4 hours** (T+0:00 to the switch done at T+4:00; B1 to B9), with the go/no-go at T+3:00 at the latest. If `W` does not fit, the LEAD decides before the freeze is announced (P7). The window cannot be shortened by editing the ETL on the night.

### 4.4 The switch (B9)

How v2 starts to serve users is **Perlu pengesahan** (open decision 8). Two options, both done by half AZ with the `.cloud` operator:

- **A (proposed):** v2 is published under its own address by half AZ; the `.cloud` operator leaves `.cloud` read-only and shows a maintenance page that points to v2. No change to the `.cloud` application code or data; the pointer page is the `.cloud` operator's own operational change.
- **B:** DNS or edge routing moves the `.cloud` address to v2. Needs a lowered time-to-live (P9) and the switch-back path to be rehearsed; the old address can no longer show `.cloud` read-only for reference during that time.

Either way: sessions are not migrated (everyone signs in again), the switch is one recorded timestamp, and the switch-back is a recorded action of the same size.

## 5. Go/no-go criteria

These are runbook 14 made final. They are checked at the decision point (B8); the earlier T-1 check (A8, A10) applies the same table to the first load. All must hold. A criterion with no evidence counts as not met. **The LEAD decides.** The LEAD may waive a criterion only in writing in the issue, with the reason (runbook 14).

| # | Criterion | Measure (final) | Evidence |
|---|---|---|---|
| 1 | Verification | `migrate:verify` status is `pass`: every entity `ok`, no check `mismatch`. | Status line, entity and check counts. |
| 2 | Rejects reviewed and inside the threshold (**proposed**, open decision 4) | Every reason (`UNKNOWN_ENUM`, `ORPHAN_PARENT`, `DUPLICATE_KEY`, `INVALID_VALUE`, `UNSUPPORTED`) per entity is listed and explained. Rejected rows at most **0.1 %** of source rows for `users` and `schools` and at most **0.5 %** per other entity. Rejected users are listed by surrogate id (each has no login until fixed; the duplicate caveat in MIG-03 Q2). | The list of reason and count, as text. |
| 3 | No lost users or schools | `ORPHAN_PARENT` rejects on `users` and `schools` are **0**. | The count. |
| 4 | Orphan scan | The v2-side foreign key scan reports **0**. | The count. |
| 5 | Delta consistent | For each entity with `updated_at`, inserted plus updated from the delta is within **5 % or 100 rows** (whichever is larger) of the number of staged rows with `updated_at` after `T-dump1`, or the gap is explained in writing (aggregation steps explain some). Rows loaded by the delta are not zero when `.cloud` was written to between the two dumps. | The delta report next to the run counters. |
| 6 | Ledger and drift accepted | Each ledger-sum, correct-sum and accepted-drift row is read and accepted; nothing was corrected to make totals agree. | One accepted line per row. |
| 7 | Timings in the window | At the decision point the elapsed time is at most T+3:00, and the measured durations leave the switch and the smoke inside T+4:30 (switch done by T+4:00, smoke 30 min). | Elapsed time and durations. |
| 8 | Backups before the apply | Restore points `pre_etl` (A4) and `pre_delta` (A10) exist, and a restore of a restore point has been proven in P6; PITR is on; the backup is newer than the last write to the production target. | Backup names and times. |
| 9 | Smoke | **Before the switch:** the read-only smoke on the production target (B7) passes (health, ready, sampled reads; no writes). The full conformance suite (`apps/api/test/conformance`) and e2e smoke passed in P6 against a restored copy of the target (runbook 14 item 8 is applied on the copy, because those suites write data). **After the switch:** the read-only smoke list of runbook 17 item 2 (B10). | The real tail of the P6 test output; the B7 and B10 results. |
| 10 | Rollback ready | The switch-back, the unfreeze and the restore steps of section 6 are rehearsed (P6, P9) with durations; the people are present. | The rehearsal timings. |
| 11 | Housekeeping plan | Dates for the deletions of section 7 are written. | The dated plan. |

Any "no" is a no-go: section 6.

## 6. Rollback

### 6.1 Triggers (each measurable)

| ID | Trigger | When |
|---|---|---|
| R1 | A stage of `migrate:all` or `migrate:delta` exits not 0, or `migrate:verify` is not `pass`, or the orphan scan is above 0. | Any time before the switch |
| R2 | A step misses its latest start or finish in section 4.1, or the projected end passes T+4:00. | Any time before the switch |
| R3 | The switch is not complete by T+4:00. | B9 |
| R4 | A smoke check fails: health endpoint not green, a role cannot sign in with its own account, dashboards empty for a sampled account, wallet sample not matching the reported ledger rows. | After the switch |
| R5 | Support or monitoring shows a wrong-data pattern (the same wrong figure for many accounts), or the 5xx rate stays above 2 % of requests for 10 minutes (proposed, open decision 11). | After the switch |
| R6 | A suspected PDPA incident touches the loaded data or a dump (runbook 0 rule 8). Report to the LEAD at once. | Any time |

### 6.2 Decision deadline (point of no return)

- **Before the switch:** the LEAD can stop at any step; nothing user-visible has changed except the `.cloud` freeze.
- **After the switch:** the LEAD may still roll back until **switch time + 4 hours** (proposed; with a 05:00 MYT switch that is 09:00 MYT, 01:00 UTC). After that v2 is the system of record and problems are fixed forward. Risk for the LEAD: the longer v2 is live, the more data exists only in v2, and a 09:00 MYT deadline runs into the school morning, when traffic is likely highest. A shorter deadline loses less data but leaves less time to find a problem. The LEAD chooses (open decision 3).

### 6.3 Procedure

**Before the switch (v2 not public).** Service is not at risk, only the freeze lasts.

1. **The `.cloud` operator lifts the freeze** (`.cloud` returns to normal service and writes). This is the first and the only urgent action; it does not wait for the v2 clean-up. Communicate: "maintenance extended, no data lost" (6.5).
2. v2 clean-up, by the LEAD's choice, in order of preference:
   - **R-a: restore `pre_delta`** (the verified T-1 state; AZ). Keeps the T-1 load; a new attempt needs only a new final dump and a new delta.
   - **R-b: restore `pre_etl`**, or run `migrate:rollback` (runbook 16, Procedure B: the production database holds v2-born rows such as staff and smoke accounts, so Procedure A, dropping the database, is not used). Both the dry-run and the apply need `PP_ALLOW_MIGRATE_APPLY=1` and, in production, `PP_MIGRATE_TARGET_DB=<db>`; `--confirm=<db>` must equal the database name. Dry-run first, then `--apply`. It refuses (exit 2 or 4, no change) while an apply run is `running` in `etl_runs`: confirm no load is active, mark that run `failed`, then retry. A refusal because a v2-born row references a migrated row also changes nothing; the LEAD decides.
3. After a `migrate:rollback`, re-run the idempotent seeds (`npm run be:db:seed`) to restore adopted seed rows. Prove the result as runbook 16 says: per-table counts equal the snapshot, `legacy_source = 'cloud'` counts are 0. Do not run `migrate:verify` after a rollback.
3a. Before any new apply, run a fresh dry-run; the earlier dry-run no longer counts (runbook 16; the apply gate needs a passing dry-run on the same input).
4. `staging_cloud` stays for at most 7 days (section 7).

**After the switch (R4 to R6, within the deadline).**

1. AZ takes a **`post_switch` backup** of the v2 database first (so the v2 data is kept for analysis whatever happens next), then switches back (section 4.4, same size as the switch). The `.cloud` operator lifts the `.cloud` freeze (`.cloud` was kept intact and read-only, so its data is as it was at `T-freeze`).
2. Stop v2 writes (maintenance page on v2) so the v2 data is kept as it is for analysis; do not delete it.
3. **What is lost, honestly:** anything written in v2 after the switch (registrations, practice, password resets, new content) is not in `.cloud`. There is no reverse migration, none is planned in this plan, and any such data is lost or must be re-entered by hand. Users who set a new password in v2 will use the old one again in `.cloud`. The LEAD accepts this risk when choosing the deadline (section 6.2).
4. A later retry needs a fresh decision: v2 now holds v2-born rows, so `migrate:rollback` may refuse (6.3 R-b). The LEAD decides between a clean database restore (`pre_etl`, losing the v2-born rows) and another delta on top.

### 6.4 Timings

Restore and switch-back durations come from MIG-07 and P6 (placeholders: restore `<min>`, switch back `<min>`, unfreeze `<min>`). Service is back for users at the end of the unfreeze (before the switch) or of the switch-back plus the unfreeze (after the switch). Both are recorded in P6 and written next to the go/no-go line.

### 6.5 Communication

| When | Message | By |
|---|---|---|
| Freeze extended or cutover aborted | "The maintenance window is extended or cancelled; `.cloud` is available again; no data is lost; a new date will be given." | Who sends notices (open decision 6), text approved by the LEAD |
| Rollback after the switch | Same plus "anything done in the new system after <time> is not kept; please repeat it." | Same |
| Replan after an abort | New date and window; a new T-1 load is not needed if `pre_delta` was restored and `--as-of` and `IC_HASH_KEY` are unchanged; any change to either means a clean start. | LEAD |

Write the decision, the trigger id, the times and the counts as text in the issue (no data).

## 7. After cutover

Retention follows the MIG-03 decisions (LEAD, all defaults, 21 Oct 2026) and runbook 0, 17 and 18. Dates are computed from a cutover on 30 Oct 2026; if the switch is later, the dates move with it.

| Item | Rule | Owner | Date |
|---|---|---|---|
| Raw dumps (T-1 copy on the host, final dump, the encrypted archive, every copy handed out), anonymised copies, key file, `pp_staging_reader` role | Deleted as soon as the load and reconciliation succeed, in any case within 7 days. The T-1 copies go at A11; the final copies after the cutover sign-off. | Amin (his copies), AZ (production host), LEAD (custodian, confirms) | Final copies: after B7 sign-off, at the latest **6 Nov 2026** |
| `staging_cloud` schema | `drop schema staging_cloud cascade;` Kept only as the input for a rollback retry. | AZ | **At the latest 6 Nov 2026** |
| Question report export file (`.migration-out/`, from `migrate:export-question-reports`) | Deleted with `staging_cloud`: at hand-over or 7 days after the cutover, whichever is first. The LEAD records the deletion date as text in the issue. | AM operator, LEAD confirms | **At the latest 6 Nov 2026** |
| Scratch `<db>_staging` database | Dropped right after the stage copy (section 3.1). | AZ | 30 Oct 2026 |
| WAL, base backups, snapshots and replicas of the server that held the dump; temp and spill files; shell history with a URL | Checked and cleared (runbook 5 items 3 and 4, runbook 18). The restore points `pre_etl`, `pre_delta` and `post_switch` hold real data and follow the same 7-day rule. | AZ | At the latest 6 Nov 2026 |
| `archive_cloud` | **Kept 12 months, all archive tables** (Q12 A). Read-only, not served by the API. Roster JSON files are purged. Deleted by `drop schema archive_cloud cascade;` with the LEAD's confirmation. | AZ (executes), LEAD (approves) | **On or after 30 Oct 2027** (a dated reminder is set at cutover) |
| Open question reports | Open reports are exported with `migrate:export-question-reports` (added in #123) after the final verify; it writes a mode 0600 CSV under `.migration-out/` (Q9 A). It holds raw reporter free text from minors (the `reason` is redacted for e-mail, phone and IC and capped; `created_at` is a date only): custody like a dump (encrypted, out of band, never in GitHub). **Deleted at hand-over or after 7 days, whichever comes first**, the same deadline as `staging_cloud`. Closed reports are **not** exported: they stay in `archive_cloud` for 12 months (Q12 A). Recipient: open decision 12. | AM exports, LEAD hands over and confirms deletion | Hand-over by 6 Nov 2026; file deleted at hand-over, at the latest **6 Nov 2026** |
| `etl_runs`, `etl_recon`, `etl_rejects`, `etl_checkpoints`, `etl_id_map` | Kept with the database (audit trail and later backfill). `etl_id_map` is not deleted. | AZ | Standing |
| Recon report and profiles (`.migration-out/`) | Aggregates and surrogate ids only; kept in the LEAD's encrypted storage until both the rehearsal and the cutover sign-offs are done, at most 30 days; numbers go into the issue as text; never in GitHub (runbook 17 item 1, 18). | LEAD | At the latest 29 Nov 2026 |
| `.cloud` | Stays read-only for reference; never written again. Its end of life is the `.cloud` owner's decision, outside this plan. | `.cloud` operator | n/a |

**Hypercare (30 Oct to 6 Nov).** Daily: health and readiness endpoints, error rate, the number of password-reset requests (expected spike, runbook 17 item 3), support questions about streak, mastery or ranking changes (accepted drift, runbook 17 item 4), one repeat of the smoke list. `migrate:link-questions` may run at any time after the cutover.

**Sign-off record.** The LEAD writes this one line in the issue (no data, no names beyond the handles) when the final dump copies are deleted and `staging_cloud` is dropped:

```
Cutover <date>: freeze <T-freeze> MYT (<UTC>), final dump <T-dump-final>, switch <time>,
window used <h:mm> of <h:mm>, verify <status>, rejects <n> (reasons reviewed), go/no-go <decision> by azarulhakim,
rollback needed <no | trigger id>, dumps and key deleted <date>, staging_cloud dropped <date>,
archive_cloud kept until <date>, recon report deleted <date>. Signed: azarulhakim.
```

## 8. Open decisions for the LEAD

Each item is answerable in one word; `default` accepts the proposal, and `all defaults` accepts every proposal. Already decided and therefore not asked: the dump operator is Amin and the LEAD approves (OD-18 A); production loads use real, not anonymised, data (the ETL refuses anonymised data in production); `.cloud` DATETIME is +08:00 (DT-1 A).

1. **Freeze start (T).** Default: 30 Oct 2026 01:00 MYT (29 Oct 17:00 UTC). Answer: a time, or `default`.
2. **Maximum freeze window.** Default: 4 hours (go/no-go by T+3:00, switch done by T+4:00). Answer: hours, or `default`.
3. **Point of no return after the switch.** Default: switch + 4 hours. Risk: with a 05:00 MYT switch the deadline is 09:00 MYT, in the school morning. Answer: hours, or `default`.
4. **Reject threshold.** Default: `ORPHAN_PARENT` on users and schools = 0; rejects at most 0.1 % for users and schools and 0.5 % for every other entity; every reason explained. Answer: `default` or new numbers.
5. **Who freezes and unfreezes `.cloud`.** A (default): Amin, who holds the read-only server access (OD-18 operator). B: the `.cloud` system owner, via Amin. The team never changes `.cloud` code or data. Answer: A or B.
6. **Who sends the notice to schools and users.** Default: Amin, text approved by the LEAD. Answer: `Amin`, `LEAD`, or another handle.
7. **Who types the production commands (`migrate:*`).** Default: the half AM migration operator, with half AZ DevOps on the host (credentials stay with humans and the secret store). Answer: `default` or another arrangement.
8. **How the switch is done.** A (default): v2 on its own address plus a pointer page on `.cloud`. B: DNS or edge routing moves the old address to v2. Answer: A or B.
9. **First load on production at T-1 (A, default)** with the delta inside the freeze, or **B** one full fresh load inside the freeze (no T-1; longer window, fewer steps). Answer: A or B.
10. **Production database platform (go-live checklist D-2).** Default: VPS (half AZ owns it), with restore points `pre_etl`, `pre_delta`, `post_switch` as `pg_dump -Fc` plus PITR. Answer: `VPS`, `managed`, or `default`.
11. **Post-switch 5xx rollback trigger (R5).** Default: 5xx above 2 % of requests for 10 minutes. Answer: `default` or a number.
12. **Recipient of the open question report export (Q9 A).** Default: the LEAD receives it and passes it to the content team. Answer: `LEAD` or a handle.
13. **Standalone delta dry-run (B5) inside the window.** Default: keep it; drop it only if P7 shows the window does not fit. Answer: `keep` or `drop`.
