# API catalogue part B1: core, identity (M01, M02) and curriculum (M03)

Part of the v2 API catalogue (index: `docs/architecture/v2-api-catalogue.md`, assembled by the lead). The frontend mock is the behavioural spec: this part documents what the mock handlers do today, not what they should do. Where the mock, the SRS, a BE card or the contract disagree, the disagreement is listed in "Open questions" (OQ-API-B1-n) and nothing is invented.

## 1. Scope and counts

Sources read: `src/mock/**` (server, auth middleware, core-data), `src/modules/m01-authentication/mock/**`, `src/modules/m02-users-schools/mock/**`, `src/modules/m03-curriculum/mock/**`, the module `api/` clients and types, `packages/contract/src/**`, `docs/plan/backend-tasks/BE-03/05/06/07/08/25`, `docs/requirements/role-access-matrix.md`.

Count method (re-runnable): a script (`scratchpad/docs-owner/api-b1/count.mjs`) matches `route(\s*'METHOD',\s*'/api/...'` across lines (so multi-line registrations are found), skips `__tests__`, and the result was cross-checked with `grep -rEc "\broute\(" <dir> --include=*.ts`.

| Group | Mock `route(` registrations | Contract-only (no mock handler) | Notes |
|---|---:|---:|---|
| Core (`src/mock/core-data`) | 3 | 0 | `GET /api/me`, `GET /api/me/gamification-summary`, `GET /api/admin/server-status`. The "about 44" in the brief = these 3 + 41 test-only registrations in `src/mock/server/__tests__/*` (helpers 8, router 19, server 13, transport 1), which are not endpoints; 2 more hits in `src/mock/server/router.ts` are doc comments. |
| Session/auth contract | 0 | 4 | `GET /session`, `POST /session/role`, `POST /session/mode`, `DELETE /session/mode` exist only in `packages/contract` (BE-03). Section 5. |
| M01 authentication | 19 | 0 | = M01 SRS §7 #1–#6, #8–#19, #21 (SRS #7 `GET /api/me` is the core route; SRS #20 school search is M02-42). The plan/brief figure "17" is stale. |
| M02 users and schools | 49 | 0 | = M02 SRS §7 #1–#43 (43) + L45 parent invites (4) + `GET /api/admin/schools/options` (XL-13 alias) + `GET /api/admin/config/defaults` (proposed, not in SRS §7). The plan figure "43" is the SRS count only. |
| M03 curriculum | 29 | 0 | = M03 SRS §7 #1–#29. The plan/brief figure "12" is stale. |
| **Total** | **100** | **4** | 104 endpoint sections. |

Contract status totals (packages/contract/src/openapi.ts registers 6 paths, all in `session/paths.ts`): `exists` 4 (all contract-only), `partial` 2 (`POST /auth/login`, `POST /auth/logout`: path and schema registered but the shape differs from the mock, OQ-API-B1-1), `missing` 98 (every other mock route). Card coverage (after the LEAD card audit, commit 63d363c): every route is listed in a BE card endpoint table, 0 **UNCOVERED** (section 10 records what changed).

Reference prefixes used in "Source" lines (all under `src/`): `core/` = `mock/core-data/`, `m01/` = `modules/m01-authentication/mock/handlers/`, `m02/` = `modules/m02-users-schools/mock/handlers/`, `m03/` = `modules/m03-curriculum/mock/handlers/`; client files are `modules/mNN-*/api/*.ts`. Line numbers are of the `route(` registration (R) and the handler function (H).

## 2. Wire conventions that apply to every endpoint

Defined in `src/mock/server/respond.ts`, `paginate.ts`, `validate.ts`, `auth/middleware.ts`, `src/api/client.ts`. Endpoint blocks refer to these by name.

> **UD-1 (user decision 2026-10-19):** where this part describes the mock auth/session wire (Bearer token, `{token, expiresAt, user}` login body, 422 for bad credentials, integer ids), the real API follows the contract instead; the LEAD realigns the mock and `HttpTransport` (V2-T31).

### 2.1 Envelopes

| Name | Body | Produced by |
|---|---|---|
| `Env-D` | `{ data }`, HTTP 200 | `ok(data)` |
| `Env-DS` | `{ data, status: "<BM flash text>" }`, HTTP 200 or 201. `status` is a sibling of `data` (the frontend calls these with `raw: true` and shows `status` in a green alert) | `ok(data, { status })`, `created(data, { status })` |
| `Env-L` | `{ data: [...], meta }` HTTP 200. `meta` = `{ page, pageSize, totalItems, totalPages, from, to }` + module extras (`counts`, `roleCounts`, `types`) | `paged`, `paginate`, `unpaged` |
| `Env-204` | no body, HTTP 204 | `noContent()` |
| `Env-Err` | `{ error: { code, message, fields?, retryAfter? } }`; `retryAfter` (seconds) also sent as `Retry-After` header on 429 | `fail()` |

Pagination rules (Laravel style): `page` query value that is missing or not a positive integer means page 1; the page size is fixed per endpoint (it is not a client parameter unless stated); an out-of-range page is not an error, it returns `data: []` with the requested `page`; `totalPages = max(1, ceil(totalItems/pageSize))`; `from`/`to` are 1-based positions or `null` on an empty page. `unpaged` (lists live does not paginate): `page 1`, `pageSize = max(1, n)`, `totalItems n`, `totalPages 1`, `from 1|null`, `to n|null`. Extra meta can never override these fields.

### 2.2 Authentication and guards (`src/mock/auth/middleware.ts`)

The mock authenticates with `Authorization: Bearer <token>` (OQ-API-B1-2: the real API uses the HTTP-only cookie session + `X-CSRF-Token`, BE-03). Guards used by this part:

| Guard | No/dead session | Wrong role | Meaning |
|---|---|---|---|
| none (`public`) | passes | passes | `req.session` is still filled when a valid token is sent (used by parent-invite preview) |
| `requireAuth()` | `401 UNAUTHORIZED` | n/a | any logged-in role |
| `requireRole(r…)` | `401 UNAUTHORIZED` | `403 FORBIDDEN` | role must be one of the list |
| handler-side `if (!req.session) return 401` | `401` | n/a | `GET /api/students/search` |

Session roles in the mock: `student, teacher, parent, sponsor, school_admin, ppd_officer, jpn_officer, admin` (`MockRole`). Session lifetime: no "remember" = 120 min sliding (re-slid at most once per interval); "remember" = 5 years, non-sliding (`mock/auth/sessions.ts`). Token format `pp_` + 40 chars. Unknown route: `404 NOT_FOUND "Not Found."`. Unhandled error: `500 SERVER_ERROR "Server Error"`.

### 2.3 Default error messages (English, Laravel defaults; `respond.ts:31`)

| Name | Status | code | message |
|---|---|---|---|
| `E401` | 401 | `UNAUTHORIZED` | `Unauthenticated.` |
| `E403` | 403 | `FORBIDDEN` | `This action is unauthorized.` |
| `E404` | 404 | `NOT_FOUND` | `Not Found.` (some M03 routes use a BM message instead, stated per endpoint) |
| `E429` | 429 | `RATE_LIMITED` | `Too Many Attempts.` (default; login and reset use their own text) |
| `E500` | 500 | `SERVER_ERROR` | `Server Error` |
| `E422` | 422 | `VALIDATION_ERROR` | top-level `message` = first field message + ` (and N more error(s))`; `fields` = `{ field: message }`, one message per field (first failing rule). Default text when no field: `The given data was invalid.` |

