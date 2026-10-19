# API catalogue part: teacher, reports and admin endpoints (M08, M10, M11, M12, M17, M18, M27)

Status: draft for the lead (reference for the BE cards BE-17 to BE-22). Part of `docs/architecture/v2-api-catalogue.md`; the index is assembled by the lead.
Sources read: the mock handlers listed in section 1, the module `api/` clients and types, `src/mock/server/{router,respond,validate,paginate,request}.ts`, `src/mock/auth/middleware.ts`, `packages/contract/src/**` (incl. `openapi.ts`), `docs/architecture/v2-backend-plan.md` (5, 6, 7, 14.7), `docs/plan/backend-tasks/BE-17..BE-22`, `docs/requirements/role-access-matrix.md`. The frontend mock is the behavioural spec: this document records what it does. Where the mock is provisional or inferred, the entry says so; nothing here is a new business rule.

## 1. Scope and counts

Every `route(` registration under `src/modules/<module>/mock/**` was found with `grep -rnE "route\(" ... --include=*.ts` (excluding `__tests__`) and each hit was matched to a registration (the commands are in section 13). **The counts differ from the figures in the brief and in `v2-backend-plan.md` 6.3** (17 / 33 / 4 / 13 / 2 / - / 17); those figures are stale, the grep is the truth. M27 needs one extra step because 8 routes are made by four factory functions.

| Module | Handlers folder | Grep hits | Registered routes | Brief / plan 6.3 | Notes |
|---|---|---:|---:|---|---|
| M08 student performance | `m08-student-performance/mock/handlers` | 30 | **30** | 17 | class 2, student 2, performance 4, item-analysis 4, headcount 12, social 6 |
| M10 teacher and class | `m10-teacher-class/mock/handlers` | 39 | **39** | 33 | 30 plus 9 Command Center routes under `/api/guru/command-center` |
| M11 teacher analytics | `m11-teacher-analytics/mock/handlers` | 7 | **7** | 4 | monitoring 5, teacher report 2 |
| M12 Kirkpatrick | `m12-kirkpatrick/mock/handlers` | 14 | **14** | 13 | levels 7, feedback 2, interventions 2, students 2, export 1 |
| M17 admin dashboard (Command Center) | `m17-admin-dashboard/mock/handlers` | 11 | **11** | 2 | live 1, daily 2, drill 8 |
| M18 PPD / JPN | `m18-ppd-jpn/mock/handlers` | 4 | **4** | - | Amaran school family only |
| M27 school admin | `m27-school-admin/mock/handlers` | 18 | **22** | 17 | factories: `csvRoute` x2, `detailRoute` x2, `updateRoute` x2, `resetRoute` x2 |
| **Total** | | 123 | **127** | | |

Contract status (checked in `packages/contract/src/openapi.ts` and `session/paths.ts`): the contract registers only `/auth/login`, `/auth/logout`, `/session`, `/session/role`, `/session/mode` (POST, DELETE) and the shared components. **None of the 127 endpoints has a contract path: `exists` 0, `partial` 0, `missing` 127.** Related (not equal) pieces that do exist: `ListMeta`/`PageQuery`/`envelopeOf` envelopes (`common/envelope.ts`), the error body and codes (`common/error.ts`), `RoleCode`/`ScopeLevel` (`common/enums.ts`), `Scope` (`session/scope.ts`) and Mod Pelajar (`/session/mode`).

## 2. Conventions as coded (apply to every endpoint unless the entry says otherwise)

