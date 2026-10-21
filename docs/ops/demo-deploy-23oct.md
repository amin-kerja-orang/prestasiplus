# Demo deploy pack, 23 Oct 2026 (Path A, updated migrations)

Copy-paste step list for the LEAD, who deploys after G6. Nothing here was run against the cloud demo (Render,
Supabase, Cloudflare); every number below comes from a local rehearsal on an empty Postgres 16 that mimics Supabase
(section 9). Background, TLS variants and the edge client IP design are in
[demo-cloudflare-supabase.md](demo-cloudflare-supabase.md); the seed rules are in [demo-reseed.md](demo-reseed.md).

This replaces the rehearsal checklist of `be/demo-rehearsal-23oct` @ `917a152b`: the tip now also carries
`0028_pksk`, `0031_pksk_question_kind` and `0032_marketplace`, and the PoC seed has grown to 25 modules.

## 0. What gets deployed

| Piece | Source | Commit |
|---|---|---|
| API (Render `prestasiplus-api`) | `feature/v2-backend` | `23c98226ba1c5d0291b18af19f992e5342a4b1d7` (tip at writing, 21 Oct) |
| Database (Supabase `prestasiplus-demo`) | migrations + PoC seed from the same commit | 33 migrations, `0001_init` .. `0038_intake_workflow` |
| SPA (Cloudflare Pages `prestasiplus-demo`, direct upload) | `be/integration-frontend` | the merge commit of Developer 5's sync PR (`be/integration-frontend` + `feature/v2-backend`); see 4.1 |

**Stop and re-check before you start** (2 minutes, on your laptop checkout):

```bash
git fetch origin +refs/heads/feature/v2-backend:refs/remotes/origin/feature/v2-backend \
                 +refs/heads/be/integration-frontend:refs/remotes/origin/be/integration-frontend
git log --oneline -1 origin/feature/v2-backend
ls apps/api/prisma/migrations | grep -c '^00'                              # on that commit: expect 33
git merge-base --is-ancestor 23c98226 origin/be/integration-frontend && echo "SPA branch is synced"
```

- If the tip moved past `23c98226` and the migration count is still 33, you may deploy the newer tip; the counts in
  section 2.6 should still hold if no seed file changed (`git diff --stat 23c98226 origin/feature/v2-backend -- apps/api/prisma`
  shows nothing). If a migration or seed file changed, ask DevOps to re-run the rehearsal first.
- If "SPA branch is synced" does not print, the sync PR has not merged yet: wait for it (4.1).

Do the whole run outside demo hours: from step 2.2 until step 3 is live, the old API faces the new schema.

## 1. Backup before the reset (5 min)

