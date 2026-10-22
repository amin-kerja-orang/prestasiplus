# Platform settings checklist (AZ-08)

One checklist of every platform setting that the application depends on, per platform and environment. It points to the step-by-step guides instead of repeating them and never contains a secret value. Variable names are defined in `apps/api/src/common/config/env.schema.ts`, `.env.api.example`, `render.yaml` and `deploy/pages-direct/_worker.js`.

Related: [demo-cloudflare-supabase.md](demo-cloudflare-supabase.md) (demo, step by step), [deploy-execution.md](deploy-execution.md), [deploy-staging.md](deploy-staging.md), [go-live-bijak-spm.md](go-live-bijak-spm.md) (section 3, production env), [api-runbook.md](api-runbook.md) (section 13, secret rotation), [db-password-rotation.md](db-password-rotation.md), the production VPS runbook (`docs/ops/production-vps.md`, AZ-09; arrives with PR #116), threat model `docs/architecture/v2-threat-model.md` (rows 18 to 21).

Conventions in the tables:

- **Who** is always `LEAD` (the lead types secrets into the platform; agents never touch a platform, see the rule in api-runbook.md).
- **Verify** commands use placeholders (`<project>`, `<service>`); run them from a laptop, they print no secret.
- `LEAD: confirm` marks anything that cannot be verified from the repo (a platform UI value, an account setting, a decision still open).
- Generate random values with `openssl rand -hex 32` (64 hex characters). PowerShell without openssl: `-join ((1..32) | % { '{0:x2}' -f (Get-Random -Max 256) })`.

## 1. Traffic path and proxy chain (read this first)

```
Demo        browser -> Cloudflare Pages (_worker.js, same origin /api) -> Render proxy -> Node API (port from PORT) -> Supabase
Production  browser -> VPS nginx (docker/frontend/nginx.conf, proxies /api) -> Node API (api:3000) -> Postgres 16 (db:5432)
```

How the API learns the client address (it feeds every per-address throttle, the audit log and the request log; one derivation point, `apps/api/src/common/net/client-ip.ts`):

| Setup | Variables | Address used |
|---|---|---|
| Demo, edge header mode (target) | `CLIENT_IP_HEADER=x-pp-client-ip` + `EDGE_PROXY_SECRET` (same value on the worker) | The header the worker fills from `CF-Connecting-IP`, trusted only when `X-PP-Edge-Secret` equals `EDGE_PROXY_SECRET`. Anything else (direct call to the Render URL, wrong secret, malformed header) falls back to the socket peer, never to a client-supplied value. |
| Demo, fallback (header mode off) | `TRUST_PROXY_HOPS=2` | Express reads the 2nd entry from the right of `X-Forwarded-For`: the worker overwrites the header with `CF-Connecting-IP` (hop 1: client), Render appends the worker egress (hop 2). Spoofable on a direct call to the Render URL; the API logs a `ClientIp` boot warning in production. |
| Production VPS, nginx only | `TRUST_PROXY_HOPS=1`, `CLIENT_IP_HEADER` empty | nginx sets `X-Forwarded-For $proxy_add_x_forwarded_for`; with 1 trusted hop Express takes the last entry, which is the address nginx saw. `compose.yaml` already sets 1 for the `api` service. |
| Production VPS behind Cloudflare or another load balancer | `TRUST_PROXY_HOPS=2` or header mode | `LEAD: confirm` the topology in AZ-09 before go-live. Too high lets a client choose its address; too low puts everyone in one bucket (api-runbook.md, section 12 step 6). |

## 2. Demo environment

### 2.1 Cloudflare Pages (static app + `_worker.js` edge)

Direct upload of `dist/` plus `deploy/pages-direct/_worker.js`. Secrets and variables apply to NEW deployments only: after changing one, upload a new deployment.

| Setting | Where | Required value rule | Who | Verify | Failure mode if wrong |
|---|---|---|---|---|---|
| `EDGE_PROXY_SECRET` | Pages project, Settings, Variables and Secrets (encrypted secret), or `npx wrangler pages secret put EDGE_PROXY_SECRET --project-name <project>` | Random, at least 32 characters, identical to the API's `EDGE_PROXY_SECRET` (surrounding whitespace is ignored on both sides). | LEAD | After the first request through the edge the Render log has NO `ClientIp` warning. Two-network check: 6 wrong logins from a phone on mobile data, then the laptop on another network can still log in (demo-cloudflare-supabase.md, "Edge client IP"). | Mismatch or missing: the API ignores the header and puts every user in the socket-peer bucket (all pupils share one throttle bucket, early 429). A shorter value is a Render boot failure on the API side, not here. No data exposure. |
| `API_ORIGIN` | Pages project, Variables (plain) | `https://<service>.onrender.com`, no path. Empty falls back to the default constant in `_worker.js` (the project's Render URL); a bad URL gives 500 `SERVER_ERROR`. | LEAD | `curl -fsS https://<project>.pages.dev/api/health` returns `status: ok`. | `/api` unreachable (502 or 500 JSON from the worker). |
| Worker header handling | `deploy/pages-direct/_worker.js` (in the repo, nothing to set) | Strips client `x-forwarded-for`, `x-real-ip`, `cf-connecting-ip`, `true-client-ip`, `x-pp-client-ip`, `x-pp-edge-secret`, `forwarded`, `x-forwarded-port`, `x-forwarded-ssl` (the exact list in `_worker.js`); rebuilds from `CF-Connecting-IP`; forces `cache-control: no-store` unless the API set one. Covered by `npm run test:edge` (`scripts/edge-worker.test.mjs`). | n/a | `npm run test:edge`; smoke test `scripts/demo-smoke.sh` step 1 (no-store) and step 5 (spoofed XFF still 429 on the 6th login). | A stale upload of an older worker lacks the secret header: same symptom as a secret mismatch. |
| Cache rule for `/api/*` | Cloudflare dashboard, Caching, Cache Rules (defence in depth) | Rule: path starts with `/api/` then "Bypass cache". The worker already sets `no-store`, so this is a second layer. `*.pages.dev` may not expose zone cache rules at all. | LEAD: confirm | `curl -sI https://<project>.pages.dev/api/health` shows `cache-control: no-store` and no `cf-cache-status: HIT`. | A cached `/api` answer would serve one user's data to another. Treat any `HIT` on `/api` as an incident. |
| Build variables | Build environment of the SPA (not a Pages setting when uploading `dist/`) | `VITE_API_MODE=http`; `VITE_API_BASE_URL` empty (same origin). Unset `VITE_API_MODE` silently falls back to the mock. | LEAD | Log in with a seeded demo account; the network tab shows `/api/...` calls. | The demo shows mock data, not the database. |
| Custom domain, TLS | Pages project, Custom domains | `LEAD: confirm` (not in the repo). If a domain is added, update `PUBLIC_ORIGINS` and `PUBLIC_BASE_URL` on Render. | LEAD | Browser opens the domain over HTTPS. | Cookies and QR join links point at the wrong origin. |

### 2.2 Render (API service `pretasiplus-api`)

Defined in `render.yaml` (free plan, Singapore, Docker). Every `sync: false` value is typed in the dashboard (Environment).

| Setting | Where | Required value rule | Who | Verify | Failure mode if wrong |
|---|---|---|---|---|---|
| Health check path | Service, Settings, Health and Alerts (blueprint: `healthCheckPath`) | `/api/health` (liveness: process up; `/api/health` and `/api/ready` are both exempt from the global throttle, `EXEMPT_PATHS` in `global-rate-limit.guard.ts`). Do NOT point it at `/api/ready` on the free plan: a database blip would then restart or mark the service unhealthy. Use `/api/ready` for the external uptime check instead. | LEAD | `curl -fsS https://<service>.onrender.com/api/health` gives `status: ok`, `db: up`; `/api/ready` gives `status: ready`, `migrations: applied`. | Render marks a healthy service down, or keeps a dead one live. |
| Auto-deploy | Service, Settings, Build and Deploy (blueprint: `autoDeploy: false`) | Off. Deploys are manual and need explicit LEAD confirmation (a deploy resets the ephemeral disk, see below). | LEAD | Settings shows Auto-Deploy "No". | A push redeploys mid-demo; uploaded files vanish; the first request is slow (about 6 minutes build). |
| Instance count | Service, Settings, Scaling | Exactly 1 (free plan is 1). Rate-limit counters are per process and in memory (threat model row 18, accepted by LEAD 2026-10-21 on the condition of ONE instance); `JOBS_WORKER_ENABLED` also assumes one worker. A shared store (Redis or a Postgres counter) is required before scaling out. | LEAD | Dashboard shows 1 instance. | With 2 instances every limit is doubled and split per process, and background jobs may run on neither or both. |
| Spin-down | Free plan behaviour | Sleeps after 15 minutes idle; first request about 1 minute. Open `/api/health` 2 to 3 minutes before presenting. Disk is ephemeral: uploads vanish on redeploy, restart or sleep. | LEAD | Run the wake-up request before the demo. | A slow first login in front of the audience. |
| `NODE_ENV` | `render.yaml` | `production`. Turns on the production refusals (SESSION_SECRET, IC_HASH_KEY, FILE_STORAGE_DIR, `MAIL_LOG_RESET_LINKS`). | LEAD | Log line `API listening on port <PORT>` after the deploy. | The API refuses to start and names the offending key (never the value). |
| `PORT` | Do not set | Render injects it. | LEAD | n/a | A wrong fixed port fails the health check. |
| `DATABASE_URL` | Dashboard secret | Supabase SESSION pooler URL (port 5432, `aws-<n>-<region>.pooler.supabase.com`), user `postgres.<PROJECT_REF>`, suffix `?sslmode=verify-full&sslrootcert=/etc/secrets/supabase-ca.crt` (CA mounted as a Render secret file `supabase-ca.crt`), fallback `?sslmode=no-verify`. Alphanumeric password (a special character must be URL-encoded). | LEAD | `/api/ready` returns 200. | `db: down` in `/api/health` or `Invalid environment configuration. DATABASE_URL`. |
| `SESSION_SECRET` | Dashboard secret | Random, `openssl rand -hex 32`. Schema minimum is 16 characters and not `change-me`; use 32 or more. Different from `IC_HASH_KEY`. | LEAD | Boot succeeds; login works. | Boot refused in production. Rotating it logs everyone out (see db-password-rotation.md, section 5.1). |
| `IC_HASH_KEY` | Dashboard secret | Random, min 32 in production (loadEnv MIN_IC_KEY_LENGTH), 16 in the schema; different from `SESSION_SECRET`. Never rotate casually (it invalidates every stored IC hash until all are recomputed; api-runbook.md section 13). | LEAD | Boot succeeds. | Boot refused; or, if changed later, IC-based reset and IC search stop matching. |
| `CLIENT_IP_HEADER` | Dashboard (plain) | `x-pp-client-ip` (allow-list in the schema: `x-pp-client-ip`, `cf-connecting-ip`, `x-real-ip`, `true-client-ip`, lowercase). Requires `EDGE_PROXY_SECRET`, else the boot fails. | LEAD | Two-network check above. | Unset: old behaviour via `TRUST_PROXY_HOPS` (spoofable on a direct call). |
| `EDGE_PROXY_SECRET` | Dashboard secret | Random, at least 32 characters, equal to the Pages secret. | LEAD | As in 2.1. | Shorter than 32 fails the boot; mismatch means one shared bucket. |
| `TRUST_PROXY_HOPS` | `render.yaml` | `2` (worker, then Render proxy). Still governs `req.secure` and is the fallback when header mode is off. | LEAD | Smoke test step 5 (spoofed XFF does not change the bucket). | Too high: a client picks its address. Too low (1): all users share the Cloudflare egress address. |
| `COOKIE_SECURE` | `render.yaml` | `true` (browser talks HTTPS to Pages). Only `false` for a plain-http rehearsal. | LEAD | Login response `Set-Cookie` carries `Secure`. | `false` on a public site sends the session cookie over http. |
| `COOKIE_DOMAIN` | Leave unset | Empty: host-only cookie on the Pages domain. | LEAD | Cookie has no `Domain` attribute. | A wrong domain makes the browser drop the cookie (login appears to succeed, session lost). |
| `PUBLIC_BASE_URL` | Dashboard | Valid URL of the Pages origin, `https://<project>.pages.dev` (class QR join links). An empty value fails the boot. | LEAD | Boot succeeds; a class QR link opens the app. | Boot failure, or QR links point to the wrong host. |
| `PUBLIC_ORIGINS` | Dashboard | Comma-separated web origins allowed in article and banner image URLs (the API origin is always allowed): the Pages origin. | LEAD | An article with an image from the Pages origin saves. | Image URL validation rejects valid images. |
| `ALLOW_DEMO_SEED` | `render.yaml` | `false` on the running API (the seed is a one-off from a laptop; the running API never seeds). Only the laptop shell runs the seed with `true`, never saved on Render. | LEAD | Dashboard shows `false`. | `true` on a public service invites a re-seed with published demo credentials. |
| `BIJAK_POC_QUESTIONS` | `render.yaml` | `true` for the demo (the demo papers place PoC questions). `false` in production. | LEAD | A demo Bijak paper shows its questions. | `false` on the demo: PoC ids are refused, papers look empty. `true` in production serves PoC questions to real pupils. |
| `SEED_DEMO_PASSWORD_HASH` | Laptop shell only, at seed time (not a Render variable) | An argon2id PHC string used as the password hash of every demo account. Set it before the first seed on any public environment; unset hashes the published dev password (named in demo-reseed.md). An invalid value fails the seed without printing it. Existing accounts keep their hash. | LEAD | Log in as a demo account with the published dev password: it must FAIL. | Anyone can log in as the demo admin. |
| Throttles `THROTTLE_*` | Dashboard (plain) | See 2.5 below. | LEAD | See 2.5. | See 2.5. |
| `METRICS_ENABLED` | Dashboard (optional) | `true` (default) is fine: in production `/api/metrics` needs an admin session unless the caller's peer is in `METRICS_INTERNAL_CIDRS`. `false` makes it answer 404. | LEAD | Anonymous `curl -s -o /dev/null -w '%{http_code}' https://<project>.pages.dev/api/metrics` is not 200. | Metrics readable by anyone (only if a CIDR is too wide). |
| `METRICS_INTERNAL_CIDRS` | Dashboard (optional) | Leave unset on Render: the direct peer is a Render proxy address, so a CIDR allow-list is meaningless there. | LEAD | Anonymous request to `/api/metrics` is refused. | A broad CIDR would let any proxy-routed request read metrics. |
| `AI_PROVIDER` | Dashboard (optional) | `mock` (default) for the demo. A real provider (`anthropic`, `openai`, `gemini`, `openai-compatible`) needs `AI_MODEL`, `AI_API_KEY`, `AI_MONTHLY_BUDGET_SEN` and a price entry in `AI_PRICE_TABLE_JSON`, otherwise it counts as NOT configured (fail closed). An unknown id stops the boot. | LEAD (decision OD-14 open) | `GET /api/ai/status` as admin shows the provider and `configured`. | Intake extraction unavailable (`AI_UNAVAILABLE`), or spend without a cap. |
| `AI_API_KEY` | Dashboard secret | The provider key; set only in the platform secret store; never committed, logged or stored. The provider receives redacted text only (threat model row 46). | LEAD | `/api/ai/status` reports configured, without printing the key. | Leaked key = spend on the lead's account. Rotate at the provider and update the secret. |
| `AI_MODEL`, `AI_BASE_URL`, `AI_BASE_URL_ALLOWLIST`, `AI_PRICE_TABLE_JSON`, `AI_MONTHLY_BUDGET_SEN` | Dashboard (optional) | Per `.env.api.example`. `AI_BASE_URL` (openai-compatible only) must be https and its host in `AI_BASE_URL_ALLOWLIST`. | LEAD | As above. | Provider counts as not configured. |
| `FILE_STORAGE_DIR` | `render.yaml` | `/var/lib/pretasiplus/files` (absolute; required in production). Ephemeral on the free plan. | LEAD | Upload works; remember files vanish on redeploy. | Boot refused if missing in production. |

### 2.3 Supabase (Postgres)

| Setting | Where | Required value rule | Who | Verify | Failure mode if wrong |
|---|---|---|---|---|---|
| Connection mode | Project, Connect | SESSION pooler (port 5432). Not the transaction pooler (6543): Prisma prepared statements break. Not "Direct connection" (IPv6 only on the free plan). | LEAD | `/api/ready` is 200 on Render. | Random query failures (transaction pooler) or no connection (direct). |
| SSL mode | Project Settings, Database, SSL Configuration | Runtime: `sslmode=verify-full&sslrootcert=...` (node-postgres) or `no-verify` as a documented fallback. Laptop Prisma migrate: `sslmode=require`. Laptop seed: `no-verify`. Never `require` for the runtime (node-postgres treats it as verify). "Enforce SSL" `LEAD: confirm` is on. | LEAD | Boot logs no TLS error. | `self-signed certificate in certificate chain`, boot failure or `db: down`. |
| Data API lockdown | Supabase SQL editor, run `scripts/supabase/lockdown-data-api.sql` once after the migrations, again after any re-migration | Revokes `anon`, `authenticated`, `service_role` rights on `public` (the tables have no Row Level Security). The API connects as the `postgres` pooler role and is unaffected. Idempotent. | LEAD | As the anon key, an unauthenticated REST read of a table (`curl` with the project's public key) is refused (permission denied). Do the check from the laptop; never paste the key into the repo. | Pupil data readable through the public Data API. Treat as a breach. |
| Database password | Project Settings, Database | Alphanumeric random, stored only as part of `DATABASE_URL`. Rotation: [db-password-rotation.md](db-password-rotation.md) section 1. | LEAD | `/api/ready` after rotation. | API cannot connect. |
| Data API exposure | Project Settings, API (Data API) | Defence in depth: turn the Data API off, or remove `public` from the exposed schemas (the app never uses it). `LEAD: confirm` the UI wording. | LEAD: confirm | The REST endpoint with the public key returns an error for `public` tables. | Data API stays reachable if the revoke SQL is ever skipped after a re-migration. |
| Row Level Security | SQL editor (not in the repo) | Enable RLS on every `public` table with no policies (deny-all for `anon` and `authenticated`); the API's owner role bypasses it. `LEAD: confirm` this is applied; the repo has only the revoke SQL, and new tables from later migrations need it again. | LEAD: confirm | `select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;` returns no rows. | A re-grant by Supabase defaults would expose a table. |
| Pool size | Project, Connect | Free tier session pool is about 15 connections per role; the API's pg pool (10) fits one instance only. | LEAD: confirm | Supabase dashboard, connections graph. | `too many clients` if a second API instance or a long laptop script runs. |
| Backups | Project, Database, Backups | Free plan has no point-in-time restore. Take a manual `pg_dump` before any delta or reseed (demo-cloudflare-supabase.md). `LEAD: confirm` plan features. | LEAD | A dump file restores into a scratch database. | No recovery point after a bad migration. |
| Pausing | Free plan | A free project pauses after a week of inactivity. `LEAD: confirm` it is active before 23 Oct. | LEAD | Dashboard shows "Active". | The API shows `db: down`. |

### 2.4 Order of operations when changing demo settings

1. Pages secrets or variables, then upload a new deployment.
2. Render environment variables (a save triggers a restart or redeploy), wait for `API listening on port ...`.
3. Smoke test: `BASE_URL=https://<project>.pages.dev bash scripts/demo-smoke.sh`, after `read -rs DEMO_PASSWORD; export DEMO_PASSWORD` in the same shell (the prompt does not echo and keeps the value out of history).
4. Edge secret changes follow section 3 below.

### 2.5 Demo throttle values (23 Oct demo)

Why: many pupils sit behind ONE school address. Per-address buckets (everything keyed by `req.ip`) are shared by the whole class, while per-user buckets are not. Current defaults are in `.env.api.example`; the demo runbook says "do not lower them", this section is about raising only the per-address ones.

| Variable | Keyed by | Default | Demo recommendation | Reason |
|---|---|---|---|---|
| `THROTTLE_GLOBAL_PER_MINUTE` | address, all `/api` routes except health and ready | 300 | Raise to 3000 `LEAD: confirm` | 30 or more pupils loading pages (several calls each) from one school address can pass 300 per minute and get 429 on random calls. This is the one most likely to bite. |
| `THROTTLE_PUBLIC_PER_MINUTE` | address (public lookups: jpn, ppd) | 60 | Raise to 600 `LEAD: confirm` | A class registering or looking up schools at the same time. |
| `THROTTLE_PUBLIC_SEARCH_PER_MINUTE` | address (school typeahead) | 300 | Keep | Already sized for a school. |
| `THROTTLE_REGISTER_PER_MINUTE` | address (self-registration) | 30 | Keep, raise to 120 only if the demo registers a whole class live | The default already tolerates a school behind one NAT. |
| `THROTTLE_PARENT_INVITE_PREVIEW_PER_MINUTE`, `THROTTLE_SUPPORT_CONFIG_PER_MINUTE`, `FILE_READS_PER_MINUTE` (anonymous cms_image only) | address | 30, 60, 120 | Keep | Not on the class login path. |
| `THROTTLE_LOGIN_PER_MINUTE` | identifier plus address pair | 5 | Keep | Per pair, so a shared address is fine; this protects each account from guessing. |
| `LOGIN_IDENTIFIER_FAIL_LIMIT` | identifier, all addresses | 100 | Keep | Account-level brute-force ceiling. |
| Login per-address ceiling (20 failed logins per minute across all identifiers) | address | 20, fixed in code, no env variable | Cannot be changed by config | A whole class mistyping at once could trip it. Report to the backend developers if it matters; otherwise brief pupils to log in in two waves. `LEAD: confirm`. |
| All per-user `THROTTLE_*` | user | defaults | Keep | Not affected by sharing an address. |

Set the raised values on Render (Environment), redeploy, then run the demo-smoke test. Check that the edge header mode works first (section 2.1): without it all users already share the Cloudflare egress address and the global bucket would be hit by the whole audience, not just one school.

PUT THEM BACK: after the demo and before any production use, delete these variables on Render (the code defaults apply again) and record it in the rotation/changes log. Production keeps the defaults unless OQ1 in go-live-bijak-spm.md changes them. A production VPS has the same sharing problem for schools: the values to use there are a LEAD decision for AZ-09, not an inheritance of the demo's raised numbers.

## 3. Edge secret pair: rotation

The pair is the Pages secret `EDGE_PROXY_SECRET` (sent by the worker as `X-PP-Edge-Secret`) and the Render variable `EDGE_PROXY_SECRET`.

**Finding: the API accepts ONE value only** (`apps/api/src/common/net/client-ip.ts`, a single constant-time comparison against `EDGE_PROXY_SECRET`; the worker also sends exactly one). Dual-secret rotation with zero gap is therefore not supported. There is, however, no outage and no security downgrade during the window: while the two sides differ, the API ignores the header and uses the socket peer address (the Cloudflare or Render proxy address), so every user shares one throttle bucket. With the global ceiling at 300 per minute (or the raised demo value) that can mean early 429 for a busy class; nothing is exposed. Request a dual-value change from the backend developers if a zero-gap rotation is needed (accept `EDGE_PROXY_SECRET` and a `EDGE_PROXY_SECRET_PREVIOUS`).

Brief-window procedure (LEAD confirms first; do it off-peak, never during the demo):

1. Generate the new value on the laptop: `openssl rand -hex 32`. Keep it in a password manager, never in a ticket, chat or shell history (type or paste it into the platform UI).
2. Prepare the Pages side: have the next `dist/` + `_worker.js` upload ready to run.
3. Render first: set the new `EDGE_PROXY_SECRET` and save; wait for "Live" and `API listening on port ...`. The window starts now (the old worker still sends the old value). Render goes first because its restart takes minutes, whereas the Pages upload goes live in seconds, which makes the window shorter than the other order.
4. Immediately set the new Pages secret (`npx wrangler pages secret put EDGE_PROXY_SECRET --project-name <project>` or the dashboard) and upload the new deployment. The window ends when that deployment is live.
5. Verify: no new `ClientIp` warning in the Render log after the first request; the two-network check from the demo runbook ("Edge client IP"); `scripts/demo-smoke.sh` steps 1 and 5.
6. Delete the old value everywhere (password manager entry, notes).

Rollback: put the old value back on both sides (same order), or remove `CLIENT_IP_HEADER` on Render and redeploy (the API then uses `TRUST_PROXY_HOPS`, the older spoofable behaviour; temporary only).

Cadence: every 90 days (api-runbook.md section 13) and immediately after a suspected leak. The secret is redacted in logs (`x-pp-edge-secret`, threat model rows 20 and 51).

## 4. Production environment (owner's VPS, docker compose)

Details, files and hardening are in the production VPS runbook (`docs/ops/production-vps.md`, AZ-09; arrives with PR #116). The settings below are the application-side rules that runbook must satisfy; the `LEAD: confirm` rows are decided there.

### 4.1 `.env.api` (git-ignored, copied from `.env.api.example`)

| Setting | Required value rule | Who | Verify | Failure mode if wrong |
|---|---|---|---|---|
| `NODE_ENV` | `production` (compose sets it) | LEAD | `docker compose exec api printenv NODE_ENV` | Production refusals are skipped (dev defaults for secrets). |
| `DATABASE_URL` | `postgresql://<USER>:<PASSWORD>@db:5432/<DBNAME>` using the `.env.db` user, password and database. Alphanumeric password. | LEAD | `curl -fsS http://127.0.0.1:5192/api/ready` (through nginx) and `docker compose exec api wget -qO- http://127.0.0.1:3000/api/ready` | `/api/health` 200 but `/api/ready` 503: the database or a migration is the problem. |
| `SESSION_SECRET`, `IC_HASH_KEY` | Distinct random values, `openssl rand -hex 32` each, min 32 recommended for both; `IC_HASH_KEY`: min 32 in production (loadEnv MIN_IC_KEY_LENGTH), 16 in the schema; `SESSION_SECRET`: min 16. | LEAD | Boot succeeds. | Boot refused; shared values weaken the IC hash. |
| `TRUST_PROXY_HOPS` | `1` for compose + the frontend nginx (set in `compose.yaml`; staging overlay defaults to 1). `2` if Cloudflare or another load balancer sits in front of nginx. | LEAD: confirm topology | 6 wrong logins from one network do not block another network. | See section 1. |
| `CLIENT_IP_HEADER`, `EDGE_PROXY_SECRET` | Empty when nginx is the only proxy. If a Cloudflare worker or tunnel is added in front, use the header mode of section 3 with a worker secret and `x-pp-client-ip`. In production with `TRUST_PROXY_HOPS` greater than 0 and either unset, the API logs a boot warning. | LEAD: confirm | Boot log. | Spoofable client address behind a second proxy. |
| `COOKIE_SECURE` | `true` (HTTPS terminated at nginx or in front). The staging overlay fixes it to `true`. | LEAD | `Set-Cookie` has `Secure`. | Session cookie over http. |
| `COOKIE_DOMAIN` | Empty (host-only cookie) unless decision D-2 in go-live-bijak-spm.md says otherwise. | LEAD | Cookie has no `Domain`. | Dropped cookie, login loop. |
| `PUBLIC_BASE_URL`, `PUBLIC_ORIGINS` | The production site origin, https. `PUBLIC_BASE_URL` must be a valid URL (an empty value fails the boot). | LEAD | Boot succeeds; a class QR link opens the site. | Boot failure, wrong QR links. |
| `ALLOW_DEMO_SEED` | `false`. With it false the seed loads reference data only. | LEAD | `grep ALLOW_DEMO_SEED .env.api` (value only, never print other lines). | Demo accounts with a published password in production. |
| `BIJAK_POC_QUESTIONS` | `false` (LEAD decision 2026-10-20: PoC questions never in production). | LEAD | `grep BIJAK_POC_QUESTIONS .env.api` | PoC questions served to real pupils. |
| `SEED_DEMO_PASSWORD_HASH` | Unset in production (it is only for staging or production-demo seeding). | LEAD | Not present in `.env.api`. | n/a if unset. |
| `MAIL_LOG_RESET_LINKS` | `false`; `true` refuses the boot in production. | LEAD | Boot succeeds. | Reset links in logs (leaks a secret). |
| `FILE_STORAGE_DIR` | Absolute path on the persistent volume `apifiles` (the Dockerfile sets it). | LEAD | Upload survives `docker compose down` and `up`. | Boot refused; or lost files if the volume is removed (`down -v`). |
| `METRICS_ENABLED`, `METRICS_INTERNAL_CIDRS` | Metrics on. Set `METRICS_INTERNAL_CIDRS` only to the docker network of a scraper that reaches the API directly (direct peer, not through nginx), for example the compose network CIDR. Unset in production = admin session only. | LEAD | From inside the compose network the scraper gets 200; through the public site anonymous gets a refusal. | Too wide a CIDR exposes metrics. |
| `THROTTLE_*` | Code defaults (section 2.5 raised values are demo-only). One API instance only (threat model row 18). | LEAD | `.env.api` has no raised throttle lines left from the demo. | Weaker abuse protection, or shared-IP schools blocked (decide in AZ-09). |
| `JOBS_WORKER_ENABLED` | `true` on exactly one instance. | LEAD | n/a | Intake jobs never run, or run twice. |
| `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, `AI_BASE_URL`, `AI_BASE_URL_ALLOWLIST`, `AI_MONTHLY_BUDGET_SEN`, `AI_PRICE_TABLE_JSON` | As in 2.2. `AI_API_KEY` only in `.env.api` (mode 600, owner only). | LEAD (OD-14) | `GET /api/ai/status` as admin. | See 2.2. |
| `LOG_LEVEL` | `info` | LEAD | Logs are JSON on stdout. | n/a |

### 4.2 `.env.db`, nginx, host

| Setting | Required value rule | Who | Verify | Failure mode if wrong |
|---|---|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` in `.env.db` | Random alphanumeric password. `POSTGRES_PASSWORD` only takes effect at the FIRST initialisation of the `pgdata` volume; later changes need `ALTER ROLE` (db-password-rotation.md section 2). | LEAD | `docker compose ps db` shows healthy. | `.env.db` and the live role diverge silently. |
| `.env.api` and `.env.db` file mode | `chmod 600`, owner is the deploy user, never in git (`.gitignore`). | LEAD: confirm | `stat -c '%a %U' .env.api .env.db` | Other host users can read the secrets. |
| Database port | No host port (compose default). | LEAD | `docker compose ps` shows no published 5432. | Database exposed to the internet. |
| nginx proxy headers | `docker/frontend/nginx.conf` proxies `/api` with `X-Forwarded-For $proxy_add_x_forwarded_for`; it is the single trusted hop. Cache: API answers carry their own `cache-control`; confirm nothing caches `/api`. | LEAD: confirm in AZ-09 | `curl -sI https://<site>/api/health` shows `no-store` or no shared-cache hit. | Wrong client address; cached private data. |
| Instance count | `api` runs as ONE container. | LEAD | `docker compose ps api` lists one. | Per-process rate limits split (threat model row 18). |
| Backups | Daily `npm run db:backup`, monthly restore drill (db-backup.md); alert on a non-zero exit. | LEAD | Newest `pp-backup-*.dump` is under a day old. | No recovery point. |
| Uptime and alerts | External check on `/api/ready` through the public domain; account `LEAD: confirm` (api-runbook.md section 11). | LEAD | Test alert received. | Outage unnoticed. |

### 4.3 HSTS (HTTP Strict Transport Security)

Ramp it up; a wrong HSTS value is hard to undo because browsers cache it for `max-age` seconds.

Who sends it today:
- **The API**, in production (`NODE_ENV=production` or a secure request): `max-age=15552000; includeSubDomains`, hard-coded in `apps/api/src/common/security/security-headers.ts` (BE-33). Any browser that sees one `/api` answer of a production API on a host caches that policy for 6 months, subdomains included.
- **Production VPS edge (AZ-09, #116):** the edge owns HSTS for the whole host. It sends `PP_HSTS` (default `max-age=300`) on every https response, SPA and `/api`, and hides the API's own header on `/api` (`proxy_hide_header`), so the ramp below is what browsers see.
- `docker/frontend/nginx.conf` (the compose frontend) sets none.

| Where | Setting | Rule | Verify |
|---|---|---|---|
| Production VPS edge (AZ-09) | `PP_HSTS` in `/etc/pretasiplus/prod.env` (default `max-age=300`; empty = no header) | Ramp: 5 minutes (`max-age=300`), then 1 day (86400), 1 week (604800), then 6 months (15552000). Add `; includeSubDomains` only after checking that every subdomain of the registrable domain serves HTTPS (the owner may have other subdomains). Do NOT add `preload` until the value has been stable for months and the lead agrees (preload is effectively permanent). | `curl -sI https://<site>/ \| grep -i strict-transport` and the same for `https://<site>/api/health`: exactly one header each, equal to `PP_HSTS` |
| Demo, Cloudflare | Zone SSL/TLS, Edge Certificates, HSTS (custom domain only). `*.pages.dev` is expected to send HSTS already (`LEAD: confirm` with one `curl -sI https://<project>.pages.dev/`). The Pages worker passes the API's own header through on `/api`, so a custom demo domain gets `max-age=15552000; includeSubDomains` from the first `/api` answer unless the worker strips or replaces it (`LEAD: confirm` before attaching a custom domain). | Same ramp, same no-preload rule. | Same `curl -sI`, on `/` and on `/api/health`. |

## 5. Pre-demo checklist (23 Oct)

- [ ] Supabase project active; lockdown SQL applied after the last migration (2.3).
- [ ] Render service Live, one instance, auto-deploy off, `/api/ready` is 200 (2.2).
- [ ] `ALLOW_DEMO_SEED=false` and `BIJAK_POC_QUESTIONS=true` on Render; demo accounts do not accept the published dev password (`SEED_DEMO_PASSWORD_HASH` was set at seeding).
- [ ] Edge secret pair equal; no `ClientIp` warning; two-network check done (2.1, 3).
- [ ] Raised per-address throttles decided and applied, or deliberately left at default (2.5).
- [ ] Wake-up request sent 2 to 3 minutes before the start; `scripts/demo-smoke.sh` passes.
- [ ] After the demo: raised throttles removed (2.5), seed password and edge secret rotated if shared with others.

## 6. Open items for the lead

- Raise `THROTTLE_GLOBAL_PER_MINUTE` and `THROTTLE_PUBLIC_PER_MINUTE` for the demo (2.5): yes or no, and the numbers.
- Fixed per-address login ceiling (20 per minute) cannot be tuned: accept, or ask the backend developers to make it configurable.
- Dual edge-secret support (zero-gap rotation): not implemented; ask the backend developers only if needed.
- Cloudflare cache rule on `/api/*` and custom domain: confirm they exist or are unavailable on `*.pages.dev`.
- Production topology (nginx only vs Cloudflare in front), hence `TRUST_PROXY_HOPS`, and the production throttle policy for shared school addresses: decide in AZ-09.
