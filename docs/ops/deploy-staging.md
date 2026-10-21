# Staging deploy

> Temporary demo of 2026-10-21, step by step with a smoke test and the Supabase Data API lockdown:
> [demo-cloudflare-supabase.md](demo-cloudflare-supabase.md). It supersedes the `sslmode=require` URL of step 1 below
> (node-postgres verifies `sslmode=require`; use `verify-full` with the Supabase CA).

Two paths. Both keep the browser on ONE origin (SPA and `/api` together), so there is no CORS and the
session cookie is first-party.

1. **Primary: Cloudflare Pages (SPA + `/api` proxy Function) + Render (API) + Supabase (Postgres)**, all free tiers.
2. **Alternative: single VPS with Docker Compose** (further down).

## Primary path

```
Browser --> https://<project>.pages.dev  (static SPA, built VITE_API_MODE=http)
              \-- /api/*  -> Pages Function functions/api/[[path]].ts  -> API_ORIGIN (Render)  -> Supabase
```

Secrets live only in the platform dashboards. Never put a real value in the repo.

### 1. Supabase (database)
1. Create a project (free). Note the database password.
2. Connect -> **Session pooler** string (port **5432**, IPv4 compatible). Do NOT use the transaction pooler (port 6543): it breaks Prisma prepared statements. Only if the transaction pooler were ever forced, append `?pgbouncer=true`; avoid it.
3. `DATABASE_URL=postgresql://postgres.<ref>:<password>@<region>.pooler.supabase.com:5432/postgres?sslmode=require`
   Use this one value for both `migrate deploy` and the runtime API. URL-encode special characters in the password.

### 2. Render (API)
1. New -> Blueprint from this repo (`render.yaml`), or New Web Service -> Docker, Dockerfile path `./docker/api/Dockerfile`, context `.`, plan Free, health check path `/api/health`.
2. Environment variables (dashboard):

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | the Supabase session-pooler URL |
   | `COOKIE_SECURE` | `true` |
   | `COOKIE_DOMAIN` | empty (host-only cookie on the Pages domain) |
   | `TRUST_PROXY_HOPS` | `2` (see below) |
   | `SESSION_SECRET`, `IC_HASH_KEY` | random, 32+ chars, different from each other |
   | `PUBLIC_BASE_URL`, `PUBLIC_ORIGINS` | the Pages origin, `https://<project>.pages.dev` (or the custom domain) |
   | `ALLOW_DEMO_SEED` | `true` on staging only (never production). The seed itself is a manual one-off, below. |
   | `BIJAK_POC_QUESTIONS` | `true` on staging only. NOT on `origin/feature/v2-backend` 6694de7c (`git grep` finds nothing); set it when #49 and the flag PR merge. |
3. Free tier: the service sleeps after 15 minutes idle, so open the site once before a demo (the first request takes about 30-60 s). Uploads go to the container disk (`FILE_STORAGE_DIR`), which is **ephemeral** on free: files vanish on redeploy or restart.
4. `TRUST_PROXY_HOPS=2`: the Function overwrites `X-Forwarded-For` with `CF-Connecting-IP` (the client), then Render's proxy appends the address it saw (the Function's Cloudflare egress IP). Chain: `client, cf-egress`, socket = Render proxy. Express with 2 trusted hops skips the socket peer and the last XFF entry and reads the next one: the client. With 1, every user looks like the Cloudflare egress address (one shared throttle bucket); too high lets a client choose its address. This is reasoning, not yet measured: after deploy, send wrong-password logins from two networks and confirm the throttle is per client; if Render adds another hop, adjust the number.
5. CSRF/origin: the API protects mutations with the session-bound `X-CSRF-Token` header, not an Origin comparison. `PUBLIC_ORIGINS` only allows image URLs in articles/banners and `PUBLIC_BASE_URL` builds links, so set both to the Pages origin. The Function forwards `Origin`, `Referer` and `x-csrf-token` unchanged.

### 3. Migrate and seed (one-off from a laptop)
The runtime image has no Prisma CLI and Render free has no pre-deploy command, so run from a checkout after `npm ci`:
```
export DATABASE_URL='<supabase session pooler url>'
npm run be:db:migrate                          # prisma migrate deploy; safe to re-run
ALLOW_DEMO_SEED=true npm run be:db:seed        # STAGING ONLY, explicit, idempotent
```
Run migrations before deploying a release that carries a new migration, after taking a backup (free plan: no daily backups, so `pg_dump` the session pooler URL from the laptop). See BE-33 for the backup/restore procedure.

