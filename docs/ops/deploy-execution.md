# Staging deploy: execution checklist (Cloudflare Pages + Render + Supabase)

Step-by-step companion to `docs/ops/deploy-staging.md` (background and reasoning live there). Values were checked
against the deploy branch `origin/be/integration-frontend` @ 17f946b8 (package.json, env schema, scripts). Secrets
go only in the platform dashboards or your laptop shell, never in the repo. Placeholders are in `<angle brackets>`.

## 0. Blocker check (do first)
- The deploy branch must contain `origin/feature/v2-backend` at 729b7c20 or later, because `functions/api/[[path]].ts`
  and `render.yaml` are NOT on 17f946b8 (`git ls-tree 17f946b8 functions render.yaml` prints nothing).
  Check: `git merge-base --is-ancestor 729b7c20 <deploy-sha> && echo OK`. If it prints nothing, re-sync the deploy
  branch with v2-backend first.
- Use the same deploy SHA for Pages and Render so SPA and API match.

## 1. Supabase (do first)
1. New project, free plan, region Southeast Asia (Singapore). Save the database password.
2. Connect -> Session pooler -> copy the URI (port **5432**, IPv4). Not the transaction pooler (6543).
3. Final value (URL-encode special characters in the password):
   `DATABASE_URL=postgresql://postgres.<project-ref>:<password>@<region>.pooler.supabase.com:5432/postgres?sslmode=require`
4. From a laptop checkout of the deploy SHA, after `npm ci` (this runs `prisma migrate deploy` and the seed runner via
   `apps/api/scripts/db.mjs`):
   ```
   export DATABASE_URL='<url above>'
   npm run be:db:migrate
   ALLOW_DEMO_SEED=true npm run be:db:seed          # STAGING ONLY; default profile "poc"; idempotent
   ```
   Windows PowerShell: `$env:DATABASE_URL='...'; $env:ALLOW_DEMO_SEED='true'`. Do not use `be:db:reset`.
5. Verify (Supabase SQL editor, or `psql "$DATABASE_URL"`):
   ```sql
   select count(*) as migrations from _prisma_migrations where finished_at is not null;
   select role, count(*) from user_roles group by role;   -- demo accounts exist, per role (prisma/schema/identity.prisma: UserRole -> user_roles)
   ```
   The migrations count should equal the number of folders in `apps/api/prisma/migrations`.

## 2. Render (API)
Create from the Blueprint (`render.yaml`, New -> Blueprint, branch = deploy branch), or manually: New Web Service ->
Docker, repo + deploy branch, Dockerfile `./docker/api/Dockerfile`, context `.`, plan Free, health check path `/api/health`,
Auto-Deploy off. Environment (dashboard):

| Key | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | in Blueprint |
| `DATABASE_URL` | Supabase session pooler URL (step 1.3) | required, no default |
| `SESSION_SECRET` | `openssl rand -hex 32` | required in production, 16+ chars, not `change-me` |
| `IC_HASH_KEY` | `openssl rand -hex 32` (a different value) | required in production, 32+ chars, must differ from `SESSION_SECRET`. Never rotate later without recomputing every `ic_hash`. |
| `FILE_STORAGE_DIR` | leave unset | required in production, absolute; the Dockerfile already sets `/var/lib/pretasiplus/files` |
| `COOKIE_SECURE` | `true` | in Blueprint |
| `COOKIE_DOMAIN` | empty / unset | host-only cookie on the Pages domain |
| `TRUST_PROXY_HOPS` | `2` | in Blueprint; verify after deploy (section 6) |
| `PUBLIC_BASE_URL` | `https://<project>.pages.dev` | set in step 5 once the Pages domain is known |
| `PUBLIC_ORIGINS` | `https://<project>.pages.dev` | same; used for article/banner image URLs |
| `ALLOW_DEMO_SEED` | `true` (optional) | staging only. The API runtime ignores it; the seed is run from the laptop in step 1.4 |
| `BIJAK_POC_QUESTIONS` | `true` (staging only) | NOT in the env schema on 17f946b8 (`git grep` finds only a decision note in AGENT-SYNC.md), so it has no effect yet; unknown keys are ignored, so setting it is harmless. Set it now, and confirm it takes effect once the flag PR merges. |
| `PORT` | do not set | Render injects it; the API reads it |

Every other key in `apps/api/src/common/config/env.schema.ts` has a default or is optional (throttles, `LOG_LEVEL`, `MAX_UPLOAD_MB`, `INTAKE_MAX_FILE_MB`, `SESSION_*`, `LOGIN_*`, `MAIL_LOG_RESET_LINKS`, ...), so the first boot needs only the five required rows above (`NODE_ENV`, `DATABASE_URL`, `SESSION_SECRET`, `IC_HASH_KEY`, and `FILE_STORAGE_DIR` which the image provides). `MAIL_LOG_RESET_LINKS` must not be `true` in production.

After the deploy is Live: `curl -fsS https://<service>.onrender.com/api/health` (first call may take 30-60 s). Boot failure messages name the offending env key in the Render logs.

## 3. Cloudflare Pages (SPA + proxy Function)
Workers & Pages -> Create -> Pages -> Connect to Git.

