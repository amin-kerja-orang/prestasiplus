# API runbook (BE-33)

Operations guide for the `api` (NestJS) and `db` (PostgreSQL 16) services. It links to the existing guides instead of repeating them:

| Topic | Guide |
|---|---|
| Containers, image layout, migrate job | [containers.md](containers.md) |
| Backup, restore check, monthly drill | [db-backup.md](db-backup.md) |
| Staging deploy (Cloudflare Pages + Render + Supabase, or one VPS) | [deploy-staging.md](deploy-staging.md), [deploy-execution.md](deploy-execution.md) |
| Demo data reseed | [demo-reseed.md](demo-reseed.md) |

Rule for every action on a shared or production environment (deploy, restore, secret rotation, seed): get the lead's explicit confirmation first.

## 1. Services

| Service | Image / build | Port | State | Notes |
|---|---|---|---|---|
| `api` | `docker/api/Dockerfile` (runtime stage, `node:22.22.2-alpine`) | 3000 (compose `expose` only; the frontend nginx proxies `/api/`) | stateless; uploads in volume `apifiles` (`/var/lib/pretasiplus/files`) | non-root `node` (uid 1000), read-only rootfs, `/tmp` tmpfs, `cap_drop: ALL`, `no-new-privileges`. `CMD ["node","dist/main.js"]` (node is PID 1, receives SIGTERM), `STOPSIGNAL SIGTERM`. |
| `migrate` | Dockerfile `build` stage | none | one-shot | `prisma migrate deploy`, exits 0 before `api` starts. |
| `db` | `postgres:16-alpine` | 5432 (no host port) | volume `pgdata` | Back it up (section 10). |
| `frontend` | `docker/frontend/Dockerfile` (nginx) | 8080 | stateless | Proxies `/api/` to `api:3000`. |

At runtime the API writes only to `FILE_STORAGE_DIR` and `os.tmpdir()` (`/tmp`: PDF and OCR scratch, tesseract cache). Prisma 7 uses the `pg` driver adapter, so no query engine is unpacked at start. The image also carries the `prisma/migrations` folder names so `/api/ready` can compare them with `_prisma_migrations`.

## 2. Environment keys

Source of truth: `apps/api/src/common/config/env.schema.ts` (zod; a test keeps it equal to `.env.api.example`). Secrets come from the platform secret store or the uncommitted `.env.api` (mode 600), never from the repo. A missing or invalid required key stops the process at start with a message naming the key (never the value).

Required in production (boot fails without them):

| Key | Rule |
|---|---|
| `NODE_ENV` | `production` (compose sets it). |
| `DATABASE_URL` | `postgresql://` URL. Contains a password: secret. |
| `SESSION_SECRET` | at least 16 characters, not `change-me`. Use 32+ random characters (`openssl rand -hex 32`). Secret. |
| `IC_HASH_KEY` | at least 32 characters, different from `SESSION_SECRET`. Secret. |
| `FILE_STORAGE_DIR` | absolute path; the image sets `/var/lib/pretasiplus/files`. |

Not allowed in production: `MAIL_LOG_RESET_LINKS=true` (boot fails). `ALLOW_DEMO_SEED` must stay `false`.

Optional keys (defaults in brackets):

