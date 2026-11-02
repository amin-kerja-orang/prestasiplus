# Run sheet: production VPS dark setup, 26 Oct 2026 (A3)

**Follow this sheet on the night.** It is the command-by-command version of [vps-dark-setup-26oct.md](vps-dark-setup-26oct.md), checked against the tip and with measured timings. The older sheet keeps the evidence table, the open questions for the LEAD and the gap lists — read it afterwards, not instead.

- **Plan:** [v2-cutover-plan.md](v2-cutover-plan.md) step **A3** (section 4.1), preconditions **P3, P4, P5**. Runbook: [production-vps.md](production-vps.md). Next sheet: [pre-night-28oct.md](pre-night-28oct.md).
- **Written against:** `feature/v2-backend` at `9924a2f6` (38 migration folders, including `0043_questions_legacy_columns` and `0044_question_draw_indexes` from QLOAD).
- **Owner:** the LEAD runs every step. Half AZ DevOps wrote the sheet and has no server access and no credentials. Every step that changes the server needs the LEAD's own go: this sheet is the order of the steps, not the permission.
- **Server:** a **newly bought** VPS — 4 vCPU, 16 GB RAM, ≥100 GB disk, Ubuntu 24.04 (22.04 acceptable if upgraded before Apr 2027). **Never the existing host that runs PIOS and the legacy database**: this sheet creates roles, drops throwaway databases and changes `archive_mode`, none of which may touch that machine. The LEAD confirms the target host before step 1.
- **Placeholders:** `<domain>` (the public host name), `<db>` (the `POSTGRES_DB` value), `<release_sha>` (pinned at A2), `<bucket>`, `<s3_profile>`. Real values stay on the server and in the LEAD's password manager. **Never paste a secret value into an issue or a PR.** The P3 role names (`pp_owner`, `pp_app`, `pp_etl`, `pp_stager`) are fixed in `deploy/vps/lib.sh` and are not secrets.

## How to read a step

Each step has **Command**, **Green** (what it must print), **Red** (what makes it a stop) and an evidence blank. A step is finished when its Green matches and the blank is filled. **Red means stop and tell the LEAD** — never edit a script on the server, never improvise SQL, never retype a `DATABASE_URL` by hand.

Two shorthands, set once per shell session:

```
cd /opt/pretasiplus
PC='docker compose -f compose.yaml -f deploy/vps/compose.prod.yaml --env-file /etc/pretasiplus/prod.env'
# pq "SQL": one read-only query in the production database, inside the db container with its own credentials.
# The SQL goes in as an argument; no password is ever typed or printed.
pq() { $PC exec -T db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -At -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"' sh "$1"; }
```

Run everything as `ppdeploy` from `/opt/pretasiplus` unless `sudo` is shown. `PC` must be run from that directory (compose resolves every relative path in both files against it).

---

## What was rehearsed, and what was not

The timings in this sheet come from a **local rehearsal on 24 Oct** in the half-AZ DevOps sandbox: a throwaway native **PostgreSQL 16.15** cluster (the same major as the `postgres:16-alpine` image) started with the production `command:` settings from `compose.prod.yaml` (`shared_buffers=512MB`, `work_mem=8MB`, `maintenance_work_mem=128MB`, `max_connections=100`, `wal_compression=on`, `log_min_duration_statement=1000`, `log_lock_waits=on`, `log_checkpoints=on`).

**Rehearsed end to end, green:**

| What | Result |
|---|---|
| `docker compose config -q` with the production overlay | renders; 5 services (`api db edge frontend migrate`); the `tls`, `clamav` and `monitoring` profiles each render too; only 80 and 443 published; no `replicas`/`scale` on `api` |
| `db-roles.sh secrets` on a fresh `/etc/pretasiplus` | writes `api.env` (`pp_app`), creates `migrate.env` (`pp_owner`) and `etl.env` (`pp_etl`), all `640 root:ppdeploy`; a second run keeps all three |
| `deploy.sh --dry-run` preflight | reproduced both the missing-`migrate.env` failure and, once `secrets` had run, the single expected certificate failure |
| All **38** migrations in order as `pp_owner` on an empty database | 38 applied, 0 unfinished, 197 public tables; `0043`/`0044` objects all present |
| `db-roles/apply.sql` twice (empty database, then post-`0044`) | idempotent, no error |
| `db-roles/check.sql` full probe set | **38/38 PASS** with no stage schemas, **44/44 PASS** with `staging_cloud` and `archive_cloud` present |
| Network logins as `pp_app`, `pp_owner`, `pp_etl` over TCP with scram | each `logged in, not a superuser`; `pp_app` `CREATE TEMP TABLE` denied; `pp_stager` refused over the network, accepted on the local socket |
| `pg_dump -Fc --no-owner --exclude-schema=staging_cloud` (the exact `backup.sh` flags) | 0 `staging_cloud` entries in the dump, `archive_cloud` kept |
| `pg_restore` into `<db>_restorecheck` and the row-count comparison | 197 public tables, 38 `_prisma_migrations` rows |
| `bash -n` on all 18 scripts in `deploy/vps`, `deploy/rehearsal`, `deploy/cutover` | no syntax error |
| `npm run be:lint:migration` | passed (121 pre-existing warnings) |

