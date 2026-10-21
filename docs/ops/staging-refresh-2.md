# Paired staging refresh 2 (Supabase + Render API + Cloudflare Pages)

Runbook to move the existing staging stack to the `feature/v2-backend` tip (API, migrations, seed) and the `be/integration-frontend` tip (SPA) together. Background and first-time setup: [deploy-execution.md](deploy-execution.md), [deploy-staging.md](deploy-staging.md), [demo-reseed.md](demo-reseed.md), [db-backup.md](db-backup.md). Not repeated here.

Staging only. Written from the repo at `origin/feature/v2-backend` 872e04ce; nothing here was executed by the author. Every deploy step touches a shared environment and needs the user's explicit go first. Secrets stay in the platform dashboards or your shell, never in the repo, chat or tickets. Placeholders: `<RENDER_URL>`, `<PAGES_URL>`, `<SUPABASE_DB_URL>` (session pooler, port 5432, `?sslmode=require`; not 6543).

## Decisions (summary)

| Question | Choice | Why |
|---|---|---|
| Deploy order | Backup, then **Supabase migrate**, then **Render API**, then seed, then **Pages FE**, then verify | Every migration on this base (0019 to 0023, 0026) is additive: new tables and columns, no `DROP`/`RENAME` outside comments (checked with grep). The old API keeps working on the migrated schema, but the new API calls tables that do not exist yet on an un-migrated DB (500 on those routes). So migrate first. The Pages FE (calls batch3-only routes) goes last, after the API serves them (AGENT-SYNC: Pages live must not pass `785e44ef` until the blockers below clear). |
| Seed path | **Path B: additive seed on the existing data, no reset** | Seeds are idempotent upserts by natural key, never truncate (`seed/index.ts` header; demo-reseed.md "Notes"). Reset would wipe UAT data and is refused when `NODE_ENV=production` anyway (`db.mjs`). Details in step 3. |

## Needs confirmation (open before you start)

| # | Item | Why it matters |
|---|---|---|
| 1 | Blocker #76 (AGENT-SYNC 2026-10-21): BE-23 `/gamification/leaderboard` must not expose pupils' full names nationally (Group B). Merged or not at the v2-backend tip? | Staging refresh is declared BLOCKED until it is fixed. Do not start while open. |
| 2 | BE-21 full and BE-19 full merged (BE-19 full brings migration 0030) | Same blocker list. On 872e04ce both are still slices (backend-tracker: `in-progress`). |
| 3 | Which migrations the staging DB already has | `migrate status` (step 1) answers this; the table below assumes staging holds 0001 to 0018 and is not proven by the repo. |
| 4 | Whether `0025` (BE-41) and `0027` (BE-44) exist at the tip | Allocated to Group B, not on this base. 0016 and 0024 are never used (gaps are normal; do not "fix" them). |
| 5 | `core-marketplace-categories` seed module (BE-46) | Not in `seedModules` on this base; only seeds if BE-46 is merged. Adding a `reference` module needs LEAD approval (comment in `seed/index.ts`). |
| 6 | Pages `NODE_VERSION`, build command and `VITE_PROTOTYPE_SCOPE` still as in deploy-execution.md section 3 | Dashboard state is not in the repo. |
| 7 | Mobile /login measurement script path | No script found in the repo; step 6(iv) describes the measurement, the tooling is Needs confirmation. |

### Migrations at the v2-backend tip

| Migration | On base 872e04ce | Source | Action |
|---|---|---|---|
| 0019_gamification_shop | yes | BE-23 | applies if pending |
| 0020_ai_intake | yes | BE-37 | applies if pending |
| 0021_missions_question_sets | yes | BE-18 | applies if pending |
| 0022_practice_reads | yes | BE-13 | applies if pending |
| 0023_reports_analytics_kirkpatrick | yes | BE-20 | applies if pending |
| 0026_cikgu_alesa | yes | BE-43 | applies if pending |
| 0025 (BE-41), 0027 (BE-44) | no | Group B | only if merged at the tip |
| 0028 (BE-42 `pksk`) | no | Group A | only if merged; BE-42 has TWO migrations, `0028_pksk` and `0031_pksk_question_kind` (lead, 2026-10-21): apply both, in order |
| 0029 | released, never used | BE-28 | none |
| 0030 (BE-19 full: headcount, timeline) | no | Group A | only if merged |
| 0031 (BE-42 `pksk_question_kind`) | no | Group A | only if merged |
| 0032 (BE-46 marketplace) | no | Group A | only if merged |