Needs a Postgres **17** client (`pg_dump`, `pg_restore`, `psql`; Windows: the PostgreSQL 17 installer, "Command
Line Tools" only). Put the session pooler URL in this shell only (it never goes into a file or the history):

```bash
read -rsp 'Supabase session pooler URL (no ?suffix): ' PGURL && export PGURL; echo
```

`postgresql://postgres.<PROJECT_REF>:<SUPABASE_DB_PASSWORD>@aws-<n>-ap-southeast-1.pooler.supabase.com:5432/postgres`

1.1 Record the current state (read-only):

```bash
psql "$PGURL?sslmode=require" -At -c "select count(*), max(migration_name) from _prisma_migrations where finished_at is not null and rolled_back_at is null"
```

Last recorded live state (#67, 21 Oct 11:04 MYT, deploy `adcaad0c`): `25|0030_headcount_timeline`. Note what you see.

1.2 Dump the whole `public` schema, OUTSIDE the checkout (it holds all demo data):

```bash
pg_dump "$PGURL?sslmode=require" -n public -Fc -f ~/demo-before-23oct-$(date +%F-%H%M).dump
pg_restore -l ~/demo-before-23oct-*.dump | grep -c 'TABLE DATA'          # non-zero = readable dump
```

Keep the file until after the demo. It is the database rollback (section 6).

## 2. Database: Path A, full reset (recommended, 10 min)

### 2.1 Why not the delta (Path B)

On the live DB the tip's new migrations sort **below** migrations that are already applied:

- the live DB has `0030_headcount_timeline` (last recorded state), so `0025_spm_hub` and `0028_pksk` would apply
  under it; and if the 23 Oct rehearsal set was ever applied there (`0033_games`, `0034_foster_applications`,
  `0037_ai_extraction`, `0038_intake_workflow`), `0028`, `0031` and `0032` would apply under those too.
- `scripts/demo-db-delta.mjs` and `prisma migrate deploy` both accept this silently (the delta only prints a
  `note ... sorts before the newest applied migration`). The rehearsal (9.3) shows the three new migrations are
  additive and give the same schema on an EMPTY database. What was never rehearsed is that out-of-order history on
  the live DB **with its data**: rows the old seed and the demo itself wrote, plus a seed top-up from a seed that has
  grown from 17 to 25 modules over them. The result would be a DB state no one has tested, and the expected counts
  below could not be used to check it.
- The migration history would also differ from every other environment (order of `_prisma_migrations`).

Path A gives the exact state the rehearsal verified, so every count in 2.6 can be checked. It loses only the
fictitious data the demo wrote (the backup in 1.2 keeps it).

### 2.2 Reset the `public` schema

Supabase dashboard -> SQL Editor -> New query (it runs as `postgres`, the owner of every app table):

```sql
BEGIN;
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
COMMIT;
SELECT count(*) AS tables_left FROM information_schema.tables WHERE table_schema = 'public';   -- expect 0
```

This drops the app tables and `_prisma_migrations` only; Supabase's own schemas (`auth`, `storage`, `extensions`,
...) are not touched. `pgcrypto` stays in `extensions`. If the `DROP` is refused (permission), stop: use the
fallback in [demo-cloudflare-supabase.md](demo-cloudflare-supabase.md) 9.8 (new Supabase project).

### 2.3 Migrate 0001 -> 0038 (1 min)

From the laptop checkout at the deploy commit (`npm ci` done):

```bash
git checkout 23c98226ba1c5d0291b18af19f992e5342a4b1d7
npm ci
npm run db:generate -w @pp/api                 # the seed needs the generated client
export DATABASE_URL="$PGURL?sslmode=no-verify"
node scripts/demo-db-delta.mjs --dry-run       # expect: "_prisma_migrations: not present (empty database)", 33 "would apply"
node scripts/demo-db-delta.mjs                 # expect last line: Done: 33 migration(s) applied; _prisma_migrations now has 33 applied row(s).
node scripts/demo-db-delta.mjs                 # expect: Up to date: no migration to apply.
```

`0001_init` prints a NOTICE that `pgcrypto` already exists: fine. (`npm run be:db:migrate` with `?sslmode=require`
does the same through Prisma; the rehearsal used the delta script, which needs no Prisma engine download.)

### 2.4 PoC seed (1 min)

Use the SAME demo password as now (from the vault), so nothing changes for the presenters. Hash it from a silent
prompt (only the hash is printed; do not paste it anywhere):

```bash
read -rsp 'Demo password (vault): ' PW; echo
export SEED_DEMO_PASSWORD_HASH="$(cd apps/api && PW="$PW" node -e "require('@node-rs/argon2').hash(process.env.PW,{memoryCost:19456,timeCost:2,parallelism:1}).then(h=>console.log(h))")"
unset PW
NODE_ENV=production ALLOW_DEMO_SEED=true BIJAK_POC_QUESTIONS=true npm run be:db:seed -- --profile=poc
```

Expected last line:

```
seed: profile=poc, 25 module(s): core-identity, core-schools, core-school-packages, core-population, curriculum, questions, wallet, content, exam, exam-demo-blueprints, poc-classes, poc-bijak-sittings, battle, games, poc-cikgu, pksk, poc-performance, questions-pool, spm-subject-configs, spm, practice, core-marketplace-categories, marketplace, gamification, poc-profile
```

Also expected, not an error: `seed exam: PoC questions are not written to the questions table ...` (the API serves
them at runtime with `BIJAK_POC_QUESTIONS=true`). A second run is safe and changes no row count (rehearsed).

```bash
unset SEED_DEMO_PASSWORD_HASH DATABASE_URL
```

### 2.5 Data API lockdown (do not skip)

SQL Editor -> paste [scripts/supabase/lockdown-data-api.sql](../../scripts/supabase/lockdown-data-api.sql) -> Run,
then:

```sql
SELECT count(*) AS leaked_grants FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated', 'service_role');    -- expect 0
SELECT has_table_privilege('anon', 'public.users', 'SELECT') AS anon_reads_users;           -- expect false
```

Also check Integrations -> Data API is still switched off.

### 2.6 Verify the counts

SQL Editor:

```sql
SELECT
  (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS migrations,
  (SELECT max(migration_name) FROM _prisma_migrations) AS newest,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS tables,
  (SELECT count(*) FROM users) AS users,
  (SELECT count(*) FROM users WHERE lower(email) LIKE '%@demo.test') AS demo_test,
  (SELECT count(*) FROM users WHERE password_hash IS NULL) AS no_hash,
  (SELECT count(*) FROM schools) AS schools,
  (SELECT count(*) FROM classrooms) AS classes,
  (SELECT count(*) FROM enrolments) AS enrolments,
  (SELECT count(*) FROM exam_attempts) AS sittings,
  (SELECT count(*) FROM papers) AS papers,
  (SELECT count(*) FROM questions) AS questions,
  (SELECT count(*) FROM pksk_packages) AS pksk_packages,
  (SELECT count(*) FROM marketplace_products) AS mkt_products,
  (SELECT count(*) FROM battles) AS battles,
  (SELECT count(*) FROM practice_sessions) AS practice_sessions;
```

Expected (exact; the seed is deterministic, two fresh rehearsal builds gave identical counts in every table):

| migrations | newest | tables | users | demo_test | no_hash | schools | classes | enrolments | sittings | papers | questions | pksk_packages | mkt_products | battles | practice_sessions |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 33 | 0038_intake_workflow | 197 | 51 | 18 | 0 | 4 | 15 | 34 | 15 | 5 | 503 | 3 | 10 | 71 | 4 |

Whole DB: 197 tables in `public` (incl. `_prisma_migrations`), 99 of them non-empty, 15,734 rows in total. Any
difference: stop and compare before deploying the API.

## 3. Render: the API (~8 min, of which ~6 min build)

3.1 `prestasiplus-api` -> **Environment**. Names only; values come from your vault, never from the repo or a chat.

| Key | Set to / keep |
|---|---|
| `NODE_ENV` | keep `production` |
| `DATABASE_URL` | keep (unchanged by the reset; section 7 changes it after the demo) |
| `SESSION_SECRET`, `IC_HASH_KEY` | keep |
| `PUBLIC_ORIGINS`, `PUBLIC_BASE_URL` | keep = the Pages origin |
| `COOKIE_SECURE` | keep `true` |
| `TRUST_PROXY_HOPS` | keep `2` |
| `FILE_STORAGE_DIR` | keep `/var/lib/pretasiplus/files` |
| `BIJAK_POC_QUESTIONS` | **must be `true`** (else the PoC papers have no questions) |
| `ALLOW_DEMO_SEED` | keep `false` (the API never seeds) |
| `LOG_LEVEL` | keep `info` |
| `CLIENT_IP_HEADER` | **set** `x-pp-client-ip` |
| `EDGE_PROXY_SECRET` | **set**: a new random value, at least 32 characters, the SAME as the Pages secret (4.3). Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` and paste straight into both dashboards. `CLIENT_IP_HEADER` without it fails the boot |
| `AI_PROVIDER` | leave **unset** (= the mock) or `mock` |
| `AI_MODEL`, `AI_API_KEY`, `AI_BASE_URL`, `AI_BASE_URL_ALLOWLIST`, `AI_MONTHLY_BUDGET_SEN`, `AI_PRICE_TABLE_JSON` | leave **unset** (no real provider in the demo) |
| `MARKETPLACE_PLATFORM_WHATSAPP` | leave unset (fictitious default `60000000000`, right for a demo) |
| `PORT`, `COOKIE_DOMAIN`, every `THROTTLE_*`, `INTAKE_*`, `METRICS_*`, `*_TIMEOUT_MS` | leave unset (code defaults) |

New since the last demo deploy (`adcaad0c`) in `apps/api/src/common/config/env.schema.ts`: `CLIENT_IP_HEADER`,
`EDGE_PROXY_SECRET`, the `AI_*` block, `MARKETPLACE_PLATFORM_WHATSAPP`, and optional throttles/timeouts. **None is
required**: all are optional or have a default. The only cross-check is `CLIENT_IP_HEADER` => `EDGE_PROXY_SECRET`.
Production boot still requires `DATABASE_URL`, `SESSION_SECRET`, `IC_HASH_KEY` (different from it) and an absolute
`FILE_STORAGE_DIR`, all already set.

3.2 **Settings** -> Build & Deploy -> **Branch** -> `feature/v2-backend` -> Save (auto-deploy stays off).

3.3 **Manual Deploy** -> **Deploy a specific commit** -> `23c98226ba1c5d0291b18af19f992e5342a4b1d7`. Wait for
"Live"; the log ends with `API listening on port 10000`. `Invalid environment configuration. <KEY>: ...` names the
key to fix (never the value).

3.4 `https://<service>.onrender.com/api/health` -> `{"data":{"status":"ok","db":"up",...}}`.

## 4. Cloudflare Pages: the SPA (direct upload, ~10 min)

### 4.1 Which commit

Build from `be/integration-frontend` **after Developer 5's sync PR (backend tip into `be/integration-frontend`)
merges**: use that merge commit (`git log --oneline -1 origin/be/integration-frontend` once the check in section 0
prints "SPA branch is synced"). Today `be/integration-frontend` is `d909e1e0`, 204 commits behind the backend tip.

`be/demo-pages` is **no longer needed**: its two http-session fixes (`42ac1e38`, `c96db90e`) are already in
`be/integration-frontend`, and its only other change, `deploy/pages-direct/_worker.js`, is older than the one on the
backend tip (`cd3cff26`: edge client IP, secret trim, `no-store`), which the sync brings in.

Rehearsed locally (not pushed): `be/integration-frontend` `d909e1e0` merged with `feature/v2-backend` `23c98226`
(one docs conflict, no code conflict); after it, `apps/api` and `packages/` are identical to the tip. Build 20 s,
`check-demo-bundle: OK (3 marker(s), 526 file(s) checked in dist)`, 669 files, about 17 MB.

### 4.2 Build

```bash
git checkout <sync merge commit on be/integration-frontend>
npm ci
VITE_API_MODE=http npx vite build --mode demo        # the shell value wins over VITE_API_MODE=mock in .env.demo
node scripts/check-demo-bundle.mjs dist              # expect "check-demo-bundle: OK"
cp deploy/pages-direct/_worker.js dist/
git diff --quiet 23c98226 -- deploy/pages-direct/_worker.js apps/api packages && echo "worker + API = deploy commit"
cd dist && zip -qr ~/pages-dist.zip . && cd ..      # the CONTENTS of dist at the zip root
unzip -l ~/pages-dist.zip | grep -E ' (index.html|_worker.js)$'   # both listed at the root
```

PowerShell: `$env:VITE_API_MODE='http'; npx vite build --mode demo`, then `Copy-Item deploy/pages-direct/_worker.js dist/`
and `Compress-Archive -Path dist/* -DestinationPath $HOME\pages-dist.zip`.

### 4.3 Secret, then upload (Pages first, then Render is the safe order; doing both within minutes is fine too)

1. `npx wrangler pages secret put EDGE_PROXY_SECRET --project-name prestasiplus-demo` (prompts for the value; the
   SAME value as Render), or dashboard -> Settings -> Variables and Secrets -> type **Secret**. `API_ORIGIN` stays
   the Render URL.
2. Workers & Pages -> `prestasiplus-demo` -> **Create deployment** -> Production -> upload `~/pages-dist.zip` ->
   Save and deploy. Secrets apply to new deployments only, so upload after setting it.
3. `https://<project>.pages.dev/api/health` -> db up.

## 5. After the deploy (15 min)

Wake the API first (`/api/health`, Render free sleeps after 15 min). Git Bash, from the deploy checkout, with jq on
PATH. Never run these at the same time as each other or as UAT (shared login limits).

5.1 Smoke behind Pages:

```bash
read -rsp 'Demo password (vault): ' DEMO_PASSWORD; echo
BASE_URL=https://<project>.pages.dev DEMO_PASSWORD="$DEMO_PASSWORD" bash scripts/demo-smoke.sh
```

Expect `Result: 28 passed, 0 failed` (all PASS). Rehearsal straight at the API (no Pages): 25 passed, the 3 failures
were the proxy-only checks (SPA `/`, deep link `/login`, `no-store` from the worker). The 21 Oct deploy had 2 FAILs
behind Pages (`no-store`, spoofed `X-Forwarded-For`); both are fixed by the tip worker plus `CLIENT_IP_HEADER` +
`EDGE_PROXY_SECRET`. Then: Render log shows **no** `ClientIp` warning, and do the two-network check (6 wrong
logins from a phone on mobile data, then the laptop on another network can still log in).

5.2 Walkthrough, read-only (wait about a minute after the smoke):

```bash
BASE_URL=https://<project>.pages.dev BUILD_SHA=23c98226 STRICT_EXEMPT="" DEMO_PASSWORD="$DEMO_PASSWORD" bash scripts/demo-walkthrough.sh
```

`STRICT_EXEMPT=""` because #85 and #86 are merged. Expect `102 passed, 0 failed, 5 skipped` and exit code **3**
("5 modules SKIPPED — not a go"): that is the normal result of a read-only run (practice, games, battle, foster and
the role switch are writes).

5.3 Walkthrough with writes, ONCE per DB refresh:

```bash
BASE_URL=https://<project>.pages.dev BUILD_SHA=23c98226 STRICT_EXEMPT="" CONFIRM_WRITES=1 DEMO_PASSWORD="$DEMO_PASSWORD" bash scripts/demo-walkthrough.sh
unset DEMO_PASSWORD
```

It prints the target and waits 5 s (Ctrl-C to stop). Expect `116 passed, 0 failed, 0 skipped`, `GO`, exit 0. It
leaves one practice session, one battle, one pending Keluarga Angkat application and a few logins in the DB.

Not covered by either script (check by hand in the browser): SPA rendering, the 5 solo games in http mode
(PR #105, D62), `/login` on mobile.

## 6. Rollback

- **SPA:** Pages -> Deployments -> the previous deployment -> **Rollback to this deployment**.
- **API:** Render -> Settings -> Branch back to `be/demo-deploy-2` -> Manual Deploy -> commit `adcaad0c`.
  Remove `CLIENT_IP_HEADER` if the edge side is rolled back too (`EDGE_PROXY_SECRET` may stay).
- **Database** (only together with the API rollback; the old API on the new DB is untested): SQL Editor
  `BEGIN; DROP SCHEMA public CASCADE; COMMIT;` (do NOT re-create `public`: the dump does), then

  ```bash
  pg_restore --no-owner --no-privileges --exit-on-error -d "$PGURL?sslmode=require" ~/demo-before-23oct-<stamp>.dump
  ```

  then re-run the lockdown (2.5). Rehearsed locally: the restore gave the same row count in all 197 tables as the
  source at dump time. A restore into a schema that already exists fails on `CREATE SCHEMA public`.

```bash
unset PGURL
```

## 7. After the demo: rotate the DB password (5 min)

The pooler URL (with its password) has been on laptops and in the Render dashboard. Rotate it right after the demo:

1. Supabase -> Project Settings -> Database -> **Reset database password** -> generate a new one (letters and
   digits only avoids URL encoding) -> save it in the vault.
2. Render -> `prestasiplus-api` -> Environment -> `DATABASE_URL` -> the same URL with the new password and the same
   suffix as now (`?sslmode=verify-full&sslrootcert=/etc/secrets/supabase-ca.crt`, or the `no-verify` fallback) ->
   Save -> Manual Deploy (same commit). Until the redeploy is Live the API answers `db: down`.
3. `/api/health` -> db up; log in once as `pelajar@demo.test`.
4. Delete the local dump (`~/demo-before-23oct-*.dump`) once the demo is signed off.

Optionally rotate `EDGE_PROXY_SECRET` the same way (both sides together, see "Rotate the secret" in
[demo-cloudflare-supabase.md](demo-cloudflare-supabase.md)).

## 8. Checklist

- [ ] 0: tip still 33 migrations; SPA branch synced
- [ ] 1: current state noted; dump written and readable
- [ ] 2: reset, 33 migrations, seed 25 modules, lockdown 0 leaked grants, counts match 2.6
- [ ] 3: Render env (`BIJAK_POC_QUESTIONS`, `CLIENT_IP_HEADER`, `EDGE_PROXY_SECRET`), branch, commit `23c98226`, health db up
- [ ] 4: Pages secret, build + bundle check, upload, health
- [ ] 5: smoke 28/0, no `ClientIp` warning, two-network check, walkthrough read-only 102/0/5 (exit 3), writes 116/0/0 (exit 0)
- [ ] 7: after the demo, DB password rotated, Render redeployed

## 9. Rehearsal record (21 Oct 2026, cloud container, Postgres 16.15)

Supabase-like layout: a NON-superuser `postgres` role owning the database, `pgcrypto` in `extensions`, `public`
owned by `pg_database_owner`, roles `anon`/`authenticated`/`service_role` with default grants.

1. **Old state:** the 30 migrations of `be/demo-rehearsal-23oct` `917a152b` applied with the delta script.
2. **Delta dry run at the tip:** 3 migrations (`0028_pksk`, `0031_pksk_question_kind`, `0032_marketplace`), each
   with `note ... sorts before the newest applied migration (0038_intake_workflow)`; no checksum refusal.
3. **Out-of-order vs in-order schema** (empty DBs): `pg_dump -s` identical apart from the schema comment. The three
   migrations are additive (0031 widens two CHECKs). So the risk of Path B is the untested data state, not the DDL.
4. **Path A:** the 2.2 SQL as the non-superuser `postgres` (0 tables left), delta 33 applied, second run "Up to
   date", seed 25 modules in about 15 s, a second seed run changed no row count and kept the password hashes,
   lockdown 0 leaked grants, `anon_reads_users` false. A second fresh build gave identical counts in every table.
5. **API** built from `23c98226` (`npm run be:build`), `NODE_ENV=production`, `BIJAK_POC_QUESTIONS=true`, on that
   DB: health db up; `demo-smoke.sh` direct: 25 passed, 3 proxy-only failed; walkthrough read-only
   (`STRICT_EXEMPT=""`): 102 passed, 0 failed, 5 skipped, exit 3; with `CONFIRM_WRITES=1`: 116 passed, 0 failed,
   0 skipped, GO, exit 0.
6. **Worker:** `node scripts/edge-worker.test.mjs` 15 pass, 0 fail.
7. **Backup/restore:** `pg_dump -n public -Fc` then drop schema + `pg_restore --no-owner --no-privileges`: same
   counts in all 197 tables.
8. Not rehearsable here: Supabase itself, the Pages edge, Render. Those are checked by 2.6 and section 5.