**NOT rehearsed — the first run of these is on the box.** Budget time for them and read their output carefully:

| What | Why not | What to watch |
|---|---|---|
| `docker compose up` of any service; the image build | No container registry is reachable from the sandbox (`registry-1.docker.io` answers 403 to CONNECT), so no image could be pulled or built | Step 2 below checks the egress the build needs **before** you need it |
| `prisma migrate deploy` itself | `binaries.prisma.sh` answers 403, so the Prisma schema engine could not be downloaded. The 38 `migration.sql` files were applied in order with `psql` instead (the mechanism `deploy/rehearsal/rehearsal-db.sh` uses), with the same prisma-compatible ledger rows | The SQL is proven; the Prisma **wrapper** is not. Step 7's `applied = folders` check is what proves it on the box |
| The reference seed (`deploy.sh --seed-reference`) | Needs the generated Prisma Client, which needs the same blocked engines | Step 8. Its output must list only reference modules and `demo modules skipped` |
| `backup.sh`, `restore-drill.sh`, `offsite.sh` as scripts | They `docker exec` into the `db` container. The `pg_dump`/`pg_restore` work they do was rehearsed directly; the wrappers were not | Step 10 |
| nginx, TLS, certbot, the edge health checks, Uptime Kuma | No images | Steps 5 and 6 |

---

## Step 1. The checkout is the release

**Command**

```
cd /opt/pretasiplus
git rev-parse HEAD
git status --porcelain --untracked-files=no | wc -l
ls -d apps/api/prisma/migrations/*/ | wc -l
ls deploy/vps/db-roles.sh deploy/vps/db-roles/apply.sql deploy/vps/db-roles/check.sql
ls deploy/vps/migration/slot.sh deploy/vps/migration/restore-point.sh deploy/vps/migration/pitr.sh
grep -c '"migrate:questions"' apps/api/package.json
grep -c '"admin:bootstrap"' apps/api/package.json
grep -c 'MALWARE_SCAN' deploy/vps/compose.prod.yaml
```

**Green**

- `git rev-parse HEAD` is exactly `<release_sha>` from A2.
- The dirty-file count is `0` (`deploy.sh` refuses a dirty tree).
- The migration folder count is the release's. **Write it down: N = ____** (it is **38** at `9924a2f6`; a newer release pins a higher number — the number is never the check, step 7 is).
- Both `ls` lines list every file with no `No such file`.
- `migrate:questions` → `1`, `admin:bootstrap` → `1`, `MALWARE_SCAN` → `0`.

