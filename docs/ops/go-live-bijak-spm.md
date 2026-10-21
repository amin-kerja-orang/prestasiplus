# Go-live readiness checklist: Bijak SPM

Status as read on 2026-10-21 (07:20 UTC) from the repo at `feature/v2-backend` @ `c6634721` and from the
GitHub PRs and issues named below. Timeline (from the merge queue, #67 comment of 2026-10-21 07:09Z): full demo
23 Oct, **ready for full testing 25 Oct**, **go-live 30 Oct**. These dates are not recorded anywhere else in the
repo.

Legend: **verified** = read in the repo or on the named PR/issue; **unverified** = could not be checked from the
repo (platform dashboards, someone's local state, a plan stated only in a brief). No secret values appear here;
env vars are named only.

Sources: `docs/ops/**`, `render.yaml`, `functions/api/[[path]].ts`, `compose*.yaml`, `docker/**`, `scripts/**`,
`.github/workflows/**`, `docs/plan/AGENT-SYNC.md`, `docs/plan/backend-tracker.md`, `docs/plan/backend-tasks/**`,
`docs/TRACKER.md`, `docs/requirements/v2-bijak-spm.md`, PR #81 (BE-33 rest) and the merge queue #67.
There is **no `deploy/` directory** in the repo; the deploy files are `render.yaml`, `functions/` and `docker/`.

---

## 1. Scope of the Bijak SPM go-live

**What it is** (verified, `docs/TRACKER.md` D32, `docs/requirements/v2-bijak-spm.md`): one product that merges the
old .my SPM Mock and the .cloud Simulasi. Two starts (Kertas Pilihan, Jana Kertas), two modes (Mod Peperiksaan,
Mod Latihan). Admin Pusat builds and publishes papers ("Kertas & SPM", D52); teachers and school admins see the
results (US-33).

**Unverified:** no document names the exact module list for the 30 Oct go-live. The list below is the working
definition from `docs/plan/AGENT-SYNC.md` (Bijak sprint and demo objectives: (a) student Bijak flow, (b) teacher and
school visibility of Bijak results, (c) Admin Pusat publish) plus the identity cards those depend on. The LEAD
confirms it (open decision D-1).

### Routes (verified, `src/modules/m28-bijak-spm/routes.ts`)
`/spm/bijak`, `/spm/bijak/sejarah`, `/spm/bijak/kertas/:paperId`, `/spm/bijak/percubaan/:attemptId`,
`/spm/bijak/percubaan/:attemptId/keputusan`. Admin Pusat paper builder and intake screens are in the Admin Pusat
portal. Login, `/api/me`, role switch and Mod Pelajar come from M01/M02.

### Modules and cards

| Area | Module | Card(s) | State |
|---|---|---|---|
| Identity, sessions, roles, CSRF | M01/M02 | BE-01..BE-07, BE-24, BE-25 | **merged** |
| Curriculum | M03 | BE-08 | **merged** |
| Question bank | M04 | BE-09, BE-10 | **merged** |
| Practice write/read, US-33 aggregate | M05 | BE-11, BE-12, BE-13 | **merged** |
| Bijak papers, attempts, Kontrak Blueprint, paper builder | M28 | BE-14, BE-15, BE-16, BE-39 | **merged** |
| Teacher views, reports | M10/M19 | BE-17, BE-18, BE-19, BE-20 | **merged** (BE-19 full via #79 per tracker) |
| School admin (results visibility) | M27 | BE-21 | **merged as slice + full** per `docs/plan/backend-tracker.md` line 22; the card row still says `in-progress` (unverified which ACs remain) |
| Command Center / admin dashboard | M17 | BE-22 | **merged** (#69, tip `c6634721`) |
| AI intake: files, OCR, job runner; dashboard and budget | Admin Pusat | BE-37, BE-40 | **merged** |
| AI extraction service | Admin Pusat | BE-36 | **not merged**, PR #86, G4 in progress (no verdict yet), migration 0037 (LEAD to confirm number) |
| Intake workflow (batches, review, accept to Draf) | Admin Pusat | BE-38 | **not merged**, PR #85, G4 in progress (no verdict yet), migration 0038 (LEAD to confirm number) |
| Security hardening, readiness, metrics, runbook | cross-cutting | BE-33 rest | **approved-not-merged**, PR #81 (G4 re-review Approve, Security Pass) |
| Log PII redaction | cross-cutting | BE-33 part | **not merged**, branch `be/BE-33-log-pii-redaction` @ `521a6756` (Group A; passed in the cloud verify, #67) |
| Seed guard fail-closed | seed | (#80) | **approved-not-merged**, PR #80 |
| PoC seed profile | seed | BE-26 | **approved-not-merged**, PR #74 (needed for test data, never for production) |
| HTTP switch, e2e against the real API | frontend | BE-32 | **partly merged** (PC-1 part merged 2026-10-20); AC3 `@api` e2e, 413 envelope, frontend AC7 open (LEAD) |
| Frontend in http mode | frontend | `be/integration-frontend` @ `23656b63` | **not merged** into `feature/v2-backend`; the demo Pages build is made from it (unverified how it reaches production) |
| Old-system data migration | PC-4 | BE-27, BE-34, BE-35 merged; BE-28, BE-29, BE-30 **not built/merged** | see §2.7 |

Adjacent cards, **not** needed for Bijak SPM unless the LEAD says so (all approved-not-merged unless noted):
#73 BE-41 SPM hub M06 (0025), #77 BE-23 leaderboard privacy (in `lead/merge-b5`), #71 BE-44 battle (0027, in
`lead/merge-b5`), #72 BE-45 games (0033), #83 BE-47 Keluarga Angkat (0034); Group A branches BE-42 PKSK and
BE-46 marketplace (not merged). Note: #77 is needed **whatever the scope** if the leaderboard is visible, because
the tip without it shows full names nationally (#67, demo redeploy comment).

---

## 2. Blocking items

Owner lanes: **A** = Group A (LEAD's PC lanes), **B** = Group B, **LEAD**, **user**.

### 2.1 By 25 Oct (full testing starts)

| # | Item | Owner | Link | State |
|---|---|---|---|---|
| 1 | Fast-forward `feature/v2-backend` to `lead/merge-b5` @ `39d9e962` (#77 + #69 + #71). Full verify is green: 5772 passed, 5 allowed failures | LEAD | #67 (verify comment 02:44Z) | not done (tip still `c6634721`) |
| 2 | Merge the approved Group B queue: #81, #80, #74, #73, #72, #83 | LEAD | #67 (queue comment 07:09Z) | not merged |
| 3 | G4 verdict and merge of BE-38 and BE-36; confirm migrations 0037/0038 | B (review), LEAD (merge, numbers) | #85, #86 | G4 running |
| 4 | Group A test failures on BE-42 (`pksk-db.spec.ts` list order; `migratable-double-upsert` `pksk_packages` check constraint) and BE-28 (`core.db.spec.ts` duplicate rejects, no `run_id` filter). All test-side; fixes proposed. No PR exists for either branch; heads are still `976fd057` and `b14f3005`, so the fixes are not pushed | A | #67 Group A verify comment | open |
| 5 | Log PII redaction branch merged (`be/BE-33-log-pii-redaction` @ `521a6756`) | A / LEAD | #67 | passes, not merged |
| 6 | Login throttle behind Cloudflare: the per-client pair key does not bite behind the Pages worker (6 spoofed attempts, all 401, no 429). DevOps is building a fix on `be/ops-edge-client-ip` (**unverified:** the branch is not on GitHub yet). Interim: measure and set `TRUST_PROXY_HOPS` (likely 3), re-run smoke step 5 and the two-network check | B (DevOps), user (Render env) | #81 "Needs ops", #67 demo-live comment | open |
| 7 | Worker `cache-control: no-store` on proxied `/api` responses (`_worker.js` on `be/demo-pages`; one-line fix in #81). Same DevOps branch | B (DevOps) | #81 | open |
| 8 | Frontend http mode in the deployed build: BE-32 AC3 `@api` e2e, `/login` mobile re-measure, `TODO(d4)` in `e2e/api/helpers.ts`; decide how `be/integration-frontend` reaches the go-live build | LEAD | `docs/plan/AGENT-SYNC.md`, BE-32 card | open |
| 9 | Test environment refreshed to the merged tip (`docs/ops/staging-refresh-2.md`, never executed) | B (DevOps) with user approval (G6 rule) | — | not done |

### 2.2 By 30 Oct (go-live)

| # | Item | Owner | Link | State |
|---|---|---|---|---|
| 10 | **The 7 cross-lane gaps from #81** (release gate blocked until closed): (1) BE-03 role-switch/mode audit `target_type`/`target_id` null; (2) BE-06 password-reset audit null actor fields; (3) BE-10 bulk-action no status events, null `scope_level`; (4) BE-21 `POST /admin-sekolah/guru` non-strict; (5) BE-24 `POST /admin/articles`, `POST /tiket` non-strict; (6) BE-06 `POST /me/notifications/bulk-read`, `POST /auth/register` non-strict; (7) BE-12 `POST /practice/sessions` non-strict. Each is an `it.fails` in #81 that goes red when fixed | LEAD files them; owners: 1, 2, 6 = A (PC-1); 3, 7 = B (PC-2/PC-5); 4 = A (PC-6); 5 = A (PC-1) | #81 | not filed (unverified: no issue found) |
| 11 | Confirm BE-33 OQ1 rate-limit numbers and OQ2 metrics rule | LEAD | #81 | open |
| 12 | **Rotate the demo DB password and Render `DATABASE_URL` together** (one change window: new Supabase password, then the Render secret, then redeploy, then `/api/health` and smoke). Not documented in the repo; **unverified** why or when it was decided | user (dashboards), B (DevOps) runbook | — | open |
| 13 | **Production environment chosen and provisioned.** The repo documents only the free-tier demo (Render free sleeps and has an ephemeral disk, so uploads vanish on restart; Supabase free pauses after 7 idle days and its backup coverage is stated two ways in the docs) and a VPS compose path | user + LEAD (decision D-2) | `docs/ops/deploy-execution.md` §8, `docs/ops/deploy-staging.md` | open |
| 14 | **Backups and restore test.** `npm run db:backup` / `db:restore-check` exist for the compose `db`; scheduling is manual; uploaded files (`apifiles` volume) are not in the dump; for Supabase only a manual `pg_dump -Fc` is documented. AC7 drill done locally only (141 tables, 0 mismatches, #81); compose/production drill not done | B (DevOps), user (schedule, storage) | `docs/ops/db-backup.md`, #81 | open |
| 15 | **Monitoring and alerts.** Only `GET /api/health` exists on the tip; `/api/ready` and `/api/metrics` arrive with #81. No uptime monitor, no alert rules, no failed-backup alert in the repo | B (DevOps) after #81 | #81 | open |
| 16 | **Sentry / error tracking:** nothing in the repo (no SDK, no DSN env var). Decide yes/no; if yes it is new work and a new env var | user + LEAD (D-4) | — | not started |
| 17 | Docker image run read-only + boot smoke; throw-away vulnerable-dependency branch proves `deps-audit` goes red; pin Trivy and dependency-review by SHA; `stop_grace_period: 30s`; nginx `location = /api/metrics { return 404; }` | LEAD / B (DevOps) | #81 "Needs LEAD / ops" | open |
| 18 | Load smoke (k6 suggested before G6; no card owns it) | LEAD to assign | `docs/qa/v2-test-strategy.md` OQ-TS-3 | not started |
| 19 | No frontend CI workflow (`npm run verify` is not in GitHub Actions) and no deploy workflow | LEAD | `.github/workflows/` | open |
| 20 | G5 (QA Ready) and G6 (user confirms the deploy) for the release | QA lane, user | CLAUDE.md §2 | not started |

### 2.3 Data migration from the old system

The cards plan one (BE-28 reference/identity/classes, BE-29 activity/wallet/content, BE-30 reconcile, rehearsal,
delta run, rollback). Verified state: BE-27, BE-34, BE-35 (staging, kit, anonymiser) merged; BE-28 on a branch with
1 failing test (§2.1 #4), BE-29 WIP draft PR #82, **BE-30 not started**; OD-10 (migration questions) unanswered;
`docs/qa/v2-test-strategy.md` requires a green rehearsal, a tested rollback, a freeze plan and a rehearsed delta
run before a go-live with migration.

**This cannot be ready by 30 Oct as planned.** Whether the 30 Oct go-live needs migrated accounts at all is open
decision D-3. If it does, it is the largest blocker on this list (owner A, PC-4).

---

## 3. Production environment checklist

### 3.1 Env vars per service (names only; values only in the platform dashboard or the operator's shell)

**API** (`apps/api/src/common/config/env.schema.ts`, `.env.api.example`, `render.yaml`):

| Var | Rule for production |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | secret; runtime uses `sslmode=verify-full` + CA file (fallback `no-verify`) on Supabase; Prisma migrate uses `sslmode=require` |
| `SESSION_SECRET` | secret, required, 32+ chars (schema minimum 16), not `change-me` |
| `IC_HASH_KEY` | secret, required, 32+ chars, differs from `SESSION_SECRET`; **never rotate** without recomputing every `ic_hash` |
| `FILE_STORAGE_DIR` | required, absolute, on persistent storage |
| `COOKIE_SECURE` | `true` |
| `COOKIE_DOMAIN` | unset (host-only cookie on the SPA host) unless D-2 says otherwise |
| `SESSION_COOKIE_NAME` | default `pp_session` |
| `PUBLIC_BASE_URL`, `PUBLIC_ORIGINS` | the production URLs; an empty `PUBLIC_BASE_URL` fails the boot |
| `TRUST_PROXY_HOPS` | measured per topology (1 compose+nginx; 2 assumed on Render+Pages, **unverified**, see §2.1 #6) |
| `ALLOW_DEMO_SEED` | `false` |
| `BIJAK_POC_QUESTIONS` | `false` |
| `MAIL_LOG_RESET_LINKS` | not `true` (boot fails) |
| `JOBS_WORKER_ENABLED` | `true` on exactly one instance (intake jobs) |
| `OCR_ENGINE` | `none` by default (scanned pages fail `OCR_UNAVAILABLE`); `tesseract` needs `OCR_LANG_DIR` |
| `LOG_LEVEL`, `PORT` | `info`; `PORT` injected by the platform |
| `REQUEST_TIMEOUT_MS`, `HEADERS_TIMEOUT_MS`, `KEEP_ALIVE_TIMEOUT_MS`, `SHUTDOWN_GRACE_MS`, `METRICS_ENABLED`, `METRICS_INTERNAL_CIDRS` | new with #81 (optional, defaults in #81) |
| `THROTTLE_*`, `LOGIN_*`, `INTAKE_*`, `OCR_*`, `JOBS_*`, `BIJAK_SWEEP_INTERVAL_SECONDS` | defaults unless OQ1 changes them (§2.2 #11). Throttle counters are per process: run **one** API instance or accept uncoordinated limits |
| AI provider vars (BE-36) | arrive with #86; names per that PR; provider choice is OD-14 (D-5) |

**SPA build** (Pages or `docker/frontend`): `VITE_API_MODE=http` (unset silently falls back to the mock),
`VITE_API_BASE_URL` empty (same origin), `VITE_TEST_HOOKS=false`, `VITE_PROTOTYPE_SCOPE` (confirm it does not hide
the Admin Pusat publish screen), `NODE_VERSION`. There is no `.env.production` in the repo.

**Pages Function / worker:** `API_ORIGIN` (fails closed with 500 if unset). If the DevOps edge fix adds a shared
proxy secret (proposed `PROXY_SHARED_SECRET` in #81), it is a secret on both sides — **unverified** until that
branch lands.

**DB (compose path):** `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` (`.env.db`, git-ignored).

**Seed only:** `SEED_DEMO_PASSWORD_HASH` (never set in production).
**Migration tooling only:** `PP_ALLOW_MIGRATE_APPLY`, `PP_MIGRATE_TARGET_DB`, `CLOUD_SOURCE_URL`, `ANON_HMAC_KEY` /
`ANON_HMAC_KEY_FILE`, `PP_ALLOW_STAGING_RESET`, `PP_STAGING_DB_ALLOWLIST`.

### 3.2 Secrets handling
- [ ] Secrets only in platform dashboards / operator shell; `.env.api` and `.env.db` stay git-ignored.
- [ ] Production `SESSION_SECRET` and `IC_HASH_KEY` are new values, not the demo ones (unverified whether the demo
      values were ever shared).
- [ ] Demo DB password and Render `DATABASE_URL` rotated together (§2.2 #12).
- [ ] gitleaks green on the release SHA (CI `secret-scan` job, full history).
- [ ] Supabase: Data API off and `scripts/supabase/lockdown-data-api.sql` run (anon/authenticated grants = 0).

### 3.3 Migration path
- [ ] Apply `0001` → latest with `prisma migrate deploy` (compose: one-shot `migrate` service; Render: from a
      laptop checkout of the release SHA with `npm run be:db:migrate`, because the free Render image has no
      Prisma CLI and no pre-deploy hook).
- [ ] **0024 is never used** (it would sort below applied migrations); 0016 is also unused. Gaps are normal; do
      not "fix" them.
- [ ] After the queue merges the set is expected to be: base `0001`–`0015`, `0017`–`0023`, `0026`, `0030`, plus
      `0025` (#73), `0027` (#71), `0033` (#72), `0034` (#83), `0037` (#86), `0038` (#85) if those merge;
      `0028`/`0031`/`0032` only if BE-42/BE-46 merge. Expected `_prisma_migrations` count = number of folders at
      the release SHA (not the highest number).
- [ ] Forward-only: `pg_dump -Fc` immediately before the migrating deploy.
- [ ] `npm run be:lint:migration` green on the release SHA.

### 3.4 Seeds
- [ ] **No PoC profile in production.** Run the seed with `ALLOW_DEMO_SEED` unset: only `kind:'reference'`
      modules run (`core-school-packages`, plus `spm-subject-configs` if #73 merges).
- [ ] Guard fail-closed: with #80 and #74 merged, production refuses demo seeding and `--force-demo` needs
      `ALLOW_DEMO_SEED=true` as well (two keys). Until they merge, only `ALLOW_DEMO_SEED` guards it.
- [ ] `BIJAK_POC_QUESTIONS=false`, so no reserved PoC question ids are served. Real papers come from the
      Admin Pusat intake and builder — **unverified** who loads the real launch papers and when (D-6).

### 3.5 CORS, CSP, cookies
- [ ] **CORS:** none configured; the design is same-origin (`/api` proxied by the Pages Function or the
      frontend nginx). Keep it same-origin; do not add CORS.
- [ ] **API headers** (`common/security/security-headers.ts`): nosniff, `X-Frame-Options: DENY`,
      `Referrer-Policy: no-referrer`, COOP `same-origin`, CORP `same-site`, CSP `default-src 'none'; frame-ancestors 'none'`,
      HSTS in production.
- [ ] **SPA CSP:** none set in `docker/frontend/nginx.conf`; no Pages `_headers` file found. Decide whether to add one
      (D-7); unverified whether live has one.
- [ ] **Cookie:** HttpOnly, SameSite=Lax, Secure (`COOKIE_SECURE=true`), CSRF via `X-CSRF-Token`; no token in
      bodies (#81 `cookies-and-tokens.spec.ts`).
- [ ] `/api` responses carry `cache-control: no-store` through the edge (§2.1 #7).
- [ ] `/api/metrics` not reachable from outside (#81 rule + nginx 404 line).

---

## 4. Go-live runbook

Pre-conditions: every item in §2 closed or explicitly waived by the LEAD and the user; G4 and G5 passed on the
release SHA; the user has confirmed the deploy (G6).

### 4.1 Order of steps
1. **Freeze.** LEAD tags the release SHA on `feature/v2-backend`; no merges after the tag.
2. **Verify the SHA.** `npm ci && npm run be:verify` (only the 5 known local failures), `npm run be:build`,
   `npm run conformance:api`, `contract:check`, frontend `npm run verify`, gitleaks.
3. **Backup.** `pg_dump -Fc` of the target DB with a `.sha256` sidecar, stored off the host, outside the repo.
   Record the current API commit and SPA deployment id as rollback points.
4. **Migrate.** `npm run be:db:migrate` against the production DB from a checkout of the release SHA. Check the
   `_prisma_migrations` count (§3.3).
5. **Reference seed.** `npm run be:db:seed` with `ALLOW_DEMO_SEED` unset. Check that only reference modules ran.
6. **Data migration** (only if D-3 says yes): BE-30 orchestrator, reconcile report green, delta run in the freeze
   window. Not buildable from the repo today.
7. **Deploy the API** at the release SHA, with the env in §3.1. Wait for `/api/health` (and `/api/ready` once #81 is
   in) to return 200.
8. **Deploy the SPA** built from the same SHA (`VITE_API_MODE=http`), bundle check passing.
9. **Smoke** (§4.2).
10. **Load the launch content** (D-6) and publish through Admin Pusat.
11. **Go/no-go** (§4.3), then open access.

### 4.2 Smoke steps
`scripts/demo-smoke.sh` against the production URL with `EXPECT_SECURE=1`, using a production smoke account (the
script expects demo accounts and `DEMO_PASSWORD`; production smoke accounts are **unverified / to be created**):
1. Static site and `/api` proxy; `cache-control: no-store` on `/api`.
2. Student login; CSRF 403 without the header; session cookie flags (HttpOnly, Secure, SameSite=Lax).
3. Bijak SPM: list papers, start, autosave, submit, result, history.
4. Admin Pusat: Pembina Kertas, publish; the student then sees the paper; Mod Pelajar.
5. Client-address check: 6th failed login from one client gets 429; a second network is not locked out.

Manual extras (`docs/ops/deploy-execution.md` §5): upload under the limit works; over 22 MB gives 413; teacher and
school admin see the student's Bijak result (US-33).

### 4.3 Go / no-go criteria
**Go** only if all hold:
- Smoke 100% pass (no "known" failures carried over from the demo).
- `/api/health` (and `/api/ready`) 200; no 5xx in the API logs during smoke.
- Migration count matches; no demo accounts (`@demo.test`, `@example.test`) in the production DB.
- Backup taken and its restore check passed in the last drill.
- Uptime monitor and alerting active (§2.2 #15); error tracking per D-4.
- No open Critical/High from QA or security; the 7 cross-lane gaps closed or waived in writing by the LEAD.

**No-go** on any failure of the above, or if the data reconciliation (if D-3 = yes) is not green.

### 4.4 Rollback
- **SPA:** promote the previous Pages deployment (or redeploy the previous frontend image).
- **API:** redeploy the previous commit (Render: deploy specific commit; compose: previous image tag).
- **DB:** migrations are forward-only. If the release migrated, restore the step-3 dump into a fresh database and
  point `DATABASE_URL` at it, or restore over the target in a maintenance window. Any writes made after the
  dump are lost; say so in the go/no-go decision.
- **Data migration:** BE-30 plans rollback by dropping the target schema (not built).
- After rollback: re-run smoke against the old version and record the incident in the tracker.

---

## 5. Open decisions

| # | Decision | For |
|---|---|---|
| D-1 | Exact module and route scope of the 30 Oct go-live (is it only M28 + identity + teacher/school views + Admin Pusat intake/builder? are M06 SPM hub, leaderboard, games, battle in?) | user + LEAD |
| D-2 | Production hosting: the free tiers are unfit (sleeping API, ephemeral upload disk, DB pause, backups). Paid Render + Supabase with backups, or the VPS compose path? Who pays, which region | user |
| D-3 | Does go-live need migrated users/schools/history from the old system? If yes, BE-28/29/30 and OD-10 are critical-path and 30 Oct is at risk | user + LEAD |
| D-4 | Error tracking (Sentry or none) and who receives alerts | user + LEAD |
| D-5 | AI provider for intake in production (OD-14), region, monthly cap; or launch with intake on the mock provider and papers built by hand | user |
| D-6 | Who loads the real launch papers and question content, and by when | user + LEAD |
| D-7 | SPA Content-Security-Policy: add one or replicate live (no CSP) | LEAD |
| D-8 | BE-33 OQ1 rate-limit numbers and OQ2 metrics access rule | LEAD |
| D-9 | Single API instance (per-process throttles) or a shared throttle store before scaling | LEAD |
| D-10 | Backup cadence, retention, storage location, and the monthly restore drill owner | user + LEAD |
| D-11 | Migration numbers 0037 (BE-36) and 0038 (BE-38) | LEAD |
| D-12 | Password-reset by e-mail is out of B1 (links are only logged in dev). Is that acceptable for launch, and what is the support path for a forgotten password? | user |