| Setting | Value |
|---|---|
| Production branch | the deploy branch |
| Framework preset | None |
| Root directory | `/` (repo root, so `functions/` is picked up) |
| Build command | `npx vite build --mode production --outDir dist` |
| Build output directory | `dist` |

Environment variables (Production and Preview; the first five are build time, `API_ORIGIN` is read by the Function at runtime):

| Key | Value |
|---|---|
| `NODE_VERSION` | `22.22.2` (package.json engines `^22.22.2 \|\| ^24.15.0 \|\| >=26`; if Pages rejects the patch version use `22`) |
| `VITE_API_MODE` | `http` |
| `VITE_API_BASE_URL` | empty (same origin) |
| `VITE_TEST_HOOKS` | `false` |
| `VITE_PROTOTYPE_SCOPE` | `on` (the compose default for the real-API build; see open item) |
| `API_ORIGIN` | `https://<service>.onrender.com` (no trailing path) |

Why this build command: `npm run build` is `vue-tsc -b && vite build --mode demo && node scripts/check-demo-bundle.mjs`. `--mode demo` loads `.env.demo` (`VITE_API_MODE=mock`), defers the mock boot (`bootstrap.ts` checks `MODE === 'demo'`) and applies the mock-bundle size budget, so it produces the mock build. The http build uses `--mode production` (there is no `.env.production`, so everything comes from the dashboard vars, and with `VITE_API_MODE` unset the app silently falls back to mock: always set it) and skips the demo guard. This mirrors `compose.http.yaml` (`BUILD_MODE=production`, `VITE_API_MODE=http`). `vue-tsc` is not run on Pages: CI already type-checks (`npm run typecheck`), and it would only add build time (not measured here). Run `npm run typecheck` and the bundle test hooks check in CI before tagging the deploy SHA.

Check the test-hook leak manually after the first build if wanted: `node scripts/check-demo-bundle.mjs dist` (budget lines apply to the demo size only and may fail for the http build; the marker check is what matters).

SPA fallback needs no `_redirects` (Pages serves `index.html` when there is no `404.html`). After the first deploy: `curl -fsS https://<project>.pages.dev/api/health`.

### Mock fallback project (no backend)
Second Pages project, same repo and branch: root `/`, framework None, build command `npm run build`
(faster: `npx vite build --mode demo --outDir dist && node scripts/check-demo-bundle.mjs dist`), output `dist`,
env `NODE_VERSION=22.22.2` only. Do not set `API_ORIGIN` or any `VITE_*`; `.env.demo` supplies `VITE_API_MODE=mock`.
Data stays in the browser.

## 4. Order of operations
1. Section 0 blocker check, then Supabase: create, migrate, seed, verify (section 1).
2. Render: create the service, set env, deploy; check `/api/health` on the Render URL.
3. Pages: create the project with `API_ORIGIN` = the Render URL, deploy; check `https://<project>.pages.dev/api/health`.
4. Render: set `PUBLIC_BASE_URL` and `PUBLIC_ORIGINS` to the Pages domain, redeploy (Manual Deploy).
5. Smoke tests (section 5).
6. Warm-up before any demo: open `/api/health` and log in once about 5 minutes before; Render free sleeps after 15 minutes idle.

## 5. Smoke tests
- [ ] SPA loads, a deep link reload returns the app.
- [ ] `/api/health` OK through Pages.
- [ ] Login with a seeded student account: `pp_session` cookie set on the Pages domain, `HttpOnly; Secure; SameSite=Lax`; a mutating call succeeds (CSRF header OK).
- [ ] Objective (a), Bijak student flow: paper list loads, start an attempt, answer, save, submit, see the result.
- [ ] Objective (c), admin publish: log in as Admin Pusat, publish a paper, then the student sees it in the list.
- [ ] Upload under the limit works; over 22 MB gets a 413 JSON error. (Files are lost on Render restart.)

## 6. Verify TRUST_PROXY_HOPS=2
The chain is: Function sets `X-Forwarded-For` to the client, Render appends the Function's egress IP. Hop 2 should give
the client address. Test: from two different networks, fail login 5+ times within a minute for a throwaway identifier
(`THROTTLE_LOGIN_PER_MINUTE` default 5) and confirm the second network is not throttled by the first, and that Render
request logs show the client address and not a Cloudflare one. If everyone shares a bucket, set `1`; if a client can
change its bucket by sending `X-Forwarded-For`, raise it. Not yet measured.

## 7. Rollback
- SPA: Pages -> Deployments -> previous good deployment -> Rollback.
- API: Render -> Deploys -> redeploy the previous commit.
- Database: migrations are forward-only; if the bad release migrated, restore the Supabase backup (daily on free) rather than rolling the API back alone.

## 8. Known limitations (staging only)
- Render free sleeps after 15 minutes idle (30-60 s cold start). Acceptable for a demo; use a paid always-on plan for production.
- Render free storage is ephemeral: uploads vanish on restart or redeploy. Production needs a persistent disk or object storage.
- Supabase free: daily backups only, projects pause after inactivity.
- Pages Functions free: 100,000 requests per day.
- Demo accounts have a published password: never seed them into production (`ALLOW_DEMO_SEED` stays unset there).
- Open item: `VITE_PROTOTYPE_SCOPE=on` limits the UI to the prototype scope (D43). Confirm the Admin Pusat publish screen (objective c) is inside the scope, otherwise set `off` or the screen will be unreachable.