**Red** — any `No such file`; a sha that is not the A2 sha; a non-zero dirty count; `migrate:questions` or `admin:bootstrap` at `0`; `MALWARE_SCAN` not `0` (PR #203 would force ClamAV on against the LEAD's OFF decision).

Timing: seconds. Evidence: sha ____ , N = ____

---

## Step 2. Host prerequisites **and the egress the build needs**

The second command block is the one addition to the old sheet, and it is the one most likely to cost the night: the `api`/`migrate` images are **built on the VPS** (`PP_BUILD_MODE=local`), and that build downloads from the npm registry, the Prisma engine host and the container registry. A firewall that allows only 22/80/443 **inbound** is correct; an egress rule that blocks these hosts breaks step 4 with a confusing error.

**Command**

```
docker compose version --short
timedatectl | grep 'Time zone'
sudo ufw status verbose
node --version
for c in docker git curl openssl flock sha256sum node aws gpg; do printf '%s: ' "$c"; command -v "$c" || echo MISSING; done
df -h / /var/backups/pretasiplus
free -g | head -2
nproc
```

```
# Egress the image build needs. Each must answer a status, not hang.
for h in https://registry.npmjs.org/ https://binaries.prisma.sh/ https://registry-1.docker.io/v2/ https://auth.docker.io/token https://production.cloudflare.docker.com/; do
  printf '%-45s ' "$h"; curl -s -o /dev/null -w '%{http_code}\n' --max-time 15 "$h" || echo UNREACHABLE
done
```

**Green**

- Compose `2.24` or newer (the overlay uses `!reset` and `!override`; the rehearsal ran on 5.6.1).
- `Time zone: Asia/Kuala_Lumpur`. Node `v22.x`. No tool says `MISSING`.
- ufw active, inbound only 22 (limit), 80, 443.
- `nproc` ≥ 4; `free -g` shows ~16 GB; `/` has ≥ 100 GB with at least 40 GB free (the build cache and images alone take a few GB).
- Every egress line prints a numeric status (`200`, `401` and `404` are all fine — they mean the host answered). `registry-1.docker.io/v2/` answering `401` is normal.

**Red** — any `MISSING`; compose below 2.24; any egress line printing `000` or `UNREACHABLE`, which means the build in step 4 will fail: tell the LEAD and get the egress opened before going on. The LEAD must also confirm **in writing** that the VPS disk or at least the backup volume is encrypted (no encryption ⇒ no backups on this host).

Timing: seconds. Evidence: compose ____ , node ____ , nproc ____ , RAM ____ , egress all answered: ____ , disk encrypted (LEAD): ____

---

## Step 3. Folders, env files and the P3 secrets

**Command**

```
sudo install -d -m 750 -o root -g ppdeploy /etc/pretasiplus
sudo install -d -o ppdeploy -g ppdeploy -m 700 /var/backups/pretasiplus /var/lib/pretasiplus-deploy /var/log/pretasiplus \
  /srv/pretasiplus/letsencrypt /srv/pretasiplus/letsencrypt-log /srv/pretasiplus/certbot-webroot
# PITR: the archive folder must be owned by uid 70 (postgres inside the image) BEFORE the db first starts,
# or Docker creates it root-owned and every archive_command fails silently while WAL piles up in pgdata.
sudo install -d -o 70 -g 70 -m 700 /var/backups/pretasiplus/wal /var/backups/pretasiplus/wal/wal /var/backups/pretasiplus/wal/base
sudo install -d -o ppdeploy -g ppdeploy -m 700 /srv/pretasiplus/stage
sudo install -d -o 1000 -g 1000 -m 700 /srv/pretasiplus/migration-out

sudo install -m 640 -o root -g ppdeploy deploy/vps/.env.prod.example /etc/pretasiplus/prod.env
sudo install -m 640 -o root -g ppdeploy deploy/vps/api.env.example    /etc/pretasiplus/api.env
sudo install -m 640 -o root -g ppdeploy deploy/vps/db.env.example     /etc/pretasiplus/db.env
sudoedit /etc/pretasiplus/prod.env
sudoedit /etc/pretasiplus/api.env
sudoedit /etc/pretasiplus/db.env
```

In `prod.env` set at least `PP_DOMAIN`, `PP_LETSENCRYPT_EMAIL`, `PP_PG_ARCHIVE_MODE=on`, `PP_PROFILES=` (empty or `monitoring`, **never** `clamav`), `PP_JOBS_WORKER_ENABLED=true`. Keep the shipped resource limits: they are the N=300 row of runbook section 13 (an assumption until a k6 run replaces it) and leave most of a 16 GB box to the page cache, which suits Postgres.

In `api.env` the values that must be real: `SESSION_SECRET` and `IC_HASH_KEY` (each `openssl rand -hex 32`, **different from each other**), `MARKETPLACE_PLATFORM_WHATSAPP` (the real wa.me digits, not `60000000000`), `REGISTRATION_OPEN=false`, `THROTTLE_GLOBAL_PER_MINUTE=3000`. **Leave `DATABASE_URL` alone** — the next command rewrites it.

> `IC_HASH_KEY` is never rotated: a different key invalidates every stored IC hash. The LEAD keeps a copy off the server, with `SESSION_SECRET`. A restore without both is not a full restore.

**Then the P3 role credentials. Do not type a `DATABASE_URL` by hand:**

```
sudo deploy/vps/db-roles.sh secrets
```

**Green**

```
[db-roles] api.env: DATABASE_URL for pp_app written (new password)
[db-roles] migrate.env: DATABASE_URL for pp_owner written (created)
[db-roles] etl.env: DATABASE_URL for pp_etl written (created)
[db-roles] next: deploy/vps/db-roles.sh apply (as the deploy user; deploy.sh also runs it), then recreate the api if its password changed
```

Verify, names only:

```
stat -c '%a %U:%G %n' /etc/pretasiplus/*.env
for f in api.env migrate.env etl.env; do printf '%-12s ' "$f"; sudo sed -n 's|^DATABASE_URL=postgresql://\([a-z_]*\):.*|\1|p' /etc/pretasiplus/$f; done
stat -c '%u %a %n' /var/backups/pretasiplus/wal
```

- `stat` prints **five** files, every one `640 root:ppdeploy`.
- The three roles print `pp_app`, `pp_owner`, `pp_etl` in that order.
- The WAL folder prints `70 700`.

**Red** — fewer than five env files; any other mode or owner; a `DATABASE_URL` user that is not the role above; the WAL folder not `70 700`. Re-running `secrets` is safe (it prints `kept` three times and changes nothing), so a missing file is always fixable here.

Timing (rehearsed): `secrets` **under 1 s**. The `sudoedit` work is the LEAD's typing time. Evidence: five files 640 root:ppdeploy ____ , roles ____ , WAL folder ____

---

## Step 4. Dry run, then TLS, then dry run again

### 4a. Dry run

```
deploy/vps/deploy.sh --dry-run
```

**Green** — exactly **one** failure, the certificate, plus two allowed warnings (this was reproduced in the rehearsal):

```
---- 1/9 preflight (tag <sha12>, domain <domain>, env dir /etc/pretasiplus) ----
WARN: PP_OFFSITE_KIND=none: backups stay on this server only
WARN: PP_HEALTHCHECK_PING_URL is empty: a silent backup failure would not be noticed
PREFLIGHT FAILED: cannot read the certificate for <domain> (missing, or live/ is root-only and the edge container is not running): run deploy/vps/tls/init-cert.sh first (runbook section 6)
ERROR: preflight found 1 problem(s); nothing was changed
```

The two warnings clear in steps 10 and 11. The tag is the first 12 characters of `<release_sha>`.

**Red** — any other `PREFLIGHT FAILED` line. The message always names the key, never the value. The three you are most likely to see, and the fix:

| Line | Fix |
|---|---|
| `env file missing or unreadable: /etc/pretasiplus/migrate.env (create it with: sudo deploy/vps/db-roles.sh secrets)` — and the same for `etl.env` | step 3's `secrets` was skipped. Run it, dry-run again. **Not a no-go.** The preflight stops before the certificate check, so you will see 2 problems and no certificate line |
| `placeholder value for <KEY> in <file>` | an example value is still in place: `sudoedit` that file |
| `DATABASE_URL user in <file> must be <role> …` or `… password in <file> must differ from POSTGRES_PASSWORD` | a `DATABASE_URL` was typed by hand. `sudo deploy/vps/db-roles.sh secrets --rotate app,owner,etl` |
| `PP_WAL_ARCHIVE_DIR … must exist, owned by uid 70 with mode 700` | run the `install -d -o 70` line of step 3 |

Timing: seconds. Evidence: failures ____ , warnings ____

### 4b. The certificate

Precondition (LEAD): the DNS **A** record of `<domain>` points at the VPS and **no AAAA record** exists (the edge publishes IPv4 only).

```
sudo deploy/vps/tls/init-cert.sh --dry-run     # Let's Encrypt staging first
sudo deploy/vps/tls/init-cert.sh               # the real certificate
```

**Green** — the dry run reaches the Let's Encrypt staging servers and succeeds; the real run writes `live/<domain>/fullchain.pem`. Then:

```
deploy/vps/deploy.sh --dry-run
```

now prints **no** `PREFLIGHT FAILED` line at all and ends with `preflight passed`, keeping the two allowed warnings.

**Red** — the dry run fails on the HTTP-01 challenge (DNS not pointing here yet, or port 80 blocked); the preflight then reports the certificate as self-signed, expired, or from the **staging** servers (that last one is a warning, not a failure, but browsers will warn — do not go live on it).

**Not rehearsed.** Record the real duration.

Timing: not measured (first run on the box). Evidence: dry-run ____ , real certificate ____ , preflight passed ____

---

## Step 5. The deploy (dark)

This builds the images, starts the database, applies the roles, migrates, starts the api, the frontend and the edge, and checks health through the edge. It is **nine steps inside one script**; read each `---- k/9 ----` line as it goes by.

```
deploy/vps/deploy.sh
```

It asks you to type `<domain>` to confirm. Nothing after step 1 runs until you do.

**Green, step by step**

| Script step | What it must print |
|---|---|
| `1/9 preflight` | `preflight passed` |
| `2/9 pre-deploy backup` | `db is not running: first install, nothing to back up` (this is the first install) |
| `3/9 images` | the build finishes with no error. **Longest step of the night; not measured here.** Watch for an npm or Prisma download failure — that is step 2's egress |
| `4/9 database and least-privilege roles` | the `db` container reaches healthy, then `db-roles.sh apply` runs with no error |
| `5/9 migrate …, then the roles again and the role check` | `prisma migrate deploy` applies **N** migrations, then `apply`, then `DB ROLES CHECK PASSED: <n> probes` with **no `FAIL` line** |
| `6/9 api and frontend` | both reach healthy |
| `7/9 edge` | recreated, reaches healthy |
| `8/9 health checks through the edge` | every check passes: `/api/health` 200, `/api/ready` 200, `/` 200, `/api/metrics` **404**, `http://…` 301 |
| `9/9 record the release` | `deploy complete: <sha12>` |

**Red** — any `DEPLOY FAILED at: …` line. The script prints the way back itself; follow that text, do not improvise. Two rules: **the schema is forward-only** (never restore the pre-deploy dump without the LEAD's explicit confirmation), and a `FAIL` from the role check at step 5/9 stops the deploy *before* the api switches, which is the intended behaviour — fix it with `db-roles.sh apply` and re-run the deploy, never with hand-written GRANTs.

Timing: the SQL parts are fast — in the rehearsal, all 38 migrations on an empty database took **4 s** (slowest single migration `0014_practice_write`, 1 s), `db-roles.sh apply` **about 1 s** each time and the role check **under 1 s**. The image build and the health-check waits are the real cost and were **not** measured. Expect the whole run to be dominated by step 3/9.

Evidence: confirmed at ____ , finished at ____ , build duration ____ , `deploy complete` sha ____

---

## Step 6. After the deploy: ports, schema, roles

### 6a. Only 80 and 443 are published

```
$PC ps
sudo ss -ltnp | grep -E ':(80|443|3000|5432|8080|3001)\b'
```

**Green** — `api`, `db`, `frontend` and `edge` are `running (healthy)`; `ss` shows a listener on 80 and 443 only (Kuma, if the `monitoring` profile is on, binds `127.0.0.1:3001` and that is fine). **Red** — anything listening on `0.0.0.0:3000`, `:5432` or `:8080`.

Evidence: ____

### 6b. Schema at the tip (P3, last part)

```
pq "select count(*) from _prisma_migrations where finished_at is not null and rolled_back_at is null"
ls -d apps/api/prisma/migrations/*/ | wc -l
pq "select count(*) from _prisma_migrations where finished_at is null"
pq "select count(*) from information_schema.tables where table_schema = 'public'"
curl -s -o /dev/null -w '%{http_code}\n' https://<domain>/api/ready
```

**Green** — the first two numbers are **equal** (= N from step 1); the third is `0`; the table count is **197** at `9924a2f6`; `/api/ready` is `200` (its body says `"migrations":"applied"`, which is `ready` only when every shipped migration is applied and none failed).

**Red** — the counts differ, the unfinished count is not `0`, or `/api/ready` is not 200. A `503` means the database or a migration: do **not** restart-loop the api; read `$PC logs migrate` and tell the LEAD. Note too: **a migration merged after today means this check and the 28 Oct restore points are redone** (plan A5).

Timing: seconds. Evidence: applied ____ , folders ____ , unfinished ____ , public tables ____ , ready ____

### 6c. The P3 role evidence

`deploy.sh` already applied and checked the roles at steps 4/9 and 5/9. Re-run the check so you have its output as the P3 evidence:

```
deploy/vps/db-roles.sh check
```

**Green** — every line starts `PASS`, and the last line is `DB ROLES CHECK PASSED: <n> probes`. Before any `slot.sh copy` (no stage schemas) that is **44** probes: 38 SQL probes plus 3 network logins, the `pp_app` TEMP refusal, the `pp_stager` network refusal and the `pp_stager` socket login. The count is not the check — **no `FAIL` and exit 0** is.

Also confirm the ownership is clean:

```
pq "select tableowner, count(*) from pg_tables where schemaname = 'public' group by 1"
pq "select count(*) from information_schema.schemata where schema_name in ('staging_cloud','archive_cloud')"
```

**Green** — one line only, `pp_owner | 197`; and `0` stage schemas. Do **not** pre-create the stage schemas: `restore-point.sh take pre_etl` refuses when `staging_cloud` exists.

**Red** — any `FAIL`; a second owner in `public`; a stage schema already present. Fix is always `db-roles.sh apply` then `check` again; if a `FAIL` survives one `apply`, stop and tell the LEAD — do not continue to the 28 Oct sheet.

Timing (rehearsed): the SQL probe set runs in **under 1 s**; the login probes add a second or two. Evidence: probes ____ , FAIL ____ , public owner ____ , stage schemas ____

---

## Step 7. Single API instance (runbook section 14)

The API keeps its rate-limit counters in process memory, so there must be exactly one `api` container, and that one container is the jobs worker.

```
$PC ps -q api | wc -l
$PC config | awk '/^[A-Za-z]/{a=0} /^  [A-Za-z0-9_-]+:/{a=($1=="api:")} a&&($1=="replicas:"||$1=="scale:"){print}'
grep -n '^PP_JOBS_WORKER_ENABLED' /etc/pretasiplus/prod.env
```

**Green** — `1`; the `awk` prints nothing (verified in the rehearsal against the rendered overlay); `PP_JOBS_WORKER_ENABLED=true`. **Red** — any other count, any `replicas`/`scale` line, or the flag not `true`. Never run `up --scale api=N`.

Evidence: ____

---

## Step 8. Reference seed, once

Reference data (the `school_packages` catalogue and the SPM subject configs) is **not** part of a deploy. Load it once, explicitly.

```
deploy/vps/deploy.sh --seed-reference
```

It asks you to type `<domain>` to confirm, as in step 5, and the prompt says `(reference seed only)`.

**Green** — the output lists only **reference** modules and says `demo modules skipped`, then `reference seed finished`. The job runs with `ALLOW_DEMO_SEED=false` and `BIJAK_POC_QUESTIONS=false` forced by the overlay, so a demo module cannot load even if an env file asked for it.

**Red** — any demo module in the output (stop at once and tell the LEAD), or a non-zero exit. **Not rehearsed** (the Prisma Client could not be generated in the sandbox), so read the module list carefully and record the duration.

Timing: not measured. Evidence: reference modules ____ , demo skipped ____ , duration ____

---

## Step 9. Admin Pusat bootstrap (AZ-36)

Without this there is nobody in production who can publish papers. Two things make this step easy to get wrong, so read the whole step before running anything.

**The image tag.** `deploy.sh` builds and runs the images tagged with the 12-character release sha and exports `PP_IMAGE_TAG` only inside its own process. The `$PC` shorthand does not, and `prod.env` ships `PP_IMAGE_TAG=prod`, so a bare `$PC run … migrate` would ask for `pretasiplus-api-migrate:prod` — an image the deploy never built. Take the tag from the state file the deploy wrote:

```
TAG="$(cat /var/lib/pretasiplus-deploy/current.tag)"; echo "release tag: $TAG"
```

**The password is never an argument.** The CLI refuses any `--password…` flag and any positional argument before it does anything else. It reads the password from a hidden prompt (typed twice) or, with `--password-stdin`, from standard input. `--mode`, `--email` and `--confirm` are all required and `--confirm` must repeat `--email` exactly; without them the CLI exits **2** with its usage text and creates nothing.

### 9a. The hidden prompt (preferred)

`run --rm` without `-T` keeps a terminal, which the prompt needs.

```
PP_IMAGE_TAG="$TAG" $PC run --rm --no-deps migrate \
  npm run admin:bootstrap -w @pp/api -- \
  --mode=create --email=<admin e-mail> --confirm=<the same e-mail> --name="Admin Pusat"
```

It asks `New password (hidden): ` and then `Repeat the new password: `. The password must be 12 to 255 characters, one line, no leading or trailing space, and must not contain the name part of the e-mail address.

### 9b. Or from a file (when there is no terminal, e.g. over a non-interactive SSH)

The file must belong to `ppdeploy`, not to root: the `<` redirect is done by your shell, so `sudo` on the compose command would not help it read a root-only file.

```
umask 077
install -m 600 /dev/null ~/pp-admin-pass
IFS= read -rsp 'New password (not echoed): ' PW && printf '%s\n' "$PW" > ~/pp-admin-pass && unset PW && echo
PP_IMAGE_TAG="$TAG" $PC run --rm -T --no-deps migrate \
  npm run admin:bootstrap -w @pp/api -- \
  --mode=create --email=<admin e-mail> --confirm=<the same e-mail> --password-stdin < ~/pp-admin-pass
shred -u ~/pp-admin-pass
```

The file holds the password on **one** line; exactly one trailing newline is stripped, a second line is refused. Delete it in the same sitting — the `shred` above is part of the step, not an afterthought. `--password-stdin` refuses to run when standard input is a terminal, and the hidden prompt refuses to run when it is not, so 9a and 9b are not interchangeable.

**Green** — exit **0**, the run reports the account created, one `audit_events` row was written (`admin.bootstrap.created`, actor role `host_cli`), and the LEAD can sign in at `https://<domain>`. The account is created with `must_reset_password`, so **the first login asks for a new password** — that is expected, not a fault.

**Red** — by exit code:

| Exit | Meaning | What to do |
|---|---|---|
| **2** | usage: a missing or wrong `--mode` / `--email` / `--confirm`, a password passed as an argument, an unknown flag, or the wrong stdin form for the chosen password input | re-read 9a/9b and run again; nothing was written |
| **3** | refused by the database state: `--mode=create` while an active, unsuspended Admin Pusat already exists | **do not force it.** If an admin already exists the step is done; a locked-out *last* admin is `--mode=reset`, which is the LEAD's decision, not this sheet's |
| **1** | the run failed | read the output and tell the LEAD; nothing is half-written (it is one transaction under the same advisory lock as the last-admin guard) |

Also red: `Unable to find image 'pretasiplus-api-migrate:prod'` or compose starting a rebuild — `PP_IMAGE_TAG` was not set from `current.tag`.

> `must_reset_password` is set by the version on the tip. PR #268 (`admin:bootstrap no longer sets must_reset_password`) was still open at `9924a2f6`; if it has merged into the release, the first login will not ask.

Evidence: tag ____ , exit ____ , audit row ____ , sign-in ____

---

## Step 10. Backups, the exclusion rule and the restore drill (P4)

### 10a. First backup

```
deploy/vps/backup/backup.sh --tag daily
```

**Green** — `dump ok: <name>  <size> bytes  sha256 <hash>  (<n> tables with data; schemas left out: staging_cloud)`, and the three machine lines `BACKUP_FILE=`, `BACKUP_SHA256=`, `BACKUP_SIZE=`. The `schemas left out: staging_cloud` part is the P4 exclusion rule, and it was verified in the rehearsal: a dump taken with those exact flags holds **0** `staging_cloud` entries and keeps `archive_cloud`.

Check it yourself:

```
$PC exec -T db pg_restore --list < "$(ls -t /var/backups/pretasiplus/pp-backup-*.dump | head -1)" | grep -c staging_cloud
```

(The host has no PostgreSQL client tools; `pg_restore` runs inside the `db` container, as `backup.sh` does.)

**Green** — `0`. **Red** — anything above `0`: raw `.cloud` data would be leaving in a routine dump. Stop and tell the LEAD.

Timing (rehearsed, schema only, no rows): `pg_dump -Fc --no-owner --exclude-schema=staging_cloud` in **1 s**, producing a **871 KB** dump with 198 table-data entries. On the production box tonight the database is nearly empty too, so expect the same order. It grows with the data.

Evidence: file ____ , sha256 ____ , size ____ , staging_cloud entries ____

### 10b. The restore drill (BE-33 AC7 evidence)

**This stops the api** for the duration — users would see an error page, which is why it belongs in the dark window.

```
deploy/vps/backup/restore-drill.sh --operator "<name or role>"
```

**Green** — the evidence block `PP-RESTORE-DRILL-EVIDENCE v1` with `result: PASS`, `row_count_comparison: PASS (… 0 mismatches)`, `writers_quiesced: api stopped for the duration of the drill`, and `prisma_migrations_rows` **equal to N from step 1** (38 at `9924a2f6` — in the rehearsal the restored copy held 197 public tables and 38 ledger rows). The script starts the api again itself; confirm `/api/ready` is 200 afterwards.

**Red** — `result: FAIL`, any mismatch count above `0`, a `prisma_migrations_rows` that is not N, or an api that did not come back (`$PC start api` by hand, then tell the LEAD).

Timing (rehearsed, the restore part only): `pg_restore` into the throwaway database **2 s**, dropping it under 1 s. The full script also takes a fresh dump and stops and starts the api, so expect **one to three minutes** on an empty database.

Evidence: result ____ , time ____ , prisma_migrations_rows ____

### 10c. Off-site and the timers

Set `PP_OFFSITE_KIND=s3`, `PP_OFFSITE_S3_URI`, the `gpg` **public** key in `PP_BACKUP_GPG_RECIPIENT` (and `PP_BACKUP_GPG_FPR`) in `prod.env` — the **private** key stays off the server with the LEAD. Then install the units:

```
sudo install -m 644 deploy/vps/systemd/pp-*.service deploy/vps/systemd/pp-*.timer /etc/systemd/system/
sudo install -m 644 deploy/vps/systemd/pretasiplus.tmpfiles.conf /etc/tmpfiles.d/
sudo install -m 644 deploy/vps/logrotate/pretasiplus /etc/logrotate.d/
sudo systemd-tmpfiles --create
sudo systemctl daemon-reload
sudo systemctl enable --now pp-backup.timer pp-cert-renew.timer pp-health-probe.timer
# pp-restore-drill.timer (1st of the month, 03:30) would fire on 1 Nov 03:30, inside the cutover window, and it stops the
# api: enable it only after the 1 Nov switch:  sudo systemctl enable --now pp-restore-drill.timer
systemctl list-timers 'pp-*'
```

**Green** — three timers listed with a next run (four once `pp-restore-drill.timer` is enabled after 1 Nov). After this, `deploy/vps/deploy.sh --dry-run` no longer warns about `PP_OFFSITE_KIND` once `prod.env` says `s3`. **Red** — a timer that fails to enable, or `off-site copies are enabled but PP_BACKUP_GPG_RECIPIENT is empty` from the next dry run.

Evidence: timers ____ , off-site first copy ____

---

## Step 11. PITR base and monitoring

```
pq "show archive_mode"
pq "select last_archived_wal, last_archived_time, failed_count from pg_stat_archiver"
deploy/vps/migration/pitr.sh base
```

**Green** — `archive_mode` is `on`; `failed_count` is `0` and `last_archived_wal` is a real segment name; the base backup finishes. **Red** — `archive_mode` `off` (PITR is a go/no-go criterion for the migration night), or `failed_count` above `0` (almost always the uid-70 ownership of `PP_WAL_ARCHIVE_DIR` from step 3).

Then set `PP_HEALTHCHECK_PING_URL`, `PP_HEALTHCHECK_PROBE_URL` and `PP_ALERT_WEBHOOK_URL` in `prod.env` and prove the probe and an alert both arrive:

```
deploy/vps/monitoring/health-probe.sh
```

**Green** — the probe reports every check healthy and the configured ping URL receives it. The last dry-run warning (`PP_HEALTHCHECK_PING_URL is empty`) is now gone.

Evidence: archive_mode ____ , failed_count ____ , base backup ____ , probe ____ , alert received ____

---

## Step 12. Final A3 evidence block

Fill this in and paste it on **#109** (the cutover issue). Names, counts and times only — **never a secret value, and never a host name or address in a public issue**.

```
A3 PRODUCTION VPS DARK SETUP — 26 Oct 2026
release sha                : <release_sha>
migration folders (N)      : ____
applied migrations         : ____    unfinished: ____
public tables              : ____    public owner: ____
env files (640 root:ppdeploy): ____ of 5      DATABASE_URL roles: pp_app / pp_owner / pp_etl  ____
db-roles check             : ____ probes, ____ FAIL, exit ____
api instances              : ____    PP_JOBS_WORKER_ENABLED: ____
ports published            : ____
certificate                : issuer ____ expires ____
/api/health ____  /api/ready ____  / ____  /api/metrics ____ (expect 404)  http->https ____
reference seed             : reference modules only ____ , demo skipped ____
admin:bootstrap            : ____
backup                     : file ____ sha256 ____ size ____ ; staging_cloud entries in dump: ____
restore drill              : result ____ at ____ , prisma_migrations_rows ____
off-site                   : kind ____ , first copy ____ , gpg recipient set ____
PITR                       : archive_mode ____ , failed_count ____ , base backup ____
timers                     : ____ of 4 enabled
monitoring                 : probe ____ , test alert received ____
image build duration       : ____        total wall time: ____
open items for 27 Oct      : ____
```

---

## Notes for the UAT-mode plan of 26 Oct evening (A3 pack)

The LEAD's plan of 26 Oct evening runs the whole v2 system on this VPS in UAT mode from tonight, with fixes redeployed until the 31 Oct cutover. The A3 pack (`a3-*.sh`, kept outside the repo because it names no host and is copied to the server by the LEAD) automates this sheet. Four points it handles that this sheet does not:

1. **Two release trees.** The release pins a backend commit (`feature/v2-backend`) and a frontend commit (`be/integration-frontend`). `deploy.sh` builds all three images from one checkout, so it would ship the backend tree's SPA. The pack builds the frontend image from a second worktree at the frontend pin (same build arguments as `compose.prod.yaml`), re-tags it with the release tag and recreates `frontend`. **After any plain `deploy.sh` run this has to be repeated**, or the backend-tree SPA is served.
2. **The "clean" restore point.** `restore-point.sh` accepts only `pre_etl`, `pre_delta`, `post_switch` and `post_drop`. Until the LEAD decides otherwise, the clean point the cutover restores before the final migration is `pre_etl` (with `pre_delta`, the same state), taken after the smoke accounts exist and before any `.cloud` data, verified with `--expect-migrations repo`. A schema migration deployed later makes it stale: take it again.
3. **Roster hashes in `etl.env`** are written single-quoted (production-migration-slot.md, `etl` notes).
4. **`pp-restore-drill.timer`** stays disabled until after the 1 Nov switch (step 10c).

## If something goes wrong

1. **Stop at the first Red.** Nothing in this sheet needs to be finished tonight except the deploy itself; the 27 Oct rehearsal (A4) and the 28 Oct go/no-go are where gaps get closed.
2. **Never edit a script or a SQL file on the server.** If a script is wrong, the fix is a PR on half AZ's branch, not a live edit — a live edit also makes the tree dirty, which `deploy.sh` then refuses.
3. **Never hand-write a `DATABASE_URL` or a GRANT.** `db-roles.sh secrets` and `db-roles.sh apply` are the only correct way; both are idempotent.
4. **The schema is forward-only.** A failed migrate does not get rolled back by restoring a dump unless the LEAD says so explicitly (runbook section 8).
5. **Do not restart-loop a container.** Read `$PC logs --since 10m <service>` first.
6. If the deploy fails after step 5/9, `deploy.sh` prints the exact `rollback.sh` command for the situation it is in. Use that text, not your own judgement about which release is running.