Rule: `ls apps/api/prisma/migrations` at the deploy SHA is the truth. The expected `_prisma_migrations` count equals the number of folders there (not the highest number, because of the gaps). Migrations are forward-only: there is no down migration.

## 0. Pre-flight

| Field | Value |
|---|---|
| Date / operator / lead | ____ / ____ / ____ |
| API SHA (`origin/feature/v2-backend` tip) | ______________ |
| FE SHA (`origin/be/integration-frontend` tip) | ______________ |
| FE contains API SHA? | `git merge-base --is-ancestor <API SHA> <FE SHA> && echo OK` (must print OK, otherwise `functions/` and `render.yaml` may be missing; same check as deploy-execution.md section 0) |
| Blockers #76, BE-21 full, BE-19 full cleared | yes / no (AGENT-SYNC) |

1. **Freeze notice.** Tell the team (and the UAT testers) that staging is frozen: no pushes to the two branches, no logins, no UAT, no automated e2e until sign-off. Check: written acknowledgement from the lead. Rollback: lift the freeze.
2. **Backup of the Supabase DB.** Free plan has daily backups only, so take a manual one. Two options, do the first:
   ```
   pg_dump -Fc --no-owner --no-privileges -d "<SUPABASE_DB_URL>" -f <BACKUP_DIR>/pp-staging-<yyyymmdd-hhmm>.dump
   sha256sum <BACKUP_DIR>/pp-staging-<yyyymmdd-hhmm>.dump > <BACKUP_DIR>/pp-staging-<yyyymmdd-hhmm>.dump.sha256
   ```
   (`<BACKUP_DIR>` outside the repo, encrypted volume; the dump holds personal data of minors, see db-backup.md. `pg_dump` major version must be >= the Supabase server's.) Second option: Supabase dashboard, Database, Backups, note the latest daily backup time and, if the plan allows, take a manual backup. Check: `pg_restore --list <dump> | head` prints a table of contents; the file is not empty; sha256 recorded in the results log. Note that `scripts/db-restore-check.mjs` targets the compose `db` container, not Supabase; to prove the dump, restore it into a throwaway local Postgres (`createdb pp_restorecheck; pg_restore --no-owner --exit-on-error -d pp_restorecheck <dump>; dropdb pp_restorecheck`). Restore command for a real rollback is in step 7.
3. **Confirm the Render environment** (dashboard, Environment tab; read only, change only if wrong):

   | Key | Expected |
   |---|---|
   | `NODE_ENV` | `production` |
   | `TRUST_PROXY_HOPS` | `2` (Pages Function sets `X-Forwarded-For`, Render appends the egress IP) |
   | `COOKIE_SECURE` | `true` |
   | `PUBLIC_BASE_URL`, `PUBLIC_ORIGINS` | `<PAGES_URL>` (no trailing path) |
   | `BIJAK_POC_QUESTIONS` | `true` (in the env schema on this base, default false; without it the PoC papers have no questions) |
   | `ALLOW_DEMO_SEED` | **not set** on Render. The API runtime ignores it; it is set only inline on the seed command in step 3 |
   | `DATABASE_URL`, `SESSION_SECRET`, `IC_HASH_KEY` | present; do not rotate `IC_HASH_KEY` (every `ic_hash` depends on it) |
   | `SEED_DEMO_PASSWORD_HASH` | not on Render (shell only, step 3) |

   Check: values match; any boot failure later names the offending key in the Render logs. Rollback: restore the previous value.
4. **Record the rollback targets:** Render, current Live deploy commit SHA: ______; Pages, current production deployment ID/SHA: ______; Supabase, `select count(*) from _prisma_migrations where finished_at is not null;` = ____ and the dump file name from step 2.
5. **Local checkout.** On a laptop: `git fetch origin && git checkout <API SHA> && npm ci`. Check: `git rev-parse HEAD` equals the API SHA in the table.

## 1. Supabase: migrate (before the API)

1. Preview what is pending (read only):
   ```
   export DATABASE_URL='<SUPABASE_DB_URL>'
   npx prisma migrate status --schema apps/api/prisma/schema      # run from apps/api if the schema path differs
   ```
   Check: lists the migrations not yet applied; they must be a subset of the table above and contain no failed/rolled-back entry. If `migrate status` reports a failed migration, STOP (NO-GO).
2. Apply:
   ```
   export DATABASE_URL='<SUPABASE_DB_URL>'
   npm run be:db:migrate
   ```
   (`db.mjs` runs `prisma migrate deploy`; safe to re-run.) Check: the output ends with "All migrations have been successfully applied" (or "No pending migrations"); then `npx prisma migrate status` says "Database schema is up to date!". SQL check: `select count(*) from _prisma_migrations where finished_at is not null;` equals the number of folders in `apps/api/prisma/migrations` at the API SHA.
3. Rollback: none for the migration itself (forward-only). If a migration fails midway, do not hand-edit; restore the step-0 backup (step 7) and report to the Group A owner. The old API stays compatible with the already-additive schema, so a failed refresh can leave the old Render and Pages running meanwhile.

## 2. Render: API to the v2-backend tip

1. Render dashboard, service `pretasiplus-api`, Manual Deploy, Deploy specific commit, `<API SHA>` (Auto-Deploy is off in `render.yaml`). Free plan cold start takes 30 to 60 s.
2. Wait for status Live. Check:
   ```
   curl -fsS <RENDER_URL>/api/health
   ```
   Expected: `{"data":{"status":"ok","db":"up","time":"..."}}` (the controller also returns a `time` field). Not `db:"down"`, not a Render 502/503. Also check the Render deploy log shows the API SHA and no env-key boot error.
3. Rollback: Render, Deploys, previous deploy, Redeploy. Safe because the schema is additive.

## 3. Seed: demo and reference modules

### Path A vs Path B

| | Path A: reset + full seed | Path B: additive seed (chosen) |
|---|---|---|
| Command | `be:db:reset` (`prisma migrate reset --force`), then migrate and seed | `ALLOW_DEMO_SEED=true BIJAK_POC_QUESTIONS=true npm run be:db:seed -- --profile=poc` |
| Data loss | Total: drops everything, including UAT attempts, changed passwords and uploaded-file references | None. Seeds upsert by natural key and never truncate (`seed/index.ts` rules; demo-reseed.md "Notes") |
| Demo passwords | All accounts return to the published seed password (`apps/api/prisma/seed/core/demo-password.ts`) unless `SEED_DEMO_PASSWORD_HASH` is set before | Existing hashes are kept (`existing.passwordHash ?? demoPasswordHash()`), so the staging-only password set earlier survives; only newly created accounts take `SEED_DEMO_PASSWORD_HASH` |
| Existing UAT data | Lost | Kept |
| Guard | `db.mjs` refuses reset when `NODE_ENV=production`; the shell for the seed has no `NODE_ENV=production`, so it would run against Supabase, which is why the refusal is not a protection here. Needs the user's explicit go and a verified backup | Demo guard (`seed/guard.ts`) is fail-closed: unless `NODE_ENV` is `development` or `test`, the demo modules need `ALLOW_DEMO_SEED=true` (the inline prefix on the command). With `NODE_ENV` unset and no prefix, only the reference catalogue runs |
| Verdict | Do not use on shared staging | **Use.** Fall back to Path A only if the migrate step is unrecoverable and the backup restore also fails (then rebuild from empty: demo-reseed.md Path A) |

Caveat for Path B: modules that use `existing ?? value` keep old rows as they are, so a changed seed value does not overwrite an existing row. If a seed fix must overwrite, that is a data change decided case by case, not part of this runbook.

### Steps

1. Same checkout as step 0 (API SHA). Set the shell only (never in a file):
   ```
   export DATABASE_URL='<SUPABASE_DB_URL>'
   export SEED_DEMO_PASSWORD_HASH='<argon2id hash from the vault>'     # only for accounts created now; see demo-reseed.md
   ```
   `NODE_ENV` stays unset in this shell.
2. Run (the `ALLOW_DEMO_SEED=true` prefix applies to this one command only; do not `export` it):
   ```
   ALLOW_DEMO_SEED=true BIJAK_POC_QUESTIONS=true npm run be:db:seed -- --profile=poc
   ```
   Check the last line: `seed: profile=poc, N module(s): core-identity, core-schools, core-school-packages, core-population, curriculum, questions, wallet, content, exam, exam-demo-blueprints, poc-classes, poc-bijak-sittings, poc-cikgu, practice, gamification` (15 modules on this base, in registry order; `N` is 15, or more if BE-46 and others added modules at the tip; the exact list is Needs confirmation per SHA). The line must contain no "demo modules skipped" warning. New on this refresh: `gamification`, `practice`, `poc-cikgu` (and `core-marketplace-categories`, reference, if BE-46 is merged). Reference modules (`core-school-packages`, and the marketplace categories if present) run in every environment; the rest are demo.
3. Spot queries (Supabase SQL editor or `psql "$DATABASE_URL"`; the counts are compared with the pre-refresh numbers, since the expected totals are not fixed in the repo):
   ```sql
   select count(*) from _prisma_migrations where finished_at is not null;      -- = folders at the API SHA
   select role, count(*) from user_roles group by role;                         -- demo accounts exist per role
   select count(*) from users where lower(email) like '%@demo.test';            -- not lower than before
   select count(*) from bijak_papers;                                           -- table name Needs confirmation (migration 0012_bijak_papers); >= before, published papers present
   select count(*) from school_packages;                                        -- reference data present
   -- only if BE-46 / 0032 is merged: the marketplace categories table (name Needs confirmation) is non-empty
   ```
   Re-running step 2 must leave all counts unchanged (idempotent). Rollback: restore the step-0 backup (step 7); there is no targeted undo.
4. Do not touch `users.password_hash` by SQL here. The Path B SQL in demo-reseed.md (reset hashes, copy to `murid4` to `murid8`) applies only if the team wants to rotate off the published seed password, and is a separate decision.

## 4. Cloudflare Pages: FE to the integration-frontend tip

1. Confirm the Pages project env (deploy-execution.md section 3): `VITE_API_MODE=http`, `VITE_API_BASE_URL` empty, `VITE_TEST_HOOKS=false`, `VITE_PROTOTYPE_SCOPE` as agreed, `API_ORIGIN=<RENDER_URL>` (runtime, read by `functions/api/[[path]].ts`), build command `npx vite build --mode production --outDir dist`, output `dist`.
2. Deploy `<FE SHA>` (push to the production branch, or Retry/Create deployment on that commit). Wait until the deployment is Success.
3. Checks:
   ```
   curl -fsS <PAGES_URL>/api/health          # same JSON as step 2, through the Function proxy
   curl -sI  <PAGES_URL>/login | head -1     # 200, text/html (SPA)
   curl -sI  <PAGES_URL>/some/deep/route     # 200 (SPA fallback)
   ```
   - `/api/health` returning HTML or a 500 `Konfigurasi pelayan tidak lengkap.` = `API_ORIGIN` unset or wrong.
   - Build is http mode: load `<PAGES_URL>/login` in a browser, open the network tab, a login attempt sends `POST /api/auth/login` (not a mock, no `window.__mock`). The deploy log must show `--mode production`, not `--mode demo`. An http build never contains the mock data bundle.
4. Rollback: Pages, Deployments, previous good deployment, Rollback.

## 5. Verification (strict order, one at a time)

Use a dedicated tester account and the vault password. **Never run any automated e2e at the same time as manual UAT or another smoke**: one IP shares the login throttle (5 per minute) and the API rate limit, and gives 429 (go/no-go rule, 2026-10-20). Leave about 1 minute between steps. Smoke writes data (one student attempt). A 429 is a rerun, not a FAIL. Tooling is on the FE branch (`origin/be/integration-frontend`): run from a checkout of `<FE SHA>` with `npm ci`.

| Step | Command (env names only; values from the vault) | Expected | NO-GO if |
|---|---|---|---|
| (i) Smoke on Render | `BASE_URL=<RENDER_URL> BIJAK_STUDENT_USER=… BIJAK_STUDENT_PASS=… npm run smoke:bijak` | 8 lines PASS (`health`, `login`, `list-papers`, `start-attempt`, `autosave`, `read-back`, `submit`, `result`) then `SMOKE PASS`, exit 0 | any `FAIL <step>` (exit 1): API broken at that step. Exit 2 = missing env. `list-papers` "no published paper" = seed or publish missing |
| (ii) Smoke on Pages | same with `BASE_URL=<PAGES_URL>` | same output | passes on Render but fails on Pages = proxy, cookie or CSRF (deploy config), a deploy blocker |
| (iii-a) `@bijak` http e2e | `BIJAK_API_BASE=<PAGES_URL> BIJAK_STUDENT_USER/_PASS BIJAK_ADMIN_SEKOLAH_USER/_PASS BIJAK_GURU_USER/_PASS BIJAK_ADMIN_PUSAT_USER/_PASS npx playwright test -c playwright.bijak.config.mjs --grep @bijak --workers=1` (add `E2E_BOOT_TIMEOUT_MS=60000` on a slow machine) | 0 failed at 375/768/1280: `http-autosave`, `student-http` PASS, `us33-http` PASS (a skip is not a pass), `admin-publish-http` 1 real test PASS, other tests only `fixme` | any failure, or a skip without a known fixme or missing credential. Failure on one width only = responsive bug (High) |
| (iii-b) `@api` e2e | `BASE_URL=<PAGES_URL> E2E_DEMO_PASSWORD=<STAGING_DEMO_PASSWORD> npm run test:e2e:http -- --grep @api --workers=1` (uses `playwright.http.config.ts`; `E2E_HTTP_START_STACK` must be unset so it does not try to start Docker; per-role `BIJAK_<ROLE>_PASS` overrides `E2E_DEMO_PASSWORD`; the password comes from the vault, never typed into a file) | 0 failed. The `@api` and `@bijak` http specs read passwords from env (`e2e/api/helpers.ts`, `e2e/bijak/http-creds.ts`); `e2e/api/auth-session.spec.ts` also reads `E2E_DEMO_PASSWORD` (falls back to the local seed password only when it is unset), so always set it for staging | any failure not explained by a known credential or fixme |
| (iv) /login mobile measurement | See below | pass = horizontal overflow 0 AND the chips' right edge <= viewport width, at 320 and 375 | overflow > 0 or a chip past the viewport: High layout bug |
| (v) Manual UAT | `docs/qa/bijak-uat.md` rows via `docs/qa/bijak-go-no-go.md` section 3 (on the FE branch) | per the go/no-go matrix | only after (i) to (iv) are green and nobody is running automation |

(iv) Measurement: Playwright chromium with `isMobile: true`, `hasTouch: true`, viewport 320x568 then 375x812, open `<PAGES_URL>/login`, wait until the role chips are shown, wait a further 3 s, then evaluate `document.documentElement.scrollWidth - window.innerWidth` (overflow, must be 0 or less) and, for every chip, `getBoundingClientRect().right` (must be <= `window.innerWidth`). Evaluating earlier or on a non-mobile context gives wrong numbers. Record both widths. Script location: Needs confirmation (none found in the repo).

Defects rule (from the go/no-go): no open Critical or High; no lost answer; no mark scheme visible before Hantar in exam mode. Blocked-on-B4 rows (create and full publish of a paper) are accepted, not a NO-GO, unless B4 has landed at the FE SHA.

Also verify once (deploy-execution.md section 6): `TRUST_PROXY_HOPS=2` (a second network is not throttled by the first network's failed logins).

## 6. NO-GO handling

Any NO-GO: stop, keep the freeze, record the failing step in the log, decide with the lead whether to fix forward or roll back (step 7). Do not start the manual UAT on a NO-GO.

## 7. Rollback (per layer, newest layer first)

| Layer | Action | Check |
|---|---|---|
| Pages FE | Pages, Deployments, previous good deployment (ID recorded in step 0.4), Rollback | `<PAGES_URL>/api/health` OK; the old SPA loads. Note: the old FE at or below `785e44ef` is the one compatible with a rolled-back API |
| Render API | Render, Deploys, previous deploy (SHA from step 0.4), Redeploy | `<RENDER_URL>/api/health` = `{data:{status:'ok',db:'up'}}`. Works without a DB restore because the new migrations are additive |
| Supabase DB | Last resort (data corruption or a failed migration). Needs the user's explicit go. Stop writers first (Render suspend). Restore the step-0 dump: `pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error -d "<SUPABASE_DB_URL>" <BACKUP_DIR>/pp-staging-<yyyymmdd-hhmm>.dump`, or use the Supabase dashboard restore of the daily backup. Needs confirmation: whether the Supabase-managed schemas (`auth`, `storage`) and `--clean` behave as expected on the free plan; test the command on a scratch database first | `select count(*) from _prisma_migrations where finished_at is not null;` equals the pre-refresh number from step 0.4, then redeploy the old API and FE |

Migrations are forward-only: there is no down migration. Some migrations carry "Reversible: DROP TABLE ..." comments (for example 0020, 0022) but those are not run by tooling; do not apply them by hand on shared data.

## 8. Results log and sign-off

| Time | Step | Result (Pass/Fail/Blocked) | Notes | Evidence (log/screenshot path) |
|---|---|---|---|---|
| | 0 freeze + backup (file, sha256) | | | |
| | 1 migrate (count before / after) | | | |
| | 2 Render health | | | |
| | 3 seed (last log line, counts) | | | |
| | 4 Pages health + SPA | | | |
| | 5(i) smoke Render | | | |
| | 5(ii) smoke Pages | | | |
| | 5(iii-a) `@bijak` e2e | | | |
| | 5(iii-b) `@api` e2e | | | |
| | 5(iv) /login 320 / 375 | | | |
| | 5(v) manual UAT | | | |
| | Freeze lifted | | | |

| Sign-off | Name | Date | Decision (GO / NO-GO / Rolled back) |
|---|---|---|---|
| Operator | | | |
| Lead | | | |
