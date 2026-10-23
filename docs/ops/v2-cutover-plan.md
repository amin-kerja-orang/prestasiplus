# v2 cutover plan: .cloud to v2, one night on 29 Oct 2026, DNS switch on 30 Oct 2026 (MIG-08)

- **Interpretation (one line): one night: freeze, export, full load, verify; DNS switch by the LEAD on 30 Oct; `.cloud` read-only until the switch.** This is an *interpretation of the LEAD plan of 22 Oct 22:39 MYT (#109), to be confirmed* by the LEAD. Two points of it are worth confirming: (a) `.cloud` stays read-only for about a day, from the freeze on 29 Oct 01:00 to the switch on 30 Oct, because the LEAD reviews on the morning of 30 Oct; (b) the night has no delta, because the freeze comes first and the export is therefore consistent.
- **Status:** the LEAD decided the first list of open decisions (`all defaults`, #109, 22 Oct 2026 10:30 MYT; marked "Decided: LEAD, 22 Oct") and 4b and 14 to 19 ("defaults, except 16", #109 6340542912; marked "Decided: LEAD, 22 Oct (#109 6340542912)"). The LEAD then gave the binding go-live plan of 22 Oct 22:39 MYT (#109), on which this version is restructured. Items it changes are marked "superseded by the LEAD plan" in section 8. Decision 4b is "AND, pending the LEAD's reply (#109 6341421182)". Nothing here has been run.
- **Slug:** `v2-cutover-plan`. **Item:** MIG-08 (P0). Docs only.
- **Builds on:** [migration runbook](../architecture/v2-migration-runbook.md) sections 0 to 18 (sections 12 to 18 arrive with PR #123; until it is merged they exist only on that branch), [data migration design](../architecture/v2-data-migration.md) (risk "Cutover", section 5; load order, section 6.1), [backend plan](../architecture/v2-backend-plan.md) sections 14.5 to 14.8, [backup and restore drill](db-backup.md), [go-live checklist](go-live-bijak-spm.md), and the roles in [AGENT-SYNC](../plan/AGENT-SYNC.md) ("Halves"). It also uses the LEAD's "all defaults" answers on the MIG-03 decisions of 21 Oct 2026 (PR #114), the half AZ rehearsal environment (PR #117: `docs/ops/rehearsal-db.md` and `deploy/rehearsal/rehearsal-db.sh`), the AM-10 dump tools and procedure (PR #125: `docs/ops/cloud-dump-procedure.md`, `dump:check`, `dump:cloud`, `dump:produce`, `dump:wipe`, `dump:grants`) and the half AZ production migration slot (PR #166: `docs/ops/production-migration-slot.md`, `deploy/vps/migration/slot.sh`, `restore-point.sh`, `pitr.sh`).
- **Time convention:** every time is Malaysia time (MYT, UTC+8) with UTC in brackets. `.cloud` `DATETIME` values are read as +08:00 (decision DT-1 A).
- **Marker:** "Perlu pengesahan" means not decided yet; it is to be confirmed by the person named, or by the LEAD.
- **Step mapping (this version against the previous one).** Old A1 to A13 and B0 to B14 are renumbered; the mapping is in section 4.0. Criteria IDs 1 to 13 and the stop IDs S1 to S7 are unchanged. Preconditions P1 to P13 keep their numbers, with new dates.

This plan does not repeat the runbook. Where it says "runbook 14", read section 14 of the migration runbook.

## 1. Purpose and scope

**Purpose.** Move the user data of the old system `.cloud` (MySQL) into the v2 backend (PostgreSQL 16) in **one rehearsed night**, so v2 can open for Bijak SPM on **30 Oct 2026** with the existing users, schools, classes and history, and so the go-live can be stopped or reversed on measurable triggers.

**The shape of the plan (the LEAD plan of 22 Oct 22:39 MYT, binding; interpretation to be confirmed).**

| Date (MYT) | What |
|---|---|
| 24 Oct | The migration PRs are merged. The AM-10 dump is run by the dump operator. A real-data rehearsal runs on the rehearsal DB. |
| 25 Oct | Code freeze. |
| 26 Oct | The production VPS is set up dark: TLS, backups to S3, reference-only seed, registration closed. |
| 27 Oct | Second rehearsal, production-like and timed. The go/no-go criteria are written. |
| 28 Oct | G6 go/no-go by the LEAD. The downtime notice goes to users of the old system. |
| **29 Oct 01:00** | **Freeze `.cloud`, then the export, then the full first load into production, then verify.** Any breach means stop and roll back. The dump operator does this alone, by runbook. |
| 30 Oct | The LEAD's morning review, the DNS switch, opening to users, monitoring (the LEAD and half AZ DevOps). |

**What moves.** The entities in the load order of data-migration 6.1 and the matrix in backend plan 14.7, loaded in one full first load by `migrate:all --apply`. There is no T-1 export and no delta at night: the freeze comes first, so the single export is consistent. The delta (`migrate:delta`) is kept only for rehearsals and a replan (section 4.7). Question-bound working state, structured and exam answers, and the other items decided in MIG-03 are dropped or archived as decided there. Files (AC9, decided A, LEAD 22 Oct): banner images are copied from a read-only export of the `.cloud` storage files taken in the same sitting (`--files-dir` of the activity stage, PR #122; the export procedure is AM-10 `cloud-dump-procedure.md` section 8.1: the files travel in the same encrypted archive as the raw dump); **support-ticket attachments are not migrated**. Streak, mastery and rankings are recomputed and differ by design (runbook 17).

**What never happens.**

- `.cloud` is never modified by the team. The dump operator (**Decided: LEAD, 22 Oct**, item 5) only switches it to read-only or maintenance mode and back, using the maintenance-switch access that the `.cloud` owner gives (how: Perlu pengesahan). This is an operational switch with no change to its code or data (decision D28a). No agent session has access to `.cloud` or holds its credentials.
- `prestasiplus.my` is not touched and is not a source (`staging_my` stays an empty extension point).
- No dump, report or secret goes into the repo, a PR, an issue, chat or a CI artifact (runbook 0).
- Nothing in this plan is executed without the LEAD's explicit confirmation. The production deploy needs the LEAD's approval (gate G6, 28 Oct).

## 2. Roles (RACI)

R = does it, A = accountable (one per row), C = consulted, I = informed.

| Role | Who | Responsibility in the cutover |
|---|---|---|
| LEAD | The LEAD (the project lead who approves each step) | Go/no-go (G6 on 28 Oct, and the morning review on 30 Oct), rollback decisions after the night, merges, approves the production deploy, approves each hand-over, receives the deletion confirmations, does the DNS switch. |
| `.cloud` owner (AM-10 calls this role "data owner") | The person who administers the `.cloud` database and application; who that is: **Perlu pengesahan** | Creates the read-only MySQL account `pp_dump_ro`, **arranges its unlock and lock for the night sitting in advance** (item 9 of the G4 fixes; for example a MySQL event that unlocks it at the sitting start and locks it at a fixed time; **Perlu pengesahan**), drops it at clean-up (AM-10 procedure, section 2 item 5 and section 4). Confirms that no MySQL 8 `mandatory_roles` apply to the account (else the tools refuse it, exit 3). Gives the dump operator access to the maintenance switch of `.cloud` (**Perlu pengesahan**: how, and whether the owner stays on call). Does not change `.cloud` code or data. Not on call at night (decision 16). |
| Dump operator | The human who holds the read-only `.cloud` access (OD-18 A, decided); the LEAD approves | **Freezes and unfreezes `.cloud`** (**Decided: LEAD, 22 Oct**, item 5; needs the `.cloud` owner's maintenance-switch access, **Perlu pengesahan**). Sends the notice to schools and users, text approved by the LEAD (**Decided: LEAD, 22 Oct**, item 6). Runs `dump:check` and `dump:cloud` on the operator's machine, encrypts, hands over, wipes the operator's copy (section 3.3). **Runs the whole night sitting (Phase B) ALONE** by the written night card (section 4.6) (**Decided: LEAD, 22 Oct (#109 6340542912)**, decision 16: no deputy). The operator does **not** hold `ALTER USER` on production MySQL (item 9). The operator gets **time-boxed VPS rights** for the sitting (section 4.6, "Night access"). Every threshold breach or failed step means STOP and roll back by the card; no one is woken for a go/no-go; the LEAD reviews in the morning. |
| Half AZ DevOps | half AZ | Production database and VPS, the throwaway staging cluster (section 3.1), backups and PITR, restore points, the production dark set-up, deploys, DNS or app switch support, monitoring. Daylight only (decision 16): the restore-point checks and the pre-flight are done by half AZ on 28 Oct, before the G6 go; half AZ is not on the night session. On 30 Oct half AZ DevOps is with the LEAD for the switch and the monitoring. |
| Half AM migration operator | half AM | Runs rehearsals and the daylight steps of Phase C (the Q9 export and `migrate:archive-minimise`), reads and reports the verify output and rejects, prepares the SQL checks of section 4.5. At night the dump operator types the written commands alone (decision 16; **Perlu pengesahan**: shell access on the migration host and per-run access to the secret store for the operator). The production credentials stay with a human and in the platform secret store, never with an agent. |
| QA | half AZ (G5 owner) | Prepares the v2-born smoke accounts and the smoke checklist in daylight (P11, created **before** the `pre_etl` point so a restore keeps them); runs the e2e smoke on the restored copy (P6) and the sign-in smoke on the morning of 30 Oct (C2). The conformance suite runs on the release sha in CI or locally. |
| Night deputies | **None** (**Decided: LEAD, 22 Oct (#109 6340542912)**, decision 16) | No deputy for the `.cloud` owner, the dump operator or half AZ DevOps at the 01:00 sitting. One operator plus the LEAD's morning review. |

| Step | LEAD | Dump op. | `.cloud` owner | AZ DevOps | AM operator | QA |
|---|---|---|---|---|---|---|
| Approve this plan, window and thresholds | A/R | C | C | C | C | I |
| Daylight pre-flight (A5, 28 Oct) | A (reads at G6) | I | | R | C | R (accounts) |
| Preconditions (section 3) | A | R (own items) | R (own items) | R | R | C |
| Pre-arranged unlock and lock of `pp_dump_ro` for the sitting; drop it at clean-up | I | C (confirms it works at B2) | A/R | | | |
| Export (`dump:cloud`, B2) | A (pre-approves at G6) | R (alone) | C (account, Perlu pengesahan) | | | |
| Encrypted hand-over, checksum, wipe of the operator copy | I | A/R (sender and receiver at night; compares the checksum alone) | | C (prepares the host in daylight) | | |
| Restore points and backups | I | | | A/R (daylight) | C | |
| Throwaway cluster, stage load, copy (B4, B5) | I | R (through `slot.sh`, **Perlu pengesahan**: VPS access) | | A (A5 preparation) | C | |
| `migrate:all`, `migrate:verify` (B6 to B8) | I | R (night, alone) | | C (daylight guards, env) | A (rehearsals) | |
| Freeze proof (B4) | A (pre-approves the rules) | R (alone) | | | | |
| Freeze and unfreeze `.cloud` | A (asks) | R | C (gives switch access) | | | |
| Go/no-go at the decision point (B9) | A (pre-approves the checklist at G6; reviews in the morning) | R (runs the mechanical checklist alone) | | C (daylight pre-flight) | | |
| Morning review (C1), sign-in smoke (C2), DNS switch (C3) | A/R | | | R (switch support, monitoring) | | R (C2) |
| Night rollback (restore `pre_etl`) | A (pre-approves `--yes` at G6; reviews in the morning) | R (alone, by the written card; **Perlu pengesahan**: VPS access) | | C (daylight set-up) | | |
| Rollback after the DNS switch (daytime) | A | | | R (stops writes first, restores) | C | |
| Notice to schools and users | A (approves the text) | R | | | | |
| Deletion of dumps, credentials and reports (section 7) | A/R (custodian) | R (own copies, option file, check reports, night access) | R (drops the account) | R (production host, backups, revokes night access) | R (reports) | |

## 3. Preconditions (24 Oct to 28 Oct)

All must be met and evidenced as text before the LEAD gives the G6 go on 28 Oct. A precondition with no evidence counts as not met. The LEAD checks the list at G6 (A5, 28 Oct, section 4).

| # | Precondition | Due | Owner | Evidence |
|---|---|---|---|---|
| P1 | **Rehearsals green.** First real-data rehearsal on the rehearsal DB with the AM-10 dump (24 Oct, A1), and the **second rehearsal, production-like and timed** (27 Oct, A4), with timings for: export (`dump:produce`, of which the `dump:cloud` part), encrypt and hand-over, `staging:load`, stage copy, `migrate:all --apply`, `migrate:verify`, `migrate:rollback`, restore of a snapshot, and (replan only) the delta dry-run and apply. Runbook 14 met on the rehearsal. | 24 Oct (first), 27 Oct (second) | AZ, AM | The timing figures and exit codes as text. |
| P2 | PRs **#122** (AM-08, ETL throughput), **#123** (AM-09, orchestration, including `migrate:archive-minimise`), **#125** (AM-10, dump tools) and **#166** (half AZ, migration slot) merged by the LEAD on 24 Oct. The git sha the rehearsals ran is the release sha, or the rehearsal is repeated after any ETL change. **Code freeze on 25 Oct**: the LEAD re-pins on the current head and the release sha named in P2 and in the night card is the re-pinned one. | 24 Oct (merge), 25 Oct (freeze) | LEAD | The shas. |
| P3 | **Least-privilege migration role first** (before the migration to the tip): a dedicated database role for `migrate:*`, not a superuser and not the API role. Grants: read on `staging_cloud` and `archive_cloud`; read and write on the v2 tables the ETL writes and on `etl_*`; no DDL beyond that. A separate **stage-only role** (CREATE and DROP on `staging_cloud` and `archive_cloud` only), run by half AZ, does the stage copy (section 3.1 step 3) and the section 7 `drop schema staging_cloud cascade` and `drop schema archive_cloud cascade`; it is also the role `staging:load` uses if it needs schema create or drop. The migration role also needs USAGE on the schemas it reads and writes and USAGE and UPDATE on the sequences of the tables it writes. `prisma migrate deploy` runs as the schema owner role (half AZ), which is neither the migration role nor the API role. The API role never gets access to `staging_cloud` or `archive_cloud`. Half AZ creates the roles (**Perlu pengesahan**). Then: production database migrated to the tip with `prisma migrate deploy`; applied migrations equal the number of folders; `/api/ready` reports migrations applied; v2 is **dark** (not public, registration closed). | 26 Oct | AZ | The role names and grants as text (no passwords); the counts; **a check that the stage-only role has no access to `public` or to the v2 tables** (for example a denied `select` and a denied `insert`, as text). |
| P4 | Backups (to S3) and PITR on for the production database; a restore drill passed on it ([db-backup](db-backup.md)). A backup that has not passed a restore check is not trusted. Routine backups leave `staging_cloud` out (#166). | 26 Oct | AZ | Drill result, backup timestamp. |
| P5 | Secrets in the platform secret store, never in the repo: `DATABASE_URL`, `IC_HASH_KEY` (one value for the life of the system, **kept and never deleted**, unlike the anonymiser key; a copy kept by the LEAD, because a different key changes IC hashes), `PP_MIGRATE_TARGET_DB`, `PP_ALLOW_MIGRATE_APPLY`, `FILE_STORAGE_DIR` (an apply with `--files-dir` needs it: the absolute path of the v2 file storage, outside the files export, a separate directory that neither contains nor sits inside it; `--files-dir` itself must be an existing readable directory outside the repository working tree, not containing it, and holding a valid `SHA256SUMS`; the activity stage refuses otherwise) and, for a rollback only, `PP_ALLOW_MIGRATE_ROLLBACK`, each set per run only, not permanently (`slot.sh etl` sets `NODE_ENV`, `PP_MIGRATE_TARGET_DB` and, when `--apply` is on the line, `PP_ALLOW_MIGRATE_APPLY` itself; section 4.6). **Perlu pengesahan** (half AZ): `slot.sh` mounts only the reports volume into the migrate container and does not set `FILE_STORAGE_DIR`; how `--files-dir` and `FILE_STORAGE_DIR` reach `slot.sh etl` is not shown in #166. CI tokens have no production access. Production uses **no anonymiser key**. | 26 Oct | AZ, LEAD | A confirmation line per name (no value). |
| P6 | **Second rehearsal of the whole night procedure, production-like and timed** (27 Oct, A4), on a fresh copy: the dump path of section 3.3 (the rehearsal uses `dump:produce` because the rehearsal environment refuses raw data), encrypted hand-over and checksum, throwaway staging cluster up and torn down, `staging:load`, stage copy, full load, verify, the restore of a restore point, and the night card read end to end. The `dump:cloud` part is timed from the **24 Oct AM-10 dump sitting** (ordered by the LEAD plan, run by the dump operator under AM-10 sections 1 to 7; this replaces the earlier rule of no extra raw read of the real `.cloud` for timing); the file export of AC9 is timed with it. The production guard is exercised once with a synthetic fixture: `NODE_ENV=production PP_MIGRATE_TARGET_DB=<db> PP_ALLOW_MIGRATE_APPLY=1 ... --apply` must be **refused by the synthetic-data guard**; a run that is accepted is a failed rehearsal. Without `PP_MIGRATE_TARGET_DB` it is refused by the target guard (rehearsal-db recipe). The e2e smoke and the read-only SQL checks of section 4.5 run against a restored **copy** of the target, never against production. The conformance suite is not part of this: it runs on the release sha in CI or locally. Every duration recorded. | 27 Oct | AZ, AM, dump operator | Timings against section 4.3; the two refusals; test output tail. |
| P7 | **Window budget computed** (section 4.3) from P1 and P6 and within the maximum night window (Default 6 hours). If not, the LEAD decides on 27 Oct: widen the window, or move the date. | 27 Oct | AM | The sum and the margin. |
| P8 | Dump operator: written freeze procedure (how `.cloud` is made read-only through the maintenance switch and how the operator proves no write happens after it) and unfreeze procedure, with the switch access confirmed by the `.cloud` owner (**Perlu pengesahan**: the maintenance switch command, from the `.cloud` owner). `.cloud` owner: the read-only account `pp_dump_ro` exists with the grants generated by `dump:grants` (column-level preferred; the table-level fallback is an open LEAD item in AM-10) and is locked; **no MySQL 8 `mandatory_roles` apply to it** (AM-10 section 2 item 5); the unlock and lock for the night are pre-arranged (for example a MySQL event; **Perlu pengesahan**); whether a current read replica exists (not needed at night, **Perlu pengesahan**). Dump operator: `dump:check` run and "rules OK" received (reads no rows), read-only shell access to the `.cloud` storage for the banner file export, beyond the MySQL account (AM-10 section 8.1; **Perlu pengesahan** with the data owner), disk encryption on every machine that will hold a dump (runbook 0 rule 5), mysql client and gpg installed, time-zone line of the check report matches DT-1, and the night PC rule of section 4.6. | 27 Oct | dump operator, `.cloud` owner | A confirmation line per item; the `dump:check` verdict (aggregates). |
| P9 | Switch method decided and rehearsed (item 8 and section 4.4: the DNS switch by the LEAD on 30 Oct; **Perlu pengesahan**: confirm DNS over the earlier own-address-plus-pointer-page method). The DNS time-to-live is lowered at least 24 h before the switch, that is by 29 Oct morning (done on 28 Oct). The switch-back path (section 6.4) is rehearsed too. | 28 Oct | AZ | Switch and switch-back durations; the time-to-live value and the time it was lowered. |
| P10 | **Notice to schools and users of the old system** on 28 Oct: `.cloud` is read-only from about 01:00 MYT on 29 Oct until the new system opens on 30 Oct (the times are approximate; the final times are confirmed in a reminder), that everyone must sign in again and that roster accounts and accounts with a legacy password must set a new password (runbook 17 item 3), and where to get help. Sent by the dump operator (**Decided: LEAD, 22 Oct**, item 6); wording approved by the LEAD. A notice "the new system is open" goes out at C3. | 28 Oct | dump operator | The sent text and time. |
| P11 | Production smoke accounts exist in v2 (student, teacher, parent, admin; **created in v2, not migrated**; used for sign-in checks only; kept or removed by the LEAD's choice after the cutover) and the smoke list of section 4.5 is fixed. The accounts are created **before** the `pre_etl` point (A5), so a restore of `pre_etl` keeps them. | 28 Oct (before `pre_etl`) | QA | The account list (roles only) and the checklist. |
| P12 | One dump operator on the night sitting, **no deputies** (decision 16), plus the LEAD's morning review; a contact list kept outside the repo; no one is woken for a go/no-go. The **access list** of the operator (every **Perlu pengesahan** marker for VPS access, the maintenance switch, the secret store, the storage access) is confirmed as text by 28 Oct 17:30, with a start time and an end time for each right (time-boxed). Support is told to expect a spike in password-reset requests. | 28 Oct | LEAD | The access list as text (no names beyond roles, no secrets). |
| P13 | The LEAD gives the **G6 go/no-go** on 28 Oct (A5): a dated line in the issue that approves the night card, the B9 checklist and the night restore with `--yes` (section 4.6), and reads this list. | 28 Oct | LEAD | A dated line in the issue. |

### 3.1 How the production `stage` step differs from the rehearsal

The rehearsal environment (`up`, `load-dump`, `stage`, `snapshot`, `restore-snapshot`) solves one problem: `staging:load` refuses a database whose name does not end in `_staging`, but `migrate:*` reads `staging_cloud` from the same database it writes to. `stage` loads into a separate `<db>_staging` database and copies the `staging_cloud` and `archive_cloud` schemas into the target with `pg_dump -Fc -n staging_cloud -n archive_cloud | pg_restore`, after dropping the old copies in the target. Production uses the same pattern, with one change forced by retention (below):

1. **A throwaway PostgreSQL 16 server or cluster** (decision 14, **Decided: LEAD, 22 Oct (#109 6340542912)**: stage on the throwaway cluster, #166; never in GitHub or a cloud session): its own data directory on an encrypted volume, no WAL archiving, no PITR, no backups, no replicas, never serving the API, named so its database ends in `_staging`. It is created empty before the load (`slot.sh throwaway-up`) and destroyed with its volume right after the copy in step 3 (`slot.sh throwaway-down`), and at the latest at the cutover sign-off.
2. `slot.sh load --from <dump dir>` there (it runs `staging:load` with `PP_ALLOW_STAGING_RESET=1` and `NODE_ENV=development`; the loader refuses production). It refuses a dump that is not marked raw, is marked anonymised or synthetic, carries a `large_integers` note or holds `.partial` files. No read-only PostgreSQL restore is involved on this route.
3. `slot.sh copy` copies the two schemas from the throwaway cluster into the production target database; it compares table counts (83 in `staging_cloud`, 35 in `archive_cloud`, runbook 12 step 1).
4. `slot.sh throwaway-down` destroys the throwaway cluster and its volume; `slot.sh wipe-dump <dump dir> <FILE.gpg>` deletes the `.gpg` file and the extracted dump directory as soon as the load has succeeded (do not wait for the 7 days); the passphrase is destroyed with them. **Exception:** the extracted `files` directory (AC9) is kept, because the load (B6, B7) still reads it through `--files-dir`; it stays on the migration host (half AZ), outside the repository working tree, with half AZ DevOps as its custodian, and is deleted under section 7 once the activity stage has copied the files.

**Why a separate cluster.** The target must hold `staging_cloud` while `migrate:*` runs, so a raw copy of the `.cloud` data sits inside the production database from the copy until the drop (section 7). Loading in the throwaway cluster keeps the loader's work, temp files and WAL (the biggest and longest-lived copies) off the production server, and leaves only the one copy in the target, whose life is capped in section 7. Option B of decision 14 (not chosen) would stage inside a `_staging` database on the production server instead.

**Production mode is never rehearsed end to end on real data.** The rehearsal environment forces `NODE_ENV=development` for `exec` and the loads, and the ETL refuses anonymised or synthetic data when `NODE_ENV=production`. So the first run of `migrate:*` in production mode on real data is B6 of the night. The measure that lowers the risk: P6 exercises the `PP_MIGRATE_TARGET_DB` guard and the synthetic-data guard with a synthetic fixture, and B6 runs a dry-run (writes nothing) before the apply.

**Half AZ's implementation (#166, `docs/ops/production-migration-slot.md`).** `deploy/vps/migration/slot.sh` builds this step with option A of decision 14 (a throwaway cluster, archive off, database `<db>_staging`; the schema copy with the 83/35 count check; then destroy and wipe). `restore-point.sh` takes `pre_etl`, `pre_delta`, `post_switch` and `post_drop` (each `pg_dump -Fc` with a sha256 and a custody file); `pitr.sh` covers PITR; `slot.sh gonogo` prints evidence lines (section 4.6, B0). It does not cover criterion 9 (the smoke) or criterion 13 (the freeze proof); those stay with their own steps. The B0 disk rule (free space on the receiving host at least 5 times the dump size) is separate; both must hold. The step IDs and criteria there followed the previous version of this plan (A4, A12, B0 to B13); #166 must be updated to the IDs in section 4.0, or the mapping read; if the two disagree, this plan is corrected or #166 is, on #109. Three gaps in #166 are reported to half AZ (**Perlu pengesahan**): (a) `slot.sh gonogo` also checks a `pre_delta` point and prints `MISSING ... -> NO-GO` when there is none, so half AZ takes a `pre_delta` point at the same time as `pre_etl` (identical state, no raw data), or changes the check; (b) `slot.sh etl` accepts a fixed list of commands that does not include `migrate:archive-minimise`; (c) how `--files-dir` and `FILE_STORAGE_DIR` reach the migrate container (P5).

Points **not** covered by the rehearsal script that need half AZ (who own deploys and the VPS):

- The script is built for anonymised data: `load-dump` refuses a dump without an anonymisation attestation, scans for personal data and drops a hit. The cutover loads **real** data from a raw `pp-staging-dump/1` directory (section 3.3) through `slot.sh`.
- The production database platform is the VPS (go-live checklist D-2; decision 10, **Decided: LEAD, 22 Oct**). The restore-point and backup-deletion mechanics in sections 4 and 7 depend on it.
- Role and server hardening for servers that hold real personal data of minors for the migration period (no superuser role, encrypted disk, WAL and backup handling in runbook 5).

### 3.2 Input format and the dump tools (AM-10, PR #125)

- `.cloud` is MySQL. The ETL has no direct MySQL source (runbook 7 item 5). `staging:load` takes exactly one of: a `pp-staging-dump/1` directory (`--from`) or a read-only PostgreSQL restore.
- The AM-10 tools (PR #125) turn `.cloud` into `pp-staging-dump/1`. Run from the repository root as `npm run <tool> -w @pp/api -- <flags>`; output paths are relative to `apps/api` and must be new directories inside a `.migration-out` folder.
  - `dump:check --out <dir>`: preflight; reads no rows (server version, time zones, grants, columns against the spec, row counts).
  - `dump:cloud --out <dir> [--datetime-offset +08:00] [--tables a,b]`: **raw** export in one consistent read-only snapshot. The connection comes from a mode 600 MySQL option file outside the repo (`CLOUD_MYSQL_DEFAULTS_FILE`; `CLOUD_MYSQL_CLIENT` if the client is not on `PATH`); a remote host needs `VERIFY_IDENTITY` or `VERIFY_CA`, otherwise use an SSH tunnel. `DATETIME` values get the offset (default `+08:00`, DT-1: do not change it). It refuses an account with any privilege other than `USAGE`, `SELECT`, `SHOW VIEW` and `SHOW DATABASES` (exit 3, nothing read). Exit 6 means (`dump:produce` refuses the same way, so a rehearsal counts it as a failure too) a row-count mismatch, a bad stream, or an integer of 2^53 or more that would lose precision when the dump is read as JSON (PR #125, round 6; partial output deleted).
  - `dump:produce --work <dir>`: raw, then anonymise, then leak scan, then the raw directory is wiped. For rehearsals only.
  - `dump:wipe --dir <dir>`: overwrite with zeros, then delete.
  - `dump:grants --database <name> --account "'user'@'host'"`: prints the SQL the `.cloud` owner runs (no connection).
- **Production uses the raw `dump:cloud` output**, because the ETL refuses anonymised data in production. Rehearsals use `dump:produce` output, because the rehearsal environment refuses raw data.
- `D_dump` in the duration formula (section 4.3) is the export time of `dump:cloud`. It is measured at the 24 Oct dump sitting and again in the second rehearsal.
- **Perlu pengesahan (AM-10):** that `staging:load` accepts a raw manifest (`raw: true`) from `dump:cloud` (`slot.sh load` checks the marker; the rehearsal on 27 Oct proves the load itself on a raw-marked fixture).

### 3.3 Production raw-data flow (addendum to the AM-10 procedure)

The AM-10 procedure is written for the anonymised rehearsal dump. The cutover needs the raw output as the normal path. This section is the cutover addendum (the same hand-over and wipe rules, applied to a raw directory); it is AM-10 `cloud-dump-procedure.md` section 8 (raw production flow), and the exact command lines are in the night card (section 4.6, B2 and B3).

There is **one** production sitting (the export at B2), by the dump operator on the operator's own machine, alone (decision 16). The `.cloud` owner is not present; the account is unlocked and locked by the arrangement made beforehand (item 9; **Perlu pengesahan**).

1. **No anonymiser key.** Production uses none: steps 1 and 5 of the AM-10 sitting (create and destroy the key) are skipped, `ANON_HMAC_KEY_FILE` is not set, and `dump:produce` and `anonymise:*` are not used. `IC_HASH_KEY` is a different thing (the ETL side) and is **kept**, never deleted.
2. `pp_dump_ro` is unlocked by the pre-arranged event or arrangement (the operator holds no `ALTER USER`). `dump:check` (reads no rows) is the last look and also proves the account works; then `dump:cloud` into a new work directory. Expect exit 0.
3. The account is locked again by the same arrangement after the export (also on a failure). The operator confirms the lock by a refused connection attempt, or reports "lock unconfirmed".
4. Check the output: manifest present and marked raw, no `.partial` left, table and row counts equal the `dump:check` report (the export is frozen, so equal). **Exit 6 (also from `dump:produce` in a rehearsal; row-count mismatch, bad stream, or an integer of 2^53 or more) or exit 130 (interrupted twice) is a stop: that sitting is a no-go.** Wipe the work directory, do not try a workaround on the night, and treat it as trigger R2 (section 6.1); an exit 6 caused by large integers needs a developer fix before any retry. Exit 3 means the account is not read-only (nothing was read).
   - **Files (AC9):** the read-only export of the banner image files for `--files-dir` joins this sitting, with the same encryption, hand-over and wipe rules. The procedure is AM-10 `cloud-dump-procedure.md` section 8.1 (the files travel in the same encrypted archive as the raw dump; it needs read-only shell access to the `.cloud` storage, P8, scoped to the banner directory and removed after the sitting); support-ticket attachments are not exported. An apply also needs `FILE_STORAGE_DIR` (P5): an absolute path to the v2 file storage, separate from the files export; `--files-dir` must be outside the repository working tree and must not contain it, on an encrypted disk. `migrate:all` hands `--files-dir=<files export>` unchanged to the activity dry-run and its apply (#123, runbook 12); B6 and B7 pass it. Without it no file is migrated.
5. **Encrypt** (`tar | gpg --symmetric --cipher-algo AES256`), do the **mandatory listing check**, take the sha256 of the `.gpg` file (exact lines in B3). The passphrase never travels with the file and never goes into GitHub, chat or an AI session. **At night the operator is both sender and receiver** (the operator is alone and runs the VPS steps through `slot.sh`): the operator types the passphrase once on the receiving host to decrypt, and the passphrase is destroyed with the `.gpg` file (night PC rule, section 4.6).
6. **Hand over** (`scp`) to the receiving host, which runs the throwaway staging cluster. **The operator compares the checksum on the receiving host at night** (`sha256sum` there against the sender's value); a mismatch allows one new hand-over, a second mismatch is STOP.
7. **As soon as the checksum matches, the operator runs `dump:wipe --dir "$work"` on the operator PC and deletes the `.gpg` file there** (and closes any SSH tunnel). The operator does not wait for the load. On the receiving host `slot.sh wipe-dump` deletes the extracted `raw` directory and the received `.gpg` file right after `staging:load` succeeds (section 3.1 step 4), except the `files` directory, which stays (half AZ DevOps as custodian) until the activity stage has copied it (section 7).
8. The operator reports aggregates only (date, exit code, tables, total rows, sha256, "local copies deleted") to the LEAD, as text in the issue, in the morning report (section 4.6).

Notes. The raw export is real personal data of minors: no screen sharing, no cloud-sync folder, encrypted disk (runbook 0). If the sitting is interrupted or fails, STOP by the common block of section 4.6 first (wipe, then the rest), and the repeat is decided in the morning (AM-10 section 6 night sitting rule). An interrupted export inside the freeze costs `D_dump` again (section 6.1 trigger R2), but at night it is a STOP, not a repeat.

## 4. Timeline: 24 Oct to 30 Oct

**Reference clock.** `T` = start of the `.cloud` freeze = **29 Oct 2026 01:00 MYT (28 Oct 17:00 UTC)**. This is the LEAD's plan of 22 Oct 22:39 MYT; it takes over from the earlier item 1 (freeze at 30 Oct 01:00) and item 17 (T-1 export at 29 Oct 01:00), which are superseded (section 8). Traffic figures for `.cloud` are **Perlu pengesahan** (the `.cloud` owner can read them). `--as-of` = **2026-10-29** (the MYT date of the export), used in every `migrate:*` run of the plan. Date-dependent rules (for example subscription expiry) are judged as of 29 Oct; this effect is accepted.

### 4.0 Step map and mapping from the previous numbering

| Step | When | What | Old steps |
|---|---|---|---|
| A1 | 24 Oct | PRs merged; AM-10 dump sitting by the dump operator; real-data rehearsal on the rehearsal DB | P1, P2 (new dates) |
| A2 | 25 Oct | Code freeze; release sha re-pinned | P2 |
| A3 | 26 Oct | VPS set up dark: TLS, backups to S3, reference-only seed, registration closed; roles, secrets, PITR base | P3, P4, P5 |
| A4 | 27 Oct | Second rehearsal, production-like and timed; budget; go/no-go criteria written; access list | P6, P7, P8 |
| A5 | 28 Oct | Pre-night: restore points after the final schema migrations (with the migration count check), pre-flight, time-to-live lowered, notice sent, **G6 go/no-go by the LEAD** | A4 (`pre_etl`), A12, A13, P9 to P13 |
| B0 | 29 Oct 00:00 | Pre-flight at night, throwaway cluster up | B0 |
| B1 | 29 Oct 01:00 | Freeze `.cloud` | B1 |
| B2 | after B1 | Export (`dump:check`, `dump:cloud`) | A2 and B2 (one export now) |
| B3 | after B2 | Encrypt, hand over, compare the checksum, wipe | A3, B3 |
| B4 | after B3 | `slot.sh load`, freeze proof | A5 (load), B4 |
| B5 | after B4 | `slot.sh copy`, `throwaway-down`, `wipe-dump` | A5 (copy), B5 |
| B6 | after B5 | `staging:profile`, `migrate:all --dry-run` | A6, A7, A8 |
| B7 | after B6 | `migrate:all --apply` | A9 |
| B8 | after B7 | `migrate:verify`, read-only SQL checks | A10, B8 |
| B9 | latest T+5:30 | Mechanical go/no-go | B9 |
| B10 | after B9 | Close: `.cloud` stays frozen, v2 stays dark, morning report | B13 |
| C1 | 30 Oct morning | The LEAD's review of the night report | (new) |
| C2 | 30 Oct, before the switch | Sign-in smoke on dark v2 with the v2-born accounts | B12 |
| C3 | 30 Oct | DNS switch by the LEAD; notice "the new system is open" | B11 |
| C4 | 30 Oct onward | Monitoring and hypercare | B13 |
| C5 | 30 Oct to 6 Nov, daylight | Q9 export, then `migrate:archive-minimise` | B14a |
| C6 | optional | `migrate:link-questions` | B14 |
| Rehearsal / replan only (4.7) | | idempotency run, delta dry-run and apply | A11, B6, B7, A12 (`pre_delta` use) |
| Not run | | B10 old (decision 15, `list`) | B10 |

### 4.1 Steps

Commands are the `npm run <script> -w @pp/api -- <flags>` forms of runbook 12 in daylight and rehearsals, and the `deploy/vps/migration/slot.sh` forms at night (section 4.6); secrets come from the secret store (P5). "Latest" is the abort rule: if the step has not started or finished by then, stop and apply section 6.

**One source lock.** `migrate:all`, `migrate:delta`, `migrate:rollback` and `migrate:link-questions --apply` share the advisory lock `etl:source:cloud`; a second one started while it is held exits 4. The standalone `migrate:core` and `migrate:activity` do **not** take the lock, so operators use **only `migrate:all`** (and `migrate:delta` in a replan) for loading, never the standalone commands, and never start a load while a rollback runs. `slot.sh etl` refuses the standalone commands.

**Phase A: daylight preparation (24 to 28 Oct, v2 dark, `.cloud` live)**

| Step | Date | Owner | Action | Evidence | Abort rule |
|---|---|---|---|---|---|
| A1 | 24 Oct | LEAD (merges), dump operator, AM, AZ | PRs #122, #123, #125 and #166 merged (P2). The AM-10 dump sitting by the dump operator (`dump:produce`, AM-10 sections 1 to 7; anonymised and leak-scanned). A real-data rehearsal on the rehearsal DB with that dump (P1). | The shas; the timings; exit codes. | A red rehearsal: fix and repeat before A4; if it does not turn green by 27 Oct, the LEAD moves the date (P7). |
| A2 | 25 Oct | LEAD | Code freeze. The LEAD re-pins on the current head; that sha is the release sha. | The sha. | Any change to the ETL after the freeze means a repeat of the rehearsal (P2). |
| A3 | 26 Oct | AZ | The production VPS set up dark: TLS, backups to S3, reference-only seed (`deploy/vps/deploy.sh --seed-reference`), registration closed, migrated to the tip, roles and secrets (P3 to P5), PITR base (`pitr.sh base --label first`). | The checks of P3 to P5 as text. | Anything missing: the LEAD is told on 27 Oct. |
| A4 | 27 Oct | AZ, AM, dump operator, QA, LEAD | Second rehearsal, production-like and timed (P6). The window budget (P7). **The go/no-go criteria of section 5 are written** (confirmed or changed by the LEAD). The access list of the operator (P8, P12). | Timings against section 4.3; the criteria. | Over budget: the LEAD decides (P7). |
| A5 | 28 Oct | AZ, QA, dump operator, LEAD | **Pre-night.** (1) AZ checks that the production database has had its **final schema migrations** (`prisma migrate deploy` applied, `/api/ready` reports migrations applied). (2) Only then AZ takes the restore points: `deploy/vps/migration/restore-point.sh take pre_etl --operator "<role>"`, `... take pre_delta --operator "<role>"` (same state, no raw data; **Perlu pengesahan**, see 3.1) and `deploy/vps/migration/pitr.sh base --label pre_etl`, then `restore-point.sh verify pre_etl` (prints `RESTORE POINT OK: pre_etl ... sha256 matches`). **A restore point is valid only if it was taken after the final schema migrations: a point with fewer migrations than the release fails the migration check on restore** (MIG-07 pass 4: a 33-migration snapshot on a 36-migration tree failed). The check: the number of applied migrations in the point's database state equals the number of folders in `apps/api/prisma/migrations` at the release sha (`ls -d apps/api/prisma/migrations/*/ \| wc -l`), recorded as text. A new schema migration after this point means the points are taken again. (3) The smoke accounts exist before the point (P11). (4) The DNS time-to-live is lowered (P9). (5) The notice is sent (P10). (6) The operator's access list is confirmed by 17:30. (7) The rehearsal dump files are deleted and named: the work directory of the AM-10 sitting, its `.gpg`, the extracted dump and files directories on the rehearsal host, and the passphrase note. (8) **G6 go/no-go by the LEAD at 18:00**: the LEAD reads P1 to P13, approves the night card and the B9 checklist, and **pre-approves the night restore with `--yes`** (`restore-point.sh restore pre_etl --yes`, section 6.3). That is the only go the night needs. | Dated go line in the issue; restore point names, sizes, the migration counts. | No-go: `.cloud` is untouched, nothing to undo; replan (section 6.5). |

**Phase B: the night (29 Oct, `.cloud` frozen from 01:00, v2 dark)**

The exact commands, the expected output and the latest times are in the night card (section 4.6). This table gives the intent.

| Step | Start | Owner | Action | Expected duration | Evidence | Abort rule |
|---|---|---|---|---|---|---|
| B0 | T-60 min: 29 Oct 00:00 (28 Oct 16:00 UTC) | dump operator (alone) | Pre-flight: `slot.sh gonogo`, `restore-point.sh verify` of `pre_etl` and `pre_delta`, the migration count check, the target table counts noted, then `slot.sh throwaway-up`. No go call: the LEAD's go was given at G6. | 30 min | `gonogo` lines read by the B0 rule, counts. | Anything red: do not freeze (nothing changed); morning report. |
| B1 | **T+0:00 = 01:00 (17:00 UTC)** | dump operator (alone) | Switches `.cloud` to read-only or maintenance mode (**Perlu pengesahan**: the `.cloud` maintenance switch command, from the `.cloud` owner) and proves no write happens after it (P8). Records `T-freeze`. | 20 min | Timestamp and the operator's confirmation line. | Not confirmed by T+0:20 (01:20): lift the freeze, stop (nothing changed in v2). |
| B2 | T+0:20 = 01:20 | dump operator (alone) | `dump:check`, `dump:cloud` (the single export, with the files export). Records `T-dump`. | `D_dump` | Timestamp, manifest, exit code. | Exit 6 or 130, or not finished by T+1:10 (02:10): STOP (trigger R2). |
| B3 | after B2 | dump operator (alone) | Encrypt, listing check, sha256, `scp`, checksum compared on the receiving host, wipe of the operator copy. | `D_xfer` | Checksum match, "local copies deleted". | Latest 02:35. Mismatch: hand over again once; second mismatch: STOP. |
| B4 | after B3 | dump operator (alone) | `slot.sh load --from <dump dir>`, then the **freeze proof** (aggregates only): for every staged table with `updated_at`, `max(updated_at) <= T-freeze`. | `D_load` | Exit 0, counts against the manifest; the proof result per table. | Latest 03:05. A value after `T-freeze` is a no-go (criterion 13). |
| B5 | after B4 | dump operator (alone) | `slot.sh copy`, `slot.sh throwaway-down`, `slot.sh wipe-dump`. **This is the first raw data in the production database.** | `D_copy` | `STAGE COPY PASSED: archive_cloud:35 staging_cloud:83`, `THROWAWAY DESTROYED`, `DUMP COPIES DELETED`. | Latest 03:20. |
| B6 | after B5 | dump operator (alone) | `slot.sh etl staging:profile`, then `slot.sh etl migrate:all --dry-run` (production mode, so the synthetic-data guard fails early; on a first load only the core dry-run runs). | about `N_core / r` plus profile | Exit 0, per-entity table for core, reject counts by reason. | Latest finish 03:50. Exit not 0, or the guard refuses: STOP (the fix is a developer task, not an edit in production). |
| B7 | after B6 | dump operator (alone) | `slot.sh etl migrate:all --apply` (the full first load; runs verify at the end). | about `2 x N / r` | Exit 0, run ids, duration. | Latest start 04:00, latest finish 06:00. A failed stage (exit 1): STOP. |
| B8 | after B7 | dump operator (alone) | `slot.sh etl migrate:verify`; read-only SQL checks of section 4.5 part 1. | `D_verify` + 10 min | Exit 0 and `verify pass`; entity and check counts, reject counts by reason. | Latest 06:20. Not exit 0 and `verify pass`: STOP. |
| B9 | **T+5:30 = 06:30 (22:30 UTC) at the latest** | dump operator (alone) | Mechanical go/no-go: the checklist of section 4.6 (B9), pre-approved at G6. All green means the night is a success; any red, or any latest time missed, means STOP and rollback. Nobody is woken. | 15 min | The checklist, each item green or red, as text. | No decision by 06:30 is a no-go. |
| B10 | after B9 (latest T+6:00 = 07:00) | dump operator (alone) | Close: `.cloud` stays frozen (read-only) until the switch; v2 stays dark (no switch at night); the morning report is posted; the common close block runs (night access revoked is confirmed by half AZ in daylight). | 15 min | Timestamp, report. | Report cannot be posted: keep the text for the LEAD. |

**Phase C: 30 Oct and after (daylight; the LEAD and half AZ DevOps)**

| Step | When | Owner | Action | Abort rule |
|---|---|---|---|---|
| C1 | 30 Oct morning | LEAD | Reads the night report and the verify output, accepts the ledger, correct-sum and drift rows (runbook 14 items 1 to 4) and the reject reasons against section 5; decides: switch, or hold. | A "no": `.cloud` is unfrozen and a restore of `pre_etl` is done in daylight (section 6.3); replan. |
| C2 | 30 Oct, before the switch | QA, AZ | Sign-in smoke on dark v2 with the four v2-born smoke accounts (section 4.5 part 2) and the read-only SQL checks again. | A failed check is trigger R4: no switch. |
| C3 | 30 Oct | LEAD, AZ | **DNS switch by the LEAD** (section 4.4). Notice "the new system is open". `.cloud` stays read-only after the switch (D28a). Open self-registration: `REGISTRATION_OPEN=true` in `api.env` + recreate api (production-vps.md section 16); probe 422, not 403. | Switch not complete by the time agreed with the LEAD in A4: trigger R3. |
| C4 | 30 Oct onward | LEAD, AZ | Monitoring and hypercare (section 7). | Triggers R4 to R6. |
| C5 | by 6 Nov, daylight, after the Q9 export | AM, LEAD | **Archive minimisation (decision 18):** first the Q9 export (`migrate:export-question-reports`), then `npm run migrate:archive-minimise -w @pp/api -- --confirm <db> --export-summary <.migration-out/question-reports-open-<stamp>.summary.json>` as a dry-run, then with `--apply`, with `PP_ALLOW_MIGRATE_APPLY=1` and `PP_MIGRATE_TARGET_DB=<db>` (`migrate:archive-minimise` is delivered by #123 (AM-09) and merged with it, `apps/api/src/migration/export/archive-minimise.ts`; the production path through `slot.sh etl` needs half AZ to add it, 3.1). The tool is refused before the Q9 export has run and reports counts only. **This runs before `post_drop`** (section 7). **A failed or refused minimise triggers no rollback**: `archive_cloud` stays as it is; the retry is by a date the LEAD sets (Default: within 2 days), otherwise the LEAD decides. A restore of `pre_etl` after the minimise undoes it, so the Q9 export and the minimise are run again. | Exit not 0 or refused: stop and report to the LEAD. |
| C6 | later, optional | AM | `migrate:link-questions` dry-run, then `--apply` (runbook 12). Cutover never waits for it. | |

### 4.2 Why the freeze comes first

Under the LEAD plan the freeze starts before the export, so the single export is the final state of `.cloud`: there is no second export and no delta to catch up. The delta (runbook 15) re-runs core and activity over the whole fresh dump and takes close to a full run; that cost, and the effect of source deletes between two exports, only matter for a rehearsal or a replan with two exports (section 4.7). At night the full load takes the place of both. Evidence of full-volume cost (MIG-07 pass 3b, #133, synthetic 20k users): a delta with changes took 513 s and a no-op delta 515 s, so size any window from the full-volume time, not from the number of changed rows.

### 4.3 Duration budget (night window)

Formula for the night window `W` (from B1 to the end of B9):

```
sum = D_freeze (B1 to B2, 20 min)
    + D_dump + D_xfer + D_load + D_copy
    + D_profile_dry + D_apply + D_verify (incl. read-only smoke)
    + D_gonogo (15 min)
W   = 1.25 x sum            (the 25 % buffer is inside the window)
D_profile_dry ~ N_core / r
D_apply       ~ 2 x N / r   (core and activity, each a dry-run plus an apply)
```

`N` = number of source rows the ETL reads (known from the `dump:check` report and the manifest counts of B2). `r` = rows per second. The only measured rate today is **3,611 rows/s** (AM-08, AC7, 1M rows, synthetic data, laptop-class VM). Real data, the production disk and the network will differ. **Use 3,611 only as a placeholder; replace it with the A1 and A4 rehearsal figures.**

| Item | Source of the figure | Placeholder (for the estimate below) |
|---|---|---|
| `D_freeze` | Fixed by the plan (B1 to B2) | 20 min |
| `D_dump` (the `dump:cloud` export time, with the file export) | The 24 Oct sitting and the A4 rehearsal | 25 min |
| `D_xfer` (encrypt, listing check, transfer, checksum, wipe) | A4 | 15 min |
| `D_load`, `D_copy` | MIG-07 `timings.log` (loader and `stage-copy`), A4 | 20 min, 10 min |
| `D_verify` with the read-only smoke | MIG-07, A4 | 20 min |
| `D_gonogo` | Fixed | 15 min |
| **Fixed total** | | **125 min** |
| Restore time | MIG-07 and A4 | `<min>` |

There is no switch step at night, so `D_switch` is no longer in the sum; the DNS switch is a daytime step on 30 Oct.

**Maximum night window: Default 6 hours** (T+0:00 to T+6:00 = 07:00; go/no-go at T+5:30 at the latest). The window does not run under school-morning traffic because `.cloud` is frozen and v2 is dark; the LEAD confirms the figure on 27 Oct. **Largest `N` that fits, at the placeholders.** `1.25 x (125 + ETL) <= 360` gives ETL <= 163 min = 9,780 s. With three passes over the data (B6 plus B7), `3 x N / 3,611 <= 9,780`, so **`N` is about 11.7 million rows**. Each minute saved from the fixed 125 adds about 72,000 rows.

Illustration of the ETL part only, at the placeholder rate (these row counts are examples, not observed counts):

| `N` rows | One pass `N / 3,611` | Three passes (B6 and B7 together) |
|---|---|---|
| 1,000,000 | about 4.6 min | about 14 min |
| 3,000,000 | about 14 min | about 42 min |
| 5,000,000 | about 23 min | about 69 min |
| 10,000,000 | about 46 min | about 139 min (fits, tight) |
| 15,000,000 | about 69 min | about 208 min (does not fit) |

Rule (P7): the computed `W` must be at most the maximum window. If `W` does not fit, the LEAD decides before G6 (P7). The window cannot be shortened by editing the ETL on the night.

### 4.4 The switch (C3)

The switch is no longer a night step. Under the interpretation of the LEAD plan, **the LEAD does a DNS switch on 30 Oct after the morning review**, with half AZ DevOps; `.cloud` stays frozen (read-only) until then and after it (D28a). **Perlu pengesahan:** DNS over the earlier own-address-plus-pointer-page method (decision 8, superseded in part). Two ways, both done by the LEAD with half AZ:

- **DNS (the LEAD plan):** DNS or edge routing moves the `.cloud` address to v2. Needs a lowered time-to-live (P9, lowered on 28 Oct) and the switch-back path to be rehearsed; the old address no longer shows `.cloud` read-only for reference after the switch.
- **Own address plus pointer page (earlier decision 8, kept as the fallback):** v2 is published under its own address by half AZ and `.cloud` shows a maintenance page that points to v2. No change to the `.cloud` application code or data. The page is `deploy/cutover/pointer-page/` (static, BM, no tracking; `render.sh`, #166); the LEAD approves its text. The dump operator is not on duty in the daytime, so placing and removing the page needs an operator access that is **Perlu pengesahan**.

Either way: sessions are not migrated (everyone signs in again), the switch is one recorded timestamp, and the switch-back is a recorded action of the same size.

### 4.5 Smoke checks (no sign-in as a real minor)

The team cannot and must not sign in as migrated accounts: roster and legacy-hash accounts are forced to reset their password, and the accounts belong to real minors. Runbook 14 item 8 and runbook 17 item 2 are applied as follows.

1. **At night, before any switch (B8), read-only on the production target.** Health and ready endpoints; SQL checks by surrogate id, counts only: for a deterministic sample of users per role, the migrated practice-session and answer counts equal the staged counts; for a sample of wallets, the balance against the ledger sum equals what the verify report lists; derived JPN/PPD rows equal the distinct state and district pairs; the number of accounts marked for a forced password reset equals the expected number (roster accounts plus accounts with a non-bcrypt or shared default hash; the column name is confirmed by the AM operator). No writes.
2. **On the morning of 30 Oct, before the DNS switch (C2), and again after it.** Health green; the **v2-born smoke accounts** (P11: student, teacher, parent, admin) each sign in, reach their dashboard and, for the student, start the first-login flow; the same SQL checks repeated; error rate and password-reset requests watched. Sign-in checks use only these v2-born accounts.
3. The e2e smoke ran on a restored copy in P6 (it writes data, so never on production). The conformance suite tests the code on its own seeded database, not the restored data, and runs on the release sha in CI or locally.

### 4.6 Night card (single operator)

One person, the dump operator, can follow this card alone at 01:00. Nothing in it needs a second person. Decision 16 (**Decided: LEAD, 22 Oct (#109 6340542912)**): no deputy; every threshold breach or failed step is STOP and rollback by this card; nobody is woken; the LEAD reads the morning report. Times are MYT (UTC in brackets). The release sha is the one the LEAD re-pinned at A2. Commands are run from the repository root on the operator PC (B1 to B3) or on the VPS (B0, B3 receiving part, B4 to B10). `<db>` is the production database name; `slot.sh` reads it from `db.env`. `<work>` is `apps/api/.migration-out/run-<stamp>-final` on the operator PC; `<extract dir>` and `<restricted dir>` are directories outside the repository on the encrypted volume of the VPS; `<dump dir>` = `<extract dir>/raw`; `<files export>` = `<extract dir>/files`. `S` below is `deploy/vps/migration/slot.sh` and `R` is `deploy/vps/migration/restore-point.sh`.

**What `slot.sh` sets for you (checked in `slot.sh`).** `S load` runs `staging:load` with `NODE_ENV=development` and `PP_ALLOW_STAGING_RESET=1` against the throwaway cluster only. Every `S etl ...` runs with `NODE_ENV=production` and `PP_MIGRATE_TARGET_DB=<db>`; `PP_ALLOW_MIGRATE_APPLY=1` is added only when `--apply` is on the command line, and `PP_ALLOW_MIGRATE_ROLLBACK=1` only for `migrate:rollback`. Nothing is set permanently. The operator does not export them by hand. `S etl` accepts `staging:profile`, `migrate:all`, `migrate:delta`, `migrate:verify`, `migrate:rollback`, `migrate:link-questions` and `migrate:export-question-reports` only. One `--confirm <db>` form (a space, not `=`) is used throughout.

**Night PC rule.** The export is made on a PC where: no AI agent and no cloud session runs or has run during the sitting (no agent CLI, no chat client with an agent, no cloud IDE, no screen sharing); the disk is encrypted; no cloud-sync folder holds `<work>`. The gpg passphrase is a fresh one, kept only in the operator's head or on paper, typed once on the VPS at B3, and **destroyed** (paper shredded) as part of the common close block. A file that must reach the LEAD (for example an ids file or a check report; at night under this plan none is produced, because there is no delta) reaches the LEAD **out of band**: encrypted, by a channel the LEAD names, never through GitHub, chat or an AI session (**Perlu pengesahan**: the channel).

**Night access (time-boxed).** The operator's rights are given for the sitting only and have an end time: the VPS (SSH user, `slot.sh`, `restore-point.sh`, `pitr.sh`, timers), the `.cloud` maintenance switch, per-run access to the secret store, the read-only storage access, the SSH tunnel to `.cloud`. They end at 07:00 MYT on 29 Oct (T+6:00) or at the close, whichever is first. The operator does **not** hold `ALTER USER` on production MySQL: the unlock and lock of `pp_dump_ro` are pre-arranged by the `.cloud` owner (for example a MySQL event unlocking at 01:15 and locking at 02:30; **Perlu pengesahan**). Half AZ revokes the VPS rights and the `.cloud` owner revokes the maintenance-switch access in daylight; both confirm "night access revoked" as text for the sign-off (section 7).

**Before the night (daylight, not part of the card).** At A5 (28 Oct): the restore points were taken after the final schema migrations and their migration count equals the release sha's folder count; the smoke accounts exist; the LEAD approved this card, the B9 checklist and the night restore with `--yes`; the access list below is confirmed. **Perlu pengesahan** (access the operator may not have; none is invented here): (a) VPS access for `S`, `R`, `pitr.sh` and the timers; (b) the `.cloud` maintenance switch, with its freeze and unfreeze commands (the `.cloud` owner gives them, P8); (c) the pre-arranged unlock and lock of `pp_dump_ro`; (d) shell access on the migration host and the receiving host, and per-run access to the secret store; (e) how `--files-dir` and `FILE_STORAGE_DIR` reach `S etl` (P5). If any is missing at G6, the night is a no-go.

**Steps.** Each step: run the command, check the expected output, check the latest time. If the output or the time is not as written, **STOP**.

| Step | Command (exact) | Expected | Latest time | If not |
|---|---|---|---|---|
| B0 | `S gonogo`; `R verify pre_etl`; `R verify pre_delta`; the migration count check (applied migrations in the database equal `ls -d apps/api/prisma/migrations/*/ \| wc -l` at the release sha); note the target table counts; then `S throwaway-up`. Stop the timers: `sudo systemctl stop pp-backup.timer pp-restore-drill.timer` | Read `gonogo` by the rule below. `RESTORE POINT OK: pre_etl ... sha256 matches` and the same for `pre_delta`. `THROWAWAY UP: container ..., database <db>_staging, ... archive_mode=off` | start 00:00 (16:00 UTC), done 00:55 | STOP (nothing changed: do not freeze) |
| B1 | Switch `.cloud` to read-only: **Perlu pengesahan**: the `.cloud` maintenance switch command, from the `.cloud` owner. Run the P8 proof that no write happens. Note `T-freeze` | Operator's confirmation line and `T-freeze` as an ISO 8601 time with +08:00 | 01:20 (17:20 UTC) | Lift the freeze (the unfreeze command, same owner); STOP |
| B2 | `npm run dump:check -w @pp/api -- --out .migration-out/check-<stamp>`; `work="$PWD/apps/api/.migration-out/run-<stamp>-final"`; `mkdir -m 700 "$work"`; `npm run dump:cloud -w @pp/api -- --out "$work/raw"`; the banner files export into `"$work/files"` with `SHA256SUMS` (AM-10 section 8.1); confirm the lock of `pp_dump_ro` by a refused connection or write "lock unconfirmed"; note `T-dump` | `dump:check` "rules OK"; `dump:cloud` exit 0; manifest present and marked raw, no `.partial`, counts equal the check report | 02:10 (18:10 UTC) | STOP (exit 6 or 130 is a no-go; a locked account at `dump:check` is a STOP) |
| B3 | `name="pp-cutover-dump-<stamp>.tar.gz.gpg"; out="$work/$name"`; `( set -o pipefail; tar -C "$work" -czf - raw files \| gpg --symmetric --cipher-algo AES256 -o "$out" ); echo "exit $?"` (must be 0); `( set -o pipefail; gpg --decrypt "$out" \| tar -tzf - \| wc -l ); echo "exit $?"` (must be 0; the count equals the entries under `raw` and `files` plus the two directories); `sha256sum "$out"`; `scp "$out" <user>@<receiver host>:<restricted dir>/`; on the VPS `sha256sum <restricted dir>/$name` (compared by the operator); `mkdir -m 700 <extract dir>`; `( set -o pipefail; gpg --decrypt <restricted dir>/$name \| tar -xzf - -C <extract dir> )` (the extraction form, the inverse of the listing line); then on the operator PC `npm run dump:wipe -w @pp/api -- --dir "$work"` and delete the local `.gpg` if it is outside `$work`; close the tunnel | Both exits 0; the two sha256 values are equal; `<extract dir>/raw/manifest.json` exists; "local copies deleted" | 02:35 (18:35 UTC) | One new hand-over; a second mismatch is STOP |
| B4 | `S load --from <extract dir>/raw`; then the freeze proof: for every staged table with `updated_at`, `max(updated_at) <= T-freeze` (**Perlu pengesahan**: half AZ gives the one-line read-only form; `slot.sh` has no subcommand for it) | `LOAD DONE: archive_cloud:35 staging_cloud:83 in <db>_staging, duration_s=...`; counts equal the manifest; the proof holds for every table | 03:05 (19:05 UTC) | STOP (a value after `T-freeze` is a no-go, criterion 13; a refused manifest is a STOP) |
| B5 | `S copy`; `S throwaway-down`; `S wipe-dump <extract dir>/raw <restricted dir>/$name` | `STAGE COPY PASSED: archive_cloud:35 staging_cloud:83`; `THROWAWAY DESTROYED: container ... removed`; `DUMP COPIES DELETED: raw and <name>` | 03:20 (19:20 UTC) | STOP (a count other than 83/35 is reported and stops the night) |
| B6 | `S etl staging:profile`; `S etl migrate:all --dry-run --as-of=2026-10-29 --files-dir=<files export>` | `ETL STEP staging:profile exit=0`; `ETL STEP migrate:all exit=0`; per-entity table for core; reject counts by reason | 03:50 (19:50 UTC) | STOP |
| B7 | `S etl migrate:all --apply --as-of=2026-10-29 --files-dir=<files export>` (`FILE_STORAGE_DIR` per P5) | `ETL STEP migrate:all exit=0`; run ids; the end-of-run verify | start 04:00 (20:00 UTC), done 06:00 (22:00 UTC) | STOP |
| B8 | `S etl migrate:verify`; the read-only SQL checks of section 4.5 part 1 | **Exit 0 and a line `verify pass`** (the gate is the exit code and the word `pass`, not a count of entities or checks; the numbers n and m are reported and compared with the A4 rehearsal for information only); SQL counts equal the verify report | 06:20 (22:20 UTC) | STOP |
| B9 | `S gonogo` again, and the checklist below | `throwaway: none running`; `stage: archive_cloud:35 staging_cloud:83`; the other lines by the B0 rule; checklist all green | 06:30 (22:30 UTC) | STOP |
| B10 | Leave `.cloud` read-only; v2 stays dark; start the timers: `sudo systemctl start pp-backup.timer pp-restore-drill.timer`; run the common close block (below); post the morning report | Report posted; `.cloud` still read-only | 07:00 (23:00 UTC) | If the report cannot be posted, keep the text for the LEAD |

**Reading `slot.sh gonogo` (B0 and B9).** The script prints plain lines; the real words are `NO-GO`, `MISSING` and `PITR off`. The rule: **no line contains `NO-GO`, `MISSING` or `PITR off`**, and the `api` line ends in `-> 200`. A `PITR off` line is a **STOP with no waiver at night** (the script's own text mentions a waiver; that is for daylight and is not available to the operator). A line `PITR on, last archived WAL ... failed_count N` needs `failed_count 0` (a growing count is a STOP). `disk: N% free` must be above 30 (else the line says `NO-GO`). The `throwaway:` line reads `throwaway: none running` **before** `S throwaway-up` (at B0 first run, expected) and again at B9; a line saying `STILL RUNNING` at B9 means the cluster was not destroyed: run `S throwaway-down` and STOP the night's close until it is confirmed. At B0 the `stage:` line shows the counts before the copy (not yet 83/35). The `backup:` line must show a dump younger than 24 hours.

**B9 checklist (mechanical; the LEAD pre-approves it in daylight at G6).** All criteria green means success. Any red, or any latest time missed, means STOP + rollback; nobody is woken. There is no waiver at night.

| # | Item | Green when |
|---|---|---|
| 1 | Criterion 1 | `migrate:verify` exit 0 and a `verify pass` line |
| 2 | Criteria 2 and 3 | Rejects inside 0.1 % (users, schools) and 0.5 % (others); `ORPHAN_PARENT` on users and schools is 0; no reason on the list of reasons the A4 rehearsal found that the LEAD did not accept |
| 3 | Criterion 4 | The orphan scan reports 0 |
| 4 | Criterion 5 | Not applicable at night (no delta; rehearsal / replan only, 4.7) |
| 5 | Criterion 6 | The ledger, correct-sum and drift rows are the rows the LEAD accepted in the A4 rehearsal; any new row is red |
| 6 | Criterion 7 | Elapsed time is at most T+5:30 and no latest time of the card was missed |
| 7 | Criterion 8 | `S gonogo` shows `pre_etl` and `pre_delta` with sha256 ok, and PITR on (no `PITR off`) |
| 8 | Criterion 9 | The B8 read-only checks pass |
| 9 | Criterion 10 | The rehearsal timings (P6) exist and the access list is confirmed (G6) |
| 10 | Criterion 11 | The dated housekeeping plan exists (G6), including the list of backups of section 7 |
| 11 | Criterion 12 | Not applicable at night (rehearsal / replan only, 4.7) |
| 12 | Criterion 13 | The freeze proof of B4 passed for every table |

**Stop-condition table.** Each row is a STOP. After the STOP, run the common block, then the rollback case.

| # | Stop condition | Action |
|---|---|---|
| S1 | A threshold breach: a criterion 2, 3 or 4 breach at B8 or B9 (and, in a replan with a delta, a criterion 5 row or a `deleted_at_source_ratio` failure, decision 4b: AND, pending the LEAD's reply, #109 6341421182) | STOP, rollback |
| S2 | `migrate:verify` is not exit 0 with `verify pass` | STOP, rollback |
| S3 | Any step exits with a non-zero code (including 1, 6 and 130) | STOP, rollback |
| S4 | A lock is refused (exit 4: another `migrate:*` holds `etl:source:cloud`) | STOP, rollback; do not start a second load |
| S5 | A guard refuses (exit 2 or 3: target guard, synthetic-data guard, read-only account check, `slot.sh` manifest check) | STOP, rollback |
| S6 | A latest time is missed. All the times of the card: B0 not done by 00:55; B1 not confirmed by 01:20; B2 not finished by 02:10; B3 by 02:35; B4 by 03:05; B5 by 03:20; B6 by 03:50; B7 not started by 04:00 or not finished by 06:00; B8 by 06:20; no go/no-go by 06:30; B10 not closed by 07:00 | STOP, rollback |
| S7 | Any red item in the B9 checklist, a checksum that fails twice, a `gonogo` line by the STOP rule (including `PITR off`), or any doubt about the output, the data or the access | STOP, rollback |

**Common to every STOP.** Before any rollback case, in this order (this matches AM-10 section 6, the night sitting rule). Do not skip an item because the STOP came early; an item that does not apply is recorded as "not applicable".

1. On the operator PC: `npm run dump:wipe -w @pp/api -- --dir "$work"`, then check that `$work` is gone.
2. Delete the `.gpg` file (the local copy).
3. On the VPS: `S wipe-dump <extract dir>/raw <restricted dir>/$name` and `S throwaway-down`.
4. Lock `pp_dump_ro` (the pre-arranged event or arrangement has locked it, confirmed by a refused connection), or report "lock unconfirmed".
5. Close the SSH tunnel.
6. Close the terminal, which holds the passphrase (and destroy the passphrase note).

The morning report confirms each of the six items.

**Rollback procedure at night (restore `pre_etl`).** Write down the time and the step. Do not improvise. The rollback point at night is **`pre_etl`**, taken after the final schema migrations and before the load. The night rollback is: **restore `pre_etl`, unfreeze `.cloud`, and v2 stays dark.**

*Case 1: STOP before the load (B0 to B5, before the first raw data is in the production database, that is before `S copy`).*

1. B0 red or before B1: nothing changed. Stop there, run the common block, post the report.
2. Unfreeze `.cloud` first (the unfreeze command: **Perlu pengesahan**, same owner as B1), record `T-unfreeze`. Confirm: `.cloud` accepts writes again (the operator's check).
3. v2 is untouched: compare the table counts of the target with the counts noted at B0. Confirm: counts equal. No restore is needed.

*Case 2: STOP after the copy (B5 done, B6 to B9), the raw copy and possibly migrated rows are in the production database.*

1. Common block first. Unfreeze `.cloud` (as Case 1 step 2). **`.cloud` is unfrozen before the v2 clean-up**; the unfreeze does not wait.
2. Verify the point: `R verify pre_etl`. Confirm: the line `RESTORE POINT OK: pre_etl file=... sha256 matches, <n> tables with data`.
3. Restore: `R restore pre_etl --yes` (pre-approved by the LEAD at G6; **Perlu pengesahan**: VPS access). Confirm: exit 0 and the final line `RESTORED: pre_etl (...) in <N> s. api and frontend stay stopped: check the counts, then follow the cutover plan ...`.
4. Confirm the state: the table counts equal the counts of the point (noted at B0), `legacy_source = 'cloud'` counts are 0, and no `staging_cloud` schema is left. `migrate:verify` is **not** run after a `pre_etl` restore (the database holds no migrated users); for a restore of a migrated state (a rehearsal or a replan point) the confirmation is `S etl migrate:verify` with exit 0 and `verify pass`, and counts equal to the point.
5. **v2 is down after a restore and stays dark.** `R restore` stops `api` and `frontend`. At night v2 is not public before the DNS switch, so **no restart is needed** and none is done at night. If a restart is wanted in daytime (for example for the C2 smoke of a later attempt): start the api and the frontend again with the deploy script of #166 (`deploy/vps/deploy.sh`, whose step 6 brings `api` and `frontend` up and waits healthy; the LEAD types the confirmation) and confirm that **`/api/ready` returns 200** (also visible in the `api:` line of `S gonogo`). #166 gives no separate "start" subcommand; the exact restart line is **Perlu pengesahan** with half AZ.
6. Only if the restore fails: `S etl migrate:rollback --confirm <db>` (dry-run), then the same with `--apply` (runbook 16, Procedure B; `slot.sh` sets `PP_ALLOW_MIGRATE_ROLLBACK`, `PP_ALLOW_MIGRATE_APPLY` and `PP_MIGRATE_TARGET_DB` itself for this command). Then `npm run be:db:seed`. Confirm: per-table counts equal the point, `legacy_source = 'cloud'` counts are 0. Do not run `migrate:verify` after this rollback. Then STOP: no further action.
7. Drop the raw copy if it is still there: it is gone with a restore of `pre_etl`; with `migrate:rollback` the `staging_cloud` schema is dropped by half AZ under the retention cap (section 7).

**Confirmation lines.** The production confirmation of a restore is: `restore-point.sh restore` exit 0 with the `RESTORED: <name> ...` line, then (for a migrated point) `migrate:verify` pass, and the counts equal to the point. `RESTORE POINT OK: <name> ... sha256 matches` is the line of `verify`. The lines `MIGRATION CHECK PASSED` and `ROLLBACK VERIFIED` belong to the rehearsal script (`rehearsal-db.sh restore-snapshot`) and are **MIG-07 evidence only** (#133: `ROLLBACK VERIFIED`, `MIGRATION CHECK PASSED` 33/33); they are never expected from the production scripts.

*Measured timings (MIG-07, #133, `docs/ops/mig07-rehearsal-report.md`, synthetic 20k users; real data will differ):* `migrate:rollback --apply` 19 s; restore `pre_etl` 5.5 s and 4.4 s; restore `after_full` 16.7 s; delta apply 513 s (a no-op delta takes as long).

**What to post on #109 for the LEAD in the morning.** Aggregates only; no names, no ids, no secrets.

```
Night report <date>:
timestamps (MYT): B1 <T-freeze>, B2 <T-dump>, last step reached <Bn> at <time>, end <time>
step reached: <Bn>
decision: success | stop
stop condition: <S1..S7 | none>
exit codes: <step: code, ...>
verify: <exit 0 + pass | other>, <n> entities, <n> checks
counts: rejects <n> by reason
gonogo (B0, B9): <lines read by the rule; any line outside the rule>
common block: 1 work dir gone <yes|no>; 2 .gpg deleted <yes|no>; 3 wipe-dump and throwaway-down <yes|no>;
  4 pp_dump_ro locked <confirmed|lock unconfirmed>; 5 tunnel closed <yes|no>; 6 terminal closed, passphrase destroyed <yes|no>
rollback done: yes | no; case <1 | 2>; confirmation lines: <RESTORE POINT OK / RESTORED / counts equal / verify pass where it applies>
.cloud unfrozen: yes | no (time)   (on success: no, it stays read-only until the DNS switch)
v2: dark (not public)
```

### 4.7 Delta and idempotency (rehearsal / replan only)

The delta is **not run at night**. It is kept for rehearsals (P1, P6) and for a replan that needs two exports (for example a retry after a restore of a migrated point, section 6.5).

- **Idempotency run (old A11):** `NODE_ENV=production`, `PP_ALLOW_MIGRATE_APPLY=1`, `PP_MIGRATE_TARGET_DB=<db>`, `FILE_STORAGE_DIR`: `migrate:delta --since=<T-dump1> --as-of=<date> --files-dir=<files export>` (dry-run), then the same with `--apply`, against the same stage. Expected: every row `unchanged`. It measures the real rate `r`.
- **Delta dry-run and apply (old B6, B7):** the same command with the second export. The activity stage may show "skipped" (runbook 15, notes). `migrate:delta` exits 2 on a database with no migrated users: a re-load there is `migrate:all --apply`.
- **Source deletes are not propagated by the delta** (runbook 15): a row removed in `.cloud` after the first export stays in v2. With the freeze first there is no such gap at night.
- **Reading the verify lines (delta only).** `deleted_at_source:<entity>` counts are reported and never fail on their own; a `deleted_at_source_ratio:<entity>` line with status `mismatch` fires above 5 % of the entity's target count AND above 100 rows (decision 4b; `verify/index.ts:176` on #123) and is a STOP in a replan, usually meaning a truncated or wrong re-stage. The ids of such rows (at most 200 per entity, a sample) go to a mode 0600 file `.migration-out/deleted-at-source-*.json`, real data, never printed or posted, handed to the LEAD out of band and deleted within 7 days of reading.
- The criterion 5 check table of section 5 is filled from the `migrate:delta` report in such a run.

## 5. Go/no-go criteria

These are runbook 14 made final. At night they are checked at the decision point (B9); the LEAD checks them again at C1. The same table is applied to the rehearsals (A1, A4). All must hold. A criterion with no evidence counts as not met. **The LEAD decides.** The LEAD may waive a criterion only in writing in the issue, with the reason (runbook 14), and only in daylight (G6, C1); there is no waiver at night.

| # | Criterion | Measure (final) | Evidence |
|---|---|---|---|
| 1 | Verification | `migrate:verify` exits 0 and prints `verify pass`: every entity `ok`, no check `mismatch` or failed. | Status line, entity and check counts. |
| 2 | Rejects reviewed and inside the threshold (decision 4a, **Decided: LEAD, 22 Oct**) | Every reason (`UNKNOWN_ENUM`, `ORPHAN_PARENT`, `DUPLICATE_KEY`, `INVALID_VALUE`, `UNSUPPORTED`) per entity is listed and explained. Rejected rows at most **0.1 %** of source rows for `users` and `schools` and at most **0.5 %** per other entity. Rejected users are listed by surrogate id (each has no login until fixed; the duplicate caveat in MIG-03 Q2). | The list of reason and count, as text. |
| 3 | No lost users or schools | `ORPHAN_PARENT` rejects on `users` and `schools` are **0**. | The count. |
| 4 | Orphan scan | The v2-side foreign key scan reports **0**. | The count. |
| 5 | Delta consistent (**rehearsal / replan only**; thresholds: decision 4b, **Decided: LEAD, 22 Oct (#109 6340542912)**: 5 % / 100 rows; AND, pending the LEAD's reply, #109 6341421182) | For each entity with `updated_at`, the gap between the staged rows with `updated_at` after `T-dump1` and the delta's inserted plus updated fails when it is above 5 % AND above 100 rows (the rule stays AND, as in the code, `verify/index.ts:176`, #123). Not applicable at night (no delta). A breach in a replan is STOP + rollback (section 6.1 R1). | The criterion 5 table, filled from the `migrate:delta` report. |
| 6 | Ledger and drift accepted | Each ledger-sum, correct-sum and accepted-drift row is read and accepted; nothing was corrected to make totals agree. | One accepted line per row. |
| 7 | Timings in the window | At the decision point the elapsed time is at most T+5:30, and every latest time of the night card was met. | Elapsed time and durations. |
| 8 | Backups before the first write | Restore points `pre_etl` and `pre_delta` exist, were taken **after the final schema migrations** (their migration count equals the release sha's folder count), and a restore of a restore point has been proven in P6; PITR is on (**`PITR off` is a STOP at night, no waiver**); the points are newer than the last write to the production target before the first write of Phase B (the stage copy, B5). | Backup names and times; the `slot.sh gonogo` lines (#166: restore points, PITR, backup age, disk); the migration counts. |
| 9 | Smoke | **At night (B8):** the read-only checks of section 4.5 part 1 pass. The e2e smoke passed in P6 against a restored copy of the target, and the conformance suite passed on the release sha. **On 30 Oct (C2, and after the switch):** section 4.5 part 2. | The B8 result; the real tail of the P6 test output. |
| 10 | Rollback ready | The restore steps and the switch-back of section 6 are rehearsed (P6, P9) with durations; the operator has the access. | The rehearsal timings. |
| 11 | Housekeeping plan | Dates for the deletions of section 7 are written, including the list of backups and WAL taken while `staging_cloud` exists and between the load and the minimise. | The dated plan. |
| 12 | Source deletes known and small (**rehearsal / replan only**) | After a delta, `migrate:verify` reports `deleted_at_source:<entity>` per entity (reported, not failing). No `deleted_at_source_ratio:<entity>` check fails (above **5 %** AND above **100** rows; decision 4b; `verify/index.ts:176`, #123). Not applicable at night (the freeze comes first). Decision 15 is `list`: rows deleted at `.cloud` are listed in the reconciliation report and are never deleted in v2 (no old B10; `erase` cannot run in the window). | The counts as text. The ids file stays out of GitHub and chat and is deleted within 7 days of reading (section 7). |
| 13 | `.cloud` was still | For every staged table with `updated_at`, `max(updated_at) <= T-freeze` in the stage (B4), and the dump operator's confirmation line exists. | The per-table result; the confirmation. |

**Criterion 5 check table (replan only).** The operator fills this in from the `migrate:delta` report, one row per entity with `updated_at`. "Staged changed" = staged rows with `updated_at` after `T-dump1`. Gap = absolute difference between "staged changed" and "inserted + updated". Gap % = gap divided by "staged changed" times 100 (if "staged changed" is 0 and the gap is above 0, gap % is 100). **Within** if gap is 100 rows or fewer, or gap % is 5 or less. **STOP** only if gap is above 100 rows AND gap % is above 5.

| Entity | Staged changed | Inserted | Updated | Inserted + updated | Gap (rows) | Gap % | Within / STOP |
|---|---|---|---|---|---|---|---|
| `<entity>` | | | | | | | |
| `<entity>` | | | | | | | |

Note: the LEAD was asked about AND vs OR on #109 (6341421182); Default AND until answered. The same AND rule applies to criterion 12.

Any "no" is a no-go: section 6. At night a "no" is STOP + rollback with nobody woken (section 4.6); a written waiver is possible only in daylight (G6, C1).

## 6. Rollback

### 6.1 Triggers (each measurable)

| ID | Trigger | When |
|---|---|---|
| R1 | A stage of `migrate:all` exits not 0, or `migrate:verify` is not exit 0 with `verify pass`, or the orphan scan is above 0, or any criterion of section 5 that applies at night is red at B9 (in a replan with a delta, also a criterion 5 or 12 breach, decision 4b). | Any time before the switch |
| R2 | A step misses its latest start or finish in section 4.6 (including an export that fails; at night it is a STOP, not a repeat), or the projected end passes T+6:00. | Any time before the switch |
| R3 | The DNS switch is not complete at the time agreed with the LEAD (A4). | C3 |
| R4 | A smoke check fails: health endpoint not green, a v2-born smoke account of any role cannot sign in, an SQL check of section 4.5 differs from the verify report (counts for a sampled surrogate id, wallet against ledger). | C2, or after the switch |
| R5 | Support or monitoring shows a wrong-data pattern (the same wrong figure for many accounts), or the 5xx rate stays above 2 % of requests for 10 minutes (**Decided: LEAD, 22 Oct**, item 11). | After the switch |
| R6 | A suspected PDPA incident touches the loaded data or a dump (runbook 0 rule 8; AM-10 section 5). Report to the LEAD at once. | Any time |

### 6.2 Decision deadline (point of no return)

- **At night and before the switch:** the dump operator stops alone by the stop-condition table of section 4.6 (decision 16). After the night the LEAD can stop at any step (C1, C2); nothing user-visible has changed except the `.cloud` freeze, and `.cloud` stays frozen until the LEAD unfreezes it.
- **After the DNS switch:** the LEAD may still roll back until **switch time + 4 hours** (Decided: LEAD, 22 Oct, item 3; for a switch at 09:00 MYT that is 13:00 MYT). After that v2 is the system of record and problems are fixed forward. Risk for the LEAD: the longer v2 is live, the more data exists only in v2, and a switch in the school morning meets the highest traffic. The LEAD chooses the switch time.

### 6.3 Procedure

**Night (v2 dark).** The operator restores `pre_etl`, unfreezes `.cloud` and leaves v2 dark: section 4.6, "Rollback procedure at night". Service is not at risk (v2 was never public), only the freeze lasts. The LEAD decides any retry in the morning (section 6.5).

**Daytime before the switch (the LEAD decides at C1 or C2).**

1. The unfreeze of `.cloud` comes first and does not wait for the v2 clean-up. Communicate: "maintenance extended, no data lost" (6.5).
2. v2 clean-up, by the LEAD's choice, in order of preference:
   - **R-a: restore `pre_etl`** (`R restore pre_etl`, the LEAD types the database name or approves `--yes`; half AZ runs it). Holds no real data.
   - **R-b: `migrate:rollback`** (runbook 16, Procedure B: the production database holds v2-born rows such as staff and smoke accounts, so Procedure A, dropping the database, is not used). Both the dry-run and the apply need, in every environment, `PP_ALLOW_MIGRATE_ROLLBACK=1`, `PP_ALLOW_MIGRATE_APPLY=1`, `PP_MIGRATE_TARGET_DB=<db>` and `--confirm <db>`, and `--confirm` and `PP_MIGRATE_TARGET_DB` must both equal the database name (a missing or wrong value exits 2); `S etl migrate:rollback --confirm <db>` sets the first three itself. Dry-run first, then `--apply`; the dry-run runs the deletes and rolls them back, so it **takes row locks** on the migrated tables: run it when no load and no heavy traffic is running, and never start a load during a rollback. The rollback also closes failed apply runs and their checkpoints, so a re-apply starts fresh. It refuses with `RollbackRefusedError` (exit 2, no change) while an apply run is `running` in `etl_runs`: confirm no load is active, mark that run `failed`, then retry. A refusal because a v2-born row references a migrated row also changes nothing; the LEAD decides.
3. After a `migrate:rollback`, re-run the idempotent seeds (`npm run be:db:seed`) to restore adopted seed rows. Prove the result as runbook 16 says: per-table counts equal the point, `legacy_source = 'cloud'` counts are 0. Do not run `migrate:verify` after a rollback.
4. Before any new apply, run a fresh dry-run; the earlier dry-run no longer counts (runbook 16). After a `migrate:rollback` or a restore of `pre_etl` the database has no migrated users, so the re-load is `migrate:all --apply` after a new freeze and a new export; `migrate:delta` exits 2 there.
5. **A restore of `pre_etl` after the minimise (C5) undoes it**, because the point holds the unminimised archive: the Q9 export and `migrate:archive-minimise` are run again after the next load.
6. `staging_cloud` and the restore points are kept under the retention cap of 6.5 and section 7.

**After the DNS switch (R4 to R6, within the deadline).** This is a daytime procedure with the LEAD and half AZ DevOps; the dump operator is not on duty.

1. Half AZ DevOps **stops writes first**: the API is stopped, or draining (`/api/ready` answers 503 while the process drains after a shutdown signal), **or** the edge blocks writes (half AZ, per #166). The API itself has no maintenance state. Half AZ then checks that writes have stopped: a SQL count of a write-heavy table (for example practice answers) does not change over 1 minute (counts only). Then half AZ takes a **`post_switch` backup** (`R take post_switch`) so the v2 data is kept for analysis whatever happens next (retention, encryption and access in section 7, row "v2 data kept after a rollback"), then switches DNS back (section 4.4). The `.cloud` freeze is lifted by the dump operator or the `.cloud` owner on the LEAD's request (`.cloud` was kept intact and read-only, so its data is as it was at `T-freeze`); until then it stays read-only.
2. Do not delete the v2 data now; keep it as it is for analysis, under the retention rule of section 7. A `post_switch` backup taken while `staging_cloud` still exists in the target also holds a raw copy of `.cloud`, so the stricter deadline applies: it is deleted at the `staging_cloud` drop deadline (6 Nov 2026) if that comes first, otherwise 30 days after the rollback.
3. Restore `pre_etl` (R-a) or `migrate:rollback` (R-b) as the LEAD chooses, after the `post_switch` backup.
4. **What is lost, honestly:** anything written in v2 after the switch (registrations, practice, password resets, new content) is not in `.cloud`. There is no reverse migration, none is planned in this plan, and any such data is lost or must be re-entered by hand. Users who set a new password in v2 will use the old one again in `.cloud`. The LEAD accepts this risk when choosing the switch time (section 6.2).
5. A later retry needs a fresh decision: v2 now holds v2-born rows, so `migrate:rollback` may refuse (R-b). The LEAD decides between a clean database restore (`pre_etl`, losing the v2-born rows) and another load on top.

### 6.4 Timings

Restore and switch-back durations come from MIG-07 and P6 (placeholders: switch back `<min>`, unfreeze `<min>`). Measured in MIG-07 (#133, `docs/ops/mig07-rehearsal-report.md`, synthetic data, 20k users): `migrate:rollback --apply` 19 s; restore of `pre_etl` 5.5 s and 4.4 s; restore of `after_full` 16.7 s; delta apply 513 s (a no-op delta takes as long). Service is back for `.cloud` users at the end of the unfreeze (before the switch) or of the switch-back plus the unfreeze (after the switch). Both are recorded in P6 and written next to the go/no-go line.

### 6.5 Communication and replan

| When | Message | By |
|---|---|---|
| Freeze extended or cutover aborted | "The maintenance window is extended or cancelled; `.cloud` is available again; no data is lost; a new date will be given." | The dump operator (item 6), text approved by the LEAD |
| Rollback after the switch | Same plus "anything done in the new system after <time> is not kept; please repeat it." | Same |
| Replan after an abort | New date and window. After a restore of `pre_etl` the next attempt is a new night: a new freeze, a new export, `migrate:all --apply`. Any change to `--as-of` or the key means a clean start. The delta is used only if the LEAD approves a plan with two exports (4.7). | LEAD |

**Retention cap after an abort and replan.** Raw data in `staging_cloud` and the raw-data restore points are capped at **7 days from the first raw load** (the stage copy, B5), or they need a **new dated plan approved by the LEAD**. A restore of `pre_etl` removes the raw copy at once; a restore of a point that holds it does not. Half AZ reports the first raw load date and the cap date in the morning after any abort.

Write the decision, the trigger id, the times and the counts as text in the issue (no data).

## 7. After cutover

Retention follows the MIG-03 decisions (LEAD, all defaults, 21 Oct 2026), runbook 0, 17 and 18, and the AM-10 procedure section 4. Dates are computed from the first raw load on 29 Oct 2026 and the DNS switch on 30 Oct 2026; if either is later, the dates move with it. **Perlu pengesahan** (the LEAD): the cap is 7 days from the first raw load, which with a load on 29 Oct is 5 Nov; the previous version and #166 use 6 Nov 2026, and this version keeps 6 Nov as the outer date until the LEAD confirms or moves it.

| Item | Rule | Owner | Date |
|---|---|---|---|
| Raw dump copies | The operator's raw directory and `.gpg` are wiped when the checksum matches (section 3.3). On the receiving host `slot.sh wipe-dump` deletes the `.gpg` and the extracted `raw` directory right after `staging:load` succeeds. The passphrase is destroyed with them. Rehearsal dumps (AM-10 sitting of 24 Oct, anonymised): deleted after A4, named at A5. Any other copy handed out follows the 7-day rule. | dump operator (own copies), AZ (receiving host), LEAD (custodian, confirms) | Same day as the sitting; at the latest **6 Nov 2026** |
| Throwaway staging cluster | Destroyed with its volume right after the copy into the target (B5), and at the latest at the cutover sign-off. | AZ | 29 Oct 2026 |
| `staging_cloud` schema in the target | `drop schema staging_cloud cascade;` Kept only as the input for a rollback retry. | AZ | **At the latest 6 Nov 2026** |
| Backups and WAL taken while `staging_cloud` exists in the target (daily backups, archived WAL, base backups, S3 copies, from B5 to the drop) | Routine backups leave `staging_cloud` out (#166) but **contain `archive_cloud`**, which holds unminimised personal columns until C5. **Backups taken between the load (B5) and the minimise (C5) hold unminimised data.** AZ keeps an explicit list of them (name, time, location including S3), each with a **deletion date**: all are deleted at the `post_drop` clean-up, by 6 Nov 2026, with the S3 copies. If the platform cannot delete selected WAL, cap PITR retention to 7 days for this period (Perlu pengesahan, half AZ). `pre_etl` and `pre_delta` (taken in daylight on 28 Oct) hold no real data and are not on the list. Restore points taken later while `staging_cloud` exists carry a raw-data flag in `custody.tsv`; `purge-raw` runs after `post_drop`. | AZ (executes), LEAD (confirms) | **At the latest 6 Nov 2026** |
| `post_drop` order | `migrate:archive-minimise` (C5) runs **before** `post_drop`, so the clean point holds minimised data. If the minimise is not done by the day `staging_cloud` is dropped, `post_drop` is taken anyway and dated in the list above; the backups taken before the minimise still follow the deletion dates of the previous row. A failed minimise triggers no rollback (C5). | AZ, AM | Before 6 Nov 2026 |
| Deleted-at-source ids file (replan only; `.migration-out/deleted-at-source-*.json`, mode 0600) | Real data: legacy user ids and parent:child pairs of minors. Not produced at night. If produced, deleted at most 7 days after the LEAD has read it; handed over out of band, never in GitHub or chat. | LEAD (custodian), AM operator | Within 7 days of production |
| Files export for AC9 (`--files-dir`, banner images, real files) | Deleted with the raw dump copies: the operator's copy at the checksum match, the receiving copy once the activity stage has copied the files (it is exempt from the immediate delete after `staging:load`, because B6 and B7 read it; host: the receiving migration host, AZ; custodian: half AZ DevOps). Support-ticket attachments are not exported. | dump operator, AZ | Same day as the sitting; at the latest **6 Nov 2026** |
| Question report export file (`.migration-out/`, from `migrate:export-question-reports`), the `question_submissions` CSV (the Q9 CSV) | **Kept** (decision 19, **Decided: LEAD, 22 Oct (#109 6340542912)**) in a **named storage location: an encrypted, operator-owned location outside GitHub and cloud sessions (Perlu pengesahan with the LEAD)**, with the same retention and access as the dump copies (LEAD custodian, access limited to the LEAD and half AZ DevOps). **End date: 6 Nov 2026.** The CSV is handed to the content team **out of band** (encrypted, by a channel the LEAD names; never GitHub or chat). The LEAD records the deletion date as text in the issue. | AM operator, LEAD confirms | **6 Nov 2026** |
| `archive_cloud` | **Kept 12 months, all archive tables** (Q12 A), **minimised after the Q9 export** by `migrate:archive-minimise` (decision 18, step C5; counts only). Read-only, not served by the API. Roster JSON files are purged. Deleted by `drop schema archive_cloud cascade;` with the LEAD's confirmation. Until then it sits in the database and in later backups; those age out under the normal backup retention after the drop (half AZ states the number of days, Perlu pengesahan). | AZ (executes), LEAD (approves) | **On or after 30 Oct 2027** (a dated reminder is set at cutover) |
| Read-only MySQL account and the option file | The `.cloud` owner **drops `pp_dump_ro`** (`DROP USER`) and removes the pre-arranged unlock and lock event; the dump operator deletes the option file and the `dump:check` reports (`apps/api/.migration-out/check-*`, names and aggregates only). The account stays locked outside the sitting. | `.cloud` owner, dump operator | When the LEAD signs off the cutover and no retry is planned; at the latest 6 Nov 2026 (check reports 30 days at most) |
| **Night access** | **Night access revoked:** the operator's time-boxed VPS rights, the `.cloud` maintenance-switch access, the per-run secret-store access, the read-only storage access (scoped to the banner directory) and the SSH tunnel. Half AZ and the `.cloud` owner confirm each as text. | AZ, `.cloud` owner | At the close of the night (07:00 on 29 Oct at the latest), confirmed in daylight |
| WAL, base backups, snapshots and replicas of any server that held a dump; temp and spill files; shell history with a URL | Checked and cleared (runbook 5 items 3 and 4, runbook 18). | AZ, dump operator | At the latest 6 Nov 2026 |
| Open question reports | Open reports are exported with `migrate:export-question-reports` (added in #123) after the final verify; it writes a mode 0600 CSV under `.migration-out/` (Q9 A). It holds raw reporter free text from minors (the `reason` is redacted for e-mail, phone and IC and capped; `created_at` is a date only): custody like a dump (encrypted, out of band, never in GitHub), storage and end date as in the Q9 CSV row. Closed reports are **not** exported: they stay in `archive_cloud` for 12 months (Q12 A). Recipient: the LEAD (item 12, **Decided: LEAD, 22 Oct**), who passes it to the content team out of band. Right after this export, C5 runs the `archive_cloud` minimisation. | AM exports, LEAD hands over and confirms deletion | Hand-over and end date 6 Nov 2026 |
| Complete list of deleted-at-source rows for `erase` (not chosen; decision 15 is `list`), if it is ever produced | Real data (legacy ids of minors). Same custody as the ids file: mode 0600, never in GitHub or chat, deleted within 7 days. | dump operator, LEAD (custodian) | Within 7 days of production |
| v2 data kept after a rollback (the `post_switch` backup, section 6.3) | Real data of v2 users. Encrypted at rest. Access: the LEAD and half AZ DevOps only. The `post_switch` row applies to a rollback **after the DNS switch of 30 Oct**; at night there is no `post_switch` point, because v2 is dark and nothing is switched. **Deadline: 6 Nov 2026 or 30 days after the rollback, whichever is first.** A `post_switch` backup taken while `staging_cloud` still exists in the target also holds a raw copy of `.cloud`: the stricter rule applies (see the backups row above and section 6.3). | AZ (holds, deletes), LEAD (confirms) | 6 Nov 2026 or 30 days after the rollback, whichever is first |
| `etl_runs`, `etl_recon`, `etl_rejects`, `etl_checkpoints`, `etl_id_map` | Kept with the database (audit trail and later backfill). `etl_id_map` is not deleted. | AZ | Standing |
| `IC_HASH_KEY` | Kept for the life of the system, in the secret store, with the LEAD's copy. Never deleted (a new key would change every IC hash). | AZ, LEAD | Standing |
| Recon report and profiles (`.migration-out/`) | Aggregates and surrogate ids only; kept in the LEAD's encrypted storage until both the rehearsal and the cutover sign-offs are done, at most 30 days; numbers go into the issue as text; never in GitHub (runbook 17 item 1, 18). | LEAD | At the latest 29 Nov 2026 |
| `.cloud` | Read-only from the freeze on 29 Oct; stays read-only for reference after the switch; never written again. Its end of life is the `.cloud` owner's decision, outside this plan. | dump operator (keeps it read-only), `.cloud` owner | n/a |

**Hypercare (30 Oct to 6 Nov).** Daily: health and readiness endpoints, error rate, the number of password-reset requests (expected spike, runbook 17 item 3), support questions about streak, mastery or ranking changes (accepted drift, runbook 17 item 4), one repeat of the smoke list of section 4.5 part 2. `migrate:link-questions` may run at any time after the cutover.

**Sign-off record.** The LEAD writes this one line in the issue (no data, no names) when the final dump copies are deleted and `staging_cloud` is dropped:

```
Cutover <date>: freeze <T-freeze> MYT (<UTC>), export <T-dump>, DNS switch <time>,
night window used <h:mm> of <h:mm>, verify <status>, rejects <n> (reasons reviewed),
go/no-go <decision> by the LEAD (G6 28 Oct, C1 30 Oct), rollback needed <no | trigger id>,
dumps deleted <date>, pp_dump_ro dropped <date>, option file and check reports deleted <date>,
night access revoked <date> (VPS, maintenance switch, secret store, storage),
staging_cloud dropped <date>, archive minimised <date>, affected backups and WAL deleted <date>, archive_cloud kept until <date>,
Q9 CSV handed over <date> and deleted <date>, recon report deleted <date>. Signed: the LEAD.
```

## 8. Decisions for the LEAD

**Decided: LEAD, #109, 22 Oct 2026 10:30 MYT** = `all defaults` on items 1 to 13 and the file decision AC9 (items marked below). Items 4b and 14 to 19 were decided on 22 Oct 2026 ("defaults, except 16", #109 comment 6340542912). On 22 Oct 22:39 MYT the LEAD gave the binding go-live plan (#109); items it changes are marked "superseded by the LEAD plan", and this reading is an *interpretation, to be confirmed*. Already decided earlier and not asked: the dump operator is the human who holds the read-only access, the LEAD approves (OD-18 A); production loads use real, not anonymised, data (the ETL refuses anonymised data in production) and use no anonymiser key; `.cloud` DATETIME is +08:00 (DT-1 A).

| # | Item | Status | Content |
|---|---|---|---|
| 1 | Freeze start (T) | Decided: LEAD, 22 Oct; **superseded by the LEAD plan** | Now 29 Oct 2026 01:00 MYT (28 Oct 17:00 UTC). The earlier value was 30 Oct 01:00. |
| 2 | Maximum freeze window | Decided: LEAD, 22 Oct (4 hours with a switch inside); **superseded by the LEAD plan** | The night has no switch. Default for the night: 6 hours, go/no-go by T+5:30 (section 4.3); the LEAD confirms on 27 Oct. |
| 3 | Point of no return after the switch | Decided: LEAD, 22 Oct | Switch + 4 hours, now counted from the DNS switch of 30 Oct. |
| 4a | Reject threshold | Decided: LEAD, 22 Oct | `ORPHAN_PARENT` on users and schools = 0; rejects at most 0.1 % for users and schools and 0.5 % for every other entity; every reason explained (criterion 2). |
| 4b | Delta and deleted-at-source thresholds | Decided: LEAD, 22 Oct (#109 6340542912): 5 % / 100 rows. **AND, pending the LEAD's reply (#109 6341421182).** | A breach is STOP + rollback in a replan with a delta (criteria 5 and 12). The rule stays AND, as in the code (`verify/index.ts:176`, #123): `deleted_at_source_ratio` fails above 5 % AND above 100 rows, and the criterion 5 delta check fails when the gap is above 5 % AND above 100 rows. The LEAD was asked about AND vs OR on #109 (6341421182); Default AND until answered. At night under the new plan the delta checks do not apply (rehearsal / replan only). |
| 5 | Who freezes and unfreezes `.cloud` | Decided: LEAD, 22 Oct | The dump operator (not the `.cloud` owner). This replaces the earlier plan default 5 A and so reverses it, on the LEAD's comment "LEAD DECISION, #109, 22 Oct 2026 10:30 MYT". The operator needs the `.cloud` owner's maintenance-switch access and its commands: how is **Perlu pengesahan**. The team never changes `.cloud` code or data. |
| 6 | Who notifies schools and users | Decided: LEAD, 22 Oct | The dump operator; text approved by the LEAD. |
| 7 | Who types the production commands (`migrate:*`) | Decided: LEAD, 22 Oct; **night part per decision 16** | In daylight and rehearsals the half AM migration operator, with half AZ DevOps on the host. At night the dump operator, alone, through `slot.sh`. Credentials stay with humans and the secret store. |
| 8 | How the switch is done | Decided: LEAD, 22 Oct (A: own address plus a pointer page); **superseded in part by the LEAD plan, to be confirmed** | The LEAD plan says DNS switch by the LEAD on 30 Oct. The own-address-plus-pointer-page method stays as the fallback (section 4.4). |
| 9 | First load | Decided: LEAD, 22 Oct (A: full load at T-1, delta inside the freeze); **superseded by the LEAD plan** | One night: freeze, export, full first load, verify. The delta is for rehearsals and a replan only (4.7). |
| 10 | Production database platform (go-live checklist D-2) | Decided: LEAD, 22 Oct | VPS (half AZ owns it), with restore points `pre_etl`, `pre_delta`, `post_switch` as `pg_dump -Fc` plus PITR. |
| 11 | Post-switch 5xx rollback trigger (R5) | Decided: LEAD, 22 Oct | 5xx above 2 % of requests for 10 minutes. |
| 12 | Recipient of the open question report export (Q9 A) | Decided: LEAD, 22 Oct | The LEAD receives it and passes it to the content team out of band; kept with the same retention and access as the dump (decision 19). |
| 13 | Standalone delta dry-run (old B6) inside the window | Decided: LEAD, 22 Oct; **superseded by the LEAD plan** | Not run at night (no delta). Kept for rehearsals. The night has a first-load dry-run at B6 instead. |
| 14 | Where the raw dump is staged | Decided: LEAD, 22 Oct (#109 6340542912) | Stage on the throwaway cluster (#166), destroyed right after the copy and at the latest at the cutover sign-off. Never in GitHub or a cloud session. |
| 15 | Source deletes between the two exports (criterion 12) | Decided: LEAD, 22 Oct (#109 6340542912): `list` | Rows deleted at `.cloud` are listed in the reconciliation report and never deleted in v2. The old B10 (manual PDPA deletes) is not run at the cutover. `erase` cannot run inside the freeze window. Under the new plan there is one export, so no such gap at night. **Follow-up (not part of the decision, a suggestion for the LEAD after go-live):** handle erasure requests through the normal privacy-log process. |
| 16 | Night deputies | Decided: LEAD, 22 Oct (#109 6340542912) | **No deputy.** The dump operator runs the night session (Phase B) alone. Every threshold breach or failed step means STOP and roll back by the written runbook. No one is woken for a go/no-go; the LEAD reviews in the morning. Access the operator may not have is marked **Perlu pengesahan** (VPS access for `slot.sh`, `restore-point.sh`, `pitr.sh`; the `.cloud` maintenance switch; the pre-arranged unlock and lock of `pp_dump_ro`). |
| 17 | T-1 export time | Decided: LEAD, 22 Oct (#109 6340542912); **superseded by the LEAD plan** | There is no T-1 export. The single export follows the freeze at 29 Oct 01:20. |
| AC9 | AC9 files | Decided: LEAD, 22 Oct | A: banner images from a read-only files export in the AM-10 sitting (`--files-dir`, PR #122); support-ticket attachments are not migrated. |
| 18 | `archive_cloud` minimisation | Decided: LEAD, 22 Oct (#109 6340542912) | Adopted. Step C5, right after the Q9 export and before `post_drop`: `npm run migrate:archive-minimise -w @pp/api -- --confirm <db> --export-summary <.migration-out/question-reports-open-<stamp>.summary.json>`, dry-run then `--apply`, with `PP_ALLOW_MIGRATE_APPLY=1` and `PP_MIGRATE_TARGET_DB=<db>`. `migrate:archive-minimise` is delivered by #123 (AM-09) and merged with it (`apps/api/src/migration/export/archive-minimise.ts`, head `89c4ece7`). Refused before the export has run; counts only. A failure triggers no rollback; retry by a date the LEAD sets (Default: within 2 days). |
| 19 | `question_submissions` CSV | Decided: LEAD, 22 Oct (#109 6340542912) | The CSV is kept, with the same retention and access as the dump (outside GitHub), end date 6 Nov 2026, in the named storage location of section 7 (Perlu pengesahan). |
