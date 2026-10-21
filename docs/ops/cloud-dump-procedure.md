# Procedure: producing an anonymised .cloud dump (AM-10)

- **Status:** draft for LEAD review (2026-10-21). Written against the fixed CLI interface of AM-10; nothing in this document has been run on real data.
- **Items marked "Perlu pengesahan"** are not confirmed yet. Do not treat them as decided.
- **Related:** [migration runbook](../architecture/v2-migration-runbook.md) (rules in section 0, anonymiser in sections 8, 10 and 11), [database backup and encryption pattern](db-backup.md), [threat model, row 72](../architecture/v2-threat-model.md), [backend plan, OD-2 and OD-18](../architecture/v2-backend-plan.md), [BE-35 task card](../plan/backend-tasks/BE-35-anonymiser-fixtures.md).

## 1. Purpose, scope, owner

**Purpose.** Produce one pseudonymised copy of the .cloud MySQL database (a `pp-staging-dump/1` directory) for the migration rehearsals (MIG-07: staging load, profile, ETL, reconciliation), without any developer, agent or CI job ever touching real data (OD-2, OD-18).

**Scope.** This document covers the human procedure on the operator PC: preflight, the one sitting, hand-over, deletion and incident handling. The tools are `dump:check`, `dump:produce`, `dump:cloud`, `dump:wipe` (this item) and the existing `anonymise:run`, `anonymise:scan`, `staging:load` (see the runbook). It does not cover loading on the rehearsal host beyond the hand-over (see runbook section 2).