### 4. Cloudflare Pages (SPA + proxy)
1. Workers & Pages -> Create -> Pages -> connect the Git repo, production branch = the release branch.
2. Build settings: framework preset None, root directory `/` (the `functions/` folder must be at the repo root), build command `npx vite build --mode production --outDir dist`, output directory `dist`.
3. Environment variables (Production and Preview):

   | Key | Value |
   |---|---|
   | `NODE_VERSION` | `22` |
   | `VITE_API_MODE` | `http` (build time) |
   | `VITE_API_BASE_URL` | empty (same origin) |
   | `VITE_TEST_HOOKS` | `false` |
   | `API_ORIGIN` | the Render URL, e.g. `https://pretasiplus-api.onrender.com` (runtime, read by the Function). Unset = the Function answers 500 (fails closed). |
4. SPA fallback: nothing to add. Pages serves `index.html` for unknown paths when the build has no top-level `404.html` (Vite emits none), and `functions/api` wins for `/api/*`. A `_redirects` file is not needed. `public/_routes.json` limits the Function to `/api/*`, so static files do not count against the Function quota.
5. The Function (`functions/api/[[path]].ts`): preserves method, path and query; streams the body; `redirect: 'manual'`; returns every `Set-Cookie` unchanged; overwrites (never appends) `X-Forwarded-For` and `X-Real-IP` with `CF-Connecting-IP`; sets `X-Forwarded-Proto: https` and `X-Forwarded-Host` to the Pages host; strips hop-by-hop headers; adds no caching; answers 502 in the API error envelope (`{"error":{"code","message"}}`) when the API is unreachable, 500 when `API_ORIGIN` is unset, and 413 for `POST /api/files` over 22 MB (the API enforces its own `MAX_UPLOAD_MB`/`INTAKE_MAX_FILE_MB` below that). The free Pages plan allows 100,000 Function requests per day.

