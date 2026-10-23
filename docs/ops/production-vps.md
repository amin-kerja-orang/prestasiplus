# Production on the owner's VPS (AZ-09)

One VPS, Docker Compose, TLS by Let's Encrypt. Everything is VPS-agnostic: sizes, limits and the domain are
parameters. This is the production counterpart of the staging path in [deploy-staging.md](deploy-staging.md); it reuses
`compose.yaml`, the two Dockerfiles, `scripts/db-backup.mjs` / `scripts/db-restore-check.mjs` and the API runbook
([api-runbook.md](api-runbook.md)), and adds an overlay and scripts in `deploy/vps/`.

**Conventions.** `LEAD:` marks something only the LEAD can supply or decide (VPS specs, domain, DNS, secrets,
accounts, off-site target). Nothing in the repo contains a secret; real values live in `/etc/pretasiplus/*.env` on the
server (section 3). Every action on the production server (deploy, rollback, restore, certificate issue, secret change,
seed) needs the LEAD's explicit confirmation first; the scripts ask for it (type the domain).

Contents: 1 Design | 2 Server prerequisites | 3 Parameters | 4 First install | 5 Edge nginx | 6 TLS | 7 Deploy |
8 Rollback | 9 Backups and restore drill | 10 Monitoring and alerts | 11 Logs | 12 Secrets | 13 Sizing and load test |
14 Single-instance rule | 15 ClamAV | 16 Cutover 30 Oct (AZ side) | 17 Findings for the developer roles |
18 Not rehearsed here | 19 Troubleshooting | 20 Defaults applied on 22 Oct (LEAD may veto)

---

## 1. Design

```
Internet --80/443--> edge (nginx:1.27-alpine, TLS, Let's Encrypt certificate)
                       |-- /api/*            --> api:3000       (ONE container, see section 14)
                       |-- everything else   --> frontend:8080  (the SPA image: static files, no host port)
                       '-- /api/metrics      --> 404 (never leaves the host)
api --> db:5432 (postgres:16-alpine, volume pgdata, no host port)
profiles: clamav (clamd :3310), monitoring (Uptime Kuma on 127.0.0.1:3001), tls (certbot, on demand)
```

Files:

| File | Purpose |
|---|---|
| `deploy/vps/compose.prod.yaml` | Overlay over `compose.yaml` (services, limits, restart, health, logging, profiles) |
| `deploy/vps/.env.prod.example`, `api.env.example`, `db.env.example` | Names with placeholders: copy to `/etc/pretasiplus/{prod,api,db}.env` |
| `deploy/vps/nginx/` | Edge config template, snippets, `check.sh` (syntax) and `test-routing.sh` (behaviour, with stub upstreams) |
| `deploy/vps/deploy.sh`, `rollback.sh`, `lib.sh` | Migrate-then-deploy with `--dry-run`, image rollback |
| `deploy/vps/tls/` | `init-cert.sh` (first certificate), `renew.sh` |
| `deploy/vps/backup/` | `backup.sh`, `offsite.sh`, `restore-drill.sh` |
| `deploy/vps/monitoring/` | `health-probe.sh`, `alert.sh` |
| `deploy/vps/systemd/` | Timers and services for backup, drill, probe, certificate renewal, plus `cron.pretasiplus` as the alternative |
| `deploy/vps/logrotate/pretasiplus` | Host log rotation |
| `deploy/vps/loadtest/` | k6 script and guide |

Decisions and why:

1. **Overlay, not a standalone file.** `docker compose -f compose.yaml -f deploy/vps/compose.prod.yaml --env-file /etc/pretasiplus/prod.env ...`,
   always run from the repo root: Compose resolves every relative path of both files against the directory of the
   FIRST `-f` file (the repo root), so the overlay's `./deploy/vps/nginx/...` mounts and the build contexts resolve.
   The base file keeps the build definitions and the hardening (`read_only`, `cap_drop`, `no-new-privileges`); the overlay
   changes only what production needs. The scripts build this command line; type it by hand only when debugging.
   Needs Compose 2.24 or newer (`!reset`, `!override`).
2. **A separate edge nginx, not the frontend nginx.** The frontend image is a static-file server whose `/api/` block caps
   bodies at 3 MB (22 MB on `/api/files`); the production API also has many-file multipart routes up to ~220 MB (section 5).
   A separate edge owns TLS, ACME, the upload tiers, `/api/metrics` and the CSP, and talks to `api` directly, so the
   frontend container stays unchanged and has no published port. The frontend's own `/api/` block is simply unused.
3. **Proxy chain and `TRUST_PROXY_HOPS`.** Exactly one proxy (the edge) sits in front of the API, so the overlay forces
   `TRUST_PROXY_HOPS=1`, and the edge OVERWRITES `X-Forwarded-For` with the peer address it saw (a client-sent header
   never reaches the API; `deploy/vps/nginx/test-routing.sh` proves it). If a CDN or load balancer is ever put in front
   of the edge: add the realip module at the edge, and re-derive the number (the per-client throttles depend on it:
   too high lets a client choose its address, too low makes everyone one address).
4. **Fail-closed seed flags.** The overlay forces `ALLOW_DEMO_SEED=false` and `BIJAK_POC_QUESTIONS=false` in the
   `environment:` of `api` and `migrate`, which wins over `api.env`. The `migrate` job runs `prisma migrate deploy`
   only. `deploy.sh` also refuses to run if any env file or the shell sets either flag to `true`/`1` (the values the API's
   `env.schema.ts` accepts), or `MAIL_LOG_RESET_LINKS=true`.
5. **Images** are built on the VPS from the checked-out release commit and tagged with the git sha
   (`pretasiplus-api:<sha12>`, `pretasiplus-frontend:<sha12>`, `pretasiplus-api-migrate:<sha12>`), or pulled from a registry
   (`PP_BUILD_MODE=pull`, `PP_IMAGE_PREFIX`). Old images are never pruned by the scripts, which is what makes rollback quick.
6. **Healthchecks, restart, stop grace, limits, log rotation** are on every long-running service: `restart: unless-stopped`;
   `stop_grace_period` 35 s for `api` (above `SHUTDOWN_GRACE_MS=25000`), 60 s for `db`; `deploy.resources.limits` from
   `PP_*_CPUS` / `PP_*_MEM`; Docker `json-file` logs capped at 5 x 20 MB per container (`PP_LOG_MAX_FILE`, `PP_LOG_MAX_SIZE`).

---

## 2. Server prerequisites

`LEAD:` provide the VPS (specs: section 13), the domain and DNS control, and root/sudo access for the operator.

- **OS:** Ubuntu Server LTS (22.04 or 24.04), fully updated; time zone `Asia/Kuala_Lumpur` (`timedatectl set-timezone Asia/Kuala_Lumpur`) so
  the timer times below are local.
- **Docker Engine + Compose plugin** from Docker's apt repository (not the distro `docker.io`), Compose 2.24+:
  `docker compose version`. Optional `/etc/docker/daemon.json` with `{"log-driver":"json-file","log-opts":{"max-size":"20m","max-file":"5"},"live-restore":true}`
  so containers outside this stack are rotated too.
- **Firewall (ufw): only 22, 80, 443.**
  ```
  sudo ufw default deny incoming && sudo ufw default allow outgoing
  sudo ufw limit 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable
  ```
  Docker publishes container ports through its own iptables rules and bypasses ufw, so the rule that matters is to publish
  nothing else. This stack publishes only 80 and 443 on the edge and (profile `monitoring`) Kuma on 127.0.0.1. Do not add
  `ports:` for `db`, `api` or `frontend`. Check with `sudo ss -tlnp` after every deploy.
- **SSH:** key login only (`PasswordAuthentication no`, `PermitRootLogin no`), optionally `fail2ban`.
- **Unattended upgrades:** `sudo apt install unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades`
  (security updates). Kernel reboots: containers come back by themselves (`unless-stopped`), so a scheduled reboot is safe;
  `LEAD:` decide whether `Unattended-Upgrade::Automatic-Reboot` is on (04:30 suggested).
- **Non-root deploy user:** `sudo adduser --disabled-password --gecos "" ppdeploy && sudo usermod -aG docker ppdeploy`.
  **Docker group membership is root-equivalent on this host** (anyone in the group can mount `/` into a container): keep the deploy user's SSH key, and the user itself, to the few people the LEAD trusts, and treat that key like root's. The timers in
  `deploy/vps/systemd/` run as this user.
- **Swap:** a 2 GB swap file as a safety net for image builds (`fallocate -l 2G /swapfile`, `chmod 600`, `mkswap`, `swapon`, fstab,
  `vm.swappiness=10`). The containers have memory limits, so swap is not part of normal operation.
- **Packages:** `git curl openssl ca-certificates logrotate`; for the restore drill **Node 22** (the drill wraps
  `scripts/db-restore-check.mjs`; use NodeSource or `nvm` for the deploy user); for off-site copies `awscli` (S3-compatible) or `rsync`;
  optional `gnupg` (encrypt copies that leave the server).
- **Disk encryption:** backups hold personal data of minors. `LEAD:` confirm the VPS disk or the backup volume is encrypted
  (LUKS on a data volume if the provider does not encrypt at rest). Without encryption at rest do not store backups there
  ([db-backup.md](db-backup.md)).

- **Image pinning.** Tags in the pack: `nginx:1.28-alpine` (edge), `postgres:16-alpine`, `certbot/certbot:v3.0.1`, `clamav/clamav:1.4`, `louislam/uptime-kuma:1.23.16`.
  The build environment had no network to resolve digests, and those tags were not checked against the registries. `LEAD:` at install, confirm each tag is a currently supported release (for nginx the
  current stable line), pull it, and **pin by digest**: `docker image inspect --format '{{index .RepoDigests 0}}' <image>`, then put `name@sha256:...` into `PP_EDGE_IMAGE`, `PP_CERTBOT_IMAGE`,
  `PP_CLAMAV_IMAGE`, `PP_KUMA_IMAGE` (and the `postgres` line of `compose.yaml` if the LEAD wants it). Re-check monthly with the security updates.

---

## 3. Parameters

Three files hold everything, all outside the repo, owner `root`, group `ppdeploy`, mode `640` (`sudo install -m 640 -o root -g ppdeploy ...`):

| File | Content | Example |
|---|---|---|
| `/etc/pretasiplus/prod.env` | Compose interpolation and script settings (`--env-file`). Not secret, except the two ping URLs and `PP_ALERT_WEBHOOK_URL` | `deploy/vps/.env.prod.example` |
| `/etc/pretasiplus/api.env` | API secrets and production settings (`env_file` of `api` and `migrate`) | `deploy/vps/api.env.example` |
| `/etc/pretasiplus/db.env` | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | `deploy/vps/db.env.example` |

Write values with an editor (`sudoedit`), never on a command line. Generate secrets with `openssl rand -hex 32`. The `*.example`
files use inline-comment-free lines on purpose (Compose would keep a trailing comment of an empty value).

Who sets what: **LEAD** = the LEAD supplies or approves the value; **OPS** = the operator, with the default unless told otherwise.

### prod.env