| Role | Who | Does what |
|---|---|---|
| Operator | Amin (`aminfaudzi`), the human who holds read-only .cloud access (issue #109, AM-10) | Runs every command in this document, on the operator PC |
| Approver | the LEAD (`azarulhakim`) | Approves the sitting, reviews the kept free text (step 4), receives incident reports, signs the deletion |
| Data owner | whoever administers the .cloud database | Creates and later drops the read-only MySQL account |
| Receiver | the owner of the rehearsal host (the VPS prepared for MIG-07) | Receives the encrypted file, loads it, confirms deletion |

Note on the owner: OD-18 names "the lead" as the person who runs the anonymiser. This procedure names Amin as the operator because Amin holds the read-only .cloud access, and the LEAD as the approver. **Perlu pengesahan:** the LEAD confirms this split (and who is "the lead" in OD-18 and in the runbook, where the lead is also the custodian of the copies).

**Hard rules.**

- Nobody else runs this procedure. **Never a Claude or other agent session**: agents never see credentials, the key, the option file, the raw data or the dump. Do not paste any command output from the sitting into an agent session, except what step 9 allows.
- The operator PC is the one machine allowed to connect to .cloud. This is not a "development machine" in the sense of runbook section 0, rule 6: no agent, no shared account, no cloud-synced folder, no screen sharing on it. **Perlu pengesahan:** the LEAD confirms that the operator PC meets this description (the runbook text speaks of "the lead's PC").
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
   CREATE USER 'pp_dump_ro'@'<operator IP or %>' IDENTIFIED BY '<generated password>' REQUIRE SSL;
   -- preferred: column-level grants, only the spec columns, one statement per table
   GRANT SELECT (<col1>, <col2>, ...) ON <db>.<table> TO 'pp_dump_ro'@'<operator IP or %>';
   ```
   - **Column-level grants are preferred** (data minimisation: the account cannot even read a column that is not in the spec). The spec columns are in `apps/api/src/migration/ddl/spec.ts`, and the `dump:check` report lists the selected columns per table, so the data owner can check the grants against it. The statements are generated, without any connection, by `npm run dump:grants -w @pp/api -- --database <db> --account "'pp_dump_ro'@'<operator IP>'"` (spec columns minus the redacted ones; the password stays a placeholder for the data owner). With column-level grants the account cannot see columns outside the spec, so the `dump:check` report lists them as "missing or not granted" and cannot answer column-name questions; for those, the data owner runs the metadata-only `information_schema.columns` query printed at the end of the `dump:grants` output with their own access and posts only the names.
   - Fallback: `GRANT SELECT, SHOW VIEW ON <db>.* TO 'pp_dump_ro'@'<operator IP or %>';` (table-level on the whole database). It is accepted by the tools but gives access to columns that are not needed. **Perlu pengesahan:** the LEAD and the data owner agree to the fallback if column-level grants are not practical.
   - Prefer the operator's fixed IP over `%`; if `%` is unavoidable, the data owner restricts access by firewall.
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
8. **Run the preflight and share the report.** `dump:check` reads no rows. It writes `schema-report.json` and `schema-report.md` (server version, time zones, grant verdict, and per table the missing and extra column names, type notes and row counts). The report holds names and aggregates only.
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
   - Skim `schema-report.md` once. It should hold only table and column names, counts, versions and time zones. If anything looks like a host name or a value, do not post it and tell the LEAD.
   - The report's list **"Source columns not in spec"** answers the open-columns question of AM-08 on #109 (column names only, no data). Post it there with the rest of the report; developers add those columns to the spec and the anonymiser rules **before the sitting**.
   - Paste the contents of the `.md` file as a comment on issue #109. **Perlu pengesahan:** this assumes the repository and its issues are private; if not, send the report to the developers privately instead. A developer reads it and adds any missing anonymiser rules, so the sitting does not stop on exit 4.
   - **Wait for a developer to reply "rules OK" on #109.** Do not schedule the sitting before that.
9. **Time zone.** `--datetime-offset` is the offset of the .cloud DATETIME columns (default `+08:00`). **Perlu pengesahan:** confirm the application time zone with the LEAD or the data owner, using the time zones in the `dump:check` report, and write the agreed offset on #109 before the sitting.
10. **Book the sitting** with the LEAD (about 30 minutes, uninterrupted) and with the receiver of the rehearsal host (so the file can be accepted and confirmed the same day).

## 3. The sitting (target under 30 minutes)

Run every command from the repository root, in one terminal for the whole sitting (the environment variables live in it). `<date>` is `YYYYMMDD`. `$work` (PowerShell) and `$work` (bash) hold the **absolute** path of the work dir. Because `npm run ... -w @pp/api` runs inside `apps/api`, the work dir is `<repo>/apps/api/.migration-out/run-<date>`; the tools accept an absolute path as long as it is inside a `.migration-out` folder under the repository root, and using the one absolute path everywhere avoids pointing a command at the wrong folder.

| Step | What | Expected time |
|---|---|---|
| 0 | Prepare the machine | 2 min |
| 1 | Create a fresh key | 2 min |
| 2 | `dump:produce` | 8 min (depends on the row counts in the check report; **Perlu pengesahan**, not yet measured on real data) |
| 3 | Check the output | 2 min |
| 4 | Free-text review (LEAD) | 5 min |
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

Use the offset agreed in section 2, item 9 (leave the flag out for the `+08:00` default). What the tool does: checks the key first; exports a consistent read-only snapshot (only the columns in the spec, secrets NULL at source) through `<work>/raw.partial` to `<work>/raw`; anonymises through `<work>/anon.partial` to `<work>/anon`; leak-scans; writes `<work>/schema-report.json` and `<work>/schema-report.md`; and then **always** wipes the raw export, whether the run succeeded or not. It prints row counts, sizes, the sha256 of `anon/manifest.json` and the elapsed time. Keep the terminal open: you need these numbers in steps 3 and 9.

**Interrupting the run.** Ctrl+C, or closing the terminal, aborts the run and the raw data is wiped. A second Ctrl+C forces a synchronous wipe (wait for the prompt to come back). If the process is killed hard (Task Manager, `kill -9`, a power cut), run `dump:wipe --dir "$work"` **before anything else**, then destroy the key (section 6).

If the exit code is not 0, go to section 6 now.

### Step 3. Check the output (2 min)

- Exit code 0 (`$LASTEXITCODE` in PowerShell, `echo $?` in bash).
- `<work>/raw` does not exist and there is no `.partial` directory: `ls "$work"` (PowerShell: `Get-ChildItem $work`) shows `anon`, `schema-report.json` and `schema-report.md`, and nothing else.
- The table count and row counts are plausible against the `dump:check` report (same tables, row counts the same or slightly higher if the live system moved since the check; a table with 0 rows that had rows is a failure).
- Write down for step 9: exit code, table count, total rows.

### Step 4. Free-text review by the LEAD (5 min)

Runbook section 11 requires this before the dump is shared. The LEAD sits at the operator PC (no screen sharing, no photos). **Perlu pengesahan:** if the LEAD cannot be present, the LEAD may delegate the review to the operator in writing on #109. The rule is: **no real person's name may appear in a shared dump.**

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
4. If nothing is found, the LEAD writes "free-text review passed" for the record (step 9). **Perlu pengesahan:** the sample size (40 values per column at a stride) is a proposal; the LEAD may set a larger one.

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
- Send the passphrase to the receiver through a **different channel from the file** (for example, the file by `scp`, the passphrase by a call or a private message). Never in the same message, never on #109 or in e-mail with the file.

### Step 7. Hand over to the rehearsal host (3 min)

Only to the rehearsal host (the MIG-07 VPS), into a directory that only the receiver's account can read. Never GitHub, a PR, an issue, chat, CI, an e-mail attachment or a cloud drive.

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

This overwrites with zeros and deletes the directory (`anon`, the `.gpg` file, the report files and anything left, including any `.partial` directories inside it). Close the SSH tunnel (Ctrl+C in its terminal). Empty the recycle bin or trash if you deleted anything by hand. The option file stays until the last rehearsal (section 4). Leave `apps/api/.migration-out/check-<date>` (aggregates only) until the rehearsals are done. After step 9, **close the terminal window**: it holds the passphrase and the sampled text in its scrollback.

### Step 9. Report on #109 (2 min)

Post one comment with **only**:

- date;
- exit code of `dump:produce`;
- number of tables and total number of rows;
- sha256 of the `.gpg` file;
- the offset used for `--datetime-offset`;
- "free-text review passed (LEAD)";
- "raw wiped, key destroyed", and "local copies deleted" once step 8 is done.

Never post data, file paths that contain personal information, the passphrase, the key, the option file or any host name.

## 4. Where things live and when they are deleted

The anonymised dump is **pseudonymised, not anonymous**: ids and timestamps are kept, so the records could be linked to a person by anyone who also holds the raw data, and free text that was kept can name people; it is still personal data of minors (runbook section 10). The key is destroyed in step 5 and nobody holds it afterwards. This supersedes the wording of runbook section 10 that the lead holds the key. **Perlu pengesahan:** the LEAD confirms.

| Item | Where | Deleted when |
|---|---|---|
| MySQL option file (`CLOUD_MYSQL_DEFAULTS_FILE`) | Operator PC, outside the repo, mode 600 / user-only | After the last rehearsal or at go-live, whichever comes first; the data owner drops `pp_dump_ro` at the same time |
| Anonymiser key | Created in step 1; it exists for the sitting only | Destroyed in step 5. Never reused, never backed up, never copied |
| Raw export `<work>/raw.partial` and `<work>/raw` | Operator PC, inside `apps/api/.migration-out`; never leaves the PC | Wiped by `dump:produce` itself, on success and on failure |
| Anonymised directory `<work>/anon` and the `.gpg` file | Operator PC under `.migration-out`, encrypted disk | Step 8, after the receiver confirms receipt |
| `.gpg` file and extracted dump on the rehearsal host | Restricted directory on the rehearsal host (encrypted disk) | As soon as load and reconciliation succeed, 7 days at most (runbook section 0, rule 4, and section 10) |
| Staging databases (`staging_cloud`, `archive_cloud`) and reports on the rehearsal host | Rehearsal host | Dropped after reconciliation (runbook section 5) |
| `dump:check` report (`apps/api/.migration-out/check-<date>`) | Operator PC | Aggregates only; delete with the option file at the latest, 30 days at most |
| Written deletion confirmation | A comment on #109 by the operator (local copies, key) and a comment by the receiver (host copies, staging databases), then the LEAD signs | Kept as the record; this is the "dump deleted" line that threat model row 72 asks for |

The confirmation comments contain the date, "deleted" and what was deleted, and nothing else.

## 5. PDPA and minors

- **Data minimisation.** Only the columns in the spec are exported; source-only columns are never exported; secrets (`remember_token`, `parent_invite_token`) are NULL at the source. Every personal value is replaced by the anonymiser (runbook section 8).
- **Purpose limitation.** The dump is for the migration rehearsal only. It is never loaded into production: its manifest is marked anonymised, `staging:load` refuses a marked dump when `NODE_ENV` is production, and it refuses any database that is not a `_staging` database. Student, teacher and parent accounts in it have a published dummy password.
- **Storage limitation.** 7 days at most on the rehearsal host; deleted as soon as the load and reconciliation succeed.
- **Access.** Only the operator, the LEAD and the receiver ever touch the file. Do not share the dump with anyone who also has raw data (ids and timestamps link them).
- **Incident.** A lost or stolen laptop, a file sent to the wrong place, a copy on an unencrypted disk, a passphrase or key sent together with the file, or a leak-scan hit.
  1. **Stop.** Do not retry, do not copy the file elsewhere, do not "tidy up first".
  2. **Tell the LEAD immediately** by phone or private message, not on a public issue. Write down the time you noticed it and what was involved (which files, which channel, to whom).
  3. Do what the LEAD says: usually wipe local copies, ask the receiver to delete host copies, and have the data owner drop the account and change its password.
  4. The LEAD decides whether the data owner, the affected schools or the authority must be informed. **Perlu pengesahan:** a statutory notification period may apply; the LEAD checks with the data owner or a legal adviser. Record the incident with date, time and outcome.

## 6. Abort and troubleshooting

If the sitting is interrupted for any reason (a call, a power cut, a lost connection, a doubt): run `dump:wipe --dir "$work"` first (also after a hard kill: Task Manager, `kill -9`, a power cut), then destroy the key (step 5), close the tunnel, and **start again on another day with a NEW key and a NEW work dir**. An interrupted run is not resumed.

```powershell
npm run dump:wipe -w @pp/api -- --dir $work
```

```bash
npm run dump:wipe -w @pp/api -- --dir "$work"
```

`dump:wipe` covers everything in the work dir, including the `raw.partial` and `anon.partial` directories. After any non-zero exit check that `<work>` is gone (or wipe it) and that the key file is destroyed.

| Exit code | Meaning | What to do |
|---|---|---|
| 0 | Success | Continue to step 3 |
| 1 | Failed (other error) | Read the message (table and column names and counts only). Wipe the work dir, destroy the key. If the cause is not obvious, post the message text on #109 (check it holds no value or host name first) |
| 2 | Usage or configuration error | Check: `CLOUD_MYSQL_DEFAULTS_FILE` points to an existing file with the right permissions; `ANON_HMAC_KEY_FILE` points to a file outside the repo, mode 600, at least 32 characters; `mysql --version` works or `CLOUD_MYSQL_CLIENT` is set; `--work` names a path inside a `.migration-out` folder under the repository root, and is new or empty; for a remote host the option file verifies the server certificate (`VERIFY_IDENTITY` or `VERIFY_CA`, or `ssl=1` plus `ssl-verify-server-cert` for MariaDB). The key is checked first, so nothing was read. Fix and run again; destroy the key you created and make a new one |
| 3 | Account not read-only | Nothing was read. Destroy the unused key (step 5). Do not try to fix the grants yourself. Tell the data owner to remove every privilege except `USAGE`, `SELECT` (table or column level), `SHOW VIEW` and `SHOW DATABASES` (section 2, item 5), then run `dump:check` again |
| 4 | An anonymiser rule is missing for a column | The rules are checked before the tool connects, so no data was fetched. Destroy the unused key (step 5). Post the column names (names only) on #109. A developer adds the rules and the LEAD approves them; run `dump:check` again, wait for "rules OK", and sit again with a new key |
| 5 | Leak scan hit | The output was deleted. **Stop and tell the LEAD at once**; do not rerun elsewhere. The log names the `table.column` and the kind of hit, not the value. The LEAD decides the rule change (runbook section 8, step 4); a developer applies it; sit again with a new key |
| 6 | Row-count mismatch or bad stream | The source changed during the export or the connection broke (tunnel dropped?). Raw is wiped. Check the tunnel and the network, wipe, destroy the key, and run again with a new key and a new work dir. Repeated failures: post the table names on #109 |
| Review failed (step 4) | A real name is in a kept column | Do not hand over. Wipe, destroy the key, the LEAD changes the rule, a developer applies it, sit again with a new key |

`dump:cloud` (raw export only) exists for troubleshooting a failing export. If used: `npm run dump:cloud -w @pp/api -- --out <dir>` writes raw data, so it is real personal data on disk. Then run `anonymise:run` and `anonymise:scan` as in runbook section 8, and `npm run dump:wipe -w @pp/api -- --dir <dir>` on the raw directory straight afterwards, with the same key and wipe rules as above.

## 7. Repeat runs (rehearsals and delta runs)

Every run follows this document from the start of section 3:

- a **fresh key** each time (a second dump made with one key can be joined to the first on its fakes);
- a **fresh work dir** (`.migration-out/run-<date>`; if a second run falls on the same day, add a suffix such as `run-<date>-2`);
- the same deletion rules, the same #109 report, the same confirmation of deletion;
- a new `dump:check` when the schema may have changed or after any exit 4, with "rules OK" before the sitting.

Because the key differs, the fakes differ between two dumps: each run is a complete standalone dump, and rehearsals cannot compare pseudonyms across dumps. The `--datetime-offset` stays the agreed value unless the LEAD changes it.
