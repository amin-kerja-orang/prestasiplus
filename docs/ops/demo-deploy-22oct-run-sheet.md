# Demo deploy run sheet, 22 Oct 2026 (Path A)

A short version of [demo-deploy-23oct.md](demo-deploy-23oct.md) (#112) that you can copy and paste.
It is pinned to the commits of the LEAD merge batch (#67 "LEAD merge log 22 Oct").

- **Who runs it:** the LEAD, in Git Bash, outside demo hours.
- **What you need:** names only. Every value comes from the vault, and every secret is read with a silent prompt.
- **Where to look for detail:** each step names its #112 section, which has the reasons, the fallbacks and the rollback detail.

| Fill in | Value |
|---|---|
| `<BACKEND_SHA>` (Render, migrations, seed, smoke/walkthrough scripts) | `<BACKEND_SHA>` (`feature/v2-backend` after the merge batch) |
| `<FRONTEND_SHA>` (Pages SPA) | `<FRONTEND_SHA>` (`be/integration-frontend` after the merge batch) |
| Merged PRs this sheet assumes | `<MERGED_PRS>` |

**Different from #112.** #112 pins `23c98226` with 33 migrations. If you change nothing else, change these:
1. **Commits.** Use `<BACKEND_SHA>` and `<FRONTEND_SHA>` everywhere #112 says `23c98226`.
2. **Migrations.** The count and the newest name are read from `<BACKEND_SHA>` in step 1. With #127, #132 and #135 merged, that is 36 migrations, up to `0042_question_sets_nullable_classroom`.
3. **Questions.** With #129 merged (the D1–D4 pool), the questions count is **1271**; without it, 503. Every other count in #112 §2.6 is unchanged (rehearsed in step 13).
4. **SPA diff check (#112 §4.2).** Only the worker and the demo scripts must match `<BACKEND_SHA>`. `apps/api` on the SPA branch is older by design: `be/integration-frontend` is synced to `23c98226`, not to the later backend merges.
5. **New env name.** With #167 merged, the new name is `INTAKE_TEACHER_ENABLED`. Leave it unset: intake is Admin Pusat only, and the demo has no teacher intake step.
6. **Go/no-go.** Step 11 is new and comes from AZ-32 (#144).

## 1. Checkout and pre-checks (5 min)

```bash
BE=<BACKEND_SHA>; FE=<FRONTEND_SHA>
git fetch origin +refs/heads/feature/v2-backend:refs/remotes/origin/feature/v2-backend \
                 +refs/heads/be/integration-frontend:refs/remotes/origin/be/integration-frontend
git merge-base --is-ancestor $BE origin/feature/v2-backend && git merge-base --is-ancestor $FE origin/be/integration-frontend && echo "SHAs OK"
git merge-base --is-ancestor 23c98226 $FE && echo "SPA branch is synced"
EXP_MIG=$(git ls-tree --name-only $BE apps/api/prisma/migrations/ | grep -c '/00')
EXP_NEWEST=$(git ls-tree --name-only $BE apps/api/prisma/migrations/ | grep '/00' | tail -1 | xargs basename)
EXP_Q=$(git cat-file -e $BE:apps/api/prisma/seed/questions/pool-content-primary.ts 2>/dev/null && echo 1271 || echo 503)
echo "expect $EXP_MIG migrations, newest $EXP_NEWEST, questions $EXP_Q"
git checkout $BE && npm ci && npm run db:generate -w @pp/api
```

All three echo lines must print. If either SHA check fails, stop: the SHA is not on its branch.

## 2. Backup (5 min; #112 §1)

You need the Postgres **17** client tools and the Supabase CA file saved as `~/prod-ca-2021.crt`.

```bash
umask 077
read -rp  'Project ref of prestasiplus-demo: ' DEMO_REF
read -rsp 'Session pooler URL WITHOUT password: ' PGURL && export PGURL; echo
read -rsp 'Supabase DB password (vault): ' PGPASSWORD && export PGPASSWORD; echo
CA="$(cygpath -m "$HOME" 2>/dev/null || printf %s "$HOME")/prod-ca-2021.crt"
export SSLQ="sslmode=verify-full&sslrootcert=$CA"
export DUMP=~/demo-before-22oct-$(date +%F-%H%M).dump
psql "$PGURL?$SSLQ" -At -c "select 'psql: OK'"
psql "$PGURL?$SSLQ" -At -c "select count(*) from users where email is not null and lower(email) not like '%@demo.test' and lower(email) not like '%@example.test'"   # expect 0
psql "$PGURL?$SSLQ" -At -c "select count(*), max(migration_name) from _prisma_migrations where finished_at is not null and rolled_back_at is null"   # note it
pg_dump "$PGURL?$SSLQ" -n public -Fc -f "$DUMP" && pg_restore -l "$DUMP" | grep -c 'TABLE DATA'   # must be non-zero
echo "$DUMP"   # note the name for a rollback
```

Then paste the `pp_gate` function from #112 §1.0 once, and run `pp_gate`. If #112 is not merged, get the function with `git fetch origin +refs/heads/ops/demo-deploy-23oct:refs/remotes/origin/ops/demo-deploy-23oct && git show origin/ops/demo-deploy-23oct:docs/ops/demo-deploy-23oct.md`. It must print `GATE OK`.
- **Non-demo user count is not 0:** stop. This is not the demo DB.
- **Certificate error on either client:** use the `sslmode=require` / `no-verify` fallback in #112 §1. Use it only from a trusted network.

## 3. Path A: reset the database (1 min; #112 §2.2)

```bash
pp_gate && psql "$PGURL?$SSLQ" -v ON_ERROR_STOP=1 -c "BEGIN; DROP SCHEMA public CASCADE; CREATE SCHEMA public; COMMIT;"
psql "$PGURL?$SSLQ" -At -c "select count(*) from information_schema.tables where table_schema = 'public'"   # expect 0
```

## 4. Migrations 0001 → newest (1 min; #112 §2.3)

```bash
export DATABASE_URL="$PGURL?$SSLQ"
node scripts/demo-db-delta.mjs --dry-run   # expect "$EXP_MIG migration(s) would be applied"
node scripts/demo-db-delta.mjs             # expect "Done: $EXP_MIG migration(s) applied"
node scripts/demo-db-delta.mjs             # expect "Up to date: no migration to apply."
```

These are the tip's 33 migrations (`0001_init` .. `0038_intake_workflow`), plus whichever of these merged:
- `0040_practice_answers_answered_at_index` (#127);
- `0041_aggregate_school_index_name` (#132);
- `0042_question_sets_nullable_classroom` (#135).

Merged in this batch: `<MIGRATIONS_MERGED>`. The `0001_init` NOTICE that pgcrypto already exists is fine.

## 5. PoC seed (1 min; #112 §2.4)

Use the same demo password as now, so nothing changes for the presenters.

```bash
read -rsp 'Demo password (vault): ' PW; echo
export SEED_DEMO_PASSWORD_HASH="$(cd apps/api && PW="$PW" node -e "require('@node-rs/argon2').hash(process.env.PW,{memoryCost:19456,timeCost:2,parallelism:1}).then(h=>console.log(h))")"
unset PW
NODE_ENV=production ALLOW_DEMO_SEED=true BIJAK_POC_QUESTIONS=true npm run be:db:seed -- --profile=poc
unset SEED_DEMO_PASSWORD_HASH DATABASE_URL
```

- **Expect:** `seed: profile=poc, 25 module(s): core-identity, …, poc-profile`.
- **With #129:** the D1–D4 pool comes from the same `questions-pool` module. There is no extra flag and no extra step.
- **Not an error:** the line `seed exam: PoC questions are not written …`.

## 6. Lockdown and counts (2 min; #112 §2.5–2.6)

```bash
psql "$PGURL?$SSLQ" -v ON_ERROR_STOP=1 -f scripts/supabase/lockdown-data-api.sql
psql "$PGURL?$SSLQ" -At -c "select count(*) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role')"   # expect 0
psql "$PGURL?$SSLQ" -At -c "select has_table_privilege('anon','public.users','SELECT')"   # expect f
echo "expect: $EXP_MIG | $EXP_NEWEST | 197 | 51 | 18 | 0 | 4 | 15 | 34 | 15 | 5 | $EXP_Q | 3 | 10 | 71 | 4"
psql "$PGURL?$SSLQ" -At -F' | ' -c "SELECT (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),(SELECT max(migration_name) FROM _prisma_migrations),(SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'),(SELECT count(*) FROM users),(SELECT count(*) FROM users WHERE lower(email) LIKE '%@demo.test'),(SELECT count(*) FROM users WHERE password_hash IS NULL),(SELECT count(*) FROM schools),(SELECT count(*) FROM classrooms),(SELECT count(*) FROM enrolments),(SELECT count(*) FROM exam_attempts),(SELECT count(*) FROM papers),(SELECT count(*) FROM questions),(SELECT count(*) FROM pksk_packages),(SELECT count(*) FROM marketplace_products),(SELECT count(*) FROM battles),(SELECT count(*) FROM practice_sessions)"
unset PGPASSWORD
```

The two lines must be identical. If any value differs, stop and compare before you deploy the API. Also check that Supabase **Integrations → Data API** is still off.

## 7. Build the SPA first (5 min; #112 §4.2)

Build it in a separate worktree. Section 1's checkout stays at `$BE`.

```bash
git worktree add ../pp-spa $FE && cd ../pp-spa && npm ci
VITE_API_MODE=http npx vite build --mode demo && node scripts/check-demo-bundle.mjs dist   # expect "check-demo-bundle: OK"
cp deploy/pages-direct/_worker.js dist/ && ls dist/index.html dist/_worker.js
git diff --quiet $BE -- deploy/pages-direct/_worker.js scripts/demo-smoke.sh scripts/demo-walkthrough.sh && echo "worker + demo scripts = deploy commit"
cd - && git log --oneline -1   # expect $BE
```

If the `worker + demo scripts` line does not print, stop and ask DevOps. The `git diff` deliberately leaves out `apps/api` and `packages` (see item 4 under "Different from #112").

## 8. Edge secret, then the Render environment (#112 §3.1, §4.3 step 1)

1. **Pages secret.** `npx wrangler pages secret put EDGE_PROXY_SECRET --project-name prestasiplus-demo` (it prompts for the value). The secret takes effect on the next upload. `API_ORIGIN` stays the Render URL.
2. **Render.** In `prestasiplus-api` → Environment, check these names. Values come from the vault.

| Name | Action |
|---|---|
| `EDGE_PROXY_SECRET` | **set**: the SAME new random value as on Pages, at least 32 characters |
| `CLIENT_IP_HEADER` | **set** `x-pp-client-ip` (boot fails without `EDGE_PROXY_SECRET`) |
| `BIJAK_POC_QUESTIONS` | **must be `true`** |
| `AI_PROVIDER` | `mock` (AZ-29 item 1) |
| `NODE_ENV` | keep `production` |
| `COOKIE_SECURE` | keep `true` |
| `TRUST_PROXY_HOPS` | keep `2` |
| `ALLOW_DEMO_SEED` | keep `false` |
| `LOG_LEVEL` | keep `info` |
| `DATABASE_URL`, `SESSION_SECRET`, `IC_HASH_KEY`, `PUBLIC_ORIGINS`, `PUBLIC_BASE_URL`, `FILE_STORAGE_DIR` | keep |
| `AI_MODEL`, `AI_API_KEY`, `AI_BASE_URL*`, `AI_MONTHLY_BUDGET_SEN`, `AI_PRICE_TABLE_JSON` | unset |
| `INTAKE_TEACHER_ENABLED` (new with #167) | unset (Admin Pusat only) |
| `MAIL_LOG_RESET_LINKS` | unset (it is refused in production) |
| `JOBS_*`, `OCR_*`, `INTAKE_*`, `THROTTLE_*`, `METRICS_*`, `*_TIMEOUT_MS` | unset (code defaults, as rehearsed) |

New names on `<BACKEND_SHA>` since #112: `<NEW_ENV_NAMES>`.

## 9. Deploy the API, then upload the SPA right after (~10 min; #112 §3.2–3.4, §4.3)

1. **Render branch.** Settings → Branch: `feature/v2-backend`.
2. **Render deploy.** Manual Deploy → **Deploy a specific commit** → `<BACKEND_SHA>`. Wait for "Live", with `API listening on port 10000` in the log.
3. **API health.** `https://<service>.onrender.com/api/health` shows `db: up`.
4. **Pages upload, at once.** Workers & Pages → `prestasiplus-demo` → Create deployment → Production → drag `../pp-spa/dist` → Save and deploy.
5. **Pages health.** `https://<project>.pages.dev/api/health` shows `db: up`.

Nobody uses the demo between the reset (step 3) and step 9.4.

## 10. Smoke and walkthrough (15 min; #112 §5)

Run these from the step-1 checkout. Run them one at a time, never together with UAT.

```bash
read -rsp 'Demo password (vault): ' DEMO_PASSWORD; echo
BASE_URL=https://<project>.pages.dev DEMO_PASSWORD="$DEMO_PASSWORD" bash scripts/demo-smoke.sh
# expect: Result: 28 passed, 0 failed
BASE_URL=https://<project>.pages.dev BUILD_SHA=${BE:0:8} STRICT_EXEMPT="" DEMO_PASSWORD="$DEMO_PASSWORD" bash scripts/demo-walkthrough.sh
# expect: 102 passed, 0 failed, 5 skipped, exit 3 (read-only)
BASE_URL=https://<project>.pages.dev BUILD_SHA=${BE:0:8} STRICT_EXEMPT="" CONFIRM_WRITES=1 DEMO_PASSWORD="$DEMO_PASSWORD" bash scripts/demo-walkthrough.sh
# expect: 116 passed, 0 failed, 0 skipped, GO, exit 0 (writes; once per DB refresh)
```

Then check two more things:
- **Render log:** no `ClientIp` warning.
- **Two-network login check:** make 6 wrong logins from a phone on mobile data. The laptop, on another network, can still log in.

## 11. Go/no-go in the browser (10 min; AZ-32 #144 §7)

The scripts test the API only. These three defects are in the SPA, so check them by hand at 1280 and on a phone.

| Check | If #154 (DEMO-FIX-1) is in `$FE` | If not |
|---|---|---|
| **D-01:** a teacher can use Cipta Kelas, and a pupil joins with the code | must PASS | keep Cipta Kelas out of the script; use the seeded classes |
| **D-02:** practice starts with a specific Darjah (D1–D4) | must PASS (needs #129) | demo **"Semua Tahap"** only |
| **D-03:** Battle Arena Quick Match finds a match, or "Batal" works | must PASS | keep Battle Arena out of the demo |

Check whether #154 is in: `git merge-base --is-ancestor 81de8d0e $FE && echo "#154 in"`. In this batch: `<DEMO_FIXES_LANDED>`.

Other checks:
- **D-05:** `/jemput-ibu-bapa` never shows `/terima/undefined`. If #153 is not in, press "Jana Link Baru" first.
- **#105:** the 5 solo games reach their result card.
- **#131:** the 5 intake review screens load as Admin Pusat.
- **D-06:** try one real PDF upload in the demo laptop's browser. If it fails, demo "Cuba dengan kertas contoh".
- **D-11:** if #155 is merged, teacher Kirkpatrick lists only the teacher's own school. The "… - Admin" title on `/guru/monitoring` is still open (it is UI only).

**Go** means all of these:
- steps 6 and 10 match their expected values;
- the rows that must PASS do pass;
- every other row has its workaround written into the presenters' script.

Otherwise roll back (#112 §6):
- **Pages:** roll back to the previous deployment.
- **Render:** branch `be/demo-deploy-2`, commit `adcaad0c`.
- **Database:** `pp_gate`, then drop and `pg_restore "$DUMP"`, then lockdown.

## 12. Clean up, and rotate after the demo (#112 §6–7)

```bash
unset PGURL PGPASSWORD SSLQ DUMP DEMO_REF CA DEMO_PASSWORD; unset -f pp_gate
```

**After the demo, rotate the DB password:**
1. Supabase → Database → **Reset database password**. Save the new password in the vault (letters and digits only).
2. Render → `DATABASE_URL`: the same URL and suffix, with the new password. Then Manual Deploy of the same `<BACKEND_SHA>`.
3. Check `/api/health` shows `db: up`, and log in once as `pelajar@demo.test`.
4. Delete `~/demo-before-22oct-*.dump` once the demo is signed off.
5. Optional: rotate `EDGE_PROXY_SECRET`, on both sides together.

## 13. Rehearsal behind this sheet

Local only: nothing ran against Render, Supabase or Cloudflare.

**Tree.** `feature/v2-backend` @ `23c98226` merged with:
- #129 `989153ca`;
- #132 `f6174caa`;
- #127 `38039fcb`;
- #135 `ebb111a2`;
- #162 `d318f81d`;
- #167 `5bbc1892`.

**Database.** Postgres 16 in a Supabase-like layout: a non-superuser `postgres` owner, `pgcrypto` in `extensions`, and the roles `anon`, `authenticated` and `service_role`.

**Results:**
- **Delta script:** a dry run of 36, then `Done: 36 migration(s) applied`, then `Up to date`.
- **Seed:** 25 modules.
- **Lockdown:** 0 grants.
- **Counts:** `36 | 0042_question_sets_nullable_classroom | 197 | 51 | 18 | 0 | 4 | 15 | 34 | 15 | 5 | 1271 | 3 | 10 | 71 | 4`.
- **Worker and demo scripts:** identical between `23c98226` and #120's head `3726820d`.
- **SPA, smoke and walkthrough:** AZ-32 (#144 §4) got 102/0/5 and 116/0/0 on a combined tree that included #129.