| Name | Default | Who | Meaning |
|---|---|---|---|
| `PP_DOMAIN` | none (required) | LEAD | Public host name, no scheme. Used by nginx, certbot, `PUBLIC_BASE_URL`, the health checks |
| `PP_LETSENCRYPT_EMAIL` | none | LEAD | Let's Encrypt expiry notices |
| `PP_ENV_DIR` | `/etc/pretasiplus` | OPS | Folder of the three files |
| `PP_LE_DIR`, `PP_LE_LOG_DIR`, `PP_WEBROOT_DIR` | `/srv/pretasiplus/letsencrypt`, `-log`, `certbot-webroot` | OPS | Certificates (certbot writes, edge reads), its log, the ACME webroot |
| `PP_BACKUP_DIR` | `/var/backups/pretasiplus` | OPS | Dumps. Must be outside the repo; encrypted volume |
| `PP_STATE_DIR` | `/var/lib/pretasiplus-deploy` | OPS | `current.tag`, `previous.tag`, `history.log`, probe state |
| `PP_IMAGE_TAG` | `prod` (scripts set the git sha) | script | Image tag |
| `PP_IMAGE_PREFIX` | empty | LEAD | Registry prefix with trailing slash, e.g. `ghcr.io/ORG/`; empty = build on the VPS |
| `PP_BUILD_MODE` | `local` | OPS | `local` builds on the VPS (needs ~2 GB free RAM); `pull` pulls from `PP_IMAGE_PREFIX` |
| `PP_PROFILES` | empty | LEAD | Compose profiles to run: `clamav`, `monitoring` (comma list) |
| `PP_HTTP_BIND` | `0.0.0.0` | OPS | IPv4 address for ports 80/443. The edge publishes **IPv4 only**: create an A record, no AAAA record |
| `PP_EDGE_AUTH_RATE` | `300r/m` | OPS | Edge `limit_req` per client IP on `/api/auth/` (nginx rate syntax). Secondary to the API's own login throttle; generous because many schools share one NAT address (F2 default, section 20). A huge value (`100000r/m`) makes it a no-op |
| `PP_EDGE_AUTH_BURST` | `120` | OPS | Burst size of that limit (excess requests get `429` immediately, `nodelay`) |
| `PP_LOCK_FILE` | `/var/lock/pretasiplus.lock` | OPS | The shared lock for backup, deploy, rollback, restore drill and certificate jobs; the deploy user must be able to write it |
| `PP_DEPLOY_GROUP` | `ppdeploy` | OPS | When a script runs as root (`sudo init-cert.sh`), `pp_lock` hands the lock file to this group with mode 0660, so the deploy user's timers are not locked out. Also install `systemd/pretasiplus.tmpfiles.conf` (section 9, Schedule) |
| `PP_LOCK_WAIT` | `1800` | OPS | Seconds a timer-started backup or drill waits for another operation before it fails |
| `PP_API_CPUS`, `PP_API_MEM`, `PP_API_HEAP_MB`, `PP_API_STOP_GRACE` | `1.5`, `2g`, `1536`, `35s` | OPS (LEAD sizes) | API limits; heap about 75% of the memory limit; stop grace above `SHUTDOWN_GRACE_MS` |
| `PP_DB_CPUS`, `PP_DB_MEM`, `PP_DB_SHM` | `2`, `2g`, `256m` | OPS (LEAD sizes) | Database limits |
| `PP_EDGE_MEM` | `512m` | OPS | Edge memory limit; see the sizing note in section 13 |
| `PP_FRONTEND_CPUS/MEM`, `PP_EDGE_CPUS`, `PP_MIGRATE_CPUS/MEM`, `PP_CLAMAV_CPUS/MEM`, `PP_KUMA_CPUS/MEM` | see the file | OPS | Limits of the other services |
| `PP_KUMA_PORT` | `3001` | OPS | Loopback port of Uptime Kuma |
| `PP_PG_SHARED_BUFFERS`, `PP_PG_EFFECTIVE_CACHE_SIZE`, `PP_PG_WORK_MEM`, `PP_PG_MAINTENANCE_WORK_MEM`, `PP_PG_MAX_CONNECTIONS`, `PP_PG_MAX_WAL_SIZE`, `PP_PG_LOG_MIN_DURATION_MS` | `512MB`, `1GB`, `8MB`, `128MB`, `100`, `2GB`, `1000` | OPS (LEAD sizes) | Postgres settings passed as `-c` (table in section 13) |
| `PP_UPLOAD_FILES_MB`, `PP_UPLOAD_BIG_MB` | `22`, `256` | OPS | Edge body limits (section 5) |
| `PP_CSP_MODE` | `report-only` | LEAD (decision D-7) | `report-only`, `enforce` or `off`. Default applied 22 Oct: `report-only` at go-live (section 20) |
| `PP_HSTS` | `max-age=300` | LEAD | HSTS value for the whole host, sent by the edge on every https response (the API's own HSTS is replaced, so there is one policy). Ramp per `platform-settings.md` §4.3: `max-age=300` → `max-age=86400` → `max-age=604800` → `max-age=15552000`, one clean week per step; add `; includeSubDomains` only once every subdomain serves HTTPS; never `preload`. Empty = no header. `deploy.sh` refuses any other shape (the value is pasted into the nginx config) |
| `PP_LOG_MAX_SIZE`, `PP_LOG_MAX_FILE` | `20m`, `5` | OPS | Docker log rotation |
| `PP_JOBS_WORKER_ENABLED` | `true` | OPS | The one API instance runs the job worker |
| `PP_BACKUP_KEEP_DAILY`, `PP_BACKUP_KEEP_WEEKLY`, `PP_BACKUP_WEEKLY_DAY`, `PP_BACKUP_KEEP_AUX`, `PP_BACKUP_KEEP_FILES`, `PP_BACKUP_FILES` | `7`, `4`, `7`, `5`, `2`, `weekly` | LEAD | Retention (section 9) |
| `PP_OFFSITE_KIND` | `none` | LEAD | `s3`, `rsync` or `none`. Default applied 22 Oct: **`s3`** once the LEAD has the bucket (section 20) |
| `PP_OFFSITE_S3_URI`, `PP_OFFSITE_S3_ENDPOINT`, `PP_OFFSITE_S3_PROFILE` | empty | LEAD | S3-compatible target (credentials in the backup user's aws CLI config, not here) |
| `PP_OFFSITE_RSYNC_TARGET`, `PP_OFFSITE_RSYNC_SSH_PORT` | empty, `22` | LEAD | rsync-over-ssh target (key-based login of the backup user) |
| `PP_BACKUP_GPG_RECIPIENT` | empty | LEAD | **Required when `PP_OFFSITE_KIND` is `s3` or `rsync`**: public key (id/e-mail) that every off-site copy is encrypted to. The PRIVATE key is kept off the server (LEAD's vault / a second machine); `offsite.sh` checks `gpg --list-keys` and dies otherwise |
| `PP_BACKUP_GPG_FPR` | empty | LEAD | **Recommended**: the 40-hex fingerprint of the backup key (`gpg --fingerprint`). `offsite.sh` then encrypts to exactly that key (`--recipient FPR!`), so another key whose user id matches `PP_BACKUP_GPG_RECIPIENT` can never be chosen; it warns while only the user id is set |
| `PP_OFFSITE_ALLOW_PLAINTEXT` | `false` | LEAD | `true` only as a recorded LEAD decision; lets off-site copies leave unencrypted |
| `PP_BACKUP_MAX_AGE_DAYS` | `35` | LEAD | Erasure rule: nothing older stays on the server (section 9) |
| `PP_CSP_IMG_HOSTS` | `https://img.youtube.com` | LEAD | Space-separated https origins allowed for images in the CSP (no bare `https:`) |
| `PP_EDGE_IMAGE` | `nginx:1.28-alpine` | OPS | Edge image pin (see "Image pinning" in section 2) |
| `PP_HEALTHCHECK_PING_URL`, `PP_HEALTHCHECK_PROBE_URL` | empty | LEAD (account) | Dead man's switch URLs (backup job, health probe) |
| `PP_ALERT_WEBHOOK_URL` | empty | LEAD (channel) | Generic webhook that receives alert text |
| `PP_ALERT_DISK_PCT`, `PP_ALERT_CERT_DAYS`, `PP_ALERT_BACKUP_MAX_AGE_H`, `PP_ALERT_API_ERRORS_5M` | `85`, `21`, `30`, `25` | OPS | Alert thresholds |
| `PP_CERTBOT_IMAGE`, `PP_CLAMAV_IMAGE`, `PP_KUMA_IMAGE` | see compose | OPS | Image pins |
| `PP_OPERATOR`, `PP_PROBE_BASE_URL`, `PP_PROD_ENV` | unset | OPS | Per-run: operator name for the drill evidence; probe base URL for tests; alternate `prod.env` path |
| `VITE_PROTOTYPE_SCOPE` | `on` (base compose default) | LEAD | Build arg. Open question carried from the go-live checklist: confirm it does not hide the Admin Pusat publish screen; set `off` here if it does |

### api.env (secrets; the full key list is `.env.api.example` and [api-runbook.md](api-runbook.md) section 2)

| Name | Who | Rule |
|---|---|---|
| `DATABASE_URL` | LEAD | `postgresql://USER:PASSWORD@db:5432/DBNAME`, equal to `db.env`. `deploy.sh` checks host, user, database and password |
| `SESSION_SECRET`, `IC_HASH_KEY` | LEAD | 32+ characters each, different. **Never rotate `IC_HASH_KEY` casually** (section 12) |
| `MARKETPLACE_PLATFORM_WHATSAPP` | LEAD | The real wa.me number (digits, country code first); the dev default is refused by `deploy.sh` |
| `PUBLIC_ORIGINS` | LEAD | Extra image origins for articles/banners (empty = API origin only) |
| `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, `AI_MONTHLY_BUDGET_SEN`, `AI_PRICE_TABLE_JSON` | LEAD (decision D-5/OD-14) | **Decided 22 Oct (AZ-29 item 1): `AI_PROVIDER=mock`**, the other four stay unset. `AI_API_KEY` is a secret. See `docs/ops/ai-intake-production-decisions.md` (lands with #138) |
| `OCR_ENGINE`, `OCR_LANG_DIR` | LEAD | **Decided 22 Oct (AZ-29 item 4): `OCR_ENGINE=none`**, `OCR_LANG_DIR` unset. Scanned pages are typed in by hand |
| `INTAKE_*` limits | LEAD | **Decided 22 Oct (AZ-29 item 5 KEEP):** no key set, the schema defaults apply (20 MB, 200 pages, 500 pages per day). Intake is admin-only at go-live (item 7, card AZ-35) |
| `REGISTRATION_OPEN` | LEAD | `false` from install until the 30 Oct switch, then `true` (section 16). Unset = open, so the key must be present. While `false`, `POST /api/auth/register` answers 403 `REGISTRATION_CLOSED`; login, password reset and admin-created accounts are unaffected |
| `METRICS_ENABLED`, `METRICS_INTERNAL_CIDRS` | OPS | Metrics stay admin-session-only; the edge returns 404 from outside |
| `THROTTLE_GLOBAL_PER_MINUTE` | LEAD (OQ1) | **`3000`** (F2 default applied 22 Oct, section 20): counted per client address, and a school shares one NAT address. `deploy.sh` warns below 3000 |
| other `THROTTLE_*`, `LOGIN_*`, ... | LEAD (OQ1) | Defaults unless the LEAD changes them |
| `KEEP_ALIVE_TIMEOUT_MS`, `REQUEST_TIMEOUT_MS`, `SHUTDOWN_GRACE_MS` | OPS | Defaults 65000 / 120000 / 25000; the edge timeouts are built around them |

Forced by the overlay (cannot be overridden by `api.env`): `NODE_ENV=production`, `PORT=3000`, `TRUST_PROXY_HOPS=1`,
`COOKIE_SECURE=true`, `ALLOW_DEMO_SEED=false`, `BIJAK_POC_QUESTIONS=false`, `JOBS_WORKER_ENABLED` (= `PP_JOBS_WORKER_ENABLED`),
`PUBLIC_BASE_URL=https://$PP_DOMAIN`, `FILE_STORAGE_DIR=/var/lib/pretasiplus/files`, `NODE_OPTIONS=--max-old-space-size=$PP_API_HEAP_MB`.

Reserved (do NOT put them in `api.env` yet): `CLAMAV_HOST=clamav`, `CLAMAV_PORT=3310` (section 15).

---

## 4. First install, step by step

Every step that touches the server is the operator's, after the LEAD's go. `LEAD:` items are inputs.

1. `LEAD:` VPS ready (section 2), domain chosen, **DNS A record of `PP_DOMAIN` points at the VPS** (the edge publishes IPv4 only: do not create an AAAA record, or IPv6 clients cannot connect). For the cutover (section 16)
   lower the TTL to 300 s at least 48 hours before.
2. As `ppdeploy`: `sudo mkdir -p /opt/pretasiplus && sudo chown ppdeploy: /opt/pretasiplus && git clone <repo url> /opt/pretasiplus && cd /opt/pretasiplus && git checkout <release tag>`.
   `LEAD:` the repo URL/deploy key and the release tag.
3. Folders: `sudo install -d -m 750 -o root -g ppdeploy /etc/pretasiplus && sudo install -d -o ppdeploy -g ppdeploy -m 700 /var/backups/pretasiplus /var/lib/pretasiplus-deploy /var/log/pretasiplus /srv/pretasiplus/letsencrypt /srv/pretasiplus/letsencrypt-log /srv/pretasiplus/certbot-webroot`
   (a separate encrypted volume mounted at `/var/backups/pretasiplus` is better).
4. Env files: `sudo install -m 640 -o root -g ppdeploy deploy/vps/.env.prod.example /etc/pretasiplus/prod.env`, same for `api.env.example` -> `api.env`
   and `db.env.example` -> `db.env`; edit all three with `sudoedit` (`LEAD:` values). Choose the size profile of section 13.
5. Dry run: `deploy/vps/deploy.sh --dry-run`. **Before step 6 the only failure it should report is the missing-certificate line** (`no certificate for ...`); everything else must already pass. After step 6 it must end with `preflight passed`. It prints every step it would run.
6. Certificate (section 6): `deploy/vps/tls/init-cert.sh --dry-run`, then `deploy/vps/tls/init-cert.sh`.
7. Deploy (section 7): `deploy/vps/deploy.sh`. On a first install there is nothing to back up; the script says so.
8. Reference data, once: `deploy/vps/deploy.sh --seed-reference` (section 7). Then the smoke test of section 7.
9. Schedulers: install the timers (section 9) and the probe (section 10), and logrotate (section 11).
10. First backup and a restore drill (section 9) before any user data exists, then again after the data migration.
11. `LEAD:` the first administrator account. Default applied 22 Oct (F1, section 20): the first Admin Pusat accounts come from the
    `.cloud` migration (T-1 load, 29 Oct). There is still no bootstrap command; do not enable the demo seed to work around it.

---

## 5. Edge nginx

Template `deploy/vps/nginx/templates/pp.conf.template`, rendered at container start (only `PP_*` variables are substituted,
`NGINX_ENVSUBST_FILTER=^PP_`). Change it, then redeploy (the edge is recreated on every deploy).

| Topic | Setting |
|---|---|
| HTTP | Port 80: ACME webroot at `/.well-known/acme-challenge/`, `/healthz`, everything else `301` to `https://PP_DOMAIN` (a fixed host, not `$host`: no open redirect) |
| TLS | TLS 1.2 and 1.3, Mozilla "intermediate" ciphers, no session tickets, shared session cache, HTTP/2. A request for any other host name or a bare IP gets no certificate (`ssl_reject_handshake`). No OCSP stapling (Let's Encrypt stopped publishing OCSP) |
| HSTS | **Edge-owned, `PP_HSTS`** (default `max-age=300`), on every https response: SPA, `/api` and the 404s nginx answers itself (`templates/snippets/hsts.conf.template`). On `/api` the API's own production header (`max-age=15552000; includeSubDomains`, hard-coded in `security-headers.ts`) is hidden with `proxy_hide_header` and replaced, so the header is never doubled and the ramp in `platform-settings.md` §4.3 is not overridden by one API response. Raise the value step by step; never start at 6 months |
| `/api/metrics` | `404` for `/api/metrics`, `/api/metrics/`, any case (`/api/Metrics`), any suffix, `//api//metrics`, `/api/./metrics`, percent-encoded spellings (nginx matches on the decoded URI) |
| `/api/` | Proxied to `api:3000` with `Host`, `X-Real-IP`, `X-Forwarded-For` (= the peer address, overwritten), `X-Forwarded-Proto`, `X-Request-Id`. 3 MB body, connect 5 s, send 60 s, **read 125 s**: just above `REQUEST_TIMEOUT_MS=120000`, so the API answers its own timeout first. The edge's keep-alive towards clients is 60 s, below `KEEP_ALIVE_TIMEOUT_MS=65000`. **No `add_header` on `/api`**: the API's own headers (nosniff, DENY, no-referrer, COOP/CORP, CSP `default-src 'none'`, `Cache-Control: no-store` on session responses) reach the browser unchanged |
| Uploads, tier 1 (`PP_UPLOAD_FILES_MB`, 22 MB) | `/api/files`, `/api/timeline`, `/api/me/picture`, `/api/spm-walkthrough/solve`, `/api/bijak/attempts/:id/photos`, `/api/diagram-audit/:kind/:id/image`. Body timeout 120 s, upstream 300 s |
| Uploads, tier 2 (`PP_UPLOAD_BIG_MB`, 256 MB) | Many-file multipart routes: `/api/intake/batches` and `/api/intake/batches/:id/files` (up to `INTAKE_MAX_FILES_PER_BATCH`+1 = 11 files x 20 MB = 220 MB), `/api/admin/audio-kbat-sets` (4 x 20 MB = **80 MB**, the biggest the audio KBAT needs), `/api/admin/screenshots` (20 x 10 MB), `/api/perutusan` (6 x 2 MB + 3 x 5 MB), `/api/guru/question-papers` (up to 101 MB). At most **2 concurrent big uploads per address and 4 for the whole server** (`limit_conn`). The API enforces each purpose itself; this is the outer fence. A new many-file route needs a line in that regex |
| SPA | `/` proxied to `frontend:8080`. Cache headers come from the frontend nginx (`/assets/*` immutable for a year, `index.html` and deep links `no-cache`, SPA fallback). Gzip is on for SPA assets, **off for `/api`** (the JSON carries the CSRF token: BREACH) |
| Security headers on the SPA | The frontend nginx already sends `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`; the edge adds only HSTS and the CSP, so nothing is duplicated |
| CSP | Decision **D-7**: default `report-only` applied for go-live on 22 Oct (section 20). `report-only`: no breakage, violations appear in the browser console. `PP_CSP_MODE=enforce` enforces the same policy (decide D-7 before go-live: section 16, T-2 d), `off` sends nothing. The policy (`snippets/csp-*.conf`): `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: $PP_CSP_IMG_HOSTS (no bare `https:`); font-src 'self' data:; media-src 'self' blob:; connect-src 'self'; frame-src` the three video hosts the SPA allows; `object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`. **Check in a browser on staging before choosing `enforce`** (video embeds, article images, audio player) |
| Request-body buffers | `client_body_temp_path` and `proxy_temp_path` are on the **disk-backed named volume `edgetmp`** (`/var/cache/nginx`), not tmpfs. tmpfs pages count against the edge's memory limit, so buffering unauthenticated 256 MB bodies in RAM would OOM-kill the edge. Worst case on disk: 4 big uploads x 256 MB + the 22 MB tier, a few GB at most; the nginx workers' memory stays small. HSTS (`PP_HSTS`) is also sent on the 404s that nginx itself answers (`/api/metrics`, `/api`) |
| Auth flood guard | `/api/auth/` has `limit_req` per client IP (`PP_EDGE_AUTH_RATE`, `PP_EDGE_AUTH_BURST`, status 429). It is a secondary guard: the API throttles logins per account and per IP itself, and the edge sees one address for a whole school behind NAT, hence the generous default. Tested by `test-routing.sh` |
| Access log | Same format as the frontend nginx: a 64-hex path segment (parent invite token) is logged as `[redacted]`, no Referer |

Check without Docker: `deploy/vps/nginx/check.sh [report-only|enforce|off]` (syntax) and `deploy/vps/nginx/test-routing.sh`
(starts the host's nginx with stub upstreams: metrics 404 in 8 spellings, no XFF spoofing, redirect, HSTS/CSP placement, body limits per tier).

---

## 6. TLS (Let's Encrypt)

- Webroot challenge through the running edge, certificates in `PP_LE_DIR` (bind mount, read-only for the edge).
- **First certificate:** `deploy/vps/tls/init-cert.sh --dry-run` (certbot against the Let's Encrypt staging servers; proves DNS, port 80 and the
  webroot path without issuing), then `deploy/vps/tls/init-cert.sh`. It makes a 1-day self-signed placeholder so nginx can start, starts the edge,
  removes the placeholder, runs certbot, reloads the edge. Rate limits: do not repeat the real run in a loop.
- **Reading the certificate without root.** certbot creates `live/` and `archive/` root-only. The deploy user (`ppdeploy`) does not need to read them: `deploy.sh` and `health-probe.sh` read `fullchain.pem` through the running edge (`docker compose exec -T edge cat ...`; the directory is mounted read-only there), after trying a direct read. Consequence: before the edge has ever run (first install), the preflight cannot see the file and says so; run `init-cert.sh` first, which starts the edge. If you prefer direct reads, give the group access: `sudo chgrp ppdeploy $PP_LE_DIR/live $PP_LE_DIR/archive && sudo chmod 750 $PP_LE_DIR/live $PP_LE_DIR/archive` (note that the key files then become readable to the group as well; `ppdeploy` is root-equivalent anyway through the docker group).
- **Failed issuance.** If certbot fails, `init-cert.sh` puts the placeholder back (the edge keeps a certificate) and exits non-zero; a re-run reuses the placeholder and never nests directories. `deploy.sh` refuses a self-signed certificate, so a half-finished first install cannot be deployed by mistake.
- **Renewal:** `deploy/vps/tls/renew.sh` twice a day (systemd timer `pp-cert-renew.timer` or cron). Certbot renews when fewer than 30 days remain;
  the script reloads the edge every time. Failure raises an alert. The health probe alerts when fewer than `PP_ALERT_CERT_DAYS` (21) days remain.
- Alternative: a different ACME client (Caddy, acme.sh) or a provider-managed certificate: put `fullchain.pem` and `privkey.pem` at
  `$PP_LE_DIR/live/$PP_DOMAIN/` and skip certbot; nothing else changes.

---

## 7. Deploy

Run on the VPS as `ppdeploy`, from the checkout of the release commit the LEAD tagged (no merges after the tag).

```
cd /opt/pretasiplus && git fetch --tags && git checkout <release tag>
deploy/vps/deploy.sh --dry-run          # every check for real, every step printed, nothing changed
deploy/vps/deploy.sh                    # asks you to type the domain: the LEAD's confirmation
```

What it does, in order (`deploy.sh --help`):

1. **Preflight.** Tools and Compose version; the three env files exist, mode `640` (`root:ppdeploy`; `600`/`400` also pass) and are neither readable by others nor writable by the group; **no placeholder** (`change-me`, `USER:PASSWORD`,
   `app.example.my`, the dev WhatsApp number, ...); **fail-closed guard**: refuses if `ALLOW_DEMO_SEED`, `BIJAK_POC_QUESTIONS` or `MAIL_LOG_RESET_LINKS` is `true`/`1`
   in any env file or the shell; secrets 32+ characters, `IC_HASH_KEY` different from `SESSION_SECRET` (what the API enforces at boot, plus the 32-character team policy);
   `DATABASE_URL` matches `db.env` (host `db`, user, database, password); stop grace above `SHUTDOWN_GRACE_MS`; the certificate is readable (directly, or through the running edge when `live/` is root-only) and is **not self-signed** (issuer differs from subject: the `init-cert.sh` placeholder is refused), not expired; `docker compose config -q`
   passes with the overlay; **single-instance guard** (section 14); the working tree is clean (`--allow-dirty` to override).
2. **Pre-deploy backup** (`backup.sh --tag pre-deploy --no-files`) if the database is running. `--skip-backup` exists and is logged as a warning: do not use it with a migrating release.
3. **Build or pull** the three images tagged with the git sha.
4. `db` up and healthy.
5. **Migrate**: one-shot `migrate` runs `prisma migrate deploy` only. Never a seed. Idempotent. A failed migration stops the deploy before the API is touched.
6. `api` and `frontend` up, `--wait` for healthy.
7. **Edge** recreated (rendered nginx config and certificate are re-read). A blip of about a second on 80/443.
8. **Health checks through the edge** (real host name, forced to 127.0.0.1): `/api/health` 200, `/api/ready` 200 `ready` (database up and every shipped migration applied), `/` 200,
   `/api/metrics` 404, `http://` redirects 301.
9. Records `current.tag` and `previous.tag` in `PP_STATE_DIR`, appends to `history.log` (tag, sha, user).

**Deploy check (single instance).** After the deploy, `docker compose -f compose.yaml -f deploy/vps/compose.prod.yaml --env-file /etc/pretasiplus/prod.env ps api` must show exactly one container.

**Expected log line:** in production the API logs one boot warning (`clientIpBootWarning`, #91) when `TRUST_PROXY_HOPS` > 0 and `CLIENT_IP_HEADER` / `EDGE_PROXY_SECRET` are unset. On this stack that is expected and harmless: the edge is the single proxy and sets the client address itself; those two keys are for the Cloudflare Pages path and stay empty here.

There is **no automatic rollback**: migrations are forward-only, so the script stops, prints what to do and sends an alert. The old API keeps serving until step 6 replaces it.

**Lock.** `deploy.sh`, `rollback.sh`, `backup.sh`, `restore-drill.sh` and the certificate scripts share one lock file (`PP_LOCK_FILE`, default `/var/lock/pretasiplus.lock`). A second operation fails at once with exit 75 (deploy, rollback) or waits up to `PP_LOCK_WAIT` seconds (timer-started backup, drill, renewal). The backup that a deploy or a drill starts itself inherits the lock (`PP_LOCK_HELD=1`). **Run the scripts as `ppdeploy`** (`sudo -u ppdeploy …`), not as root; only `init-cert.sh` needs root. A root run hands the lock file to `PP_DEPLOY_GROUP` (0660), and `pretasiplus.tmpfiles.conf` recreates it with the right owner at every boot. A timer backup that cannot get the lock within `PP_LOCK_WAIT` alerts "BACKUP SKIPPED … lock was busy", not "BACKUP FAILED".

**A deploy that fails (the failed-deploy path).** Any failed step, including a failed step-8 health check, runs the failure handler: it prints where it stopped, sends the alert and prints the rollback command. From step 5 on, `deploying.tag` in `PP_STATE_DIR` names the release being started; `current.tag` still names the last release that finished (it is written only in step 9). So after a failure past `migrate`, the containers run the new tag while `current.tag` is the old one. `rollback.sh` therefore compares the requested tag with the api image that is actually running (`docker inspect` of the api container), not with `current.tag`:
- `deploy/vps/rollback.sh <old tag>` (the command the failure message prints) works;
- `deploy/vps/rollback.sh --previous` means "the last release that finished" in that state (it picks `current.tag`, not `previous.tag`), and prints a warning that a deploy did not finish;
- `--checkout` uses the same tag, so the commit comes from `history.log`;
- a failure before step 5 changed no container; nothing to roll back.
After the rollback `deploying.tag` is removed and `previous.tag` is left as it was.

**Reference data (once per environment, and after a release that adds reference modules):**
```
deploy/vps/deploy.sh --seed-reference
```
runs `npm run be:db:seed` in the `migrate` image with `ALLOW_DEMO_SEED=false`. In production the seed loads **reference modules only** (the `school_packages` catalogue and the
SPM subject configs; `apps/api/prisma/seed/index.ts`) and prints that the demo modules were skipped; read that line. It is idempotent (upserts).
Never run the demo seed or `--force-demo` in production (it needs two keys on purpose, and creates accounts with a published password).

**Smoke test after the first deploy** (the checklist of [go-live-bijak-spm.md](go-live-bijak-spm.md) section 4.2; `scripts/demo-smoke.sh` with `EXPECT_SECURE=1` needs accounts; `LEAD:` production smoke accounts are still to be created):
SPA and a deep link load; login sets `pp_session` `HttpOnly; Secure; SameSite=Lax`; CSRF 403 without the header; one Bijak attempt end to end; an upload under 22 MB works and an oversize one is
refused cleanly; an audio KBAT set create (up to 80 MB) and an intake batch upload pass the edge; the sixth failed login from one client gets 429 and a second network is not locked out
(proves `TRUST_PROXY_HOPS`/XFF); `docker compose ... logs api` shows structured lines without stack traces.

---

## 8. Rollback

**Images (fast, reversible):**
```
deploy/vps/rollback.sh --dry-run
deploy/vps/rollback.sh                  # to previous.tag; or: rollback.sh <tag>; add --checkout to also check out that release's commit
```
It restarts `api` and `frontend` on the earlier tag, recreates the edge, runs the same health checks, swaps `current.tag`/`previous.tag` (after a failed deploy it only resets `current.tag`; see the failed-deploy path in section 7). It does not run `migrate` and does not touch the database.
Use `--checkout` when `compose.prod.yaml` or the nginx files changed in the bad release (the edge config comes from the checkout, not from an image).

**Database: migrations are forward-only.** After a release that migrated:
- If the migration was additive (new table/column), the older API runs on the newer schema (`/api/ready` only requires that every migration the running image ships is applied). Image rollback is enough.
- If it was not safe: restore the pre-deploy dump taken in step 2 of the deploy. This loses every write after that dump. **It needs the LEAD's confirmation and a maintenance notice.**
  Steps (also in [db-backup.md](db-backup.md), "Real restore"), from the repo root with the production overlay (`PC='docker compose -f compose.yaml -f deploy/vps/compose.prod.yaml --env-file /etc/pretasiplus/prod.env'`):
  1. `$PC stop api frontend`; keep `db` running. Take a safety dump of the current state first: `deploy/vps/backup/backup.sh --tag drill --no-offsite --no-files`.
  2. Prove the chosen dump is intact: `(cd /var/backups/pretasiplus && sha256sum -c <dump>.sha256)` and `$PC exec -T db pg_restore --list < <dump> | head`. (The full row-count drill compares against the live database, so it only applies to a fresh dump of an idle database: section 9.)
  3. `$PC cp <dump> db:/tmp/restore.dump`, then
     `$PC exec db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d postgres -c "drop database \"$POSTGRES_DB\" with (force)" -c "create database \"$POSTGRES_DB\""'`, then
     `$PC exec db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error /tmp/restore.dump'`, then `$PC exec db rm /tmp/restore.dump`.
  4. Roll the images back (`rollback.sh --checkout <tag>`; this also works right after a failed deploy, see section 7), then `$PC up -d --wait --no-deps api frontend`. Check `/api/ready` and a login.
  5. Uploads: restore from the newest `pp-files-*.tar.gz` only if the files volume was damaged (`$PC exec -T api tar -xzf - -C /var/lib/pretasiplus/files < archive`; the api rootfs is read-only but the volume is writable).
  6. Record the incident (what, when, which dump, data-loss window) and tell the LEAD.
- Rollback triggers and go/no-go rules for the cutover: section 16.

---

## 9. Backups and restore drill

**What is backed up**

| Asset | Mechanism | Frequency | Retention (parameters) |
|---|---|---|---|
| PostgreSQL | `pg_dump -Fc --no-owner` inside the db container with the container's own `POSTGRES_*` (the same command as `scripts/db-backup.mjs`; file names are compatible). `pp-backup-<UTC>.dump` + `.sha256` | nightly 02:15, and before every deploy | daily `PP_BACKUP_KEEP_DAILY`=7; weekly copy (day `PP_BACKUP_WEEKLY_DAY`=Sunday) in `weekly/`, `PP_BACKUP_KEEP_WEEKLY`=4; pre-deploy and drill dumps `PP_BACKUP_KEEP_AUX`=5 |
| Uploads (volume `apifiles`) | `tar -czf` through the api container, `pp-files-<UTC>.tar.gz` + `.sha256` | weekly (`PP_BACKUP_FILES=weekly`; `true` = nightly, `false` = off) | newest `PP_BACKUP_KEEP_FILES`=2 |
| Config / secrets | `/etc/pretasiplus/*.env` | by hand | `LEAD:` keep a copy in the LEAD's password manager. A restore without `IC_HASH_KEY` and `SESSION_SECRET` is not a full restore |
| Certificates | reissuable | n/a | n/a |

`backup.sh` also checks that the file starts with `PGDMP`, that `pg_restore --list` reads it and shows table data, and that a failed run leaves no partial file. A failure raises an alert and pings `/fail`.

**Schedule.** systemd (preferred):
```
sudo mkdir -p /var/log/pretasiplus && sudo chown ppdeploy: /var/log/pretasiplus
sudo install -m 644 deploy/vps/systemd/pretasiplus.tmpfiles.conf /etc/tmpfiles.d/pretasiplus.conf
sudo systemd-tmpfiles --create /etc/tmpfiles.d/pretasiplus.conf                          # the lock file, owned by ppdeploy, at every boot
sudo cp deploy/vps/systemd/pp-*.service deploy/vps/systemd/pp-*.timer 'deploy/vps/systemd/pp-alert@.service' /etc/systemd/system/
sudo systemctl daemon-reload
systemd-analyze verify /etc/systemd/system/pp-*.service /etc/systemd/system/pp-*.timer   # only /opt/... path notes are acceptable
sudo systemctl enable --now pp-backup.timer pp-health-probe.timer pp-cert-renew.timer     # pp-restore-drill.timer after the first manual drills
systemctl list-timers 'pp-*'
```

The units run as `ppdeploy` with `NoNewPrivileges`, `ProtectSystem=full`, `PrivateTmp`, `ProtectHome=read-only`, `ProtectKernelTunables`, `ProtectControlGroups`, `RestrictSUIDSGID` and `ReadWritePaths` for the backup directory, the state directory and `/run/lock`. If you move `PP_BACKUP_DIR`, `PP_STATE_DIR` or `PP_LOCK_FILE`, edit `ReadWritePaths` in the units too. These settings keep the docker socket reachable; the socket itself stays the real privilege (docker group = root-equivalent).
The units assume the checkout `/opt/pretasiplus` and the user `ppdeploy`; edit them if yours differ. Cron alternative (install ONE of the two): `sudo install -m 644 deploy/vps/systemd/cron.pretasiplus /etc/cron.d/pretasiplus`.

**Off-site copy** (`offsite.sh`, called by `backup.sh`; `LEAD:` choose the target, a disk loss on this VPS must not lose the only copies):
- `PP_OFFSITE_KIND=s3`: any S3-compatible bucket through `aws s3 cp --endpoint-url PP_OFFSITE_S3_ENDPOINT`. Credentials live in the backup user's aws CLI configuration (`aws configure --profile pp-backup`), never in `prod.env`.
  Use a write-only key if the provider supports it, and set a bucket lifecycle rule (for example 35 days) plus object lock/versioning: that is the off-site retention.
- `PP_OFFSITE_KIND=rsync`: `rsync -a -e "ssh -p PORT"` to `PP_OFFSITE_RSYNC_TARGET`; key-based login of `ppdeploy` (`ssh-keygen`, add the public key on the target, `ssh` once to accept the host key). Prune on the target side.
- `PP_BACKUP_GPG_RECIPIENT` is **required** for `s3` and `rsync`: `offsite.sh` refuses to send plaintext (override only with `PP_OFFSITE_ALLOW_PLAINTEXT=true`, a recorded LEAD decision) and checks the key with `gpg --list-keys`. Generate the key pair on the LEAD's own machine, import only the PUBLIC key for the deploy user (`gpg --import public.asc`), and **keep the private key off the server** (a break-in must not read old copies). Write down where the private key and its passphrase are kept: without them the off-site copies are unreadable.
- `none` is accepted only until the target exists; every run logs a loud warning and `deploy.sh` warns too.

**Restore drill and evidence (BE-33 AC7).** `deploy/vps/backup/restore-drill.sh` wraps `scripts/db-restore-check.mjs`; it does not duplicate it:

```
deploy/vps/backup/restore-drill.sh --operator "<name of the person running or witnessing it>"
```
1. Stops the api (the only writer) so the database is idle, because the check compares the exact row count of every table of the LIVE database with the restored copy.
   Users get an error page for roughly one to three minutes: run it in a quiet window. (`--no-quiesce` exists for a database nobody writes to, e.g. staging or a rehearsal; on a live database mismatches can then be false alarms.)
2. Takes a fresh dump (`backup.sh --tag drill --no-offsite --no-files`).
3. `node scripts/db-restore-check.mjs --file <dump> --container <db>`: verifies the sha256 sidecar, restores into the throw-away database `<db>_restorecheck`, compares every public table, drops it. The script refuses any other target name, so the main database is never touched.
4. Starts the api again (also after a failure), writes the evidence file, alerts on FAIL.

Evidence file `<PP_BACKUP_DIR>/drill-evidence/restore-drill-<UTC stamp>.txt` (`latest.txt` points at the newest). **Fixed format `PP-RESTORE-DRILL-EVIDENCE v1`**, real output of the rehearsal on local PostgreSQL 16.15:

```
PP-RESTORE-DRILL-EVIDENCE v1
timestamp_utc: 2026-10-21T14:57:02Z
dump_file: pp-backup-20261021T145702Z-drill.dump
dump_sha256: 52e9baf1be8a9f82f10a2b66949218b5cc8bb1b4e478ffbd518518b4142c877b
dump_size_bytes: 21926
postgres_version: 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
tables_restored: 4
prisma_migrations_rows: 33
rows_restored: 1753
row_count_comparison: PASS (4 source tables, 4 restored tables, 1753 rows restored, 0 mismatches)
duration_seconds: 2
writers_quiesced: api stopped for the duration of the drill
result: PASS
operator: Rehearsal Operator (fictitious)
```
Fields: UTC time, dump file name and sha256, size, server version, tables restored, `_prisma_migrations` rows, total rows restored, the row-count comparison result, duration, quiesce mode, `PASS`/`FAIL` (a FAIL adds `failure_reason:`), operator
(default `OPERATOR-NAME-TO-FILL-IN` if `--operator`/`PP_OPERATOR` is not given: write the name in by hand). Attach the file (not the dump) to the BE-33 AC7 evidence and keep it with the ops log.

**Retention and erasure rule (`LEAD:` decision, proposed default 35 days).** Backups contain personal data of minors, so they must not live forever. Proposal: nothing older than **35 days** exists anywhere
(local `PP_BACKUP_MAX_AGE_DAYS=35`, enforced by `backup.sh` after each successful run; off-site: a bucket lifecycle rule or a prune on the rsync target of the same 35 days, plus the GPG-encrypted copies expire together).
Consequence the LEAD must accept: a deletion request is satisfied in the live database at once but the data remains in backups up to 35 days; a restore re-applies the deletions made since (record them).
Real-data migration dumps follow the shorter 7-day rule of the migration runbook.

**Cadence.** First drill right after the first install (empty-ish database) and again after the data migration; then monthly (first working day) on the newest scheduled backup, per [db-backup.md](db-backup.md);
`pp-restore-drill.timer` can automate the monthly run once two manual drills passed. A failed drill blocks releases until a good backup exists. Also restore one off-site copy to a scratch host once, to prove the off-site path and the GPG key work.

---

## 10. Monitoring and alerts

| Layer | Tool | Setup |
|---|---|---|
| External uptime | A checker outside the VPS on `https://$PP_DOMAIN/api/health` and `/api/ready` (and the SPA `/`), 1 minute, alert after 2 failures | `LEAD:` account (healthchecks.io, UptimeRobot, Better Stack or similar; free tiers exist). A page that is down must be seen from outside, not only from the server |
| Dead man's switch, backup | `PP_HEALTHCHECK_PING_URL` | `backup.sh` pings `/start`, then success or `/fail`. Configure the check with a 26 h period + 2 h grace: a silent or dead backup alerts at the provider |
| Dead man's switch, probe | `PP_HEALTHCHECK_PROBE_URL` | `health-probe.sh` pings success every 5 minutes (period 10 min); a dead server or probe alerts at the provider |
| Local probe | `deploy/vps/monitoring/health-probe.sh` (timer, every 5 minutes) | Alerts on: `/api/health` or `/api/ready` not 200 through the public name; a compose service not running or unhealthy; disk of `/`, the Docker root, the backup dir >= `PP_ALERT_DISK_PCT` (85); certificate < `PP_ALERT_CERT_DAYS` (21) days; newest dump older than `PP_ALERT_BACKUP_MAX_AGE_H` (30 h); API error lines in 5 minutes >= `PP_ALERT_API_ERRORS_5M` (25). The same problem alerts once, then every 6 h while it lasts; a new problem alerts at once |
| Alert delivery | `PP_ALERT_WEBHOOK_URL` (a generic webhook: ntfy, a Slack-compatible incoming webhook) | `LEAD:` channel and who receives it. Failed systemd units (`OnFailure=`) and failed deploys/rollbacks use the same path; without a webhook they still appear in `journalctl -t` / the unit log |
| Status page and checks (optional) | Uptime Kuma, profile `monitoring` | `PP_PROFILES=monitoring`; listens on `127.0.0.1:3001` only: `ssh -L 3001:127.0.0.1:3001 ppdeploy@host`, open `http://127.0.0.1:3001`, create the admin user on first visit, add HTTP monitors for `/api/health` and `/api/ready` with a keyword check on `"status":"ready"`, certificate-expiry notification, and notification targets. Do not publish it behind the edge without authentication in front. It sits on its own network (`monitor`), cannot reach `api` or `db`, runs with `cap_drop: ALL` and `no-new-privileges`; it probes the public name through the edge |
| Metrics | `/api/metrics` (Prometheus text) | Blocked at the edge. Admin session or an internal peer only. If Prometheus is added, join it to the compose network and set `METRICS_INTERNAL_CIDRS` to that network |

Alerts required by the task and where they come from: **disk usage** (probe), **backup failure** (backup.sh alert + `/fail` ping + backup-age check + dead man's switch), **certificate expiry** (probe + renewal failure alert + Let's Encrypt e-mail), **service down** (probe + external checker).

### Error tracking (Sentry): default A applied 22 Oct (section 20)

State: `apps/api` has **no Sentry SDK and no DSN variable** (searched `apps/api`, `packages`, `src`; the only hit is a word inside a vendored PDF-engine comment). Go-live checklist item D-4.

| Option | For | Against |
|---|---|---|
| A. None for 30 Oct | No new data processor; no code change; nothing leaves the server (PDPA, minors); the probe already alerts on bursts of API error lines; structured logs carry `requestId` | No grouped stack traces or release tracking; errors are found by reading logs |
| B. Sentry SaaS | Best tooling, free tier | Stack traces and breadcrumbs can contain personal data; Sentry hosts only in the US or EU, so a cross-border transfer for data on Malaysian minors; needs an SDK + scrubbing change in the API (backend-developer) and a DSN secret |
| C. Self-hosted GlitchTip (Sentry-compatible) | Data stays on infrastructure the LEAD controls; works with the Sentry SDK | Same SDK change as B; its own stack (web, worker, Postgres, Redis: about 1 GB RAM) to run, patch and back up; competes with the app for the VPS |

**Recommendation (and the default if the LEAD does not answer): A, no error tracker for 30 Oct**, and re-decide after the first week with real error volume; if one is wanted then, C on a second small
host (not the app VPS), or B only after a PDPA review and a scrubbing change. Either B or C needs a backend-developer card first (SDK init behind an env flag, `beforeSend` scrubbing of cookies, headers,
bodies, IC, e-mail). No infrastructure for it is included in this pack.

---

## 11. Logs and rotation

| Where | What | Rotation |
|---|---|---|
| `docker compose logs <service>` | api (one JSON line per event, pino; secrets, cookies, CSRF, Referer and invite tokens redacted), edge access log (invite tokens redacted, no Referer), db, migrate | Docker `json-file`: 5 files x 20 MB per container, compressed (`PP_LOG_MAX_FILE`, `PP_LOG_MAX_SIZE`) |
| `journalctl -u pp-backup.service` etc. | Backup, probe, drill, renewal when run by systemd | journald; set `SystemMaxUse=500M` in `/etc/systemd/journald.conf` |
| `/var/log/pretasiplus/*.log` | Same jobs when run by cron | `deploy/vps/logrotate/pretasiplus` (weekly, 8 kept, compressed): `sudo install -m 644 deploy/vps/logrotate/pretasiplus /etc/logrotate.d/pretasiplus` |
| `/srv/pretasiplus/letsencrypt-log` | certbot | same logrotate file (monthly) |
| `PP_STATE_DIR/history.log` | deploy and rollback history | tiny; keep |
| Audit trail | table `audit_events` | in the database (not a log file) |

Useful: `docker compose ... logs --since 15m api | grep '"level":50'` (errors); follow one request by `requestId` (also the `X-Request-Id` response header); the edge log line carries `rid=`.

---

## 12. Secrets

- Secrets exist only in `/etc/pretasiplus/*.env` (and the operator's password manager / the LEAD's vault). Never in the repo, in build args (`VITE_*` are public), in chat or in an issue.
- Rotation procedure and effects per secret: [api-runbook.md](api-runbook.md) section 13 (`SESSION_SECRET` logs everyone out; `IC_HASH_KEY` **breaks IC lookups until every hash is recomputed: do not rotate without a plan from the backend developers**;
  `DATABASE_URL`/`POSTGRES_PASSWORD` need `ALTER ROLE` because `POSTGRES_PASSWORD` only applies at first init).
- On this stack a rotation is: `sudoedit /etc/pretasiplus/api.env` (and `db.env` + `ALTER ROLE` for the database), then `docker compose ... up -d --force-recreate api`, check `/api/ready` and one login, delete the old value. LEAD confirmation first.
- Suggested schedule: every 90 days and after any suspected leak; a leaked secret or dump is reported to the LEAD the same day (PDPA).
- CI/CD tokens: this pack adds none. Deploys are run by the deploy user on the server (no CI deploy token with access to production exists). If a CI deploy is added later: a dedicated key, restricted to `deploy.sh` through a forced command, no registry write scope.

---

## 13. Sizing and load test

**Everything in this section is an assumption until a k6 run on a production-sized staging box replaces it.** The method is simple so it can be checked: requests per second from users, CPU from requests, memory from component limits.

### Assumptions

| # | Assumption | Source / basis |
|---|---|---|
| A1 | **N** = pupils signed in and active at the same time in the busiest hour. Not the enrolled number | definition |
| A2 | An active pupil makes **12 API requests per minute on average** (0.2 req/s): a dashboard load is about 5 calls, and an exam attempt autosaves about once per 10 s while answering. The SPA debounces autosave at 800 ms per change (`src/modules/m28-bijak-spm/lib/autosave.ts`); one save per 10 s is an assumed answering pace. The API allows 240 saves/min per user (`THROTTLE_BIJAK_ATTEMPT_SAVE_PER_MINUTE`) | code + assumption |
| A3 | **Peak = 2 x average** for a few minutes after a teacher starts a class exercise (everybody logs in, lists papers, starts an attempt) | assumption |
| A4 | One Node process serves about **200 req/s** of this mixed, database-backed workload before its main thread saturates (about 5 ms of JavaScript + driver time per request; one core) | assumption; k6 replaces it |
| A5 | A login costs about 100 ms of CPU (argon2id / bcrypt run off the main thread, in libuv's pool of 4); a lesson-start wave of N logins in 2 minutes = N/120 logins per second | assumption |
| A6 | 2.5 SQL queries per request, 0.4 ms each on cached data, so Postgres needs about 1 core per 800 req/s | assumption |
| A7 | API memory: 250 MB base + in-memory multipart buffers (an intake upload is held fully in memory: up to 220 MB, `INTAKE_UPLOAD_CONCURRENCY`=2, so about 450 MB) + OCR workers (`OCR_WORKERS`=2 x `OCR_WORKER_RSS_LIMIT_MB`=512 = about 1 GB, only when `OCR_ENGINE=tesseract`) | `.env.api.example` |
| A8 | ClamAV (clamd) holds the signatures in memory: **1 to 1.5 GB resident**, 2 GB limit to survive a reload | upstream behaviour |
| A9 | Disk: 25 GB for OS, images, build cache and logs; database `pgdata` per N: 1 / 3 / 10 / 30 GB in the first year; uploads `apifiles`: 5 / 10 / 20 / 40 GB; local backups = 21 dumps (7 daily + 4 weekly + 5 pre-deploy + 5 drill) at 0.3 x `pgdata` each + 2 uploads archives. Total = 25 + 7.8 x pgdata + 3 x uploads | assumption |
| A10 | Postgres: `shared_buffers` = 25% of the database container's memory; `effective_cache_size` = 50%; the API pool is 10 connections per process (`pg` default), so `max_connections` 100 is ample for one API | Postgres practice; `apps/api/src/db/client.ts` |

### Table

| N (pupils at once) | req/s avg / peak | API processes needed (A4, peak) | vCPU | RAM, core stack | RAM with ClamAV + Kuma | Disk | Where the numbers come from |
|---|---|---|---|---|---|---|---|
| **100** | 20 / 40 | 1 | **2** (4 with ClamAV) | **4 GB** | 8 GB | **60 GB** | API 1 CPU / 1-2 GB; db 0.5-1 CPU / 1 GB; edge, frontend small; OS 1 GB |
| **300** | 60 / 120 | 1 | **4** (6 with ClamAV) | **8 GB** | 16 GB | **100 GB** | API 1.5 CPU / 2 GB; db 2 CPU / 2 GB |
| **1,000** | 200 / 400 | **2 at peak: beyond the single-instance rule** (1 only if load is smooth) | **8** | **16 GB** | 16 GB | **200 GB** | API 2 CPU / 3 GB (main thread saturates near 200 req/s); db 3 CPU / 4 GB |
| **3,000** | 600 / 1,200 | **3 to 6: needs the shared rate-limit store first** | 16 (indicative) | 32 GB (indicative) | 32 GB | 400 GB | API x3 (6 GB), db 6 CPU / 12 GB; put the database on its own host |

Reading it:
- **The single-instance rule is the real cap.** One API process (section 14) tops out near 200 req/s (A4), which is about **500 simultaneous pupils at 2 x peak, 1,000 only if load is smooth**. Adding vCPU does not help the JavaScript main thread. For more than that, the rate-limit counters must move to a shared store first (backend card; threat model row 18), then more API instances. A bigger VPS is not the fix.
- RAM sums use the component limits: API + db + edge (0.25 GB) + frontend (0.125 GB) + OS (1 GB), rounded up to the next standard size with about 20% headroom; "with ClamAV + Kuma" adds 2 GB + 0.5 GB.
- vCPU is the sum of the CPU limits (API + db + edge + frontend) rounded up; ClamAV adds 1 for scans and signature reloads.
- Disk is dominated by backups (A9). Cutting `PP_BACKUP_KEEP_*` or moving old copies off-site shrinks it.

### Settings per size (`prod.env`)

| N | `PP_API_CPUS` / `MEM` / `HEAP_MB` | `PP_DB_CPUS` / `MEM` | `PP_PG_SHARED_BUFFERS` | `PP_PG_EFFECTIVE_CACHE_SIZE` | `PP_PG_WORK_MEM` | `PP_PG_MAINTENANCE_WORK_MEM` | `PP_PG_MAX_CONNECTIONS` |
|---|---|---|---|---|---|---|---|
| 100 | 1 / 1g / 768 (2g / 1536 if OCR is on) | 1 / 1g | 256MB | 512MB | 4MB | 64MB | 100 |
| 300 | 1.5 / 2g / 1536 | 2 / 2g | 512MB | 1GB | 8MB | 128MB | 100 |
| 1,000 | 2 / 3g / 2304 | 3 / 4g | 1GB | 2GB | 8MB | 256MB | 100 |
| 3,000 | per API instance 2 / 3g (after the shared store) | 6 / 12g | 3GB | 6GB | 16MB | 512MB | 200 |

`PP_EDGE_MEM` (512m default): nginx workers and TLS are small, but 4 concurrent big uploads are buffered on the disk volume `edgetmp` and still stream through worker memory; keep at least 512m, and give the VPS 5 to 10 GB of disk headroom for the request-body buffers. `PP_DB_SHM` stays 256m. `shared_buffers` + `maintenance_work_mem` + connections x `work_mem` must stay well below `PP_DB_MEM`.

### Load test (k6)

`deploy/vps/loadtest/pupil-load.k6.js` (guide: `deploy/vps/loadtest/README.md`): login, dashboard/papers reads, an exam attempt with autosave every 10 s, submit, result. Run it
against a **staging box of the same size**, never against production without the LEAD's say-so (the script refuses unless `LT_CONFIRM_TARGET` equals the target host).
Pass thresholds tied to the table: read p95 < 500 ms, autosave p95 < 400 ms, login p95 < 3 s, error rate < 0.5%, **zero 429**, checks > 99%; and during the run the API container stays under 70% of its CPU limit and 80% of its memory limit.
Start at N, then 1.5 x N: where p95 crosses the threshold is the real capacity; replace A4 with that number.

**Throttles vs one load generator.** The API throttles per client address: `THROTTLE_GLOBAL_PER_MINUTE` = 300 requests per minute per address on every `/api` route (3000 in production, section 20), login 5 per minute per identifier and address.
A single-IP generator hits the global ceiling within seconds and then measures the limiter. Do not change production values: either run on staging with `THROTTLE_GLOBAL_PER_MINUTE=1000000` in its `api.env`
(per-user limits can stay), or spread the load over several source addresses. The same ceiling is a **production risk** for schools (finding F2).

---

## 14. Single-instance rule

The API keeps its rate-limit counters (and the AI provider limits) in process memory; only the login throttle is in the database (threat model row 18, accepted by the LEAD on 2026-10-21 on the condition that the API runs as ONE instance).

- `api` is one container. `compose.prod.yaml` has no `deploy.replicas`, and says so in a comment next to the service. **Never** add `replicas`, `docker compose up --scale api=N`, a second stack on the same database, or a second host running the API.
- A shared store (Redis, or a Postgres counter table behind `RateLimiter.consume`) is required before scaling out; that is a backend-developer card. Until then, scale up (section 13), not out.
- **Go-live (30 Oct) is single-instance on the VPS. This is the accepted go-live limit (LEAD decision A on #190, 2026-10-22); scaling out needs the shared store first** (Redis, or a Postgres counter table behind `RateLimiter.consume`).
- **Guard.** `deploy.sh` preflight (also in `--dry-run`, read-only, no root) refuses the deploy with "api must run as ONE instance (threat model row 18, runbook section 14)" when the rendered production config gives the `api` service `deploy.replicas` or `scale` other than 1, or when more than one `api` container of this compose project is already running (a leftover `--scale api=2`). It also refuses `PP_JOBS_WORKER_ENABLED` set to anything but true, because the single instance is the worker. It prints names and counts only. It cannot see a second host or a second stack on another project name: those stay a rule.
- `JOBS_WORKER_ENABLED=true` runs on exactly this one instance (`PP_JOBS_WORKER_ENABLED`). With a second instance, exactly one must have it `true`.
- A restart resets the in-memory counters; a deploy therefore briefly resets rate limits. Accepted.
- During a deploy the API is recreated: for the few seconds of the swap the edge returns 502 for `/api` (the SPA stays up). Deploy outside exam windows.

---

## 15. ClamAV

State: threat model rows 43 and 18, SH-02, backlog #78. **ClamAV or an equivalent is required before production go-live** (the LEAD accepted "no scan" for demo and staging only). The scan code in the API is half AM's;
**the API does not read any scan setting yet.**

This pack provides the environment:
- Compose profile `clamav`: service `clamav` (`clamav/clamav:1.4`, pinned by `PP_CLAMAV_IMAGE`), clamd on the internal network at `clamav:3310`, signature volume `clamdb`, health check `clamdcheck.sh` (first start downloads and loads the signatures: up to 5 minutes),
  `CLAMD_CONF_ConcurrentDatabaseReload=no`, `MaxFileSize`/`StreamMaxLength` 32 MB (above the 20 MB intake ceiling), memory limit `PP_CLAMAV_MEM` (2g), CPU `PP_CLAMAV_CPUS` (1).
- Enable with `PP_PROFILES=clamav` in `prod.env`, then `deploy.sh`.
- **Reserved env names, read once the half-AM card lands:** `CLAMAV_HOST=clamav`, `CLAMAV_PORT=3310`. They are only comments in `.env.prod.example`. Do not add them to `api.env` before the card: `env.schema.ts` does not know them and a test keeps `.env.api.example` equal to the schema.
- Until the card lands, clamd runs but nothing calls it. Check it is alive: `docker compose ... ps clamav` shows `healthy` (the image's `clamdcheck.sh` health check asks clamd to answer).
- **Go-live gate:** no pupil or teacher uploads in production until the #78 ClamAV wiring lands, **or a recorded LEAD risk acceptance** (a dated line in the cutover log). Intake is admin-only at go-live (AZ-29 item 7, card AZ-35); the gate still covers the other pupil and teacher upload routes (section 20). It is an explicit go/no-go item in section 16. `clamav` runs on its own network `scan` (add `scan` to the api service when the card lands) with `cap_drop: ALL` plus the few capabilities its entrypoint needs.
- ClamAV needs outbound HTTPS to the ClamAV mirrors for signature updates (freshclam). Cost: 1 to 1.5 GB RAM (section 13).

---

## 16. Cutover 30 Oct: the AZ side

The data-migration steps (freeze, dump import, dry-run, apply, delta, reconciliation) are owned by half AM (BE-28/29/30, `docs/architecture/v2-migration-runbook.md`, `v2-data-migration.md` section 5; BE-29 and BE-30 are not merged at the time of writing, OD-10 and
decision D-3 "is migration needed at go-live" are open, see [go-live-bijak-spm.md](go-live-bijak-spm.md) section 2.3). This is the infrastructure sequence around that slot. Times are relative to the go-live moment **T0** (`LEAD:` fixes T0).

| When | Step | Owner | Done when |
|---|---|---|---|
| T-7 d | `LEAD:` VPS provisioned, SSH access, domain bought, off-site **S3-compatible bucket and write key** created (section 20) and alert channel chosen; sizing profile chosen (section 13) | LEAD | accounts exist |
| T-5 d | Server hardened (section 2); repo cloned; env files written (section 4); `deploy.sh --dry-run` passes | AZ | `preflight passed` |
| T-4 d | `init-cert.sh --dry-run` on the real name, then the real certificate (DNS must already point at the VPS, or use a temporary name) | AZ | `https://` works with a valid certificate |
| **T-2 d** | **Infrastructure ready**: full deploy of the release candidate on the production box under its real name (no pupils yet), `--seed-reference`, smoke test (section 7), ufw check (`ss -tlnp`), timers installed, external uptime checker and dead-man's-switch URLs live, a test alert delivered end to end (stop the backup timer's ping URL and see the provider mail, or `monitoring/alert.sh "test"`) | AZ | smoke test 100% pass; test alert received. `api.env` keeps `REGISTRATION_OPEN=false`: the smoke test expects 403 on `curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' https://$PP_DOMAIN/api/auth/register` |
| T-2 d | First **backup + restore drill** on the production box; evidence file kept; one off-site copy restored on a scratch host | AZ | `result: PASS`, off-site copy restores |
| **T-2 d** | **DNS TTL lowered** to 300 s (48 h before the switch) on the records that will change | LEAD | `dig` shows TTL <= 300 |
| **T-2 d** | **Decide D-7 (SPA CSP) before go-live**: check the report-only policy in a browser on staging (video embeds, article images, audio player), then set `PP_CSP_MODE=enforce` (and `PP_CSP_IMG_HOSTS`) or record the LEAD's decision to stay on `report-only`/`off` | LEAD + frontend | decision recorded |
| T-1 d | Load test on a staging box of the same size at 1 x and 1.5 x the expected N (section 13), with the section 20 values (`THROTTLE_GLOBAL_PER_MINUTE=3000`, edge auth 300r/m burst 120): zero 429 from one source address at the class-login wave; go-live checklist items 17-19 closed or waived in writing | LEAD + AZ | numbers recorded |
| T-1 d | Freeze announced: no merges after the release tag; the release SHA in `deploy.sh --dry-run` equals the tag the LEAD approved | LEAD | tag recorded |
| T-2 h | Rollback readiness: previous image tag present (`previous.tag`), disk free > 30%, last scheduled backup < 24 h old and off-site, operator awake and `sudo`-capable, on-call phone list | AZ | checklist ticked |
| **T-1 h** | **Pre-cutover backup**: `deploy/vps/backup/backup.sh --tag pre-deploy` (dump + sha256 + off-site copy), verify the off-site copy is there; record file name and sha256 in the cutover log | AZ | file and hash recorded |
| T-1 h | **Deploy / migrate**: `deploy/vps/deploy.sh` (confirmation typed by the LEAD's go): builds, runs the schema migrations, starts the release. Health checks pass through the edge | AZ | `deploy complete` |
| **T0 slot** | **Half-AM migration slot**: AM runs the BE-30 orchestrator against this database (freeze window, dry-run, `--apply` with its `PP_ALLOW_MIGRATE_APPLY` / `PP_MIGRATE_TARGET_DB` guards, delta run, reconciliation). AZ keeps the API reachable only to the team (DNS not switched yet), watches `docker stats`, `logs api`, disk and `pg_stat_activity`, and **takes a second dump right after the load** (`backup.sh --tag pre-deploy`) so the migrated state is restorable. How AM runs the tooling on the VPS (for example `docker compose ... run --rm --no-deps -e PP_ALLOW_MIGRATE_APPLY=1 -e PP_MIGRATE_TARGET_DB=<db> migrate <command>` from the `migrate` image, which has the tooling) is **unverified** and agreed with AM before T-2 d | AM (runs), AZ (supports) | reconciliation green (AM's report); dump taken |
| T0 + 15 min | **Smoke test** on the real name through the edge (section 7 list), including login of a migrated account, a Bijak attempt, an upload, the throttle/XFF check from two networks, the metrics 404 | AZ + QA | all pass |
| **T0 + 30 min** | **Go / no-go** (below). On go: **DNS switch** (change the A record to the VPS (no AAAA record); they should already be, in which case this is lifting the access restriction). Announce | LEAD | decision logged |
| T0 + 30 min, on go | **Open self-registration** (after the DNS switch). As the deploy user, from the repo checkout: `sudoedit /etc/pretasiplus/api.env` and set `REGISTRATION_OPEN=true`; then recreate only the api: `PP_IMAGE_TAG=$(cat /var/lib/pretasiplus-deploy/current.tag) docker compose -f compose.yaml -f deploy/vps/compose.prod.yaml --env-file /etc/pretasiplus/prod.env up -d --no-deps --force-recreate --wait api` (`PP_IMAGE_TAG` keeps the running release; without it compose falls back to the `prod` tag; add `--profile ...` if `PP_PROFILES` is set). Check: `curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' https://$PP_DOMAIN/api/auth/register` gives 422 (open; an empty body creates nothing) instead of 403 (closed); `/api/ready` 200. Rollback: close again with the same edit (`false`) and recreate | AZ (LEAD gives the go) | probe 422, `/api/ready` 200 |
| T0 + 30 min to +4 h | **Monitoring watch**: the operator watches the uptime checker, the probe, `logs api | grep '"level":50'`, 429 rates, CPU and memory against the 70% / 80% lines, p95 from the edge log (`rt=`), disk growth. First 4 hours continuous, then the normal alerts | AZ | no trigger hit |
| T0 + 1 d | Nightly backup + off-site verified; certificate renewal dry run (`certbot renew --dry-run`); capacity review against the sizing table; post-cutover drill after the first full backup | AZ | recorded |

**Go / no-go (infrastructure part)** - go only if all hold: **uploads gate: no pupil/teacher uploads are enabled in production until the #78 ClamAV wiring has landed, or the LEAD has recorded a risk acceptance in the cutover log**; `/api/ready` 200 and the smoke test 100% on the real name; backup taken within the last hour and its sha256 recorded, off-site copy present, last restore drill PASS; certificate valid > 60 days;
external checker, probe, dead-man's switches and the alert channel proven by a test alert; no Critical/High open from QA or security; migrated-data reconciliation green (AM) when D-3 = yes; disk > 30% free; the operator and the LEAD reachable for the next 4 hours.
No-go on any failure. The application-side go/no-go list is in [go-live-bijak-spm.md](go-live-bijak-spm.md) section 4.3.

**Rollback triggers (after the DNS switch)** - any of: `/api/ready` not 200 for more than 5 minutes; sustained 5xx above 2% for 10 minutes; login failing for migrated accounts; data-integrity finding (wrong counts, someone seeing another school's data); CPU or memory pinned at the limit with p95 > 3 s for 10 minutes and no quick fix; certificate or TLS failure that the operator cannot fix in 15 minutes.
Action: the LEAD decides. (1) Image problem only: `rollback.sh --checkout` (section 8). (2) Data problem: put the old system back in front by DNS (the TTL is 300 s; the old systems are never modified, decision D28a), keep the new database untouched for analysis, restore only with the LEAD's confirmation (section 8).
Writes made on the new system after the DNS switch exist only there: say so in the decision.

---

## 17. Findings for the developer roles

Found while building this pack; AZ does not change application code.

| # | Finding | For | Severity |
|---|---|---|---|
| F1 | **Default applied 22 Oct (section 20): migrated `.cloud` admins; a bootstrap command card is still needed as the fallback and for a locked-out last admin.** **No way to create the first Admin Pusat account in production.** The demo seed is refused in production (correct), the production seed loads reference data only, and there is no bootstrap command in `apps/api`. Unless the data migration (BE-28) brings an admin, go-live has nobody who can publish papers. Needs a one-off, audited "create first admin" command (password from the environment, not the command line) or a documented migration step | backend-developer | High (go-live blocker) |
| F2 | **Default applied 22 Oct (section 20): `THROTTLE_GLOBAL_PER_MINUTE=3000`, edge auth 300r/m burst 120.** **`THROTTLE_GLOBAL_PER_MINUTE=300` is per client address.** A school (a class of 40 on one NAT address at about 12 requests per minute each = 480) exceeds it, and then every request from that school is 429. The login failed-attempt limit of 20 per minute per address (fixed) is similar. LEAD decision OQ1 (rate-limit numbers) must raise it for production or key signed-in routes on the user | backend-developer, LEAD | High |
| F3 | Many-file multipart routes exceed the staging frontend nginx limits (`/api/` 3 MB, `/api/files` 22 MB): `POST /api/admin/audio-kbat-sets` (80 MB), `/api/intake/batches/:id/files` (220 MB), `/api/admin/screenshots` (200 MB), `/api/guru/question-papers` (101 MB), `/api/perutusan`, plus 5 MB photo routes would get 413 on the staging stack. The production edge handles them; `docker/frontend/nginx.conf` (staging) does not. Not changed here | devops (follow-up on staging), qa-engineer | Medium |
| F4 | `REQUEST_TIMEOUT_MS=120000` covers the whole request, so a 220 MB upload must arrive within 2 minutes (about 15 Mbit/s). The runbook suggests up to 300000 for slow links; the edge already allows 300 s upstream on those routes. LEAD to decide per intake behaviour | LEAD, backend-developer | Low |
| F5 | The API buffers multipart bodies in memory (multer memory storage): 220 MB x `INTAKE_UPLOAD_CONCURRENCY`=2 means API memory spikes of about 450 MB (included in the sizing) | backend-developer | Info |
| F6 | `apifiles` (uploads) is not in the database dump. This pack archives it weekly; pupil photos grow it. A plan for object storage or incremental backup is a later improvement | devops | Info |
| F7 | ClamAV: the scan code is not in the API yet (half AM). Reserved env names `CLAMAV_HOST` / `CLAMAV_PORT` | half AM (backlog #78) | High before go-live per row 43 |
| F8 | No error tracking in the API (section 10). **Default A applied 22 Oct: none for 30 Oct, re-decide after week 1** | LEAD | Default applied |
| F9 | SPA CSP decision D-7; the pack ships report-only (explicit T-2 d item in section 16). **Default applied 22 Oct: report-only at go-live** | LEAD, frontend-developer (verify the policy in a browser) | Default applied |

---

## 18. Not rehearsed here

The build environment has **no Docker daemon, no k6, no ClamAV, no public network path** and may not touch any real server or the cloud demo. Rehearsed for real: compose rendering (`docker compose config -q`, with and without each profile),
the edge nginx config (`nginx -t` and a live behaviour test against stub upstreams), the backup, retention and restore-drill scripts against a local PostgreSQL 16.15 (through a stand-in for `docker exec`), the deploy dry run and its guards, the health probe, `shellcheck` on all scripts, and the k6 script logic against a stub API (with a stand-in `k6` module).

**Not run, so unproven until the first real run:**
- **Verify on the first VPS rehearsal (added after G4 round 2):** (a) that `ppdeploy` really cannot read `$PP_LE_DIR/live` and that the preflight and the health probe then read the certificate through `docker compose exec -T edge cat` (or that your `chgrp`/`chmod 750` group-read step works); (b) the systemd hardening (`NoNewPrivileges`, `ProtectSystem=full`, `PrivateTmp`, `ProtectHome=read-only`, `ReadWritePaths`) with a real `systemctl start pp-backup.service pp-health-probe.service pp-cert-renew.service` and `journalctl -u`: the docker CLI must still reach the socket and `/run/lock` must be writable; (c) a failed deploy on staging (stop the api healthcheck on purpose) followed by `rollback.sh <old tag>` and `rollback.sh --previous`, with the real `docker inspect` of the api container (the rehearsal used a stand-in); (d) a second `deploy.sh` or `backup.sh` started while one runs gets the lock message; (e) `limit_req` on `/api/auth/` with the real client address (it must not trip for a normal school); (f) `systemctl start pp-backup.service` with `PP_OFFSITE_KIND` set and the key imported for `ppdeploy`: `gpg --encrypt` must work under `ProtectHome=read-only` (gpg writes `~/.gnupg` lock and trustdb files; if `ppdeploy`'s home is under `/home`, add that `.gnupg` to `ReadWritePaths` or move the home); (g) `curl -sI https://<domain>/` and `/api/health` each show exactly one `Strict-Transport-Security` header equal to `PP_HSTS`.
- `docker compose up` of any service: image builds, the `migrate` job on the VPS, container health, `--wait`, the real `read_only`/`cap_drop` behaviour of the edge (root master + capabilities), the tmpfs-rendered nginx template, the compose `!reset []` effect on a real engine (rendered correctly by `config`), resource limits taking effect.
- TLS: certificate issuance (`init-cert.sh`, including the `--dry-run` path and the placeholder swap), renewal, HTTP/2 (the host nginx is 1.24, the image 1.27; `http2 on;` was removed for the host test), real browser behaviour of the CSP.
- `deploy.sh` and `rollback.sh` beyond `--dry-run` (builds, migrate, recreate, health checks through a real edge, the typed confirmation).
- The restore drill with the real `docker compose exec` path and with the api stop/start (rehearsed with stand-ins), and the uploads archive through the api container (`tar` inside the read-only image, rehearsed locally only).
- Off-site copy (`aws s3 cp`, `rsync`, `gpg`), healthchecks pings, webhook alerts, Uptime Kuma, the systemd timers' actual firing (units were syntax-checked with `systemd-analyze`), logrotate.
- ClamAV container start, signature download, memory use, and any scan (the API does not call it yet).
- k6: the real `k6 run`, the thresholds against real numbers, and the sizing table.
- The 30 Oct cutover itself, the half-AM migration slot (not built), and DNS.
- The sizing assumptions A1-A10.

---

## 19. Troubleshooting

| Symptom | Likely cause / action |
|---|---|
| `deploy.sh`: `placeholder value for X` | An example value is still in the env file. Names only are printed; edit with `sudoedit` |
| `deploy.sh`: `no certificate for ...` | Run `deploy/vps/tls/init-cert.sh` first |
| `nginx: [emerg] cannot load certificate` in the edge log | The certificate files are missing or unreadable; the edge runs as root master, check `PP_LE_DIR` and the path `live/$PP_DOMAIN/` |
| Edge starts but `/api` is 502 | `api` is not healthy: `docker compose ... ps`, `logs api` (a boot refusal names the key, never the value) |
| `/api/ready` 503, `/api/health` 200 | Database or a migration: `logs db`, `logs migrate`; do not restart-loop the API |
| Many 429 for a whole school | `THROTTLE_GLOBAL_PER_MINUTE` per address (finding F2), or `TRUST_PROXY_HOPS` wrong (everyone one address) |
| Upload gives 413 at the edge | A route not in the tier regexes (section 5) or `PP_UPLOAD_*` too low |
| `backup.sh`: `service "db" is not running` | `docker compose ... up -d db` |
| `restore-drill.sh`: row-count mismatch | Writes happened between dump and check: run with the api stopped (default), not `--no-quiesce` |
| Disk full | `docker system df`, old images (`docker image prune` keeps tagged ones in use; keep the last two releases), backup dir, Docker logs |
| After a reboot nothing is up | `restart: unless-stopped` needs the Docker service enabled: `systemctl enable docker` |

---

## 20. Defaults applied on 22 Oct (LEAD may veto)

The LEAD DECISION of 22 Oct 2026, 10:30 MYT (#113) told AZ-DevOps to apply the recommended defaults of this pack to
the open items and list them, so the LEAD can veto any line. A veto is one line on #113; AZ-DevOps then changes this
section, the example files and the checks. **The VPS size stays parameterised** (section 13) until the LEAD gives the
specs.

| # | Item | Default in force | Where it is set | What the LEAD still supplies |
|---|---|---|---|---|
| F1 | First Admin Pusat in production | The first Admin Pusat accounts are the **migrated `.cloud` admins** (MIG-08 load option A: `migrate:all --apply` on 29 Oct brings `admin` users with a national scope; their password hash is carried, or they must reset it). At the T-1 check (cutover plan step A10) the LEAD confirms that at least **two** active Admin Pusat accounts exist (a second one is the break-glass path for a locked-out admin) and signs in with his own. No demo seed, no raw SQL | Cutover plan (#124) A10; this runbook section 4 step 11 | His own admin account on `.cloud`. A fallback is still needed if no admin migrates, and for a locked-out last admin: a one-off, audited bootstrap/reset command (backend card, to be assigned by the LEAD) |
| F2 | Throttle behind a school NAT | `THROTTLE_GLOBAL_PER_MINUTE=3000` (about 250 active pupils on one address at 12 requests per minute each); edge `PP_EDGE_AUTH_RATE=300r/m`, `PP_EDGE_AUTH_BURST=120` (a class of 40 signing in at once). Per-user and per-route buckets unchanged. The fixed login limit of 20 failed attempts per minute per address stays (code); it counts failures only | `api.env.example`, `.env.prod.example`, compose defaults; `deploy.sh` warns below 3000 | Nothing. The T-1 d load test confirms zero 429 |
| Sentry | Error tracking | **A: none for 30 Oct**; re-decide after week 1 with real error volume. The probe alerts on bursts of API error lines (`PP_ALERT_API_ERRORS_5M`) | Section 10 | Nothing now |
| CSP | SPA CSP (D-7) | **`PP_CSP_MODE=report-only`** at go-live. The T-2 d browser check still runs; switching to `enforce` is a later LEAD decision | `.env.prod.example`; section 16 T-2 d | Nothing now |
| ClamAV | Upload scanning | Profile `clamav` **not** in `PP_PROFILES` until the #78 scan card lands (clamd would run with nothing calling it). Intake is admin-only (AZ-29 item 7, card AZ-35). The go/no-go uploads gate of section 16 stays for every other pupil or teacher upload route: #78 landed, or a dated LEAD risk-acceptance line | `.env.prod.example`; sections 15 and 16 | The risk acceptance line, if #78 is not in by 30 Oct |
| Off-site | Off-site target | **`s3`**: an S3-compatible bucket, ideally in a Malaysian or Asia-Pacific region; a key that can write but not delete if the provider supports it; bucket lifecycle **35 days** (the erasure rule of section 9); **no object lock** and versioning off (the erasure rule and the migration clean-up of the cutover plan section 7 must be able to delete); GPG required with `PP_BACKUP_GPG_FPR` pinned; one off-site copy restored on a scratch host at T-2 d. `rsync` stays possible if the LEAD prefers a second server | `.env.prod.example` (`PP_OFFSITE_KIND` stays `none` in the example until the bucket exists) | The bucket, endpoint and key (in the backup user's aws profile, never in `prod.env`), and the GPG key pair |

AI intake values (AZ-29: `AI_PROVIDER=mock`, `OCR_ENGINE=none`, intake limits KEEP, admin-only) are decided, not
defaults: see section 3 and `docs/ops/ai-intake-production-decisions.md` (lands with #138).

Also folded in here (optional G4 minors of the #116 review): the HSTS ramp now lists 604800 like
`platform-settings.md`; `deploy.sh` refuses a `PP_HSTS` value that is not empty, `max-age=N` or
`max-age=N; includeSubDomains`; and a failed deploy with no api container running now prints the rollback command
instead of "nothing to roll back".
