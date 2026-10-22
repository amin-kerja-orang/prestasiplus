# Procedure: producing an anonymised .cloud dump (AM-10)

- **Status:** draft for LEAD review (2026-10-21). Written against the fixed CLI interface of AM-10; nothing in this document has been run on real data.
- **Items marked "Perlu pengesahan"** are not confirmed yet. Do not treat them as decided.
- **Night-sitting decisions (Decided: LEAD, 22 Oct (6340542912)):** (14) the raw production dump is staged only on the throwaway staging cluster (section 8); (19) the Q9 `question_submissions` CSV is kept like the dump, outside GitHub (section 4); (16) there is no deputy: the operator runs the 01:00 night sittings alone, and every stop in this procedure means "stop, wipe, make sure the account is locked, report on #109 in the morning (aggregates only)" (sections 6 and 8). The night plan is the cutover plan on branch `be/AM-MIG-08-cutover-plan` (`docs/ops/v2-cutover-plan.md`, #124, sections 3.3, 4.0 and 4.6). **Dates (per LEAD go-live plan 22 Oct (6343623918); AM1-2's one-night reading, to be confirmed by the LEAD):** 24 Oct = the anonymised rehearsal sitting (sections 2 to 7 of this procedure, loaded on the rehearsal DB of #117; step A1 of #124) together with the MIG-07 real-data rehearsal; 27 Oct = the second rehearsal, production-like and timed (A4); 29 Oct at 01:00 MYT = the one production night sitting (section 8; B1 freeze, B2 export, B3 encrypt, hand over and wipe, then B4 to B10 on the VPS). There is no T-1 export and no delta at go-live: the earlier two-night structure (a T-1 export plus a final export) is superseded.
- **Related:** [migration runbook](../architecture/v2-migration-runbook.md) (rules in section 0, anonymiser in sections 8, 10 and 11), [database backup and encryption pattern](db-backup.md), [threat model, row 72](../architecture/v2-threat-model.md), [backend plan, OD-2 and OD-18](../architecture/v2-backend-plan.md), [BE-35 task card](../plan/backend-tasks/BE-35-anonymiser-fixtures.md).

## 1. Purpose, scope, owner

**Purpose.** Produce one pseudonymised copy of the .cloud MySQL database (a `pp-staging-dump/1` directory) for the migration rehearsals (MIG-07: staging load, profile, ETL, reconciliation), without any developer, agent or CI job ever touching real data (OD-2, OD-18).

**Scope.** This document covers the human procedure on the operator PC: preflight, the one sitting, hand-over, deletion and incident handling. The tools are `dump:check`, `dump:produce`, `dump:cloud`, `dump:wipe` (this item) and the existing `anonymise:run`, `anonymise:scan`, `staging:load` (see the runbook). It does not cover loading on the rehearsal host beyond the hand-over (see runbook section 2). Section 8 adds the production (cutover, MIG-08) flow, which uses the raw export instead of the anonymised one, and the banner image files that go with it (section 8.1).

| Role | Who | Does what |
|---|---|---|
| Operator | the half-AM operator: the one human who holds read-only .cloud access (OD-18 A, LEAD decision 21 Oct; issue #109, AM-10) | Runs every command in this document, on the operator PC |
| Approver | the LEAD | Approves the sitting, does or accepts the kept free-text review (step 4), receives incident reports, signs the deletion |
| Data owner | whoever administers the .cloud database | Creates and later drops the read-only MySQL account |
| Receiver | the owner of the rehearsal host (the VPS prepared for MIG-07) | Receives the encrypted file, loads it, confirms deletion |

Note on the owner: OD-18 names "the lead" as the person who runs the anonymiser. **LEAD decision 21 Oct, OD-18 A:** the operator (the human who holds the read-only .cloud access) runs the anonymiser and the LEAD approves. This replaces the OD-18 default and the runbook wording where "the lead" runs the anonymiser.

**Hard rules.**

- Nobody else runs this procedure. **Never a Claude or other agent session**: agents never see credentials, the key, the option file, the raw data or the dump. Do not paste any command output from the sitting into an agent session, except what step 9 allows.
- The operator PC is the one machine allowed to connect to .cloud. This is not a "development machine" in the sense of runbook section 0, rule 6: no agent, no shared account, no cloud-synced folder, no screen sharing on it. **Perlu pengesahan:** the LEAD confirms that the operator PC meets this description (the runbook text speaks of "the lead's PC").
- The raw dump, the anonymised dump and the key **never** enter GitHub, an issue or PR, any chat, or any Claude/AI session or transcript, cloud or local. The scripts read the operator's connection settings from the option file (a 600 file outside the repo) and never embed or log them.
- Everything in runbook section 0 applies (dumps are never committed, attached, or sent through chat; encrypted disks only; 7 days at most).
- Placeholders in angle brackets (`<...>`) are filled in by the operator on the day. Never write a real host, user name, password, IP address or person's name into the repository, an issue, a chat or this file.

## 2. Prerequisites (the day before, about 20 minutes, no data touched)

Work through this list on the operator PC. No data rows are read. The `dump:check` run in item 8 connects to the database and reads schema information and row counts only.

1. **Full-disk encryption is ON, and the screen locks.**
   - Windows (PowerShell as administrator): `manage-bde -status C:` must show "Protection On" for the drive that holds the user profile and the repo checkout.
   - Linux: `lsblk -o NAME,TYPE,MOUNTPOINT | grep -E "crypt|luks"` shows the root or home volume on a `crypt` device (LUKS). macOS: `fdesetup status` says "FileVault is On."
   - Set the screen lock to 5 minutes or less. If any of this is off, stop: runbook section 0, rule 5.
2. **Node 22 and the repository** at the tip of `feature/v2-backend`, on that encrypted disk, outside any cloud-sync folder.
   ```powershell
   node --version     # v22.x
   git -C <repo> fetch origin
   git -C <repo> checkout feature/v2-backend
   git -C <repo> pull --ff-only
   cd <repo>
   npm ci
   ```
   ```bash
   node --version     # v22.x
   git -C <repo> fetch origin && git -C <repo> checkout feature/v2-backend && git -C <repo> pull --ff-only
   cd <repo> && npm ci
   ```
3. **A MySQL client.** MySQL 8 client, or the MariaDB client.
   - Windows: MySQL Installer with a custom setup that installs the client programs only (no server), or unzip the MySQL 8 zip archive and use `bin\mysql.exe`. Check with `mysql --version`. **Perlu pengesahan:** the exact installer option name on the day.
   - Linux/macOS: `mysql-client` (apt: `mysql-client`; Homebrew: `mysql-client`). Check with `mysql --version`.
   - If `mysql` is not on `PATH`, set `CLOUD_MYSQL_CLIENT` to the full path of the executable (PowerShell: `$env:CLOUD_MYSQL_CLIENT = "<path>\mysql.exe"`; bash: `export CLOUD_MYSQL_CLIENT=<path>/mysql`). The path is not a secret.
4. **gpg.** Windows: install Gpg4win (it includes `gpg` and the passphrase dialog). Linux/macOS: `gpg` from the package manager. Check `gpg --version`. Windows 10 and later has `tar` and `ssh`/`scp` built in; check `tar --version` and `ssh -V`.
5. **A read-only MySQL account**, confirmed with the data owner. The tools accept only the privileges `USAGE`, `SELECT` (table-level or column-level), `SHOW VIEW` and `SHOW DATABASES` (`SHOW VIEW` is not needed: views are skipped); anything else is refused (exit 3). If no account exists, the data owner runs this on the .cloud database (placeholders only; the data owner generates and hands over the password through a private channel, never in the issue):
   ```sql
   CREATE USER 'pp_dump_ro'@'<operator IP or %>' IDENTIFIED BY <<SET-A-STRONG-PASSWORD>> REQUIRE SSL;
   -- preferred: column-level grants, only the spec columns, one statement per table
   GRANT SELECT (<col1>, <col2>, ...) ON <db>.<table> TO 'pp_dump_ro'@'<operator IP or %>';
   ```
   - **Column-level grants are preferred** (data minimisation: the account cannot even read a column that is not in the spec). The spec columns are in `apps/api/src/migration/ddl/spec.ts`, and the `dump:check` report lists the selected columns per table, so the data owner can check the grants against it. The statements are generated, without any connection, by `npm run dump:grants -w @pp/api -- --database <db> --account "'pp_dump_ro'@'<operator IP>'"` (spec columns minus the redacted ones). Through an SSH tunnel (item 6) use the tunnel account host instead: `--account "'pp_dump_ro'@'127.0.0.1'"`. The output holds the password placeholder `<<SET-A-STRONG-PASSWORD>>`, which is deliberately not valid SQL: the data owner **must replace it** with a generated password before running the statements. With column-level grants the account cannot see columns outside the spec, so the `dump:check` report lists them as "missing or not granted" and cannot answer column-name questions; for those, the data owner runs the metadata-only `information_schema.columns` query printed at the end of the `dump:grants` output with their own access and posts only the names.
   - Fallback: `GRANT SELECT, SHOW VIEW ON <db>.* TO 'pp_dump_ro'@'<operator IP or %>';` (table-level on the whole database). It is accepted by the tools but gives access to columns that are not needed. **Open LEAD item (not decided here):** whether the table-level fallback is allowed at all; the LEAD decides with the data owner.
   - Use the operator's fixed IP as the account host. If `%` cannot be avoided, the data owner **must** restrict access to the operator's address by firewall (a MUST, not advice).
   - **Tunnel variant of the account host.** With the SSH tunnel (item 6) MySQL sees the connection coming from the SSH host (often `127.0.0.1`/`localhost`), not from the operator IP, so an account `'pp_dump_ro'@'<operator IP>'` fails with `ERROR 1045`. For a tunnel sitting the data owner creates the account with the host MySQL really sees (`'pp_dump_ro'@'127.0.0.1'`, or the SSH host's address if the tunnel ends elsewhere; the data owner checks with `SELECT CURRENT_USER();` after a test login) and uses that host in every statement of this item (GRANT, ALTER USER, DROP USER). The generated script is then: `npm run dump:grants -w @pp/api -- --database <db> --account "'pp_dump_ro'@'127.0.0.1'"`. **Perlu pengesahan:** the host MySQL sees on the day.
   - **The data owner confirms, as a binding step before the sitting, that no `mandatory_roles` apply and no default role is set for `pp_dump_ro`**, for example by checking `SELECT @@global.mandatory_roles;`, `SHOW GRANTS FOR 'pp_dump_ro'@'<operator IP or %>';` and `SELECT CURRENT_ROLE();` (MySQL 8 / MariaDB) in a login as that account. The tools now read `mandatory_roles` (`SHOW GLOBAL VARIABLES`) and the current role themselves and refuse with exit 3, before any row is read, when `mandatory_roles` is non-empty or the current role is not `NONE` (MariaDB: not NULL). A server-wide `SELECT ON *.*` is refused the same way; grant on `<db>` only.
   - **Keep the account locked between sittings.** The data owner runs `ALTER USER 'pp_dump_ro'@'<operator IP or %>' ACCOUNT UNLOCK;` for the sitting and `ALTER USER 'pp_dump_ro'@'<operator IP or %>' ACCOUNT LOCK;` straight after (or creates a new account for each sitting and drops it afterwards).
   - **Load on the source.** One long consistent snapshot can strain a production database. Run the sitting off-peak, or against a read replica if the data owner has one (**Perlu pengesahan:** whether a replica exists and is current enough).
   - The data owner drops the account after the last rehearsal (`DROP USER 'pp_dump_ro'@'<operator IP or %>';`).
6. **How to reach the database.**
   - Direct over TLS: `host=<db host>` and `port=<port>` in the option file (item 7). For a remote host the tools require that the client **verifies the server certificate** (item 7); `ssl-mode=REQUIRED`, or no TLS setting at all, is refused (exit 2).
   - Through an SSH tunnel, in a separate terminal that stays open for the sitting (same command in PowerShell and bash). **This is the recommended path when the server certificate cannot be verified.**
     ```
     ssh -N -L 13306:127.0.0.1:3306 <ssh user>@<ssh host>
     ```
     Then the option file uses `host=127.0.0.1` and `port=13306`, and needs no TLS setting (the tunnel encrypts the traffic).
7. **The MySQL option file**, outside the repo, readable by you only. Create it empty, lock it, then type the content in an editor so the password never appears on a command line or in shell history.
   ```powershell
   $cnf = "$env:USERPROFILE\pp-cloud-ro.cnf"
   New-Item -ItemType File -Path $cnf | Out-Null
   icacls $cnf /inheritance:r /grant:r "$($env:USERDOMAIN)\$($env:USERNAME):(R,W)" | Out-Null
   notepad $cnf
   $env:CLOUD_MYSQL_DEFAULTS_FILE = $cnf
   ```
   ```bash
   (umask 077; touch ~/pp-cloud-ro.cnf); chmod 600 ~/pp-cloud-ro.cnf
   ${EDITOR:-nano} ~/pp-cloud-ro.cnf
   export CLOUD_MYSQL_DEFAULTS_FILE=~/pp-cloud-ro.cnf
   ```
   Only the groups `[client]` and `[mysql]` are accepted. Options in `[client]` and `[mysql]` are applied in file order, last one wins; keep only `[client]`. Any other group (`[client-server]`, `[client-mariadb]`, `[mariadb-client]`, `[mariadb]`, `[mysqldump]`, ...), `!include` or `!includedir` is refused (exit 2). **Only these keys are accepted:** `host`, `port`, `user`, `password`, `database`, `socket`, `protocol`, `ssl-mode`, `ssl`, `ssl-ca`, `ssl-capath`, `ssl-cert`, `ssl-key`, `ssl-verify-server-cert`, `skip-ssl`, `default-character-set`. Any other key is refused with exit 2, including `init-command`, `execute`, `pager`, `tee`, `plugin-dir`, any key with a `loose-` prefix, and abbreviated key names; write each key out in full. The client is started with `--defaults-file`, so no other option file on the machine is read.
   Content for a **direct connection to a remote host** (placeholders):
   ```ini
   [client]
   host=<db host>
   port=<3306>
   user=pp_dump_ro
   password=<password from the data owner>
   database=<db>
   ssl-mode=VERIFY_IDENTITY
   ssl-ca=<path to the CA file, only if the server certificate is not signed by a CA the client already trusts>
   ```
   - `VERIFY_IDENTITY` checks the certificate and that it was issued for the host name you connect to. `VERIFY_CA` (certificate only) is also accepted. `REQUIRED`, or no `ssl-mode` line, is refused for a remote host (exit 2).
   - MariaDB client: it does not know `ssl-mode`. Replace that line with `ssl=1` and `ssl-verify-server-cert` (and keep `ssl-ca=<path>` if needed).
   - If the certificate cannot be verified (self-signed with no CA file, or the host name does not match), do not weaken the setting: use the SSH tunnel instead.

   Content **through the SSH tunnel** (placeholders):
   ```ini
   [client]
   host=127.0.0.1
   port=13306
   user=pp_dump_ro
   password=<password from the data owner>
   database=<db>
   ```
   The MySQL 8 client uses TLS by default when the server offers it, so an account created with `REQUIRE SSL` still connects through the tunnel. **Perlu pengesahan:** confirm on the day (the data owner may drop `REQUIRE SSL` for the tunnel account).
   - Check the permissions: PowerShell `icacls $cnf` (only your user); bash `ls -l ~/pp-cloud-ro.cnf` (`-rw-------`).
8. **Run the preflight and share only the aggregates.** `dump:check` reads no rows. It writes `schema-report.json` and `schema-report.md` (server version, time zones, grant verdict, and per table the engine, the missing and extra column names, type notes and row counts). The report holds names and aggregates only, but it describes the .cloud server and schema in detail, so **the full report stays on the operator PC** and is never pasted into #109 or any other channel.
   Run it from the repository root. `npm run ... -w @pp/api` runs inside `apps/api`, so a relative `--out .migration-out/check-<date>` lands in `<repo>/apps/api/.migration-out/check-<date>/`.
   ```powershell
   npm run dump:check -w @pp/api -- --out .migration-out/check-$(Get-Date -Format yyyyMMdd)
   Get-Content apps/api/.migration-out/check-$(Get-Date -Format yyyyMMdd)/schema-report.md
   ```
   ```bash
   npm run dump:check -w @pp/api -- --out .migration-out/check-$(date +%Y%m%d)
   cat apps/api/.migration-out/check-$(date +%Y%m%d)/schema-report.md
   ```
   - Exit 3 means the account has a privilege outside the accepted list (item 5): stop and go back to the data owner.
   - Skim `schema-report.md` once on the PC. It should hold only table and column names, counts, versions and time zones. If anything looks like a host name or a value, tell the LEAD privately.
   - **What goes on #109 (and nothing else):** (a) the counts from the line `Tables present: <n> of <m>. Rows: <total>.`; (b) the list from the report's table column **"Source columns not in spec"** (table name and column names, no data), which answers the open-columns question of AM-08; developers add those columns to the spec and the anonymiser rules **before the sitting**; (c) the number from the section **"Source tables that ddl/spec.ts does not know (never exported)"** (the count only, not the names); (d) the `Grants:` verdict word only ("read-only (accepted)" or "NOT read-only"). Not the server version, the time zones, the engines, the `Type notes` section, any other column or table list, or the file itself. If a developer needs more, the operator sends it privately on the LEAD's say-so.
   - **Caveat for a column-level account** (one made with `dump:grants`): the database shows such an account only the columns it was granted, so "Source columns not in spec" is **empty by construction** and says nothing about columns the spec does not know. A spec column the account cannot see is reported as "missing or not granted". To answer the open-columns question, the data owner runs the metadata-only `information_schema.columns` query printed (as a comment) at the end of the `dump:grants` output, with their own access, and sends you the result (names and types only, no rows); post only the column names that are not in the spec on #109 instead.
   - **Perlu pengesahan:** this assumes the repository and its issues are private; even so, post only the items above. A developer reads them and adds any missing anonymiser rules, so the sitting does not stop on exit 4.
   - **InnoDB.** The consistent snapshot of the sitting holds only for InnoDB tables. `dump:check` prints each spec table's `engine` and warns about every non-InnoDB table. A warning means the data owner must confirm that writes to that table are frozen for the whole sitting; otherwise the sitting is a no-go. Tell the LEAD privately; post only "engine warning: yes/no" on #109.
   - **Binding smoke against the real server (before the first real sitting).** Proof so far is on MariaDB 10.11. `dump:check` must run clean **once** against the real .cloud server (metadata only, no rows), whatever its flavour and version (**Perlu pengesahan:** MySQL 8?). The JSON expression path for MySQL 5.7/8 is otherwise only string-tested. Do not schedule the sitting until this run exits 0; if it fails, post only the exit code and the MySQL error number (for example `ERROR 1045`).
   - For any failure of `dump:check`, `dump:produce` or `dump:cloud`, post on #109 **only the exit code and the MySQL error numbers** (e.g. `ERROR 1045`), never the message text.
   - **Wait for a developer to reply "rules OK" on #109.** Do not schedule the sitting before that.
9. **Time zone (LEAD decision 21 Oct, DT-1 A).** .cloud DATETIME values are `+08:00`, which is the default of `--datetime-offset`; **do not change the default**. Rule: the export writes every DATETIME with an explicit `+08:00` and every TIMESTAMP with `Z`, because `staging:load` reads offset-less strings in the session time zone. The `dump:check` report still lists the server time zones; if they look inconsistent with this, tell the LEAD instead of changing the offset.
10. **Book the sitting** with the LEAD (about 30 minutes, uninterrupted) and with the receiver of the rehearsal host (so the file can be accepted and confirmed the same day).

## 3. The sitting (target under 30 minutes)

Run every command from the repository root, in one terminal for the whole sitting (the environment variables live in it). `<date>` is `YYYYMMDD`. `$work` is a shell variable that holds the **absolute** path of the work dir; step 0 sets it (PowerShell and bash forms). Because `npm run ... -w @pp/api` runs inside `apps/api`, the work dir is `<repo>/apps/api/.migration-out/run-<date>`; the tools accept an absolute path as long as it is inside a `.migration-out` folder under the repository root, and using the one absolute path everywhere avoids pointing a command at the wrong folder.

| Step | What | Expected time |
|---|---|---|
| 0 | Prepare the machine | 2 min |
| 1 | Create a fresh key | 2 min |
| 2 | `dump:produce` | 8 min (depends on the row counts in the check report; **Perlu pengesahan**, not yet measured on real data) |
| 3 | Check the output | 2 min |
| 4 | Free-text check (operator), LEAD review or acceptance | 5 min |
| 5 | Destroy the key | 1 min |
| 6 | Encrypt the `anon` directory | 2 min |
| 7 | Hand over to the rehearsal host | 3 min |
| 8 | Delete the local copies | 1 min |
| 9 | Report on #109 | 2 min |
| | **Total** | **28 min** |

### Step 0. Prepare the machine (2 min)

- Close chat, e-mail and screen-sharing applications and any remote-desktop agent. Nobody else is looking at the screen.
- Confirm the repo, the key folder and the work folder are **not** inside a cloud-sync folder (OneDrive, Dropbox, Google Drive, iCloud). Windows: the repo path must not contain `OneDrive` or `Dropbox`; open the OneDrive and Dropbox settings and check which folders are backed up (Desktop, Documents and Pictures are often synced by default). Note that `%USERPROFILE%` itself can be redirected into OneDrive: print it with `echo $env:USERPROFILE` and check. Linux/macOS: `pwd` of the repo and of `$HOME` must not be under a sync client's folder.
- If you use the SSH tunnel, start it now (section 2, item 6) and leave it open.
- Set the environment for this terminal (the values are paths, not secrets):
  ```powershell
  $env:CLOUD_MYSQL_DEFAULTS_FILE = "$env:USERPROFILE\pp-cloud-ro.cnf"
  # only if mysql is not on PATH: $env:CLOUD_MYSQL_CLIENT = "<path>\mysql.exe"
  $date = Get-Date -Format yyyyMMdd
  $work = Join-Path (Get-Location) "apps/api/.migration-out/run-$date"
  $work    # print it: it must be under <repo>\apps\api\.migration-out\
  ```
  ```bash
  export CLOUD_MYSQL_DEFAULTS_FILE=~/pp-cloud-ro.cnf
  # only if mysql is not on PATH: export CLOUD_MYSQL_CLIENT=<path>/mysql
  date=$(date +%Y%m%d)
  work="$PWD/apps/api/.migration-out/run-$date"
  echo "$work"    # print it: it must be under <repo>/apps/api/.migration-out/
  ```

### Step 1. Create a fresh key (2 min)

A new key for every run. Never reuse one, never back it up (runbook section 8). The commands are the same as in the runbook:

```powershell
$b = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
$f = "$env:USERPROFILE\pp-anon-$date.key"
New-Item -ItemType File -Path $f | Out-Null                         # 1. an empty file
icacls $f /inheritance:r /grant:r "$($env:USERDOMAIN)\$($env:USERNAME):(R,W)" | Out-Null # 2. lock it down BEFORE the key is written
[Convert]::ToBase64String($b) | Set-Content -NoNewline -Path $f      # 3. write the key
$env:ANON_HMAC_KEY_FILE = $f                                         # this shell only
Remove-Variable b                                                    # the key bytes must not stay in the session
```

```bash
(umask 077; head -c 48 /dev/urandom | base64 > ~/pp-anon.key) && chmod 600 ~/pp-anon.key
export ANON_HMAC_KEY_FILE=~/pp-anon.key
```

Never use `ANON_HMAC_KEY` inline and never print or open the key file. On Windows the tool cannot enforce permissions and prints a warning; the `icacls` lock above is your protection.

### Step 2. Produce the dump (8 min)

```powershell
npm run dump:produce -w @pp/api -- --work "$work" --datetime-offset +08:00
```

```bash
npm run dump:produce -w @pp/api -- --work "$work" --datetime-offset +08:00
```

**Time zone rule (LEAD decision 21 Oct, DT-1 A; also section 2, item 9).** `--datetime-offset` is `+08:00` and must not be changed. The export writes every DATETIME with an explicit `+08:00` and every TIMESTAMP with `Z`, because `staging:load` reads offset-less strings in the session time zone. Leave the flag out, or pass `+08:00` as above.

What the tool does: checks the key first; exports a consistent read-only snapshot (only the columns in the spec, secrets NULL at source) through `<work>/raw.partial` to `<work>/raw`; anonymises through `<work>/anon.partial` to `<work>/anon`; leak-scans; writes `<work>/schema-report.json` and `<work>/schema-report.md`; and then **always** wipes the raw export, whether the run succeeded or not. It prints row counts, sizes, the sha256 of `anon/manifest.json` and the elapsed time. Keep the terminal open: you need these numbers in steps 3 and 9.

**Interrupting the run.** A first Ctrl+C (or closing the terminal) stops the run promptly, in the export and in the anonymiser phase as well, and the raw data is wiped. A second Ctrl+C forces a synchronous wipe (wait for the prompt to come back). If the process is killed hard (Task Manager, `kill -9`, a power cut), run `dump:wipe --dir "$work"` **before anything else**, then destroy the key (section 6).

If the exit code is not 0, go to section 6 now.

### Step 3. Check the output (2 min)

- Exit code 0 (`$LASTEXITCODE` in PowerShell, `echo $?` in bash).
- `<work>/raw` does not exist and there is no `.partial` directory: `ls "$work"` (PowerShell: `Get-ChildItem $work`) shows `anon`, `schema-report.json` and `schema-report.md`, and nothing else.
- The table count and row counts are plausible against the `dump:check` report (same tables, row counts the same or slightly higher if the live system moved since the check; a table with 0 rows that had rows is a failure).
- Write down for step 9: exit code, table count, total rows.

### Step 4. Free-text check by the operator, then the LEAD review (5 min)

**LEAD notice 21 Oct (delta to runbook section 11):** the operator verifies the anonymisation on the operator PC **before anything leaves it**. This check is mandatory and is the operator's own (parts 1 and 2 below). The LEAD's review required by runbook section 11 then happens in one of two ways: the LEAD is present in person at the operator PC (no screen sharing, no photos), or the LEAD accepts the operator's written result on #109, which holds aggregates only (the columns checked, the number of values looked at per column, and "no real name found"; never a value). The rule is: **no real person's name may appear in a shared dump.** This step belongs to the anonymised rehearsal dump only. For the 01:00 production night (section 8) no LEAD is present and there is no free-text check: the raw flow has no anonymised output and nothing to review (Decided: LEAD, 22 Oct (6340542912)).

1. Run the pattern scan on the output (patterns only):
   ```
   npm run anonymise:scan -w @pp/api -- --dir "$work/anon"
   ```
   It must exit 0.
2. For each kept free-text column in the list in runbook section 11 (`notes.body`, `notes.title`, `questions.body`, `exam_papers.title`, `users.kelas`, `users.teaching_subject`, `question_attempts.selected_option`, and the rest of that list), look at a sample of the values in the terminal. This prints to the screen only; do not redirect to a file, copy or screenshot. The command prints every `<stride>`-th value of one column, at most 40:
   ```powershell
   node -e "const r=require('readline').createInterface({input:require('fs').createReadStream(process.argv[1])});let i=0,n=0;const k=+process.argv[3];r.on('line',l=>{if(i++%k===0&&n++<40){const v=JSON.parse(l)[process.argv[2]];console.log(typeof v==='string'?v:JSON.stringify(v))}})" "$work/anon/notes.ndjson" body 50
   ```
   ```bash
   node -e "const r=require('readline').createInterface({input:require('fs').createReadStream(process.argv[1])});let i=0,n=0;const k=+process.argv[3];r.on('line',l=>{if(i++%k===0&&n++<40){const v=JSON.parse(l)[process.argv[2]];console.log(typeof v==='string'?v:JSON.stringify(v))}})" "$work/anon/notes.ndjson" body 50
   ```
   Change the file (`<table>.ndjson`), the column (`body`) and the stride (50: choose about row count divided by 40). For a json column the whole value is printed. Look for a teacher, parent or pupil named in a note, title, comment or class label. The values stay in the terminal scrollback: close the terminal window after the sitting (`clear` does not remove scrollback).
3. A sample is not proof. If any real name is seen in any column, **stop**: the LEAD decides the new rule (`scrub-text` or `null`) for that column in `anon.config.json`, a developer applies it, and the whole sitting is repeated with a new key on another day (section 6, "Review failed"). Do not hand over this dump.
4. If nothing is found, the operator writes the aggregate result for the LEAD (step 9), and the LEAD is present or accepts it on #109. **Open LEAD item (not decided here):** the sample size (40 values per column at a stride) is a proposal; the LEAD sets the size.

### Step 5. Destroy the key (1 min)

As soon as steps 2 to 4 are finished. The encryption in step 6 uses a separate passphrase, not this key. After this the fakes can never be linked back to people.

```powershell
Set-Content -Path $f -Value ('0' * 128) -NoNewline   # overwrite
Remove-Item $f
Remove-Item Env:ANON_HMAC_KEY_FILE
Test-Path $f                                          # must be False
```

```bash
shred -u ~/pp-anon.key        # macOS: rm -P ~/pp-anon.key
unset ANON_HMAC_KEY_FILE
ls ~/pp-anon.key              # must say: No such file
```

On an SSD or a journaling file system, overwriting does not guarantee the old blocks are gone; full-disk encryption is the real guard, which is why section 2, item 1 is a hard prerequisite.

The commands in this procedure never contain a secret, so shell history only holds paths. If you ever typed a password, a key or a passphrase on a command line, treat it as exposed: tell the LEAD, rotate that secret, and remove the history line. PowerShell history file: `(Get-PSReadLineOption).HistorySavePath`. bash: `history -c; history -w`.

### Step 6. Encrypt the anon directory (2 min)

Encrypt with a passphrase (the pattern from [db-backup.md](db-backup.md)). Generate a passphrase and keep it in a password manager or on paper; do not save it in a file next to the archive, and do not type it on a command line (gpg asks for it in a dialog or prompt).

```powershell
$p = New-Object byte[] 24
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($p)
[Convert]::ToBase64String($p)    # shown once on screen: copy it to the password manager (the window is closed after the sitting)
Remove-Variable p
$name = "pp-staging-dump-$date.tar.gz.gpg"
Push-Location $work              # relative names inside the work dir: no quoting problems with spaces in the path
cmd /c "tar -czf - anon | gpg --symmetric --cipher-algo AES256 -o $name"
$LASTEXITCODE                    # must be 0
# mandatory listing check (asks for the passphrase again); the count must be the number of files in anon plus 1 (the directory entry)
cmd /c "gpg --decrypt $name | tar -tzf -" | Measure-Object -Line
$LASTEXITCODE                    # must be 0
(Get-ChildItem anon).Count
Get-FileHash -Algorithm SHA256 $name
Pop-Location
$out = Join-Path $work $name
```

```bash
head -c 24 /dev/urandom | base64   # shown once on screen: copy it to the password manager (the window is closed after the sitting)
name="pp-staging-dump-$date.tar.gz.gpg"
out="$work/$name"
( set -o pipefail; tar -C "$work" -czf - anon | gpg --symmetric --cipher-algo AES256 -o "$out" ); echo "exit $?"   # must be 0
# mandatory listing check (may ask for the passphrase again); the count must be the number of files in anon plus 1 (the directory entry)
( set -o pipefail; gpg --decrypt "$out" | tar -tzf - | wc -l ); echo "exit $?"   # must be 0
ls "$work/anon" | wc -l
sha256sum "$out"
```

- On Windows PowerShell the pipe must run inside `cmd /c`: the PowerShell pipeline would corrupt binary data. The exit code of a `cmd /c` pipeline is the one of its last command, so the listing check (a readable archive with the right number of entries) is what proves the encryption worked.
- **The listing check is mandatory.** Do not hand over a file whose exit code is not 0 or whose listing fails or has the wrong count. In that case wipe and start again as in section 6.
- Send the passphrase to the receiver through a **different channel from the file**: a phone call, in person, or an end-to-end-encrypted messenger on a device that has no AI agent and no cloud session on it. Never on #109, in a PR, in e-mail, in any chat with an agent, in the same message as the file, or in any Claude/AI session or transcript.

### Step 7. Hand over to the rehearsal host (3 min)

Only to the rehearsal host (the MIG-07 VPS), into a directory that only the receiver's account can read. Never GitHub, a PR, an issue, chat, CI, an e-mail attachment, a cloud drive, or any Claude/AI session or transcript.

```powershell
scp "$out" <user>@<rehearsal host>:<restricted dir>/
```

```bash
scp "$out" <user>@<rehearsal host>:<restricted dir>/
```

(`sftp` works the same way.) The receiver runs `sha256sum` on the received file, compares it with the value from step 6 (the hash is not secret, any channel will do), and confirms receipt. **Do not go to step 8 until the receiver has confirmed.**

The receiving side is the rehearsal DB environment prepared by half AZ (PR #117, branch `ops/AZ-30-rehearsal-db`, not merged yet; its recipe is `docs/ops/rehearsal-db.md` on that branch). The receiver decrypts and extracts **outside the repository** (a restricted directory), then runs `deploy/rehearsal/rehearsal-db.sh load-dump <path to the extracted anon directory>`. That script accepts a `pp-staging-dump/1` directory, checks its sha256, and refuses a dump that is inside the repo. The receiver deletes the `.gpg` file, the extracted directory and the staging databases again per section 4. **Perlu pengesahan:** the exact path argument and the script's behaviour are taken from PR #117 and are checked once it is merged.

### Step 8. Delete the local copies (1 min)

After the receiver's confirmation:

```powershell
npm run dump:wipe -w @pp/api -- --dir "$work"
Test-Path $work    # must be False
```

```bash
npm run dump:wipe -w @pp/api -- --dir "$work"
ls "$work"         # must say: No such file or directory
```

This overwrites with zeros and deletes the directory (`anon`, the `.gpg` file, the report files and anything left, including any `.partial` directories inside it). Close the SSH tunnel (Ctrl+C in its terminal). Empty the recycle bin or trash if you deleted anything by hand. **After every sitting, also a failed one (checklist, binding):** (a) `dump:wipe` has run and `<work>` is gone; (b) the key is destroyed (anonymised flow); (c) **the operator deletes the option file** (`Remove-Item $cnf` / `shred -u ~/pp-cloud-ro.cnf`) **or the data owner locks the account** (`ACCOUNT LOCK`, item 5), and the operator confirms which one on #109 in the words "option file deleted" or "account locked"; (d) the tunnel is closed. If the account is only locked, the option file stays until the last rehearsal (section 4) and must remain mode 600. Leave `apps/api/.migration-out/check-<date>` (aggregates only) until the rehearsals are done. After step 9, **close the terminal window**: it holds the passphrase and the sampled text in its scrollback.

### Step 9. Report on #109 (2 min)

Post one comment with **only**:

- date;
- exit code of `dump:produce`;
- number of tables and total number of rows;
- sha256 of the `.gpg` file;
- the offset used for `--datetime-offset`;
- "free-text check passed (operator)" and "LEAD review: present in person" or "LEAD accepted on #109" (aggregates only);
- "raw wiped, key destroyed", and "local copies deleted" once step 8 is done.

Never post data, file paths that contain personal information, the passphrase, the key, the option file or any host name.

## 4. Where things live and when they are deleted

The anonymised dump is **pseudonymised, not anonymous**: ids and timestamps are kept, so the records could be linked to a person by anyone who also holds the raw data, and free text that was kept can name people; it is still personal data of minors (runbook section 10). The key is destroyed in step 5 and nobody holds it afterwards. This supersedes the wording of runbook section 10 that the lead holds the key. **Perlu pengesahan:** the LEAD confirms.

| Item | Where | Deleted when |
|---|---|---|
| MySQL option file (`CLOUD_MYSQL_DEFAULTS_FILE`) | Operator PC, outside the repo, mode 600 / user-only | After every sitting (also a failed one) unless the data owner has locked the account (section 3, step 8 checklist); in any case after the last rehearsal or at go-live, whichever comes first, when the data owner drops `pp_dump_ro` |
| Anonymiser key | Created in step 1; it exists for the sitting only | Destroyed in step 5. Never reused, never backed up, never copied |
| Raw export `<work>/raw.partial` and `<work>/raw` | Operator PC, inside `apps/api/.migration-out`; never leaves the PC | Wiped by `dump:produce` itself, on success and on failure |
| Anonymised directory `<work>/anon` and the `.gpg` file | Operator PC under `.migration-out`, encrypted disk | Step 8, after the receiver confirms receipt |
| `.gpg` file and extracted dump on the rehearsal host | Restricted directory on the rehearsal host (encrypted disk) | As soon as load and reconciliation succeed, 7 days at most (runbook section 0, rule 4, and section 10) |
| Staging databases (`staging_cloud`, `archive_cloud`) and reports on the rehearsal host | Rehearsal host | Dropped after reconciliation (runbook section 5) |
| `dump:check` report (`apps/api/.migration-out/check-<date>`) | Operator PC | Aggregates only; delete with the option file at the latest, 30 days at most |
| Written deletion confirmation | A comment on #109 by the operator (local copies, key) and a comment by the receiver (host copies, staging databases), then the LEAD signs | Kept as the record; this is the "dump deleted" line that threat model row 72 asks for |

**Added (Decided: LEAD, 22 Oct (6340542912)), the Q9 open-question-report CSV and the staged raw dump:**

| Item | Where | Deleted when |
|---|---|---|
| `question_submissions` CSV (metadata only; produced by `migrate:export-question-reports` on #123, cutover plan section on open question reports, Q9) | Held by whoever runs the export, in the same custody as the dump: encrypted disk, mode 0600 under `.migration-out/`, handed over out of band, **outside GitHub** (never in git, an issue, a PR, a chat or any Claude/AI session). Same retention and access as the dump (section 5, "Access") | When the dump is deleted, on the same confirmation (the deletion comment lists it) |
| Raw production dump (section 8) after hand-over | Only on the throwaway staging cluster of half AZ (decision 14); never on GitHub, never in any cloud session | Destroyed after the cutover sign-off (the cluster, the `.gpg` file and the extracted directory) |

The confirmation comments contain the date, "deleted" and what was deleted, and nothing else.

## 5. PDPA and minors

- **Data minimisation.** Only the columns in the spec are exported; source-only columns are never exported; secrets (`remember_token`, `parent_invite_token`) are NULL at the source. Every personal value is replaced by the anonymiser (runbook section 8).
- **Purpose limitation.** The dump is for the migration rehearsal only. It is never loaded into production: its manifest is marked anonymised, `staging:load` refuses a marked dump when `NODE_ENV` is production, and it refuses any database that is not a `_staging` database. Student, teacher and parent accounts in it have a published dummy password.
- **Storage limitation.** 7 days at most on the rehearsal host; deleted as soon as the load and reconciliation succeed.
- **Access.** Only the operator, the LEAD and the receiver ever touch the file. Do not share the dump with anyone who also has raw data (ids and timestamps link them).
- **Incident.** A lost or stolen laptop, a file sent to the wrong place, a copy on an unencrypted disk, a passphrase or key sent together with the file, or a leak-scan hit.
  1. **Stop.** Do not retry, do not copy the file elsewhere, do not "tidy up first".
  2. **Tell the LEAD immediately** by phone or private message, not on a public issue. (Exception, the 01:00 production night, Decided: LEAD, 22 Oct (6340542912): nobody is woken. The operator stops, wipes with `dump:wipe`, makes sure the account is locked, and reports to the LEAD on #109 in the morning, aggregates only.) Write down the time you noticed it and what was involved (which files, which channel, to whom).
  3. Do what the LEAD says: usually wipe local copies, ask the receiver to delete host copies, and have the data owner drop the account and change its password.
  4. The LEAD decides whether the data owner, the affected schools or the authority must be informed. **Open LEAD item:** a statutory notification period may apply; the LEAD checks with the data owner or a legal adviser. Record the incident with date, time and outcome.

## 6. Abort and troubleshooting

If the sitting is interrupted for any reason (a call, a power cut, a lost connection, a doubt): run `dump:wipe --dir "$work"` first (also after a hard kill: Task Manager, `kill -9`, a power cut), then destroy the key (step 5), close the tunnel, and **start again on another day with a NEW key and a NEW work dir**. An interrupted run is not resumed.

```powershell
npm run dump:wipe -w @pp/api -- --dir $work
```

```bash
npm run dump:wipe -w @pp/api -- --dir "$work"
```

**Night sitting rule (Decided: LEAD, 22 Oct (6340542912), no deputy, decision 16).** For the 01:00 production night sitting on 29 Oct (B1 to B3 of the cutover plan, per LEAD go-live plan 22 Oct (6343623918); AM1-2's one-night reading, to be confirmed by the LEAD) the operator is alone. **Every stop condition in this section and in section 8, in particular exit codes 1, 2, 3, 6 and 130 (any other non-zero code is treated the same), the receiver not confirming, and a failed check, means the same four things and nothing else:** (1) stop, do not retry; (2) wipe with `dump:wipe --dir "$work"`; (3) make sure the account is locked (the data owner's lock, arranged before the night; if the operator cannot confirm it, say so in the report); (4) report on #109 in the morning, aggregates only (exit code and `ERROR n` numbers). The same STOP also closes everything else that the night opened, matching the "Common to every STOP" block of #124 section 4.6, in this order: wipe the work dir and check it is gone; delete the `.gpg` file (the local copy); wipe the dump copies on the receiving host (the half AZ `slot.sh` steps named in #124); the account locked (confirmed by a refused connection attempt) or "lock unconfirmed"; close the SSH tunnel; close the terminal, which holds the passphrase in its scrollback, and destroy the passphrase note. Nobody is called, woken or asked for a go/no-go during the night; the decision to repeat is taken in the morning by the LEAD. Wherever a row below says "tell the LEAD" or "tell the data owner", read it as "in the morning report" for a night sitting.

`dump:wipe` covers everything in the work dir, including the `raw.partial` and `anon.partial` directories. After any non-zero exit check that `<work>` is gone (or wipe it) and that the key file is destroyed.

| Exit code | Meaning | What to do |
|---|---|---|
| 0 | Success | Continue to step 3 |
| 1 | Failed (other error) | Read the message on the PC only. Wipe the work dir, destroy the key. If the cause is not obvious, post on #109 **only the exit code and the MySQL error numbers** (e.g. `ERROR 1045`), never the message text (it can hold host, user or schema names); send more privately to the LEAD if needed. A client-side failure with no `ERROR n` (for example the MariaDB client rejecting `ssl-mode`) shows `The MySQL client failed (exit N)` followed by a fixed short text instead of the client's message: post only "exit 1". With the MariaDB client use `ssl=1` plus `ssl-verify-server-cert` in the option file (item 7), not `ssl-mode`, or install the matching MySQL 8 client and set `CLOUD_MYSQL_CLIENT`; then run `dump:check` again |
| 2 | Usage or configuration error | Check: `CLOUD_MYSQL_DEFAULTS_FILE` points to an existing file with the right permissions; `ANON_HMAC_KEY_FILE` points to a file outside the repo, mode 600, at least 32 characters; `mysql --version` works or `CLOUD_MYSQL_CLIENT` is set; `--work` names a path inside a `.migration-out` folder under the repository root, and is new or empty; the option file holds only the `[client]` and `[mysql]` groups and only the allowed keys (item 7); for a remote host the option file verifies the server certificate (`VERIFY_IDENTITY` or `VERIFY_CA`, or `ssl=1` plus `ssl-verify-server-cert` for MariaDB). The key is checked first, so nothing was read. Fix and run again; destroy the key you created and make a new one |
| 3 | Account not read-only | Nothing was read. Destroy the unused key (step 5). Do not try to fix the grants yourself. Tell the data owner to remove every privilege except `USAGE`, `SELECT` (table or column level), `SHOW VIEW` and `SHOW DATABASES` (section 2, item 5), to remove any server-wide `SELECT ON *.*`, and to remove any `mandatory_roles` or default role (the tools refuse when `mandatory_roles` is non-empty or the current role is not `NONE` (MariaDB: not NULL)), then run `dump:check` again |
| 4 | An anonymiser rule is missing for a column | The rules are checked before the tool connects, so no data was fetched. Destroy the unused key (step 5). Post the column names (names only, no table contents) on #109. A developer adds the rules and the LEAD approves them; run `dump:check` again, wait for "rules OK", and sit again with a new key |
| 5 | Leak scan hit | The output was deleted. **Stop and tell the LEAD at once**; do not rerun elsewhere. The log names the `table.column` and the kind of hit, not the value. The LEAD decides the rule change (runbook section 8, step 4); a developer applies it; sit again with a new key |
| 6 | Row-count mismatch or bad stream | The source changed during the export or the connection broke (tunnel dropped?). Raw is wiped. Check the tunnel and the network, wipe, destroy the key, and run again with a new key and a new work dir. Repeated failures: post only the exit code on #109 and tell the LEAD privately (night sitting: stop, wipe, account locked, morning report; see the night sitting rule above). **Also exit 6, for `dump:produce` and for `dump:cloud`:** the export contains an integer of 2^53 or larger (a BIGINT that cannot be kept exact). The run is refused and the partial output is deleted; tell the LEAD privately which table (post only the exit code on #109, no value), and a developer fixes it before the next sitting |
| 130 | Interrupted twice (Ctrl+C, closed terminal, shutdown) | Night sitting: stop, wipe, account locked, morning report. The raw and partial directories were force-deleted, so nothing raw is left, but the run is dead. Destroy the key (step 5), check that `<work>` holds no `raw` and no `.partial`, and start again from step 1 with a new key and a new work dir. A single interrupt exits 1 instead (the tool cleans up by itself; see exit 1) |
| Review failed (step 4) | A real name is in a kept column | Do not hand over. Wipe, destroy the key, the LEAD changes the rule, a developer applies it, sit again with a new key |

For the cutover, `dump:cloud` is the normal path and is described in section 8. Outside the cutover, `dump:cloud` (raw export only) is a troubleshooting tool for a failing export. If used: `npm run dump:cloud -w @pp/api -- --out <dir>` writes raw data, so it is real personal data on disk. Then run `anonymise:run` and `anonymise:scan` as in runbook section 8, and `npm run dump:wipe -w @pp/api -- --dir <dir>` on the raw directory straight afterwards, with the same key and wipe rules as above.

## 7. Repeat runs (rehearsals and delta runs)

Every run follows this document from the start of section 3:

- a **fresh key** each time (a second dump made with one key can be joined to the first on its fakes);
- a **fresh work dir** (`.migration-out/run-<date>`; if a second run falls on the same day, add a suffix such as `run-<date>-2`);
- the same deletion rules, the same #109 report, the same confirmation of deletion;
- a new `dump:check` when the schema may have changed or after any exit 4, with "rules OK" before the sitting.

Because the key differs, the fakes differ between two dumps: each run is a complete standalone dump, and rehearsals cannot compare pseudonyms across dumps. The `--datetime-offset` stays `+08:00` (LEAD decision 21 Oct, DT-1 A).

## 8. Production raw-data flow (cutover, MIG-08)

Sections 1 to 7 describe the anonymised rehearsal dump. The cutover (MIG-08, plan section 3.3 in the cutover plan on branch `be/AM-MIG-08-cutover-plan`, `docs/ops/v2-cutover-plan.md`) needs the **raw** `dump:cloud` output as the normal path, because the ETL refuses anonymised data in production. AM-10 confirms that addendum, and it is part of this procedure. The same hand-over and wipe rules apply, to a raw directory.

**Where the raw dump is staged (Decided: LEAD, 22 Oct (6340542912), decision 14).** The raw production dump is staged **only on the throwaway (temporary) staging cluster** of half AZ (#166, `deploy/vps/migration/slot.sh`; its recipe is `docs/ops/production-migration-slot.md` once #166 is merged; that file is not on `feature/v2-backend` yet). The cluster is destroyed after the cutover sign-off. The raw dump never goes to GitHub or to any cloud session. This replaces every earlier open wording about where it is staged.

**`NODE_ENV` on the receiver.** "Production" here means real data, not `NODE_ENV=production`. `staging:load` refuses to run under `NODE_ENV=production` for any dump (its reset guard), so the receiver runs `staging:load` on the throwaway staging cluster with `NODE_ENV` not set to production, `PP_ALLOW_STAGING_RESET=1` and a `_staging` database (or `PP_STAGING_DB_ALLOWLIST`). A raw dump carries no `anonymised`/`synthetic` marker, so it is not refused as synthetic; the production guards apply later, to `migrate:*` (MIG-08 plan).

**The raw export is real personal data of minors.** Encrypted disk (section 2, item 1), no screen sharing, no cloud-sync folder, and it never enters GitHub, an issue or PR, any chat, or any Claude/AI session or transcript. Everything in section 1 (hard rules) and section 5 (PDPA and incidents) applies in full.

**Timing and who is present (Decided: LEAD, 22 Oct (6340542912); per LEAD go-live plan 22 Oct (6343623918); AM1-2's one-night reading, to be confirmed by the LEAD).** There is **one** production sitting, on 29 Oct 2026 from 01:00 MYT (28 Oct 17:00 UTC): #124 B1 freezes `.cloud` (the `.cloud` maintenance switch, not part of this procedure), B2 is `dump:check` then `dump:cloud` (this section, steps 3 to 6), B3 is encrypt, hand over, compare the checksum and wipe (steps 7 to 9). The earlier T-1 export (A2) and the second export are gone: the export is taken in the freeze, so the table and row counts equal the `dump:check` report. The operator runs the sitting alone: no deputy, no LEAD present, nobody on call (decision 16). The data owner's part (creating the account, and the unlock and lock of `pp_dump_ro`) and the booking are arranged **before** the night (#124 section 4.6, "Night access" and "Before the night"); the operator holds no `ALTER USER`. Nothing in the night requires waking anyone. The migrate, verify and rollback steps (B4 to B10, S1 to S7, restore of `pre_etl`) belong to #124, not to this procedure; a threshold breach there (decision 4b: 5 % or 100 rows, where a delta applies at all) is a stop and rollback by #124.

**The production sitting (B2 and B3), by the operator alone on the operator PC; the data owner is not present and the account is unlocked and locked by the arrangement made beforehand:**

1. **No anonymiser key.** `ANON_HMAC_KEY_FILE` is not set (unset it if the terminal has it), steps 1 and 5 of the sitting (create and destroy the key) are skipped, and `dump:produce` and `anonymise:*` are not used. `IC_HASH_KEY` is a different thing (the ETL side); it is **kept** and never deleted here.
2. `pp_dump_ro` is unlocked by the pre-arranged event or arrangement of the data owner (section 2, item 5; with a tunnel use the tunnel account host); the operator does not run `ALTER USER`. A locked account at `dump:check` (exit 1 with `ERROR 1045`, or exit 3) is a STOP by the night sitting rule (section 6).
3. Prepare the terminal as in step 0 (option file, tunnel if used, `$date`), and define the work dir as an absolute path, unique per sitting (`run-<date>-final` for the production night sitting, as in #124 B2; a rehearsal of it uses another suffix):
   ```powershell
   $work = Join-Path (Get-Location) "apps/api/.migration-out/run-$date-final"
   New-Item -ItemType Directory -Path $work | Out-Null     # must not exist yet
   icacls $work /inheritance:r /grant:r "$($env:USERDOMAIN)\$($env:USERNAME):(OI)(CI)F"
   ```
   ```bash
   work="$PWD/apps/api/.migration-out/run-$date-final"
   mkdir -m 700 "$work"                                     # must not exist yet
   ```
   The work dir is created first with owner-only permissions, because the `.gpg` file of step 7 is written into it.
4. Run `dump:check` as a last look (section 2, item 8; it reads no rows) into a new directory such as `.migration-out/check-<date>` (a reused, non-empty directory gives exit 2), then the raw export. `--datetime-offset` stays at its `+08:00` default (DT-1 A; DATETIME with explicit `+08:00`, TIMESTAMP with `Z`).
   ```powershell
   npm run dump:cloud -w @pp/api -- --out "$work/raw"
   ```
   ```bash
   npm run dump:cloud -w @pp/api -- --out "$work/raw"
   ```
   Expect exit 0. **Exit 6 means stop: it is a no-go for that sitting** (row-count mismatch or bad stream, or an integer of 2^53 or larger). Do not retry in the same sitting. Stop, wipe (`dump:wipe`), make sure the account is locked, and report on #109 in the morning, aggregates only (exit code, no values). Rehearsal sittings in daytime may tell the LEAD privately instead.
5. **The account is locked again** by the same pre-arranged arrangement after the export, **also after a failure**. The operator confirms the lock by a refused connection attempt, or reports "lock unconfirmed".
6. Check the output: the manifest in `<work>/raw` is marked `raw: true`, no `.partial` directory is left, and the table and row counts equal the `dump:check` report (the export is taken in the freeze, so they are equal; a difference is a STOP).
7. **Encrypt** with the same commands as step 6 of the sitting, with `raw` (and `files`, if section 8.1 applies) in place of `anon`; the **listing check is mandatory**: the line count it prints must equal the number of files plus directories under `raw` (and `files`) plus the top directories themselves (bash: `find "$work/raw" | wc -l`; PowerShell: `(Get-ChildItem -Recurse "$work/raw").Count + 1`). Take the sha256 of the `.gpg` file. The passphrase goes to the receiver by phone call, in person or an end-to-end-encrypted messenger on a device with no AI agent or cloud session (step 6), never with the file, never in GitHub, e-mail, or any chat with an agent.
   ```powershell
   $name = "pp-cutover-dump-$date.tar.gz.gpg"
   Push-Location $work
   cmd /c "tar -czf - raw | gpg --symmetric --cipher-algo AES256 -o $name"
   $LASTEXITCODE                    # must be 0
   cmd /c "gpg --decrypt $name | tar -tzf -" | Measure-Object -Line
   $LASTEXITCODE                    # must be 0
   Get-FileHash -Algorithm SHA256 $name
   Pop-Location
   $out = Join-Path $work $name
   ```
   ```bash
   name="pp-cutover-dump-$date.tar.gz.gpg"; out="$work/$name"
   ( set -o pipefail; tar -C "$work" -czf - raw | gpg --symmetric --cipher-algo AES256 -o "$out" ); echo "exit $?"   # must be 0
   ( set -o pipefail; gpg --decrypt "$out" | tar -tzf - | wc -l ); echo "exit $?"                                   # must be 0
   sha256sum "$out"
   ```
8. **Hand over** with `scp "$out" <user>@<receiver host>:<restricted dir>/` to the receiver, who runs the throwaway staging cluster (MIG-08 plan section 3.1). The checksum is compared on the receiving host: `sha256sum` there, against the value of step 7. **At night the operator is both sender and receiver** (#124 section 3.3 item 5 and section 4.6 B3): the operator runs the VPS steps alone, types a fresh passphrase once on the receiving host to decrypt (kept in the operator's head or on paper, never sent anywhere), and destroys it at the close. A mismatch allows one new hand-over; a second mismatch is a STOP. In a daytime rehearsal of this flow the receiver does the comparison and confirms. The receiver stages the extracted dump only on the throwaway cluster (decision 14).
9. **As soon as the receiver confirms the checksum**, run `dump:wipe --dir "$work"`. **Same-day cap:** if the checksum is not confirmed by the end of the sitting (the "receiver not confirming" case), run `dump:wipe --dir "$work"` anyway, delete the `.gpg` file, and repeat the sitting; the plaintext raw directory never stays on the operator PC overnight. In a night sitting this is the "receiver not confirming" stop: wipe, make sure the account is locked, report in the morning (no call, no waiting for a go/no-go). Then, delete the `.gpg` file if it is outside `$work`, and close the SSH tunnel. Do not wait for the verify or the load. The receiver then holds the only copy and deletes it right after `staging:load` succeeds.
10. Report **aggregates only** on #109: date, exit code, number of tables, total rows, sha256 of the `.gpg` file, "local copies deleted", and "option file deleted" or "account locked" (section 3, step 8 checklist). Never data, message text of errors (exit code and `ERROR n` only), paths with personal information, the passphrase or any host name.

**Abort and failure.** The abort table in section 6 applies, including exit 6 and exit 130. After a failure or an interruption run `dump:wipe --dir "$work"` **first** (also after a hard kill), make sure the data owner has locked the account, and only then repeat (in a night sitting, repeating is decided in the morning, not during the night: stop, wipe, account locked, morning report on #109, aggregates only). There is no key to destroy in this flow. An interrupted export inside the freeze costs the export time again (MIG-08 plan, trigger R2), but at night it is a STOP, not a repeat (#124 S3).

**Rehearsal dates of this flow (per LEAD go-live plan 22 Oct (6343623918); AM1-2's one-night reading, to be confirmed by the LEAD).** 24 Oct: the anonymised sitting of sections 2 to 7 plus the real-data rehearsal on the rehearsal DB (#124 A1). 27 Oct: the production-like, timed rehearsal (A4): the `dump:cloud` part is timed against the rehearsal source only (a synthetic or anonymised database, never the real .cloud), and the rest of this section is exercised in daylight with the receiver confirming.

**Retention.** The same deadlines as section 4 apply: the operator wipes in step 9; the receiver deletes right after `staging:load` succeeds, and in any case within 7 days (runbook section 0, rule 4); the throwaway cluster is destroyed after the cutover sign-off (Decided: LEAD, 22 Oct (6340542912)). The Q9 `question_submissions` CSV follows the same custody (section 4). The option file and the account follow section 4.

### 8.1 Content files (AC9, `--files-dir`; LEAD decision 22 Oct: A without ticket attachments)

`migrate:activity` never reads the .cloud storage. It migrates files only when the receiver passes `--files-dir=<dir>` (runbook section 19.1 on the AM-08 branch). The operator exports the files in the same sitting as the raw dump.

**What is exported.** Only the files the staged rows point to, and today `migrate:activity` copies only `banners.image_path`. So the operator **exports the banner image files only**, i.e. the files named by `image_path` in the raw `banners` export (`<work>/raw`). Article images and note and video files are not staged, so they are not migrated and are **not exported**; `audio_kbat.audio_path` is counted, not copied, so it is not exported either. **Support-ticket attachments are never exported** (LEAD decision 22 Oct). A wider export needs a spec change first.

**Access (Perlu pengesahan: confirm with the data owner/LEAD).** The operator uses read-only access to the .cloud storage, which is **more than the MySQL account**: it needs read-only shell access to the storage. The method, the host and who provides the access are not decided, and this document assumes none. No command that writes to the .cloud server is ever used. Shell access to the storage can see more than the banner files (ticket attachments, server configuration), so **before the sitting** the access is scoped to the banner directory (for example an rsync-only or forced-command SSH key, or a chroot) and is removed after the sitting. Files are copied without following symbolic links (`rsync -r --no-links`, or `tar --no-dereference`; never `scp -r`, which follows them).

**`SHA256SUMS`.**
- It is generated **on the .cloud server at export time**, from the live storage, read-only, by the operator. A manifest made from the exported copy proves nothing about tampering or damage in transit.
- Format: `sha256sum` output, with paths relative to the export directory, in exactly the same text the staged `image_path` column holds. The hash runs on the server, but **its output is written on the operator PC, never on the server** (nothing is created in the .cloud storage). Example (restricted to the banner files; `<storage host>`, `<storage root>` and `<banner dir>` are placeholders; `-type f` skips symbolic links):
  ```bash
  ssh <storage host> 'cd <storage root> && find <banner dir> -type f -print0 | sort -z | xargs -0 sha256sum' > "$work/files/SHA256SUMS"
  ```
  `find .` prints a leading `./` on every path; `migrate:activity` strips leading `./` when it reads the manifest (`load/activity/files.ts`, #122), so that prefix is harmless. Beyond it, the path text in each line must equal the `image_path` text exactly.
- No file name may need `sha256sum` escaping (a line starting with `\`). The export must avoid such names; otherwise the run fails closed with the manifest line number.
- A directory without a valid `SHA256SUMS` is refused (fail closed). The manifest is part of the input hash, so a dry-run does not authorise an apply on a changed manifest.

**Layout and hand-over.** The banner files go into `"$work/files"`, with `SHA256SUMS` at the **root** of that directory and the other files at the relative paths the manifest lists. Symbolic links are not allowed. The directory is kept outside GitHub like the dump (never in git, an issue, a PR, chat or any Claude/AI session), and is encrypted and handed over **in the same archive as the raw dump**: step 7 above with `raw files`.
```powershell
Push-Location $work
cmd /c "tar -czf - raw files | gpg --symmetric --cipher-algo AES256 -o $name"
```
```bash
( set -o pipefail; tar -C "$work" -czf - raw files | gpg --symmetric --cipher-algo AES256 -o "$out" ); echo "exit $?"   # must be 0
```
The mandatory listing check of step 7 stays, and its entry count now includes the files directory (everything in `raw` and `files`, plus the two directory entries).

**Receiver.**
- Decrypts and extracts **outside any repository working tree**, on the encrypted disk. `migrate:activity` refuses a `--files-dir` inside the working tree (or one that contains it).
- Runs `migrate:activity ... --files-dir=<that dir>` with the **same flag on the dry-run and on the apply**. The apply also needs `FILE_STORAGE_DIR` (the absolute path of the v2 file storage, separate from the export). The dry-run verifies every file and writes nothing.
- Deletes the files directory together with the dump (step 9 for the operator; the receiver's deadline in section 8, "Retention").

**Exit and abort.** A missing, unlisted, mismatched, oversized, wrongly typed or unsafe file is an `INVALID_VALUE` reject on that banner's `image_path`; it is not an exit code of the dump tools. The banner row is not loaded. The fix is a **new export** (a new sitting with the same rules: account unlocked and locked, `dump:wipe` first after a failure).

**Rehearsal (anonymised flow).** Files do **not** go with the anonymised dump by default, because `dump:produce` does not handle files. Rehearsals run `migrate:activity` without `--files-dir` (the report then prints `files: not migrated`), unless the LEAD allows real banner images in a rehearsal. **Perlu pengesahan:** banner images are public marketing images, but that is for the LEAD to confirm.
