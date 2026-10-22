# Full Testing Plan (G5) - 25 Oct 2026

Slug: `full-testing-25oct`. Task AZ-10a (half AZ, stream S4 QA). Language: English (docs rule); route names, ids and BM UI copy stay as in the code.
Status: **Draft for LEAD review.** The in-scope module list is a working set until decision D-1 is made (section 2.3).

## 1. Purpose, date, build, environments, roles

| Item | Detail |
|---|---|
| Purpose | Verify, with executed evidence, that the Bijak SPM go-live scope works end to end on the real API: every acceptance criterion (AC) of the in-scope modules, three viewports, role scope, personal-data handling. Output is the G5 verdict (CLAUDE.md section 2): Ready / Not ready. |
| Test day | **Sunday 25 Oct 2026** ("ready for full testing", `docs/ops/go-live-bijak-spm.md`, timeline table). Go-live is Friday 30 Oct 2026. Fix and retest window: 26-29 Oct. |
| Backend under test | `feature/v2-backend` @ `<BE_SHA>` (plan written against tip `23c98226`; refresh the SHA at the entry check, section 7). |
| Frontend under test | `be/integration-frontend` @ `<FE_SHA>` after Developer 5's sync (plan written against `d909e1e0`; the sync is not done at writing time). FE/API pair per `docs/ops/staging-refresh-2.md` section 0. |
| Migrations | Latest on tip is `0038_intake_workflow`; half AZ uses 0040-0069, half AM 0070-0099 (AGENT-SYNC rule 2). Record the highest applied migration in the run header. |
| Environments | **E1 local stack**: PostgreSQL + API + SPA built with `VITE_API_MODE=http`, PoC seed (`npm run stack:up`, or `be:*` for API only). All destructive and data-writing tests run here. **E2 demo** (Render + Supabase + Pages, PoC seed): **read-only for testers except the UAT scripts**; no e2e, no smoke scripts, no load (shared rate limits: login 5/min per address). Production does not exist yet (D-2 pending). |
| Roles | Murid, Guru, Admin Sekolah, Admin Pusat (in scope); Ibu Bapa (boundary only, outside prototype scope); visitor with no session. |
| People | LEAD `azarulhakim`; half-AM lead `aminfaudzi`; QA lead and testers = half AZ `qa-engineer` sessions. See section 9. |
| Not allowed | Live sites (prestasiplus.my, prestasiplus.cloud), real names, real data, passwords or tokens in tickets, screenshots, chat or this repo. |

## 2. Scope

### 2.1 In scope (working set of 12, see 2.3)

Owner = half and lane per `docs/plan/AGENT-SYNC.md` "Halves" (AZ: PC-2, PC-3, PC-5, PC-7 + frontend shared files; AM: PC-1, PC-4, PC-6, confirmed) and the `Lane` column of `docs/plan/backend-tracker.md`.