| Group | Keys |
|---|---|
| Core | `PORT` [3000], `LOG_LEVEL` [info; fatal, error, warn, info, debug, trace, silent], `TRUST_PROXY_HOPS` [0; compose sets 1 = the frontend nginx], `CLIENT_IP_HEADER` [unset; one of `x-pp-client-ip`, `cf-connecting-ip`, `x-real-ip`, `true-client-ip`], `EDGE_PROXY_SECRET` [unset; secret, 32+ chars, required when `CLIENT_IP_HEADER` is set], `PUBLIC_BASE_URL` (URL), `PUBLIC_ORIGINS` (comma-separated extra image origins) |
| Session and cookies | `SESSION_COOKIE_NAME`, `COOKIE_DOMAIN`, `COOKIE_SECURE` [true unless set to `false`; the dev overlay compose.http.yaml sets false], `SESSION_REMEMBER_DAYS` [30], `SESSION_REMEMBER_DAYS_STAFF` [1; 0 = off] |
| Login hardening | `THROTTLE_LOGIN_PER_MINUTE` [5], `LOGIN_IDENTIFIER_FAIL_LIMIT` [100 per 15 min], `LOGIN_FAILURE_FLOOR_MS` [1500], `LEGACY_BCRYPT_DUMMY_COST` [12] |
| Seeds | `ALLOW_DEMO_SEED` [false], `BIJAK_POC_QUESTIONS` [false; staging only] |
| Runtime (BE-33) | `REQUEST_TIMEOUT_MS` [120000], `HEADERS_TIMEOUT_MS` [60000], `KEEP_ALIVE_TIMEOUT_MS` [65000], `SHUTDOWN_GRACE_MS` [25000], `METRICS_ENABLED` [true; `false` makes `/api/metrics` 404], `METRICS_INTERNAL_CIDRS` [unset; comma list of IPv4/IPv6 CIDRs, invalid value fails the boot] |
| Files | `MAX_UPLOAD_MB` [10], `INTAKE_MAX_FILE_MB` [20], `UPLOAD_RATE_PER_MINUTE` [30], `FILE_READS_PER_MINUTE` [120] |
| Jobs and OCR | `JOBS_WORKER_ENABLED` [false], `JOBS_POLL_MS`, `JOBS_CONCURRENCY`, `JOBS_LOCK_TIMEOUT_MS`, `JOBS_BACKOFF_BASE_MS`, `OCR_ENGINE` [none; tesseract needs `OCR_LANG_DIR`], `OCR_LANG_DIR`, `OCR_WORKERS`, `OCR_PAGE_TIMEOUT_MS`, `OCR_INSPECT_TIMEOUT_MS`, `OCR_MAX_PAGES`, `OCR_MIN_TEXT_CHARS`, `OCR_RENDER_DPI`, `OCR_MAX_PIXELS`, `OCR_WORKER_MEMORY_MB`, `OCR_WORKER_RSS_LIMIT_MB` |
| Intake | `INTAKE_TEACHER_ENABLED` [false; AZ-35: off = intake files and review routes are Admin Pusat only, a teacher gets 403; keep off until ClamAV scans uploads (#78)], `INTAKE_UPLOAD_CONCURRENCY`, `INTAKE_MAX_FILES_PER_BATCH`, `INTAKE_MAX_ACTIVE_BATCHES`, `INTAKE_DAILY_PAGE_QUOTA`, `INTAKE_WRITES_PER_MINUTE`, `INTAKE_READS_PER_MINUTE` |
| Misc | `BIJAK_SWEEP_INTERVAL_SECONDS`, `MAIL_LOG_RESET_LINKS` (development only) |
| Rate limits | every `THROTTLE_*` key; see section 9 and `.env.api.example` (each line states the unit and the key: user or address). All optional. |

Every value is an integer unless stated. Timeout notes: `REQUEST_TIMEOUT_MS` and `HEADERS_TIMEOUT_MS` must be at least 1000 (0 is refused, it would disable slowloris protection). nginx `proxy_read_timeout` is 120 s on `/api/` and 300 s on `/api/files`; keep `REQUEST_TIMEOUT_MS` at or below the matching nginx value, and `HEADERS_TIMEOUT_MS` at or below `REQUEST_TIMEOUT_MS`. Tuning point: one process timeout covers every route, so the 120 s default also caps uploads on `/api/files` (a 22 MB body needs about 1.5 Mbit/s to arrive in time); where users upload over slow links, raise `REQUEST_TIMEOUT_MS` up to 300000 (the `/api/files` nginx value) (nginx still ends other `/api/` requests at 120 s, so the process value above it only matters for direct callers).

## 3. Start and stop

```
docker compose up -d --build db migrate api          # base stack; production never seeds
docker compose -f compose.yaml -f compose.staging.yaml up -d --build --wait    # staging VPS
docker compose ps
docker compose stop api                              # SIGTERM, then SIGKILL after the stop timeout
```

Graceful shutdown (`apps/api/src/common/health/graceful-shutdown.ts`): on SIGTERM or SIGINT the API stops accepting connections, closes idle keep-alive sockets, waits for in-flight requests to finish, closes the Prisma pool, and exits 0. If draining takes longer than `SHUTDOWN_GRACE_MS` (default 25000) it exits 1. The container stop timeout must be larger than the grace: Docker's default is 10 s, so set `stop_grace_period: 30s` on the `api` service (compose.yaml change requested from the lead; until then use `docker compose stop -t 30 api`). On a platform (Render and similar) set the shutdown delay to 30 s or more.

## 4. Health and readiness

| Route | Auth | Meaning |
|---|---|---|
| `GET /api/health` | none | Liveness: the process answers. Used by the image `HEALTHCHECK` and load balancers. Not access-logged, not rate-limited. |
| `GET /api/ready` | none | Readiness. `200 {"data":{"status":"ready","db":"up","migrations":"applied","time":...}}` only when the database answers within 3 s and every shipped migration is applied and none is failed. Otherwise `503` with code `SERVER_ERROR` and no detail (the reason is in the log as `not ready: ...`). `Cache-Control: no-store`. Not rate-limited. The result (ok or not) is cached for 3 s and concurrent callers share one check, so at most one DB query per 3 s per process; the migration folder is read once per process. |

Use `/api/ready` for the deploy smoke test and for traffic switching; use `/api/health` for restart decisions only (a database outage must not restart-loop the API).

## 5. Metrics

`GET /api/metrics` returns Prometheus text (`text/plain; version=0.0.4`, `no-store`).

- Allowed: (a) a direct internal peer with no `X-Forwarded-*`, `X-Real-IP` or `Forwarded` header, or (b) a valid session whose active role is `admin`. Everything else gets 403 `FORBIDDEN`. Who is an "internal peer" (the socket address, never `X-Forwarded-For`; `::ffff:` mapped addresses are matched as IPv4):
  - `METRICS_INTERNAL_CIDRS` set: only peers inside one of those CIDRs (set it to the Docker network of the scraper, for example `172.18.0.0/16`).
  - not set and `NODE_ENV=production`: nobody; the internal path is OFF and only an admin session works. This avoids failing open when a proxy forwards without forwarding headers.
  - not set and not production: loopback and private ranges (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, `::1`, `fc00::/7`, `fe80::/10`).
- `METRICS_ENABLED=false` makes the route 404.
- Labels are route templates (for example `/api/classes/:id`), method and status class. No user id, e-mail, IC, token or query value is ever a label.
- nginx adds `X-Real-IP` and `X-Forwarded-For` on every proxied call, so a request that went through nginx is only served to an admin session. Scrape from inside the Docker network (`http://api:3000/api/metrics`, from a sidecar or Prometheus on the same network). Best practice: add `location = /api/metrics { return 404; }` to `docker/frontend/nginx.conf` so it is never reachable from the internet (requested from the lead; the file is outside this card's list).

## 6. Migrations

Forward-only. The `migrate` job runs `prisma migrate deploy` before `api` starts; a failed migration keeps the API down.

```
docker compose up -d --build db migrate api
docker compose logs migrate
```

Before a deploy that carries a migration: take a backup (section 10) and check the lint with `npm run be:lint:migration`. After the deploy: `GET /api/ready` must be 200. A migration is never edited after merge; a mistake is fixed with a new migration, or by restoring the pre-deploy backup.

## 7. Seed rules

`npm run be:db:seed` (`apps/api/prisma/seed/index.ts`) runs the modules of the profile (default `poc`) in order.

- `kind: 'reference'` modules (today only `core-school-packages`) run in every environment, production included. They contain no personal data.
- Everything else is demo data (fictitious accounts with a published password). With `NODE_ENV=production` they are skipped, with a warning listing the skipped modules, unless `ALLOW_DEMO_SEED=true` (or `1`). Outside production the demo seed runs without the flag.
- Production: run the seed without `ALLOW_DEMO_SEED`. Never set it to `true` in production. Staging may load the demo accounts with the explicit one-off command in [deploy-staging.md](deploy-staging.md).
- Seeds are idempotent (upserts) and deterministic. `be:db:reset` refuses to run when `NODE_ENV=production`.

## 8. Request limits and headers

Global security headers (helmet-style, HSTS in production), `x-powered-by` off, JSON body limit 100 kB by default (import routes 2200 kB, article and note routes 1300 kB, only for a signed-in cookie shape), oversize body gives 413. The nginx limits are 3 MB (`/api/`) and 22 MB (`/api/files`). Cookies are `HttpOnly`, `SameSite=Lax`, `Secure` in production; no token appears in a response body.

## 9. Rate limits

Counters are per process, in memory (a shared store is a follow-up), except the login and reset counters, which are rows in `login_attempts` (keyed hashes only: neither an address nor an identifier is stored). All refusals are `429 RATE_LIMITED` with `retryAfter` seconds in the body and the `Retry-After` header. Behind nginx the client address is the last `X-Forwarded-For` entry; `TRUST_PROXY_HOPS` must match the number of proxies (1 for compose).

Edge client address (Cloudflare Pages to Render demo/go-live): when `CLIENT_IP_HEADER` is set, the throttle key is the address in that request header, but only if the request also carries `X-PP-Edge-Secret` equal to `EDGE_PROXY_SECRET` (compared in constant time). Allowed header names: `x-pp-client-ip`, `cf-connecting-ip`, `x-real-ip`, `true-client-ip`; any other value, or a secret shorter than 32 characters, fails the boot with the key named (never the value). Fail-safe: a missing or wrong secret, or a missing or invalid address, falls back to the socket peer (strict, never the header). Unset `CLIENT_IP_HEADER` = the `TRUST_PROXY_HOPS` behaviour above; compose/nginx keeps `TRUST_PROXY_HOPS=1` and does not set either key. `TRUST_PROXY_HOPS` still governs `req.secure`. Rollout and rollback: [demo-cloudflare-supabase.md](demo-cloudflare-supabase.md), "Edge client IP + no-store (go-live fix)" (**user action, needs G6 confirmation**).

| Limit | Default | Window | Key | Env key |
|---|---|---|---|---|
| Global ceiling, every `/api` route except `/api/health` and `/api/ready` (`/api/metrics` is counted, G4 M1) | 300 | 1 min | address | `THROTTLE_GLOBAL_PER_MINUTE` |
| Login, attempts per identifier and address (counted before the password check) | 5 | 60 s | identifier + address | `THROTTLE_LOGIN_PER_MINUTE` |
| Login, failed attempts per address across identifiers | 20 | 60 s | address | fixed |
| Login, failed attempts per identifier across addresses | 100 | 15 min | identifier | `LOGIN_IDENTIFIER_FAIL_LIMIT` |
| Password reset link request (`/auth/password/email`) | 1 | 60 s | e-mail | fixed (`ACCOUNT_RESET_REQUEST_INTERVAL_SECONDS`) |
| Password reset by IC (`/auth/password/reset-ic`) | 5 | 15 min | account and address, whichever first | fixed (`ACCOUNT_RESET_IC_MAX_ATTEMPTS`) |
| Reset token redemption, failed | 5 per e-mail + address; 20 per address | 60 s | e-mail + address; address | fixed (`ACCOUNT_THROTTLE`) |
| Password change, wrong current password | 5 per min, 20 per 15 min | 60 s; 15 min | user | fixed |
| Registration | 30 | 1 min | address | `THROTTLE_REGISTER_PER_MINUTE` |
| Account writes (profile, password, picture, settings) | 30 | 1 min | user | `THROTTLE_ACCOUNT_WRITE_PER_MINUTE` |
| File upload and delete | 30 | 1 min | user | `UPLOAD_RATE_PER_MINUTE` |
| File download | 120 | 1 min | user (anonymous cms_image: address) | `FILE_READS_PER_MINUTE` |
| Intake writes (create, upload, cancel) | 20 | 1 min | user | `INTAKE_WRITES_PER_MINUTE` |
| Intake reads | 240 | 1 min | user | `INTAKE_READS_PER_MINUTE` |
| Support ticket creation | 10 | 1 hour | user | `THROTTLE_SUPPORT_TICKET_CREATE_PER_HOUR` |
| Public lookups (jpn, ppd, account stats) | 60 | 1 min | address | `THROTTLE_PUBLIC_PER_MINUTE` |
| Bulk user import | 10 | 1 hour | user | `THROTTLE_IMPORT_PER_HOUR` |
| Every other module (reads, writes, exports) | see `.env.api.example`, one line per key | 1 min or 1 hour | user or address | `THROTTLE_*` |

Differences from the card's working assumptions (registration 10 per hour per address, uploads 30 per hour per user, tickets 5 per hour per user): the code uses the numbers above, which are configurable. Registration is per minute because a school shares one address. The lead confirms or changes the numbers (card open question 1).

Single instance: the API must run as ONE instance (Render free plan) because the rate-limit buckets live in process memory (only the login throttle is in the database). Before running more than one instance, move the buckets to a shared store (Redis). Accepted by the lead on 2026-10-21 (threat model row 18).

## 10. Backup and restore of pgdata

Procedure, retention, encryption and the monthly drill are in [db-backup.md](db-backup.md): `npm run db:backup`, `npm run db:restore-check`, and the disaster-recovery steps (stop writers, safety backup, restore, `migrate`, check `/api/ready`). Uploads are in the separate `apifiles` volume and need their own backup.

Drill executed for BE-33 (acceptance criterion 7), 2026-10-20, with the same tools the scripts use (`pg_dump -Fc --no-owner`, `pg_restore --no-owner --exit-on-error`) against local PostgreSQL 16.15, because there is no Docker daemon in the build environment (the npm scripts call `docker compose exec`):

1. Source database: the 23 repository migrations applied in order, then the demo seed (`prisma/seed/index.ts`, profile `poc`).
2. `pg_dump -Fc`: 761173 bytes, `PGDMP` header, sha256 `cc5e6c90...ea8cab4b`.
3. Fresh empty database, `pg_restore`: no errors.
4. Exact `count(*)` of every table, source against restored: 141 tables, 9876 rows in total in 65 non-empty tables, 0 mismatches, 5 of 5 sequences present. Result `ROW-COUNT COMPARISON PASSED`.
5. Both scratch databases and the dump file were deleted.

The full output is attached to the PR. The same drill with `npm run db:backup` and `npm run db:restore-check` on the real `db` container, and the first production backup, still need the lead or the operator (see section 15).

### AC7 rehearsal (run once in the cloud session)

Purpose: prove `npm run db:backup` and `npm run db:restore-check` on a real Postgres 16 container, with the source-against-restored row-count comparison of every public table (including `_prisma_migrations`). Needs Docker and Node; no production, no shared environment. It uses its own Compose project name, so it never touches the `pretasiplus` stack or its volumes. Docker cap rule: run it as the only heavy database job (no `be:verify`, no API test run, no other Postgres container at the same time).

Run from the repo root, in one shell session (the exports must stay set). The dump goes to a temporary folder outside the repo; the throwaway password is made up on the spot and never printed.

```
cd <repo root> && pwd && git status --short                  # clean tree, expected branch
export COMPOSE_PROJECT_NAME=pp-ac7                           # wins over `name:` in compose.yaml, for compose and for the npm scripts
export BACKUP_DIR="$(mktemp -d)/pp-ac7-backups"              # outside the repo
PW="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')"
printf 'POSTGRES_DB=prestasiplus\nPOSTGRES_USER=pp\nPOSTGRES_PASSWORD=%s\n' "$PW" > .env.db
printf 'DATABASE_URL=postgresql://pp:%s@db:5432/prestasiplus\nSESSION_SECRET=%s\n' "$PW" "$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')" > .env.api
unset PW
```

`.env.db` and `.env.api` are git-ignored; check `git status --short` shows neither. Compare `.env.api.example` and add any other required key it lists (do not print the file).

```
# 1. Start only the throwaway database (waits for the healthcheck)
docker compose -f compose.yaml up -d --wait db

# 2. Migrate and seed the non-production `poc` profile (compose.http.yaml adds the seed with ALLOW_DEMO_SEED=true)
docker compose -f compose.yaml -f compose.http.yaml run --rm --build migrate
docker compose -f compose.yaml exec -T db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "select count(*) from users"'    # must be > 0

# 3. Backup (pg_dump -Fc inside the container; prints file, size, sha256)
npm run db:backup -- --dir "$BACKUP_DIR"

# 4. Restore into a fresh empty database <db>_restorecheck, compare, drop it
npm run db:restore-check -- --dir "$BACKUP_DIR"
echo "exit code: $?"
```

Do not write to the source database between steps 3 and 4: any write shows up as a mismatch. The restore target is always a new database named `<db>_restorecheck` on the same container; the script refuses any other name and drops it at the end (add `--keep-db` only to inspect it).

Expected success output shape (numbers differ; the `poc` seed gave 141 tables and 9876 rows in the local drill above):

```
Checksum matches the .sha256 sidecar.
Backup: pp-backup-<UTC timestamp>.dump  <size>  sha256 <64 hex>
Restoring into throwaway database "prestasiplus_restorecheck" via compose service db (main database "prestasiplus" is not touched)
public tables: <N>
_prisma_migrations rows: <M>
rows in users: <n>   (also schools, sessions, audit_events, questions where present)
row-count comparison: <N> source tables, <N> restored tables, <R> rows restored, 0 mismatches
ROW-COUNT COMPARISON PASSED
Dropped prestasiplus_restorecheck.
RESTORE CHECK PASSED
exit code: 0
```

A failure prints `ROW-COUNT COMPARISON FAILED` with one `table: source X, restored Y` line per difference and exits non-zero. That is a real finding: keep the dump, do not clean up, and report it to the lead.

Paste into the PR: the output of steps 3 and 4 and the `exit code` line. Both scripts print only file name, size, sha256, database names and counts. Do not paste `.env.db`, `.env.api`, any `DATABASE_URL` or the folder path of the dump if it contains a user name. Then tick AC7 in section 15 (change the status to "done on compose `db`").

Cleanup (only what this rehearsal started; never kill node or docker processes by name):

```
docker compose -f compose.yaml down -v                       # removes only project pp-ac7: its db container, network and pgdata volume
rm -rf "$BACKUP_DIR" .env.db .env.api                        # only if they did not exist before the rehearsal
unset COMPOSE_PROJECT_NAME BACKUP_DIR
docker compose ls                                            # pp-ac7 must be gone
```

If `.env.db` or `.env.api` already existed, back them up before the environment block above and restore them afterwards instead of deleting. The `ROW-COUNT COMPARISON` lines need the comparison added to `scripts/db-restore-check.mjs` (BE-33 close-out); without it the script prints only the core-table counts and `RESTORE CHECK PASSED`, which is not enough for AC7.

## 11. Logs

- The API logs one JSON line per event to stdout (pino, `nestjs-pino`). There are no log files (read-only rootfs). `LOG_LEVEL` sets the level. Every request line carries `requestId` (also returned as `X-Request-Id`). `/api/health` is not logged.
- Read them: `docker compose logs -f api`, `docker compose logs --since 30m api | grep '"level":50'` (errors), `docker compose logs migrate`, `docker compose logs db`. On Render and similar platforms use the service log view; ship stdout to the platform's log store.
- Redacted before writing: cookie and `Set-Cookie` headers, `Authorization`, `X-CSRF-Token`, `Referer`, `req.params.token`, any `password` field, and parent-invite tokens inside URL paths. Reset links are never logged in production. Log-capture tests over a login, a reset and an upload prove no password, cookie or IC is logged (`apps/api/test/security/log-capture.spec.ts`).
- Audit trail: table `audit_events` (actor, role, scope, action, target, request id; no personal content) and `question_status_events`. Query it for who did what; it is not a log file.
- Metrics: section 5. Alerts: no alerting stack is configured in the repo yet. Minimum until then: an external uptime check on `/api/ready` through the public domain, and a scheduled check of the backup exit code (see db-backup.md). Ask the lead for the monitoring account (manual step).

## 12. Incident basics

1. Triage: `docker compose ps`; `curl -fsS http://127.0.0.1:5192/api/ready` (through nginx) and `docker compose exec api wget -qO- http://127.0.0.1:3000/api/ready`. `/api/health` 200 and `/api/ready` 503 means the database or a migration is the problem, not the process.
2. Read the last errors: `docker compose logs --since 15m api | grep '"level":50'`. Use the `requestId` from a user report or the response header to follow one request.
3. Database down: `docker compose logs db`, `docker compose ps db`. Do not delete `pgdata`. A restore is a last resort and needs the lead's confirmation (db-backup.md, "Real restore").
4. Bad release: roll back by redeploying the previous commit (`git checkout <previous>`, same compose command). If the bad release applied a migration, restore the pre-deploy backup instead, since migrations are forward-only.
5. Suspected data leak or leaked secret: rotate the secret (section 13), tell the lead the same day (PDPA: the data covers minors), keep the logs.
6. Too many 429: raise the matching `THROTTLE_*` key only after checking `TRUST_PROXY_HOPS` is right (a wrong value counts everyone as one address).
7. Write down: what, when, who, request ids, data affected, action taken.

## 13. Secret rotation

Rotate on a schedule agreed with the lead (suggested every 90 days) and immediately after any suspected leak. Always: generate the new value in the secret store (`openssl rand -hex 32`), update, redeploy `api` (`docker compose up -d api` or the platform's redeploy), check `/api/ready` and one login, delete the old value.

| Secret | Effect of rotating | Notes |
|---|---|---|
| `SESSION_SECRET` | Every signed-in session and CSRF token becomes invalid; all users must log in again. Login-throttle counters and reset hashes keyed with it restart. | Announce it; do it off-peak. |
| `IC_HASH_KEY` | IC lookups (reset by IC, IC search) stop matching until every `ic_hash` is recomputed with the new key. | Do not rotate without a recompute plan from the backend developers. Never reuse `SESSION_SECRET`. |
| `DATABASE_URL` password | The API cannot connect until it is redeployed with the new value. | Change the role password in Postgres and the secret in the same maintenance window; for compose also `.env.db` (`POSTGRES_PASSWORD` only applies at first init: run `ALTER ROLE` in the running database). |
| `POSTGRES_PASSWORD` (`.env.db`) | As above for the `db` service. | |
| Backup passphrases | Old encrypted copies need the old passphrase. | Keep the old one until those copies expire. |
| CI tokens | The workflows use only the default `GITHUB_TOKEN` (`contents: read`; the openapi job adds `pull-requests: read`); no stored secret. | |

## 14. CI security gates and allow-list process

`.github/workflows/api.yml` (jobs run on every push and pull request touching the API, packages or the Dockerfile):

| Gate | Job / step | Fails when |
|---|---|---|
| Production dependency audit | `deps-audit`: `npm ci`, `npm audit --omit=dev --json`, `node scripts/npm-audit-gate.mjs` | any high or critical advisory is not in `.github/security/npm-audit-allowlist.json`, or an allow-list entry is expired or incomplete |
| Dependency review | `dependency-review` (pull requests): `actions/dependency-review-action`, `fail-on-severity: high`, `permissions: contents: read` | a PR adds or changes a dependency with a high or critical advisory |
| Image scan | `docker`: Trivy on the built image, `severity: HIGH,CRITICAL`, `ignore-unfixed: true`, `exit-code: 1`, `trivyignores: .trivyignore` | an OS or library vulnerability with a fix is not ignored |
| Read-only run and boot smoke | `docker`: `docker run --rm --read-only --tmpfs /tmp --user node ... node -v`, then migrate and boot against a service Postgres, `/api/health`, `/api/ready`, `docker stop`, exit code 0 | the image needs a writable rootfs, the process does not start, readiness is not 200, or SIGTERM does not end in exit 0. It does not prove that a slow in-flight request finishes; `apps/api/test/security/shutdown.spec.ts` does. |
| Secret scan | `secret-scan` (gitleaks, full history) and the `no-dumps` workflow | a secret pattern, a dump or a file over 1 MB is tracked |
| Non-root | `docker`: `id -u` is not 0 | the image runs as root |

Pinning: `aquasecurity/trivy-action` and `actions/dependency-review-action` are pinned by version tag because the commit SHA could not be verified from the build environment. Before the first release replace each tag with the full 40-character commit SHA of the same tag (keep the tag as a comment) and let Dependabot or a reviewer bump them.

Allow-list process (an exception is a risk acceptance, not a fix):

1. The finding is first fixed by upgrading the dependency or base image. Only when no fix exists or the code path is provably not reachable, an exception may be requested in a PR.
2. npm advisories: add an entry to `.github/security/npm-audit-allowlist.json` with `id` (GHSA id), `package`, `reason` (why it is not exploitable here, naming the code path), and `expires` (ISO date, at most 30 days ahead). Image findings: add the id to `.trivyignore` on its own line with `exp:YYYY-MM-DD` and a comment line above it with the reason, date and owner.
3. The `devops-engineer` owns both files; each new or renewed entry needs the lead's approval in the PR and a security-review comment.
4. An expired entry fails CI on purpose (the npm gate fails on any expired entry, Trivy stops ignoring an expired id). Renew with a fresh reason, or fix the dependency. Renewal more than twice is escalated to the lead.
5. Expiry is enforced by the CI `deps-audit` gate itself, not by `be:test` (so a date never breaks the local gate). Entries active at BE-33 (expire 2026-11-19): `GHSA-68fv-2mgg-jv7q` (`source-map-js`, reached only through postcss in sanitize-html, which parses with `{ map: false }`) and `GHSA-587h-7wmj-h5pm` (`vite` dev server on Windows; vite is a build tool and not in the runtime image). `.trivyignore` has no active entries.
6. The gate is unit-tested (`apps/api/test/security/npm-audit-gate.spec.ts`) and the workflow shape is tested (`apps/api/test/security/ci-workflow.spec.ts`).

Run the audit gate locally:

```
npm audit --omit=dev --json > audit.json; node scripts/npm-audit-gate.mjs --file audit.json
```

## 15. Release gate and readiness checklist

Evidence per BE-33 acceptance criterion and plan section 10 item. "needs LEAD/ops" means the step cannot be run in the build environment (no Docker daemon, no CI access, no production) and must be done before the release gate (G6), with the lead's confirmation.

Test files are under `apps/api/test/security/` unless a full path is given; scenarios against the full app are in `apps/api/test/conformance/security/`.

| # | Item | Evidence | Status |
|---|---|---|---|
| AC1 | CSRF on one route of every mutating group; cross-user 404; mass assignment 422; 413; SQL-injection strings | `csrf-every-group.spec.ts`, `sampled-domains.spec.ts`, `global-hardening.spec.ts` | tests in the PR |
| AC2 | Rate limits for login, reset, registration, upload, tickets; `retryAfter` | `rate-limits.spec.ts`; numbers in section 9 | tests in the PR; numbers need lead confirmation |
| AC3 | Cookie flags; no token in a response body | `cookies-and-tokens.spec.ts` | tests in the PR |
| AC4 | Audit rows for the audit list | `audit-coverage.spec.ts` | tests in the PR |
| AC5a | `SIGTERM` finishes an in-flight request and exits 0 | `shutdown.spec.ts`; `timeouts.spec.ts` | tests in the PR |
| AC5b | Image runs non-root, read-only, `/tmp` tmpfs | workflow steps in `api.yml` (`docker` job), shape tested in `ci-workflow.spec.ts`; Dockerfile reviewed for writes outside `/tmp` and `FILE_STORAGE_DIR` | real image run: needs LEAD/ops (first green CI run, or `docker build -f docker/api/Dockerfile -t pretasiplus-api:local . && docker run --rm --read-only --tmpfs /tmp --user node pretasiplus-api:local node -v`) |
| AC6a | CI fails on high or critical production dependencies, with allow-list | `deps-audit` job, `scripts/npm-audit-gate.mjs`, `npm-audit-gate.spec.ts`, allow-list file; local run on the repo and on a fake critical advisory (exit 1) are in the PR | done locally |
| AC6b | CI fails on image vulnerabilities | Trivy step, `ci-workflow.spec.ts` | first real scan: needs LEAD/ops |
| AC6c | A deliberately vulnerable dev branch shows the failure in CI | not run (cannot push a throw-away branch and watch CI from here) | needs LEAD/ops (steps: branch, `npm install --save-prod <package with a known high advisory>`, open a PR, expect `deps-audit` and `dependency-review` red; delete the branch; paste the run link in the PR) |
| AC7 | Backup restored into a fresh database, row-count comparison | section 10 and the pasted output (141 tables, 0 mismatches) | done on local Postgres; on the compose `db` and in production: needs LEAD/ops |
| AC8 | Secret scan green; log-capture over login, reset, upload | `secret-scan` job, `log-capture.spec.ts` (and `apps/api/test/logging-pii.spec.ts`) | tests in the PR; the CI job runs on the PR |
| AC9 | D52 review items each have a threat-model row and a named test | threat-model table in the PR description | in the PR |
| P10-1 | Contract committed first, `contract:check` | `npm run contract:check` | run before merge |
| P10-2 | Envelope, status codes, BM messages from the contract | `apps/api/test/conformance/security/` | after BE-31 |
| P10-3 | Scope and role enforcement (403, 404, 401, `CSRF_INVALID`) | `csrf-every-group.spec.ts`, `sampled-domains.spec.ts` | tests in the PR |
| P10-4 | Migration applies on empty and on previous head | no migration in this card; `npm run be:lint:migration` unchanged | n/a |
| P10-5 | Unit and integration tests incl. validation paths | all specs above, `ready.spec.ts`, `metrics.spec.ts` | tests in the PR |
| P10-6 | Seed module | none in this card; seed rules in section 7 | n/a |
| P10-7 | `npm run be:verify` green, root typecheck and test if `packages/**` changed | paste the real tail in the PR | run before merge |
| P10-8 | No secrets, no real names, no personal data in logs | gitleaks job, `log-capture.spec.ts`, review | in the PR |
| P10-9 | PR description from the template | `.github/pull_request_template.md` | lead |
| P10-10 | Lead approval, `security-review` label | | lead |
| Ops | Production backup scheduled, restore drill monthly, uptime check on `/api/ready`, alert contact | db-backup.md, section 11 | needs LEAD/ops (accounts, schedule, encrypted volume) |
| Ops | No malware scan on stored uploads: accepted for demo/staging (admin-only uploads, magic-byte checks); ClamAV or equivalent required before production go-live (backlog #78) | threat model row 43 | needs LEAD/ops before go-live |
| Ops | nginx does not proxy `/api/metrics`; `stop_grace_period: 30s` on `api` | sections 3 and 5 | needs lead (files outside this card) |