### 5. Smoke checklist
- [ ] `https://<project>.pages.dev/` loads; reload on a deep link returns the app.
- [ ] `https://<project>.pages.dev/api/health` returns OK (the first call is slow while Render wakes).
- [ ] Login with a demo account: the response sets `pp_session` on the Pages domain, `HttpOnly; Secure; SameSite=Lax`.
- [ ] A Bijak paper list loads (needs #49 and `BIJAK_POC_QUESTIONS=true`).
- [ ] An upload under the limit works; one over 22 MB gets a 413 JSON error.
- [ ] Render logs show the client address, not a Cloudflare one (see `TRUST_PROXY_HOPS`).

### 6. Roll back
- Frontend: Pages -> Deployments -> the previous good deployment -> Rollback (instant).
- API: Render -> Deploys -> redeploy the previous commit.
- Migrations are forward-only: if the bad release migrated, restore the Supabase backup instead.

### 7. Fallback: mock build to Pages (no backend)
A static demo where data stays in the browser. Create a **second Pages project** (or a branch preview) from the same repo:
- Build command `npm run build` (= `vue-tsc -b && vite build --mode demo && node scripts/check-demo-bundle.mjs`; the guard fails the build if test hooks leak). Faster, no type-check: `npx vite build --mode demo --outDir dist && node scripts/check-demo-bundle.mjs dist`.
- Output directory `dist`. Env `NODE_VERSION=22`. `VITE_API_MODE` comes from `.env.demo` (`mock`); do not set `API_ORIGIN` (no `/api` call is ever made in mock mode).

## Alternative: single VPS with Docker Compose

One stack: nginx serves the SPA (built with `VITE_API_MODE=http`) and proxies `/api/` to the `api` container.
Browser and API share one origin, so there is no CORS and the cookie session and CSRF work. Files:
`compose.yaml` (base) + `compose.staging.yaml` (staging overlay). Never use `compose.http.yaml` on staging
(dev/e2e only: seeds demo accounts on every start and sets `COOKIE_SECURE=false`).

### Prerequisites
- A VPS with Docker Engine and the Compose plugin (v2.24 or newer, the overlay uses `!override`), at least 2 GB RAM for the build.
- A domain with TLS. HTTPS must terminate in front of the frontend nginx (Caddy, Traefik, host nginx or a cloud load balancer) and forward to `127.0.0.1:5192` with `X-Forwarded-For` and `X-Forwarded-Proto`. The container itself speaks plain http on 8080.
- The repo checked out on the VPS at the release commit.
- Env files created from the examples (never committed):
  ```
  cp .env.api.example .env.api
  cp .env.db.example .env.db
  ```

### Env values
| Where | Key | Staging value |
|---|---|---|
| overlay (fixed) | `VITE_API_MODE` | `http` (build arg set by `compose.staging.yaml`) |
| overlay (fixed) | `COOKIE_SECURE` | `true` (cannot be overridden by `.env`) |
| shell or `.env` | `TRUST_PROXY_HOPS` | `1` = only the frontend nginx; `2` = one more TLS proxy in front. A wrong value lets clients spoof their address (too high) or throttles everyone as one (too low). With 2, also add real_ip handling in `docker/frontend/nginx.conf`. |
| `.env.api` | `NODE_ENV` | `production` (the compose file sets it) |
| `.env.api` | `DATABASE_URL` | `postgresql://<user>:<password>@db:5432/<db>` matching `.env.db` |
| `.env.api` | `SESSION_SECRET`, `IC_HASH_KEY` | random, 32+ chars, different from each other (`openssl rand -hex 32`) |
| `.env.api` | `PUBLIC_BASE_URL` | `https://<staging domain>` |
| `.env.api` | `ALLOW_DEMO_SEED` | leave `false`. Demo accounts are loaded only by the explicit one-off command below, staging only. Never `true` in production. |
| `.env.api` | `BIJAK_POC_QUESTIONS` | `true` on staging only. Not on this base yet: set it when BE-15/16 merge (it is not in `env.schema.ts` here). |
| `.env.db` | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | own values, random password |

### Deploy
```
git fetch && git checkout <release-commit>
docker compose -f compose.yaml -f compose.staging.yaml up -d --build --wait
```
Order is enforced: `db` healthy, then `migrate` (`prisma migrate deploy`, exits), then `api`, then `frontend`. A failed migration stops the api from starting.

Seed the staging demo accounts (STAGING ONLY, explicit and idempotent; refused by the guard unless the flag is given):
```
docker compose -f compose.yaml -f compose.staging.yaml run --rm -e ALLOW_DEMO_SEED=true migrate npm run be:db:seed
```
Demo accounts and their published password are listed in the seed docs (`apps/api/prisma/seed`). Do not run this on production; without the flag the production seed loads reference data only.

Health:
```
docker compose -f compose.yaml -f compose.staging.yaml ps
curl -fsS http://127.0.0.1:5192/healthz            # nginx
curl -fsS https://<domain>/api/health              # through TLS, nginx and the api
```

Log in with a demo account at `https://<domain>/` (credentials from the seed docs).

### Smoke checklist
- [ ] SPA loads at `https://<domain>/`; a deep link (reload on a client route) returns the app, not 404.
- [ ] `/api/health` returns OK through the domain.
- [ ] Login succeeds; the response sets `pp_session` with `HttpOnly; Secure; SameSite=Lax` (browser dev tools, Application, Cookies).
- [ ] A Bijak paper list loads for a student (needs BE-15/16 and `BIJAK_POC_QUESTIONS=true`).
- [ ] An upload under the limit works (default 10 MB; nginx allows 22 MB on `/api/files`); an oversize one is rejected cleanly.
- [ ] `docker compose ... logs api` shows structured log lines and no stack traces for the above.

### Roll back
Images are rebuilt from the checked-out commit, so roll back by redeploying the previous commit:
```
git checkout <previous-commit>
docker compose -f compose.yaml -f compose.staging.yaml up -d --build --wait
```
Migrations are forward-only. If the bad release applied a migration, restore the database backup taken before the deploy instead (take one first: see Backups). Uploads live in the `apifiles` volume and survive redeploys.

### Stop
```
docker compose -f compose.yaml -f compose.staging.yaml down        # keeps data volumes
docker compose -f compose.yaml -f compose.staging.yaml down -v     # DESTROYS database and uploads
```

### Backups
Take a dump before every deploy that carries a migration. The full backup and tested-restore procedure is BE-33 (`docs/plan/backend-tasks/BE-33-hardening-release.md`); `docs/ops/db-backup.md` is not on this base yet. Minimum until then:
```
docker compose -f compose.yaml -f compose.staging.yaml exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > backup-$(date +%F-%H%M).dump
```
Store dumps outside the repo and off the VPS.

### Security notes
- No demo seed in production: demo accounts have a published password. Production `.env.api` keeps `ALLOW_DEMO_SEED=false`.
- Staging must hold fictitious or anonymised data only. Real personal data (PDPA, including IC numbers and minors) needs the anonymiser (BE-35) or a production-grade setup with consent and retention rules.
- Secrets live only in `.env.api` and `.env.db` on the VPS (mode 600), never in the repo or in build args. `VITE_*` values are public in the bundle.
- Logs: `docker compose ... logs -f api frontend`. nginx redacts 64-hex path tokens and does not log the Referer; the API redacts the same. Do not paste logs with cookies or tokens into tickets. Docker's default json log driver has no rotation: set `log-opts` (`max-size`, `max-file`) in `/etc/docker/daemon.json`.
- Publish only the TLS proxy; the frontend port is bound to loopback and `db`/`api` publish nothing.
