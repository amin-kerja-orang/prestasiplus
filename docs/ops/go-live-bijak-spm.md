# Go-live readiness checklist: Bijak SPM

Status read on 2026-10-21 (~12:40Z) from the repo at **`feature/v2-backend` @ `2be3b5f6`**, and from the GitHub PRs
and issues named below. `2be3b5f6` is `lead/merge-final` @ `4b4e2ea7` (fast-forward) plus a tracker commit. It brings
#86 BE-36 (`0037`), #85 BE-38 (`0038`), #90 + #93 (PoC question pool), #92 BE-12, #88, BE-28, BE-42 (`0028`, `0031`),
BE-46 (`0032`), the BE-33 log PII redaction and the BE-33 audit-gap docs/tests (#67 LEAD comment 12:24Z).

## Needs a decision

These three block planning. Details and the other decisions are in §5.

| # | Decision | Why it blocks | For |
|---|---|---|---|
| **D-1** | **Go-live scope.** Exactly which modules and routes go live on 30 Oct. | Decides whether games, battle, the SPM hub and leaderboard are blockers (§2.1 #10). | user + LEAD (owner: Amin) |
| **D-2** | **Hosting.** Paid Render + Supabase with backups, or the VPS compose path. | The free tiers are unfit for production (§2.2 #20). Nothing in §3–4 can run until it is chosen. | user |
| **D-3** | **Data migration from the old system.** Is it needed at go-live? | If yes, BE-28/29/30 and OD-10 are on the critical path and 30 Oct is at risk (§2.3). | user + LEAD |

Timeline, from the merge queue (#67 comment of 2026-10-21 07:09Z):

| Date | Milestone |
|---|---|
| 23 Oct | full demo |
| **25 Oct** | **ready for full testing** |
| **30 Oct** | **go-live** |

These dates are not recorded anywhere else in the repo.

**Legend**
- **verified:** read in the repo or on the named PR or issue.
- **unverified:** could not be checked from the repo. Examples: platform dashboards, someone's local state, a plan stated only in a brief or a review comment.

No secret values appear here. Env vars are named only.

**Sources**
- Repo: `docs/ops/**`, `render.yaml`, `functions/`, `docker/**`, `compose*.yaml`, `scripts/**`, `.github/workflows/**`.
- Plans and docs: `docs/plan/AGENT-SYNC.md` (HANDOFF 2026-10-21 ~09:30), `docs/plan/backend-tracker.md`, `docs/plan/backend-tasks/**`, `docs/TRACKER.md`, `docs/requirements/v2-bijak-spm.md`.
- GitHub: PRs #81, #85, #86, #88, #89, #90, #91, #92, #93, #102 and #103; gap issues #94–#100; backlog #78; the merge queue #67 (including the Group B update of 2026-10-21 08:30Z, the gap summary of 11:03Z, the demo rehearsal of 11:50Z and the LEAD close-out of 12:24Z); and the reviews on #87.
- **Demo rehearsal and deploy checklist:** [#67 comment 6315200981](https://github.com/amin-kerja-orang/prestasiplus/issues/67#issuecomment-6315200981) (11:50Z), section "Deploy checklist for the user (after G6; names only, no values)". That checklist is for the 23 Oct demo deploy (Render + Pages, PoC seed), not for production (§4).
- The deploy files are `render.yaml`, `functions/` and `docker/`. `deploy/pages-direct/` is on the tip (#89).

---

## 1. Scope of the Bijak SPM go-live

### What it is

Verified from `docs/TRACKER.md` D32 and `docs/requirements/v2-bijak-spm.md`:
- One product that merges the old .my SPM Mock and the .cloud Simulasi.
- Two ways to start: Kertas Pilihan and Jana Kertas.
- Two modes: Mod Peperiksaan and Mod Latihan.
- Admin Pusat builds and publishes the papers ("Kertas & SPM", D52).
- Teachers and school admins see the results (US-33). Per D43, teachers have no Bijak screen of their own.

**Unverified:** no document names the exact module list for the 30 Oct go-live. The list below uses the working
definition from `docs/plan/AGENT-SYNC.md`, which has three demo objectives:
1. the student Bijak flow;
2. teacher and school visibility of Bijak results;
3. Admin Pusat publish.

It also includes the identity cards those depend on. The LEAD confirms the list (open decision D-1).

### Routes

Verified in `src/modules/m28-bijak-spm/routes.ts`:
- `/spm/bijak`
- `/spm/bijak/sejarah`
- `/spm/bijak/kertas/:paperId`
- `/spm/bijak/percubaan/:attemptId`
- `/spm/bijak/percubaan/:attemptId/keputusan`

The Admin Pusat paper builder and the intake screens are in the Admin Pusat portal. Login, `/api/me`, role switch
and Mod Pelajar come from M01/M02.

### Modules and cards

Merged means merged into `feature/v2-backend` @ `2be3b5f6`.

| Area | Module | Card(s) | State |
|---|---|---|---|
| Identity, sessions, roles, CSRF | M01/M02 | BE-01..BE-07, BE-24, BE-25 | **merged** |
| Curriculum | M03 | BE-08 | **merged** |
| Question bank | M04 | BE-09, BE-10 | **merged** |
| Practice write/read, US-33 aggregate | M05 | BE-11, BE-12, BE-13 | **merged**. The practice question source is wired (#92, BE-12). Random mode serves levels D1–D4 only, and the PoC pool has T4/T5 rows only, so a `random` start on the PoC seed still returns 422 (§2.1 #14, #16a). |
| Bijak papers, attempts, Kontrak Blueprint, paper builder | M28 | BE-14, BE-15, BE-16, BE-39 | **merged** |
| Teacher views, reports | M10/M19 | BE-17, BE-18, BE-19, BE-20 | **merged** |
| School admin (results visibility) | M27 | BE-21 | **merged**. Tracker row `done`, full card merged @ `12117a2f`. AC#13 doc fix `docs/BE-21-ac13-contract` @ `0ca65e73` is also on the tip (§2.1 #13). |
| Command Center / admin dashboard | M17 | BE-22 | **merged** (#69) |
| AI intake: files, OCR, job runner; dashboard and budget | Admin Pusat | BE-37, BE-40 | **merged** |
| AI extraction service | Admin Pusat | BE-36 | **merged** (#86 @ `c4793dfc`, via `lead/merge-final`; migration `0037_ai_extraction`) |
| Intake workflow (batches, review, accept to Draf) | Admin Pusat | BE-38 | **merged** (#85 @ `621b5a61`, via `lead/merge-final`; migration `0038_intake_workflow`). Sends redacted OCR text only, never page images (LEAD decision (c), 2026-10-21). The single-redactor follow-up (#85, #78) is closed by #189: BE-36's service redacts once, and nothing but OCR text reaches the provider. |
| Security hardening, `/api/ready`, `/api/metrics`, runbook | cross-cutting | BE-33 rest | **merged** (#81). `docs/ops/api-runbook.md` §15 is the release gate. |
| Log PII redaction | cross-cutting | BE-33 part | **merged** (`521a6756`, via `lead/merge-final`, no PR) |
| Seed guard fail-closed, PoC seed profile | seed | #80, BE-26 (#74) | **merged** |
| Edge client IP + worker no-store | ops | #89, #91 | **merged** (#89 @ `29c9cf67`; #91 trims the secret and logs a production boot warning). `deploy/pages-direct/_worker.js` is on the tip. (§2.1 #6) |
| HTTP switch, e2e against the real API | frontend | BE-32 | **partly merged**. PC-1 part merged 2026-10-20. Still open: AC3 `@api` e2e, the `/login` mobile re-measure, the 413 envelope and frontend AC7 (LEAD). |
| Frontend in http mode | frontend | `be/integration-frontend` @ `d909e1e0` | **not merged** into `feature/v2-backend`. The demo Pages build is made from it. How it reaches production is **unverified**. Check the FE/API SHA pair per `docs/ops/staging-refresh-2.md` §0. |
| Old-system data migration | PC-4 | BE-27, BE-28, BE-34, BE-35 merged; BE-29 (draft #82) and BE-30 **not merged / not built** | see §2.3 |

**Adjacent cards.** These are not needed for Bijak SPM unless the LEAD says so (D-1).
- **Merged:** #73 BE-41 SPM hub M06 (0025), #77 BE-23 leaderboard privacy, #71 BE-44 battle (0027), #72 BE-45 games (0033), #83 BE-47 Keluarga Angkat (0034).
- **Merged via `lead/merge-final` (no PR):** BE-42 PKSK (`ec74b76d`, 0028 + 0031), BE-46 marketplace (`97766959`, 0032).
- **Not merged:** frontend `fe/m18-amaran-summary` (see §2.1).

---

## 2. Blocking items

Owner lanes:
- **A** = Group A (the LEAD's PC lanes)
- **B** = Group B
- **LEAD**
- **user**

### 2.1 By 25 Oct (full testing starts)

| # | Item | Owner | Link | State |
|---|---|---|---|---|
| 1 | Fast-forward `feature/v2-backend` past `lead/merge-b5` (#77 + #69 + #71) | LEAD | #67 | **done** (in `3d0b1271`) |
| 2 | Merge the approved Group B queue: #81, #80, #74, #73, #72, #83 | LEAD | #67 | **done** (in `3d0b1271`) |
| 3 | G4 verdict and merge of BE-38 and BE-36; confirm migrations 0037 and 0038 | B (review), LEAD (merge, numbers) | #85, #86 | **done**: #85 (G4 re-review Approve 09:42Z; head `621b5a61`) and #86 (re-review Approve with minors 11:01Z; head `c4793dfc`) merged via `lead/merge-final` @ `4b4e2ea7`, with `0037` and `0038`. Follow-up: BE-38 uses BE-36's redactor (#85, #78; Group B, not blocking). |
| 4 | Group A test failures (BE-42, BE-28), all test-side | A | #67 LEAD comment 12:24Z | **done**: fixes `ec74b76d` (BE-42) and `06538cba` (BE-28) merged via `lead/merge-final`; full be:verify green on `3d94e291`, targeted run green on `4b4e2ea7` (LEAD). |
| 5 | Merge the log PII redaction branch (`be/BE-33-log-pii-redaction` @ `521a6756`) | A / LEAD | #67 | **done** (via `lead/merge-final`) |
| 6 | **Login throttle behind Cloudflare and worker `cache-control: no-store`.** The demo smoke saw 6 spoofed attempts, all 401, none 429, and no `no-store` on proxied `/api`. Fixed by #89 (merged). Remaining (user): set both vars on Render and the secret on Pages, then check there is no ClientIp boot warning after the first request through the edge (#91). | user (Render and Pages secrets); B (DevOps) re-runs smoke step 5 | #89, #91, #81 | code merged; platform settings pending (**unverified**) |
| 7 | **BE-32 `/login` mobile re-measure on real API data.** Pass needs all of these: horizontal overflow 0, the stat chip's right edge ≤ the viewport, `isMobile: true` at 320 and 375, and a sample taken for 3 s after the chip is visible. Then remove `TODO(d4)` in `e2e/api/helpers.ts` (on `be/integration-frontend`) and re-run the 6 mobile `@api` specs. That closes BE-32. | LEAD | `docs/plan/AGENT-SYNC.md` HANDOFF, `docs/ops/staging-refresh-2.md` §5 (iv) | open |
| 8 | Decide how `be/integration-frontend` reaches the go-live build | LEAD | `docs/plan/AGENT-SYNC.md` | open (**unverified** plan) |
| 9 | Refresh the test environment to the merged tip (`docs/ops/staging-refresh-2.md`, never executed) | B (DevOps) | — | **blockers cleared** at `3d0b1271` (#76 fixed via #77; BE-19 full and BE-21 full merged); **waiting for the user's go (G6)** |
| 10 | 5 permainan solo rosak dalam mod http — keputusan skop go-live menunggu pemilik (Amin); bukan blocker Bijak SPM jika di luar skop. | LEAD (D-1) | LEAD review on #87, #78, #102 | open. The LEAD pushed a D58 stopgap to `be/integration-frontend` @ `d909e1e0` (solo games show "belum tersedia dalam demo" in http mode). **#102** (draft, head `70ad8f53`, same purpose) is still open and is not in that branch; LEAD to close or merge one. |
| 11 | M18 S23/S21 `fe/m18-amaran-summary` @ `f20e6c80` | A (FE) | `docs/plan/AGENT-SYNC.md` HANDOFF | review APPROVE; not merged; e2e WIP |
| 12 | BE-46 marketplace `be/BE-46-marketplace` @ `97766959` (migration 0032) | A | `docs/plan/AGENT-SYNC.md` HANDOFF | **merged** (via `lead/merge-final`). Out of Bijak scope unless D-1 says otherwise. |
| 13 | BE-21 AC#13 doc fix `docs/BE-21-ac13-contract` @ `0ca65e73` | A | — | **done**: `0ca65e73` is an ancestor of the tip (merged with BE-21 full, before `54ae851d`) |
| 14 | **Demo blocker (23 Oct): practice cannot start.** `POST /api/practice/sessions` always returns 422 `NOT_ENOUGH_QUESTIONS`, because `PracticePorts.provideQuestions` is still the `NoPracticeQuestions` placeholder and is not wired to the BE-09 bank. | B (Developer 3, BE-12 / PC-2) | #92, #103, #88 | **merged**: #92 (`c02f7274`) via `lead/merge-final`. Follow-up **#103** (#92 nits, head `0c234cf0`) is open, ready for G4, but its base is the merged `be/BE-12-practice-question-source`, so it needs a retarget. Remaining demo gap: see #16a. |
| 15 | **Demo blocker (23 Oct): PoC question pool.** Battle quick-match answers 422 on the PoC seed (at most 3 published MCQs per subject at Tingkatan 4; battle needs 10). #90 adds 480 PoC-only MCQs (24 per subject per level, 10 subjects). Seed data only; production stays guarded by `ALLOW_DEMO_SEED`. | B (DevOps) | #90, #93 | **merged** via `lead/merge-final` (#90 `e684c054` and follow-up #93 `172f05a2`, both closed by hand by the LEAD). |
| 16 | **Full-demo walkthrough script** (`scripts/demo-walkthrough.sh`). It found #14 and #15. | B (DevOps) | #88 | **merged** (`3b1a2796`: writes off by default, `CONFIRM_WRITES=1` to write, STRICT on). |
| 16a | **Demo rehearsal (23 Oct).** `be/demo-rehearsal-23oct` @ `917a152b` (rehearsal only, not for merge): `demo-walkthrough.sh` **112 PASS / 1 FAIL / 0 SKIP**; `demo-smoke.sh` 25/3 (the 3 need the Pages layer); `edge-worker` test 15/15; be:verify green apart from the 5 known local failures and 1 intermittent `test/games/solo/solo.spec.ts`. The 1 FAIL: the walkthrough starts practice in `random` mode, which serves D1–D4 only, and the PoC pool has T4/T5 rows only, so 422 `NOT_ENOUGH_QUESTIONS`. With `past_year` it is 115/0/0. | B (DevOps, #88: use `past_year` or `latih_tubi`); #90 owner if the demo must show random/chapter (needs D1–D4 pool rows) | [#67 comment 6315200981](https://github.com/amin-kerja-orang/prestasiplus/issues/67#issuecomment-6315200981) | open (one-line script change) |
| 16b | **Demo deploy checklist** (user, after G6): Render commit, Render env names, DB reset or delta (0030 → 0038), Pages edge secret + `_worker.js` re-upload, then smoke + read-only walkthrough. | user; B (DevOps) | [#67 comment 6315200981](https://github.com/amin-kerja-orang/prestasiplus/issues/67#issuecomment-6315200981), section "Deploy checklist for the user" | waiting for the user's go (G6). Its commit (`917a152b`) predates the merge; the matching tip commit is `2be3b5f6`, which also has BE-28/42/46 (0028, 0031, 0032), so the delta is longer than listed there (**unverified** against a deploy). |

Item 4 failures in detail:
- **BE-42 (2 failures), fixed in `ec74b76d`:**
  - `pksk-db.spec.ts`: list order (the spec now advances the fixed clock).
  - `migratable-double-upsert`: `pksk_packages` check constraint (fixture added).
- **BE-28 (1 failure), fixed in `06538cba`:** `core.db.spec.ts` duplicate rejects (the query is now scoped to the apply run).
- Both fixes are merged; the full be:verify on `lead/merge-final` @ `3d94e291` is green (LEAD, #67 12:24Z).

Item 10, the five games broken in http mode: betul-salah, cabaran-kilat, tembak-jawapan, susun-jawapan, kad-memori.
- If games are in the go-live scope, this is a blocker.
- Otherwise the LEAD writes "games out of scope for go-live".

### 2.2 By 30 Oct (go-live)

| # | Item | Owner | Link | State |
|---|---|---|---|---|
| 17 | **The 7 cross-lane gaps from #81.** The release gate is blocked until they close. Each gap is an `it.fails` test on the tip that goes red once it is fixed. | owners below | #81, #94–#100, [#67 gap summary](https://github.com/amin-kerja-orang/prestasiplus/issues/67#issuecomment-6314364599) | **filed as #94–#100**, all open; `it.fails` markers still on the tip. **Blockers: #94, #95, #96** (Major). #97–#100 are Minor (a non-strict body: the extra field has no effect). Patch hunks for gaps 1–3: `docs/qa/BE-33-audit-gaps.patch` (not applied); close-out: `docs/qa/BE-33-audit-coverage.md`. LEAD to decide whether #97–#100 are go-live exceptions (#78); if yes, the release gate waits only on #94–#96. |
| 18 | Confirm BE-33 OQ1 (rate-limit numbers) and OQ2 (metrics access rule) | LEAD | #81 | open |
| 19 | **Rotate the demo DB password and Render `DATABASE_URL` together.** Do it in one change window: set a new Supabase password, then the Render secret, then redeploy, then check `/api/ready` and run the smoke. Rotation steps in general: `docs/ops/api-runbook.md` §13. Why and when this was decided is **unverified**. | user (dashboards), B (DevOps) | — | open |
| 20 | **Choose and provision the production environment.** See the note below the table. | user + LEAD (D-2) | `docs/ops/deploy-execution.md` §8, `docs/ops/deploy-staging.md` | open |
| 21 | **Backups and restore test.** See the note below the table. | B (DevOps), user (schedule, storage) | `docs/ops/db-backup.md`, `docs/ops/api-runbook.md` §10, #81 | open |
| 22 | **Monitoring and alerts.** `GET /api/health`, `GET /api/ready` and `GET /api/metrics` exist on the tip (#81). There is no uptime monitor on `/api/ready`, no alert rules and no failed-backup alert in the repo. | B (DevOps) | `docs/ops/api-runbook.md` §4–5 | open |
| 23 | **Sentry / error tracking:** nothing in the repo (no SDK, no DSN env var). Decide yes or no. Yes means new work and a new env var. | user + LEAD (D-4) | — | not started |
| 24 | Image and CI checks. See the note below the table. | LEAD / B (DevOps) | #81 "Needs LEAD / ops" | open (**unverified** whether any were done after the merge) |
| 25 | Load smoke. k6 is suggested before G6; no card owns it. | LEAD to assign | `docs/qa/v2-test-strategy.md` OQ-TS-3 | not started |
| 26 | Add a frontend CI workflow (`npm run verify` is not in GitHub Actions) and a deploy workflow (there is none) | LEAD | `.github/workflows/` | open |
| 27 | G5 (QA Ready) and G6 (the user confirms the deploy) for the release | QA lane, user | CLAUDE.md §2 | not started |

Item 17, the 7 gaps and their owners:

| Gap | Issue | Card | Lane | Go-live |
|---|---|---|---|---|
| 1. Role-switch and mode audit rows have null `target_type`/`target_id` | #94 | BE-03 | A (PC-1) | **blocker** (Major) |
| 2. Password-reset audit rows have null actor fields | #95 | BE-06 | A (PC-1) | **blocker** (Major) |
| 3. Bulk action writes no status events and has a null `scope_level`. The fix also touches BE-09's `questions.service.ts`. | #96 | BE-10 + BE-09 | B (PC-5 + PC-2) | **blocker** (Major) |
| 4. `POST /admin-sekolah/guru` is non-strict | #97 | BE-21 | A (PC-6) | Minor |
| 5. `POST /admin/articles` and `POST /tiket` are non-strict | #98 | BE-24 | A (PC-1) | Minor |
| 6. `POST /me/notifications/bulk-read` and `POST /auth/register` are non-strict | #99 | BE-06 | A (PC-1) | Minor |
| 7. `POST /practice/sessions` is non-strict | #100 | BE-12 | B (PC-2) | Minor |

Item 20, why the current environments are not enough: the repo documents only the free-tier demo and a VPS
compose path.
- Render free sleeps and has an ephemeral disk, so uploads vanish on restart.
- Supabase free pauses after 7 idle days, and the docs describe its backup coverage in two different ways.

Item 21, what exists and what is missing:
- `npm run db:backup` and `npm run db:restore-check` exist for the compose `db`.
- Scheduling is manual.
- Uploaded files (`apifiles` volume) are not in the dump.
- For Supabase, only a manual `pg_dump -Fc` is documented.
- The AC7 drill ran locally only (141 tables, 0 mismatches, #81). No compose or production drill has run.
- Since `d6cd5d11`, `scripts/db-restore-check.mjs` compares the exact row count of every table. This is untested until the cloud run.
- `docs/ops/api-runbook.md` §10 now has the AC7 rehearsal steps ("AC7 rehearsal (run once in the cloud session)").

Item 24, the checks still open:
- Run the image read-only and do a boot smoke.
- Prove `deps-audit` goes red on a throw-away branch with a vulnerable dependency.
- Pin Trivy and dependency-review by SHA.
- Set `stop_grace_period: 30s`.
- Add the nginx line `location = /api/metrics { return 404; }`.

### 2.3 Data migration from the old system

The cards plan one:
- **BE-28:** reference data, identity and classes.
- **BE-29:** activity, wallet and content.
- **BE-30:** reconciliation, rehearsal, delta run and rollback.

Verified state:

| Card | State |
|---|---|
| BE-27, BE-34, BE-35 (staging, kit, anonymiser) | merged |
| BE-28 | **merged** via `lead/merge-final` (`06538cba`, no PR; tracker `done`) |
| BE-29 | WIP, draft PR #82 (not in `lead/merge-final`; migration `0035` reserved) |
| BE-30 | **not started** (migration `0036` reserved) |
| OD-10 (migration questions) | unanswered |

Before a go-live with migration, `docs/qa/v2-test-strategy.md` requires all of these:
- a green rehearsal;
- a tested rollback;
- a freeze plan;
- a rehearsed delta run.

**This cannot be ready by 30 Oct as planned.** Open decision D-3 is whether the 30 Oct go-live needs migrated
accounts at all. If it does, this is the largest blocker on the list (owner A, PC-4).

---

## 3. Production environment checklist

### 3.1 Env vars per service

Names only. Values live only in the platform dashboard or the operator's shell. The canonical list is
`docs/ops/api-runbook.md` §2 and `apps/api/src/common/config/env.schema.ts`.

**API** (`env.schema.ts`, `.env.api.example`, `render.yaml`):

| Var | Rule for production |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Secret. On Supabase the runtime uses `sslmode=verify-full` with a CA file (fallback `no-verify`). Prisma migrate uses `sslmode=require`. |
| `SESSION_SECRET` | Secret, required, 32+ chars (the schema minimum is 16), not `change-me` |
| `IC_HASH_KEY` | Secret, required, 32+ chars, different from `SESSION_SECRET`. **Never rotate** without recomputing every `ic_hash`. |
| `FILE_STORAGE_DIR` | Required, absolute, on persistent storage |
| `COOKIE_SECURE` | `true` |
| `COOKIE_DOMAIN` | Unset (host-only cookie on the SPA host), unless D-2 says otherwise |
| `SESSION_COOKIE_NAME` | Default `pp_session` |
| `PUBLIC_BASE_URL`, `PUBLIC_ORIGINS` | The production URLs. An empty `PUBLIC_BASE_URL` fails the boot. |
| `TRUST_PROXY_HOPS` | Measured per topology: 1 for compose + nginx; 2 assumed on Render + Pages. Behind the Cloudflare edge, use #89's header instead (next row). |
| `CLIENT_IP_HEADER`, `EDGE_PROXY_SECRET` | Added by #89 (merged). `CLIENT_IP_HEADER` requires `EDGE_PROXY_SECRET` (`env.schema.ts`). In production the API logs one boot warning if `TRUST_PROXY_HOPS` > 0 and either var is unset (#91). The secret is trimmed; a whitespace-only value counts as unset. `CLIENT_IP_HEADER=x-pp-client-ip` (API only). `EDGE_PROXY_SECRET` is a secret of 32+ chars on both the API and Pages, with the same value; the worker sends it as `X-PP-Edge-Secret`. A shorter secret fails the boot. Leave both empty for the old behaviour. **Rollout:** Pages first (secret, then re-upload the build with the new `_worker.js`), then Render (both vars, redeploy). **Rollback:** remove `CLIENT_IP_HEADER` on Render and redeploy. Source: #89's section "Edge client IP + no-store (go-live fix)" in `docs/ops/demo-cloudflare-supabase.md`. |
| `ALLOW_DEMO_SEED` | `false` |
| `BIJAK_POC_QUESTIONS` | `false` |
| `MAIL_LOG_RESET_LINKS` | Not `true` (boot fails) |
| `JOBS_WORKER_ENABLED` | `true` on exactly one instance (intake jobs) |
| `OCR_ENGINE` | `none` by default, so scanned pages fail with `OCR_UNAVAILABLE`. `tesseract` needs `OCR_LANG_DIR`. |
| `LOG_LEVEL`, `PORT` | `info`. The platform injects `PORT`. |
| `REQUEST_TIMEOUT_MS`, `HEADERS_TIMEOUT_MS`, `KEEP_ALIVE_TIMEOUT_MS`, `SHUTDOWN_GRACE_MS` | Defaults per `docs/ops/api-runbook.md` |
| `METRICS_ENABLED`, `METRICS_INTERNAL_CIDRS` | In production, `/api/metrics` is admin-only or open to the listed CIDRs (#81) |
| `THROTTLE_*`, `LOGIN_*`, `INTAKE_*`, `OCR_*`, `JOBS_*`, `BIJAK_SWEEP_INTERVAL_SECONDS` | Defaults, unless OQ1 changes them (§2.2 #18). Throttle counters are per process, so either run **one** API instance or accept limits that are not coordinated across instances. |
| `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, `AI_BASE_URL`, `AI_BASE_URL_ALLOWLIST`, `AI_MONTHLY_BUDGET_SEN`, `AI_PRICE_TABLE_JSON`, `AI_TIMEOUT_MS`, `AI_MAX_CONCURRENCY`, `AI_RATE_LIMIT_*`, `AI_MAX_RETRIES`, `AI_RETRY_BASE_MS`, `THROTTLE_AI_*` | BE-36 (#86, merged; `env.schema.ts`, `.env.api.example`). `AI_PROVIDER` defaults to `mock`. `AI_API_KEY` is a secret. A paid provider needs a price entry in `AI_PRICE_TABLE_JSON` and a monthly cap, or it counts as not configured (fail closed). Concurrency and rate limits are per process. The provider receives redacted text only (LEAD decision (c)). The provider choice is OD-14 (D-5). |

**SPA build** (Pages or `docker/frontend`):
- `VITE_API_MODE=http`. If it is unset, the build silently falls back to the mock.
- `VITE_API_BASE_URL` empty (same origin).
- `VITE_TEST_HOOKS=false`.
- `VITE_PROTOTYPE_SCOPE`: confirm it does not hide the Admin Pusat publish screen.
- `NODE_VERSION`.
- There is no `.env.production` in the repo.

**Pages Function / worker:**
- `API_ORIGIN` fails closed with a 500 if unset.
- The worker (`deploy/pages-direct/_worker.js`, #89, on the tip) also needs the edge secret, with the same value as the API's `EDGE_PROXY_SECRET`.

**DB (compose path):** `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` (in `.env.db`, git-ignored).

**Seed only:** `SEED_DEMO_PASSWORD_HASH` (never set in production).

**Migration tooling only:**
- `PP_ALLOW_MIGRATE_APPLY`, `PP_MIGRATE_TARGET_DB`
- `CLOUD_SOURCE_URL`
- `ANON_HMAC_KEY`, `ANON_HMAC_KEY_FILE`
- `PP_ALLOW_STAGING_RESET`, `PP_STAGING_DB_ALLOWLIST`

### 3.2 Secrets handling
- [ ] Secrets live only in platform dashboards or the operator's shell. `.env.api` and `.env.db` stay git-ignored.
- [ ] Production `SESSION_SECRET`, `IC_HASH_KEY` and `EDGE_PROXY_SECRET` are new values, not the demo ones.
- [ ] The demo DB password and Render `DATABASE_URL` are rotated together (§2.2 #19).
- [ ] gitleaks is green on the release SHA (CI `secret-scan` job, full history).
- [ ] Supabase: the Data API is off and `scripts/supabase/lockdown-data-api.sql` has run, so anon and authenticated grants are 0.

### 3.3 Migration path
- [ ] Apply `0001` → latest with `prisma migrate deploy`.
  - Compose: the one-shot `migrate` service runs it.
  - Render: run `npm run be:db:migrate` from a laptop checkout of the release SHA. The free Render image has no Prisma CLI and no pre-deploy hook.
- [ ] **0024 is never used**, because it would sort below the applied migrations. 0016 is also unused. Gaps are normal; do not "fix" them.
- [ ] Present on the tip `2be3b5f6`: `0001`–`0015`, `0017`–`0023`, `0025`–`0028`, `0030`–`0034`, `0037`, `0038` (33 folders). New since `84438c70`: `0028` + `0031` (BE-42), `0032` (BE-46), `0037` (#86), `0038` (#85).
- [ ] Reserved, not on the tip: `0035` BE-29, `0036` BE-30 (#67 LEAD allocation). `0029` is not used.

- [ ] The expected `_prisma_migrations` count is the number of folders at the release SHA, not the highest number.
- [ ] Migrations are forward-only, so take a `pg_dump -Fc` immediately before the migrating deploy.
- [ ] `npm run be:lint:migration` is green on the release SHA.

### 3.4 Seeds
- [ ] **No PoC profile in production.** Run the seed with `ALLOW_DEMO_SEED` unset. Only the `kind:'reference'` modules run: `core-school-packages`, `core-wallet-tiers` (P11-B1: the 4 M14 tiers, without which every student dashboard answers 500), `core-marketplace-categories` and `spm-subject-configs` (`apps/api/prisma/seed/spm-subject-configs.ts`, on the tip since #73).
- [ ] The guard is fail-closed (#80 and #74 merged; `--force-demo` handling is in `apps/api/prisma/seed/index.ts` at the tip): production refuses demo seeding, and `--force-demo` needs `ALLOW_DEMO_SEED=true` as well (two keys). The #90 question pool is PoC-only under the same guard.
- [ ] `BIJAK_POC_QUESTIONS=false`, so the reserved PoC question ids are not served.
- [ ] Real papers come from the Admin Pusat intake and builder. D-6 is decided as B2: legacy .cloud papers are not migrated; K1 draft papers are built from the migrated MCQs by `npm run bijak:k1-drafts` and published by Admin Pusat after review (5.1).

### 3.5 CORS, CSP, cookies
- [ ] **CORS:** none is configured. The design is same-origin: `/api` goes through the Pages Function or worker, or through the frontend nginx. Keep it same-origin and do not add CORS.
- [ ] **API headers** (`common/security/security-headers.ts`):
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: no-referrer`
  - COOP `same-origin`, CORP `same-site`
  - CSP `default-src 'none'; frame-ancestors 'none'`
  - HSTS in production
- [ ] **SPA CSP:** `docker/frontend/nginx.conf` sets none, and no Pages `_headers` file was found. Decide whether to add one (D-7).
- [ ] **Cookie:** HttpOnly, SameSite=Lax, Secure (`COOKIE_SECURE=true`), CSRF via `X-CSRF-Token`, no token in response bodies (#81 `cookies-and-tokens.spec.ts`).
- [ ] `/api` responses carry `cache-control: no-store` through the edge (#89, merged; `deploy/pages-direct/_worker.js` on the tip).
- [ ] `/api/metrics` is not reachable from outside: the #81 rule plus the nginx 404 line (§2.2 #24).

---

## 4. Go-live runbook

### Pre-conditions
- [ ] Every item in §2 is closed, or the LEAD and the user have waived it explicitly.
- [ ] G4 and G5 passed on the release SHA.
- [ ] The user has confirmed the deploy (G6).
- [ ] The release gate in `docs/ops/api-runbook.md` §15 is met.

**Test rules** (from `docs/ops/staging-refresh-2.md` §5, the go/no-go rule of 2026-10-20):
- Run the smoke twice: first against the API host directly (Render), then through the edge (Pages). Passing on the API but failing on the edge means a deploy-config blocker (proxy, cookie or CSRF).
- Run automated e2e with `--workers=1`.
- **Never run automated e2e at the same time as manual UAT or another smoke.** One IP shares the login throttle and the API rate limit, so overlapping runs get 429. A 429 means rerun, not FAIL.

### 4.1 Order of steps
1. **Freeze.** The LEAD tags the release SHA on `feature/v2-backend`. No merges after the tag.
2. **Verify the SHA.** All of these must pass:
   - `npm ci && npm run be:verify`, with only the 5 known local failures;
   - `npm run be:build`, `npm run conformance:api`, `contract:check`;
   - frontend `npm run verify`;
   - gitleaks.
3. **Backup.**
   - Take a `pg_dump -Fc` of the target DB with a `.sha256` sidecar.
   - Store it off the host and outside the repo.
   - Record the current API commit and SPA deployment id as rollback points.
4. **Migrate.** Run `npm run be:db:migrate` against the production DB from a checkout of the release SHA. Check the `_prisma_migrations` count (§3.3).
5. **Reference seed.** Run `npm run be:db:seed` with `ALLOW_DEMO_SEED` unset, and check that only the reference modules ran.
   - Production seeds **before** the API, unlike staging (`staging-refresh-2.md`: migrate → API → seed → Pages).
   - The production seed is reference-only and additive. It does not depend on the API.
   - With it done first, the new API never serves without its reference rows, such as packages and SPM subject configs.
   - Both orders are additive-safe.
6. **Data migration**, only if D-3 says yes: run the BE-30 orchestrator, get a green reconcile report, and do the delta run in the freeze window. This cannot be built from the repo today.
7. **Deploy the API** at the release SHA, with the env in §3.1. Wait for `/api/ready` to return 200.
8. **Deploy the SPA** built from the same SHA (`VITE_API_MODE=http`), with the bundle check passing.
9. **Smoke** (§4.2).
10. **Load the launch content** (D-6) and publish it through Admin Pusat.
11. **Go/no-go** (§4.3), then open access.

### 4.2 Smoke steps

Run `scripts/demo-smoke.sh` (or `npm run smoke:bijak`, which is on the FE branch `be/integration-frontend` and not in this tree's `package.json`) with `EXPECT_SECURE=1`:
- once against the API host;
- once against the production URL.

It needs a production smoke account. The script expects demo accounts and `DEMO_PASSWORD`; production smoke
accounts are **unverified / to be created**.

1. Static site and `/api` proxy; `cache-control: no-store` on `/api`.
2. Student login; CSRF 403 without the header; session cookie flags (HttpOnly, Secure, SameSite=Lax).
3. Bijak SPM: list papers, start, autosave, submit, result, history.
4. Admin Pusat: Pembina Kertas and publish (the student then sees the paper); Mod Pelajar.
5. Client-address check: the 6th failed login from one client gets 429, and a second network is not locked out.

The #88 walkthrough (`scripts/demo-walkthrough.sh`, merged) is an API-only companion to the smoke. It does not cover the SPA, the solo games
or the `/login` mobile measure, and with `CONFIRM_WRITES=1` it writes rows, so run writes only on the demo project, never in production.

Manual extras (`docs/ops/deploy-execution.md` §5):
- An upload under the limit works.
- An upload over 22 MB gives 413.
- The teacher and the school admin see the student's Bijak result (US-33).

### 4.3 Go / no-go criteria

**Go** only if all of these hold:
- The smoke passes 100% on both hosts, with no "known" failures carried over from the demo.
- `/api/ready` returns 200, and the API logs show no 5xx during the smoke.
- The migration count matches.
- There are no demo accounts (`@demo.test`, `@example.test`) in the production DB.
- The backup is taken, and the last drill's restore check passed.
- The uptime monitor and alerting are active (§2.2 #22). Error tracking is set up per D-4.
- No Critical or High is open from QA or security.
- The 7 cross-lane gaps are closed, or the LEAD has waived them in writing.

**No-go** on any failure above, or if the data reconciliation is not green (when D-3 = yes).

### 4.4 Rollback
- **SPA:** promote the previous Pages deployment, or redeploy the previous frontend image.
- **API:** redeploy the previous commit. On Render, deploy that specific commit. On compose, use the previous image tag.
- **DB:** migrations are forward-only. If the release migrated, either:
  - restore the step-3 dump into a fresh database and point `DATABASE_URL` at it; or
  - restore over the target in a maintenance window.

  Any writes made after the dump are lost. Say so in the go/no-go decision.
- **Data migration:** BE-30 plans a rollback that drops the target schema. It is not built.
- **After a rollback:** re-run the smoke against the old version and record the incident in the tracker.

---

## 5. Open decisions

D-1, D-2 and D-3 are the ones that need a decision now (see "Needs a decision" at the top).

| # | Decision | For |
|---|---|---|
| D-1 | The exact module and route scope of the 30 Oct go-live. Is it only M28 + identity + teacher/school views + Admin Pusat intake and builder? Are the M06 SPM hub, leaderboard, games (5 solo games are broken in http mode) and battle in? If games are out, write "games out of scope for go-live". | user + LEAD (owner: Amin) |
| D-2 | Production hosting. The free tiers are unfit (sleeping API, ephemeral upload disk, DB pause, backups). Choose paid Render + Supabase with backups, or the VPS compose path. Who pays, and which region? | user |
| D-3 | Does go-live need users, schools or history migrated from the old system? If yes, BE-28/29/30 and OD-10 are on the critical path and 30 Oct is at risk. | user + LEAD |
| D-4 | Error tracking (Sentry or none), and who receives the alerts | user + LEAD |
| D-5 | The AI provider for intake in production (OD-14), its region and monthly cap. Or launch with intake on the mock provider and papers built by hand. | user |
| D-6 | Who loads the real launch papers and question content, and by when. **Decided B2 (LEAD, 30 Oct):** no papers at go-live except K1 drafts built from the migrated MCQs; see 5.1. | user + LEAD |
| D-7 | SPA Content-Security-Policy: add one, or replicate live (no CSP) | LEAD |
| D-8 | BE-33 OQ1 rate-limit numbers and OQ2 metrics access rule | LEAD |
| D-9 | One API instance (per-process throttles), or a shared throttle store before scaling | LEAD |
| D-10 | Backup cadence, retention and storage location, and who owns the monthly restore drill | user + LEAD |
| D-11 | ~~Migration numbers 0037 (BE-36) and 0038 (BE-38)~~ **Settled:** both merged with those numbers (`lead/merge-final`). | LEAD |
| D-12 | Password reset by e-mail is out of B1; reset links are only logged, and only in dev. Is that acceptable for launch, and what is the support path for a forgotten password? | user |

### 5.1 D-6 (B2): K1 draft papers from the migrated MCQs

Bijak SPM has no papers at go-live: the legacy .cloud papers are not migrated, and "Jana Kertas" reports a shortage because the
migrated questions carry no chapter. So the LEAD builds **draft** K1 (Kertas 1, objective) papers from the MCQs that `migrate:questions`
loaded; a human reviews them; Admin Pusat publishes them. Slug `bijak-k1-papers`.

**What it makes.** For Matematik `1449/1`, Sejarah `1249/1`, Fizik `4531/1` and Sains: a Spec blueprint "Objektif" (one section, answer all,
40 questions, 40 marks, when the subject has none) and up to 2 draft papers of 40 MCQs each, titled `Latihan SPM <subject> Kertas 1 Set <n>`.
Paper 2 shares no question with paper 1. The 40 follows `docs/requirements/v2-exam-schema.md` D7 (a single section of 40 MCQs for these
subjects). Durations: Matematik 75 min, Sejarah 90, Fizik 75, Sains 75 (Matematik and Sains are inferred; an admin can change a draft's duration).
Per-paper level mix: Matematik 17 / 13 / 10 questions from Tingkatan 1-3 / 4 / 5 (PR #400 layer-2 data, inferred), Sejarah 20 / 20 from Tingkatan 4 / 5,
Fizik and Sains an even Tingkatan 4 / 5 split (default). A level without enough stock passes its share to the others.

**Which questions.** Migrated (`legacy_source = cloud`), active, published, no stimulus group, subject matched, Tingkatan 1-5 only (primary is
left out), one MCQ part with 2 to 8 options that all have text and one key that names an option, and one copy of each stem. They are ordered by
`legacy_id` and picked by an even spread over that order (no randomness), so the same stock gives the same papers on UAT and on production.

**It does not publish.** A Spec blueprint also switches on the "Jana Kertas" button for that subject (it reads the blueprint); the pool tags
of the migrated questions do not match, so Jana Kertas will still report a shortage until the questions are tagged. Say so to testers.

**Run (LEAD, on the VPS, from the checkout of the release SHA, like `admin:bootstrap`).** `PC` and `TAG` are as in `vps-dark-26oct-runsheet.md`.
No password or token is needed: it uses `DATABASE_URL` from `.env.api` inside the `migrate` image and writes the audit rows under the
lowest-id active Admin Pusat user (`--actor-id=<id>` picks another). It prints counts only, never a question text, title or id.

```
# 1. Dry-run first (default): reads, writes nothing. Check the stock and "would create" per subject.
PP_IMAGE_TAG="$TAG" $PC run --rm --no-deps migrate npm run bijak:k1-drafts -w @pp/api

# 2. Create the drafts (after the final question load, on the night of 31 Oct).
PP_IMAGE_TAG="$TAG" $PC run --rm --no-deps migrate npm run bijak:k1-drafts -w @pp/api -- --apply
```

Flags: `--sets=1` (one paper per subject), `--subjects=MAT,SEJ,PHY,SN`, `--sn-code=<code>`, `--replace-blueprints`, `--help`.
Exit code 0 is done, 1 a write failed, 2 usage, 3 something is blocked and needs a decision. Re-running is safe: a draft is found by its title,
or by holding the same questions after a rename, and nothing is created twice. An empty draft left by a failed run is filled on the next run.
- **Sains** has no paper code in the repo and the stock may be short. It is skipped when it has fewer than 40 eligible questions, and blocked until
  `--sn-code=<printed paper code>` is given (or a Sains K1 blueprint exists). The LEAD decides the code.
- **A blueprint that does not fit** (for example the demo Matematik K1 of the PoC seed has 10 questions) blocks that subject. `--replace-blueprints`
  adds a new Spec version over it. A Disahkan blueprint is never replaced.
- Run the dry-run on UAT first; the numbers on production after the final load will be larger, the picks stay a function of the stock.

**Reviewer checklist** (one human, per draft, in Admin Pusat "Kertas & SPM"; use "Pratonton sebagai Pelajar" to see it as a student):
- [ ] The answer key of every question is correct (the review view shows the key). A wrong key: remove the question and add another of the same level, or leave the paper in draft.
- [ ] The stem and every option read clearly (no broken markup, no missing text, no cut-off sentence, maths readable).
- [ ] Images: the migration does not copy images, so a question that needs a picture was held out. Check that no question refers to "rajah" or "gambar" that is not shown.
- [ ] No duplicates: the same question twice, or two questions that ask the same thing.
- [ ] The title, the printed duration and the paper code are right for the subject.
- [ ] Only then press publish. Publish refuses a paper that fails its own check (40 questions, all published, no duplicate) and lists why.

**When.** The script runs after the final question load on the night of 31 Oct. The reviewer checks the drafts, and Admin Pusat publishes them
after the review and **before the 1 Nov DNS switch**. Anything not reviewed by then stays a draft (students do not see drafts).
