# R1 PRD 60: API contract (gap-closing release)

Status: draft for review (G2 input). Branch `docs/r1-prd-devplan` (code base: `feature/v3-bijak-r1`). Date: 2026-11-04. Feature slug: `r1-prd-devplan`. Language: English; BM copy only where quoted from the SRS. Owner: Solution Architect.

**What this file is.** The single list of the HTTP endpoints the R1 screens use, with, for each one, who may call it, what it takes and returns, whether it already exists, and the exact defect when it does not behave as the SRS requires. It is written for developers and cloud agents who build from the docs alone (`docs/plan/r1-development-plan.md` §0A). It does **not** replace the code or the zod contract; where a shape exists in `packages/contract/src/**` the contract file is named and wins on field-level detail.

**What this file is not.** It is not a rebuild plan (FR-X1-5). Every endpoint marked `Exists-OK` or `Exists-Fix` is reused. `Missing-Build` rows add only the piece that is absent.

**Evidence.** The route, path and guard of every `Exists-*` row come from the controller named in its section header (path relative to `apps/api/src/modules/`). Each stated defect was read in the cited service, rules or contract file, or is quoted from the SRS gap list when the row says so; defects that depend on live data were not re-run. The route inventory in Appendix A was generated on 2026-11-04 from every `@Controller` / `@Get` / `@Post` / `@Put` / `@Patch` / `@Delete` in `apps/api/src` (605 handlers in 102 controller files; the regex count of decorators equals the count of extracted routes). Statements about live UAT behaviour (empty lists, 404) are quoted from the SRS gap analysis (`docs/qa/gap-analysis-2026-11-04/`) and were **not** re-run here. Data-model changes are referenced by `DM-nn` from `docs/prd/r1/50-data-model-erd.md` (cross-reference table in section 2.15). Where this file and the ERD disagree the row says so and the question is in section 6.2.

**Privacy.** No real names, e-mails, credentials, tokens or server addresses appear in this file. Examples use fictitious values.

---

## 1. Conventions

### 1.1 Base path, transport, versioning

| Item | Rule (source) |
|---|---|
| Base path | Every route is under `/api` (`app.setGlobalPrefix('api')`, `apps/api/src/configure-app.ts:71`). In this file a path written `/api/x` is the full path. The OpenAPI document is generated from `packages/contract/src/openapi.ts`. |
| Versioning | None. Changes are additive (new optional fields, new routes). A breaking change needs an ADR (`docs/adr/`). |
| Content type | JSON (`application/json`). Exceptions: CSV exports (`text/csv; charset=utf-8`), file upload (`multipart/form-data`), file download (binary), `POST /api/admin/users/bulk-import` (JSON or multipart `csvFile`). |
| Success envelope | `{ "data": T }` (`common/http/respond.ts` `ok`). Lists: `{ "data": T[], "meta": ListMeta }` (`okList`). `204` carries no body. Exceptions that are **raw** on purpose: `POST /api/cikgu/send` (hidden module) and the CSV/file routes. |
| Cache | Pupil, class, ticket and report answers send `Cache-Control: no-store` (`NoStoreInterceptor`). New routes that return personal data must do the same. |
| Time | Timestamps are ISO strings in Malaysia time (`common/time/myt.ts`, contract `TimestampSchema`). |

### 1.2 Authentication and session (as built, not JWT)

| Item | Rule |
|---|---|
| Mechanism | Server-side **session in an HttpOnly cookie** named `pp_session` (`auth.constants.ts` `DEFAULT_COOKIE_NAME`). There is no JWT and no bearer token. |
| Login | `POST /api/auth/login` (public) with `LoginRequest` (`packages/contract/src/auth/login.ts`: `identifier` e-mail or username, `password`, optional `schoolId` when a username exists in more than one school, `remember`). Returns `{ data: Session }` and sets the cookie. |
| Session shape | `Session` (`packages/contract/src/session/session.ts`): `user`, `roles[]`, `active` (role + scope), `mode`, `capabilities[]`, `landingPath`, `expiresAt`, `csrf`, `mustChangePassword`. |
| CSRF | Every authenticated **mutating** request (`POST`, `PUT`, `PATCH`, `DELETE`) must send the header `X-CSRF-Token` with the value of `Session.csrf` (`auth.constants.ts` `CSRF_HEADER`). Missing or wrong: `403` `CSRF_INVALID`. Safe methods do not need it. |
| Logout | `POST /api/auth/logout` is public so a dead session still gets `204`; when a valid session exists the CSRF header is checked first. Clears the cookie. |
| Role | A session has an **active role** (`student`, `teacher`, `school_admin`, `admin`, plus `ppd_officer`, `parent`, `sponsor` which are outside the R1 matrix). Guards use the **active** role only (`RolesGuard`). Display names: student = Murid, teacher = Guru, school_admin = Admin Sekolah, admin = Admin Pusat (`RoleCodeSchema`). |
| Forced password change | While `mustChangePassword` is true every route except `GET /api/session` answers `403` `PASSWORD_CHANGE_REQUIRED` (`PasswordChangeGuard`). |

### 1.3 Guards and role rules

Global guards run in this order (`common/guards/guards.ts`): `AuthGuard` (401) -> `RolesGuard` (403) -> `CapabilityGuard` (403). Rate-limit and NUL-byte guards are also global (`common/security`).

| Decorator | Meaning |
|---|---|
| `@Public()` | No session needed (login, logout, health, public profile, `config/support`, school search, articles, videos list). |
| `@Roles(...)` | The active role must be listed, else `403 FORBIDDEN`. **Many routes have no `@Roles`**: they accept any signed-in role and decide inside the service (scope, ownership). Those are written "any signed-in" in the catalogue; the target restriction is in the role matrix (section 3). |
| `@Capability(key)` | The session capability list (`capabilitiesFor(role, scope)` in `packages/contract/src/access`) must contain the key. Not used by any R1 route today. |
| Scope | School-scoped roles (teacher, school_admin) are forced to the school in the session scope, whatever the query says (Kirkpatrick `scope.ts` `isSchoolForced`; monitoring service). A pupil is limited to own data. |
| Rate limit | `RateLimitGuard` + `@RateLimit(spec)` per user or per client address. Over the limit: `429 RATE_LIMITED` with `retryAfter` seconds and a `Retry-After` header. NFR-4: normal admin navigation must not hit 429; the UI shows a retry message, never an empty error (S0-T08). |

### 1.4 Error envelope

All errors (`common/errors/all-exceptions.filter.ts`, contract `common/error.ts`):

```ts
{ error: { code: string, message: string /* BM, shown to the user */,
           fields?: Record<string, string> /* field -> BM message, for 422 */,
           details?: Record<string, unknown>, retryAfter?: number, requestId?: string } }
```

| Status | `code` | Used for |
|---|---|---|
| 401 | `UNAUTHORIZED` | No or expired session |
| 403 | `FORBIDDEN` | Active role not allowed; also CSRF as `CSRF_INVALID`, forced password change as `PASSWORD_CHANGE_REQUIRED` |
| 404 | `NOT_FOUND` | Unknown id, **or an id outside the caller's scope** (no existence leak), **or a hidden feature** (section 1.7) |
| 409 | `CONFLICT` | Lifecycle pair not allowed, stale filter count, duplicate |
| 400 | `BAD_REQUEST` | Malformed request that is not a validation failure (a malformed JSON body is still mapped to 422); default message "Permintaan tidak sah. Sila muat semula halaman dan cuba lagi." (ERR-REQ-02) |
| 409 | `STALE_VERSION` | A draft or paper save carried an `expectedUpdatedAt` older than the stored version (module code on `CONFLICT`, FR-ERR-25, ERR-CON-02b); `details` carries the stored `updatedAt` |
| 413 | `PAYLOAD_TOO_LARGE` | Body or upload over its limit; default message "Fail atau data terlalu besar. Saiz maksimum ialah {n} MB." |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Wrong file type; default message "Jenis fail tidak disokong. Format dibenarkan: {senarai}." |
| 422 | `VALIDATION_ERROR` | Body/query invalid; `fields` keyed by field path. A malformed body (400) is mapped to 422. Module codes exist, for example `AMBIGUOUS_USERNAME` (with `details.schools`), `BIJAK_GENERATE_*` |
| 429 | `RATE_LIMITED` | Throttle |
| 500 | `SERVER_ERROR` | Never leaks a stack; default message "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi." |
| 502 | `BAD_GATEWAY` | Upstream down (ERR-SYS-02, same message as 500) |
| 503 | `SERVICE_UNAVAILABLE` | Maintenance or session store unavailable; default message "Sistem sedang diselenggara buat sementara waktu. Sila cuba semula dalam beberapa minit." (ERR-SYS-03) |
| 504 | `TIMEOUT` | Proxy timeout (ERR-SYS-04) |

**BM defaults and audit (40 FR-ERR-4, E-1, E-3, E-9).** The default `message` of 401, 403, 404, 409, 422, 429, 500, 413 and 415 is the BM text of ERR-AUTH-01, ERR-ACC-01, ERR-ACC-02, ERR-CON-01, ERR-REQ-01, ERR-RATE-01, ERR-SYS-01, ERR-REQ-03 and ERR-REQ-04 in `40-cross-cutting.md`; no English default ("Not Found.", "Too Many Attempts.") reaches a user. The module BM message constants (`*_MESSAGES`) replace the Laravel English texts of register, reset and change password. An unmapped 4xx stays a 4xx. Every Admin Pusat write route writes one `audit_events` row (actor, time, object, before/after summary). Retried user actions are idempotent per `(userId, clientUuid)` on redeem, convert tokens, claim and ticket purchase (FR-ERR-9, DM-78, DM-79); the repeat returns the first result.

### 1.5 Pagination, filtering, sorting

- Query `page` (default 1) and `pageSize` (default 20, max 100) (`PageQuerySchema`, `common/envelope.ts`). Some lists keep a fixed page size set by the SRS (25 for school-admin lists, 20 for Import & Semakan); the route then ignores `pageSize`.
- Response `meta: { page, pageSize, totalItems, totalPages, from, to, counts? }` (`ListMeta`; `from`/`to` are 1-based, `null` on an empty page). Module aggregates may be added next to the standard keys (`counts`).
- Unpaged lists (`unpaged()` in curriculum, `classes` list) return `meta.totalItems = data.length`.
- Filters are plain query params; unknown params are ignored unless the route says strict. Bulk-by-filter bodies are **strict** (an unknown key is 422).

### 1.6 Validation

zod everywhere (`ZodValidationPipe`, `common/validation`); request bodies of new routes must be a `z.strictObject` in `packages/contract/src/<area>/` and registered in `openapi.ts` (shared-file protocol, plan §3). Free text is length-capped; `\u0000` is refused (`NulGuard`). BM validation messages live next to the schema (`*_MESSAGES`). Validation order for a record route: existence (404) before body (422), as the existing admin routes do.

### 1.7 Hidden features: 404, not 403 (FR-X2-2, D108-6)

| Case | Response |
|---|---|
| Feature is **off** or **not in scope** for the release (Cikgu Alesa `/api/cikgu/*`, Mohon Keluarga Angkat `/api/mohon-keluarga-angkat`, and any route behind a Kawalan Ciri switch that is off) | `404 NOT_FOUND`, standard body, **for every caller including anonymous**. Never 403, never a "feature off" message. A `FeatureGuard` runs **before** `AuthGuard` (API-AUTH-16). |
| Feature is on, caller's role may not use it | `403 FORBIDDEN`. The UI never links to it (FR-X2-3), so a real user cannot reach it from the menu. |
| Record exists but belongs to another school, class or pupil | `404` by default (no existence leak). Listed exceptions where the SRS fixes `403`: pupil asks for another pupil's headcount (FR-MUR-3-1), teacher asks for another teacher's weekly-report class (AC-GUR-43-6), teacher asks for another teacher's class in Analisa Item (FR-GUR-6-1, AC-GUR-6-5), Kirkpatrick pupil of another school (uniform 403), school-wide item analysis for a pupil (AC-MUR-6-5). Each such row says so. |
| Today | **No API feature guard exists** (grep of `apps/api/src` finds no flag check in the controllers). Hidden modules are hidden in the front end only, so `POST /api/cikgu/send` and `POST /api/mohon-keluarga-angkat` answer `200/201` to any signed-in role. This is a defect (API-AUTH-16). |

### 1.8 Identifiers

- **Resource ids** are opaque strings (`IdSchema`, `common/ids.ts`); some legacy routes take numeric-looking ids (`chapterId`, `missionId`, `questionSetId`) and validate them with `intId`. Practice session ids are UUIDs.
- **API ids in this file**: `API-<AREA>-nn`, unique and stable (never renumbered; new rows get the next number).

| Area | Scope |
|---|---|
| AUTH | login, session, account (`/me`), public stats, FeatureGuard |
| MUR | pupil-only screens: shell notifications, dashboard, profile, Kelas Saya, Video, parents |
| GUR | teacher-only screens: classes, pupils, Misi Harian, Set Soalan, Sumbang Soalan, Laporan Mingguan, teacher profile |
| AS | school-admin portal `/admin-sekolah/*`, Amaran Awal, Sekolah Bersaing, school pupil import |
| ADM | Admin Pusat: users, schools, subscriptions, content admin, settings, dashboards, gamification/shop/games admin |
| Q | questions, stimulus groups, Studio, intake (Import & Semakan), question reports, servability |
| DSKP | curriculum: levels, subjects, Bab/Topik/SP, DSKP lookups, Bab mapping, Heatmap |
| BIJAK | Bijak SPM papers/attempts, SPM hub lanes (Databank, Latih Tubi lane, Tracking A, Subjektif), Kontrak, Set Builder |
| PRAC | practice sessions, Latih Tubi, Soalan by Chapter, Remedial, structured, PKSK, audio |
| RPT | performance, analytics, item analysis, headcount, Kirkpatrick, monitoring, Command Center, reports |
| GAME | Permainan, battle, leagues, tournaments, gamification, wallet, shop, marketplace, rankings |
| SUP | support tickets, support contact setting |
| FILE | file upload and download |

### 1.9 Status legend and card references

| Status | Meaning |
|---|---|
| **Exists-OK** | The route exists in the cited controller and, as read in code, meets the R1 contract. Verify the ACs only (FR-X1-5 "Keep"). Where UAT data is empty the note says "data defect". |
| **Exists-Fix** | The route exists; the row states the **exact defect** (role list, scope, missing field, wrong data rule). Change only that. |
| **Missing-Build** | No route today. Full request and response shape is in section 2.17 (or inline). |

`Card` = task card of `docs/plan/r1-development-plan.md` (`S<sector>-T<nn>`). `FR/AC` = IDs of the three SRS files; a `*` means "all numbered requirements of that module" because the module has many.

Role abbreviations in the catalogue: **M** Murid (`student`), **G** Guru (`teacher`), **AS** Admin Sekolah (`school_admin`), **AP** Admin Pusat (`admin`), "any" = any signed-in role (no `@Roles`), "public" = no session.

---

## 2. Endpoint catalogue

Controller paths are relative to `apps/api/src/modules/`. A row that groups several routes lists each `METHOD path` explicitly, so Appendix A maps one to one.

### 2.1 AUTH

Controllers: `auth/auth.controller.ts`, `account/account.controller.ts`, `common/guards/*`.

| API ID | Method + path | Roles | Request | Response | Status | FR/AC | Card |
|---|---|---|---|---|---|---|---|
| API-AUTH-01 | `POST /api/auth/login` | public | `LoginRequest` {identifier, password, schoolId?, remember} | `{data: Session}`; `401` bad credentials; `422` `AMBIGUOUS_USERNAME` with `details.schools`; `429` | Exists-OK (`auth/auth.controller.ts:64`) | AC-X2-1, FR-MUR-SH-* | S5-T10 |
| API-AUTH-02 | `POST /api/auth/logout` | public (CSRF checked when a session exists) | none | `204`; cookie cleared; replaying with the old cookie gives `401` on the next call | Exists-OK (`auth/auth.controller.ts:80`) | FR-MUR-A5-3, R1-GUR-A5, R1-AS-A5 | S5-T10 |
| API-AUTH-03 | `GET /api/session` | any signed-in (also while password change is pending) | none | `{data: Session}` | Exists-Fix: answers `503` with the BM maintenance body "Sistem sedang diselenggara buat sementara waktu. Sila cuba semula dalam beberapa minit." (ERR-SYS-03, `SERVICE_UNAVAILABLE`) when the session store is unavailable, instead of a bare 500 (`auth/auth.controller.ts:101`) | FR-MUR-SH-* | S0-T06 |
| API-AUTH-04 | `POST /api/session/role` | any signed-in | `SwitchRoleRequest` {role} | `{data: Session}` | Exists-OK | multi-role staff | n/a |
| API-AUTH-05 | `POST /api/session/mode`, `DELETE /api/session/mode` | any signed-in (Admin Sekolah/Admin Pusat use "Mod Pelajar") | `EnterModeRequest` {mode: 'mod_pelajar'} | `{data: Session}` | Exists-OK | R1-AS-0 | n/a |
| API-AUTH-06 | `POST /api/auth/register` | public | `RegisterRequest` (`account/schema.ts`): `ACCOUNT_PASSWORD_MIN = 8`; a student `grade` below 7 or above 11 is refused with `fields.grade` "Tahap tidak sah." (`gradeToLevelCode` / `levelCodeToGrade`: Tingkatan n -> `T{n}` -> `grade = n + 6`); BM message constants replace the Laravel English texts (section 1.4) | `201 {data}`; `422` fields | Exists-Fix: password minimum 8, `grade` 7..11 and BM messages as stated in Request (`account/account.controller.ts`) | Murid onboarding | n/a |
| API-AUTH-07 | `POST /api/auth/password/email`, `POST /api/auth/password/reset`, `POST /api/auth/password/reset-ic` | public | e-mail / token+new password (`ACCOUNT_PASSWORD_MIN = 8`) / IC reset | `200` generic (no account enumeration) | Exists-Fix: reset enforces the minimum 8 characters and answers in BM (section 1.4) | account recovery | n/a |
| API-AUTH-08 | `GET /api/me` | any signed-in | none | `{data: AccountProfile}` (`account/schema.ts` ~line 252: name, e-mail, phone, bio, grade, school, role, join date) | Exists-Fix: lacks `aspiration` (Cita-Cita, max 255) that FR-MUR-A1-3 saves (the public link of FR-MUR-A1-4 is built in the front end from the user id). Target: `aspiration` is `varchar(255)` and `bio` allows 1000 characters (`ACCOUNT_BIO_MAX = 1000`) (DM-80); `aspiration` never appears in the public profile | FR-MUR-A1-1..4, FR-MUR-A2-* | S5-T05 |
| API-AUTH-09 | `PUT /api/me` | any signed-in, own record | `name` max 255, `phone` max 14, `bio`, `aspiration`; `grade`, `schoolId` and `role` are **ignored for every role** (D-A15); absent key keeps the value, null/blank clears (`account/schema.ts:432-440`) | `{data: AccountProfile}` | Exists-Fix, exact defect (scope hole, F-17): `apps/api/src/modules/account/profile.service.ts:157` writes `grade` from the body for every role, and `:158` writes `schoolId` for a student or parent (`mayChooseSchool` from `SELF_SCHOOL_ROLES`, `:119-121`), so a pupil can move to another school or Tingkatan and change XS-1, rankings, level gating and the school admin list. Fix: delete both writes and their `schoolInvalid` / `gradeInvalid` checks; `grade` and `schoolId` change only through admin user edit (`PUT /api/admin/users/:id`) or the school-admin pupil edit; a request that sends them has them ignored and the stored values stay (AC-MUR-A2-6). Also: `ACCOUNT_BIO_MAX` becomes 1000 and `aspiration` (max 255) is added (DM-80; OQ-API-03 decided). `PUT /api/me` is a partial update: every key is optional and `name` is 1..255 when present; for the role student `grade`, `schoolId` and `role` are ignored and the answer is `200` with the stored values. Register and admin edit reject a student `grade` outside 7..11 with `fields.grade` "Tahap tidak sah." | FR-MUR-A1-3 | S5-T05 |
| API-AUTH-10 | `PUT /api/me/password` | any signed-in | body per `account/schema.ts` (current and new password; the new password has `ACCOUNT_PASSWORD_MIN = 8`; login itself accepts any non-empty password) | success without body or `{data}`; `422` fields | Exists-Fix: minimum 8 characters, BM message "Kata laluan mesti sekurang-kurangnya 8 aksara." | FR-MUR-A2-* | S5-T05 |
| API-AUTH-11 | `POST /api/me/picture` | any signed-in | multipart image (see API-FILE-01 for limits) | `{data}` with the stored picture reference | Exists-OK (kept only if already built, FR-MUR-A1-8) | FR-MUR-A1-8 | S5-T05 |
| API-AUTH-12 | `GET /api/me/settings`, `PUT /api/me/settings` | any signed-in | body per `account/schema.ts` (Mod Rohani switch) | `{data: Settings}` | Exists-OK (Mod Rohani) | FR-MUR-A2-* | S5-T05 |
| API-AUTH-13 | `GET /api/public/stats` | public | none | `{data}` with the public counters, including `tahap` | Exists-Fix: UAT returns `tahap` = 11 (Darjah + Tingkatan active); must return **5** (FR-X3-2). Root cause is the active-level data (DM-12 deactivates Darjah 1-6; DM-13 adds a check so it cannot recur) and, if the query counts levels without `is_active` and `stage <> 'primary'`, the query; confirm in code before changing | FR-X3-2, AC-X3-1 | S4-T05 |
| API-AUTH-14 | `GET /api/me/gamification-summary` | any signed-in | none | {coins, xp, streak, level} | Exists-OK (`wallet/wallet.controller.ts:60+`) | shell header | n/a |
| API-AUTH-15 | `GET /api/me/notifications`, `GET /api/me/notifications/unread-count`, `POST /api/me/notifications/read-all`, `POST /api/me/notifications/bulk-read`, `POST /api/me/notifications/bulk-delete`, `POST /api/me/notifications/:id/read`, `DELETE /api/me/notifications/:id` | any signed-in, own only | `page`, `pageSize`; bulk bodies {ids[]} | list / counts | Exists-OK (`notifications/notifications.controller.ts`) | FR-MUR-SH-* (bell) | S0-T06 |
| API-AUTH-16 | **FeatureGuard** (not a route): global guard that answers `404 NOT_FOUND` for any route of an off or hidden feature, before `AuthGuard` | all | n/a | `404` standard body | Missing-Build: no server-side flag exists; `POST /api/cikgu/send`, `GET/POST /api/cikgu/*`, `POST /api/mohon-keluarga-angkat` are reachable today. Shape in 2.17 | FR-X2-1a, FR-X2-2, NFR-6, FR-ADM-N06.* | S0-T10 |
| API-AUTH-17 | `GET /api/health`, `GET /api/ready`, `GET /api/metrics` | public (`metrics` is restricted to the internal network, `common/metrics/internal-network.ts`) | none | liveness / readiness / Prometheus text | Exists-OK (`common/health/*.ts`, `common/metrics/metrics.controller.ts`); ops only, no R1 screen. **Additive field on `GET /api/ready` (S0-T03, R1 decision D113, round 3):** `worker: "ok"|"down"|"disabled"`. `disabled` when `JOBS_WORKER_ENABLED` is false. Otherwise it is computed in `jobs/jobs.health.ts` from the worker heartbeat: the jobs worker loop (same process as the API) stamps `lastTickAt` on every poll tick and ticks at most 15 s apart even when no job is queued; `ok` when `now - lastTickAt <= 60 s`, `down` when older than 60 s or the worker never ticked since start. The field is informational: a `down` worker does not change the HTTP status of `/api/ready` (that stays driven by the database check), and `/api/health` is unchanged | FR-X5-2 | S0-T02, S0-T03 |

### 2.2 MUR (pupil-only screens)

Controllers: `practice/reads/overview/overview.controller.ts`, `classes/kelas-saya.controller.ts`, `content/videos/videos.controller.ts`, `content/articles/articles.controller.ts`, `parents/parents.controller.ts`, `reports/performance/http/social.controllers.ts`, `gamification/gamification.controller.ts`.

| API ID | Method + path | Roles | Request | Response | Status | FR/AC | Card |
|---|---|---|---|---|---|---|---|
| API-MUR-01 | `GET /api/dashboard` | any signed-in (pupil data of the caller) | none | `PracticeReadDashboard` (`packages/contract/src/practice/reads/schema.ts:206`): greeting, subjects with servable counts, streak, targets, wallet strip | Exists-Fix: missing blocks Pakej SPM Aktif, Kombo (+warning), Cabaran Kilat, Soalan Terkini, Statistik; "Subjek Tersedia" counts must be what Latih Tubi serves (D91); no mood (OQ-MUR-10) | FR-MUR-2-* | S5-T04 |
| API-MUR-02 | `GET /api/me/profile-activity` | M (own) | none | `{calendar30d[], badges[], recentSessions[10], tiles}; the public profile of the same pupil returns first name only and `school: null`` | Missing-Build (shape 2.17.1). No route returns the 30-day calendar, badge list or last 10 sessions (parity C20) | FR-MUR-A1-1, A1-2, A1-6 | S5-T05 |
| API-MUR-03 | `GET /api/public/students/:id` | public (rate limited per client address, uniform 404 after a 150 ms floor) | none | `PerformancePublicProfile` (first name only, `school: null`, tiles, posts = []) | Exists-Fix is not needed for the shape: the code deliberately returns **first name only and no school** (privacy decision OQ-8 in `public-profile.service.ts`) and the SRS now says the same (FR-MUR-A1-5, OQ-API-04 decided). Keep as is; only the SRS and the test are aligned | FR-MUR-A1-5, AC-MUR-A1-5 | S5-T05 |
| API-MUR-04 | `GET /api/kelas-saya`, `POST /api/kelas-saya/join` | any signed-in pupil | join: {code} | list of the pupil's classes; join returns the class | Exists-Fix: follow V2 (OQ-X-3): a pupil is in a class only because the teacher or admin enrolled them, so the V3-only "Sertai" box is removed from the UI and `POST /api/kelas-saya/join` answers `404` for every role (OQ-API-08 decided, AC-MUR-8-3); the column `classrooms.join_code` stays (no migration) but `joinCode` and the QR are removed from pupil and teacher responses; the list stays and shows classmates by display name only (4.6) | FR-MUR-8-*, FR-GUR-8-* | S6-T14, S5-T08 |
| API-MUR-05 | `GET /api/videos` (public), `GET /api/videos/:id` (public), `GET /api/videos/form-context`, `POST /api/videos`, `PUT /api/videos/:id`, `DELETE /api/videos/:id` | list/detail: public; write routes: AP and G (a Guru video is school-scoped, `visibility = 'school'` with the teacher's `school_id`, DM-76); a pupil gets `403` | list: `subject`, `level`, `page`; Guru create: `{title, url, subjectId?, category}` (category `motivasi`, `tutorial`, `tips_spm`, `ceramah`, `lain`) | `Video[]` | Exists-Fix (`content/videos/videos.controller.ts`): write routes are limited to Admin Pusat and Guru (OQ-API-12 amended); the list returns global videos plus the own school's; admin writes are exposed to the admin list (N-01); the Murid "Tambah Video" button stays hidden (OQ-MUR-11) | FR-MUR-7-*, R1-ADM-N-01 | S5-T08 |
| API-MUR-06 | `GET /api/articles`, `GET /api/articles/hot`, `GET /api/articles/latest`, `GET /api/articles/:slug` | public | list: `page`, `category` | `Article[]` | Exists-OK (`content/articles/articles.controller.ts`) | FR-MUR-20-*, R1-ADM-N-02 | S5-T09 |
| API-MUR-07 | `GET /api/banners/active` | public | none | `Banner[]` | Exists-OK (`content/banners/banners.controller.ts`) | shell | S5-T09 |
| API-MUR-08 | `GET /api/perutusan`, `GET /api/perutusan/mine`, `GET /api/perutusan/compose-context`, `GET /api/perutusan/:id`, `POST /api/perutusan`, `POST /api/perutusan/:id/reactions`, `POST /api/perutusan/:id/comments`, `GET /api/public/perutusan/:id` | `POST /api/perutusan`: AP, AS; others: any signed-in; last is public | compose: {title, body, audience} | `Perutusan` | Exists-OK (`content/perutusan/perutusan.controller.ts`); the FE route `/perutusan` is unbuilt (AS-2 card), not an API gap | R1-AS-2 | S6-T07, S5-T09 |
| API-MUR-09 | `GET /api/me/parent-invite`, `POST /api/me/parent-invite` (and `/generate`), `GET /api/parent-invites/:token` (public), `POST /api/parent-invites/:token/accept` (parent), `GET /api/me/parent-links`, `DELETE /api/me/parent-links/:linkId`, `GET /api/admin/parent-links`, `DELETE /api/admin/parent-links/:linkId` | invite create/read: M; accept: parent; links: M, parent; admin links: AP, AS | none | invite {token, url, expiresAt} | Exists-OK (`parents/parents.controller.ts`); Delivery B | R1-MUR-40, R1-ADM-P2-16 | S6-T15 |
| API-MUR-10 | `GET /api/gamification/achievements`, `GET /api/gamification/share-cards`, `GET /api/gamification/referral` | any signed-in pupil | none | badges / cards / referral code | Exists-Fix for referral: rule differs from V2 (Rujuk Kawan, R1-MUR-36); achievements Exists-OK | R1-MUR-34, 36 | S7-T04, S7-T07 |

### 2.3 GUR (teacher-only screens)

Controllers: `classes/teacher.controller.ts`, `classes/missions/*.ts`, `classes/question-sets/question-sets.controller.ts`, `questions/http/guru.controller.ts`, `questions/workflow/dskp/dskp.controller.ts`, `questions/workflow/imports/imports.controller.ts` (second class), `command-center/guru/guru.controller.ts`, `reports/performance/http/social.controllers.ts`.

| API ID | Method + path | Roles | Request | Response | Status | FR/AC | Card |
|---|---|---|---|---|---|---|---|
| API-GUR-01 | `GET /api/guru/classes` | G | none | `TeacherClass[]` with pupil count (distinct, XS-1) | Exists-Fix: response carries the V3-only `joinCode`/QR fields that GUR-8 drops; pupil count must equal XS-1 | FR-GUR-8-1 | S6-T14 |
| API-GUR-02 | `POST /api/guru/classes` | G | {name, educationLevel, subjectId?, year?, schoolId? (default own)} | `{data: TeacherClass}`; `422` fields | Exists-OK (`classes.service.ts:90`); make `subject` optional per FR-GUR-8-2 (verify) | FR-GUR-8-2 | S6-T14 |
| API-GUR-03 | `PUT /api/guru/classes/:id` (edit class) | G (own class) | same fields as create | `{data: TeacherClass}` | Missing-Build (shape 2.17.2). Only create, list and `qr-data` exist | FR-GUR-8-2 | S6-T14 |
| API-GUR-04 | `GET /api/guru/classes/:id/qr-data` | G | none | QR payload | Exists-Fix: removed from the UI and the route answers `404` for every role (join code and QR dropped, FR-GUR-8, OQ-API-08 decided); the column `classrooms.join_code` stays | FR-GUR-8 gap | S6-T14 |
| API-GUR-05 | `GET /api/guru/students`, `PUT /api/guru/students/:id` (add pupil to class), `DELETE /api/guru/students/:id?classroomId=` (enrolment becomes `removed`) | G | list: `tab=mine or school`, `search`, `page`; PUT body {classroomId} | list of pupils; `{removed: 1}` | Exists-OK (`classes.service.ts:174,264`); list needs the V2 columns Tahap, Tugasan, Skor Purata, Terakhir Aktif | FR-GUR-8-3, FR-GUR-41-1, 41-2 | S6-T10 |
| API-GUR-06 | `POST /api/guru/students` (Cipta Pelajar) | G | {name, classroomId, ic?} | `{data: {id, username, defaultPasswordNotice}}`; message "Pelajar dicipta. Login: {username} / {kata laluan lalai}"; the default password comes from configuration, never a literal | Missing-Build (shape 2.17.2). "Cipta Pelajar" redirects silently today because no route creates a pupil for a teacher | FR-GUR-41-3, AC-GUR-41-* | S6-T10 |
| API-GUR-07 | `GET /api/guru/dashboard` | G | none | `TeacherDashboard` | Exists-Fix: needs V2 cards Ringkasan Mingguan, Headcount TOV/RS/AR, On Track/Off Track, and "Soalan" = own contribution count (FR-GUR-44-1) | FR-GUR-2-* | S6-T07 |
| API-GUR-08 | `GET /api/guru/chapters`, `POST /api/guru/chapters`, `GET /api/guru/topics`, `POST /api/guru/topics` | G | create: {subjectId, levelId, name} | chapters/topics owned by the teacher | Exists-OK (`classes/teacher.controller.ts`) | R1-GUR-9, 44 | S5-T02 |
| API-GUR-09 | `GET /api/guru/contributions`, `GET /api/guru/galeri-rajah` | G | none | contribution counts; figure gallery | Exists-OK | FR-GUR-44-1 | S6-T06 |
| API-GUR-10 | `GET /api/missions/today` | any signed-in pupil | none | today's missions | Exists-OK (`classes/missions/missions.controller.ts`) | pupil Misi Harian | S6-T07 |
| API-GUR-11 | `GET /api/guru/missions`, `POST /api/guru/missions`, `DELETE /api/guru/missions/:id` | G | create: {title, description?, targetQuestions 1..1000, rewardCoins 0..`mission_reward_max` (default 10000), date, classroomId?}; at most 5 missions per teacher per day; fields per DM-75 | list with `completedCount`, `global` flag; `{data: Mission}`; `{deleted: 1}` | Missing-Build (shape 2.17.2). No `/guru/missions` route exists | FR-GUR-2b-1..3 | S6-T07 |
| API-GUR-12 | `GET /api/guru/remedial-progress`, `GET /api/guru/command-center/remedial/scan`, `POST /api/guru/command-center/remedial/generate`, `POST /api/guru/command-center/remedial/cancel` | G, AP | scan: `classroomId`, `subjectId`; generate: {classroomId, subjectId, pupilIds[]} | scan result; generated `RemedialTest` | Exists-OK (`classes/missions/remedial.controller.ts`); end-to-end click test pending (S6-T07) | R1-GUR-1 | S6-T07 |
| API-GUR-13 | `GET /api/guru/command-center/live-data`, `GET .../drill`, `GET .../evaluate`, `GET .../predictive`, `GET .../achievements`, `GET .../badge-holders` | G, AP | `classroomId?` | board / drill / evaluate / predictive / badges | Exists-OK (`command-center/guru/guru.controller.ts`); Evaluate and Badges are "unverified" in the SRS | FR-GUR-1-* | S6-T07 |
| API-GUR-14 | `GET /api/command-center/school/:id`, `.../school/:sid/teacher/:uid`, `.../classroom/:id`, `.../headcount/:configId`, `.../student/:id`, `.../student/:id/subject`, `.../student/:id/week`, `.../session/:sessionId` | G (own scope), AS (own school), AP | none | drill payloads | Exists-OK (`command-center/drill/drill.controller.ts`); pupil and class drill pages are FE work | FR-GUR-1-* | S6-T07 |
| API-GUR-15 | `GET /api/set-soalan-saya` | any signed-in pupil | none | published sets assigned to a class where the pupil has an active enrolment (DM-46); the session mode is `question_set` | Exists-Fix (`classes/question-sets/question-sets.controller.ts:36`): the list reads the assigned classes of DM-46; a set id the pupil is not assigned to answers `404` ERR-ACC-02 both here and at `POST /api/practice/sessions` with `questionSetId` (API-PRAC-01, the one place the 404 is enforced for a start). R1 sets have no time limit and no attempt cap (the teacher form of 20 R1-GUR-8b has no such field): `timeLimitSec` is null and ERR-PRAC-05 is never raised for a set. Empty today because teachers cannot create sets (API-GUR-16) | FR-MUR-26-* | S5-T11 |
| API-GUR-16 | `GET /api/guru/question-sets`, `POST /api/guru/question-sets`, `GET /api/guru/question-sets/:id`, `PUT /api/guru/question-sets/:id`, `DELETE /api/guru/question-sets/:id`, `POST /api/guru/question-sets/:id/status`, `POST /api/guru/question-sets/:id/copy` (body `{classroomIds}`; the dialog "Pilih Kelas Sasaran" sends a one-element array), `GET /api/guru/question-sets/:id/results?classroomId=` | G (own sets) | create: {title, subjectId, levelId? (stored in `question_sets.education_level_id`, DM-46), classroomIds[] (own classes, at least 1 to publish), questionIds[] approved only, status 'draft or published'} | set with counters; results rows per attempt; copy body `{classroomIds}`; **bank picker** `GET /api/guru/question-sets/bank?subjectId=&levelId=&q=&cursor=` (G): approved and servable questions only, newest first, 50 units per page, `q` at least 2 characters, a stimulus group is one unit (shape 2.17.2) | Missing-Build (shape 2.17.2). The module `apps/api/src/modules/classes/question-sets` exists but holds **only the pupil feed** `GET /set-soalan-saya` (API-GUR-15); none of the teacher routes `/api/guru/question-sets*` exists, so all of them are built (20 R1-GUR-8b says the same). Registered additions: ADD-04 = DM-46 `question_sets.education_level_id`; ADD-19 = the results route and the copy body; both are part of this row | FR-GUR-8b-1..6, FR-MUR-26 | S6-T14 |
| API-GUR-17 | `POST /api/guru/question-papers` | G, AP | multipart: 1..5 files (PDF, DOCX or XLSX; images are not accepted; each at most 20 MB), `paperType` (OPT-JENIS-HANTARAN slug), free-text `subject` (<= 100), `levelId?`, `year?`, `preparedBy?` (<= 200), `note?`, and the boolean answer-scheme confirmation | `201 {data: {batchId}}`; message "Kertas dihantar kepada admin." | Exists-Fix: answers **503** because `question-sets.ports.ts:46,56` binds `UnavailablePaperIntake` and nothing calls `provideIntake`; must create an intake batch with `source = 'guru'` (DM-72) | FR-GUR-44-3, FR-ADM-Q12.2, Q12.3 | S1-T08, S6-T06 |
| API-GUR-18 | `GET /api/guru/questions`, `GET /api/guru/questions/:id`, `POST /api/guru/questions`, `PUT /api/guru/questions/:id`, `DELETE /api/guru/questions/:id` | G (own, pending only for edit/delete), AP | `QuestionGuruCreateRequest` (`questions/schema.ts:651`); create and update gain `difficultyLevel` (required), `tp`, `cognitiveLevel`, `chapterId`, `spIds: Id[]` (1 to 3 ids; a single-select form sends a one-element array, N-10) (the last four optional where D112 allows) | `QuestionGuruSummary`/`Detail` | Exists-Fix: edit form must preselect the stored difficulty and stored correct answer (FR-GUR-44-6); no per-question source gate (D99). **One intake path (D113-continued, L-6):** every teacher submission (single MCQ here, structured question, paper upload through API-GUR-17, diagram) is an intake item of an `intake_batches` row with `source = 'guru'` (DM-72); `POST` creates a one-item batch, and the list shows the teacher's own items with the status of OPT-STATUS-SOALAN (`Menunggu Semakan` until the admin acts). The admin reviews it in Semak Import / Kiriman Guru (API-Q-14, API-Q-15); "Terima" creates a `Draf` question in the Studio wizard with the submitted fields pre-filled (card S2-T02); `PUT`/`DELETE` act on the item while it is pending | FR-GUR-44-1, 44-2, 44-5, 44-6 | S6-T06 |
| API-GUR-19 | `GET /api/guru/questions/template`, `POST /api/guru/questions/import` | G, AP | `.csv` only (JSON `csv` text or multipart), at most 2 MB and 500 data rows | `{imported, errors[{row, message}]}` (the error file is built on the client from this response) | Exists-Fix: "Template" must be a real download; error rows reported while valid rows still import (FR-GUR-44-4) | FR-GUR-44-4 | S6-T06, S1-T05 |
| API-GUR-20 | `GET /api/guru/dskp/bidang`, `GET /api/guru/dskp/sk`, `GET /api/guru/dskp/sp`, `POST /api/guru/dskp/bidang`, `POST /api/guru/dskp/sk`, `POST /api/guru/dskp/sp`, `GET /api/guru/audio-kbat/template`, `GET /api/guru/audio-kbat/template-word` | G, AP (POSTs in `question-sets.controller.ts`) | query `subjectId`, `levelId`, `bidangId`, `skId` | DSKP lookups (also in DSKP area) | Exists-OK | FR-GUR-44-* | S6-T06 |
| API-GUR-21 | `GET /api/guru/weekly-report?classroomId=&week=YYYY-MM-DD` | G (own classes; another teacher's class = 403, the listed exception of 1.7) | `classroomId` required, `week` optional (defaults to the current Monday-Sunday) | `GuruWeeklyReport` (shape 2.17.2); every accuracy field is a number with one decimal on the wire (pooled correct ÷ answered × 100, XS-5) and the screen shows the whole number rounded half up (4.6, D-T10-1) | Missing-Build. The only weekly route is `GET /api/weekly-report`, which **throws FORBIDDEN for every role** by design (`reports/performance/services/weekly-report.service.ts:5-11`, `social.controllers.ts`); the Guru sidebar item therefore shows "403 Akses Ditolak". **One canonical route (R1 decision D113, round 3):** the Guru page `/guru/laporan-mingguan-kelas` (20 R1-GUR-43; the old path `/guru/laporan-mingguan` redirects to it) calls only `GET /api/guru/weekly-report`; `GET /api/weekly-report` (API-RPT-13) is not an alias, stays `403` for every role and no R1 page calls it | FR-GUR-43-1..9, AC-GUR-43-1..9 | S6-T01 |
| API-GUR-22 | `PUT /api/account/teacher-profile`, `GET /api/public/teachers/:id` | PUT: G (own); GET: public | PUT {name, bio, ic?, schoolId, subject, qualification, experienceYears, phone?}; GET none | profile; public teacher card | Missing-Build (shape 2.17.2). No route exists; `/guru/profil/edit` and `/guru/{id}` have no route either | FR-GUR-A1-* | S5-T05 |
| API-GUR-23 | `GET /api/cikgu/*`, `POST /api/cikgu/*` (RPH, essays, PBD, send) | G, AP (send: any) | n/a | n/a | Exists-Fix: **must be 404 for all** while the module is hidden (D102). See API-AUTH-16 | FR-X2-1a | S0-T10 |
| API-GUR-24 | `GET /api/guru/personal-questions`, `POST /api/guru/personal-questions`, `GET /api/guru/personal-questions/:id`, `PUT /api/guru/personal-questions/:id`, `DELETE /api/guru/personal-questions/:id` | G (own; another teacher's id = 404) | create/update: {subjectId, educationLevelId (required, Tingkatan 1-5), chapterId?, spIds?, tp?, cognitiveLevel? (the four DSKP fields, conditional: see the rules under API-GUR-24 in 2.17.2), difficulty 1..5, text, options[4] {text}, correctIndex 0..3, referenceUrl? (http or https only)} | `PersonalQuestion` (shape 2.17.2; carries the DSKP fields); delete answers `409` "Soalan sedang digunakan dalam misi." while an active Misi draws the question | Missing-Build (shape 2.17.2). `/api/guru/questions` (API-GUR-18) creates teacher intake items (`source = 'guru'`) and is not reused: a personal question never enters the bank, Databank, Set Soalan pickers or admin review (FR-GUR-44a-4) | FR-GUR-44a-1..6, AC-GUR-44a-1..6 | S6-T16 |
| API-GUR-25 | `GET /api/missions/today` and the mission draw behind it | M (own classes) | none | missions with `personalQuestionCount`; a served item may carry `referenceUrl` | Exists-Fix: a mission is drawn from the bank only today. The personal questions (API-GUR-24) of the teacher who owns the pupil's class, in the mission's subject, must be served through Misi Harian and nowhere else. The draw point is the mission question builder in `classes/missions` (found by symbol); S6-T16 changes it unconditionally and owns this row; S6-T07 (Dashboard) only reads `personalQuestionCount` | FR-GUR-44a-3, FR-GUR-44a-4, AC-GUR-44a-4 | S6-T16 |
| API-GUR-26 | `GET /api/guru/structured-questions`, `GET /api/guru/structured-questions/:id`, `POST /api/guru/structured-questions`, `PUT /api/guru/structured-questions/:id` | G (approved questions only); AP keeps API-Q-10 | list: `subjectId?`, `educationLevelId?`, `status?`, `page` (fixed 20 per page); POST/PUT (own question in `review` or `draft` only): stimulus text, image (`question_image`), 1..10 parts | `GuruStructuredRow` / `GuruStructuredDetail` (shape 2.17.2) | Missing-Build (shape 2.17.2): teacher-facing mount over the same read service as API-Q-10, without admin-only fields. POST and PUT create an intake batch with `source = 'guru'` (DM-72), reviewed by Admin Pusat like any teacher submission (ADD-13) | FR-GUR-44b-1..7, AC-GUR-44b-1..7 | S6-T17 |
| API-GUR-27 | `GET /api/guru/databank/overview`, `GET /api/guru/databank/questions` | G | list: `subjectId?`, `q?`, `page` (20 per page) | overview: counts per subject group; list: approved questions with their whole stimulus group (shape 2.17.2) | Missing-Build (shape 2.17.2). `GET /api/spm/databank` (API-BIJAK-07) is the pupil Bijak past-paper lane and is not reused | FR-GUR-44d-1..6, AC-GUR-44d-1..6, FR-X1-4d/4e/4f | S6-T19 |
| API-GUR-28 | `GET /api/guru/kertas-peperiksaan`, `POST /api/guru/kertas-peperiksaan`, `GET /api/guru/kertas-peperiksaan/:id`, `PUT /api/guru/kertas-peperiksaan/:id`, `DELETE /api/guru/kertas-peperiksaan/:id`, `POST /api/guru/kertas-peperiksaan/:id/share`, `POST /api/guru/kertas-peperiksaan/:id/withdraw` | G (own; another teacher's id = 404) | create {name 1..255, subjectId}; update adds questionIds[] (approved only) | `KertasPeperiksaan` (shape 2.17.2) | Missing-Build (shape 2.17.2). Stored as `question_sets` with `kind = 'kertas'` (DM-43), not as `papers` (admin-owned, would appear in the pupil SPM hub). A shared paper reaches the pupil through the unchanged Set Soalan Guru feed (API-GUR-15). File upload of a paper stays API-GUR-17 | FR-GUR-44e-1..5, AC-GUR-44e-1..5 | S6-T20 |

### 2.4 AS (Admin Sekolah)

Controllers: `school-admin/school-admin.controller.ts`, `school-admin/people/pupils.controller.ts`, `school-admin/people/teachers.controller.ts`, `school-admin/reports/school-reports.controller.ts`, `school-admin/amaran/amaran.controller.ts`, `games/leagues/sekolah-bersaing.controller.ts`, `command-center/board/board.controller.ts`.

| API ID | Method + path | Roles | Request | Response | Status | FR/AC | Card |
|---|---|---|---|---|---|---|---|
| API-AS-01 | `GET /api/admin-sekolah/dashboard` | AS | none | `SchoolAdminDashboard` | Exists-Fix: numbers disagree with other screens (pupils 17/16/13, teachers 3/4, answers 122/30/36). Read XS-1..XS-5 from one shared school read model (`school-admin/dashboard.service.ts`) | FR-AS-2-*, XS-1..5 | S6-T03, S6-T13 |
| API-AS-02 | `GET /api/admin/command-center/live-data` | AP, AS | `schoolId` ignored for AS (forced) | Command Center board | Exists-Fix: tile "Sekolah Berdaftar" returns 0 and "langganan aktif" has no number for AS; "Pelajar Berdaftar" 16 vs 17 (XS-1). Fix in `command-center/board/board.service.ts` | FR-AS-1-*, XS-1 | S6-T07, S6-T03 |
| API-AS-03 | `GET /api/command-center/daily-activity`, `GET /api/command-center/daily-activity/school/:id` (AP only) | AP, AS (first) | `date?` | engagement series | Exists-Fix: BM weekday labels, "-" for accuracy without answers (`accuracy` number with one decimal or null, 4.6, D-T10-1) | FR-AS-1-* | S6-T07 |
| API-AS-04 | `GET /api/admin-sekolah/guru/pending`, `POST /api/admin-sekolah/guru/:id/verify` | AS (own school) | none | pending teachers; verify returns the teacher | Exists-OK (`school-admin.controller.ts`) | FR-AS-52-*, "Guru Menunggu" | S6-T09 |
| API-AS-05 | `GET /api/admin-sekolah/pelajar`, `GET .../pelajar/form-options`, `GET .../pelajar/export.csv`, `GET .../pelajar/:id`, `POST .../pelajar`, `PUT .../pelajar/:id`, `POST .../pelajar/:id/reset-password` | AS (own school; other school id = 404) | list: `search`, `status`, `classroomId`?, `level`? (T1..T5), `page` (25 per page) | `SchoolPupil`; export CSV | Exists-Fix: list has no **class/Tingkatan filter**; edit lacks status radios "Aktif (boleh log masuk)"/"Digantung" and optional new password; "{n} pelajar" must equal XS-1 | FR-AS-51-1..6 | S6-T09 |
| API-AS-06 | `POST /api/admin-sekolah/pelajar/import` | AS (forced own school) | multipart or JSON: `level` T1..T5, `csvFile` (<= 2 MB, <= 1000 rows; columns nama,email,kelas); `dryRun?` (the preview step) | `StudentImportResult` {created, skipped, errors[{row, message}], preview[]} | Missing-Build (shape 2.17.2). Only the Admin Pusat import `POST /api/admin/students/import` and `POST /api/admin/users/bulk-import` exist. Quota = the subscription seat limit; over the limit the whole file is refused (shape 2.17.2); password minimum 8 (D-A17) | FR-AS-51-4 | S6-T09 |
| API-AS-07 | `GET /api/admin-sekolah/guru`, `.../guru/export.csv`, `.../guru/:id`, `POST .../guru`, `PUT .../guru/:id`, `POST .../guru/:id/toggle-active`, `POST .../guru/:id/reset-password` | AS (own school) | list: `search`, `status`, `page`; create body gains `subject`, `qualification`, `ic?`, `password?` (minimum 8) | `SchoolTeacher` | Exists-Fix: teacher count "Guru" is 3 here and 4 on Prestasi/Monitoring: one XS-3 query (teacher accounts of the school, approved and not deleted; pending teachers and school-admin accounts are excluded, 20 §5 XS-3) | FR-AS-52-*, XS-3 | S6-T03, S6-T09 |
| API-AS-08 | `GET /api/admin-sekolah/usage` | AS | `days` default 30 | `UsageReport` | Exists-Fix: zero in the 30-day window because the window was fixed-date in seeds; compute from "now" on the server and read XS-1..5 | FR-AS-46-* | S6-T09 |
| API-AS-09 | `GET /api/admin-sekolah/laporan-aktiviti` | AS | `range`, `tab=guru or murid` | `ActivityReport` | Exists-Fix: add "Skor Purata", "Pelajar Paling Aktif (Top 10)", "Cikgu Belum Akses ({n})"; BM labels in "Pecahan Aktiviti"; trend axis scales to data (`school-admin/reports/activity.service.ts`) | FR-AS-48-* | S6-T09 |
| API-AS-10 | `GET /api/admin-sekolah/laporan-bulanan` | AS | `month=YYYY-MM` | `MonthlyReport` | Exists-Fix: returns 4 cards only; add Pelajar Berdaftar "{n} aktif", Kadar Penglibatan, Soalan Dijawab, Ketepatan (one-decimal number on the wire, 4.6, D-T10-1), Guru, Soalan/Pelajar Aktif, Bulan Paling Aktif, "Trend Penggunaan Bulanan", headcount and Lencana tiles; subject performance always present (empty array, not omitted) | FR-AS-50-* | S6-T09 |
| API-AS-11 | `GET /api/admin-sekolah/dskp-heatmap` | AS | `level` T1..T5 | `{subjects[], cells[{subject, bab or sp, accuracy /* one decimal or null, 4.6, D-T10-1 */, answers}]}` | Exists-Fix: every cell is "-" because no mastery data reaches the grid; compute from answers joined to question Bab/SP (needs API-DSKP-09 data) | FR-AS-47-* | S6-T09, S4-T03 |
| API-AS-12 | `GET /api/admin-sekolah/kelas` | AS | none | `SchoolClass[]` {id, name, level, teacher, pupils} | Exists-Fix: remove `joinCode` ("Kod Kelas" dropped); row links go to `/prestasi/kelas/:id` and Senarai Pelajar filtered by class | FR-AS-53-* | S6-T09 |
| API-AS-13 | `GET /api/amaran/schools/:id`, `GET /api/amaran/summary`, `GET /api/amaran/effectiveness`, `GET /api/amaran/export/school/:id` | `AMARAN_ROLES` = AP, AS, G (`school-admin/amaran/amaran.access.ts:11`); export: AP, AS | `status`, `subject`, `level` | `AmaranSummary` | Exists-Fix: `school-admin/amaran/risk.rules.ts:63-76` `computeRisk` scores a never-active pupil 80 = Merah; expose `neverActive` as status "Belum Bermula" outside the three risk groups and count it separately (`amaran.service.ts`); add "Analisis Risiko Mengikut Subjek" | FR-AS-49-*, FR-X4-3 | S6-T04 |
| API-AS-14 | `GET /api/sekolah-bersaing` | any signed-in at guard level (a national board, no school scope); target: AS | none (`week` removed) | `[{rank, school, state, accuracy /* one decimal, 4.6, D-T10-1 */, pupils}]` top 30 | Exists-Fix: reads a weekly seed with no current week -> "Data minggu ini belum dijana."; must rank live: average session accuracy per school over T1-T5 sessions, computed on request (FR-AS-45-4). No weekly job and no stored board (plan S7-T02 and DM-31 aligned, OQ-API-07) | FR-AS-45-1..5 | S7-T02 |
| API-AS-15 | `GET /api/headcounts` for AS | AS | none | school-class configs | Exists-Fix: lists only configs created by the viewer (`headcount.service.ts:114,121`), so AS sees none; for `school_admin` return the configs of the school's classes through `classrooms.school_id` (DM-29), add the "Guru" column, refuse writes (see API-RPT-10) | FR-AS-3-* | S10-T02 |
| API-AS-16 | `GET /api/analytics/classes` for AS | AS | `classroomId?` | class analytics | Exists-Fix: `CLASS_ANALYSIS_ROLES = ['admin','teacher']` (`reports/performance/domain/access-policy.ts`) excludes `school_admin`; allow it with the school forced | FR-AS-5-*, R1-GUR-5 | S10-T04 |
| API-AS-17 | `GET /api/item-analysis/school`, `GET /api/item-analysis/classes` for AS | AS | `level`, `subject`, `range` | `ItemAnalysis` | Exists-Fix: the school scope exists but shows 16 pupils/36 answers/33.3% vs 122/57.9% on the Dashboard (XS-1, XS-4, XS-5); read the shared queries (S6-T03 consumes the same queries for its dashboard; it does not own this route) | FR-AS-6-* | S10-T03 |

### 2.5 ADM (Admin Pusat)

Controllers: `users/users.controller.ts`, `users/lookups.controller.ts`, `schools/schools.controller.ts`, `subscriptions/*.ts`, `content/{articles,banners,notes,screenshots,perutusan}/*.ts`, `gamification/admin.controller.ts`, `shop/admin.controller.ts`, `games/rooms/admin/admin-games.controller.ts`, `battle/tournaments/tournaments.controller.ts`, `pksk/pksk-admin.controller.ts`, `marketplace/marketplace.controller.ts`, `ai-extraction/ai-admin.controller.ts`.

| API ID | Method + path | Roles | Request | Response | Status | FR/AC | Card |
|---|---|---|---|---|---|---|---|
| API-ADM-01 | `GET /api/admin/users`, `GET /api/admin/users/filters`, `GET /api/admin/users/:id`, `POST /api/admin/users`, `PUT /api/admin/users/:id`, `DELETE /api/admin/users/:id`, `POST /api/admin/users/:id/toggle-active`, `POST /api/admin/users/bulk-delete`, `POST /api/admin/users/bulk-import` | AP, AS (school forced) | list: `role`, `schoolId`, `level`, `search`, `status`, `page` | `AdminUser` | Exists-Fix: pupil level picker offers Darjah (D96): list/form options must return Tingkatan 1-5 only; remove `Login As` (U-01); password minimum 8 characters for create, reset and bulk import; the bulk-import body limit is 2 MB (raised from 1,100 kB, 40 E-11; also `POST /api/admin/students/import`) (D-A17, FR-ADM-U02.4; the V1 value 6 is superseded); the import-over-quota rule is API-AS-06 | FR-ADM-U01..U03.*, U05, U06 | S6-T12, S6-T11 |
| API-ADM-02 | `GET /api/students/search`, `GET /api/admin/teachers`, `GET /api/admin/teachers/:id/classrooms`, `GET /api/admin/schools/:id/students` | AP, AS, G (first only) | `q`, `schoolId` | pickers | Exists-OK (`users/lookups.controller.ts`) | FR-ADM-U* | S6-T11 |
| API-ADM-03 | `GET /api/admin/schools`, `GET /api/admin/schools/options`, `GET /api/admin/schools/:id`, `POST /api/admin/schools`, `PUT /api/admin/schools/:id`, `POST /api/admin/schools/:id/toggle`, `GET /api/schools` (AP) | AP | list: `state`, `type`, `search` | `School` | Exists-Fix: hide SK/SJK types by default (D72, OQ-U1); otherwise Exists-OK (`schools/schools.controller.ts`) | FR-ADM-U04.* | S6-T12 |
| API-ADM-04 | `GET /api/schools/search?state=&q=` (min 2 characters, at most 20 results), `GET /api/jpn`, `GET /api/jpn/:id/ppd` | public | `q` | school/JPN/PPD pickers | Exists-Fix: school search gains the `state` filter, a 2-character minimum and a 20-result cap | registration | n/a |
| API-ADM-05 | `GET /api/admin/classes` | AP | `schoolId`, `level`, `page` | `AdminClass[]` {id, name, level, teacher, pupils, school} | Missing-Build (shape 2.17.3). No class list for Admin Pusat exists; classes appear only inside Command Center drill-down | FR-ADM-U08.* | S6-T11 |
| API-ADM-06 | `GET /api/admin/school-packages`, `GET/POST /api/admin/school-subscriptions`, `GET /api/admin/school-subscriptions/:id`, `GET .../:id/students`, `GET .../:id/renewal-invoice`, `PUT .../:id/quota`, `POST .../:id/extend`, `POST .../:id/upgrade`, `POST .../:id/cancel`, `GET /api/admin/schools/:id/quota`, `POST /api/admin/students/import`, `GET/POST /api/admin/comp-students`, `GET /api/admin/comp-students/:id`, `POST .../bulk-action`, `.../:id/toggle-coins`, `.../:id/toggle-active`, `GET/POST /api/admin/users/:id/packages` | AP | per contract `schools/subscriptions/schema.ts` | subscription / quota objects | Exists-OK (`subscriptions/*`) | FR-ADM-U05, U07, U09 | S6-T11 |
| API-ADM-07 | `GET /api/admin/articles`, `.../:id`, `POST`, `PUT /:id`, `DELETE /:id`; `GET /api/admin/banners`, `.../:id`, `POST`, `PUT /:id`, `DELETE /:id`; `GET /api/admin/notes`, `.../:id`, `POST`, `PUT /:id`, `DELETE /:id`; `GET/POST /api/admin/screenshots` | AP | CRUD bodies in `content/*` contracts | content rows | Exists-Fix for banners (edit does not preload types, V1 D-6) and notes (filter and create defects, V1 D-1, D-7); articles Exists-OK | R1-ADM-N-02..04 | S5-T09 |
| API-ADM-08 | `GET /api/admin/games`, `PUT /api/admin/games/settings` | AP | settings {boardTiles, ...} (`games/schema`) | game settings; the settings keys follow DM-38 (daily caps `games_daily_syiling_cap` 100 and `games_daily_xp_cap` 500, referral and mystery-box keys are `gamification_settings` rows; only four keys live in `reward_settings`) | Exists-Fix (`games/rooms/admin/admin-games.controller.ts`); page is unbuilt (N-05) | R1-ADM-N-05 | S7-T03 |
| API-ADM-09 | `GET /api/admin/feature-toggles`, `PUT /api/admin/feature-toggles/:key` | AP | {enabled: boolean} | `FeatureToggle[]` | Missing-Build (shape 2.17.3). Backed by the new table `feature_flags` (DM-34, migration `0250_s0_feature_flags`). The SRS cites `POST /api/admin/feature-toggles`; one list read plus an idempotent `PUT` per key is the chosen shape (OQ-API-05) | FR-ADM-N06.1..4 | S0-T10, S0-T11 |
| API-ADM-10 | `GET /api/admin/settings/support`, `PUT /api/admin/settings/support` | AP | PUT {email, phone, whatsapp, hours} (max 120 chars each, e-mail format) | `SupportConfig` | Missing-Build (shape 2.17.3). Feeds `GET /api/config/support` (API-SUP-04) | FR-ADM-N07.1..3 | S7-T09 |
| API-ADM-11 | `GET /api/admin/dashboard` | AP | none | `AdminDashboard` | Missing-Build (shape 2.17.3). The `/admin` page redirects to Command Center and is empty | FR-ADM-M01.1..4 | S6-T11 |
| API-ADM-12 | `GET /api/admin/analytics` | AP | `range` | `AdminAnalytics` | Missing-Build (shape 2.17.3). Question-bank analytics are computed from the list endpoint counts (FR-ADM-M05.2), no stored counts | FR-ADM-M05.1..3 | S6-T11 |
| API-ADM-13 | `GET /api/admin/reports/laporan`, `GET /api/admin/reports/executive` | AP | `year`, `range` | `AdminLaporan`, `ExecutiveReport` | Missing-Build (shape 2.17.3). Same read model as the Guru Laporan (FR-ADM-M06.2); M-07 has no V2 reference (evidence E-23), shape provisional | FR-ADM-M06.*, M07, M08.* | S6-T13 |
| API-ADM-14 | `GET /api/admin/gamification/overview`, `.../tiers`, `POST .../tiers`, `PUT .../tiers/:id`, `POST .../tiers/:id/toggle`, `.../challenges`, `POST`, `PUT /:id`, `POST /:id/toggle`, `DELETE /:id`, `.../students`, `POST .../award`, `.../transactions`, `GET/PUT .../settings` | AP | per `gamification` contract | gamification admin; `GET/PUT .../settings` carries the `gamification_settings` keys (DM-38) and the challenge type `combo` is accepted (DM-81; only types with an evaluator are selectable) | Exists-Fix (`gamification/admin.controller.ts`); no page yet | R1-ADM-P2-01..06 | S7-T04 |
| API-ADM-15 | `GET /api/admin/hadiah`, `.../:id`, `POST`, `PUT /:id`, `POST /bulk`, `GET /redemptions`, `POST /redemptions/:id/deliver`, `POST /redemptions/:id/cancel` | AP | per `shop` contract | catalogue + queue | Exists-Fix (`shop/admin.controller.ts`; no page yet). Defects to fix (FR-GM-21.4, AC-GM-21.5, FR-ADM-P2-08.3): (1) `cancel` refunds the pupil once, with the coin source `hadiah_refund`, and a repeated cancel answers `409` ERR-RWD-07 "Tebusan ini tidak lagi menunggu pemprosesan." without a second refund; (2) `cancel` restores the item stock by 1 for a finite-stock item; (3) `cancel` notifies the pupil (status "Dibatalkan" with "Token dikembalikan."); (4) `deliver` and `cancel` carry the double-submission flag (a repeat within the same transaction key is answered with the first result); (5) the budget check counts every non-cancelled non-digital redemption (DM-48) | R1-ADM-P2-07, 08 | S7-T05 |
| API-ADM-16 | `GET /api/admin/reward-control`, `PUT /api/admin/reward-control/settings`, `PUT /api/admin/reward-control/rewards/:id/cost`, `POST /api/admin/reward-control/draws` | AP | settings {redeemBudget, flatCoins, sessionYear, miniGamesCoins} | `RewardControl` | Exists-Fix: Settings keys follow DM-38: only `flat_quiz_reward`, `games_award_syiling`, `reward_budget_sen_session` and `current_session_year` live in `reward_settings`. Cabutan Bertuah admin has `POST draws` only; list, close and draw-winner missing (API-GAME-09). **Coin rate (D-A11):** `flatCoins` is persisted in `reward_settings.coins_per_correct` (DM-48), default **1** (the V2 value), range 0..20 (48 is the behaviour spec); the wallet credit of every question-answering mode reads it; validation error `422` ERR-REQ-15 "Syiling mesti antara 0 dan 20."; `redeemBudget` is in sen and is the one global session budget (DM-48), refusal ERR-GAME-22 "Had tebusan sesi ini telah dicapai." | R1-ADM-P2-09, 10 | S7-T05, S7-T07 |
| API-ADM-17 | `GET /api/tournaments/form-options`, `POST /api/tournaments` | AP | create {title, start, end, scope}; formats are `single_match` and `league` only | `Tournament` | Exists-Fix: no update/open/cancel route (P2-14, no V2 reference, E-14); edit, open and cancel are API-ADM-25 | R1-ADM-P2-14 | S7-T06 |
| API-ADM-18 | `GET /api/admin/pksk-questions`, `.../stats`, `.../:id`, `POST`, `PUT /:id`, `DELETE /:id`, `POST /bulk`; `GET /api/admin/pksk-access`, `.../stats`, `POST`, `POST /:id/revoke`; `GET /api/pksk-packages` | AP | per `pksk` contract | PKSK admin | Exists-OK (`pksk/pksk-admin.controller.ts`) | R1-MUR-19 admin feed | S5-T13 |
| API-ADM-19 | `GET /api/marketplace/categories`, `GET /api/marketplace/products`, `GET /api/marketplace/products/:slug`, `POST /api/marketplace/products/:slug/whatsapp`, `GET /api/marketplace/sellers/:id`, plus admin Produk/Penjual CRUD | pupil reads: any signed-in; admin CRUD: AP | admin product {name, price, sellerId, ...}, seller {name, status}; pupil list filters `category`, `condition`, `sort`; order body `{quantity, note}` | catalogue | Exists-Fix: pupil reads exist (`marketplace/marketplace.controller.ts`); `GET/POST/PUT/DELETE /api/admin/marketplace/products` and `/sellers` Missing-Build (provisional shapes follow V1 M20) | R1-MUR-32, R1-ADM-P2-12, 13 | S7-T08 |
| API-ADM-20 | `GET /api/ai/status`, `GET /api/ai/usage`, `PUT /api/ai/settings`, `POST /api/ai/test` | AP | AI provider settings | status | Exists-OK (`ai-extraction/ai-admin.controller.ts`); intake only. Cikgu Alesa AI stays hidden (D73) | PIPE | n/a |
| API-ADM-21 | `GET /api/admin/server-status` | AP | none | server status card of the Command Center | Exists-OK (`command-center/board/board.controller.ts`) | FR-ADM-M02.* | S6-T07 |
| API-ADM-22 | `GET /api/admin-sekolah/usage`, `.../laporan-aktiviti`, `.../laporan-bulanan`, `.../dskp-heatmap`, `.../kelas`, `.../pelajar`, `.../guru` with `?schoolId=` for Admin Pusat; plus `GET /api/headcounts` and `GET /api/item-analysis/school/:schoolId` (the latter already allows `admin`) | AP (`schoolId` required), AS (forced own school) | `schoolId` | same payloads as API-AS-08..12 | Missing-Build: the whole `/admin-sekolah/*` family is `@Roles('school_admin')`, so Admin Pusat cannot open the "central views of school-admin reports" (R1-ADM-M-07). Add `admin` to the roles of the read routes and read `schoolId` from the query when the caller is `admin`; shape 2.17.3. M-07 has no V2 reference (E-23) | FR-ADM-M07.* | S6-T13 |
| API-ADM-23 | `GET /api/admin/games/spin-segments`, `PUT /api/admin/games/spin-segments` | AP | PUT: 8 segments `{position, label, syiling, weight, active}` | the 8 segments | Missing-Build (shape 2.17.9). Table `spin_segments` (DM-64); weights are integers totalling 100 else `422` "Jumlah berat mesti 100."; the save is audited | FR-GM-14.1..14.3 | S7-T03 |
| API-ADM-24 | `PUT /api/admin/reward-control/draws/:id` (edit before open), `POST /api/admin/reward-control/draws/:id/cancel`, `POST /api/admin/reward-control/draws/:id/winners/:winnerId/deliver` | AP | draw body of 48 GAME-22 (shape 2.17.9) | `Draw` | Missing-Build (shape 2.17.9). Draw status `drawn` and `cancelled` (DM-65); cancel refunds the tickets | FR-GM-22.* | S7-T07 |
| API-ADM-25 | `PUT /api/tournaments/:uuid`, `POST /api/tournaments/:uuid/open`, `POST /api/tournaments/:uuid/cancel`, `POST /api/leagues/:id/schools` | AP | tournament body (formats `single_match` and `league` only); `{schoolIds[]}` for league enrolment | `Tournament`; `League` | Missing-Build (shape 2.17.9). League enrolment is Admin Pusat only: there is no Guru or Admin Sekolah route (DM-61, DM-62) | FR-GM-15.1, FR-GM-15.4, R1-ADM-P2-14 | S7-T06 |

### 2.6 Q (questions, stimulus groups, intake)

Controllers: `questions/http/admin.controller.ts`, `questions/http/stimuli.controller.ts`, `questions/http/servability.controller.ts`, `questions/http/structured.controller.ts`, `questions/studio/studio.controller.ts`, `questions/workflow/{lifecycle,imports,quality,reports,diagram-audit,master-notes,ai-explanation}/*.ts`, `intake/{dashboard,files,workflow}/*.ts`.

| API ID | Method + path | Roles | Request | Response | Status | FR/AC | Card |
|---|---|---|---|---|---|---|---|
| API-Q-01 | `GET /api/questions` (+ `/filter-options`, `/summary`) | AP | `QuestionListQuery` (`questions/schema.ts:174` + `questionFilterShape:144`): `page`, `pageSize`, `search`, `status`, `subjectId`, `educationLevelId`, `kertas` 1..4 (`'1'..'4'`), `tahun`, `negeri`, `jenis`, `dskpFilter` tagged/untagged, `sourceFilter`, `tagReview`, `missing` unit/tp/marks/key; add `tingkatan`, `chapter` (`none` = unlinked, or a chapter id), `unit`, `rejected`, `source`, `q` (text or id) and `flag` (`stimulus_missing` or `stem_duplicated`), also in `QuestionFilter` so the bulk-by-filter body accepts them; the server returns a cap notice when the result exceeds the cap | `{data: QuestionRow[], meta}`; row has `dskpTagged`, `dskpComplete`, `chapterLabel`, `stimulusGroup?` | Exists-Fix: (a) no filter for "Bab belum dipautkan" or for stimulus flags; (b) the Studio count and `/admin/questions` count differ ("3 vs 0": three lists over different stores, S2-T03) -> one query; (c) group member rows must not be counted as separate "questions" in a surface that counts papers' units (D91). The work-list "Soalan tanpa Bab" is this route with `chapter=none` (D-A5); per-subject counts come from API-DSKP-10; the admin maps them with API-DSKP-09 | FR-ADM-Q03.*, M01.1, C05.4, G7.5 | S2-T03, S1-T07, S2-T08 |
| API-Q-02 | `GET /api/questions/:id` | AP | none | `QuestionDetail` (`questions/schema.ts:285`) with `dskp`, `dskpStatus`, `placements`, `stimulusGroup` | Exists-Fix: add `chapter {id, number, name}` and `flags[]` (additive, section 4.1) | FR-ADM-QE3.*, QE4.* | S1-T02, S1-T07 |
| API-Q-03 | `POST /api/questions`, `PUT /api/questions/:id`, `POST /api/questions/:id/edit-as-draft`, `DELETE /api/questions/:id` | AP | `QuestionCreateRequest` / `QuestionUpdateRequest` (`questions/schema.ts:389,404`): `parts[]`, `tag {unitId, spIds[<=3], tp}`, `curriculumChapterId`, `dskpSpId`, `stimulusGroupId`, `numberLabel`, `kbat` (SP travels only as `spIds: Id[]`, 1 to 3 ids, everywhere, N-10; the legacy input `dskpSpId` is still accepted and read as `spIds: [id]`); `language` (`ms`, `en`, `ms+en`, DM-50; input `bm` is accepted and stored as `ms`), `modeConfig` (DM-55, field names of 45 section 7.0 and 3.1.6; a leaf with `modeConfig.example` has marks 0 and every other leaf marks 1 to 100, else `422` with 'Nilai mata mesti sekurang-kurangnya 1.' or 'Jawapan contoh diperlukan.'), `schemeRules` (DM-54, names of 45 section 7.0), `textbookRef` (DM-56), `expectedUpdatedAt` (optional; a mismatch answers `409 STALE_VERSION`, 40 E-9); `approved` refused unless subject, level, unit, SP, TP set (unit, SP and TP only where DSKP nodes exist for the Subjek + Tingkatan, D112(3)); Quick Edit (R1-ADM-Q-24) saves through this route (a single-leaf MCQ with 2..8 options saves here) and is repaired because it is dead on the real API (Team B audit, D112(5)); **difficulty (D-A6):** `difficultyLevel` (1..5) is **typed** and required for every bank, teacher and private question (the form pre-fills `min(5, TP)` until the admin touches it); a CSV, intake or teacher row without it is filled with `min(5, TP)` and returned with `difficultyDefaulted: true` and the admin confirms before `Terbitkan`; the server never overwrites a typed value when TP changes; stored in `difficulty_level` (DM-47) while TP stays in `difficulty_tp` | `{data: Question}`; `422` `fields` keyed by path | Exists-Fix: (a) SP typed free text is validated only at Terima/publish (late 422); validate unit/SP/TP/level/part marks against DSKP at save (S1-T02); (b) a question that names a Rajah/Jadual/Graf/Petikan but has no stimulus/group/image is accepted and later published (see API-Q-12); (c) `kertas` is the text '1' to '3' in code today (`QuestionKertasSchema`) and the printed Bahagian has no field: the target is `'1'..'4'` (DM-08, Kertas Subjektif is Kertas 2-4) and add optional `sectionLabel` (DM-07); (d) contract mismatch: `baseInput.difficultyLevel` is required (`packages/contract/src/questions/schema.ts:353`, "Sila pilih tahap kesukaran.") and stays required, but it is stored in `difficulty_level` and no longer in `difficulty_tp`; the Tag step collects TP and Tahap kesukaran as two fields (DM-47); (e) approval also needs a Bab: see API-Q-05 `NO_CHAPTER` | FR-ADM-QE1.*, QE3.*, Q04.* | S1-T01, S1-T02 |
| API-Q-04 | `POST /api/questions/bulk-action`, `POST /api/questions/bulk-action/filter` | AP | {action: draft/review/approved/archived/delete, ids[<=64]}; filter body {action: approved/archived, filter: QuestionFilter, expectedCount, dryRun} (strict) | `QuestionBulkResult` / `QuestionFilterBulkResult` | Exists-Fix (`questions/http/admin.controller.ts`): the action is group-aware: a body with `ids` that holds only part of a stimulus group is refused as a whole with `422` ERR-QST-02 "Soalan dalam kumpulan rangsangan mesti dipilih bersama." (`code` VALIDATION_ERROR, `details.reason` `stimulus_group_split`, `details.group` the group id; nothing is expanded silently and no row changes), and `ids` and `groupId` sent together are refused with `422` ERR-REQ-01 (`fields.groupId` "Pilih soalan atau kumpulan, bukan kedua-duanya."). **Group bulk status change (D113-continued, L-2):** the first body also accepts `{action: draft/review, groupId: Id}` (no `ids`): it moves every member of that stimulus group in one transaction; the group page button "Hantar kumpulan untuk semakan" sends `{action: "review", groupId}` and moves every `Draf` member to `Menunggu Semakan` (a member already `Menunggu Semakan` or `Diluluskan` is left as it is; a `Diarkibkan` member makes the call `409` "Kumpulan mengandungi soalan diarkibkan."); a group with 0 members answers `422` "Kumpulan perlu sekurang-kurangnya 1 soalan."; response `QuestionBulkResult`, the filter body supports `dryRun`, and `FILTER_ACTION_CAP` is 1,000 | FR-ADM-Q03.* | n/a |
| API-Q-05 | `GET /api/questions/:id/gate-check?gate=approve or submit` | AP, owning G | `gate` | `QuestionGateCheck` {gate, ok, issues[{path, code, message, step}]} | Exists-Fix: this already **is** the completeness list; the Studio bar shows "n belum lengkap" without naming them because the UI ignores `issues`. No new `/completeness` route is built (decision D-API-2); add to `issues` the DSKP-aware checks of S1-T02 (SP of the chosen unit, TP range, level per leaf, part marks). **Bab gate (D-A5):** `issues[]` gains `{code: "NO_CHAPTER", message: "Sila pilih Bab.", step: <the wizard step number of 45 section 4.1, an integer 1 to 4>}` as a blocker for a new approval where the subject and Tingkatan have chapters (D112(1); for a Subjek + Tingkatan without chapters the item is absent); it sits beside the DSKP unit, SP and TP/aras items (the DSKP unit "Unit" is not the Bab), which are themselves listed only where DSKP nodes exist for the Subjek + Tingkatan (D112(3)). The issue codes are those of 45 section 4.1 (`NO_SUBJECT` .. `GATE_STATUS`, 30 rows), including `NO_DIFFICULTY` "Sila pilih tahap kesukaran.", `SCHEME_SUM`, `STIMULUS_MISSING`, `FIGURE_ONLY`, `GROUP_EMPTY`, `GROUP_MIXED` and `MEMBER_NOT_READY` | FR-ADM-QE4.*, Q06.* | S1-T02, S2-T01 |
| API-Q-06 | `POST /api/questions/:id/status` | AP (owner G for draft -> review) | `QuestionStatusRequest` {to: draft/review/approved/archived/**rejected**, reason?} | `{data: QuestionStatusResult}` incl. `servability`; `409` pair not allowed; `422` `fields` + `details.gate` | Exists-Fix (`questions/workflow/lifecycle/lifecycle.controller.ts`): `to: "rejected"` is allowed only from `review` by Admin Pusat ("Tolak", 45 section 2.8): it stores status `draft` with `question_versions.rejection_reason` (DM-58) = `reason`, which is required (5 to 500 characters, `422 fields.reason` "Sila nyatakan sebab penolakan (sekurang-kurangnya 5 aksara)." ; for an item of `source = guru` the same range, for any other source an optional reason of at most 200 characters is accepted on the intake item reject of API-Q-15, not here); the owner is notified; `to: "review"` clears `rejection_reason`. The label `Ditolak` is `draft` plus a reason (OPT-STATUS-SOALAN). Owner of this change: S1-T02 | FR-ADM-Q04.*, FR-QA-32 | S1-T02 |
| API-Q-07 | `GET /api/stimuli`, `GET /api/stimuli/:id`, `POST /api/stimuli`, `PUT /api/stimuli/:id`, `DELETE /api/stimuli/:id` | AP | `StimulusCreateRequest` (`questions/stimuli.ts:89`): kind (passage/image/diagram/table/map/infographic/graph), label, caption, body, alt, sourceCitation, tableData, imageId | `Stimulus` {id, kind, label, ..., groupCount} | Exists-OK (`questions/http/stimuli.controller.ts`); a stimulus that still has members through its group cannot be deleted: `409` "Rangsangan ini masih digunakan oleh {n} soalan." (DM-02 RESTRICT; the old `inUse` text is retired, 45 §4.1) | FR-ADM-QE1.*, FR-X1-4a | S1-T01 |
| API-Q-08 | `GET /api/stimulus-groups`, `POST /api/stimulus-groups`, `GET/PUT/DELETE /api/stimulus-groups/:id`, `POST /api/stimulus-groups/:id/members`, `DELETE /api/stimulus-groups/:id/members/:questionId`, `PUT /api/stimulus-groups/:id/members` (atomic set), `PUT /api/stimulus-groups/:id/members/order`, `POST /api/stimulus-groups/:id/questions` | AP | create {label?, scope: section/paper, subjectId: Id, educationLevelId: Id, kertas?: 1..4, stimulusIds[1..3], questionIds[0..40], optionBank?}; update `PUT` accepts the same fields (`subjectId`, `educationLevelId`, `kertas` may change only while the group has no member or every member already matches; else `422`); members {questionId}; set {questionIds[]}. The three scope fields are stored on the group row (DM-51), so an empty group has them; every member must have the same Subjek and Tingkatan (and Kertas when the group has one): `422` `fields.questionIds` "Subjek dan Tingkatan ahli mesti sama dengan kumpulan." | `StimulusGroupDetail` {id, label, scope, subjectId, educationLevelId, kertas, stimuli[], optionBank, questionIds[], members[], warning} | Exists-Fix: (a) code treats a group with fewer than 2 questions as a **draft group** (`STIMULUS_MESSAGES.smallGroup`, `builderBlocker` "Kumpulan perlu sekurang-kurangnya 2 soalan.") but FR-X1-4a/D108-1 says 1..n is valid everywhere including inside papers; only a zero-member group is blocked, as a draft, and cannot be placed in a paper (FR-ADM-QE2.4, DM-01: the blocker text becomes "Kumpulan perlu sekurang-kurangnya 1 soalan."). Change `builderBlocker`, `smallGroup(n)`, the "2 or more at creation" check in `StimuliService.createGroup` and the `GroupMembers` warning threshold (`exam/builder/paper-check.ts`); change the contract test that asserts the old text first. Also DM-02: deleting a group that still has members must be refused (`ON DELETE RESTRICT`), and DM-04: a question held back by an open stimulus flag does not count as "served" for the served lock; (b) no E2E proof of "add a 2nd/3rd question without re-uploading the figure"; `POST .../:id/questions` creates a question in the group | FR-ADM-QE1.*, QE2.*, Q05.*, FR-X1-4a/b | S1-T01 |
| API-Q-09 | `GET /api/questions/studio/dskp` | AP | `subjectId`, `levelId`, `kertas?` | `StudioDskp` {units[{id, code, name, sps[]}]} | Exists-OK (`questions/studio/studio.controller.ts`); T4-T5 only until the T1-T3 data is loaded (S4-T09, D109) | FR-ADM-QE3.* | S2-T01 |
| API-Q-10 | `GET /api/structured-questions`, `GET /api/structured-questions/:id` | AP | `QuestionStructuredListQuery` | `QuestionStructuredRow/Detail` | Exists-Fix: read-only; lane needs "Jumlah Soalan", "Diluluskan", "Agihan Mengikut Subjek" and "tiada skema" count (Q-23) | FR-ADM-Q23.* | S2-T06 |
| API-Q-11 | `GET /api/admin/servability/overview`, `GET /api/admin/servability/lanes/databank`, `GET /api/admin/servability/lanes/bijak-spm`, `GET /api/admin/servability/questions/:id`, `POST /api/admin/servability/questions/batch`, `GET /api/admin/questions/:id/paper-servability` | AP | batch {ids[]} | `ServabilityReport` per activity (databank, latih_tubi_spm, bab, simulasi_paper, simulasi_kuiz, jana_kertas) with reason codes `group_incomplete`, `stimulus_missing`, `chapter_missing` and `permainan` (on top of the flags) | Exists-Fix: (a) Studio shows "Dilihat murid di 0/6" for every row while Latih Tubi serves the question -> the indicator must come from the **same function** pupils draw with (`served-rule.ts`, `learner-visibility.ts`); (b) only 2 of 6 lanes have a read; add lanes `latih-tubi`, `tracking-a`, `subjektif`, `kertas-subjektif` (see API-BIJAK-12); (c) reason codes `has_stimulus` and `has_option_image` ("hanya memaparkan soalan teks") are the superseded D92-1 rule: remove after S1-T06 (D105); (d) activity enum, one list (F-19): `databank`, `latih_tubi_spm`, `bab`, `simulasi_paper`, `simulasi_kuiz`, `jana_kertas` plus `permainan` (the sixth surface of Q-06 "Permainan"); `SERVABILITY_ACTIVITIES` gains `permainan`, six activities are served and `jana_kertas` stays admin-only (the pupil indicator reads "n daripada 6"); (e) reason `chapter_missing` for activity `bab` (and the Heatmap): "Bab belum dipaut - tidak disajikan dalam Soalan by Chapter." | FR-X4-2, FR-ADM-Q01.2, Q06.*, Q02.3 | S1-T07, S3-T03 |
| API-Q-12 | Servability flags `stimulus_missing`, `figure_only`, `stem_duplicated` (new reason codes on the report above; stored on `question_versions.stimulus_flag`, DM-05) | AP read; flag clear by AP | none; `POST /api/admin/questions/:id/flags/dismiss` {flag} ("Bukan masalah") | `ServabilityReasonCode` additions; question detail `flags[]` | Missing-Build (shape 2.17.4). `stimulus_missing` and `figure_only` exclude the question from every pupil surface; `stem_duplicated` renders the text once and is fixed by the data clean-up DM-40, not excluded (OD-3 decided). "Bukan masalah" (`POST /api/admin/questions/:id/flags/dismiss`) is also the way an import issue on a paper is cleared (D113-continued). Question id 812791-like ("Rajah 14..." with no figure, stem shown twice) is published and served to pupils today | FR-ADM-G7.1..G7.6, FR-MUR-QP-4, QP-5 | S1-T07 |
| API-Q-13 | `GET /api/admin/questions/regroup-worklist` | AP | `subjectId?`, `levelId?`, `flag?`, `page` | list + per-subject/Tingkatan counts | Missing-Build (shape 2.17.4). No list of figure-less or split questions exists | FR-X1-4f, FR-ADM-QE8.*, G7.5 | S1-T07, S2-T04, S4-T04 |
| API-Q-24 | `POST /api/admin/questions/regroup` | AP | `{ figureQuestionId?: Id; stimulusId?: Id; stimulus?: StimulusCreateRequest; memberQuestionIds: Id[] /* 1..40 */; label?: string }` | `{data: StimulusGroupDetail}`; served members are accepted with `regroup=true`; the audit row can be undone through API-Q-36 | Missing-Build (shape 2.17.4). One transaction: create the stimulus (from a figure-only row's text and image when it has one) and the group, attach the members, archive the figure-only question with `archive_reason = 'regrouped'` (DM-06), write `question_status_events` and `audit_events`. An image that was never copied is reported "gambar tiada" and the question stays unserved | FR-ADM-QE8.1..8.4, FR-X1-4f | S1-T07, S2-T04, S4-T04 |
| API-Q-25 | `POST /api/intake/batches/:id/paper` | AP | `{title?: string}` | `201 {data: {paperId, sections, placements}}` (`200` on a re-call); `409` while an item of the batch is still `pending`, and `409` once the draft paper is published (Terbit); `422` "Kertas subjektif tidak dijana daripada kelompok." when the batch is the source batch of a Kertas Subjektif paper (`papers.source_batch_id` of an existing paper with `surface = 'subjektif'`): such a batch is sent to its paper only through API-BIJAK-14 `{ apply: true }` (one flow, 45 section 3.5; the review screen of Kiriman Guru and Kelompok Item calls API-BIJAK-14 for it and API-Q-25 for every other batch); `422` `fields.items` "Soalan dalam kumpulan rangsangan mesti dipilih bersama." (ERR-QST-02, the one catalogue text for a set, a paper and a placement) when a placement would split a group | Missing-Build (shape 2.17.4; DM-45). Nothing turns an accepted batch into a paper today: the intake controller has extract / review / items / stimuli / accept / reject / duplicate only, so `Kertas Diimport` and `Semak & Terbit` list nothing (F-01, D-A2). `Hantar untuk semakan` calls this route; the draft paper is then published through API-BIJAK-10 under a Disahkan contract. Simulasi papers only. **Surface columns (P-13):** the response and the paper row carry `surface = 'simulasi'` and `exam_board` only when the migration 0161 columns exist; until S3-T06 merges, S1-T10 creates the paper without them (the response omits both keys) and migration 0161 backfills `surface = 'simulasi'` for every paper with `source_batch_id` not null (DM-45). The `422` error shape is the ERR-QST-02 shape: `fields.items` holds the text and `details.group` the group id | FR-ADM-Q07.3, FR-ADM-QE5.2, AC-CHAIN-2 | S1-T10 |
| API-Q-14 | `POST /api/intake/batches`, `GET /api/intake/batches`, `GET /api/intake/batches/:id`, `POST /api/intake/batches/:id/files`, `POST /api/intake/batches/:id/cancel`, `GET /api/intake/files/:id/pages`, `.../pages/:n/image`, `.../pages/:n/thumb`, `GET /api/intake/figures/:id/image`, `GET /api/intake/files/:id/original` | G, AP | create {subjectId?, educationLevelId (required for new batches: Tingkatan T1-T5 chosen at upload, DM-09), kertas 1..4 (DM-08), year?, source?}; files multipart (PDF, DOCX, images; this route, not `/api/files`); status values include `selesai_dengan_ralat` (label "Selesai dengan ralat", DM-71); `INTAKE_PAPER_TYPES` is retired and mapped to the OPT-JENIS-HANTARAN / OPT-JENIS-KERTAS slugs (DM-72); limits `INTAKE_BATCH_LIMIT`, `INTAKE_ACTIVE_LIMIT`, `INTAKE_DAILY_PAGE_QUOTA` (40 E-10); OCR timeouts: 90 s per page (`OCR_TIMEOUT`, setting `OCR_PAGE_TIMEOUT_MS`, default 90000, already in `env.schema.ts`) and 15 min per batch (`OCR_BATCH_TIMEOUT`, setting `OCR_BATCH_TIMEOUT_MS`, default 900000, added to `env.schema.ts` by S1-T04 through a cross-sector PR to S0), two limits with two codes (ERR-INT-05); batch statuses are exactly OPT-BATCH-STATUS (40): `submitted`, `processing`, `ready_for_review`, `selesai_dengan_ralat`, `failed`, `cancelled`; a failed page is retried through `extract` with `pages[]` (API-Q-15), a failed file or batch through API-Q-26, one shared `retry_count` of 3 per file | `IntakeBatch` {id, status, source, files[], counts} | Exists-Fix: (a) batch stays "Sedang diproses" forever when the worker/OCR is off; needs a job timeout -> stored status `failed` (label "Gagal") + BM reason (FR-ADM-Q07.2, S1-T04); (b) list needs `source=guru` filter and the three tabs Kelompok Item / Kertas Diimport / Kiriman Guru; (c) the paper chosen at upload is not carried to accepted questions; (d) an accepted batch is turned into a draft paper by API-Q-25 (the `Kertas Diimport` tab lists those papers) | FR-ADM-Q07.*, Q08.*, Q12.* | S1-T03, S1-T04, S2-T02 |
| API-Q-15 | `POST /api/intake/batches/:id/extract`, `GET /api/intake/batches/:id/review`, `POST /api/intake/batches/:id/items`, `POST /api/intake/batches/:id/stimuli`, `PATCH /api/intake/stimuli/:id`, `POST /api/intake/stimuli/:id/link-references`, `DELETE /api/intake/stimuli/:id`, `GET /api/intake/items`, `POST /api/intake/items/bulk`, `GET /api/intake/items/:id`, `PATCH /api/intake/items/:id`, `POST /api/intake/items/:id/accept`, `.../reject`, `.../duplicate` | G, AP | accept {…tags}; link-references {questionNumbers[] range}; bulk {ids[], action} | review payload with **groups** (stimulus + member items) | Exists-Fix: (a) extraction output must be groups ("Rajah 3 -> soalan 5-8"), never a figure attached to the first question only or duplicated (`intake/workflow/figure-links.ts`); (b) manual "Terima" rejects free-text SP late and the batch then shows 0 questions; accept must create drafts or say why; (c) `extract` also serves "Cuba lagi" on failed pages: `pages[]` re-extracts the chosen pages of a file and adds 1 to that file's `retry_count`; the file/batch retry routes, the shared counter (3 per file) and the 4th-attempt refusal `409` ERR-INT-11 are API-Q-26; (b) and the group actions belong to S1-T03, the timeout and retry work to S1-T04; the group actions are API-Q-37 and API-Q-38 | FR-X1-4c, FR-ADM-QE5.*, Q09.*, Q10.* | S1-T03, S1-T04, S2-T02 |
| API-Q-16 | `GET /api/intake/dashboard`, `GET /api/intake/dashboard/cost` | AP | none | counts, AI cost | Exists-OK (`intake/dashboard/intake-dashboard.controller.ts`) | R1-ADM-Q-07 | n/a |
| API-Q-17 | `GET /api/question-imports`, `GET /api/question-imports/template`, `POST /api/question-imports` | AP | CSV (JSON `csv` text or multipart `csvFile`) | `{imported, errors[]}` | Exists-Fix: template has raw ids and no unit/SP/TP/level/paper/group columns, so CSV questions can never publish; target columns are human-readable codes (DM-10): subject, Tingkatan, unit, SP list separated by `;`, TP, KBAT, kertas, bahagian, number label, `group_key`, `stimulus_text`, `stimulus_text_en`, `stimulus_image` (first row of a group), `bahasa` (`ms`, `en` or `ms+en`; default `ms`; `bm` is accepted and stored as `ms`); rows sharing a `group_key` become one stimulus group created in the same transaction as its draft members; unknown codes are reported per row with row number and field; the success banner clears on the next upload; the header is the header list of 30 Q-11 with a template download and an error CSV (`baris`, `question_key`, `medan`, `kod_ralat`, `mesej`); limits 5 MB and 2,000 rows; success is partial per question; CSV columns (D-A5, F-05) are those of the header list of 30 Q-11; `sp_kod` holds SP codes separated by `;`; a row without a Bab is accepted as a draft and reported "Bab belum dipilih", but cannot be approved where the Subjek + Tingkatan has chapters (API-Q-05 `NO_CHAPTER`, D112(1)) | FR-ADM-QE6.*, Q11.* | S1-T05, S2-T05 |
| API-Q-18 | `GET /api/question-quality`, `POST /api/question-quality/audit` | AP | audit {scope} | quality tiles | Exists-Fix: "Perlu Semakan" must not exceed the total (V2 shows 902,797 > 451,518; Q-21) | FR-ADM-Q21.* | S2-T09 |
| API-Q-19 | `POST /api/question-reports` | M, G | {questionId, questionType, reasons[1..8], note?}; reason set by question kind | `201 {data: QuestionReport}`; `403` when the pupil never answered or was served that question; `409` "Anda sudah melaporkan soalan ini." for a duplicate on the same question version (the server fills `source` `murid`/`guru` from the reporter's active role, DM-82, never from the body); daily cap `422` with BM message | Exists-Fix: the daily cap is **20** (`QUESTION_REPORT_MESSAGES.dailyCap`, kept; plan S5-T06 now says 20, OQ-API-06); enforce "served in own attempt" (FR-MUR-54-5) | FR-MUR-54-4..7, D98 | S5-T06 |
| API-Q-20 | `GET /api/question-reports/mine`, `GET /api/question-reports`, `PATCH /api/question-reports/:id` | mine: any signed-in; list/patch: AP | list: `status` pending/reviewed/fixed/dismissed/all; patch {status, note?, archive?} | `{data, meta: {counts}}` | Exists-Fix: pupil counters are Jumlah/Menunggu/Disemak/Diperbaiki/Ditolak/Dikeluarkan (display status `removed`), `mine` must expose `counts` for all six (five stored statuses; `removed` is counted under `fixed` for the tile) and no "Selesai" label | FR-MUR-54-2, 54-3, R1-ADM-Q-22 | S5-T06, S2-T06 |
| API-Q-21 | `GET /api/diagram-audit`, `POST /api/diagram-audit/:kind/:id/image`, `POST /api/diagram-audit/:kind/:id/dismiss` | AP; G for the list and the image upload (dismiss stays AP, a teacher gets 403) | image multipart (one image: `jpg`, `png` or `webp`, at most 5 MB, for a question that needs a figure; it stays pending until an admin accepts it) | audit list | Exists-Fix (`questions/workflow/diagram-audit/diagram-audit.controller.ts`): open the list and the upload to the teacher role; a teacher upload does not change the question, it creates an intake batch with `source = 'guru'` whose image is attached once to the stimulus group (FR-X1-4a, 4c). Useful for figure repair (QE-08) | FR-X1-4f, FR-GUR-44c-1..5, AC-GUR-44c-1..5 | S6-T18, S4-T04 |
| API-Q-22 | `GET /api/master-notes`, `POST /api/master-notes/:id/:action`, `POST /api/questions/:id/ai-explanation` | AP; ai-explanation: any signed-in with in-service rules | action approve/reject | notes | Exists-OK | PIPE | n/a |
| API-Q-23 | `GET /api/admin/source-papers`, `GET /api/admin/source-papers/:id` | AP | filters as intake batches | read-only registry | Missing-Build (shape 2.17.4). Read-only registry over intake batches and migrated source papers | FR-ADM-Q19.1, Q19.2 | S2-T09 |
| API-Q-26 | `POST /api/intake/files/:id/retry` (retry one failed file or page set), `POST /api/intake/batches/:id/retry` (retry all failed pages) | G (own batch), AP | none | `202 {data: {attempt, retriesLeft}}`; the 4th attempt per file is refused with `409` ERR-INT-11 | Missing-Build (shape 2.17.4). Today there is no per-file counter (`intake_files.retry_count`, DM-71); the counter is shared with `extract` + `pages[]` (API-Q-15), so page, file and batch retries together allow 3 per file | FR-ADM-Q07.2, 40 X10.5.3, E-10 | S1-T04 |
| API-Q-30 | `POST /api/questions/:id/parts/:partId/scheme/validate` | AP | the scheme body (scheme v2, DM-54) | `{ok, issues[{path, code, message, step}]}` | Missing-Build (shape 2.17.4). Validates a marking scheme live in the Studio editor; same issue shape as API-Q-05 | FR-QA-19 | S1-T09a |
| API-Q-31 | `POST /api/stimulus-groups/:id/publish` | AP | none | `StimulusGroupDetail`; `422` with `details.gate[]`; `409` "Semua soalan dalam kumpulan mesti dihantar untuk semakan dahulu." | Missing-Build (shape 2.17.4). Allowed only when every member is `Menunggu Semakan` or already `Diluluskan` (precondition; a `Draf` member gives the `409` and nothing changes); then it sets every member `Diluluskan` in one audited transaction; one failing member (gate `422`) changes nothing. Members reach `Menunggu Semakan` through API-Q-04 with `groupId` | FR-QA-02 | S1-T01 |
| API-Q-32 | `POST /api/stimulus-groups/:id/edit-as-draft`, `DELETE /api/stimulus-groups/:id/draft` | AP | none | `StimulusGroupDetail` with `draftOfGroupId`; `409 CONFLICT` with `details.id` when a draft already exists | Missing-Build (shape 2.17.4). Draft copy of a served group (DM-51); one open draft per group | FR-QA-04 | S1-T01 |
| API-Q-33 | `POST /api/stimulus-groups/:id/retire` | AP | `{confirm: true}` | `{archived: n, affectedPapers: [...]}` | Missing-Build (shape 2.17.4). Archives every member in one transaction; the stimulus is kept | FR-QA-05 | S1-T01 |
| API-Q-34 | `POST /api/stimulus-groups/:id/members/:questionId/move` | AP | `{toGroupId}` | both group details | Missing-Build (shape 2.17.4). Same Subjek and Kertas only; a served member moves through draft copies | FR-QA-06 | S1-T01 |
| API-Q-35 | `POST /api/stimulus-groups/merge` | AP | `{fromGroupId, intoGroupId}` (at most 3 stimuli after the merge) | merged `StimulusGroupDetail` | Missing-Build (shape 2.17.4) | FR-QA-08 | S1-T01 |
| API-Q-36 | `POST /api/admin/questions/regroup/:auditId/undo` | AP | none | `{restored: n}`; `409` after a later edit | Missing-Build (shape 2.17.4). Undo of API-Q-24 (audit payload rule DM-59) | FR-QA-13 | S1-T07 |
| API-Q-37 | `POST /api/intake/stimuli/:id/accept-group` | AP | optional tag overrides | `{created: [...]}`; `422` per failing member | Missing-Build (shape 2.17.4). "Terima kumpulan": stimulus and all pending members in one transaction | FR-QA-36 | S1-T03 |
| API-Q-38 | `POST /api/intake/stimuli/:id/merge` | AP | `{intoStimulusId}` | the review group | Missing-Build (shape 2.17.4). "Gabungkan kumpulan" in Semak Ekstrak | FR-QA-08, FR-QA-36 | S1-T03 |
| API-Q-39 | `GET /api/admin/papers/:id/jsu`, `GET /api/admin/blueprints/:subject/:kertas/jsu` | AP | none (`?format=csv` exports CSV) | grid Bahagian x Tajuk DSKP x TP x KBAT x Markah with `required`, `actual`, `ok` | Missing-Build (shape 2.17.4). The `Jadual JSU` tab of a Kontrak and of a paper review | FR-QA-40 | S3-T02 |

### 2.7 DSKP (curriculum, Bab/SP, Heatmap)

The pupil Soalan by Chapter reads (`/api/practice/chapter-subjects*`) are catalogued once, as API-PRAC-05.

Controllers: `curriculum/admin.controller.ts` (three classes), `curriculum/learner.controller.ts`, `questions/studio/studio.controller.ts`, `questions/workflow/dskp/dskp.controller.ts`, `exam/blueprints/lookups.controller.ts`, `heatmap/heatmap.controller.ts`.

| API ID | Method + path | Roles | Request | Response | Status | FR/AC | Card |
|---|---|---|---|---|---|---|---|
| API-DSKP-01 | `GET /api/education-levels`, `GET /api/subjects` (`?active=1` returns only active subjects), `GET /api/topics`, `GET /api/topics/:id`, `GET /api/learning-map` | any signed-in | `levelId`, `subjectId` | learner curriculum lists (`curriculum/schema.ts`) | Exists-Fix: T1-T3 pupils see "Kandungan untuk Tingkatan anda akan datang"; the **pickers must return only active Tingkatan 1-5** (FR-X3-1, D96) and subjects that have servable questions for the pupil's level (FR-X3-3). The empty state is per subject, never level-wide. UAT has 11 active levels (data, DM-12). The read side must use "active levels with `stage <> 'primary'`" from `education_levels` instead of the hard-coded T4/T5 (DM-20), and T1-T3 chapters/topics are read from `chapters` -> `topics` -> `subtopics` (DM-16) | FR-X3-1, FR-X3-3, AC-X3-1, FR-MUR-24-*, 25-* | S4-T06, S4-T05 |
| API-DSKP-02 | `GET /api/admin/education-levels`, `.../:id`, `POST`, `PUT /:id`, `PATCH /:id/active`, `DELETE /:id` | AP | {name, nameEn, code, stage, curriculum, active} | `EducationLevel` | Exists-OK (`curriculum/admin.controller.ts`); **data task**: set Darjah 1-6 inactive on UAT (U-OP-xx, S4-T05). After that C-03 lists Tingkatan only | FR-ADM-C03.* | S4-T05 |
| API-DSKP-03 | `GET /api/admin/subjects`, `.../:id`, `POST`, `PUT /:id`, `PATCH /:id/active`, `DELETE /:id` | AP | subject fields | `Subject` | Exists-OK | FR-ADM-C02.* | S4-T07 |
| API-DSKP-04 | `GET /api/admin/curriculum` (tree), `GET/POST/PUT/DELETE /api/admin/curriculum/chapters[/:id]`, `GET/POST/PUT/DELETE /api/admin/curriculum/topics[/:id]`, `POST/PUT/DELETE /api/admin/curriculum/subtopics[/:id]` | AP | `subjectId`, `levelId` | Bab/Topik/Sub-topik tree | Exists-Fix: tree has no **question count per Bab** and no DSKP tab (SP list per Bab); add `questionCount` and `servableCount` per chapter (computed, D11/D12) | FR-ADM-C01.*, C05.4 | S4-T07 |
| API-DSKP-05 | `GET /api/questions/studio/dskp` | AP | `subjectId`, `levelId`, `kertas?` | `{units[{id, code, name, sps[{id, code, title, skCode}]}]}` | Exists-OK. T4-T5 data today; T1-T3 loaded in the same structure from existing chapter data (S4-T09, D109) | FR-ADM-C04, G.* | S4-T02, S4-T09 |
| API-DSKP-06 | `GET /api/admin/bijak/dskp/units`, `GET /api/admin/bijak/subjects` | AP | `subject`, `kertas` | units and subjects for Kontrak quotas | Exists-OK (`exam/blueprints/lookups.controller.ts`) | FR-ADM-Q16.* | S3-T01 |
| API-DSKP-07 | `GET /api/guru/dskp/bidang`, `GET /api/guru/dskp/sk`, `GET /api/guru/dskp/sp` | G, AP | `subjectId`, `levelId`, `bidangId`, `skId` | `{id, code, name}[]` | Exists-OK (`questions/workflow/dskp/dskp.controller.ts`; roles: any signed-in, no `@Roles`) | FR-GUR-44-* | S6-T06 |
| API-DSKP-08 | `GET /api/buku-nota/heatmap` | M (student), AP | `subjectId?`, `levelId?` | `{subjects[{id, name, chapters[{id, number, name, attempts, correct, accuracy /* one decimal or null, 4.6, D-T10-1 */, state: 'belum-cuba' or band}]}]}` | Exists-Fix: empty on UAT because 0 of 339,112 questions have a Bab. Rule: **Bab first** (D89), SP tags only for chapters with no Bab data (FR-MUR-14-3); T1-T5 (FR-MUR-14-6). Roles `student, admin` per code; target M only for the pupil screen | FR-MUR-14-1..6 | S10-T05 |
| API-DSKP-09 | `POST /api/admin/curriculum/questions/bulk-chapter` | AP | strict body (shape 2.17.4): `chapterId`, `filter` or `ids[]`, `dryRun`, `expectedCount`, `overwrite` (boolean, default false) | `{matched, eligible, refused, applied, cap, remaining, capped, dryRun, auditId}` | Missing-Build (DM-17, no schema change). `bulk-chapter` lives only here (not in API-ADM-06). There is no Bab setter except the single `curriculumChapterId` in `PUT /api/questions/:id`; `POST /questions/bulk-action*` only changes status. Updates `question_versions.chapter_id` in place on the live approved version, only when the Bab's subject and level match; no new version, no status or servability change. **No auto-mapping** (D89, OQ-03). Used with the work-list "Soalan tanpa Bab" (API-Q-01 `chapter=none`, counts API-DSKP-10) | FR-ADM-C05.1..5, AC-ADM-C05.* | S4-T03, S2-T08 |
| API-DSKP-10 | `GET /api/admin/curriculum/chapter-coverage` | AP | `subjectId?`, `educationLevelId?` | `{data: {rows: [{subjectId, subjectName, levelCode, approved, withChapter, withoutChapter}]}}` | Missing-Build (shape 2.17.4). The counts behind the admin work-list "Soalan tanpa Bab"; the list itself is API-Q-01 with `chapter=none`. Counts use the same predicate as C-1 (approved, not flagged) | FR-ADM-C05.4, D-A5 | S4-T03 |

### 2.8 BIJAK (Bijak SPM, SPM hub, Kontrak, Set Builder)

Controllers: `bijak/papers/papers.controller.ts`, `bijak/attempts/attempts.controller.ts`, `bijak/kuiz/kuiz.controller.ts`, `spm/{spm,mocks,duta,walkthrough}.controller.ts`, `exam/blueprints/blueprints.controller.ts`, `exam/builder/builder.controller.ts`, `exam/builder/section-pool.controller.ts`, `questions/http/servability.controller.ts`.

| API ID | Method + path | Roles | Request | Response | Status | FR/AC | Card |
|---|---|---|---|---|---|---|---|
| API-BIJAK-01 | `GET /api/bijak/papers` | M | `subject?`, `kertas?`, `kind?` | `BijakPaperSummary[]` (`bijak/papers/schema.ts:103`) with the caller's progress (`belum/sedang/selesai`); `surface` defaults to `simulasi` (the Kertas Subjektif list is `surface=subjektif`, API-BIJAK-04) | Exists-OK (`bijak/papers/papers.controller.ts`). **Data defect, not code**: UAT has 0 published papers, so the list is empty. Produced by U-OP-04/08/09 (Kontrak -> Set Builder -> Terbit) | FR-MUR-13-* ("paper list non-empty") | S3-T08 |
| API-BIJAK-02 | `GET /api/bijak/papers/:id`, `GET /api/bijak/contracts`, `GET /api/bijak/subjects` | M | none | `BijakPaperCover`; `BijakBlueprintContract[]` (`canGenerate`, `unavailableReason: 'NO_BLUEPRINT'`); `BijakSubject[]` | Exists-OK. **Data defect**: 0 contracts on UAT; a pupil sees a contract only if a *Disahkan* version exists (D76) | FR-MUR-13-* | S3-T01, S3-T08 |
| API-BIJAK-03 | `POST /api/bijak/papers/generate` | AP (admin Jana Kertas, FR-ADM-QE7.2) | `BijakGenerateRequest` {subject, kertas} | `201 {paperId}`; `422` with `BIJAK_GENERATE_*` codes (no blueprint, shortage list `BijakGenerateShortage`, limit) | Exists-Fix: a call by a pupil session answers **404** (D112(6); the pupil "Jana Kertas" tab is hidden, FR-MUR-13-20); `canGenerate` ("Jana Kertas Disahkan only") is kept for the admin call (FR-ADM-QE7.2) | FR-MUR-13-20, FR-ADM-QE7.2 | S3-T07 |
| API-BIJAK-04 | `GET /api/bijak/papers?surface=subjektif` (list of published Kertas Subjektif papers), `GET /api/bijak/papers/:paperId/in-progress`, `POST /api/bijak/attempts`, `GET /api/bijak/attempts/:id`, `PUT /api/bijak/attempts/:id/answers`, `POST /api/bijak/attempts/:id/submit`, `POST /api/bijak/attempts/:id/abandon`, `POST /api/bijak/attempts/:id/questions/:questionId/check`, `GET /api/bijak/attempts/:id/result`, `POST /api/bijak/attempts/:id/retry`, `GET /api/bijak/papers/:paperId/attempts`, `GET /api/bijak/history`, `POST /api/bijak/attempts/:id/photos` | M (own attempt only) | start `BijakAttemptStartRequest` {paperId, mode: 'exam' or 'latihan', restart?} (the attempt kind is never sent: it follows the paper, `simulasi` for a Simulasi paper and `subjektif` for a paper of `surface = subjektif`; the page of S3-T06 starts the Kertas Subjektif attempt here, N-3, N-4); the `surface=subjektif` list returns `BijakPaperSummary[]` of published papers of that surface for the pupil's level; save `BijakAttemptSavePayload`; photos multipart | `BijakAttemptPaperView` {serverNow, attempt, sections[], questions[], groups[], checks[]}; `BijakAttemptResultView` | Exists-Fix: (a) a structured item is shown as "Tidak disajikan: jenis jawapan tidak dibenarkan dalam bahagian ini" for modes outside `BijakAllowedModes`; add the P1 modes `match_letter`, `working`, "Pilih N" in `questions/grading.ts` (S1-T09a) and the attempt part view (S3-T04). **The one grader is `questions/grading.ts` (S1-owned; S1-T09a extends it):** the Bijak submit and self-mark, practice check-answer and the exam engines all call it; there is no second grader in `exam-core` (S3-T04 edits the attempt service and the part view, not the grader); (a2) **late submit (R1 decision D113, 40 FR-ERR-19):** the client auto-submits at 00:00 (`auto: true`; the 30 s figure is only the client grace); a submit or an offline sync that arrives after the deadline, up to 24 h later, is accepted (200) and stored with its real `submittedAt`, never rejected for lateness; an attempt not submitted at `deadline + 300 s` is submitted by the server as `auto_submitted` by the one timer job in `bijak/` that card S3-T04 owns (the same job closes an abandoned Kuiz session, API-BIJAK-06; S5-T15 owns only the practice-session sweeper of API-PRAC-03), and a later client submit or sync within 24 h replaces that and re-marks the result (46 section 2); `closed` is answered only to an autosave `PUT .../answers` after the attempt was submitted; (b) groups are delivered as `groups[]` with 1..3 stimuli and `from/to` (good), the front end must show each stimulus once and sticky (FR-MUR-QP-1, 2, 8); (c) **answer rows (D-A1):** `POST /api/bijak/attempts/:id/submit` writes one `practice_answers` row per answered leaf through the `AnswerLogPort` with `mode` from the master table in 40 (OPT-MODE-SESI): `simulasi` for a Simulasi / Bijak paper sitting, `subjektif` for a Kertas Subjektif sitting (attempt kind `subjektif`), `tracking_a` for a Tracking A Bahasa set, and `attempt_id` set; Databank and objective Tracking A are drill sessions through API-PRAC-01 (not this submit) and a Kuiz writes through API-BIJAK-06 (idempotent per `(attempt_id, user_id, question_id, part_ref)` (DM-44)), and still upserts the `practice_attempt_aggregates` summary (units and marks); a regrade updates the rows; (d) the `answers` union gains `choices` (mcq_multi), `gaps` (cloze), `cells` (table_fill) and `topicId` (essay_choice) as in DM-68; autosave is 800 ms with a per-part `rev` (the server ignores a change whose `rev` is not above the stored one) and a late sync is accepted for 24 h; `GET /api/bijak/attempts/:id/result?scheme=1` returns the marking scheme for a closed Kertas Subjektif attempt; the result coins are the rate x score and the XP is 10 x score (DM-48) | FR-MUR-13-*, FR-MUR-QP-1..17, AC-X6-2 | S3-T04, S1-T09a |
| API-BIJAK-05 | `POST /api/bijak/attempts/:id/self-mark` | M | `BijakAttemptSelfMarkRequest` {partId, mark, band?, `pointsHit?: string[]`, `criteria?: {id, mark}[]`} | `BijakAttemptSelfMarkResult` {partId, awarded, max, band?, totals, `pointsHit?`, `criteria?`} | Exists-Fix: `selfMarkable` is also true for `accepted` parts left `belum_dimarkah`; the request and response carry the point ticks and rubric criteria (DM-25); applying a self-mark is idempotent. Otherwise exists (`bijak/attempts/attempts.controller.ts`). The plan card S3-T06 states "no self-mark endpoint"; the route exists, what is missing is the Subjektif/Kertas Subjektif lane (API-BIJAK-14) and its UI. Self-mark updates `marks_awarded` of the part row in `practice_answers` and `is_correct` (full marks) and never changes the row's mode; the route serves both attempt kinds (N-3): `subjektif` (Kertas Subjektif, S3-T06; also a Tracking A Bahasa set, whose rows keep `tracking_a`) and `structured` (Soalan Berstruktur, API-PRAC-10, S5-T11); this is the Subjektif lane's mark route (D-A9) | FR-MUR-13-* (Subjektif), D104 | S3-T06 |
| API-BIJAK-06 | `POST /api/bijak/kuiz/sessions`, `POST /api/bijak/kuiz/sessions/:id/check`, `POST /api/bijak/kuiz/sessions/:id/finish`, `GET /api/bijak/kuiz/papers/:id`, `POST /api/bijak/kuiz/papers/:id/check` | M | quiz bodies in `bijak/kuiz/schema.ts`; the `check` request adds `selectedOptionIds[]` (Kuiz) | quiz payloads; the `check` response adds `correctOptionIds[]` (the one key field name for a multi-answer key everywhere, N-12) | Exists-Fix (`bijak/kuiz/kuiz.controller.ts`); "Kertas belum tersedia" is an accepted state (withdrawn paper). The `.../check` calls (Semak) write no `practice_answers` row; the writing call is `POST /api/bijak/kuiz/sessions/:id/finish` (random kuiz) or the attempt submit (kuiz paper): one row per checked question, mode `kuiz`, idempotent per session and question (50 section 4.7a, N-1). **Abandoned Kuiz (P-5, run 5):** the S3-T04 timer job of `bijak/` (see API-BIJAK-04 a2) closes a Kuiz session with no activity for 2 h: the rows already written for its checked questions are kept and no reward is paid; a later `finish` on that session re-marks and pays under the idempotency rule | FR-MUR-13-* | S3-T04 |
| API-BIJAK-07 | `GET /api/spm/overview`, `GET /api/spm/databank`, `GET /api/spm/latih-tubi`, `GET /api/spm/latih-tubi/:code`, `GET /api/spm/tracking-a`, `GET /api/spm/tracking-a/:code`, `GET /api/spm/subjektif` | M | `form`, `subjectCode` | the hub read returns the Kertas Subjektif count ("{n} kertas") for every T1-T5 pupil; `SpmOverview`, `SpmDatabankSubject[]`, `SpmLatihTubiList`, ... (`spm/hub.ts`) | Exists-Fix: the tile "Jumlah Soalan" must equal the sum of the per-subject Databank counts for the pupil's form, "Soalan Tracking A" the Tracking A count, and each chip the count in its own details view (D91, AC-MUR-13-13); counts must equal what the draw serves, including figure questions and whole groups (D105) | FR-MUR-13-*, FR-X4-2 | S3-T07 |
| API-BIJAK-08 | `GET /api/spm-mocks`, `POST /api/spm-mocks`, `GET /api/spm-mocks/:id`, `POST /api/spm-mocks/:id/submit`, `GET /api/spm-mocks/:id/result`, `GET /api/duta/recommendations`, `POST /api/spm-walkthrough/solve` | M | mock config / answers | mock, result | Exists-OK (`spm/mocks.controller.ts`, `duta.controller.ts`, `walkthrough.controller.ts`) | FR-MUR-13-* | S3-T07 |
| API-BIJAK-09 | `GET /api/admin/blueprints`, `.../:subject/:kertas`, `POST /api/admin/blueprints`, `POST .../:subject/:kertas/versions`, `.../retire`, `.../sections/:position/review`, `GET .../versions`, `GET .../pool`, `GET/POST .../evidence`, `DELETE .../evidence/:evidenceId`, `GET .../verification`, `POST .../verify` | AP | create `BijakBlueprintAdminCreate` (`bijak/builder/schema.ts:958`); verify {…} | `BijakBlueprintView`, `BijakVerificationSummary` | Exists-OK (`exam/blueprints/blueprints.controller.ts`). `verify` correctly refuses a blueprint that fails the checks (for example `NO_QUOTA`, `NO_KBAT`). D112(3): `POST /api/admin/blueprints` is refused for a Subjek with no DSKP nodes ("DSKP belum dimuatkan untuk subjek ini. Kontrak tidak boleh dicipta.", FR-ADM-Q16.7), a check added with the Kontrak form fix. The defect "Disahkan not selectable" is in the Kontrak form (`kontrak/domain/form.ts`, S3-T01), not the route; D95: blueprints on UAT are created by an admin. `BijakBlueprintAdminCreate` and `BijakBlueprintView` sections gain `label` (free text), `compulsory` (bool, mutually exclusive with `choose`), `marksPerQuestion?: number[]` (DM-57) and `questionCount` on the blueprint; `verify` checks that a paper's per-question marks equal the list ("Markah soalan {no} tidak sepadan dengan kontrak."); `GET .../jsu` is API-Q-39 | FR-ADM-Q16.* | S3-T01 |
| API-BIJAK-10 | `GET /api/admin/papers`, `POST /api/admin/papers`, `GET /api/admin/papers/pool-preview`, `POST /api/admin/papers/preview`, `GET/PUT/DELETE /api/admin/papers/:id`, `POST .../:id/publish`, `GET .../:id/review`, `GET .../:id/student-view`, `GET .../:id/sections/:sid/pool`, `POST .../:id/placements`, `DELETE .../:id/placements/:questionId`, `POST .../:id/sections`, `POST .../:id/sections/:sid/questions`, `DELETE .../:id/questions/:questionId`, `PUT .../:id/sections/:sid/order`, `PUT .../:id/groups/:groupId`, `POST .../:id/copy`, `POST .../:id/withdraw`, `GET/PUT /api/admin/section-pools/:questionId` | AP | create `BijakBuilderPaperCreate` {subject, kertas, title?}; publish `BijakBuilderPublishRequest` {override?, reason?}; section rule `{type:'all'}` or `{type:'choose', n}` | `BijakBuilderPaper`, `BijakBuilderEditor`, `BijakBuilderPublishResult` | Exists-Fix: (a) the paper builder blocks a group with fewer than 2 questions ("Kumpulan perlu sekurang-kurangnya 2 soalan.") against D108-1 (1..n); (b) the pool must add a group as **one unit** and never split/reorder members (FR-X1-4e, `exam/builder/paper-check.ts`); (c) "Pembina Kertas" and "Set Builder" show the same papers: one builder, `/admin/spm/kertas` redirects (UI, S3-T02); (d) Terbit with a Disahkan contract must not need the exception box (route already takes `override` + `reason` only for the exception path); (e) section rule `choose` exists in the contract; the missing "Pilih N" control is UI; (f) integrity: every group with a member on a paper has all its members in the same section, contiguous, in group order (DM-26 verification script), and `paper_placements.question_id` gets its missing FK (DM-11); (g) paper detail returns per-member `pinned` and `servable` flags and `importIssues[]` derived from the member flags (open flags of DM-05 and intake item flags); `papers.is_test` papers are excluded from "Set kertas (pilihan)"; paper saves accept an optional `expectedUpdatedAt` (a mismatch answers `409 STALE_VERSION`, 40 E-9); (h) **list of "Kertas Diimport" (A-17):** `GET /api/admin/papers` takes the additive filter `imported=true` (only papers with `source_batch_id` not null, DM-45; omitting it returns all papers; the tab "Kertas Diimport" sends `surface=simulasi&imported=true`) and `sourceBatchId` (optional, one batch), and each `BijakBuilderPaperSummary` gains `sourceBatchId: number|null`, `paperCode: string|null`, `questionCount` (placements), `importIssueCount` (members with an open import flag, DM-05) and `status` (`draf`, `diterbitkan`, `disembunyikan`); the tab "Kertas Diimport" is this call with `imported=true` and the Bilangan Soalan column is `questionCount` (no new API ID). **Owner of (h) (A-19, run 5): S1-T10**, in the same PR that creates the imported papers (a cross-sector PR to S3 for the `admin-papers` list route and the summary type; S3-T02 keeps (h) when it rebuilds the list) | FR-ADM-Q13.*, Q14.*, Q15.*, QE7.* | S3-T02, S1-T06, S1-T10 (h) |
| API-BIJAK-11 | `POST /api/admin/papers/generate` (Jana set) | AP | today: `BijakBuilderPaperCreate` {subject, kertas, title?} (the service parses `unknown`, `exam/builder/builder.service.ts`); target adds `year?`, `negeri?`, `count?` (the Tahun, Negeri and Bilangan inputs) per V2 | `{data: {id}}` of the new draft | Exists-Fix: Jana set has no Tahun/Negeri/Bilangan inputs; Sejarah offers Kertas 2 only (blueprint data) | FR-ADM-Q14.*, QE7.* | S3-T02 |
| API-BIJAK-12 | `GET /api/admin/servability/lanes/{lane}` | AP | `lane` in `databank, bijak-spm` today; add `latih-tubi, tracking-a, subjektif, kertas-subjektif` | `{count, attention: {count, text}, rows[], meta}` | Exists-Fix: only 2 of the 6 hub cards have a read (`questions/http/servability.controller.ts:79,86`). The hub shows 2 cards and the Latih Tubi, Tracking A, Subjektif, Kertas Subjektif lanes are missing; `attention` text is the BM servability reason (`SERVABILITY_REASON_MS`); no "Flag OFF" tag (D104) | FR-ADM-Q01.1..5, Q02.1..4 | S3-T03 |
| API-BIJAK-13 | `GET /api/admin/spm/tracking-a`, `GET /api/admin/spm/tracking-a/:id`, `POST /api/admin/spm/tracking-a`, `PUT /api/admin/spm/tracking-a/:id` | AP | create {subjectId, year, setNo}; save {items: [{kind:'question' or 'group', id}]} (shape 2.17.5) | `TrackingASet` {id, subject, year, setNo, kind, targetCount, filled, attention} | Missing-Build. Pupil side `GET /spm/tracking-a*` exists (`spm/tracking.service.ts`); admin `/admin/spm/tracking-a` is 404; table `spm_tracking_sets` is seed-only. Target size stays `spm_subject_configs.target_size`; a question may sit in one sibling set only (`unique (subject_id, year, question_id)`, DM-24). The pupil Tracking A attempt is a Bijak-style attempt and writes answer rows with mode `tracking_a` (DM-44, master table in 40) | FR-ADM-Q17.1..6 | S3-T05 |
| API-BIJAK-14 | Kertas Subjektif admin: list, create, read, update, delete, publish, withdraw **reuse `/api/admin/papers*` (API-BIJAK-10) with `surface = 'subjektif'`**; new: `POST /api/admin/papers/:id/source` (paper PDF + optional skema PDF -> intake batch for THAT paper, then `{ apply: true }` appends the accepted items as its placements); lane read `GET /api/admin/servability/lanes/kertas-subjektif` | AP | `GET /api/admin/papers?surface=subjektif&subjectId&kertas&year&negeri&status`; create adds `surface`, `examBoard` (Negeri/badan), `kertas` 2-4; source upload multipart | `BijakBuilderPaperSummary` + `surface`, `examBoard`; tiles `{total, published, withScheme}` in `meta.counts`; `202 {data: {batchId}}` for the source upload, `201 {data: {placements}}` for apply | Missing-Build (shape 2.17.5). A Kertas Subjektif paper is a `papers` row with `surface = 'subjektif'` whose placements point at bank questions that carry the DSKP tags and stimulus groups (DM-23, OD-2; replaces the document model of ADR-0033, a new ADR is required). `/admin/spm/kertas-subjektif` is 404 today. The pupil lane lists and opens the papers with `GET /api/bijak/papers?surface=subjektif` and starts the attempt (kind `subjektif`) through API-BIJAK-04, then self-marks through API-BIJAK-05 (N-3, N-4). **One flow for placements (B-03, run 5; 45 section 3.5):** the batch created by `POST .../:id/source` is the source batch of THAT paper; when its items are accepted, "Hantar untuk semakan" on that batch (including from Kiriman Guru) calls `{ apply: true }` of this route, owned by S3-T06, which appends the placements and creates no paper; API-Q-25 refuses that batch with `422`, and the S1 guard in API-Q-25 (S1-T10) is the only code that refuses it | FR-ADM-Q18.1..8 | S3-T06 |
| API-BIJAK-15 | `GET /api/admin/servability/overview` for the SPM hub | AP | none | counts and attention per activity | Exists-OK (`servability.controller.ts`); see API-BIJAK-12 for the missing lane reads | FR-ADM-Q01.2 | S3-T03 |

### 2.9 PRAC (practice engine)

Controllers: `practice/practice.controller.ts`, `practice/reads/overview/overview.controller.ts`, `practice/reads/analytics/analytics.controller.ts`, `practice/reads/writes/writes.controller.ts`, `classes/missions/missions.controller.ts`, `content/audio/audio.controller.ts`, `pksk/pksk-student.controller.ts`.

| API ID | Method + path | Roles | Request | Response | Status | FR/AC | Card |
|---|---|---|---|---|---|---|---|
| API-PRAC-01 | `POST /api/practice/sessions` | any signed-in pupil (no `@Roles`) | `StartSessionRequest` (`practice/schema.ts:96`): `mode` (chapter/revision/latih_tubi/mission/remedial/question_set/pksk/databank/tracking_a; `random`, `past_year` and `ramalan` are legacy values kept in `ck_practice_sessions_mode` so old rows stay valid and read only, never written by R1 code, D-T10-2; a start request with `mode: "random"` (or either other legacy value) is refused with `422` ERR-PRAC-07 "Mod tidak sah." (N-5); the screen-to-mode table is in 40, OPT-MODE-SESI), `subjectCode`, `levelId`, `difficulty`, `count`, `chapterId`, `year`, `setNo`, `targetQuestionId`, `missionId`, `remedialTestId`, `questionSetId`, `clientUuid` (idempotency: a repeat start with the same `clientUuid` returns the first session); **mode list (F-02):** `chapter, revision, latih_tubi, mission, remedial, question_set, pksk, databank, tracking_a` for a practice session (12 values in `ck_practice_sessions_mode` after migration `0181`: these nine plus the legacy `random`, `past_year` and `ramalan`, which appear only on old rows and are never written by R1 code; 50 section 4.7a "Written versus read", D-T10-2); the Bijak paper sittings use attempts (API-BIJAK-04) and write their answers to the same store under `simulasi` (Simulasi / Bijak paper), `kuiz` (Kuiz, through API-BIJAK-06) or `subjektif` (Kertas Subjektif papers), and Soalan Berstruktur writes `structured` (API-PRAC-10); **Random Kuiz does not use this route**: it uses API-BIJAK-06 (`/api/bijak/kuiz/sessions`, check, finish) and writes mode `kuiz` (D-T10-3); Battle Arena writes `battle` and every other game writes `game` (master table in 40, registry in 50 section 4.7a) | `StartSessionResponse` {sessionId, `resumed`, `answered[{questionId, selectedLabel, isCorrect}]`, mode, subject, chapter?, questions: `PracticeQuizQuestion[]` (strict: id, questionText, options only), revisionMeta?, timeLimitSec?} | Exists-Fix: (1) level offering is T4/T5 only: `OFFERED_LEVEL_CODES = SPM_LEVEL_CODES` (`practice/rules.ts:40-43`) -> offer the active non-primary levels from `education_levels`, that is T1-T5 (DM-20; FR-X3-3, FR-MUR-16-2, D101); (2) `PracticeQuizQuestion` has **no stimulus, no group, no figure, no parts**, and the bridge drops richer items (`be09-practice-mapping.ts`), so figure questions and groups are never served and figure-less "Rajah..." items slip through: add additive `stimulusGroup` (shape 4.1) and `parts` and serve a group as one unit (FR-X1-4e, D105, FR-MUR-QP-4..7); (3) serve rule: servability reasons `has_stimulus` / `has_option_image` must be dropped for Latih Tubi, Databank, Soalan by Chapter (D105); (4) every session mode writes its answer rows to `practice_answers` with `mode` through the one `AnswerLogPort` (DM-44); the Syiling credit reads `reward_settings.coins_per_correct` (DM-48, default 1); (5) all T1-T5 level codes are offered | FR-MUR-16-*, 9-*, QP-4..7, 13, FR-X3-3 | S5-T03, S1-T06, S4-T06, S5-T01 |
| API-PRAC-02 | `POST /api/practice/sessions/:id/check-answer` | M (own session) | `CheckAnswerRequest` {questionId, selectedOptionId, `selectedOptionIds[]` (only for `question_set`)} | `CheckAnswerResponse` {isCorrect, correctOptionId, `correctOptionIds[]`, feedback, explanation} | Exists-Fix: the multi-answer request and response fields are added; single-answer MCQ is unchanged. Non-MCQ leaves in drills need an `answer` union like Bijak (OQ-API-10); not required while drills serve MCQ units. Each check writes one `practice_answers` row with the session `mode` (DM-44, D-A1); never a second table. Built by S5-T03; S5-T11 uses the `question_set` fields (`selectedOptionIds[]`, `correctOptionIds[]`) and the 404 start check of API-PRAC-01 for an unassigned set and depends on S5-T03 | FR-MUR-16-* | S5-T03, S5-T11 (uses) |
| API-PRAC-03 | `POST /api/practice/sessions/:id/submit`, `GET /api/practice/sessions` | M (own) | submit `SubmitSessionRequest` {timeSpent}; list `ListSessionsQuery` | `SubmitSessionResponse` (+ gamification); `SessionListResponse` with stats (excludes `abandoned` sessions) | Exists-Fix (`practice/practice.controller.ts`): a session sweeper job (no route) moves a session idle for 2 h to status `abandoned` (shown as "ditinggalkan", DM-66); this sweeper (S5-T15) covers `practice_sessions` only; an abandoned Kuiz session (API-BIJAK-06) is closed by the S3-T04 timer job in `bijak/`, which keeps the checked rows and pays no reward | FR-MUR-16-*, FR-MUR-A1-6 | S5-T15 |
| API-PRAC-04 | `GET /api/practice/subjects`, `GET /api/practice/subjects/:code` | M | `levelCode?` | Latih Tubi subject cards with servable counts | Exists-Fix: T1-T5 offering (see API-PRAC-01) and counts equal what the draw serves (D91, FR-X4-2); on UAT the admin shows "Dilihat murid di 0/6" while this serves the questions (see API-Q-11) | FR-MUR-16-*, FR-X4-2 | S5-T03, S1-T07 |
| API-PRAC-05 | `GET /api/practice/chapter-subjects`, `GET /api/practice/chapter-subjects/:code` | M | `levelCode?` | subjects with chapter counts; chapters (`number`, `name`, `servableCount`; no `locked` field, every chapter is open, D98) | Exists-Fix: UAT shows "Tiada subjek bab tersedia untuk tahap ini" (0 questions have a Bab; data via API-DSKP-09) and the T1 gate; chapters must carry the **real chapter number**; the 70% unlock rule and sentence are removed (D98, SRS; plan S5-T02 aligned, OQ-API-11) | FR-MUR-9-*, FR-GUR-9 | S5-T02 |
| API-PRAC-06 | `GET /api/practice/revision`, `GET /api/practice/revision/:code`, `GET /api/practice/progress`, `GET /api/practice/history`, `GET /api/practice/corrections`, `GET /api/practice/mastery` | M | `subjectCode?` | wrong-answer queue, progress, history, mastery per subject | Exists-OK (`practice/reads/analytics/analytics.controller.ts`) | FR-MUR-12-*, 6-6 | S5-T07 |
| API-PRAC-07 | `GET /api/remedial-tests/mine`, `GET /api/remedial-tests/:id` (today's missions: API-GUR-10) | M | none | assigned tests | Exists-OK (`classes/missions/missions.controller.ts`); only teacher-assigned tests; **auto cards** for weak subjects are missing (API-PRAC-08) | FR-MUR-12-1 | S5-T07 |
| API-PRAC-08 | `GET /api/practice/remedial-suggestions` | M | none | `{completed[], needed[{subjectCode, subjectName, accuracy /* mean session accuracy, one decimal, 4.6, D-T10-1 */, target: 60, before, after?}], assigned[]}` | Missing-Build (shape 2.17.5). A subject is "Perlu Pemulihan" when the pupil's mean session accuracy there is below 60% (FR-MUR-12-2); drill = `POST /practice/sessions` with `mode: 'remedial'` or `'revision'`. May be satisfied by extending `GET /api/practice/mastery` if it already returns per-subject mean session accuracy (not verified); decide in S5-T07 | FR-MUR-12-1..6 | S5-T07 |
| API-PRAC-09 | `GET /api/spm-targets`, `PUT /api/spm-targets` | M | {subjectCode: grade} | targets | Exists-OK (`practice/reads/writes/writes.controller.ts`) | FR-MUR-2-* | n/a |
| API-PRAC-10 | `GET /api/practice/structured`, `GET /api/practice/structured/:id`, `POST /api/practice/structured/:id/attempts` | M | answers | structured item + attempt result | Exists-Fix (R1-MUR-17 "Complete": seeded only; the attempt now writes through the port). **Subjektif / Berstruktur storage (D-A9, N-3):** this route creates attempts of kind `structured` only; a Kertas Subjektif attempt is created by API-BIJAK-04 (S3-T06); `POST /api/practice/structured/:id/attempts` creates an `exam_attempts` row (kind `structured`); marking, scheme reveal and `POST /api/bijak/attempts/:id/self-mark` (API-BIJAK-05) apply; answers are written per leaf part to `practice_answers` with mode `structured` (the master table in 40, OPT-MODE-SESI; Kertas Subjektif sittings use `subjektif`, API-BIJAK-04), `part_ref`, `marks_awarded`, `marks_max` (DM-44); the self-mark keeps mode `structured`; the attempt shows in Prestasi as a unit. No separate `StructuredAttempt` result store is read by reports | FR-MUR-17-* | S5-T11 |
| API-PRAC-11 | `GET /api/audio-kbat-sets`, `.../:id`, `.../:id/sections/:no/audio`, `POST .../:id/attempts`; admin `GET/POST /api/admin/audio-kbat-sets`, `GET .../template` | M reads; AP admin | attempt answers | audio set | Exists-OK (`content/audio/audio.controller.ts`); Delivery B | FR-MUR-27-* | S5-T12 |
| API-PRAC-12 | `GET /api/pksk/me/access`, `GET /api/pksk-domains`, `GET /api/pksk/levels/:level/dashboard`, `.../domains`, `.../domains/:code`, `.../exam-attempts`, `.../exam`, `POST .../domains/:code/practice-sessions`, `POST .../exam-attempts` | M | — | PKSK content and attempts; start sets: levels A/B/C = 10 questions, domain = 5 | Exists-Fix (`pksk/pksk-student.controller.ts`); the SRS lists the answering flow as "Complete" (S5-T13), no specific route defect pinned; verify on UAT data | FR-MUR-19-* | S5-T13 |

### 2.10 RPT (performance, analytics, headcount, Kirkpatrick, monitoring)

Controllers: `reports/performance/http/performance.controllers.ts`, `reports/performance/http/social.controllers.ts`, `reports/performance/headcount/headcount.controllers.ts`, `reports/performance/timeline/timeline.controllers.ts`, `reports/analytics/http/analytics.controllers.ts`, `reports/kirkpatrick/http/kirkpatrick.controllers.ts`, `command-center/board/board.controller.ts`.

| API ID | Method + path | Roles | Request | Response | Status | FR/AC | Card |
|---|---|---|---|---|---|---|---|
| API-RPT-01 | `GET /api/performance/students/:userId` | any signed-in; service rule `mayOpenStudent`: own id, admin any, teacher own-class pupil, school_admin own-school pupil | none | `PerformanceStudent` {mastery per subject, sessions, accuracy} | Exists-Fix (`reports/performance/services/student-performance.service.ts`; `domain/access-policy.ts`): for the role student the route returns the own data with no redirect, and the school and class endpoints answer `403` for a student. A pupil asking for another pupil's id gets **404** (AC-MUR-4-2). The defect "pupil Prestasi opens the school dashboard" is the front end (`/prestasi` redirects to `/prestasi/sekolah`; the pupil must go to `/prestasi/{ownId}`). Figures follow 4.6 (`accuracy` is a number with one decimal on the wire and the page shows the whole number rounded half up, D-T10-1; Soalan Diuji = distinct questions) | FR-MUR-4-1, 4-5, AC-MUR-4-2 | S10-T01 |
| API-RPT-02 | `GET /api/performance/school`, `GET /api/performance/levels`, `GET /api/performance/levels/:code`, `GET /api/performance/classes`, `GET /api/performance/classes/:id` | G (own classes), AS (own school), AP; **not M** | none | `PerformanceSchool` / level / class dashboards | Exists-Fix: no `@Roles`; for a `student` the service returns school-wide aggregates (cohort-gated, `levelVisibleToNonStaff`) -> **privacy defect** (FR-X4-4, P0). Add `@Roles('teacher','school_admin','admin')` (+ `ppd_officer` aggregates outside R1) so a pupil gets `403`. Owner S10-T01 (the `@Roles` fix); S10-T07 only reads the teacher and school dashboards | FR-X4-4, FR-MUR-4-*, FR-GUR-4-*, FR-AS-4-* | S10-T01 |
| API-RPT-03 | `GET /api/analytics/me` | M | none | `PerformanceAnalyticsMe` (per-subject SP mastery, trend, projection) | Exists-Fix: subject picker only lists subjects with data; show a tab for **every subject with SP nodes** and "-" accuracy when no answers; SP data is empty on UAT until Bab/SP mapping (S4-T03) | FR-MUR-5-1.. | S10-T04 |
| API-RPT-04 | `GET /api/analytics/classes` | `['admin','teacher']` today | `classroomId?` | class analytics | Exists-Fix: must also accept `school_admin` with the school forced (`CLASS_ANALYSIS_ROLES`, `domain/access-policy.ts`); add "Kelas" column data; hide "Rekod Intervensi" for AS | FR-GUR-5-*, FR-AS-5-* | S10-T04 |
| API-RPT-05 | `GET /api/item-analysis/me` | M (own attempts only) | `subjectCode?`, `tapis?` (`semua` default, `ada_betul`, `selalu_salah`; `selalu_salah` lists only items with at least 2 attempts and 0 correct; 10 R1-MUR-6 uses these same slugs) | the shape of 2.17.6 (tiles, per-subject counts, items with attempts and correct) | Missing-Build (shape 2.17.6). A pupil has no own-scope item analysis. Figures follow 4.6 | FR-MUR-6-1..9, AC-MUR-6-* | S10-T03 |
| API-RPT-06 | `GET /api/item-analysis/school`, `GET /api/item-analysis/school/:schoolId` | `admin, teacher, school_admin, student, ppd_officer` today | `level`, `subject`, `range` | `ItemAnalysis` school scope | Exists-Fix: role list contains `student` (`performance.controllers.ts:118,124`) -> school-wide item data reachable by a pupil; **remove `student`**, pupil gets `403` (AC-MUR-6-5). AS gets own school only (`schoolAccess`) | FR-MUR-6-2, AC-MUR-6-5, FR-AS-6-* | S10-T03 |
| API-RPT-07 | `GET /api/item-analysis/classes`, `GET /api/item-analysis/classes/:id`, `GET /api/teacher/item-analysis`, `GET /api/teacher/report` | `['admin','teacher']` | `classroomId` | class item analysis, teacher report | Exists-Fix: one Tahap rule (% betul bands) across both pages; the sort select and search must be bound to the rows (V1 defect); empty tables are a data matter | FR-GUR-6-*, FR-GUR-42-* | S10-T03 |
| API-RPT-08 | `GET /api/headcounts/me`, `GET /api/headcounts/me/detail` | M (own classes, own rows only) | none | list of the pupil's headcount configs for the current session year; own detail (`PerformanceHeadcountStudent`) | Missing-Build (shape 2.17.6). The whole `/api/headcounts` controller is `@Roles('admin','teacher','school_admin')`, so a pupil gets 403. Any other pupil id = `403` (FR-MUR-3-1). **One computation (D-A3):** the pupil view shows the numbers computed by the Headcount spec in 20 R1-GUR-3 (same OTR_k arithmetic, AR source and "On Track" rule: AR >= OTR_k of the latest checkpoint with an AR; no midpoint rule, no AR >= TOV rule); "Active" = the entry has an ETR, its own or the class default; the pupil card reads "Draft" with "Belum Ada Data" exactly when there is no ETR, and a missing TOV alone does not change it (DM-49, P-10). The Prestasi 360 Headcount block (10 FR-MUR-4-6) reads `GET /api/headcounts/me` and shows its empty copy until S10-T02 has merged this route | FR-MUR-3-1..8, AC-MUR-3-5 | S10-T02 |
| API-RPT-09 | `GET /api/headcounts`, `GET .../dashboard`, `GET .../form-options`, `GET .../students/:userId`, `GET .../:id`, `GET .../:id/summary`, `GET .../:id/export` (CSV), `POST /api/headcounts`, `POST .../auto-setup`, `POST .../:id/drop-students`, `POST .../:id/reset`, `DELETE .../:id` | G, AS (read), AP | create `PerformanceHeadcountCreateRequest` {classroomId, subjectId, educationLevelId, academicYear, activeOtrs 2..5, mode auto/manual}; auto-setup {levels[]}; drop {action: drop/restore, studentIds[]} | list/detail/summary (`PerformanceHeadcount*`) | Exists-Fix: (a) list/detail shows only configs created by the viewer (`headcount.service.ts:114,121`) -> AS sees none; for `school_admin` return the configs of the school's classes; (b) write routes must refuse `school_admin` (read-only, FR-AS-3-*); (c) add the "Guru" column. In Auto mode the AR is `round(correct / answered * 100)` over `practice_answers` rows of the subject within the config's academic year, **all modes** (HC-SPEC in 20 R1-GUR-3, HC-3; D-A3), the same query for the pupil, teacher and school-admin views; a Manual AR is stored with 1 decimal; a grade band is chosen on the AR rounded to a whole number | FR-GUR-3-1..2, FR-AS-3-* | S10-T02 |
| API-RPT-10 | `PUT /api/headcounts/:id/ar` (Key-in AR), `PUT /api/headcounts/:id/tov` (Edit TOV/ETR), `PUT /api/headcounts/:id/settings` (Tetapan, Auto/Manual) | G (own config) | shapes in 2.17.6; `PUT .../tov` also accepts the optional `rsRecordedAt` (date, not in the future; "Tarikh Rekod RS", DM-49) | updated `PerformanceHeadcountDetail` | Missing-Build. The controller has no write beyond create/auto-setup/drop/reset/delete, so the four placeholder pages (`HeadcountShellPage.vue`) have nothing to call; OTR/status rules in `headcount.rules.ts` apply to 2, 3, 4 and 5 OTRs | FR-GUR-3-3, 3-4 | S10-T02 |
| API-RPT-11 | `GET /api/kirkpatrick/overview`, `.../reaction`, `.../learning`, `.../behavior`, `.../results`, `.../chain`, `.../filter-options`, `.../students/:id`, `.../export-pdf`, `.../interventions`, `POST .../interventions`; `GET /api/kirkpatrick/me`; `GET /api/feedback/status`, `POST /api/feedback` | AP, G, AS (staff routes; teacher and AS forced to the own school); `me` and `feedback`: any signed-in | `period`, `state`, `school` (ignored for G/AS) | Kirkpatrick levels | Exists-Fix: scope is already forced on the server (`reports/kirkpatrick/services/scope.ts`). The AS defects are front-end (6 of 7 routes unregistered, `detailLinks:false`; "Tahap 1" click dead; school/state selects instead of the locked label). API fix: **no-data must not become a decline** ("Penurunan 73.3%" when the period has no activity, FR-X4-3), locate in `kirkpatrick/domain/aggregate.ts` or the front-end comparison panel and fix there; the `interventions` write is hidden from AS (OQ-AS-5) | FR-AS-11-*, FR-GUR-11-*, FR-ADM-M04.*, FR-X4-3 | S6-T02 |
| API-RPT-12 | `GET /api/monitoring/overview`, `.../export`, `.../schools/:schoolId`, `.../schools/:schoolId/students/:userId`, `.../schools/:schoolId/teachers/:userId` | AP, G, AS (G and AS forced to the own school; `state` ignored) | `state`, `level`, `range` | monitoring payloads | Exists-OK (`reports/analytics/http/analytics.controllers.ts`); defects are front-end: Guru mount shows the national overview, AS mount shows whole-country filters and 4 vs 3 teachers (XS-3), admin menu points to `/guru/monitoring`. Weekly tracking limited to 12 weeks for AS (FE or service param) | FR-GUR-10-*, FR-AS-10-*, FR-ADM-M03.* | S6-T08 |
| API-RPT-13 | `GET /api/rankings`, `GET /api/leaderboard`, `GET /api/weekly-report` | any signed-in | rankings `PerformanceRankingQuery`; `GET /api/rankings` `PerformanceRankingQuery` returns the four scopes (class, school, state, national) and "Sekitar anda" for Kedudukan; `GET /api/leaderboard` takes `scope` (kelas, sekolah only; the same two as API-GAME-06, which owns the leaderboard) and `period` | ranking rows; rank and percentile reads for Kedudukan | Exists-Fix: single leaderboard API `GET /api/leaderboard` (D113, see API-GAME-06); `rankings` returns an empty list ("Tiada data kedudukan") instead of own rank cards and "Sekitar anda" (R1-MUR-18); `GET /api/weekly-report` is **always 403** by design (student/parent screen unchanged, not linked from the Guru menu; the one teacher route is `GET /api/guru/weekly-report`, API-GUR-21; it is not an alias of this one) | FR-MUR-18-*, FR-GUR-43-3 | S7-T06, S6-T01 |
| API-RPT-14 | `GET /api/timeline`, `POST /api/timeline` | M | POST {title, category (enum), eventDate, story (max 500), photos[]} | `PerformanceTimelinePost[]` | Exists-Fix: feed is manual posts only; V2 merges **automatic entries** (finished sessions, badges, level-ups) and shows "Profil Awam Anda"; add them to the GET and keep manual posts (FR-MUR-39-1) | FR-MUR-39-1..5 | S10-T08 |
| API-RPT-15 | `DELETE /api/timeline/:id` | M (own manual post) | none | `{deleted: 1}` | Missing-Build. No delete route exists (FR-MUR-39-3) | FR-MUR-39-3, AC-MUR-39-2 | S10-T08 |
| API-RPT-16 | `PUT /api/headcounts/:id/defaults` | G (own config; AS and AP refused) | `{defaultTov: number or null (0..100), defaultEtr: number or null (0..100)}` | updated `PerformanceHeadcountDetail` | Missing-Build (DM-49). The V2 per-subject card "Simpan Sasaran" (FR-GUR-3-9, AC-GUR-3-13): the class-level TOV and RS written here are the defaults of every entry whose own value is null | FR-GUR-3-4, AC-GUR-3-2 | S10-T02 |
| API-RPT-17 | `POST /api/kirkpatrick/interventions/:id/review` | G (own), AS (own school) | none | the intervention with `after_accuracy` | Missing-Build (shape 2.17.6). Writes `interventions.after_accuracy` = the accuracy of the 14 days after the record (DM-30); refused with `409` before 7 days after `action_date` | 20 ADD-15 (working label), R1-GUR-43 | S6-T02 |

### 2.11 GAME (Permainan, battle, gamification, wallet, shop)

Controllers: `games/rooms/rooms.controller.ts`, `games/rooms/quick-match.controller.ts`, `games/solo/**/**.controller.ts`, `games/leagues/leagues.controller.ts`, `battle/{arena,queue,standings,tournaments}/*.ts`, `gamification/gamification.controller.ts`, `wallet/wallet.controller.ts`, `shop/shop.controller.ts`.

| API ID | Method + path | Roles | Request | Response | Status | FR/AC | Card |
|---|---|---|---|---|---|---|---|
| API-GAME-01 | `GET /api/games/hub`, `GET /api/games/:game/lobby`, `POST /api/games/:game/rooms`, `POST /api/games/:game/rooms/join`, `GET /api/games/:game/rooms/:code`, `POST /api/games/:game/rooms/:code/start`, `POST /api/games/:game/rooms/:code/action`, `POST /api/papan-bijak/quick-match`, `GET /api/papan-bijak/quick-match/poll`, `POST /api/papan-bijak/quick-match/cancel` | any signed-in pupil | room/action bodies in `games/schema` | room state with `roundEndsAt`; the result view returns `reward {xp, syiling, capped, reason}` | Exists-Fix (`games/rooms/*.ts`): `roundEndsAt`, same-school opponent search, `isBot` labels ("Robot PrestasiPlus") and the reward block are added; the `attempt_id` of room answer rows is `game_rooms.session_id` (DM-67); behind the `permainan` switch (API-AUTH-16: off -> 404). Games draw MCQ text units only until image support exists (`image_games` reason). A question answered in a game writes a `practice_answers` row with mode `game` (DM-44, D-A1); the Syiling credit follows `reward_settings.mini_games_give_coins` (default No, XP only) | FR-MUR-21-* | S7-T01 |
| API-GAME-02 | `GET /api/games/solo/:game`, `POST /api/games/solo/kad-memori/reveal`, `POST /api/games/solo/:game/check`, `POST /api/games/solo/:game/submit`, `GET /api/games/jutawan`, `POST /api/games/jutawan/start`, `.../:sessionId/answer`, `.../:sessionId/lifeline`, `GET /api/games/roda-nasib`, `POST /api/games/roda-nasib/spin`, `GET /api/games/pertandingan`, `GET /api/games/uji-minda` | M | answers | game state; the result view returns `reward {xp, syiling, capped, reason}` | Exists-Fix (`games/solo/**`): reward block added; solo answer rows use the solo session uuid as `attempt_id` | FR-MUR-21-* | S7-T01 |
| API-GAME-03 | `GET /api/battle/lobby`, `GET /api/battle/arena/:uuid`, `POST /api/battle/arena/:uuid/answer`, `GET /api/battle/search-opponent`, `POST /api/battle/invite`, `GET /api/battle/invitations`, `POST /api/battle/invite/:uuid/accept`, `POST /api/battle/invite/:uuid/decline`, `POST /api/battle/forfeit/:uuid`, `POST /api/battle/quick-match`, `POST /api/battle/school-battle`, `GET /api/battle/poll-match/:queueId`, `POST /api/battle/accept-challenger/:queueId`, `POST /api/battle/reject-challenger/:queueId`, `POST /api/battle/join-queue/:queueId`, `GET /api/battle/poll-challenger/:queueId` | M | battle bodies; search restricted to the same school | battle state with `roundEndsAt`, `isBot` labels and `reward {xp, syiling, capped, reason}` | Exists-Fix (`battle/arena`, `battle/queue`): a robot battle has `counts_for_ranking = false` (DM-60), the real-pupil bot pool is removed, Battle answers write `practice_answers` mode `battle` with the battle uuid as `attempt_id`; the "Batal" of the queue overlay is API-GAME-14 | FR-MUR-21-* | S7-T01 |
| API-GAME-04 | `GET /api/battle/standings/students`, `GET /api/battle/standings/schools`, `GET /api/battle/schools/:id`, `GET /api/battle/history` | any signed-in | `period`, `state` | standings | Exists-OK (`battle/standings/standings.controller.ts`). Names of other pupils are the display name only (4.6) | R1-ADM-P2-15 | S7-T06 |
| API-GAME-05 | `GET /api/tournament/active`, `GET /api/tournaments`, `GET /api/tournaments/:uuid`, `GET/POST /api/leagues`, `POST /api/leagues/join`, `GET /api/leagues/:id` | any signed-in pupil | join {code} (unused in R1) | leagues/tournaments | Exists-Fix: `POST /api/leagues/join` is not used by any R1 screen and answers `403` for every role; Admin Pusat enrols a school through API-ADM-25; Tournament page is empty/demo; must read real leagues, standings and the shell banner when active (FR-MUR-23-*); the answer `part_ref` is `tournament#{position}` (position 1-10 within the round, 48 GAME-15) | FR-MUR-23-* | S7-T06 |
| API-GAME-06 | `GET /api/leaderboard` (canonical; `GET /api/gamification/leaderboard` is removed once no client calls it, and `/gamification/leaderboard` redirects to `/leaderboard`) | M (and staff for own scope) | **target** `scope=kelas or sekolah`, `period=all or week or month` | `{me: {rank, coins, accuracy /* one decimal, 4.6, D-T10-1 */, streak}, podium[3], rows[{rank, name, coins, accuracy, streak, userId}]}` | Exists-Fix: `GET /api/leaderboard` is the single leaderboard API (D113), honours `scope` and `period` and returns `{me, podium[3], rows[]}`; the old handler **ignores the period and every other query** (`gamification.controller.ts:69`, FR-M14-08); the page needs scope tabs Kelas/Sekolah, period chips and the "Kedudukan Anda" tiles with own rank even outside the top; names only within the viewer's scope; the duplicate route is a front-end redirect. `rows[].name` and `podium[].name` are the display name (first name only, no school) for every pupil except the viewer (D-A12, 4.6: first given name only) | FR-MUR-33-1..5, AC-MUR-33-* | S7-T06 |
| API-GAME-07 | `GET /api/gamification/dashboard`, `.../challenges`, `.../convert`, `POST .../convert`, `GET /api/gamification/wallet`, `GET /api/gamification/transactions` | M | convert {tokens} | wallet, challenges, conversion | Exists-OK (`gamification/gamification.controller.ts`, `wallet/wallet.controller.ts`); reward model vs V2 per R1-MUR-28/29 "Complete" | FR-MUR-28-*, 29-*, 30-* | S7-T04 |
| API-GAME-08 | `GET /api/hadiah-digital/items` and `GET /api/hadiah-digital/redemptions` (both marked "removed once `/cikgu/hadiah` reads the shared `rewards` catalogue", D113, DM-77), `POST /api/hadiah/redemptions` (idempotent per `(userId, clientUuid)` only, DM-78: no `Idempotency-Key` header and no time window), `GET /api/gamification/mystery-boxes`, `POST /api/gamification/mystery-boxes/:id/open`, `GET /api/cabutan`, `POST /api/cabutan/:drawId/tickets` (idempotent by `clientUuid`, DM-78) | M | redemption {itemId, `clientUuid`} | shop/box/draw | Exists-Fix: catalogue empty until the admin loads gifts (data + admin screens); Kotak Misteri must be the single **50-syiling box** with admin-configurable odds, an odds table and disclaimer (R1-MUR-35) instead of four token boxes | FR-MUR-31-*, 35-*, 22-*, 38-* | S7-T05, S7-T07 |
| API-GAME-09 | `GET /api/admin/reward-control/draws`, `POST /api/admin/reward-control/draws/:id/close`, `POST /api/admin/reward-control/draws/:id/winners`; `GET/POST /api/admin/reward-control/mystery-boxes`, `PUT /api/admin/reward-control/mystery-boxes/:id` | AP | winners {drawPrizeId} ("Cabut pemenang"); box {label, costSyiling, isActive, prizes[{label, kind, amount, weight, stock?}]} (no `xp` field), weights total 100 | draw rows with winners per prize slot; boxes | Missing-Build (provisional, no V2 capture of these forms, E-14). Only `POST draws` exists. New tables `draw_winners` (DM-36) and `mystery_boxes` + `mystery_box_prizes` seeded from the four constants in `shop.constants.ts` (DM-37) | FR-ADM-P2-10, P2-11 | S7-T07 |
| API-GAME-10 | `POST /api/mohon-keluarga-angkat` | any signed-in (Mohon Keluarga Angkat, hidden module) | application body (`sponsorship` contract) | `201 {data}` | Exists-Fix: answers 201 to any signed-in role today; must be **404 for everyone** while hidden (D102, API-AUTH-16). The marketplace routes are in API-ADM-19 | FR-X2-1a | S0-T10 |
| API-GAME-11 | `POST /api/gamification/challenges/:id/claim` | M | none | `{claimed: true, rewardSyiling, rewardXp}`; `409` if already claimed that MYT day | Missing-Build (shape 2.17.9). Credits `reward_syiling` and `reward_xp` once (ledger source `challenge`; DM-63, DM-79); idempotent per `(userId, clientUuid)`; the auto-credit on session completion is removed | FR-GM-19.* | S7-T04 |
| API-GAME-12 | `POST /api/tournaments/:uuid/register`, `POST /api/tournaments/:uuid/rounds/:n/start`, `POST /api/tournaments/:uuid/rounds/:n/answer`, `GET /api/tournaments/:uuid/standings` | M | register `{}`; answer `{questionId, optionId}` | round questions; answer result; standings rows | Missing-Build (shape 2.17.9). An answer writes `practice_answers` mode `game`, `part_ref` `tournament#n`, `attempt_id` = `tournament_round_scores.attempt_id` (DM-61) | FR-GM-15.5, FR-GM-15.7 | S7-T06 |
| API-GAME-13 | `GET /api/leagues/:id/standings?level=`, `GET /api/leagues/:id/me` | M (staff read own scope) | `level` | standings rows; the own school row | Missing-Build (shape 2.17.9). Standings recomputed hourly and frozen at the end (DM-62) | FR-GM-15.2, FR-GM-15.3 | S7-T06 |
| API-GAME-14 | `POST /api/battle/queue/:queueId/cancel` | M | none | `{cancelled: true}` | Missing-Build (shape 2.17.9). The "Batal" of the Battle queue overlay | FR-GM-01.* | S7-T01 |

### 2.12 SUP (support tickets, support contact)

Controllers: `support/support.controller.ts` (two classes).

| API ID | Method + path | Roles | Request | Response | Status | FR/AC | Card |
|---|---|---|---|---|---|---|---|
| API-SUP-01 | `GET /api/tiket` | any signed-in (own tickets) | `status?` (unknown value ignored; a `userId` is ignored) | `SupportTicket[]` {id, subject, body, status: `dibuka`/`dalam_proses`/`menunggu_balas`/`selesai`/`ditutup` (the stored Malay values; no English status value exists anywhere), statusLabel, adminReply, createdAt} | Exists-Fix: `adminReply` is always `null` today (no reply route); show "Balasan Sokongan" once API-SUP-05 exists (one reply per ticket, DM-32, OD-4) | FR-MUR-A4-*, FR-GUR-A4-*, FR-AS-A4-* | S7-T10 |
| API-SUP-02 | `POST /api/tiket` | any signed-in | `SupportTicketCreateRequest` {subject (<=255), body (<=5000)}; strict: `userId` or any extra key = 422; NUL refused | `201 {data: SupportTicket}`; every active admin gets a `new_ticket` notification | Exists-OK (`support/support.controller.ts:62`). Messages are BM. Rate limit `SUPPORT_LIMITS.create` | FR-MUR-A4-* | S7-T10 |
| API-SUP-03 | `GET /api/admin/tiket`, `GET /api/admin/tiket/open-count` | AP | `status`, `role?`, `page` (25 per page) | `SupportQueueResponse` {rows[{id, createdAt, userName, roleLabel, school, subject, status, replied}], meta: {total, counts}}; `{count}` | Exists-Fix: queue returns the newest 200 only (`SUPPORT_QUEUE_LIMIT`), no role/school columns and no pagination; the SRS wants 25 per page, the user shown by role label and school (no e-mail). Needs `support_tickets.created_role` and `school_id` (DM-32) | FR-ADM-P2-20.1, 20.3 | S7-T09 |
| API-SUP-04 | `GET /api/config/support` | public (rate limited per client) | none | `{data: {email, phone, whatsapp, hours}}` | Exists-Fix: answers **404** "Konfigurasi sokongan tidak dijumpai." when the singleton row is missing (`support/support.service.ts:113`), so Panduan loads with an API error on UAT. Must answer **200 with empty strings** (DM-33; seeded, never 404); the pages hide the contact block | FR-MUR-A3-3, FR-GUR-A3-2, FR-ADM-N07.2, AC-MUR-A3-* | S5-T05, S7-T09 |
| API-SUP-05 | `GET /api/admin/tiket/:id`, `PUT /api/admin/tiket/:id/reply`, `PATCH /api/admin/tiket/:id/status` | AP | reply {text (<=5000)}; status {status: SupportTicketStatus (`dibuka`, `dalam_proses`, `menunggu_balas`, `selesai`, `ditutup`)} | ticket detail (single reply); updated ticket; saving a reply sets `replied` = true and the text appears under "Balasan Sokongan" for the owner | Missing-Build (shape 2.17.7). The module has no reply or status-change route (contract note OQ-API-B4-21); one admin reply per ticket + replier + time (DM-32); messages are BM | FR-ADM-P2-20.2 | S7-T09 |

### 2.13 FILE

Controller: `files/files.controller.ts`.

| API ID | Method + path | Roles | Request | Response | Status | FR/AC | Card |
|---|---|---|---|---|---|---|---|
| API-FILE-01 | `POST /api/files?purpose=<purpose>` | any signed-in (`UploadGuard`: session + CSRF; which role may use which purpose is decided in `files.service.ts`, not verified here) | multipart `file`; `purpose` in `FILE_PURPOSES` = avatar, bijak_photo, question_image, cms_image, audio_kbat, cms_screenshot, timeline_photo (`packages/contract/src/files/schema.ts:14`) and, added by S1-T09b in its own PR (it edits `files/files.service.ts` and `packages/contract/src/files/schema.ts`, both S1-sector files, no cross-sector PR; S1-T01 keeps the route), `drawing_template` (images only, 5 MB, Admin Pusat; the answer template or model drawing of a `drawing` leaf, 45 mode 8); allowed types are **images (jpeg, png, webp) and audio only**, 2 MB for avatar-like purposes | `201 {data: FileRef}`; a too-large file or wrong type is `422` with `fields.file`; unknown purpose `422` `fields.purpose` | Exists-OK (`files/files.controller.ts:146`). Question images are referenced by file id (`imageId`), never by URL; inline SVG is refused (stored-XSS rule). **PDF/DOCX papers do not go through this route**: they use `POST /api/intake/batches/:id/files` (API-Q-14) | FR-ADM-QE1.*, FR-GUR-44-3 | S1-T01 |
| API-FILE-02 | `GET /api/files/:id` | `@Public()` at guard level, but only purpose `cms_image` is readable without a session; every other purpose needs a session (resolved inside the handler: `401` without one, `404` for a file the caller may not see; a `question_image` of a withdrawn paper is readable only by the pupil who sat it, `question-image-access.ts`) | none | binary; `nosniff`, sandbox CSP, `Cache-Control: private, max-age=300` for `cms_image` else `no-store`; read throttled per user or per address | Exists-OK (`files/files.controller.ts:168`) | FR-X1-4d | n/a |
| API-FILE-03 | `DELETE /api/files/:id` | `DeleteGuard` (session + CSRF; ownership rule in `files.service.ts`) | none | `204` | Exists-OK (`files/files.controller.ts:199`) | n/a | n/a |

### 2.14 Additions to servability (shared by Q, PRAC, BIJAK)

`packages/contract/src/servability/schema.ts` `SERVABILITY_REASON_CODES` gains `stimulus_missing` and `figure_only` (API-Q-12; `stem_duplicated` is a flag, not a servability reason); `has_stimulus` and `has_option_image` stop being used by Latih Tubi, Databank and Soalan by Chapter (D105) and stay only for surfaces that truly cannot render them (games `image_games`), each with an admin-visible reason (FR-X1-4e).

### 2.15 Data-model cross-reference (`docs/prd/r1/50-data-model-erd.md`)

| API IDs | DM IDs (change, status in the ERD) |
|---|---|
| API-Q-08, API-BIJAK-10 | DM-01 (group 1..n), DM-02 (RESTRICT on group delete), DM-03 (question-level and part-level stimulus stay valid), DM-04 (flagged question is not "served"), DM-26 (paper/group integrity script), DM-27 (draw inserts a group contiguously) |
| API-Q-12, API-Q-13, API-Q-24, API-Q-11 | DM-05 (stored `stimulus_flag`, same predicate as pupil draws), DM-06 (`regrouped` archive reason), DM-40 (trim duplicated leaf prompt), DM-39 (CI test seed) |
| API-Q-03, API-Q-14, API-Q-15, API-Q-17 | DM-07 (`section_label`), DM-08 (Kertas 1..4), DM-09 (`intake_batches.education_level_id`), DM-10 (CSV codes and `group_key`) |
| API-Q-05 | DM-19 (tag contract and verification SQL; `dskp_complete` stays computed) |
| API-BIJAK-09 | DM-21 (e2e fixture must pass Sahkan), DM-22 (contracts created by the admin on UAT) |
| API-BIJAK-14 | DM-23 (`papers.surface`, `exam_board`), DM-25 (self-mark storage, kept) |
| API-BIJAK-13 | DM-24 (`spm_tracking_set_questions` subject/year/unique) |
| API-AUTH-13, API-DSKP-02 | DM-12 (deactivate Darjah 1-6 on UAT), DM-13 (check: no active primary level) |
| API-DSKP-01, API-PRAC-01, API-PRAC-04, API-PRAC-05 | DM-16 (pupil Topik/Peta read `chapters`), DM-20 (levels from `education_levels`, not T4/T5) |
| API-DSKP-05, API-DSKP-07 | DM-14 (DSKP load T4-T5), DM-15 (`dskp_*` stays the teacher picking list) |
| API-DSKP-09, API-DSKP-10 | DM-17 (bulk-chapter, in-place update), DM-18 (RESTRICT on chapter delete), DM-41 (Bab mapping run) |
| API-PRAC-01, API-PRAC-02, API-PRAC-10, API-BIJAK-04, API-BIJAK-05, API-GAME-01 | DM-44 (single answer store: mode, attempt_id, part_ref, marks) |
| API-Q-25 | DM-45 (`papers.source_batch_id`), DM-11 (placement FK) |
| API-GUR-16, API-GUR-15 | DM-46 (`question_set_classrooms`) |
| API-Q-03 | DM-47 (`difficulty_level`) |
| API-ADM-16 | DM-48 (`reward_settings`) |
| API-RPT-16, API-RPT-08, API-RPT-09 | DM-49 (headcount defaults) |
| API-AS-01..AS-12, API-RPT-02, API-RPT-12 | DM-28 (one named query per XS-1..XS-5) |
| API-AS-15 | DM-29 (Headcount through `classrooms.school_id`) |
| API-RPT-11 | DM-30 (Kirkpatrick: no data is null, never a decline) |
| API-AS-14 | DM-31 (computed on request; no weekly job, no stored board) |
| API-SUP-01..05 | DM-32 (ticket role, school, single reply), DM-33 (`config/support` 200 with empty strings) |
| API-AUTH-16, API-ADM-09 | DM-34 (`feature_flags`, `locked`) |
| API-ADM-06, API-AS-06 | DM-35 (subscriptions and quota; Import Pelajar limit = `student_quota`) |
| API-GAME-09 | DM-36 (`draw_winners`), DM-37 (`mystery_boxes`, `mystery_box_prizes`) |
| API-GUR-24, API-GUR-25 | DM-42 (personal question: `question_versions.visibility`, `owner_user_id`, `reference_url`; excluded from every other served set) |
| API-GUR-28 | DM-43 (`question_sets.kind`, teacher paper reuses the set tables) |
| API-ADM-14..19 | DM-38 (existing gamification, shop, marketplace, tournament tables are enough; no order table) |
| API-Q-26 | DM-71 (`intake_files.retry_count`, `selesai_dengan_ralat`) |
| API-Q-31..API-Q-35 | DM-51 (draft copy of a group), DM-52 (stimulus citation, option body) |
| API-Q-30 | DM-54 (scheme v2), DM-55 (`mode_config`) |
| API-Q-36 | DM-59 (regroup audit payload) |
| API-Q-39 | DM-57 (`blueprint_sections.marks_per_question`, `blueprints.question_count`) |
| API-GAME-12, API-GAME-13, API-ADM-25 | DM-61 (tournament tables), DM-62 (league standings columns) |
| API-GAME-11 | DM-63 (`challenge_claims`), DM-79 (`coin_ledger.client_uuid`) |
| API-GAME-14, API-GAME-01..API-GAME-03 | DM-60 (`battles.counts_for_ranking`), DM-67 (`game_rooms.session_id`) |
| API-ADM-23 | DM-64 (`spin_segments`) |
| API-ADM-24 | DM-65 (`draws.status`) |
| API-PRAC-03 | DM-66 (`practice_sessions.status` `abandoned`) |
| API-BIJAK-04 | DM-68 (attempt part-answer JSON) |
| API-GUR-17 | DM-72 (teacher intake source) |
| API-GUR-11 | DM-75 (Misi Harian fields) |
| API-MUR-05 | DM-76 (school-scoped video) |
| API-GAME-08 | DM-77 (one reward catalogue), DM-78 (redeem and ticket idempotency) |
| API-AUTH-08, API-AUTH-09 | DM-80 (`users.aspiration`, `bio` 1000) |
| API-Q-19 | DM-82 (`question_reports.source`) |
| API-RPT-17 | DM-30 (`interventions.after_accuracy`) |
| API-ADM-14 | DM-81 (challenge type `combo`) |
| API-GUR-16 | DM-46 (`question_sets.education_level_id`) |
| API-Q-03, API-Q-14 | DM-69 (question types), DM-70 (stimulus kinds), DM-50 (bilingual twins) |

### 2.16 Limits that matter to R1

| Limit | Value | Source |
|---|---|---|
| `pageSize` | default 20, max 100 | `PageQuerySchema` |
| Bulk by id list | at most 64 ids | `QuestionBulkRequestSchema` |
| Bulk by filter | cap per run `FILTER_ACTION_CAP`; stale count = 409 | `QuestionFilterBulkRequestSchema` |
| Stimulus group | 1-3 stimuli, 0-40 members (R1: at least 1 to be placed) | `STIMULUS_LIMITS` |
| Student/CSV import | 2 MB (2,097,152 bytes), 1000 rows; `POST /api/admin/users/bulk-import` and `POST /api/admin/students/import` body limit 2 MB (raised from 1,100 kB, 40 E-11) | `STUDENT_IMPORT_MAX_BYTES` |
| Avatar-like image upload | 2 MB (jpeg, png, webp) | `files/schema.ts` |
| Question report reasons | 1-8 per report; daily cap 20 (OQ-API-06) | `question-workflow/reports.ts` |
| Practice `timeSpent` | at most 180 s per question | `practice/rules.ts` |
| Support ticket | subject 255, body 5000 | `support/schema.ts` |
| Performance reads | 120 per minute per user by default (`THROTTLE_PERFORMANCE_READ_PER_MINUTE`) | `performance.controllers.ts` |

---

### 2.17 Missing-Build shapes

All new request bodies are `z.strictObject` in `packages/contract/src/<area>/`, registered in `openapi.ts`. Responses are wrapped `{ data }` unless a list (`{ data, meta }`). All writes need `X-CSRF-Token`, are audited (actor, time, before/after summary; `common/audit`), and are rate limited. Copy in quotes is BM from the SRS; copy that has no V2, V1, code or SRS source is decided R1 copy (D113) and is built as written.

### 2.17.1 MUR

**API-MUR-02 `GET /api/me/profile-activity`** (M, own only; no user id parameter)

```ts
type ProfileActivity = {
  tiles: { coins: number; streakDays: number; level: number; practiceDays: number }
  calendar30d: { date: string /* YYYY-MM-DD, MYT */; answered: number }[]   // exactly 30, today last
  badges: { code: string; name: string; earnedAt: Timestamp }[]            // empty -> "Belum ada lencana lagi"
  recentSessions: {                                                         // max 10, newest first
    id: string; mode: PracticeMode; modeLabel: string /* BM, never snake_case */
    questions: number; correct: number; accuracy: number | null /* one decimal on the wire, shown as a whole number (4.6, D-T10-1) */; coins: number; at: Timestamp }[]
  publicProfilePath: string                                                 // '/pelajar/{id}'
}
```

Errors: `401`; any role other than `student` -> `403`. Sources: practice sessions (M05), wallet (M14), achievements (M14).

### 2.17.2 GUR

**API-GUR-03 `PUT /api/guru/classes/:id`** body = the create body of API-GUR-02 (`name` and `educationLevel` required; `subjectId` optional; `year`); `200 {data: TeacherClass}`; another teacher's class: `404`.

**API-GUR-06 `POST /api/guru/students`** (Cipta Pelajar)

```ts
body: { name: string /*1..255*/; classroomId: Id /*own class*/; ic?: string /*12 digits, optional*/ }
200/201: { data: { id: Id; name: string; username: string; message: string } }
// message = "Pelajar dicipta. Login: {username} / {kata laluan lalai}"; the default password is a configuration value
// (never a literal in code, docs, seeds or tests); the school and level come from the class.
errors: 422 fields (name required "Nama diperlukan.", classroomId must be an own class); 409 duplicate username in the school
```

**API-GUR-11 Misi Harian**

```ts
GET  /api/guru/missions            -> { data: Mission[] }           // own missions + platform ("Global") missions
POST /api/guru/missions            body: { title: string /*1..255*/; description?: string; targetQuestions: number /*1..1000, default 10*/;
                                           rewardCoins: number /*0..10000, default 10*/; date: 'YYYY-MM-DD' /*default today*/;
                                           classroomId?: Id | null /*null = all own classes*/ }
                                   -> 201 { data: Mission }        // UI message "Misi dicipta." [PRINCIPLE]
DELETE /api/guru/missions/:id      -> { data: { deleted: 1 } }     // only own missions; completed rewards stay; Global mission = 403
type Mission = { id: Id; title: string; description: string | null; targetQuestions: number; rewardCoins: number; date: string;
                 classroomId: Id | null; global: boolean; completedCount: number /* pupils of the teacher's classes */ }
```

Owner of the store: M05 daily missions (`classes/missions`). A pupil sees the mission on `GET /api/missions/today`. Reward (N-2): each correct answer pays the admin coin rate (default 1, D-A11) as in every mode; `rewardCoins` is paid once, when the pupil reaches `targetQuestions` (M05/M14). The code constant `MISSION_COINS_PER_CORRECT = 3` is removed (Fix: `apps/api/src/modules/practice/rules.ts:50,61`, `start.planner.ts:317`, `ports.ts:133`).

**API-GUR-16 Set Soalan (teacher)**

```ts
GET    /api/guru/question-sets                  -> { data: { sets: QuestionSetRow[]; counters: { published: number; draft: number; participation: number } } }
POST   /api/guru/question-sets                  body: { title: string; subjectId: Id; educationLevelId?: Id | null; questionIds: Id[] /* approved only, 1..N */;
                                                        classroomIds: Id[] /* explicit own classes; >= 1 to publish; DM-46 */;
                                                        status: 'draft' | 'published' }  -> 201 { data: QuestionSet }   // 422 fields.questionIds "Soalan dalam kumpulan rangsangan mesti dipilih bersama." when part of a stimulus group is sent
GET    /api/guru/question-sets/:id              -> { data: QuestionSet }
PUT    /api/guru/question-sets/:id              same body as POST -> { data: QuestionSet }
POST   /api/guru/question-sets/:id/status       body: { status: 'draft' | 'published' } ("Terbitkan" / "Jadikan Draf")
POST   /api/guru/question-sets/:id/copy         body: { classroomIds: Id[] /* own classes */ } -> 201 draft copy assigned to those classes
GET    /api/guru/question-sets/:id/results      -> { data: { rows: { pupil: string; attemptedAt: Timestamp; correct: number; total: number; accuracy: number /* one decimal on the wire, shown whole (4.6, D-T10-1) */ }[] } }  // newest first
DELETE /api/guru/question-sets/:id              -> { data: { deleted: 1 } }  // attempt records stay for Prestasi
```

Rules: only `approved` questions can be chosen (422 `fields.questionIds`); an archived question drops out at serve time; a published set is visible only to the pupils enrolled in one of its **explicitly selected classes** (`classroomIds`, DM-46; no "all my classes" default; a pupil of another class gets **404**, record outside scope, 1.7); only `draft` and `published` are offered (`scheduled` has no FR); the pupil session mode is `question_set`; each item is a **unit** (a group stays together, FR-X1-4e). Accuracy in `results` rows is `correct / total * 100` with one decimal on the wire (4.6, D-T10-1); the screen shows it rounded half up to a whole number; the colour is a UI rule on the wire value (>= 70 green, >= 50 amber).

**API-GUR-16 bank picker** (G; same predicate as API-GUR-27 and the pupil draw)

```ts
GET /api/guru/question-sets/bank?subjectId=&levelId=&q=&cursor=
-> { data: { units: { kind: 'question' | 'group'; id: Id; questionIds: Id[]; preview: string /* 120 characters + "..." */;
                      subject: string; level: string; difficulty: 1|2|3|4|5; stimulus: StimulusGroupPublic | null }[];
             nextCursor: string | null /* 50 units per call; the screen loads the next batch on scroll */ } }
```

`subjectId` and `levelId` are optional ("Semua"); `q` shorter than 2 characters answers `422` "Taip sekurang-kurangnya 2 aksara."; a group is one unit, never split (FR-X1-4e).

**API-GUR-21 `GET /api/guru/weekly-report?classroomId=&week=YYYY-MM-DD`** (G own classes)

```ts
type GuruWeeklyReport = {
  classroom: { id: Id; name: string }
  week: { from: string /* Monday */; to: string /* Sunday */; label: string /* "02 Nov 2026 — 08 Nov 2026" */ }
  summary: { answered: number; activePupils: number; improvedPupils: number; attentionSubjects: number }
  topPerformers: { rank: number; name: string; answered: number; accuracy: number }[]          // <= 5, answered >= 5, accuracy desc
  mostImproved: { name: string; previousAccuracy: number; accuracy: number; delta: number }[] // <= 5, active in both weeks, delta > 0
  attentionSubjects: { subject: string; accuracy: number; answered: number }[]                // weekly accuracy < 50, ascending
}
```

Rules: week = Monday 00:00 to Sunday 23:59 (MYT) of the week containing `week` (default: the current week); previous week = the 7 days before; accuracy (also `previousAccuracy`, `accuracy` of every list) = pooled correct / answered x 100, a number with one decimal on the wire (4.6, D-T10-1), shown as a whole number rounded half up; "Pelajar Aktif" = pupils with >= 1 answer (XS-2). Errors: another teacher's class `403` (AC-GUR-43-6); missing `classroomId` `422`; malformed `week` `422`. Pupil names are only those of the teacher's own class.

**API-GUR-22 teacher profile**: `PUT /api/account/teacher-profile` body `{ bio?: string; subjects?: Id[]; phone?: string }` -> `{data}`; `GET /api/public/teachers/:id` (public, same uniform-404 and time-floor pattern as `GET /api/public/students/:id`) -> `{ name, school?, subjects[], bio? }` with no e-mail or phone.

**API-GUR-24 personal questions (Soalan & Rujukan)**

```ts
type PersonalQuestion = { id: Id; subjectId: Id; subjectName: string; educationLevelId: Id /* Tingkatan 1-5, required */; difficulty: 1|2|3|4|5; text: string;
                          chapterId: Id | null /* Bab (D89) */; spIds: Id[] /* SP, 0..3 */; tp: number | null /* 1..6 */; cognitiveLevel: CognitiveLevel | null /* Aras */;
                          options: { text: string }[] /* exactly 4 */; correctIndex: 0|1|2|3; referenceUrl: string | null; createdAt: Timestamp }
GET    /api/guru/personal-questions        -> { data: PersonalQuestion[], meta }   // own only, newest first
POST   /api/guru/personal-questions        body = PersonalQuestion without id/subjectName/createdAt -> 201 { data: PersonalQuestion }
PUT    /api/guru/personal-questions/:id    same body -> { data: PersonalQuestion }
DELETE /api/guru/personal-questions/:id    -> { data: { deleted: 1 } }
```

Rules: `educationLevelId` is required and must be an active Tingkatan 1-5 (else `422 fields.educationLevelId` "Sila pilih tingkatan."); `subjectId` required (`422 fields.subjectId` "Sila pilih subjek."); `difficulty` required, separate from `tp` and never derived from it (`422 fields.difficulty` "Sila pilih kesukaran."). **DSKP fields (FR-GUR-44a-7, D112; same rules, ids and messages as 20 R1-GUR-44a and 44-F1):** `chapterId` is required only when the chosen Subjek + Tingkatan has chapters (`GET /api/guru/chapters`, API-GUR-08), else `422 fields.chapterId` "Sila pilih bab."; `spIds` (1 to 3 SP ids of that Bab, API-DSKP-07), `tp` (1 to 6) and `cognitiveLevel` are required only when DSKP nodes exist for that Subjek + Tingkatan, else `422 fields.spIds` "Sila pilih Standard Pembelajaran (SP).", `422 fields.tp` "Sila pilih TP." (a value outside 1 to 6: "Tahap Penguasaan (TP) mesti antara 1 dan 6."), `422 fields.cognitiveLevel` "Sila pilih aras pemikiran."; when none exist for the Subjek + Tingkatan the field is optional and, if sent, must belong to that Subjek + Tingkatan (else the same 422). Stored as in 44-F1 (`question_versions` chapter reference, `question_version_sp_nodes`, `difficulty_tp`, `cognitive_level`, `difficulty_level`). `referenceUrl` must start with `http://` or `https://` (else `422 fields.referenceUrl`, BM message; `javascript:` is refused); required fields give BM `422` messages (FR-GUR-44a-2); another teacher's id is `404`. Stored with `visibility = 'teacher_private'` (DM-42); every served-set predicate of the bank requires `visibility = 'bank'`, so the question never reaches Latih Tubi, Databank, Set Soalan pickers, Studio or the review queue. **API-GUR-25:** `GET /api/missions/today` adds `personalQuestionCount`; the mission draw may add the owning teacher's personal questions of the mission subject for the pupils of that teacher's classes only; a served item carries `referenceUrl` (the pupil screen opens it in a new tab with `rel="noopener noreferrer"`).

**API-GUR-26 teacher structured questions**: `GET /api/guru/structured-questions?subjectId&educationLevelId&status&page` -> `{ data: GuruStructuredRow[], meta }` (fixed 20 per page, newest first; `meta.totalItems` is the dataset count, FR-GUR-44b-1); row = {number, textExcerpt, level, subject, kbat, subCount, marks (sum of parts), status}; `GET .../:id` -> detail with the stimulus once above its sub-questions and the scheme (`Skema Jawapan`). Only approved questions are returned; a question that needs a diagram it lacks is not served (FR-X1-4f). Read-only: a teacher writes through API-GUR-17.

**API-GUR-27 teacher Databank**: `GET /api/guru/databank/overview` -> `{ totalQuestions, activeSubjects, teras: SubjectTile[], elektif: SubjectTile[] }` with `SubjectTile = { subjectId, nameMs, nameEn, count }`; every count is computed from the same predicate that pupils are served by (D11, D91; Tingkatan 1-5, approved, servable); `activeSubjects` = subjects with count > 0. `GET /api/guru/databank/questions?subjectId&q&page` -> `{ data: DatabankRow[], meta }` (20 per page, newest first; `q` searches the question text); a row with a figure or stimulus group returns the whole group as one unit. Personal questions (DM-42) and unapproved submissions are never returned.

**API-GUR-28 Kertas Peperiksaan**: `type KertasPeperiksaan = { id: Id; name: string; subjectId: Id; status: 'draf' | 'dikongsi'; questionIds: Id[]; classroomIds: Id[]; createdAt: Timestamp }`. `POST` {name, subjectId} creates a draft owned by the caller (empty name or no subject: `422` BM); `PUT` sets `questionIds` (approved only, a group stays together, FR-X1-4e); `POST .../share` makes it visible to the pupils of all the caller's classes (`status = 'dikongsi'`); `POST .../withdraw` returns it to draft. Another teacher's id is `404`.

### 2.17.3 AS and ADM

**API-AS-06 `POST /api/admin-sekolah/pelajar/import`** (AS; school forced from the session; `?dryRun=true` previews)

```ts
body (multipart `csvFile` or JSON { csvFile: string }) + { level: 'T1'|'T2'|'T3'|'T4'|'T5' }   // file <= 2 MB (STUDENT_IMPORT_MAX_BYTES = 2,097,152), <= 1000 rows; columns nama, email, kelas
200: { data: { dryRun: boolean; rows: number; created: number; skipped: number;
               errors: { row: number; message: string }[]; preview?: { row: number; name: string; email: string | null; className: string | null }[] } }
errors: 413 too large; 422 (no file, unknown level, header missing); 409 `QUOTA_FULL` "Kuota penuh! Sila tingkatkan kuota dahulu." when rows > remaining seats, where remaining seats = `school_subscriptions.student_quota` − pupils already in the school (active and pending); the **whole file is refused** and nothing is imported (D-A17, FR-AS-51-10; no partial import). A password set by an import, a create or a reset has at least **8 characters** (FR-ADM-U02.4, D-A17)
```

Only new accounts are created; existing accounts are not overwritten or deleted. Reuse the row validation of `POST /api/admin/students/import` (`subscriptions/quota.controller.ts`, contract `StudentImport*` in `packages/contract/src/schools/subscriptions/schema.ts`).

**API-ADM-05 `GET /api/admin/classes`** `?schoolId&level&teacherId&page&pageSize` -> `{ data: { id, name, level, teacher: {id, name}, school: {id, name}, pupils: number }[], meta }` (pupils = XS-1 for that class).

**API-ADM-09 Kawalan Ciri** (table `feature_flags`, DM-34)

```ts
GET /api/admin/feature-toggles          -> { data: { key: string; labelMs: string; audience: 'pelajar'|'guru'; enabled: boolean; locked: boolean }[] }
PUT /api/admin/feature-toggles/:key     body: { enabled: boolean } -> { data: FeatureToggle }   // audited (actor, key, old, new); effective on the next request (5 s cache)
```

Keys at R1: `permainan` (default ON) and `latih-tubi` (default ON), plus the V2 labels of R1-ADM-P2-19. A key with no row is ON (fail-open, FR-ADM-N06.4). `alesa` and `keluarga-angkat` are `locked`: the guard answers 404 for them whatever `enabled` says, and `PUT {enabled:true}` on a locked key is `409`. There is no key for Kertas Subjektif or the Subjektif lane (D104). Migration `0250_s0_feature_flags` (new file `feature-flags.prisma`).

**API-ADM-10 Tetapan Sokongan**

```ts
GET /api/admin/settings/support -> { data: { email: string; phone: string; whatsapp: string; hours: string } }   // '' = not set
PUT /api/admin/settings/support body: { email?: string|null /* e-mail format */; phone?: string|null /* digits */; whatsapp?: string|null; hours?: string|null /* each <= 120 (R1 decision D113) */ }
```

`GET /api/config/support` returns the same four values, `200` with empty strings when nothing is saved (DM-33).

**API-ADM-11 `GET /api/admin/dashboard`** -> `{ data: { questions: { total, byStatus: { draft, review, approved, archived }, thisWeek }, subjects: { total, active }, levels: number /* 5 */, users: { total, students, teachers }, battles: { total, active, finished } } }`; the question counts come from the **same query** as `GET /api/questions/summary` so "3 vs 0" cannot recur (FR-ADM-M01.1). Darjah never counted (FR-ADM-M01.3).

**API-ADM-12 `GET /api/admin/analytics`** `?range=7d|30d|90d` -> `{ data: { platform: { schools, activeSubscriptions, students, activeStudents, answered, accuracy /* one decimal, 4.6, D-T10-1 */ }, trend: { date, answered }[], topSchools: { school, answered }[], bank: { bySubject[], byLevel[], byStatus, dskpTaggedShare, chapterCoverage, servability: Record<activity, number> } } }`. Bank figures are computed, never stored (D11/D12).

**API-ADM-13 reports**: `GET /api/admin/reports/laporan?range` -> tiles and 14-day trend from practice sessions (same read model as the Guru Laporan so figures agree); `GET /api/admin/reports/executive?year` -> `{ year, schools: {total, active}, students: {registered, active}, engagement, answered, accuracy /* one decimal, 4.6, D-T10-1 */, teachers, answeredPerActivePupil }`. M-07 has no V2 reference (E-23): provisional.

**API-ADM-22 central views.** Reuses the response of the matching `/api/admin-sekolah/*` route with `?schoolId=<id>`; for `admin` the id is required (`422` `fields.schoolId` otherwise, `404` unknown school); for `school_admin` the id is ignored and the session school is used. Reads only; the write routes of `/admin-sekolah/*` stay `school_admin` only (Admin Pusat edits pupils and teachers through `/api/admin/users`).

### 2.17.4 Q and DSKP

**API-Q-25 `POST /api/intake/batches/:id/paper`** (AP, one transaction, audited)

```ts
body: { title?: string /* default: "{Subjek} Kertas {n} {tahun}" from the batch header */ }
201: { data: { paperId: Id; sections: { label: string; rule: 'semua' | 'pilih'; n: number | null; questions: number }[]; placements: number } }
409: an item of the batch is still 'pending'  ·  422: a placement would split a stimulus group  ·  200 (same body) when the draft for this batch and paper code already exists (update, not duplicate)
```

**Rules (R1 decision D113, round 3 and round 4).**
- **Paper code:** `paper_code` of the paper is `intake_batches.paper_code`, the `Kod kertas` typed at upload (45 U-09, DM-09); when none was typed it is `K{kertas}` (e.g. `K1`). It is never null for an imported paper (NOT NULL applies to papers with `source_batch_id` only). **One batch gives one paper**; the unique index of DM-45 is (`source_batch_id`, `paper_code`).
- **Bahagian to section:** one `paper_sections` row per distinct `question_versions.section_label` (DM-07: the Bahagian detected by the extractor or, when it found none, the one typed at upload) in order of first appearance; no label gives one section "Bahagian A". The section rule is copied from the Disahkan contract when one exists.
- **Re-call (idempotent):** a second call for the same batch returns `200` with the same paper and changes only by appending placements for questions accepted after the paper was created; it never changes the title, the sections, the order or any placement already there, so edits made in Set Builder are kept (a question the admin removed from the paper stays removed unless it was accepted again later). Once the paper is published (Terbit) the call answers `409`.
- **Groups:** a stimulus group is placed whole, contiguous and in group order in the section of its first member; members rejected in the batch are simply absent; the call answers `422` only when the accepted members of one group carry different section labels.

Effects: one draft `papers` row (`status` draft, `surface` simulasi, subject, Tingkatan, Kertas, year, `exam_board`, `paper_code`, `source_batch_id`, DM-45); the `paper_sections` rows above; `paper_placements` for the accepted questions in printed order with `numberLabel`; every stimulus group placed whole, contiguous, in group order, in one section (INV-14, INV-35). Only `approved` questions can be published later; the draft may hold drafts of questions.

**API-DSKP-10 `GET /api/admin/curriculum/chapter-coverage`** (AP): rows as in the catalogue; `withoutChapter` is the number the work-list "Soalan tanpa Bab" opens (API-Q-01 `chapter=none`).

**API-Q-12 flags and API-Q-13 work-list**

```ts
type StimulusFlag = 'stimulus_missing' | 'figure_only' | 'stem_duplicated'      // DM-05: stored on question_versions.stimulus_flag
// QuestionDetail.flags: StimulusFlag[]   (additive; empty = none)
// stimulus_missing: stem, an option or a part prompt names Rajah|Jadual|Graf|Petikan|Peta|Carta AND the question has no stimulus, no group and no image
// stem_duplicated: normalised stem equals the prompt of its only leaf
// stimulus_missing and figure_only: servability reason (not a status change), excluded from every pupil surface; the flag clears when a stimulus/group is attached or the
// admin dismisses it (a dismissal carries to the next version only while stem, options and part prompts are unchanged, OD-8).
// figure_only: the question holds nothing but a figure (a stimulus that was imported as a "question").
// stem_duplicated: shown once and fixed by the data clean-up DM-40; not excluded (OD-3 decided).
POST /api/admin/questions/:id/flags/dismiss  body: { flag: StimulusFlag } -> { data: { id, flags: StimulusFlag[] } }   // "Bukan masalah", audited
GET  /api/admin/questions/regroup-worklist   ?subjectId&educationLevelId&flag&page
  -> { data: { questionId: Id; numberLabel: string|null; stemExcerpt: string; subject: string; level: string; flag: StimulusFlag;
               paper: { title: string; year: number|null } | null }[],
       meta: ListMeta & { counts: { bySubject: Record<string, number>; byLevel: Record<string, number>; byFlag: Record<StimulusFlag, number> } } }
```

Both are Admin Pusat only. The same count feeds the `Perhatian` text of the Latih Tubi lane (FR-ADM-G7.5).

**API-Q-24 `POST /api/admin/questions/regroup`** (AP, one transaction, audited)

```ts
body (strict): { figureQuestionId?: Id           // a figure-only question to convert into the stimulus
                 stimulusId?: Id                  // OR an existing stimulus
                 stimulus?: StimulusCreateRequest // OR a new one
                 memberQuestionIds: Id[]          // 1..40, same subject, same kertas
                 label?: string | null }
200: { data: StimulusGroupDetail }                // the new group; figureQuestionId is archived with archive_reason 'regrouped' (DM-06)
errors: 404 unknown id; 409 a member is already in another group; 422 fields (no figure source, members of mixed subject)
```

**API-Q-23 source papers**: `GET /api/admin/source-papers` `?q&subjectId&year&source&page` -> rows {id, title, subject, year, source: 'intake'|'migrated', questions, batchId?}; `GET /api/admin/source-papers/:id` -> the paper and its questions with `Sunting di Studio` links. Read-only.

**API-DSKP-09 `POST /api/admin/curriculum/questions/bulk-chapter`** (AP)

```ts
body (strict): {
  chapterId: Id                                             // the Bab to set
  ids?: Id[]                                                // <= 64, OR
  filter?: QuestionFilter                                   // same as GET /api/questions; must contain subjectId and educationLevelId
  expectedCount?: number                                    // required unless dryRun, 409 if the live count differs
  dryRun?: boolean
  overwrite?: boolean                                       // default false: only questions with no Bab are set; true = "Tukar Bab sedia ada": questions that already have another Bab are changed too
}   // exactly one of ids or filter
200: { data: { matched: number; eligible: number; refused: number /* subject/level does not match the Bab */;
               applied: number; /* with overwrite false, a question that already has a Bab is counted in refused */ cap: number /* FILTER_ACTION_CAP */; remaining: number; capped: boolean; dryRun: boolean; auditId: Id | null } }
errors: 404 unknown chapter; 409 stale count; 422 filter without subject/level, or ids and filter together
```

Effects: sets `curriculumChapterId` only; with `overwrite: false` a question that already has a Bab is left unchanged and counted in `refused`; with `overwrite: true` it is changed (the checkbox "Tukar Bab sedia ada" of FR-ADM-C05, default off). No status change, no unit/SP/TP derivation (FR-ADM-C05.3); no keyword auto-mapping (D89, OQ-03). The UI line "{n} soalan akan dipautkan ke Bab {nama}" is (R1 copy, D113).

**API-Q-26 intake retry** (G own batch, AP)

```ts
POST /api/intake/files/:id/retry       body: none      // re-runs extraction for the failed pages of one file
POST /api/intake/batches/:id/retry     body: none      // re-runs every failed file of the batch
202: { data: { attempt: number /* 1..3 */; retriesLeft: number /* 0..2 */ } }
errors: 404 unknown id or another teacher's batch; 409 ERR-INT-11 on the 4th attempt of a file (retry_count = 3); 409 while the file is still being processed
```

`intake_files.retry_count` (DM-71) is incremented by 1 for every file a call re-runs, and `POST /api/intake/batches/:id/extract` with `pages[]` (API-Q-15, "Cuba lagi" on failed pages) increments it the same way: page, file and batch retries share the one limit of 3 per file. The page OCR limit (90 s, `OCR_TIMEOUT`) and the batch limit (15 min, `OCR_BATCH_TIMEOUT`) are separate settings and codes (ERR-INT-05). The batch status becomes `selesai_dengan_ralat` when some files stay failed after the retries.

**API-Q-30 `POST /api/questions/:id/parts/:partId/scheme/validate`** (AP). Body: the scheme v2 object of the part, exactly the field table of 45 section 7.0 (normative; DM-54 cites it): key kinds `option`, `options`, `mapping`, `accepted`, `points`, `rubric`; `points[]` with `accept`, `allOf`, `seen`, `implied`, `requires`, `notAccepted`, `unit`, `ecf`; `groups[]` with `pointIds`, `type`, `anyN`, `eachMarks`, `cap`; `bonus`, `alternatives[]`, `countMarks`, `finalAnswer`, `modelText`, `guidance`, `deductions`, `zeroIf`. The best-reachable-marks algorithm of 45 section 7.0 decides `SCHEME_SUM`. `guidance` is stripped from `scheme` in every pupil response. `200 { data: { ok: boolean; issues: { path: string; code: string; message: string; step: 1|2|3|4 }[] } }`, the same issue shape as API-Q-05 (`SCHEME_SUM`, `SCHEME_DEPENDS`, `BAND_RANGE`, `NO_SCHEME`, ...). Read-only; nothing is saved.

**API-Q-31..35 stimulus-group actions** (AP, all audited)

```ts
POST /api/stimulus-groups/:id/publish              body: none           -> StimulusGroupDetail; 409 CONFLICT "Semua soalan dalam kumpulan mesti dihantar untuk semakan dahulu." when any member is still Draf; 422 { error: { code: 'VALIDATION_ERROR', details: { gate: { questionId; message /* "Soalan {no}: {mesej}" */ }[] } } } and nothing changes
POST /api/stimulus-groups/:id/edit-as-draft        body: none           -> StimulusGroupDetail { draftOfGroupId }; 409 CONFLICT { details: { id } } when a draft exists
DELETE /api/stimulus-groups/:id/draft              body: none           -> 204
POST /api/stimulus-groups/:id/retire               body: { confirm: true } -> { data: { archived: number; affectedPapers: { id; title }[] } }; 422 when confirm is not true
POST /api/stimulus-groups/:id/members/:questionId/move   body: { toGroupId: Id } -> { data: { from: StimulusGroupDetail; to: StimulusGroupDetail } }; 409 "Soalan ini sudah berada dalam kumpulan rangsangan lain."; 422 "Soalan dalam satu kumpulan mesti sama subjek." / "...sama kertas."
POST /api/stimulus-groups/merge                    body: { fromGroupId: Id; intoGroupId: Id } -> StimulusGroupDetail; 422 when the merged group would hold more than 3 stimuli
```

A group with a served member is changed only through the draft copy (DM-51); `publish` on the copy swaps it in one transaction. Sittings in progress keep their pinned version.

**API-Q-36 `POST /api/admin/questions/regroup/:auditId/undo`** (AP). Body none. `200 { data: { restored: number } }` (membership, images, the archived figure-only question and the flags). `409` "Kumpulan telah diubah selepas kumpul semula; tidak boleh dibuat asal." after a later edit or publish of a draft copy; `404` unknown audit id. Audit payload rule: DM-59.

**API-Q-37 `POST /api/intake/stimuli/:id/accept-group`** (AP). Body (optional): `{ tags?: { unitId?; spIds?: Id[]; tp?; chapterId?; difficultyLevel? } }` applied to every pending member that has no value. `201 { data: { created: { itemId; questionId }[] } }`. `422` lists the failing members ("Soalan {no}: {mesej}") and creates none.

**API-Q-38 `POST /api/intake/stimuli/:id/merge`** (AP). Body `{ intoStimulusId: Id }`. `200` the review group (the two stimuli kept, members of both, at most 3 stimuli); `422` for a different batch.

**API-Q-39 JSU grid** (AP)

```ts
GET /api/admin/papers/:id/jsu                          -> { data: JsuGrid }   // actuals of this paper against its contract
GET /api/admin/blueprints/:subject/:kertas/jsu         -> { data: JsuGrid }   // the contract itself (required only; actual = null)
?format=csv                                            -> text/csv; charset=utf-8
type JsuGrid = { rows: { bahagian: string; tajukDskp: string; tp: number | null; kbat: boolean | null;
                         markah: { required: number; actual: number | null; ok: boolean | null } }[];
                 totals: { required: number; actual: number | null; ok: boolean | null } }
```

### 2.17.5 BIJAK and PRAC

**Answer log write path (D-A1, DM-44; not a route)**

```ts
interface AnswerLogPort {   // practice/ owns it (S5-T15); the only writer of practice_answers. THE one signature: 46 D-PA-1 and plan S5-T15 copy it verbatim
  record(entry: { userId, attemptId, questionId, partRef, mode, isCorrect, marksAwarded, marksMax, answeredAt, isTest }): Promise<{ id: string; created: boolean }>
}
// Types of the entry (same names, no other fields; identical in 46 D-PA-1 and plan S5-T15):
//   userId: Id; attemptId: string /* uuid of the activity instance: exam_attempts.id for a Bijak sitting, practice_sessions.id for a drill, battle uuid / game_rooms.session_id / solo session uuid / tournament_round_scores.attempt_id for a game */
//   questionId: Id; partRef: string | null /* leaf path of a structured or subjective part; `<game_key>#<position>` for battle and game; null for an MCQ elsewhere */
//   mode: 'latih_tubi'|'chapter'|'revision'|'remedial'|'databank'|'tracking_a'|'kuiz'|'simulasi'|'subjektif'|'structured'|'question_set'|'mission'|'pksk'|'audio_kbat'|'battle'|'game'
//         /* exactly the 16 writable values of the master table in 40 (OPT-MODE-SESI); `past_year`, `ramalan` and `random` are legacy and rejected on write (D-T10-2) */
//   isCorrect: boolean; marksAwarded: number | null; marksMax: number   /* R1 writes 1 for an MCQ (null only on legacy rows); a marked part is correct only when marksAwarded = marksMax */
//   answeredAt: Timestamp
//   isTest: boolean /* true when the actor is in "Mod Pelajar" (INV-30): the row is stored with is_test = true and excluded from every count; the caller sets it from the session, the port never infers it */
```

Idempotency key: (`attempt_id`, `user_id`, `question_id`, `part_ref`) with a null `part_ref` read as `''`; it is the unique index of DM-44. A second `record` with the same key updates the row (`created: false`), never adds one. For a drill session the port also writes `session_id` = `attemptId`. The port reads the served version of the question itself and copies subject, level, Bab and difficulty from it at write time. A caller with several rows (a Bijak submit, a Kuiz finish) calls `record` once per row inside its own transaction. Callers: practice sessions (check-answer), Bijak attempt submit and self-mark, structured/Subjektif attempts, Set Soalan sessions, games. Reports read this store only.

**API-BIJAK-13 Tracking A admin** (AP)

```ts
GET  /api/admin/spm/tracking-a ?subjectId&page   -> { data: TrackingARow[], meta: ListMeta & { items: number } }   // "Set objektif penuh dan lane bahasa. · 60 item"
POST /api/admin/spm/tracking-a                    body: { subjectId: Id; year: number; setNo: number } -> 201 { data: TrackingASet }   // "Tambah Set"
GET  /api/admin/spm/tracking-a/:id                -> { data: TrackingASet }
PUT  /api/admin/spm/tracking-a/:id                body: { items: { kind: 'question' | 'group'; id: Id }[] } -> { data: TrackingASet }  // one transaction
type TrackingASet = { id: Id; subject: string; year: number; setNo: number; kind: string; targetCount: number /* questions; a group counts as its members */;
                      filled: number; attention: string | null /* "set tidak lengkap" */; items: { kind; id; position; questions: number }[]; candidates?: number }
```

Rules: candidates are servable questions and groups only, figures and groups included (D105); a group is added, replaced or removed as one unit in group order; a question is not reused in a sibling set of the same subject/year; a group that does not fit the remaining slots is refused with a BM reason (FR-ADM-Q17.6).

**API-BIJAK-14 Kertas Subjektif admin** (AP; reuses the paper builder, DM-23)

```ts
// list:   GET  /api/admin/papers?surface=subjektif&subjectId&kertas=2|3|4&year&negeri&status&page
//         -> BijakBuilderPaperSummary[] + { surface: 'subjektif'; examBoard: string | null }, meta.counts = { total, published, withScheme }
// create: POST /api/admin/papers   body: BijakBuilderPaperCreate + { surface: 'subjektif'; examBoard?: string; year: number }   // created as 'draf'
// edit / read / delete / publish (Terbit) / withdraw (Sembunyikan): the existing /api/admin/papers/:id routes
// source: POST /api/admin/papers/:id/source   multipart { paper: PDF; skema?: PDF }  -> 202 { data: { batchId: Id } }   // intake batch (D81) of THAT paper: sets papers.source_batch_id = batchId (DM-45); figures become stimulus groups, text stays editable
//         409 while the paper's current source batch is still being processed; a later upload makes a new batch and replaces source_batch_id
// apply:  POST /api/admin/papers/:id/source   JSON { apply: true }  -> 201 { data: { placements: number } }   // after the batch items are decided: appends the groups and questions of the accepted items as placements of THAT paper (no new paper; API-Q-25 answers 422 for this batch), same section and group rules as API-Q-25, append-only; 409 while an item is pending
// publish refuses with 422 "“{title}” tiada kandungan — tidak boleh diterbitkan." (R1 copy, D113) until every question passes the completeness gate (QE-04);
// a question without a scheme is flagged "tiada skema — tidak disajikan" and the paper cannot be published (FR-ADM-Q18.8)
```

No feature flag (D104). `papers.surface` distinguishes the Simulasi lane from the Subjektif lane; existing papers are `simulasi` (DM-23). Pupil side: attempts via `/api/bijak/attempts` with self-mark (API-BIJAK-05).

**API-PRAC-08 `GET /api/practice/remedial-suggestions`** (M own)

```ts
{ data: { completed: { subject: string; before: number; after: number; delta: number; at: Timestamp }[];
          needed: { subjectCode: string; subjectName: string; accuracy: number /* one decimal, 4.6, D-T10-1 */; target: 60 }[];     // mean session accuracy < 60
          assigned: { id: Id; title: string; subject: string; status: string }[] } }                // = GET /remedial-tests/mine
```

The drill is `POST /api/practice/sessions { mode: 'remedial' | 'revision', subjectCode }` built from the pupil's wrong, still-servable questions, else the subject's weakest topics (FR-MUR-12-3).

### 2.17.6 RPT

**API-RPT-16 `PUT /api/headcounts/:id/defaults`** (G own config): body `{ defaultTov: number | null; defaultEtr: number | null }` (0..100) -> `{ data: PerformanceHeadcountDetail }`; an entry with a null `tov` or `etr` reads the default (DM-49).

**API-RPT-05 `GET /api/item-analysis/me`** (M, own attempts only; `?subjectCode&tapis`)

```ts
{ data: { tiles: { answered: number /* "Soalan Dijawab", answer rows (XS-4) */; needRemedial: number /* "Perlu Pemulihan" */;
                   needStrengthen: number /* "Perlu Pengukuhan" */; mastery: number | null /* "Tahap Penguasaan", pooled accuracy, one decimal on the wire */ };
          subjects: { code: string; name: string; attempts: number; uniqueQuestions: number; accuracy: number | null /* one decimal */;
                      wrongAnswers: number /* answer rows with is_correct false */; weakRepeated: number /* distinct questions in Pemulihan or Pengukuhan */; earlySignalWeak: number /* distinct questions in Isyarat Awal */ }[];     // ascending accuracy
          counts: { isyaratAwal: number; pemulihan: number; pengukuhan: number };
          items: { questionId: Id; category: 'isyarat_awal' | 'pemulihan' | 'pengukuhan'; attempts: number; correct: number; wrongTimes: number;
                   lastAnsweredAt: Timestamp; subject: string; chapter: string | null; source: string;
                   question: QuestionPublic /* no key, parts public */; stimulusGroup: StimulusGroupPublic | null;   // shown once per group
                   explanation: string | null }[] } }
```

Rules (FR-MUR-6-3): `isyarat_awal` = 1 attempt, 0 correct; `pemulihan` = at least 2 attempts, 0 correct; `pengukuhan` = at least 2 attempts and 0 < correct < attempts. `tapis` filters `items`: `ada_betul` keeps correct > 0, `selalu_salah` keeps correct = 0, `semua` keeps all (tiles and subjects ignore it). Archived questions are dropped; group members and figure questions carry their stimulus (FR-MUR-6-7); no school figures, no class lists (FR-MUR-6-8). Revision drill: `POST /practice/sessions {mode:'revision', subjectCode}`.

**API-RPT-08 headcount for the pupil**

```ts
GET /api/headcounts/me          -> { data: PerformanceHeadcountListItem[] }          // configs of the pupil's own classes, current session year
GET /api/headcounts/me/detail?configId=   -> { data: PerformanceHeadcountStudent }   // own AR, the teacher's TOV/ETR and RS; no classmate data; 'status' words "Active", "Draft", "On Track", "Below Target" stay as V2
```

`configId` (optional) picks one of the pupil's configs; omitted, the config last updated is used; a missing or foreign `configId` (not a config of the pupil's own classes) answers `404`. `GET /api/headcounts/students/:userId` stays staff-only; a pupil asking for any id other than the own gets `403` (FR-MUR-3-1). No create, delete or Auto-Setup is reachable by a pupil (AC-MUR-3-5): the existing routes keep their staff `@Roles`.

**API-RPT-10 headcount teacher writes** (G own config; AS and AP refused)

```ts
PUT /api/headcounts/:id/ar        body: { checkpoint: number /* OTR index 1..activeOtrs */; marks: { userId: Id; value: number | null /* 0..100 */ }[] }   // Key-in AR
PUT /api/headcounts/:id/tov       body: { rows: { userId: Id; tov?: number | null; etr?: number | null }[] }                                          // Edit TOV/ETR
PUT /api/headcounts/:id/settings  body: { mode?: 'auto' | 'manual'; activeOtrs?: 2|3|4|5; academicYear?: number }                                     // Tetapan, Auto/Manual rules
-> { data: PerformanceHeadcountDetail }
```

Validation: values 0..100 or null; unknown user = 422 `fields`; a dropped pupil is read-only; OTR/status/grade rules in `headcount.rules.ts` unchanged.

**API-RPT-17 `POST /api/kirkpatrick/interventions/:id/review`** (G own record, AS own school; AP refused)

```ts
body: none
200: { data: { id: Id; actionDate: string; afterAccuracy: number | null /* numeric(5,2): accuracy of the 14 days after the record */ } }
errors: 404 unknown id or out of scope; 409 "Semakan hanya boleh dibuat 7 hari selepas tarikh tindakan." before 7 days after action_date
```

Writes `interventions.after_accuracy` (DM-30); a repeat call recomputes it.

### 2.17.7 SUP (single reply, DM-32)

```ts
GET   /api/admin/tiket/:id          -> { data: { id; subject; body; status: SupportTicketStatus; roleLabel: string | null; school: string | null; createdAt;
                                                  adminReply: string | null; repliedAt: Timestamp | null } }
PUT   /api/admin/tiket/:id/reply    body: { text: string /*1..5000*/ } -> { data: ticket }      // sets admin_reply + replier + time; "Dibalas" = adminReply is not null; does NOT change the status; notifies the owner
PATCH /api/admin/tiket/:id/status   body: { status: SupportTicketStatus } -> { data: ticket }
```

Only Admin Pusat replies; no e-mail address is returned (role label from `created_role`, school from `school_id`; old rows with several roles show a dash). A second `PUT` replaces the reply. A reply thread is deferred (OD-4).

### 2.17.8 AUTH-16 FeatureGuard

```ts
// Declaration on a controller or handler
@Feature('permainan')      // /api/games/*, /api/battle/*, /api/papan-bijak/*, /api/leagues*, /api/tournament*  (when the switch is OFF)
@Feature('latih-tubi')     // POST /api/practice/sessions with mode latih_tubi, GET /api/spm/latih-tubi*, GET /api/practice/subjects*  (when OFF)
@Feature('alesa')          // /api/cikgu/*   (release-hidden: always OFF at R1)
@Feature('keluarga-angkat')// /api/mohon-keluarga-angkat   (release-hidden: always OFF at R1)
// Runtime: global guard registered BEFORE AuthGuard. Reads the flag map (cached a few seconds). Off or release-hidden -> ApiError.of('NOT_FOUND') for every caller.
// Test (S0-T04/S0-T10): for each hidden key, anonymous, each role -> 404 with body { error: { code: 'NOT_FOUND', message: 'Not Found.' } }.
```

### 2.17.9 GAME and ADM game admin (shapes from `48-game-and-gamification-spec.md`)

**API-GAME-11 `POST /api/gamification/challenges/:id/claim`** (M). Body `{ clientUuid?: string }`. `200 { data: { claimed: true; rewardSyiling: number; rewardXp: number } }`. `409` when already claimed that MYT day (unique `(user_id, challenge_id, myt_date)`, DM-63); `409` when the challenge is not completed. Credits once in one transaction (ledger source `challenge`, DM-79 `client_uuid`); a repeat with the same `clientUuid` returns the first result.

**API-GAME-12 tournament play** (M)

```ts
POST /api/tournaments/:uuid/register             body: {}                              -> { data: { registeredAt } }     // errors "Pendaftaran belum dibuka.", "Pendaftaran sudah ditutup.", "Anda sudah mendaftar.", "Tahap anda tidak layak untuk tournament ini."
POST /api/tournaments/:uuid/rounds/:n/start      body: {}                              -> { data: { attemptId: string /* tournament_round_scores.attempt_id */; questions: PracticeQuizQuestion[] /* 10 */; secondsPerQuestion: number } }   // "Pusingan belum dibuka.", "Pusingan sudah tamat.", "Anda sudah bermain pusingan ini."
POST /api/tournaments/:uuid/rounds/:n/answer     body: { questionId: Id; optionId: number } -> { data: { isCorrect: boolean; score: number } }   // writes practice_answers mode 'game', attempt_id = the round attemptId, part_ref 'tournament#<position>' (position 1..10 in the round; the round number n is carried by the attempt)
GET  /api/tournaments/:uuid/standings            -> { data: { rows: { rank; name /* first name only */; school?; score; correct; totalMs }[]; me: { rank; score } | null } }
```

**API-GAME-13 league standings** (M; staff read their own scope)

```ts
GET /api/leagues/:id/standings?level=            -> { data: { rows: { rank; schoolName; score; participants }[]; recomputedAt: Timestamp; frozen: boolean } }
GET /api/leagues/:id/me                          -> { data: { school: { rank; score; participants } | null; mine: { points: number } } }
```

**API-GAME-14 `POST /api/battle/queue/:queueId/cancel`** (M). Body none. `200 { data: { cancelled: true } }`; `404` for a queue entry of another pupil.

**API-ADM-23 spin segments** (AP)

```ts
GET /api/admin/games/spin-segments   -> { data: SpinSegment[] }                    // exactly 8
PUT /api/admin/games/spin-segments   body: { segments: SpinSegment[] /* exactly 8 */ } -> { data: SpinSegment[] }
type SpinSegment = { position: 1..8; label: string /* <= 20 */; syiling: number /* 0..100 */; weight: number /* integer */; active: boolean }
```

`422` "Jumlah berat mesti 100." when the weights do not total 100. Audited.

**API-ADM-24 draws** (AP)

```ts
PUT  /api/admin/reward-control/draws/:id                      body: draw body of 48 GAME-22 { title; ticketPrice; maxTickets; opensAt; closesAt; prizes[{ label; kind; amount; weight; stock? }] }  // draft only -> Draw
POST /api/admin/reward-control/draws/:id/cancel               body: none -> Draw { status: 'cancelled' }   // open or closed draw; every ticket is refunded
POST /api/admin/reward-control/draws/:id/winners/:winnerId/deliver   body: none -> Draw                    // marks the prize delivered
```

**API-ADM-25 tournaments and league enrolment** (AP only)

```ts
PUT  /api/tournaments/:uuid          body: tournament body { title; levelId; format: 'single_match' | 'league'; rounds?: 1..10; source; start; end; registrationClosesAt } -> Tournament   // before registration opens
POST /api/tournaments/:uuid/open     body: none -> Tournament { status: 'registration' }   // "Buka Pendaftaran"
POST /api/tournaments/:uuid/cancel   body: none -> Tournament { status: 'cancelled' }
POST /api/leagues/:id/schools        body: { schoolIds: Id[] } -> League                    // there is no Guru, Admin Sekolah or pupil route
```

---

## 3. Role-access matrix for the API

Columns are the four R1 roles: **Murid** (student), **Guru** (teacher), **Admin Sekolah** (school_admin), **Admin Pusat** (admin). The matrix is the **target** derived from the FRs (`docs/Matriks-Akses-Peranan.xlsx` via the three SRS parts). Where the code today differs, the row cites the API ID in section 2 and the difference is repeated in "Code today versus target" below. `ppd_officer`, `parent` and `sponsor` are outside the R1 matrix and get `403` on everything below unless the row says otherwise.

Legend: ✅ allowed · ❌ not allowed (`403`, or `404` when the feature is hidden or the record is out of scope) · ⚠️ allowed with a scope (the scope is in the note column).

| Endpoint group (API IDs) | Murid | Guru | Admin Sekolah | Admin Pusat | Scope note |
|---|---|---|---|---|---|
| Login, logout, session, role/mode switch (AUTH-01..05) | ✅ | ✅ | ✅ | ✅ | Public except session reads; CSRF on writes |
| Register, password reset, school search, public stats, `config/support`, articles, banners, video list (AUTH-06/07/13, SUP-04, MUR-05/06/07, ADM-04) | ✅ | ✅ | ✅ | ✅ | No session needed |
| Own account `/me`, settings, picture, notifications, gamification summary (AUTH-08..15) | ✅ | ✅ | ✅ | ✅ | Own record only |
| Hidden modules: Cikgu Alesa, Mohon Keluarga Angkat (AUTH-16, GUR-23, GAME-10) | ❌ | ❌ | ❌ | ❌ | `404` for everyone including anonymous |
| Pupil dashboard, profile activity, public profile read (MUR-01..03) | ✅ | ❌ | ❌ | ❌ | Own data; public profile read is anonymous (pupil first name only) |
| Kelas Saya (pupil) (MUR-04) | ✅ | ❌ | ❌ | ❌ | Teacher uses GUR-01..05 |
| Parent invite (pupil side) (MUR-09) | ✅ | ❌ | ❌ | ❌ | Delivery B |
| Practice: Latih Tubi, Soalan by Chapter, sessions, revision, Remedial, structured, PKSK, audio (PRAC-01..12) | ✅ | ⚠️ | ❌ | ❌ | Guru browses the shared Soalan by Chapter pages (FR-GUR-9); Admin Sekolah and Admin Pusat only in "Mod Pelajar" (AUTH-05) |
| Teacher remedial scan/generate, Command Center (GUR-12..14) | ❌ | ⚠️ | ⚠️ | ✅ | Guru own classes; Admin Sekolah own school (drill only) |
| Bijak SPM pupil: papers, contracts, attempts, kuiz, SPM hub, mocks (BIJAK-01, 02, 04..08; BIJAK-03 is admin-only and a pupil call answers 404) | ✅ | ❌ | ⚠️ | ⚠️ | Admin Sekolah and Admin Pusat only in "Mod Pelajar"; attempts are own only |
| Bijak admin: Kontrak, Set Builder, section pools, lanes, Tracking A, Kertas Subjektif (BIJAK-09..15) | ❌ | ❌ | ❌ | ✅ | |
| Questions admin: list, edit, bulk, stimuli, groups, Studio, servability, flags, work-list (Q-01..13, Q-18, Q-21, Q-23) | ❌ | ❌ | ❌ | ✅ | |
| Guru questions (Sumbang Soalan) and CSV import (GUR-18, GUR-19) | ❌ | ⚠️ | ❌ | ✅ | Guru: own questions; edit/delete only own pending |
| Guru personal questions and their Misi Harian serving (GUR-24, GUR-25) | ⚠️ | ⚠️ | ❌ | ❌ | Guru: own questions only (another id = 404); pupil: only questions of the own teacher's classes, only through Misi Harian |
| Guru tools: structured list, Databank, Kertas Peperiksaan, diagram upload (GUR-26, GUR-27, GUR-28, Q-21 list and upload) | ❌ | ⚠️ | ❌ | ✅ | Guru: read-only bank views; own papers only (another id = 404); diagram dismiss is Admin Pusat only |
| Paper submit and intake batches (GUR-17, Q-14, Q-15) | ❌ | ⚠️ | ❌ | ✅ | Guru: own batches (`source=guru`); admin: all |
| Question reports: create / own list (Q-19, Q-20 first part) | ✅ | ✅ | ❌ | ❌ | Only for a question the caller was served (FR-MUR-54-5) |
| Question reports: admin list and decision (Q-20 second part) | ❌ | ❌ | ❌ | ✅ | |
| Curriculum lists for pickers (DSKP-01), Guru DSKP lookups (DSKP-07) | ✅ | ✅ | ✅ | ✅ | Active Tingkatan 1-5 only for pupils |
| Curriculum admin, Bab mapping, DSKP studio lookups (DSKP-02..06, DSKP-09) | ❌ | ❌ | ❌ | ✅ | |
| Heatmap Topik Lemah (DSKP-08) | ✅ | ❌ | ❌ | ✅ | Pupil own data; admin read exists in code, no R1 admin screen |
| Prestasi 360 of one pupil (RPT-01) | ⚠️ | ⚠️ | ⚠️ | ✅ | Pupil: own id only; Guru: pupils of own classes; Admin Sekolah: pupils of own school |
| Prestasi school/level/class dashboards (RPT-02) | ❌ | ⚠️ | ⚠️ | ✅ | Guru own classes; Admin Sekolah own school. Pupil `403` (fix) |
| Analitik Adaptif own (RPT-03) | ✅ | ❌ | ❌ | ❌ | |
| Analitik Adaptif classes (RPT-04, AS-16) | ❌ | ⚠️ | ⚠️ | ✅ | Guru own classes; Admin Sekolah own school (fix) |
| Analisa Item own (RPT-05) | ✅ | ❌ | ❌ | ❌ | |
| Analisa Item school scope (RPT-06) | ❌ | ⚠️ | ⚠️ | ✅ | Pupil `403` (fix) |
| Analisa Item classes, teacher report (RPT-07) | ❌ | ⚠️ | ❌ | ✅ | Guru own classes |
| Headcount: pupil view (RPT-08) | ✅ | ❌ | ❌ | ❌ | Own only; another pupil's id = `403` |
| Headcount: read (RPT-09 reads, AS-15) | ❌ | ⚠️ | ⚠️ | ✅ | Guru own configs; Admin Sekolah school's classes, read only |
| Headcount: write (RPT-09 writes, RPT-10) | ❌ | ⚠️ | ❌ | ✅ | Guru own configs; Admin Sekolah refused |
| Kirkpatrick levels, PDF, interventions (RPT-11) | ❌ | ⚠️ | ⚠️ | ✅ | Forced to own school for Guru and Admin Sekolah; Admin Sekolah does not record interventions |
| Kirkpatrick own + feedback form (RPT-11 `me`, `feedback`) | ✅ | ✅ | ✅ | ✅ | Own |
| Kirkpatrick intervention review (RPT-17) | ❌ | ⚠️ | ⚠️ | ❌ | Guru own record; Admin Sekolah own school; refused before 7 days after the action date |
| Intake retry (Q-26) | ❌ | ⚠️ | ❌ | ✅ | Guru own batch; the 4th attempt per file is refused (ERR-INT-11) |
| Stimulus-group publish, draft copy, retire, move, merge, regroup undo, JSU (Q-30..Q-39 except intake) | ❌ | ❌ | ❌ | ✅ | Admin Pusat only, audited |
| Intake group accept and merge (Q-37, Q-38) | ❌ | ❌ | ❌ | ✅ | Admin Pusat only |
| Challenge claim, tournament play, league standings, Battle queue cancel (GAME-11..14) | ✅ | ❌ | ❌ | ❌ | Own; staff read league standings of the own scope only |
| Spin segments, draw edit/cancel/deliver, tournament edit/open/cancel, league enrolment (ADM-23..25) | ❌ | ❌ | ❌ | ✅ | Admin Pusat only; no Guru or Admin Sekolah route enrols a school
| Monitoring (RPT-12) | ❌ | ⚠️ | ⚠️ | ✅ | Guru and Admin Sekolah fixed to own school |
| Rankings / Kedudukan, leaderboard (RPT-13, GAME-06) | ✅ | ⚠️ | ⚠️ | ✅ | Names only inside the viewer's scope |
| Timeline Saya (RPT-14, RPT-15) | ✅ | ❌ | ❌ | ❌ | Own |
| Laporan Mingguan Guru (GUR-21) | ❌ | ⚠️ | ❌ | ❌ | Own classes; another class `403`. `GET /api/weekly-report` stays `403` for every role |
| Teacher classes, pupils, Misi Harian, Set Soalan (GUR-01..06, GUR-11, GUR-16) | ❌ | ⚠️ | ❌ | ❌ | Own classes/sets. Admin Pusat manages the same data through `/api/admin/*` |
| Teacher dashboard, contributions, chapters (GUR-07..09) | ❌ | ⚠️ | ❌ | ❌ | |
| Teacher profile write, public teacher card read (GUR-22) | ❌ | ⚠️ | ❌ | ❌ | Write own; card read is public |
| School-admin portal: dashboard, pupils, teachers, usage, reports, DSKP heatmap, classes (AS-01, AS-04..12) | ❌ | ❌ | ⚠️ | ⚠️ | Admin Sekolah own school (other school id = `404`); Admin Pusat read-only via `?schoolId=` (ADM-22) |
| Pupil import by Admin Sekolah (AS-06) | ❌ | ❌ | ⚠️ | ❌ | Own school; Admin Pusat uses `POST /api/admin/students/import` |
| Amaran Awal (AS-13) | ❌ | ⚠️ | ⚠️ | ✅ | Admin Sekolah own school. Code also lets Guru in (see OQ-API-09); export is Admin Sekolah and Admin Pusat only |
| Sekolah Bersaing (AS-14) | ⚠️ | ⚠️ | ✅ | ✅ | Matrix row 45 is Admin Sekolah; code allows any signed-in role (OQ-API-09) |
| Command Center board (AS-02, AS-03) | ❌ | ❌ | ⚠️ | ✅ | Admin Sekolah own school |
| Admin users, schools, subscriptions, comp students, classes (ADM-01..06) | ❌ | ❌ | ⚠️ | ✅ | Admin Sekolah may use `/api/admin/users*` and `/api/admin/teachers*` for the own school; the rest is Admin Pusat only |
| Content admin: articles, banners, notes, screenshots, games settings (ADM-07, ADM-08) | ❌ | ❌ | ❌ | ✅ | |
| Feature toggles, support settings, dashboard, analytics, reports, server status (ADM-09..13, ADM-21) | ❌ | ❌ | ❌ | ✅ | |
| Perutusan: read | ✅ | ✅ | ✅ | ✅ | |
| Perutusan: compose (MUR-08) | ❌ | ❌ | ⚠️ | ✅ | Admin Sekolah to own school |
| Gamification, shop, reward-control, tournaments, PKSK, marketplace admin (ADM-14..19) | ❌ | ❌ | ❌ | ✅ | |
| Games, battle, wallet, shop, marketplace: pupil use (GAME-01..05, 07, 08) | ✅ | ❌ | ❌ | ❌ | Behind the `permainan` switch where it applies |
| Support tickets: create and own list (SUP-01, SUP-02) | ✅ | ✅ | ✅ | ✅ | Own |
| Support tickets: queue, detail, reply, status (SUP-03, SUP-05) | ❌ | ❌ | ❌ | ✅ | |
| Files: upload / download / delete (FILE-01..03) | ⚠️ | ⚠️ | ⚠️ | ✅ | By `purpose` (avatar, bijak_photo, timeline_photo for pupils; question_image and audio for staff). The per-purpose role rule is in `files.service.ts` and was not verified here |

### ALLOWED

- **Murid:** everything in the pupil-facing groups on own data only: practice, Bijak SPM, Prestasi 360 (own id), Analitik own, Analisa Item own, Headcount own (after API-RPT-08), Timeline own, Remedial, Heatmap, Laporan Soalan (create and own list), games, wallet, shop, tickets, notifications.
- **Guru:** the teacher groups on own classes and own questions, plus the shared school-level reads that the SRS gives to Guru (Monitoring, Kirkpatrick, Prestasi, Analitik classes, Analisa Item classes, Headcount) limited to the own school and classes.
- **Admin Sekolah:** the `/api/admin-sekolah/*` family and the school-wide reports for the own school, Command Center board, Sekolah Bersaing, Kirkpatrick levels, Monitoring, perutusan compose for the own school.
- **Admin Pusat:** every admin route; read of school-admin reports for any school (after API-ADM-22); the content, question, curriculum, Bijak, user, school, gamification and support administration.

### SCOPED (⚠️)

- School-scoped roles are **forced** to the school in the session scope: a `schoolId`, `state` or `level` query that names another school is ignored or answered `404`.
- Guru sees pupils only through own classes (`teaches`); a class of another teacher is `404` (or `403` where the SRS fixes it: weekly report).
- "Mod Pelajar" (`POST /api/session/mode`) lets Admin Sekolah and Admin Pusat try pupil features. Data created in that mode is marked test and excluded from pupil statistics.

### NOT ALLOWED (❌)

- A pupil never reaches school-wide data (`/api/performance/school|levels|classes`, `/api/item-analysis/school`): `403` (FR-X4-4, AC-MUR-6-5). A pupil never sees another pupil's record: `404` (Prestasi, AC-MUR-4-2) or `403` (Headcount, FR-MUR-3-1).
- Guru never reaches admin routes (`/api/admin/*`, `/api/questions`, `/api/stimuli*`, `/api/bijak/*` pupil sittings).
- Admin Sekolah never reaches another school, and never writes Headcount, Kirkpatrick interventions or questions.
- Nobody reaches a hidden module: `404`.

### Important notes

- **404 vs 403 rule for hidden features (FR-X2-2, D108-6).** Off or release-hidden feature: `404 NOT_FOUND` for every caller, before authentication (API-AUTH-16). On but not for your role: `403 FORBIDDEN`. Record outside your scope: `404` unless the SRS names `403` for that route. The front end shows its standard "Halaman Tidak Dijumpai" page on 404.
- A menu item must never lead to a `403` (FR-X2-3): where the table says ❌ for a role, that role has no sidebar entry for it.

### Code today versus target (each is an `Exists-Fix` row)

| Route group | Code today | Target | Row |
|---|---|---|---|
| `GET /api/performance/school`, `/levels`, `/levels/:code`, `/classes`, `/classes/:id` | no `@Roles`; a pupil receives cohort-gated school aggregates | `@Roles('teacher','school_admin','admin')` | API-RPT-02 |
| `GET /api/item-analysis/school`, `/school/:schoolId` | `student` listed | remove `student` | API-RPT-06 |
| `GET /api/analytics/classes` | `admin`, `teacher` | add `school_admin` (school forced) | API-RPT-04 |
| `/api/headcounts*` | `admin`, `teacher`, `school_admin` (including writes); a pupil gets `403` | pupil own routes; AS read-only | API-RPT-08, RPT-09 |
| `/api/cikgu/*`, `POST /api/mohon-keluarga-angkat` | reachable by any signed-in role | `404` for all | API-AUTH-16 |
| `GET /api/weekly-report` | always `403` | unchanged; teacher report is `GET /api/guru/weekly-report` | API-GUR-21 |
| `/api/admin-sekolah/*` | `school_admin` only | Admin Pusat read via `?schoolId=` | API-ADM-22 |
| `GET /api/amaran/*` | `admin`, `school_admin`, `teacher` | Guru stays, scope forced to own classes (OQ-API-09 decided) | API-AS-13 |
| `GET /api/sekolah-bersaing` | any signed-in | Admin Sekolah and Admin Pusat only (OQ-API-09 decided) | API-AS-14 |
| `GET /api/buku-nota/heatmap` | `student`, `admin` | unchanged | API-DSKP-08 |

---

## 4. Key payload schemas

Type notation is TypeScript, field-compatible with the zod schemas. `// ADD` marks a field or route that does not exist yet (additive, optional, no breaking change). `Id` = `IdSchema`, `Timestamp` = `TimestampSchema` (`packages/contract/src/common/`).

### 4.1 Question with its stimulus group and DSKP tags

Existing: `packages/contract/src/questions/schema.ts` (`QuestionSchema:205`, `QuestionDetailSchema:285`, `QuestionCreateRequestSchema:389`), `parts.ts` (`QuestionStimulusSchema`, `QuestionStimulusGroupSchema:281`, `QuestionCurriculumTagSchema:245`, cognitive levels), `stimuli.ts` (`StimulusSchema`, `StimulusGroupCreateRequestSchema`, `StimulusGroupDetailSchema`), `gate.ts` (`QuestionGateCheckSchema`). Pupil projection: `QuestionPublicSchema:728`, `QuestionPublicPartSchema`.

```ts
// Admin / editor view: GET /api/questions/:id  (QuestionDetail)
type QuestionDetail = {
  id: Id
  subjectId: Id | null; educationLevelId: Id | null          // Tingkatan 1-5 only for pupils (D96)
  questionType: QuestionType                                  // 11 types (DM-69, OPT-JENIS-SOALAN of 40): mcq, mcq_multi, true_false, match, short_answer, fill_blank, structured, working, essay, drawing, table_fill (short_text and numeric are leaf modes, not types)
  questionText: string                                        // the stem; text shown ONCE (a leaf prompt equal to it is flagged stem_duplicated)
  questionImage: string | null                                // file token of a stem image
  options: string[] | null; correctAnswer: 0|1|2|3 | null     // flat MCQ; `parts` carries every other mode
  pointsValue: number; kertas: '1'|'2'|'3'|'4' | null; numberLabel: string | null
  status: 'draft'|'review'|'approved'|'archived'
  language: 'ms'|'en'|'ms+en'                                 // DM-50; stored values (OPT-BAHASA); an input 'bm' is accepted and stored as 'ms'
  modeConfig?: Record<string, unknown>                        // per part, in `parts[].modeConfig` (DM-55: maxWords, wordRange, hardLimit, answerSpace, alternatives, answerTemplate, dependsOnPart, preFill, multi, grid, drawingKind, example)
  schemeRules?: unknown | null                                // question-level deductions and zeroIf (DM-54)
  textbookRef?: { bab: string; tingkatan: number; mukaSurat: number; hingga?: number } | null   // DM-56
  rejectionReason?: string | null                             // 5..500 characters, cleared on the next send for review (DM-58)
  parts?: QuestionPart[]                                      // tree, max depth 3, leaf per answer mode; leaf has marks, key, cognitiveLevel, kbat, unitNodeId, difficultyTp
  // --- DSKP tags (Bab / Unit / SP / TP / aras) ---
  tag?: { unitId: Id | null; spIds: Id[] /* <= 3 */; tp: number | null /* 1..6 */ }
  dskpSpId: Id | null                                         // flat-question SP
  curriculumChapterId: Id | null; curriculumTopicId: Id | null; chapterLabel: string | null   // Bab (D89)
  kbat?: 'mengaplikasi'|'menganalisis'|'menilai'|'mencipta' | null; tagReview?: boolean
  dskp: { bidang: {id; code; name}; sk: {id; code; description}; sp: {id; code; description} } | null
  dskpStatus?: { complete: boolean; issues: { path: string; code: string; message: string; step: 1|2|3|4 }[] }
  chapter?: { id: Id; number: number; name: string } | null  // ADD: structured Bab for Soalan by Chapter and the work-list
  flags?: ('stimulus_missing' | 'figure_only' | 'stem_duplicated')[]   // ADD (API-Q-12, DM-05)
  // --- stimulus group: a stimulus is NEVER a question and carries no marks (D90) ---
  stimulusGroup?: {
    id: Id
    stimuli: { id: Id; kind: 'passage'|'image'|'diagram'|'table'|'map'|'infographic'|'graph'; label: string /* "Rajah 3" */
               body: RichText | null; bodyEn?: RichText | null; imageId: Id | null; alt: string | null; caption?: string | null; captionEn?: string | null   // DM-50
               sourceCitation?: string | null; tableData?: { head: string[]; rows: string[][] } | null }[]   // 1..3
    optionBank?: { label: 'A'|'B'|'C'|'D'|'E'|'F'|'G'|'H'; body: RichText /* {ms, en?} */; imageId?: Id | null; isDistractor?: boolean }[]   // BI match_letter bank, stored once (DM-50, DM-52)
    questionIds: Id[]                                           // 1..40 members in published order; 1 is valid (D108-1)
  } | null
  placements?: QuestionPlacement[]; generatedPaperCount?: number
  createdBy: { id: Id; name: string | null }; createdAt: Timestamp; updatedAt: Timestamp
}

// Create / update: POST /api/questions, PUT /api/questions/:id  (strict; images by uploaded file id)
type QuestionCreateRequest = {
  questionType: QuestionType; subjectId: Id; educationLevelId: Id; difficultyLevel: 1|2|3|4|5; questionText: string /* >= 10 */
  parts?: QuestionPart[]; tag?: { unitId; spIds; tp }; dskpSpId?: Id | ''; curriculumChapterId?: Id | ''; kertas?: '1'|'2'|'3'|'4' | null
  numberLabel?: string | null; cognitiveLevel?: CognitiveLevel | null
  stimulusGroupId?: Id | null                                  // join a group (the group exists first, D93)
  language?: 'ms'|'en'|'ms+en' /* input 'bm' accepted, stored as 'ms' */; modeConfig?: Record<string, unknown>; schemeRules?: unknown | null
  textbookRef?: { bab: string; tingkatan: number; mukaSurat: number; hingga?: number } | null; rejectionReason?: string | null   // same optional fields as QuestionDetail (DM-50, DM-54, DM-55, DM-56, DM-58); owning cards S1-T01, S1-T09a
  questionImageFileId?: Id | null; optionImageFileIds?: (Id | null)[]; status?: 'draft'          // 'approved' only via POST /questions/:id/status
}

// Group first, then its questions (D93): POST /api/stimulus-groups  (StimulusGroupCreateRequest)
type StimulusGroupCreateRequest = { label?: string | null; scope?: 'section'|'paper'; subjectId: Id; educationLevelId: Id; kertas?: 1|2|3|4 /* stored on the group row, DM-51 */; stimulusIds: Id[] /* 1..3 */; questionIds?: Id[] /* 0..40 */; optionBank?: { label: 'A'|'B'|'C'|'D'|'E'|'F'|'G'|'H'; body: RichText /* {ms, en?} */; imageId?: Id | null; isDistractor?: boolean }[] /* same shape as QuestionDetail.stimulusGroup.optionBank (DM-50, DM-52) */ }
// Add a 2nd, 3rd question without re-uploading the figure: POST /api/stimulus-groups/:id/members {questionId}  or  PUT .../members {questionIds[]}  or  POST .../:id/questions

// Completeness: GET /api/questions/:id/gate-check?gate=approve  -> QuestionGateCheck
type QuestionGateCheck = { gate: 'submit'|'approve'; ok: boolean; issues: { path: string; code: string; message: string; step: 1|2|3|4 }[] }

// Pupil projection (Latih Tubi, Soalan by Chapter, Databank, games): today PracticeQuizQuestion has only id, questionText, options.
type PracticeQuizQuestion = {
  id: Id; questionText: string; textDirection: 'ltr'|'rtl'; scriptType: ScriptType; wrongTimes: number; hasDskp: boolean
  contributor: { name: string; profileUrl: string | null } | null; options: { id: number; label: string; text: string }[]
  stimulusGroup?: { id: Id; stimuli: Stimulus[] /* shown once above its questions */; from: number; to: number; questionIds: Id[] }   // ADD (D105)
  parts?: QuestionPublicPart[]                               // ADD: no keys, for non-MCQ leaves
}
```

Rules that every producer of this shape keeps: a group is one unit and is served whole or not at all; a question that is a member never appears without its `stimulusGroup`; the stimulus is shown once; counts exclude stimuli (FR-X1-4a, FR-X1-4e, FR-ADM-QE1.5).

### 4.2 Paper and blueprint (Bijak SPM)

Existing: `packages/contract/src/bijak/papers/schema.ts` (`BijakPaperSummarySchema:103`, `BijakPaperCoverSchema:143`, `BijakBlueprintContractSchema:183`, `BijakGenerateRequestSchema:204`), `bijak/builder/schema.ts` (`BijakBuilderPaperSchema:356`, `BijakBuilderPaperSectionSchema:313`, `BijakBuilderSectionRuleSchema:258`, `BijakBlueprintAdminCreateSchema:958`, `BijakBuilderPublishRequestSchema:716`), `bijak/standards/schema.ts` (quota, difficulty profile, allowed modes, verification).

```ts
// Pupil list row: GET /api/bijak/papers
type BijakPaperSummary = { id: Id; title: string; subject: string; subjectName: string; kertas: 1|2|3|4; year: number; code: string /* "1449/2" */
  durationMin: number; questionCount: number; marks: number /* derived, choose-N counts the N largest */
  kind: 'pilihan'|'jana'; status: 'belum'|'sedang'|'selesai'; lastScore?: { score: number; max: number }; attemptId?: Id }
// Contract the pupil can generate from: GET /api/bijak/contracts  (only a Disahkan version has canGenerate = true)
type BijakBlueprintContract = { subject: string; subjectName: string; kertas: number; source: BlueprintSource; code: string; durationMin: number
  sections: { label: string; take: number /* a group counts with all its questions */ }[]; canGenerate: boolean; unavailableReason?: 'NO_BLUEPRINT' }
// Admin paper: GET /api/admin/papers/:id
type BijakBuilderPaper = { id: Id; title: string; subject: string; kertas: number; year: number; code: string; durationMin: number
  instructions: string[]; reference?: ReferencePanel[]
  sections: { id: Id; label: string; title?: string; markBudget: number; questionCount: number; compulsory?: boolean; instruction?: string
              rule: { type: 'all' } | { type: 'choose'; n: number }        // "Jawab Semua" / "Pilih N"
              questionIds: Id[]; numberLabels?: Record<Id, string>; adminCreated?: true }[]
  status: 'draf'|'terbit'; createdAt: Timestamp; updatedAt: Timestamp; publishedAt?: Timestamp }
// Terbit: POST /api/admin/papers/:id/publish   body { override?: boolean; reason?: string /* >= 5 chars when override */ }
// Kontrak (blueprint) create: POST /api/admin/blueprints  (BijakBlueprintAdminCreate: subject, kertas, sections with quotas per Unit/TP/KBAT, difficulty profile, allowed modes)
//   Disahkan: POST /api/admin/blueprints/:subject/:kertas/verify  (refuses with a list of failed checks, for example NO_QUOTA, NO_KBAT)
// Jana set (target): POST /api/admin/papers/generate  { subject, kertas, title?, year?, negeri?, count? }   // year, negeri, count ADD
// Pupil sitting view: GET /api/bijak/attempts/:id -> BijakAttemptPaperView
type BijakAttemptPaperView = { serverNow: Timestamp; attempt: BijakAttemptMeta; sections: BijakAttemptSection[]
  questions: BijakAttemptQuestion[]
  groups: { id: Id; stimulus: Stimulus; stimuli?: Stimulus[] /* 1..3, shown once */; from: number; to: number; questionIds: Id[] }[]
  checks: BijakAttemptQuestionResult[] }
```

### 4.3 Practice attempt

Existing: `packages/contract/src/practice/schema.ts` (`StartSessionRequestSchema:96`, `StartSessionResponseSchema:149`, `CheckAnswerRequestSchema:173`, `SubmitSessionRequestSchema:197`), `bijak/attempts/schema.ts` (start `205`, save `170`, self-mark `640`).

```ts
// Latih Tubi / Soalan by Chapter / Remedial / question set:  POST /api/practice/sessions
type StartSessionRequest = { mode: 'chapter'|'revision'|'latih_tubi'|'mission'|'remedial'|'question_set'|'pksk'|'databank'|'tracking_a'  // 'random', 'past_year' and 'ramalan' are legacy, never written (D-T10-2); 'kuiz' is not started here (API-BIJAK-06, D-T10-3)
  subjectCode?: string; levelId?: Id | null          // T1..T5 (T4/T5 only today: API-PRAC-01)
  difficulty?: 1..5 | null; count?: number            // random/chapter 5|10|15|20; revision 20; latih_tubi per subject target
  chapterId?: number | string; year?: number; setNo?: number; targetQuestionId?: Id | null /* "Buka Soalan Sama", count 1 */
  missionId?: ..; remedialTestId?: ..; questionSetId?: ..; clientUuid?: string /* idempotency key */ }
type StartSessionResponse = { sessionId: string /* uuid */; mode: PracticeMode; subject: { code: string; name: string; color: string } | null
  chapter?: { id: Id; number: number | null; name: string | null }; questions: PracticeQuizQuestion[] /* see 4.1 */
  revisionMeta?: { selected: number; totalWrong: number }; timeLimitSec?: number | null }
// Per answer (MCQ):  POST /api/practice/sessions/:id/check-answer  { questionId: Id; selectedOptionId: number }
//   -> { isCorrect: boolean; correctOptionId: number; feedback: string /* BM */; explanation: string | null }
// question_set sessions may also send selectedOptionIds: number[] and receive correctOptionIds: number[] (API-PRAC-02); Kuiz check calls do the same (API-BIJAK-06)
// Finish:  POST /api/practice/sessions/:id/submit  { timeSpent?: ... }  (cap 180 s per question)  -> SubmitSessionResponse (score + coins + XP)
// Errors:  422 PracticeErrorCode (unknown mode, too few servable questions: a BM message, never an empty session)

// Bijak SPM sitting (own attempt)
type BijakAttemptStartRequest = { paperId: Id; mode: 'exam'|'latihan'; restart?: boolean }   // 201 new / 200 existing -> { attemptId }
// Save:   PUT  /api/bijak/attempts/:id/answers   (BijakAttemptSavePayload: changes per part, autosave)
// Submit: POST /api/bijak/attempts/:id/submit    -> BijakAttemptSubmitResult
// Self-mark (structured / subjective, scheme revealed after submit):
type BijakAttemptSelfMarkRequest = { partId: Id; mark: number /* clamped to 0..part marks */; band?: string /* rubric parts */ }
// -> { partId: Id; awarded: number; max: number; band?: string; totals }  (best-N applied)
```

### 4.4 Ticket

Existing: `packages/contract/src/support/schema.ts`.

```ts
type SupportTicketStatus = 'dibuka'|'dalam_proses'|'menunggu_balas'|'selesai'|'ditutup'      // labels: Dibuka, Dalam Proses, Menunggu Balas, Selesai, Ditutup
type SupportTicket = { id: Id; subject: string; body: string; status: SupportTicketStatus; statusLabel: string
  adminReply: string | null /* ADD behaviour: set by API-SUP-05, today always null */; createdAt: Timestamp }
type SupportTicketCreateRequest = { subject: string /* 1..255 */; body: string /* 1..5000 */ }       // strict: userId or any extra key = 422
// Owner:  GET /api/tiket?status=   POST /api/tiket (201)
// Admin:  GET /api/admin/tiket?status=&role=&page=  -> { data: SupportQueueRow[], meta: { total, counts } }
type SupportQueueRow = { id: Id; createdAt: Timestamp; userName: string | null; subject: string; status: SupportTicketStatus; replied: boolean
  roleLabel?: string; school?: string | null /* ADD (FR-ADM-P2-20.1): user shown by role label and school, never by e-mail */ }
// ADD (OD-4: ONE admin reply, the pupil cannot reply; no thread): GET /api/admin/tiket/:id (detail with the single reply), PUT /api/admin/tiket/:id/reply {text}, PATCH /api/admin/tiket/:id/status {status}
// Support contact: GET /api/config/support -> { email|null, phone|null, whatsapp|null, hours|null }  (200 always)
```

### 4.5 Shared shapes

```ts
type ListMeta = { page: number; pageSize: number; totalItems: number; totalPages: number; from: number | null; to: number | null; counts?: Record<string, number> }
type ErrorBody = { error: { code: string; message: string; fields?: Record<string, string>; details?: Record<string, unknown>; retryAfter?: number; requestId?: string } }
```

### 4.6 Field rules that make one number and one name (D-A10, D-A12, D-A6)

**Display name (D-A12).** Any pupil other than the viewer is shown by **first given name only**, no initial (for example "Aisyah"), **never a school** (D113). This applies to Kelas Saya, Kedudukan, Papan Pendahulu, game rooms, tournaments and `GET /api/public/students/:id`. Full name goes only to the pupil, the class teacher, the school admin of the school and Admin Pusat. A projection that cannot prove the viewer's scope returns the display name and `school: null`.

**Metric fields (one computation, one precision).** The authoritative list is 40 FR-X4 (counts) and 50 section 5.3 (XS-1..7); the wire types are:

| Field | Type | Computation | Precision |
|---|---|---|---|
| `ketepatan` (Ketepatan, accuracy; JSON name `accuracy` in every report, practice and leaderboard payload) | number or null, **one decimal on the wire** (for example `66.7`) | pooled `correct / answered * 100` (XS-5, never a mean of session values), rounded half up to one decimal at the API; `null` with 0 answers; never above 100 | every screen shows the whole number, rounded half up from the one-decimal wire value (40 FR-X4-5); only the manual Headcount AR screen may show one decimal; counts stay available so a class value is pooled from counts. Decision D-T10-1 (R1 decision D113): this rule applies to **every** `accuracy`, `ketepatan`, `previousAccuracy`, `afterAccuracy` and per-chapter/per-subject accuracy field in 60, with no exception; an API row that names an accuracy field points here |
| `skorPurata` (Skor Purata) | integer or null | mean of per-session accuracy; a different, separately named measure | whole-number percent |
| `soalanDijawab` | integer | count of `practice_answers` rows, all modes (XS-4) | integer |
| `soalanDiuji` | integer | **distinct** `question_id` answered (XS-7), not answer rows | integer |
| `pelajarAktif` | integer | distinct pupils with an answer in the window (XS-2) | integer |
| `ar`, `tov`, `etr`, `otr` (Headcount) | number or null | HC-SPEC in 20 R1-GUR-3 (Auto AR integer; Manual AR 1 decimal) | as the spec; grade band on the value rounded to a whole number |

**Difficulty (D-A6).** TP (1..6) and `difficultyLevel` (1..5) are two fields (DM-47). The three-label display is `difficultyLabelOf` (`apps/api/src/modules/questions/projection.ts:98`): 1-2 Mudah, 3 Sederhana, 4-5 Sukar. The only five-label mapping is `1 Sangat Mudah, 2 Mudah, 3 Sederhana, 4 Sukar, 5 Sangat Sukar` (`practice-config.ts:12`) over `min(5, TP)` (`be09-practice-mapping.ts:25`).

**Activity enum for "Dilihat murid di" (F-19).** `databank, latih_tubi_spm, bab, simulasi_paper, simulasi_kuiz, jana_kertas, permainan`. `jana_kertas` is an admin-only activity; the pupil indicator reads "n daripada 6".

**Ticket semantics (OD-4, D-A13).** One admin reply per ticket (`adminReply`, `repliedAt`), no thread, the pupil cannot reply; statuses `dibuka, dalam_proses, menunggu_balas, selesai, ditutup`; **saving a reply does not change the status**, the admin sets the status separately (API-SUP-05 `PATCH .../status`); the owner sees the reply and `statusLabel` in `GET /api/tiket`.

---

## 5. Screen to endpoint map

Read as: module ID (SRS) -> API IDs a front-end developer calls. "(data)" means the endpoint exists and the defect is data, "(fix)" means the row has a defect to close first. Sections 2.1-2.13 hold the detail.

### 5.1 Murid (`10-murid.md`)

| SRS module | Screen | API IDs |
|---|---|---|
| FR-MUR-SH (shell) | sidebar, header, account menu, banner, notifications, coins strip | API-AUTH-03, API-AUTH-02, API-AUTH-14, API-AUTH-15, API-MUR-07, API-GAME-05 (`/tournament/active` banner), API-FILE-02 |
| R1-MUR-A1 | Profil Saya, public profile | API-AUTH-08 (fix), API-AUTH-09 (fix), API-AUTH-11, API-MUR-02 (build), API-MUR-03 (fix/OQ), API-FILE-01/02 |
| R1-MUR-A2 | Tetapan Peribadi | API-AUTH-08, API-AUTH-10, API-AUTH-12 |
| R1-MUR-A3 | Panduan | API-SUP-04 (fix) |
| R1-MUR-A4 | Tiket Bantuan | API-SUP-01 (fix), API-SUP-02 |
| R1-MUR-A5 | Log Keluar | API-AUTH-02 |
| R1-MUR-2 | Dashboard | API-MUR-01 (fix), API-PRAC-04 (fix), API-PRAC-09, API-GAME-07, API-GUR-10, API-GUR-15, API-MUR-06 |
| R1-MUR-3 | Headcount | API-RPT-08 (build) |
| R1-MUR-4 | Prestasi Saya | API-RPT-01; API-RPT-02 must refuse a pupil (fix) |
| R1-MUR-5 | Analitik Adaptif | API-RPT-03 (fix) |
| R1-MUR-6 | Analisa Item | API-RPT-05 (build), API-RPT-06 (fix, refuse pupil), API-PRAC-01, API-Q-19 |
| R1-MUR-7 | Video | API-MUR-05 |
| R1-MUR-8 | Kelas Saya | API-MUR-04 (fix), API-GUR-15, API-GAME-06 |
| R1-MUR-9 | Soalan by Chapter | API-PRAC-05 (fix), API-PRAC-01 (fix), API-PRAC-02, API-PRAC-03, API-DSKP-09 (data), API-Q-19 |
| R1-MUR-12 | Remedial | API-PRAC-07, API-PRAC-08 (build), API-PRAC-06, API-PRAC-01 |
| R1-MUR-13 | SPM: Bijak SPM, Databank, Tracking A, Subjektif, Kertas Subjektif | API-BIJAK-01..08 (API-BIJAK-04, 07 fix; 01, 02 data), API-Q-19, FILE (photos via API-BIJAK-04) |
| R1-MUR-14 | Heatmap Topik Lemah | API-DSKP-08 (fix) |
| R1-MUR-16 | Latih Tubi | API-PRAC-04 (fix), API-PRAC-01 (fix), API-PRAC-02, API-PRAC-03, API-Q-19 |
| R1-MUR-17 | Soalan Berstruktur | API-PRAC-10, API-BIJAK-05 |
| R1-MUR-18 | Kedudukan | API-RPT-13 (fix) |
| R1-MUR-19 | PKSK | API-PRAC-12 |
| R1-MUR-20 | Artikel | API-MUR-06 |
| R1-MUR-21 | Permainan | API-GAME-01, API-GAME-02, API-GAME-03 |
| R1-MUR-22 | Cabutan Bertuah | API-GAME-08 (fix) |
| R1-MUR-23 | Tournament | API-GAME-05 (fix) |
| R1-MUR-24 | Topik | API-DSKP-01 (fix) |
| R1-MUR-25 | Peta Belajar | API-DSKP-01 (fix) |
| R1-MUR-26 | Set Soalan Guru | API-GUR-15, API-PRAC-01 (`mode: 'question_set'`) |
| R1-MUR-27 | Audio KBAT | API-PRAC-11 |
| R1-MUR-28 | Syiling & Token | API-GAME-07, API-AUTH-14 |
| R1-MUR-29 | Tukar Token | API-GAME-07 (`convert`) |
| R1-MUR-30 | Cabaran Harian | API-GAME-07 (`challenges`), API-GUR-10 |
| R1-MUR-31 | Kedai Hadiah | API-GAME-08 |
| R1-MUR-32 | Marketplace | API-ADM-19 |
| R1-MUR-33 | Papan Pendahulu | API-GAME-06 (fix), API-MUR-03 |
| R1-MUR-34 | Pencapaian | API-MUR-10 |
| R1-MUR-35 | Kotak Misteri | API-GAME-08 (fix) |
| R1-MUR-36 | Rujuk Kawan | API-MUR-10 (fix) |
| R1-MUR-38 | Kedai Hadiah Digital | API-GAME-08 |
| R1-MUR-39 | Timeline Saya | API-RPT-14 (fix), API-RPT-15 (build), API-FILE-01 (`timeline_photo`) |
| R1-MUR-40 | Jemput Ibu Bapa | API-MUR-09 |
| R1-MUR-54 | Laporan Soalan | API-Q-19 (fix), API-Q-20 (fix) |
| FR-MUR-QP (question paper contract) | stimulus once, sticky, figures, groups | API-BIJAK-04 (groups present), API-PRAC-01 (add `stimulusGroup`), API-Q-02, API-Q-08, API-FILE-02 |
| FR-MUR-DK (DSKP level per module) | level shown per module | API-DSKP-01, API-DSKP-05 |

### 5.2 Guru (`20-guru-admin-sekolah.md`)

| SRS module | Screen | API IDs |
|---|---|---|
| R1-GUR-A1 | Profil Saya (+ `/guru/profil/edit`, `/guru/{id}`) | API-AUTH-08, API-AUTH-09, API-GUR-22 (build) |
| R1-GUR-A2 | Tetapan Peribadi | API-AUTH-08, API-AUTH-10, API-AUTH-12 |
| R1-GUR-A3 | Panduan | API-SUP-04 (fix) |
| R1-GUR-A4 | Tiket Bantuan | API-SUP-01, API-SUP-02 |
| R1-GUR-A5 | Log Keluar | API-AUTH-02 |
| R1-GUR-1 | Command Center | API-GUR-13, API-GUR-12, API-GUR-14 |
| R1-GUR-2 | Dashboard Guru | API-GUR-07 (fix), API-GUR-11 (build), API-RPT-09 |
| R1-GUR-2b | Misi Harian | API-GUR-11 (build) |
| R1-GUR-3 | Headcount | API-RPT-09 (fix), API-RPT-10 (build) |
| R1-GUR-4 | Prestasi | API-RPT-02, API-RPT-01 |
| R1-GUR-5 | Analitik Adaptif | API-RPT-04 |
| R1-GUR-6 | Analisa Item | API-RPT-07 (fix), API-RPT-06 |
| R1-GUR-7 | Video | API-MUR-05 |
| R1-GUR-8 | Kelas Saya | API-GUR-01 (fix), API-GUR-02, API-GUR-03 (build), API-GUR-05, API-GUR-04 (remove) |
| R1-GUR-8b | Set Soalan | API-GUR-16 (build) |
| R1-GUR-9 | Soalan by Chapter | API-PRAC-05 (fix), API-GUR-08, API-DSKP-09 (data) |
| R1-GUR-10 | Monitoring | API-RPT-12 |
| R1-GUR-11 | Kirkpatrick | API-RPT-11 (fix) |
| R1-GUR-41 | Pelajar Saya | API-GUR-05, API-GUR-06 (build), API-RPT-01 |
| R1-GUR-42 | Laporan | API-RPT-07 |
| R1-GUR-43 | Laporan Mingguan | API-GUR-21 (build) |
| R1-GUR-44 | Sumbang Soalan (incl. the "Alat Soalan" block, FR-GUR-44-8) | API-GUR-17 (fix, 503), API-GUR-18 (fix), API-GUR-19 (fix), API-GUR-20, API-GUR-09, API-Q-14 |
| R1-GUR-44a | Soalan & Rujukan | API-GUR-24 (build), API-GUR-25 (fix) |
| R1-GUR-44b | Soalan Berstruktur | API-GUR-26 (build), API-GUR-17 (submit) |
| R1-GUR-44c | Soalan Gambar Rajah | API-Q-21 (fix) |
| R1-GUR-44d | Databank Soalan | API-GUR-27 (build) |
| R1-GUR-44e | Kertas Peperiksaan | API-GUR-28 (build) |

### 5.3 Admin Sekolah

| SRS module | Screen | API IDs |
|---|---|---|
| R1-AS-A5 / A1 / A2 / A3 / A4 | Log Keluar, Profil, Tetapan, Panduan, Tiket | API-AUTH-02; API-AUTH-08/09; API-AUTH-08/10/12; API-SUP-04; API-SUP-01/02 |
| R1-AS-0 | preconditions (UAT account) | API-ADM-01 (accounts), API-AUTH-05 |
| R1-AS-1 | Command Center | API-AS-02 (fix), API-AS-03 (fix) |
| R1-AS-2 | Dashboard | API-AS-01 (fix), API-MUR-08 |
| R1-AS-3 | Headcount | API-AS-15 (fix) |
| R1-AS-4 | Prestasi | API-RPT-02 |
| R1-AS-5 | Analitik Adaptif | API-AS-16 (fix) |
| R1-AS-6 | Analisa Item | API-AS-17 (fix) |
| R1-AS-7 | Video | API-MUR-05 |
| R1-AS-10 | Monitoring | API-RPT-12 |
| R1-AS-11 | Kirkpatrick | API-RPT-11 (fix) |
| R1-AS-45 | Sekolah Bersaing | API-AS-14 (fix) |
| R1-AS-46 | Statistik Penggunaan | API-AS-08 (fix) |
| R1-AS-47 | DSKP Heatmap | API-AS-11 (fix) |
| R1-AS-48 | Laporan Aktiviti | API-AS-09 (fix) |
| R1-AS-49 | Amaran Awal | API-AS-13 (fix) |
| R1-AS-50 | Laporan Bulanan | API-AS-10 (fix) |
| R1-AS-51 | Senarai Pelajar | API-AS-05 (fix), API-AS-06 (build) |
| R1-AS-52 | Senarai Guru | API-AS-07 (fix), API-AS-04 |
| R1-AS-53 | Kelas Sekolah | API-AS-12 (fix) |
| XS-1..XS-5 (cross-screen numbers) | all AS counts | API-AS-01, API-AS-02, API-AS-07, API-AS-08, API-AS-15, API-RPT-02, API-RPT-12 read one shared school read model |

### 5.4 Admin Pusat (`30-admin-pusat.md`)

| SRS screen | API IDs |
|---|---|
| QE-01, QE-02 (group rule, group-first entry) | API-Q-07, API-Q-08 (fix), API-Q-03 |
| QE-03, QE-04 (DSKP form, completeness) | API-Q-03 (fix), API-Q-05 (fix), API-Q-09, API-DSKP-05 |
| QE-05 (upload keeps structure) | API-Q-14 (fix), API-Q-15 (fix), API-FILE-01 |
| QE-06 (CSV) | API-Q-17 (fix) |
| QE-07 (papers never split a group) | API-BIJAK-10 (fix), API-BIJAK-11 (fix) |
| QE-08 (regroup work-list) | API-Q-13 (build), API-Q-12 (build), API-Q-21 |
| Q-01, Q-02 (SPM hub, lanes) | API-BIJAK-12 (fix), API-BIJAK-15, API-Q-11 (fix), API-Q-01 |
| Q-03 (Bank Soalan list) | API-Q-01 (fix), API-Q-04, API-Q-11 |
| Q-04 (Studio wizard) | API-Q-02 (fix), API-Q-03 (fix), API-Q-05, API-Q-06, API-Q-09, API-FILE-01 |
| Q-05 (stimulus group screen) | API-Q-08 (fix), API-Q-07 |
| Q-06 (servability, "Dilihat murid di") | API-Q-11 (fix), API-Q-12 |
| Q-07, Q-08, Q-09, Q-10 | API-Q-14 (fix), API-Q-15 (fix), API-Q-16, API-Q-03 |
| Q-11 (Import CSV) | API-Q-17 (fix) |
| Q-12 (Kiriman Guru) | API-GUR-17 (fix), API-Q-14 (fix; `source=guru`) |
| Q-13, Q-14, Q-15 (Set Builder, Terbit) | API-BIJAK-10 (fix), API-BIJAK-11 (fix) |
| Q-16 (Kontrak Simulasi) | API-BIJAK-09, API-DSKP-06 |
| Q-17 (Tracking A) | API-BIJAK-13 (build) |
| Q-18 (Kertas Subjektif) | API-BIJAK-14 (build) |
| Q-19 (Sumber Kertas) | API-Q-23 (build) |
| Q-20 (Senarai Soalan, Bank Lama) | API-Q-01, API-Q-04 |
| Q-21 (Kualiti Soalan) | API-Q-18 (fix) |
| Q-22 (Laporan Soalan) | API-Q-20 (fix) |
| Q-23 (Soalan Berstruktur / Subjektif lane) | API-Q-10 (fix), API-BIJAK-12 |
| Q-24 (Quick Edit) | API-Q-03 |
| C-01 Kurikulum | API-DSKP-04 (fix) |
| C-02 Subjek | API-DSKP-03 |
| C-03 Tahap Pendidikan | API-DSKP-02 (data) |
| C-04 DSKP load | API-DSKP-05, API-DSKP-06 |
| C-05 Tetapkan Bab | API-DSKP-09 (build), API-Q-01 (fix, filter) |
| N-01 Video | API-MUR-05 |
| N-02, N-03, N-04 Artikel, Banner, Nota | API-ADM-07 |
| N-05 Tetapan Permainan | API-ADM-08 |
| N-06 Kawalan Ciri | API-ADM-09 (build), API-AUTH-16 (build) |
| N-07 Tetapan (support contact) | API-ADM-10 (build), API-SUP-04 (fix) |
| U-01, U-02, U-03 Pengguna | API-ADM-01 (fix), API-ADM-02 |
| U-04 Sekolah | API-ADM-03, API-ADM-04 |
| U-05, U-06 Import | API-ADM-06, API-ADM-01 (`bulk-import`) |
| U-07 Pelajar Komplimen | API-ADM-06 |
| U-08 Kelas Sekolah | API-ADM-05 (build) |
| U-09 Langganan Sekolah | API-ADM-06 |
| M-01 Dashboard | API-ADM-11 (build), API-Q-01 (`/questions/summary`) |
| M-02 Langsung, Aktiviti Harian | API-AS-02, API-AS-03, API-ADM-21 |
| M-03 Monitoring | API-RPT-12 |
| M-04 Kirkpatrick | API-RPT-11 |
| M-05 Analitik | API-ADM-12 (build) |
| M-06 Laporan | API-ADM-13 (build) |
| M-07 Central school-admin views | API-ADM-22 (build) |
| M-08 Laporan Eksekutif | API-ADM-13 (build) |
| P2-01..P2-06 Gamifikasi | API-ADM-14 |
| P2-07, P2-08 Hadiah, Tebusan | API-ADM-15 |
| P2-09, P2-10, P2-11 Kawalan Reward, Cabutan, Kotak Misteri | API-ADM-16 (fix), API-GAME-09 (build) |
| P2-12, P2-13 Marketplace | API-ADM-19 (fix) |
| P2-14 Tournament, Liga | API-ADM-17 (fix), API-GAME-05 |
| P2-15 Ranking Sekolah, Leaderboard | API-GAME-04, API-GAME-06 |
| P2-16 Pautan Ibu Bapa | API-MUR-09 |
| P2-17 Audio KBAT | API-PRAC-11 |
| P2-18 Artikel/Banner/Nota/Video forms | API-ADM-07, API-MUR-05 |
| P2-19 Kawalan Ciri (full set) | API-ADM-09, API-AUTH-16 |
| P2-20 Tiket Bantuan | API-SUP-03 (fix), API-SUP-05 (build) |
| U-OP-01..13 (UAT data operations) | Run through the admin API/UI above (Disahkan: API-BIJAK-09; Terbit: API-BIJAK-10; Bab: API-DSKP-09; Darjah off: API-DSKP-02); scripts in `apps/api/scripts/uat-ops/` (S3-T08, S4-T08) |

---

## 6. Decisions taken in this contract and open API questions

### 6.1 Decisions (made here; each can be reversed by an ADR)

| ID | Decision | Reason |
|---|---|---|
| D-API-1 | Hidden or off features answer `404` from a `FeatureGuard` that runs before authentication. | FR-X2-2 says "never a 403"; running it first also hides the feature from anonymous probes. |
| D-API-2 | No new `/completeness` or `/validate` route. The Studio uses `GET /api/questions/:id/gate-check` (already returns `issues[{path, code, message, step}]`) and the `422 fields` of the save routes. | The shape the plan asked for already exists; the UI ignores it (S1-T02 now reuses it, FR-X1-5). |
| D-API-3 | Own-scope reads for pupils are `.../me` routes (`/headcounts/me`, `/item-analysis/me`), not a relaxed role list on the staff routes. | Keeps staff routes strictly staff and the privacy rule testable (AC-MUR-3-5, AC-MUR-6-5). |
| D-API-4 | Admin Pusat central views reuse `/api/admin-sekolah/*` read routes with `?schoolId=`. | One read model, so Admin Pusat and Admin Sekolah show the same number (XS rules). |
| D-API-5 | Teacher-submitted papers use intake batches with `source=guru`; no `/api/question-submissions`. | FR-ADM-Q12.2 (OQ-Q12); the plan card S1-T08 is aligned (OQ-API-13). |
| D-API-7 | A Kertas Subjektif paper is a `papers` row with `surface = 'subjektif'` (DM-23, OD-2); the admin screens reuse `/api/admin/papers*`. | Keeps DSKP tags and stimulus groups on every question; adds one discriminator instead of a second paper model. |
| D-API-8 | The R1 decisions of 2026-11-04 that touch this file (D113-continued): `POST /api/kelas-saya/join` answers 404 for every role (OQ-API-08); Guru may create school-scoped videos (OQ-API-12); `API-GUR-26` carries the teacher structured-question POST/PUT and `API-GUR-17` accepts PDF, DOCX and XLSX only; `difficultyLevel` is typed and required (API-Q-03); student import limit is 2 MB and 1000 rows; the pupil display name is the first given name only; support ticket statuses are the five Malay values; Battle answers write mode `battle`, other games `game`, and the answer-store unique key includes `user_id` (DM-44). | The SRS wins on behaviour (10/20/30), 50/60 win on technical shape. |
| D-API-6 | Self-mark stays on `POST /api/bijak/attempts/:id/self-mark`; Kertas Subjektif pupils reuse Bijak attempts. | The route exists; the plan text "no self-mark endpoint" is stale. |

### 6.2 API questions (all decided by principle on 2026-11-04; none left for the user)

| ID | Question | Recommendation | Decision |
|---|---|---|---|
| OQ-API-01 | Should the 404 for a hidden feature also apply to anonymous callers? | Yes (D-API-1). Alternative considered: authenticate first, then 404 (rejected). | **Decided (by principle, 2026-11-04): yes, a `FeatureGuard` runs before authentication, so anonymous callers also get 404. Reason: FR-X2-2 says never 403 and an off module must not be probeable.** |
| OQ-API-02 | Out-of-scope records answer `404` by default but the SRS fixes `403` for Headcount (other pupil), weekly report (other class) and Kirkpatrick (other school's pupil). Unify? | Keep the SRS-fixed `403`s, document them per row (done), default `404`. Do not change the V2-parity ones. | **Decided (by principle, 2026-11-04): keep the SRS-fixed `403`s (Headcount of another pupil, weekly report of another class, Kirkpatrick pupil of another school) and default every other out-of-scope record to `404`. Reason: V2 parity for unchanged flows; the default hides existence.** |
| OQ-API-03 | `bio` is capped at 500 in the contract; FR-MUR-A1-3 says 1000, plus a new `aspiration` (Cita-Cita, 255). | Raise `bio` to 1000 and add `aspiration` (additive). | **Decided (by principle, 2026-11-04): raise `bio` to 1000 and add `aspiration` (255), additive. Reason: the SRS wins on behaviour and the change is a constant plus one optional field.** |
| OQ-API-04 | The anonymous pupil profile returns the first name only and no school (privacy decision OQ-8 in the code); FR-MUR-A1-5 shows the full name and school. | Keep the code (minors' privacy, NFR-5) and amend FR-MUR-A1-5 to "first name, school hidden". Also FR-MUR-39-4 (public timeline posts) cannot work on the anonymous profile (`posts` is always `[]`). | **Decided (by principle, 2026-11-04): privacy: the anonymous pupil profile shows the first name only and no school (and no bio, cita-cita or posts); FR-MUR-A1-5 and FR-MUR-39-4 amended. Reason: pupils are minors and the page is public (NFR-5).** |
| OQ-API-05 | The SRS cites `POST /api/admin/feature-toggles`. | Use `GET` + `PUT /:key` (idempotent). | **Decided (by principle, 2026-11-04): `GET` plus `PUT /:key`. Reason: idempotent and smaller than a POST/PUT pair.** |
| OQ-API-06 | Daily question-report cap: contract 20, plan S5-T06 says 10. | 20 (the contract is tested; OQ-MUR-15 says "set by the backend"). | **Decided (by principle, 2026-11-04): 20 per day; plan S5-T06 and OQ-MUR-15 aligned. Reason: the contract value is enforced and tested.** |
| OQ-API-07 | Sekolah Bersaing: FR-AS-45-4 says computed on request; plan S7-T02 and DM-31 say a weekly job writing `sekolah_bersaing_weeks` with a fallback to the last stored week (OQ-AS-6). | The response is the same either way (rank, school, state, accuracy, pupils; no `week` line). Compute on request if the 339k-row aggregate is fast enough on UAT; otherwise keep the weekly job. Measured in S7-T02 with an `EXPLAIN`. | **Decided (by principle, 2026-11-04): compute on request, no weekly job, no stored board; DM-31 and plan S7-T02 aligned. Reason: the SRS (FR-AS-45-4) wins on behaviour and 50 shows no measured performance need (a 60-second cache is the fallback).** |
| OQ-API-08 | `POST /api/kelas-saya/join` and the teacher class `joinCode`/QR are dropped from the UI (GUR-8). Remove the API too? (Yes: 404.) | The route answers 404 for every role and `joinCode`/QR leave the responses; the column stays (no migration). | **Decided (D113-continued, 2026-11-04): the route `POST /api/kelas-saya/join` answers 404 for every role; the column `classrooms.join_code` stays (no migration); `joinCode`/QR are removed from responses. Reason: AC-MUR-8-3 (SRS) wins on behaviour. This overrides the earlier decision "keep the route".** |
| OQ-API-09 | Code lets Guru call `GET /api/amaran/*` and any role call `GET /api/sekolah-bersaing`; the matrix gives both to Admin Sekolah only. | Restrict `sekolah-bersaing` to Admin Sekolah and Admin Pusat and keep `amaran` open to Guru with the scope forced to own classes (aggregates, no pupil list beyond own classes). | **Decided (by principle, 2026-11-04): `sekolah-bersaing` is restricted to Admin Sekolah and Admin Pusat (matrix row 45); `amaran` stays open to Guru because V2 lists Amaran Awal among the teacher tools, but the scope is forced to the teacher's own classes (verified in S6-T04). Reason: privacy first, no pupil list beyond one's own classes.** |
| OQ-API-10 | `check-answer` takes a single MCQ option. Drills that serve non-MCQ units (D105) need an answer union like Bijak. | MCQ-only drills until S1-T09a lands; then reuse the Bijak part-answer shape. | **Decided (by principle, 2026-11-04): MCQ-only drills until S1-T09a lands, then the Bijak part-answer shape. Reason: no new API shape before the grading modes exist.** |
| OQ-API-11 | Chapter unlock at 70%: plan S5-T02 keeps it, the SRS (D98) removes the sentence. | Follow the SRS: no unlock rule in the API. | **Decided (by principle, 2026-11-04): no unlock rule in the API (done: `locked` removed, plan S5-T02 aligned). Reason: the SRS wins on behaviour (D98).** |
| OQ-API-12 | Roles for `POST/PUT/DELETE /api/videos` (no `@Roles`). | Admin Pusat and Guru (Guru rows school-scoped, DM-76); the pupil "Tambah Video" button stays hidden (OQ-MUR-11). | **Decided (D113-continued, 2026-11-04): write routes of `/api/videos` are Admin Pusat and Guru (Guru rows are school-scoped, DM-76); the pupil "Tambah Video" button stays hidden (OQ-MUR-11). Reason: R1-GUR-7 (SRS) wins on behaviour. Amends the earlier decision "Admin Pusat only".** |
| OQ-API-13 | Plan S1-T08 adds `/api/question-submissions`; FR-ADM-Q12.2 says it is not built. | Not built (D-API-5). | **Decided (by principle, 2026-11-04): not built; S1-T08 aligned (intake batches with `source=guru`). Reason: FR-ADM-Q12.2 and D-API-5.** |
| OQ-API-14 | FR-AS-51-7 "Pratonton" (impersonate a pupil). No endpoint exists; `Login As` is removed for admins (U-01). | Do not build; Mod Pelajar already covers trying pupil screens. | **Decided (by principle, 2026-11-04): not built. Reason: impersonating a minor is a privacy risk and "Mod Pelajar" already covers trying pupil screens.** |
| OQ-API-15 | (Closed) how a Kertas Subjektif paper is typed. | Closed by D-API-7: `papers.surface`. **Decided (by principle, 2026-11-04): confirmed, no change.** |
| OQ-API-16 | Mood check-in on the pupil dashboard (parity C01) is hidden by OQ-MUR-10. | Do not build an endpoint while OQ-MUR-10 hides the check-in. | **Decided (by principle, 2026-11-04): no endpoint; the mood check-in stays hidden. Reason: OQ-MUR-10 and a mood record about minors needs its own privacy design (no new scope).** |
| OQ-API-17 | The `files` per-purpose role rules (who may upload `question_image`, `audio_kbat`, `cms_*`) are read in S1-T01. | S1-T01 reads `files.service.ts` and adds the rule to API-FILE-01. | **Decided (by principle, 2026-11-04): S1-T01 reads `files.service.ts` and writes the per-purpose rule into API-FILE-01. Reason: a verification task, not a user decision.** |
| OQ-API-18 | Mix of numeric-looking and opaque ids across modules (`chapterId`, `missionId`, `questionSetId`). | Leave; new routes use `IdSchema` strings. | **Decided (by principle, 2026-11-04): leave as is; new routes use `IdSchema` strings. Reason: renumbering working ids is a rebuild.** |
| OQ-API-19 | FR-ADM-G7.3 says a `stem_duplicated` question is excluded from pupil surfaces; DM-05 and OD-3 say it is only displayed once and fixed by data clean-up DM-40. | Follow the ERD (display once, do not exclude); the clean-up removes the duplicate. | **Decided (D113, OD-3, 2026-11-04): display once, do not exclude; FR-ADM-G7.3 and FR-MUR-QP-5 amended (only `stimulus_missing` and `figure_only` exclude). Reason: the question is complete and answerable, the data is cleaned by DM-40.** |

---

## 7. Summary

### 7.1 Counts (rows of section 2 = API IDs)

| Area | API IDs | Exists-OK | Exists-Fix | Missing-Build |
|---|---|---|---|---|
| AUTH | 17 | 9 | 7 | 1 |
| MUR | 10 | 4 | 5 | 1 |
| GUR | 28 | 10 | 8 | 10 |
| AS | 17 | 1 | 15 | 1 |
| ADM | 25 | 6 | 9 | 10 |
| Q | 36 | 5 | 15 | 16 |
| DSKP | 10 | 5 | 3 | 2 |
| BIJAK | 15 | 5 | 8 | 2 |
| PRAC | 12 | 5 | 6 | 1 |
| RPT | 17 | 1 | 10 | 6 |
| GAME | 14 | 2 | 7 | 5 |
| SUP | 5 | 1 | 3 | 1 |
| FILE | 3 | 3 | 0 | 0 |
| **Total** | **209** | **57** | **96** | **56** |

One row can hold several routes. The 56 `Missing-Build` rows are about 118 new route handlers (one of them, API-AUTH-16, is a guard, not a route) plus the admin marketplace CRUD inside API-ADM-19. The rows added by the 2026-11-04 allocation are API-Q-26, API-Q-30..API-Q-39, API-GAME-11..API-GAME-14, API-ADM-23..API-ADM-25 and API-RPT-17 (20 rows, all `Missing-Build`); statuses of rows that gained behaviour (for example API-AUTH-03, API-BIJAK-03, API-GAME-01..03) moved from `Exists-OK` to `Exists-Fix`. Appendix A lists all 605 existing handlers.

### 7.2 Top defects (all `Exists-Fix`, in priority order)

1. **Pupil Prestasi opens school-wide data** (API-RPT-02, FR-X4-4, P0): `/api/performance/school|levels|classes` have no `@Roles` and answer a pupil; the front end also redirects `/prestasi` to the school page. `/api/item-analysis/school` lists `student` (API-RPT-06).
2. **Guru Laporan Mingguan is 403** (API-GUR-21): `GET /api/weekly-report` throws `FORBIDDEN` for every role by design; no teacher route exists.
3. **Hidden modules are reachable by API** (API-AUTH-16): no server-side feature flag; `/api/cikgu/*` and `/api/mohon-keluarga-angkat` answer any signed-in role.
4. **Pupil Headcount and Analisa Item have no route** (API-RPT-08, RPT-05): the controllers are staff-only.
5. **Stimulus split**: the practice session payload has no stimulus or group (API-PRAC-01), the paper builder blocks 1-question groups against D108-1 (API-Q-08, BIJAK-10), and figure-less "Rajah n" questions are published and served (API-Q-12).
6. **Questions without Bab/SP**: the field exists (`curriculumChapterId`, `dskpSpId`) but 0 of 339,112 UAT questions have a Bab and there is no bulk setter (API-DSKP-09); Soalan by Chapter and Heatmap stay empty.
7. **Bijak has no papers/contracts on UAT**: the pupil reads are correct but empty (API-BIJAK-01/02); admin lanes cover 2 of 6 (API-BIJAK-12), Tracking A and Kertas Subjektif admin routes are missing (API-BIJAK-13/14).
8. **Analitik Adaptif and Item Analysis refuse Admin Sekolah** (`CLASS_ANALYSIS_ROLES` excludes `school_admin`, API-RPT-04) and the school-admin numbers disagree across screens (XS-1..5, API-AS-01/07/08/17).
9. **Paper submit returns 503** (API-GUR-17) and **`/api/config/support` returns 404** when the row is missing (API-SUP-04).
10. **Latih Tubi offers only T4 and T5** (`OFFERED_LEVEL_CODES`, API-PRAC-01) against D101.

### 7.3 FRs without an endpoint (or with a conflicting one)

| FR / item | Why | Handling |
|---|---|---|
| FR-AS-51-7 "Pratonton" a pupil (Admin Sekolah) | No impersonation route; `Login As` is removed for admins | OQ-API-14, not built |
| Mood check-in (R1-MUR-2, parity C01) | Hidden by OQ-MUR-10 | OQ-API-16, no endpoint |
| FR-MUR-39-4 public timeline posts | The anonymous profile never returns posts (privacy); the FR now says so | OQ-API-04 (decided) |
| FR-MUR-A1-5 full name and school on the public profile | Replaced: first name only, no school (privacy rule in code; the FR now says so) | OQ-API-04 (decided) |
| R1-ADM-M-07 central views (no V2 reference, E-23) | Shape is provisional | API-ADM-22 |
| R1-ADM-P2-10/11/14 forms (E-14), P2-12/13 marketplace admin | No V2 capture of these forms | Provisional shapes (API-GAME-09, API-ADM-19) |
| Non-API requirements: FR-X2-0/AC-X2-3 (repo string check), FR-X5-2 (stack boots), NFR-1/FR-X6-* (responsive), FR-ADM-Q18.5 (OCR bake-off E-05) | Not HTTP behaviour | Covered by the plan cards, not this file |

Every other FR/AC of the three SRS files maps to at least one API ID in section 5.

### 7.4 Files read as evidence

`apps/api/src/**/*.controller*.ts` (all 102 controller files, via the generated inventory), `common/guards/*`, `common/errors/*`, `common/http/respond.ts`, `configure-app.ts`, `reports/performance/domain/access-policy.ts`, `reports/performance/services/{weekly-report,school-performance,public-profile}.service.ts`, `support/support.service.ts`, `practice/rules.ts`, `files/files.controller.ts`; `packages/contract/src/{common,session,auth,account,questions,bijak,practice,support,servability,files,question-workflow}/**`; the three SRS files, `40-cross-cutting.md`, `00-index.md`, `docs/plan/r1-development-plan.md`.

---

## Appendix A. Route inventory (generated 2026-11-04 from the code)

One row per `@Get/@Post/@Put/@Patch/@Delete` handler. "Guard" shows the effective `@Roles` (class or method), `@Capability`, or `PUBLIC`; an empty cell means any signed-in role (the service decides). Line = decorator line. Paths include the `/api` global prefix.

### common/health/health.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/health` | PUBLIC | 20 |

### common/health/ready.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/ready` | PUBLIC | 18 |

### common/metrics/metrics.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/metrics` | PUBLIC | 35 |

### account/account.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| POST | `/api/auth/register` | PUBLIC | 107 |
| POST | `/api/auth/password/email` | PUBLIC | 122 |
| POST | `/api/auth/password/reset` | PUBLIC | 131 |
| POST | `/api/auth/password/reset-ic` | PUBLIC | 143 |
| GET | `/api/me` |  | 194 |
| PUT | `/api/me` |  | 199 |
| PUT | `/api/me/password` |  | 205 |
| POST | `/api/me/picture` |  | 218 |
| GET | `/api/me/settings` |  | 230 |
| PUT | `/api/me/settings` |  | 235 |
| GET | `/api/public/stats` | PUBLIC | 249 |

### ai-extraction/ai-admin.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/ai/status` | roles: admin | 34 |
| GET | `/api/ai/usage` | roles: admin | 40 |
| PUT | `/api/ai/settings` | roles: admin | 47 |
| POST | `/api/ai/test` | roles: admin | 53 |

### auth/auth.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| POST | `/api/auth/login` | PUBLIC | 64 |
| POST | `/api/auth/logout` | PUBLIC | 80 |
| GET | `/api/session` |  | 101 |
| POST | `/api/session/role` |  | 109 |
| POST | `/api/session/mode` |  | 120 |
| DELETE | `/api/session/mode` |  | 131 |

### battle/arena/arena.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/battle/lobby` |  | 19 |
| GET | `/api/battle/arena/:uuid` |  | 25 |
| POST | `/api/battle/arena/:uuid/answer` |  | 31 |

### battle/queue/invitations.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/battle/search-opponent` |  | 28 |
| POST | `/api/battle/invite` |  | 35 |
| GET | `/api/battle/invitations` |  | 43 |
| POST | `/api/battle/invite/:uuid/accept` |  | 50 |
| POST | `/api/battle/invite/:uuid/decline` |  | 58 |
| POST | `/api/battle/forfeit/:uuid` |  | 66 |

### battle/queue/queue.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| POST | `/api/battle/quick-match` |  | 24 |
| POST | `/api/battle/school-battle` |  | 32 |
| GET | `/api/battle/poll-match/:queueId` |  | 40 |
| POST | `/api/battle/accept-challenger/:queueId` |  | 47 |
| POST | `/api/battle/reject-challenger/:queueId` |  | 55 |
| POST | `/api/battle/join-queue/:queueId` |  | 63 |
| GET | `/api/battle/poll-challenger/:queueId` |  | 71 |

### battle/standings/standings.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/battle/standings/students` |  | 36 |
| GET | `/api/battle/standings/schools` |  | 41 |
| GET | `/api/battle/schools/:id` |  | 46 |
| GET | `/api/battle/history` |  | 51 |

### battle/tournaments/tournaments.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/tournament/active` |  | 31 |
| GET | `/api/tournaments` |  | 37 |
| GET | `/api/tournaments/form-options` | roles: admin | 43 |
| POST | `/api/tournaments` | roles: admin | 50 |
| GET | `/api/tournaments/:uuid` |  | 57 |

### bijak/attempts/attempts.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/bijak/papers/:paperId/in-progress` | roles: student | 100 |
| POST | `/api/bijak/attempts` | roles: student | 105 |
| GET | `/api/bijak/attempts/:id` | roles: student | 117 |
| PUT | `/api/bijak/attempts/:id/answers` | roles: student | 122 |
| POST | `/api/bijak/attempts/:id/submit` | roles: student | 132 |
| POST | `/api/bijak/attempts/:id/abandon` | roles: student | 143 |
| POST | `/api/bijak/attempts/:id/questions/:questionId/check` | roles: student | 150 |
| GET | `/api/bijak/attempts/:id/result` | roles: student | 165 |
| POST | `/api/bijak/attempts/:id/self-mark` | roles: student | 171 |
| POST | `/api/bijak/attempts/:id/retry` | roles: student | 183 |
| GET | `/api/bijak/papers/:paperId/attempts` | roles: student | 191 |
| GET | `/api/bijak/history` | roles: student | 196 |
| POST | `/api/bijak/attempts/:id/photos` | roles: student | 201 |

### bijak/kuiz/kuiz.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| POST | `/api/bijak/kuiz/sessions` | roles: student | 40 |
| POST | `/api/bijak/kuiz/sessions/:id/check` | roles: student | 46 |
| POST | `/api/bijak/kuiz/sessions/:id/finish` | roles: student | 53 |
| GET | `/api/bijak/kuiz/papers/:id` | roles: student | 60 |
| POST | `/api/bijak/kuiz/papers/:id/check` | roles: student | 66 |

### bijak/papers/papers.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/bijak/papers` | roles: student | 29 |
| GET | `/api/bijak/papers/:id` | roles: student | 35 |
| GET | `/api/bijak/contracts` | roles: student | 41 |
| GET | `/api/bijak/subjects` | roles: student | 47 |
| POST | `/api/bijak/papers/generate` | roles: student | 53 |

### cikgu/cikgu.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| POST | `/api/cikgu/send` |  | 25 |
| GET | `/api/cikgu/rph` | roles: teacher, admin | 57 |
| POST | `/api/cikgu/rph` | roles: teacher, admin | 63 |
| GET | `/api/cikgu/rph/:id` | roles: teacher, admin | 69 |
| GET | `/api/cikgu/essays` | roles: teacher, admin | 75 |
| GET | `/api/cikgu/essays/:id` | roles: teacher, admin | 81 |
| GET | `/api/cikgu/pbd` | roles: teacher, admin | 87 |
| POST | `/api/cikgu/pbd/rollup` | roles: teacher, admin | 93 |
| POST | `/api/cikgu/pbd/bulk-approve` | roles: teacher, admin | 100 |
| GET | `/api/cikgu/pbd/export.csv` | roles: teacher, admin | 107 |

### classes/kelas-saya.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/kelas-saya` |  | 20 |
| POST | `/api/kelas-saya/join` |  | 27 |

### classes/missions/missions.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/missions/today` |  | 24 |
| GET | `/api/remedial-tests/mine` |  | 31 |
| GET | `/api/remedial-tests/:id` |  | 38 |

### classes/missions/remedial.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/guru/remedial-progress` | roles: teacher, admin | 22 |
| GET | `/api/guru/command-center/remedial/scan` | roles: teacher, admin | 28 |
| POST | `/api/guru/command-center/remedial/generate` | roles: teacher, admin | 34 |
| POST | `/api/guru/command-center/remedial/cancel` | roles: teacher, admin | 41 |

### classes/question-sets/question-sets.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/set-soalan-saya` |  | 45 |
| POST | `/api/guru/question-papers` | roles: teacher, admin | 64 |
| GET | `/api/guru/audio-kbat/template` | roles: teacher, admin | 71 |
| GET | `/api/guru/audio-kbat/template-word` | roles: teacher, admin | 77 |
| POST | `/api/guru/dskp/bidang` | roles: teacher, admin | 84 |
| POST | `/api/guru/dskp/sk` | roles: teacher, admin | 90 |
| POST | `/api/guru/dskp/sp` | roles: teacher, admin | 96 |

### classes/teacher.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/guru/classes` | roles: teacher | 22 |
| POST | `/api/guru/classes` | roles: teacher | 29 |
| GET | `/api/guru/classes/:id/qr-data` | roles: teacher | 35 |
| GET | `/api/guru/students` | roles: teacher | 41 |
| PUT | `/api/guru/students/:id` | roles: teacher | 47 |
| DELETE | `/api/guru/students/:id` | roles: teacher | 53 |
| GET | `/api/guru/dashboard` | roles: teacher | 59 |
| GET | `/api/guru/chapters` | roles: teacher | 65 |
| POST | `/api/guru/chapters` | roles: teacher | 71 |
| GET | `/api/guru/topics` | roles: teacher | 77 |
| POST | `/api/guru/topics` | roles: teacher | 83 |
| GET | `/api/guru/contributions` | roles: teacher | 89 |
| GET | `/api/guru/galeri-rajah` | roles: teacher | 95 |

### command-center/board/board.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/admin/command-center/live-data` | roles: admin, school_admin | 26 |
| GET | `/api/command-center/daily-activity` | roles: admin, school_admin | 32 |
| GET | `/api/command-center/daily-activity/school/:id` | roles: admin | 39 |
| GET | `/api/admin/server-status` | roles: admin | 47 |

### command-center/drill/drill.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/command-center/school/:id` | roles: admin, teacher, school_admin | 26 |
| GET | `/api/command-center/school/:sid/teacher/:uid` | roles: admin, teacher, school_admin | 32 |
| GET | `/api/command-center/classroom/:id` | roles: admin, teacher, school_admin | 38 |
| GET | `/api/command-center/headcount/:configId` | roles: admin, teacher, school_admin | 44 |
| GET | `/api/command-center/student/:id` | roles: admin, teacher, school_admin | 51 |
| GET | `/api/command-center/student/:id/subject` | roles: admin, teacher, school_admin | 57 |
| GET | `/api/command-center/student/:id/week` | roles: admin, teacher, school_admin | 63 |
| GET | `/api/command-center/session/:sessionId` | roles: admin, teacher, school_admin | 69 |

### command-center/guru/guru.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/guru/command-center/live-data` | roles: teacher, admin | 26 |
| GET | `/api/guru/command-center/drill` | roles: teacher, admin | 32 |
| GET | `/api/guru/command-center/evaluate` | roles: teacher, admin | 39 |
| GET | `/api/guru/command-center/predictive` | roles: teacher, admin | 45 |
| GET | `/api/guru/command-center/achievements` | roles: teacher, admin | 51 |
| GET | `/api/guru/command-center/badge-holders` | roles: teacher, admin | 57 |

### content/articles/articles.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/articles` | PUBLIC | 27 |
| GET | `/api/articles/hot` | PUBLIC | 34 |
| GET | `/api/articles/latest` | PUBLIC | 41 |
| GET | `/api/articles/:slug` | PUBLIC | 48 |
| GET | `/api/admin/articles` | roles: admin | 64 |
| GET | `/api/admin/articles/:id` | roles: admin | 75 |
| POST | `/api/admin/articles` | roles: admin | 82 |
| PUT | `/api/admin/articles/:id` | roles: admin | 89 |
| DELETE | `/api/admin/articles/:id` | roles: admin | 95 |

### content/audio/audio.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/audio-kbat-sets` |  | 124 |
| GET | `/api/audio-kbat-sets/:id` |  | 131 |
| GET | `/api/audio-kbat-sets/:id/sections/:no/audio` |  | 139 |
| POST | `/api/audio-kbat-sets/:id/attempts` |  | 177 |
| GET | `/api/admin/audio-kbat-sets` | roles: admin | 194 |
| GET | `/api/admin/audio-kbat-sets/template` | roles: admin | 209 |
| POST | `/api/admin/audio-kbat-sets` | roles: admin | 231 |

### content/banners/banners.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/banners/active` |  | 21 |
| GET | `/api/admin/banners` | roles: admin | 38 |
| GET | `/api/admin/banners/:id` | roles: admin | 44 |
| POST | `/api/admin/banners` | roles: admin | 50 |
| PUT | `/api/admin/banners/:id` | roles: admin | 57 |
| DELETE | `/api/admin/banners/:id` | roles: admin | 63 |

### content/notes/notes.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/admin/notes` | roles: admin | 21 |
| GET | `/api/admin/notes/:id` | roles: admin | 27 |
| POST | `/api/admin/notes` | roles: admin | 33 |
| PUT | `/api/admin/notes/:id` | roles: admin | 40 |
| DELETE | `/api/admin/notes/:id` | roles: admin | 46 |

### content/perutusan/perutusan.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/perutusan` |  | 29 |
| GET | `/api/perutusan/mine` |  | 35 |
| GET | `/api/perutusan/compose-context` |  | 41 |
| GET | `/api/perutusan/:id` |  | 47 |
| POST | `/api/perutusan` | roles: admin, school_admin | 53 |
| POST | `/api/perutusan/:id/reactions` |  | 66 |
| POST | `/api/perutusan/:id/comments` |  | 73 |
| GET | `/api/public/perutusan/:id` | PUBLIC | 88 |

### content/screenshots/screenshots.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/admin/screenshots` | roles: admin | 75 |
| POST | `/api/admin/screenshots` | roles: admin | 81 |

### content/videos/videos.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/videos` | PUBLIC | 26 |
| GET | `/api/videos/form-context` |  | 33 |
| GET | `/api/videos/:id` | PUBLIC | 39 |
| POST | `/api/videos` |  | 46 |
| PUT | `/api/videos/:id` |  | 53 |
| DELETE | `/api/videos/:id` |  | 59 |

### curriculum/admin.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/admin/education-levels` | roles: admin | 25 |
| GET | `/api/admin/education-levels/:id` | roles: admin | 30 |
| POST | `/api/admin/education-levels` | roles: admin | 35 |
| PUT | `/api/admin/education-levels/:id` | roles: admin | 41 |
| PATCH | `/api/admin/education-levels/:id/active` | roles: admin | 47 |
| DELETE | `/api/admin/education-levels/:id` | roles: admin | 53 |
| GET | `/api/admin/subjects` | roles: admin | 66 |
| GET | `/api/admin/subjects/:id` | roles: admin | 71 |
| POST | `/api/admin/subjects` | roles: admin | 76 |
| PUT | `/api/admin/subjects/:id` | roles: admin | 82 |
| PATCH | `/api/admin/subjects/:id/active` | roles: admin | 88 |
| DELETE | `/api/admin/subjects/:id` | roles: admin | 94 |
| GET | `/api/admin/curriculum` | roles: admin | 107 |
| GET | `/api/admin/curriculum/chapters/:id` | roles: admin | 112 |
| POST | `/api/admin/curriculum/chapters` | roles: admin | 117 |
| PUT | `/api/admin/curriculum/chapters/:id` | roles: admin | 123 |
| DELETE | `/api/admin/curriculum/chapters/:id` | roles: admin | 129 |
| GET | `/api/admin/curriculum/topics/:id` | roles: admin | 135 |
| POST | `/api/admin/curriculum/topics` | roles: admin | 140 |
| PUT | `/api/admin/curriculum/topics/:id` | roles: admin | 146 |
| DELETE | `/api/admin/curriculum/topics/:id` | roles: admin | 152 |
| POST | `/api/admin/curriculum/subtopics` | roles: admin | 158 |
| PUT | `/api/admin/curriculum/subtopics/:id` | roles: admin | 164 |
| DELETE | `/api/admin/curriculum/subtopics/:id` | roles: admin | 170 |

### curriculum/learner.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/education-levels` |  | 22 |
| GET | `/api/subjects` |  | 27 |
| GET | `/api/topics` |  | 33 |
| GET | `/api/topics/:id` |  | 38 |
| GET | `/api/learning-map` |  | 43 |

### exam/blueprints/blueprints.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/admin/blueprints` | roles: admin | 27 |
| GET | `/api/admin/blueprints/:subject/:kertas` | roles: admin | 33 |
| POST | `/api/admin/blueprints` | roles: admin | 39 |
| POST | `/api/admin/blueprints/:subject/:kertas/versions` | roles: admin | 45 |
| POST | `/api/admin/blueprints/:subject/:kertas/retire` | roles: admin | 51 |
| POST | `/api/admin/blueprints/:subject/:kertas/sections/:position/review` | roles: admin | 58 |
| GET | `/api/admin/blueprints/:subject/:kertas/versions` | roles: admin | 71 |
| GET | `/api/admin/blueprints/:subject/:kertas/pool` | roles: admin | 78 |
| GET | `/api/admin/blueprints/:subject/:kertas/evidence` | roles: admin | 84 |
| POST | `/api/admin/blueprints/:subject/:kertas/evidence` | roles: admin | 90 |
| DELETE | `/api/admin/blueprints/:subject/:kertas/evidence/:evidenceId` | roles: admin | 96 |
| GET | `/api/admin/blueprints/:subject/:kertas/verification` | roles: admin | 107 |
| POST | `/api/admin/blueprints/:subject/:kertas/verify` | roles: admin | 113 |

### exam/blueprints/lookups.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/admin/bijak/dskp/units` | roles: admin | 18 |
| GET | `/api/admin/bijak/subjects` | roles: admin | 24 |

### exam/builder/builder.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/admin/papers` | roles: admin | 22 |
| POST | `/api/admin/papers` | roles: admin | 28 |
| GET | `/api/admin/papers/pool-preview` | roles: admin | 35 |
| POST | `/api/admin/papers/generate` | roles: admin | 42 |
| POST | `/api/admin/papers/preview` | roles: admin | 48 |
| GET | `/api/admin/papers/:id` | roles: admin | 56 |
| PUT | `/api/admin/papers/:id` | roles: admin | 62 |
| DELETE | `/api/admin/papers/:id` | roles: admin | 68 |
| POST | `/api/admin/papers/:id/publish` | roles: admin | 74 |
| GET | `/api/admin/papers/:id/review` | roles: admin | 81 |
| GET | `/api/admin/papers/:id/student-view` | roles: admin | 87 |
| GET | `/api/admin/papers/:id/sections/:sid/pool` | roles: admin | 93 |
| POST | `/api/admin/papers/:id/placements` | roles: admin | 99 |
| DELETE | `/api/admin/papers/:id/placements/:questionId` | roles: admin | 105 |
| POST | `/api/admin/papers/:id/sections` | roles: admin | 112 |
| POST | `/api/admin/papers/:id/sections/:sid/questions` | roles: admin | 119 |
| DELETE | `/api/admin/papers/:id/questions/:questionId` | roles: admin | 126 |
| PUT | `/api/admin/papers/:id/sections/:sid/order` | roles: admin | 132 |
| PUT | `/api/admin/papers/:id/groups/:groupId` | roles: admin | 139 |
| POST | `/api/admin/papers/:id/copy` | roles: admin | 145 |
| POST | `/api/admin/papers/:id/withdraw` | roles: admin | 151 |

### exam/builder/section-pool.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/admin/section-pools/:questionId` | roles: admin | 17 |
| PUT | `/api/admin/section-pools/:questionId` | roles: admin | 23 |

### files/files.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| POST | `/api/files` |  | 146 |
| GET | `/api/files/:id` | PUBLIC | 168 |
| DELETE | `/api/files/:id` |  | 199 |

### games/leagues/leagues.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/leagues` |  | 24 |
| POST | `/api/leagues` |  | 30 |
| POST | `/api/leagues/join` |  | 36 |
| GET | `/api/leagues/:id` |  | 45 |

### games/leagues/sekolah-bersaing.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/sekolah-bersaing` |  | 14 |

### games/rooms/admin/admin-games.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/admin/games` | roles: admin | 16 |
| PUT | `/api/admin/games/settings` | roles: admin | 22 |

### games/rooms/quick-match.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| POST | `/api/papan-bijak/quick-match` |  | 32 |
| GET | `/api/papan-bijak/quick-match/poll` |  | 45 |
| POST | `/api/papan-bijak/quick-match/cancel` |  | 51 |

### games/rooms/rooms.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/games/hub` |  | 35 |
| GET | `/api/games/:game/lobby` |  | 41 |
| POST | `/api/games/:game/rooms` |  | 47 |
| POST | `/api/games/:game/rooms/join` |  | 53 |
| GET | `/api/games/:game/rooms/:code` |  | 60 |
| POST | `/api/games/:game/rooms/:code/start` |  | 66 |
| POST | `/api/games/:game/rooms/:code/action` |  | 73 |

### games/solo/jutawan/jutawan.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/games/jutawan` |  | 19 |
| POST | `/api/games/jutawan/start` |  | 26 |
| POST | `/api/games/jutawan/:sessionId/answer` |  | 33 |
| POST | `/api/games/jutawan/:sessionId/lifeline` |  | 40 |

### games/solo/play/solo.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/games/solo/:game` |  | 24 |
| POST | `/api/games/solo/kad-memori/reveal` |  | 32 |
| POST | `/api/games/solo/:game/check` |  | 41 |
| POST | `/api/games/solo/:game/submit` |  | 50 |

### games/solo/spin/spin.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/games/roda-nasib` |  | 19 |
| POST | `/api/games/roda-nasib/spin` |  | 26 |

### games/solo/weekly/weekly.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/games/pertandingan` |  | 19 |
| GET | `/api/games/uji-minda` |  | 26 |

### gamification/admin.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/admin/gamification/overview` | roles: admin | 26 |
| GET | `/api/admin/gamification/tiers` | roles: admin | 31 |
| POST | `/api/admin/gamification/tiers` | roles: admin | 36 |
| PUT | `/api/admin/gamification/tiers/:id` | roles: admin | 42 |
| POST | `/api/admin/gamification/tiers/:id/toggle` | roles: admin | 48 |
| GET | `/api/admin/gamification/challenges` | roles: admin | 55 |
| POST | `/api/admin/gamification/challenges` | roles: admin | 60 |
| PUT | `/api/admin/gamification/challenges/:id` | roles: admin | 66 |
| POST | `/api/admin/gamification/challenges/:id/toggle` | roles: admin | 72 |
| DELETE | `/api/admin/gamification/challenges/:id` | roles: admin | 79 |
| GET | `/api/admin/gamification/students` | roles: admin | 85 |
| POST | `/api/admin/gamification/award` | roles: admin | 91 |
| GET | `/api/admin/gamification/transactions` | roles: admin | 99 |
| GET | `/api/admin/gamification/settings` | roles: admin | 105 |
| PUT | `/api/admin/gamification/settings` | roles: admin | 110 |
| GET | `/api/admin/reward-control` | roles: admin | 126 |
| PUT | `/api/admin/reward-control/settings` | roles: admin | 131 |
| PUT | `/api/admin/reward-control/rewards/:id/cost` | roles: admin | 137 |
| POST | `/api/admin/reward-control/draws` | roles: admin | 143 |

### gamification/gamification.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/gamification/dashboard` |  | 58 |
| GET | `/api/gamification/challenges` |  | 63 |
| GET | `/api/gamification/leaderboard` |  | 69 |
| GET | `/api/gamification/achievements` |  | 75 |
| GET | `/api/gamification/share-cards` |  | 80 |
| GET | `/api/gamification/referral` |  | 86 |
| GET | `/api/gamification/convert` |  | 91 |
| POST | `/api/gamification/convert` |  | 96 |

### heatmap/heatmap.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/buku-nota/heatmap` | roles: student, admin | 33 |

### intake/dashboard/intake-dashboard.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/intake/dashboard` | roles: admin | 22 |
| GET | `/api/intake/dashboard/cost` | roles: admin | 28 |

### intake/files/intake-files.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| POST | `/api/intake/batches` | roles: teacher, admin | 88 |
| GET | `/api/intake/batches` | roles: teacher, admin | 95 |
| GET | `/api/intake/batches/:id` | roles: teacher, admin | 105 |
| POST | `/api/intake/batches/:id/files` | roles: teacher, admin | 111 |
| POST | `/api/intake/batches/:id/cancel` | roles: teacher, admin | 131 |
| GET | `/api/intake/files/:id/pages` | roles: teacher, admin | 138 |
| GET | `/api/intake/files/:id/pages/:n/image` | roles: teacher, admin | 144 |
| GET | `/api/intake/files/:id/pages/:n/thumb` | roles: teacher, admin | 150 |
| GET | `/api/intake/figures/:id/image` | roles: teacher, admin | 156 |
| GET | `/api/intake/files/:id/original` | roles: teacher, admin | 162 |

### intake/workflow/intake-workflow.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| POST | `/api/intake/batches/:id/extract` | roles: teacher, admin | 64 |
| GET | `/api/intake/batches/:id/review` | roles: teacher, admin | 77 |
| POST | `/api/intake/batches/:id/items` | roles: teacher, admin | 83 |
| POST | `/api/intake/batches/:id/stimuli` | roles: teacher, admin | 90 |
| PATCH | `/api/intake/stimuli/:id` | roles: teacher, admin | 97 |
| POST | `/api/intake/stimuli/:id/link-references` | roles: teacher, admin | 103 |
| DELETE | `/api/intake/stimuli/:id` | roles: teacher, admin | 110 |
| GET | `/api/intake/items` | roles: teacher, admin | 116 |
| POST | `/api/intake/items/bulk` | roles: teacher, admin | 123 |
| GET | `/api/intake/items/:id` | roles: teacher, admin | 130 |
| PATCH | `/api/intake/items/:id` | roles: teacher, admin | 136 |
| POST | `/api/intake/items/:id/accept` | roles: teacher, admin | 142 |
| POST | `/api/intake/items/:id/reject` | roles: teacher, admin | 150 |
| POST | `/api/intake/items/:id/duplicate` | roles: teacher, admin | 157 |

### marketplace/marketplace.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/marketplace/categories` |  | 18 |
| GET | `/api/marketplace/products` |  | 23 |
| GET | `/api/marketplace/products/:slug` |  | 28 |
| POST | `/api/marketplace/products/:slug/whatsapp` |  | 35 |
| GET | `/api/marketplace/sellers/:id` |  | 43 |

### notifications/notifications.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/me/notifications` |  | 49 |
| GET | `/api/me/notifications/unread-count` |  | 55 |
| POST | `/api/me/notifications/read-all` |  | 61 |
| POST | `/api/me/notifications/bulk-read` |  | 68 |
| POST | `/api/me/notifications/bulk-delete` |  | 75 |
| POST | `/api/me/notifications/:id/read` |  | 82 |
| DELETE | `/api/me/notifications/:id` |  | 89 |

### parents/parents.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/me/parent-invite` | roles: student | 58 |
| POST | `/api/me/parent-invite  (and /api/me/parent-invite/generate)` | roles: student | 66 |
| GET | `/api/parent-invites/:token` | PUBLIC | 74 |
| POST | `/api/parent-invites/:token/accept` | roles: parent | 81 |
| GET | `/api/me/parent-links` | roles: student, parent | 92 |
| DELETE | `/api/me/parent-links/:linkId` | roles: student, parent | 99 |
| GET | `/api/admin/parent-links` | roles: admin, school_admin | 107 |
| DELETE | `/api/admin/parent-links/:linkId` | roles: admin, school_admin | 114 |

### pksk/pksk-admin.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/admin/pksk-questions` | roles: admin | 19 |
| GET | `/api/admin/pksk-questions/stats` | roles: admin | 25 |
| POST | `/api/admin/pksk-questions/bulk` | roles: admin | 31 |
| GET | `/api/admin/pksk-questions/:id` | roles: admin | 38 |
| POST | `/api/admin/pksk-questions` | roles: admin | 45 |
| PUT | `/api/admin/pksk-questions/:id` | roles: admin | 51 |
| DELETE | `/api/admin/pksk-questions/:id` | roles: admin | 57 |
| GET | `/api/admin/pksk-access` | roles: admin | 73 |
| GET | `/api/admin/pksk-access/stats` | roles: admin | 79 |
| POST | `/api/admin/pksk-access` | roles: admin | 86 |
| POST | `/api/admin/pksk-access/:id/revoke` | roles: admin | 92 |
| GET | `/api/pksk-packages` | roles: admin | 108 |

### pksk/pksk-student.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/pksk/me/access` |  | 19 |
| GET | `/api/pksk-domains` |  | 25 |
| GET | `/api/pksk/levels/:level/dashboard` |  | 31 |
| GET | `/api/pksk/levels/:level/domains` |  | 37 |
| GET | `/api/pksk/levels/:level/domains/:code` |  | 43 |
| GET | `/api/pksk/levels/:level/exam-attempts` |  | 49 |
| POST | `/api/pksk/levels/:level/domains/:code/practice-sessions` |  | 56 |
| GET | `/api/pksk/levels/:level/exam` |  | 67 |
| POST | `/api/pksk/levels/:level/exam-attempts` |  | 73 |

### practice/practice.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| POST | `/api/practice/sessions` |  | 70 |
| POST | `/api/practice/sessions/:id/check-answer` |  | 76 |
| POST | `/api/practice/sessions/:id/submit` |  | 83 |
| GET | `/api/practice/sessions` |  | 91 |

### practice/reads/analytics/analytics.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/practice/revision` |  | 28 |
| GET | `/api/practice/revision/:code` |  | 33 |
| GET | `/api/practice/progress` |  | 38 |
| GET | `/api/practice/history` |  | 43 |
| GET | `/api/practice/corrections` |  | 48 |
| GET | `/api/practice/mastery` |  | 53 |

### practice/reads/overview/overview.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/dashboard` |  | 36 |
| GET | `/api/practice/subjects` |  | 41 |
| GET | `/api/practice/subjects/:code` |  | 46 |
| GET | `/api/practice/chapter-subjects` |  | 51 |
| GET | `/api/practice/chapter-subjects/:code` |  | 56 |

### practice/reads/writes/writes.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/spm-targets` |  | 27 |
| PUT | `/api/spm-targets` |  | 32 |
| GET | `/api/practice/structured` |  | 48 |
| GET | `/api/practice/structured/:id` |  | 53 |
| POST | `/api/practice/structured/:id/attempts` |  | 58 |

### questions/http/admin.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/questions` | roles: admin | 55 |
| GET | `/api/questions/filter-options` | roles: admin | 64 |
| GET | `/api/questions/summary` | roles: admin | 70 |
| POST | `/api/questions/bulk-action` | roles: admin | 75 |
| POST | `/api/questions/bulk-action/filter` | roles: admin | 93 |
| GET | `/api/questions/:id` | roles: admin | 112 |
| POST | `/api/questions` | roles: admin | 117 |
| PUT | `/api/questions/:id` | roles: admin | 126 |
| POST | `/api/questions/:id/edit-as-draft` | roles: admin | 138 |
| DELETE | `/api/questions/:id` | roles: admin | 146 |

### questions/http/guru.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/guru/questions` | roles: teacher, admin | 39 |
| GET | `/api/guru/questions/:id` | roles: teacher, admin | 45 |
| POST | `/api/guru/questions` | roles: teacher, admin | 50 |
| PUT | `/api/guru/questions/:id` | roles: teacher, admin | 59 |
| DELETE | `/api/guru/questions/:id` | roles: teacher, admin | 69 |

### questions/http/servability.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| POST | `/api/admin/servability/questions/batch` | roles: admin | 55 |
| GET | `/api/admin/servability/questions/:id` | roles: admin | 62 |
| GET | `/api/admin/servability/overview` | roles: admin | 71 |
| GET | `/api/admin/servability/lanes/databank` | roles: admin | 79 |
| GET | `/api/admin/servability/lanes/bijak-spm` | roles: admin | 86 |
| GET | `/api/admin/questions/:id/paper-servability` | roles: admin | 114 |

### questions/http/stimuli.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/stimuli` | roles: admin | 57 |
| GET | `/api/stimulus-groups` | roles: admin | 65 |
| POST | `/api/stimuli` | roles: admin | 73 |
| GET | `/api/stimuli/:id` | roles: admin | 81 |
| PUT | `/api/stimuli/:id` | roles: admin | 86 |
| DELETE | `/api/stimuli/:id` | roles: admin | 95 |
| POST | `/api/stimulus-groups` | roles: admin | 105 |
| GET | `/api/stimulus-groups/:id` | roles: admin | 113 |
| PUT | `/api/stimulus-groups/:id` | roles: admin | 118 |
| DELETE | `/api/stimulus-groups/:id` | roles: admin | 127 |
| POST | `/api/stimulus-groups/:id/members` | roles: admin | 135 |
| DELETE | `/api/stimulus-groups/:id/members/:questionId` | roles: admin | 146 |
| PUT | `/api/stimulus-groups/:id/members` | roles: admin | 154 |
| PUT | `/api/stimulus-groups/:id/members/order` | roles: admin | 164 |
| POST | `/api/stimulus-groups/:id/questions` | roles: admin | 174 |

### questions/http/structured.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/structured-questions` | roles: admin | 15 |
| GET | `/api/structured-questions/:id` | roles: admin | 24 |

### questions/studio/studio.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/questions/studio/dskp` | roles: admin | 18 |

### questions/workflow/ai-explanation/ai-explanation.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| POST | `/api/questions/:id/ai-explanation` |  | 20 |

### questions/workflow/diagram-audit/diagram-audit.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/diagram-audit` |  | 117 |
| POST | `/api/diagram-audit/:kind/:id/image` |  | 131 |
| POST | `/api/diagram-audit/:kind/:id/dismiss` |  | 151 |

### questions/workflow/dskp/dskp.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/guru/dskp/bidang` |  | 18 |
| GET | `/api/guru/dskp/sk` |  | 23 |
| GET | `/api/guru/dskp/sp` |  | 28 |

### questions/workflow/imports/imports.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/question-imports` |  | 32 |
| GET | `/api/question-imports/template` |  | 38 |
| POST | `/api/question-imports` |  | 43 |
| GET | `/api/guru/questions/template` |  | 60 |
| POST | `/api/guru/questions/import` |  | 65 |

### questions/workflow/lifecycle/lifecycle.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/questions/:id/gate-check` |  | 32 |
| POST | `/api/questions/:id/status` |  | 39 |

### questions/workflow/master-notes/master-notes.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/master-notes` |  | 22 |
| POST | `/api/master-notes/:id/:action` |  | 27 |

### questions/workflow/quality/quality.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/question-quality` |  | 16 |
| POST | `/api/question-quality/audit` |  | 21 |

### questions/workflow/reports/reports.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| POST | `/api/question-reports` | roles: student, teacher | 27 |
| GET | `/api/question-reports/mine` |  | 34 |
| GET | `/api/question-reports` |  | 39 |
| PATCH | `/api/question-reports/:id` |  | 45 |

### reports/analytics/http/analytics.controllers.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/monitoring/overview` | roles: admin, teacher, school_admin | 45 |
| GET | `/api/monitoring/export` | roles: admin, teacher, school_admin | 51 |
| GET | `/api/monitoring/schools/:schoolId` | roles: admin, teacher, school_admin | 57 |
| GET | `/api/monitoring/schools/:schoolId/students/:userId` | roles: admin, teacher, school_admin | 63 |
| GET | `/api/monitoring/schools/:schoolId/teachers/:userId` | roles: admin, teacher, school_admin | 69 |
| GET | `/api/teacher/report` | roles: admin, teacher | 87 |
| GET | `/api/teacher/item-analysis` | roles: admin, teacher | 93 |

### reports/kirkpatrick/http/kirkpatrick.controllers.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/kirkpatrick/overview` | roles: admin, teacher, school_admin | 48 |
| GET | `/api/kirkpatrick/reaction` | roles: admin, teacher, school_admin | 54 |
| GET | `/api/kirkpatrick/learning` | roles: admin, teacher, school_admin | 60 |
| GET | `/api/kirkpatrick/behavior` | roles: admin, teacher, school_admin | 66 |
| GET | `/api/kirkpatrick/results` | roles: admin, teacher, school_admin | 72 |
| GET | `/api/kirkpatrick/chain` | roles: admin, teacher, school_admin | 78 |
| GET | `/api/kirkpatrick/filter-options` | roles: admin, teacher, school_admin | 84 |
| GET | `/api/kirkpatrick/students/:id` | roles: admin, teacher, school_admin | 90 |
| GET | `/api/kirkpatrick/me` |  | 96 |
| GET | `/api/kirkpatrick/export-pdf` | roles: admin, teacher, school_admin | 102 |
| GET | `/api/kirkpatrick/interventions` | roles: admin, teacher, school_admin | 119 |
| POST | `/api/kirkpatrick/interventions` | roles: admin, teacher, school_admin | 125 |
| GET | `/api/feedback/status` |  | 143 |
| POST | `/api/feedback` |  | 148 |

### reports/performance/headcount/headcount.controllers.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/headcounts` | roles: admin, teacher, school_admin | 62 |
| GET | `/api/headcounts/dashboard` | roles: admin, teacher, school_admin | 67 |
| GET | `/api/headcounts/form-options` | roles: admin, teacher, school_admin | 72 |
| GET | `/api/headcounts/students/:userId` | roles: admin, teacher, school_admin | 77 |
| POST | `/api/headcounts` | roles: admin, teacher, school_admin | 82 |
| POST | `/api/headcounts/auto-setup` | roles: admin, teacher, school_admin | 88 |
| GET | `/api/headcounts/:id/summary` | roles: admin, teacher, school_admin | 95 |
| GET | `/api/headcounts/:id/export` | roles: admin, teacher, school_admin | 100 |
| GET | `/api/headcounts/:id` | roles: admin, teacher, school_admin | 118 |
| POST | `/api/headcounts/:id/drop-students` | roles: admin, teacher, school_admin | 124 |
| POST | `/api/headcounts/:id/reset` | roles: admin, teacher, school_admin | 131 |
| DELETE | `/api/headcounts/:id` | roles: admin, teacher, school_admin | 138 |

### reports/performance/http/performance.controllers.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/analytics/me` |  | 48 |
| GET | `/api/analytics/classes` | roles: admin, teacher | 54 |
| GET | `/api/performance/students/:userId` |  | 76 |
| GET | `/api/performance/school` |  | 81 |
| GET | `/api/performance/levels` |  | 86 |
| GET | `/api/performance/levels/:code` |  | 92 |
| GET | `/api/performance/classes` |  | 97 |
| GET | `/api/performance/classes/:id` |  | 102 |
| GET | `/api/item-analysis/school` | roles: admin, teacher, school_admin, student, ppd_officer | 119 |
| GET | `/api/item-analysis/school/:schoolId` | roles: admin, teacher, school_admin, student, ppd_officer | 125 |
| GET | `/api/item-analysis/classes` | roles: admin, teacher | 135 |
| GET | `/api/item-analysis/classes/:id` | roles: admin, teacher | 141 |

### reports/performance/http/social.controllers.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/rankings` |  | 50 |
| GET | `/api/leaderboard` |  | 58 |
| GET | `/api/weekly-report` |  | 67 |
| GET | `/api/public/students/:id` | PUBLIC | 81 |

### reports/performance/timeline/timeline.controllers.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/timeline` |  | 75 |
| POST | `/api/timeline` |  | 81 |

### school-admin/amaran/amaran.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/amaran/schools/:id` | roles: admin, school_admin, teacher | 27 |
| GET | `/api/amaran/summary` | roles: admin, school_admin, teacher | 34 |
| GET | `/api/amaran/effectiveness` | roles: admin, school_admin, teacher | 47 |
| GET | `/api/amaran/export/school/:id` | roles: admin, school_admin | 54 |

### school-admin/people/pupils.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/admin-sekolah/pelajar` | roles: school_admin | 28 |
| GET | `/api/admin-sekolah/pelajar/form-options` | roles: school_admin | 34 |
| GET | `/api/admin-sekolah/pelajar/export.csv` | roles: school_admin | 40 |
| GET | `/api/admin-sekolah/pelajar/:id` | roles: school_admin | 50 |
| POST | `/api/admin-sekolah/pelajar` | roles: school_admin | 56 |
| PUT | `/api/admin-sekolah/pelajar/:id` | roles: school_admin | 64 |
| POST | `/api/admin-sekolah/pelajar/:id/reset-password` | roles: school_admin | 70 |

### school-admin/people/teachers.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/admin-sekolah/guru` | roles: school_admin | 27 |
| GET | `/api/admin-sekolah/guru/export.csv` | roles: school_admin | 33 |
| GET | `/api/admin-sekolah/guru/:id` | roles: school_admin | 43 |
| POST | `/api/admin-sekolah/guru` | roles: school_admin | 49 |
| PUT | `/api/admin-sekolah/guru/:id` | roles: school_admin | 57 |
| POST | `/api/admin-sekolah/guru/:id/toggle-active` | roles: school_admin | 63 |
| POST | `/api/admin-sekolah/guru/:id/reset-password` | roles: school_admin | 70 |

### school-admin/reports/school-reports.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/admin-sekolah/usage` | roles: school_admin | 40 |
| GET | `/api/admin-sekolah/laporan-aktiviti` | roles: school_admin | 48 |
| GET | `/api/admin-sekolah/laporan-bulanan` | roles: school_admin | 56 |
| GET | `/api/admin-sekolah/dskp-heatmap` | roles: school_admin | 63 |
| GET | `/api/admin-sekolah/kelas` | roles: school_admin | 71 |

### school-admin/school-admin.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/admin-sekolah/dashboard` | roles: school_admin | 30 |
| GET | `/api/admin-sekolah/guru/pending` | roles: school_admin | 41 |
| POST | `/api/admin-sekolah/guru/:id/verify` | roles: school_admin | 47 |

### schools/schools.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/admin/schools` | roles: admin | 68 |
| GET | `/api/admin/schools/options` | roles: admin | 75 |
| GET | `/api/admin/schools/:id` | roles: admin | 81 |
| POST | `/api/admin/schools` | roles: admin | 87 |
| PUT | `/api/admin/schools/:id` | roles: admin | 93 |
| POST | `/api/admin/schools/:id/toggle` | roles: admin | 99 |
| GET | `/api/schools` | roles: admin | 107 |
| GET | `/api/schools/search` | PUBLIC | 124 |
| GET | `/api/jpn` | PUBLIC | 130 |
| GET | `/api/jpn/:id/ppd` | PUBLIC | 136 |

### shop/admin.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/admin/hadiah` | roles: admin | 24 |
| POST | `/api/admin/hadiah/bulk` | roles: admin | 29 |
| GET | `/api/admin/hadiah/redemptions` | roles: admin | 36 |
| POST | `/api/admin/hadiah/redemptions/:id/deliver` | roles: admin | 41 |
| POST | `/api/admin/hadiah/redemptions/:id/cancel` | roles: admin | 48 |
| GET | `/api/admin/hadiah/:id` | roles: admin | 55 |
| POST | `/api/admin/hadiah` | roles: admin | 60 |
| PUT | `/api/admin/hadiah/:id` | roles: admin | 66 |

### shop/shop.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/hadiah-digital/items` |  | 34 |
| GET | `/api/hadiah-digital/redemptions` |  | 39 |
| POST | `/api/hadiah/redemptions` |  | 44 |
| GET | `/api/gamification/mystery-boxes` |  | 50 |
| POST | `/api/gamification/mystery-boxes/:id/open` |  | 55 |
| GET | `/api/cabutan` |  | 62 |
| POST | `/api/cabutan/:drawId/tickets` |  | 67 |

### spm/duta.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/duta/recommendations` |  | 13 |

### spm/mocks.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/spm-mocks` |  | 28 |
| POST | `/api/spm-mocks` |  | 33 |
| GET | `/api/spm-mocks/:id` |  | 40 |
| POST | `/api/spm-mocks/:id/submit` |  | 45 |
| GET | `/api/spm-mocks/:id/result` |  | 51 |

### spm/spm.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/spm/overview` |  | 25 |
| GET | `/api/spm/databank` |  | 30 |
| GET | `/api/spm/latih-tubi` |  | 35 |
| GET | `/api/spm/latih-tubi/:code` |  | 40 |
| GET | `/api/spm/tracking-a` |  | 45 |
| GET | `/api/spm/tracking-a/:code` |  | 50 |
| GET | `/api/spm/subjektif` |  | 55 |

### spm/walkthrough.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| POST | `/api/spm-walkthrough/solve` |  | 68 |

### sponsorship/sponsorship.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| POST | `/api/mohon-keluarga-angkat` |  | 20 |

### subscriptions/comp-students/comp-students.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/admin/comp-students` | roles: admin | 21 |
| POST | `/api/admin/comp-students` | roles: admin | 27 |
| POST | `/api/admin/comp-students/bulk-action` | roles: admin | 33 |
| GET | `/api/admin/comp-students/:id` | roles: admin | 40 |
| POST | `/api/admin/comp-students/:id/toggle-coins` | roles: admin | 46 |
| POST | `/api/admin/comp-students/:id/toggle-active` | roles: admin | 53 |

### subscriptions/quota.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/admin/schools/:id/quota` | roles: admin | 67 |
| POST | `/api/admin/students/import` | roles: admin | 74 |

### subscriptions/subscriptions.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/admin/school-packages` | roles: admin | 37 |
| GET | `/api/admin/school-subscriptions` | roles: admin | 43 |
| POST | `/api/admin/school-subscriptions` | roles: admin | 52 |
| GET | `/api/admin/school-subscriptions/:id` | roles: admin | 58 |
| GET | `/api/admin/school-subscriptions/:id/students` | roles: admin | 64 |
| GET | `/api/admin/school-subscriptions/:id/renewal-invoice` | roles: admin | 70 |
| PUT | `/api/admin/school-subscriptions/:id/quota` | roles: admin | 76 |
| POST | `/api/admin/school-subscriptions/:id/extend` | roles: admin | 86 |
| POST | `/api/admin/school-subscriptions/:id/upgrade` | roles: admin | 97 |
| POST | `/api/admin/school-subscriptions/:id/cancel` | roles: admin | 108 |

### subscriptions/user-packages.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/admin/users/:id/packages` | roles: admin | 18 |
| POST | `/api/admin/users/:id/packages` | roles: admin | 25 |

### support/support.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/tiket` |  | 55 |
| POST | `/api/tiket` |  | 62 |
| GET | `/api/admin/tiket` | roles: admin | 75 |
| GET | `/api/admin/tiket/open-count` | roles: admin | 82 |
| GET | `/api/config/support` | PUBLIC | 96 |

### users/lookups.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/students/search` | roles: admin, school_admin, teacher | 24 |
| GET | `/api/admin/teachers` | roles: admin, school_admin | 34 |
| GET | `/api/admin/teachers/:id/classrooms` | roles: admin, school_admin | 42 |
| GET | `/api/admin/schools/:id/students` | roles: admin, school_admin | 49 |

### users/users.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/admin/users` | roles: admin, school_admin | 84 |
| GET | `/api/admin/users/filters` | roles: admin, school_admin | 93 |
| GET | `/api/admin/users/:id` | roles: admin, school_admin | 99 |
| POST | `/api/admin/users` | roles: admin, school_admin | 105 |
| POST | `/api/admin/users/bulk-delete` | roles: admin, school_admin | 114 |
| POST | `/api/admin/users/bulk-import` | roles: admin, school_admin | 125 |
| PUT | `/api/admin/users/:id` | roles: admin, school_admin | 150 |
| DELETE | `/api/admin/users/:id` | roles: admin, school_admin | 160 |
| POST | `/api/admin/users/:id/toggle-active` | roles: admin, school_admin | 166 |

### wallet/wallet.controller.ts

| Method | Path | Guard | Line |
|---|---|---|---|
| GET | `/api/gamification/wallet` |  | 48 |
| GET | `/api/gamification/transactions` |  | 53 |
| GET | `/api/me/gamification-summary` |  | 67 |
