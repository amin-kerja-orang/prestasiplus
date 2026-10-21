# Demo deploy: Cloudflare Pages + Render + Supabase (temporary)

Temporary demo for 2026-10-21. Step by step, about 30-45 minutes. Everything runs on free tiers.
The longer staging notes (and the VPS alternative) are in [deploy-staging.md](deploy-staging.md).

```
Browser --> https://<project>.pages.dev      static SPA, built with VITE_API_MODE=http
              \-- /api/*  --> Pages Function functions/api/[[path]].ts
                                  --> API_ORIGIN = https://<service>.onrender.com   (NestJS API, Docker)
                                          --> Supabase Postgres (session pooler, port 5432)
```

- One origin for the browser (SPA and `/api` together): no CORS, the `pp_session` cookie
  (`HttpOnly; Secure; SameSite=Lax`) is first-party and the CSRF header flow works unchanged.
- All application data lives in Supabase Postgres. The http build installs no mock server and no seed in the
  browser. Exceptions: uploaded files (Render disk, ephemeral, see Known limits) and the Bijak device copy of
  unsent answers (a localStorage mirror of what the page autosaves, cleared on submit).
- The API cannot run on Cloudflare Workers free (10 ms CPU per request vs Argon2id login, the native
  `@node-rs/argon2` module, BE-04 files on local disk). Only the tiny proxy runs on Cloudflare.
- Never put a real secret in the repo, a ticket or a chat. Placeholders below look like `<SUPABASE_DB_PASSWORD>`.

## 0. Before you start

