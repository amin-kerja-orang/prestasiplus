# v2 cutover plan: .cloud to v2, go-live 30 Oct 2026 (MIG-08)

- **Status:** proposal for LEAD approval. Open decisions are in section 8. Nothing here has been run.
- **Slug:** `v2-cutover-plan`. **Item:** MIG-08 (P0). Docs only.
- **Builds on:** [migration runbook](../architecture/v2-migration-runbook.md) sections 0 to 18 (sections 12 to 18 arrive with PR #123; until it is merged they exist only on that branch), [data migration design](../architecture/v2-data-migration.md) (risk "Cutover", section 5; load order, section 6.1), [backend plan](../architecture/v2-backend-plan.md) sections 14.5 to 14.8, [backup and restore drill](db-backup.md), [go-live checklist](go-live-bijak-spm.md), and the roles in [AGENT-SYNC](../plan/AGENT-SYNC.md) ("Halves"). It also uses the LEAD's "all defaults" answers on the MIG-03 decisions of 21 Oct 2026 (PR #114), the half AZ rehearsal environment (PR #117: `docs/ops/rehearsal-db.md` and `deploy/rehearsal/rehearsal-db.sh`), and the AM-10 dump tools and procedure (PR #125: `docs/ops/cloud-dump-procedure.md`, `dump:check`, `dump:cloud`, `dump:produce`, `dump:wipe`, `dump:grants`).
- **Time convention:** every time is Malaysia time (MYT, UTC+8) with UTC in brackets. `.cloud` `DATETIME` values are read as +08:00 (decision DT-1 A).
- **Marker:** "Perlu pengesahan" means not decided yet; it is to be confirmed by the person named, or by the LEAD.

This plan does not repeat the runbook. Where it says "runbook 14", read section 14 of the migration runbook.

## 1. Purpose and scope

**Purpose.** Move the user data of the old system `.cloud` (MySQL) into the v2 backend (PostgreSQL 16) with a short, rehearsed freeze of `.cloud` writes, so v2 goes live for Bijak SPM on **30 Oct 2026** with the existing users, schools, classes and history, and so the go-live can be stopped or reversed on measurable triggers.

**What moves.** The entities in the load order of data-migration 6.1 and the matrix in backend plan 14.7, loaded by `migrate:all` (first load, T-1) and `migrate:delta` (final catch-up, inside the freeze). Question-bound working state, structured and exam answers, and the other items decided in MIG-03 are dropped or archived as decided there. Streak, mastery and rankings are recomputed and differ by design (runbook 17).

**What never happens.**

- `.cloud` is never modified by the team. The `.cloud` owner (who that is: open decision 5) only switches it to read-only or maintenance mode and back. This is an operational switch with no change to its code or data (decision D28a). No agent session has access to `.cloud` or holds its credentials.
- `prestasiplus.my` is not touched and is not a source (`staging_my` stays an empty extension point).
- No dump, report or secret goes into the repo, a PR, an issue, chat or a CI artifact (runbook 0).
- Nothing in this plan is executed without the LEAD's explicit confirmation. The production deploy needs the LEAD's approval (gate G6).

## 2. Roles (RACI)

R = does it, A = accountable (one per row), C = consulted, I = informed.

| Role | Who | Responsibility in the cutover |
|---|---|---|
| LEAD | `azarulhakim` | Go/no-go and rollback decisions, merges, approves the production deploy, approves each hand-over, receives the deletion confirmations. |
| `.cloud` owner (AM-10 calls this role "data owner") | **Perlu pengesahan** (open decision 5). Default: the person who administers the `.cloud` database and application. Alternative: Amin (`aminfaudzi`) | Switches `.cloud` to read-only or maintenance mode and lifts it again (also on an abort); proves no write happens after the freeze. Creates the read-only MySQL account `pp_dump_ro`, **unlocks it for each sitting and locks it straight after**, drops it at clean-up (AM-10 procedure, section 2 item 5 and section 4). Does not change `.cloud` code or data. A read-only grant cannot put `.cloud` into maintenance, which is why this role is not the dump operator by default. |
| Dump operator | Amin (`aminfaudzi`), decided (OD-18 A); the LEAD approves | Runs `dump:check` and `dump:cloud` on his machine, encrypts, hands over, wipes his copy (section 3.3). Runs `.cloud` side communication if the LEAD agrees (open decision 6). |
| Half AZ DevOps | half AZ | Production database and VPS, the throwaway staging cluster (section 3.1), backups and PITR, restore points, the production `stage` step, deploys, DNS or app switch, monitoring. |
| Half AM migration operator | half AM | Runs `staging:profile` and `migrate:*` against the production target, reads and reports the verify output and rejects, runs the SQL checks of section 4.5. Who types the commands is **Perlu pengesahan** (open decision 7; proposed: the half AM migration operator with half AZ DevOps on the host); the production credentials stay with a human and in the platform secret store, never with an agent. |
| QA | half AZ (G5 owner) | Smoke after the switch (section 4.5) and the conformance suite on the copy (P6). |
| Night deputies | **Perlu pengesahan** (open decision 16) | One named deputy each for the `.cloud` owner, the dump operator and half AZ DevOps for the two night sittings (29 Oct 01:00 and 30 Oct 01:00 MYT). |

| Step | LEAD | Dump op. (Amin) | `.cloud` owner | AZ DevOps | AM operator | QA |
|---|---|---|---|---|---|---|
| Approve this plan, window and thresholds | A/R | C | C | C | C | I |
| Preconditions (section 3) | A | R (his items) | R (his items) | R | R | C |
| Unlock and lock `pp_dump_ro` per sitting; drop it at clean-up | I | C | A/R | | | |
| First dump (T-1) and final dump (`dump:cloud`) | A (approves) | R | C | I | I | I |
| Encrypted hand-over, checksum, wipe of the operator copy | I | A/R (sender) | | R (receiver) | I | |
| Restore points and backups | I | | | A/R | C | |
| Production `stage` step | I | | | A/R | C | |
| `migrate:all`, `migrate:delta`, `migrate:verify` | I | | | C (guards, env) | A/R | |
| Source-delete check and freeze proof (B4, B5) | A | | C | C | R | |
| Freeze and unfreeze `.cloud` | A (asks) | C | R | | | |
| Go/no-go at the decision point | A/R | C | C | C | C (reads verify) | C |
| Switch to v2 | A (approves) | | C | R | C | I |
| Smoke (G5) | A | | | C | R (SQL checks) | R (sign-in checks) |
| Rollback | A/R (decides) | | R (unfreeze) | R (restore, switch back) | R (rollback command) | I |
| Notice to schools and users | A | **Perlu pengesahan** (open decision 6) | | | | |
| Deletion of dumps, credentials and reports (section 7) | A/R (custodian) | R (his copies, option file, check reports) | R (drops the account) | R (production host, backups) | R (reports) | |

## 3. Preconditions (T-5 days to T-1)

All must be met and evidenced as text before the freeze is announced as "go". A precondition with no evidence counts as not met. The LEAD checks the list at the end of 29 Oct (step A13 in section 4).

| # | Precondition | Due | Owner | Evidence |
|---|---|---|---|---|
| P1 | **MIG-07 rehearsal green** (D61: before 25 Oct) with timings for: export (`dump:produce`, of which the `dump:cloud` part), encrypt and hand-over, `staging:load`, stage copy, `migrate:all --apply`, `migrate:verify`, delta dry-run and apply (runbook 13 item 18), `migrate:rollback` (item 19), restore of a snapshot. Runbook 14 met on the rehearsal. | 25 Oct | AZ, AM | The timing figures and exit codes as text. |
| P2 | PRs **#122** (AM-08, ETL throughput), **#123** (AM-09, orchestration) and **#125** (AM-10, dump tools) merged by the LEAD. The git sha the rehearsal ran is the release sha, or the rehearsal is repeated after any ETL change. | 25 Oct | LEAD | The shas. |
| P3 | Production database migrated to the tip with `prisma migrate deploy`; applied migrations equal the number of folders; `/api/ready` reports migrations applied; v2 is **not public** yet. | 27 Oct | AZ | The counts. |
| P4 | Backups and PITR on for the production database; a restore drill passed on it ([db-backup](db-backup.md)). A backup that has not passed a restore check is not trusted. | 27 Oct | AZ | Drill result, backup timestamp. |
| P5 | Secrets in the platform secret store, never in the repo: `DATABASE_URL`, `IC_HASH_KEY` (one value for T-1 and the delta, **kept for the life of the system and never deleted**, unlike the anonymiser key; a copy kept by the LEAD, because a different key changes IC hashes), `PP_MIGRATE_TARGET_DB`, `PP_ALLOW_MIGRATE_APPLY` and, for a rollback, `PP_ALLOW_MIGRATE_ROLLBACK` (name to be confirmed on the final #123), each set per run only, not permanently. CI tokens have no production access. Production uses **no anonymiser key**. | 27 Oct | AZ, LEAD | A confirmation line per name (no value). |
| P6 | **Production `stage` step ready** (section 3.1) and **a rehearsal of the whole final procedure end to end on a fresh copy**: the dump path of section 3.3 (the rehearsal uses `dump:produce` because the rehearsal environment refuses raw data; the `dump:cloud` part is timed on its own), encrypted hand-over and checksum, throwaway staging cluster up and torn down, `staging:load`, stage copy, T-1 load, freeze simulation, final-dump path, source-delete check, delta dry-run and apply, verify, rollback, restore-point restore. The production guard is exercised once with a synthetic fixture: `NODE_ENV=production PP_MIGRATE_TARGET_DB=<db> PP_ALLOW_MIGRATE_APPLY=1 ... --apply` is accepted, and refused without `PP_MIGRATE_TARGET_DB` (rehearsal-db recipe). The full conformance suite and e2e smoke run here against a restored **copy** of the target, never against production. Every duration recorded. | 28 Oct | AZ, AM, Amin | Timings against section 4.3; test output tail. |
| P7 | **Window budget computed** (section 4.3) from P1 and P6 and within the maximum window. If not, the LEAD decides on 28 Oct: widen the window, drop the standalone delta dry-run, or move the date. | 28 Oct | AM | The sum and the margin. |
| P8 | `.cloud` owner: written freeze procedure (how `.cloud` is made read-only and how he proves no write happens after it) and unfreeze procedure; the read-only account `pp_dump_ro` exists with the grants generated by `dump:grants` (column-level preferred; the table-level fallback is an open LEAD item in AM-10) and is locked; a current read replica for the T-1 export exists or not (AM-10 section 2 item 5; **Perlu pengesahan**). Amin: `dump:check` run and "rules OK" received, `dump:cloud` timed, disk encryption on every machine that will hold a dump (runbook 0 rule 5), mysql client and gpg installed, time-zone line of the check report matches DT-1. | 28 Oct | `.cloud` owner, Amin | A confirmation line per item; the `dump:check` verdict (aggregates). |
| P9 | Switch method decided and rehearsed (open decision 8). If DNS is used, the time-to-live is lowered at least 24 h before. The switch-back path (section 6) is rehearsed too. | 28 Oct | AZ | Switch and switch-back durations. |
| P10 | **Notice to schools and users**: the freeze window stated as approximate (for example "from about 01:00 to about 05:00 MYT"; the final times come from the P1 rehearsal timings and are confirmed in the 29 Oct reminder), that `.cloud` is read-only during it, that everyone must sign in again and that roster accounts and accounts with a legacy password must set a new password (runbook 17 item 3), and where to get help. First notice at T-5 days (25 Oct), reminder on 29 Oct and a notice when the freeze starts and ends. Who sends it: **Perlu pengesahan** (open decision 6; proposal: Amin, who has the `.cloud` user channels). Wording is approved by the LEAD. | 25 Oct | Perlu pengesahan | The sent text and time. |
| P11 | Production smoke accounts exist in v2 (student, teacher, parent, admin; **created in v2, not migrated**; used for sign-in checks only; kept or removed by the LEAD's choice after the cutover) and the smoke list of section 4.5 is fixed. | 28 Oct | QA | The account list (roles only) and the checklist. |
| P12 | People on call for the whole window and the rollback decision deadline, including the two night sittings and the named deputies (open decision 16), with a contact list kept outside the repo. Support is told to expect a spike in password-reset requests. | 28 Oct | LEAD | Names in the LEAD's own notes. |
| P13 | The LEAD approves the go for the T-1 load (A1). | 28 Oct | LEAD | A dated line in the issue. |

### 3.1 How the production `stage` step differs from the rehearsal

The rehearsal environment (`up`, `load-dump`, `stage`, `snapshot`, `restore-snapshot`) solves one problem: `staging:load` refuses a database whose name does not end in `_staging`, but `migrate:*` reads `staging_cloud` from the same database it writes to. `stage` loads into a separate `<db>_staging` database and copies the `staging_cloud` and `archive_cloud` schemas into the target with `pg_dump -Fc -n staging_cloud -n archive_cloud | pg_restore`, after dropping the old copies in the target. Production uses the same pattern, with one change forced by retention (below):

1. **A throwaway PostgreSQL 16 server or cluster** (open decision 14, default): its own data directory on an encrypted volume, no WAL archiving, no PITR, no backups, no replicas, never serving the API, named so its database ends in `_staging`. It is created empty before each load and destroyed with its volume right after the copy in step 3.
2. `staging:load --from <pp-staging-dump/1 directory>` there with `PP_ALLOW_STAGING_RESET=1` and `NODE_ENV` not `production` (the loader refuses production). No read-only PostgreSQL restore is involved on this route.
3. Copy the two schemas from the throwaway cluster into the production target database over verified TLS; compare table counts (83 in `staging_cloud`, 35 in `archive_cloud`, runbook 12 step 1).
4. Destroy the throwaway cluster and its volume; delete the `.gpg` file, the extracted dump directory and the passphrase as soon as the load has succeeded (do not wait for the 7 days).

**Why a separate cluster.** The target must hold `staging_cloud` while `migrate:*` runs, so a raw copy of the `.cloud` data sits inside the production database from the copy until the drop (section 7). Every backup and WAL segment taken in that period contains it. Loading in the throwaway cluster at least keeps the loader's work, temp files and WAL (the biggest and longest-lived copies) off the production server, and leaves only the one copy in the target, whose life is capped in section 7. Option B of open decision 14 stages inside a `_staging` database on the production server instead; then that database's WAL and backups join the explicit deletion list too.

**Production mode is never rehearsed end to end.** The rehearsal environment forces `NODE_ENV=development` for `exec` and the loads, and the ETL refuses anonymised or synthetic data when `NODE_ENV=production`. So the first run of `migrate:*` in production mode on real data is step A7. Two measures lower the risk: P6 exercises the `PP_MIGRATE_TARGET_DB` guard with a synthetic fixture, and step A11 runs an idempotent `migrate:delta` dry-run and apply on production against the T-1 stage, expecting every row `unchanged`. It also measures the real rate `r` before the freeze.

Points **not** covered by the rehearsal script that need half AZ (who own deploys and the VPS):

- The script is built for anonymised data: `load-dump` refuses a dump without an anonymisation attestation, scans for personal data and drops a hit. The cutover loads **real** data from a raw `pp-staging-dump/1` directory (section 3.3), with `NODE_ENV=production` and `PP_MIGRATE_TARGET_DB` for `migrate:*`, and `NODE_ENV` not production for `staging:load` only.
- The production database platform is not decided (go-live checklist D-2: managed database or VPS; open decision 10). The restore-point and backup-deletion mechanics in sections 4 and 7 (template copy, `pg_dump -Fc`, platform PITR and WAL retention) depend on it. Perlu pengesahan.
- Role and server hardening for servers that hold real personal data of minors for the migration period (no superuser role, encrypted disk, WAL and backup handling in runbook 5).

### 3.2 Input format and the dump tools (AM-10, PR #125)

- `.cloud` is MySQL. The ETL has no direct MySQL source (runbook 7 item 5). `staging:load` takes exactly one of: a `pp-staging-dump/1` directory (`--from`) or a read-only PostgreSQL restore.
- The AM-10 tools (PR #125) turn `.cloud` into `pp-staging-dump/1`. Run from the repository root as `npm run <tool> -w @pp/api -- <flags>`; output paths are relative to `apps/api` and must be new directories inside a `.migration-out` folder.
  - `dump:check --out <dir>`: preflight; reads no rows (server version, time zones, grants, columns against the spec, row counts).
  - `dump:cloud --out <dir> [--datetime-offset +08:00] [--tables a,b]`: **raw** export in one consistent read-only snapshot. The connection comes from a mode 600 MySQL option file outside the repo (`CLOUD_MYSQL_DEFAULTS_FILE`; `CLOUD_MYSQL_CLIENT` if the client is not on `PATH`); a remote host needs `VERIFY_IDENTITY` or `VERIFY_CA`, otherwise use an SSH tunnel. `DATETIME` values get the offset (default `+08:00`, DT-1: do not change it). It refuses an account with any privilege other than `USAGE`, `SELECT`, `SHOW VIEW` and `SHOW DATABASES` (exit 3, nothing read). Exit 6 means a row-count mismatch or a bad stream (partial output deleted).
  - `dump:produce --work <dir>`: raw, then anonymise, then leak scan, then the raw directory is wiped. For rehearsals only.
  - `dump:wipe --dir <dir>`: overwrite with zeros, then delete.
  - `dump:grants --database <name> --account "'user'@'host'"`: prints the SQL the `.cloud` owner runs (no connection).
- **Production uses the raw `dump:cloud` output**, because the ETL refuses anonymised data in production. Rehearsals use `dump:produce` output, because the rehearsal environment refuses raw data.
- `D_dump` in the duration formula (section 4.3) is the export time of `dump:cloud`. It is measured in P6 and again at A2, and the final export is expected to be a little longer (one more day of growth).
- **Perlu pengesahan (AM-10):** that `staging:load` accepts a raw manifest (`raw: true`) from `dump:cloud`, and the encryption steps for a raw directory (section 3.3). Both are part of the addendum in section 3.3.

### 3.3 Production raw-data flow (addendum to the AM-10 procedure)

The AM-10 procedure is written for the anonymised rehearsal dump. It treats a raw `dump:cloud` as a troubleshooting tool that is wiped the same day (its section 6, last paragraph). The cutover needs the raw output as the normal path. This section is therefore an **addendum that AM-10 must confirm: REQUEST → AM1-3** (the same hand-over and wipe rules, applied to a raw directory). Until AM1-3 confirms, treat it as a proposal.

Per sitting (the T-1 export at A2 and the final export at B2), by the dump operator on his own machine, with the `.cloud` owner present for the account:

1. **No anonymiser key.** Production uses none: steps 1 and 5 of the AM-10 sitting (create and destroy the key) are skipped, `ANON_HMAC_KEY_FILE` is not set, and `dump:produce` and `anonymise:*` are not used. `IC_HASH_KEY` is a different thing (the ETL side) and is **kept**, never deleted.
2. The `.cloud` owner unlocks `pp_dump_ro` (`ALTER USER ... ACCOUNT UNLOCK`).
3. `dump:check` (reads no rows) as a last look; then `npm run dump:cloud -w @pp/api -- --out .migration-out/<name>` (name unique per sitting; `--datetime-offset` left at its `+08:00` default). Expect exit 0.
4. The `.cloud` owner locks `pp_dump_ro` again straight after the export finished (also on a failure).
5. Check the output: manifest present and marked raw, no `.partial` left, table and row counts equal the `dump:check` report (the final export is frozen, so equal; the T-1 export may be slightly higher).
6. **Encrypt** as in AM-10 section 3 step 6 (`tar | gpg --symmetric --cipher-algo AES256`), do the **mandatory listing check**, take the sha256 of the `.gpg` file. The passphrase goes to the receiver through a **different channel** from the file, never with it, never in GitHub, chat or an AI session.
7. **Hand over** (`scp`) to the receiver: the host that will run the throwaway staging cluster. The receiver runs `sha256sum` on the received file, compares, and confirms.
8. **As soon as the receiver confirms the checksum, the operator runs `dump:wipe --dir <name>` on his raw directory and deletes his `.gpg` file** (and closes any SSH tunnel). He does not wait for the verify or the load. The receiver then holds the only copy and deletes it right after `staging:load` succeeds (section 3.1 step 4).
9. The operator reports aggregates only (date, exit code, tables, total rows, sha256, "local copies deleted") to the LEAD, as text in the issue (AM-10 step 9 pattern).

Notes. The raw export is real personal data of minors: no screen sharing, no cloud-sync folder, encrypted disk (runbook 0). If a sitting is interrupted or fails, run `dump:wipe` first, then repeat; the AM-10 abort table applies. An interrupted final export inside the freeze costs `D_dump` again (section 6.1 trigger R2).

## 4. Timeline for 30 Oct

**Reference clock.** `T` = start of the `.cloud` freeze. Proposed default: **30 Oct 2026 01:00 MYT (29 Oct 17:00 UTC)**, chosen so the window ends before the school morning. This is for LEAD approval (open decision 1); traffic figures for `.cloud` are **Perlu pengesahan** (the `.cloud` owner can read them). All later times below follow from that default. `T-1` = 29 Oct. The first export runs at **29 Oct 01:00 MYT (28 Oct 17:00 UTC)**, off-peak, because one long consistent snapshot can strain the production MySQL (AM-10 section 2 item 5; if a current read replica exists it can run in the day instead, Perlu pengesahan). First-load `--as-of` = **2026-10-29** (the MYT date of that export) and is reused in every later run. Date-dependent rules (for example subscription expiry) are therefore judged as of 29 Oct, one day before the go-live; this effect is accepted. `T-dump1` = the start time of the first export, recorded in ISO 8601 with +08:00; it is the `--since` of the delta.

### 4.1 Steps

Commands are the `npm run <script> -w @pp/api -- <flags>` forms of runbook 12; secrets come from the secret store (P5). "Latest start" is the abort rule: if the step has not started by then, stop and apply section 6.

**Phase A: first load on production (T-1, 29 Oct, v2 not public, `.cloud` live)**

| Step | Start | Owner | Command or action | Expected duration | Evidence | Abort rule |
|---|---|---|---|---|---|---|
| A1 | 29 Oct 00:45 MYT (28 Oct 16:45 UTC) | LEAD | Confirms P1 to P12 for this phase and gives the go for the T-1 load. Night sitting: dump operator, `.cloud` owner and a half AZ contact are present. | 15 min | Dated line in the issue. | Any precondition unmet: no load; replan (section 6.5). |
| A2 | 01:00 (28 Oct 17:00 UTC) | Amin, `.cloud` owner | Section 3.3 steps 2 to 5: unlock `pp_dump_ro`, `dump:check`, `dump:cloud --out .migration-out/<name>` (one consistent snapshot, no freeze), lock the account. Records `T-dump1` (export start, ISO 8601, +08:00). | `D_dump` (P6) | `T-dump1`, manifest counts, exit code. | Not finished by 04:00 MYT (28 Oct 20:00 UTC): wipe, no load today; the T-1 load can move to 30 Oct only by LEAD decision. |
| A3 | after A2 | Amin, AZ | Section 3.3 steps 6 to 8: encrypt, listing check, sha256, hand-over, receiver confirms, operator wipes his copy. Custody list updated (runbook 0 rule 4). | `D_xfer` | Checksum match, "local copies deleted". | Mismatch: hand over again once; second mismatch: stop. |
| A4 | 29 Oct 08:00 (00:00 UTC) | AZ | Creates the throwaway staging cluster (section 3.1). Backup of the production database (`pg_dump -Fc` with checksum, PITR marker time) = restore point **`pre_etl`**. It holds **no real data**: it is taken before any `.cloud` data reaches the production server. | `D_snap` | Backup name, size, PITR time. | No restore point: no apply. |
| A5 | after A4 | AZ | Production `stage` step (section 3.1): `staging:load --from <dump dir>` in the throwaway cluster, copy of the two schemas into the target, throwaway cluster and `.gpg` destroyed. | `D_load + D_copy` | Exit 0, table counts, counts against the manifest. | Exit not 0 (4 = reset guard refused; a dump-format error): stop, report to the LEAD. |
| A6 | after A5 | AM | `staging:profile`; read orphan, duplicate and enum counts. | `D_profile` | Counts as text. | Unknown enum values that are not in the reviewed list: LEAD reads them before A7. |
| A7 | after A6 | AM | `NODE_ENV=production npm run migrate:all -w @pp/api -- --dry-run --as-of=2026-10-29` (production mode, so the synthetic-data guard fails early). On a first load only the **core** dry-run runs; the activity dry-run is skipped ("needs migrate:core --apply first"). | about `N_core / r` (4.3) | Exit 0, per-entity table for core, reject counts by reason. | Exit not 0, or the guard refuses: stop; the fix is a developer task, not an edit in production. |
| A8 | after A7 | LEAD | Reviews the **core** reject reasons of A7 against the thresholds of section 5. Activity rejects do not exist yet; they first appear at A9 and are read at A10. | 30 min | The reviewed list. | Over threshold or unexplained: no apply; replan. |
| A9 | after A8 | AM, AZ | `PP_ALLOW_MIGRATE_APPLY=1` and `PP_MIGRATE_TARGET_DB=<db>` with `NODE_ENV=production`: `migrate:all --apply --as-of=2026-10-29` (runs verify at the end). | about `2 x N / r` (4.3) | Exit 0, run ids, duration. | Latest start 16:00 (08:00 UTC). A failed stage stops the run (exit 1): section 6. |
| A10 | after A9 | AM, LEAD | `migrate:verify` is `pass`; the LEAD reads the **activity** reject reasons (first visible now) and the whole reject table against section 5, and accepts the ledger, correct-sum and drift rows (runbook 14 items 1 to 4). | 45 min | Status line, accepted lines. | Verify not `pass`, or rejects over the threshold: trigger R1. `.cloud` is not frozen yet, so there is no service impact; restore `pre_etl` (section 6.3) and replan. |
| A11 | after A10 | AM, AZ | **Idempotency run on production:** `NODE_ENV=production`, `PP_ALLOW_MIGRATE_APPLY=1`, `PP_MIGRATE_TARGET_DB=<db>`: `migrate:delta --since=<T-dump1> --as-of=2026-10-29` (dry-run), then the same with `--apply`, against the T-1 stage. Expected: every row `unchanged`, nothing inserted or updated. It exercises the production guards and measures the real rate `r`. | about `2 x N / r` | Exit 0, all counters `unchanged`, duration, measured `r`. | Any insert or update that cannot be explained: trigger R1 (restore `pre_etl`, replan). |
| A12 | after A11 | AZ, AM, LEAD | AZ takes restore point **`pre_delta`** (the verified T-1 state; it holds real data, section 7). AM recomputes the window budget with the measured `r` (section 4.3); the LEAD reads it. | 30 min | Backup name; the recomputed sum. | Budget over the window: the LEAD decides (P7 options) before the freeze is confirmed. |
| A13 | 29 Oct 18:00 MYT (10:00 UTC) | LEAD | Go or no-go for the freeze: A10 to A12 green, P1 to P12 met, notice sent. After a go, Amin deletes any remaining T-1 files once the LEAD confirms. | 15 min | Dated go line. | No-go: `.cloud` is untouched, nothing to undo; replan. |

**Phase B: freeze window (T-0, 30 Oct)**

| Step | Start | Owner | Command or action | Expected duration | Evidence | Abort rule |
|---|---|---|---|---|---|---|
| B0 | T-60 min: 30 Oct 00:00 MYT (29 Oct 16:00 UTC) | LEAD, AZ | Pre-flight: people and deputies present; a fresh empty throwaway staging cluster is ready; disk space free on the receiving host at least 5 times the dump size; last backup and PITR healthy; `pre_delta` is still current (v2 has had no writes since A12: table counts equal). The LEAD says "go freeze". | 30 min | Counts equal, backup time. | Anything red: do not freeze. |
| B1 | **T+0:00 = 01:00 MYT (17:00 UTC)** | `.cloud` owner | Switches `.cloud` to read-only or maintenance mode and proves no write happens after it (his procedure, P8). Records `T-freeze`. | 20 min | Timestamp and his confirmation line. | Not confirmed by T+0:20: lift the freeze, stop (nothing changed in v2). |
| B2 | T+0:20 = 01:20 (17:20) | Amin, `.cloud` owner | Section 3.3 steps 2 to 5: unlock `pp_dump_ro`, `dump:cloud` (final export), lock the account straight after. Records `T-dump-final`. | `D_dump` | Timestamp, manifest, exit code. | Latest finish T+1:10 (02:10 MYT, 18:10 UTC): else section 6 trigger R2. |
| B3 | after B2 | Amin, AZ | Section 3.3 steps 6 to 8: encrypt, listing check, hand-over, checksum, wipe of the operator copy. | `D_xfer` | Checksum match, "local copies deleted". | As A3. |
| B4 | after B3 | AZ, AM | `staging:load --from <dump dir>` into the **throwaway** cluster. Then the **freeze proof** (aggregates only): for every staged table with `updated_at`, `max(updated_at) <= T-freeze`. | `D_load` | Exit 0, counts against the manifest; the proof result per table. | Latest finish T+1:45 (02:45 MYT, 18:45 UTC). A value after `T-freeze` is a no-go (criterion 13). |
| B5 | after B4 | AM | **Source-delete check**, before anything in the target is replaced: count the surrogate ids that are in the T-1 `staging_cloud` of the target but missing in the final stage (users and schools at least; every migrated entity if cheap). Ids only, never row values. | 5 min | Count per entity; the list of ids kept as text for the LEAD. | See criterion 12 and decision 15. |
| B6 | after B5 | AZ | Copy the two schemas from the throwaway cluster into the target (replacing the T-1 copies); compare table counts; destroy the throwaway cluster, the `.gpg` file and the extracted directory. **This is the first write to the target in Phase B.** | `D_copy` | Exit 0, table counts. | Latest finish T+1:55 (02:55, 18:55 UTC). |
| B7 | after B6 | AM | Delta dry-run: `NODE_ENV=production npm run migrate:delta -w @pp/api -- --since=<T-dump1> --as-of=2026-10-29`. The activity stage may show "skipped" (runbook 15, notes). Optional: skipped if the LEAD chose to drop it (open decision 13). | `D_dry` | Exit 0, delta report. | Exit not 0: section 6. |
| B8 | after B7 | AM, AZ | Delta apply: `PP_ALLOW_MIGRATE_APPLY=1` and `PP_MIGRATE_TARGET_DB=<db>`, `NODE_ENV=production`: `migrate:delta --since=<T-dump1> --as-of=2026-10-29 --apply`. | `D_apply` | Exit 0, duration, inserted, updated and unchanged per entity. | Latest start T+2:15 (03:15, 19:15 UTC). |
| B9 | after B8 | AM, QA | Read `migrate:verify` (run by the delta; repeat if wanted). Read-only smoke on the production target before the switch (section 4.5 part 1: health, ready, SQL checks by surrogate id; no writes, no sign-in as a real account). Send the numbers to the LEAD as text. | `D_verify` + 10 min | Status, entity and check counts, reject counts by reason. | Verify not `pass`: no-go. |
| B10 | **T+3:00 = 04:00 MYT (20:00 UTC) at the latest** | LEAD | Go/no-go (section 5). | 15 min | The decision line with the criteria table. | No decision by T+3:00 is a no-go. |
| B11 | after a go | LEAD, AM | If the LEAD decided so (decision 15): documented manual deletes of PDPA erasure requests found at B5. | per list | Count deleted, as text. | Not done: the switch waits. |
| B12 | after B11 | AZ | Switch (section 4.4). | `D_switch` | Timestamp of the switch. | Switch not complete by **T+4:00 = 05:00 MYT (21:00 UTC)**: the window is over; section 6 trigger R3. |
| B13 | after B12 | QA, AM | Smoke (G5) as in section 4.5 part 2. | 30 min | Pass or fail per check. | A failed check is trigger R4 (section 6). |
| B14 | after B13 | `.cloud` owner, LEAD | `.cloud` stays read-only, never written again (D28a). Notice "v2 is live" is sent. The window is closed; hypercare starts. | 15 min | Timestamp. | |
| B15 | later, optional | AM | `migrate:link-questions` dry-run, then `--apply` (runbook 12). Cutover never waits for it. | | Linked, ambiguous and unmatched counts. | |

### 4.2 Why the freeze includes nearly a full pass

The delta is a re-run of core and activity on the whole fresh dump (runbook 15; deviation from backend plan 14.5 item 4). It reads and transforms every row; only unchanged rows are skipped when writing (by `legacy_hash`). So the delta takes close to a full run, not a few minutes. The delta apply itself runs a dry-run and an apply for each of the two stages, and B7 adds a standalone dry-run. These figures must come from MIG-07 item 18, and the real rate from A11, not from a guess.

Source deletes are **not** propagated by the delta (runbook 15): a row removed in `.cloud` after the T-1 export stays in v2. The freeze keeps `.cloud` still during the final export, but it cannot remove a row that was deleted between the two exports. B5 therefore counts such rows, and criterion 12 and decision 15 say what is done with them.

### 4.3 Duration budget

Formula for the freeze window `W` (from B1 to the end of the switch):

```
sum = D_freeze (B1 to B2, 20 min)
    + D_dump + D_xfer + D_load + D_check (B5) + D_copy
    + D_dry + D_apply + D_verify (incl. read-only smoke)
    + D_gonogo (15 min) + D_switch
W   = 1.25 x sum            (the 25 % buffer is inside the window)
D_dry   ~ N_core / r_dry
D_apply ~ 2 x N / r_apply   (core and activity, each a dry-run plus an apply)
```

`N` = number of source rows the ETL reads (known from the first `dump:check` report and the manifest counts of A2). `r` = rows per second. The only measured rate today is **3,611 rows/s** (AM-08, AC7, 1M rows, synthetic data, laptop-class VM). Real data, the production disk and the network will differ. **Use 3,611 only as a placeholder; replace it with the MIG-07 and P6 figures, and with the rate measured at A11.** Unchanged rows are not written, so `r_apply` on a delta may be higher than the first-load rate. Do not assume it.

| Item | Source of the figure | Placeholder (for the estimate below) |
|---|---|---|
| `D_freeze` | Fixed by the plan (B1 to B2) | 20 min |
| `D_dump` (the `dump:cloud` export time) | Amin's timed export (P6, A2) | 25 min |
| `D_xfer` (encrypt, listing check, transfer, checksum, wipe) | P6 | 15 min |
| `D_load`, `D_copy` | MIG-07 `timings.log` (loader and `stage-copy`) | 20 min, 10 min |
| `D_check` (B5) | P6 | 5 min |
| `D_verify` with the read-only smoke | MIG-07 item 18, P6 | 20 min |
| `D_gonogo` | Fixed | 15 min |
| `D_switch` | P9 rehearsal | 20 min |
| **Fixed total** | | **150 min** |
| Restore time | MIG-07 item 19 and P6 | `<min>` |

**Largest `N` that fits, at the placeholders.** `1.25 x (150 + ETL) <= 240` gives ETL <= 42 min = 2,520 s. With three passes over the data (B7 plus B8), `3 x N / 3,611 <= 2,520`, so **`N` is about 3.0 million rows**. Each minute saved from the fixed 150 adds about 72,000 rows; if A11 measures a delta rate twice as fast, the limit roughly doubles. The unbuffered plan then has the go/no-go start at about T+2:37; T+3:00 is the hard deadline inside the buffer.

Illustration of the ETL part only, at the placeholder rate (these row counts are examples, not observed counts):

| `N` rows | One pass `N / 3,611` | Three passes (B7 and B8 together, worst case) |
|---|---|---|
| 1,000,000 | about 4.6 min | about 14 min |
| 3,000,000 | about 14 min | about 42 min |
| 5,000,000 | about 23 min | about 69 min (does not fit at the placeholders) |
| 10,000,000 | about 46 min | about 139 min (does not fit) |

Rule (P7): the computed `W` must be at most the maximum window. **Proposed maximum window: 4 hours** (T+0:00 to the switch done at T+4:00; B1 to B12), with the go/no-go at T+3:00 at the latest. If `W` does not fit, the LEAD decides before the freeze is announced (P7, A12). The window cannot be shortened by editing the ETL on the night.

### 4.4 The switch (B12)

How v2 starts to serve users is **Perlu pengesahan** (open decision 8). Two options, both done by half AZ with the `.cloud` owner:

- **A (proposed):** v2 is published under its own address by half AZ; the `.cloud` owner leaves `.cloud` read-only and shows a maintenance page that points to v2. No change to the `.cloud` application code or data; the pointer page is the `.cloud` owner's own operational change.
- **B:** DNS or edge routing moves the `.cloud` address to v2. Needs a lowered time-to-live (P9) and the switch-back path to be rehearsed; the old address can no longer show `.cloud` read-only for reference during that time.

Either way: sessions are not migrated (everyone signs in again), the switch is one recorded timestamp, and the switch-back is a recorded action of the same size.

### 4.5 Smoke checks (no sign-in as a real minor)

The team cannot and must not sign in as migrated accounts: roster and legacy-hash accounts are forced to reset their password, and the accounts belong to real minors. Runbook 14 item 8 and runbook 17 item 2 are applied as follows.

1. **Before the switch (B9), read-only on the production target.** Health and ready endpoints; SQL checks by surrogate id, run by half AM, counts only: for a deterministic sample of users per role, the migrated practice-session and answer counts equal the staged counts; for a sample of wallets, the balance against the ledger sum equals what the verify report lists; derived JPN/PPD rows equal the distinct state and district pairs; the number of accounts marked for a forced password reset equals the expected number (roster accounts plus accounts with a non-bcrypt or shared default hash; the column name is confirmed by the AM operator). No writes.
2. **After the switch (B13).** Health green; the **v2-born smoke accounts** (P11: student, teacher, parent, admin) each sign in, reach their dashboard and, for the student, start the first-login flow; the same SQL checks repeated; error rate and password-reset requests watched. Sign-in checks use only these v2-born accounts.
3. The full conformance suite and e2e smoke ran on a restored copy in P6 (they write data, so never on production).

## 5. Go/no-go criteria

These are runbook 14 made final. They are checked at the decision point (B10); the earlier T-1 check (A8, A10) applies the same table to the first load. All must hold. A criterion with no evidence counts as not met. **The LEAD decides.** The LEAD may waive a criterion only in writing in the issue, with the reason (runbook 14).

| # | Criterion | Measure (final) | Evidence |
|---|---|---|---|
| 1 | Verification | `migrate:verify` status is `pass`: every entity `ok`, no check `mismatch`. | Status line, entity and check counts. |
| 2 | Rejects reviewed and inside the threshold (**proposed**, open decision 4) | Every reason (`UNKNOWN_ENUM`, `ORPHAN_PARENT`, `DUPLICATE_KEY`, `INVALID_VALUE`, `UNSUPPORTED`) per entity is listed and explained. Rejected rows at most **0.1 %** of source rows for `users` and `schools` and at most **0.5 %** per other entity. Rejected users are listed by surrogate id (each has no login until fixed; the duplicate caveat in MIG-03 Q2). | The list of reason and count, as text. |
| 3 | No lost users or schools | `ORPHAN_PARENT` rejects on `users` and `schools` are **0**. | The count. |
| 4 | Orphan scan | The v2-side foreign key scan reports **0**. | The count. |
| 5 | Delta consistent (**proposed** thresholds, open decision 4) | For each entity with `updated_at`, inserted plus updated from the delta is within **5 % or 100 rows** (whichever is larger) of the number of staged rows with `updated_at` after `T-dump1`, or the gap is explained in writing (aggregation steps explain some). Rows loaded by the delta are not zero when `.cloud` was written to between the two exports. | The delta report next to the run counters. |
| 6 | Ledger and drift accepted | Each ledger-sum, correct-sum and accepted-drift row is read and accepted; nothing was corrected to make totals agree. | One accepted line per row. |
| 7 | Timings in the window | At the decision point the elapsed time is at most T+3:00, and the measured durations leave the switch and the smoke inside T+4:30 (switch done by T+4:00, smoke 30 min). | Elapsed time and durations. |
| 8 | Backups before the first write | Restore points `pre_etl` (A4) and `pre_delta` (A12) exist, and a restore of a restore point has been proven in P6; PITR is on; `pre_delta` is newer than the last write to the production target **before the first write of Phase B (the stage copy, B6)**. | Backup names and times. |
| 9 | Smoke | **Before the switch:** the read-only checks of section 4.5 part 1 pass (B9). The full conformance suite and e2e smoke passed in P6 against a restored copy of the target. **After the switch:** section 4.5 part 2 (B13). | The B9 result; the real tail of the P6 test output. |
| 10 | Rollback ready | The switch-back, the unfreeze and the restore steps of section 6 are rehearsed (P6, P9) with durations; the people are present. | The rehearsal timings. |
| 11 | Housekeeping plan | Dates for the deletions of section 7 are written, including the list of backups and WAL taken while `staging_cloud` exists. | The dated plan. |
| 12 | Source deletes known | B5 produced a count of surrogate ids present in the T-1 stage but missing in the final stage, per entity (users and schools at least). The LEAD has read the list and applied the rule of decision 15 (default: list only; PDPA erasure requests are applied by a documented manual delete after the go/no-go, B11). | The counts as text. |
| 13 | `.cloud` was still | For every staged table with `updated_at`, `max(updated_at) <= T-freeze` in the final stage (B4), and the `.cloud` owner's confirmation line exists. | The per-table result; the confirmation. |

Any "no" is a no-go: section 6.

## 6. Rollback

### 6.1 Triggers (each measurable)

| ID | Trigger | When |
|---|---|---|
| R1 | A stage of `migrate:all` or `migrate:delta` exits not 0, or `migrate:verify` is not `pass`, or the orphan scan is above 0, or the idempotency run (A11) changes a row. | Any time before the switch |
| R2 | A step misses its latest start or finish in section 4.1 (including an export that fails and must be repeated), or the projected end passes T+4:00. | Any time before the switch |
| R3 | The switch is not complete by T+4:00. | B12 |
| R4 | A smoke check fails: health endpoint not green, a v2-born smoke account of any role cannot sign in, an SQL check of section 4.5 differs from the verify report (counts for a sampled surrogate id, wallet against ledger). | After the switch |
| R5 | Support or monitoring shows a wrong-data pattern (the same wrong figure for many accounts), or the 5xx rate stays above 2 % of requests for 10 minutes (proposed, open decision 11). | After the switch |
| R6 | A suspected PDPA incident touches the loaded data or a dump (runbook 0 rule 8; AM-10 section 5). Report to the LEAD at once. | Any time |

### 6.2 Decision deadline (point of no return)

- **Before the switch:** the LEAD can stop at any step; nothing user-visible has changed except the `.cloud` freeze.
- **After the switch:** the LEAD may still roll back until **switch time + 4 hours** (proposed; with a 05:00 MYT switch that is 09:00 MYT, 01:00 UTC). After that v2 is the system of record and problems are fixed forward. Risk for the LEAD: the longer v2 is live, the more data exists only in v2, and a 09:00 MYT deadline runs into the school morning, when traffic is likely highest. A shorter deadline loses less data but leaves less time to find a problem. The LEAD chooses (open decision 3).

### 6.3 Procedure

**Before the switch (v2 not public).** Service is not at risk, only the freeze lasts.

1. **The `.cloud` owner lifts the freeze** (`.cloud` returns to normal service and writes). This is the first and the only urgent action; it does not wait for the v2 clean-up. Communicate: "maintenance extended, no data lost" (6.5).
2. v2 clean-up, by the LEAD's choice, in order of preference:
   - **R-a: restore `pre_delta`** (the verified T-1 state; AZ). Keeps the T-1 load; a new attempt needs only a new final dump and a new delta. It holds a T-1 copy of `staging_cloud`, so the 7-day deadline of section 7 still applies.
   - **R-b: restore `pre_etl`** (holds no real data), or run `migrate:rollback` (runbook 16, Procedure B: the production database holds v2-born rows such as staff and smoke accounts, so Procedure A, dropping the database, is not used). Both the dry-run and the apply need `PP_ALLOW_MIGRATE_APPLY=1` and, in production, `PP_MIGRATE_TARGET_DB=<db>`, plus `PP_ALLOW_MIGRATE_ROLLBACK=1` (name to be confirmed on the final #123); `--confirm=<db>` must equal the database name. Dry-run first, then `--apply`. It refuses with `RollbackRefusedError` (exit 2, no change) while an apply run is `running` in `etl_runs`: confirm no load is active, mark that run `failed`, then retry. A refusal because a v2-born row references a migrated row also changes nothing; the LEAD decides.
3. After a `migrate:rollback`, re-run the idempotent seeds (`npm run be:db:seed`) to restore adopted seed rows. Prove the result as runbook 16 says: per-table counts equal the snapshot, `legacy_source = 'cloud'` counts are 0. Do not run `migrate:verify` after a rollback.
4. Before any new apply, run a fresh dry-run; the earlier dry-run no longer counts (runbook 16).
5. `staging_cloud` stays for at most 7 days (section 7).

**After the switch (R4 to R6, within the deadline).**

1. AZ puts v2 into maintenance (**stops writes first**), then takes a **`post_switch` backup** of the v2 database (so the v2 data is kept for analysis whatever happens next), then switches back (section 4.4, same size as the switch). The `.cloud` owner lifts the `.cloud` freeze (`.cloud` was kept intact and read-only, so its data is as it was at `T-freeze`).
2. Do not delete the v2 data; keep it as it is for analysis.
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

Retention follows the MIG-03 decisions (LEAD, all defaults, 21 Oct 2026), runbook 0, 17 and 18, and the AM-10 procedure section 4. Dates are computed from a cutover on 30 Oct 2026; if the switch is later, the dates move with it.

| Item | Rule | Owner | Date |
|---|---|---|---|
| Raw dump copies | The operator's raw directory and `.gpg` are wiped when the receiver confirms the checksum (section 3.3). The receiver deletes the `.gpg`, the extracted directory and the passphrase right after `staging:load` succeeds. Any other copy handed out follows the 7-day rule. | Amin (his copies), AZ (receiving host), LEAD (custodian, confirms) | Same day as each sitting; at the latest **6 Nov 2026** |
| Throwaway staging cluster | Destroyed with its volume right after the copy into the target (A5, B6). | AZ | 29 and 30 Oct 2026 |
| `staging_cloud` schema in the target | `drop schema staging_cloud cascade;` Kept only as the input for a rollback retry. | AZ | **At the latest 6 Nov 2026** |
| Backups and WAL taken while `staging_cloud` exists in the target (`pre_delta`, `post_switch`, daily backups, archived WAL from A5 to the drop) | They contain a raw copy of `.cloud`. AZ keeps an explicit list of them. At the drop: take a fresh full backup `post_drop`, prove it with a restore check, then delete every listed backup and WAL segment. If the platform cannot delete selected WAL, cap PITR retention to 7 days for this period (Perlu pengesahan, half AZ). `pre_etl` holds no real data and is not on the list. | AZ (executes), LEAD (confirms) | **At the latest 6 Nov 2026** |
| Question report export file (`.migration-out/`, from `migrate:export-question-reports`) | Deleted with `staging_cloud`: at hand-over or 7 days after the cutover, whichever is first. The LEAD records the deletion date as text in the issue. | AM operator, LEAD confirms | **At the latest 6 Nov 2026** |
| `archive_cloud` | **Kept 12 months, all archive tables** (Q12 A). Read-only, not served by the API. Roster JSON files are purged. Deleted by `drop schema archive_cloud cascade;` with the LEAD's confirmation. Until then it sits in the database and in later backups; those age out under the normal backup retention after the drop (half AZ states the number of days, Perlu pengesahan). | AZ (executes), LEAD (approves) | **On or after 30 Oct 2027** (a dated reminder is set at cutover) |
| Read-only MySQL account and the option file | The `.cloud` owner **drops `pp_dump_ro`** (`DROP USER`), Amin deletes the option file and the `dump:check` reports (`apps/api/.migration-out/check-*`, names and aggregates only). The account stays locked between sittings. | `.cloud` owner, Amin | When the LEAD signs off the cutover and no retry is planned; at the latest 6 Nov 2026 (check reports 30 days at most) |
| WAL, base backups, snapshots and replicas of any server that held a dump; temp and spill files; shell history with a URL | Checked and cleared (runbook 5 items 3 and 4, runbook 18). | AZ, Amin | At the latest 6 Nov 2026 |
| Open question reports | Open reports are exported with `migrate:export-question-reports` (added in #123) after the final verify; it writes a mode 0600 CSV under `.migration-out/` (Q9 A). It holds raw reporter free text from minors (the `reason` is redacted for e-mail, phone and IC and capped; `created_at` is a date only): custody like a dump (encrypted, out of band, never in GitHub). **Deleted at hand-over or after 7 days, whichever comes first**, the same deadline as `staging_cloud`. Closed reports are **not** exported: they stay in `archive_cloud` for 12 months (Q12 A). Recipient: open decision 12. | AM exports, LEAD hands over and confirms deletion | Hand-over by 6 Nov 2026; file deleted at hand-over, at the latest **6 Nov 2026** |
| `etl_runs`, `etl_recon`, `etl_rejects`, `etl_checkpoints`, `etl_id_map` | Kept with the database (audit trail and later backfill). `etl_id_map` is not deleted. | AZ | Standing |
| `IC_HASH_KEY` | Kept for the life of the system, in the secret store, with the LEAD's copy. Never deleted (a new key would change every IC hash). | AZ, LEAD | Standing |
| Recon report and profiles (`.migration-out/`) | Aggregates and surrogate ids only; kept in the LEAD's encrypted storage until both the rehearsal and the cutover sign-offs are done, at most 30 days; numbers go into the issue as text; never in GitHub (runbook 17 item 1, 18). | LEAD | At the latest 29 Nov 2026 |
| `.cloud` | Stays read-only for reference; never written again. Its end of life is the `.cloud` owner's decision, outside this plan. | `.cloud` owner | n/a |

**Hypercare (30 Oct to 6 Nov).** Daily: health and readiness endpoints, error rate, the number of password-reset requests (expected spike, runbook 17 item 3), support questions about streak, mastery or ranking changes (accepted drift, runbook 17 item 4), one repeat of the smoke list of section 4.5 part 2. `migrate:link-questions` may run at any time after the cutover.

**Sign-off record.** The LEAD writes this one line in the issue (no data, no names beyond the handles) when the final dump copies are deleted and `staging_cloud` is dropped:

```
Cutover <date>: freeze <T-freeze> MYT (<UTC>), final export <T-dump-final>, switch <time>,
window used <h:mm> of <h:mm>, verify <status>, rejects <n> (reasons reviewed), source deletes <n> (rule applied),
go/no-go <decision> by azarulhakim, rollback needed <no | trigger id>,
dumps deleted <date>, pp_dump_ro dropped <date>, option file and check reports deleted <date>,
staging_cloud dropped <date>, affected backups and WAL deleted <date>, archive_cloud kept until <date>,
recon report deleted <date>. Signed: azarulhakim.
```

## 8. Open decisions for the LEAD

Each item is answerable in one word; `default` accepts the proposal, and `all defaults` accepts every proposal. Already decided and therefore not asked: the dump operator is Amin and the LEAD approves (OD-18 A); production loads use real, not anonymised, data (the ETL refuses anonymised data in production) and use no anonymiser key; `.cloud` DATETIME is +08:00 (DT-1 A).

1. **Times.** Default: freeze start (T) 30 Oct 2026 01:00 MYT (29 Oct 17:00 UTC); T-1 export 29 Oct 01:00 MYT (off-peak, or in the day from a replica if one exists). Answer: times, or `default`.
2. **Maximum freeze window.** Default: 4 hours (go/no-go by T+3:00, switch done by T+4:00). Answer: hours, or `default`.
3. **Point of no return after the switch.** Default: switch + 4 hours. Risk: with a 05:00 MYT switch the deadline is 09:00 MYT, in the school morning. Answer: hours, or `default`.
4. **Thresholds.** Default: `ORPHAN_PARENT` on users and schools = 0; rejects at most 0.1 % for users and schools and 0.5 % for every other entity, every reason explained (criterion 2); delta inserted plus updated within 5 % or 100 rows of the rows changed since `T-dump1` (criterion 5). Answer: `default` or new numbers.
5. **Who freezes and unfreezes `.cloud`.** A (default): the `.cloud` system/data owner (a read-only MySQL grant cannot put `.cloud` into maintenance). B: Amin. The team never changes `.cloud` code or data. Answer: A or B.
6. **Who sends the notice to schools and users.** Default: Amin, text approved by the LEAD. Answer: `Amin`, `LEAD`, or another handle.
7. **Who types the production commands (`migrate:*`).** Default: the half AM migration operator, with half AZ DevOps on the host (credentials stay with humans and the secret store). Answer: `default` or another arrangement.
8. **How the switch is done.** A (default): v2 on its own address plus a pointer page on `.cloud`. B: DNS or edge routing moves the old address to v2. Answer: A or B.
9. **First load on production at T-1 (A, default)** with the delta inside the freeze, or **B** one full fresh load inside the freeze (no T-1; longer window, fewer steps). Answer: A or B.
10. **Production database platform (go-live checklist D-2).** Default: VPS (half AZ owns it), with restore points `pre_etl`, `pre_delta`, `post_switch` as `pg_dump -Fc` plus PITR. Answer: `VPS`, `managed`, or `default`.
11. **Post-switch 5xx rollback trigger (R5).** Default: 5xx above 2 % of requests for 10 minutes. Answer: `default` or a number.
12. **Recipient of the open question report export (Q9 A).** Default: the LEAD receives it and passes it to the content team. Answer: `LEAD` or a handle.
13. **Standalone delta dry-run (B7) inside the window.** Default: keep it; drop it only if P7 shows the window does not fit. Answer: `keep` or `drop`.
14. **Where the raw dump is staged.** A (default): a separate throwaway PostgreSQL cluster with no backups, WAL archive or replicas, destroyed after the copy into the target. B: a `_staging` database on the production server, with its WAL and backups on the deletion list. Answer: A or B.
15. **Source deletes between the two exports (criterion 12).** Default `list`: list the missing surrogate ids for the LEAD; deleted rows stay in v2; PDPA erasure requests are applied afterwards by a documented manual delete (B11). Alternative `erase`: delete every missing id from v2 after the go/no-go. Answer: `list` or `erase`.
16. **Night deputies** for the `.cloud` owner, the dump operator and half AZ DevOps at the two 01:00 sittings. Default: each role names one by 27 Oct (names kept outside the repo). Answer: `yes` or `no`.