| # | Module (cards) | Lane | Half (defects go to) |
|---|---|---|---|
| 1 | **M01** Authentication, session, account (BE-03, BE-06; v2 portal login, role, Mod Pelajar) | PC-1 | AM (#109); shell/router/guard files: AZ (#113) |
| 2 | **M02** Users, schools, subscriptions, parent invites (BE-05, BE-25) | PC-1 | AM (#109) |
| 3 | **M03** Curriculum (BE-08) | PC-2 | AZ (#113) |
| 4 | **M04** Question bank incl. workflow (BE-09 PC-2, BE-10 PC-5) | PC-2 / PC-5 | AZ (#113) |
| 5 | **M05** Practice / Latih Tubi (BE-11, BE-12, BE-13) | PC-2 | AZ (#113) |
| 6 | **M28** Bijak SPM: papers, attempts, builder, blueprints (BE-14, BE-15, BE-16, BE-39) | PC-3 | AZ (#113) |
| 7 | **M10** Teacher classes, missions, remedial (BE-17, BE-18) | PC-6 | AM (#109) |
| 8 | **M08** Student performance, headcount, timeline (BE-19) | PC-6 | AM (#109) |
| 9 | **M11 + M12** Teacher analytics, monitoring, Kirkpatrick (BE-20), counted as one row | PC-6 | AM (#109) |
| 10 | **M27** School admin incl. Amaran Awal (BE-21) | PC-6 | AM (#109) |
| 11 | **M17** Command Center / admin dashboards (BE-22) | PC-6 | AM (#109) |
| 12 | **Admin Pusat AI intake**: AI extraction, intake files/OCR, intake workflow, dashboard (BE-36, BE-37, BE-38, BE-40) | PC-5 | AZ (#113) |

Cross-cutting, tested with the modules above and not counted as modules: BE-31 conformance, BE-33 hardening (`apps/api/test/security`), BE-32 http switch and e2e, seed guard and PoC seed (BE-07, BE-26).

### 2.2 Out of scope for this run

| Item | Why |
|---|---|
| M06 SPM hub, M07 PKSK, M13 Cikgu Alesa, M14/M15 gamification and shop, M16 battle and games (5 solo games broken in http mode, D62: wait for PR #105), M20 marketplace, M21 Keluarga Angkat, M25 heatmap, M09/M22 content and tickets (BE-24, listed under "identity" in go-live section 1) | Not in the working set; the go-live doc calls them "adjacent" unless D-1 says otherwise. Smoke-click only where a UAT step touches them. |
| PPD/JPN, Penaja, Ibu Bapa portals | Outside prototype scope (`prototype-scope.ts`); boundary check only (UAT-IBU). |
| Data migration BE-27..BE-30 (half AM, PC-4) | Required for go-live by D61 but has its own rehearsal and reconciliation gate (BE-30 not built). Not part of this G5 plan; see R-3. |
| Load and capacity, penetration test, VPS sizing | No card owns them (v2-test-strategy OQ-TS-3); D-2 pending. |
| BE-33 gaps #97-#100 (non-strict bodies) | Accepted go-live exceptions (D63). #94-#96 remain release-gate items and are checked in S-11/S-12. |

### 2.3 Source of the list and the scope-change rule

- **No list named "Teras" exists in the repo.** The only "module/function workbook" reference is `docs/TRACKER.md` D65 ("go-live scope (D-1) is being chosen from the module/function workbook"); the workbook itself is not in the repo (`roles-matrix/Matriks-Akses-Peranan .xlsx` is a role-access matrix of 54 menu rows, not that workbook). "Teras" elsewhere in the docs only means core subjects (M03/M04/M06).
- **Used instead:** the "Modules and cards" table in `docs/ops/go-live-bijak-spm.md` section 1 (working definition: Bijak student flow, teacher and school visibility of Bijak results, Admin Pusat publish, plus the identity, curriculum, question and practice cards they depend on), cross-checked with the lanes in `docs/plan/backend-tracker.md`. To reach 12, BE-20 is split into M11 + M12 and counted as one row, and BE-36/37/38/40 are grouped as "Admin Pusat AI intake".
- **This list must be replaced once D-1 is decided.** Scope-change rule: (1) the LEAD records D-1 in `docs/TRACKER.md`; (2) QA updates sections 2 and 3 within 2 hours and posts the diff on #113 and #109; (3) a module added after 25 Oct 12:00 is run the next day and cannot block the verdict for the original set unless the LEAD says so; (4) a removed module keeps its executed results, is marked "descoped" and leaves the exit criteria; (5) every change goes through the LEAD, never a tester.

## 3. AC map

**Legend.** Level: UT unit, IT API integration (supertest + real PostgreSQL), CT conformance (`apps/api/test/conformance/**`, `packages/contract-tests`), E2E-API (`@api` Playwright on the real stack), E2E-mock (Playwright on the in-browser mock, `e2e/mNN-*`), UAT manual (AZ-10b script, section 6).
Path prefixes: `API:` = `apps/api/test/`; `FE:` = `e2e/` and `src/modules/` on this tip; `FEI:` = file exists **only** on `be/integration-frontend` @ `d909e1e0`, not on this tip (all `@api` specs). Numbers after a path are spec files (`*.spec.ts` / `*.test.ts`).

**How ACs were counted** (re-run to refresh):
- v1 URS: `grep -oE "^\- \*\*AC-Mxx-[0-9.]+\*\*" docs/requirements/urs/Mxx-*.md | sort -u | wc -l` (equals the count of all `AC-Mxx-n.n` references).
- v2 docs: lines starting `- AC-NN.N` inside the stated section (`awk` on `###` headings): `v2-bijak-spm.md` section 4 (Student 101, Admin 48, System 6), `v2-question-bank.md` section 5 (Intake 86, Serving 23, Administration 19), `v2-portals.md` section 9 by user story (US-01..08 = 51 to M01, US-09 = 7 to M17, US-13 = 5 to M27; US-10, 11, 12, 14, 15, 16 = 25 not assigned, cross-cutting).
- **BE-AC** = numbered items under "## Acceptance criteria" of each card `docs/plan/backend-tasks/BE-nn-*.md` (API level). `docs/requirements/v2-backend-urs.md` adds 90 BE-FR and 80 BE-NFR rows with acceptance checks, counted separately (cross-cutting).
- A functional AC (URS/v2) and a BE-AC are different sets; both must be Pass. Existing results in `docs/qa/Mxx-*.md` are v1 mock-mode G5 results and are **not** evidence for the real API.

| # | Module | Requirement docs | Functional ACs | BE-ACs (cards) | Existing test evidence | Level for G5 | Gap |
|---|---|---|---|---|---|---|---|
| 1 | M01 | `urs/M01-authentication.md`; `v2-portals.md` US-01..08 | 102 + 51 = **153** | 20 (BE-03 11, BE-06 9) | API: `auth/` 16, `account/` 13, `security/` 16; `conformance/auth`, `conformance/account`; `packages/contract-tests/src/scenarios/auth.ts`; FE: `e2e/m01-authentication` 9, `src/modules/m01-*/__tests__` 15; FEI: `e2e/api/auth-session`, `logout`, `session-expiry`, `guards` | UT, IT, CT, E2E-API, UAT | `/login` mobile overflow re-measure open (`TODO(d4)` in `e2e/api/helpers.ts`); register and password-reset have no `@api` e2e; US-07/08 (Mod Pelajar, role switch) API level only |
| 2 | M02 | `urs/M02-users-schools.md` | **170** | 18 (BE-05 11, BE-25 7) | API: `users/` 9, `schools/` 9, `subscriptions/` 12; `conformance/users`, `conformance/schools`; FE: `e2e/m02-users-schools` 11, unit 32 | UT, IT, CT, E2E-mock, UAT | **No `@api` e2e.** Import caps (1 MB / 1000 rows), last-admin 409, one-time password display (D55c, D59b) only at IT level |
| 3 | M03 | `urs/M03-curriculum.md` | **121** | 10 (BE-08) | API: `curriculum/` 12; FE: `e2e/m03-curriculum` 7, unit 14 | UT, IT, E2E-mock, UAT | **No conformance scenario** (`conformance/curriculum` absent); no `@api` e2e; admin tree CRUD never run over http |
| 4 | M04 | `urs/M04-question-bank.md`; `v2-question-bank.md` Serving 23 + Administration 19 | 167 + 42 = **209** | 24 (BE-09 12, BE-10 12) | API: `questions/` 22, `questions-workflow/` 19, `bijak-question-bridge/` 2; `conformance/questions`, `conformance/questions-workflow`; FE: `e2e/m04-question-bank` 12, unit 31 | UT, IT, CT, UAT | **No `@api` e2e**; v2 lifecycle (Draf, Semakan, Lulus, Diterbitkan, Diarkib; D54) and question display ("Serving") not exercised in a browser over http |
| 5 | M05 | `urs/M05-practice.md` | **164** | 28 (BE-11 8, BE-12 11, BE-13 9) | API: `practice/` 14, `practice-reads/` 6, `practice-question-source/` 3; `conformance/practice`, `conformance/practice-reads`; FE: `e2e/m05-practice` 12, unit 25; FEI: `e2e/api/practice` (4 tests, read paths only) | UT, IT, CT, E2E-API, UAT | Write path (start, answer, finish) has no `@api` e2e; `random` start returns 422 on the PoC seed (DG-1); revision and mastery unverified over http |
| 6 | M28 Bijak | `v2-bijak-spm.md` (no v1 URS; M06 URS is the hub, out of scope) | **155** (101 / 48 / 6) | 32 (BE-14 6, BE-15 8, BE-16 10, BE-39 8) | API: `bijak-papers/` 8, `bijak-attempts/` 7, `bijak-integration/` 5, `exam-builder/` 10, `exam-core/` 1; `packages/exam-core`; `conformance/bijak`, `conformance/bijak-builder`; FE: `e2e/m06-spm/bijak-spm.spec.ts` (mock), `src/modules/m28-bijak-spm/__tests__` 7; FEI: `e2e/bijak/student-http`, `http-autosave`, `admin-publish-http`, `e2e/api/attempt-ownership` | UT, IT, CT, E2E-API, UAT | Photo upload (BE-16 AC8) and timer expiry and sweeper (AC5) have no browser test; Mod Latihan and Jana Kertas not in `@api`; builder blueprint flows only partly covered |
| 7 | M10 | `urs/M10-teacher-class.md` | **164** | 15 (BE-17 7, BE-18 8) | API: `classes/` 7, `missions/` 13; `conformance/classes`, `conformance/missions`; FE: `e2e/m10-teacher-class` 8, unit 25 | UT, IT, CT, UAT | **No dedicated `@api` e2e** (only the US-33 class view via FEI `us33-http`); missions, remedial sets, DSKP picks never run over http |
| 8 | M08 | `urs/M08-student-performance.md` | **156** | 10 (BE-19) | API: `reports/performance/` 31; `conformance/performance`; FE: `e2e/m08-student-performance` 12, unit 27; FEI: `e2e/api/teacher-prestasi` (1 test) | UT, IT, CT, E2E-API, UAT | Runtime sweep of M08 on a real stack still open (AGENT-SYNC); headcount, social, timeline not in `@api`; children's-names rule (`canSeeName`) needs a role-matrix run (S-7) |
| 9 | M11 + M12 | `urs/M11-teacher-analytics.md` 105; `urs/M12-kirkpatrick.md` 123 | 105 + 123 = **228** | 7 (BE-20) | API: `analytics/` 4, `kirkpatrick/` 7; `conformance/analytics` (`analytics.ts`, `kirkpatrick.ts`); FE: `e2e/m11-teacher-analytics` 2, `e2e/m12-kirkpatrick` 2, unit 11 + 12 | UT, IT, CT, UAT | **Thinnest e2e of any module** (4 mock specs vs 228 ACs); no `@api`; Kirkpatrick interventions and feedback UI never run over http |
| 10 | M27 | `urs/M27-school-admin.md`; `v2-portals.md` US-13 | 163 + 5 = **168** | 13 (BE-21) | API: `school-admin/` 24; `conformance/school-admin`; FE: `e2e/m27-school-admin` 10, unit 18; FEI: `e2e/bijak/us33-http` (school dashboard panel) | UT, IT, CT, E2E-API (partial), UAT | m27 runtime sweep on a real stack open; student creation (one-time password, D55c) and Amaran not in `@api`; BE-21 AC13 doc fix to re-read |
| 11 | M17 | `urs/M17-admin-dashboard.md`; `v2-portals.md` US-09 | 151 + 7 = **158** | 7 (BE-22) | API: `command-center/` 9; `conformance/command-center` (4 files); FE: `e2e/m17-admin-dashboard` 2, unit 11 | UT, IT, CT, UAT | **No `@api` e2e**; Command Center load time on the PoC seed unmeasured over http; `/admin` redirect (J-10) |
| 12 | Admin Pusat AI intake | `v2-question-bank.md` Intake (86); `v2-pentadbiran-backlog.md` (no ACs) | **86** | 32 (BE-36 10, BE-37 8, BE-38 9, BE-40 5) | API: `ai/` 9, `intake-files/` 14, `intake-workflow/` 12, `intake-dashboard/` 4; `conformance/ai`, `conformance/intake` (3 files); FEI: `src/modules/m28-bijak-spm/__tests__/intake-http.test.ts` (unit) | UT, IT, CT, UAT | **No browser test over http**; J-03: only Muat Naik Kertas and Senarai Ekstrak use `/api/intake/*`, the rest is still mock; AI provider is `mock`; real OCR and ClamAV unverified |

### 3.1 Totals

| Measure | Count |
|---|---|
| Functional ACs, 12 modules | **1,932** (v1 URS 1,586 + v2 docs 346) |
| of which from v2 docs | Bijak 155, question bank 128, portals 63 |
| Not assigned (portal shell, US-10/11/12/14/15/16) | 25, covered by the responsive sweep (5.3) and S-1..S-6 |
| BE-ACs, 12 modules | **216** |
| Cross-cutting backend requirement rows | 90 BE-FR + 80 BE-NFR |
| AZ-10b UAT steps | 28 + 14 + 11 + 5 + 16 + 7 (responsive) + 5 (cross-role) = 86 |

**Traceability gap.** Specs are not tagged with AC ids, so "AC executed" cannot be read from test output. Rule for this run: the results table (9.4) lists each AC id with its evidence (spec path and test title, or UAT step id, or manual note). `npm run check:trace` (`scripts/check-e2e-trace.mjs`) exists for mock e2e trace checks; run it and record the output. The run is not "every AC executed" until all 1,932 + 216 rows have a result. A row not run is **Not run or Blocked, never Pass**.

## 4. Test data

### 4.1 PoC seed profile

| Item | Detail |
|---|---|
| Command (local) | `npm run be:db:reset`, then `ALLOW_DEMO_SEED=true BIJAK_POC_QUESTIONS=true npm run be:db:seed -- --profile=poc` (`poc` is also the default). `be:db:reset` refuses when `NODE_ENV=production`. |
| `ALLOW_DEMO_SEED` | Seed guard (`apps/api/prisma/seed/guard.ts`): demo seeds run only when `NODE_ENV` is `development` or `test`, or `ALLOW_DEMO_SEED` is `true`/`1`. Anything else counts as production and the seed aborts. Never set it on a production database. |
| `BIJAK_POC_QUESTIONS` | `true` on E1/E2 only: the API serves the PoC Bijak questions at runtime (`bijak/question-bridge`, `exam/builder`). Off in production by LEAD decision. A run with it off must show empty states ("Tiada kertas tersedia buat masa ini"), not errors. |
| Contents | 25 ordered seed modules (`docs/plan/seed-profile.md`); the counts table is regenerated by `apps/api/test/seed/poc.spec.ts`. Question pool: 10 subjects x 2 levels (T4, T5) x 24 = 480 MCQs (`seed/questions/pool-content.ts`). |
| Demo password | One shared published demo password for all seeded accounts; **held by the LEAD and Amin, not in the repo**. Testers get it from the vault; never paste it anywhere. Staging hash procedure: `docs/ops/demo-reseed.md`. |

### 4.2 Personas (fictitious `@demo.test`; names and emails from `apps/api/prisma/seed/core/identity.ts` and `core/population.ts`, as listed in AZ-10b)

| Role | Display name | Email | School / class | Use |
|---|---|---|---|---|
| Murid (with data) | Murid Demo | `pelajar@demo.test` | SMK Demo Satu (`DEMO001`), T4, `4 Amanah` | Main student: Bijak SPM, practice, classes |
| Murid (advanced) | Murid Demo Maju | `pelajarmaju@demo.test` | SMK Demo Satu, T5, `5 Amanah` | Higher progress |
| Murid (empty) | Murid Demo Kosong | `pelajar2@demo.test` | SMK Demo Satu, T4, `4 Bestari` | Empty states |
| Guru | Guru Demo | `guru@demo.test` | SMK Demo Satu; classes `DEMO4S` (7), `DEMO4M` (6) | Teacher flows |
| Admin Sekolah | Admin Sekolah Demo | `adminsekolah@demo.test` | SMK Demo Satu | School flows |
| Admin Pusat | Admin Pusat Demo | `admin@demo.test` | none ("Seluruh Negara") | Portal Pentadbiran, builder, intake |
| Ibu Bapa | Ibu Bapa Demo | `ibubapa@demo.test` | none | Boundary check only |
| Dual role | Guru Admin Demo | `guruadmin@demo.test` | SMK Demo Satu | Role switch (API level, J-16) |
| Negative login | Murid Tidak Aktif Demo, Murid Digantung Demo | `tidakaktif@demo.test`, `digantung@demo.test` | SMK Demo Satu | Inactive and suspended messages |
| Class members | Murid Demo Empat .. Lapan | `murid4` .. `murid8@demo.test` | `DEMO4S`, `DEMO4M` | Seen in teacher and school lists; not for login |

Accounts created during tests use the prefix `qa-` and `@demo.test` (for example `qa-murid-01@demo.test`); never real names.

### 4.3 Reset procedure between runs

| Step | Command / action | When |
|---|---|---|
| 1 | `npm run stack:down -- --volumes` | Clean run |
| 2 | `npm run stack:up` (compose, migrate, demo seed, waits for health) | Clean run (E1) |
| 2b | API only: `npm run be:db:reset`, then the seed command in 4.1 | Backend-only suites |
| 3 | Check `GET /api/health` = `status: ok`, `db: up`; record highest migration and seed counts | Every reset |
| 4 | E2 demo: reseed only with half AZ's approval per `docs/ops/demo-reseed.md` (Path A or B); testers never reseed | Before UAT |
| 5 | Wait 60 s after any login-heavy run (login throttle 5/min per address) | Between suites |

Data-writing tests (submit a Bijak attempt, create class, create student, publish paper) run once per reset; record the reset id in the results.

### 4.4 Known data gaps

| ID | Gap | Effect | Owner |
|---|---|---|---|
| DG-1 | PoC pool has levels T4 and T5 only (`PoolLevel` in `seed/questions/pool-content.ts`); practice `random` and Kad Memori take D1-D4 (AZ-02 pending). | `random` practice start answers 422; Kad Memori 0 cards (J-01). Expect the 422 until AZ-02 merges, then re-run. | AZ (PC-2, PC-7) |
| DG-2 | Empty on PoC seed: rankings, Papan Pendahulu, Sekolah Bersaing, school subscriptions, complimentary students, extraction list, question reports, daily missions (J-12). | Empty-state tests only; no populated-state coverage. | AZ, AM |
| DG-3 | Seed numbers differ slightly between local and demo DB. | Compare counts at reset (4.3 step 3); do not hard-code. | QA |
| DG-4 | No real PDF/OCR sample in the repo; AI provider is `mock`. | Intake runs on fixtures only. | AZ (PC-5) |
| DG-5 | Murid `/dashboard` is not the landing page in http mode (J-06); Ibu Bapa has no screens (J-05). | Documented gaps, not bugs. | AZ |

## 5. Automated suites

### 5.1 Commands

| Suite | Command | Notes |
|---|---|---|
| Backend gate | `TEST_DATABASE_URL=postgresql://test@127.0.0.1:55432/postgres PRISMA_SCHEMA_ENGINE_BINARY=$HOME/stub/schema-engine PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npm run be:verify` | = `contract:check` + `@pp/contract-tests` + `be:lint` + `be:lint:migration` + `be:typecheck` + `be:test` + `be:build` |
| Build only | same env, `npm run be:build` | |
| Backend tests | same env, `npm run be:test` (one area: `npm run be:test -- test/<dir>`) | |
| Conformance | same env, `npm run conformance:api` (= `be:test -- test/conformance`) | |
| Contract | `npm run contract:check`, `npm run contract:test` | OpenAPI breaking-change gate also in `.github/workflows/api.yml` |
| Frontend | `npm test` (`vitest run --project unit`), `npm run typecheck`, `npm run lint` | `src/mock/server/__tests__/registry-boot.test.ts` boots the mock registry (about 56 s) |
| E2E (mock) | `npm run test:e2e` (`playwright.config.ts`); per module `npm run test:e2e:module` | Regression only; not G5 evidence for the real API |
| E2E (real API) | `npm run stack:up`, then `npm run test:e2e:http -- --grep @api`, then `npm run stack:down` | `playwright.http.config.ts`: 1 worker, projects mobile 375x812, tablet 768x1024, desktop 1280x800; `BASE_URL` or `FRONTEND_PORT` (default 5192). The scripts and specs are on `be/integration-frontend` (this tip has the two configs but no `e2e/api`, `e2e/bijak`) |
| CI | `.github/workflows/api.yml`; `e2e-http.yml` (FEI); `no-dumps.yml` | Record the run URLs for `<BE_SHA>` and `<FE_SHA>` |

**Allowed local failures (known, environment related; record them, do not "fix" in test code):** the 4 failures in `migrate-cli.spec.ts` and the `pg-source.spec.ts` test "a failed connection reports no password and no user". Any other failure is a defect, or a Blocked result with a ticket. Report real counts (passed / failed / skipped); never write "green" without output.

### 5.2 E2E-API coverage matrix (specs on `be/integration-frontend` @ `d909e1e0`; tests counted by `test(` lines; `guards` and `logout` generate extra runs per role in loops)

Each test runs in 3 projects (375, 768, 1280). "Overflow" = the spec asserts no horizontal page scroll with the `scrollWidth - clientWidth` helper (`e2e/api/helpers.ts`, `e2e/bijak/bijak-flow.ts`, `us33-flow.ts`).

| Module | `@api` specs (tests) | Viewports | Overflow checked | Gap |
|---|---|---|---|---|
| M01 | `api/auth-session` (5), `api/logout` (1), `api/session-expiry` (3), `api/guards` (3) | 3 | yes | Register, password reset, profile and settings, notifications |
| M02 | none | 0 | no | All of it |
| M03 | none | 0 | no | All of it |
| M04 | none | 0 | no | All of it |
| M05 | `api/practice` (4, reads) | 3 | yes | Start, answer, finish, revision, targets |
| M28 | `bijak/student-http` (1 serial flow), `bijak/http-autosave` (1), `api/attempt-ownership` (1), `bijak/admin-publish-http` (6), `bijak/us33-http` (2) | 3 | yes | Mod Latihan, Jana Kertas, history filters, photos, timer expiry |
| M10 | `bijak/us33-http` teacher class view (1 of its 2) | 3 | yes | Classes, missions, remedial |
| M08 | `api/teacher-prestasi` (1) | 3 | yes | Headcount, social, timeline, class and school Prestasi |
| M11/M12 | none | 0 | no | All of it |
| M27 | `bijak/us33-http` school dashboard (1 of its 2) | 3 | yes | People management, Amaran, reports |
| M17 | none | 0 | no | All of it |
| Admin Pusat intake | none | 0 | no | All of it |

Totals: 11 spec files in the http `testMatch` (7 in `e2e/api`, 4 `bijak/*http*`), 28 `test(` blocks, x3 projects = 84 runs plus loop-generated ones. Record the actual count with `npx playwright test -c playwright.http.config.ts --list --grep @api`. **6 of 12 modules (M02, M03, M04, M11/M12, M17, intake) have no `@api` spec, and M10 and M27 only through one US-33 view.** Plan response: QA writes the missing `@api` specs 25-27 Oct, priority M05 write path, M10, M27 people, M17, M04 admin list, M02 users, M03 tree (test code only; defects go to owners). Until they exist those modules rely on IT, CT and manual UAT and cannot meet EX-4 without a LEAD waiver.

### 5.3 Horizontal-scroll and responsive check (mandatory, CLAUDE.md section 7)

| Check | Method | Pass rule |
|---|---|---|
| Automated | Overflow helper in each `@api` spec at 375, 768, 1280 | `scrollWidth - clientWidth` = 0 on every sample (3 samples, taken after animations end) |
| Manual sweep | UAT-RES-01..07 (AZ-10b section 10) and every route of the four roles in 6.1 | No horizontal page scroll, nothing clipped or overlapping, navigation reachable (bottom nav or drawer at 375) |
| Re-check first | `docs/qa/v2-responsive-sweep.md` (17 Oct): RESP-01 student header at 375, RESP-02 admin Command Center student breadcrumb; `/login` hero overflow at 375 (`TODO(d4)`) | State closed or still open in the results |
| Severity | A layout break at any of the three sizes is **High** | |

## 6. Manual, exploratory, UAT, accessibility, security

### 6.1 UAT per role (reference, not duplicated)

Scripts: `docs/qa/uat-demo-23oct.md` on branch `docs/AZ-10b-uat-demo` (`git show origin/docs/AZ-10b-uat-demo:docs/qa/uat-demo-23oct.md`; it may be merged by then). The Status column is filled on a working copy; failures go to #113 in the AZ-10b format. After Developer 5's sync re-read its "Jurang diketahui" (J-01..J-16) and update expected results.

| Role | UAT ids | Steps | Run on | Extra for 25 Oct |
|---|---|---|---|---|
| Murid | UAT-MUR-01..28 | 28 | E1, then E2 | MUR-09/10 submit a paper (writes); log the reset id |
| Guru | UAT-GUR-01..14 | 14 | E1, then E2 | GUR-04 creates a class (writes) |
| Admin Sekolah | UAT-ASK-01..11 | 11 | E1, then E2 | ASK-04 creates a student: check one-time password display and must-change-password (D55c, D59b) |
| Ibu Bapa | UAT-IBU-01..05 | 5 | E1 | Boundary only |
| Admin Pusat | UAT-ADM-01..16 | 16 | E1, then E2 | Publish and withdraw a paper (writes); intake per J-03 |
| Cross-role | C-01..C-05 | 5 | E1 | C-02 (submit, then teacher and school see the result) and C-03 (publish, then student sees it) are go-live critical |
| Responsive | UAT-RES-01..07 | 7 | E1 | 375, 768, 1280 |

### 6.2 Exploratory charters (45 minutes each; notes and screenshots under `.playwright-mcp/` or the path the LEAD gives)

| Charter | Focus (try to break) |
|---|---|
| X-1 Bijak attempt | Refresh mid-attempt, two tabs on one attempt, submit twice, expired timer, Back after submit, very long answers, photo over 5 MB and wrong type |
| X-2 Auth and session | Wrong password x6 (429 copy), session expiry, missing CSRF header, logout in one tab while another is open, role switch and Mod Pelajar |
| X-3 Forms and input | Empty, 500+ characters, emoji, HTML or script strings in names, import over 1 MB / 1000 rows, BM error copy |
| X-4 Empty and error states | Murid Kosong, empty classes, API stopped (clear error, no blank page), slow network, 401/403/404/413/422/429 pages |
| X-5 Admin Pusat builder and intake | Publish with gaps, withdraw (Tarik balik), delete draft, wrong file type, duplicate detection, AI budget cap |
| X-6 Responsive and theme | Every in-scope route at 375, 768, 1280, light and dark, 320 px spot check, long school and class names |

### 6.3 Security spot checks (QA verifies; findings routed to the owner; `security-engineer` consulted for Critical/High)

| # | Check | Expected | Basis |
|---|---|---|---|
| S-1 | Guest on a protected URL; expired cookie | Redirect to `/login`; API 401 | v2-portals US-01, US-06 |
| S-2 | Cookie flags after login | HttpOnly, SameSite=Lax, Secure on https | `e2e/api/auth-session` |
| S-3 | Write without `X-CSRF-Token` | 403 `CSRF_INVALID` | BE-16 AC10; `security/csrf-every-group.spec.ts` |
| S-4 | Admin routes (`/api/admin/*`, `/api/intake/*`, `/admin/*` pages) as Murid, Guru, Admin Sekolah | 403, no data, no redirect loop | D43, `role-access-matrix.md` |
| S-5 | Student A reads student B's Bijak attempt or practice session by id | 403 "Akses ditolak" | BE-16 AC7, D54(b) |
| S-6 | School scope: Guru or Admin Sekolah of one school requests another school's class or student ids | 403 or 404, no names | D57(d), `auth/scope.spec.ts` |
| S-7 | Children's-names rule on rankings and lists (`canSeeName`): full name only in own scope, otherwise first name + initial and `userId: null` | As written in AGENT-SYNC | #76, BE-23 |
| S-8 | Login limit (5/min per address) and reset-ic limit (5 per 15 min); reset of an unknown e-mail | 429 `RATE_LIMITED` with BM copy; no account enumeration | D55(a,b), D58(c) |
| S-9 | Password for an account created by an admin: shown once, absent from logs and later GETs; must-change on first login | As D55(c), D59(b) | BE-21, BE-05 |
| S-10 | Personal data in logs and responses; AI provider receives redacted text only | No IC number, e-mail, password or token in API logs or error bodies | BE-33 log redaction, decision (c) |
| S-11 | Upload and import limits | 413/422 with BM copy "Fail import melebihi had yang dibenarkan." (413 envelope still open) | D58(e) |
| S-12 | Security headers; `/api/ready` and `/api/metrics` access | As `docs/ops/api-runbook.md` section 15 (release gate); #94-#96 checked here | BE-33, D63 |
| S-13 | No secret in repo, screenshots or tickets | gitleaks job green on `<BE_SHA>` | `.github/workflows/api.yml` |

### 6.4 Accessibility (D10: replicate live, no enhancements)

Check only that ARIA, keyboard, focus and reduced-motion behave as live and as already recorded in the module QA docs. A finding is a bug only when a control cannot be used by touch or keyboard or text is unreadable (D9 "broken"): **Medium**, or High if it blocks a core flow. Do not file missing enhancements.

## 7. Entry and exit criteria

### 7.1 Entry (checked 25 Oct 08:00-08:30; record evidence in the run header)

| # | Criterion | Evidence |
|---|---|---|
| EN-1 | Build identified: `<BE_SHA>`, `<FE_SHA>` (after Developer 5's sync); FE/API pair confirmed | git log, LEAD message |
| EN-2 | G3 and G4 done for every in-scope card on the tip (code-reviewer Approve; security-engineer where required) | `docs/plan/reviews/`, PR links |
| EN-3 | `be:verify` run on `<BE_SHA>` with the env in 5.1; only the allowed local failures | pasted tail with counts |
| EN-4 | `npm run typecheck`, `npm run lint`, `npm test` on `<FE_SHA>` | pasted tail |
| EN-5 | E1 stack up, migrated and seeded (4.3); `/api/health` ok | health output, seed counts |
| EN-6 | Smoke: login for the four roles, `/spm/bijak` opens, Pembina Kertas opens | manual, 15 minutes |
| EN-7 | No open Critical defect from the 23 Oct demo | #113, #109 |
| EN-8 | Demo password and tester access delivered out of band | LEAD confirmation |
| EN-9 | D-1 status known (decided, or "working set used") | `docs/TRACKER.md` |

If EN-1..EN-5 fail, testing does not start: QA reports Blocked to the LEAD and states the command needed (`npm run stack:up`) instead of guessing.

### 7.2 Exit (G5, aligned with CLAUDE.md section 2: "every AC executed and Pass; no open Critical/High bugs")

| # | Criterion |
|---|---|
| EX-1 | Every in-scope functional AC (1,932 at writing) and BE-AC (216) has an executed result in 9.4; none is Pass without evidence |
| EX-2 | No open Critical or High defect; Medium and Low are listed with an owner and a decision (fix, LEAD-signed waiver, or after go-live) |
| EX-3 | `be:verify` green on the final `<BE_SHA>` (allowed local failures only); CI `api.yml` green |
| EX-4 | `@api` e2e green at 375, 768 and 1280 for every module that has specs; modules without specs have a recorded LEAD waiver and a passed manual and UAT run |
| EX-5 | No horizontal page scroll, clipped or overlapping content on any in-scope screen at the three sizes |
| EX-6 | UAT for the four in-scope roles complete; every "Gagal" closed or triaged; cross-role C-02 and C-03 Pass |
| EX-7 | Security checks S-1..S-13 executed; #94-#96 closed (D63 exceptions #97-#100 noted) |
| EX-8 | Regression after the last fix (8.4) green |
| EX-9 | Verdict written by QA: **Ready / Not ready** with reasons. The LEAD owns go/no-go; the production deploy still needs the user's explicit confirmation (G6) |

## 8. Defect triage

### 8.1 Severity

| Severity | Definition (examples) |
|---|---|
| **Critical** | Data loss or corruption, security hole, a role cannot log in, a core go-live flow is impossible (Bijak submit, paper publish), API or DB crash, personal-data exposure. |
| **High** | Core flow broken with no workaround; wrong marks or results shown; a role sees data it must not; **any layout break at 375, 768 or 1280** (horizontal page scroll, clipped or overlapping content, unreachable navigation); 5xx on a normal action. |
| **Medium** | Feature works with a workaround; wrong or missing BM copy or label; missing empty or error state; a non-core control unusable by touch; a11y regression versus live. |
| **Low** | Cosmetic, spacing, typo without change of meaning, minor inconsistency. |

Documented live behaviour and known gaps (J-nn) are not defects unless the actual result differs from the documented one.

### 8.2 Issue template (GitHub issue, one defect each, no secrets)

| Field | Content |
|---|---|
| Title | `[QA][BUG-nnn] <module> <short symptom>` |
| Severity | Critical, High, Medium or Low |
| Module and AC id | for example `M28 / AC-05.3` or `BE-16 AC7` |
| Build | `<BE_SHA>`, `<FE_SHA>`, environment E1 or E2, reset id |
| Role and account | persona e-mail (never the password) |
| Viewport and browser | 375, 768 or 1280; theme; browser |
| Steps to reproduce | numbered |
| Expected vs actual | with exact BM copy |
| Evidence | screenshot path under `.playwright-mcp/` (or the given path), failing call and status, request id; no tokens or cookies |
| Suspected owner | role (`backend-developer`, `frontend-developer`, `solution-architect`) and lane (PC-n) |
| Labels | `qa`, severity, `half-az` or `half-am`, `blocker-g5` for Critical and High |

### 8.3 Routing by lane, and SLAs

| Lane or area | Half | Queue | Examples |
|---|---|---|---|
| PC-2 (M03, M04 core, M05, wallet, practice), PC-3 (M28, exam-core, builder), PC-5 (AI intake, question workflow), PC-7 (games), frontend shared files (router, menu, `prototype-scope.ts`, transport), deploy and environment, AZ-owned seed data | **AZ** | **#113** (LEAD `azarulhakim`) | M03, M04, M05, M28, intake, shell, layout in shared files |
| PC-1 (M01, M02, subscriptions, account), PC-4 (migration), PC-6 (M08, M10, M11, M12, M17, M27, reports, BE-26 seed) | **AM** | **#109** (`aminfaudzi`) | Auth, users, schools, teacher, school admin, Command Center, analytics |
| Cross-half or unclear owner | LEAD | #113 with label `needs-owner` | LEAD decides within 2 hours; a module's owner changes it at the other half's request (AGENT-SYNC rule 5) |

| Severity | Acknowledge | Fix or workaround | QA retest |
|---|---|---|---|
| Critical | 1 hour | Same day (target 4 hours); LEAD informed at once | Within 2 hours of the fix reaching the integration build |
| High | 2 hours | End of the next working day; for anything found after 27 Oct, before 29 Oct 12:00 | Within 4 hours |
| Medium | Next triage | Before 30 Oct, or a LEAD waiver recorded | Next daily regression |
| Low | Next triage | Backlog after go-live unless trivial | Optional |

The SLAs run 25-30 Oct including Sunday 25 Oct. Fixes reach QA only through the merge gate (one merge at a time by the LEAD, "SEDIA MERGE" checker, D64); QA does not use an unmerged branch for the verdict unless the LEAD names the SHA.

### 8.4 Retest and regression

- A defect is closed only by QA, after re-running its steps on the fixing SHA at **all three sizes** and recording the SHA.
- Every fix triggers: the failing test, the module's `@api` spec and IT area, and the 15-minute smoke (EN-6).
- Daily full regression: `be:verify`, `npm run test:e2e:http -- --grep @api`, UAT cross-role C-02 and C-03. One last full regression on the release-candidate SHA after the final merge (EX-8).
- A reopened defect returns to the same queue with its original id; reopened twice raises the severity one step.
- Test code (e2e, QA fixtures) is fixed by QA; application code never (QA role rule).

### 8.5 Daily triage

| Time (MYT) | Who | What |
|---|---|---|
| 09:00 | QA lead, LEAD, half-AM lead | 15-minute triage: new defects, severity, routing, blockers, waivers |
| 13:00 | QA lead | Status post on #113 and #109: counts by severity and owner, retests due |
| 17:30 | QA lead, LEAD, half-AM lead | End-of-day triage and go/no-go signal for the next day |
| 25 Oct | see 9.1 | Time blocks differ |

## 9. Schedule, RACI, reporting

### 9.1 Schedule for 25 Oct (MYT; the LEAD may adjust)

| Time | Block | Who |
|---|---|---|
| 08:00-08:30 | Entry checks EN-1..EN-9; reset E1 (4.3) | QA lead, LEAD |
| 08:30-09:00 | Kick-off: assign charters, lanes and modules; D-1 status; waiver decision (OQ-4) | LEAD, QA, half-AM lead |
| 09:00-11:00 | Automated: `be:verify`, conformance, FE unit/typecheck/lint, `@api` e2e at 3 sizes | QA |
| 09:00-12:30 | Manual AC execution: M01, M02, M03, M04 (testers split by module) | QA testers |
| 12:30-13:30 | Break; 13:00 status post | QA lead |
| 13:30-16:30 | Manual AC execution: M05, M28, M10, M08, M11/M12, M27, M17, intake | QA testers |
| 13:30-16:30 | UAT per role on E1 (6.1) and responsive sweep (UAT-RES) | UAT testers |
| 16:30-17:30 | Exploratory X-1..X-6 and security S-1..S-13 (carry over to 26 Oct if needed) | QA |
| 17:30-18:00 | Triage, first defect summary, results table updated | QA lead, LEAD, half-AM lead |
| 26-27 Oct | Fixes, retests, missing `@api` specs, UAT on E2, remaining ACs | all |
| 28-29 Oct | Final regression on the release-candidate SHA, verdict, risk sign-off | QA lead, LEAD |
| 30 Oct | Go/no-go (G5 verdict in hand; G6 needs the user's explicit confirmation) | LEAD, user |

Browser lanes: one browser per tester (CLAUDE.md "Parallel browser lanes": lanes 1-3, never two agents on one lane); scripts and temp files in a role subfolder of the scratchpad; never stop other sessions' node, Playwright or vite processes. No scripted loops against the live .my or .cloud sites.

### 9.2 RACI (R responsible, A accountable, C consulted, I informed)

| Activity | LEAD (`azarulhakim`) | Half-AM lead (`aminfaudzi`) | QA lead (half AZ) | Developers | Security-engineer |
|---|---|---|---|---|---|
| Scope and D-1 decision | A | C | C | I | I |
| Plan and results table | I | C | A/R | I | I |
| Environment and builds (E1, E2) | A | R (PC-1 stack parts) | R (verify) | C | I |
| Test execution (automated and manual) | I | C | A/R | C | I |
| Defect triage | A | R (#109) | R (files in #113) | C | C (security Critical/High) |
| Fixes in AZ lanes | A | I | I | R | C |
| Fixes in AM lanes | I | A/R | I | R | C |
| Retest and closure | I | I | A/R | I | I |
| G5 verdict | C | C | A/R | I | C |
| Merge into `feature/v2-backend` | A/R | I | I | I | I |
| Go-live (G6) | A (needs user confirmation) | C | C | I | I |

### 9.3 Reporting

- Status posts (13:00, 17:30) on #113 and #109: counts and the delta since the last post.
- At the end of the run, `docs/qa/full-testing-25oct-results.md` (new file by the QA lead; this plan stays unchanged) holds the filled table below and the G5 verdict.
- Verdict wording: **Ready** only if EX-1..EX-9 hold; otherwise **Not ready** with the list of open items.

### 9.4 Results table template

Per module, with one row per AC id in an appendix (`Not run` until executed):

| Module | Func ACs | Pass | Fail | Blocked | Not run | BE-ACs | Pass | Fail | Blocked | Not run | `@api` 375 | 768 | 1280 | Open Crit/High | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M01 | 153 | | | | | 20 | | | | | | | | | |
| M02 | 170 | | | | | 18 | | | | | n/a | n/a | n/a | | |
| M03 | 121 | | | | | 10 | | | | | n/a | n/a | n/a | | |
| M04 | 209 | | | | | 24 | | | | | n/a | n/a | n/a | | |
| M05 | 164 | | | | | 28 | | | | | | | | | |
| M28 | 155 | | | | | 32 | | | | | | | | | |
| M10 | 164 | | | | | 15 | | | | | | | | | |
| M08 | 156 | | | | | 10 | | | | | | | | | |
| M11/M12 | 228 | | | | | 7 | | | | | n/a | n/a | n/a | | |
| M27 | 168 | | | | | 13 | | | | | | | | | |
| M17 | 158 | | | | | 7 | | | | | n/a | n/a | n/a | | |
| Intake | 86 | | | | | 32 | | | | | n/a | n/a | n/a | | |
| **Total** | **1,932** | | | | | **216** | | | | | | | | | |

Per-AC appendix columns: `AC id | module | level | evidence (spec path and test title, UAT step, or note) | build SHA | reset id | result (Pass, Fail, Blocked, Not run) | defect id`.
Run header: date, `<BE_SHA>`, `<FE_SHA>`, highest migration, seed profile and counts, environment, tester, `be:verify` counts (passed, failed, skipped), allowed failures seen (4 + 1), CI run URLs.

## 10. Risks and open questions

| ID | Risk or question | Impact | Owner | Proposed handling |
|---|---|---|---|---|
| R-1 / OQ-1 | **D-1 not decided**: the 12 modules are a working set from the go-live doc, not the real list (no "Teras" list found; the workbook is not in the repo). | Wrong effort split; late scope change | LEAD, user | Rule in 2.3; LEAD confirms the set or provides the workbook list |
| R-2 | Frontend http switch incomplete: Murid `/dashboard`, SPM hub m06, M16 solo games, intake review screens still mock or limited (J-03, J-04, J-06); `be/integration-frontend` is not merged into `feature/v2-backend`. | ACs for those screens cannot Pass on the real API | AZ | Mark Blocked with the J id; re-plan after Developer 5's sync |
| R-3 | D61 requires data migration for go-live; BE-29 and BE-30 are not built. | Go-live blocker outside this plan | AM | Separate rehearsal gate; QA adds reconciliation checks if BE-30 lands before 28 Oct |
| R-4 | 6 of 12 modules have no `@api` e2e (5.2). | EX-4 cannot be met by default | AZ, QA | QA writes specs 25-27 Oct, or the LEAD waives per module |
| R-5 | Specs carry no AC ids; 2,148 AC rows (1,932 + 216) need a result. | One Sunday cannot execute all; "Not run" risk at verdict | QA lead | Run go-live-critical flows first (Bijak, publish, results visibility, auth), the rest 26-28 Oct; report honestly |
| R-6 | Data gaps DG-1 (no D1-D4 pool, AZ-02 pending) and DG-2 (empty states). | Practice `random` 422; no populated ranking tests | AZ | Re-test after AZ-02 merges |
| R-7 | Environment: demo on Render may cold-start for about 60 s; login throttle 5/min per address; D-2 hosting undecided; no production-like environment. | False failures, 429s | LEAD, user | Warm up first; space logins; destructive tests on E1 only |
| R-8 | Local `be:*` needs the stub schema engine and the PostgreSQL on port 55432; 5 known failures. | Noise in results | QA | Record exactly; any new failure is real |
| R-9 | Sunday test day; two halves and one merge gate (one PR at a time, checker every 2 hours). | Fix latency | LEAD | SLAs in 8.3; agree a merge window with the LEAD |
| R-10 | Open release-gate items #94-#96 (BE-33) and the 413 envelope; #97-#100 accepted (D63). | EX-7 | AM (PC-1) | Verify with S-11 and S-12 |
| R-11 | `uat-demo-23oct.md` is on `docs/AZ-10b-uat-demo` and was written against `d909e1e0`; labels may change after the sync. | UAT expected results drift | AZ (AZ-10b) | Re-read J-02, J-03 and screen labels after the sync |
| OQ-2 | Is Ibu Bapa in the 30 Oct scope (no screens)? | Boundary only vs a real flow | LEAD | Assume no (J-05) |
| OQ-3 | Which testers work on 25 Oct and which lane (1-3) does each use? | Capacity | LEAD | Assign at kick-off |
| OQ-4 | Will the LEAD accept per-module waivers for missing `@api` specs (EX-4)? | Exit criterion | LEAD | Decide by 25 Oct 09:00 |
| OQ-5 | Final SHAs and URL of E2; any change since 23 Oct. | Entry | LEAD | Fill `<BE_SHA>`, `<FE_SHA>` and the URL |