(OQ-API-B1-3: the contract `AUTH_ERROR_MESSAGES` are BM; the mock's generic messages are English. The BE-03 card requires the contract copy for auth codes only.)

### 2.4 Validation message templates (`validate.ts`, `:attribute` = field name in words, camelCase/snake_case split to lower-case words, e.g. `icNumber` -> `ic number`)

| Rule | Message |
|---|---|
| required | `The :attribute field is required.` |
| email | `The :attribute field must be a valid email address.` |
| min (number / string / array / file) | `The :attribute field must be at least :n.` / `... at least :n characters.` / `... at least :n items.` / `... at least :n kilobytes.` |
| max (number / string / array / file) | `The :attribute field must not be greater than :n.` / `... not be greater than :n characters.` / `... not have more than :n items.` / `... not be greater than :n kilobytes.` |
| in (oneOf) / exists | `The selected :attribute is invalid.` |
| unique | `The :attribute has already been taken.` |
| confirmed | `The :attribute field confirmation does not match.` (compares with `<field>Confirmation`) |
| integer | `The :attribute field must be an integer.` |
| string | `The :attribute field must be a string.` |
| boolean | `The :attribute field must be true or false.` |
| array | `The :attribute field must be an array.` |
| date_format H:i | `The :attribute field must match the format H:i.` |
| mimes | `The :attribute field must be a file of type: jpeg, png, webp.` |
| regex | `The :attribute field format is invalid.` |

Rules other than `required` are skipped for an empty value (`undefined`, `null`, blank string, empty array); each field reports its first failing rule; min/max on strings count characters (code points). Messages in this table are "UNVERIFIED COPY" in the SRS (Laravel defaults); a few handlers override them with BM (stated per endpoint).

### 2.5 Request body normalisation

M01 `bodyOf`, M02 `bodyOf`, M03 `normalise` mimic Laravel `TrimStrings` + `ConvertEmptyStringsToNull`: string values are trimmed and a blank string becomes `null`; password fields (`password`, `passwordConfirmation`, `currentPassword`, `newPassword`, `newPasswordConfirmation`) are never trimmed. A body that is not a plain JSON object becomes `{}`. Integers may arrive as numbers or digit strings (multipart). Booleans follow Laravel `boolean()` (`true,1,"1","true","on","yes"` for M01/M02 `toBool`; M03/M02-schools `asBoolean` accepts `true,false,1,0,"1","0"` only).

### 2.6 Ids and timestamps

Mock ids are integers (users and schools from fixtures; runtime users from 9,000,001, mock-only); the contract and the BE plan require opaque string ids (OQ-API-B1-4). Timestamps are ISO 8601 with `+08:00` (`toIsoMyt`); date-only fields are `YYYY-MM-DD`.

## 3. Summary table

Roles: `any` = any logged-in role; `public` = no session needed; `admin` = Admin Pusat only (`requireRole('admin')`); matrix = `docs/requirements/role-access-matrix.md` (it covers Murid/Guru/Admin Sekolah menu items only; Admin Pusat is out of that file, see v2-portals). Card `UNCOVERED` = no BE card endpoint table lists it (scope owner in brackets). Contract: `exists` / `partial` / `missing`.

| ID | Method | Path | Roles (as coded) | Card | Contract |
|---|---|---|---|---|---|
| C-01 | GET | `/api/me` | any | BE-06 | missing |
| C-02 | GET | `/api/me/gamification-summary` | any | BE-11 | missing |
| C-03 | GET | `/api/admin/server-status` | admin | BE-22 | missing |
| S-01 | GET | `/api/session` | any (contract) | BE-03 | exists |
| S-02 | POST | `/api/session/role` | any (contract) | BE-03 | exists |
| S-03 | POST | `/api/session/mode` | admin, school_admin (contract) | BE-03 | exists |
| S-04 | DELETE | `/api/session/mode` | any (contract) | BE-03 | exists |
| M01-01 | POST | `/api/auth/login` | public | BE-03 | partial |
| M01-02 | POST | `/api/auth/register` | public | BE-06 | missing |
| M01-03 | POST | `/api/auth/password/email` | public | BE-06 | missing |
| M01-04 | POST | `/api/auth/password/reset` | public | BE-06 | missing |
| M01-05 | POST | `/api/auth/password/reset-ic` | public | BE-06 | missing |
| M01-06 | POST | `/api/auth/logout` | public | BE-03 | partial |
| M01-07 | PUT | `/api/me` | any | BE-06 | missing |
| M01-08 | POST | `/api/me/picture` | any | BE-06 | missing |
| M01-09 | PUT | `/api/me/password` | any | BE-06 | missing |
| M01-10 | GET | `/api/me/settings` | any | BE-06 | missing |
| M01-11 | PUT | `/api/me/settings` | any | BE-06 | missing |
| M01-12 | GET | `/api/me/notifications` | any (own) | BE-06 | missing |
| M01-13 | GET | `/api/me/notifications/unread-count` | any (own) | BE-06 | missing |
| M01-14 | POST | `/api/me/notifications/read-all` | any (own) | BE-06 | missing |
| M01-15 | POST | `/api/me/notifications/bulk-read` | any (own) | BE-06 | missing |
| M01-16 | POST | `/api/me/notifications/bulk-delete` | any (own) | BE-06 | missing |
| M01-17 | POST | `/api/me/notifications/:id/read` | any (own) | BE-06 | missing |
| M01-18 | DELETE | `/api/me/notifications/:id` | any (own) | BE-06 | missing |
| M01-19 | GET | `/api/public/stats` | public | BE-06 | missing |
| M02-01 | GET | `/api/admin/users` | admin | BE-05 | missing |
| M02-02 | GET | `/api/admin/users/filters` | admin | BE-05 | missing |
| M02-03 | GET | `/api/admin/users/:id` | admin | BE-05 | missing |
| M02-04 | POST | `/api/admin/users` | admin | BE-05 | missing |
| M02-05 | PUT | `/api/admin/users/:id` | admin | BE-05 | missing |
| M02-06 | DELETE | `/api/admin/users/:id` | admin | BE-05 | missing |
| M02-07 | POST | `/api/admin/users/bulk-delete` | admin | BE-05 | missing |
| M02-08 | POST | `/api/admin/users/:id/toggle-active` | admin | BE-05 | missing |
| M02-09 | POST | `/api/admin/users/:id/impersonate` | admin | UNCOVERED (dropped by user decision, UD-2) | missing |
| M02-10 | GET | `/api/students/search` | any | BE-05 | missing |
| M02-11 | GET | `/api/admin/users/:id/packages` | admin | BE-25 | missing |
| M02-12 | POST | `/api/admin/users/:id/packages` | admin | BE-25 | missing |
| M02-13 | POST | `/api/admin/users/bulk-import` | admin | BE-05 | missing |
| M02-14 | POST | `/api/admin/students/import` | admin | BE-25 | missing |
| M02-15 | GET | `/api/admin/schools/:id/quota` | admin | BE-25 | missing |
| M02-16 | GET | `/api/admin/schools/:id/students` | admin | BE-05 | missing |
| M02-17 | GET | `/api/admin/comp-students` | admin | BE-25 | missing |
| M02-18 | POST | `/api/admin/comp-students` | admin | BE-25 | missing |
| M02-19 | GET | `/api/admin/comp-students/:id` | admin | BE-25 | missing |
| M02-20 | POST | `/api/admin/comp-students/bulk-action` | admin | BE-25 | missing |
| M02-21 | POST | `/api/admin/comp-students/:id/toggle-coins` | admin | BE-25 | missing |
| M02-22 | POST | `/api/admin/comp-students/:id/toggle-active` | admin | BE-25 | missing |
| M02-23 | GET | `/api/admin/teachers` | admin | BE-05 | missing |
| M02-24 | GET | `/api/admin/teachers/:id/classrooms` | admin | BE-05 | missing |
| M02-25 | GET | `/api/admin/schools` | admin | BE-05 | missing |
| M02-26 | GET | `/api/admin/schools/:id` | admin | BE-05 | missing |
| M02-27 | POST | `/api/admin/schools` | admin | BE-05 | missing |
| M02-28 | PUT | `/api/admin/schools/:id` | admin | BE-05 | missing |
| M02-29 | POST | `/api/admin/schools/:id/toggle` | admin | BE-05 | missing |
| M02-30 | GET | `/api/admin/schools/options` | admin | BE-05 | missing |
| M02-31 | GET | `/api/schools` (`?all=1`) | admin | BE-05 (listed as public, OQ) | missing |
| M02-32 | GET | `/api/admin/school-subscriptions` | admin | BE-25 | missing |
| M02-33 | GET | `/api/admin/school-packages` | admin | BE-25 | missing |
| M02-34 | POST | `/api/admin/school-subscriptions` | admin | BE-25 | missing |
| M02-35 | GET | `/api/admin/school-subscriptions/:id` | admin | BE-25 | missing |
| M02-36 | GET | `/api/admin/school-subscriptions/:id/students` | admin | BE-25 | missing |
| M02-37 | PUT | `/api/admin/school-subscriptions/:id/quota` | admin | BE-25 | missing |
| M02-38 | POST | `/api/admin/school-subscriptions/:id/extend` | admin | BE-25 | missing |
| M02-39 | POST | `/api/admin/school-subscriptions/:id/upgrade` | admin | BE-25 | missing |
| M02-40 | POST | `/api/admin/school-subscriptions/:id/cancel` | admin | BE-25 | missing |
| M02-41 | GET | `/api/admin/school-subscriptions/:id/renewal-invoice` | admin | BE-25 | missing |
| M02-42 | GET | `/api/schools/search` | public | BE-05 | missing |
| M02-43 | GET | `/api/jpn` | public | BE-05 | missing |
| M02-44 | GET | `/api/jpn/:id/ppd` | public | BE-05 | missing |
| M02-45 | GET | `/api/me/parent-invite` | student | BE-25 | missing |
| M02-46 | POST | `/api/me/parent-invite/generate` | student | BE-25 | missing |
| M02-47 | GET | `/api/parent-invites/:token` | public (viewer from token) | BE-25 | missing |
| M02-48 | POST | `/api/parent-invites/:token/accept` | parent | BE-25 | missing |
| M02-49 | GET | `/api/admin/config/defaults` | admin | BE-05 | missing |
| M03-01 | GET | `/api/admin/subjects` | admin | BE-08 | missing |
| M03-02 | GET | `/api/admin/subjects/:id` | admin | BE-08 | missing |
| M03-03 | POST | `/api/admin/subjects` | admin | BE-08 | missing |
| M03-04 | PUT | `/api/admin/subjects/:id` | admin | BE-08 | missing |
| M03-05 | PATCH | `/api/admin/subjects/:id/active` | admin | BE-08 | missing |
| M03-06 | DELETE | `/api/admin/subjects/:id` | admin | BE-08 | missing |
| M03-07 | GET | `/api/admin/education-levels` | admin | BE-08 | missing |
| M03-08 | GET | `/api/admin/education-levels/:id` | admin | BE-08 | missing |
| M03-09 | POST | `/api/admin/education-levels` | admin | BE-08 | missing |
| M03-10 | PUT | `/api/admin/education-levels/:id` | admin | BE-08 | missing |
| M03-11 | PATCH | `/api/admin/education-levels/:id/active` | admin | BE-08 | missing |
| M03-12 | DELETE | `/api/admin/education-levels/:id` | admin | BE-08 | missing |
| M03-13 | GET | `/api/admin/curriculum` | admin | BE-08 | missing |
| M03-14 | GET | `/api/admin/curriculum/chapters/:id` | admin | BE-08 | missing |
| M03-15 | POST | `/api/admin/curriculum/chapters` | admin | BE-08 | missing |
| M03-16 | PUT | `/api/admin/curriculum/chapters/:id` | admin | BE-08 | missing |
| M03-17 | DELETE | `/api/admin/curriculum/chapters/:id` | admin | BE-08 | missing |
| M03-18 | GET | `/api/admin/curriculum/topics/:id` | admin | BE-08 | missing |
| M03-19 | POST | `/api/admin/curriculum/topics` | admin | BE-08 | missing |
| M03-20 | PUT | `/api/admin/curriculum/topics/:id` | admin | BE-08 | missing |
| M03-21 | DELETE | `/api/admin/curriculum/topics/:id` | admin | BE-08 | missing |
| M03-22 | POST | `/api/admin/curriculum/subtopics` | admin | BE-08 | missing |
| M03-23 | PUT | `/api/admin/curriculum/subtopics/:id` | admin | BE-08 | missing |
| M03-24 | DELETE | `/api/admin/curriculum/subtopics/:id` | admin | BE-08 | missing |
| M03-25 | GET | `/api/topics` | any | BE-08 | missing |
| M03-26 | GET | `/api/topics/:id` | any | BE-08 | missing |
| M03-27 | GET | `/api/learning-map` | any | BE-08 | missing |
| M03-28 | GET | `/api/subjects` | any | BE-08 | missing |
| M03-29 | GET | `/api/education-levels` | any | BE-08 | missing |

Matrix note: section A of the role-access matrix (Profil Saya, Tetapan Peribadi, Log Keluar...) allows every role, which matches `requireAuth()` on all `/api/me*` routes. `Topik` and `Peta Belajar` (matrix B #24, #25) are Murid-only menu items, but the mock endpoints M03-25..27 accept any session (the menu hides them; the API does not restrict, OQ-API-B1-12).

## 4. Core endpoints (`src/mock/core-data`, owner: core / M01 / M14 / M17)

`UserMe` (used by C-01, M01-01, M01-02, M01-04, M01-07, M02-09) is defined in `core/me.ts:21` and `modules/m01-authentication/api/types.ts`:

| Field | Type | Notes |
|---|---|---|
| `id` | number (contract: string) | |
| `name`, `email` | string | |
| `phone`, `bio`, `avatarUrl` | string or null | `avatarUrl` is a data URL in the mock (OQ-API-B1-9) |
| `role` | one of the 8 mock roles | contract `RoleCode` has no `jpn_officer` (OQ-API-B1-5) |
| `grade` | number 1-11 or null | students only |
| `schoolId` | number or null | |
| `createdAt`, `updatedAt` | ISO +08:00 | |
| `lastLoginAt` | ISO +08:00 or null | |
| `school` | `SchoolSummary` or null | `{ id, name, code, type, state, district, city }`; `district`, `city` nullable; `code` is `''` when none |
| `landingPath` | string | server-computed per role (`mock/auth/landing.ts`): admin `/admin`, ppd_officer `/ppd/dashboard`, jpn_officer `/jpn/dashboard`, all others `/dashboard` (contract v2 uses a different table, OQ-API-B1-5) |

### C-01 `GET /api/me`
> **User decision 2026-10-19 (UD-1): the real API follows the contract: ids are decimal strings, cookie session plus `X-CSRF-Token`, `Session` shape and `/api/session*`, no Bearer. The mock shape described below is realigned by the LEAD (V2-T31); build to the contract, not to this mock shape.**
- Purpose: the logged-in user (M01 SRS #7; implemented in the core, not M01). Also re-fetched in the background (FR-M01-52).
- Auth: `requireAuth()`; matrix section A (all roles).
- Request: none.
- Response: 200 `Env-D` with `UserMe`.
- Errors: 401 `E401` (also when the session user row is not a session role).
- Side effects: none (the session resolver may slide the expiry, `mock/auth/sessions.ts`).
- Owner: core (M01 contract). Source: `core/routes.ts` R:62. Client: `modules/m01-authentication/api/account.ts` `getMe`; `stores/session.ts:313`.
- Card: BE-06 (must agree with `GET /api/session`, BE-06 AC7). Contract: missing.

### C-02 `GET /api/me/gamification-summary`
- Purpose: header chips (coins, points, streak).
- Auth: `requireAuth()`.
- Request: none.
- Response: 200 `Env-D` `{ coins: number, points: number, streakDays: number }`. `coins` = M14 `wallet.summary.currentSyiling`, `points` = `xp`, `streakDays` = `streak.get.current`; a user without wallet/streak rows (or an M14-less boot) reads `0/0/0`.
- Errors: 401 `E401`.
- Side effects: none.
- Owner: core reading M14. Source: `core/routes.ts` R:66, H:`gamificationSummaryOf` :40. Client: `shells/user/useGamificationSummary.ts:14`.
- Card: BE-11. Contract: missing.

### C-03 `GET /api/admin/server-status`
- Purpose: header server-health pill (Admin Pusat only).
- Auth: `requireRole('admin')` (FR-M17-06, SEC-M17-10).
- Request: none. Polled every 30 s by the UI.
- Response: 200 `Env-D` `{ cpuPct, ramPct, diskPct: number (0-100); uptime: string "<d>d <h>h"; load: number; cores: number; ramUsedGb, ramTotalGb, diskUsedGb, diskTotalGb: number (1 decimal) }`. The mock returns a deterministic fixture that steps every 30 s (4 samples: first = observed live reading cpu 6, ram 52, disk 50, load 0.15, 8 cores, RAM total 31.1 GB, disk total 398.7 GB, uptime from 204d 2h). A real backend returns real host readings with the same field names; thresholds (CPU 50/80, RAM 60/85, Disk 75/90) live in the frontend.
- Errors: 401 `E401`; 403 `E403`.
- Side effects: none.
- Owner: M17. Source: `core/server-status.ts` R:81. Client: `shells/admin/server-status.ts:12`.
- Card: BE-22. Contract: missing. `diskUsedGb`/`diskTotalGb` are INFERRED fields (file header).

## 5. Session contract endpoints with no mock handler

The contract (`packages/contract/src/session/paths.ts`, registered in `openapi.ts`) defines these; the mock has no `route(...)` for them and the frontend does not call them yet (the mock session is `localStorage['pp.auth']` + Bearer; Mod Pelajar is emulated through M02-09, see OQ-API-B1-2, OQ-API-B1-6). They are documented from the contract and BE-03 so the backend card has one reference. Paths below are relative to `/api` in the contract and `/api/...` on the wire. All use the `Env-D` `{ data: Session }` envelope; authenticated mutating requests need header `X-CSRF-Token` equal to `Session.csrf`.

`Session` (contract `session/session.ts`): `{ user: { id, name, email|null, username|null, avatarUrl|null, schoolId|null }, roles: RoleGrant[] (min 1; unique; student never combined; admin single-role), active: { role, portal, scope, via: 'direct'|'mod_pelajar' }, mode: { kind:'mod_pelajar', returnRole, since, isTest:true } | null, capabilities: CapabilityKey[], landingPath: string (starts with '/'), expiresAt: Timestamp(+08:00), csrf: string }`. `RoleGrant` = `{ role, portal ('pentadbiran'|'pembelajaran'), scope: { level, stateCode?, districtCode?, schoolId?, label } }`. Tokens are never returned in the body, only `csrf`.

BM error copy (contract `auth/errors.ts` `AUTH_ERROR_MESSAGES`, code to status in `AUTH_ERROR_STATUS`):

| code | HTTP | message |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | `E-mel/Nama pengguna atau kata laluan tidak sah.` |
| `ACCOUNT_INACTIVE` | 403 | `Akaun anda tidak aktif atau telah digantung. Sila hubungi pentadbir.` |
| `SCHOOL_INACTIVE` | 403 | `Sekolah anda belum diaktifkan oleh pentadbir. Sila hubungi pihak sekolah.` |
| `AMBIGUOUS_USERNAME` | 422 | `Nama pengguna ini wujud di lebih daripada satu sekolah. Sila pilih sekolah anda.` (+ `details.schools: [{id,name}]`) |
| `ROLE_NOT_ALLOWED` | 403 | `Peranan ini tidak tersedia untuk akaun anda.` |
| `MODE_ACTIVE` | 409 | `Sila keluar daripada Mod Pelajar sebelum menukar peranan.` |
| `MODE_ALREADY_ACTIVE` | 409 | `Mod Pelajar sedang aktif.` |
| `MODE_NOT_ALLOWED` | 403 | `Mod Pelajar tidak tersedia untuk peranan anda.` |
| `NO_MODE_ACTIVE` | 409 | `Tiada mod yang sedang aktif.` |
| `CSRF_INVALID` | 403 | `Sesi tidak sah. Sila muat semula halaman dan cuba lagi.` |
| `RATE_LIMITED` | 429 | `Terlalu banyak percubaan. Sila cuba sebentar lagi.` (+ `retryAfter`) |

### S-01 `GET /api/session`
- Purpose: one call resolves roles, active role, scope, capabilities, mode, landing path.
- Auth: any session. Request: none. Response: 200 `{ data: Session }`. Errors: 401 `UNAUTHORIZED`.
- Side effects: none. Owner: core/M01. Source: contract `paths.ts` (no mock). Client: none yet.
- Card: BE-03. Contract: exists.

### S-02 `POST /api/session/role`
- Purpose: switch the active role (multi-role accounts).
- Auth: any session + CSRF header. Request body (strict): `{ role: RoleCode }`; the role must be in the account's role list; a `scope` key or any unknown key is rejected.
- Response: 200 `{ data: Session }` (session id regenerated, audit row). Errors: 401; 403 `ROLE_NOT_ALLOWED` / `CSRF_INVALID`; 409 `MODE_ACTIVE`; 422 `VALIDATION_ERROR`.
- Side effects: `sessions` (id regenerated), `audit_events`. Source: contract (no mock). Card: BE-03. Contract: exists.

### S-03 `POST /api/session/mode`
- Purpose: enter Mod Pelajar (admin or school_admin acts as the test student, `via='mod_pelajar'`, `mode.isTest=true`, data written is test data).
- Auth: active role `admin` or `school_admin` (D33b) + CSRF. Body (strict): `{ mode: 'mod_pelajar' }`.
- Response: 200 `{ data: Session }`. Errors: 401; 403 `MODE_NOT_ALLOWED` / `CSRF_INVALID`; 409 `MODE_ALREADY_ACTIVE`; 422.
- Side effects: `sessions`, `audit_events`. Source: contract (no mock; the mock emulates it with M02-09 and `shells/shared/mod-pelajar.ts`). Card: BE-03. Contract: exists.

### S-04 `DELETE /api/session/mode`
- Purpose: leave the mode (Keluar Mod Pelajar); the return role becomes active.
- Auth: any session + CSRF. No body. Response: 200 `{ data: Session }`. Errors: 401; 403 `CSRF_INVALID`; 409 `NO_MODE_ACTIVE`.
- Side effects: `sessions`, `audit_events`. Source: contract (no mock). Card: BE-03. Contract: exists.

## 6. M01 authentication endpoints (`m01/`, owner M01)

Shared mock details: password/IC are stored as salted SHA-256 hashes in the mock (the real backend: argon2id, BE-03 AC8). E-mail comparison key = trimmed lower-case. Throttle: 5 failed credential attempts per e-mail, 60 s decay from the first failure, success clears (`auth-state.ts`, `LOGIN_MAX_ATTEMPTS`, `LOGIN_DECAY_MS`). Reset tokens: one live token per e-mail, valid 60 min, single use; a new request for the same e-mail within 60 s is throttled (shared with the IC reset). `UserMe` as in section 4.

`SessionPayload` = `{ token: string, expiresAt: ISO +08:00, user: UserMe }` (mock only; the real API returns the cookie + `Session`, OQ-API-B1-1).

### M01-01 `POST /api/auth/login`
> **User decision 2026-10-19 (UD-1): the real API follows the contract: ids are decimal strings, cookie session plus `X-CSRF-Token`, `Session` shape and `/api/session*`, no Bearer. The mock shape described below is realigned by the LEAD (V2-T31); build to the contract, not to this mock shape. Bad credentials answer 401 `INVALID_CREDENTIALS` (not 422 with `fields.email`); the success body is `{data: Session}` with the session cookie.**
- Purpose: password login (M01 SRS #1).
- Auth: public. Throttled per e-mail.
- Request body: `{ email: string (required), password: string (required), remember?: boolean | 'true' }`. (Contract `LoginRequest` is `{ identifier, password, schoolId?, remember }`, OQ-API-B1-1.)
- Response: 200 `Env-D` `SessionPayload`. `remember=true` gives expiry +5 years, else +120 min sliding.
- Errors (in evaluation order):
  - 422 `VALIDATION_ERROR` (`E422`, `required` on `email` / `password`).
  - 429 `RATE_LIMITED` `Too many login attempts. Please try again in {n} seconds.` with `fields.email` = same text and `retryAfter` = n (remaining lockout seconds), after 5 failures.
  - 422 `VALIDATION_ERROR` `Email atau kata laluan tidak sah.` with `fields.email` = same text (unknown e-mail, wrong password, or an account with no password); counts one failed attempt (`auth.ts:60` `MSG_BAD_CREDENTIALS`, OBSERVED live copy).
  - 403 `ACCOUNT_INACTIVE` `Akaun anda tidak aktif. Sila hubungi pentadbir.` (`auth.ts:62`) when `isActive=false`, checked only after the credentials matched; the refused attempt does not count.
  - 403 `ROLE_OUT_OF_SCOPE` `Peranan ini tidak termasuk dalam prototaip.` (`app/prototype-scope.ts:50`) when the prototype-scope flag is on and the role is not student/teacher/school_admin/admin (mock/prototype switch, OQ-API-B1-7).
- Side effects: failure creates/increments the throttle row; success clears it, updates `users.lastLoginAt/lastActiveAt/hasLoggedIn` (BR-25), creates a session row, calls M14 `gamification.onLogin(userId, at)` (daily login/streak hook; a failure never blocks the login, FR-M01-69).
- Owner: M01. Source: `m01/auth.ts` R:311, H:109. Client: `m01/api/auth.ts` `login`.
- Card: BE-03 (BE-07 seeds). Contract: partial (`/auth/login` registered with a different request, response and error set).

### M01-02 `POST /api/auth/register`
- Purpose: self-registration (M01 SRS #2).
- Auth: public.
- Request body: `name` (required, max 255), `email` (required, valid, max 255, unique case-insensitive: `The email has already been taken.`), `phone` (max 14), `role` (in `student|teacher|parent`, default `student`), `grade` (students only: required `The grade field is required.`, integer 1-11 else `The selected grade is invalid.`; ignored for other roles), `icNumber` (max 14; stored only for students), `schoolId` (must exist: `The selected school id is invalid.`), `password` (required, min 6, confirmed by `passwordConfirmation`), `referralCode?` (string; ignored when unknown).
- Response: 201 `Env-D` `SessionPayload` (not remembered). New user: `isActive` true; `grade` only for students.
- Errors: 422 `E422`.
- Side effects: `users` row (+ password and IC hash), session, `lastLoginAt`, M14 `gamification.onLogin`, M14 `referrals.onRegistered(newUserId, code)` (FR-M01-70 provisional; failures never block).
- Owner: M01. Source: `m01/auth.ts` R:312, H:169. Client: `register`. Card: BE-06 (BE-06 says "school join code"; the mock takes `schoolId`, OQ-API-B1-8). Contract: missing.

### M01-03 `POST /api/auth/password/email`
- Purpose: send the reset link (M01 SRS #3).
- Auth: public.
- Request body: `{ email: required, valid }`.
- Response: 200 `Env-D` `{ status: "We have emailed your password reset link." }` (`auth.ts:64`).
- Errors: 422 `E422`; 422 `We can't find a user with that email address.` (`fields.email`, `auth.ts:66`; reveals that the account does not exist, OQ-API-B1-10); 429 `RATE_LIMITED` `Please wait before retrying.` (`fields.email`, `retryAfter` seconds) when a token was issued less than 60 s ago.
- Side effects: `password_resets` token (replaces earlier ones, 60 min); outbox e-mail `{ type:'password-reset', to, subject:'Reset Kata Laluan', data:{ token, email, link:'/password/reset/{token}?email={urlencoded}' } }` (delivered only on commit). Works for any user row, including roles without a session.
- Owner: M01. Source: `m01/auth.ts` R:313, H:216. Client: `sendPasswordResetLink`. Card: BE-06. Contract: missing.

### M01-04 `POST /api/auth/password/reset`
- Purpose: set a new password with a token and log in (M01 SRS #4).
- Auth: public.
- Request body: `token` (required), `email` (required, valid), `password` (required, min 6, confirmed by `passwordConfirmation`).
- Response: 200 `Env-D` `{ token, expiresAt, user: UserMe, status: "Your password has been reset." }` (`status` is inside `data`; `auth.ts:65`). The session is not remembered.
- Errors: 422 `E422`; 422 `We can't find a user with that email address.` (`fields.email`) for an unknown e-mail; 422 `This password reset token is invalid.` (`fields.email`, `auth.ts:68`) for an unknown, other-e-mail or expired token or a user without a session role; 403 `ACCOUNT_INACTIVE` `Akaun anda tidak aktif. Sila hubungi pentadbir.` (nothing changes; INFERRED extension of BR-23).
- Side effects: password hash replaced, token consumed, session created, `lastLoginAt`, M14 `onLogin`. The mock does not invalidate the user's other sessions (BE-06 AC2 requires it, OQ-API-B1-10).
- Owner: M01. Source: `m01/auth.ts` R:314, H:251. Client: `resetPassword`. Card: BE-06. Contract: missing.

### M01-05 `POST /api/auth/password/reset-ic`
- Purpose: reset by e-mail + IC number; returns a broker token that is then used with M01-04 (M01 SRS #5).
- Auth: public.
- Request body: `email` (required, valid), `icNumber` (required, max 14).
- Response: 200 `Env-D` `{ token: string, email: string }`.
- Errors: 422 `E422`; 422 `Email atau No Kad Pengenalan tidak sepadan.` (`fields.email`, `auth.ts:70`) for an unknown e-mail or an IC hash mismatch (placeholder copy). A match returns the token directly (OQ-API-B1-10).
- Side effects: issues a reset token (also arms the 60 s forgot-password throttle for that e-mail). No outbox e-mail.
- Owner: M01. Source: `m01/auth.ts` R:315, H:281. Client: `resetByIc`. Card: BE-06. Contract: missing.

### M01-06 `POST /api/auth/logout`
> **User decision 2026-10-19 (UD-1): the real API follows the contract: ids are decimal strings, cookie session plus `X-CSRF-Token`, `Session` shape and `/api/session*`, no Bearer. The mock shape described below is realigned by the LEAD (V2-T31); build to the contract, not to this mock shape. Logout requires the CSRF header when a session exists.**
- Purpose: end the session (M01 SRS #6).
- Auth: public; ignores a dead or absent session (never 401).
- Request: none (Bearer header if any).
- Response: 204 `Env-204`, always.
- Errors: none in the mock. (Contract: 403 `CSRF_INVALID` when a session exists and the CSRF header is wrong.)
- Side effects: the session and its impersonation child sessions are revoked.
- Owner: M01. Source: `m01/auth.ts` R:316, H:300. Client: `logout`; `stores/session.ts:326`. Card: BE-03. Contract: partial (registered; the CSRF rule is not in the mock).

## 7. M01 account, notifications, stats

All routes in this section use `requireAuth()` and operate on the session user only (no user id parameter). Matrix section A.

### M01-07 `PUT /api/me`
- Purpose: update own profile (M01 SRS #8).
- Request body: `name` (required, max 255), `phone` (max 14), `bio` (max 500), `grade` (integer 1-11, `The selected grade is invalid.`), `schoolId` (must exist, `The selected school id is invalid.`). `email` in the body is ignored (BR-13). An absent key keeps the stored value; `null`/blank clears `phone`, `bio`, `grade`, `schoolId`. `schoolId` is ignored for `school_admin, ppd_officer, jpn_officer, admin` (a staff school is an admin-assigned scope).
- Response: 200 `Env-DS` `UserMe`, `status: "Profil berjaya dikemaskini."` (`auth-account.ts:46`).
- Errors: 401 `E401`; 422 `E422`.
- Side effects: `users` update (`updatedAt`).
- Owner: M01. Source: `m01/auth-account.ts` R:213, H:95. Client: `updateProfile` (raw). Card: BE-06. Contract: missing.

### M01-08 `POST /api/me/picture`
- Purpose: upload avatar (M01 SRS #9). Multipart.
- Request: multipart field `profilePicture` (required file; MIME `image/jpeg`, `image/png` or `image/webp`; max 2048 KB). Messages: `The profile picture field is required.`, `The profile picture field must be a file of type: jpeg, png, webp.`, `The profile picture field must not be greater than 2048 kilobytes.`
- Response: 200 `Env-DS` `{ avatarUrl: string }`, `status: "Gambar profil berjaya dikemaskini."` (`:47`). The mock stores a base64 data URL; the real API stores a file (BE-04) and returns a URL (OQ-API-B1-9).
- Errors: 401; 422 `E422`.
- Side effects: `users.avatarUrl`, file store (BE-04).
- Owner: M01. Source: `m01/auth-account.ts` R:214, H:140. Client: `uploadPicture` (`api.multipart`, raw). Card: BE-06. Contract: missing.

### M01-09 `PUT /api/me/password`
- Purpose: change own password (M01 SRS #10); the session is kept.
- Request body: `currentPassword` (required), `password` (required, min 6, confirmed by `passwordConfirmation`).
- Response: 200 `Env-D` `{ status: "Kata laluan berjaya dikemaskini." }` (`:48`; `status` is inside `data`).
- Errors: 401; 422 `E422`; 422 `The password is incorrect.` (`fields.currentPassword`) when the current password does not verify.
- Side effects: password hash replaced.
- Owner: M01. Source: `m01/auth-account.ts` R:215, H:159. Client: `changePassword`. Card: BE-06. Contract: missing.

### M01-10 `GET /api/me/settings`
- Purpose: own settings (M01 SRS #11).
- Response: 200 `Env-D` `UserSettings` = `{ spiritualMode: bool, showBismillahSplash: bool, subuhPushEnabled: bool, subuhPushTime: "HH:mm", ramadanModeEnabled: bool, sahurPushTime: "HH:mm", faith: 'muslim'|'hindu'|'buddhist'|'christian'|'none'|null }`. Defaults when never saved (BR-17): all booleans false, `subuhPushTime '05:30'`, `sahurPushTime '04:30'`, `faith null`.
- Errors: 401. Side effects: none.
- Owner: M01. Source: `m01/auth-account.ts` R:216, H:183. Client: `getSettings`. Card: BE-06. Contract: missing. (The data-migration plan drops `faith`: OQ-API-B1-11.)

### M01-11 `PUT /api/me/settings`
- Purpose: save settings; every save writes all fields (M01 SRS #12).
- Request body: the seven `UserSettings` fields. Booleans are coerced with `toBool` (a missing key is false). `subuhPushTime` / `sahurPushTime`: 24h `H:i` (`^([01]\d|2[0-3]):[0-5]\d$`) else `The subuh push time field must match the format H:i.` / `The sahur push time field must match the format H:i.`; blank gives the default time. `faith` in the 5 codes else `The selected faith is invalid.`; blank gives null.
- Response: 200 `Env-DS` `UserSettings`, `status: "Tetapan berjaya disimpan."` (`:49`).
- Errors: 401; 422 `E422`. Side effects: `user_settings` upsert.
- Owner: M01. Source: `m01/auth-account.ts` R:217, H:187. Client: `saveSettings` (raw). Card: BE-06. Contract: missing.

### M01-12 `GET /api/me/notifications`
- Purpose: own inbox, newest first (M01 SRS #13).
- Query: `filter` (`unread` or `read`; other values ignored), `type` (`system`, `reminder` or `milestone`; other values ignored), `page`. Page size fixed at 20. `filter` and `type` combine with AND.
- Response: 200 `Env-L`. `data[]` item `AppNotification` = `{ id: number, userId: number, type: string (lower-case code, e.g. spaced_review), category: 'system'|'reminder'|'milestone'|null, title: string, body: string, readAt: ISO|null, createdAt: ISO }`. `meta.counts = { all, unread }` for the user, ignoring the filters. Sort: `createdAt` desc, then id desc.
- Errors: 401. Side effects: none.
- Owner: M01 (M22 extends the entity). Source: `m01/notifications.ts` R:69. Client: `m01/api/notifications.ts` `fetchNotifications`. Card: BE-06. Contract: missing.

### M01-13 `GET /api/me/notifications/unread-count`
- Response: 200 `Env-D` `{ count: number }`. Errors: 401. Source: `m01/notifications.ts` R:89. Client: `fetchUnreadCount`. Card: BE-06. Contract: missing.

### M01-14 `POST /api/me/notifications/read-all`
- Response: 200 `Env-D` `{ updated: number }` (how many were unread). Errors: 401. Side effects: `readAt = now` on the user's unread items. Source: R:93. Client: `markAllNotificationsRead`. Card: BE-06. Contract: missing.

### M01-15 `POST /api/me/notifications/bulk-read`
- Request body: `ids` (required, non-empty array of integers): `The ids field is required.` / `The ids.* field must be an integer.`
- Response: 200 `Env-D` `{ success: true }`. Foreign and unknown ids are silently ignored; already-read items keep the first `readAt`.
- Errors: 401; 422 `E422`. Side effects: `readAt`. Source: R:97. Client: `bulkMarkNotificationsRead`. Card: BE-06. Contract: missing.

### M01-16 `POST /api/me/notifications/bulk-delete`
- Request body as M01-15. Response 200 `Env-D` `{ success: true }`; foreign and unknown ids are ignored; deletion is permanent.
- Errors: 401; 422. Side effects: rows deleted. Source: R:104. Client: `bulkDeleteNotifications`. Card: BE-06. Contract: missing.

### M01-17 `POST /api/me/notifications/:id/read`
- Path: `id` integer (non-numeric: the route does not match, so `404 E404`).
- Response: 200 `Env-D` `{ success: true }`; reading twice keeps the first `readAt`.
- Errors: 401; 404 `E404` (`Not Found.`) for an unknown or foreign id.
- Side effects: `readAt`. Source: R:111. Client: `markNotificationRead`. Card: BE-06. Contract: missing.

### M01-18 `DELETE /api/me/notifications/:id`
- Path: `id` integer. Response: 200 `Env-D` `{ success: true }` (not 204). Errors: 401; 404 `E404` for an unknown or foreign id.
- Side effects: row deleted. Source: R:122. Client: `deleteNotification`. Card: BE-06. Contract: missing.

### M01-19 `GET /api/public/stats`
- Purpose: login page counters, computed per request (M01 SRS #21, BR-21; no stored figures).
- Auth: public. Request: none.
- Response: 200 `Env-D` `{ questionCount: number, subjectCount: number, levelCount: number }`. `questionCount` = M04 eligible questions (mock today: status `approved` and active; real API: v2 lifecycle, D54a: status `published` and active); `subjectCount` = active M03 subjects; `levelCount` = active M03 education levels.
- Errors: none. Side effects: none.
- Owner: M01 reading M03/M04. Source: `m01/auth-stats.ts` R:12 (H via `auth-deps.ts` `platformStats`). Client: `m01/api/stats.ts` `getPlatformStats`. Card: BE-06. Contract: missing.

## 8. M02 users and schools (`m02/`, owner M02; users table owned by M01)

Common to the whole section: all `/api/admin/*` routes use `requireRole('admin')` (guest 401 `E401`, any other role including `school_admin` 403 `E403`; BE-05 AC2 expects Admin Sekolah scoped access on some of them, OQ-API-B1-13). The "Source" R/H line numbers refer to files under `m02/` unless a path is given.

Shapes (client types in `modules/m02-users-schools/api/*.ts`):

- `AdminUserListItem` = `{ id, name, email, phone|null, role (8 codes or 'unmapped'), school: {id,name}|null, isActive, createdAt, avatarUrl|null }`.
- `AdminUserDetail` = `UserMe` fields (`id,name,email,phone,role,grade,schoolId,bio,avatarUrl,createdAt,updatedAt,lastLoginAt,school (SchoolSummary|null)`) + `landingPath: string|null` (null for roles without a session) + `icNumber: string|null` + `isActive` + `subscriptionPackage: 'none'|'regular_monthly'|'personal'` + `hasPkskSubscription: bool` + `ppdState|null` + `ppdDistrict|null` + `linkedStudents: StudentSearchItem[]` (parents only, else `[]`). `icNumber` is the masked value `xxxxxx-xx-xx` + last 2 digits (full value only for fictitious seeded fixtures, mock-only; the real API returns the mask only, BE-05 AC4).
- `StudentSearchItem` = `{ id, name, classLevel: 'D1'..'D6'|'T1'..'T5'|null, schoolName|null }`.
- `ImportResult` = `{ created: number, skipped: number, failed: number, errors: [{ line: number (1-based), message: string }] }` (`errors` = failed lines only).
- `SchoolSummary` = `{ id, name, code, type, state, district|null, city|null }`. `AdminSchool` = `SchoolSummary` + `isActive, createdAt, updatedAt, studentCount, teacherCount` (counts of users with that role at the school, active and inactive).
- Roles in `role` filters/bodies: `student, teacher, parent, sponsor, school_admin, ppd_officer, jpn_officer, admin` (BR-01).

### M02-01 `GET /api/admin/users` (SRS #1)
- Purpose: S1 user list.
- Auth: admin.
- Query: `role` (one of the 8 codes; any other non-empty value returns an empty page), `schoolId` (digits; non-numeric returns an empty page), `isActive` (`1` or `0`; other values mean no filter), `search` (case-insensitive substring of name or e-mail), `page`. Page size fixed 25. Order: `createdAt` desc, then id desc. Filters combine with AND.
- Response: 200 `Env-L` of `AdminUserListItem`; `meta.roleCounts = { student, teacher, parent, sponsor, schoolAdmin, ppdOfficer, admin }` over ALL users (ignores filters; `jpn_officer` has no card).
- Errors: 401, 403.
- Side effects: none.
- Source: `users-admin.ts` R:518, H:129. Client: `api/users.ts` `fetchAdminUsers`. Card: BE-05. Contract: missing.

### M02-02 `GET /api/admin/users/filters` (SRS #2)
- Response: 200 `Env-D` `{ schools: [{ id, name }] }`: schools with at least one user, by name A-Z (case-insensitive, then id).
- Errors: 401, 403. Source: R:519, H:155. Client: `fetchUserFilters`. Card: BE-05. Contract: missing.

### M02-03 `GET /api/admin/users/:id` (SRS #3)
- Path: `id` integer. Response: 200 `Env-D` `AdminUserDetail`. Errors: 401, 403, 404 `E404`.
- Source: R:522, H:171. Client: `fetchAdminUser`. Card: BE-05. Contract: missing.

### M02-04 `POST /api/admin/users` (SRS #4)
- Purpose: S2 create user.
- Request body (fields of the visible section only): `role` (required, in the 8 codes), `name` (required, max 255), `email` (required, valid, max 255, unique case-insensitive), `phone` (max 14), `password` (required, min 6, confirmed by `passwordConfirmation`), `isActive` (default true; coerced `toBool`), `grade` (required for `student`: `The grade field is required when role is student.`; 1-11 else `The selected grade is invalid.`), `icNumber` (max 14; stored only for students), `schoolId` (optional; must exist else `The selected school id is invalid.`; required for `school_admin`: `The school id field is required when role is school_admin.`), `linkedStudentIds` (parent: array of ids that are students, else `The selected linked student ids is invalid.`), `ppdState` (required for `ppd_officer`/`jpn_officer`: `The ppd state field is required.`; must be a known JPN name for those roles and `school_admin`: `The selected ppd state is invalid.`), `ppdDistrict` (required for `ppd_officer`: `The ppd district field is required when role is ppd_officer.`; must be a PPD code of the chosen JPN: `The selected ppd district is invalid.`).
- Defaults (BR-09): a `school_admin` takes `ppdState`/`ppdDistrict` from its school when not sent; `ppd_officer` keeps both; `jpn_officer` keeps `ppdState` only; others null. `grade` only kept for students.
- Response: 201 `Env-DS` `AdminUserDetail`, `status: "Pengguna berjaya didaftarkan."` (`users-admin.ts:100`).
- Errors: 401, 403, 422 `E422`.
- Side effects: `users` row (`createdById` = acting admin; id from 9,000,001 in the mock), password hash, IC hash+mask, `parent_links` rows for parents.
- Source: R:520, H:265. Client: `createAdminUser` (raw). Card: BE-05. Contract: missing.

### M02-05 `PUT /api/admin/users/:id` (SRS #5)
- Purpose: S3 edit. A key that is absent leaves the stored value unchanged (BR-11); `null` clears `phone`, `schoolId`, `icNumber`.
- Request body: `name` (required, max 255), `email` (required, valid, max 255, unique excluding this user), `role` (required, in the 8 codes), `phone`, `isActive` (`toBool` when present), `grade` (student: required when the record would end up without one, 1-11), `icNumber` (max 14; only applied for students), `subscriptionPackage` (`none|regular_monthly|personal`; students only; when it changes, the expiry is recomputed: `regular_monthly` = +1 calendar month at the same MYT time (last day of the month if shorter); `personal` = the next 10 January 23:59:59 MYT strictly after now (the handler always passes billing onetime for `personal`); `none` = null expiry), `hasPkskSubscription` (bool; students), `schoolId` (must exist; `school_admin` must end up with one: `The school id field is required when role is school_admin.`), `linkedStudentIds` (parents; replaces the whole set when present), `newPassword` (min 6) + `newPasswordConfirmation` (confirmed).
- Response: 200 `Env-DS` `AdminUserDetail`, `status: "Pengguna berjaya dikemaskini."` (`:101`).
- Errors: 401, 403, 404 `E404`, 422 `E422`.
- Side effects: `users` update, password hash if `newPassword`, IC, subscription package and `expiresAt`, `parent_links` replaced.
- Source: R:523, H:347. Client: `updateAdminUser` (raw). Card: BE-05. Contract: missing.

### M02-06 `DELETE /api/admin/users/:id` (SRS #6)
- Response: 200 `Env-DS` `{ deleted: 1 }`, `status: "Pengguna berjaya dipadam."` (`:102`; not 204).
- Errors: 401, 403, 404 `E404`; 422 `VALIDATION_ERROR` `Anda tidak boleh memadam akaun sendiri.` (`fields.id`, `:106`, INFERRED) when the id is the acting admin's.
- Side effects (BR-06 cascade): parent links (as parent or student), parent invites, school-admin packages, complimentary profile, all sessions of the user, and the user row are removed in one transaction.
- Source: R:524, H:451. Client: `deleteAdminUser` (raw). Card: BE-05 (BE-05 AC6: state in the PR whether the real API blocks or cascades). Contract: missing.

### M02-07 `POST /api/admin/users/bulk-delete` (SRS #7)
- Request body: `ids` (required; array of integers: `The ids field is required.` / `The ids field must be an array of integers.`).
- Response: 200 `Env-DS` `{ deleted: n }`, `status: "{n} pengguna berjaya dipadam."` (`usersDeletedText`); unknown ids are skipped.
- Errors: 401, 403, 422 `E422`; 422 `Anda tidak boleh memadam akaun sendiri.` (`fields.ids`) when the list contains the acting admin.
- Side effects: as M02-06 per id, one transaction.
- Source: R:521, H:461. Client: `bulkDeleteAdminUsers` (raw). Card: BE-05. Contract: missing.

### M02-08 `POST /api/admin/users/:id/toggle-active` (SRS #8)
- Response: 200 `Env-DS` `{ isActive: boolean }` (new value), `status: "Status pengguna berjaya dikemaskini."` (`:103`). Self-deactivation is allowed (BR-04).
- Errors: 401, 403, 404 `E404`. Side effects: `users.isActive` flipped.
- Source: R:525, H:488. Client: `toggleUserActive` (raw). Card: BE-05. Contract: missing.

### M02-09 `POST /api/admin/users/:id/impersonate` ("Login As", Mod Pelajar emulation) (SRS #9)
> **Not ported (UD-2): user decision 2026-10-19 drops impersonation ("Login As" / act as another user). Mod Pelajar is `POST /api/session/mode` only (D31c). The backend does not register this route; the frontend removes its caller. Kept here as the record of the mock behaviour.**
- Purpose: opens a fresh session of the target user. The frontend replaces its stored session with it (Login As) or parks the admin session and uses it as Mod Pelajar (`shells/shared/mod-pelajar.ts`, student id 2 hard-coded).
- Response: 200 `Env-D` `{ token, expiresAt, user: UserMe }` (not remembered; `lastLoginAt` not touched; no M14 hook; the admin's own session stays valid).
- Errors: 401, 403, 404 `E404`; 422 `Anda tidak boleh Login As akaun sendiri.` (`fields.id`, `:107`); 422 `Pengguna ini tiada peranan yang sah untuk log masuk.` (`fields.id`, `:108`) for a user whose role has no session (`unmapped`).
- Side effects: a session row. No audit row in the mock (BE-05: align with BE-03 session mode, OQ-API-B1-6).
- Source: R:528, H:498. Client: `impersonateUser`. Card: UNCOVERED (dropped by user decision, UD-2). Contract: missing (superseded by S-03 in the contract, OQ-API-B1-6).

### M02-10 `GET /api/students/search` (SRS #39)
- Purpose: pick students (S2 parent links, S7, other modules).
- Auth: any session (handler-side check, 401 `E401` without one).
- Query: `q` (trimmed; fewer than 2 characters returns `[]`). Matches students whose name or e-mail contains `q`, newest first, limit 15.
- Response: 200 `Env-D` `StudentSearchItem[]` (no meta). Errors: 401.
- Source: R:531, H:509. Client: `searchStudents`. Card: BE-05. Contract: missing.

### M02-11 `GET /api/admin/users/:id/packages` (SRS #10)
- Purpose: S16 SPM package cards for a school admin.
- Response: 200 `Env-D` `{ user: {id,name}, school: SchoolSummary|null, packages: [{ formLevel:'t4'|'t5', packageId (1 | 2), code:'T4'|'T5', name:'Pakej SPM Tingkatan 4'|'Pakej SPM Tingkatan 5', priceLabel:'RM 30/pelajar · {years} tahun', years (2 for t4, 1 for t5), assigned: {studentQuota, assignedAt}|null }], existingT5Count }`; `existingT5Count` = students of the user's school with grade 11 (0 without school).
- Errors: 401, 403, 404 `E404`; 422 `Pengguna ini bukan admin sekolah.` (`fields.id`, `users-packages.ts:45`) when the user is not a `school_admin`.
- Source: `users-packages.ts` R:124, H:50. Client: `fetchUserPackages`. Card: BE-25. Contract: missing.

### M02-12 `POST /api/admin/users/:id/packages` (SRS #11)
- Request body: `formLevel` (required; `t4` or `t5`), `packageId` (required; must pair with formLevel: t4 -> 1, t5 -> 2, else `The selected package id is invalid.`), `studentQuota` (required integer 1-2000; text digits accepted; `The student quota field must be an integer.` / `must be at least 1.` / `must not be greater than 2000.`).
- Response: 200 `Env-DS` `SchoolAdminPackage` = `{ id, userId, formLevel, packageId, studentQuota, assignedAt }`, `status: "Pakej berjaya ditetapkan."` (`:44`). Upsert per (user, formLevel); assigning again replaces the quota and `assignedAt` (BR-13).
- Errors: 401, 403, 404, 422 (not a school admin message as M02-11, or `E422`).
- Side effects: `school_admin_packages` upsert.
- Source: `users-packages.ts` R:127, H:81. Client: `assignUserPackage` (raw). Card: BE-25. Contract: missing.

### M02-13 `POST /api/admin/users/bulk-import` (SRS #12)
- Purpose: S4 import teachers / parents / school admins / PPD officers from CSV or pasted text.
- Request: JSON or multipart. `role` (required; `teacher|parent|school_admin|ppd_officer`: `The role field is required.` / `The selected role is invalid.`), `schoolId` (required for `teacher` and `school_admin`: `The school id field is required.`; must exist: `The selected school id is invalid.`), `defaultPassword` (optional; blank = configured bulk default; min 6: `The default password field must be at least 6 characters.`), `importMode` (required `csv|paste`: `The import mode field is required.` / `The selected import mode is invalid.`), `csvFile` (file, or its text in JSON) when csv, `pasteContent` when paste.
- Row format: one line per user `name, email, phone?, password?`; comma separated with optional double quotes (`""` = literal quote); blank lines ignored; a leading BOM dropped; the first line is a header (skipped) when its second column is not an e-mail. Line numbers count the original text including blanks.
- Row outcomes: failed (with `errors[]`) for: `Nama diperlukan.` (no name), `Nama tidak boleh melebihi 255 aksara.`, `Emel tidak sah.`, `Nombor telefon tidak boleh melebihi 14 aksara.`, `Kata laluan mesti sekurang-kurangnya 6 aksara.` (`import/records.ts:31`); skipped: e-mail already exists or repeats earlier in the same import (case-insensitive); otherwise created (active, `createdById` = admin; `school_admin` also gets `ppdState`/`ppdDistrict` of its school; password = row password or default).
- No data rows: 422 `Tiada data untuk diimport.` on `fields.csvFile` or `fields.pasteContent` (`imports.ts:58`).
- Response: 200 `Env-DS` `ImportResult`, `status: "Import selesai: {created} pengguna didaftarkan, {skipped} dilangkau, {failed} gagal."`. Created rows are committed in one transaction (BE-05 AC5 asks per-row semantics and a report).
- Errors: 401, 403, 422 `E422`. Side effects: `users` rows, password hashes.
- Source: `imports.ts` R:285, H:132. Client: `api/imports.ts` `importUsers` (raw). Card: BE-05. Contract: missing.

### M02-14 `POST /api/admin/students/import` (SRS #13)
- Purpose: S5 DELIMa student import.
- Request: JSON or multipart. `schoolId` (required; must exist), `classLevel` (required; `D1..D6` -> grade 1-6, `T1..T5` -> grade 7-11; `The class level field is required.` / `The selected class level is invalid.`), `importMode`, `csvFile` / `pasteContent` as M02-13.
- Row format: csv = `name, email, password, ic?`; paste = blocks separated by blank lines whose lines are name, DELIMa e-mail, password, optional IC. Failed rows: `Nama diperlukan.`, `Nama tidak boleh melebihi 255 aksara.`, `Emel DELIMa tidak sah.`, `Kata laluan DELIMa diperlukan.`, `Nombor IC tidak boleh melebihi 14 aksara.`; skipped: existing or repeated e-mail. Created students: `role student`, name in Title Case, `grade` from `classLevel`, `idDelima` = e-mail, active, password and IC hash.
- School checks: no active/grace subscription -> 422 `Sekolah ini tiada langganan aktif. Import pelajar tidak dibenarkan.` (`fields.schoolId`, `imports.ts:59`); more new records than the remaining quota -> 422 `Kuota tidak mencukupi.` (`fields.schoolId`, `:61`; the whole import is refused). No data rows -> `Tiada data untuk diimport.`
- Response: 200 `Env-DS` `ImportResult`, `status: "Import selesai: {created} pelajar didaftarkan, {skipped} dilangkau."`.
- Errors: 401, 403, 422. Side effects: `users` rows.
- Source: R:286, H:197. Client: `importStudents` (raw). Card: BE-25. Contract: missing.

### M02-15 `GET /api/admin/schools/:id/quota` (SRS #14)
- Response: 200 `Env-D` `SchoolQuota` = `{ hasSubscription: false }` or `{ hasSubscription: true, quota, used, remaining }`. `quota` = `studentQuota` of the latest-starting `active` (or `grace`) subscription of the school (tie: higher id); `used` = all students of the school, active and inactive; `remaining = max(0, quota - used)`.
- Errors: 401, 403, 404 `E404` (unknown school).
- Source: `imports.ts` R:287, quota in `mock/quota.ts:66`. Client: `fetchSchoolQuota`. Card: BE-25. Contract: missing.

### M02-16 `GET /api/admin/schools/:id/students` (SRS #15)
- Query: `search` (substring of name, e-mail or DELIMa id, case-insensitive), `classLevel` (`D1..T5`, exact). Not paginated; max 200; sorted by name then id.
- Response: 200 `Env-D` `[{ id, name, email, idDelima|null, classLevel|null, isActive }]`. Errors: 401, 403, 404 (unknown school).
- Source: `imports.ts` R:297. Client: `fetchSchoolStudents`. Card: BE-05. Contract: missing.

### M02-17 `GET /api/admin/comp-students` (SRS #16)
- Purpose: S6 complimentary students (role student, `isComplimentary`).
- Query: `page`; page size fixed 50; newest first (`createdAt` desc, id desc, INFERRED).
- Response: 200 `Env-L` of `{ id, name, username (= login e-mail "{last 6 IC digits}@prestasiplus.my"), icNumber|null (masked), schoolName|null, classLabel (first active class name, else ''), teacherName (that class's teacher, else ''), isActive, coinsEnabled, packageExpiresAt 'YYYY-MM-DD' (default '2026-12-31') }`; `meta.counts = { coinsOff, total }` over all complimentary students (a student without a profile counts as coins OFF).
- Errors: 401, 403; 500 `SERVER_ERROR` `Pelajar komplimen memerlukan pemalam mock M10 (kelas), M03 dan M04 dimuatkan bersama M02.` (mock-only guard when the M10 store is not booted; not a real-API behaviour).
- Source: `comp-students.ts` R:393, H:189. Client: `api/comp-students.ts` `fetchCompStudents`. Card: BE-25. Contract: missing.

### M02-18 `POST /api/admin/comp-students` (SRS #17)
- Request body: `classroomId` (required; an active classroom: `The selected classroom id is invalid.`), `packageExpiresAt` (required; `YYYY-MM-DD` valid date: `The package expires at field must be a valid date.`), `students` (required text, one `NAMA, NOKP` per line; the IC follows the last comma, non-digits stripped).
- Per line: no comma or no name -> failed `Format baris tidak sah. Gunakan NAMA, NOKP.`; IC under 6 digits -> failed `No. KP mesti sekurang-kurangnya 6 digit.` (`comp-students.ts:82-83`); username = last 6 IC digits + `@prestasiplus.my`; skipped when that username exists or repeats; otherwise created: student, active, school and grade (= classroom level id) from the classroom, complimentary, password = configured `compStudentDefaultPassword` (M02-49), IC hash, subscription package `personal` expiring `{date}T23:59:59+08:00`, complimentary profile (`originalSchoolName` = classroom school, coins off by default), enrolled in the classroom with source `complimentary`.
- Response: 201 `Env-DS` `ImportResult`, `status: "{n} pelajar komplimen berjaya didaftarkan."`.
- Errors: 401, 403, 422 `E422`, 404 `E404` (classroom vanished), 500 as M02-17 (mock-only).
- Side effects: `users`, complimentary profile, M10 enrolment rows. Source: R:394, H:236. Client: `registerCompStudents` (raw). Card: BE-25. Contract: missing.

### M02-19 `GET /api/admin/comp-students/:id` (SRS #18)
- Response: 200 `Env-D` `{ userId, username, name, icNumber|null, classLevel|null, isActive, coinsEnabled, packageExpiresAt, originalSchoolName|null, classLabel, teacherName, syilingBalance, coinBalance, classes: [{ name, classCode, subjectName|null, teacherName, status ('active'|'removed') }] }`. Balances come from M14 (read-only; 0/0 until M14 registers).
- Errors: 401, 403, 404 `E404` unless the id is a complimentary student; 500 as M02-17 (mock-only).
- Source: R:396, H:151/319. Client: `fetchCompStudent`. Card: BE-25. Contract: missing.

### M02-20 `POST /api/admin/comp-students/bulk-action` (SRS #19)
- Request body: `action` (required; `coins_off|coins_on|deactivate|activate`), `ids` (required non-empty array of integers).
- Response: 200 `Env-DS` `{ updated: n }`, `status: "Tindakan berjaya dilaksanakan."` (`:80`); ids that are not complimentary students are ignored.
- Errors: 401, 403, 422 `E422`. Side effects: coins flag or `users.isActive` per id.
- Source: R:395, H:326. Client: `bulkCompAction` (raw). Card: BE-25. Contract: missing.

### M02-21 `POST /api/admin/comp-students/:id/toggle-coins` (SRS #20)
- Response: 200 `Env-DS` `{ coinsEnabled }`, `status: "Tindakan berjaya dilaksanakan."`. Errors: 401, 403, 404. Side effects: complimentary profile flag (BE-25 AC5: audit-log the actor).
- Source: R:399, H:358. Client: `toggleCompCoins`. Card: BE-25. Contract: missing.

### M02-22 `POST /api/admin/comp-students/:id/toggle-active` (SRS #21)
- Response: 200 `Env-DS` `{ isActive }`, same status text. Errors: 401, 403, 404. Side effects: `users.isActive`.
- Source: R:402, H:366. Client: `toggleCompActive`. Card: BE-25. Contract: missing.

### M02-23 `GET /api/admin/teachers` (SRS #22)
- Response: 200 `Env-D` `[{ id, name, email }]` every teacher, sorted by name (ms collation) then id. Errors: 401, 403.
- Source: R:405, H:375. Client: `fetchTeachers`. Card: BE-05. Contract: missing.

### M02-24 `GET /api/admin/teachers/:id/classrooms` (SRS #23)
- Response: 200 `Env-D` `[{ id (classroom id), name, classCode (join code) }]`: the teacher's active classes (kind classroom), by id; `[]` for none or an unknown teacher (no 404).
- Errors: 401, 403; 500 as M02-17 (mock-only). Source: R:406, H:383. Client: `fetchTeacherClassrooms`. Card: BE-05. Contract: missing.

### M02-25 `GET /api/admin/schools` (SRS #24)
- Query: `search` (substring of name or code), `state` (exact full state name), `type` (exact: `SK, SMK, SJK(C), SJK(T), MRSM, SBP`), `page`. Page size 30; sort name A-Z then id.
- Response: 200 `Env-L` of `AdminSchool`; `meta.counts = { total, active, inactive }` over all schools (ignoring filters); `meta.types` = distinct school types present, sorted.
- Errors: 401, 403. Source: `schools-admin.ts` R:150. Client: `api/schools-admin.ts` `fetchAdminSchools`. Card: BE-05. Contract: missing.

### M02-26 `GET /api/admin/schools/:id` (SRS #25)
- Response: 200 `Env-D` `AdminSchool`. Errors: 401, 403, 404 `E404`.
- Source: R:171. Client: `fetchAdminSchool`. Card: BE-05. Contract: missing.

### M02-27 `POST /api/admin/schools` (SRS #26)
- Request body (strings trimmed; blank is not converted to null here): `name` (required, string, max 255), `code` (required, string, max 20, unique case-insensitive: `The code has already been taken.`), `type` (required; one of the 6 types), `state` (required; one of the 16 JPN/state names in `m02/../data/geo.ts` `STATE_NAMES`), `district` (string, max 255), `city` (string, max 255), `isActive` (boolean; default true).
- Response: 201 `Env-DS` `AdminSchool`, `status: "Sekolah berjaya disimpan."` (`schools-admin.ts:53`). Empty `district`/`city` stored as null.
- Errors: 401, 403, 422 `E422`. Side effects: `schools` row (id from 10,301 in the mock).
- Source: R:182. Client: `createSchool` (raw). Card: BE-05. Contract: missing.

### M02-28 `PUT /api/admin/schools/:id` (SRS #27)
- Request body as M02-27 (the school's own code is not a duplicate; an absent `isActive` keeps the stored value).
- Response: 200 `Env-DS` `AdminSchool`, `status: "Sekolah berjaya disimpan."`. Errors: 401, 403, 404, 422.
- Source: R:190. Client: `updateSchool` (raw). Card: BE-05. Contract: missing.

### M02-29 `POST /api/admin/schools/:id/toggle` (SRS #28)
- Response: 200 `Env-DS` `{ isActive }`, `status: "Status sekolah berjaya dikemaskini."` (`schools-admin.ts:54`). Errors: 401, 403, 404. A school is never deleted (BR-20, INFERRED).
- Source: R:207. Client: `toggleSchool` (raw). Card: BE-05. Contract: missing.

### M02-30 `GET /api/admin/schools/options` (XL-13 alias)
- Response: 200 `Env-D` `[{ id, name }]`: every school, active and inactive, name A-Z, no paging. Errors: 401, 403.
- Source: R:169. Client: none (alias of M02-31). Card: BE-05. Contract: missing.

### M02-31 `GET /api/schools` (SRS #43; consumer M04 #31)
- Auth: admin (`requireRole('admin')`). Query: `all=1` required, else 422 `VALIDATION_ERROR` `The all field is required.` (`fields.all`).
- Response: 200 `Env-D` `[{ id, name }]` as M02-30.
- Errors: 401, 403, 422. Source: R:221. Client: `fetchSchoolOptions`. Card: BE-05, which lists it as "public school picker" while the mock is admin-only (OQ-API-B1-14). Contract: missing.

### M02-32 `GET /api/admin/school-subscriptions` (SRS #29)
- Query: `search` (substring of school name or code), `status` (`active|grace|expired|cancelled`; unknown matches nothing), `formLevel` (`t4|t5|d1_d6|t1_t3`; unknown matches nothing). Not paginated; newest first (id desc).
- Response: 200 `Env-L` (unpaged meta) of `{ id, school: {id,name,code}, formLevel, packageTier ('basic'|'full'), used, studentQuota, status, startsAt, endsAt }`; `meta.counts = { active, grace, expired, totalQuota }` over all rows (`totalQuota` = sum of quota of `active` rows). `used` = students of the school, active and inactive.
- Errors: 401, 403. Source: `subscriptions.ts` R:437, H:195. Client: `api/subscriptions.ts` `fetchSubscriptions`. Card: BE-25. Contract: missing.

### M02-33 `GET /api/admin/school-packages` (SRS #30)
- Response: 200 `Env-D` `SchoolPackage[]` (4 rows) = `{ id, code ('T4'|'T5'|'D1_D6'|'T1_T3'), name, slug, educationLevel ('spm'|'primary'|'lower_secondary'), formLevel ('t4'|'t5'|'d1_d6'|'t1_t3'), priceAnnual (decimal string "30.00"), maxRenewals, isActive }`; term years = `maxRenewals + 1`.
- Errors: 401, 403. Source: R:438, H:228. Client: `fetchSchoolPackages`. Card: BE-25. Contract: missing.

### M02-34 `POST /api/admin/school-subscriptions` (SRS #31)
- Request body: `schoolId` (required; must be an ACTIVE school: `The selected school id is invalid.`), `packageTier` (required; `basic|full`), `schoolPackageId` (required; existing package id), `studentQuota` (required integer 1-2000), `paymentReference` (string|null), `paymentNotes` (string|null).
- Response: 201 `Env-DS` `SubscriptionDetail` (below), `status: "Langganan berjaya dicipta."` (`:83`). New row: `status 'active'`, `startsAt` = now, `endsAt` = now + 1 month (`basic`) or + 12 months (`full`) (calendar months in MYT, last day clamp), `questionLimit` 500 (`basic`) or null (`full`), `notes` null. A school may hold several subscriptions.
- `SubscriptionDetail` = `{ id, schoolId, schoolPackageId, packageTier, studentQuota, used, status, startsAt, endsAt, questionLimit|null, paymentReference|null, paymentNotes|null, notes|null, createdAt, updatedAt, formLevel, remaining (max(0, quota-used)), usedPercent (min(100, round(used*100/quota))), school: SchoolSummary, package: SchoolPackage }`.
- Errors: 401, 403, 422 `E422`. Side effects: `school_subscriptions` row.
- Source: R:439, H:234. Client: `createSubscription`. Card: BE-25. Contract: missing.

### M02-35 `GET /api/admin/school-subscriptions/:id` (SRS #32)
- Response: 200 `Env-D` `SubscriptionDetail`. Errors: 401, 403, 404 `E404`. Source: R:440, H:280. Client: `fetchSubscription`. Card: BE-25. Contract: missing.

### M02-36 `GET /api/admin/school-subscriptions/:id/students` (SRS #33)
- Query: `perPage` (25, 50, 100 or 200; anything else = 50), `page`.
- Response: 200 `Env-L` of `{ id, name, idDelima|null, classLevel|null }` (all students of the school, active and inactive, by name ms collation, then id); `meta.pageSize` = the size used.
- Errors: 401, 403, 404 `E404`. Source: R:443, H:287. Client: `fetchSubscriptionStudents`. Card: BE-25. Contract: missing.

### M02-37 `PUT /api/admin/school-subscriptions/:id/quota` (SRS #34)
- Request body: `studentQuota` (required integer 1-2000), `notes` (optional string, the reason).
- Response: 200 `Env-DS` `SubscriptionDetail`, `status: "Kuota berjaya dikemaskini."` (`:84`). When a reason is given, a history line `[Kuota {old} → {new} pada {dd/mm/yyyy HH:mm}] {reason}` is appended to `notes` (one line per entry, newline-joined). Works on any status.
- Errors: 401, 403, 404, 422. Source: R:446, H:308. Client: `updateSubscriptionQuota`. Card: BE-25. Contract: missing.

### M02-38 `POST /api/admin/school-subscriptions/:id/extend` (SRS #35)
- Request body: `days` (required integer 1-365), `reason` (optional string).
- Response: 200 `Env-DS` `SubscriptionDetail`, `status: "Tempoh langganan berjaya dilanjutkan."` (`:85`). `endsAt += days`; an `expired`/`grace` row whose new end is in the future becomes `active`; a `cancelled` row is never reactivated. History line `[Dilanjutkan {days} hari pada {dd/mm/yyyy HH:mm}] {reason}` appended to `notes` only when a reason is given.
- Errors: 401, 403, 404, 422. Source: R:449, H:331. Client: `extendSubscription`. Card: BE-25. Contract: missing.

### M02-39 `POST /api/admin/school-subscriptions/:id/upgrade` (SRS #36)
- Request body: `paymentReference`, `paymentNotes` (optional strings; applied when non-blank).
- Response: 200 `Env-DS` `SubscriptionDetail`, `status: "Langganan berjaya dinaik taraf."` (`:86`). Effect: `packageTier 'full'`, `questionLimit null`, `endsAt` = now + 12 months, `status 'active'`, `notes` gets `[Naik taraf Pemantauan → Penuh pada {dd/mm/yyyy HH:mm}]`.
- Errors: 401, 403, 404; 422 `VALIDATION_ERROR` `Hanya langganan Pemantauan boleh dinaik taraf.` (`fields.packageTier`, `:89`) unless the tier is `basic`.
- Source: R:452, H:364. Client: `upgradeSubscription`. Card: BE-25. Contract: missing.

### M02-40 `POST /api/admin/school-subscriptions/:id/cancel` (SRS #37)
- Response: 200 `Env-DS` `SubscriptionDetail` with `status 'cancelled'`, `status` text `Langganan berjaya dibatalkan.` (`:87`).
- Errors: 401, 403, 404; 422 `Langganan ini sudah dibatalkan.` (`fields.status`, `:90`).
- Source: R:455, H:395. Client: `cancelSubscription`. Card: BE-25. Contract: missing.

### M02-41 `GET /api/admin/school-subscriptions/:id/renewal-invoice` (SRS #42)
- Response: 200 `Env-D` `RenewalInvoice` = `{ ref: "INV-{subscriptionId}-{yyyymmdd of today}", date: now ISO, school: SchoolSummary, packageName, currentPeriod: {start,end}, renewalPeriod: {start: endsAt, end: endsAt + 12 months}, students: [{no (1-based), name, idDelima|null, classLevel|null}], studentCount, pricePerStudent: "30.00", total: decimal string = enrolled students x price (not the quota) }`. Money is computed in integer cents.
- Errors: 401, 403, 404. Source: R:458, H:414. Client: `fetchRenewalInvoice`. Card: BE-25. Contract: missing.

### M02-42 `GET /api/schools/search` (SRS #38; M01 #20)
- Auth: public.
- Query: `q` (substring of name or code), `state` (exact full state name; blank ignored), `limit` (positive integer; default 20; no maximum), `id` (one school by id; ignored filters; fixture schools excluded).
- Response: 200 `Env-D` `SchoolSummary[]`; active schools only; sorted by name then id; not paginated, no `meta`.
- Errors: none. Source: `schools-public.ts` R:17. Client: `api/schools.ts` `searchSchools`. Card: BE-05. Contract: missing.

### M02-43 `GET /api/jpn` (SRS #40)
- Auth: public. Response: 200 `Env-D` `Jpn[]` = `[{ id, code, name }]` (the 16 JPN, by id). Source: R:30. Client: `fetchJpnList`. Card: BE-05. Contract: missing.

### M02-44 `GET /api/jpn/:id/ppd` (SRS #41)
- Auth: public. Response: 200 `Env-D` `Ppd[]` = `[{ id, jpnId, code (e.g. "PPD GOMBAK"), name (e.g. "PPD Gombak") }]` by code. Errors: 404 `E404` for an unknown JPN.
- Source: R:34. Client: `fetchPpdList`. Card: BE-05. Contract: missing.

### M02-45 `GET /api/me/parent-invite` (L45 #1)
- Auth: `requireRole('student')` (401; 403 for other roles).
- Response: 200 `Env-D` `ParentInviteView` = `{ token (64 lowercase hex), createdAt, parents: [{ id, name, email, linkedAt }] }`; the token is created on the first call; parents sorted by name (ms collation, case-insensitive) then id.
- Side effects: `parent_invites` row created on first read. No time expiry in the mock (BE-25 AC2 requires expiring, hashed, single-use tokens: OQ-API-B1-15).
- Source: `parent-invites.ts` R:149, H:92. Client: `api/parent-invite.ts` `fetchParentInvite`. Card: BE-25. Contract: missing.

### M02-46 `POST /api/me/parent-invite/generate` (L45 #2)
- Auth: student. Response: 200 `Env-D` `{ token, createdAt, status: "Link jemputan baru telah dijana!" }` (status inside `data`); the old token stops working at once.
- Errors: 401, 403. Source: R:150, H:103. Client: `generateParentInvite`. Card: BE-25. Contract: missing.

### M02-47 `GET /api/parent-invites/:token` (L45 #3)
- Auth: public (session optional). Path: `token` any non-empty string.
- Response: 200 `Env-D` `InvitePreview` = `{ valid: true, student: { name, initials (first letter of first two words, upper case; "?" if empty), schoolName|null }, viewer: 'guest'|'parent'|'other' }`; `viewer` derived from the bearer token if any.
- Errors: 404 `E404` for any unknown token or a token whose student is not an active `student`.
- Source: R:151, H:115. Client: `fetchInvitePreview`. Card: BE-25. Contract: missing.

### M02-48 `POST /api/parent-invites/:token/accept` (L45 #4)
- Auth: `requireRole('parent')` (guards run before the token is looked up: 401/403 first).
- Response: 200 `Env-D` `AcceptResult` = `{ linked: true, created: boolean (false when already linked), student: { id, name, schoolName|null }, parent: { name } }`. Idempotent.
- Errors: 401, 403, 404 `E404` (unknown token/inactive student).
- Side effects: `parent_links` row if absent (no `relationship` field in the mock; BE-25 adds it).
- Source: R:152, H:131. Client: `acceptParentInvite`. Card: BE-25. Contract: missing.

### M02-49 `GET /api/admin/config/defaults` (proposed, not in SRS §7)
- Response: 200 `Env-D` `{ schoolAdminDefaultPassword, bulkImportDefaultPassword, compStudentDefaultPassword }` (strings; configuration values, dummy in the prototype; they must never be real secrets in docs or seeds). Used by S2 generator, S4 and S7 info text, and read by M02-13 / M02-18 as the default passwords.
- Errors: 401, 403. Source: `admin-config.ts` R:56. Client: `api/users.ts` `fetchAdminDefaults`. Card: BE-05 (listed under lookups). Contract: missing. (Returning default passwords from an API is a security question, OQ-API-B1-16.)

## 9. M03 curriculum (`m03/`, owner M03)

Common: admin routes use `requireRole('admin')` (401 `E401`, 403 `E403`). M03 `NOT_FOUND` messages are BM flash texts (BR-18, OBSERVED) and are the `error.message` the screens show: subject `Subjek tidak dijumpai.`, level `Tahap Pendidikan tidak dijumpai.`, chapter `Bab tidak dijumpai.`, topic `Topik tidak dijumpai.`, subtopic `Subtopik tidak dijumpai.` (INFERRED); defined in `m03/admin-common.ts:16-22`. Success flash texts (`status`, `admin-common.ts:25`, UNVERIFIED COPY): `Subjek berjaya ditambah.` / `...dikemaskini.` / `...dipadam.`; `Tahap Pendidikan berjaya ditambah.` / `...dikemaskini.` / `...dipadam.`; `Bab berjaya ...`, `Topik berjaya ...`, `Subtopik berjaya ...` (same three verbs). Body handling: `normalise` (trim, blank becomes null). Integer fields accept numbers or digit strings. Ordering (BR-08): subjects and levels by `order` then id; chapters by `chapterNumber` asc (null last) then creation order; topics by `topicNumber` in natural dotted order (`1` < `1.1` < `2`; null last) then creation order; subtopics by creation order. Timestamps `+08:00`.

Shapes (client `modules/m03-curriculum/api/*.ts`):

- `Subject` (admin) = `{ id, code, name, nameEn, icon: string|null (free text: Lucide name, Font Awesome class or emoji), color: "#RRGGBB", isCore, order, isActive, educationLevelIds: number[] (level order), createdAt, updatedAt }`. `AdminSubjectListItem` = `Subject` + `questionCount` (M04 active questions of the subject) + `levels: [{id,name}]`.
- `EducationLevel` = `{ id, code, name, nameEn, stage: 'primary'|'lower_secondary'|'upper_secondary', curriculum: string, order, isActive, grade: number|null (1-11 link to M01 `grade`; null for levels created later), createdAt, updatedAt }`. The list item adds `questionCount` (M04 active questions of the level) and `subjectCount` (linked subjects).
- `CurriculumChapter` = `{ id, subjectId, educationLevelId, name, nameEn|null, chapterNumber|null, description|null, inTree, isActive, createdSeq, createdAt, updatedAt }`; `CurriculumTopic` = `{ id, chapterId, name, nameEn|null, topicNumber: string|null, description|null, learningStandard|null, isActive, createdSeq, createdAt, updatedAt }`; `CurriculumSubtopic` = `{ id, topicId, name, nameEn|null, learningObjective|null, createdSeq, createdAt, updatedAt }` (row types in `modules/m03-curriculum/mock/repository/types.ts:86-127`; `inTree=false` marks 60 legacy chapters that no tree read or write returns; they behave as missing for chapter and topic endpoints).

### M03-01 `GET /api/admin/subjects` (SRS #1)
- Response: 200 `Env-L` (unpaged) of `AdminSubjectListItem`, all subjects (active and inactive). Errors: 401, 403.
- Source: `admin-subjects.ts` R:133. Client: `api/admin-subjects-levels.ts` `fetchAdminSubjects`; `api/admin-curriculum.ts` `fetchSubjectOptions`. Card: BE-08. Contract: missing.

### M03-02 `GET /api/admin/subjects/:id` (SRS #2)
- Response: 200 `Env-D` `Subject`. Errors: 401, 403, 404 `NOT_FOUND` `Subjek tidak dijumpai.`
- Source: R:143. Client: `fetchAdminSubject`. Card: BE-08. Contract: missing.

### M03-03 `POST /api/admin/subjects` (SRS #3)
- Request body: `name` (required, string, max 255), `nameEn` (required, string, max 255), `code` (required, string, max 20, unique case-insensitive across subjects: `The code has already been taken.`; stored upper-case), `icon` (string, max 100; an empty value is stored as null; default when the key is absent: `fas fa-book`), `color` (string `#RRGGBB`: `The color field format is invalid.`; default `#4f46e5`), `isCore` (boolean, default false), `order` (integer >= 0: `The order field must be at least 0.`, default 0), `educationLevelIds` (array of existing level ids: `The education level ids field must be an array.` / `The selected education level ids is invalid.`; default `[]`).
- Response: 201 `Env-DS` `Subject`, `status: "Subjek berjaya ditambah."`; a new subject is `isActive` true.
- Errors: 401, 403, 422 `E422`. Side effects: `subjects` row + `subject_levels` links (the v2 plan derives the pivot instead, BE-08 AC3, OQ-API-B1-17).
- Source: R:154. Client: `createSubject`. Card: BE-08. Contract: missing.

### M03-04 `PUT /api/admin/subjects/:id` (SRS #4)
- Request body: as M03-03; on update an absent `icon`, `color`, `isCore`, `order` or `educationLevelIds` key keeps the stored value (INFERRED); `name`, `nameEn`, `code` stay required; the code is unique ignoring this subject. Links are replaced by `educationLevelIds` when sent.
- Response: 200 `Env-DS` `Subject`, `status: "Subjek berjaya dikemaskini."`. Errors: 401, 403, 404 (`Subjek tidak dijumpai.`), 422.
- Source: R:162. Client: `updateSubject` (raw). Card: BE-08. Contract: missing.

### M03-05 `PATCH /api/admin/subjects/:id/active` (SRS #5)
- Request body: `isActive` (required, boolean: `The is active field is required.` / `The is active field must be true or false.`).
- Response: 200 `Env-D` `{ id, isActive }` (no `status`). Errors: 401, 403, 404 (`Subjek tidak dijumpai.`), 422.
- Source: R:179. Client: `setSubjectActive`. Card: BE-08. Contract: missing.

### M03-06 `DELETE /api/admin/subjects/:id` (SRS #6)
- Response: 200 `Env-DS` `{ deleted: 1 }`, `status: "Subjek berjaya dipadam."`. Cascade (BR-10): the level links and every chapter of the subject (including out-of-tree chapters) with their topics and subtopics. The mock does not touch M04 questions.
- Errors: 401, 403, 404 (`Subjek tidak dijumpai.`). Side effects: cascade delete in one transaction.
- Source: R:196. Client: `deleteSubject` (raw). Card: BE-08. Contract: missing.

### M03-07 `GET /api/admin/education-levels` (SRS #7)
- Response: 200 `Env-L` (unpaged) of the level plus `questionCount`, `subjectCount`; all levels, `order` then id. Errors: 401, 403.
- Source: `admin-levels.ts` R:95. Client: `fetchAdminLevels`; `fetchLevelOptions`. Card: BE-08. Contract: missing.

### M03-08 `GET /api/admin/education-levels/:id` (SRS #8)
- Response: 200 `Env-D` `EducationLevel`. Errors: 401, 403, 404 (`Tahap Pendidikan tidak dijumpai.`). Source: R:105. Client: `fetchAdminLevel`. Card: BE-08. Contract: missing.

### M03-09 `POST /api/admin/education-levels` (SRS #9)
- Request body: `name` (required, string, max 255), `nameEn` (required, string, max 255), `code` (required, string, max 10, unique case-insensitive: `The code has already been taken.`; stored upper-case), `stage` (required; one of the 3 stages), `curriculum` (required, string, max 255), `order` (integer >= 0; default 0).
- Response: 201 `Env-DS` `EducationLevel` (`isActive` true, `grade` null), `status: "Tahap Pendidikan berjaya ditambah."`. Errors: 401, 403, 422.
- Side effects: `education_levels` row. Source: R:116. Client: `createLevel` (raw). Card: BE-08. Contract: missing.

### M03-10 `PUT /api/admin/education-levels/:id` (SRS #10)
- Request body as M03-09 (code unique ignoring itself). `isActive` and `grade` are not changed by this call.
- Response: 200 `Env-DS` `EducationLevel`, `status: "Tahap Pendidikan berjaya dikemaskini."`. Errors: 401, 403, 404, 422.
- Source: R:125. Client: `updateLevel` (raw). Card: BE-08. Contract: missing.

### M03-11 `PATCH /api/admin/education-levels/:id/active` (SRS #11)
- Request and response as M03-05 (`{ id, isActive }`); 404 `Tahap Pendidikan tidak dijumpai.`
- Source: R:141. Client: `setLevelActive`. Card: BE-08. Contract: missing.

### M03-12 `DELETE /api/admin/education-levels/:id` (SRS #12)
- Response: 200 `Env-DS` `{ deleted: 1 }`, `status: "Tahap Pendidikan berjaya dipadam."`. Cascade: subject links of the level and every chapter of the level (with topics and subtopics).
- Errors: 401, 403, 404. Source: R:158. Client: `deleteLevel` (raw). Card: BE-08. Contract: missing.

### M03-13 `GET /api/admin/curriculum` (SRS #13)
- Purpose: S1 curriculum tree of one subject and level.
- Query: `subjectId`, `educationLevelId` (both required integers).
- Response: 200 `Env-D` `{ subject: {id,name}, level: {id,name}, stats: { chapters, topics, subtopics }, chapters: ChapterNode[] }` where `ChapterNode` = chapter + `topics: (topic + subtopics: subtopic[])[]`; only `inTree` chapters of that subject and level; counts include inactive records (BR-06).
- Errors: 401, 403; 422 `fields.subjectId` / `fields.educationLevelId`: `The subject id field is required.`, `The subject id field must be an integer.`, `The education level id field is required.`, `The education level id field must be an integer.`; 404 `Subjek tidak dijumpai.` / `Tahap Pendidikan tidak dijumpai.`
- Source: `admin-curriculum.ts` R:172. Client: `api/admin-curriculum.ts` `fetchCurriculumTree`. Card: BE-08. Contract: missing.

### M03-14 `GET /api/admin/curriculum/chapters/:id` (SRS #14)
- Response: 200 `Env-D` chapter + `subject: {id,name}` + `level: {id,name}`. Errors: 401, 403, 404 `Bab tidak dijumpai.`
- Source: R:195. Client: `fetchChapter`. Card: BE-08. Contract: missing.

### M03-15 `POST /api/admin/curriculum/chapters` (SRS #15)
- Request body: `subjectId` (required integer, existing subject), `educationLevelId` (required integer, existing level), `name` (required, string, max 255), `nameEn` (string, max 255), `chapterNumber` (integer >= 1: `The chapter number field must be at least 1.`), `description` (string). Invalid references: `The selected subject id is invalid.` / `The selected education level id is invalid.`
- Response: 201 `Env-DS` chapter (`inTree` true, `isActive` true), `status: "Bab berjaya ditambah."`. Errors: 401, 403, 422.
- Side effects: `chapters` row (`createdSeq` = next). Source: R:206. Client: `createChapter` (raw). Card: BE-08. Contract: missing.

### M03-16 `PUT /api/admin/curriculum/chapters/:id` (SRS #16)
- Request body as M03-15 (subject and level can be re-assigned) plus `isActive` (boolean; absent keeps the stored value).
- Response: 200 `Env-DS` chapter, `status: "Bab berjaya dikemaskini."`. Errors: 401, 403, 404 `Bab tidak dijumpai.`, 422.
- Source: R:214. Client: `updateChapter` (raw). Card: BE-08. Contract: missing.

### M03-17 `DELETE /api/admin/curriculum/chapters/:id` (SRS #17)
- Response: 200 `Env-DS` `{ deleted: { chapters: 1, topics: n, subtopics: m } }`, `status: "Bab berjaya dipadam."`. Cascade to topics and subtopics.
- Errors: 401, 403, 404 `Bab tidak dijumpai.` (also for an out-of-tree chapter). Source: R:237. Client: `deleteChapter`. Card: BE-08. Contract: missing.

### M03-18 `GET /api/admin/curriculum/topics/:id` (SRS #18)
- Response: 200 `Env-D` topic + `chapter` (= chapter + `subject` + `level` refs). Errors: 401, 403, 404 `Topik tidak dijumpai.`
- Source: R:251. Client: `api/admin-curriculum.ts` `fetchTopic`. Card: BE-08. Contract: missing.

### M03-19 `POST /api/admin/curriculum/topics` (SRS #19)
- Request body: `chapterId` (required integer; an existing in-tree chapter: `The selected chapter id is invalid.`), `name` (required, string, max 255), `nameEn` (string, max 255), `topicNumber` (string, max 20; a JSON number is read as its text), `description` (string), `learningStandard` (string).
- Response: 201 `Env-DS` topic, `status: "Topik berjaya ditambah."`. Errors: 401, 403, 422. Side effects: `topics` row.
- Source: R:264. Client: `createTopic` (raw). Card: BE-08. Contract: missing.

### M03-20 `PUT /api/admin/curriculum/topics/:id` (SRS #20)
- Request body as M03-19 without `chapterId` (fixed after creation, ignored) plus `isActive` (absent keeps).
- Response: 200 `Env-DS` topic, `status: "Topik berjaya dikemaskini."`. Errors: 401, 403, 404 `Topik tidak dijumpai.`, 422.
- Source: R:278. Client: `updateTopic` (raw). Card: BE-08. Contract: missing.

### M03-21 `DELETE /api/admin/curriculum/topics/:id` (SRS #21)
- Response: 200 `Env-DS` `{ deleted: { topics: 1, subtopics: n } }`, `status: "Topik berjaya dipadam."`. Errors: 401, 403, 404 `Topik tidak dijumpai.`
- Source: R:301. Client: `deleteTopic`. Card: BE-08. Contract: missing.

### M03-22 `POST /api/admin/curriculum/subtopics` (SRS #22)
- Request body: `topicId` (required integer, existing topic: `The selected topic id is invalid.`), `name` (required, string, max 255), `nameEn` (string, max 255), `learningObjective` (string).
- Response: 201 `Env-DS` subtopic (appended last), `status: "Subtopik berjaya ditambah."`. Errors: 401, 403, 422.
- Source: R:313. Client: `createSubtopic` (raw). Card: BE-08. Contract: missing.

### M03-23 `PUT /api/admin/curriculum/subtopics/:id` (SRS #23)
- Request body: `name` (required), `nameEn`, `learningObjective` as M03-22 (topic fixed). Response: 200 `Env-DS` subtopic, `status: "Subtopik berjaya dikemaskini."`. Errors: 401, 403, 404 `Subtopik tidak dijumpai.`, 422.
- Source: R:327. Client: `updateSubtopic` (raw). Card: BE-08. Contract: missing.

### M03-24 `DELETE /api/admin/curriculum/subtopics/:id` (SRS #24)
- Response: 200 `Env-DS` `{ deleted: 1 }`, `status: "Subtopik berjaya dipadam."`. Errors: 401, 403, 404 `Subtopik tidak dijumpai.`
- Source: R:345. Client: `deleteSubtopic`. Card: BE-08. Contract: missing.

### M03-25 `GET /api/topics` (SRS #25)
- Purpose: S12 Topik catalogue (the legacy "topics" of grade levels, a dataset separate from the admin chapter tree).
- Auth: `requireAuth()` (any role; the matrix #24 menu item is Murid only, OQ-API-B1-12).
- Query: `gradeLevel` (`DARJAH_1`..`DARJAH_6`, `TINGKATAN_1`..`TINGKATAN_5`), `subject` (`MATEMATIK, BAHASA_MELAYU, BAHASA_INGGERIS, SAINS, PENDIDIKAN_ISLAM, PENDIDIKAN_MORAL, SEJARAH, GEOGRAFI`); both case-insensitive exact, combined with AND; unknown values match nothing. Sort by `sequence` then id.
- Response: 200 `Env-L` (unpaged) of `TopicCard` = `{ id, gradeLevel, subject, subjectLabel (code with "_" replaced by a space), name, description|null, subtopicCount, subtopicsPreview: string[] (first 3 subtopic names) }`.
- Errors: 401. Side effects: none.
- Source: `student-curriculum.ts` R:116. Client: `api/student-curriculum.ts` `fetchTopics`. Card: BE-08. Contract: missing.

### M03-26 `GET /api/topics/:id` (SRS #26)
- Auth: any session. Path `id` integer (non-numeric: no route match, so 404).
- Response: 200 `Env-D` `TopicDetail` = `{ id, gradeLevel, subject, subjectLabel, practiceCode ('MATH','BM','BI','SCI','PI','PM','SEJ','GEO'), name, description|null, icon|null, sequence, subtopics: [{ id, name, description|null, progress }], progress: { questionsAnswered, progress } }`. Progress is derived per request for the CURRENT user from the M05 answer log (BR-19): the k-th legacy topic of (subject, grade) maps to the k-th chapter of (subject practice code, level of that grade); `questionsAnswered` = the user's answers in that chapter, `progress = min(100, round(100 * correct / 20))`; every subtopic shows the topic progress. A topic without a mapped chapter reads 0/0. Nothing is stored. (BE-08 says progress is not computed in BE-08 but derived in BE-13: OQ-API-B1-18.)
- Errors: 401, 404 `E404` (`Not Found.`).
- Source: R:126. Client: `fetchTopic` (student file). Card: BE-08. Contract: missing.

### M03-27 `GET /api/learning-map` (SRS #27)
- Purpose: S14 Peta Belajar.
- Auth: any session.
- Query: `subject` (empty or absent = `MATEMATIK`; an unknown code is kept as typed and yields no topics), `grade` (one of `DARJAH_1`..`DARJAH_4`; anything else = `DARJAH_4`).
- Response: 200 `Env-D` `LearningMap` = `{ subject, subjectLabel (pill label, else the code title-cased), grade, gradeOptions: ['DARJAH_1','DARJAH_2','DARJAH_3','DARJAH_4'], subjects: [{ code, label, emoji, color }] (the 7 fixed pills, `student-curriculum.ts:38`), stats: { done (topics in state mastered), total, progress (rounded mean of topic progress, 0 when none) }, topics: [{ id, name, icon|null, state ('mastered'|'started'|'unlocked'|'locked'), progress, sessions, questionsAnswered, practiceUrl: "/practice?topic_id={id}" | null (locked) }] }`. State per topic in `sequence` order (BR-14): `mastered` when progress >= 80; else `started` when sessions >= 1 or questionsAnswered >= 1; else `unlocked` when it is one of the first two topics or the previous topic is started or mastered; else `locked`.
- Errors: 401. Side effects: none.
- Source: R:160. Client: `fetchLearningMap`. Card: BE-08. Contract: missing.

### M03-28 `GET /api/subjects` (SRS #28)
- Auth: any session. Query: `educationLevelId` (integer of an existing level; non-numeric or unknown is ignored, meaning no filter).
- Response: 200 `Env-L` (unpaged) of `{ id, code, name, nameEn, icon|null, color, isCore, educationLevelIds }`; active subjects only; `order` then id.
- Errors: 401. Source: `lookups.ts` R:12. Client: `api/lookups.ts` `fetchSubjects`. Card: BE-08. Contract: missing.

### M03-29 `GET /api/education-levels` (SRS #29)
- Auth: any session. Response: 200 `Env-L` (unpaged) of `{ id, code, name, nameEn, stage, grade|null }`; active levels only; `order` then id.
- Errors: 401. Source: `lookups.ts` R:31. Client: `fetchEducationLevels`. Card: BE-08. Contract: missing.

## 10. Uncovered endpoints

One endpoint, by user decision: `POST /api/admin/users/:id/impersonate` (M02-09) is **not ported** (UD-2, dropped by user decision 2026-10-19). Otherwise none. Before the card audit (commit 63d363c) 24 mock routes were not in any BE card endpoint table (M01 2, M02 6, M03 16); BE-06, BE-05 and BE-08 now list them. The audit assigns four M02 routes to BE-25, not BE-05: `GET /api/admin/schools/:id/quota` (M02-15), `POST /api/admin/students/import` (M02-14) and the user-package routes (M02-11, M02-12). One card/mock difference remains: BE-05 lists `GET /api/schools` as a public picker while the mock route is admin-only (M02-31, OQ-API-B1-14).

Contract-only endpoints (S-01..S-04) have a card (BE-03) but no mock handler and no frontend client.

## 11. Open questions

- **OQ-API-B1-1 (login/logout shape).** **Resolved by UD-1 (user decision 2026-10-19): the real API follows the contract (string ids, cookie + CSRF, `Session`, 401 `INVALID_CREDENTIALS`, no Bearer); the LEAD realigns mock and HttpTransport (V2-T31).** The mock `POST /api/auth/login` takes `{email,password,remember}` and returns `{data:{token,expiresAt,user:UserMe}}`; errors are 422 `Email atau kata laluan tidak sah.` (with `fields.email`), 403 `ACCOUNT_INACTIVE` `Akaun anda tidak aktif. Sila hubungi pentadbir.`, 429 `Too many login attempts...`. The contract (`openapi.ts`, BE-03) takes `{identifier,password,schoolId?,remember}`, returns `{data:Session}` with a cookie, and uses 401 `INVALID_CREDENTIALS` `E-mel/Nama pengguna atau kata laluan tidak sah.`, 403 `ACCOUNT_INACTIVE` `Akaun anda tidak aktif atau telah digantung. Sila hubungi pentadbir.`, 429 `Terlalu banyak percubaan...`. They differ in field name, status, code, BM copy and body. The frontend login page and `stores/session.ts` cannot switch to http until the lead realigns one side (V2-T31). `POST /api/auth/register` and the reset endpoints also return the mock `SessionPayload`, which has no contract schema.
- **OQ-API-B1-2 (auth transport).** **Resolved by UD-1 (user decision 2026-10-19): the real API follows the contract (string ids, cookie + CSRF, `Session`, 401 `INVALID_CREDENTIALS`, no Bearer); the LEAD realigns mock and HttpTransport (V2-T31).** Mock = Bearer token in `localStorage['pp.auth']`; real = HTTP-only cookie + `X-CSRF-Token` (BE-03; plan section 7 says do not add Bearer). Logout in the mock is a public 204 with no CSRF; the contract requires CSRF when a session exists.
- **OQ-API-B1-3 (generic error copy).** Mock generic messages (`Unauthenticated.`, `This action is unauthorized.`, `Not Found.`, `Server Error`, Laravel validation templates) are English; the contract copy for auth codes is BM. The M01 SRS marks the English text UNVERIFIED. Which language should the real API return for generic 401/403/404/422 and for field validation messages the UI shows directly?
- **OQ-API-B1-4 (ids).** **Resolved by UD-1 (user decision 2026-10-19): the real API follows the contract (string ids, cookie + CSRF, `Session`, 401 `INVALID_CREDENTIALS`, no Bearer); the LEAD realigns mock and HttpTransport (V2-T31).** Contract and plan: opaque string ids; mock and all clients: integers (`id: number`, `Number(req.params.id)`, `int()` route params, `ids: number[]` bodies, `userId` in notifications). Every response/request type in this part needs the string realignment (listed in `v2-frontend.md` section 6) and the frontend types change with it. Not decided per endpoint.
- **OQ-API-B1-5 (roles and landing).** The mock has 8 roles incl. `jpn_officer` and `landingPath` `/admin`, `/ppd/dashboard`, `/jpn/dashboard`, `/dashboard`; the contract has 7 (`RoleCode` without `jpn_officer`; D31a single PPD/JPN role) and v2 landing paths (`v2-frontend.md` 4.4). `meta.roleCounts` (M02-01) has no `jpnOfficer`. M02-04/05 accept `jpn_officer`, M02-13 accepts `ppd_officer`.
- **OQ-API-B1-6 (Mod Pelajar / impersonate).** **Resolved by UD-2 (user decision 2026-10-19): impersonation is dropped; Mod Pelajar is `POST /api/session/mode` only (D31c).** The mock emulates Mod Pelajar with `POST /api/admin/users/2/impersonate` (a second full session; the admin token stays valid; no audit; student id 2 hard-coded). The contract has `POST/DELETE /session/mode` (same session, `mode.isTest`, `X-CSRF`). BE-05 says "align with the session mode of BE-03 and flag conflicts". M02-09 is also used for plain "Login As" (no return control, FR-M02-12), which the contract does not model (and M27 has its own impersonation switch with return path, outside this part).
- **OQ-API-B1-7 (prototype scope).** `POST /api/auth/login` answers 403 `ROLE_OUT_OF_SCOPE` `Peranan ini tidak termasuk dalam prototaip.` when `isPrototypeScopeOn()` and the role is not student/teacher/school_admin/admin (D43). Not in the contract error list. Keep, drop, or make it a deployment flag?
- **OQ-API-B1-8 (registration).** BE-06: "school join code, role limited to student/teacher/parent". Mock: `schoolId` (must exist), optional `referralCode` (M14), `grade` required for students, `icNumber`, no join code, no username. Which is authoritative?
- **OQ-API-B1-9 (avatar).** Mock stores a base64 data URL in `users.avatarUrl` and returns it; BE-06/BE-04 will store a file. Response field name stays `avatarUrl`; confirm it becomes a served URL and whether the JPEG/PNG/WebP and 2 MB limits stay.
- **OQ-API-B1-10 (password reset disclosure).** BE-06 AC2 requires a generic response regardless of account existence and invalidation of other sessions. The mock answers 422 `We can't find a user with that email address.` for an unknown e-mail (M01-03/04), reveals an IC mismatch (M01-05), returns the reset `token` in the response body of the IC reset (M01-05), and does not invalidate other sessions. Mock = replicate live Laravel; card = secure. Which wins? (Also: reset tokens in the mock are 60 min and shared between the e-mail and IC flows; cards say "expiry per SRS".)
- **OQ-API-B1-11 (faith).** `GET/PUT /api/me/settings` carry `faith`; `v2-data-migration.md` section 5 / plan 14.7 drops `faith`. Confirm whether the field stays in the API.
- **OQ-API-B1-12 (role scope of learner reads).** `GET /api/topics`, `/api/topics/:id`, `/api/learning-map`, `/api/subjects`, `/api/education-levels` accept any session role. The role-access matrix lists Topik and Peta Belajar as Murid-only menu items; the matrix does not say whether teachers/admins may call the API. Keep `requireAuth` only?
- **OQ-API-B1-13 (Admin Sekolah on admin routes).** All `/api/admin/users*`, `/api/admin/schools*`, subscriptions, comp-students, imports are `requireRole('admin')` in the mock (a `school_admin` gets 403; the school-admin portal uses M27 routes). BE-05 AC2/BE-25 AC4 describe school-admin scoped access to the same paths (own school, 404 for others). Either the cards add a scoped variant or the paths stay admin-only and M27 (BE-21) serves school admins.
- **OQ-API-B1-14 (`GET /api/schools`).** BE-05 lists `GET /api/schools` among the "public school picker" routes; in the mock it is admin-only and requires `all=1` (else 422 `The all field is required.`); the public picker is `GET /api/schools/search`. `GET /api/admin/schools/options` returns the same data as `GET /api/schools?all=1` (XL-13 alias).
- **OQ-API-B1-15 (parent invite tokens).** Mock: 64-hex token per student, no expiry, reusable by many parents, stored in clear, `parent_links` without `relationship`. BE-25 AC2: random, hashed at rest, single-use, expiring, link with `relationship`. The preview response (`student.name`, `initials`, `schoolName`) is a personal-data exposure on a public endpoint; confirm the minimal fields.
- **OQ-API-B1-16 (default passwords endpoint).** M02-49 returns three fixture default passwords to the admin UI (generator on S2, S4, S7 info text) and M02-13/18 apply them to new accounts. Returning a shared default password from an API (and setting it on migrated roster accounts) conflicts with BE-06 AC3 (`must_reset_password`) and the security rules. Mock values are dummy.
- **OQ-API-B1-17 (subject-level pivot).** Mock M03-03/04 write `subject_levels` links from `educationLevelIds`; BE-08 AC3 derives the pivot from chapters ("no .cloud source", `v2-data-migration.md` 4.2). `educationLevelIds` is returned by M03-28 and is a request field of M03-03/04; the writer must decide whether it stays writable.
- **OQ-API-B1-18 (topic progress).** M03-26/27 compute per-user progress from the M05 answer log (BR-19: 20 correct answers = 100%, k-th legacy topic to k-th chapter mapping). BE-08 states progress is not computed there and points to BE-13, but BE-13 lists no `/api/topics*` or `/api/learning-map` endpoint. Who serves these two endpoints, and does the legacy topic dataset (125 rows, grade-level topics) migrate at all (it is not in the plan 14.7 matrix)?
- **OQ-API-B1-19 (stale counts).** Plan section 6.3 and the brief say M01 17 / M02 43 / M03 12 routes; the mock has 19 / 49 / 29 (SRS-numbered 19 + core `GET /api/me`, 43 + 6, 29). The 12 in M03 matches only the admin curriculum tree. The plan table should be corrected.
- **OQ-API-B1-20 (pagination parameters).** Contract `PageQuery` allows `pageSize` (default 20, max 100). Mock list endpoints use a fixed page size per endpoint (users 25, schools 30, comp-students 50, notifications 20) and ignore `pageSize`; only M02-36 reads `perPage` (25/50/100/200). Several lists are unpaged (M02-32, M03 lists, lookups). Decide: keep fixed sizes (frontend switch is a no-op) or add `pageSize`.
- **OQ-API-B1-21 (mock-only behaviours to drop).** M02-17/18/19/24 answer 500 `Pelajar komplimen memerlukan pemalam mock M10...` when the M10 store is not booted; `IMPORT_*`/`MSG_*` placeholders marked UNVERIFIED COPY (success texts, own-delete refusals, quota refusal) have no live source; ids from 9,000,001 / 10,301 and demo reset tokens `demo-reset-token` / `demo-expired-token` are mock fixtures and must not be reproduced.
- **OQ-API-B1-22 (delete behaviour).** M02-06/07 cascade-delete a user (links, invites, packages, complimentary profile, sessions) and return 200 with a body; M03-06/12/17/21 cascade-delete curriculum rows. BE-05 AC6 asks whether the real API blocks or cascades when dependent rows exist (practice history, classes, wallets, which the mock does not check). M03 deletes also do not check M04 questions that reference the chapter/topic.
- **OQ-API-B1-23 (SRS not re-read).** The M01, M02 and M03 SRS files were consulted through the handler header comments that quote their section/BR numbers; where the SRS states a rule the mock does not implement, this catalogue follows the mock. A verification pass against `docs/requirements/srs/M01-*.md`, `M02-*.md`, `M03-*.md` is still advisable before the cards are finalised.

