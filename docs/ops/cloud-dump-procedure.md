# Procedure: producing an anonymised .cloud dump (AM-10)

- **Status:** draft for LEAD review (2026-10-21; sections 9 to 11 added 2026-10-23). Written against the fixed CLI interface of AM-10; nothing in this document has been run on real data. The `dump:check` command, the report shape and the counter and checklist statements of sections 9 to 11 were run against a synthetic MariaDB 10.11 database on 23 Oct (MySQL 5.7 and 8 not verified; each such statement says so).
- **Items marked "Perlu pengesahan"** are not confirmed yet. Do not treat them as decided.
- **Night-sitting decisions (Decided: LEAD, 22 Oct (6340542912)):** (14) the raw production dump is staged only on the throwaway staging cluster (section 8); (19) the Q9 `question_submissions` CSV is kept like the dump, outside GitHub (section 4); (16) there is no deputy: the operator runs the 01:00 night sittings alone, and every stop in this procedure means "stop, wipe, make sure the account is locked, report on #109 in the morning (aggregates only)" (sections 6 and 8). The night plan is the cutover plan on branch `be/AM-MIG-08-cutover-plan` (`docs/ops/v2-cutover-plan.md`, #124, sections 3.3, 4.0 and 4.6). **Dates (per LEAD go-live plan 22 Oct (6343623918); AM1-2's one-night reading, to be confirmed by the LEAD):** 24 Oct = the anonymised rehearsal sitting (sections 2 to 7 of this procedure, loaded on the rehearsal DB, `deploy/rehearsal/rehearsal-db.sh`; step A1 of #124) together with the MIG-07 real-data rehearsal; 27 Oct = the second rehearsal, production-like and timed (A4); 29 Oct at 01:00 MYT = the one production night sitting (section 8; B1 freeze, B2 export, B3 encrypt, hand over and wipe, then B4 to B10 on the VPS). There is no T-1 export and no delta at go-live: the earlier two-night structure (a T-1 export plus a final export) is superseded.
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
   -- replace the placeholder below, angle brackets included, with a quoted generated password, e.g. '<password>'
   CREATE USER 'pp_dump_ro'@'<operator IP or %>' IDENTIFIED BY <<SET-A-STRONG-PASSWORD>> REQUIRE SSL;
   -- preferred: column-level grants, only the spec columns, one statement per table
   GRANT SELECT (<col1>, <col2>, ...) ON <db>.<table> TO 'pp_dump_ro'@'<operator IP or %>';
   ```
   - **Column-level grants are preferred** (data minimisation: the account cannot even read a column that is not in the spec). The spec columns are in `apps/api/src/migration/ddl/spec.ts`, and the `dump:check` report lists the selected columns per table, so the data owner can check the grants against it. The statements are generated, without any connection, by the command below (spec columns minus the redacted ones), written to a file outside the repo:
     ```
     npm run -s dump:grants -w @pp/api -- --database <db> --account "'pp_dump_ro'@'<operator IP>'" > grants.sql
     ```
     `-s` (silent) keeps the three npm banner lines out of the redirected file; without it `grants.sql` starts with npm text and `mysql` rejects it. Check that the first line of `grants.sql` starts with `--`. Through an SSH tunnel (item 6) use the tunnel account host instead: `--account "'pp_dump_ro'@'127.0.0.1'"`. The output holds the password placeholder `<<SET-A-STRONG-PASSWORD>>`, which is deliberately not valid SQL: the data owner **must replace it**, including the angle brackets, with a quoted generated password such as `'<password>'`, before running the statements (the same rule applies to the `CREATE USER` statement above). With column-level grants the account cannot see columns outside the spec, so the `dump:check` report lists them as "missing or not granted" and cannot answer column-name questions; for those, the data owner runs the metadata-only `information_schema.columns` query printed at the end of the `dump:grants` output with their own access and posts only the names.
   - Fallback: `GRANT SELECT, SHOW VIEW ON <db>.* TO 'pp_dump_ro'@'<operator IP or %>';` (table-level on the whole database). It is accepted by the tools but gives access to columns that are not needed. **Open LEAD item (not decided here):** whether the table-level fallback is allowed at all; the LEAD decides with the data owner.
   - Use the operator's fixed IP as the account host. If `%` cannot be avoided, the data owner **must** restrict access to the operator's address by firewall (a MUST, not advice).
   - **Tunnel variant of the account host.** With the SSH tunnel (item 6) MySQL sees the connection coming from the SSH host (often `127.0.0.1`/`localhost`), not from the operator IP (checked on MariaDB 10.11 with a local tunnel: an account made for `'pp_dump_ro'@'127.0.0.1'` connected and `SELECT CURRENT_USER();` said `pp_dump_ro@127.0.0.1`), so an account `'pp_dump_ro'@'<operator IP>'` fails with `ERROR 1045`. For a tunnel sitting the data owner creates the account with the host MySQL really sees (`'pp_dump_ro'@'127.0.0.1'`, or the SSH host's address if the tunnel ends elsewhere; the data owner checks with `SELECT CURRENT_USER();` after a test login) and uses that host in every statement of this item (GRANT, ALTER USER, DROP USER). The generated script is then: `npm run -s dump:grants -w @pp/api -- --database <db> --account "'pp_dump_ro'@'127.0.0.1'" > grants.sql` (`-s` as above). **Perlu pengesahan:** the host MySQL sees on the day.
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
   Run it from the repository root. `npm run ... -w @pp/api` runs inside `apps/api`, so a relative `--out .migration-out/check-<stamp>` (`<stamp>` is `yyyyMMdd-HHmm`, as in section 9.1) lands in `<repo>/apps/api/.migration-out/check-<stamp>/`.
   ```powershell
   $stamp = Get-Date -Format yyyyMMdd-HHmm
   npm run dump:check -w @pp/api -- --out ".migration-out/check-$stamp"
   Get-Content "apps/api/.migration-out/check-$stamp/schema-report.md"
   ```
   ```bash
   stamp=$(date +%Y%m%d-%H%M)          # i.e. .migration-out/check-$(date +%Y%m%d-%H%M), read once so the cat finds the same directory
   npm run dump:check -w @pp/api -- --out ".migration-out/check-$stamp"
   cat "apps/api/.migration-out/check-$stamp/schema-report.md"
   ```
   - Exit 3 means the account has a privilege outside the accepted list (item 5): stop and go back to the data owner.
   - Skim `schema-report.md` once on the PC. It should hold only table and column names, counts, versions and time zones. If anything looks like a host name or a value, tell the LEAD privately.
   - **What goes on #109 (and nothing else):** (a) the counts from the line `Tables present: <n> of <m>. Rows: <total>.`; (b) the list from the report's table column **"Source columns not in spec"** (table name and column names, no data), which answers the open-columns question of AM-08; developers add those columns to the spec and the anonymiser rules **before the sitting**; (c) the number from the section **"Source tables that ddl/spec.ts does not know (never exported)"** (the count only, not the names); (d) the `Grants:` verdict word only ("read-only (accepted)" or "NOT read-only"). Not the server version, the time zones, the engines, the `Type notes` section, any other column or table list, or the file itself. If a developer needs more, the operator sends it privately on the LEAD's say-so.
   - **Caveat for a column-level account** (one made with `dump:grants`): the database shows such an account only the columns it was granted, so "Source columns not in spec" is **empty by construction** and says nothing about columns the spec does not know. A spec column the account cannot see is reported as "missing or not granted". To answer the open-columns question, the data owner runs the metadata-only `information_schema.columns` query printed (as a comment) at the end of the `dump:grants` output, with their own access, and sends you the result (names and types only, no rows); post only the column names that are not in the spec on #109 instead.
   - **Perlu pengesahan:** this assumes the repository and its issues are private; even so, post only the items above. A developer reads them and adds any missing anonymiser rules, so the sitting does not stop on exit 4.
   - **InnoDB.** The consistent snapshot of the sitting holds only for InnoDB tables. `dump:check` prints each spec table's `engine` and warns about every non-InnoDB table. A warning means the data owner must confirm that writes to that table are frozen for the whole sitting; otherwise the sitting is a no-go. Tell the LEAD privately; post only "engine warning: yes/no" on #109.
   - **Binding smoke against the real server (before the first real sitting).** Proof so far is on MariaDB 10.11. `dump:check` must run clean **once** against the real .cloud server (metadata only, no rows), whatever its flavour and version (**Perlu pengesahan:** MySQL 8?). The JSON expression path for MySQL 5.7/8 is otherwise only string-tested. Do not schedule the sitting until this run exits 0; if it fails, post only the exit code and the MySQL error number (for example `ERROR 1045`).
   - For any failure of `dump:check`, `dump:produce` or `dump:cloud`, post on #109 **only the exit code and the MySQL error numbers** (e.g. `ERROR 1045`), never the message text.
   - **Wait for a developer to reply "rules OK" on #109.** The operator posts the aggregates above on #109 and a developer replies "rules OK" to them; the LEAD does not give it. Do not start the export (step 2) before that reply, and do not schedule the sitting before it. **When it runs:** `dump:check` needs the account unlocked (section 11, item 7 plans a short day-before window for it, **Perlu pengesahan**, .cloud owner). If that window is not booked, `dump:check` runs at the start of the sitting instead (as in section 3, row "A"), the operator posts the aggregates, and step 2 waits for the reply; in that case a developer must be on #109 for that time. Section 9 gives the exact command again for 24 Oct and the night, and the list of what the report must show before the operator posts the aggregates.
9. **Time zone (DT-1 = UTC; LEAD decision 24 Oct 02:15 MYT, #109 6371548855; this replaces the 21 Oct decision DT-1 A, which assumed `+08:00`).** The .cloud export has no DATETIME columns: every date column is a TIMESTAMP, and the .cloud app time zone and the DB session are both UTC. So the sitting passes `--datetime-offset +00:00` (the tool default in `apps/api/src/migration/dump/cloud.ts` stays `+08:00`; there is no code change, so always pass the flag). `--datetime-offset` only affects DATETIME values (and a DATE column that the spec reads as a timestamp); every TIMESTAMP is written with `Z` whatever the offset is, so with TIMESTAMP-only data the offset changes no value, and the flag mainly makes the export report say `DATETIME offset applied: +00:00.`. The `dump:check` report still lists the server time zones; if they do not look like UTC, or the data owner finds a DATETIME column (the `dump:check` report lists no column types, so this comes from the schema export, not from the report), tell the LEAD instead of changing the offset.
10. **Book the sitting** with the LEAD (about 30 minutes, uninterrupted) and with the receiver of the rehearsal host (so the file can be accepted and confirmed the same day).

## 3. The sitting (target about 30 minutes)

Run every command from the repository root, in one terminal for the whole sitting (the environment variables live in it). `<date>` is `YYYYMMDD`. `$work` is a shell variable that holds the **absolute** path of the work dir; step 0 sets it (PowerShell and bash forms). Because `npm run ... -w @pp/api` runs inside `apps/api`, the work dir is `<repo>/apps/api/.migration-out/run-<date>`; the tools accept an absolute path as long as it is inside a `.migration-out` folder under the repository root, and using the one absolute path everywhere avoids pointing a command at the wrong folder.

| Step | What | Expected time |
|---|---|---|
| A | `dump:check` (section 9), read the report, post the aggregates, "rules OK" received | 2 min, plus the wait for "rules OK" if it was not received the day before (the check itself took 1 to 2 s on the synthetic fixture, section 9.4) |
| 0 | Prepare the machine | 2 min |
| 1 | Create a fresh key | 2 min |
| 2 | `dump:produce` | 8 min (depends on the row counts in the check report; **Perlu pengesahan**, not yet measured on real data; section 9.4 has the synthetic timing) |
| 3 | Check the output | 2 min |
| 4 | Free-text check (operator), LEAD review or acceptance | 5 min |
| 5 | Destroy the key | 1 min |
| 6 | Encrypt the `anon` directory | 2 min |
| 7 | Hand over to the rehearsal host | 3 min |
| 8 | Delete the local copies | 1 min |
| 9 | Report on #109 | 2 min |
| | **Total** | **30 min** (28 min of steps 0 to 9, plus row A) |

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
npm run dump:produce -w @pp/api -- --work "$work" --datetime-offset +00:00
```

```bash
npm run dump:produce -w @pp/api -- --work "$work" --datetime-offset +00:00
```

**Time zone rule (DT-1 = UTC; LEAD decision 24 Oct 02:15 MYT, #109 6371548855: no DATETIME columns, every date column is a TIMESTAMP; app and DB session UTC; also section 2, item 9).** Pass `--datetime-offset +00:00` as above and do not change it. The export writes every TIMESTAMP with `Z` and any DATETIME with the given offset, because `staging:load` reads offset-less strings in the session time zone. With TIMESTAMP-only data the offset changes no value. Do not leave the flag out: the tool default is still `+08:00`.

What the tool does: checks the key first; exports a consistent read-only snapshot (only the columns in the spec, secrets NULL at source) through `<work>/raw.partial` to `<work>/raw`; anonymises through `<work>/anon.partial` to `<work>/anon`; leak-scans; writes `<work>/schema-report.json` and `<work>/schema-report.md`; and then **always** wipes the raw export, whether the run succeeded or not. It prints row counts, sizes, the sha256 of `anon/manifest.json` and the elapsed time. Keep the terminal open: you need these numbers in steps 3 and 9.

**Interrupting the run.** A first Ctrl+C (or closing the terminal) stops the run promptly, in the export and in the anonymiser phase as well, and the raw data is wiped. A second Ctrl+C forces a synchronous wipe (wait for the prompt to come back). Run through `npm run`, the shell usually shows exit 130 after any Ctrl+C, so do not rely on the number. After any Ctrl+C read the last line the tool printed (`Interrupted. The partial output was deleted.` or `Raw data deleted.`), run `dump:wipe --dir "$work"` and destroy the key. If the process is killed hard (Task Manager, `kill -9`, a power cut), run `dump:wipe --dir "$work"` **before anything else**, then destroy the key (section 6).

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
2. For each kept free-text column in the list in [runbook section 11](../architecture/v2-migration-runbook.md#11-anonymiser-decisions-and-open-points-be-35), paragraph "Required review of kept free text" (`notes.body`, `notes.title`, `questions.body`, `exam_papers.title`, `users.kelas`, `users.teaching_subject`, `question_attempts.selected_option`, and the rest of that list), look at a sample of the values in the terminal. This prints to the screen only; do not redirect to a file, copy or screenshot. The command prints every `<stride>`-th value of one column, at most 40:
   ```powershell
   node -e "const r=require('readline').createInterface({input:require('fs').createReadStream(process.argv[1])});let i=0,n=0;const k=+process.argv[3];r.on('line',l=>{if(i++%k===0&&n++<40){const v=JSON.parse(l)[process.argv[2]];console.log(typeof v==='string'?v:JSON.stringify(v))}})" "$work/anon/notes.ndjson" body 50
   ```
   ```bash
   node -e "const r=require('readline').createInterface({input:require('fs').createReadStream(process.argv[1])});let i=0,n=0;const k=+process.argv[3];r.on('line',l=>{if(i++%k===0&&n++<40){const v=JSON.parse(l)[process.argv[2]];console.log(typeof v==='string'?v:JSON.stringify(v))}})" "$work/anon/notes.ndjson" body 50
   ```
   If a listed table has 0 rows it has no `.ndjson` file in `anon`: skip it (the sample command would fail with ENOENT). Change the file (`<table>.ndjson`), the column (`body`) and the stride (50: choose about row count divided by 40). For a json column the whole value is printed. Look for a teacher, parent or pupil named in a note, title, comment or class label. The values stay in the terminal scrollback: close the terminal window after the sitting (`clear` does not remove scrollback).
   In the 8 `redact-pii` columns (runbook section 11, marked "redacted, A1-LEAK") the token `[maklumat peribadi dipadam]` is expected, not a finding; a real name **outside** a token is still a STOP.
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
# mandatory listing check (asks for the passphrase again); the count must be the number of files in anon (SHA256SUMS included, if you made it) plus 1 (the directory entry)
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
( cd "$work/anon" && find . -type f ! -name SHA256SUMS -print0 | LC_ALL=C sort -z | xargs -0 sha256sum > SHA256SUMS )   # before the tar; load-dump on the receiver needs it
( umask 077; set -o pipefail; tar -C "$work" -czf - anon | gpg --symmetric --cipher-algo AES256 -o "$out" ); echo "exit $?"   # must be 0
ls -l "$out"   # -rw-------
# mandatory listing check (may ask for the passphrase again); the count must be the number of files in anon (SHA256SUMS included) plus 1 (the directory entry)
( set -o pipefail; gpg --decrypt "$out" | tar -tzf - | wc -l ); echo "exit $?"   # must be 0
ls "$work/anon" | wc -l   # taken after SHA256SUMS exists, so it counts it
sha256sum "$out"
```

- **`SHA256SUMS` inside `anon` (bash block, before the `tar`).** The receiver's `deploy/rehearsal/rehearsal-db.sh load-dump <dir>` needs a checksum for an ndjson directory: `SHA256SUMS` inside the directory (or `<dir>.sha256` next to it, or `--sha256 <hex>`), and `dump:produce` writes none, so the operator makes it in this step. The line hashes every file except `SHA256SUMS` itself, with `LC_ALL=C` sorting, which is the form `load-dump` verifies. The listing count is taken after it, so `SHA256SUMS` is one of the files counted: the rule stays "files in `anon` plus 1". There is no tested PowerShell form: on Windows run the line in Git Bash or WSL, or leave it out and the receiver re-creates it (see step 7); then the count is without it.
- `umask 077` in the encrypt subshell makes the `.gpg` file mode 600; without it the file comes out mode 644. The `ls -l` line must show `-rw-------`.
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

The receiving side is the rehearsal DB environment prepared by half AZ (`deploy/rehearsal/rehearsal-db.sh`; its recipe is `docs/ops/rehearsal-db.md`). The receiver:

1. decrypts and extracts **outside the repository** (a restricted directory);
2. runs `deploy/rehearsal/rehearsal-db.sh load-dump <path to the extracted anon directory>`. For a `pp-staging-dump/1` directory the script needs `anon/SHA256SUMS` (made in step 6) and verifies it (it prints `SHA256SUMS: OK`), accepts a manifest marked anonymised (`"anonymised": true`, or `"synthetic": true`), runs `anonymise:scan`, then `staging:load` into the `<db>_staging` database, and refuses a dump that is inside the repo.

If the operator's `SHA256SUMS` is missing, the receiver can re-create it on the extracted directory with the same `find ... sha256sum` line as in step 6 (the A1 sheet, step A1.3), or pass `--sha256 <hex>` / use a `<dir>.sha256` file; this is a fallback, and it proves nothing about transit (the `.gpg` sha256 comparison above does). The receiver deletes the `.gpg` file, the extracted directory and the staging databases again per section 4.

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

This overwrites with zeros and deletes the directory (`anon`, the `.gpg` file, the report files and anything left, including any `.partial` directories inside it). Close the SSH tunnel (Ctrl+C in its terminal). Empty the recycle bin or trash if you deleted anything by hand. **After every sitting, also a failed one (checklist, binding):** (a) `dump:wipe` has run and `<work>` is gone; (b) the key is destroyed (anonymised flow); (c) **the operator deletes the option file** (`Remove-Item $cnf` / `shred -u ~/pp-cloud-ro.cnf`) **or the data owner locks the account** (`ACCOUNT LOCK`, item 5), and the operator confirms which one on #109 in the words "option file deleted" or "account locked"; (d) the tunnel is closed. If the account is only locked, the option file stays until the last rehearsal (section 4) and must remain mode 600. Leave `apps/api/.migration-out/check-<stamp>` (aggregates only) until the rehearsals are done. After step 9, **close the terminal window**: it holds the passphrase and the sampled text in its scrollback.

### Step 9. Report on #109 (2 min)

Post one comment with **only**:

- date;
- exit code of `dump:produce`;
- number of tables and total number of rows;
- sha256 of the `.gpg` file;
- the offset used for `--datetime-offset`;
- "free-text check passed (operator)" and "LEAD review: present in person" or "LEAD accepted on #109" (aggregates only);
- the redaction counts that `dump:produce` logs (`Redacted <n> span(s) in <table.column> (<kind> x<n>, ...)`, one line per column), counts only (A1-LEAK, #303);
- "raw wiped, key destroyed", and "local copies deleted" once step 8 is done;
- "option file deleted" or "account locked" (step 8, checklist item c).

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
| `dump:check` report and freeze readings (`apps/api/.migration-out/check-<stamp>`; section 10: `freeze-<date>-<n>/`, `freeze-<date>-<n>.counts.txt` and `freeze-<date>-<n>.status.txt`) | Operator PC | Aggregates only; delete with the option file at the latest, 30 days at most |
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

`dump:wipe` exiting 2 with `The directory does not exist.` means there is nothing to wipe (the run never created the work dir, or it was wiped already). Run through `npm run`, the shell usually shows 130 after any Ctrl+C: do not rely on the number, read the tool's last line (`Interrupted. The partial output was deleted.` or `Raw data deleted.`), then wipe and destroy the key.

**Night sitting rule (Decided: LEAD, 22 Oct (6340542912), no deputy, decision 16).** For the 01:00 production night sitting on 29 Oct (B1 to B3 of the cutover plan; dates as in the note at the top of this document) the operator is alone. **Every stop condition in this section and in section 8, in particular exit codes 1, 2, 3, 6 and 130 (any other non-zero code is treated the same), the receiver not confirming, and a failed check, means the same four things and nothing else:** (1) stop, do not retry; (2) wipe with `dump:wipe --dir "$work"`; (3) make sure the account is locked (the data owner's lock, arranged before the night; if the operator cannot confirm it, say so in the report); (4) report on #109 in the morning, aggregates only (exit code and `ERROR n` numbers). The same STOP also closes everything else that the night opened, matching the "Common to every STOP" block of #124 section 4.6, in this order: wipe the work dir and check it is gone; delete the `.gpg` file (the local copy); wipe the dump copies on the receiving host (the half AZ `slot.sh` steps named in #124); the account locked (confirmed by a refused connection attempt) or "lock unconfirmed"; **delete the option file that holds the DB credential** (after the lock check, which needs it; a repeat gets a new option file and a new password from the data owner, see section 2, item 7 and section 3, step 8); close the SSH tunnel; close the terminal, which holds the passphrase in its scrollback, and destroy the passphrase note. Nobody is called, woken or asked for a go/no-go during the night; the decision to repeat is taken in the morning by the LEAD. Wherever a row below says "tell the LEAD" or "tell the data owner", read it as "in the morning report" for a night sitting.

`dump:wipe` covers everything in the work dir, including the `raw.partial` and `anon.partial` directories. After any non-zero exit check that `<work>` is gone (or wipe it) and that the key file is destroyed.

| Exit code | Meaning | What to do |
|---|---|---|
| 0 | Success | Continue to step 3 |
| 1 | Failed (other error) | (After a Ctrl+C, see the 130 row: the shell may show 130 or 1.) Read the message on the PC only. Wipe the work dir, destroy the key. If the cause is not obvious, post on #109 **only the exit code and the MySQL error numbers** (e.g. `ERROR 1045`), never the message text (it can hold host, user or schema names); send more privately to the LEAD if needed. A client-side failure with no `ERROR n` (for example the MariaDB client rejecting `ssl-mode`) shows `The MySQL client failed (exit N)` followed by a fixed short text instead of the client's message: post only "exit 1". With the MariaDB client use `ssl=1` plus `ssl-verify-server-cert` in the option file (item 7), not `ssl-mode`, or install the matching MySQL 8 client and set `CLOUD_MYSQL_CLIENT`; then run `dump:check` again |
| 2 | Usage or configuration error | Check: `CLOUD_MYSQL_DEFAULTS_FILE` points to an existing file with the right permissions; `ANON_HMAC_KEY_FILE` points to a file outside the repo, mode 600, at least 32 characters; `mysql --version` works or `CLOUD_MYSQL_CLIENT` is set; `--work` names a path inside a `.migration-out` folder under the repository root, and is new or empty; the option file holds only the `[client]` and `[mysql]` groups and only the allowed keys (item 7); for a remote host the option file verifies the server certificate (`VERIFY_IDENTITY` or `VERIFY_CA`, or `ssl=1` plus `ssl-verify-server-cert` for MariaDB). The key is checked first, so nothing was read. Fix and run again; destroy the key you created and make a new one |
| 3 | Account not read-only | Nothing was read. Destroy the unused key (step 5). Do not try to fix the grants yourself. Tell the data owner to remove every privilege except `USAGE`, `SELECT` (table or column level), `SHOW VIEW` and `SHOW DATABASES` (section 2, item 5), to remove any server-wide `SELECT ON *.*`, and to remove any `mandatory_roles` or default role (the tools refuse when `mandatory_roles` is non-empty or the current role is not `NONE` (MariaDB: not NULL)), then run `dump:check` again |
| 4 | An anonymiser rule is missing for a column | The rules are checked before the tool connects, so no data was fetched. Destroy the unused key (step 5). Post the column names (names only, no table contents) on #109. A developer adds the rules and the LEAD approves them; run `dump:check` again, wait for "rules OK", and sit again with a new key |
| 5 | Leak scan hit | The raw export and the anonymised output were deleted, but the work dir still holds `schema-report.json` and `schema-report.md`: run `dump:wipe` as for any stop. **Stop and tell the LEAD at once**; do not rerun elsewhere. The log names the `table.column` and the kind of hit, not the value. The LEAD decides the rule change (runbook section 8, step 4); a developer applies it; sit again with a new key. Rehearsal note (23 Oct, synthetic fixture): a rehearsal MySQL built from `fixtures:generate` has sequential 12-digit ICs (`000000000001`, `000000000002`, ...), which can make a fake equal another row's original value, so the scan reported `users.ic (original-value) x2` and `dump:produce` exited 5 with the output and raw data deleted; change `users.ic` first (non-sequential values) before a rehearsal sitting. On real data any hit is still a STOP for the LEAD as written above |
| 6 | Row-count mismatch or bad stream | The source changed during the export or the connection broke (tunnel dropped?). Raw is wiped. Check the tunnel and the network, wipe, destroy the key, and run again with a new key and a new work dir. Repeated failures: post only the exit code on #109 and tell the LEAD privately (night sitting: stop, wipe, account locked, morning report; see the night sitting rule above). **Also exit 6, for `dump:produce` and for `dump:cloud`:** the export contains an integer of 2^53 or larger (a BIGINT that cannot be kept exact). The run is refused and the partial output is deleted; tell the LEAD privately which table (post only the exit code on #109, no value), and a developer fixes it before the next sitting |
| 130 | Interrupted twice (Ctrl+C, closed terminal, shutdown) | Night sitting: stop, wipe, account locked, morning report. The raw and partial directories were force-deleted, so nothing raw is left, but the run is dead. Destroy the key (step 5), check that `<work>` holds no `raw` and no `.partial`, and start again from step 1 with a new key and a new work dir. A single interrupt exits 1 instead (the tool cleans up by itself; see exit 1). Run through `npm run`, the shell usually shows 130 after any Ctrl+C, so do not rely on the number: read the tool's last line (`Interrupted. The partial output was deleted.` or `Raw data deleted.`), run `dump:wipe --dir "$work"` and destroy the key |
| Review failed (step 4) | A real name is in a kept column | Do not hand over. Wipe, destroy the key, the LEAD changes the rule, a developer applies it, sit again with a new key |

For the cutover, `dump:cloud` is the normal path and is described in section 8. Outside the cutover, `dump:cloud` (raw export only) is a troubleshooting tool for a failing export. If used: `npm run dump:cloud -w @pp/api -- --out <dir> --datetime-offset +00:00` writes raw data, so it is real personal data on disk. Then run `anonymise:run` and `anonymise:scan` as in runbook section 8, and `npm run dump:wipe -w @pp/api -- --dir <dir>` on the raw directory straight afterwards, with the same key and wipe rules as above.

## 7. Repeat runs (rehearsals)

Every run follows this document from the start of section 3:

- a **fresh key** each time (a second dump made with one key can be joined to the first on its fakes);
- a **fresh work dir** (`.migration-out/run-<date>`; if a second run falls on the same day, add a suffix such as `run-<date>-2`);
- the same deletion rules, the same #109 report, the same confirmation of deletion;
- a new `dump:check` when the schema may have changed or after any exit 4, with "rules OK" before the sitting.

Because the key differs, the fakes differ between two dumps: each run is a complete standalone dump, and rehearsals cannot compare pseudonyms across dumps. The `--datetime-offset` stays `+00:00` (DT-1 = UTC, LEAD decision 24 Oct 02:15 MYT, #109 6371548855).

## 8. Production raw-data flow (cutover, MIG-08)

Sections 1 to 7 describe the anonymised rehearsal dump. The cutover (MIG-08, plan section 3.3 in the cutover plan on branch `be/AM-MIG-08-cutover-plan`, `docs/ops/v2-cutover-plan.md`) needs the **raw** `dump:cloud` output as the normal path, because the ETL refuses anonymised data in production. AM-10 confirms that addendum, and it is part of this procedure. The same hand-over and wipe rules apply, to a raw directory.

**Where the raw dump is staged (Decided: LEAD, 22 Oct (6340542912), decision 14).** The raw production dump is staged **only on the throwaway (temporary) staging cluster** of half AZ (#166, `deploy/vps/migration/slot.sh`; its recipe is `docs/ops/production-migration-slot.md` once #166 is merged; that file is not on `feature/v2-backend` yet). The cluster is destroyed after the cutover sign-off. The raw dump never goes to GitHub or to any cloud session. This replaces every earlier open wording about where it is staged.

**`NODE_ENV` on the receiver.** "Production" here means real data, not `NODE_ENV=production`. `staging:load` refuses to run under `NODE_ENV=production` for any dump (its reset guard), so the receiver runs `staging:load` on the throwaway staging cluster with `NODE_ENV` not set to production, `PP_ALLOW_STAGING_RESET=1` and a `_staging` database (or `PP_STAGING_DB_ALLOWLIST`). A raw dump carries no `anonymised`/`synthetic` marker, so it is not refused as synthetic; the production guards apply later, to `migrate:*` (MIG-08 plan).

**The raw export is real personal data of minors.** Encrypted disk (section 2, item 1), no screen sharing, no cloud-sync folder, and it never enters GitHub, an issue or PR, any chat, or any Claude/AI session or transcript. Everything in section 1 (hard rules) and section 5 (PDPA and incidents) applies in full.

**Timing and who is present (Decided: LEAD, 22 Oct (6340542912); dates as in the note at the top of this document).** There is **one** production sitting, on 29 Oct 2026 from 01:00 MYT (28 Oct 17:00 UTC): #124 B1 freezes `.cloud` (the `.cloud` maintenance switch, not part of this procedure), B2 is `dump:check` then `dump:cloud` (this section, steps 3 to 6), B3 is encrypt, hand over, compare the checksum and wipe (steps 7 to 9). The earlier T-1 export (A2) and the second export are gone: the export is taken in the freeze, so the table and row counts equal the `dump:check` report. The operator runs the sitting alone: no deputy, no LEAD present, nobody on call (decision 16). The data owner's part (creating the account, and the unlock and lock of `pp_dump_ro`) and the booking are arranged **before** the night (#124 section 4.6, "Night access" and "Before the night"); the operator holds no `ALTER USER`. Nothing in the night requires waking anyone. The migrate, verify and rollback steps (B4 to B10, S1 to S7, restore of `pre_etl`) belong to #124, not to this procedure; a threshold breach there (decision 4b: 5 % or 100 rows, where a delta applies at all) is a stop and rollback by #124.

**The production sitting (B2 and B3), by the operator alone on the operator PC; the data owner is not present and the account is unlocked and locked by the arrangement made beforehand:**

1. **No anonymiser key.** `ANON_HMAC_KEY_FILE` is not set (unset it if the terminal has it), steps 1 and 5 of the sitting (create and destroy the key) are skipped, and `dump:produce` and `anonymise:*` are not used. `IC_HASH_KEY` is a different thing (the ETL side); it is **kept** and never deleted here.
2. `pp_dump_ro` is unlocked by the pre-arranged event or arrangement of the data owner (section 2, item 5; with a tunnel use the tunnel account host); the operator does not run `ALTER USER`. A locked account at `dump:check` (exit 1 with an `ERROR n`: `ERROR 4151` on MariaDB 10.11, seen in the 23 Oct fixture run; the MySQL number is not verified; or exit 3) is a STOP by the night sitting rule (section 6).
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
4. Run `dump:check` as a last look (section 2, item 8; it reads no rows) into a new directory such as `.migration-out/check-<stamp>` (a reused, non-empty directory gives exit 2), then the raw export. Pass `--datetime-offset +00:00` (DT-1 = UTC, LEAD decision 24 Oct 02:15 MYT, #109 6371548855: no DATETIME columns, every date column is a TIMESTAMP, written with `Z`; the tool default is still `+08:00`, so do not leave the flag out).
   ```powershell
   npm run dump:cloud -w @pp/api -- --out "$work/raw" --datetime-offset +00:00
   ```
   ```bash
   npm run dump:cloud -w @pp/api -- --out "$work/raw" --datetime-offset +00:00
   ```
   Expect exit 0. **Exit 6 means stop: it is a no-go for that sitting** (row-count mismatch or bad stream, or an integer of 2^53 or larger). Do not retry in the same sitting. Stop, wipe (`dump:wipe`), make sure the account is locked, and report on #109 in the morning, aggregates only (exit code, no values). Rehearsal sittings in daytime may tell the LEAD privately instead.
5. **The account is locked again** by the same pre-arranged arrangement after the export, **also after a failure**. The operator confirms the lock by a refused connection attempt, or reports "lock unconfirmed". Only after that check, **delete the option file that holds the DB credential** (step 9).
6. Check the output: the manifest in `<work>/raw` is marked `raw: true`, no `.partial` directory is left, and the table and row counts equal the `dump:check` report (the export is taken in the freeze, so they are equal; a difference is a STOP).
7. **Encrypt** with the same commands as step 6 of the sitting, with `raw` (and `files`, if section 8.1 applies) in place of `anon` (the `SHA256SUMS` line of step 6 belongs to the anonymised dump and `load-dump`; it is not part of this flow, so the count below has no extra file); the **listing check is mandatory**: the line count it prints must equal the number of files plus directories under `raw` (and `files`) plus the top directories themselves (bash: `find "$work/raw" | wc -l`; PowerShell: `(Get-ChildItem -Recurse "$work/raw").Count + 1`). Take the sha256 of the `.gpg` file. The passphrase goes to the receiver by phone call, in person or an end-to-end-encrypted messenger on a device with no AI agent or cloud session (step 6), never with the file, never in GitHub, e-mail, or any chat with an agent.
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
   ( umask 077; set -o pipefail; tar -C "$work" -czf - raw | gpg --symmetric --cipher-algo AES256 -o "$out" ); echo "exit $?"   # must be 0
   ls -l "$out"   # -rw-------
   ( set -o pipefail; gpg --decrypt "$out" | tar -tzf - | wc -l ); echo "exit $?"                                   # must be 0
   sha256sum "$out"
   ```
8. **Hand over** with `scp "$out" <user>@<receiver host>:<restricted dir>/` to the receiver, who runs the throwaway staging cluster (MIG-08 plan section 3.1). The checksum is compared on the receiving host: `sha256sum` there, against the value of step 7. **At night the operator is both sender and receiver** (#124 section 3.3 item 5 and section 4.6 B3): the operator runs the VPS steps alone, types a fresh passphrase once on the receiving host to decrypt (kept in the operator's head or on paper, never sent anywhere), and destroys it at the close. A mismatch allows one new hand-over; a second mismatch is a STOP. In a daytime rehearsal of this flow the receiver does the comparison and confirms. The receiver stages the extracted dump only on the throwaway cluster (decision 14).
9. **As soon as the receiver confirms the checksum**, run `dump:wipe --dir "$work"`. **Same-day cap:** if the checksum is not confirmed by the end of the sitting (the "receiver not confirming" case), run `dump:wipe --dir "$work"` anyway, delete the `.gpg` file, and repeat the sitting; the plaintext raw directory never stays on the operator PC overnight. In a night sitting this is the "receiver not confirming" stop: wipe, make sure the account is locked, report in the morning (no call, no waiting for a go/no-go). Then, delete the `.gpg` file if it is outside `$work`, **delete the option file that holds the DB credential** (`Remove-Item $cnf` / `shred -u ~/pp-cloud-ro.cnf`; the lock check of step 5 is done by then), and close the SSH tunnel. Do not wait for the verify or the load. The receiver then holds the only copy and deletes it right after `staging:load` succeeds.
10. Report **aggregates only** on #109: date, exit code, number of tables, total rows, sha256 of the `.gpg` file, "local copies deleted", and, for the night sitting, both "option file deleted" and "account locked" (or "lock unconfirmed"); for a daytime rehearsal "option file deleted" or "account locked" as in the section 3, step 8 checklist. Never data, message text of errors (exit code and `ERROR n` only), paths with personal information, the passphrase or any host name.

**Abort and failure.** The abort table in section 6 applies, including exit 6 and exit 130. After a failure or an interruption run `dump:wipe --dir "$work"` **first** (also after a hard kill), make sure the data owner has locked the account, and only then repeat (in a night sitting, repeating is decided in the morning, not during the night: stop, wipe, account locked, morning report on #109, aggregates only). There is no key to destroy in this flow. An interrupted export inside the freeze costs the export time again (MIG-08 plan, trigger R2), but at night it is a STOP, not a repeat (#124 S3).

**Rehearsal dates of this flow (as in the note at the top of this document).** 24 Oct: the anonymised sitting of sections 2 to 7 plus the real-data rehearsal on the rehearsal DB (#124 A1). 27 Oct: the production-like, timed rehearsal (A4): the `dump:cloud` part is timed against the rehearsal source only (a synthetic or anonymised database, never the real .cloud), and the rest of this section is exercised in daylight with the receiver confirming.

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
( umask 077; set -o pipefail; tar -C "$work" -czf - raw files | gpg --symmetric --cipher-algo AES256 -o "$out" ); echo "exit $?"   # must be 0
```
The mandatory listing check of step 7 stays, and its entry count now includes the files directory (everything in `raw` and `files`, plus the two directory entries).

**Receiver.**
- Decrypts and extracts **outside any repository working tree**, on the encrypted disk. `migrate:activity` refuses a `--files-dir` inside the working tree (or one that contains it).
- Runs `migrate:activity ... --files-dir=<that dir>` with the **same flag on the dry-run and on the apply**. The apply also needs `FILE_STORAGE_DIR` (the absolute path of the v2 file storage, separate from the export). The dry-run verifies every file and writes nothing.
- Deletes the files directory together with the dump (step 9 for the operator; the receiver's deadline in section 8, "Retention").

**Exit and abort.** A missing, unlisted, mismatched, oversized, wrongly typed or unsafe file is an `INVALID_VALUE` reject on that banner's `image_path`; it is not an exit code of the dump tools. The banner row is not loaded. The fix is a **new export** (a new sitting with the same rules: account unlocked and locked, `dump:wipe` first after a failure).

**Rehearsal (anonymised flow).** Files do **not** go with the anonymised dump by default, because `dump:produce` does not handle files. Rehearsals run `migrate:activity` without `--files-dir` (the report then prints `files: not migrated`), unless the LEAD allows real banner images in a rehearsal. **Perlu pengesahan:** banner images are public marketing images, but that is for the LEAD to confirm.

## 9. `dump:check` for the operator: running it and reading "rules OK" (24 Oct and the night)

**Added 23 Oct.** The command and its output paths were run against a synthetic MariaDB 10.11 database on 23 Oct (a local fixture built from `apps/api/src/migration/ddl/spec.ts`, 127 spec tables, an account made with `dump:grants`). **Not verified:** MySQL 5.7 and 8 (section 2, item 8 still asks for one clean run against the real server), and any real .cloud data. Section 2, item 8 stays the place for the preflight rules; this section is the operator's exact command and the reading guide.

**When.** On 24 Oct before the anonymised rehearsal sitting (A1), and again as the last look in B2 of the night (section 8, step 4). It reads **no rows**: schema information, grants and `COUNT(*)` per table.

### 9.1 The command

Run it from the repository root, in the terminal where `CLOUD_MYSQL_DEFAULTS_FILE` points to the mode-600 option file **outside the repo** (section 2, item 7). Use a **new** `--out` directory every time.

```powershell
$env:CLOUD_MYSQL_DEFAULTS_FILE = "$env:USERPROFILE\pp-cloud-ro.cnf"
$stamp = Get-Date -Format yyyyMMdd-HHmm
npm run dump:check -w @pp/api -- --out ".migration-out/check-$stamp"
$LASTEXITCODE     # 0 = the tool is satisfied
```

```bash
export CLOUD_MYSQL_DEFAULTS_FILE=~/pp-cloud-ro.cnf
stamp=$(date +%Y%m%d-%H%M)
npm run dump:check -w @pp/api -- --out ".migration-out/check-$stamp"
echo "exit $?"      # 0 = the tool is satisfied
```

Rules that `cli.ts` enforces (checked before any connection is opened):

- `--out` is the only flag `dump:check` takes. Any other flag gives exit 2. There is no password or connection string on the command line; the tools refuse one.
- `--out` is resolved against the working directory. `npm run ... -w @pp/api` runs inside `apps/api`, so `--out .migration-out/check-<stamp>` is written to `<repo>/apps/api/.migration-out/check-<stamp>/`. An absolute path works if it is inside a `.migration-out` folder under the repo.
- The directory must be **new or empty**. A second run into the same directory gives exit 2 ("The output directory is not empty"). Add the time to the name (`yyyyMMdd-HHmm`) so a second run on the same day has its own directory.
- The option file must be outside the repo and the working directory, mode 600 (POSIX), with only the allowed keys (section 2, item 7). `mysql` must be on `PATH`, or set `CLOUD_MYSQL_CLIENT`.

Terminal output on success (four lines, plus a `Not InnoDB (...)` warning line first if a table is not InnoDB; the values below are placeholders):

```
Server: <mariadb|mysql> <version>. Grants: read-only.
Schema: <n> of <m> spec tables present, <rows> rows.
Report: <repo>/apps/api/.migration-out/check-<stamp>/schema-report.md (and .json).
Grants: read-only (accepted).
```

The two report files are created with mode 600 and hold names and aggregates only, but they stay on the operator PC (section 2, item 8).

### 9.2 What "rules OK" looks like

"Rules OK" itself is the developer's reply on #109 (section 2, item 8), given on the aggregates the operator posts. The operator first checks that the report is in this shape. Every row must hold.

| # | What | Where | Must hold |
|---|---|---|---|
| 1 | Exit code | the shell | `0`. The last terminal line is `Grants: read-only (accepted).` |
| 2 | Grants | `schema-report.md`: the line starting `Grants:`; `schema-report.json`: `grants` | `Grants: read-only (accepted). Privileges seen: ...` where the privileges are only from `USAGE`, `SELECT`, `SHOW VIEW`, `SHOW DATABASES` (a column-level account shows `SELECT, USAGE`). In the JSON: `read_only: true`, `refused: []`, `unverifiable: 0`, `roles_active: false`. The line has **no** `Beyond read-only:`, **no** `Unverifiable grant lines:` and **no** `A mandatory or active role is in effect.` |
| 3 | No active or mandatory role | same line; `grants.roles_active` | `false`. The tool reads `mandatory_roles` and the current role itself and exits 3 before counting rows if either is set |
| 4 | Server version | `Server: <flavor> <version>.` (line 3 of the `.md`); `server.flavor`, `server.version` | Present. The operator notes flavor and version for the LEAD; it is **not** posted on #109. The first run on the real server is the binding smoke of section 2, item 8 |
| 5 | Time zone (DT-1) | `Time zone: session <x>, global <y>, system <z>.` and the next line `DATETIME columns have no time zone: --datetime-offset decides the offset at export.`; `time_zone` in the JSON | Both lines present. The check report does **not** carry the offset (the `datetime_offset` key and the line `DATETIME offset applied: +00:00.` appear only in the report of `dump:cloud` / `dump:produce`). DT-1 = UTC (LEAD decision 24 Oct 02:15 MYT, #109 6371548855) holds when the three zones look like UTC and the export report then says `DATETIME offset applied: +00:00.` (look for it in step 3 of the sitting, or in B2). The export also sets its own session to `+00:00`, so every TIMESTAMP is written with `Z` whatever the server zone is. If the three zones do not look like UTC, tell the LEAD; do not change the offset (section 2, item 9). **Perlu pengesahan:** the LEAD confirms that this is what cutover plan P8 means by "time-zone line matches DT-1" |
| 6 | Spec tables present | `Tables present: <n> of <m>. Rows: <total>.`; `totals` and `spec_tables_absent_in_source` | `<n>` equals `<m>`, and `spec_tables_absent_in_source` is `[]`. A table shown as `no (absent)` is absent **or not granted**: the data owner explains each one (a spec table that does not exist in .cloud is skipped by the grant script, so it is also absent here). `Rows:` is a number, not `not counted` |
| 7 | Spec columns | table column "Spec columns missing or not granted" | Empty for every present table, or each name is explained by the data owner |
| 8 | Source columns not in spec | table column "Source columns not in spec" (`<count>: <names>`); `tables[].source_columns_not_in_spec` | Listed **by name only** (no values). Posted on #109 as table plus column names (section 2, item 8). **Empty by construction for a column-level account**: such an account sees only the columns it was granted (confirmed on the fixture: a source-only column was not listed), so the data owner's `information_schema.columns` query is the real answer |
| 9 | Source tables not in spec | the section `## Source tables that ddl/spec.ts does not know (never exported)`; `source_tables_not_in_spec` | The section exists only when the count is above 0. Post the **count** only. **Empty by construction for a column-level account too**: a table with no grant is invisible (confirmed on the fixture) |
| 10 | Engines | table column "Engine" | `InnoDB` everywhere. `(not InnoDB: no consistent snapshot)` plus the `Not InnoDB (...)` warning line triggers the InnoDB rule of section 2, item 8 |
| 11 | Row counts | table column "Rows"; `tables[].row_count`; `totals.rows` | A number for every present table (an empty cell means the table was not counted, which only happens when exit is not 0). The total equals the sum. These are the numbers the export must equal at the night (B2 compares against them) |
| 12 | Type notes | the section `## Type notes` | Informational (DATETIME offset notes, text columns held as JSON). Stays on the PC |

Shape of `schema-report.md` (headings and line templates, no values):

```
# .cloud schema report (names, types and counts only)

Generated: <ISO 8601 UTC>. Server: <flavor> <version>.
Time zone: session <x>, global <y>, system <z>.
DATETIME columns have no time zone: --datetime-offset decides the offset at export.

Grants: read-only (accepted). Privileges seen: <list>.

Tables present: <n> of <m>. Rows: <total>.

| Table | Present | Engine | Rows | Selected | Redacted | Spec columns missing or not granted | Source columns not in spec |
|---|---|---|---:|---:|---|---|---|
| <one row per spec table, 127 on the fixture> |

## Type notes            (only if there are notes)
## Source tables that ddl/spec.ts does not know (never exported)   (only if the count is above 0)
```

Top-level keys of `schema-report.json`: `generated_at`, `server` (`version`, `flavor`), `time_zone` (`session`, `global`, `system`), `grants` (`read_only`, `privileges`, `refused`, `unverifiable`, `roles_active`), `spec_tables_absent_in_source`, `source_tables_not_in_spec` (`count`, `names`), `tables[]` (`table`, `group`, `present`, `engine`, `row_count`, `columns_selected`, `columns_redacted`, `spec_columns_missing_in_source`, `source_columns_not_in_spec`, `type_notes`, `invalid_json`) and `totals` (`tables_present`, `tables_expected`, `rows`).

### 9.3 When it does not exit 0

Only these codes can come from `dump:check` (4, 5 and 130 belong to `dump:produce`). The full table and the night rule are in section 6; the operator does what that table says and nothing else.

| Exit | Seen on the fixture when | What the operator does |
|---|---|---|
| 1 | The account is locked (MariaDB 10.11 prints `ERROR 4151`; the MySQL error number is not verified), a wrong password, the server is unreachable | Section 6, exit 1. At night: a locked account at `dump:check` is a STOP (section 8, step 2) |
| 2 | The `--out` directory is not empty or not inside a `.migration-out` folder, an unknown flag, a bad option file, no TLS verification for a remote host, no `mysql` client | Section 6, exit 2. Use a new `--out` directory and fix the setting; nothing was read |
| 3 | The account holds a privilege beyond the allow-list (the fixture had `INSERT` added: the report was written with `NOT read-only (refused)` and `rows not counted`) | Section 6, exit 3. Do not fix the grants yourself; the data owner does |

Post only the exit code and the `ERROR n` numbers on #109 (section 2, item 8). At night every non-zero exit is the common STOP of section 6.

### 9.4 Timings seen on a synthetic fixture (23 Oct, not production scale)

One run of the commands of sections 3, 8 and 9 against a local MariaDB 10.11 database built from the BE-35 `medium` fixture (seed 7): **118 spec tables (before the FIT-FIX schema fit; the spec now has 127), 43 of them with rows, 366,026 rows, 96.2 MB raw**. The client reached the database through a local SSH tunnel; the hand-over was an `scp` to a local sshd. Disk, memory and network are those of a small test machine, and the synthetic text compresses about 13 to 1, so **these figures show the order of magnitude and the shape, not the production time**. They are not a measurement of .cloud (**Perlu pengesahan**: the real time comes from the 24 Oct and 27 Oct sittings).

| Step | Wall time | Rows per second |
|---|---|---|
| `dump:check` (reads no rows; includes the npm start) | 0.9 to 1.7 s | not a row-moving step |
| `dump:cloud` (the export alone, three runs) | 4.0 to 4.6 s | about 80,000 to 90,000 |
| `dump:produce` (export, anonymiser, leak scan, raw wipe) | 28 s | about 13,000 |
| `anonymise:scan` alone (step 4) | 3.3 s | about 110,000 |
| tar + gpg AES256 of `raw` (7.3 MB result) | 1.5 s | about 63 MB/s of input |
| mandatory listing check | 0.7 s | n/a |
| `sha256sum`, `scp`, remote `sha256sum` | about 0.6 s together | n/a |
| decrypt and extract on the receiver | 0.9 s | n/a |
| `dump:wipe` of the 96 MB work directory | 0.9 s | n/a |
| dry run 23 Oct on the merged tip, synthetic MariaDB 10.11, 366,026 rows: `dump:check` / `dump:produce` / encrypt / `dump:wipe` / `staging:load` | 0.88 s / 24.3 s / 2.0 s / 0.8 s / 7.4 s | `dump:produce` about 15,000 |

The export takes a small share of the sitting; the anonymiser dominates `dump:produce`. The raw flow of section 8 (`dump:cloud`, encrypt, hand over, extract, wipe) took about 9 s in total on this fixture.

## 10. Freeze and unfreeze of .cloud (cutover plan P8, B1)

**Added 23 Oct. Status: draft; the command lines of the switch itself are not known.** Cutover plan references: section 2 (roles), section 3 P8, section 4.6 (night card B1, B2 and the common STOP block) and section 6.3 (rollback). If this section and the plan ever disagree, **the plan wins**; tell the LEAD so this document is corrected.

**Who and when.**

- The dump operator freezes at **B1, 29 Oct 01:00 MYT** (28 Oct 17:00 UTC), alone, with the switch access that the .cloud owner arranged in daylight (plan section 2 and section 4.6 "Night access"). The operator does not need any database privilege beyond `pp_dump_ro` for this section.
- **There is no freeze on 24 Oct.** The 24 Oct sitting exports from the running site. `dump:cloud` and `dump:produce` read in one consistent read-only snapshot, so rows changing during the sitting do not mix into the export (this holds for InnoDB tables only; see section 2, item 8).
- **Nothing in this section may be improvised.** Every item marked "Perlu pengesahan (.cloud owner)" is missing until the .cloud owner supplies it in writing. If one is missing at G6, the plan says the night is a no-go.

| Item | Status |
|---|---|
| The freeze (maintenance switch) command | **Perlu pengesahan (.cloud owner):** `<freeze command>` |
| The unfreeze command | **Perlu pengesahan (.cloud owner):** `<unfreeze command>` |
| The HTTP status the maintenance page returns, and the status of the normal page | **Perlu pengesahan (.cloud owner):** `<maintenance status>` and `<normal status>` |
| Which background writers exist (queue workers, scheduler or cron jobs, anything else that writes to the database) and how the owner stops and restarts them | **Perlu pengesahan (.cloud owner)** |
| Whether the owner also sets the database read-only at server level | **Perlu pengesahan; the owner's choice**, not a requirement |
| Whether `pp_dump_ro` is unlocked early enough for the two readings (see "The account must be unlocked" below) | **Perlu pengesahan (.cloud owner, LEAD)** |

The command is not invented here. If the .cloud owner confirms which framework the application uses, that framework's standard maintenance command (and its matching "up" command) is the likely answer, but it stays **Perlu pengesahan** until the owner confirms it, including any options such as a secret bypass path or a retry header.

### 10.1 Freeze (B1)

1. **Run the freeze command:** `<freeze command: Perlu pengesahan (.cloud owner)>`.
2. **Record `T-freeze`** straight after the command returns, as ISO 8601 with `+08:00` (Malaysian wall time for the night card; unrelated to the export offset):
   ```powershell
   [DateTimeOffset]::UtcNow.ToOffset([TimeSpan]::FromHours(8)).ToString("yyyy-MM-ddTHH:mm:sszzz")
   ```
   ```bash
   TZ=Asia/Kuala_Lumpur date -Iseconds        # GNU date; checked on 23 Oct
   ```
3. **Public page check.** `<cloud-url>` must return the maintenance status. Only the status code is read.
   ```powershell
   try { (Invoke-WebRequest -Uri "<cloud-url>/" -UseBasicParsing).StatusCode } catch { [int]$_.Exception.Response.StatusCode }
   ```
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' "<cloud-url>/"
   ```
   Expected: `<maintenance status: Perlu pengesahan (.cloud owner)>`. Another status is a failed freeze (rule in 10.3).
4. **Background writers.** An HTTP maintenance page alone does not stop background writers: queue workers and scheduler or cron jobs keep writing to the database. The .cloud owner confirms they are stopped (**Perlu pengesahan**). The operator cannot see this with `pp_dump_ro`; the proof in 10.2 is what shows it. Optionally the owner also sets the database read-only at server level (**Perlu pengesahan; the owner's choice**). The operator can read that state: `SELECT @@global.read_only;` (works for `pp_dump_ro`; `1` means on).

**The account must be unlocked during B1.** Both readings of 10.2 use `pp_dump_ro`. The plan's example for the pre-arranged unlock is 01:15 (plan section 4.6, "Night access"; **Perlu pengesahan**), which is too late for two readings 5 minutes apart before B1's latest time of 01:20. The data owner and the LEAD therefore arrange the unlock for B1 (for example 01:00 or earlier), and the lock after B2. If that is not arranged, the proof cannot be done: say so on the B1 line and treat it as "not confirmed" (STOP by the plan). The plan wins; the LEAD decides.

### 10.2 Proof of no write after the freeze

The account `pp_dump_ro` has `SELECT` only, so the proof uses only what that account can read. Take **two readings at least 5 minutes apart, both after `T-freeze`**, with a clock in view (reading 1 about T+5, reading 2 about T+10, inside the B1 time-box). A reading is three things:

- **(a)** a `dump:check` into its own new `--out` directory (row counts per table; no row value is read);
- **(b)** the server write counters;
- **(c)** `SELECT @@global.read_only;` (information only).

Commands (the same terminal as section 3, step 0; `$date` is set there; `$counters` is the SQL of (b); use `CLOUD_MYSQL_CLIENT` instead of `mysql` if the client is not on `PATH`). Set `n` to 1 for the first reading and 2 for the second.

```powershell
$freeze = "freeze-$date"
$n = 1
$counters = "SHOW GLOBAL STATUS WHERE Variable_name IN ('Innodb_rows_inserted','Innodb_rows_updated','Innodb_rows_deleted','Com_insert','Com_update','Com_delete','Com_replace','Com_insert_select','Com_update_multi','Com_delete_multi','Com_replace_select','Com_load')"
npm run dump:check -w @pp/api -- --out ".migration-out/$freeze-$n"
$LASTEXITCODE        # must be 0
mysql --defaults-file="$env:CLOUD_MYSQL_DEFAULTS_FILE" -B -N -e $counters | Set-Content "apps/api/.migration-out/$freeze-$n.status.txt"
mysql --defaults-file="$env:CLOUD_MYSQL_DEFAULTS_FILE" -B -N -e "SELECT @@global.read_only"
(Get-Content -Raw "apps/api/.migration-out/$freeze-$n/schema-report.json" | ConvertFrom-Json).tables | ForEach-Object { "$($_.table)`t$($_.row_count)" } | Set-Content "apps/api/.migration-out/$freeze-$n.counts.txt"
```

```bash
freeze="freeze-$date"
n=1
counters="SHOW GLOBAL STATUS WHERE Variable_name IN ('Innodb_rows_inserted','Innodb_rows_updated','Innodb_rows_deleted','Com_insert','Com_update','Com_delete','Com_replace','Com_insert_select','Com_update_multi','Com_delete_multi','Com_replace_select','Com_load')"
npm run dump:check -w @pp/api -- --out ".migration-out/$freeze-$n"; echo "exit $?"        # must be 0
mysql --defaults-file="$CLOUD_MYSQL_DEFAULTS_FILE" -B -N -e "$counters" > "apps/api/.migration-out/$freeze-$n.status.txt"
mysql --defaults-file="$CLOUD_MYSQL_DEFAULTS_FILE" -B -N -e "SELECT @@global.read_only"
node -e "const r=require(process.argv[1]);for(const t of r.tables)console.log(t.table+'\t'+t.row_count)" "$PWD/apps/api/.migration-out/$freeze-$n/schema-report.json" > "apps/api/.migration-out/$freeze-$n.counts.txt"
```

After reading 2 (set `n=2` and run the block again, then compare):

```powershell
Compare-Object (Get-Content "apps/api/.migration-out/$freeze-1.counts.txt") (Get-Content "apps/api/.migration-out/$freeze-2.counts.txt")
Compare-Object (Get-Content "apps/api/.migration-out/$freeze-1.status.txt") (Get-Content "apps/api/.migration-out/$freeze-2.status.txt")
# no output from both = nothing changed
```

```bash
diff "apps/api/.migration-out/$freeze-1.counts.txt" "apps/api/.migration-out/$freeze-2.counts.txt" && echo "counts equal"
diff "apps/api/.migration-out/$freeze-1.status.txt" "apps/api/.migration-out/$freeze-2.status.txt" && echo "counters delta 0"
```

What was verified (MariaDB 10.11 on a synthetic fixture, 23 Oct, as an account with only the `dump:grants` privileges): `SHOW GLOBAL STATUS` with a `WHERE` filter, `SELECT @@global.read_only`, and `dump:check` all work for that account, and `dump:check` and the status query themselves move none of the counters. A deliberate `UPDATE` moved `Com_update` and **not** the row counts; a deliberate `DELETE` changed the row count of one table. **The `Innodb_rows_*` counters do not exist on MariaDB 10.11 (the query simply omits them); the `Com_*` statement counters do.** The `Innodb_rows_*` counters on MySQL 5.7 and 8 are **not verified**, and neither is any PowerShell form here (they were not run). Do not use `Handler_*` counters: they also count the server's internal temporary tables.

Read this carefully:

- The counters are **server-wide**. Other databases on the same server (if any) move them, and a server restart resets them to a lower value. Per-table row counts are the per-schema fallback, with the owner's confirmation.
- Row counts see inserts and deletes only. **An update changes no row count**, so the counters are the only evidence for updates. Counts and counters together are the proof.
- `Com_*` count statements, `Innodb_rows_*` count rows. Either moving is a signal.

### 10.3 The pass rule and the night-card line

**Pass.** Every table's row count is equal in the two readings **and** every counter delta is 0. A counter that moved, with all row counts equal, passes only if the .cloud owner confirms in writing (text, no names) that a schema other than the .cloud database caused it (**Perlu pengesahan**: the operator cannot see which schema). A counter that went down means the server restarted: fail. The public page must also return the maintenance status. **Fail** is anything else, and a failed or unprovable freeze is a STOP: lift the freeze (10.4) and follow the plan (B1 "If not"; nothing in v2 has changed yet).

**The line for the night card (and the morning report), aggregates only:**

```
B1 freeze: T-freeze=<YYYY-MM-DDTHH:MM:SS+08:00>; maintenance page confirmed (status <code>);
readings at <HH:MM> and <HH:MM> (>= 5 min apart); no-write proof OK
(row counts equal in all <m> tables; counters delta 0 [or: moved, explained by a non-.cloud schema, owner confirmed]);
background writers stopped: owner confirmed
```

The later check of B4 (every staged table with `updated_at` has `max(updated_at) <= T-freeze`, criterion 13) is a second, independent proof and is not replaced by this one.

### 10.4 Unfreeze

**When.** Only when the plan says so: B1 not confirmed by T+0:20 (01:20), a STOP or no-go before the switch, or a rollback (plan section 4.6, rollback Case 1 and Case 2, where `.cloud` is unfrozen first and does not wait for the v2 clean-up; and section 6.3). **On success .cloud stays read-only** until the DNS switch (plan section 4.4) and then shows the pointer page; the plan states it is never written again. After the switch, a rollback unfreeze happens on the LEAD's request (plan section 6.3). The operator never unfreezes on his or her own judgement.

1. **Run the unfreeze command:** `<unfreeze command: Perlu pengesahan (.cloud owner)>`. Record `T-unfreeze` as in 10.1 step 2.
2. **Restart the background writers** (queue workers, scheduler or cron jobs): the owner does it, or the operator with the owner's written steps (**Perlu pengesahan**). If the owner had set the database read-only, the owner turns it off.
3. **Proof that .cloud is back:**
   - the public page returns the normal status (`<normal status: Perlu pengesahan (.cloud owner)>`), using the command in 10.1 step 3;
   - the write counters move again: take the status query of 10.2 twice, a few minutes apart. At night traffic may be too low to move them; then the public page plus the owner's confirmation that the writers are running is the proof (the operator cannot test a write with a read-only account);
   - the owner confirms in text that the site accepts writes.
4. **Report line** (aggregates only, in the morning report): `unfreeze: T-unfreeze=<ISO 8601 +08:00>; public page normal (status <code>); writers restarted (owner confirmed); counters moved: yes/no`.
5. Communication text (plan section 6.5): "maintenance extended, no data lost", approved by the LEAD, sent by the operator.

The readings and the counter files are aggregates. They live in `apps/api/.migration-out/` and are deleted with the `dump:check` reports (section 4).

## 11. `pp_dump_ro` confirmation checklist for the .cloud owner

**Added 23 Oct.** The dump operator hands this list to the .cloud owner, who runs each check with the owner's own (administrator) access and ticks the box. The operator never runs these. SQL below uses `<host>` for the account host chosen in section 2, item 5. **Verified on MariaDB 10.11 (synthetic local fixture, 23 Oct):** every MariaDB form shown. **Not verified on MySQL 5.7 or 8:** every form marked "MySQL". Where the two flavours differ, both are given.

**Do not paste any output into an issue, a PR or a chat.** `SHOW CREATE USER` (MariaDB and MySQL) and `SHOW GRANTS` (MariaDB) print the password hash. The owner reads the output and ticks the box.

- [ ] **1. The account exists, once.**
  `SELECT user, host FROM mysql.user WHERE user = 'pp_dump_ro';`
  Expected: exactly one row, and the host is the one chosen in section 2, item 5 (not `%`, unless the owner confirms the firewall restriction that item 5 makes a MUST).
- [ ] **2. The grants equal the `dump:grants` output.**
  `SHOW GRANTS FOR 'pp_dump_ro'@'<host>';`
  Expected: one `GRANT USAGE ON *.*` line, then one `GRANT SELECT (<columns>) ON <db>.<table>` line per table, with the same tables and column names as the script the operator printed with `npm run -s dump:grants -w @pp/api -- --database <db> --account "'pp_dump_ro'@'<host>'"` (`-s` keeps the npm banner out of a redirected file). The numbers must be equal: the count of `GRANT SELECT (` lines here equals the count of `GRANT` lines of the script (bash `... | grep -c '^GRANT'`; PowerShell `(... | Select-String '^GRANT').Count`). On the fixture both were 118 (before the FIT-FIX schema fit; 127 with the current spec). Column-level grants are preferred; a table-level `GRANT SELECT, SHOW VIEW ON <db>.*` is the fallback, and whether it is allowed is an **open LEAD item** (section 2, item 5).
- [ ] **3. No privilege beyond `USAGE`, `SELECT`, `SHOW VIEW`, `SHOW DATABASES`, and no grant option.**
  `SELECT privilege_type, is_grantable FROM information_schema.user_privileges WHERE grantee LIKE '%pp_dump_ro%';`
  Expected: one row, `USAGE`, `NO`.
  `SELECT privilege_type, COUNT(*) FROM information_schema.column_privileges WHERE grantee LIKE '%pp_dump_ro%' GROUP BY privilege_type;`
  Expected: `SELECT` only.
  `SELECT privilege_type FROM information_schema.schema_privileges WHERE grantee LIKE '%pp_dump_ro%';` and the same on `information_schema.table_privileges`.
  Expected: no rows for a column-level account. For the table-level fallback only `SELECT` and `SHOW VIEW` (and the global `SHOW DATABASES` in the first query). Any other privilege (including `PROCESS`, `LOCK TABLES`, `REPLICATION CLIENT` and a `SELECT ON *.*`) is removed before the sitting; the tools refuse it with exit 3.
- [ ] **4. The account is locked outside sittings.**
  MariaDB: `SHOW CREATE USER 'pp_dump_ro'@'<host>';` ends with `ACCOUNT LOCK` while locked. Or `SELECT JSON_VALUE(Priv, '$.account_locked') FROM mysql.global_priv WHERE User = 'pp_dump_ro' AND Host = '<host>';` gives `1` when locked (`0` or empty when not).
  MySQL: `SELECT user, host, account_locked FROM mysql.user WHERE user = 'pp_dump_ro';` gives `Y`.
  Expected now (before the 24 Oct sitting): locked. After each sitting: locked again.
- [ ] **5. No mandatory role and no default role.**
  MySQL 8: `SELECT @@global.mandatory_roles;` is empty. (The tools refuse a non-empty value for any role, not only for this account.)
  MariaDB: the variable does not exist. `SHOW GLOBAL VARIABLES WHERE Variable_name = 'mandatory_roles';` returns no rows (this is what the tools read), and `SELECT @@global.mandatory_roles;` gives `ERROR 1193 (unknown system variable)`, which is also "none".
  Default role: MariaDB `SELECT user, host, default_role FROM mysql.user WHERE user = 'pp_dump_ro';` has an empty `default_role`; MySQL 8 `SELECT * FROM mysql.default_roles WHERE user = 'pp_dump_ro';` returns no rows. `SHOW GRANTS` (check 2) has no `GRANT <role> TO` line, and `SELECT * FROM information_schema.applicable_roles WHERE grantee LIKE '%pp_dump_ro%';` returns no rows (checked on MariaDB). In a login as `pp_dump_ro`, `SELECT CURRENT_ROLE();` gives `NULL` (MariaDB) or `NONE` (MySQL 8); the tools refuse anything else.
- [ ] **6. TLS or tunnel, as section 2 says.**
  Direct connection: the account requires TLS and the server offers it: MariaDB `SHOW CREATE USER` contains `REQUIRE SSL`; MySQL `SELECT ssl_type FROM mysql.user WHERE user = 'pp_dump_ro';` is not empty; and `SHOW VARIABLES LIKE 'have_ssl';` is `YES`. The operator's option file verifies the certificate (section 2, item 7).
  Tunnel variant: the account host is the one MySQL sees (section 2, item 5), the tunnel is the only route, and the owner states whether `REQUIRE SSL` was dropped for the tunnel account (**Perlu pengesahan**).
- [ ] **7. Unlock and lock are pre-arranged for the day-before check, 24 Oct and the night of 29 Oct.**
  How: **Perlu pengesahan** (for example scheduled events that run `ALTER USER ... ACCOUNT UNLOCK` and `... ACCOUNT LOCK`). If events are used: `SELECT @@global.event_scheduler;` is `ON`, and `SELECT event_schema, event_name, status, execute_at, interval_value, interval_field, starts, time_zone FROM information_schema.events;` lists the unlock and the lock event as `ENABLED` (the statements run on MariaDB; no event was created in the test). The times are read in the time zone of the event or the server: 29 Oct 01:00 MYT is 28 Oct 17:00 UTC. Expected: a short unlock for the `dump:check` of the day before 24 Oct (section 2, item 8; **Perlu pengesahan**: if not booked, `dump:check` runs at the start of the 24 Oct sitting), an unlock before the operator's first reading of B1 (section 10.1) or at the sitting start on 24 Oct, and a lock after B2 or the end of the sitting. The owner states what happens if an event does not fire (a manual unlock by the owner is not available at night: the plan has no one on call, so a missed unlock is a STOP).
- [ ] **8. The operator holds no `ALTER USER`.**
  The only database credential the operator holds is `pp_dump_ro` (check 3 shows no grant option), and no other account on the .cloud database was given to the operator. Written statement by the owner.
- [ ] **9. Clean-up is dated.** The owner drops the account after the last use (`DROP USER 'pp_dump_ro'@'<host>';`) on a date that is agreed (**Perlu pengesahan**: the date; section 4 says after the last rehearsal or at go-live, whichever comes first).

**Confirmation.** This is a human step; nothing here is automated. When the owner has ticked every box, the operator posts one line on #109 with **no names, no host names and no credentials**, for example: `pp_dump_ro checklist (section 11) items 1 to 9 confirmed by the .cloud owner on <date>; open: <item numbers or none>`. Boxes the owner cannot tick stay open and are named by number only; a missing item 1 to 8 on the day of a sitting is a no-go for that sitting.
