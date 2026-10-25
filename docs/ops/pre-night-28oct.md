# Checklist A5: pre-night, 28 Oct 2026, ending in the G6 go/no-go at 18:00 MYT

- **Status:** docs only. Nothing in this checklist has been run on any server. No server was reachable when it was written.
- **Owner:** half AZ DevOps prepares it. The LEAD runs each step by hand on the production VPS (half AZ DevOps and QA may be present; QA does step 3). Every step that changes the server needs the LEAD's explicit go first.
- **Plan:** [v2-cutover-plan.md](v2-cutover-plan.md) step **A5** (section 4.1), preconditions **P9 to P13** (section 3), section 4.6 (night card, read for consistency only), section 6 (rollback), section 7 (retention), section 8. It follows the 26 Oct sheet [vps-dark-setup-26oct.md](vps-dark-setup-26oct.md) (question numbers Q1 to Q28 are from that file).
- **Refs read when writing:** branch `feature/v2-backend` at `515e440f`; PR #166 head `bf016ba0` (`slot.sh`, `restore-point.sh`, `pitr.sh`, pointer page); PR #186 head `f60303be`; PR #125 head `d9562dc8` (`dump:wipe`); PR #123 head `3b196b43`; PR #203 head `ed0d8c77` (not merged).
- **Abort rule (plan A5):** a no-go at G6 leaves `.cloud` untouched and nothing to undo; replan under plan section 6.5.
- **Placeholders (public repo):** `<domain>` is the public name that moves to v2 on 30 Oct (Q12, Q13); `<test-domain>` is a throw-away name for the rehearsal; `<authoritative_ns>` is an authoritative name server of the DNS zone (from `dig NS`); `<vps-host>`, `<old-host>`, `<release_sha>`, `<db>`. No real host names, addresses, e-mail or person names in this file. Roles only: the LEAD, half AZ DevOps, the dump operator, QA, the `.cloud` owner.
- **Times:** MYT. The times in the "Planned" column are suggestions (Q28); the plan fixes only 17:30 (access list) and 18:00 (G6). Fill in `Time: __:__ MYT` when a step is done.

## How to read a step

Each step has **Command**, **Expected output** (the strings the scripts print), **STOP if** and **Evidence**. **STOP means:** do not run the next step; write the step number and the output (names and counts only) in the issue thread; tell the LEAD there.

**Freeze for the day.** From step 5 on (restore points) nothing may change the database: no deploy, no migration, no new account, no seed. Anything that does means steps 5 and 6 are done again.

## Conventions for all commands

Run as `ppdeploy` on `<vps-host>` from `/opt/pretasiplus` (same helpers as the 26 Oct sheet):

```
cd /opt/pretasiplus
PC='docker compose -f compose.yaml -f deploy/vps/compose.prod.yaml --env-file /etc/pretasiplus/prod.env'
pq() { $PC exec -T db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -At -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"' sh "$1"; }
```

| Step | Planned | Plan item |
|---|---|---|
| 1 DNS time-to-live lowered | 09:00 | P9, A5 (4) |
| 2 Final schema migrations confirmed | 10:00 | A5 (1) |
| 3 Smoke accounts exist | 11:00 | P11, A5 (3) |
| 4 Notice to schools sent | 12:00 | P10, A5 (5) |
| 5 Restore points | 13:00 | A5 (2) |
| 6 `slot.sh gonogo` daylight check | 14:30 | plan 4.6 (B0 rule) |
| 7 Switch and switch-back rehearsal; pointer page | 15:00 | P9 |
| 8 Rehearsal dump files deleted and named | 16:30 | A5 (7) |
| 9 Operator access list confirmed | by 17:30 | P12, A5 (6) |
| 10 G6 go/no-go by the LEAD | 18:00 | P13, A5 (8) |

---

## Step 1. DNS time-to-live lowered (P9) — Planned 09:00, Time: __:__ MYT

Do this first: the lower value only reaches resolvers after the **old** time-to-live has run out. The plan asks for at least 24 h before the switch of 30 Oct (production-vps.md sections 4 and 16 say 48 h: Q24). The change is made in the DNS provider's panel; no script in the repo does it.