**Accounts** (all free, sign in with GitHub where offered):
- Supabase (https://supabase.com) - database.
- Render (https://render.com) - API. It needs access to the GitHub repo `amin-kerja-orang/prestasiplus`.
- Cloudflare (https://dash.cloudflare.com) - Pages. It needs access to the same repo.

**Laptop:** a checkout of the repo, Node 22, `npm ci` done, Git Bash (for the smoke test).

**Which commit** (see "What must be merged first" at the end): Pages and Render both build the same SHA of the
deploy branch `be/integration-frontend` (UI + backend), re-synced with `feature/v2-backend` after this PR merges.

**Make three random secrets** now and keep them in a password manager (not in a file in the repo):
```
openssl rand -hex 32     # <SESSION_SECRET>
openssl rand -hex 32     # <IC_HASH_KEY>   (must differ from SESSION_SECRET)
```
(PowerShell without openssl: `-join ((1..32) | % { '{0:x2}' -f (Get-Random -Max 256) })`.)

## 1. Supabase: project and connection string (5 min)

1. New project. Name `pretasiplus-demo`, region **Southeast Asia (Singapore)**, a strong database
   password = `<SUPABASE_DB_PASSWORD>`. Plan Free. New projects get Postgres 17 (the migrations were checked
   for it, see "Migration compatibility").
2. Top bar **Connect** -> **Session pooler** (NOT "Transaction pooler", NOT "Direct connection"):
   ```
   postgresql://postgres.<PROJECT_REF>:<SUPABASE_DB_PASSWORD>@aws-<n>-ap-southeast-1.pooler.supabase.com:5432/postgres
   ```
   - Session pooler = port **5432**, IPv4, prepared statements work (Prisma needs them).
   - Transaction pooler (port 6543) breaks Prisma prepared statements: never use it here.
   - Direct connection (`db.<PROJECT_REF>.supabase.co`) is IPv6 only on free: Render cannot reach it.
   - URL-encode special characters in the password (`@` = `%40`, `#` = `%23`, `/` = `%2F`), or pick a
     password of letters and digits only.
3. TLS. Supabase signs its server certificate with its own root CA, which is not in Node's default CA store.
   Two URL variants, use them exactly as written:

   | Used by | URL suffix | Why |
   |---|---|---|
   | Render runtime (node-postgres) | `?sslmode=verify-full&sslrootcert=/etc/secrets/supabase-ca.crt` | Encrypted and verified. Needs the CA file as a Render secret file (step 4.3). |
   | Render runtime, fallback | `?sslmode=no-verify` | Encrypted, certificate NOT verified (a man-in-the-middle on the network path could read the DB password). Use only if the CA variant fails at boot with `self-signed certificate in certificate chain`, `unable to verify the first certificate` or `ENOENT`/`EACCES ... supabase-ca.crt`. Acceptable for this temporary demo only. |
   | Laptop: `be:db:migrate` (Prisma schema engine) | `?sslmode=require` | Encrypted. Prisma does not read `verify-full`/`sslrootcert` like node-postgres. |
   | Laptop: `be:db:seed` (node-postgres) | `?sslmode=no-verify` | One-off from your laptop; or the `verify-full` form with `sslrootcert=<path to the downloaded crt>`. |

   Download the CA: Project Settings -> Database -> **SSL Configuration** -> Download certificate
   (`prod-ca-2021.crt`). It is a public certificate, not a secret, but keep it out of the repo anyway.
   (Do not write `sslmode=require` for the runtime: node-postgres treats it as "verify" and the boot fails on
   the unknown CA.)

## 2. Migrate and seed from the laptop (5 min)

The runtime image has no Prisma CLI and Render free has no shell or pre-deploy command, so this is a one-off
from your laptop checkout of `feature/v2-backend` (after this PR merges; with #51 merged if it is in the demo).

Git Bash:
```
export NODE_ENV=production
export DATABASE_URL='postgresql://postgres.<PROJECT_REF>:<SUPABASE_DB_PASSWORD>@aws-<n>-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
npm run be:db:migrate                                   # prisma migrate deploy; safe to re-run
export DATABASE_URL="${DATABASE_URL%\?*}?sslmode=no-verify"
ALLOW_DEMO_SEED=true npm run be:db:seed                 # demo accounts + demo data; idempotent
unset DATABASE_URL
```
PowerShell:
```
$env:NODE_ENV='production'
$env:DATABASE_URL='postgresql://postgres.<PROJECT_REF>:<SUPABASE_DB_PASSWORD>@aws-<n>-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
npm run be:db:migrate
$env:DATABASE_URL=$env:DATABASE_URL.Replace('sslmode=require','sslmode=no-verify')
$env:ALLOW_DEMO_SEED='true'; npm run be:db:seed
Remove-Item Env:DATABASE_URL, Env:ALLOW_DEMO_SEED
```
Expected: `migrate deploy` lists the applied migrations (`0001_init` ... `0018_aggregate_school_id`, including `0015_classes`; more if later
PRs merged) and ends with "All migrations have been successfully applied". `0001_init` prints a NOTICE that
`pgcrypto` already exists (Supabase pre-installs it in the `extensions` schema): that is fine. The seed ends
with `seed: profile=poc, 11 module(s): ...` (base 01c47e75; `poc-classes` is the 10th). The line "PoC questions not loaded (BE-09 wire-up TODO)" is
expected: the PoC Bijak questions are served by the API from code, not from the seed.

`NODE_ENV=production` matters: the seed then refuses the demo modules unless `ALLOW_DEMO_SEED=true` is given
explicitly. Never run the demo seed against a real production database.

If `be:db:migrate` fails with a TLS or certificate error, append `&sslaccept=accept_invalid_certs` to the
migrate URL (still encrypted). If it cannot download its engine (corporate proxy), run it from another network.

**Demo logins** (fictitious accounts, created by the seed): `pelajar@demo.test` (student with data),
`pelajarmaju@demo.test`, `pelajar2@demo.test` (empty), `guru@demo.test`, `adminsekolah@demo.test`,
`admin@demo.test` (Admin Pusat). The shared demo password is in [../AKAUN-DEMO.md](../AKAUN-DEMO.md)
(not repeated here). It is published, so this database must never hold real data.

## 3. Supabase: lock down the Data API (3 min, do not skip)

Supabase publishes the `public` schema through its Data API (REST and GraphQL) to anyone holding the project's
**anon key**, which is public by design (it is meant for browsers). By default the API roles `anon` and
`authenticated` get full rights on every new table in `public`. Our tables live in `public` and have no Row
Level Security, so without this step every student row (names, e-mails, answers, sessions) would be readable,
and writable, by anyone with the anon key and the project URL. We do not use the Data API at all.

Do both:

1. **Turn the Data API off.** Dashboard -> Integrations -> **Data API** -> switch "Enable Data API" off
   (older dashboards: Project Settings -> API -> Data API settings, or remove `public` from "Exposed schemas").
   Do the same for GraphQL if the dashboard lists it separately.
2. **Revoke the grants** (defence in depth, also covers a later accidental re-enable). SQL Editor -> New query ->
   paste [scripts/supabase/lockdown-data-api.sql](../../scripts/supabase/lockdown-data-api.sql) -> Run.
   Then run the verify queries at the bottom of that file: `leaked_grants` = 0, `anon_reads_users` = false; if
   `pg_graphql` is listed, make sure GraphQL is off in the dashboard too. The script also revokes `service_role`
   (defence in depth; the app never uses that key).
   Re-run the script after any later migration batch (idempotent).

Effect on the app: none. The API connects as `postgres` (pooler user `postgres.<PROJECT_REF>`), owns every
table and keeps all of its rights; only the Data API roles lose access. Do not use the `service_role` key
anywhere; it is not needed.

## 4. Render: the API (10 min, of which ~6 min build)

1. Dashboard -> **New** -> **Blueprint** -> pick the repo, branch = the deploy branch (same SHA as Pages). Render reads
   [render.yaml](../../render.yaml): Docker, `docker/api/Dockerfile`, plan Free, region Singapore, health check
   `/api/health`, auto-deploy off.
   (Without a blueprint: New -> Web Service -> Docker, Dockerfile path `./docker/api/Dockerfile`, Docker context
   `.`, Free, Singapore, Health Check Path `/api/health`, then add the variables below by hand.)
2. Fill the `sync: false` variables when asked:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the session pooler URL + `?sslmode=verify-full&sslrootcert=/etc/secrets/supabase-ca.crt` (step 1.3) |
   | `SESSION_SECRET` | `<SESSION_SECRET>` |
   | `IC_HASH_KEY` | `<IC_HASH_KEY>` |
   | `PUBLIC_ORIGINS` | `https://<project>.pages.dev` (fill after step 5 if you do not know the name yet; then redeploy) |
   | `PUBLIC_BASE_URL` | the same `https://<project>.pages.dev` (class QR join links). Must be a valid URL: an empty value fails the boot. If the Pages name is not known yet, enter `https://<project>.pages.dev` with your planned project name |
   | `CLIENT_IP_HEADER` | `x-pp-client-ip` (not secret; see "Edge client IP + no-store (go-live fix)" below) |
   | `EDGE_PROXY_SECRET` | secret, at least 32 characters, the SAME value as the Pages secret of the same name. Generate it on the laptop with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` and paste it straight into the dashboard; never write it in the repo, a ticket or a chat |

   Fixed by the blueprint (check, do not change): `NODE_ENV=production`, `COOKIE_SECURE=true`,
   `TRUST_PROXY_HOPS=2`, `FILE_STORAGE_DIR=/var/lib/pretasiplus/files`, `BIJAK_POC_QUESTIONS=true`,
   `ALLOW_DEMO_SEED=false`, `LOG_LEVEL=info`. Leave `COOKIE_DOMAIN` and `PORT` unset. All throttle variables keep
   their code defaults (`.env.api.example` documents each); do not lower them for the demo.
3. Service -> **Environment** -> **Secret Files** -> Add: filename `supabase-ca.crt`, contents = the downloaded
   `prod-ca-2021.crt`. Render mounts it at `/etc/secrets/supabase-ca.crt`.
4. **Manual Deploy** -> Deploy latest commit. Wait for "Live". The log must end with `API listening on port 10000`.
   If it shows `Invalid environment configuration. <KEY>: ...`, fix that key (the message names it, never the value).
5. Check: open `https://<service>.onrender.com/api/health` -> `{"data":{"status":"ok","db":"up",...}}`.
   `db: "down"` = a wrong `DATABASE_URL` (see the TLS table in step 1.3).

Why these values:
- `COOKIE_SECURE=true` works behind the proxy: the browser talks HTTPS to Pages, so it accepts and returns a
  `Secure` cookie; the Function then calls Render over HTTPS. The API does not need to see HTTPS itself to *set*
  a Secure cookie. Rehearsed over plain http with `COOKIE_SECURE=false` only.
- `TRUST_PROXY_HOPS=2`: still governs `req.secure`/protocol handling (the Function sends `X-Forwarded-Proto: https`
  and Render's proxy adds its own hop). It no longer decides the throttle key once `CLIENT_IP_HEADER` and
  `EDGE_PROXY_SECRET` are set: the API then keys the login and public throttles on `X-PP-Client-IP`, which the edge
  fills from `CF-Connecting-IP` and which the API accepts only together with the matching `X-PP-Edge-Secret`. A
  caller that hits `onrender.com` directly has no secret, so the API ignores its headers and uses the socket peer:
  it can no longer pick its own throttle bucket. If the variables are unset (or the secret is wrong) the API falls
  back to the socket peer, never to a client-supplied value. Without the two variables the old behaviour applies:
  the Function overwrites `X-Forwarded-For` with `CF-Connecting-IP`, Render appends the Function's egress address,
  and with 2 hops Express reads the client. With 1 hop all users share one address (the Cloudflare egress: 20 failed
  logins a minute across the class would lock everyone out); too high lets a client pick its address. Smoke test
  step 5 proves "not too high"; for "not too low", log in with a wrong password 6 times from your phone (mobile data)
  and confirm the laptop can still log in.

**Alternative host: Koyeb free.** If Render is unavailable: Koyeb -> Create Web Service -> GitHub -> the repo,
builder **Dockerfile**, path `docker/api/Dockerfile`, instance **Free**, region Singapore if offered (else
Frankfurt/Washington: slower), port 3000 (`PORT=3000`), health check HTTP `/api/health`. Same variables as above;
put the CA in the URL only if Koyeb offers file mounts, otherwise use `?sslmode=no-verify`. Koyeb scales the free
instance to zero after about an hour idle (cold start a few seconds). `TRUST_PROXY_HOPS` must be re-measured with
smoke step 5 (start with 2). Then use the Koyeb URL as `API_ORIGIN` in step 5.

## 5. Cloudflare Pages: SPA and the /api proxy (10 min, of which ~3 min build)

1. Workers & Pages -> Create -> **Pages** -> Connect to Git -> the repo. Production branch = the demo frontend
   branch (see "What must be merged first"). It must contain `functions/api/[[path]].ts` and
   `public/_routes.json` from this PR.
2. Build settings:
   - Framework preset: None. Root directory: `/` (the `functions/` folder must be at the repo root).
   - Build command: `npx vite build --mode production --outDir dist` (not `npm run build`: that one is the mock
     demo build with a type-check).
   - Build output directory: `dist`.
3. Environment variables (Settings -> Variables and Secrets, for **Production** and **Preview**):

   | Key | Value | Read by |
   |---|---|---|
   | `NODE_VERSION` | `22` | build |
   | `VITE_API_MODE` | `http` | build (baked into the bundle) |
   | `VITE_API_BASE_URL` | empty (same origin) | build |
   | `VITE_TEST_HOOKS` | `false` | build |
   | `API_ORIGIN` | `https://<service>.onrender.com` (no trailing path) | the Function at runtime. Unset = every `/api` call answers 500 (fails closed). Set it for **Production only** unless you need preview URLs to work: preview URLs are public too. |
   | `EDGE_PROXY_SECRET` | **Encrypted secret**, the SAME value as on Render (Settings -> Variables and Secrets -> type Secret). With it the Function/worker sends `X-PP-Edge-Secret` to the API. Unset = the header is not sent. For a direct-upload project: `npx wrangler pages secret put EDGE_PROXY_SECRET --project-name <project>` (prompts for the value), then redeploy. |

   `VITE_*` values are public in the bundle: never put a secret in one. `API_ORIGIN` is not secret either; `EDGE_PROXY_SECRET` is, and is never baked into the bundle (runtime only).
4. Save and Deploy. When it is live, note `https://<project>.pages.dev`, then put exactly that origin into
   Render `PUBLIC_ORIGINS` and `PUBLIC_BASE_URL` and redeploy Render (step 4.4) if it was not set yet.
5. What is in place: `public/_routes.json` limits the Function to `/api/*` (static files never invoke it, which
   keeps the 100,000 Function requests/day free quota for the API). Unknown paths serve `index.html` (no
   `404.html` in the build), so deep links and reloads work without a `_redirects` file. The Function
   ([functions/api/[[path]].ts](../../functions/api/%5B%5Bpath%5D%5D.ts)) keeps method, path and query, streams
   the body (multipart photo uploads included), forwards `Cookie`, `Origin`, `Referer`, `x-csrf-token` and
   `X-Request-Id`, returns every `Set-Cookie` unchanged, overwrites `X-Forwarded-For`/`X-Real-IP` with
   `CF-Connecting-IP`, sets `X-Forwarded-Proto: https` and `X-Forwarded-Host`, adds `Cache-Control: no-store`
   unless the API set one, never proxies to another host, answers 502 in the API error envelope when the API is
   unreachable, and for `POST /api/files` answers 413 over 22 MB and 411 without a valid `Content-Length`
   (browsers always send one for FormData).

## Edge client IP + no-store (go-live fix)

> **User action - deploy needs G6 confirmation.** Nothing here is applied by the agent. Do it yourself (or tell the
> Delivery Lead to proceed) after confirming; the agent never touches Render, Cloudflare or Supabase.

What it fixes: (a) the API throttles per real client even if someone calls `onrender.com` directly, and (b) every
proxied `/api/*` answer carries `cache-control: no-store` unless the API set its own (file downloads do).

Code: [deploy/pages-direct/_worker.js](../../deploy/pages-direct/_worker.js) (direct upload) and
`functions/api/[[path]].ts` (Git-connected Pages). Both delete client-supplied `x-forwarded-for`, `x-real-ip`,
`cf-connecting-ip`, `true-client-ip`, `x-pp-client-ip`, `x-pp-edge-secret`, `forwarded`, `x-forwarded-port`,
`x-forwarded-ssl`, then set `x-forwarded-for`, `x-real-ip` and `x-pp-client-ip` from Cloudflare's `CF-Connecting-IP`
(none when it is absent) and `x-pp-edge-secret` from `EDGE_PROXY_SECRET` (only when set).

Exact names per platform:

| Platform | Key | Type | Value |
|---|---|---|---|
| Render (API) | `CLIENT_IP_HEADER` | plain env | `x-pp-client-ip` |
| Render (API) | `EDGE_PROXY_SECRET` | secret env (`sync: false`) | generated value, at least 32 characters |
| Cloudflare Pages | `EDGE_PROXY_SECRET` | encrypted secret | the SAME value |
| Render (API) | `TRUST_PROXY_HOPS` | plain env | stays `2` (still drives `req.secure`/HSTS and the fallback when `CLIENT_IP_HEADER` is unset) |
| Cloudflare Pages | `API_ORIGIN` | plain env | unchanged (the Render URL) |

Generate once on the laptop: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

Set both `EDGE_PROXY_SECRET` (same value on Pages and Render, at least 32 characters; surrounding whitespace is ignored) and `CLIENT_IP_HEADER=x-pp-client-ip` BEFORE deploying. With them unset `req.ip` comes from X-Forwarded-For and a direct call to the onrender.com origin can spoof it, and the API logs a `ClientIp` warning at boot in production.

Rollout order (recommended: Pages first, then Render):
1. Pages: set the secret (`npx wrangler pages secret put EDGE_PROXY_SECRET --project-name <project>`, or dashboard ->
   Settings -> Variables and Secrets), then re-upload the build with the new `_worker.js` (step 10; secrets apply to
   new deployments). A worker that sends the secret header to an API that does not use it is harmless.
2. Render: add `CLIENT_IP_HEADER=x-pp-client-ip` and `EDGE_PROXY_SECRET=<same value>`, then redeploy (wait for
   "Live" and `API listening on port 10000`; a secret shorter than 32 characters fails the boot and names the key).
3. Verify (below).

Doing Render first is safe but has a gap: until the new worker is uploaded the API sees no valid secret, falls back to
the socket peer (the Cloudflare egress), and all users briefly share one throttle bucket. If you do it that way, do
both steps within minutes.

Verify:
- After the first request through the edge, the Render log shows NO `ClientIp` warning (a mismatch warning means the secrets differ: every user would share one throttle bucket).
- `BASE_URL=https://<project>.pages.dev DEMO_PASSWORD='<demo password>' bash scripts/demo-smoke.sh`. Step 1 asserts
  `cache-control: ...no-store` on `GET /api/health` ("/api answers are not cached (no-store)"). Step 5 sends six
  wrong-password logins with a different spoofed `X-Forwarded-For` each and expects 429 on the 6th (the real
  client address, from the edge, is the same each time). Both must PASS.
- The two-network check (REQUIRED, step 5 alone cannot tell "spoof ignored" from "everyone in one bucket"): 6
  wrong-password logins from your phone on mobile data, then confirm the laptop on another network can still log in.
  If the laptop also gets 429, the secrets differ (the API logs one `ClientIp` warning that the edge secret is missing
  or does not match): fix `EDGE_PROXY_SECRET` on both sides, or roll back below.
- Optional direct-caller check: 6 wrong-password logins straight against `https://<service>.onrender.com/api/auth/login`
  with a changing `X-Forwarded-For` and `X-PP-Client-IP`: the 6th must be 429 (the bucket is the socket peer).

Rollback:
- API side: remove `CLIENT_IP_HEADER` on Render and redeploy: back to today's behaviour (`TRUST_PROXY_HOPS=2`).
  `EDGE_PROXY_SECRET` may stay.
- Edge side: Pages -> Deployments -> the previous deployment -> Rollback, or re-upload the previous `_worker.js`.
  The secret on Pages can stay or be deleted.

Rotate the secret: generate a new value and set it on Pages (then redeploy/re-upload) and on Render (then redeploy)
together. While the two differ the API treats every request as untrusted and uses the socket peer: strict, never open
(all users share one bucket for that gap, so keep it to a few minutes). Never print or log the value.

## 6. Wake it up before the demo

Open `https://<project>.pages.dev/api/health` 2-3 minutes before you present (Render free sleeps after 15 min
idle; the first request then takes about a minute). Keep a tab on the site during the demo.

## 7. Smoke test (3 min)

Git Bash, from the repo root:
```
BASE_URL=https://<project>.pages.dev DEMO_PASSWORD='<demo password from docs/AKAUN-DEMO.md>' bash scripts/demo-smoke.sh
```
It checks: the SPA and a deep link; `/api/health` (db up), `no-store`, `X-Request-Id`; anonymous `/api/session`
= 401; student login, `pp_session` = `HttpOnly; Secure; SameSite=Lax`, host-only; a wrong CSRF token = 403;
Bijak papers, start (exam), autosave, the answer is on the server, submit, result, history, logout; Admin Pusat
login, Bijak papers = 403 outside Mod Pelajar, the Pembina Kertas list (`/api/admin/papers`), enter Mod
Pelajar, list papers, exit, logout; and that a spoofed
`X-Forwarded-For` does not change the throttle key. It never prints the password, cookies or tokens. Expected
last line: `Result: 28 passed, 0 failed`. Then click through once in a browser as `pelajar@demo.test`.

Admin Pusat note: the student Bijak API is student-only; Admin Pusat sees student papers only in Mod Pelajar.
The paper builder API (BE-39, #47) is on the base, but the admin Bijak pages of the SPA have no http client yet
(they throw "Bijak admin API is not available in http mode"). Do not show them in the demo.

### 7.1 Full-demo walkthrough (about 2 min)

After the smoke test passes, walk every demo flow once, persona by persona (bash, curl and jq; Git Bash is fine):
```
read -rsp 'Demo password (docs/AKAUN-DEMO.md): ' DEMO_PASSWORD && export DEMO_PASSWORD; echo
BASE_URL=https://<project>.pages.dev bash scripts/demo-walkthrough.sh
unset DEMO_PASSWORD
```
It logs in as the student (`pelajar@demo.test`), teacher (`guru@demo.test`), parent (`ibubapa@demo.test`), school
admin (`adminsekolah@demo.test`), the teacher + school admin account (`guruadmin@demo.test`, role switch both ways)
and Admin Pusat (`admin@demo.test`), and checks the main reads of the dashboard, practice, SPM hub (BE-41),
leaderboard with the children's-names rule (a student, teacher and parent see other pupils masked; Admin Pusat sees
all), gamification and shop, games hub / Papan Bijak / battle (BE-44/45), Keluarga Angkat (BE-47), Command Center
(BE-22) and the intake dashboard (BE-40). AI status (BE-36) and the intake workflow (BE-38) are reported as
`SKIP ... not deployed` while they answer 404; so is any other module whose first route answers 404 (set
`STRICT=1` to make those FAIL once everything is merged).

The writes are the ones the demo shows: one practice session (start, one answer, submit), a battle quick match against
the bot then forfeit, a Papan Bijak quick match then cancel, one Keluarga Angkat application as the parent (one new
pending row per run) and the role switch. `WRITES=0` runs the reads only. Ids and per-persona passwords can be
overridden (`STUDENT_ID`, `STUDENT_PASSWORD`, ...; see the script header). Passwords are read from the environment
only and never printed. Output: one line per check, then a PASS/FAIL/SKIP markdown table and
`Result: N passed, M failed, K skipped`; the exit code is non-zero on any FAIL. The API allows 300 requests a minute
per address: the script waits out a 429 once, but leave a minute between back-to-back runs.

## 8. Rollback and teardown

- SPA: Pages -> Deployments -> a previous deployment -> Rollback (instant).
- API: Render -> Events/Deploys -> redeploy the previous commit.
- Database: migrations are forward-only and the free plan has no daily backups. Before a risky change, from the
  laptop: `pg_dump "<session pooler URL>?sslmode=require" -Fc -f demo-$(date +%F).dump` (Postgres 17 client), or
  just re-create the demo: delete the Supabase project and repeat steps 1-3 (about 10 minutes, demo data only).
- **Teardown after the demo** (recommended, the accounts have a published password): Pages -> project ->
  Settings -> Delete project; Render -> service -> Settings -> Delete Web Service; Supabase -> Project Settings ->
  General -> Delete project (or Pause). Rotate nothing else: no real secret was shared.

## 9. Switch Render back to feature/v2-backend (about 15 min, of which ~6 min build)

For the 2026-10-21 demo the API on Render (`prestasiplus-api`) was deployed from `be/fix-builder-exam-core-import`
(#56) and the Supabase DB was loaded from a dump at the #56 state: migrations `0001`-`0014` + `0017` (15 rows in
`_prisma_migrations`) and the demo seed. The base has since gained `0015_classes` (BE-17),
`0018_aggregate_school_id` and the classes seed (`poc-classes`, used by the Guru, Kelas Saya, report and school
dashboard pages). Once the LEAD has merged #56, catch the DB up FIRST, then switch the branch.

Order matters, and it is safe while the old API keeps serving: both migrations are additive (new tables, one new
nullable column plus a backfill), so the #56 API ignores them; the new rows are only read by the new API.

**What you need:** a checkout of the repo with Node 22, the Supabase **session pooler** URL (step 1.2) and a
terminal. The container that wrote this cannot reach Supabase; you run this on your own machine, and you type the
URL yourself: it never goes into a file, the repo, a chat or the shell history.

### 9.1 Laptop: update the checkout (2 min)
```
cd <your prestasiplus checkout>
git fetch origin feature/v2-backend
git checkout feature/v2-backend
git pull --ff-only origin feature/v2-backend
git log --oneline -1          # note this SHA: Render must deploy the SAME one (9.5)
npm ci
npm run db:generate -w @pp/api   # the seed needs the generated Prisma client (gitignored)
```

### 9.2 Laptop: put the DB URL in this shell only
macOS zsh (default on a Mac): the prompt does not echo and nothing lands in the history:
```
read -rs 'DATABASE_URL?Session pooler URL ending in ?sslmode=no-verify: ' && export DATABASE_URL; echo
```
bash / Git Bash: `read -rsp 'Session pooler URL ending in ?sslmode=no-verify: ' DATABASE_URL && export DATABASE_URL; echo`

Paste `postgresql://postgres.<PROJECT_REF>:<SUPABASE_DB_PASSWORD>@aws-<n>-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=no-verify`.
The `?sslmode=no-verify` suffix is for the seed (node-postgres through Prisma, step 1.3); the delta script ignores
every `ssl*` parameter and always uses TLS without certificate verification for a non-local host.

Optional but recommended (Supabase free has no backups; needs a Postgres 17 `pg_dump`, e.g. `brew install postgresql@17`).
`no-verify` is a node-postgres value that libpq (`pg_dump`) rejects, so swap the suffix, and write the dump OUTSIDE
the checkout (it holds all demo data):
`pg_dump "${DATABASE_URL%%\?*}?sslmode=require" -Fc -f ~/demo-before-delta-$(date +%F-%H%M).dump`.

### 9.3 Laptop: the migration delta (1 min)
[scripts/demo-db-delta.mjs](../../scripts/demo-db-delta.mjs) does what `prisma migrate deploy` does without the
Prisma schema engine: compares `apps/api/prisma/migrations/*/migration.sql` with `_prisma_migrations`, applies the
missing ones in name order (one transaction each: the SQL and its row commit together or not at all) and writes the
row in Prisma's table format (uuid id, sha256 checksum of the file, `finished_at`, `applied_steps_count = 1`), so a
later `prisma migrate deploy` is expected to see them as applied (checked against Prisma's table definition and
checksum rule, not against the schema engine itself, see 9.7). Run it from ONE terminal only (it takes no lock). It refuses to run, and applies nothing, when a recorded migration's
checksum differs from its file, a recorded migration has no folder in the checkout (wrong branch) or a recorded
migration is unfinished. It never prints the URL.
```
node scripts/demo-db-delta.mjs --dry-run
node scripts/demo-db-delta.mjs
node scripts/demo-db-delta.mjs          # again: must say "Up to date: no migration to apply."
```
Expected dry run on the #56 DB at base 01c47e75 (more lines if later PRs with migrations merged; that is fine as
long as Render deploys the same SHA):
```
_prisma_migrations: 15 applied row(s).
note     0015_classes sorts before the newest applied migration (0017_question_workflow); it is applied anyway (as prisma migrate deploy does).
would apply  0015_classes  sha256 bc902c50...
would apply  0018_aggregate_school_id  sha256 259cc7bd...
```
Then `Done: 2 migration(s) applied; _prisma_migrations now has 17 applied row(s).`

If it prints `REFUSED`: stop. Nothing was changed. A checksum mismatch means the checkout is not the code the DB
was built from; do not "fix" the row by hand, ask the LEAD (or use the fallback in 9.8).

### 9.4 Laptop: top up the demo seed (2-4 min)
The demo seed is idempotent by design (ADR-0006: upsert or find-by-natural-key, never truncate) and has no
per-module flag, so the top-up is simply the whole seed again from the base checkout:
```
NODE_ENV=production ALLOW_DEMO_SEED=true npm run be:db:seed
unset DATABASE_URL
```
Expected last line: `seed: profile=poc, 11 module(s): core-identity, core-schools, core-school-packages, core-population, curriculum, questions, wallet, content, exam, poc-classes, practice`.

What a re-run does to the rows that are already there (checked in the code and in the rehearsal, 9.7):
- adds the new classes (`DEMO4S` for `guru@demo.test` with the two Form 4 demo pupils, `KLS001`-`KLS013` for the
  generated teachers) and their enrolments; nothing else changes in row counts;
- demo accounts and schools are re-asserted from the seed (name, school, grade, active flags, roles); the
  password hash of an existing account is KEPT; wallets, practice sessions, exam papers, questions and the
  support ticket are left alone when they already exist; seeded articles, banners and videos are reset to the
  seed text (an edit made to them during the demo is overwritten);
- data written by the demo itself (Bijak attempts, answers, aggregates, uploads) is never touched.

Then re-run the Data API lockdown (step 3.2: SQL editor, paste `scripts/supabase/lockdown-data-api.sql`, Run, then
the verify queries: `leaked_grants` = 0). The new tables (`classrooms`, `enrolments`, `teacher_profiles`) must not
be readable through the Data API.

### 9.5 Render: change the branch and deploy (~6 min build)
1. Render -> `prestasiplus-api` -> **Environment**: check `BIJAK_POC_QUESTIONS` = `true`. The variable is new on
   the base (#51, default `false`); the #56 build never read it. Without it the new API refuses the PoC Bijak
   papers (start = 403) and the student demo breaks. Also check `PUBLIC_BASE_URL` = the Pages origin.
2. **Settings** -> Build & Deploy -> **Branch** -> `feature/v2-backend` -> Save. Auto-deploy stays **off**.
3. **Manual Deploy** -> **Deploy latest commit** (or "Deploy a specific commit" with the SHA from 9.1). Wait for
   "Live"; the log ends with `API listening on port 10000`.
4. `https://<project>.pages.dev/api/health` -> `{"data":{"status":"ok","db":"up",...}}`.

### 9.6 Smoke (3 min)
```
read -rs 'DEMO_PASSWORD?Demo password (docs/AKAUN-DEMO.md): ' && export DEMO_PASSWORD; echo     # zsh; bash: read -rsp '...' DEMO_PASSWORD
BASE_URL=https://<project>.pages.dev bash scripts/demo-smoke.sh
unset DEMO_PASSWORD
```
Expected: `Result: 28 passed, 0 failed`. Then in a browser: `guru@demo.test` -> Guru -> Kelas (class `DEMO4S`
with 2 pupils), `adminsekolah@demo.test` -> dashboard, `pelajar@demo.test` -> Kelas Saya (1 class), Bijak SPM.

**Rollback:** Render -> Settings -> Branch back to `be/fix-builder-exam-core-import` -> Manual Deploy. The DB
needs no rollback: the old API works with the new tables (additive).

### 9.7 Rehearsal (2026-10-20, container, Postgres 16, non-superuser owner, `pgcrypto` in `extensions`)
1. DB at the #56 state: migrations from the #56 tree (`--migrations-dir`), 15 rows; #56 demo seed:
   `10 module(s)`, 98 tables.
2. `--dry-run` listed `0015_classes` and `0018_aggregate_school_id`; a copy with the `0012` checksum altered was
   `REFUSED` (exit 1, nothing applied); the delta applied both (17 rows); a second run: "Up to date".
3. Seed top-up from the base: `11 module(s)`; row counts changed ONLY for `classrooms` 0 -> 14 and
   `enrolments` 0 -> 23. A second run changed no row count. A fresh DB built from the base (all migrations +
   seed) has exactly the same row count in all 101 tables and the same classes and rosters.
4. Base API (`npm run be:build`, `NODE_ENV=production`, `BIJAK_POC_QUESTIONS=true`) against that DB:
   `/api/health` db up; `scripts/demo-smoke.sh` straight at the API: 25 passed, the 3 failures are the
   proxy-only checks (SPA `/`, deep link, `no-store` added by the Pages worker); student login with CSRF, wrong
   CSRF = 403, Bijak papers (4), exam start/autosave/submit/result/history, Admin Pusat checks all passed, and the
   new aggregate row carries `school_id`. Guru classes, school-admin dashboard, school performance report and
   Kelas Saya answered 200.
5. TLS path: the script against a self-signed TLS Postgres through a non-local host name connected with
   "TLS, certificate not verified". Not rehearsable here: Supabase itself (no network path from the container)
   and the real Prisma schema engine (blocked), so the rows were checked against Prisma's table definition and
   checksum rule (sha256 hex of the file), not against `prisma migrate deploy` itself.

### 9.8 Fallback: fresh dump + reload
If the delta refuses or the top-up fails half-way: build the DB at the base state where the full toolchain
works (an empty Postgres 16/17, `node scripts/demo-db-delta.mjs` on it, then
`NODE_ENV=production ALLOW_DEMO_SEED=true npm run be:db:seed`), `pg_dump -Fc --no-owner --no-privileges` it,
and restore into a NEW Supabase project (steps 1-3), then point Render `DATABASE_URL` at the new project. This
loses whatever the demo wrote into the old DB (fictitious data only).

## 10. Re-upload the Pages frontend (direct upload, about 10 min)

The demo frontend is the Cloudflare Pages project `prestasiplus-demo`, deployed by **direct upload** (not Git):
the http build of `be/demo-pages` plus [deploy/pages-direct/_worker.js](../../deploy/pages-direct/_worker.js)
(advanced-mode worker, a JS port of `functions/api/[[path]].ts`: same-origin `/api/*` proxy to Render). Drag and
drop does not compile `functions/`, which is why the worker file goes into `dist/` by hand.

After a base change that touches the UI or the http clients, rebuild from `be/demo-pages` merged with the base:
```
cd <your prestasiplus checkout>
git fetch origin be/demo-pages feature/v2-backend
git checkout -B demo-pages-local origin/be/demo-pages
git merge --no-edit origin/feature/v2-backend      # local only; do not push (rehearsed 2026-10-20: no conflict)
npm ci
VITE_API_MODE=http npx vite build --mode demo        # the shell value wins over VITE_API_MODE=mock in .env.demo
node scripts/check-demo-bundle.mjs dist              # expect "check-demo-bundle: OK"
cp deploy/pages-direct/_worker.js dist/
cd dist && zip -qr ~/pages-dist.zip . && cd ..      # the CONTENTS of dist at the zip root, not a dist/ folder
unzip -l ~/pages-dist.zip | grep -E ' (index.html|_worker.js)$'   # both must be listed at the root
```
Windows PowerShell: `$env:VITE_API_MODE='http'; npx vite build --mode demo`, then
`Copy-Item deploy/pages-direct/_worker.js dist/` and `Compress-Archive -Path dist/* -DestinationPath $HOME\pages-dist.zip`.

Upload: Cloudflare dashboard -> Workers & Pages -> `prestasiplus-demo` -> **Create deployment** (Deployments tab)
-> Production -> upload `~/pages-dist.zip` (or drag the `dist` folder itself) -> Save and deploy. The project keeps
its `API_ORIGIN` variable; the worker falls back to `https://prestasiplus-api.onrender.com` when it is unset.
Check `https://<project>.pages.dev/api/health`, then run the smoke (9.6). Rollback: Deployments -> the previous
deployment -> **Rollback to this deployment**.

Rehearsed 2026-10-20 (be/demo-pages ad230a6 + base 01c47e75): merge clean, build 15 s, bundle check OK,
679 files, about 16 MB unzipped.

## Known limits (temporary demo)

| Limit | Effect | Mitigation |
|---|---|---|
| Render free sleeps after 15 min idle | first request ~1 min | step 6 (wake it up) |
| Render free disk is ephemeral | uploaded files (Bijak working photos, avatars, content images) vanish on redeploy, restart or sleep; the DB rows stay and point to missing files | acceptable for the demo; do not redeploy mid-demo |
| Render free: 750 instance hours/month, one instance | fine for a demo | - |
| Supabase free pauses after 7 days idle | the API answers `db: down` | Dashboard -> Restore project |
| Supabase free: no daily backups, 500 MB | demo data only | `pg_dump` if needed |
| Session pooler pool size (free ~15 per role) | the API's pg pool (10) fits; do not run several API instances | - |
| Cloudflare Pages Functions free: 100,000 requests/day | ample | `_routes.json` keeps static files out |
| The Render URL is public | with `CLIENT_IP_HEADER` + `EDGE_PROXY_SECRET` set, a client that calls `onrender.com` directly has no secret, so the API ignores its address headers and throttles it by its socket peer: it cannot pick its bucket. Without the two variables it can spoof `X-Forwarded-For` (because of `TRUST_PROXY_HOPS=2`) and dodge the per-address login throttle. The per-identifier limit (100 failures per 15 min), cookies and CSRF apply either way. A direct caller can still reach the API (CORS/CSRF/cookies decide the rest) | set both variables before go-live; a production setup should still use a private origin |
| Frontend modules without an API route yet | those pages show their error state in the http build | demo only the flows listed in step 7 |

## Migration compatibility (Supabase Postgres 15/17)

Checked on 2026-10-20 against every `apps/api/prisma/migrations/*/migration.sql` (0001-0017, incl. 0015_classes):
- Only extension: `0001_init` `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`. On Supabase it already exists in the
  `extensions` schema, so this is a no-op NOTICE (the `postgres` role may run it). No migration or query calls a
  pgcrypto function (`crypt`, `digest`, `gen_salt`, `gen_random_bytes`); the only generator used is
  `gen_random_uuid()`, which is core Postgres since 13. Hashing happens in Node.
- No `CREATE ROLE`, `GRANT`, `OWNER TO`, `CREATE SCHEMA`, `SECURITY DEFINER` or superuser-only statement. Two
  plpgsql trigger functions (`coin_ledger` append-only) and a `BEFORE TRUNCATE` trigger: allowed for the table
  owner. Identity columns, partial and functional indexes, CHECK constraints: all PG12+.
- Nothing PG16-only (no `any_value`, `pg_input_is_valid`, SQL/JSON constructors); `pg_advisory_xact_lock` is used
  only transaction-scoped, which is correct behind the session pooler.
- Rehearsed on Postgres 16 with a Supabase-like layout: a NON-superuser `postgres` role owning the database,
  `pgcrypto` pre-installed in `extensions`, Supabase's default grants to `anon`/`authenticated`/`service_role`.
  All migrations applied as that role (100 tables), the seed ran, and the lockdown script removed all 2,100 Data API grants
  (before it, `anon` could read all 46 seeded `users` rows; after it, `permission denied`). Not rehearsed on 17
  (no PG17 locally); nothing in the SQL depends on 16 vs 17.
- No migration needed changing; no new migration was added.

## What must be merged first (in this order)

One deploy branch for both services, so the SPA and the API match: `be/integration-frontend` (the LEAD's
UI + backend integration branch; 17f946b8 already carries `feature/v2-backend` 88059c9f, including #47).
Pages and Render both build the same SHA (see also [deploy-execution.md](deploy-execution.md) section 0).

1. **This PR** into `feature/v2-backend` (`render.yaml` region and vars incl. `PUBLIC_BASE_URL`, `_routes.json`,
   the Function hardening, this runbook, the smoke test, the Supabase lockdown SQL).
2. **Re-sync `be/integration-frontend` with `feature/v2-backend`** after step 1 (it then also gets 729b7c20, the
   Function and `render.yaml`; today 17f946b8 has neither).
3. **#51** (`be/bijak-poc-flag`), optional: the only conflict with the base is in
   `docs/architecture/v2-backend-deviations.md`. Without #51 the API serves the PoC questions anyway; with it,
   `BIJAK_POC_QUESTIONS=true` (already in `render.yaml`) is required.
4. **278cea1** from #48 into the deploy branch (cherry-pick, manual resolution in
   `src/modules/m28-bijak-spm/server/http.ts`). Without it the demo works, but Bijak working photos stay in the
   browser's IndexedDB and never reach the server. 17f946b8 does not have it.

Known gaps on the deploy branch (not blockers for the student flow):
- The Admin Pusat Bijak pages (Pembina Kertas, `m28-bijak-spm/admin/**`) still call the mock-only
  `bijakAdminServer()`, which throws in http mode. The backend routes exist since #47 (`/api/admin/papers`,
  `/api/admin/blueprints`; the smoke test lists them), but no frontend http client uses them yet, so
  "Admin Pusat publishes a paper" cannot be shown in the browser on the http build.
- `vue-tsc -b` may fail on the deploy branch; the Pages build command does not type-check, so the build still
  succeeds. Fix before production, not for the demo.