- **Base and ids.** Paths are the mock strings, base `/api` (Nest global prefix; `servers: [{url:'/api'}]`). Path params declared with `int()` match digits only; a non-digit segment does not match the route and the answer is `404 NOT_FOUND` "Not Found." The mock uses numeric ids; the wire id in v2 is a decimal string (plan 6.1, X1). Entries write ids as `int`.
- **Auth.** The mock authenticates with a Bearer token (`requireAuth`, `requireRole`); the real API uses the cookie session (plan 7). `requireAuth()` = any logged-in session. Role codes are `student, teacher, parent, sponsor, school_admin, ppd_officer, jpn_officer, admin`. Abbreviations in the tables: **A** admin (Admin Pusat), **T** teacher (Guru), **SA** school_admin (Admin Sekolah), **S** student (Murid), **PPD**/**JPN** officers, **any** any logged-in session.
- **Generic errors** (`src/mock/server/respond.ts` `DEFAULT_ERROR_MESSAGES`, English Laravel defaults; module routes override with BM): `401 UNAUTHORIZED` "Unauthenticated."; `403 FORBIDDEN` "This action is unauthorized."; `404 NOT_FOUND` "Not Found."; `409 CONFLICT` "Conflict."; `422 VALIDATION_ERROR` "The given data was invalid." (when `fields` is empty); `429 RATE_LIMITED` "Too Many Attempts."; `500 SERVER_ERROR` "Server Error". Error body `{error:{code, message, fields?, retryAfter?}}`. A 422 built from `fields` has `message` = the first field message, plus ` (and N more error(s))` when there are more (Laravel summary).
- **Success shapes** (the responder decides, and the frontend client depends on it): `ok/created` = `{data}` (`201` for create); `ok(data, extra)` = `{data, ...extra}` (e.g. `{data, status}`, `{data, message}`); `list/paged/unpaged` = `{data, meta}` with `meta = {page,pageSize,totalItems,totalPages,from,to,...extra}`; `raw(status, body)` = the body **without `{data}`** (the client uses `raw: true`); `blob` = a file with `Content-Disposition`. Each entry states which one is used. Pagination helper: `totalPages = max(1, ceil(total/pageSize))`, an out-of-range page is an empty page (M27 user lists instead clamp to the last page), invalid `page` = 1; `unpaged` = `page 1, pageSize max(1,n), totalPages 1`.
- **Validation messages.** Default copy for the `required/min/max/email/unique/confirmed/in/exists` rules is English Laravel text (`The :attribute field is required.`, etc.); `:attribute` is the camelCase key split into lower-case words. BM strings quoted in entries are verbatim from the handlers.
- **Time.** Day logic is Asia/Kuala_Lumpur (MYT). The mock clock is the "project clock" (`ctx.clock.now()`), the real API uses server time. Timestamps are ISO 8601 `+08:00` (one exception: `GET /api/amaran/summary` `generatedAt` is epoch ms).
- **`is_test`.** The plan (section 5) stamps data written under Mod Pelajar with `is_test` and says aggregates exclude it. **None of the 127 handlers filters `is_test`** (no field exists in the mock); see OQ-API-B3-1. The "fixture schools" 900001-900099 are the mock's way of keeping demo schools out of platform roll-ups (M11 BR-M11-34, M17 BR-M17-02, M12 BR-M12-01, M18 BR-M18-02).
- **Card column.** `BE-nn` = the endpoint is listed in that card's endpoint table (after the LEAD card audit, commit 63d363c, every route of M08, M10, M11, M12, M17 and M27 is listed explicitly; the earlier `BE-nn*` implied marker is gone). `UNCOVERED` = no card lists it (also collected in section 11).
- **Entry blocks.** `Roles/auth` = guard as coded plus matrix row from `role-access-matrix.md` (rows 1-53; the matrix covers Murid, Guru and Admin Sekolah only: Admin Pusat, PPD and JPN scopes are as coded and unverified against the matrix). Types referenced as `T:nn` are line numbers in the module's TypeScript type file named at the top of each section, so every response field is findable there.

## 3. Summary table (127 endpoints)

Scope at a glance (as coded): **teacher** = own classes and their pupils (M08, M10, M11 report, M17 drill) but **all schools** for M11 monitoring and M12 Kirkpatrick; **school_admin** = own school only, forced from the session, never from the request (M27, M17 board, M11 monitoring, M12 overview, M18); **admin** = platform (all schools, fixture schools out of roll-ups); **ppd_officer** = schools of own `ppdDistrict` (M08 item analysis, M18); **jpn_officer** = schools of own `ppdState`; **student** = self.

| ID | Module | Method | Path | Roles (as coded) | Card | Contract |
|---:|---|---|---|---|---|---|
| M08-01 | M08 | GET | `/api/performance/school` | any (scope: A platform, others own school) | BE-19 | missing |
| M08-02 | M08 | GET | `/api/performance/levels` | any (same scope) | BE-19 | missing |
| M08-03 | M08 | GET | `/api/performance/levels/:code` | any (same scope) | BE-19 | missing |
| M08-04 | M08 | GET | `/api/performance/classes` | any (teacher: own classes; others empty) | BE-19 | missing |
| M08-05 | M08 | GET | `/api/performance/classes/:id` | A any class, T own, SA own-school classes | BE-19 | missing |
| M08-06 | M08 | GET | `/api/performance/students/:userId` | A, T own pupils, SA own school, S self, PPD district, JPN state | BE-19 | missing |
| M08-07 | M08 | GET | `/api/analytics/me` | any (own data) | BE-19 | missing |
| M08-08 | M08 | GET | `/api/analytics/classes` | A, T | BE-19 | missing |
| M08-09 | M08 | GET | `/api/item-analysis/school` | A, T, SA, S, PPD, JPN (own school) | BE-19 | missing |
| M08-10 | M08 | GET | `/api/item-analysis/school/:schoolId` | same roles; A any, PPD district, JPN state, others own | BE-19 | missing |
| M08-11 | M08 | GET | `/api/item-analysis/classes` | A all classes, T own | BE-19 | missing |
| M08-12 | M08 | GET | `/api/item-analysis/classes/:id` | A any, T own | BE-19 | missing |
| M08-13 | M08 | GET | `/api/timeline` | any (own) | BE-19 | missing |
| M08-14 | M08 | POST | `/api/timeline` | any (own) | BE-19 | missing |
| M08-15 | M08 | GET | `/api/public/students/:id` | none (anonymous) | BE-19 | missing |
| M08-16 | M08 | GET | `/api/rankings` | any | BE-19 | missing |
| M08-17 | M08 | GET | `/api/leaderboard` | any | BE-19 | missing |
| M08-18 | M08 | GET | `/api/weekly-report` | any (always 403) | BE-19 | missing |
| M08-19 | M08 | GET | `/api/headcounts` | A, T, SA (own configs) | BE-19 | missing |
| M08-20 | M08 | GET | `/api/headcounts/dashboard` | A, T, SA (own configs) | BE-19 | missing |
| M08-21 | M08 | GET | `/api/headcounts/form-options` | A, T, SA | BE-19 | missing |
| M08-22 | M08 | POST | `/api/headcounts` | A, T, SA (own class) | BE-19 | missing |
| M08-23 | M08 | POST | `/api/headcounts/auto-setup` | A, T, SA | BE-19 | missing |
| M08-24 | M08 | GET | `/api/headcounts/students/:userId` | A, T, SA | BE-19 | missing |
| M08-25 | M08 | GET | `/api/headcounts/:id/summary` | A any, T own, SA own school | BE-19 | missing |
| M08-26 | M08 | GET | `/api/headcounts/:id/export` | A any, T own, SA own school | BE-19 | missing |
| M08-27 | M08 | GET | `/api/headcounts/:id` | A any, T own, SA own school | BE-19 | missing |
| M08-28 | M08 | POST | `/api/headcounts/:id/reset` | A any, T own, SA own school | BE-19 | missing |
| M08-29 | M08 | DELETE | `/api/headcounts/:id` | A any, T own, SA own school | BE-19 | missing |
| M08-30 | M08 | POST | `/api/headcounts/:id/drop-students` | A any, T own, SA own school | BE-19 | missing |
| M10-01 | M10 | GET | `/api/guru/dashboard` | T, A | BE-17 | missing |
| M10-02 | M10 | GET | `/api/guru/remedial-progress` | T, A | BE-18 | missing |
| M10-03 | M10 | GET | `/api/guru/classes` | T, A (own) | BE-17 | missing |
| M10-04 | M10 | POST | `/api/guru/classes` | T, A | BE-17 | missing |
| M10-05 | M10 | GET | `/api/guru/classes/:id/qr-data` | T, A (own class) | BE-17 | missing |
| M10-06 | M10 | GET | `/api/guru/students` | T, A | BE-17 | missing |
| M10-07 | M10 | PUT | `/api/guru/students/:id` | T, A (own class) | BE-17 | missing |
| M10-08 | M10 | DELETE | `/api/guru/students/:id` | T, A (own class) | BE-17 | missing |
| M10-09 | M10 | GET | `/api/guru/chapters` | T, A | BE-17 | missing |
| M10-10 | M10 | POST | `/api/guru/chapters` | T, A | BE-17 | missing |
| M10-11 | M10 | GET | `/api/guru/topics` | T, A | BE-17 | missing |
| M10-12 | M10 | POST | `/api/guru/topics` | T, A | BE-17 | missing |
| M10-13 | M10 | POST | `/api/guru/dskp/bidang` | T, A | BE-18 | missing |
| M10-14 | M10 | POST | `/api/guru/dskp/sk` | T, A | BE-18 | missing |
| M10-15 | M10 | POST | `/api/guru/dskp/sp` | T, A | BE-18 | missing |
| M10-16 | M10 | GET | `/api/guru/contributions` | T, A (own) | BE-17 | missing |
| M10-17 | M10 | GET | `/api/guru/questions` | T, A (own) | BE-09 | missing |
| M10-18 | M10 | POST | `/api/guru/questions` | T, A | BE-09 | missing |
| M10-19 | M10 | GET | `/api/guru/questions/template` | T, A | BE-10 | missing |
| M10-20 | M10 | POST | `/api/guru/questions/import` | T, A | BE-10 | missing |
| M10-21 | M10 | GET | `/api/guru/questions/:id` | T, A (own) | BE-09 | missing |
| M10-22 | M10 | PUT | `/api/guru/questions/:id` | T, A (own) | BE-09 | missing |
| M10-23 | M10 | DELETE | `/api/guru/questions/:id` | T, A (own) | BE-09 | missing |
| M10-24 | M10 | GET | `/api/guru/galeri-rajah` | T, A | BE-17 | missing |
| M10-25 | M10 | POST | `/api/guru/question-papers` | T, A | BE-18 (served by BE-37 `POST /api/intake/batches`, D53 OWN-1) | missing |
| M10-26 | M10 | GET | `/api/guru/audio-kbat/template` | T, A | BE-18 | missing |
| M10-27 | M10 | GET | `/api/guru/audio-kbat/template-word` | T, A | BE-18 | missing |
| M10-28 | M10 | GET | `/api/kelas-saya` | any (own) | BE-17 | missing |
| M10-29 | M10 | POST | `/api/kelas-saya/join` | S, A | BE-17 | missing |
| M10-30 | M10 | GET | `/api/set-soalan-saya` | any | BE-18 | missing |
| M10-31 | M10 | GET | `/api/guru/command-center/live-data` | T, A (own students) | BE-22 | missing |
| M10-32 | M10 | GET | `/api/guru/command-center/drill` | T, A | BE-22 | missing |
| M10-33 | M10 | GET | `/api/guru/command-center/remedial/scan` | T, A | BE-18 | missing |
| M10-34 | M10 | POST | `/api/guru/command-center/remedial/generate` | T, A | BE-18 | missing |
| M10-35 | M10 | POST | `/api/guru/command-center/remedial/cancel` | T, A | BE-18 | missing |
| M10-36 | M10 | GET | `/api/guru/command-center/predictive` | T, A | BE-22 | missing |
| M10-37 | M10 | GET | `/api/guru/command-center/evaluate` | T, A | BE-22 | missing |
| M10-38 | M10 | GET | `/api/guru/command-center/achievements` | T, A | BE-22 | missing |
| M10-39 | M10 | GET | `/api/guru/command-center/badge-holders` | T, A | BE-22 | missing |
| M11-01 | M11 | GET | `/api/monitoring/overview` | A, T (all schools), SA (own school) | BE-20 | missing |
| M11-02 | M11 | GET | `/api/monitoring/schools/:schoolId` | A, T, SA (own school) | BE-20 | missing |
| M11-03 | M11 | GET | `/api/monitoring/schools/:schoolId/students/:userId` | A, T, SA (own school) | BE-20 | missing |
| M11-04 | M11 | GET | `/api/monitoring/schools/:schoolId/teachers/:userId` | A, T, SA (own school) | BE-20 | missing |
| M11-05 | M11 | GET | `/api/monitoring/export` | A, T, SA | BE-20 | missing |
| M11-06 | M11 | GET | `/api/teacher/report` | T (own classes), A (empty) | BE-20 | missing |
| M11-07 | M11 | GET | `/api/teacher/item-analysis` | T (own classes), A (empty) | BE-20 | missing |
| M12-01 | M12 | GET | `/api/kirkpatrick/overview` | A, T, SA (own school) | BE-20 | missing |
| M12-02 | M12 | GET | `/api/kirkpatrick/reaction` | A, T | BE-20 | missing |
| M12-03 | M12 | GET | `/api/kirkpatrick/learning` | A, T | BE-20 | missing |
| M12-04 | M12 | GET | `/api/kirkpatrick/behavior` | A, T | BE-20 | missing |
| M12-05 | M12 | GET | `/api/kirkpatrick/results` | A, T | BE-20 | missing |
| M12-06 | M12 | GET | `/api/kirkpatrick/chain` | A, T | BE-20 | missing |
| M12-07 | M12 | GET | `/api/kirkpatrick/filter-options` | A, T, SA (own school) | BE-20 | missing |
| M12-08 | M12 | GET | `/api/kirkpatrick/export-pdf` | A, T | BE-20 | missing |
| M12-09 | M12 | GET | `/api/kirkpatrick/interventions` | A, T (unscoped) | BE-20 | missing |
| M12-10 | M12 | POST | `/api/kirkpatrick/interventions` | A, T | BE-20 | missing |
| M12-11 | M12 | GET | `/api/kirkpatrick/students/:id` | A, T | BE-20 | missing |
| M12-12 | M12 | GET | `/api/kirkpatrick/me` | any (own) | BE-20 | missing |
| M12-13 | M12 | GET | `/api/feedback/status` | any (own) | BE-20 | missing |
| M12-14 | M12 | POST | `/api/feedback` | any (own) | BE-20 | missing |
| M17-01 | M17 | GET | `/api/admin/command-center/live-data` | A (platform), SA (own school) | BE-22 | missing |
| M17-02 | M17 | GET | `/api/command-center/daily-activity` | A (platform), SA (own school) | BE-22 | missing |
| M17-03 | M17 | GET | `/api/command-center/daily-activity/school/:id` | A only | BE-22 | missing |
| M17-04 | M17 | GET | `/api/command-center/school/:id` | A any, T schools of own classes, SA own school | BE-22 | missing |
| M17-05 | M17 | GET | `/api/command-center/school/:sid/teacher/:uid` | A any, T self, SA own school | BE-22 | missing |
| M17-06 | M17 | GET | `/api/command-center/classroom/:id` | A any, T own, SA own school | BE-22 | missing |
| M17-07 | M17 | GET | `/api/command-center/student/:id` | A any, T own pupils, SA own school | BE-22 | missing |
| M17-08 | M17 | GET | `/api/command-center/student/:id/week` | A, T, SA (same scope) | BE-22 | missing |
| M17-09 | M17 | GET | `/api/command-center/student/:id/subject` | A, T, SA (same scope) | BE-22 | missing |
| M17-10 | M17 | GET | `/api/command-center/session/:sessionId` | A, T, SA (same scope) | BE-22 | missing |
| M17-11 | M17 | GET | `/api/command-center/headcount/:configId` | A, T, SA (same scope) | BE-22 | missing |
| M18-01 | M18 | GET | `/api/amaran/schools/:id` | A, SA own, T own, PPD district, JPN state | BE-21 | missing |
| M18-02 | M18 | GET | `/api/amaran/summary` | A, PPD, JPN, SA and T (own school only) | BE-21 | missing |
| M18-03 | M18 | GET | `/api/amaran/effectiveness` | A (school 127), SA, T (own school) | BE-21 | missing |
| M18-04 | M18 | GET | `/api/amaran/export/school/:id` | A, SA own, PPD district, JPN state (not T) | BE-21 | missing |
| M27-01 | M27 | GET | `/api/admin-sekolah/dashboard` | SA | BE-21 | missing |
| M27-02 | M27 | GET | `/api/admin-sekolah/usage` | SA | BE-21 | missing |
| M27-03 | M27 | GET | `/api/admin-sekolah/laporan-aktiviti` | SA | BE-21 | missing |
| M27-04 | M27 | GET | `/api/admin-sekolah/dskp-heatmap` | SA | BE-21 | missing |
| M27-05 | M27 | GET | `/api/admin-sekolah/laporan-bulanan` | SA | BE-21 | missing |
| M27-06 | M27 | GET | `/api/admin-sekolah/kelas` | SA | BE-21 | missing |
| M27-07 | M27 | GET | `/api/admin-sekolah/pelajar` | SA | BE-21 | missing |
| M27-08 | M27 | GET | `/api/admin-sekolah/guru` | SA | BE-21 | missing |
| M27-09 | M27 | GET | `/api/admin-sekolah/pelajar/export.csv` | SA | BE-21 | missing |
| M27-10 | M27 | GET | `/api/admin-sekolah/guru/export.csv` | SA | BE-21 | missing |
| M27-11 | M27 | GET | `/api/admin-sekolah/pelajar/form-options` | SA | BE-21 | missing |
| M27-12 | M27 | GET | `/api/admin-sekolah/pelajar/:id` | SA | BE-21 | missing |
| M27-13 | M27 | GET | `/api/admin-sekolah/guru/:id` | SA | BE-21 | missing |
| M27-14 | M27 | POST | `/api/admin-sekolah/pelajar` | SA | BE-21 | missing |
| M27-15 | M27 | POST | `/api/admin-sekolah/guru` | SA | BE-21 | missing |
| M27-16 | M27 | PUT | `/api/admin-sekolah/pelajar/:id` | SA | BE-21 | missing |
| M27-17 | M27 | PUT | `/api/admin-sekolah/guru/:id` | SA | BE-21 | missing |
| M27-18 | M27 | POST | `/api/admin-sekolah/pelajar/:id/reset-password` | SA | BE-21 | missing |
| M27-19 | M27 | POST | `/api/admin-sekolah/guru/:id/reset-password` | SA | BE-21 | missing |
| M27-20 | M27 | POST | `/api/admin-sekolah/guru/:id/toggle-active` | SA | BE-21 | missing |
| M27-21 | M27 | POST | `/api/admin-sekolah/users/:id/impersonate` | SA (checked in M01 contract) | UNCOVERED (dropped by user decision, UD-2) | missing |
| M27-22 | M27 | POST | `/api/admin-sekolah/impersonate/leave` | impersonated session | UNCOVERED (dropped by user decision, UD-2) | missing |

Legend: (the earlier `*` implied marker is gone after the card audit.) Roles use the abbreviations of section 2.

## 4. M08 Student performance (`src/modules/m08-student-performance/mock/handlers`)

Count: **30** `route(` registrations (grep: class 2, student 2, performance 4, item-analysis 4, headcount 12, social 6). The brief and `v2-backend-plan.md` 6.3 say 17; the 17 is stale (it predates M08-T1b headcount and T7 class routes). Aggregation file: `handlers/index.ts` (`m08Routes`). Types: `src/modules/m08-student-performance/api/types.ts` (T), `api/headcount-types.ts` (HT). Client: `api/performance.ts`, `api/class.ts`, `api/headcount.ts`.

Module-wide facts:

- Viewer = `req.session.userId` row of the M01 users store (`handlers/common.ts:20`). Scope for school-level reads (`performance.ts:13 scopeOf`): `admin` = platform (all schools); every other role = own `users.schoolId` (a user without a school gets an empty school scope, `schoolId = -1`).
- Role-access-matrix rows 3-6 (Headcount, Prestasi, Analitik Adaptif, Analisa Item) are allowed for Murid, Guru and Admin Sekolah; the mock enforces narrower rules per endpoint (below).
- Practice figures count practice-mode sessions only (`PRACTICE_MODE_SET` = M05 `PRACTICE_MODES`; SPM modes excluded) except where "all modes" is stated. The mock does not filter `is_test` anywhere in M08 (no `isTest` in the module): see OQ-API-B3-1.
- Percentages are 0-100; displayed accuracies are capped at 100 (`capPercent`) and rounded to 1 decimal unless stated. GPS has 2 decimals.
- Ids in the mock are numbers; the wire id is a decimal string in v2 (plan 6.1). Path params use `int()` (digits only; non-digits do not match the route, so the answer is `404 NOT_FOUND`).
- Business-rule helpers (`repository/rules.ts`): grade by percent A+ >=90, A >=80, A- >=70, B+ >=65, B >=60, C+ >=55, C >=50, D >=45, E >=40, else G (points A+ 0 ... G 9); GPS band <=2 Cemerlang, <=4 Baik, <=6 Sederhana, else Perlu Perhatian; SP band Mahir >=75, Sederhana >=50, Lemah <50; difficulty index = 1 - correct/attempts (2 dp), Sukar >0.70, Mudah <=0.30, else Sederhana; discrimination status D >=0.4 Sangat Baik, >=0.3 Baik, >=0.2 Sederhana, else Lemah. Headcount band (`headcount-port.ts:bandStatus`): AR > target = above; AR >= target-2 = on; else below; null AR or target = na. Pair status: latest AR vs target (>= = on, < = below, missing = none).

### M08-01 `GET /api/performance/school`
Purpose: school (or platform) performance dashboard S1.
- **Roles/auth:** any session (`requireAuth`). Matrix: Prestasi, all three portal roles.
- **Scope:** admin = platform; others = own school. No role gate; PPD/JPN/parent/sponsor also get their own-school scope (INFERRED, OQ-M08-04).
- **Request:** none.
- **Response:** `200 {data: SchoolPerformance}` (T:19). Fields: `scope` platform|school; `header {classCount, studentCount}`; `stats {students, teachers, classes, subjects, sessions, answered, accuracy}`; `gps {value, band, entries}`; `distribution [{grade, count, pct}]` (10 grades); `trend {years[{year,gps,band,candidates,source,change,current}], chart{labels,overall,subjects[{name,color,data}]}}`; `subjects [{subjectId,name,gps,grade,entries,onTrack,below,noTarget,achievementPct}]`; `levels [{code t4|t5,accuracy,classes,students,sessions}]`; `teachers [{userId,name,classCount,studentCount,accuracy,onTrack,below}]`.
- **Computation** (`repository/performance.ts:computeSchoolPerformance`): classes = active classrooms of the scope (`kind=classroom`); `header.classCount` = that count; students/teachers = role counts (platform) or users of role in the school; platform `sessions` = count of all sessions (Q-SESS-ALL, all modes), `answered` = count of all practice answers (Q-ANS-ALL), `accuracy` = mean of per-session accuracy (`sessionMeanAccuracy`); school scope sums per-student totals (all modes; answered = sum of per-user answer counts) and mean session accuracy; `stats.subjects` = distinct non-null subject ids of the active classes. GPS: headcount entries of the scope (entries whose student is in scope), graded entries = entries having at least one AR; each graded entry's grade = grade of its latest AR; `gps.value` = sum(points) / graded entries (2 dp), null when none; `distribution.pct` = count / graded * 100 (1 dp). `trend.years` = stored platform SPM history rows ascending plus the current MYT year as an empty row (`current: true`) when absent; `change` = gps - previous row gps (2 dp), null for the first. `trend.chart` is the fixed display constant `GPS_CHART` (`mock/data/observed`). `subjects` = graded entries grouped by subject, ordered by GPS ascending then id; `achievementPct = round((9.5 - gps)/9.5*100)`; onTrack/below/noTarget by pair (latest AR >= target / < target / no target); platform scope appends two zero rows for the display constants "Pendidikan Seni Visual" and "Sains Sukan" when they have no row. `levels` per T4/T5: classes of that education-level slug in scope, distinct active members, summed sessions (all modes), mean session accuracy. `teachers`: one card per teacher owning a `classroom` in scope, ordered by name then id; accuracy = mean session accuracy over distinct pupils of the teacher's classes; onTrack/below = distinct pupils whose headcount entries in the teacher's classes have any pair on (on) else any below (below), both null when the teacher's classes have no entries.
- **Errors:** 401 only.
- **Side effects:** none (result memoised in the mock; a backend may cache).
- **Owner/handler/client:** M08; `handlers/performance.ts:29`; `fetchSchoolPerformance`.
- **Card:** BE-19. **Contract:** missing.

### M08-02 `GET /api/performance/levels`
Purpose: Tingkatan 4 and 5 cards (S2).
- **Roles/auth:** any session. **Scope:** as above (platform for admin, own school otherwise).
- **Response:** `200 {data: LevelCard[]}` (T:84) always two rows `t4` ("Tingkatan 4"), `t5` ("Tingkatan 5"): `{code, name, classes, students}`. Platform: classes/students from the M10 level summary; school scope: count of classes of that level slug in the school and distinct active members across them.
- **Errors:** 401. **Side effects:** none.
- **Handler:** `performance.ts:35`; `fetchLevels`. **Card:** BE-19. **Contract:** missing.

### M08-03 `GET /api/performance/levels/:code`
Purpose: level detail S3.
- **Roles/auth:** any session; same scope.
- **Request:** path `code` string; only `t4` and `t5` are valid.
- **Response:** `200 {data: LevelDetail}` (T:107): `{code,name,classes,students,subjects,accuracy,sessions,onTrack,below,onTrackPct,classRows[LevelClassRow],topStudents[],atRisk[]}`. Computation (`performance.ts:levelDetail`): aggregate = classes of the level in scope (all `kind`s incl. school classes), distinct active members, sessions = sum of session totals (all modes), accuracy = mean session accuracy; `subjects` = distinct subject ids of the classes; onTrack/below count headcount entries of the scope at that level id (10/11) where pair is on (latest AR >= target) else below (no AR/target counts below); `onTrackPct = round(on/(on+below)*100)`. `classRows` ordered by group (classes without subject first, then subject name A-Z, school classes last), then class name, then id; row accuracy = sum(correct)/sum(questions) of the members' sessions (all modes), onTrack/below per pupil of that class's entries (status: any pair on = on, else any below); `href = /prestasi/kelas/{id}` for classrooms, null for school classes; `subject` text "Tiada Subjek" or "Kelas Sekolah". `topStudents` = members with >=3 sessions, ordered by mean session accuracy desc then user id, top 10. `atRisk` = entries with an AR and a target and AR < target, ordered by gap (AR - target) ascending, then config id, then user id, top 15 (`checkpoint` = latest AR checkpoint number).
- **Errors:** `404 NOT_FOUND` "Not Found." for a code other than t4/t5. 401.
- **Handler:** `performance.ts:50`; `fetchLevelDetail`. **Card:** BE-19. **Contract:** missing.

### M08-04 `GET /api/performance/classes`
Purpose: the viewer's own classes (S4).
- **Roles/auth:** any session. Teacher: own active classrooms; every other role: empty array (admin gets none, `ownClasses` returns `[]` unless teacher).
- **Response:** `200 {data: ClassCard[]}` (T:141): `{id,name,subjectName,color,students,year,joinCode,isActive}`; `color` = subject colour (default `#6366F1`), `students` = active member count.
- **Errors:** 401. **Handler:** `performance.ts:63`; `fetchOwnClasses`. **Card:** BE-19. **Contract:** missing.

### M08-05 `GET /api/performance/classes/:id`
Purpose: class dashboard S5.
- **Roles/auth:** any session, with an access rule: admin any classroom; teacher own classroom (`teacherId = viewer`); school_admin a classroom whose `schoolId` equals own `schoolId` (M27-T0c); school classes (`sc-{id}`) and all other roles are refused. Matrix: Guru and Admin Sekolah Prestasi.
- **Request:** path `id` int.
- **Response:** `200 {data: ClassDashboard}` (T:451): `class{id,name,school,subject,year,joinCode}`, `stats{students,accuracy,sessions,answered,avgMinutes,active7d}`, `headcount{configId,onTrack,below,noData,pct{on,below,none},avgTov,avgEtr}|null`, `attention[{userId,name,sessions,accuracy|null}]`, `trend[{date,sessions,avgAccuracy,activeStudents}]`, `ranking[{rank,userId,name,sessions,answered,accuracy|null,headcount on|below|na,lastActiveAt|null}]`. Computation (`class-performance.ts`): members = active enrolments; figures from practice-mode sessions of the members in the class subject (all subjects if the class has none); `stats.accuracy` = sum(correct)/sum(answered); `avgMinutes = seconds/sessions/60` (1 dp, 0 if no sessions); `active7d` = distinct members with a session in the last 7 days; `trend` = one point per MYT date with sessions in the last 30 days (today and 29 before), `avgAccuracy` = sum correct/sum answered of that day; `headcount` = the class's most recently updated config: per non-dropped roster line the band of the latest AR (above+on = onTrack, below, else noData), pct = share of total, avgTov/avgEtr from the config summary, null when the class has no config. `ranking`: members by raw accuracy desc (null last), ties by user id. `attention` = members with accuracy < 50 (desc), then members with no sessions (by id).
- **Errors:** `404 NOT_FOUND` "Not Found." for unknown class, a school class, or a class the viewer may not open (module rule BR-M08-26: 404 not 403). 401.
- **Handler:** `class.ts:31`; `fetchClassDashboard`. **Card:** BE-19. **Contract:** missing.

### M08-06 `GET /api/performance/students/:userId`
Purpose: Prestasi 360 of one pupil (S6).
- **Roles/auth:** any session plus `mayOpenStudent`: admin any; teacher a pupil in any own class (or self); school_admin pupil of own school; student self only; ppd_officer pupil whose school `district` equals the officer's `ppdDistrict`; jpn_officer pupil whose school `state` equals officer `ppdState`; other roles none.
- **Request:** path `userId` int.
- **Response:** `200 {data: StudentPerformance}` (T:167): `user{id,name,initial}`, `heroAccuracy` (rounded accuracy), `streak`, `stats{sessions,accuracy,answered,seconds}`, `headcount[]` (cards per config holding an entry; chips TOV, OTRn for keyed ARs, ETR), `mastery[{subjectCode,subjectName,color,accuracy,sessions,answered}]` (practice sessions grouped by subject; ordered by answered desc then code), `activity{streakCurrent,streakBest,koinTotal,practiceDays}` (streak from M14 `streak`, `koinTotal` = wallet `currentSyiling`, `practiceDays` = stored learner activity counter), `badges[{icon,name}]` (M14 learner badges), `heatmap[{date,sessions}]` (90 MYT days ending today), `weakTopics[WeakTopic]` (stored SP records with source `log`, accuracy < 50, lowest first; `focusCount = min(available questions, 25)`), `suggestions[{kind,text}]` (ordered BM sentences; text templates in `repository/student.ts:suggestionsOf`, kinds inactive, no-sessions, subject, topic, headcount, start).
- **Errors:** `404 NOT_FOUND` "Not Found." unknown user id; `403 FORBIDDEN` "This action is unauthorized." not permitted. 401.
- **Handler:** `student.ts:16`; `fetchStudentPerformance`. **Card:** BE-19. **Contract:** missing.

### M08-07 `GET /api/analytics/me`
Purpose: the viewer's own adaptive analytics (S7, Analitik Adaptif).
- **Roles/auth:** any session (the data is the viewer's own; non-student roles just get whatever SP records they own, usually empty).
- **Response:** `200 {data: Analytics}` (T:235): `userLevelId` (user's `grade`), `topWeak[WeakSp]` (4 weakest), `subjects[AnalyticsSubject]`. Per subject: accuracy = sum correct / sum answered over the user's SP records; `counts{mahir,sederhana,lemah,belum}` by SP band of records with answered > 0, `belum` = tiles without a band; `map.tiles` = every SP of the subject at the user's level (DSKP bidang -> SK -> SP) with `status`; `ringTotal` = tile count unless mahir exceeds it; `weak` = lemah SPs, lowest accuracy first (ties by record order); `available` = M04 questions available for the SP; `focusCount = min(available,25)`; `projection {low: grade(accuracy-10), high: grade(accuracy+10)}`; `trend` = last 30 days vs previous 30 days accuracy from sessions (>= +5 up, <= -5 down, else stable; stable when either window is empty). Subjects ordered by subject id.
- **Errors:** 401. **Handler:** `student.ts:29`; `fetchAnalytics`. **Card:** BE-19. **Contract:** missing.

### M08-08 `GET /api/analytics/classes`
Purpose: class analytics with risk filter (S8).
- **Roles/auth:** `admin` and `teacher` only; others `403`.
- **Request (query):** `classroomId` int (optional; default = first own class for a teacher, none for admin), `subjectId` int (default = first subject option), `riskLevel` critical|high|medium|low (unknown or absent = all levels).
- **Response:** `200 {data: ClassAnalytics}` (T:491): `options{classes[{id,name}], subjects[{id,name}], selected{classroomId,subjectId,riskLevel}}`, `summary{students,accuracy,atRisk,good}|null`, `rows[{userId,name,accuracy,answered,trend,projection{low,high},riskLevel}]`. Computation: rows are stored risk profiles for (class, subject) filtered by risk level, ordered by class member order; `summary.accuracy` = mean of row accuracies (1 dp), `atRisk` = critical + high rows, `good` = low rows; `summary` is null when there are no rows. `options.classes` = teacher's active classrooms (admin none). `subjects` = for class id 4 a fixed observed list of subject ids `[1,11,9,12,10,3,8,23,17,5]`; for other classes the class subject then subjects of stored profiles.
- **Errors:** `403 FORBIDDEN` "This action is unauthorized." for other roles, and for a class the viewer may not open (admin any, teacher own). An unknown `classroomId` is not an error: `cls` null, empty payload. 401.
- **Handler:** `class.ts:43`; `fetchClassAnalytics`. **Card:** BE-19. **Contract:** missing.

### M08-09 `GET /api/item-analysis/school`
Purpose: school item analysis of the viewer's own school (S9).
- **Roles/auth:** admin, teacher, school_admin, student, ppd_officer, jpn_officer (parent/sponsor: `403`). Matrix row 6.
- **Request (query):** `tingkatan` T4|T5 (anything else = null = all).
- **Response:** `200 {data: SchoolItemAnalysis}` (T:262) with `variant: "own"`: `school{id,name,code,type,district,state}`, `tingkatan`, `students`, `answers|null`, `correct|null`, `accuracy|null`, `difficulty{mudah,sederhana,sukar}`, `gps{value,band,entries,years[{year,gps}]}`, `subjects[{subjectId,name,pupils,questions,accuracy,wrong}]`, `questions[SchoolItemQuestion]` (T:245). The school question list is the stored item-statistics set (display data, DATA-M08-11); the GPS block is computed from headcount entries of that school. Header figures `answers/correct/accuracy` are null when the view has no observed header (DV-M08-32).
- **Errors:** `403 FORBIDDEN` for roles outside the list; `404 NOT_FOUND` when the viewer has no school, the school is unknown, or no analysis exists for it. 401.
- **Handler:** `item-analysis.ts:83` (`schoolHandler`); `fetchSchoolItemAnalysis`. **Card:** BE-19. **Contract:** missing.

### M08-10 `GET /api/item-analysis/school/:schoolId`
Purpose: same, for a given school id (variant `byId`).
- **Roles/auth:** as above plus: admin any school; other roles only their own school; ppd_officer a school of own `ppdDistrict`; jpn_officer a school of own `ppdState`; else `403`.
- **Request:** path `schoolId` int; query `tingkatan`.
- **Response:** `200 {data: SchoolItemAnalysis}` with `variant: "byId"`. For admin an unknown school id is NOT an error: it answers the empty payload (`school.name ""`, zero counts, `gps.value null`, empty `subjects` and `questions`; FR-M08-143). Order of checks: role gate (403), scope gate (403 for a non-admin whose own school differs, including an unknown id, unless officer coverage matches), unknown id = empty payload, then the analysis (`404` if none).
- **Errors:** 403 (role or out of scope), 401.
- **Handler:** `item-analysis.ts:88`; same client. **Card:** BE-19. **Contract:** missing.

### M08-11 `GET /api/item-analysis/classes`
Purpose: class list for the item analysis picker (S10).
- **Roles/auth:** admin (every classroom, newest `createdAt` first, ties by class id) and teacher (own classrooms, active and inactive, `isActive` flag included). Others `403`.
- **Response:** `200 {data: ClassCard[]}` (T:141).
- **Errors:** `403 FORBIDDEN` "This action is unauthorized." for student/school_admin/other roles; 401.
- **Handler:** `item-analysis.ts:102`; `fetchItemAnalysisClasses`. **Card:** BE-19. **Contract:** missing.

### M08-12 `GET /api/item-analysis/classes/:id`
Purpose: class item analysis (S11): difficulty and discrimination.
- **Roles/auth:** admin any classroom; teacher own classroom.
- **Response:** `200 {data: ClassItemAnalysis}` (T:332): `class{id,name,subjectName,levelSlug,year,students}`, `analysis{questionCount, summary{mudah,sederhana,sukar}, difficulty[], discrimination{sufficient, rows[]}}`. Computation (`repository/item-analysis.ts`): answers of the class members to questions of the class subject (all answers when the class has no subject), tallied per question: attempts, distinct students, correct; `index = round(1 - correct/attempts, 2)`, `level` by index, `accuracy = correct/attempts` (1 dp); `wrongStudents[{userId,name,times}]` by user id; `popularWrong` = most selected wrong option (lowest option index on ties); rows ordered by index desc then question id. Discrimination: N = members with >=1 finished session in the class subject; `sufficient = N >= 4`; ranked by member accuracy desc (ties by id); group size `g = max(1, round(0.27 N))` upper and lower; `index = upperCorrectShare - lowerCorrectShare` (3 dp); rows with no answers in either group are skipped; ordered by index desc.
- **Errors:** `403 FORBIDDEN` "This action is unauthorized." for unknown class, school class, or class not allowed (documented exception: the live page is "Akses Ditolak"). 401.
- **Handler:** `item-analysis.ts:120`; `fetchClassItemAnalysis`. **Card:** BE-19. **Contract:** missing.

### M08-13 `GET /api/timeline`
Purpose: the viewer's own timeline (S16, "Timeline Saya").
- **Roles/auth:** any session (matrix row 39 is Murid; the mock does not gate by role).
- **Response:** `200 {data: Timeline}` (T:361): `{profileUrl: "/pelajar/{viewerId}", posts[TimelinePost]}`; `TimelinePost {id,userId,title,category,eventDate|null,story|null,photos[{url,caption|null}],createdAt}`; posts of the user as returned by the timeline store (`timelineRepo.forUser`, store order).
- **Errors:** 401. **Handler:** `social.ts:78`; `fetchTimeline`. **Card:** BE-19. **Contract:** missing.

### M08-14 `POST /api/timeline`
Purpose: create a timeline post with photos (S17).
- **Roles/auth:** any session.
- **Request:** `multipart/form-data`: `title` string (required, trimmed, <=150), `category` one of `sijil|pencapaian|aktiviti|cerita|lain` (required), `eventDate` `YYYY-MM-DD` (optional), `story` string <=2000 (optional), `photos` (or `photos[]`) 1 to 5 files, JPEG/PNG/WebP, <= 2 MB each, `captions[i]` / `captions[]` per photo (trimmed, truncated to 200, empty = null).
- **Response:** `201 {data: TimelinePost}`. The mock stores each photo as a `data:` URL; the real API stores via the BE-04 file storage and returns a URL.
- **Errors:** `422 VALIDATION_ERROR` with `fields`, copy: title `Tajuk diperlukan.` / `Tajuk terlalu panjang (maks 150 aksara).`; category `Kategori tidak sah.`; eventDate `Tarikh tidak sah.`; story `Cerita terlalu panjang (maks 2000 aksara).`; photos `Sila muat naik sekurang-kurangnya 1 gambar.` (count < 1 or > 5) / `Gambar tidak sah (JPEG, PNG atau WebP, maks 2MB).`. Message = first field message with "(and N more error(s))". 401.
- **Side effects:** inserts a `timeline_posts` row (userId = viewer, createdAt = now ISO).
- **Handler:** `social.ts:88`; `createTimelinePost`. **Card:** BE-19. **Contract:** missing.

### M08-15 `GET /api/public/students/:id`
Purpose: public pupil profile (S18), no session required.
- **Roles/auth:** none (`[]` middleware): anonymous allowed. Privacy note: exposes name and school of any user id; see OQ-API-B3-2.
- **Request:** path `id` int.
- **Response:** `200 {data: PublicProfile}` (T:376): `id,name,firstName,schoolName,levelName,joinedAt,daysWith,tier{key,name,emoji,level,ordinal,progressPct,toNext,nextName,nextKey},syiling,streak{current,best},accuracy,activity{sessions,practiceDays,correct,bestStreak},posts[]`. Computation: sessions = practice-mode sessions of the user; `accuracy = round(cap(correct/asked*100),1)`; `practiceDays` = distinct MYT dates with a session; `joinedAt` = stored activity `joinedAt` else `user.createdAt`; `daysWith = floor((now - joinedAt)/86400000)`; tier, syiling, level from M14 wallet summary; `ordinal` = 1-based position of the tier among active tiers by `minSyiling`; `levelName` from `profileLevelId` else user grade via M03.
- **Errors:** `404 NOT_FOUND` "Not Found." for an unknown id. Note: the mock does not check the user's role or active state.
- **Handler:** `social.ts:141`; `fetchPublicProfile`. **Card:** BE-19. **Contract:** missing.

### M08-16 `GET /api/rankings`
Purpose: national/state/district/school ranking table (S19, Kedudukan).
- **Roles/auth:** any session.
- **Request (query):** `scope` nasional|negeri|daerah|sekolah (absent = nasional; unknown value -> `scope: null`, rows still computed unfiltered), `subjectId` int (absent = the "all" figure key), `tingkatan` T4|T5 (level id 10/11), `negeri` state name (required for rows when scope = negeri, else empty).
- **Response:** `200 {data: Ranking}` (T:411): `scope, title "Kedudukan {Nasional|Negeri|Daerah|Sekolah|<state>}", showFooter (scope = nasional), states[] (sorted distinct states of the ranking store), rows[{rank,userId|null,name,schoolName,tahap,correct,accuracy}], total`. Data is the stored ranking entries (display data, per-subject figures keyed by subject id). daerah and sekolah filter by the viewer's own school district/name (empty if the viewer has no school). Order: `correct` ASCENDING (observed, DV-26), then accuracy desc, then entry id; `accuracy` capped 100, 2 dp.
- **Errors:** 401. **Handler:** `social.ts:194`; `fetchRankings`. **Card:** BE-19. **Contract:** missing.

### M08-17 `GET /api/leaderboard`
Purpose: coin leaderboard (S20, Papan Pendahulu).
- **Roles/auth:** any session.
- **Request (query):** `period` all|week|month (unknown = week). Windows (MYT): week from Monday 00:00, month from the 1st, all = everything.
- **Response:** `200 {data: Leaderboard}` (T:430): `period, me{rank|null,coins,sessions,accuracy}, rows[{rank,userId|null,name,avatarUrl,coins,sessions,accuracy}] (top 50), participants (= rows.length)`. List = stored standings for the period (display data for observed/generated learners) plus computed standings for designed learner ids `[2,4,3001..3008]` and the viewer, built from their sessions in the window (coins = sum `coinsEarned`, accuracy = mean of per-session accuracy). Sorted coins desc, accuracy desc, stable order.
- **Errors:** 401. **Handler:** `social.ts:208`; `fetchLeaderboard`. **Card:** BE-19. **Contract:** missing.

### M08-18 `GET /api/weekly-report`
Purpose: Laporan Mingguan (S21): answers `403` for every role by design (observed on live; OQ-M08-01).
- **Roles/auth:** any session -> always 403.
- **Errors:** `403 FORBIDDEN` "This action is unauthorized." 401 without session.
- **Handler:** `social.ts:215`; `fetchWeeklyReport`. **Card:** BE-19 (reproduce the 403; see OQ-API-B3-3). **Contract:** missing.

### M08-19 `GET /api/headcounts`
Purpose: the viewer's own headcount configs (S12).
- **Roles/auth:** `requireRole('admin','teacher','school_admin')` (other roles `403`; 401 without session). Matrix row 3 (Murid also has "Headcount" in the matrix but the mock denies pupils on every `/api/headcounts*` route: see OQ-API-B3-4).
- **Response:** `200 {data: HeadcountListItem[]}` (HT:10): `{id,className,subjectName,levelName,year,mode,activeOtrs,students}`; configs where `teacherId = viewer.id`, newest `updatedAt` first, then id desc (admin and school_admin therefore normally get `[]`). `students` = non-dropped roster size (active class members plus pupils holding an entry).
- **Errors:** 401, 403 (role). **Handler:** `headcount.ts:105`; `fetchHeadcounts`. **Card:** BE-19. **Contract:** missing.

### M08-20 `GET /api/headcounts/dashboard`
Purpose: headcount dashboard S13.
- **Roles/auth:** same guard. **Response:** `200 {data: {configs: HeadcountDashboardConfig[]}}` (HT:22), own configs. Per config: `onTrack/offTrack/noData` count non-dropped roster lines by pair status (latest AR vs target: on / below / none), `totalStudents`, `chart {labels OTR1..OTRn, target[], actual[]}` where each point is the mean (1 dp) over non-dropped pupils of that checkpoint's target / AR, null if none.
- **Handler:** `headcount.ts:110`; `fetchHeadcountDashboard`. **Card:** BE-19. **Contract:** missing.

### M08-21 `GET /api/headcounts/form-options`
Purpose: selects for the create form (S14).
- **Roles/auth:** same guard. **Response:** `200 {data: HeadcountFormOptions}` (HT:42): `classes` (viewer's own active classrooms `{id,name}`; empty for non-teachers), `subjects` (active M03 subjects `{id,name,code}` by name then id), `levels` = ids 10 and 11 with M03 names, `defaultYear` = current MYT year.
- **Handler:** `headcount.ts:115`; `fetchHeadcountFormOptions`. **Card:** BE-19. **Contract:** missing.

### M08-22 `POST /api/headcounts`
Purpose: create a headcount config (S14).
- **Roles/auth:** same guard (admin/teacher/school_admin), but class must be one of the viewer's own active classrooms, so in practice teacher.
- **Request (JSON):** `classroomId` int-or-digit-string (required, must be own active class), `subjectId` (must exist in M03), `educationLevelId` 10 or 11, `academicYear` 2020-2100, `activeOtrs` 2|3|4|5, `mode` `auto|manual`.
- **Response:** `201 {data: {id}}`.
- **Errors:** `422 VALIDATION_ERROR` with fields: `classroomId` `Kelas diperlukan.` (missing/non-int) or `Kelas tidak sah.` (not own); `subjectId` `Subjek tidak sah.`; `educationLevelId` `Tingkatan tidak sah.`; `academicYear` `Tahun akademik mesti antara 2020 dan 2100.`; `activeOtrs` `Bilangan OTR mesti 2, 3, 4 atau 5.`; `mode` `Mod pengiraan tidak sah.`. `409 CONFLICT` for the same class + subject + year + mode: `Headcount Auto untuk kelas, subjek dan tahun ini sudah wujud.` (auto) / `Headcount Manual untuk kelas, subjek dan tahun ini sudah wujud.` (manual).
- **Side effects:** inserts a config (status `active`, no entries; `teacherId` = viewer, createdAt/updatedAt = now).
- **Handler:** `headcount.ts:129`; `createHeadcount`. **Card:** BE-19. **Contract:** missing.

### M08-23 `POST /api/headcounts/auto-setup`
Purpose: create default configs for chosen levels over the viewer's own classes (S12 modal).
- **Roles/auth:** same guard. **Request:** `{levels: (number|string)[]}`, non-empty; each a level id 1-11 or `D1`-`D6` (1-6) / `T1`-`T5` (7-11), case-insensitive.
- **Response:** `200 {data: {created: number}}`. For each own active classroom whose `levelId` is in `levels` and that has a subject, skipped if a config exists for the same class + subject + current year (any mode); created with `activeOtrs: 3`, `mode: auto`.
- **Errors:** `422` `levels` `Pilih sekurang-kurangnya satu tingkatan.` (missing/empty), `levels` `Tingkatan tidak sah.` (bad value). 
- **Side effects:** inserts configs. **Handler:** `headcount.ts:179`; `autoSetupHeadcounts`. **Card:** BE-19. **Contract:** missing.

### M08-24 `GET /api/headcounts/students/:userId`
Purpose: a pupil's headcount sections (S15).
- **Roles/auth:** admin/teacher/school_admin guard. admin: any pupil, all configs. school_admin: pupil of own school only, configs of own school. teacher: pupil must be in an own class or hold an entry in an own config; only own configs shown.
- **Response:** `200 {data: HeadcountStudent}` (HT:114): `student{id,name,school}`, `sections[HeadcountSection]` (HT:82) one per visible config with an entry, config id ascending: `status, tov, etr, rs{value,recordedAt}|null, projection{value,variant,trend,confidence}|null, rows[{checkpoint,target,targetGrade,ar,arGrade,tone}], prediction{etr,rs,diff,verdict}|null, chart{labels,target,actual,projection,rs}`. Projection (`headcount-views.ts:314`, INFERRED) = last AR + mean step, clamped 0-100; prediction diff = RS - ETR (1 dp), `|d|<=5 Ramalan Tepat`, `<=10 Hampir Tepat`, else `Selisih Besar`.
- **Errors:** `404 NOT_FOUND` unknown or non-student user; `403 FORBIDDEN` out of scope. A pupil with no visible entry gets `200` with `sections: []` (dropped entries are excluded).
- **Handler:** `headcount.ts:215`; `fetchHeadcountStudent`. **Card:** BE-19. **Contract:** missing.

### M08-25 `GET /api/headcounts/:id/summary`
Purpose: class summary (S22).
- **Roles/auth:** guard; config access `mayUse`: admin any, teacher own config (`teacherId`), school_admin config whose class/teacher school = own school.
- **Response:** `200 {data: HeadcountSummary}` (HT:120): `config{id,subject,className,levelName,year,activeOtrs}`, `students` (non-dropped), `avgTov`, `avgEtr` (1 dp means), `otrs[{n,above,onTrack,below,na}]` counts per checkpoint by band status of that checkpoint's AR vs target.
- **Errors:** `404` unknown config (checked before 403), `403` not permitted. **Handler:** `headcount.ts:248`; `fetchHeadcountSummary`. **Card:** BE-19. **Contract:** missing.

### M08-26 `GET /api/headcounts/:id/export`
Purpose: CSV download of the S23 table.
- **Roles/auth:** as summary. **Request:** query `sort` ranking|name (default ranking).
- **Response:** `200` file `text/csv`, `Content-Disposition: attachment; filename="headcount-{id}.csv"`. Content (`headcount-views.ts:csvOf`): UTF-8 with BOM, CRLF; columns `Bil, Nama, TOV (%), Gred TOV`, per OTR target/AR with grades, `ETR (%), Gred ETR`, one line per shown (not dropped) pupil in the chosen order plus a "Purata Kelas" line. Column titles are UNVERIFIED against live (L-12).
- **Errors:** 404, 403. **Handler:** `headcount.ts:259`; `downloadHeadcountCsv`. **Card:** BE-19. **Contract:** missing.

### M08-27 `GET /api/headcounts/:id`
Purpose: headcount table (S23).
- **Roles/auth:** as summary. **Request:** query `sort` ranking (latest AR desc, no AR last, then name) | name.
- **Response:** `200 {data: HeadcountDetail}` (HT:157): `config{id,subject,className,levelName,year,teacherName,status "active",activeOtrs}`, `chips{onTrack,below,empty,total}` (non-dropped lines by band of latest AR: above+on = onTrack), `rows[HeadcountRow]` (includes dropped rows with `dropped: true`), `averages{tov,otrs[],ars[],etr}` (1 dp means over non-dropped rows).
- **Errors:** 404, 403. **Handler:** `headcount.ts:272`; `fetchHeadcountDetail`. **Card:** BE-19. **Contract:** missing.

### M08-28 `POST /api/headcounts/:id/reset`
Purpose: clear all marks of a config ("Ya, Reset").
- **Roles/auth:** as summary. **Response:** `200 {data: {reset: true}}`.
- **Side effects:** every entry of the config gets `tov, etr, rs, rsRecordedAt` null and `targets, actuals` blank slots (`activeOtrs` length); config `updatedAt` refreshed.
- **Errors:** 404, 403. **Handler:** `headcount.ts:283`; `resetHeadcount`. **Card:** BE-19. **Contract:** missing.

### M08-29 `DELETE /api/headcounts/:id`
Purpose: delete a config ("Ya, Padam").
- **Roles/auth:** as summary. **Response:** `200 {data: {deleted: true}}` (not 204). **Side effects:** removes the config and its entries.
- **Errors:** 404, 403. **Handler:** `headcount.ts:296`; `deleteHeadcount`. **Card:** BE-19. **Contract:** missing.

### M08-30 `POST /api/headcounts/:id/drop-students`
Purpose: drop or restore pupils in a config ("Gugurkan" / "Kembalikan").
- **Roles/auth:** as summary. **Request:** `{action: "drop"|"restore", studentIds: int[]}`; every id must be in the config roster (active class members plus pupils holding an entry).
- **Response:** `200 {data: {updated: number}}` = number of pupils whose flag changed (distinct ids). Dropping a pupil without an entry creates an empty entry (INFERRED).
- **Errors:** 404/403 as above; `422` fields `action` `Tindakan tidak sah.`, `studentIds` `Pilih sekurang-kurangnya seorang murid.` (empty) or `Murid tidak sah.` (id not in roster).
- **Side effects:** sets `dropped` flag, updates config `updatedAt`. **Handler:** `headcount.ts:309`; `dropHeadcountStudents`. **Card:** BE-19. **Contract:** missing.

## 5. M10 Teacher and class (`src/modules/m10-teacher-class/mock/handlers`)

Count: **39** `route(` registrations (classes 3, students 3, dashboard 2, lookups 7, questions 8, extras 4, student-side 3, command-center 9). The brief and plan 6.3 say 33 (and list the Command Center routes separately as "CC routes"); the grep gives 30 non-Command-Center routes plus 9 Command Center routes. Types: `api/types.ts` (T), `api/command-center-types.ts` (CT). Clients: `api/guru.ts`, `api/command-center.ts`. The teacher DSKP reads `GET /api/guru/dskp/{bidang,sk,sp}` are registered by M04 (`m04-question-bank/mock/handlers/dskp.ts`), not here (see `lookups.ts` header); they belong to another catalogue part.

Module-wide facts:

- Guards (`handlers/common.ts`): `teacherOnly = requireRole('teacher','admin')` (401 without session, `403 FORBIDDEN` "This action is unauthorized." for student, parent, sponsor, school_admin, ppd/jpn officers); `anySession = requireAuth()`. School admin has no access to the `/api/guru/*` routes (matrix: Admin Sekolah has no Kelas Saya/Sumbang Soalan/Pelajar Saya). Command Center for school_admin is served by M17 (section 8), not by these routes.
- Ownership: a class, student list or test belongs to the viewer when `classroom.teacherId = viewer`; there is no school-wide teacher view in M10. Admin passes the guard but sees only records it owns (normally none), except where stated.
- Body readers accept JSON and multipart; integers may be digit strings (`intOf`). Wire ids are decimal strings in v2; the mock uses numbers.
- Response forms vary by endpoint and the backend must reproduce each: `ok/created` = `{data}`; `unpaged/paged` = `{data, meta}`; `raw(...)` = **bare JSON body without `{data}`** (all lookups, qr-data, contributions, remedial-progress, galeri-rajah, all Command Center GETs); "inline create refusal" = `200 {"error": "<message>"}` (string, not the standard error object).
- Validation copy in `handlers/common.ts:MSG` is "UNVERIFIED COPY (OQ-M10-16)": the exact BM strings below are what the mock emits and must be reproduced.
- Standard errors (apply to every route unless said): 401 `UNAUTHORIZED` "Unauthenticated."; 403 `FORBIDDEN` "This action is unauthorized."; `404 NOT_FOUND` "Not Found." (unknown route or non-digit `:id`); 422 `VALIDATION_ERROR` with `fields` (message = first field message + " (and N more error(s))").

### M10-01 `GET /api/guru/dashboard`
Purpose: teacher dashboard S1 (checklist, counters, active classes).
- **Roles/auth:** teacher, admin (`teacherOnly`). Matrix row 2 (Dashboard Guru).
- **Scope:** viewer's own classes and students only.
- **Response:** `200 {data: GuruDashboard}` (T:31): `checklist{hasClass,hasStudents,hasMission}`; `stats{activeClasses,totalClasses,students,questions,questionsApproved,assignments}`; `today{students:[],topics:[],actions:[]}`, `peerTutor:[]`, `submissions:[]` (always empty in the mock, OQ-M10-11); `classes[{id,name,studentCount}]` (active classes only).
- **Computation:** `totalClasses` = classes owned by viewer (all kinds returned by `classrooms.forTeacher`); `activeClasses` = those with `isActive`; `students` = distinct students with an active enrolment in an active class of the viewer (`teacherStudentIds`); `hasMission` = viewer has any mission row; `assignments` = constant 0; `questions`/`questionsApproved` = M04 contributions counts (objective questions with `createdBy = viewer`, PKSK excluded, total and approved) plus the viewer's structured questions (total / published). For the snapshot admin (user id 1, `SNAPSHOT_USER_ID`) the figures are display constants 20719 and 19361.
- **Errors:** standard 401/403.
- **Handler:** `dashboard.ts:50`; `fetchGuruDashboard`. **Card:** BE-17. **Contract:** missing.

### M10-02 `GET /api/guru/remedial-progress`
Purpose: remedial test progress S3.
- **Roles/auth:** `teacherOnly`; own tests only.
- **Response:** `200` **bare body** `RemedialProgress` (T:59): `stats{total,completed,students,avgImprovement}`, `rows[{id,studentName,subjectName,status,beforeAccuracy,afterAccuracy|null}]`. `total` = tests not cancelled; `completed` = status completed; `students` = distinct students of counted tests; `avgImprovement` = round(mean(afterAccuracy - beforeAccuracy)) over completed tests with `afterAccuracy` (0 if none); `rows` = every test of the viewer incl. cancelled, newest first (`remedialTests.forTeacher` order).
- **Handler:** `dashboard.ts:81`; `fetchRemedialProgress`. **Card:** BE-18. **Contract:** missing.

### M10-03 `GET /api/guru/classes`
Purpose: the viewer's own classes (S4).
- **Roles/auth:** `teacherOnly`. **Request:** none (not paginated).
- **Response:** `200 {data: GuruClass[], meta}` using the single-page list meta (`page 1`, `pageSize = max(1,n)`, `totalItems n`, `totalPages 1`, `from/to`). `GuruClass` (T:77): `id,kind,teacherId,schoolId,name,subjectId,subjectName,educationLevel (slug),levelId,levelLabel ("Tahun n"/"Ting. n"),academicYear,description,joinCode,isActive,createdAt,studentCount` (active enrolments). Own classes, newest first, active and inactive.
- **Handler:** `classes.ts:63`; `fetchGuruClasses`. **Card:** BE-17. **Contract:** missing.

### M10-04 `POST /api/guru/classes`
Purpose: create a class (S5).
- **Roles/auth:** `teacherOnly`; owner = viewer.
- **Request (JSON/multipart):** `name` string 1-255 (required), `subjectId` int of an active M03 subject (required), `educationLevel` one of the 11 slugs (`LEVEL_SLUGS`, required), `schoolId` int of an existing M02 school (optional, null allowed), `description` string <= 2000 (optional).
- **Response:** `201 {data: GuruClass}`. Side effect: inserts a classroom with a unique 6-character join code (BR-M10-02), `isActive` true, academic year from the clock.
- **Errors:** `422` fields (copy): `name` `Sila isi nama kumpulan.` (blank) / `Medan ini tidak sah.` (>255); `subjectId` `Sila pilih subjek.`; `educationLevel` `Sila pilih tahap pendidikan.`; `schoolId` `Sekolah tidak sah.`; `description` `Medan ini tidak sah.`.
- **Handler:** `classes.ts:67`; `createGuruClass`. **Card:** BE-17. **Contract:** missing.

### M10-05 `GET /api/guru/classes/:id/qr-data`
Purpose: join-QR data of an own class.
- **Roles/auth:** `teacherOnly`; the class must be an own classroom (`teacherId = viewer`).
- **Response:** `200` **bare** `{name, school|null, joinUrl}` with `joinUrl = https://prestasiplus.my/kelas-saya?kod={joinCode}` (PROPOSED; the host must come from configuration in the real API).
- **Errors:** `404 NOT_FOUND` "Not Found." for unknown, not owned, or school class (never names a model).
- **Handler:** `classes.ts:111`; `fetchClassQrData`. **Card:** BE-17. **Contract:** missing.

### M10-06 `GET /api/guru/students`
Purpose: "Pelajar Saya" (S6).
- **Roles/auth:** `teacherOnly`.
- **Request (query):** `tab` `mine|school` (anything else = mine), `search` string (case-insensitive name contains).
- **Response:** `200 {data: GuruStudent[], meta: {count, schoolSet}}` (T:121, 130). `GuruStudent {id,name,levelName|null (M03 level of the user's grade),classNames[]}` where `classNames` are the viewer's own active classes the student is in. `mine`: distinct students with an active enrolment in an active class the viewer owns. `school`: active student accounts of the **teacher profile** school (`teacher_profiles.school`, not `users.school_id`), at most 200 rows; no profile school gives `[]` with `schoolSet: false`. Ordered by name A-Z then id. `meta.count` = matches before the 200 cap; `schoolSet` = teacher profile has a school. NOTE: `meta` here is NOT the standard list meta (no page fields).
- **Handler:** `students.ts:90`; `fetchGuruStudents`. **Card:** BE-17. **Contract:** missing.

### M10-07 `PUT /api/guru/students/:id`
Purpose: add a student to an own class (INFERRED control, S6).
- **Roles/auth:** `teacherOnly`. **Request:** body `{classroomId}` int; path `id` = student user id.
- **Response:** `200 {data: ClassroomStudent}` (T:137): `{classroomKind,classroomId,studentId,status,source:"teacher",joinedAt}`. Side effect: inserts an active enrolment with source `teacher`.
- **Errors (check order):** `422` `classroomId` `Kelas tidak sah.` (missing/<1); `404` `Pelajar tidak dijumpai.` (user not found or not a student); `404` `Kelas tidak sah.` (class unknown); `403` `Kelas ini bukan milik anda.`; `403` `Pelajar bukan daripada sekolah anda.` (teacher profile has no school, or student's `schoolId` differs); `409 CONFLICT` `Pelajar sudah berada dalam kelas ini.`.
- **Handler:** `students.ts:121`; `addStudentToClass`. **Card:** BE-17. **Contract:** missing.

### M10-08 `DELETE /api/guru/students/:id`
Purpose: remove a student from an own class.
- **Roles/auth:** `teacherOnly`. **Request:** path `id` student; query `classroomId`.
- **Response:** `200 {data: {removed: 1}}`. Side effect: enrolment status becomes `removed`.
- **Errors:** `422` `classroomId` `Kelas tidak sah.`; `404` `Kelas tidak sah.` (unknown class); `403` `Kelas ini bukan milik anda.`; `404` `Pelajar tiada dalam kelas ini.`.
- **Handler:** `students.ts:155`; `removeStudentFromClass`. **Card:** BE-17. **Contract:** missing.

### M10-09 `GET /api/guru/chapters`
Purpose: chapter options for a subject and level (M03 data).
- **Roles/auth:** `teacherOnly`. **Request (query):** `subjectId`, `educationLevelId` ints; if either is missing the answer is `[]`.
- **Response:** `200` **bare array** `ChapterOption[]` (T:150) `{id,chapterNumber,name}` of active chapters (M03 order). Unknown parents also give `[]`, never an error.
- **Handler:** `lookups.ts:32`; `fetchChapters`. **Card:** BE-17 (delegates to the M03 repository, BE-08 owns the data). **Contract:** missing.

### M10-10 `POST /api/guru/chapters`
Purpose: inline "Bab Baru".
- **Roles/auth:** `teacherOnly`. **Request:** `name` (1-255, required), `chapterNumber` int 1-99, `subjectId`, `educationLevelId` (must exist).
- **Response:** `201` bare `{id, chapterNumber, name}`. Side effect: creates an M03 chapter.
- **Errors (HTTP 200 with body `{"error": "<text>"}`):** `Nama bab diperlukan.`; `Nombor bab mesti antara 1 dan 99.`; `Subjek atau tahap tidak sah.`.
- **Handler:** `lookups.ts:45`; `createChapter`. **Card:** BE-17. **Contract:** missing.

### M10-11 `GET /api/guru/topics`
- **Roles/auth:** `teacherOnly`. **Request:** query `chapterId` int (missing/unknown gives `[]`).
- **Response:** `200` bare `TopicOption[]` `{id, topicNumber (string|null), name}` of active topics.
- **Handler:** `lookups.ts:68`; `fetchTopics`. **Card:** BE-17. **Contract:** missing.

### M10-12 `POST /api/guru/topics`
- **Roles/auth:** `teacherOnly`. **Request:** `name` (1-255), `chapterId` (existing).
- **Response:** `201` bare `{id, topicNumber, name}`; the topic number = max existing numeric topic number of the chapter + 1, stored as string. Side effect: creates an M03 topic.
- **Errors (200 `{"error"}`):** `Nama topik diperlukan.`; `Bab tidak sah.`.
- **Handler:** `lookups.ts:80`; `createTopic`. **Card:** BE-17. **Contract:** missing.

### M10-13 `POST /api/guru/dskp/bidang`
- **Roles/auth:** `teacherOnly`. **Request:** `name` (1-255), `subjectId`, `educationLevelId` (exist), `code` (optional, <= 50).
- **Response:** `201` bare `{id, code|null, name}`. Side effect: stores a DSKP bidang with `createdBy = viewer` (runtime ids start at 9,000,001 in the mock; the real API uses normal ids).
- **Errors (200 `{"error"}`):** `Nama bidang diperlukan.` (also for code > 50); `Subjek atau tahap tidak sah.`.
- **Handler:** `lookups.ts:100`; `createBidang`. **Card:** BE-18. **Contract:** missing.

### M10-14 `POST /api/guru/dskp/sk`
- **Request:** `bidangId` (existing), `code` (1-50), `description` (1-2000). **Response:** `201` bare `{id, code, description}`. **Errors (200 `{"error"}`):** `Kod dan keterangan SK diperlukan.`; `Bidang tidak sah.`.
- **Roles/auth:** `teacherOnly`. **Handler:** `lookups.ts:123`; `createSk`. **Card:** BE-18. **Contract:** missing.

### M10-15 `POST /api/guru/dskp/sp`
- **Request:** `skId` (existing), `code` (1-50), `description` (1-2000). **Response:** `201` bare `{id, code, description}`. **Errors (200 `{"error"}`):** `Kod dan keterangan SP diperlukan.`; `SK tidak sah.`.
- **Roles/auth:** `teacherOnly`. **Handler:** `lookups.ts:134`; `createSp`. **Card:** BE-18. **Contract:** missing.

### M10-16 `GET /api/guru/contributions`
Purpose: "Sumbang Soalan" S21 header: contribution stats, tiers, subject breakdown.
- **Roles/auth:** `teacherOnly`. Matrix row 44.
- **Response:** `200` bare `Contributions` (T:193): `stats{total,approved,pending,used}` from M04 Q-CONTRIB (objective questions with `createdBy = viewer`, PKSK excluded); `tiers[{name,threshold,icon,reached}]` eight fixed tiers (Penyumbang Baru 10, Penyumbang Aktif 100, Penyumbang Dedikasi 500, Penyumbang Cemerlang 1000, Penyumbang Terbilang 2500, Legenda Soalan 5000, Guru Maestro 10000, Legenda Terulung 50000) with `reached = total >= threshold`; `nextTier` = first not reached or null; `breakdown[{label,count}]` top 10 subjects by count (ties by name) plus `Lain` for the remainder.
- **Handler:** `questions.ts:417`; `fetchContributions`. **Card:** BE-17 (listed). **Contract:** missing.

### M10-17 `GET /api/guru/questions`
Purpose: "Soalan Saya" list.
- **Roles/auth:** `teacherOnly`. **Request:** query `page` (page size fixed 20; invalid = 1).
- **Response:** `200 {data: ContributedQuestion[], meta}` (T:209): the viewer's objective questions, ids ascending. Fields: `id,questionType,questionText,subjectId,subjectName,educationLevelId,levelName,difficultyLevel,difficultyLabel (1 Sangat Mudah, 2 Mudah, 3 Sederhana, 4 Sukar, 5 Sangat Sukar),dskpTagged,status,statusLabel (draft Draf, pending_review Menunggu Semakan, approved Diluluskan, rejected Ditolak, archived Diarkibkan, pending Menunggu),isActive,options,correctAnswer,explanation,source,createdAt`.
- **Handler:** `questions.ts:443`; `fetchContributedQuestions`. **Card:** BE-09 (listed: "Guru contribution endpoints, owner M04"). **Contract:** missing.

### M10-18 `POST /api/guru/questions`
Purpose: submit a question (S22).
- **Roles/auth:** `teacherOnly`. **Request:** JSON or multipart (`questionImage`, `optionImages[i]` files JPEG/PNG/WebP <= 2 MB).
  - Required: `educationLevelId` (existing M03 level), `subjectId`, `questionType` (`mcq|true_false|short_answer|fill_blank|essay`), `difficultyLevel` (`easy|medium|hard` -> 2/3/4, or 1-5), `questionText` (1-2000 chars).
  - `mcq`: `options` 4 non-empty strings (<= 500 each; also `{text}`/`{optionText}` objects), `correctAnswer` index 0-3 or letter A-D, optional `optionImages`.
  - `true_false`: `tfAnswer` boolean-ish. `short_answer|fill_blank`: `correctAnswerText` (or `correctAnswer`) 1-500, `altAnswers` (list or comma text). `essay`: optional `modelAnswer`.
  - Optional: `explanation`, `questionImageUrl`, `curriculumChapterId` (must match subject and level), `curriculumTopicId` (must belong to the chapter), `dskpSpId` (existing SP), `scriptType` `rumi|arab|jawi|mixed` (default rumi).
- **Response:** `201 {data: ContributedQuestionDetail}` (T:237) = summary plus `questionImage,optionImages,tfAnswer,correctAnswerText,altAnswers,modelAnswer,language,scriptType,textDirection,curriculumChapterId,curriculumTopicId,dskpSpId,usage{attempts,correct,accuracy}`.
- **Errors (422 fields, copy):** `educationLevelId` `Sila pilih tahap pendidikan.`; `subjectId` `Sila pilih subjek.`; `questionType` `Jenis soalan tidak sah.`; `difficultyLevel` `Sila pilih tahap kesukaran.`; `questionText` `Sila isi soalan.` / `Soalan tidak boleh melebihi 2000 aksara.`; `questionImage` / `optionImages.n` `Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB.`; `options` `Sila isi semua pilihan jawapan.` / `Pilihan jawapan tidak boleh melebihi 500 aksara.`; `correctAnswer` `Sila pilih jawapan betul.` (mcq) or `Sila masukkan jawapan betul.` / `Jawapan betul tidak boleh melebihi 500 aksara.`; `tfAnswer` `Sila pilih betul atau salah.`; `curriculumChapterId` `Bab tidak sah.`; `curriculumTopicId` `Topik tidak sah.`; `dskpSpId` `SP DSKP tidak sah.`; `scriptType` `Jenis tulisan tidak sah.`.
- **Side effects (one transaction):** creates the M04 question (mock today: status `pending_review`; real API: v2 lifecycle, D54a: `review`; active, `createdBy = viewer`) via `questions.createFromTeacher`; runs M14 `teacherGamification.onQuestionContributed` (+1 contribution, +10 syiling, badges reached).
- **Handler:** `questions.ts:449`; `createContributedQuestion`. **Card:** BE-09 (listed; also triggers M14 contributor counters, BE-11/BE-23 territory). **Contract:** missing.

### M10-19 `GET /api/guru/questions/template`
- **Roles/auth:** `teacherOnly`. **Response:** `200` file `text/csv` named `template-import-soalan.csv` (M04's `IMPORT_TEMPLATE_CSV`). `Content-Disposition: attachment`.
- **Handler:** `questions.ts:463`; `downloadQuestionTemplate`. **Card:** BE-10 (listed with the import). **Contract:** missing.

### M10-20 `POST /api/guru/questions/import`
Purpose: CSV import of contributed questions (S21).
- **Roles/auth:** `teacherOnly`. **Request:** multipart `csvFile` (`.csv`/`.txt`, <= 5 MB), or a JSON string with the file text. Required header columns come from M04's `planImport` (no defaults: each row must carry `subject_id`, `education_level_id`, `difficulty_level`); extra caps: question text <= 2000 and each option <= 500 chars.
- **Response:** `200 {data: {imported: n, failed: [{row, message}]}}`; failed rows sorted by file row (header = row 1). Valid rows are created (pending_review) and each triggers `onQuestionContributed`.
- **Errors (422, field `csvFile`):** `Sila pilih fail CSV.`; `Fail mesti jenis CSV atau TXT dan tidak melebihi 5MB.`; `Fail CSV mesti mempunyai kolum {a, b, ...}.` (missing columns); `Fail CSV tiada baris data.`. Row messages: `Soalan tidak boleh melebihi 2000 aksara.`, `Pilihan jawapan tidak boleh melebihi 500 aksara.`, plus M04's row messages.
- **Handler:** `questions.ts:467`; `importQuestions`. **Card:** BE-10 (listed). **Contract:** missing.

### M10-21 `GET /api/guru/questions/:id`
- **Roles/auth:** `teacherOnly`; own objective question only (`createdBy = viewer`, not PKSK). **Response:** `200 {data: ContributedQuestionDetail}`. **Errors:** `404 NOT_FOUND` "Not Found." for unknown or not own (ids cannot be probed).
- **Handler:** `questions.ts:503`; `fetchContributedQuestion`. **Card:** BE-09. **Contract:** missing.

### M10-22 `PUT /api/guru/questions/:id`
- **Roles/auth:** `teacherOnly`; own only. **Request:** `questionText` (required, 1-2000), optional `difficultyLevel` (kept when absent), for MCQ: `options` 4 items `{id 0-3, optionText}` (multipart `options[i][id]`/`options[i][optionText]`) plus `correctOptionId` (index or letter), `explanation`, `image`/`questionImage` file.
- **Response:** `200 {data: ContributedQuestionDetail}`; `404` if not own or vanished. **Errors (422):** `questionText` messages as create; `difficultyLevel` `Sila pilih tahap kesukaran.`; `options` `Sila isi semua pilihan jawapan.` / `Pilihan jawapan tidak boleh melebihi 500 aksara.`; `correctOptionId` `Sila pilih jawapan betul.`; `image` `Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB.`.
- **Side effects:** `questions.updateOwn`. **Handler:** `questions.ts:514`; `updateContributedQuestion`. **Card:** BE-09. **Contract:** missing.

### M10-23 `DELETE /api/guru/questions/:id`
- **Roles/auth:** `teacherOnly`; own only. **Response:** `200 {data: {removed: 1}}`; `404` unknown/not own. Side effect: `questions.deleteOwn`; contribution credit is not taken back.
- **Handler:** `questions.ts:534`; `deleteContributedQuestion`. **Card:** BE-09. **Contract:** missing.

### M10-24 `GET /api/guru/galeri-rajah`
- **Roles/auth:** `teacherOnly`. **Request:** query `folder` optional. **Response:** `200` bare `{folders: []}` or, when `folder` is non-empty, `{images: []}`; always empty (DV-M10-09).
- **Handler:** `extras.ts:65`; `fetchRajahGallery`. **Card:** BE-17 (listed; trivial). **Contract:** missing.

### M10-25 `POST /api/guru/question-papers`
Purpose: teacher uploads a question paper (becomes an M04 QuestionSubmission `pending`).
- **Roles/auth:** `teacherOnly`. **Request:** multipart `jenisSoalan` (one of `Soalan Umum|Trial Paper|Soalan DSKP|Buku Teks|Buku Latihan|Soalan Peperiksaan|Lain-lain`), `subject` (1-100), `tingkatan` 1-5 or `T1`-`T5` or empty, `tahun` 2000-2099 or empty (empty stored as the clock year), `disediakanOleh` (<= 150), `catatan` (<= 1000), `files` 1-5 of `.pdf .doc .docx .xls .xlsx`, each <= 20 MB.
- **Response:** `201 {data: QuestionPaper}` (T:371): `id,teacherId,subjectText,levelCode,year,paperType,authorCredit,note,files[{index,name,size,mime}],status ("pending"),adminNotes,createdAt`. Side effect: `submissions.create` (M04); the mock stores only file name, size and type; the real API must store the files via BE-04.
- **Errors (422):** `jenisSoalan` `Sila pilih jenis soalan.`; `subject` `Sila isi matapelajaran.` / `Matapelajaran tidak boleh melebihi 100 aksara.`; `tingkatan` `Tingkatan tidak sah.`; `tahun` `Tahun mesti antara 2000 dan 2099.`; `disediakanOleh` `Disediakan oleh tidak boleh melebihi 150 aksara.`; `catatan` `Catatan tidak boleh melebihi 1000 aksara.`; `files` `Sila pilih sekurang-kurangnya satu fail.` / `Maksimum 5 fail.` / `{name}: format atau saiz tidak dibenarkan.`.
- **Handler:** `extras.ts:71`; `submitQuestionPaper`. **Card:** BE-18 (listed); served by BE-37 `POST /api/intake/batches` after D53 OWN-1. **Contract:** missing.

### M10-26 `GET /api/guru/audio-kbat/template`
- **Roles/auth:** `teacherOnly`. **Response:** `200` file `text/csv; charset=UTF-8`, name `template-audio-kbat.csv`, UTF-8 BOM, header `tajuk,kod_subjek,kod_tingkatan,nama_fail_audio` and the example row `Contoh: KBAT Sains Bab 1,SCI,T4,kbat-sains-1.mp3` (cells quoted when they contain whitespace, comma or quote).
- **Handler:** `extras.ts:132`; `downloadAudioKbatTemplate('xlsx')` (label is historical; the file is CSV). **Card:** BE-18 (listed). **Contract:** missing.

### M10-27 `GET /api/guru/audio-kbat/template-word`
- **Roles/auth:** `teacherOnly`. **Response:** `200` file `.docx` (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`), name `template-audio-kbat.docx`: title `Template Set Audio KBAT`, intro line `Isi satu baris bagi setiap set. Muat naik fail audio melalui borang "Cipta Set" di /guru/audio-kbat.`, a table with headings `Tajuk, Kod Subjek, Kod Tingkatan, Nama Fail Audio` and example row `KBAT Sains Bab 1, SCI, T4, kbat-sains-1.mp3`.
- **Handler:** `extras.ts:139`; `downloadAudioKbatTemplate('word')`. **Card:** BE-18 (listed). **Contract:** missing.

### M10-28 `GET /api/kelas-saya`
Purpose: classes the user has joined (S33, Kelas Saya).
- **Roles/auth:** any session (`anySession`); data are the viewer's own active enrolments. Matrix row 8: Murid and Guru.
- **Response:** `200 {data: JoinedClass[], meta}` (single-page list meta): `{id,name,subjectName|null,teacherName|null,levelLabel}`; classrooms only (school classes excluded), newest first.
- **Handler:** `student-side.ts:67`; `fetchJoinedClasses`. **Card:** BE-17. **Contract:** missing.

### M10-29 `POST /api/kelas-saya/join`
Purpose: join a class by code.
- **Roles/auth:** any session, but only `student` and `admin` may join (`403 FORBIDDEN` "This action is unauthorized." for others).
- **Request:** `{classCode}` string, trimmed, matched case-insensitively against the stored join code (any length).
- **Response:** `201 {data: {classroomId}, message: "Berjaya menyertai kelas {name}."}` (top-level `message` besides `data`). Side effect: active enrolment, source `code`.
- **Errors:** `422` `classCode` `Sila masukkan kod kelas.`; `404 NOT_FOUND` `Kod kelas tidak sah.`; `409 CONFLICT` `Anda sudah menyertai kelas ini.`.
- **Handler:** `student-side.ts:83`; `joinClass`. **Card:** BE-17. **Contract:** missing.

### M10-30 `GET /api/set-soalan-saya`
Purpose: teacher question sets the student may start (S34).
- **Roles/auth:** any session. **Response:** `200 {data: StudentQuestionSet[], meta}` (single-page): `{id,title,teacherName|null,questionCount,timeLimitMinutes|null,attemptsLeft|null}`. Sets from `questionSets.visibleFor(user, now)` (draft never; scheduled once due). `attemptsLeft = max(0, maxAttempts - completed `question_set` sessions of the user for the set)`; null when `maxAttempts = 0` (unlimited).
- **Handler:** `student-side.ts:93`; `fetchMyQuestionSets`. **Card:** BE-18. **Contract:** missing.

#### Command Center (teacher), base `/api/guru/command-center`

Applies to the next nine endpoints. **Base path confirmed:** `const BASE = '/api/guru/command-center'` (`command-center.ts:56`). Roles: `teacherOnly` (teacher, admin); school_admin gets 403 here (its Command Center is `/api/admin/command-center/live-data`, section 8). Scope: the viewer's own students S = distinct students with an active enrolment in an active class the viewer owns (BR-M10-04); all figures come from the M05 answer log of S (practice answers), computed per request with MYT day windows (today starts at MYT midnight; week = 7 calendar days ending today; previous week = the 7 before; d14/prev14; d30/prev30). Admin sees only its own (normally empty) classes. All GET bodies are **bare** (no `{data}`); the page polls `live-data` every 10 s. No `is_test` filter in the mock: OQ-API-B3-1. Peers read at call time: M05 answers, M08 headcount, M12 feedback, M14 learner badges, M17 mood check-ins.

### M10-31 `GET /api/guru/command-center/live-data`
Purpose: Command Center live tiles and panels (S2).
- **Response:** `200` bare `CcLiveData` (CT:73). Each count has a formatted string and a `...Raw` number: `totalStudents(Raw)` = |S|; `activeStudents(Raw)` = students with an answer today; `totalAnswered(Raw)` = all answers; `answeredToday(Raw)`; `answeredWeek(Raw)`; `weekChange = round((week - prevWeek)/prevWeek*100)`, 0 if prevWeek = 0; `accuracy = round(correct/answered*100)`; `gpsOverall` = GPS (2 dp) over graded headcount entries of the viewer's classes (M08; sum of grade points / graded entries; null if none; for user id 1 the display constant 4.69); `classes[{id,name,educationLevel,studentCount,active (members with an answer in the last 7 days),accuracy}]`; `topStudents` top 5 by accuracy among students with >= 10 answers; `leaderboardWeek` top 10 by answers in the last 7 days (ties: accuracy desc, id); `recentBadges` latest 5 awards to S (M14, newest first); `engagement{champion,consistent,developing,minimum,disengaged}` (distinct answer days in last 7: >=5 champion, 3-4 consistent, 1-2 developing; none in 7 but some in 30 minimum; none in 30 disengaged); `recentFeed` last 10 answers (`time` HH:mm MYT, student, subject, isCorrect); `kirkT1` = mean M12 `nps` (0-10, 1 dp) of S's feedback, `kirkT1Count`; `kirkT2Accuracy/Delta/Prev` = accuracy of last 30 days, difference to the 30 before; `kirkT3Active/Delta/Prev` = students with an answer in last 30 days vs the 30 before; `kirkT4Gps` = gpsOverall or 0; `mood{happy,okay,sad,stressed}` counts of S's M17 mood check-ins; `generatedAt` ISO +08:00. Count format: digits with "," thousands.
- **Handler:** `command-center.ts:62` (model `command-center-views.ts:liveData`); `fetchCommandCenterLiveData`. **Card:** BE-22. **Contract:** missing.

### M10-32 `GET /api/guru/command-center/drill`
Purpose: drill-down table behind a tile or panel.
- **Request (query):** `type` required: `students|today|subjects|gps|kirk|mood|engagement`; `filter` (trimmed): `students` ``|`active`; `today` ``|`aktiviti`; `subjects` and `gps` ``; `kirk` `t1|t2|t3|t4` (required); `mood` ``|`happy|okay|sad|stressed`; `engagement` ``|`champion|consistent|developing|minimum|disengaged`.
- **Response:** `200` bare `CcDrill` (CT:249): `{title, students: Row[], extra?, vsLabel?}`. Titles: `Pelajar Berdaftar`, `Soalan Dijawab` / `Aktiviti Hari Ini`, `Ketepatan Purata`, `GPS Sekolah`, `Kirkpatrick T1..T4`, `Mood Pelajar`, `Engagement Pelajar`. Rows per type are in CT:145-226 (students: `studentId,name,className,answered,accuracy,lastActiveAt,status Aktif|Login`; today: one row per student+subject pair answered today; subjects: per subject incl. students count; gps: per subject GPS with the drill's own grade scale <=1.5 A+, <=2.0 A, <=2.5 A-, <=3.0 B+, <=3.5 B, <=4.0 C+, <=4.5 C, <=5.0 D, else E and `source "Anggaran OTR"`; kirk t1: one row per feedback response with `average` (nps), `satisfaction`, `relevance/usefulness` null, `date` YYYY-MM; kirk t2-t4: empty `students` plus `extra` = `CcDrillVs` (accuracyNow/Prev/Change, answersNow/Prev, activeNow/Prev, newStudents) and `vsLabel "Bulan Ini vs Bulan Lepas"`; mood: check-ins newest first; engagement: band, days, answeredWeek, accuracy, lastActiveAt).
- **Errors:** `422 VALIDATION_ERROR` fields `type` `Jenis drill tidak sah.` or `filter` `Penapis tidak sah.` (message = same text).
- **Handler:** `command-center.ts:67`; `fetchCommandCenterDrill`. **Card:** BE-22. **Contract:** missing.

### M10-33 `GET /api/guru/command-center/remedial/scan`
Purpose: Smart Remedial scan of weak students.
- **Response:** `200` bare `CcRemedialScan` (CT:287): `weakStudents[{studentId,name,weakTopics[{subject,topicName,accuracy}],weakestAccuracy}]` and `existingRemedials[{id,studentId,status,totalQuestions,afterAccuracy}]` (viewer's tests not cancelled). Rule (BR-M10-11): per student and per topic (DSKP SP; chapter when the question has no SP), topics with >= 2 answers and accuracy (1 dp) < 50 are weak; topics ascending by accuracy; students ordered by weakest accuracy then id.
- **Handler:** `command-center.ts:77`; `fetchRemedialScan`. **Card:** BE-18. **Contract:** missing.

### M10-34 `POST /api/guru/command-center/remedial/generate`
Purpose: generate an active remedial test for one of the viewer's students.
- **Request:** `{studentId: int >= 1, subject: string}` (subject by id, code or name, case-insensitive).
- **Response:** `201` bare `{quizId, totalQuestions}`. Rule (BR-M10-12): up to 10 questions: (1) eligible questions the student answered wrongly inside the weak topics of that subject, newest first; (2) top-up per weak topic via the question bank by chapter; (3) subject pool at the student's level. Creates an `active` remedial test with `beforeAccuracy` = student's subject accuracy (1 dp). Side effect: inserts the test (M10 `remedialTests`).
- **Errors:** `422` fields `studentId` `ID pelajar tidak sah.`, `subject` `Sila pilih subjek.`; `403 FORBIDDEN` `Pelajar ini bukan murid anda.`; `422` `subject` `Subjek tidak sah.`; `422 VALIDATION_ERROR` (no fields) `Ujian remedial aktif sudah wujud untuk pelajar ini. Batalkan dahulu.` (an active test for the same student and subject) or `Tiada soalan untuk topik lemah` (no weak topic or no questions).
- **Handler:** `command-center.ts:82`; `generateRemedialTest`. **Card:** BE-18. **Contract:** missing.

### M10-35 `POST /api/guru/command-center/remedial/cancel`
- **Request:** `{quizId: int >= 1}`. **Response:** `200` bare `{success: true}`. Side effect: test status `cancelled`.
- **Errors:** `422` `quizId` `ID ujian tidak sah.`; `404 NOT_FOUND` `Ujian remedial tidak dijumpai.` (unknown or another teacher's test); `409 CONFLICT` `Ujian remedial ini tidak aktif.` (not active).
- **Handler:** `command-center.ts:109`; `cancelRemedialTest`. **Card:** BE-18. **Contract:** missing.

### M10-36 `GET /api/guru/command-center/predictive`
- **Response:** `200` bare `CcPredictive` (CT:330). Students with >= 10 answers only. Per student: `overallAccuracy` round(%), grade by the SPM scale, `predictedGps` = grade points (A+ 0 ... G 9), `risk` (E/G kritikal, D tinggi, C/C+ sederhana, else rendah), `trend` = accuracy last 14 days minus the 14 before (0 if either empty), `trendLabel` (>5 Naik, <-5 Turun, else Stabil), `consistency` = distinct answer days in last 30 / 30 * 100. Ordered by accuracy ascending, then id. Aggregates: `gradeDistribution` (all ten grades), `avgPredictedGps` (2 dp), `atRiskCount` (kritikal + tinggi), `totalPredicted`.
- **Handler:** `command-center.ts:122`; `fetchCommandCenterPredictive`. **Card:** BE-22. **Contract:** missing.

### M10-37 `GET /api/guru/command-center/evaluate`
- **Response:** `200` bare `CcEvaluation` (CT:348): `summary{totalStudents,atRisk,critical,high,medium}` and `alerts[{studentId,name,riskLevel,alerts[{message,suggestion}]}]` riskiest first, then id. Alerts per student: inactive >= 7 days (never answered counts from enrolment, at least 7) `Tiada aktiviti {n} hari` / `Hubungi pelajar dan ingatkan untuk menjawab soalan setiap hari.`; accuracy < 40% with answers `Ketepatan rendah ({n}%)` / `Jana ujian remedial untuk topik yang lemah.`; trend < -10 `Prestasi menurun` / `Semak jawapan salah terkini dan beri bimbingan tambahan.`. Risk: 3 alerts critical, 2 high, 1 medium. Read-only.
- **Handler:** `command-center.ts:127`; `fetchCommandCenterEvaluation`. **Card:** BE-22. **Contract:** missing.

### M10-38 `GET /api/guru/command-center/achievements`
- **Response:** `200` bare `CcAchievements` (CT:378): `totalStudents`, `totalNew` (awards dated today), `badgeStats[{id,name,icon,color,holders}]` for the whole M14 badge catalogue (`color` by rarity: holders >= 20 Common #94a3b8, >= 10 Uncommon #22c55e, >= 5 Rare #3b82f6, >= 1 Epic #a855f7, 0 Legendary #f59e0b), `topCollectors[{name,count}]` top 5 by badge count, `newAwards[...]` awards dated today. Read-only (nothing is awarded on GET).
- **Handler:** `command-center.ts:132`; `fetchCommandCenterAchievements`. **Card:** BE-22. **Contract:** missing.

### M10-39 `GET /api/guru/command-center/badge-holders`
- **Request:** query `badgeId` int >= 1.
- **Response:** `200` bare `CcBadgeHolders` (CT:395): `badge{name,description ""}` and `holders[{studentId,name,accuracy,awardedAt}]` (S members holding it, by award time then id).
- **Errors:** `422` `badgeId` `Lencana tidak sah.`; `404 NOT_FOUND` `Lencana tidak dijumpai.`.
- **Handler:** `command-center.ts:137`; `fetchBadgeHolders`. **Card:** BE-22. **Contract:** missing.

## 6. M11 Teacher analytics (`src/modules/m11-teacher-analytics/mock/handlers`)

Count: **7** `route(` registrations (monitoring.ts 5, report.ts 2). The brief and plan 6.3 say 4; the grep gives 7. Types: `api/types.ts` (T). Clients: `api/monitoring.ts`, `api/report.ts`. Guards in `handlers/common.ts`: `teacherGuard = requireRole('admin','teacher')`; `monitoringGuard = requireRole('admin','teacher','school_admin')`. All bodies are `{data}` envelopes (`ok`). Errors for guards: 401 `UNAUTHORIZED` "Unauthenticated."; 403 `FORBIDDEN` "This action is unauthorized."; unknown route or non-digit id `404 NOT_FOUND` "Not Found.".

Module-wide facts:

- Monitoring (matrix row 10) is allowed for Guru and Admin Sekolah in the matrix; the mock additionally allows `admin`. Scope as coded: `admin` and `teacher` see **all schools** (teacher scope is provisional, OQ-M11-02: see OQ-API-B3-5); `school_admin` is forced to own school (`users.schoolId`, or school id 0 = empty view when none). PPD/JPN officers and parent/sponsor/student get 403 (the v2 PPD/JPN dashboards are a different module, M18 section 9).
- Reserved fixture schools (ids 900001-900099, `isFixtureSchoolId`) are excluded from platform roll-ups (BR-M11-34); a school admin of a fixture school sees it in own scope.
- Percentages are 1 decimal (`round1`). `tahap` of a percentage p: Cemerlang p > 60; Sederhana 20 <= p <= 60; Rendah 5 <= p < 20; Kritikal 0 < p < 5; Tiada Langsung p = 0 (`rules.ts:tahapOf`). Class populations come from M10 enrolments; answers from the M05 answer log (Q-ANS-*). Day logic in Asia/Kuala_Lumpur.
- Stored data: only `monitoring_flags` (per pupil `review|excluded`, DATA-M11-01); everything else is computed. The mock does not filter `is_test`: OQ-API-B3-1.

### M11-01 `GET /api/monitoring/overview`
Purpose: S2 monitoring overview (engagement by school, teacher login rates, weekly tracking, signals).
- **Roles/auth:** admin, teacher, school_admin. Scope: school_admin forced to own school; others all schools (state filter available).
- **Request (query):** `period` `""|7d|30d|3m` (unknown = all time; window start now-7d, now-30d, or now minus 3 calendar months MYT), `state` exact state name (`""` = all), `tahap` one of the five tahap keys (filters the student table only, not the KPIs, weekly or signals).
- **Response:** `200 {data: MonitoringOverview}` (T:136): `filters{period,state,tahap}`; `kpi{schools,students,engaged,engagementPct,answers,avgPerStudent,teachers,teachersLoggedIn,teacherPct}`; `studentRows[SchoolEngagementRow]`; `teacherRows[TeacherEngagementRow]`; `weeks[{k,from,to}]`; `weekly[WeeklyRow]`; `signals{best,attention,suggestions}`.
- **Computation:** `registered` = T4/T5 pupils (grade 10/11) per non-fixture school (M01 query Q-M11-T45); `engaged` = distinct pupils of that school with >= 1 answer in the period (Q-M11-ACTIVE over M05 Q-ANS-SEG; flagged accounts included); `pct = engaged/registered*100`; schools with registered >= 1 only, ordered by raw pct descending then school id. Teacher table: registered teachers per school and those with `lastLoginAt` set; `pct` = logged/registered. `kpi.schools` = schools having any user of any role (in state filter/scope); `students`, `engaged` = sums over the (state-filtered, not tahap-filtered) student rows; `answers` = sum of period answers of those schools; `avgPerStudent = answers/engaged`; `teacherPct` = logged/teachers. `weeks`: M1 starts at the configured `monitoringStartDate` (`data/settings.ts`); one entry per Monday-based week up to the week containing now (`from`/`to` as `dd/mm`, last week ends today). `weekly`: per school of the student table, answers per week; cell class `zero` (0), `first` (first week with answers, or equal to previous), `up`, `down`; `best` marks the week with most answers; `trend` compares the last two weeks; schools ordered by having answers, then total answers desc, then id. `signals` (BR-M11-16, from student rows ignoring tahap): `best` = first 3 Cemerlang rows; `attention` = Rendah (kind `rendah`), Kritikal (`kritikal`), Tiada Langsung (`tiada`); `suggestions` = `motivasi` (Kritikal) and for Tiada Langsung `handsOn` if any teacher logged in else `hubungi`; each Signal carries `registered, engaged, pct, teachersLoggedIn`.
- **Errors:** 401/403.
- **Handler:** `monitoring.ts:38`; `fetchMonitoringOverview`. **Card:** BE-20. **Contract:** missing.

### M11-02 `GET /api/monitoring/schools/:schoolId`
Purpose: S3 school detail.
- **Roles/auth:** monitoring guard. school_admin: `schoolId` must equal own school else `404` (existence hidden); admin/teacher: any school.
- **Response:** `200 {data: SchoolDetail}` (T:174): `school{id,name,code,state}`, `subscription{status active|cancelled|expired, endsAt}|null` (the subscription with the latest `endsAt`; other statuses such as grace give null), `warning{review,excluded}|null`, `tahap`, `pct`, `cards{students,engaged,answers,teachers,teachersLoggedIn}`, `flags{review,excluded}`, `students[SchoolDetailStudent]`, `teachers[SchoolDetailTeacher]`. Computation: students = T4/T5 pupils of the school ordered by level label then name (Malay collation); `answers` = total answers of the pupil (whole log); `status` aktif (>= 1 answer) / login (logged in, no answers) / never; `engaged` = answers > 0 and flag is not `excluded` (S3 differs from S2 by excluding flagged-excluded accounts, BR-M11-09); `flag` from `monitoring_flags`; `lastActivityAt` = latest answer or session completion. Cards equal the rows.
- **Errors:** `404 NOT_FOUND` "Not Found." unknown school or out of scope.
- **Handler:** `monitoring.ts:48`; `fetchSchoolDetail`. **Card:** BE-20. **Contract:** missing.

### M11-03 `GET /api/monitoring/schools/:schoolId/students/:userId`
Purpose: S4 pupil detail.
- **Roles/auth:** monitoring guard. school_admin: school must be own and, if the user exists, the user's `schoolId` must be own, else 404. Admin/teacher: the school segment is not validated against the pupil (live rule BR-M11-29).
- **Response:** `200 {data: StudentDetail}` (T:221): `school`, `student{id,name,email,level,lastActivityAt}`, `cards{answered,correct,wrong,accuracy}`, `subjects[{subjectId,name,correct,total,pct}]`, `topics[{subjectId,subjectName,rows[{bab,name,correct,total,pct,badge}]}]` (badge Kuat >= 80, Sederhana >= 50, else Lemah), `answers{available,total,rows[StudentAnswerRow]}` (T:200), `wrong{count,unique,rows}`, `gaps{count,items[{group,subjectName,pct,correct,total,severity,availableQuestions}],strong[],untried[]}` (gap group accuracy < 60%; severity Kritikal < 30, Lemah < 50, else Perlu Perhatian), `observations[]` (top 3). Rows are the pupil's M05 answers joined with M04 questions (question HTML, options A-D, selected/correct label, explanation). A pupil with no answer returns the empty state, never a 404.
- **Errors:** `404` unknown school/user or out of scope.
- **Handler:** `monitoring.ts:62`; `fetchStudentDetail`. **Card:** BE-20. **Contract:** missing.

### M11-04 `GET /api/monitoring/schools/:schoolId/teachers/:userId`
Purpose: S5 teacher detail.
- **Roles/auth:** as above. The teacher person is loaded by `userId` without checking the school segment (BR-M11-29); the pupil list is the whole school of the URL (BR-M11-24).
- **Response:** `200 {data: TeacherDetail}` (T:271): `school{id,name}`, `teacher{id,name,email,lastLoginAt}`, `cards{students,engaged,pct,needAttention}`, `students[{id,name,level,answers,accuracy|null,status}]` (name order), `suggestions{neverLoggedIn,lowAccuracy (accuracy < 50),answered}`. `engaged` = pupils with >= 1 answer; `needAttention` = pupils with no answers.
- **Errors:** `404` unknown school, user not a teacher, or out of scope.
- **Handler:** `monitoring.ts:81`; `fetchTeacherDetail`. **Card:** BE-20. **Contract:** missing.

### M11-05 `GET /api/monitoring/export`
Purpose: rows behind the PDF/CSV export links (PROPOSED shape).
- **Roles/auth:** monitoring guard; same scope as overview. **Request (query):** `format` `pdf|csv` (required) plus the overview filters.
- **Response:** `200 {data: {filename: "monitoring-penglibatan.{format}", rows: SchoolEngagementRow[]}}` (T:290): the student table of the filters (tahap applied). The file itself is built by the client; the card text says "export as CSV/XLSX per mock" but the mock returns JSON rows only (OQ-API-B3-6).
- **Errors:** `422` field `format` `Format eksport mesti pdf atau csv.`.
- **Handler:** `monitoring.ts:100`; `fetchMonitoringExport`. **Card:** BE-20. **Contract:** missing.

### M11-06 `GET /api/teacher/report`
Purpose: S1 teacher report (Laporan).
- **Roles/auth:** `teacherGuard` (admin, teacher); school_admin gets 403. Matrix row 42 (Laporan): Guru. Scope: the viewer's own active classrooms; the admin has no classes so the population is empty.
- **Request (query):** `range` 7|30|90 (anything else = 30), `classroomId` int (a class that is not an own class is ignored = all classes).
- **Response:** `200 {data: TeacherReport}` (T:49): `range`, `classroomId|null`, `options.classes[{id,name}]`, `population{total,loggedIn,practised}`, `activity{total,byType{kuiz,struktur,latihTubi,trackingA,battle,permainan}}`, `score{overall|null,byType{kuiz,struktur(null),latihTubi,trackingA,battle}}`, `trend[{date dd/mm,count}]` (one per day of the range ending today), `notLoggedIn[]`, `notPractised[]` (first 10), `notPractisedAll[]`, `mostActive[]` (top 10 with `activities`).
- **Computation:** population = distinct active students of own classes (or the selected class), role student; activities in range (MYT day start of today minus range-1 days to now): completed M05 sessions by `completedAt` with mode mapped to type (random, chapter, revision, past_year, mission, remedial, question_set, pksk -> kuiz; latih_tubi -> latihTubi; ramalan -> trackingA; others kuiz), structured attempts by `submittedAt` -> struktur, M16 battle and game counts through a port (0 until M16 exists); `score.byType` = round(sum correct / sum questions *100) or null; `overall` over kuiz+latihTubi+trackingA+battle; `loggedIn` = `lastLoginAt` set; `practised` = pupils with >= 1 session (any date); `notPractised*` = pupils with zero sessions; people lists name A-Z (Malay collation); `mostActive` ordered by activities desc then name.
- **Errors:** 401/403.
- **Handler:** `report.ts:14`; `fetchTeacherReport`. **Card:** BE-20. **Contract:** missing.

### M11-07 `GET /api/teacher/item-analysis`
Purpose: S6 teacher item analysis (Analisis Item).
- **Roles/auth:** `teacherGuard`. Same population rule as the report; an unknown/not-own `classroomId` gives no rows (admin: no rows).
- **Request (query):** `subjectId` int, `classroomId` int. A selected own class without explicit subject uses the class's subject.
- **Response:** `200 {data: ItemAnalysis}` (T:309): `options{subjects[{id,name}] (active M03 subjects by name), classes[]}`, `rows[{questionId,textPlain,subjectName,attempts,pct,band,discrimination|null}]`. `pct` = correct/attempts*100 (1 dp); `band` mudah p > 70, sederhana 40-70, sukar < 40; `discrimination` = upper-group p minus lower-group p (3 dp), group size `max(1, round(0.27 N))`, N = pupils with >= 1 finished session in scope, computed only when N >= 4 and both groups answered the question. Rows ordered by pct ascending then question id (INFERRED).
- **Errors:** 401/403.
- **Handler:** `report.ts:30`; `fetchItemAnalysis`. **Card:** BE-20. **Contract:** missing.

## 7. M12 Kirkpatrick (`src/modules/m12-kirkpatrick/mock/handlers`)

Count: **14** `route(` registrations (levels 7, feedback 2, interventions 2, students 2, export 1). The brief and plan 6.3 say 13; the grep gives 14 (`/api/kirkpatrick/filter-options` is the 14th). Types: `api/types.ts` (T). Client: `api/kirkpatrick.ts`. All successful JSON bodies are `{data}` envelopes (`ok`/`created`); the PDF is a file.

Module-wide facts:

- Guards (`handlers/common.ts`): `staffRoles = requireRole('admin','teacher')`; `scopedRoles = requireRole('admin','teacher','school_admin')` (only `overview` and `filter-options`); `requireAuth()` for `me` and the feedback pair. Matrix row 11 (Kirkpatrick incl. sub-pages): Guru and Admin Sekolah; the mock lets the school admin reach only the overview (S1 alias) and filter options, and refuses the other level pages (2-6), interventions and student detail with 403. This differs from matrix decision D-RAM-4 (sub-pages come with Kirkpatrick for Guru): OQ-API-B3-7.
- Scope (BR-M12-01): population "T4/T5" = students of grade 10 or 11 whose school is outside the reserved fixture range 900001-900099. Query `schoolId` (digits only; else `422` field `schoolId` `Medan ini tidak sah.`), `state` (overview only) narrow it; an unknown school or state yields the zero state (empty lists, zero counts). A school_admin is **forced to own school** regardless of query (and sees its fixture school if that is its own); a school_admin without a school gets the empty scope. admin and teacher choose any school/state (teacher has no class or school limit: OQ-API-B3-5).
- Practice figures come from the M05 "kirkpatrick" segment: completed practice sessions/answers of the scope's T4/T5 students. T1 (feedback) is global, ignoring scope (BR-M12-32). The mock applies no `is_test` filter: OQ-API-B3-1.
- Number format: percentages are half-up to 1 decimal (`pct1`, integer arithmetic), means `mean1`. Bands by answers: >= 50 champion, 20-49 konsisten, 5-19 berkembang, 1-4 minimum, 0 tidakTerlibat (`rules.ts:bandOfAnswers`); tahap by school score >= 80/60/40/20 (INFERRED); subject status >= 80 Mastered, 50-79.9 Developing, < 50 Beginning; accuracy to grade bounds in tenths (900 A+ ... 300 E, else G); Pearson strength |r| < 0.3 Lemah, < 0.7 Sederhana, else Kuat.
- Errors for guards: 401 "Unauthenticated."; 403 "This action is unauthorized."; 404 "Not Found." for a non-digit id (no route).

### M12-01 `GET /api/kirkpatrick/overview`
Purpose: S1 summary of the four levels with before/after comparison.
- **Roles/auth:** `scopedRoles` (admin, teacher, school_admin). **Request (query):** `schoolId`, `state` (school_admin: ignored, forced own school).
- **Response:** `200 {data: Overview}` (T:53): `scope{schoolId,state}`; `t4{gps,gpsYear,recordsLabel}` (GPS of the SPM history row of the selected `schoolId` only, null otherwise); `t3{active,t4t5,sessions,accuracy}`; `t2{accuracy,answers}`; `t1{satisfaction,responses}` (global); `comparison` (before = first month with an answer in scope (whole month), after = current month day 1 to today; `delta`; BM `sentences` e.g. `Peningkatan {n}% dalam ketepatan jawapan.`, `Penurunan {n}% dalam ketepatan jawapan.`, `{n} pelajar baru mula aktif.`, `{n} pelajar kurang aktif berbanding sebelumnya.`, `Jumlah jawapan meningkat {n}%.`, `{n} pelajar naik ke tahap Champion.`; with no data: subtitle `Tiada Data vs Tiada Data`, sentence `Data tidak mencukupi untuk perbandingan.`); `kpi{t4t5,answers,teachersLoggedIn,teachers,accuracy}`; `bands[{key,count,pct}]` (five bands; `tidakTerlibat` = T4/T5 minus students with any answer).
- **Computation:** `accuracy = correct/answered*100` over the scope's completed practice answers; `active` = students with >= 1 answer; `teachers`/`teachersLoggedIn` = teachers of scope schools / with `lastLoginAt` set.
- **Handler:** `levels.ts:23`; `fetchKirkpatrickOverview`. **Card:** BE-20. **Contract:** missing.

### M12-02 `GET /api/kirkpatrick/reaction`
Purpose: S2 Level 1 reaction (global, ignores scope and query).
- **Roles/auth:** `staffRoles`. **Response:** `200 {data: Reaction}` (T:77): `npsStudent, npsTeacher, npsAdmin, satisfaction` (1-dp means over all M12 feedback responses; NPS by respondent role, satisfaction over all).
- **Handler:** `levels.ts:27`; `fetchKirkpatrickReaction`. **Card:** BE-20. **Contract:** missing.

### M12-03 `GET /api/kirkpatrick/learning`
Purpose: S3 Level 2 learning.
- **Roles/auth:** `staffRoles`. **Request:** `schoolId` (state ignored).
- **Response:** `200 {data: Learning}` (T:87): `kpi{answers,accuracy,avgScore,sessionsCompleted,sessions,completionPct}` (completionPct is 100 whenever there is a session, 0 otherwise; every session in the segment is completed); `subjects[{subjectId,name,answers,accuracy,status}]` (subjects with answers; ordered by exact accuracy descending then name A-Z (Malay collation)); `schools[{schoolId,name,students,answers,accuracy,avgScore,subjects}]` (schools with T4/T5 students; ordered by accuracy tenths desc then id; `subjects` = stored school-scores subject count; `avgScore` = mean session score).
- **Handler:** `levels.ts:29`; `fetchKirkpatrickLearning`. **Card:** BE-20. **Contract:** missing.

### M12-04 `GET /api/kirkpatrick/behavior`
Purpose: S4 Level 3 behaviour.
- **Roles/auth:** `staffRoles`. **Request:** `schoolId`.
- **Response:** `200 {data: Behavior}` (T:142): `kpi{t4t5,active,sessions,answers,accuracy,teacherPct,teachersLoggedIn,teachers}`, `bands[]`, `schools[BehaviorSchoolRow]` (T:114: `schoolId,name,code,students,active,answers,sessions,perActive,score,tahap`; ordered by stored school `score` desc then id; `perActive = answers/active`), `heat{max,cells[][]}` (weekday x hour grid, 7 rows x 18 hour columns, `max` = largest cell; in the mock a stored aggregate covering ~71% of answers (M12 OQ-M12-11), not derived from session rows; a real backend would compute it from answer timestamps, OQ-API-B3-8), `alerts[BehaviorAlert]` in fixed order of three lists, each by school id: list 1 `never` (more than half of T4/T5 never logged in), list 2 `teacher` (>= 1 teacher logged in but zero answers), list 3 `good` (more than half of T4/T5 active; with `pct`), `moodCount: 0` (constant, BR-M12-15).
- **Handler:** `levels.ts:31`; `fetchKirkpatrickBehavior`. **Card:** BE-20. **Contract:** missing.

### M12-05 `GET /api/kirkpatrick/results`
Purpose: S5 Level 4 results (SPM history, predictions, ALESA, ROI).
- **Roles/auth:** `staffRoles`. **Request:** `schoolId`.
- **Response:** `200 {data: Results}` (T:191): `kpi{gps,gpsYear,recordsLabel,passPct,pass,candidates,gradeA,gradeAPct,accuracy,answers,active,activePct,t4t5,records}`; `distribution{year,candidates,rows[{grade,n,pct}]}|null`; `subjectGps` and `trend` (platform rows in every scope); `schools[ResultsSchoolRow]` (T:162); `predictions[{userId,name,schoolId,schoolName,answers,accuracy,grade}]`; `alesa{lulus,gagal,intervensi,rows[AlesaRow]}`; `roi{active,perStudent,accuracy,gps}`; `insights{active,t4t5,pct,accuracy,grade,year,gps}`. GPS cards use the stored SPM history row of the selected school only (null if none); `pass` = candidates with grade A+ to D (first 8 grades), `gradeA` = A+, A, A-; a history row with candidates but no grade counts gives `pass/passPct/gradeA/gradeAPct = null` and no distribution (D9 choice F5). `recordsLabel` and `records` are documented display constants (DC_M12_01, DC_M12_02). School `engagement` = stored school score unless the school has no active student and no session (null); `faded` = no active students.
- **Handler:** `levels.ts:33`; `fetchKirkpatrickResults`. **Card:** BE-20. **Contract:** missing.

### M12-06 `GET /api/kirkpatrick/chain`
Purpose: S6 impact chain (platform, ignores scope).
- **Roles/auth:** `staffRoles`. **Response:** `200 {data: Chain}` (T:247): `t1{nps,satisfaction,responses}`, `t2{accuracy,answers,avgScore}`, `t3{active,t4t5,pct,sessions,bands}`, `t4{gps,r,strength}`, `correlation{bands[{label,n,acc}],r}`. `r` and the correlation bands are documented constants (DC_M12_03_R, `CORRELATION_BANDS`), not computed: OQ-API-B3-8.
- **Handler:** `levels.ts:35`; `fetchKirkpatrickChain`. **Card:** BE-20. **Contract:** missing.

### M12-07 `GET /api/kirkpatrick/filter-options`
- **Roles/auth:** `scopedRoles`. **Response:** `200 {data: FilterOptions}` (T:25): `schools[{id,name}]`, `states[]`; school_admin gets only own school (empty lists when it has none).
- **Handler:** `levels.ts:37`; `fetchKirkpatrickFilterOptions`. **Card:** BE-20. **Contract:** missing.

### M12-08 `GET /api/kirkpatrick/export-pdf`
Purpose: S6 "Muat Turun Laporan" PDF.
- **Roles/auth:** `staffRoles`. **Response:** `200` file `application/pdf`, name `laporan-kirkpatrick.pdf`, one A4 page titled `Model Kirkpatrick - Rantaian Impak`: four level blocks (labels `Tahap 1: Reaksi`, `NPS Purata`, `Kepuasan`, `Responden`, `Tahap 2: Pembelajaran`, `Ketepatan`, `Soalan Dijawab`, `Skor Purata`, `Tahap 3: Tingkah Laku`, `Pelajar aktif`, `Sesi Latihan`, ...), the correlation table and two conclusion texts, built from the `chain` figures. Layout contract: `mock/handlers/pdf.ts` (`reportLines`, `buildPdf`); the BE-20 card asks for a server `PdfPort` and a test that the file starts with `%PDF`.
- **Handler:** `export.ts:15`; `fetchKirkpatrickChainPdf`. **Card:** BE-20. **Contract:** missing.

### M12-09 `GET /api/kirkpatrick/interventions`
Purpose: S7 intervention log and KPIs.
- **Roles/auth:** `staffRoles`. **Scope:** NONE as coded: every intervention in the store is returned to any admin or teacher (not limited to own students or school): OQ-API-B3-9.
- **Response:** `200 {data: InterventionList}` (T:284): `kpi{total,pending,up,down}`, `rows[InterventionRow]` newest first (createdAt desc, id desc); row = `{id,studentId,alertType,actionDate,alertDescription,actionTaken,beforeAccuracy,afterAccuracy,beforeMood,afterMood,createdBy,createdAt,updatedAt,status,studentName}`. `status` is derived on read, never stored: `Menunggu Semakan` if `afterAccuracy` is null; null if `beforeAccuracy` is null; `Meningkat` if after > before; `Menurun` if after < before; else null. KPIs count the whole store.
- **Handler:** `interventions.ts:44`; `fetchKirkpatrickInterventions`. **Card:** BE-20. **Contract:** missing.

### M12-10 `POST /api/kirkpatrick/interventions`
- **Roles/auth:** `staffRoles`. **Request (JSON; camelCase or snake_case accepted):** `studentId` (int, required, must be a user with role student), `alertType` `mood|inactive|declining` (required), `actionDate` `YYYY-MM-DD` valid calendar day (required), `alertDescription` and `actionTaken` (required, trimmed, <= 2000), `beforeAccuracy`, `afterAccuracy` (0-100, optional, stored 1 dp), `beforeMood`, `afterMood` (`happy|okay|sad|stressed`, optional).
- **Response:** `201 {data: InterventionRow}`. Side effect: inserts the row with `createdBy` = session user.
- **Errors (422, fields):** required fields `Medan ini diperlukan.`; invalid `Medan ini tidak sah.`; repository-level: `studentId` `Pelajar tidak dijumpai.`; `alertType` `Jenis amaran tidak sah.`; `actionDate` `Tarikh tidak sah.`; accuracy `Ketepatan mesti antara 0 dan 100.`; mood `Mood tidak sah.` (the 422 message is the field text).
- **Handler:** `interventions.ts:46`; `createKirkpatrickIntervention`. **Card:** BE-20. **Contract:** missing.

### M12-11 `GET /api/kirkpatrick/students/:id`
Purpose: S8 student Kirkpatrick detail.
- **Roles/auth:** `staffRoles` (school_admin refused). No scope check beyond role (any student).
- **Response:** `200 {data: StudentKirkpatrick}` (T:303): `student{id,name,schoolName,grade}`, `activeDays`, `answers`, `accuracy`, `konsistensi`, `streak`, `strongest{subjectName,accuracy}|null`, `weakest|null`, `headcount{year,rows[{subjectName,tov}]}` (current MYT year, one row per subject A-Z), `platform[{subjectName,accuracy,answers}]`. A student with no sessions gets the zero state.
- **Errors:** one uniform `403 FORBIDDEN` "This action is unauthorized." for an unknown user, a non-student, or the two blocked live-duplicate ids (5571, 5551; fixture artefacts to drop in the real API); ids cannot be probed.
- **Handler:** `students.ts:16`; `fetchKirkpatrickStudent`. **Card:** BE-20. **Contract:** missing.

### M12-12 `GET /api/kirkpatrick/me`
- **Roles/auth:** any session (own data). **Response:** `200 {data: MyKirkpatrick}` (T:317): `headcount{year,rows[]}|null` (null when the viewer has no TOV this year), `days[{date dd/mm, answers}]` (30 days ending today, from the answer log).
- **Handler:** `students.ts:30`; `fetchMyKirkpatrick`. **Card:** BE-20. **Contract:** missing.

### M12-13 `GET /api/feedback/status`
- **Roles/auth:** any session. **Response:** `200 {data: {month: "YYYY-MM", answered: boolean}}` (T:325): whether the viewer already has a response for the current MYT month.
- **Handler:** `feedback.ts:24`; `fetchFeedbackStatus`. **Card:** BE-20. **Contract:** missing.

### M12-14 `POST /api/feedback`
Purpose: monthly satisfaction survey (one per user per calendar month).
- **Roles/auth:** any session (role of the response derived from the session, never the body).
- **Request:** `{nps: int 0..10, satisfaction: int 1..5}` (numbers or numeric strings).
- **Response:** `201 {data: FeedbackResponse}` (T:332): `{id,userId,role,schoolId,month,nps,satisfaction,createdAt}`. Side effect: inserts the response.
- **Errors:** `422` fields `nps`/`satisfaction`: `Medan ini diperlukan.` (blank) or `Medan ini tidak sah.` (not integer or out of range); `409 CONFLICT` `Anda sudah mengisi maklum balas untuk bulan ini.`.
- **Handler:** `feedback.ts:29`; `submitFeedback`. **Card:** BE-20. **Contract:** missing.

## 8. M17 Admin dashboard / Command Center for admin and school admin (`src/modules/m17-admin-dashboard/mock/handlers`)

Count: **11** `route(` registrations (live 1, daily 2, drill 8). The brief and plan 6.3 say "2 + CC routes": the two are `live-data` and `daily-activity`; the drill routes and the daily school drill make 11. SRS M17 §7 also lists #1, #2 and #14-#18 (dashboard pages, S11 school management...); they are **not registered in the mock** (see `handlers/index.ts` comment) and are out of this catalogue. Types: `api/command-center-board-types.ts` (BT: live board and daily board), `api/command-center-types.ts` (DT: drill pages). Clients: `api/command-center-board.ts`, `api/command-center.ts`. All bodies are `{data}` envelopes (`ok`).

Guards (`handlers/command-center-drill-scope.ts`):

- **AS** `adminOrSchoolAdmin`: roles admin, school_admin. 401 without session; 403 `FORBIDDEN` "This action is unauthorized." for any other role (teacher included) and for a school_admin whose user has no school (a missing scope never means platform).
- **ATS** `adminTeacherOrSchoolAdmin`: roles admin, teacher, school_admin; the same school-less school_admin 403.
- Scope **as coded** (ATS, `scopeOf`): admin = every id that exists (fixture schools included); teacher = schools of the teacher's active classes, only the teacher's own S5 page, the teacher's active classes, their active members and the headcount configs of those classes; school_admin = the school of the session user (never the request): the school, its teachers, the classes whose effective school (class school, else owner's school) is that school, its students (`role=student` with `schoolId` equal, active or not), their sessions and headcount configs of those classes. Anything outside scope, and unknown ids, answer `404 NOT_FOUND` "Not Found." (not 403, so ids cannot be probed); a non-digit id also 404 (no route match).
- Board scope (AS): admin = **platform** view P (students with `isActive`, outside the fixture schools 900001-900099; users without a school included), school_admin = **school view** (active students of the session school, fixture school included when it is the session school). Time windows (MYT, from the project clock): today [00:00, now]; week [Monday 00:00, now]; month [1st 00:00, now]; 30d = now minus 30 days.
- Ids are numbers in the mock (decimal strings in v2); session ids are M05 strings (`A2` anchors, `g1` generated, `s_...` runtime): `str(/[A-Za-z0-9_-]+/)`.
- The mock applies no `is_test` filter on answers/sessions/users beyond the above scope rules: OQ-API-B3-1.

### M17-01 `GET /api/admin/command-center/live-data`
Purpose: live board S2 for admin (platform) and school admin (own school).
- **Roles/auth:** AS. Matrix rows 1 (Command Center: Guru and Admin Sekolah). Admin Pusat is the platform view.
- **Request:** none (any client `school_id`/`schoolId` is ignored).
- **Response:** `200 {data: CcLiveData}` (BT:101): `generatedAt` ISO +08:00; `scope` platform|school; `school {id,name}|null`; `totalSchools`; `totalStudents`; `activeStudents`; `totalAnswered`; `answeredToday`; `answeredWeek`; `answeredLastWeek`; `weekChange`; `accuracy`; `topSchools[CcTopSchool]` (BT:33); `topStudents[CcTopStudent]` (BT:42); `gpsOverall`; `kirk{t1{value,scale 5,count},t2Accuracy,t3Active,t4Gps}`; `engagement{champion,consistent,developing,minimum,disengaged}`; `dailyTrend[{date,label,count}]`; `mood{happy,okay,sad,stressed}`; `recentFeed[CcFeedRow]` (BT:51); `correction{total,avgImprovement,improvedCount,topImprovers[]}`.
- **Computation:** `totalSchools` = platform: schools with an `active` M02 subscription whose period contains now, fixture schools excluded; school view: 1 if the school is subscribed else 0. `totalStudents` = platform: students with `isActive` outside fixture schools; school: active students of the school. `activeStudents` = distinct pupils with >= 1 answer ever (M05 answers of the scope). `totalAnswered/answeredToday/answeredWeek` = counts of M05 answers of scope pupils in each window (answers dated after the clock are dropped). `answeredLastWeek` = answers in the previous Monday-Sunday week; `weekChange = round((week - lastWeek)/lastWeek*100)` half away from zero, 0 if lastWeek = 0. `accuracy` = correct/answers*100 (via `accuracyOf`). `topSchools` (platform only, empty for school view) = top 5 schools by distinct answering pupils desc, then answers desc, then id, with `activeCount`, `totalAnswers`. `topStudents` = 5 pupils with most answers in the ISO week (ties accuracy desc, id). `gpsOverall` = `kirk.t4Gps` = mean of the subject GPS values of the current year's SPM history row (platform: the school row with most candidates, ties by id; school: that school's row), 3 dp, 0 when none. `kirk.t1` = M12 feedback satisfaction mean (1-5) and response count (school view: respondents of that school); `t3Active` = distinct pupils with an answer in the last 30 days. `mood` = M17 mood check-in counts for all time (scope pupils). `recentFeed` = latest 10 answers (student name, short subject name, correct, `HH:mm` MYT, school). `engagement` and `correction` are **documented display constants on the platform view** (DC-M17-05: 29/11/43/3/2229; DC-M17-03: total 899, avgImprovement 0, improvedCount 0) because no data rule reproduces them; the school view gets zeros for both and its own last 7 days of answers as `dailyTrend` (BM weekday labels Ahd, Isn, Sel, Rab, Kha, Jum, Sab; platform `dailyTrend` empty): OQ-API-B3-10.
- **Errors:** 401, 403 (see guards).
- **Handler:** `command-center-live.ts:185` (builder `buildLiveData`); `fetchCcLiveData`. **Card:** BE-22. **Contract:** missing.

### M17-02 `GET /api/command-center/daily-activity`
Purpose: daily-activity board S3.
- **Roles/auth:** AS. School admin forced to own school (`schools` list omitted).
- **Request (query):** `period` `today|week|month`; any other value or none gives today's figures and the raw value is echoed in `period`.
- **Response:** `200 {data: CcDailyActivity}` (BT:192): `period` (raw), `label` (`Hari Ini (D Mon YYYY)` English unpadded date / `Minggu Ini` / `Bulan Ini`), `scope`, `school`, `logins{total,byRole{student,teacher,parent,admin,school_admin,others...},recent[CcLoginRow (BT:136)]}` (users whose `lastLoginAt` is in the window, scope by school; 10 latest; row has chip `package` ADMIN/PARENT/AKTIF/PKSK/SEKOLAH/BEBAS/FREE and `timeAgo` via `diffForHumans`), `practice{totalAnswers,correctAnswers,accuracy,activeStudents,sessionsStarted,sessionsCompleted,avgSessionSeconds}` (answers in window; sessions = completed sessions, `started` = completed; seconds = mean `timeSpent`), `engagement{moodCheckins,moodDist,missionsCompleted (completed sessions linked to an M10 mission),badgesEarned,recentBadges[CcBadgeRow],quizSetsCreated}`, `summary{activeSchools,totalSchools (platform 57 schools with students, school view 1),activeStudents,totalStudents,totalLogins}`, `schools?[CcSchoolActivity]` (platform only; per school: `activeStudents,totalAnswers,accuracy|null,activeTeachers,loginCount,lastActive,lastActiveHuman`), `topStudents[CcDailyTopStudent]` (answers desc, accuracy desc, id), `subjectBreakdown[{code,shortName,answers}]`, `hourlyHeatmap{hour: answers}` (24 MYT hours on `today`, empty otherwise), `liveFeed[CcDailyFeedRow]`.
- **Errors:** 401, 403.
- **Handler:** `command-center-daily.ts:351`; `fetchCcDailyActivity`. **Card:** BE-22. **Contract:** missing.

### M17-03 `GET /api/command-center/daily-activity/school/:id`
Purpose: S3 school drill (teachers, pupils, logins of one school for a period).
- **Roles/auth:** `requireRole('admin')` only (school_admin and teacher get 403). **Request:** path `id` int; query `period` as above.
- **Response:** `200 {data: CcSchoolDrill}` (BT:267): `school{id,name}`, `period`, `teachers[{userId,name,students,accuracy,lastActiveHuman}]` (teachers owning a class with an active enrolment of an answering pupil), `students[{userId,name,answers,accuracy,lastActiveHuman}]`, `logins[{userId,name,role,timeAgo}]`.
- **Errors:** `404 NOT_FOUND` "Not Found." unknown school (also non-digit id); 401/403.
- **Handler:** `command-center-daily.ts:361`; `fetchCcSchoolDrill`. **Card:** BE-22. **Contract:** missing.

### M17-04 `GET /api/command-center/school/:id`
Purpose: S4 school page.
- **Roles/auth:** ATS; scope as above (admin any; teacher only schools of own classes; school_admin only own school). **Response:** `200 {data: CcSchool}` (DT:53): `school{id,name}`, `cards{students (every student of the school, active or not), active (pupils of P with >= 1 answer), answers, accuracy}`, `teachers[{userId,name,subjectText,classes,students,active30d,ownerOnly}]` (`classes` = active classes owned at the school, `students` = distinct active members, `active30d` = members with an answer in the last 30 days, `ownerOnly` = class owner who is not one of the school's teachers).
- **Errors:** `404` unknown or out of scope. **Handler:** `command-center-drill.ts:57`; `fetchCcSchool`. **Card:** BE-22. **Contract:** missing.

### M17-05 `GET /api/command-center/school/:sid/teacher/:uid`
- **Roles/auth:** ATS; teacher may open only their own page (`uid` = self and school in own classes). **Response:** `200 {data: CcTeacher}` (DT:71): `school`, `teacher`, `classes[{id,name,level,students,active30d,answers,accuracy}]`. **Errors:** `404`.
- **Handler:** `command-center-drill.ts:68`; `fetchCcTeacher`. **Card:** BE-22. **Contract:** missing.

### M17-06 `GET /api/command-center/classroom/:id`
- **Roles/auth:** ATS; teacher own active classes; school_admin classes of own school (effective school). **Response:** `200 {data: CcClass}` (DT:93): `school|null`, `teacher`, `class{id,name,level ("T4"/"D1")}`, `students[{userId,name,answers,accuracy,lastActiveAt|null,status aktif|tidak_aktif,mood|null}]`. **Errors:** `404`.
- **Handler:** `command-center-drill.ts:84`; `fetchCcClass`. **Card:** BE-22. **Contract:** missing.

### M17-07 `GET /api/command-center/student/:id`
- **Roles/auth:** ATS; teacher: pupils in own classes; school_admin: pupils of own school. **Response:** `200 {data: CcStudent}` (DT:153): `school|null`, `teacher|null`, `class|null` (first active class the viewer may open), `student`, `cards{answers,accuracy,activeDays,streak,consistency (round(days with an answer in the last 56 days / 56 * 100))}`, `subjects[CcSubjectRow]` (code `UMUM` / label `Latihan Bebas` for mixed free practice), `weeks[CcWeek]` (8 Monday-based weeks ending with the current one), `moodTrend[CcMoodDot]` (last 30 days), `headcount[CcHeadcountRow]` (entries not dropped, in configs the viewer may open), `insight{texts[], source "Rule-based Analysis"}`. **Errors:** `404` unknown, not a student, or out of scope.
- **Handler:** `command-center-drill.ts:95`; `fetchCcStudent`. **Card:** BE-22. **Contract:** missing.

### M17-08 `GET /api/command-center/student/:id/week`
- **Request:** query `start`, `end` as `YYYY-MM-DD` (real calendar dates, start <= end). **Response:** `200 {data: CcSessionList}` (DT:186): `totalAnswers,totalSessions,accuracy (1 dp),timeSpentMinutes,sessions[CcSessionRow (DT:171)]` of the pupil's completed sessions finished in [start 00:00, end+1 day 00:00) MYT, oldest first. The "all sessions" modal calls it with start 2020-01-01 and end 2030-12-31.
- **Errors:** `422 VALIDATION_ERROR` field `start` message `Julat tarikh tidak sah.`; `404` unknown/not student/out of scope (checked first).
- **Handler:** `command-center-drill.ts:106`; `fetchCcStudentWeek`/`fetchCcStudentAllSessions`. **Card:** BE-22. **Contract:** missing.

### M17-09 `GET /api/command-center/student/:id/subject`
- **Request:** query `code` (M03 subject code or `UMUM`; trimmed). **Response:** `200 {data: CcSessionList}`: the pupil's completed sessions of that subject, newest first; `UMUM` = free practice (null subject); an unknown code gives an empty list (200). **Errors:** `404` as above.
- **Handler:** `command-center-drill.ts:123`; `fetchCcStudentSubject`. **Card:** BE-22. **Contract:** missing.

### M17-10 `GET /api/command-center/session/:sessionId`
- **Roles/auth:** ATS; the session's pupil must be in scope. **Response:** `200 {data: CcSessionDetail}` (DT:208): `subjectLabel, topic, completedAt, total, correctCount, wrongCount, accuracy, timeSpent{m,s}, difficulty|null, answers[CcSessionAnswer]` (`questionText` cut at 150 characters + "...", `selectedAnswer`/`correctAnswer` as "{L}) {text}" or null). **Errors:** `404`.
- **Handler:** `command-center-drill.ts:135`; `fetchCcSession`. **Card:** BE-22. **Contract:** missing.

### M17-11 `GET /api/command-center/headcount/:configId`
- **Roles/auth:** ATS; the config's class must be in scope (`mayOpenConfig`). **Response:** `200 {data: CcHeadcountDetail}` (DT:232): `subject`, `totalStudents`, `avgTov`, `avgEtr` (1 dp means over non-null, 0 when none), `passRate` (whole percent of graded entries with grade A+ to C; INFERRED), `students[{userId,name,tov,etr,rs,grade}]` (non-dropped entries). **Errors:** `404`.
- **Handler:** `command-center-drill.ts:146`; `fetchCcHeadcount`. **Card:** BE-22. **Contract:** missing.

## 9. M18 PPD / JPN, Amaran Awal (`src/modules/m18-ppd-jpn/mock/handlers`)

Count: **4** `route(` registrations (all in `handlers/amaran.ts`: school risk page, executive summary, effectiveness, school CSV). The brief and plan 6.3 do not list M18 in the backend groups; the brief says 2. M18 is **wave-4 backlog and not carded** (`v2-backend-plan.md` section 2 last paragraph; `plan/backend-tasks/README.md` row "M18 PPD/JPN: roles/features outside the prototype scope"). The only frontend consumer is M27 (school admin Amaran Awal, S4) through `m27-school-admin/api/amaran.ts` (typed there because M18 has no client). M18 has no UI module, routes or client; the PPD/JPN portal pages of `v2-portals.md` are not mocked.

Repository types: `mock/repository/types.ts` (RT) and `mock/repository/amaran.ts` (AR). Responses are `{data}` envelopes, except the CSV file. Errors: 401 `UNAUTHORIZED` "Unauthenticated." (no session); 403 `FORBIDDEN` "This action is unauthorized."; 404 `NOT_FOUND` "Not Found."; 422 `VALIDATION_ERROR` as below.

Module-wide facts:

- Roles that reach the Amaran family at all (`AMARAN_ROLES`): admin, ppd_officer, jpn_officer, school_admin, teacher. All others (student, parent, sponsor) get 403. Matrix row 49 (Amaran Awal) allows Admin Sekolah only; the mock also admits teacher/PPD/JPN (provisional, OQ-M18-01; officer cells are INFERRED).
- School access `mayOpenSchool(viewer, schoolId)`: admin any; school_admin own `schoolId` only; teacher own `schoolId` or any school of a class the teacher owns; ppd_officer a school whose `district` equals the officer's `ppdDistrict` (and `state` equal to `ppdState` when set); jpn_officer a school whose `state` equals the officer's `ppdState`.
- Risk model (`risk.ts`, BR-M18-13/14, never stored, evaluated at the project clock): per pupil, A = 100 - mean practice-session accuracy (100 if no session but a `lastActiveAt` or mastery record; 50 if none of the three); E = min(100, whole days since `lastActiveAt` * 100 / 30), 100 when null; M = (10 - mean mastery level) * 10, 100 without mastery records; `score = 0.4A + 0.3E + 0.3M` (1 decimal); status `on_track` score < 40, `watch` score < 60, else `high` (labels `On Track`, `Perlu Perhatian`, `Berisiko Tinggi`). Pupils include inactive users (BR-M18-04); practice-mode sessions only; fixture schools 900001-900099 are excluded from district and state scopes.
- Contract: `RoleCode` in `packages/contract` has no `jpn_officer` (only `ppd_officer`); the mock session role set includes both: OQ-API-B3-11.

### M18-01 `GET /api/amaran/schools/:id`
> **UD-4: M18 Amaran is folded into BE-21 (user decision 2026-10-19).**
Purpose: school risk page (S22/S28; also M27 S4 "Amaran Awal" of a school admin).
- **Roles/auth:** any session, then `AMARAN_ROLES` and `mayOpenSchool` as above.
- **Request:** path `id` int (school); query `tingkatan` `T4|T5|4|5` (case-insensitive; anything else = no filter). The filter is class based (pupils in classes of that level).
- **Response:** `200 {data: SchoolRiskData}` (AR:148): `school{id,name,code,district,state}`, `levelFilter` `"T4"|"T5"|null`, `levelSuffix` `""` or `" — Tingkatan {n}"`, `tally{green,yellow,red,total,pct{green,yellow,red}}` (integer percentages = round(part/total*100)), `weakness[{subjectId,subjectName,weak,total,pct}]` (one row per stored correction-subject row of the school with `pupils` > 0, order as stored; `weak` = `pupilsWeak`, `total` = `pupils`), `pupils[PupilRiskView]` (RT:123): score descending with 1-based `rank`, fields `rank,userId,studentId (alias),name,levelLabel ("Tingkatan n"/"Darjah n"/null),tingkatan,className,classLabel,score,status,accuracy,engagement (lastActiveAt yyyy-mm-dd),mastery,accuracyText,engagementText,masteryText`. Cell texts (BM): `Purata ketepatan: {n}%`, `Tiada data latihan` (never active) / `Tiada data`; `Terakhir aktif: {yyyy-mm-dd}` / `Tiada aktiviti`; `Purata tahap: L{n}` / `Tiada data penguasaan` / `Tiada data`.
- **Errors:** `404` unknown school (checked before access); `403` outside scope or role not allowed.
- **Handler:** `amaran.ts:75` (`schoolRisk`); client `fetchSchoolRisk` (`m27-school-admin/api/amaran.ts`). **Card:** BE-21. **Contract:** missing.

### M18-02 `GET /api/amaran/summary`
> **UD-4: folded into BE-21.**
Purpose: printable executive summary of a school, district or state.
- **Roles/auth:** `AMARAN_ROLES` and `mayOpenScope`: school scope as `mayOpenSchool`; district/state scopes: admin any; ppd_officer only its own district (state also matching when set); jpn_officer any district or state in its own state (state scope: `state` equal to own); school_admin and teacher are refused for district/state scopes.
- **Request (query):** `scope` `school|district|state` (absent = viewer's default scope: ppd_officer own district, jpn_officer own state, admin the preview scope district `PPD BATANG PADANG` / state `Perak`, school_admin and teacher own school; none -> 403); `schoolId` (or `school_id`) int for `school`; `district`, `state` for `district` (default to the officer's own); `state` for `state` (admin default `Perak`).
- **Response:** `200 {data: SummaryData}` (AR:243): `scope`, `title` (school name / district / `Negeri {state}`), `subtitle` (`{district}, {state}` / `{state} — Ringkasan Eksekutif` / `Ringkasan Eksekutif Seluruh Negeri`), `pupilsLine` (`{n} pelajar` or null for state), `generatedAt` (epoch ms number, not ISO), `tally`, `kombo{active,pupils,avg,max,today}`, and `schools[SchoolRow]` (district/state: `schoolId,school,pupils,avgScore,green,yellow,red`, ordered by average score descending then id, schools with pupils only) or `weakness[]` (school scope). `kombo` = over scope pupils: `active` = those with a current streak > 0, `avg` = mean current streak of those (1 dp), `max` = highest, `today` = distinct pupils with an answer today (M14 streak and M05 answers).
- **Errors:** `422 VALIDATION_ERROR` English copy as coded: `scope=school` without integer id `{schoolId: "The school id is required."}`; district missing `{district: "The district and state are required."}`; state missing `{state: "The state is required."}`; unknown scope value `{scope: "The scope must be school, district or state."}` (the message is the field text). `404` unknown school, or a district/state with no schools; `403` out of scope or no default scope.
- **Handler:** `amaran.ts:96`; no client yet. **Card:** BE-21. **Contract:** missing.

### M18-03 `GET /api/amaran/effectiveness`
> **UD-4: folded into BE-21.**
Purpose: intervention effectiveness report of the viewer's own school (S24).
- **Roles/auth:** `AMARAN_ROLES`; school = admin 127 (preview school), school_admin and teacher own `schoolId`; officers have none (403).
- **Response:** `200 {data: {school{id,name}, report: EffectivenessReport}}` (AR:304): `cards{total,berkesan,evaluated,rate,needsAction,sederhana,tidakBerkesan,notEvaluated}`, `doughnut[4]` (Berkesan, Sederhana, Tidak Berkesan, Belum Dinilai), `trend{labels (BM month abbreviations Jan Feb Mac Apr Mei Jun Jul Ogo Sep Okt Nov Dis),data[]}`, `byType[{type,label,count}]` (types kaunseling "Sesi Kaunseling", kelas_tambahan "Kelas Tambahan", tugasan_khas "Tugasan Khas", hubungi_ibubapa "Hubungi Ibu Bapa", mentor_rakan "Mentor Rakan Sebaya", bimbingan "Bimbingan", lain "Lain-lain"), `byTeacher[{teacherId,name,total,berkesan,notEvaluated,rate|null}]`, `followUps[{id,studentId,studentName,type,label,interventionDate,effectiveness}]`, `bySchool[{schoolId,school,total,berkesan,sederhana,tidakBerkesan,notEvaluated,rate}]`. Computed from stored `AmaranIntervention` rows (RT:21: studentId, teacherId, schoolId, classroomId, type, interventionDate, status `done|planned`, notes, followUp, effectiveness `belum_dinilai|berkesan|sederhana|tidak_berkesan`) of the school (BR-M18-17 at `now`); the mock has no write route for interventions (read-only seed): OQ-API-B3-12.
- **Errors:** `403` role not allowed or no school (also when no data).
- **Handler:** `amaran.ts:137`; no client yet. **Card:** BE-21. **Contract:** missing.

### M18-04 `GET /api/amaran/export/school/:id`
> **UD-4: folded into BE-21.**
Purpose: school risk list as CSV ("Muat Turun CSV").
- **Roles/auth:** `AMARAN_ROLES` and `mayExportSchool` = `mayOpenSchool` but **teachers are refused** (403); admin, in-scope officers, school_admin own school.
- **Response:** `200` file `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="amaran-sekolah-{id}-{yyyymmdd}.csv"` (date in MYT), `Cache-Control: no-store`. Content: UTF-8 BOM, CRLF, header `Bil,Pelajar,Tingkatan / Kelas,Skor Risiko,Status,Ketepatan,Penglibatan,Penguasaan`, one line per pupil of the school (no `tingkatan` filter), score `toFixed(1)`, status label, the three cell texts; cells starting with `=`, `+`, `-`, `@`, tab or CR are prefixed with `'` (CSV-injection guard) and quoted per RFC 4180. No IC, e-mail or phone.
- **Side effects:** the mock records an export audit entry (viewer id, school id, filename, time) per accepted download (SEC-M18-03); the real API must write an audit event.
- **Errors:** `404` unknown school; `403` out of scope or teacher.
- **Handler:** `amaran.ts:147`; client `downloadSchoolRiskCsv` (`m27-school-admin/api/amaran.ts`). **Card:** BE-21. **Contract:** missing.

## 10. M27 School admin (`src/modules/m27-school-admin/mock/handlers`)

Count: **22** registered routes. A plain grep of `route(` finds 18 lines, because 8 routes are produced by helper factories (`csvRoute` x2, `detailRoute` x2, `updateRoute` x2, `resetRoute` x2) that contain one `route(` call each; expanded: dashboard 1, usage 1, laporan-aktiviti 1, dskp-heatmap 1, laporan-bulanan 1, kelas 1, users-read 7 (list x2, csv x2, form-options, detail x2), users-write 7 (create x2, update x2, reset x2, toggle), impersonate 2. The brief and plan 6.3 say 17 (the SRS Part B §19 numbering #1-#22 has 22 endpoints, #1 dashboard to #22 form options; 17 predates #17-#22). Types: `api/dashboard.ts` (D), `api/school-admin.ts` (S). Clients: `api/dashboard.ts`, `api/school-admin.ts`, `api/amaran.ts` (M18 calls, section 9).

Module-wide facts:

- Guard **SA** `requireSchoolAdminWithSchool` (`read-models/school-scope.ts`): 401 `UNAUTHORIZED` "Unauthenticated." without a session; 403 `FORBIDDEN` "This action is unauthorized." for any role other than `school_admin` and for a school admin whose user has no school (a missing school never means "all schools"). The dashboard uses `requireRole('school_admin')` plus the same school-less refusal. `schoolOf(req)` = the session user's `schoolId`; **no path, query or body value can change the school** (FR-M27-42). The impersonation routes carry no SA guard (see their entries). Admin Pusat has no access to `/api/admin-sekolah/*` (403); admin acts on schools through M02.
- Scope as coded: own school only. "Pupils" and "teachers" are the M01 `users` rows with the school's id and role, active or not, unless a field says active. A pupil/teacher id of another school, another role, or an unknown id is `404 NOT_FOUND` "Not Found." (indistinguishable); then an inactive in-school account is `403` (except the teacher toggle). A non-digit `:id` is a 404.
- Matrix rows: 2 Dashboard, 46 Statistik Penggunaan, 47 DSKP Heatmap, 48 Laporan Aktiviti, 50 Laporan Bulanan, 51 Senarai Pelajar, 52 Senarai Guru, 53 Kelas Sekolah (Admin Sekolah). Amaran Awal (row 49) and Sekolah Bersaing (row 45) are served by M18 / M16, not here.
- Write responses carry `status` (BM flash text) next to `data`: body `{data, status}`; clients call with `raw: true` to read both. Create-pupil adds `credential`.
- List envelope for the user lists: `{data, meta}` with `meta = {page, pageSize 25, totalItems, totalPages, from, to, counts{total,active,inactive}}`; page beyond the last gives the last page; invalid page = 1 (note: this differs from the platform pagination convention "out-of-range page = empty page", M27 clamps).
- Validation copy is the shared Laravel default (`The :attribute field is required.` etc., attribute = camelCase split to words, lower case) unless a BM text is given. Rules (M02 `handlers/users-rules.ts`): `name` required, max 255; `email` required, valid, max 255, unique (other users); `phone` max 14; passwords min 6 and confirmed (`newPasswordConfirmation` / `passwordConfirmation` equal). Default messages: required `The {attr} field is required.`; max `The {attr} field must not be greater than {n} characters.`; min `The {attr} field must be at least {n} characters.`; email `The email field must be a valid email address.`; unique `The email has already been taken.`; confirmed `The {attr} field confirmation does not match.`; exists/in `The selected {attr} is invalid.`. The 422 message = first field message plus ` (and N more error(s))`.
- No `is_test` filter is applied: OQ-API-B3-1. The v2 plan stamps data written under Mod Pelajar with `is_test`; M27 aggregates must exclude it once BE-03 mode exists.

### M27-01 `GET /api/admin-sekolah/dashboard`
Purpose: school dashboard S0.
- **Roles/auth:** `school_admin` with a school (401/403). **Request:** none.
- **Response:** `200 {data: SchoolDashboard}` (D:37): `school{id,name,state,ppd (district or null),code|null}`, `roleLabel "Admin Sekolah"`, `perutusan[{id,title,createdAt,author{initials,roleLabel}}]` (first 3 visible posts for the viewer from M09 `perutusan.list`), `cards{pupils,teachers,activeClasses,subscription{status none|active|grace|expired,label}}`, `performance{gps{value,grade,band,entries},risk{safe,watch,high,total}|null,practice{accuracy|null,sessions,questions},levels[{code,name,accuracy}],distribution[{grade,count,pct}],total}`.
- **Computation:** `pupils`/`teachers` = users of role in the school (active or not); `activeClasses` = `classrooms.list({isActive:true, schoolId})` count (both kinds); `subscription` (BR-M27-14): `active` if an `active` M02 subscription row's period contains now; else `grace` if a grace row exists; else `expired` if an active row has lapsed (`endsAt < now`) or an expired row exists; a `cancelled` row is not current; none = `none`; labels `Belum Ada`, `Aktif`, `Tempoh Ihsan`, `Tamat`. `performance.*` comes from the M08 school performance read model (section 4, `GET /api/performance/school`): `gps` from headcount entries (grade = grade at round(GPS) half up), `practice` from `stats` (accuracy null when sessions = 0, never 0%), `levels` T4/T5 accuracy, `distribution` the ten grades, `total` = sum of counts. `risk` is the M18 Amaran tally of the school at now (`onTrack` mapped to `safe`), all levels.
- **Handler:** `dashboard.ts:166`; `fetchSchoolDashboard`. **Card:** BE-21. **Contract:** missing.

### M27-02 `GET /api/admin-sekolah/usage`
Purpose: S1 school usage statistics.
- **Roles/auth:** SA. **Request (query):** `period` `today|7days|30days` (unknown/absent = `30days`). Window: `today` = 00:00 MYT to now; others last N x 24 h (half-open).
- **Response:** `200 {data: SchoolUsage}` (S:49): `school{id,name}`, `period`, `label` (`Hari Ini`|`7 Hari`|`30 Hari`), `tiles{pupils (all pupils), teachers (all teachers), activePupils (pupils with >= 1 answer in window), participationPct (round(active/registered*100), 0 if none), sessions (completed sessions in window), answers (answers in window), accuracy|null (mean of per-session accuracy, 1 dp, sessions with 0 questions skipped)}`, `modes[{label,sessions,accuracy|null}]` (sessions grouped by M05 mode label: chapter `Bab`, revision `Ulang Kaji`, ramalan `Tracking A`, pksk `PKSK`, every other mode `Latihan`; ordered by sessions desc then label).
- **Handler:** `usage.ts:9`; `fetchSchoolUsage`. **Card:** BE-21. **Contract:** missing.

### M27-03 `GET /api/admin-sekolah/laporan-aktiviti`
Purpose: S3 activity report (M17 StatsReport in the school scope).
- **Roles/auth:** SA. **Request (query):** `range` 7|30|90 (else 30); window [00:00 MYT of today minus range-1 days, now].
- **Response:** `200 {data: SchoolActivityReport}` (S:150): `range`, `schoolId`, `generatedAt` ISO +08:00, `overview{pupils,pupilsLogged,teachers,teachersLogged,practised,activity}`, `trend[{label,value}]`, `breakdown{quiz,structured,battle,game}`, `topPupils[{userId,name,activities}]`, `teachersNeverLogged[{userId,name,email}]`, `teachers[ActivityTeacherRow]` (`mcq,structured,coins,hasHeadcount,loggedIn,lastLoginAt`), `pupils{semua,aktif,loginSahaja,belumLogin}` (each up to 200 `ActivityPupilRow{userId,name,className,sessions,accuracy,seconds,coins,lastLoginAt}`), `tiles{teachers{total,logged,questions,coins},pupils{total,practised,sessions,accuracy}}`. Built by the M17 `buildStatsReport(range, {schoolId, includeInactive: true})`: the school's students and teachers (fixture school allowed when it is the session school); `schools` list, `overview.score` and `structuredScore`, `schoolName` on rows are dropped (platform-only). Sources: M05 sessions, M04 questions/structured, M08 headcount, M10 classes, M14 wallet, M16 battles/games (port, 0 until M16).
- **Handler:** `activity.ts:79`; `fetchSchoolActivityReport`. **Card:** BE-21. **Contract:** missing.

### M27-04 `GET /api/admin-sekolah/dskp-heatmap`
Purpose: S2 DSKP heatmap of the school's pupils.
- **Roles/auth:** SA. **Request (query):** `subjectId` int (default = first subject by name), `tingkatan` `T4|T5` (default T4; level ids 10/11).
- **Response:** `200 {data: SchoolDskpHeatmap}` (S:95): `school`, `subjects[{id,name}]` (subjects with >= 1 SP at the level, by name A-Z), `subject|null`, `level{code,name}`, `caption "KSSM {Subjek} Tingkatan {n}"|null`, `bidang[{id,code,name,sp[{id,code,title,answered,correct,pct|null,status}]}]`. Per SP: pooled over the school's pupils (all active or not) `answered` = sum of M08 SP records `answered`, `correct` = sum `correct` (all record origins, one row per user+subject+SP), `pct = floor(100*correct/answered + 0.5)` or null when unanswered; `status` mahir >= 75, sederhana >= 50, lemah < 50, belum (null).
- **Handler:** `dskp-heatmap.ts:9`; `fetchSchoolDskpHeatmap`. **Card:** BE-21. **Contract:** missing.

### M27-05 `GET /api/admin-sekolah/laporan-bulanan`
Purpose: S5 monthly report (12-month series and subject strengths).
- **Roles/auth:** SA. **Request (query):** `bulan` `YYYY-MM` (a future or invalid value gives the current month).
- **Response:** `200 {data: MonthlyReport}` (S:221): `school`, `month`, `label` ("September 2026"), `prev`, `next|null` (null on the current month), `cards{participationPct,active,registered,answers,perPupil (integer),accuracy|null,sessions}`, `months[{month,label,answers,correct,activePupils,perPupil,accuracy}]` (the 12 months ending with the shown month; answers from the answer log by calendar month MYT; a month is listed only if it has >= 1 completed session, and only when the shown month has answers; ascending), `total{answers,correct,accuracy}|null` (only when > 1 row), `subjects{strongest|null,weakest|null,rows[{name,accuracy,answers,pupils}]}` (shown month only, by accuracy desc, ties by answers desc then subject id), `generatedAt` (request minute, ISO +08:00).
- **Handler:** `monthly.ts:9`; `fetchMonthlyReport`. **Card:** BE-21. **Contract:** missing.

### M27-06 `GET /api/admin-sekolah/kelas`
Purpose: S8 class list of the school.
- **Roles/auth:** SA. **Request (query):** `level` (a level slug present in the school, e.g. `tingkatan-4`; unknown = all), `search` (name contains, case-insensitive), `page` (25 per page).
- **Response:** `200` body `{data: SchoolClassRow[], meta, tiles{activeClasses}, levels[{code,label}]}` (S:488; `tiles` and `levels` are top-level extras next to `data`/`meta`; `meta` = page fields plus `displayed` = rows matching the filters). Row: `key "classroom:{id}", kind "classroom", id, name, subject{id,name}|null, levelLabel, teacherName|null, members (active enrolments, may include pupils of other schools), joinCode|null, isActive, link "/prestasi/kelas/{id}"`. Rows = `classroom` classes whose `schoolId` equals the school (active and inactive), ordered by name A-Z (Malay collation), then id. `activeClasses` = active classrooms of the school.
- **Handler:** `classes.ts:9`; `fetchSchoolClasses`. **Card:** BE-21. **Contract:** missing.

### M27-07 `GET /api/admin-sekolah/pelajar`
- **Roles/auth:** SA. **Request (query):** `is_active` `1|0` (else all), `search` (name or e-mail substring, case-insensitive), `page`.
- **Response:** `200 {data: SchoolPupilRow[], meta}` (S:262): `id,name,initials (two letters),email,phone|null,gradeLabel ("Tingkatan 1..5" for grade 7-11, "Darjah 1..6" for 1-6, else null),classNames[] (names of active enrolments of both kinds in classes with isActive),isActive,createdAt,canEdit (= isActive)`. Ordered active first, then id descending, 25 per page. `meta.counts{total,active,inactive}` ignore the filters.
- **Handler:** `users-read.ts:78`; `fetchSchoolPupils`. **Card:** BE-21. **Contract:** missing.

### M27-08 `GET /api/admin-sekolah/guru`
- **Roles/auth:** SA. **Request:** as pupils. **Response:** `200 {data: SchoolTeacherRow[], meta}` (S:278): `id,name,initials,email,phone|null,classCount (active classes owned),lastLoginAt|null,isActive,createdAt,canEdit`; same order, paging and `meta.counts`.
- **Handler:** `users-read.ts:82`; `fetchSchoolTeachers`. **Card:** BE-21. **Contract:** missing.

### M27-09 `GET /api/admin-sekolah/pelajar/export.csv`
- **Roles/auth:** SA. **Request (query):** `is_active`, `search` as the list. **Response:** `200` file `text/csv; charset=utf-8`, `Content-Disposition` filename `users-pelajar-{yyyy-mm-dd}.csv` (clock date). Body: UTF-8 BOM, `\n` rows, header `id,name,email,role,sekolah,kelas,is_active,created_at`; the school's matching pupils ordered by id; `role` word `pelajar`; `sekolah` school name; `kelas` names of active classes joined by ", "; `is_active` 1/0; cells starting with `=`, `+`, `-`, `@`, tab or CR prefixed with `'`; quoted when containing comma, quote or newline; no IC, no phone. (Literal path wins over `:id`.)
- **Handler:** `users-read.ts:86` (factory `csvRoute` :44); `downloadPupilsCsv`. **Card:** BE-21. **Contract:** missing.

### M27-10 `GET /api/admin-sekolah/guru/export.csv`
- Same as above for teachers: filename `users-guru-{yyyy-mm-dd}.csv`, `role` word `guru`, `kelas` empty.
- **Handler:** `users-read.ts:87`; `downloadTeachersCsv`. **Card:** BE-21. **Contract:** missing.

### M27-11 `GET /api/admin-sekolah/pelajar/form-options`
Purpose: data for the create-pupil form (S12).
- **Roles/auth:** SA. **Response:** `200 {data: SchoolPupilFormOptions}` (S:445): `school{id,name,code,district,state}`, `classes[{id,name}]` (active classrooms of the school, name A-Z), `passwordPlaceholder` = 8 bullets, `passwordHint` `Biarkan kosong untuk guna kata laluan lalai (minimum 8 aksara).`, `passwordMinLength` 8. Never carries the default password.
- **Handler:** `users-read.ts:88` (route :65); `fetchSchoolPupilFormOptions`. **Card:** BE-21. **Contract:** missing.

### M27-12 `GET /api/admin-sekolah/pelajar/:id`
- **Roles/auth:** SA; target must be a pupil of the school. **Response:** `200 {data: SchoolUserDetail}` (S:345): `id,name,email,phone|null,isActive,createdAt,updatedAt,role ("student"),school{id,name,code,district,state}`; no IC.
- **Errors:** `404` not a pupil of this school/unknown/non-digit; `403` inactive pupil.
- **Handler:** `users-read.ts:89` (factory :53); `fetchSchoolPupil`. **Card:** BE-21. **Contract:** missing.

### M27-13 `GET /api/admin-sekolah/guru/:id`
- Same for a teacher (`role "teacher"`). **Handler:** `users-read.ts:90`; `fetchSchoolTeacher`. **Card:** BE-21. **Contract:** missing.

### M27-14 `POST /api/admin-sekolah/pelajar`
Purpose: create a pupil (S12).
- **Roles/auth:** SA. **Request (JSON):** `name` (required, 3-255), `email` (required, valid, unique, <= 255), `password` (optional; empty/absent = the configured default `bulkImportDefaultPassword`; otherwise 8-255), `classId` (optional int of an **active classroom of the school**; blank = none). `role`, `schoolId`, `isActive`, `grade`, `icNumber` are ignored.
- **Response:** `201 {data: SchoolUserDetail, credential{name,school,email,password}, status: 'Pelajar "{name}" berjaya dicipta.'}`. The plaintext password (the typed one or the default) is returned **only here** and stored nowhere. Side effects: creates an active student of the school with `createdById` = actor; hashes the password; if `classId`, enrols the pupil with source `school_admin`.
- **Errors:** `422` fields: `name` required/`The name field must be at least 3 characters.`; `email` required/valid/`The email has already been taken.`; `password` `The password field must be at least 8 characters.`/max; `classId` `The selected class id is invalid.` (not an active classroom of the school).
- **Handler:** `users-write.ts:229` (route :189); `createSchoolPupil`. **Card:** BE-21. **Contract:** missing.

### M27-15 `POST /api/admin-sekolah/guru`
Purpose: create a teacher (S11).
- **Roles/auth:** SA. **Request:** `name` (required, <= 255), `email` (required, valid, unique), `phone` (optional <= 14), `password` (required, >= 6), `passwordConfirmation` (must equal).
- **Response:** `201 {data: SchoolUserDetail, status: "Pengguna berjaya didaftarkan."}`. Side effects: creates an active teacher of the school (`createdById` = actor) with the password hash. **Errors:** `422` fields per the rules above (`The password field confirmation does not match.`).
- **Handler:** `users-write.ts:230` (route :148); `createSchoolTeacher`. **Card:** BE-21. **Contract:** missing.

### M27-16 `PUT /api/admin-sekolah/pelajar/:id`
- **Roles/auth:** SA; target a pupil of the school and active (404 then 403). **Request:** `name`, `email`, `phone` (`null` clears; absent keeps), optional `newPassword` (>= 6) + `newPasswordConfirmation`. Other keys ignored; role, school, status, grade never change.
- **Response:** `200 {data: SchoolUserDetail, status: "Pengguna berjaya dikemaskini."}`. Side effects: updates the user; if `newPassword`, replaces the hash and revokes **all** the target's sessions.
- **Errors:** 404, 403 (inactive), 422 (name/email/phone/newPassword rules; e-mail uniqueness excludes self).
- **Handler:** `users-write.ts:231`; `updateSchoolPupil`. **Card:** BE-21. **Contract:** missing.

### M27-17 `PUT /api/admin-sekolah/guru/:id`
- Same for a teacher. **Handler:** `users-write.ts:232`; `updateSchoolTeacher`. **Card:** BE-21. **Contract:** missing.

### M27-18 `POST /api/admin-sekolah/pelajar/:id/reset-password`
- **Roles/auth:** SA; pupil of the school, active. **Request:** `{newPassword (required, >= 6), newPasswordConfirmation}`. **Response:** `200 {data: {reset: true}, status: "Pengguna berjaya dikemaskini."}`. Side effects: replaces the password hash at once, revokes the target's sessions (not the actor's), bumps `updatedAt`.
- **Errors:** 404, 403 (inactive), `422` (`The new password field is required.`, `The new password field must be at least 6 characters.`, `The new password field confirmation does not match.`).
- **Handler:** `users-write.ts:233`; `resetSchoolPupilPassword`. **Card:** BE-21. **Contract:** missing.

### M27-19 `POST /api/admin-sekolah/guru/:id/reset-password`
- Same for a teacher. **Handler:** `users-write.ts:234`; `resetSchoolTeacherPassword`. **Card:** BE-21. **Contract:** missing.

### M27-20 `POST /api/admin-sekolah/guru/:id/toggle-active`
Purpose: switch a teacher active/inactive (either direction, including an inactive teacher). Pupils cannot be toggled.
- **Roles/auth:** SA. **Request:** none. **Response:** `200 {data: {isActive: boolean}, status: "Status pengguna berjaya dikemaskini."}` (the new state). Side effects: flips `isActive`; deactivating revokes all that teacher's sessions.
- **Errors:** `404` unknown/other school/not a teacher (a pupil id is 404 at the route; the owner contract would answer 403 `Anda tidak boleh mengurus akaun ini.` for a non-teacher in the school).
- **Handler:** `users-write.ts:235` (route :171); `toggleSchoolTeacherActive`. **Card:** BE-21. **Contract:** missing.

### M27-21 `POST /api/admin-sekolah/users/:id/impersonate`
> **Not ported (UD-2): user decision 2026-10-19 drops impersonation ("Login As" / act as another user). Mod Pelajar is `POST /api/session/mode` only (D31c). The backend does not register this route; the frontend removes its caller. Kept here as the record of the mock behaviour.**
Purpose: "Menyamar" (school admin opens a pupil's or teacher's account with a way back).
- **Roles/auth:** any session at the route (401 `UNAUTHORIZED` if none); every other check is in the M01 contract `impersonation.start`, in this order: calling session already impersonating -> `409 CONFLICT`; caller not a school_admin with a school -> `403`; target unknown or of another school -> `404`; target has no session role -> `403`; target not a student/teacher -> `403`; target inactive -> `403`. Messages are the default texts of each status (`This action is unauthorized.`, `Not Found.`, `Conflict.`).
- **Request:** path `id` (positive integer; anything else = unknown target 404). **Response:** `200 {data: {token, expiresAt, user (UserMe), impersonator{id,name}}, status: "Anda kini menyamar sebagai {name}."}`. Side effects: opens a NEW session for the target (not "remember"), whose server-side record holds the actor's session token as `parentToken`; the actor's session stays valid; an audit row (actor, target, `impersonate.start`, time) is written.
- **Conflict with the contract:** the platform contract defines a different mechanism, `POST/DELETE /session/mode` (Mod Pelajar: the admin/school_admin acts as self (student) with data stamped `is_test`, `packages/contract/src/session/session.ts`). The BE-21 card says to align with it and, if the mock conflicts, stop and ask: OQ-API-B3-13.
- **Handler:** `impersonate.ts:44`; `impersonateSchoolUser`. **Card:** UNCOVERED (dropped by user decision, UD-2). **Contract:** missing (related `/session/mode` exists, different semantics).

### M27-22 `POST /api/admin-sekolah/impersonate/leave`
> **Not ported (UD-2): user decision 2026-10-19 drops impersonation ("Login As" / act as another user). Mod Pelajar is `POST /api/session/mode` only (D31c). The backend does not register this route; the frontend removes its caller. Kept here as the record of the mock behaviour.**
- **Roles/auth:** any session at the route (401 without); the **impersonated** session calls it. M01 `impersonation.leave`: a session with no `parentToken` -> `403`; the actor's session expired or ended -> `403` (the impersonated session is revoked anyway; the client must log in again).
- **Response:** `200 {data: {token, expiresAt, user, remember, returnTo ("/admin-sekolah/pelajar" or "/admin-sekolah/guru")}, status: "Anda telah kembali ke akaun pentadbir."}`. The way back is taken only from the server-held `parentToken`, never from the request; side effects: revokes the impersonated session, writes audit `impersonate.leave`. Not wrapped in a transaction (the revoke must survive a PARENT_EXPIRED refusal).
- **Handler:** `impersonate.ts:65`; `leaveImpersonation`. **Card:** UNCOVERED (dropped by user decision, UD-2). **Contract:** missing.

## 11. Uncovered endpoints

After the card audit (63d363c) and the user decisions of 2026-10-19: 2 endpoints, both dropped by user decision.

| Endpoint | Module | Reason |
|---|---|---|
| `POST /api/admin-sekolah/users/:id/impersonate` (M27-21) | M27 | Not ported, dropped by user decision (UD-2) |
| `POST /api/admin-sekolah/impersonate/leave` (M27-22) | M27 | Not ported, dropped by user decision (UD-2) |

M18 Amaran (M18-01..04) was uncovered; UD-4 folds it into BE-21, so it now has a card. `GET/PUT/DELETE /api/guru/questions/:id` are in BE-09 and the earlier `BE-nn*` markers are gone (card audit).

Also relevant to cards (not endpoints of this part):

- (UD-4: the Amaran family is now BE-21 scope.) The M27 dashboard (`GET /api/admin-sekolah/dashboard`, BE-21) reads the M18 Amaran tally (`risk.forSchool`) and the M18 school page; without the four M18 endpoints (or an equivalent service) BE-21 cannot reach parity. The mock has **no write route** for `AmaranIntervention` (the effectiveness report reads seeded rows only).
- `GET /api/guru/dskp/{bidang,sk,sp}` (teacher DSKP reads) are registered by M04 (`m04-question-bank/mock/handlers/dskp.ts`), BE-10 lists them; they belong to another catalogue part. `GET /api/admin/server-status` (BE-22) is in `src/mock/core-data/server-status.ts`, outside the folders of this part, and was not verified here.
- The mock registers no route to **enter or edit headcount marks** (TOV, OTR target/actual, ETR, RS): `headcount_entries` exist only from seeds; the only mutations are create/auto-setup config, reset, delete, drop/restore (OQ-API-B3-4).

## 12. Open questions

IDs `OQ-API-B3-n` are local to this part (the lead will renumber when assembling the index).

- **OQ-API-B3-1 (is_test).** No handler in M08/M10/M11/M12/M17/M18/M27 excludes `is_test` data; the mock has no such field. Plan section 5 says aggregates exclude it (V2-T19). Decision needed: which of the 127 endpoints must exclude `is_test` rows (all aggregates and rankings, certainly M08 rankings/leaderboard, M11, M12, M17 board, M27 reports), and whether Mod Pelajar rows are also hidden from teacher lists (class rosters, Pelajar Saya).
- **OQ-API-B3-2 (public profile).** `GET /api/public/students/:id` needs no session and returns name, first name, school name, level, tier, coins, streak, accuracy and the student's timeline posts (with photos) for any student id. The users are minors. Keep as is (live parity), require an opt-in flag, or require a session?
- **OQ-API-B3-3 (weekly report).** `GET /api/weekly-report` answers `403` for every role by design (M08 OQ-M08-01, live parity). Should the real backend also return 403, or build the report (and for which role)?
- **OQ-API-B3-4 (headcount entry and roles).** (a) The mock has no endpoint to key TOV/OTR/AR/ETR/RS marks; BE-19 says "headcount setup and entry". Which endpoints and who may write marks (teacher import, per-pupil edit)? (b) The role matrix row 3 lists Headcount for Murid, but every `/api/headcounts*` route refuses student, parent, sponsor and officers (403). Confirm that the pupil view is only `GET /api/performance/students/:userId` (headcount cards) and `GET /api/headcounts/students/:userId` is staff-only.
- **OQ-API-B3-5 (teacher scope on monitoring and Kirkpatrick).** `GET /api/monitoring/*` and `GET /api/kirkpatrick/{reaction,learning,behavior,results,chain,students/:id,interventions}` give a teacher the same all-schools data as the admin (provisional, OQ-M11-02, SRS M12 §9), including pupil-level answer detail of any school (`/api/monitoring/schools/:schoolId/students/:userId`). The role-access-matrix grants Guru these menus but defines no scope. Limit a teacher to own school / own classes (changes the response data, not the shape), or keep national scope?
- **OQ-API-B3-6 (monitoring export).** BE-20 says "export as CSV/XLSX per mock", but `GET /api/monitoring/export` returns JSON rows `{filename, rows}` for the client to render PDF/CSV. Keep the JSON contract (preferred, mock parity) or return a file?
- **OQ-API-B3-7 (school admin on Kirkpatrick).** Matrix decision D-RAM-4 includes the Kirkpatrick sub-pages (T1..T4, Rantaian Impak, Intervensi) for Guru and assumes the same for Admin Sekolah, but the mock lets school_admin call only `overview` and `filter-options` (403 on the rest, G4 decision F6). Which is right for v2?
- **OQ-API-B3-8 (constants vs computed).** Figures the mock fixes as documented display constants, not computed: M12 `chain.t4.r` and `correlation.bands` (Pearson r), M12 Behavior heat grid (stored 7x18 aggregate over ~71% of answers), M17 live board `engagement` buckets (29/11/43/3/2229) and `correction` panel (899 records), M17 `gpsOverall` (mean subject GPS of one school's SPM row), M08 S1 subject-GPS two zero rows (`Pendidikan Seni Visual`, `Sains Sukan`), M08 ranking and leaderboard standings of generated learners (stored rows), M08 `GPS_CHART`. Define real computation rules or keep stored/seeded display data for these in B1.
- **OQ-API-B3-9 (interventions scope and wellbeing data).** `GET /api/kirkpatrick/interventions` returns every intervention (free text, mood, accuracy) to any admin or teacher with no school/class scope; `POST` accepts any student id. v2-data-migration Q7/Q9 flag wellbeing data as sensitive. Add scope (own school / own students) and decide retention.
- **OQ-API-B3-10 (two Command Center families).** Teacher `/api/guru/command-center/*` returns bare bodies, rules BR-M10-08..16 (engagement bands by answer days: champion >= 5 days etc.), no `{data}`. Admin/school-admin `/api/admin/command-center/live-data` and `/api/command-center/*` return `{data}` and a different shape (`CcLiveData` in `m17/api/command-center-board-types.ts`), with different engagement rules (constants). BE-22 says "the same endpoints answer for teacher, school admin and admin"; as coded they are two families and the school admin cannot use the teacher base (403). Unify (new shape, frontend change) or keep both (one service, two controllers)?
- **OQ-API-B3-11 (JPN role).** The mock has `jpn_officer` (used in M08 `officerCovers`, M18 scope, `users.ppdState`), but `RoleCode` in `packages/contract/src/common/enums.ts` lists only `ppd_officer` (D31a: one PPD/JPN role). Which role code do the M08/M18 JPN branches map to in v2, and is a state scope needed in B1?
- **OQ-API-B3-12 (M18 scope).** **Resolved by UD-4 (user decision 2026-10-19): M18 Amaran is folded into BE-21.** M18 is not carded. Needed for BE-21 parity: school risk page, executive summary, effectiveness report, school CSV, plus the risk model (score 0.4A+0.3E+0.3M, thresholds 40/60, BR-M18-13/14). Add a card or fold into BE-21/BE-19? No route exists to write interventions (`AmaranIntervention`), and the PPD/JPN pages in `v2-portals.md` have no mock at all.
- **OQ-API-B3-13 (impersonation vs Mod Pelajar).** **Resolved by UD-2 (user decision 2026-10-19): impersonation is dropped; Mod Pelajar is `POST /api/session/mode` only (D31c).** M27 `POST /api/admin-sekolah/users/:id/impersonate` opens a session as a real pupil/teacher of the school with a server-held parent token and `.../impersonate/leave`. The contract defines `POST/DELETE /session/mode` (Mod Pelajar: acts as self (student), data stamped `is_test`). BE-21 says to use one mechanism and ask if they conflict: they do. Keep both endpoints, replace with the mode, or define the semantics (is data written while impersonating a real pupil stamped `is_test`? is it audited?).
- **OQ-API-B3-14 (non-standard bodies).** The frontend clients depend on bare (un-enveloped) bodies and on odd metas: all M10 `GET/POST /api/guru/{chapters,topics,dskp/*}` (bare arrays/objects, refusals as `200 {"error": "<string>"}`), `/api/guru/classes/:id/qr-data`, `/api/guru/contributions`, `/api/guru/remedial-progress`, `/api/guru/galeri-rajah`, all Command Center teacher GETs, `GET /api/guru/students` (`meta {count, schoolSet}`), `GET /api/admin-sekolah/kelas` (extras `tiles`, `levels` beside `data`/`meta`), M27 writes `{data, status}`, `POST /api/kelas-saya/join` `{data, message}`. Reproduce exactly (switch is a no-op) or realign client and contract together? The `200 {"error": string}` inline-create refusals contradict the standard error body.
- **OQ-API-B3-15 (ids and paging).** **Ids resolved by UD-1 (user decision 2026-10-19): the real API follows the contract (string ids, cookie + CSRF, `Session`, 401 `INVALID_CREDENTIALS`, no Bearer); the LEAD realigns mock and HttpTransport (V2-T31).** Numeric ids in the mock vs decimal-string ids in v2 (plan 6.1): the mock path regex is digits only, headcount and many bodies embed numeric ids in `href`/`link` strings (e.g. `/prestasi/kelas/{id}`, `profileUrl /pelajar/{id}`). Confirm string ids everywhere and that `link`/`href` strings are built from them. Also confirm paging: M27 clamps an out-of-range page to the last page whereas the platform convention returns an empty page.
- **OQ-API-B3-16 (rankings order).** `GET /api/rankings` orders rows by `correct` ASCENDING (observed live quirk, DV-26), then accuracy desc. Reproduce or fix (D9: broken behaviour may be fixed)?
- **OQ-API-B3-17 (performance).** Several aggregates scan the whole answer log per request in the mock (class item analysis memo "40 s cold", M11 segments, M17 board tallies, M08 S1). The real backend needs SQL aggregates/indexes (BE-19 mentions views); is a materialised or cached read model acceptable (staleness window) for the board endpoints polled every 10 s (`/api/guru/command-center/live-data`)?
- **OQ-API-B3-18 (file outputs).** Real files are required for `GET /api/kirkpatrick/export-pdf` (PDF, `PdfPort`), `GET /api/headcounts/:id/export`, `GET /api/admin-sekolah/{pelajar,guru}/export.csv`, `GET /api/amaran/export/school/:id`, `GET /api/guru/audio-kbat/template(-word)`, `GET /api/guru/questions/template`; and uploads for `POST /api/timeline` (photos, 2 MB each, JPEG/PNG/WebP, stored as `data:` URLs in the mock), `POST /api/guru/question-papers` (pdf/doc/xls up to 20 MB, only metadata stored in the mock), image uploads on `/api/guru/questions`. Confirm storage (BE-04) and that CSV formula-injection guards (leading `'` on cells starting `= + - @ tab CR`) are required on every CSV.

## 13. Verification run

Commands run in `D:\Dev Projects\pp-docs` (read-only):

```
for m in m08-student-performance m10-teacher-class m11-teacher-analytics m12-kirkpatrick m17-admin-dashboard m18-ppd-jpn m27-school-admin; do
  grep -rnE "route\(" src/modules/$m/mock --include=*.ts | grep -v __tests__ | wc -l
done
```

Results: 30, 39, 7, 14, 11, 4, 18. For M27 the 18 hits contain 4 factory definitions (`csvRoute`, `detailRoute`, `updateRoute`, `resetRoute`, one `route(` each) that are each registered twice (8 routes), so 18 - 4 + 8 = 22 endpoints. No `route(` registration exists outside `mock/handlers`. Endpoint blocks in sections 4-10: 30, 39, 7, 14, 11, 4, 22 (total 127). Summary table rows: 127 (`UNCOVERED` 7, `*` implied 24, contract `missing` 127). Contract check: `packages/contract/src/openapi.ts` registers `COMPONENT_SCHEMAS` plus `registerSessionPaths` only (`/auth/login`, `/auth/logout`, `/session`, `/session/role`, `/session/mode` POST and DELETE).