**Command**

```
dig +noall +answer <domain> A @<authoritative_ns>      # before: write down the old TTL
# change the TTL of the record that moves on 30 Oct to 300 seconds in the DNS provider's panel (the LEAD)
dig +noall +answer <domain> A @<authoritative_ns>      # after
```

**Expected output:** the `after` line shows `300` in the TTL column. Old TTL was ____ s; lowered at __:__ MYT; so resolvers have the short value from __:__ MYT on 29 Oct at the latest (lowering time plus old TTL).

**STOP if** the TTL still shows the old value, or (lowering time plus old TTL) is later than the time the LEAD plans to switch on 30 Oct. Tell the LEAD; the switch time or the method (Q12) may need to change. Also confirm there is **no AAAA record** for the name (the edge is IPv4 only): `dig +short <domain> AAAA` prints nothing.

Evidence (old TTL, new TTL, time): ____

---

## Step 2. Final schema migrations confirmed — Planned 10:00, Time: __:__ MYT

A restore point is valid only if it was taken after the final schema migrations: a point with fewer migrations than the release fails the migration check on restore (plan A5, MIG-07 pass 4: a 33-migration snapshot on a 36-migration tree failed).

**Command**

```
git rev-parse HEAD
git status --porcelain --untracked-files=no | wc -l
pq "select count(*) from _prisma_migrations where finished_at is not null and rolled_back_at is null"
ls -d apps/api/prisma/migrations/*/ | wc -l
pq "select count(*) from _prisma_migrations where finished_at is null"
curl -s https://<domain>/api/ready
tail -n 3 /var/lib/pretasiplus-deploy/history.log
```

**Expected output**

- The sha equals `<release_sha>` of A2; the dirty-tree count is `0`.
- Applied count = folder count (both ____); unfinished count `0`.
- `/api/ready` returns JSON with `"status":"ready"`, `"db":"up"`, `"migrations":"applied"` (field names from `apps/api/src/common/health/ready.controller.ts`).
- The last `history.log` line is the deploy of that sha (`deploy tag=<sha12> ... sha=<release_sha>`).

**STOP if**

- applied is lower than folders: the LEAD decides whether to run `deploy/vps/deploy.sh` (step 6a of the 26 Oct sheet) now; then repeat this step. If the sha is not `<release_sha>`, any ETL change after the code freeze means the rehearsal is repeated (plan P2): tell the LEAD, do not go on.
- a migration was applied after 26 Oct: re-run the grant lines of 26 Oct step 8b if the roles were created (new tables need grants), and tell the LEAD.
- `/api/ready` is not 200 or the unfinished count is not `0`.

Evidence: sha ____ applied ____ folders ____ unfinished ____ ready ____

---

## Step 3. Smoke accounts exist BEFORE `pre_etl` (P11) — Planned 11:00, Time: __:__ MYT

Four production smoke accounts, **created in v2, not migrated**: student, teacher, parent, admin. They are used for sign-in checks only (plan 4.5 part 2, C2). QA creates them in daylight and fixes the smoke list. They must exist **before** step 5 so that a restore of `pre_etl` keeps them. Names of people and real school data never appear in the issue; the list is roles only.

