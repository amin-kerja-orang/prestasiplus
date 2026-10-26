# Run sheet A3: production VPS set up dark, 26 Oct 2026

- **Status:** docs only. Nothing in this sheet has been run on any server. No server was reachable when it was written.
- **Re-checked against the tip `9924a2f6` on 24 Oct** (PR `[PC-5]`). Steps 0, 1b, 1c, 3 and 8, the "Script gaps" table and the "Where the plan and the scripts disagree" list were written at `515e440f`, before #123, #125 and #166 merged and before `deploy/vps/db-roles.sh` existed; they are corrected here. The command-by-command sheet with the measured timings of a local rehearsal is [vps-dark-26oct-runsheet.md](vps-dark-26oct-runsheet.md) — **follow that one on the night** and use this sheet for the evidence table and the open questions.
- **Owner:** half AZ DevOps prepares this sheet. The LEAD runs each step by hand on the production VPS (half AZ DevOps may sit next to the LEAD). Every step that changes the server needs the LEAD's explicit go first; this sheet is the list of steps, not the permission.
- **Plan:** [v2-cutover-plan.md](v2-cutover-plan.md) step **A3** (section 4.1), preconditions **P3, P4, P5** (section 3), 3.1, section 6 (rollback), section 7 (retention). The 28 Oct sheet is [pre-night-28oct.md](pre-night-28oct.md).
- **Runbook behind it:** [production-vps.md](production-vps.md) sections 4, 6, 7, 9, 12, 14, 15, 16, 20; [db-backup.md](db-backup.md); [api-runbook.md](api-runbook.md) sections 2, 6, 10, 13.
- **Refs read when writing:** branch `feature/v2-backend` at `515e440f`, re-checked at `9924a2f6` (migrations 0043/0044 from QLOAD; #123, #125 and #166 merged); PR #166 head `bf016ba0` (migration slot: `slot.sh`, `restore-point.sh`, `pitr.sh`, PITR settings, pointer page); PR #186 head `f60303be` (runbook section 21); PR #164 head `95994f1b`; PR #203 head `ed0d8c77` (malware scan, not merged); PR #123 head `3b196b43` (`migrate:*`); PR #125 head `d9562dc8` (`dump:*`).
- **Abort rule (plan A3):** anything missing at the end: tell the LEAD on 27 Oct. Do not improvise a fix in production, and do not edit a script on the server.
- **Placeholders used (public repo):** `<domain>` (public host name), `<vps-host>`, `<db>` (the `POSTGRES_DB` value), `<release_sha>` (the sha pinned at A2), `<bucket>`, `<s3_profile>`. The P3 role names are fixed in `deploy/vps/lib.sh` (`pp_owner`, `pp_app`, `pp_etl`, `pp_stager`) and are not secrets, so they are written out. Real values stay on the server and in the LEAD's password manager. Never paste a secret value into the issue.

## How to read a step

Each step has **Command** (copied from the script or runbook named under it), **Expected output** (the strings the script prints), **STOP if** (the condition and what to do), and an **Evidence** line to fill in.

**STOP means:** do not run the next step; write the step number and the exact output (names and counts only, never a value) in the issue thread; tell the LEAD there. A step that depends on a PR that is not in the release is listed under "Script gaps" at the end.

## Conventions for all commands

Run as `ppdeploy` on `<vps-host>`, from the checkout, unless `sudo` is shown.

```
cd /opt/pretasiplus
PC='docker compose -f compose.yaml -f deploy/vps/compose.prod.yaml --env-file /etc/pretasiplus/prod.env'
# pq "SQL": one read-only query in the production database, run inside the db container with its own credentials.
# The SQL goes in as an argument; no password is ever typed or printed.
pq() { $PC exec -T db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -At -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"' sh "$1"; }
```

(`PC` is the line in production-vps.md section 8; `pq` is the pattern `restore-point.sh` and `pitr.sh` use for `psql_target`.) `PC` must be run from `/opt/pretasiplus`.

---

## Step 0. Is everything this sheet needs in the release?

Plan P2 says #122, #123, #125 and #166 are merged on 24 Oct and the release sha is pinned on 25 Oct (A2). Check the checkout really has them.

**Command**

```
cd /opt/pretasiplus
git rev-parse HEAD
ls deploy/vps/migration/slot.sh deploy/vps/migration/restore-point.sh deploy/vps/migration/pitr.sh deploy/cutover/pointer-page/render.sh
grep -c '"migrate:all"' apps/api/package.json
grep -c '"admin:bootstrap"' apps/api/package.json
grep -c 'MALWARE_SCAN' deploy/vps/compose.prod.yaml
ls -d apps/api/prisma/migrations/*/ | wc -l
```

**Expected output**

- `git rev-parse HEAD` prints the 40-hex sha, equal to `<release_sha>` of A2.
- `ls` lists the four files (merged from PR #166; they were still in that PR at `515e440f`).
- The next two `grep -c` print `1` (`migrate:all` merged from PR #123; `admin:bootstrap` is on `feature/v2-backend`).
- The `MALWARE_SCAN` count prints `0` (PR #203 is not in the release; see step 5).
- The last line is the migration folder count at the release sha. Write it down: **N = ____** (it is **38** at `9924a2f6`: 36 at `515e440f` plus `0043_questions_legacy_columns` and `0044_question_draw_indexes` from QLOAD. A newer tip can be higher; the number itself is never the check — step 7 compares it with the applied count).

**STOP if**

- the sha is not the A2 sha, or `git status --porcelain --untracked-files=no` prints anything (`deploy.sh` refuses a dirty tree): do not continue; tell the LEAD.
- `ls` says `No such file`: #166 is not in the release. Steps 9 (exclude rule), 10 and the 28 Oct sheet cannot run. Tell the LEAD; the LEAD decides whether to re-pin.
- the `migrate:all` count is `0`: #123 is not in the release.
- the `MALWARE_SCAN` count is not `0`: PR #203 is in the release. ClamAV is then forced on by the compose file and the LEAD's "OFF" decision cannot be applied (step 5). Tell the LEAD.

Evidence: ____

---

## Step 1. Pre-checks: host prerequisites, folders, env files, dry run

### 1a. Host prerequisites (production-vps.md section 2)

**Command**

```
docker compose version --short
timedatectl | grep 'Time zone'
sudo ufw status verbose
node --version
for c in docker git curl openssl flock sha256sum node aws gpg; do printf '%s: ' "$c"; command -v "$c" || echo MISSING; done
df -h /var/backups/pretasiplus
```

**Expected output**

- Compose version 2.24 or newer.
- `Time zone: Asia/Kuala_Lumpur`.
- ufw is active and allows only 22 (limit), 80 and 443 inbound.
- Node `v22.x` (the restore drill needs it).
- Every tool prints a path (none says `MISSING`).
- The backup volume shows free space (the 28 Oct sheet needs about 3 times the database size for restore points, plus WAL for 7 days; production-migration-slot.md section 1 in #166).

**STOP if** any item is missing or different. The LEAD must also confirm in writing: **the VPS disk or the backup volume is encrypted** (production-vps.md section 2; a plain disk means no backups here). Confirmation line: ____

Evidence: ____

### 1b. Folders and env files (production-vps.md section 4 steps 2 to 4; PITR folders from #166, production-migration-slot.md section 1)

**Command** (the LEAD supplies the values with `sudoedit`; never type a value on the command line)

```
sudo install -d -m 750 -o root -g ppdeploy /etc/pretasiplus
sudo install -d -o ppdeploy -g ppdeploy -m 700 /var/backups/pretasiplus /var/lib/pretasiplus-deploy /var/log/pretasiplus /srv/pretasiplus/letsencrypt /srv/pretasiplus/letsencrypt-log /srv/pretasiplus/certbot-webroot
# PITR (PR #166): archive folder owned by uid 70 (postgres in the image); stage and report folders
sudo install -d -o 70 -g 70 -m 700 /var/backups/pretasiplus/wal /var/backups/pretasiplus/wal/wal /var/backups/pretasiplus/wal/base
sudo install -d -o ppdeploy -g ppdeploy -m 700 /srv/pretasiplus/stage
sudo install -d -o 1000 -g 1000 -m 700 /srv/pretasiplus/migration-out
sudo install -m 640 -o root -g ppdeploy deploy/vps/.env.prod.example /etc/pretasiplus/prod.env
sudo install -m 640 -o root -g ppdeploy deploy/vps/api.env.example /etc/pretasiplus/api.env
sudo install -m 640 -o root -g ppdeploy deploy/vps/db.env.example /etc/pretasiplus/db.env
sudoedit /etc/pretasiplus/prod.env
sudoedit /etc/pretasiplus/api.env
sudoedit /etc/pretasiplus/db.env
# P3 least-privilege roles: migrate.env (pp_owner) and etl.env (pp_etl), and the pp_app URL in api.env.
# This writes generated passwords; never type a DATABASE_URL by hand. Run it AFTER db.env has its real POSTGRES_DB.
sudo deploy/vps/db-roles.sh secrets
```

`db-roles.sh secrets` is **not optional**: `deploy.sh` refuses to run without `migrate.env` and `etl.env` (see 1c). It is idempotent — a second run prints `DATABASE_URL for <role> kept` three times and changes nothing.

In `prod.env` the LEAD sets at least: `PP_DOMAIN`, `PP_LETSENCRYPT_EMAIL`, `PP_PG_ARCHIVE_MODE=on` (already the example value in #166), `PP_PROFILES=` (empty or `monitoring`, never `clamav`; step 5), `PP_JOBS_WORKER_ENABLED=true` (step 4). Choose the size profile of production-vps.md section 13.

**Expected output**

```
stat -c '%a %U:%G %n' /etc/pretasiplus/*.env
```

prints `640 root:ppdeploy` for all **five** files: `api.env`, `db.env`, `prod.env`, `migrate.env` and `etl.env`. The `DATABASE_URL` user in each (names only, no values):

```
for f in api.env migrate.env etl.env; do printf '%-12s ' "$f"; sudo sed -n 's|^DATABASE_URL=postgresql://\([a-z_]*\):.*|\1|p' /etc/pretasiplus/$f; done
```

prints `pp_app`, `pp_owner`, `pp_etl` in that order.

**STOP if** a file shows another mode or owner (`deploy.sh` also refuses it), fewer than five files exist, a `DATABASE_URL` user is not the role above, or the folder `/var/backups/pretasiplus/wal` is not owned by uid 70 (`stat -c '%u' /var/backups/pretasiplus/wal` must print `70`; `deploy.sh` refuses a deploy otherwise when PITR is on).

Evidence: ____

### 1c. Dry run (the preflight)

**Command**

```
deploy/vps/deploy.sh --dry-run
```

(Source: `deploy/vps/deploy.sh`, `--dry-run`: runs every read-only check for real and prints each step; changes nothing.)

**Expected output at this point (before TLS)**

- The first lines: `---- 1/9 preflight (tag <sha12>, domain <domain>, env dir /etc/pretasiplus) ----`.
- **The only failure is the certificate line:** `PREFLIGHT FAILED: cannot read the certificate for <domain> (missing, ...): run deploy/vps/tls/init-cert.sh first (runbook section 6)`, followed by `preflight found 1 problem(s); nothing was changed`, exit 1. (The runbook text says `no certificate for ...`; the script's own wording is the one above.)
- **If `db-roles.sh secrets` was skipped in 1b**, the preflight stops earlier and prints two different lines instead, and never reaches the certificate check at all (verified against `9924a2f6`):

  ```
  PREFLIGHT FAILED: env file missing or unreadable: /etc/pretasiplus/migrate.env (create it with: sudo deploy/vps/db-roles.sh secrets)
  PREFLIGHT FAILED: env file missing or unreadable: /etc/pretasiplus/etl.env (create it with: sudo deploy/vps/db-roles.sh secrets)
  ERROR: preflight found 2 problem(s); nothing was changed
  ```

  That is **not** a no-go: run `sudo deploy/vps/db-roles.sh secrets` (1b) and run the dry run again.
- Warnings are allowed for now: `WARN: PP_OFFSITE_KIND=none: backups stay on this server only` (until step 9) and `WARN: PP_HEALTHCHECK_PING_URL is empty ...` (until step 12).
- The tag in the first line is the first 12 characters of `<release_sha>`.

**STOP if** there is any other `PREFLIGHT FAILED` line (a placeholder, a mode, `DATABASE_URL` not equal to `db.env`, a missing WAL folder...). The message names the key, never the value. Fix it with `sudoedit`, run again. If it cannot be fixed within the hour, tell the LEAD.

Evidence: ____

---

## Step 2. TLS, edge check and the certificate renewal timer

Precondition (LEAD): the DNS A record of `<domain>` points at `<vps-host>`, and **no AAAA record** exists (the edge publishes IPv4 only). Which host name the edge serves while v2 is dark is an open question (Q13).

### 2a. Dry run, then the real certificate

**Command** (source: `deploy/vps/tls/init-cert.sh`, flags `--dry-run`, `--staging`, `--yes`)

```
sudo deploy/vps/tls/init-cert.sh --dry-run
sudo deploy/vps/tls/init-cert.sh
```

The second call asks "Type the domain to confirm"; the LEAD types the domain. Do not repeat the real run in a loop (Let's Encrypt rate limits).

**Expected output**

- Dry run: `DNS check (informational): <domain> -> <ip>` (the address must be `<vps-host>`'s), `starting the edge (nginx) alone`, certbot output, and the last line `certbot dry run finished OK; the placeholder certificate stays until the real run`.
- Real run: last line `certificate installed for <domain>; edge reloaded`.

**STOP if** the DNS line shows another address, certbot reports a failed challenge, or the script exits non-zero. A failed real run puts the placeholder back (the edge keeps a certificate); read the output, do not retry more than once, tell the LEAD.

Evidence: ____

### 2b. The certificate is real

**Command**

```
echo | openssl s_client -connect <domain>:443 -servername <domain> 2>/dev/null | openssl x509 -noout -issuer -subject -dates
```

**Expected output:** an `issuer` that is Let's Encrypt and different from the `subject`; `notAfter` about 90 days away.

**STOP if** the issuer equals the subject (the 1-day self-signed placeholder) or the issuer says "staging" (a staging certificate; browsers warn; `deploy.sh` warns about it). Run the real step 2a again only after the LEAD agrees.

Evidence: ____

### 2c. Edge config check (optional where the tools exist)

**Command** (sources: `deploy/vps/nginx/check.sh`, `deploy/vps/nginx/test-routing.sh`)

```
deploy/vps/nginx/check.sh report-only
deploy/vps/nginx/test-routing.sh
```

**Expected output:** `OK: edge nginx config is valid (csp mode: report-only)` and `ALL PASSED`. These need a host `nginx`, `perl`, `openssl` and (for the second) `python3`. If the host has no nginx the script prints `nginx not installed` and exits 2: that is not a server fault; the proof on this host is then the edge starting in 2a and the health checks of step 6 (these two scripts run in CI and on the build side).

**STOP if** a script that could run prints `FAIL` or `nginx: [emerg]`.

Evidence: ____

### 2d. Install the systemd units and enable the renewal timer (production-vps.md section 9, Schedule)

**Command**

```
sudo mkdir -p /var/log/pretasiplus && sudo chown ppdeploy: /var/log/pretasiplus
sudo install -m 644 deploy/vps/systemd/pretasiplus.tmpfiles.conf /etc/tmpfiles.d/pretasiplus.conf
sudo systemd-tmpfiles --create /etc/tmpfiles.d/pretasiplus.conf
sudo cp deploy/vps/systemd/pp-*.service deploy/vps/systemd/pp-*.timer 'deploy/vps/systemd/pp-alert@.service' /etc/systemd/system/
sudo systemctl daemon-reload
systemd-analyze verify /etc/systemd/system/pp-*.service /etc/systemd/system/pp-*.timer
sudo systemctl enable --now pp-cert-renew.timer
systemctl list-timers 'pp-*'
$PC --profile tls run --rm certbot renew --dry-run
```

(The last line is the check that `deploy/vps/tls/renew.sh` itself names in its failure alert.)

**Expected output:** `systemd-analyze verify` prints nothing but notes about `/opt/...` paths (acceptable per the runbook); `list-timers` shows `pp-cert-renew.timer` with a next run (03:40 or 15:40 plus a random delay); certbot says the simulated renewals succeeded.

**STOP if** `systemd-analyze verify` reports an error other than path notes, the timer is not listed, or the renewal dry run fails.

Evidence: ____

---

## Step 3. Secrets (precondition P5): names only, never values

The secret store on this host is `/etc/pretasiplus/{api,db,prod,migrate,etl}.env` (root:ppdeploy, mode 640) plus the LEAD's password manager (production-vps.md section 12). The plan says "platform secret store"; this stack has no other store. `migrate.env` and `etl.env` hold one key each, written by `db-roles.sh secrets` (step 1b), never by hand.

**Command: list the key names that exist (the sed prints a name only when the line is `NAME=...`; it can never print a value)**

```
for f in api.env db.env prod.env migrate.env etl.env; do echo "== $f"; sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' /etc/pretasiplus/$f | sort; done
```

**Command: presence and absence counts (grep -c prints a number, not a line)**

```
cd /etc/pretasiplus
for k in DATABASE_URL SESSION_SECRET IC_HASH_KEY MARKETPLACE_PLATFORM_WHATSAPP; do printf '%s in api.env: ' "$k"; grep -c "^$k=" api.env; done
for k in POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD; do printf '%s in db.env: ' "$k"; grep -c "^$k=" db.env; done
for k in PP_MIGRATE_TARGET_DB PP_ALLOW_MIGRATE_APPLY PP_ALLOW_MIGRATE_ROLLBACK FILE_STORAGE_DIR ANON_HMAC_KEY ANON_HMAC_KEY_FILE; do printf '%s in any env file: ' "$k"; cat api.env db.env prod.env | grep -c "^$k="; done
env | grep -c '^PP_ALLOW_MIGRATE\|^PP_MIGRATE_TARGET_DB\|^ANON_HMAC'
cd /opt/pretasiplus && grep -n 'FILE_STORAGE_DIR' deploy/vps/compose.prod.yaml
```

**Expected output**

- The first four counts are `1`; the db.env counts are `1`. `migrate.env` and `etl.env` each hold exactly one `DATABASE_URL` and no other key.
- The six "any env file" counts are `0`, and the `env | grep -c` line prints `0`. These names are set **per run only**, by `slot.sh etl` (`PP_MIGRATE_TARGET_DB` on every run, `PP_ALLOW_MIGRATE_APPLY` only when `--apply` is on the line, `PP_ALLOW_MIGRATE_ROLLBACK` only for `migrate:rollback`); a permanent entry would defeat the guards.
- The `FILE_STORAGE_DIR` line is the compose overlay forcing `/var/lib/pretasiplus/files` for the api (not an env-file entry).
- `deploy.sh --dry-run` (step 1c) already checks: `SESSION_SECRET` and `IC_HASH_KEY` are 32+ characters and different; each `DATABASE_URL` names its own P3 role (`api.env`→`pp_app`, `migrate.env`→`pp_owner`, `etl.env`→`pp_etl`) on host `db` with the `POSTGRES_DB` of `db.env`; the three passwords differ from each other **and** from `POSTGRES_PASSWORD`; `POSTGRES_USER` is none of the role names; no placeholder.

**Confirmation lines (the LEAD writes yes or no and the date; no values)**

| Name | Rule | Confirmed |
|---|---|---|
| `DATABASE_URL` | one per role file: `api.env`→`pp_app`, `migrate.env`→`pp_owner`, `etl.env`→`pp_etl`; same host (`db`) and database as `db.env`; each password 32-128 URL-safe characters, all three different from each other and from `POSTGRES_PASSWORD` (`deploy.sh` checks all of it). Written by `db-roles.sh secrets`, never typed | ____ |
| `IC_HASH_KEY` | in `api.env`; **one value for the life of the system; never rotated, never deleted**; the LEAD holds a copy outside the server (a different key changes every IC hash; a restore without `IC_HASH_KEY` and `SESSION_SECRET` is not a full restore) | LEAD has a copy: ____ |
| `PP_MIGRATE_TARGET_DB` | not stored; `slot.sh etl` sets it per run from `POSTGRES_DB` | absent: ____ |
| `PP_ALLOW_MIGRATE_APPLY` | not stored; per run only, with `--apply` | absent: ____ |
| `FILE_STORAGE_DIR` | forced by the overlay for the api. For an apply with `--files-dir` the migrate container has no such path: **open (Q5)** | ____ |
| `PP_ALLOW_MIGRATE_ROLLBACK` | not stored; rollback only, per run | absent: ____ |
| Anonymiser key (`ANON_HMAC_KEY`, `ANON_HMAC_KEY_FILE`) | none in production (plan 3.3 item 1; the ETL refuses anonymised data in production) | absent: ____ |
| `SESSION_SECRET`, `MARKETPLACE_PLATFORM_WHATSAPP`, `POSTGRES_PASSWORD` | set, real, not a placeholder | ____ |
| Off-site: the aws profile of `ppdeploy`, the GPG **public** key on the server, the **private** key off the server with the LEAD | step 9 | ____ |
| CI tokens | none has access to production: this pack adds none (production-vps.md section 12); the workflows use only the default `GITHUB_TOKEN` (api-runbook.md section 13). The LEAD checks the repository's Actions secrets and deploy keys list and the `ppdeploy` authorized keys (`wc -l ~ppdeploy/.ssh/authorized_keys`: each line is a named person or role) | ____ |

**STOP if** any "absent" name has a count above `0` (remove it with `sudoedit`, note it), a required name is `0`, the LEAD has no copy of `IC_HASH_KEY`, or any CI token can reach the VPS or the database. Do not print the file to "see".

Evidence: ____

---

## Step 4. Single API instance (runbook section 14; the #204 guard in `deploy.sh`)

**Command**

```
grep -E '^PP_JOBS_WORKER_ENABLED=' /etc/pretasiplus/prod.env
grep -n 'replicas' deploy/vps/compose.prod.yaml
deploy/vps/deploy.sh --dry-run        # the guard runs inside the preflight
```

After the deploy of step 6, count the running api containers:

```
$PC ps -q api | grep -c .
```

**Expected output**

- `PP_JOBS_WORKER_ENABLED=true` (the one api instance is the jobs worker; `deploy.sh` refuses any other value).
- The `grep replicas` line finds only the comment saying not to add one (no `deploy.replicas` key).
- The dry run shows no line `api must run as ONE instance (threat model row 18, runbook section 14): ...`. That is the refusal text if the rendered config has `replicas` or `scale` other than 1, or more than one api container is already running.
- After step 6: the count is exactly `1`.

**STOP if** the refusal message appears, `PP_JOBS_WORKER_ENABLED` is not `true`, or the count is not `1`. Never `--scale api=N`, never a second stack on the same database. Tell the LEAD.

Evidence: ____

---

## Step 5. ClamAV is OFF at go-live (LEAD decision; production-vps.md sections 15, 16, 20)

Decision in force: the compose profile `clamav` is **not** in `PP_PROFILES`; intake is admin-only; the uploads gate is a dated LEAD risk-acceptance line.

**Command**

```
grep -E '^PP_PROFILES=' /etc/pretasiplus/prod.env
grep -c 'clamav' <<<"$(grep -E '^PP_PROFILES=' /etc/pretasiplus/prod.env)"
docker ps --format '{{.Names}}' | grep -ci clam
grep -c '^INTAKE_TEACHER_ENABLED=true' /etc/pretasiplus/api.env
grep -c 'MALWARE_SCAN' deploy/vps/compose.prod.yaml
```

**Expected output:** `PP_PROFILES=` is empty or lists only `monitoring`; the next three counts are `0` (no `clamav` in the profile list, no clamd container, intake for teachers not switched on; `INTAKE_TEACHER_ENABLED` defaults to false); the `MALWARE_SCAN` count is `0`.

**The LEAD writes the uploads-gate line** in the cutover log (the issue) now, dated, with this content:

```
Uploads gate, <date> <hh:mm> MYT: ClamAV is OFF at go-live by LEAD decision (production-vps.md section 20).
No malware scan runs on uploads. Intake is Admin Pusat only (INTAKE_TEACHER_ENABLED not set).
The LEAD accepts the risk of pupil and teacher uploads without a scan until the #78 scan card lands. Signed: the LEAD.
```

Important facts the LEAD should know when signing: (1) there is **no setting that blocks pupil or teacher uploads**; the line is a risk acceptance, not a control. (2) The runbook rule is "no pupil or teacher uploads in production until the #78 ClamAV wiring has landed, or a recorded LEAD risk acceptance" and it is a go/no-go item (section 16). (3) If PR #203 (ed0d8c77) is merged into the release, its compose file forces `MALWARE_SCAN=clamd` and starts clamd on every deploy, and its `deploy.sh` refuses a deploy without it; "OFF" is then impossible and this step must be redone.

**STOP if** `clamav` is in `PP_PROFILES` or a clamd container runs (remove it from `prod.env` and `deploy` again; tell the LEAD), the `MALWARE_SCAN` count is not `0`, or the LEAD has not written the gate line. Without the line, uploads are a no-go at G6.

Evidence (gate line pasted, date and time): ____

---

## Step 6. Deploy dark, then the reference-only seed

"Dark" in the plan means: v2 is not public and registration is closed, and nobody is told the address. The repo has **no setting that closes registration** and no allow-list at the edge (see Q14, Q15 and Script gaps). The only measure available is: do not announce `<domain>`, do not link to it, and do not do the DNS switch before C3 on 30 Oct.

### 6a. Deploy (migrates to the tip in the same run)

**Command** (source: `deploy/vps/deploy.sh`; flags `--dry-run`, `--yes`, `--skip-backup`, `--allow-dirty`, `--tag`, `--seed-reference`)

```
deploy/vps/deploy.sh --dry-run
deploy/vps/deploy.sh
```

The second call asks "Type the domain to confirm"; the LEAD types the domain. Do not use `--skip-backup` or `--allow-dirty`.

**Expected output**

- Dry run: `preflight passed`, then `DRY-RUN would run: ...` for each of steps 2 to 8. The very last line of a dry run also reads `deploy complete: <sha12>`; it does not mean anything ran (the earlier lines say `DRY-RUN would run`).
- Real run: `db is not running: first install, nothing to back up`; `---- 5/9 migrate (prisma migrate deploy only) ----`; then `health checks passed: /api/health 200, /api/ready ready, / 200, /api/metrics 404, http redirects` and `deploy complete: <sha12>. Roll back the images with: deploy/vps/rollback.sh ...`.

**STOP if** the dry run prints any `PREFLIGHT FAILED`, or the real run prints `DEPLOY FAILED at: ...`. There is no automatic rollback and migrations are forward-only. Read the three lines the script prints (where it stopped, what to do). Do not run `rollback.sh` or restore a dump without the LEAD (production-vps.md section 8). On the first install there is nothing live to protect, but still tell the LEAD.

Evidence (the `deploy complete` line, with the tag): ____

### 6b. Reference seed (once)

**Command**

```
deploy/vps/deploy.sh --seed-reference --dry-run
deploy/vps/deploy.sh --seed-reference
```

(Source: `deploy/vps/deploy.sh`. It runs `npm run be:db:seed` in the `migrate` image with `ALLOW_DEMO_SEED=false` and `BIJAK_POC_QUESTIONS=false`. It exits after the seed and does not migrate or deploy. The LEAD types the domain at the prompt.)

**Expected output**

- Dry run: `DRY-RUN would run: docker compose ... run --rm --no-deps -e ALLOW_DEMO_SEED=false -e BIJAK_POC_QUESTIONS=false migrate npm run be:db:seed`.
- Real run: the seed prints the line `seed: demo modules skipped: NODE_ENV is not development or test, so this run counts as production (set ALLOW_DEMO_SEED=1 to load them): <module names>`, and the script ends with `reference seed finished: the output must list only reference modules and 'demo modules skipped'`. Exit 0. It loads the `school_packages` catalogue and the SPM subject configs only.

Check there are no accounts and no demo accounts:

```
pq "select count(*) from users"
pq "select count(*) from users where email like '%@demo.test' or email like '%@example.test'"
```

Expected: `0` and `0` (nothing creates users here; the first admin is step 11, the smoke accounts are 28 Oct).

**STOP if** the seed output does not contain the `demo modules skipped` line, shows a demo module as loaded, or either count is not `0`. Never run the seed with `ALLOW_DEMO_SEED` or `--force-demo` in production.

Evidence: ____

### 6c. After the deploy: ports, HSTS, single instance

**Command**

```
sudo ss -tlnp
$PC ps -q api | grep -c .
curl -sI https://<domain>/ | grep -ic '^strict-transport-security'
curl -sI https://<domain>/api/health | grep -ic '^strict-transport-security'
curl -s https://<domain>/api/ready
```

**Expected output:** only 22, 80, 443 (and, with the `monitoring` profile, 127.0.0.1:3001) listen; api count `1`; each HSTS count `1`; `/api/ready` returns JSON containing `"status":"ready"`, `"db":"up"`, `"migrations":"applied"`.

**STOP if** another port listens, the HSTS header is doubled or missing, or `/api/ready` is not 200.

Evidence: ____

---

## Step 7. Schema at the tip: migration count and readiness (P3, last part)

`prisma migrate deploy` ran in step 6a (the `migrate` job). Prove the database has every migration of `<release_sha>`.

**Command**

```
pq "select count(*) from _prisma_migrations where finished_at is not null and rolled_back_at is null"
ls -d apps/api/prisma/migrations/*/ | wc -l
pq "select count(*) from _prisma_migrations where finished_at is null"
curl -s -o /dev/null -w '%{http_code}\n' https://<domain>/api/ready
```

**Expected output**

- The first two numbers are equal: applied = folders (N from step 0).
- The third number is `0` (no unfinished or failed migration).
- `/api/ready` prints `200`. The body field is `"migrations":"applied"` (`apps/api/src/common/health/ready.controller.ts`): it is `ready` only when every shipped migration is applied and none failed.

**STOP if** the numbers differ, the third number is not `0`, or `/api/ready` is not 200 (503 means the database or a migration; do not restart-loop the api; `$PC logs migrate` and tell the LEAD). Also note: **a new migration merged after today means this check and the 28 Oct restore points are redone** (plan A5).

Evidence: applied = ____, folders = ____, unfinished = ____, ready = ____

---

## Step 8. P3 database roles (`deploy/vps/db-roles.sh`, already run by the deploy)

**This step changed on `9924a2f6`.** The roles are no longer hand-written SQL: `deploy/vps/db-roles.sh` and `deploy/vps/db-roles/{apply,check}.sql` create and prove them, and **`deploy.sh` already ran `apply` (step 4), `apply` again and `check` (step 5) during step 6a** — a failed `check` stops a deploy before the api switches. So by the time you reach this step the four roles exist. What is left here is to read the evidence and paste it.

The four fixed roles (`deploy/vps/lib.sh`; none is a superuser, none has CREATEDB / CREATEROLE / REPLICATION / BYPASSRLS, none is a member of any role):

| Role | Used by | Credentials in | Rights in short |
|---|---|---|---|
| `pp_owner` | the one-shot `migrate` service (`prisma migrate deploy`, the reference seed) | `migrate.env` | owns the database, schema `public` and every object in it; the only DDL in `public` |
| `pp_app` | the API | `api.env` | CONNECT, USAGE on `public`, SELECT/INSERT/UPDATE/DELETE on every table (`_prisma_migrations`: SELECT only), USAGE/SELECT/UPDATE on every sequence, plus the owner's default privileges. No DDL, no TEMP, nothing on the stage schemas |
| `pp_etl` | `migrate:*` through `slot.sh etl` | `etl.env` | the `pp_app` grants plus TEMP; USAGE and SELECT on `staging_cloud` and `archive_cloud`, UPDATE on `archive_cloud` |
| `pp_stager` | `slot.sh copy` and the section 7 drops | none — **no password**, local socket in the db container only | CONNECT and CREATE on the database (so it can create and then own the two stage schemas). Nothing on `public` |

The bootstrap `POSTGRES_USER` of `db.env` stays the cluster superuser and is used only by the ops scripts inside the db container (`db-roles.sh`, `backup.sh`, `restore-drill.sh`, a manual restore). `deploy.sh` refuses a `POSTGRES_USER` that is one of the four role names, and refuses a `DATABASE_URL` that does not name its own role.

### 8a. Show the facts first (read-only)

**Command**

```
pq "select rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolcanlogin from pg_roles where rolname in ('pp_owner','pp_app','pp_etl','pp_stager') order by 1"
pq "select tableowner, count(*) from pg_tables where schemaname = 'public' group by 1"
pq "select rolname, rolsuper from pg_roles where rolname = (select usename from pg_user where usesuper limit 1)"
```

**Expected output**

- Four rows, one per role, every column `f` except `rolcanlogin` = `t`.
- One owner line only: `pp_owner | <N>` (N is the public table count; it was **197** at `9924a2f6`). A second owner means something was created outside `migrate` — tell the LEAD.
- The superuser line is the `POSTGRES_USER` value, not one of the four roles.

**STOP if** a role is missing, any attribute other than `rolcanlogin` is `t`, or a `public` table is owned by anything but `pp_owner`. Do not hand-write SQL: run `deploy/vps/db-roles.sh apply` and then `check`.

Evidence: roles ____, public owner ____ / ____ tables, superuser is POSTGRES_USER: ____

### 8b. The proof run (`db-roles.sh check`)

This is the P3 evidence. It is read-only: every SQL probe runs `AS` the role inside a block that is rolled back, and the login probes only log in.

**Command**

```
deploy/vps/db-roles.sh check
```

**Expected output:** one `PASS | <role> | <probe> | <detail>` line per probe and a final `DB ROLES CHECK PASSED: <n> probes`. Before any `slot.sh copy` (so with no stage schemas) there are **44 probes**: 38 SQL probes + 3 network logins (`pp_app`, `pp_owner`, `pp_etl`, each `logged in, not a superuser`) + the `pp_app` TEMP-table refusal + the `pp_stager` network refusal + the `pp_stager` local-socket login. With both stage schemas present it is **50** (6 more SQL probes). The exact count is not the check — **no `FAIL` line and exit 0** is.

Lines worth reading out loud, all of which were `PASS` in the 24 Oct local rehearsal on the same schema (PR `[PC-5]`):

```
PASS | app   | _prisma_migrations read-only | select=t insert=f update=f delete=f
PASS | app   | CREATE TABLE in public -> expect denied | denied: permission denied for schema public
PASS | app   | CREATE TEMP TABLE -> expect denied | denied: permission denied for schema pg_temp_N
PASS | app   | TRUNCATE public.users -> expect denied | denied: permission denied for table users
PASS | etl   | CREATE TABLE in public -> expect denied | denied: permission denied for schema public
PASS | etl   | CREATE TEMP TABLE -> expect allowed | allowed
PASS | stage | SELECT on public.users -> expect denied | denied: permission denied for schema public
PASS | owner | owns every public table and sequence | objects owned by another role: 0 of 378
PASS | owner | owns the database | owner: pp_owner
PASS | stage | network login as pp_stager | refused (no password)
```

**STOP if** any line starts with `FAIL`, or the script exits non-zero (`DB ROLES CHECK FAILED: <k> of <n> probes`). The fix is `deploy/vps/db-roles.sh apply` followed by `check` again — never hand-written GRANTs. If a `FAIL` survives one `apply`, stop and tell the LEAD: do not continue to the 28 Oct sheet.

Evidence: probes ____ , FAIL lines ____ , exit ____

### 8c. The stage schemas are not pre-created

The `pp_etl` read rights on `staging_cloud` and `archive_cloud` need no action tonight and are **not** lost at a copy any more: `slot.sh copy` runs `db-roles.sh apply` before the drop and again after the restore, and `apply.sql` carries a default-privileges rule for what `pp_stager` creates, so the migration role can read a fresh copy at once.

**Command (read-only)**

```
pq "select count(*) from information_schema.schemata where schema_name in ('staging_cloud','archive_cloud')"
```

**Expected output:** `0`. Do **not** pre-create them: `restore-point.sh take pre_etl` refuses when `staging_cloud` exists (`pre_etl must hold no .cloud data, but schema staging_cloud exists`).

**STOP if** the count is not `0`: a stage schema exists before the migration night. Tell the LEAD.

Evidence: ____

---

## Step 9. Backups to S3, exclusion of `staging_cloud`, and the restore drill (P4)

P4 rule: **a backup that has not passed a restore check is not trusted.** Routine backups leave `staging_cloud` out (PR #166).

### 9a. Off-site target (production-vps.md sections 9 and 20; `deploy/vps/backup/offsite.sh`)

**Command**

```
sudoedit /etc/pretasiplus/prod.env      # LEAD: PP_OFFSITE_KIND=s3, PP_OFFSITE_S3_URI=s3://<bucket>/<prefix>, PP_OFFSITE_S3_ENDPOINT, PP_OFFSITE_S3_PROFILE=<s3_profile>, PP_BACKUP_GPG_RECIPIENT, PP_BACKUP_GPG_FPR
aws configure --profile <s3_profile>    # the LEAD types the key; it lives in ppdeploy's aws config, never in prod.env
gpg --import <public_key_file>          # the PUBLIC key only; the private key stays off the server
gpg --list-keys
```

**Expected output:** `gpg --list-keys` shows the backup key; `PP_BACKUP_GPG_FPR` holds its 40-hex fingerprint (`gpg --fingerprint`). Settings in force (section 20): bucket lifecycle 35 days, **no object lock**, versioning off, a key that can write but not delete if the provider supports it. The LEAD confirms the lifecycle rule in the provider console (no repo script sets it): ____

**STOP if** the bucket, endpoint, key or GPG key pair are not ready (Q19). Without them P4 cannot pass; tell the LEAD on 27 Oct.

Evidence: ____

### 9b. First backup with the off-site copy (source: `deploy/vps/backup/backup.sh`, flags `--tag daily|pre-deploy|drill`, `--no-offsite`, `--no-files`)

**Command**

```
deploy/vps/backup/backup.sh
ls -l /var/backups/pretasiplus/pp-backup-*.dump*
```

**Expected output**

- `dump ok: pp-backup-<UTC>Z.dump  <bytes> bytes  sha256 <hash>  (<n> tables with data; schemas left out: staging_cloud)` (the part after the table count is from PR #166).
- `off-site (s3) ok: pp-backup-<UTC>Z.dump.gpg` and `off-site (s3) ok: pp-backup-<UTC>Z.dump.sha256`.
- `backup done: pp-backup-<UTC>Z.dump`, then the lines `BACKUP_FILE=`, `BACKUP_SHA256=`, `BACKUP_SIZE=`. Write down the file name and the sha256 (a hash is not a secret).
- Exclusion proof (no `staging_cloud` entries): `$PC exec -T db pg_restore --list < /var/backups/pretasiplus/pp-backup-<UTC>Z.dump | grep -c staging_cloud` prints `0`.

**STOP if** there is `BACKUP FAILED`, `refusing to send plaintext`, `no public key for PP_BACKUP_GPG_FPR`, `aws CLI not installed`, or the `staging_cloud` count is not `0` (PR #166 not in the release: tell the LEAD). If the key is write-only, listing the bucket may be denied; the LEAD confirms the object in the provider console instead.

Evidence: file ____ sha256 ____ time ____

### 9c. Timer

**Command**

```
sudo systemctl enable --now pp-backup.timer
systemctl list-timers 'pp-*'
```

**Expected output:** `pp-backup.timer` with a next run around 02:15 MYT. `pp-restore-drill.timer` is installed but **not enabled** here (Q20).

**STOP if** the timer is not listed.

Evidence: ____

### 9d. Restore drill (source: `deploy/vps/backup/restore-drill.sh`, flags `--operator`, `--no-quiesce`, `--evidence-dir`)

The drill stops the api for one to three minutes. That is fine while v2 is dark.

**Command**

```
deploy/vps/backup/restore-drill.sh --operator "half AZ DevOps"
cat /var/backups/pretasiplus/drill-evidence/latest.txt
```

**Expected output:** the evidence block `PP-RESTORE-DRILL-EVIDENCE v1` with `row_count_comparison: PASS (... 0 mismatches)`, `result: PASS`, `writers_quiesced: api stopped for the duration of the drill`, and `prisma_migrations_rows: <n>` equal to N of step 0. The api is started again by the script (check `/api/ready` is 200 afterwards).

**STOP if** `result: FAIL` (the block adds `failure_reason:`), or the api does not come back (`docker compose start api`, then tell the LEAD). A failed drill blocks releases until a good backup exists.

Evidence: result ____ time ____ prisma_migrations_rows ____

### 9e. One off-site copy restored (production-vps.md sections 9 and 16; runbook says once, at T-2 d)

There is no repo script for this (Script gaps). With the LEAD's private key (which is never on the server), on a scratch host or the LEAD's machine:

**Command**

```
aws --profile <s3_profile> --endpoint-url <endpoint> s3 cp s3://<bucket>/<prefix>/pp-backup-<UTC>Z.dump.gpg .
aws --profile <s3_profile> --endpoint-url <endpoint> s3 cp s3://<bucket>/<prefix>/pp-backup-<UTC>Z.dump.sha256 .
gpg --decrypt pp-backup-<UTC>Z.dump.gpg > pp-backup-<UTC>Z.dump
sha256sum -c pp-backup-<UTC>Z.dump.sha256
pg_restore --list pp-backup-<UTC>Z.dump | head
```

**Expected output:** `pp-backup-<UTC>Z.dump: OK` and a readable table of contents with table data. (A full restore of this file into a scratch database can use `node scripts/db-restore-check.mjs --file <dump> --container <db container>` per db-backup.md.) Delete the scratch copies afterwards.

**STOP if** the key cannot decrypt, the sha256 does not match or the list is empty: the off-site path is not trusted; tell the LEAD.

Evidence: ____

---

## Step 10. PITR base (P4; source: `deploy/vps/migration/pitr.sh`, PR #166)

`pitr.sh` usage (from its own header): `status`, `base [--label NAME]`, `restore-test --target-time "YYYY-MM-DD HH:MM:SS+00" [--base STAMP]`, `cleanup --keep-from STAMP [--yes]`. The label is lowercase letters, digits and `_`.

The archive settings are in `prod.env` and the compose overlay (both from PR #166): `PP_PG_ARCHIVE_MODE=on`, `PP_PG_ARCHIVE_TIMEOUT=1800` (seconds; the worst-case loss of a PITR restore), `PP_WAL_ARCHIVE_DIR=/var/backups/pretasiplus/wal` (owner uid 70, mode 700). `archive_mode` was already on at the first deploy of step 6, so no extra restart is needed.

**Command**

```
grep -E '^PP_PG_ARCHIVE_MODE=|^PP_PG_ARCHIVE_TIMEOUT=|^PP_WAL_ARCHIVE_DIR=' /etc/pretasiplus/prod.env
deploy/vps/migration/pitr.sh status
deploy/vps/migration/pitr.sh base --label first
deploy/vps/migration/pitr.sh status
```

**Expected output**

- The three settings: `on`, `1800`, the archive folder.
- `status` first line: `archive_mode=on archive_timeout=<value> wal_level=replica`; second line `archiver: archived <n>, last <segment> at <UTC time> UTC, failed 0`.
- `base`: `BASE BACKUP DONE: <stamp> (label pp-first-<stamp>), <size>, duration_s=<n>`.
- The second `status` lists the base backup stamp and `failed 0`.

Then, once at least one WAL segment has been archived after the base backup (wait up to `archive_timeout`, 30 minutes; `base` closes its last segment itself), prove the archive replays:

```
deploy/vps/migration/pitr.sh restore-test --target-time "<UTC time after the base backup, YYYY-MM-DD HH:MM:SS+00>"
```

Expected: `PITR TEST PASSED: base <stamp> replayed to <time> and promoted in <n> s; <n> public tables, <N> applied migrations`. It runs in a scratch container with no network and never touches the production data directory. If the timing does not fit today, do it on 27 Oct and tell the LEAD.

**STOP if** `archive_mode=off` ("archive_mode is off: set PP_PG_ARCHIVE_MODE=on in prod.env and redeploy"), `failed` is above `0` or grows, `base` exits non-zero, or `restore-test` prints `PITR TEST FAILED`. A failed archive must be fixed before the 28 Oct sheet; `slot.sh gonogo` prints `PITR off` or `failed_count` lines and the night card treats them as STOP.

Evidence: base stamp ____ restore-test ____

---

## Step 11. Admin Pusat bootstrap (AZ-36; runbook section 21, PR #186)

**Default in force (F1, production-vps.md section 20):** the first Admin Pusat accounts are the **migrated `.cloud` admins**, arriving with `migrate:all --apply` on 29 Oct. At least **two** active Admin Pusat accounts must exist afterwards (the second is the break-glass); the LEAD signs in with his own. The bootstrap command is the **fallback**, and the tool for a locked-out last admin. So **on 26 Oct this step is normally not run.** Run it only if the LEAD decides to (Q17).

The command exists in code on `feature/v2-backend` (`apps/api/package.json`: `admin:bootstrap`; `apps/api/src/ops/admin-bootstrap/`). Its runbook text (section 21) exists only in PR #186; production-vps.md section 4 step 11 and findings F1/F11 on `feature/v2-backend` still say "no bootstrap command".

**Command** (from #186 section 21; hidden-prompt form; the leading space keeps the line out of the history when `HISTCONTROL=ignorespace`)

```
 $PC run --rm --no-deps migrate npm run admin:bootstrap -w @pp/api -- --mode=create --email=<admin e-mail> --confirm=<admin e-mail>
```

Flags (from the command's own usage): `--mode=create|reset`, `--email`, `--confirm` (must repeat `--email`), `--name`, `--reactivate` (reset only), `--password-stdin`. The password is typed twice at the hidden prompt, never on the line. Only without a terminal use `--password-stdin` with a one-line file owned by `ppdeploy`, then `shred -u` it. Use `--mode=reset` for a locked-out admin.

**Expected output:** exit 0 and a line with the user id, the database name, and the number of sessions and reset links ended. No password change is required at the next login (R39b). One `audit_events` row `admin.bootstrap.created` (or `.reset`) is written.

**STOP if** exit 3 (refused: `create` while an active Admin Pusat exists or the e-mail has an account; nothing written) or exit 2 (usage, confirmation missing, weak password under 12 characters). Do not work around it with raw SQL on `users`, the demo seed, or `ALLOW_DEMO_SEED` (runbook section 21 forbids all three).

Evidence (run: yes or no; if yes, exit code and the user id line; no e-mail, no password): ____

---

## Step 12. Monitoring and health probe

**Command**

```
sudo systemctl enable --now pp-health-probe.timer
systemctl list-timers 'pp-*'
deploy/vps/monitoring/health-probe.sh
deploy/vps/monitoring/alert.sh "A3 test alert from <vps-host>"
```

(Sources: `deploy/vps/monitoring/health-probe.sh [--quiet]`, `deploy/vps/monitoring/alert.sh "message"`. The LEAD sets `PP_ALERT_WEBHOOK_URL`, `PP_HEALTHCHECK_PING_URL`, `PP_HEALTHCHECK_PROBE_URL` in `prod.env` with `sudoedit`, and creates the external uptime checker on `https://<domain>/api/health` and `/api/ready`, section 10 of the runbook.)

**Expected output:** three timers listed (`pp-backup`, `pp-cert-renew`, `pp-health-probe`); the probe prints `ok   /api/health 200`, `ok   /api/ready 200`, `ok   container states read`, `ok   disk ... %`, `ok   certificate <n> days left`, `ok   newest backup <n> h old`, `ok   api error lines in 5 min: <n>` and `all checks passed`, exit 0; the test alert reaches the LEAD's channel (the script itself prints `WARN: ALERT: ...` to the journal). `deploy.sh --dry-run` no longer warns about the ping URL.

**STOP if** the probe exits 1 (it names the failed check) or the test alert does not arrive. Mark as missing and tell the LEAD on 27 Oct; the night depends on alerts working.

Evidence: ____

---

## Step 13. Final A3 evidence block

Paste this into the issue (names, counts and yes/no only; no values, no passwords, no names of people).

```
A3 evidence, 26 Oct 2026, release sha <sha12>, written <hh:mm> MYT by half AZ DevOps with the LEAD

Step 0  scripts present (slot.sh, restore-point.sh, pitr.sh, render.sh): yes | no ; #203 in release: no | yes
Step 1  dry run before TLS: only the certificate line: yes | no
Step 2  certificate issuer: <issuer>, expires <date>; renew timer: enabled; renewal dry run: ok
Step 3  P5 secrets: DATABASE_URL yes ; IC_HASH_KEY yes, LEAD has a copy yes ; SESSION_SECRET yes
        PP_MIGRATE_TARGET_DB absent ; PP_ALLOW_MIGRATE_APPLY absent ; PP_ALLOW_MIGRATE_ROLLBACK absent ; FILE_STORAGE_DIR (Q5) <state>
        anonymiser key absent ; CI tokens with production access: none
Step 4  single instance: api containers 1 ; PP_JOBS_WORKER_ENABLED=true
Step 5  ClamAV: PP_PROFILES=<value>, clamd container none ; uploads gate line dated <date> by the LEAD: yes | no
Step 6  deploy complete <sha12> ; seed: demo modules skipped line seen ; users 0 ; demo accounts 0 ; registration closed: NOT ENFORCED (no setting, Q14) ; v2 public: no, address not announced
Step 7  P3 migrations: applied <n> = folders <n> ; unfinished 0 ; /api/ready 200 "migrations":"applied"
Step 8  P3 roles: <migration_role> <attributes> ; <stage_role> <attributes> ; grants as in the issue ;
        stage role select on public.users: <error line> ; insert: <error line> ;
        API role superuser: <t|f> (Q2) ; schema owner = API role: <yes|no>
Step 9  P4 backup <file> sha256 <hash> at <time> ; off-site s3 ok ; staging_cloud entries in dump 0 ; drill result <PASS|FAIL> at <time>, prisma_migrations_rows <n> ; off-site copy restored: yes | no
Step 10 P4 PITR: archive_mode on ; base <stamp> ; failed 0 ; restore-test <PASSED|not yet>
Step 11 Admin Pusat bootstrap: not run (F1: migrated admins on 29 Oct) | run, exit <code>
Step 12 probe timer on ; all checks passed ; test alert received: yes | no
Missing / open for the LEAD on 27 Oct: <list, or none>
```

**Abort rule (plan A3):** anything missing: **the LEAD is told on 27 Oct.** If the missing item is a precondition of A5 (P3 roles, P4 backup and drill, P5 secrets) the LEAD decides on 27 Oct whether the 28 Oct sheet can start.

---

## Open questions for the LEAD

One line each: question, plan reference, **default in force** if the LEAD does not answer. (The 28 Oct sheet refers to these numbers and adds its own from Q29 on.)

| Q | Question | Plan reference | Default in force |
|---|---|---|---|
| Q1 | Do the migration role and the stage-only role get created on 26 Oct, and by whom? | P3 "Half AZ creates the roles (Perlu pengesahan)" | Not created until the LEAD says go on step 8b. The SQL here is a manual template, not a script. |
| Q2 | The API, the `migrate` job and `slot.sh` all use the bootstrap `POSTGRES_USER` (a superuser, and `deploy.sh` refuses any other user). Accept this for go-live, or ask for a separate schema-owner, API and migration role (change to `deploy.sh`, compose and `slot.sh`)? | P3 "not a superuser and not the API role", "API role never gets access to `staging_cloud`" | As shipped: one superuser role for everything; P3 is recorded as not met on 27 Oct. |
| Q3 | Should the migration role be limited to the ETL tables (list in `apps/api/prisma/migratable-models.json` plus `etl_*`) instead of all `public` tables? | P3 "read and write on the v2 tables the ETL writes and on `etl_*`" | Wide form (all tables in `public`) in step 8b. |
| Q4 | `slot.sh copy` drops and recreates `staging_cloud`/`archive_cloud` (no ACL) and runs as the bootstrap role, so the migration role's read grants and the stage-only role are not used. Who re-grants after B5, or should `slot.sh` change? | P3, 3.1 step 3 | No re-grant step exists in the night card; the stage-only role stays unused by the scripts. |
| Q5 | How do `--files-dir` and `FILE_STORAGE_DIR` reach `slot.sh etl`? (`slot.sh` mounts only the reports folder.) | P5, 3.1 gap (c), 4.6 access item (e) | Not solved: B6/B7 with `--files-dir` would fail; no file would be migrated. |
| Q6 | `slot.sh gonogo` also checks `pre_delta` and prints `MISSING ... -> NO-GO` without it. Take `pre_delta` with `pre_etl`, or change the check? | 3.1 gap (a), A5 item 2 | Take `pre_delta` at the same time as `pre_etl` (same state, no raw data). |
| Q7 | `slot.sh etl` does not accept `migrate:archive-minimise`. Half AZ adds it, or C5 runs another way? | 3.1 gap (b), C5 | Not accepted; C5 cannot run through `slot.sh` (and the command exists only in PR #123). |
| Q8 | PITR WAL retention cap while `staging_cloud` exists: cap at 7 days, or delete WAL by `pitr.sh cleanup`? | Section 7 backups row ("cap PITR retention to 7 days", Perlu pengesahan) | `pitr.sh cleanup --keep-from <post_drop base>` by 6 Nov; no 7-day cap configured. |
| Q9 | How many days do backups that contain `archive_cloud` age out after the drop? | Section 7 `archive_cloud` row (half AZ states the number of days) | The normal 35 days (`PP_BACKUP_MAX_AGE_DAYS`, bucket lifecycle 35 days). |
| Q10 | 5 Nov (7 days from 29 Oct) or 6 Nov as the cap/deletion date? | Section 7 note | 6 Nov 2026 as the outer date. |
| Q11 | Where is the Q9 export file / `question_submissions` CSV kept (the named encrypted location)? | Section 7, decision 19 | None named. Needed before C5, not for A3/A5. |
| Q12 | Switch by DNS (30 Oct) or by own address plus pointer page? | P9, 4.4, decision 8 | DNS by the LEAD on 30 Oct; the pointer page is the fallback. |
| Q13 | Which host name does the edge serve and get its certificate for while v2 is dark, and what happens to the certificate when DNS moves? The edge answers only `PP_DOMAIN` and issues by an HTTP challenge, which needs DNS at the VPS first. | P9, 4.4; production-vps.md section 16 ("or use a temporary name") | A temporary host name for 26 to 29 Oct; the DNS switch then needs a changed `PP_DOMAIN`, a new certificate and a redeploy on 30 Oct. No script covers it. |
| Q14 | Registration is to be "closed", but no env key, setting or script closes it (`POST /api/auth/register` stays open; only `THROTTLE_REGISTER_PER_MINUTE` limits it). Accept "unannounced address" as the control, or ask for a code or edge change? | A3 / P3 "registration closed" | Unannounced address only; recorded as NOT ENFORCED in the evidence block. |
| Q15 | Define "dark" (not public). Add an edge allow-list (team addresses only; not built, #166 section 10 point 3)? | P3, B10 | Dark = address not announced and not linked. |
| Q16 | ClamAV OFF: sign the uploads-gate line (step 5), and confirm PR #203 stays out of the release (if merged, OFF is impossible). | Production-vps.md sections 15, 16, 20 | OFF; the LEAD signs the dated risk-acceptance line; no setting blocks pupil or teacher uploads. |
| Q17 | Run the Admin Pusat bootstrap on 26 Oct, or rely on the migrated admins? The runbook names a "T-1 check (A10)" for two active admins; A10 no longer exists in the plan numbering. When is that check done now? | F1 (section 20); plan 4.1 | Not run on 26 Oct; the two-admin check is added to the C1 morning review of 30 Oct (LEAD to confirm). |
| Q18 | How are the four smoke accounts (student, teacher, parent, admin) created while registration is "closed" and before schools exist? | P11 | Not defined. Only the admin has a repo path (`admin:bootstrap`); see the 28 Oct sheet. |
| Q19 | Off-site inputs: bucket, endpoint, write key, GPG key pair and where its private half is kept. | Section 20 Off-site row; P4 | `s3` with bucket lifecycle 35 days, no object lock, key write-only if possible; the LEAD supplies all inputs; without them P4 is not met. |
| Q20 | Enable `pp-restore-drill.timer`? Its first run (1 Nov 03:30 MYT) stops the api for 1 to 3 minutes during hypercare. | Production-vps.md section 9; night card B10 | Installed, not enabled; B10 starts it by `systemctl start` (not persistent). |
| Q21 | `.cloud` maintenance-switch command and who gives the operator access. | P8, B1 | Not in the repo; not invented here. |
| Q22 | Operator access list (VPS for `slot.sh`, `restore-point.sh`, `pitr.sh`; shell on the migration host; per-run secret-store access; time-boxed to 07:00 on 29 Oct). | P12, 4.6 "Night access" | None granted; the list is confirmed by 17:30 on 28 Oct or the night is a no-go. |
| Q23 | `restore-point.sh` does not record the migration count. Accept the manual method (count query before and after `take`)? | A5 item 2 | Manual count before and after, recorded as text. |
| Q24 | DNS time-to-live: the plan says lower it at least 24 h before the switch; the runbook says 48 h. | P9; production-vps.md sections 4 and 16 | Lower it first thing on 28 Oct (satisfies 24 h for any switch after 09:00 on 29 Oct; 48 h only if the switch is after 09:00 on 30 Oct). |
| Q25 | How is the DNS switch rehearsed without moving real users? | P9 | On a throw-away DNS name the LEAD owns (see the 28 Oct sheet). |
| Q26 | Who places the pointer page on `.cloud`, and who approves its BM text? | 4.4 fallback | Half AM `.cloud` operator places it (per #166); the LEAD approves the text. |
| Q27 | Which channel and time does the notice to schools go out? | P10 | Sent by the dump operator on 28 Oct, text approved by the LEAD. |
| Q28 | Are the suggested times of the 28 Oct sheet acceptable? | A5 | Suggested times only; fixed times are 17:30 (access list) and 18:00 (G6). |

## Script gaps

**Re-checked against `9924a2f6` on 24 Oct (PR `[PC-5]`).** Most of the table below was written at `515e440f`, when #123, #125 and #166 were still open. They are merged: the rows marked **ON THE TIP** are no longer gaps and need no workaround. Only the rows still marked "Not found" are open.

| Named in the sheet | Where it lives |
|---|---|
| `deploy/vps/migration/slot.sh`, `restore-point.sh`, `pitr.sh` | **ON THE TIP** (was PR #166) |
| `deploy/cutover/pointer-page/render.sh` and `index.template.html` | **ON THE TIP** (was PR #166) |
| PITR settings: `PP_PG_ARCHIVE_MODE`, `PP_PG_ARCHIVE_TIMEOUT`, `PP_WAL_ARCHIVE_DIR`, `PP_STAGE_*`, `PP_MIGRATION_OUT` in `.env.prod.example`; the `archive_*` flags and `/walarchive` mount in `compose.prod.yaml`; the WAL-folder check in `deploy.sh` | **ON THE TIP** (was PR #166) |
| `PP_BACKUP_EXCLUDE_SCHEMAS` and the `schemas left out:` log text of `backup.sh` | **ON THE TIP** (was PR #166). Verified 24 Oct: a dump taken with the default `staging_cloud` holds 0 `staging_cloud` entries and keeps `archive_cloud` |
| `docs/ops/production-migration-slot.md` | **ON THE TIP** (was PR #166) |
| `npm run migrate:all`, `migrate:delta`, `migrate:verify`, `migrate:rollback`, `migrate:link-questions`, `migrate:export-question-reports`, `migrate:archive-minimise`, `migrate:questions` | **ON THE TIP** (was PR #123). All eight are in `slot.sh etl`'s allow-list |
| `npm run dump:check`, `dump:cloud`, `dump:produce`, `dump:wipe`, `dump:grants` | Only in PR #125 (still open at `9924a2f6`) — the 28/29 Oct sheets need it, this sheet does not |
| `npm run admin:bootstrap -w @pp/api` (AZ-36) | **In code on the tip.** Its runbook text (section 21) is only in PR #186; production-vps.md on the tip still says there is no command |
| `docker compose ... run ... migrate npm run admin:bootstrap` check of an installed image | Needs the `migrate` image built from the release; not run |
| Creating the P3 roles | **ON THE TIP**: `deploy/vps/db-roles.sh` (`secrets`/`apply`/`check`) and `db-roles/{apply,check}.sql`, run by `deploy.sh` steps 4 and 5. Step 8 of this sheet was rewritten for it; the old manual SQL template is gone |
| A setting or script that closes registration | **ON THE TIP**: `REGISTRATION_OPEN=false` in `api.env` (`deploy.sh` warns when it is unset, because unset means OPEN); the 30 Oct switch is runbook section 16 |
| An edge allow-list / "dark" switch | Not built (production-migration-slot.md section 10 point 3 says so) |
| A setting that blocks pupil/teacher uploads while ClamAV is off | Not found anywhere. The malware scan is PR #203 (not merged) |
| Restoring an off-site (S3) copy on a scratch host | No script; manual steps in 9e with `aws`, `gpg`, `sha256sum`, `pg_restore` |
| Migration count stored in a restore point | Not found anywhere (`restore-point.sh` records time, name, file, sha256, bytes, raw flag, WAL position, operator) |
| Giving the migration role grants on `staging_cloud`/`archive_cloud` after `slot.sh copy` | **ON THE TIP**: `slot.sh copy` runs `db-roles.sh apply` before the drop and after the restore, and `apply.sql` sets default privileges for what `pp_stager` creates. Verified 24 Oct: with both stage schemas present, `pp_etl` reads them and `pp_app` is denied |
| `--files-dir` / `FILE_STORAGE_DIR` for `slot.sh etl` | **ON THE TIP**: `--files-dir HOST_DIR` mounts the export read-only at `/files`, and with `--apply` it also mounts the api `apifiles` volume and sets `FILE_STORAGE_DIR` (cutover plan P5) |
| `migrate:archive-minimise` in `slot.sh etl` | **ON THE TIP**: in the allow-list, and it gets `PP_ALLOW_MIGRATE_APPLY=1` in every mode |
| The `.cloud` maintenance switch | Not found anywhere |
| DNS change, TTL change, uptime-checker accounts, bucket lifecycle rule | Done in the provider consoles; no repo script |

## Where the plan and the scripts disagree

1. ~~**Roles (P3).**~~ **RESOLVED on the tip** (re-checked 24 Oct, PR `[PC-5]`). `deploy/vps/db-roles.sh` creates four non-superuser roles and `deploy.sh` now requires the opposite of what this item said: `api.env`→`pp_app`, `migrate.env`→`pp_owner`, `etl.env`→`pp_etl`, each with its own password, and `POSTGRES_USER` must **not** be one of them. `slot.sh copy` runs as `pp_stager`. See step 8.
2. ~~**Stage schemas and grants.**~~ **RESOLVED on the tip.** `slot.sh copy` runs `db-roles.sh apply` before the drop and after the restore, and `apply.sql` carries default privileges for objects `pp_stager` creates, so `pp_etl`'s read access survives every copy. Dropping still needs ownership — which is why `pp_stager` creates and therefore owns the two schemas.
3. **Dark (A3, P3).** No edge allow-list or "dark" switch exists. The registration half of this item is **resolved**: `REGISTRATION_OPEN=false` in `api.env` closes self-registration (403 `REGISTRATION_CLOSED`) and the 30 Oct switch opens it.
4. **DNS switch vs the edge.** The edge serves only `PP_DOMAIN` and the first certificate needs the name to resolve to the VPS; a DNS switch of an existing public name on 30 Oct has no script for the certificate and host-name change.
5. **Runbook vs script wording.** production-vps.md section 4 step 5 says the dry run fails with `no certificate for ...`; the script prints `cannot read the certificate for <domain> ...`. Section 4 step 11 and F1/F11 say there is no bootstrap command; the code has one.
6. **F1 "T-1 check (cutover plan step A10)".** A10 is the old numbering; the current plan has no such step.
7. **TTL.** Plan P9: at least 24 h before the switch; production-vps.md sections 4 and 16: 48 h.
8. **Migration count in a restore point (A5 item 2).** The plan speaks of "the number of applied migrations in the point's database state"; `restore-point.sh` stores no such number, so the sheet compares the live count before and after `take`.
9. **PR #203.** If merged, ClamAV is always on and `PP_PROFILES=clamav` is obsolete; this contradicts the LEAD's OFF decision at go-live.
10. **PR #166 text.** Its document still uses the old step ids (A4, A12, B0 to B13) and a `pre_etl` time of 29 Oct 08:00; the plan now takes `pre_etl` on 28 Oct (A5).
