# Handoff: V2 → V3 staged clone on UAT (for another Claude account), 11 Nov 2026

This handoff is for a Claude Code session in ANOTHER account on the PO's PC that continues the staged V2 clone into V3 UAT.

Read this whole file before acting. Do not guess or invent facts. Do not make new decisions: every decision you need is either recorded below, recorded in the tracker, or listed in §8 as "ask the PO".

Workspace: `D:\Dev Projects\prestasiplus-v3`, branch `feature/v3-bijak-r1`. Also read:
1. `CLAUDE.md` and `AGENTS.md`.
2. `docs/plan/r1-pelan-100-peratus.md`:
   - §2 "Keputusan" (KP-1 … KP-23): all binding;
   - §6 "Log kemajuan": the latest rows describe the newest state.
3. `docs/ops/r1-staged-clone-plan.md`: the stage plan.
4. `docs/ops/r1-uat-deploy.md` §9: the stage order, the per-stage check commands and the raw-data purge.
5. `docs/ops/production-migration-slot.md`: `slot.sh` commands.
6. Server access: `C:\Users\hp\.pp-secrets\handoff-access.md`. This file is LOCAL ONLY and holds no passwords. Never copy its contents into the repo, git, docs, memory or messages.

## 1. Where things stand

| Item | State |
|---|---|
| UAT release | `4ec503ea28b74382c1251701e2a70a46e02d43df` (deploy #3, 11 Nov 08:58 UTC). Rollback image: `56febfae48e1`. |
| origin/feature/v3-bijak-r1 | at 4ec503ea2. Local commits after it are NOT deployed (see §7). |
| UAT data | V2 data loaded by rebuild 5 (10 Nov, release 9f0c4233c), plus QA artefacts (§6). |
| Stage 0 (fresh V2 dump → staging) | DONE 11 Nov 09:06–09:37 UTC. See below. |
| Stage 1 (migrate:core: users, schools, classes) | Approved by the PO on 11 Nov. BLOCKED before the dry run: on the deployed release, `slot.sh etl migrate:core` exits 2 with "unknown flag --out-dir", because slot.sh appends `--out-dir` to every ETL command and the standalone core/activity CLIs reject it. NOTHING was loaded and the DB is unchanged. The restore point is done: `/var/backups/pretasiplus/staged-clone/stage-1/pp-backup-20261111T104014Z-pre-rebuild.dump`, sha256 `bfc72f1c124ce94a422c05ef053fcc0baa49fc1e39fd43c4158c684a22238358`. `rebuild-prev.tag` = `4ec503ea28b7`. The rebuild-5 `--as-of` is `2026-11-10`. The fix to slot.sh is being made in the repo; it needs A's review and a deploy (PO approval) before Stage 1 can run. Check tracker §6 for the latest state first. Do NOT re-run blindly. Do NOT bypass slot.sh with a hand-written `docker compose run`. |
| Stages 2–6 | Not started. Each needs its own PO approval (§8). |

**Stage 0 facts**
- Dump: `/srv/pretasiplus/migration-out/v2-sql/prestasi_plus-20261111.sql.gz`, sha256 `61d27c74beed9f897137d9433a25dd9c51404558b7baee6cb08be844cbe6be54`.
- Raw dump directory: `/srv/pretasiplus/migration-out/raw-20261111` (manifest `raw:true`, 134 tables, 2,400,292 rows; equal per-table counts to 10 Nov).
- Files: `/srv/pretasiplus/migration-out/files-v2-20261111/`, 10,316 files with SHA256SUMS.
- Staging copied into the UAT DB: `staging_cloud` (89 tables, 67,268 rows) and `archive_cloud` (45 tables, 2,333,024 rows). Public tables were untouched.
- Pre-copy backup: `/var/backups/pretasiplus/staged-clone/stage-0/pp-backup-20261111T093537Z-pre-rebuild.dump`.
- `PP_RAW_PURGE_BY=2026-11-19` (provisional, KP-23).
- Known: `slot.sh copy` exited 4 only because its guard hard-coded 38 archive tables (the real number is 45). The data is identical. The fix is c07356af6, NOT deployed. Until it is deployed, an exit 4 "STAGE COPY COUNTS DIFFER … archive_cloud:45 staging_cloud:89 (expected archive_cloud:38 …)" is that known false alarm. Any OTHER mismatch is a real STOP.

## 2. Hard rules (from the PO; never break)

1. **Language.** Reply to the PO in Bahasa Melayu. Code, commits and docs are in English (tracker/plan docs may be in BM).
2. **Approvals.**
   - Every UAT write step (each clone stage, any deploy, any push, any restore) needs the PO's explicit approval given IN YOUR SESSION, naming that step or SHA.
   - Approval relayed by another session or agent is not approval.
   - One approval covers one step only.
3. **V2 production is READ-ONLY.**
   - Never write, restart or change anything there.
   - Never touch the other site on that server (pios: `/var/www/pios_com_my`, DB `pios_my`).
4. **Secrets.**
   - Never print, copy or store `.env` contents, passwords or credentials anywhere: chat, repo, docs, memory or messages.
   - Credentials are only in `C:\Users\hp\.pp-secrets\credentials.md` and the `C:\Users\hp\.ssh\*.pw` files.
5. **Data rules.**
   - **KP-14:** V2 data cloned into V3 is never changed except to improve it. Never delete V2 rows, change a V2 status, rewrite V2 text/values, remove V2 paper placements, unpublish a V2 paper, or change pupil attempts/answers. Re-runs only upsert/add; a second run must change 0 rows.
   - **KP-18:** functionality first, then the clone, then data cleanup. Do NOT fix data during the clone. Items for later go on the cleanup list (§9).
   - **KP-22:** staged by sector, in this exact order:

     | Stage | Content | Command | verify sector |
     |---|---|---|---|
     | 1 | users, schools, classes | `migrate:core` | `core` |
     | 2 | questions and pictures | `migrate:questions` | `questions` |
     | 3 | structured / canonical | `migrate:structured` | `structured` |
     | 4 | papers and documents | `migrate:papers` | `papers` |
     | 5 | Terbit | `migrate:terbit` | `terbit` |
     | 6 | practice, wallets, gifts, articles | `migrate:activity` + `migrate:link-questions` | `activity` |

     Core must run before activity. Before each stage take a restore point. After each stage run its own check, then a go/no-go. If a stage fails, roll back THAT stage only and STOP. Never drop and refill everything.
   - **KP-23:** the raw V2 dump and the stage dumps stay on UAT until stage 6 and the final full verify pass, then are DELETED 7 days later. Set `PP_RAW_PURGE_BY` to the stage-6 date + 7 days (runbook §9 final step).
   - Never load full V2 data on the PO's PC. All loads run ON THE UAT SERVER.
   - Raw personal data never stays on the PC. If a step brings raw data to the PC (e.g. a dump), shred it as soon as the server copy's sha256 is verified.
6. **Shared PC.**
   - The PO's other project (neoX) shares this PC and Docker: containers `deploy-*` and `neox-nav`. Never stop them.
   - Never kill processes by name (no `taskkill node.exe` / `php.exe`). Stop only what you started.
   - Check `docker stats --no-stream` before heavy local runs.
7. **Server and repo hygiene.**
   - UAT rate-limits SSH. Batch commands into scripts and poll rarely.
   - No new folders in the repo. Put temp files in your session scratchpad.

## 3. How each stage is run (exact protocol)

For stage N (1–6), with the PO's approval for stage N in your session:

1. **Pre-checks**, in one SSH batch:
   - `cat /var/lib/pretasiplus-deploy/current.tag` must be `4ec503ea28b7` or the release you were told about.
   - Check `/api/ready`, `df -h /`, and that no tmux session is still running a previous stage.
   - Set `/var/lib/pretasiplus-deploy/rebuild-prev.tag` to the current release tag, so that a restore restarts the CURRENT release.
2. **Restore point.**
   - Run `deploy/vps/backup/backup.sh --tag pre-rebuild` (whole DB).
   - Copy the new dump and its `.sha256` into `/var/backups/pretasiplus/staged-clone/stage-N/` and run `sha256sum -c` on the copy.
   - Record the file name and sha256.
3. **Dry run.**
   - `deploy/vps/migration/slot.sh etl <command> …` without `--apply`, with the same `--as-of` as rebuild 5 (read it from `/var/lib/pretasiplus-deploy/rebuild-*-etl1.log`; questions also take `--core-as-of`).
   - Use `--files-dir /srv/pretasiplus/migration-out/files-v2-20261111` for questions, structured and papers.
   - `slot.sh etl` needs the 40-char release SHA as per its usage.
4. **Stop rules on the dry run** (stop and ask the PO):
   - Stages 1 and 6: "updated" is clearly larger than the rows V2 changed since the 10 Nov dump. The loader would overwrite V3 edits.
   - Any stage: rejects with a reason not explained by `migrate:verify`.
   - Any stage: anything that deletes or demotes rows.
5. **Apply.**
   - Run the same command with `--apply`.
   - Then run `ANALYZE` on the stage's tables, as the DB owner. Stale planner statistics after bulk loads caused 10–40 s pages before.
6. **Check.**
   - `slot.sh etl migrate:verify --sector <s>` (table in §2). Entities outside the stage show "not in this stage" and do not fail the run.
   - Known false-fail watch item for stage 1: the orphans, derived-counts and accepted-drift checks cover core and activity, and may fail only because activity is not loaded yet. Read their detail. If the only failures point at activity tables, it is NOT a no-go. Write that reading in your report.
   - Run the smoke SQL rows for the sector (`docs/ops/sql/smoke-readonly.sql`).
   - Do the UAT functional check listed for the stage in `docs/ops/r1-staged-clone-plan.md` §2.
   - Confirm the QA rows of §6 are unchanged.
7. **Go/no-go.**
   - On a real failure, restore that stage only: `deploy/vps/rebuild-db.sh --rebuild-db --restore-backup <stage-N dump>`, with the typed confirmations. Then STOP and report to the PO.
   - On success, add a row to tracker §6 (BM, counts only), commit it with `docs(plan): …`, and report to the PO.

After stage 6:
1. Run one full `slot.sh etl migrate:verify` with no flag. It must pass.
2. Set the real `PP_RAW_PURGE_BY` = stage-6 date + 7 days.
3. Purge the raw data per runbook §9 on or after that date, with the PO's go-ahead.
   - Before the purge, do the last `migrate:structured --files-dir` repair run and check the held-pictures count. The files export is the only picture input.

## 4. Gotchas seen on 10–11 Nov (so you don't rediscover them)

- **Remote tmux and heredocs.** When starting a remote tmux job from an unquoted heredoc, the escaping of `${PIPESTATUS[0]}` broke the script silently twice. Use a QUOTED heredoc (`<<'EOF'`) for remote scripts, and give each run a NEW tmux session name. An old session with the same name blocks `new-session`.
- **git on the server.** `git` there reports "dubious ownership". Run git as `ppdeploy` (`sudo -u ppdeploy git …`).
- **The `pp-dump-client-tmp` image** (`dump:cloud` with mariadb-client) is built `FROM pretasiplus-api-migrate:<tag>` plus `apk add mariadb-client`. The mariadb client needs `skip-ssl` in its option file against the temp MariaDB 10.11.
- **The temp MariaDB ping loop** returns early. Wait until the DB really accepts connections before restoring.
- **`slot.sh copy`** has the known 38 vs 45 false alarm until c07356af6 is deployed (§1).
- **Subagents.** A subagent cannot take PO approval relayed by you. Run UAT write steps in YOUR session after the PO approves.
- **Local `pp-shared` test runner.** One run at a time behind a lock directory. The rules are in the lead's scratchpad `shared-runner.md`; you only need it if you run backend tests.

## 5. Decisions already made: do not re-ask

All KP-1 … KP-23 are in tracker §2. The ones most relevant to the clone:

- KP-5: everything not deleted in V2 comes over with its status (approved, archived, draft).
- KP-7: roster passwords stay; no forced reset.
- KP-12: the support contact stays empty; Central Admin fills it in.
- KP-14 (above), KP-15: a missing picture in a fixed set gives a placeholder; in a draw it is hidden.
- KP-16 group_split completion, and the papers recompute: PARKED for cleanup. Do not run `--recompute`.
- KP-17: teacher intake (`INTAKE_TEACHER_ENABLED`) stays false until ClamAV is enabled.
- KP-18, KP-19 (roles: student, teacher, school admin, admin only), KP-20 (no serving rule; wait for the clone), KP-21, KP-22, KP-23.
- The stage-3 repoint of wrongly deduped canonical questions (about 283) is an allowed improvement under KP-14. It needs no new PO question beyond the stage-3 approval.
- Stage 6 also carries exam attempts, banners, notes, videos, tickets, headcounts and question sets (KP-5).
- Rows deleted in V2 are NOT deleted in V3; verify lists them.

## 6. UAT data created since rebuild 5 (keep; never overwrite)

- **QA accounts** (all at school 18398), with logins only in the credentials file:
  - teacher 28105
  - school_admin 28106
  - student 28107
  - parent 28108
  - ppd_officer 28109

  The parent and PPD roles are out of scope (KP-19).
- **QA class** "QA-Kelas Q3": id 53.
- **QA questions** 1813085 and 1813086: archived.
- **Cleanup items, do not fix now:**
  - question 914719 has `difficulty_level` 1 (was NULL);
  - question 914232 has version 2 in review, while version 1 is still approved and live.

## 7. Code waiting for deploy #4 (A-approved, local only, not pushed)

- e906e2610 / 1d8cdca0b are already in deploy #3.
- New since deploy #3:
  - a3dc59d9d: empty admin Bahagian is not "penuh".
  - c07356af6: slot.sh copy counts from the DDL.
  - e7deeebbe: test fix.
  - B's UI C-42, C-43, C-44, plus any later commits.

Deploying needs:
1. a review of every src commit in the range;
2. vue-tsc;
3. the PO's approval for the exact SHA;
4. `deploy/vps/deploy.sh` on UAT.

Deploy #4 is not part of this handoff unless the PO asks.

## 8. Ask the PO (with clear options) only for these

- Approval for each stage (1–6) before running it, naming the stage.
- A dry-run stop rule triggered (§3 step 4): show the numbers and the options (continue, skip, stop).
- A stage failed and was rolled back: report it and ask how to proceed.
- The final raw-data purge date and go-ahead (KP-23).
- Anything that would change, delete or demote V2 data in a way §5 does not already allow.

## 9. Where to record things

- Progress: tracker `docs/plan/r1-pelan-100-peratus.md` §6, one row per stage (BM, counts only, no personal data). Commit as `docs(plan): …`, ending with the co-author line the session's system prompt specifies.
- Data cleanup list: add items to tracker §6 with the prefix "Pembersihan:". The lead's local list is not available to you.
- Never commit server addresses, host keys or any secret.