**Command (operator, then the smoke admin; path from Q18-PROPOSAL, #109 6394041360, and `docs/qa/p11-production-smoke.md` section 2.3 case (a); no new script)**

0. Tiers first: the release must carry #230 (`core-wallet-tiers`), then the operator runs `deploy/vps/deploy.sh --seed-reference`. Check: `pq "select count(*) from tiers"` is 4. Without tiers every student dashboard answers 500 (P11-B1). Fallback if #230 is not on the release sha: p11 section 2.3 step 7a.
1. The admin account: the operator runs `npm run -s admin:bootstrap -w @pp/api -- --mode=create --email=<SMOKE_ADMIN_EMAIL> --confirm=<SMOKE_ADMIN_EMAIL>` in the migrate container (26 Oct sheet step 11). The password goes in the hidden prompt or through `--password-stdin`. Exit 3 (an active Admin Pusat already exists) is a STOP.
2. Student, teacher, parent: the smoke admin creates them with `POST /api/admin/users` (or the admin SPA screens), after creating one clearly fictitious school with `POST /api/admin/schools` (a code that cannot be a MOE code; no district, no city). Teacher and student get that school; the parent gets no school and no linked child. `REGISTRATION_OPEN=false` blocks only `POST /api/auth/register`, not these routes. A teacher created by an admin is active at once (the pending state comes only from self-registration), so no school admin approval is needed. Each one-time password (`data.generatedPassword`) goes straight to the password manager.
3. E-mails use a domain that cannot exist in `.cloud` (p11 open question 8), so the ETL never strips a real user's e-mail.

After creation, count (no names):

```
pq "select count(*) from users"
```

**Expected output:** the number of users is four (the bootstrap admin is the smoke admin); `schools` is 1; `tiers` is 4 (at least 1 with the fallback). QA signs in once with each account on the dark site and confirms each reaches its dashboard (QA's own record, roles only).

**STOP if** fewer than four accounts exist or the creation path is unknown at 12:00. Do not take the restore points; tell the LEAD. The LEAD decides: wait, or go without (then the accounts would be lost on a restore and C2 has nothing to use).

Evidence (roles list, count, QA sign-in confirmation per role): ____

---

## Step 4. Notice to schools and users sent (P10) — Planned send 12:00, Time sent: __:__ MYT

P10: the dump operator sends the notice on 28 Oct; the LEAD approves the wording first. The text is not in this file. Its content, per the plan: `.cloud` is read-only from about 01:00 MYT on 29 Oct until the new system opens on 30 Oct (times approximate, final times in a reminder); everyone must sign in again; roster accounts and accounts with a legacy password must set a new password; where to get help (the support role of runbook section 21). A second notice "the new system is open" goes out at C3 on 30 Oct.

**Command:** none in the repo (a message through the channel the LEAD names, Q27).

**Expected output:** a sent message and its time.

- Text approved by the LEAD at: __:__ MYT (the LEAD's line in the issue).
- Sent by the dump operator through (channel): ____ at __:__ MYT.
- Support (the Meja Bantuan role) told to expect a spike in password-reset requests: yes | no.

**STOP if** the LEAD has not approved the text by 14:00, or the channel is unclear. P10 is then not met at G6; tell the LEAD.

Evidence (approval time, send time, channel): ____

---

## Step 5. Restore points, then the PITR base, then verify — Planned 13:00, Time: __:__ MYT

Only after steps 2 and 3. Sources: `deploy/vps/migration/restore-point.sh` and `deploy/vps/migration/pitr.sh` (PR #166). From the scripts' own usage: `restore-point.sh take NAME [--operator "<name>"]`, `list`, `verify NAME`, `restore NAME [--yes]`; NAME is `pre_etl`, `pre_delta`, `post_switch` or `post_drop`; `pitr.sh base [--label NAME]`. The operator value is a **role**, never a person's name.

**Command**

```
deploy/vps/migration/restore-point.sh list
pq "select count(*) from _prisma_migrations where finished_at is not null and rolled_back_at is null"    # M1 = ____
ls -d apps/api/prisma/migrations/*/ | wc -l                                                              # folders = ____
deploy/vps/migration/restore-point.sh take pre_etl --operator "half AZ DevOps"
deploy/vps/migration/restore-point.sh take pre_delta --operator "half AZ DevOps"
deploy/vps/migration/pitr.sh base --label pre_etl
deploy/vps/migration/restore-point.sh verify pre_etl
deploy/vps/migration/restore-point.sh verify pre_delta
deploy/vps/migration/restore-point.sh list
pq "select count(*) from _prisma_migrations where finished_at is not null and rolled_back_at is null"    # M2 = ____
tail -n 2 /var/lib/pretasiplus-deploy/history.log
```

`pre_delta` is taken in the same state as `pre_etl` (no raw data), because `slot.sh gonogo` checks for it and prints `MISSING ... -> NO-GO` without it (Q6).

**Expected output**

- Each `take`: `RESTORE POINT TAKEN: pre_etl file=pre_etl-<UTC>.dump bytes=<n> sha256=<hash> tables_with_data=<n> raw_data=no wal_lsn=<lsn> duration_s=<n>` (and the same with `pre_delta`). `raw_data=no` is required. The script refuses `pre_etl` with `pre_etl must hold no .cloud data, but schema staging_cloud exists` if the schema exists.
- `pitr.sh base`: `BASE BACKUP DONE: <stamp> (label pp-pre_etl-<stamp>), <size>, duration_s=<n>`.
- Each `verify`: `RESTORE POINT OK: pre_etl file=pre_etl-<UTC>.dump sha256 matches, <n> tables with data` (and the same for `pre_delta`).
- `list` prints the custody file (time, name, file, sha256, bytes, raw flag, WAL position, operator, status): paste the names, sizes and the first 12 characters of each sha256.
- **Migration count check:** M1 = M2 = folders. `restore-point.sh` does not store the migration count (Q23), so the count is the live count at the moment of the point; `take` holds the same lock as `deploy.sh`, so no deploy can run in between. The last `history.log` line (a deploy) must be **older** than the `created_utc` of the points in `list`.
- Optional second proof, not rehearsed in this repo (standard tools only): `$PC exec -T db pg_restore --data-only --table=_prisma_migrations -f - < /var/backups/pretasiplus/restore-points/pre_etl-<UTC>.dump | awk '/^COPY /{c=1;next} /^\\\.$/{c=0} c' | wc -l` should print the folder count. If it does not parse, rely on M1/M2.

**STOP if**

- M1, M2 and the folder count are not all equal, or a deploy line is newer than a point: the points are not valid. Take them again after the cause is clear; tell the LEAD.
- `take` or `verify` fails (`sha256 mismatch`, `pg_restore --list shows no table data`), or `pitr.sh` says `archive_mode is off`. No restore point means no night: tell the LEAD.
- **Any new schema migration after this point means the points are taken again** (plan A5).

Evidence: names, sizes, sha256 prefixes ____ ; M1 ____ M2 ____ folders ____ ; base stamp ____

---

## Step 6. `slot.sh gonogo` as a daylight dry check — Planned 14:30, Time: __:__ MYT

Safe in daylight: from the script (`deploy/vps/migration/slot.sh`, PR #166), `gonogo` only reads. It runs `restore-point.sh verify` for `pre_etl` and `pre_delta`, a few `select` statements (archive state, schema table counts), `df` on the backup volume, `docker inspect` of the throwaway container and one GET of `/api/ready` through the edge. It writes nothing and takes no lock. It is the same check the night card reads at B0 and B9.

**Command**

```
deploy/vps/migration/slot.sh gonogo
```

**Expected output (read by the night-card rule, plan 4.6)**

- First line: `GO/NO-GO EVIDENCE (infrastructure part, cutover plan section 5; counts and names only)`.
- `criterion 8: restore point pre_etl present, sha256 ok` and the same for `pre_delta`.
- `criterion 8: PITR on, last archived WAL <segment> at <UTC time>, failed_count 0`.
- `stage: archive_cloud:0 staging_cloud:0 in the target (expected archive_cloud:38 staging_cloud:89 while the slot runs)`. Zeros are right before the copy.
- `backup: newest dump pp-backup-<UTC>Z.dump is <n> h old` with n below 24.
- `disk: <n>% free on the backup volume` with n above 30.
- `api: /api/ready through the edge -> 200`.
- `throwaway: none running`.
- **The rule:** no line contains `NO-GO`, `MISSING` or `PITR off`; the `api` line ends in `-> 200`; `failed_count` is `0`.

**STOP if** any line breaks the rule. For `PITR off` the script's own text mentions a written waiver; at night there is none, and in daylight only the LEAD can decide it (Q30). If `backup:` is older than 24 h or missing, a manual `deploy/vps/backup/backup.sh` (LEAD's go) fixes it; then run `gonogo` again.

Evidence (paste the lines): ____

---

## Step 7. DNS switch and switch-back rehearsed and timed (P9); pointer page fallback — Planned 15:00, Time: __:__ MYT

P9: switch method decided and rehearsed, and the switch-back too. The plan's default is the DNS switch by the LEAD on 30 Oct (Q12). Do **not** rehearse by moving the real public name: that would move real users.

### 7a. DNS rehearsal on a throw-away name (provider panel; no repo script)

**Command**

```
dig +noall +answer <test-domain> A @<authoritative_ns>      # points at <old-host>
# the LEAD changes the record to <vps-host> in the DNS provider's panel; note the time
dig +noall +answer <test-domain> A @<authoritative_ns>      # repeat until it shows <vps-host>
# the LEAD changes it back to <old-host>; note the time
dig +noall +answer <test-domain> A @<authoritative_ns>      # repeat until it shows <old-host>
```

**Expected output:** the record shows `<vps-host>` after the switch and `<old-host>` after the switch-back, both with TTL 300. Record: switch started __:__, authoritative answer new at __:__ (duration ____ min); switch-back started __:__, answer old at __:__ (duration ____ min). These are the figures P9 asks for and plan section 6.4 uses (switch back, `<min>`).

Limit to say plainly: the edge answers only `PP_DOMAIN` (any other name gets no certificate), so this rehearsal times the DNS change and its propagation, not the serving of v2 under the new name (Q13, Q25).

**STOP if** the record does not change within 15 minutes, or no throw-away name exists. Tell the LEAD: the rehearsal is then "timed in the panel only, untested" and the LEAD decides at G6.

Evidence (durations, TTL): ____

### 7b. Pointer page, the fallback method (PR #166)

Source: `deploy/cutover/pointer-page/render.sh --url https://<v2 host>/ --support-email <role mailbox> --support-whatsapp <digits, country code first> --out <file outside the repo>`. It refuses `http://`, a placeholder-looking URL, a path inside the repository, and any value that could break the HTML.

**Command**

```
deploy/cutover/pointer-page/render.sh --url https://<domain>/ --support-email <role mailbox> --support-whatsapp <digits> --out <file outside the repo>
```

**Expected output:** `pointer page written: <the --out file>` and `sha256: <hash>`. The LEAD approves the BM text of the page together with the notice; the file and its sha256 are handed to whoever places it on `.cloud` (Q26). Placing and removing it needs an access that is not yet confirmed (plan 4.4).

**STOP if** the script refuses a value (it names the argument). This step is optional if the LEAD confirms DNS only.

Evidence (sha256, approved by the LEAD at __:__): ____

---

## Step 8. Rehearsal dump files deleted and named (A5 item 7) — Planned 16:30, Time: __:__ MYT

The rehearsal dumps are anonymised, but they are deleted after A4 and **named** at A5. Items to name and delete: (a) the work directory of the AM-10 sitting (operator PC), (b) its `.gpg` file, (c) the extracted dump and files directories on the rehearsal host, (d) the passphrase note.

**Command**

```
npm run dump:wipe -w @pp/api -- --dir <work dir>                    # operator PC, then the extracted dump and files directories on the rehearsal host (PR #125; overwrites with zeros, then deletes)
shred -u <file.gpg>                                                  # each .gpg file
deploy/vps/migration/slot.sh wipe-dump <dir> [<file.gpg>]           # only for a copy on the VPS; the directory must hold manifest.json
ls -d <work dir> <extract dir> <files dir> <file.gpg>               # check each path
```

**Expected output:** `wipe-dump` prints `DUMP COPIES DELETED: <dir name> and <file name>`; the `ls` check prints `No such file or directory` for every path. The passphrase note is destroyed (paper shredded or note deleted): confirmed yes | no.

**STOP if** any path still exists, or a copy was made that is not on the list. Delete it, or tell the LEAD. (Any other copy follows the 7-day rule and must go by 6 Nov, plan section 7.)

Evidence (the named items, directory and file names only, no contents; time deleted): ____

---

## Step 9. Operator access list confirmed by 17:30 (P12) — Time: __:__ MYT

P12: one dump operator on the night sitting, no deputies, plus the LEAD's morning review; a contact list kept **outside the repo**; nobody is woken for a go/no-go. The access list is confirmed as text by 17:30, with a start time and an end time for every right (time-boxed). Roles only, no names, no secrets. Per the night card, the rights end at **07:00 MYT on 29 Oct** or at the close, whichever comes first.

**Command:** none (the LEAD collects confirmations). Fill the table; every row needs "confirmed" or the night is a no-go (plan 4.6, "If any is missing at G6, the night is a no-go").

| Right (role) | Granted by | Start | End | Confirmed |
|---|---|---|---|---|
| VPS: SSH user for the dump operator, with `slot.sh`, `restore-point.sh`, `pitr.sh` and `sudo systemctl stop/start pp-backup.timer pp-restore-drill.timer` (night card B0, B10) | half AZ DevOps | ____ | 07:00 29 Oct | ____ |
| Shell on the migration host and the receiving host (the VPS) | half AZ DevOps | ____ | 07:00 29 Oct | ____ |
| Per-run access to the secret store (the production credentials stay with a human) | the LEAD | ____ | 07:00 29 Oct | ____ |
| `.cloud` maintenance switch, with its freeze and unfreeze commands (Q21) | the `.cloud` owner | ____ | 07:00 29 Oct | ____ |
| Pre-arranged unlock and lock of the read-only MySQL account (the operator holds no `ALTER USER`) | the `.cloud` owner | ____ | ____ | ____ |
| Read-only storage access for the banner files export | the `.cloud` owner | ____ | removed after the sitting | ____ |
| SSH tunnel to `.cloud` | the `.cloud` owner | ____ | 07:00 29 Oct | ____ |
| How `--files-dir` and `FILE_STORAGE_DIR` reach `slot.sh etl` (Q5) | half AZ DevOps | n/a | n/a | ____ |
| Contact list kept outside the repo | the LEAD | n/a | n/a | ____ |
| Support told to expect a password-reset spike | the LEAD | n/a | n/a | ____ |

**Expected output:** the table filled in and posted as text in the issue by 17:30. Half AZ revokes the VPS rights and the `.cloud` owner revokes the maintenance-switch access in daylight after the night, and each confirms "night access revoked" (plan section 7).

**STOP if** any right is missing at 17:30. The night is then a no-go unless the LEAD resolves it before 18:00.

Evidence (the posted table, time): ____

---

## Step 10. G6 go/no-go by the LEAD — 18:00, Time: __:__ MYT

Before reading, re-check that nothing changed since step 5:

```
git rev-parse HEAD
pq "select count(*) from _prisma_migrations where finished_at is not null and rolled_back_at is null"
tail -n 1 /var/lib/pretasiplus-deploy/history.log
deploy/vps/migration/restore-point.sh verify pre_etl
```

Expected: the same sha, the same count as M2 of step 5, a last deploy older than the points, and `RESTORE POINT OK: pre_etl ... sha256 matches`. If not, the points are taken again (step 5) and G6 waits.

### The LEAD reads P1 to P13 (plan section 3)

| P | What | Where the evidence is | Met (yes / no) |
|---|---|---|---|
| P1 | Rehearsals green, timings, exit codes | issue, 24 and 27 Oct | ____ |
| P2 | #122, #123, #125, #166 merged; code freeze; release sha | issue, A2 | ____ |
| P3 | Roles, grants, denied checks, migrated to the tip, v2 dark (open items Q1 to Q4, Q14) | 26 Oct evidence block, step 8 and 7 | ____ |
| P4 | Backups to S3, PITR, restore drill passed | 26 Oct evidence block, steps 9 and 10 | ____ |
| P5 | Secrets by name, no anonymiser key, no CI token (open item Q5) | 26 Oct evidence block, step 3 | ____ |
| P6 | Second rehearsal, production guard exercised | issue, 27 Oct | ____ |
| P7 | Window budget inside 6 hours | issue, 27 Oct | ____ |
| P8 | Freeze procedure, `.cloud` account, `dump:check` verdict | issue, 27 Oct | ____ |
| P9 | Method decided; time-to-live lowered; switch and switch-back rehearsed | steps 1 and 7 | ____ |
| P10 | Notice sent | step 4 | ____ |
| P11 | Smoke accounts exist before `pre_etl` | step 3 | ____ |
| P12 | Operator access list, time-boxed | step 9 | ____ |
| P13 | This go line | below | n/a |

### The LEAD approves three things

1. **The night card** (plan section 4.6) at release sha `<sha12>`.
2. **The B9 checklist** (plan section 4.6): mechanical, no waiver at night; any red or any missed latest time means STOP and rollback; nobody is woken.
3. **The night restore with `--yes`:** the dump operator, alone, at a STOP in Case 2, runs `deploy/vps/migration/restore-point.sh restore pre_etl --yes`. The script's usage: it stops `api` and `frontend`, drops and recreates the database, restores the newest `pre_etl` point, and starts nothing; it asks to type the database name unless `--yes`. Its last line is `RESTORED: pre_etl (...) in <N> s. api and frontend stay stopped: ...`. This is the only go the night needs.

Open items the LEAD must decide before saying go: any item of the "Open questions" list below that is not resolved. Plan 4.6 says that if a night-path access or the `--files-dir` route (Q5) is missing at G6, the night is a no-go.

### The dated go line (the LEAD posts this in the issue)

```
G6 go/no-go, 28 Oct 2026, <hh:mm> MYT, by the LEAD: <GO | NO-GO>.
Read: P1 to P13 (evidence above).
Approved: the night card (cutover plan 4.6) at release sha <sha12>; the B9 checklist; and the night restore
  "deploy/vps/migration/restore-point.sh restore pre_etl --yes" by the dump operator at a STOP in Case 2.
Restore points: pre_etl <size>, pre_delta <size>, taken <hh:mm> MYT; applied migrations <n> = folders <n>; PITR base <stamp>.
Switch method: DNS by the LEAD on 30 Oct, time-to-live 300 s since <hh:mm> 28 Oct; pointer page fallback: <yes | no>.
Open items accepted by the LEAD: <list, or none>. Open items that make this a NO-GO: <list, or none>.
Signed: the LEAD.
```

If NO-GO: `.cloud` is untouched, nothing to undo; replan under plan section 6.5.

Evidence (link to the posted line): ____

---

## Open questions for the LEAD

Numbers Q1 to Q28 are the ones in [vps-dark-setup-26oct.md](vps-dark-setup-26oct.md), with their defaults. Those that touch A5 and P9 to P13 are repeated in one line; Q29 on are new here.

| Q | Question | Plan reference | Default in force |
|---|---|---|---|
| Q5 | How do `--files-dir` and `FILE_STORAGE_DIR` reach `slot.sh etl`? | P5, 3.1 (c), 4.6 (e) | Not solved; a missing route at G6 makes the night a no-go (plan 4.6). |
| Q6 | `gonogo` needs `pre_delta`: take it with `pre_etl`, or change the check? | 3.1 (a), A5 item 2 | Take `pre_delta` with `pre_etl` (step 5). |
| Q7 | `migrate:archive-minimise` is not in the `slot.sh etl` allow-list. | 3.1 (b), C5 | Not accepted; C5 cannot run through `slot.sh`. |
| Q8 | PITR WAL retention cap (7 days) while `staging_cloud` exists. | Section 7 | `pitr.sh cleanup` by 6 Nov; no cap configured. |
| Q10 | 5 Nov or 6 Nov as the cap date. | Section 7 | 6 Nov 2026. |
| Q11 | Named storage location for the Q9 CSV. | Section 7, decision 19 | None named (needed before C5). |
| Q12 | DNS switch or own address plus pointer page. | P9, 4.4 | DNS by the LEAD on 30 Oct; pointer page as fallback. |
| Q13 | Host name and certificate when DNS moves. | P9 | Open; no script covers it. |
| Q18 | How the four smoke accounts are created while registration is "closed". | P11 | Proposed in #109 6394041360 (step 3 above, p11 section 2.3 case (a)); LEAD decision pending. |
| Q21 | `.cloud` maintenance switch and who gives access. | P8, P12 | Not in the repo. |
| Q22 | Operator access list. | P12 | None granted; confirmed by 17:30 or no-go. |
| Q23 | Migration count in the restore point. | A5 item 2 | Manual count before and after `take` (step 5). |
| Q24 | Time-to-live 24 h (plan) or 48 h (runbook). | P9 | Lowered first thing on 28 Oct (step 1). |
| Q25 | Rehearsal of the DNS switch without moving real users. | P9 | A throw-away name; times DNS only (step 7a). |
| Q26 | Who places the pointer page on `.cloud` and approves its text. | 4.4 | Half AM `.cloud` operator; the LEAD approves the text. |
| Q27 | Channel and time of the notice. | P10 | Dump operator, 28 Oct, text approved by the LEAD (step 4). |
| Q28 | Are the suggested times acceptable. | A5 | Suggested only; 17:30 and 18:00 are fixed. |
| Q29 | At G6, which open items does the LEAD accept (Q2 superuser role, Q14 registration not enforced, Q16 ClamAV off) and which are a no-go? | P13 | Items on the night path (Q5, Q21, Q22) are a no-go if open; the rest are recorded as accepted in the go line. |
| Q30 | Is a written waiver of `PITR off` possible in daylight? | 4.6 "Reading `slot.sh gonogo`" | No waiver; `PITR off` is a no-go. |
| Q31 | Is the pre-approved `restore-point.sh restore pre_etl --yes` typed by the dump operator alone (needs VPS access, Q22)? | 4.6 rollback Case 2, P13 | Yes, alone, as the plan says. |

## Script gaps

Named in this checklist and not on `feature/v2-backend` (`515e440f`); where each lives. "Not found anywhere" means no fetched ref has it; nothing was invented.

| Named | Where it lives |
|---|---|
| `deploy/vps/migration/restore-point.sh`, `pitr.sh`, `slot.sh` (`gonogo`, `wipe-dump`) | Only in open PR #166 (`bf016ba0`) |
| `deploy/cutover/pointer-page/render.sh` | Only in open PR #166 |
| `npm run dump:wipe -w @pp/api` | Only in open PR #125 (`d9562dc8`) |
| `npm run admin:bootstrap -w @pp/api` | In code on `feature/v2-backend`; runbook text only in PR #186 (`f60303be`) |
| Script that creates the student, teacher and parent smoke accounts, or a way to create them while registration is closed | Not found anywhere |
| Migration count stored in a restore point | Not found anywhere (`restore-point.sh` has no such field) |
| DNS TTL change, DNS switch and switch-back, notice sending | Provider panel and the LEAD's channel; no script |
| A way to rehearse the switch under the real name | Not found anywhere (the edge serves only `PP_DOMAIN`) |
| `--files-dir` / `FILE_STORAGE_DIR` route for `slot.sh etl`; `migrate:archive-minimise` in `slot.sh etl`; a freeze-proof subcommand | Not in `slot.sh` (PR #166) |
| `.cloud` maintenance switch; unlock and lock of the read-only account | Not found anywhere |
| Operator sudo rule for `systemctl stop/start pp-backup.timer pp-restore-drill.timer` | Not found anywhere (the night card uses it; no sudoers file in the repo) |

## Where the plan and the scripts disagree

1. **Migration count "in the point".** The plan (A5 item 2) checks the count in the point's database state; `restore-point.sh` does not record it. The sheet compares the live count before and after `take`.
2. **`pre_delta`.** The plan takes it as "same state, no raw data" and the script has no guard for that; PR #166's document still describes `pre_delta` as holding a raw `staging_cloud` copy (old plan). `gonogo` demands it either way.
3. **Time-to-live.** Plan 24 h; production-vps.md 48 h (Q24).
4. **`PITR off` waiver.** `slot.sh gonogo` text mentions a written waiver; the night card forbids it at night.
5. **Smoke accounts before `pre_etl` with registration closed (P11 and A3).** Path proposed in step 3 (Q18, #109 6394041360): `admin:bootstrap`, then the admin API; it needs #230 plus `--seed-reference` for the student dashboard.
6. **Night access.** The night card needs `sudo systemctl stop/start` of two timers for the dump operator; nothing in the repo grants it.
