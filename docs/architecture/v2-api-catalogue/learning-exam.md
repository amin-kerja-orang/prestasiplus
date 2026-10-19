# API catalogue: Learning and exam (M04, M05, M06, M07, M13, M25, M28 + SPM intake)

Part of the v2 API catalogue (index: `v2-api-catalogue.md`). Written by the Architect for the people and agents who build the real backend (NestJS 11 + Prisma + PostgreSQL) so that the frontend can switch from the in-browser mock to HTTP **with no change**. The frontend mock is the behavioural spec: this file documents what the mock does and never invents a business rule. Where a card, the contract or the mock disagree, the disagreement is listed as an open question (section 13), not resolved here.

Source snapshot: worktree `D:\Dev Projects\pp-docs`, branch `docs/v2-reference`, 2026-10-19. File paths and line numbers below refer to that snapshot and will drift; use the function names.

## 1. Scope and endpoint counts

Counts come from this command, run per module (it finds every `route(` registration, including those that span several lines; test folders excluded):

```
grep -rnE "\broute\(" src/modules/<module> --include=*.ts | grep -v __tests__ | wc -l
```

| Module | Mock folder | `route(` registrations | Plan section 6.3 count | Notes |
|---|---|---:|---:|---|
| M04 Question bank | `src/modules/m04-question-bank/mock/handlers` | 30 | 25 | includes the 3 DSKP lookups (`/api/guru/dskp/*`, M10-owned data) registered here |
| M05 Practice | `src/modules/m05-practice/mock/handlers` | 23 | 20 | includes `GET /api/remedial-tests/:id` (registered by `remedialPreviewRoutes`) |
| M06 SPM classic | `src/modules/m06-spm/mock/handlers` | 14 | 11 (README backlog) | includes the provisional `GET /api/duta/recommendations` |
| M07 PKSK | `src/modules/m07-pksk/mock/handlers` | 21 | 16 (README backlog) | 9 student + 7 admin questions + 5 admin access/packages |
| M13 Cikgu Alesa | `src/modules/m13-cikgu-alesa/mock/handlers` | 10 | 8 (README backlog) | includes the two detail routes |
| M25 AI Centre | `src/modules/m25-ai-centre/mock/handlers` | 1 | 1 | `GET /api/duta/recommendations` is declared in its client but registered by M06 |
| M28 Bijak SPM | `src/modules/m28-bijak-spm` | **0** | 0 (about 12 methods) | a class, documented as 16 public methods (section 10) |
| **Total HTTP routes** | | **99** | 81 | the plan/README counts are older than the mock; the mock is the truth (OQ-API-B2-9) |

Each registered route is unique by method + pattern (the router refuses duplicates at boot, `src/mock/server/router.ts`). Every `route` array is wired into its module's `routes:` list (`mock/index.ts`), checked for M04, M05, M06, M07, M13, M25.

Also covered: the admin SPM question intake (D52), documented as 10 operations IN-01..IN-10 (section 11). Source: local commit `b2e1033` on `feature/student-prototype`, not yet in `feature/v2-backend`; like Bijak it has no HTTP routes. Two operations have no card endpoint (IN-05, IN-09); IN-04 is only partly covered and IN-06/IN-08 have no public endpoint.

Contract status of the whole part: `packages/contract/src` contains only `common`, `session`, `auth`, `access` (and `openapi.ts` registers only `/auth/login`, `/auth/logout`, `/session`, `/session/role`, `/session/mode` plus the access components). **All 99 routes, all 16 Bijak operations and all intake endpoints are `missing`**: `exists` = 0, `partial` = 0. The shared pieces that already exist and must be reused: `Id`, `Timestamp`, `DateOnly`, `ListMeta`, `PageQuery`, `ErrorBody`, `ErrorCode` (`packages/contract/src/common/*`).

## 2. Conventions used in this file

**Transport (mock, `src/mock/server/*`, `src/api/client.ts`).**

- Path prefix `/api`. JSON bodies, or `multipart/form-data` where stated. Authentication in the mock is a Bearer token resolved to a session `{ token, userId, role }`; the real API uses the cookie session (plan section 7). Roles in the mock: `student, teacher, parent, sponsor, school_admin, ppd_officer, jpn_officer, admin`.
- Route params: `int()` accepts digits only; a non-matching value means **no route matches** and the answer is `404 NOT_FOUND "Not Found."`. Static segments win over `:param` segments (`/api/questions/summary` before `/api/questions/:id`).
- Response kinds used below:
  - **E1** `{ data }` (200/201), the client unwraps `data`.
  - **E2** `{ data: T[], meta: ListMeta }` with the Laravel-style meta `{ page, pageSize, totalItems, totalPages, from, to, counts? }` plus module extras (the client keeps `meta`). Helpers: `paged/paginate` (a page is cut; an out-of-range page is an empty page that keeps the requested `page`; `totalPages = max(1, ceil(total/pageSize))`; an invalid `page` means 1) and `unpaged` (`page 1`, `pageSize = max(1, n)`, `totalPages 1`; used where live did not paginate).
  - **E3** `{ data, status }`: mutations that return a BM flash string in `status` (read with `raw: true`). `status` is not part of the common envelope schemas; the contract must add it (OQ-API-B2-19).
  - **RAW** body sent untouched (bare arrays, `{ ok, message }`, `{ success, message }`, live-shaped bodies, CSV, files). Marked per endpoint.
- Validation errors: `422` `{ error:{ code:'VALIDATION_ERROR', message, fields:{ field: message } } }`; `message` is the first field message plus " (and N more error(s))" when several (`summarizeFields`). Where a handler uses `fail(...)` directly the message and `fields` are as written in the block.

**Shared error shorthands** (used in the blocks):

| Code | Meaning | Status, code, message |
|---|---|---|
| `E-AUTH` | `requireAuth()`: no session | 401 `UNAUTHORIZED` "Unauthenticated." |
| `E-ADMIN` | `requireRole('admin')` | 401 `UNAUTHORIZED` "Unauthenticated." (no session); 403 `FORBIDDEN` "This action is unauthorized." (any other role) |
| `E-404` | unknown route, non-numeric `int()` param, or `notFound()` from a handler | 404 `NOT_FOUND` "Not Found." (unless a block gives its own message) |
| `E-422` | validation | 422 `VALIDATION_ERROR` as above |

The default messages "Unauthenticated.", "This action is unauthorized.", "Not Found." are the Laravel English defaults in `src/mock/server/respond.ts` (`DEFAULT_ERROR_MESSAGES`); the contract says `message` is BM for direct display (OQ-API-B2-18).

**Guards** (`src/mock/auth/middleware.ts`): `G-AUTH` = `requireAuth()` (any signed-in role). `G-ADMIN` = `requireRole('admin')`. Object-level rules (owner only) are described per endpoint.

**Roles and the access matrix.** `docs/requirements/role-access-matrix.md` covers the student prototype (Murid, Guru, Admin Sekolah). The v2 portal matrix is `packages/contract/src/access/matrix.ts` (Admin Pusat `admin`, Pegawai PPD `ppd_officer`, Admin Sekolah `school_admin`); the learning-side items are the Pembelajaran list. Learning/exam admin items are `admin` = F and `ppd_officer`/`school_admin` = `-`: BS-01 Bank Soalan, BS-02 Import & Semakan, BS-03 Sumber Kertas, BS-04 Kualiti Soalan, BS-05 Laporan Soalan, BS-06 Soalan PKSK, BS-07 Audio KBAT, KS-01..KS-12 (Kertas & SPM: Gambaran SPM, Databank Soalan, Latih Tubi, Tracking A, Subjektif, Bijak SPM (Simulasi), Kertas Subjektif, Kontrak Simulasi, Set Builder, Tanda Karangan, Ramalan SPM, Set Soalan). Student menu rows used: 13 SPM, 14 Heatmap Topik Lemah, 16 Latih Tubi, 17 Soalan Berstruktur, 19 PKSK, 37 Cikgu Alesa, 9 Soalan by Chapter, 12 Remedial. The mock mostly checks only "signed in" for student features; where a stricter rule exists in the matrix it is called out as an open question.

**Contract status values.** `exists` = a zod schema and an `openapi.ts` path for the endpoint; `partial` = a path with an incomplete schema; `missing` = neither. Here every endpoint is `missing`.

**Block layout.** One `###` per endpoint: Purpose, Auth, Request, Response, Errors, Side effects, Owner / code / client (module, handler file:line of the `route(` registration or function, frontend client function), Card, Contract.

## 3. Summary table

Roles: `any signed-in` = `requireAuth()` only. "Card" lists the backend card that defines the endpoint, or **UNCOVERED**. Contract status: all `missing`.

### 3.1 HTTP routes (99)

| ID | Method | Path | Roles / auth | Card | Contract |
|---|---|---|---|---|---|
| M04-01 | GET | `/api/questions` | admin | BE-09 | missing |
| M04-02 | GET | `/api/questions/summary` | admin | BE-09 | missing |
| M04-03 | POST | `/api/questions` | admin | BE-09 | missing |
| M04-04 | GET | `/api/questions/:id` | admin | BE-09 | missing |
| M04-05 | PUT | `/api/questions/:id` | admin | BE-09 | missing |
| M04-06 | DELETE | `/api/questions/:id` | admin | BE-09 | missing |
| M04-07 | POST | `/api/questions/bulk-action` | admin | BE-09, BE-10 | missing |
| M04-08 | POST | `/api/questions/:id/ai-explanation` | admin | BE-10 | missing |
| M04-09 | GET | `/api/question-reports` | admin | BE-10 | missing |
| M04-10 | POST | `/api/question-reports` | any signed-in | BE-10 | missing |
| M04-11 | GET | `/api/question-reports/mine` | any signed-in | BE-10 | missing |
| M04-12 | PATCH | `/api/question-reports/:id` | admin | BE-10 | missing |
| M04-13 | GET | `/api/question-submissions` | admin | BE-10 | missing |
| M04-14 | PATCH | `/api/question-submissions/:id/status` | admin | UNCOVERED | missing |
| M04-15 | GET | `/api/question-submissions/:id/files/:index` | admin | UNCOVERED | missing |
| M04-16 | POST | `/api/question-imports` | admin | BE-10 | missing |
| M04-17 | GET | `/api/question-imports/template` | admin | BE-10 | missing |
| M04-18 | GET | `/api/question-imports` | admin | BE-10 | missing |
| M04-19 | GET | `/api/question-quality` | admin | BE-10 | missing |
| M04-20 | POST | `/api/question-quality/audit` | admin | BE-10 | missing |
| M04-21 | GET | `/api/diagram-audit` | admin | BE-10 | missing |
| M04-22 | POST | `/api/diagram-audit/:kind/:id/image` | admin | BE-10 | missing |
| M04-23 | POST | `/api/diagram-audit/:kind/:id/dismiss` | admin | UNCOVERED | missing |
| M04-24 | GET | `/api/master-notes` | admin | BE-10 | missing |
| M04-25 | POST | `/api/master-notes/:id/:action` | admin | UNCOVERED | missing |
| M04-26 | GET | `/api/structured-questions` | admin | BE-09 | missing |
| M04-27 | GET | `/api/structured-questions/:id` | admin | UNCOVERED | missing |
| M04-28 | GET | `/api/guru/dskp/bidang` | admin, teacher | BE-10 | missing |
| M04-29 | GET | `/api/guru/dskp/sk` | admin, teacher | BE-10 | missing |
| M04-30 | GET | `/api/guru/dskp/sp` | admin, teacher | BE-10 | missing |
| M05-01 | POST | `/api/practice/sessions` | any signed-in | BE-12 | missing |
| M05-02 | POST | `/api/practice/sessions/:id/check-answer` | any signed-in | BE-12 | missing |
| M05-03 | POST | `/api/practice/sessions/:id/submit` | any signed-in | BE-12 | missing |
| M05-04 | GET | `/api/practice/sessions` | any signed-in | BE-12 | missing |
| M05-05 | GET | `/api/dashboard` | any signed-in | BE-13 | missing |
| M05-06 | GET | `/api/practice/subjects` | any signed-in | BE-13 | missing |
| M05-07 | GET | `/api/practice/subjects/:code` | any signed-in | BE-13 | missing |
| M05-08 | GET | `/api/practice/chapter-subjects` | any signed-in | BE-13 | missing |
| M05-09 | GET | `/api/practice/chapter-subjects/:code` | any signed-in | BE-13 | missing |
| M05-10 | GET | `/api/practice/revision` | any signed-in | BE-13 | missing |
| M05-11 | GET | `/api/practice/revision/:code` | any signed-in | BE-13 | missing |
| M05-12 | GET | `/api/practice/progress` | any signed-in | BE-13 | missing |
| M05-13 | GET | `/api/practice/history` | any signed-in | BE-13 | missing |
| M05-14 | GET | `/api/practice/corrections` | any signed-in | BE-13 | missing |
| M05-15 | GET | `/api/practice/mastery` | any signed-in | BE-13 | missing |
| M05-16 | GET | `/api/practice/structured` | any signed-in | BE-13 | missing |
| M05-17 | GET | `/api/practice/structured/:id` | any signed-in | BE-13 | missing |
| M05-18 | POST | `/api/practice/structured/:id/attempts` | any signed-in | BE-13 | missing |
| M05-19 | GET | `/api/spm-targets` | any signed-in | BE-13 | missing |
| M05-20 | PUT | `/api/spm-targets` | any signed-in | BE-13 | missing |
| M05-21 | GET | `/api/remedial-tests/mine` | any signed-in | BE-13 | missing |
| M05-22 | GET | `/api/missions/today` | any signed-in | BE-13 | missing |
| M05-23 | GET | `/api/remedial-tests/:id` | any signed-in | UNCOVERED | missing |
| M06-01 | GET | `/api/spm/overview` | any signed-in | UNCOVERED | missing |
| M06-02 | GET | `/api/spm/databank` | any signed-in | UNCOVERED | missing |
| M06-03 | GET | `/api/spm/latih-tubi` | any signed-in | UNCOVERED | missing |
| M06-04 | GET | `/api/spm/latih-tubi/:code` | any signed-in | UNCOVERED | missing |
| M06-05 | GET | `/api/spm/tracking-a` | any signed-in | UNCOVERED | missing |
| M06-06 | GET | `/api/spm/tracking-a/:code` | any signed-in | UNCOVERED | missing |
| M06-07 | GET | `/api/spm/subjektif` | any signed-in | UNCOVERED | missing |
| M06-08 | GET | `/api/spm-mocks` | any signed-in | UNCOVERED | missing |
| M06-09 | POST | `/api/spm-mocks` | any signed-in | UNCOVERED | missing |
| M06-10 | GET | `/api/spm-mocks/:id` | any signed-in | UNCOVERED | missing |
| M06-11 | POST | `/api/spm-mocks/:id/submit` | any signed-in | UNCOVERED | missing |
| M06-12 | GET | `/api/spm-mocks/:id/result` | any signed-in | UNCOVERED | missing |
| M06-13 | POST | `/api/spm-walkthrough/solve` | any signed-in | UNCOVERED | missing |
| M06-14 | GET | `/api/duta/recommendations` | any signed-in | UNCOVERED | missing |
| M07-01 | GET | `/api/pksk/me/access` | any signed-in | UNCOVERED | missing |
| M07-02 | GET | `/api/pksk-domains` | any signed-in | UNCOVERED | missing |
| M07-03 | GET | `/api/pksk/levels/:level/dashboard` | any signed-in + level gate | UNCOVERED | missing |
| M07-04 | GET | `/api/pksk/levels/:level/domains` | any signed-in + level gate | UNCOVERED | missing |
| M07-05 | GET | `/api/pksk/levels/:level/domains/:code` | any signed-in + level gate | UNCOVERED | missing |
| M07-06 | GET | `/api/pksk/levels/:level/exam-attempts` | any signed-in + level gate | UNCOVERED | missing |
| M07-07 | POST | `/api/pksk/levels/:level/domains/:code/practice-sessions` | any signed-in + level gate | UNCOVERED | missing |
| M07-08 | GET | `/api/pksk/levels/:level/exam` | any signed-in + level gate | UNCOVERED | missing |
| M07-09 | POST | `/api/pksk/levels/:level/exam-attempts` | any signed-in + level gate | UNCOVERED | missing |
| M07-10 | GET | `/api/admin/pksk-questions` | admin | UNCOVERED | missing |
| M07-11 | GET | `/api/admin/pksk-questions/stats` | admin | UNCOVERED | missing |
| M07-12 | POST | `/api/admin/pksk-questions/bulk` | admin | UNCOVERED | missing |
| M07-13 | GET | `/api/admin/pksk-questions/:id` | admin | UNCOVERED | missing |
| M07-14 | POST | `/api/admin/pksk-questions` | admin | UNCOVERED | missing |
| M07-15 | PUT | `/api/admin/pksk-questions/:id` | admin | UNCOVERED | missing |
| M07-16 | DELETE | `/api/admin/pksk-questions/:id` | admin | UNCOVERED | missing |
| M07-17 | GET | `/api/admin/pksk-access` | admin | UNCOVERED | missing |
| M07-18 | GET | `/api/admin/pksk-access/stats` | admin | UNCOVERED | missing |
| M07-19 | POST | `/api/admin/pksk-access` | admin | UNCOVERED | missing |
| M07-20 | POST | `/api/admin/pksk-access/:id/revoke` | admin | UNCOVERED | missing |
| M07-21 | GET | `/api/pksk-packages` | admin | UNCOVERED | missing |
| M13-01 | POST | `/api/cikgu/send` | any signed-in (guest: raw 401 {}) | UNCOVERED | missing |
| M13-02 | GET | `/api/cikgu/rph` | teacher, admin | UNCOVERED | missing |
| M13-03 | POST | `/api/cikgu/rph` | teacher, admin | UNCOVERED | missing |
| M13-04 | GET | `/api/cikgu/rph/:id` | teacher, admin | UNCOVERED | missing |
| M13-05 | GET | `/api/cikgu/essays` | teacher, admin | UNCOVERED | missing |
| M13-06 | GET | `/api/cikgu/essays/:id` | teacher, admin | UNCOVERED | missing |
| M13-07 | GET | `/api/cikgu/pbd` | teacher, admin | UNCOVERED | missing |
| M13-08 | POST | `/api/cikgu/pbd/rollup` | teacher, admin | UNCOVERED | missing |
| M13-09 | POST | `/api/cikgu/pbd/bulk-approve` | teacher, admin | UNCOVERED | missing |
| M13-10 | GET | `/api/cikgu/pbd/export.csv` | teacher, admin | UNCOVERED | missing |
| M25-01 | GET | `/api/buku-nota/heatmap` | student, admin | UNCOVERED | missing |

### 3.2 Bijak SPM operations (16 methods, 0 routes) and their target endpoints

Target paths are those defined by cards BE-15 and BE-16 (relative to `/api`; full path `/api/bijak/...`). Role in the cards: student, attempt owner only.

| ID | Mock method | Target endpoint (card) | Card | Contract |
|---|---|---|---|---|
| BJ-01 | `listPapers(userId)` | `GET /api/bijak/papers` | BE-15 | missing |
| BJ-02 | `getCover(userId, paperId)` | `GET /api/bijak/papers/:id` | BE-15 | missing |
| BJ-03 | `listContracts()` | `GET /api/bijak/contracts` | BE-15 | missing |
| BJ-04 | `subjects()` | **endpoint not yet defined** | none | missing |
| BJ-05 | `generatePaper(userId, subject, kertas)` | `POST /api/bijak/papers/generate` | BE-15 | missing |
| BJ-06 | `findInProgress(userId, paperId)` | `GET /api/bijak/papers/:paperId/in-progress` | BE-16 | missing |
| BJ-07 | `startAttempt(userId, paperId, mode, {restart})` | `POST /api/bijak/attempts` | BE-16 | missing |
| BJ-08 | `getAttemptView(userId, attemptId)` | `GET /api/bijak/attempts/:id` | BE-16 | missing |
| BJ-09 | `saveAnswers(userId, attemptId, payload)` | `PUT /api/bijak/attempts/:id/answers` | BE-16 | missing |
| BJ-10 | `submit(userId, attemptId, payload)` | `POST /api/bijak/attempts/:id/submit` | BE-16 | missing |
| BJ-11 | `abandon(userId, attemptId)` | `POST /api/bijak/attempts/:id/abandon` | BE-16 | missing |
| BJ-12 | `sweep()` | none: scheduled `AttemptSweeper` job | BE-16 | n/a |
| BJ-13 | `checkQuestion(userId, attemptId, questionId, payload?)` | `POST /api/bijak/attempts/:id/questions/:questionId/check` | BE-16 | missing |
| BJ-14 | `getResult(userId, attemptId)` | `GET /api/bijak/attempts/:id/result` | BE-16 | missing |
| BJ-15 | `history(userId)` | `GET /api/bijak/history` | BE-16 | missing |
| BJ-16 | `serverNow()` | field `serverNow` inside BJ-08 (absent from the mock view) | BE-16 | missing |

Card-only endpoints without a mock method (photos upload, admin papers, admin blueprints, intake, AI usage) are in sections 10 and 11.

## 4. M04 Question bank (30 routes)

Mock source: `src/modules/m04-question-bank/mock/handlers/*.ts` (registered by `workflow.ts` and `questions.ts`). Client: `src/modules/m04-question-bank/api/*.ts`. SRS: `docs/requirements/srs/M04-question-bank.md` (endpoint numbers `#n` below are the SRS §7 numbers quoted in the handler headers).

Module-wide facts (apply to every M04 endpoint unless a block says otherwise):

- Ids are numbers in the mock (`int()` route params). The target contract uses opaque string ids (plan 6.1, `IdSchema`); see OQ-API-B2-1.
- Mutations answer `{ data, status }` where `status` is a BM flash string; the client reads them with `raw: true`. This is a module-specific envelope extension (`status` is not in `@pp/contract` common envelopes).
- The mock model is the **.cloud-era flat objective model** (`Question` with `options[4]`, `correctAnswer 0..3`, `status` in `draft|pending_review|approved|rejected|archived|pending`). BE-09 builds the v2 part-tree model of `v2-exam-schema.md`. The wire shapes below are what the frontend consumes today; the mapping to the v2 model is an open question (OQ-API-B2-2).
- All routes except those marked otherwise are Admin Pusat only (`requireRole('admin')`). Role-access matrix (contract `access/matrix.ts`): BS-01 Bank Soalan, BS-02 Import & Semakan, BS-03 Sumber Kertas, BS-04 Kualiti Soalan, BS-05 Laporan Soalan are `admin` = F, `ppd_officer` = -, `school_admin` = -.

### M04-01 `GET /api/questions`

- **Purpose:** admin question list (S1), newest first, PKSK rows never included (`pkskDomainId = null` always applied).
- **Auth:** `G-ADMIN`. Matrix BS-01 (admin F).
- **Request (query):** `subjectId` int, `educationLevelId` int, `difficultyLevel` int (a non-numeric value matches nothing: empty page); `status` text, one of `draft|pending_review|approved|rejected|archived` (unknown = empty); `dskpFilter` `tagged|untagged` (unknown = empty); `complianceFilter` one of `missing_source` (rows without `sourceFile`), `verified_generated` (`aiVerified=true`), or a `complianceStatus` value `verified|pending_mapping|quarantined|rejected|draft` (unknown = empty); `sourceFilter` `textbook|dskp|trial|marking_scheme` (unknown = empty); `search` text (case-insensitive contains on `questionText`, trimmed); `page` int (invalid = 1); `pageSize` int (default 20, max 100).
- **Response:** 200 `{ data: QuestionRow[], meta: ListMeta }` (paged helper; out-of-range page = empty rows, requested `page` echoed). Sort: `createdAtMs desc, id asc`.
  `QuestionRow` = `{ id:number, questionText:string, subject:{id,name}|null, level:{id,name}|null, difficultyLevel:number, status, isActive:boolean, complianceStatus, aiVerified:boolean, dskpTagged:boolean, sourceType:'textbook'|'dskp'|'trial'|'marking_scheme'|'ai_generated'|null, sourceFile:string|null }` (TS: `api/questions.ts:39`).
- **Errors:** `E-ADMIN`. Invalid filter values never error.
- **Side effects:** none.
- **Owner / code / client:** M04 / `handlers/questions.ts:248` (fn `list` :101) / `fetchQuestions` (`api/questions.ts:249`).
- **Card:** BE-09. **Contract:** missing.

### M04-02 `GET /api/questions/summary`

- **Purpose:** S1 "Jumlah" and one tile per active M03 subject.
- **Auth:** `G-ADMIN`.
- **Request:** none.
- **Response:** 200 `{ data: { total:number, subjects: { id, name, icon:string|null, group:'teras'|'elektif', total:number, approved:number }[] } }`. `total` = all non-PKSK questions (Q-ALL); per subject `total` = Q-ALL, `approved` = Q-APPROVED; subjects = active M03 subjects ordered by id; `icon` = Font Awesome class from the fixed table in `handlers/question-shape.ts:20` (fallback `fa-book`); `group` = `teras` if subject `isCore` else `elektif`.
- **Errors:** `E-ADMIN`.
- **Side effects:** none.
- **Owner / code / client:** M04 / `questions.ts:250` (fn :132) / `fetchQuestionSummary` (`api/questions.ts:268`).
- **Card:** BE-09. **Contract:** missing.

### M04-03 `POST /api/questions`

- **Purpose:** admin creates one objective question. Body is multipart (live form) or JSON.
- **Auth:** `G-ADMIN`.
- **Request body** (camelCase keys; digits accepted as strings): `subjectId` int (required, must exist in M03), `educationLevelId` int (required, must exist), `difficultyLevel` int 1..5 (required), `questionType` `mcq|true_false|short_answer|fill_blank|essay` (required on create), `questionText` string (required, trimmed, at least 10 characters), `questionImage` file (JPG/PNG/WebP, max 2 MB), `dskpSpId` int|null (must name a known DSKP SP, M10), `explanation` string|null, `language` `bm|en` (default `bm`), `pointsValue` int >= 1 (default 1).
  - `mcq`: `options[0..3]` four non-empty strings (also accepted: JSON array `options` or repeated `options[]`), `optionImages[0..3]` files, `correctAnswer` int 0..3.
  - `true_false`: `tfAnswer` true|false|null (`true`/`'true'`/`'1'`/1 and `false`/`'false'`/`'0'`/0; null or `''` = no answer; anything else invalid).
  - `short_answer`/`fill_blank`: `correctAnswerText` required, `altAnswers` comma string or array (trimmed, blanks dropped).
  - `essay`: `modelAnswer` optional (`''` stored as null).
- **Response:** 201 `{ data: Question, status:'Soalan berjaya ditambah.' }`. `Question` = full `DATA-M04-01` (TS `api/questions.ts:95`, 36 fields incl. `id, subjectId, educationLevelId, difficultyLevel, questionType, questionText, questionImage, options, optionImages, correctAnswer, tfAnswer, correctAnswerText, altAnswers, modelAnswer, explanation, aiExplanation, language, pointsValue, status, isActive, complianceStatus, aiVerified, sourceType, sourceFile, sourcePage, sourceSet, qualityScore, needsDiagram, spmPool, dskpSpId, curriculumChapterId, curriculumTopicId, chapterLabel, scriptType, textDirection, pkskDomainId, pkskTargetLevel, pkskOptions, createdBy, createdAt, updatedAt, usage{attempts,correct}`).
  Created row defaults: `status='approved'`, `isActive=true`, `complianceStatus='draft'`, `aiVerified=false`, `needsDiagram=false`, `qualityScore=null`, `scriptType='rumi'`, `createdBy` = session user, `spmPool` set when subject is one of the 19 SPM pool subjects and level id is 10 or 11 (`runtimeSpmPool`, `repository/rules.ts:25`).
- **Errors (422 `VALIDATION_ERROR`, one response with all `fields`; top-level `message` = first message + "(and N more errors)"):** `subjectId` "Sila pilih subjek."; `educationLevelId` "Sila pilih tahap pendidikan."; `difficultyLevel` "Sila pilih tahap kesukaran."; `questionType` "Jenis soalan tidak sah."; `questionText` "Teks soalan mesti sekurang-kurangnya 10 aksara."; `questionImage` / `optionImages.<i>` "Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB."; `options` "Sila isi semua pilihan jawapan."; `correctAnswer` "Sila pilih jawapan betul."; `tfAnswer` "Jawapan betul atau salah tidak sah."; `correctAnswerText` "Sila masukkan jawapan betul."; `pointsValue` "Nilai mata mesti sekurang-kurangnya 1."; `language` "Bahasa tidak sah."; `dskpSpId` "SP DSKP tidak sah." (all in `handlers/question-input.ts:33`). Plus `E-ADMIN`.
- **Side effects:** insert `questions` row; image uploads are simulated (reference `blob:mock/question/<file>`); real backend must use FileStorage (BE-04).
- **Owner / code / client:** M04 / `questions.ts:252` (fn `create` :154; parser `question-input.ts:121`) / `createQuestion` (`api/questions.ts:278`).
- **Card:** BE-09 (create). **Contract:** missing.

### M04-04 `GET /api/questions/:id`

- **Purpose:** admin question detail (S3), PKSK rows included.
- **Auth:** `G-ADMIN`. **Params:** `id` digits (non-digits: no route match, 404).
- **Response:** 200 `{ data: QuestionDetail }` = `Question` without `createdBy` plus `subject:{id,name}|null`, `level:{id,name}|null`, `dskp: { bidang:{id,code:string|null,name}, sk:{id,code,description}, sp:{id,code,description} } | null` (null when untagged or SP unknown), `createdBy:{id, name:string|null}` (TS `api/questions.ts:159`).
- **Errors:** `E-ADMIN`; 404 `NOT_FOUND` "Not Found." (unknown id).
- **Side effects:** none.
- **Owner / code / client:** M04 / `questions.ts:253` (fn :148, shaping `question-shape.ts:153`) / `fetchQuestion` (`api/questions.ts:286`).
- **Card:** BE-09. **Contract:** missing.

### M04-05 `PUT /api/questions/:id`

- **Purpose:** admin edit (S4). Same body keys as M04-03, except `questionType` is ignored (a saved question keeps its type). Patch semantics for optional fields: absent = unchanged, `''` clears; required fields (`subjectId`, `educationLevelId`, `difficultyLevel`, `questionText`) must be sent; `removeQuestionImage` (`1|true`) clears the image; `removeOptionImage[i]` clears option image `i`; absent `dskpSpId` keeps the saved SP, `''`/null clears it.
- **Auth:** `G-ADMIN`. **Params:** `id`.
- **Response:** 200 `{ data: Question, status:'Soalan berjaya dikemaskini.' }`.
- **Errors:** `E-ADMIN`; 404 `NOT_FOUND` "Not Found." for unknown id **or a PKSK row** (`pkskDomainId != null`, owned by M07); 422 as M04-03.
- **Side effects:** update row; `dskpTagged`, `hasSourceFile`, `textDirection` facets kept consistent; a row moved to a T4/T5 level of a pool subject joins `spmPool` (never cleared); `updatedAt` = now.
- **Owner / code / client:** M04 / `questions.ts:254` (fn :163) / `updateQuestion` (`api/questions.ts:297`).
- **Card:** BE-09. **Contract:** missing.

### M04-06 `DELETE /api/questions/:id`

- **Purpose:** permanent delete.
- **Auth:** `G-ADMIN`. **Params:** `id`.
- **Response:** 200 `{ data: { deleted: 1 }, status:'Soalan berjaya dipadam.' }` (SRS says 204; the mock deliberately answers 200 with the flash).
- **Errors:** `E-ADMIN`; 404 for unknown id or PKSK row.
- **Side effects:** hard delete of the row (no soft delete, plan section 5).
- **Owner / code / client:** M04 / `questions.ts:255` (fn `remove` :174) / `deleteQuestion` (`api/questions.ts:308`).
- **Card:** BE-09. **Contract:** missing.

### M04-07 `POST /api/questions/bulk-action`

- **Purpose:** apply one status action to many questions.
- **Auth:** `G-ADMIN`.
- **Request body:** `{ action: 'approve'|'reject'|'archive'|'delete'|'pending_review', ids: number[] }`. `ids` must be a non-empty array of positive safe integers.
- **Response:** 200 `{ data: { affected:number }, status:'<n> soalan berjaya dikemaskini.' }`. Mapping: approve->`approved`, reject->`rejected`, archive->`archived`, pending_review->`pending_review`, delete = hard delete. Unknown ids and PKSK ids are skipped silently (not counted). Duplicate ids counted once.
- **Errors:** 422 `VALIDATION_ERROR` with `fields.action` "Sila pilih tindakan terlebih dahulu." (missing) or "Tindakan tidak sah." (unknown); `fields.ids` "Sila pilih sekurang-kurangnya satu soalan." (missing/empty) or "Senarai soalan tidak sah." (not an int array). Plus `E-ADMIN`. (Copy in `questions.ts:63-72`.)
- **Side effects:** status updates (+`updatedAt`) or deletes in one transaction. No transition validation in the mock (any status to any status); BE-10 AC-1 requires the lifecycle rules, see OQ-API-B2-3.
- **Owner / code / client:** M04 / `questions.ts:251` (fn `bulk` :182) / `bulkQuestionAction` (`api/questions.ts:315`).
- **Card:** BE-09 (bulk-action), lifecycle rules BE-10. **Contract:** missing.

### M04-08 `POST /api/questions/:id/ai-explanation`

- **Purpose:** generate (canned, deterministic) AI explanation for a question; **stub** in the target (BE-10, OD-7).
- **Auth:** `G-ADMIN`. **Params:** `id`. **Query:** `force=1` regenerates even if one exists.
- **Request body:** none.
- **Response (raw, no envelope; client uses `api.raw`):** 200 `{ ok:true, message:'Penjelasan AI berjaya dijana.' }` after storing `aiExplanation = { markdown, generatedAt }`; 200 `{ ok:true, message:'Penjelasan AI sudah wujud.' }` when one exists and `force != 1` (nothing changes). Mock waits `m04.aiLatencyMs` (default 1500 ms) first.
- **Errors:** `E-ADMIN`; 404 for unknown id or PKSK row. Fault-injection branches (test-only config `m04.aiFailNext`): 500 `{ ok:false, message:'Perkhidmatan AI tidak tersedia buat masa ini.' }`, 500 `{ ok:false }`, 200 `{ ok:false }`, 500 non-JSON HTML. The page reads the status/body exactly like the live script (FR-M04-46).
- **Side effects:** `questions.aiExplanation` set; variant picked as previous+1 or `id % 3`.
- **Owner / code / client:** M04 / `questions.ts:256` (fn :216; copy `ai-explanation.ts:22`) / `generateAiExplanation` (`api/questions.ts:332`).
- **Card:** BE-10 (stub). **Contract:** missing.

### M04-09 `GET /api/question-reports`

- **Purpose:** admin triage list of student reports (S7).
- **Auth:** `G-ADMIN`. Matrix BS-05.
- **Request (query):** `status` `pending|reviewed|fixed|dismissed|all` (absent/empty = `pending`; unknown = empty list and `meta.activeTab = null`).
- **Response:** 200 `{ data: ReportView[], meta }`, **not paged** (`unpaged`: `page 1`, `pageSize = max(1,n)`, `totalPages 1`), newest first (`createdAt desc, id desc`). `meta` extra: `activeTab: 'pending'|'reviewed'|'fixed'|'dismissed'|'all'|null`, `counts:{pending,reviewed,fixed,dismissed,all}` over all reports regardless of filter.
  `ReportView` = `{ id, questionType:'mcq'|'structured', questionId, reasons:string[], reasonLabels:string[], category:'Jawapan Salah'|'Tak Jelas'|'Lain-lain', comment:string|null, source, quizSessionId:string|null, roomCode:string|null, sourceSet:string|null, status:'pending'|'reviewed'|'fixed'|'dismissed', displayStatus: status|'removed', adminNotes:string|null, createdAt, updatedAt, question: ReportQuestionView, reporter:{id, name:string|null} }` (TS `api/reports.ts:46-76`).
  `question` (full for admin): `{ exists, type, id, text?, options?:string[], correctAnswer?:number|null, subjectName?, levelName?, complianceStatus?, isActive?, practiceUrl?:string|null }`; `exists:false` when the question is gone. `displayStatus='removed'` when status `fixed`, question exists and is inactive. `category` from the first reason (`wrong_answer`/`wrong_options` = Jawapan Salah, `confusing_question`/`unclear` = Tak Jelas, else Lain-lain). Reason labels: `lib/report-reasons.ts:19-120`.
- **Errors:** `E-ADMIN`.
- **Side effects:** none.
- **Owner / code / client:** M04 / `reports.ts:272` (fn `list` :148) / `fetchQuestionReports` (`api/reports.ts:123`).
- **Card:** BE-10. **Contract:** missing.

### M04-10 `POST /api/question-reports`

- **Purpose:** any signed-in user reports a question (S14 modal; hosts in M05/M06/M10).
- **Auth:** `G-AUTH` (any role).
- **Request body:** `{ questionId:number (required, positive int), questionType?:'mcq'|'structured' (default mcq), reasons:string[] (required, non-empty), comment?:string|null (<= 500 chars), source?: 'spm'|'structured_attempt'|'latihan'|'revision'|'teacher_databank' (default `spm` for mcq, `structured_attempt` for structured), quizSessionId?:string|null, roomCode?:string|null }`. `reasons` allowed sets: mcq `wrong_answer, confusing_question, wrong_options, missing_options, duplicate, typo, other, outdated`; structured `wrong_answer, confusing_question, wrong_options, typo, other`. `quizSessionId`/`roomCode` pattern `^[A-Za-z0-9._:-]{1,64}$`. (The TS client type also lists `quiz` and `papan_bijak` as sources; the mock handler rejects them: OQ-API-B2-4.)
- **Response (raw, no envelope):** 201 `{ success:true, message:'Laporan berjaya dihantar.' }`.
- **Errors:** 422 `fields`: `questionType` "Jenis soalan tidak sah."; `questionId` "Sila pilih soalan."; `reasons` "Sila pilih sekurang-kurangnya satu sebab laporan." / "Sebab laporan tidak sah."; `source` "Sumber laporan tidak sah."; `comment` "Komen tidak boleh melebihi 500 aksara."; `quizSessionId`/`roomCode` "Rujukan sesi atau bilik tidak sah."; 404 `NOT_FOUND` "Not Found." when the question does not exist; 401 `E-AUTH`. No duplicate-open-report check in the mock (BE-10 AC-3 says "as the mock does": none).
- **Side effects:** insert report `status='pending'`. **mcq: the question is deactivated at once** (`isActive=false`, removes it from practice eligibility). **structured: deactivated when it has >= 3 reports in `pending|reviewed`.** One transaction.
- **Owner / code / client:** M04 / `reports.ts:273` (fn `create` :164) / `createQuestionReport` (`api/reports.ts:133`).
- **Card:** BE-10. **Contract:** missing.

### M04-11 `GET /api/question-reports/mine`

- **Purpose:** the caller's own reports (S13). The `question` block carries only `{exists, type, id}` (no text or answers).
- **Auth:** `G-AUTH`.
- **Response:** 200 `{ data: ReportView[], meta:{...unpaged, counts} }` newest first; `counts` over the caller's reports only (`pending,reviewed,fixed,dismissed,all`).
- **Errors:** `E-AUTH`.
- **Side effects:** none.
- **Owner / code / client:** M04 / `reports.ts:274` (fn `mine` :263) / `fetchMyReports` (`api/reports.ts:146`).
- **Card:** BE-10. **Contract:** missing.

### M04-12 `PATCH /api/question-reports/:id`

- **Purpose:** admin resolves a report.
- **Auth:** `G-ADMIN`. **Params:** `id` digits.
- **Request body:** `{ status:'fixed'|'dismissed'|'reviewed' (required), adminNotes?:string|null (<= 1000; blank string stored as null; null clears; absent keeps), reactivate?:boolean, forceDeactivate?:boolean }` (flags accept `true|1|'1'|'true'`).
- **Response:** 200 `{ data:{ id, status, adminNotes:string|null, updatedAt }, status:'Laporan berjaya dikemaskini.' }`.
- **Errors:** `E-ADMIN`; 404 unknown report; 422 `fields.status` "Status tidak sah."; `fields.adminNotes` "Nota admin tidak boleh melebihi 1000 aksara.".
- **Side effects:** report status/notes/`updatedAt`; `reactivate=true` sets the question `isActive=true`; `forceDeactivate=true` sets `isActive=false` (mcq via the questions store, structured via structured store). Both flags may be sent (reactivate applied first). The UI sends notes "Soalan dan jawapan disemak — tiada masalah" (dismiss+reactivate) and "Dinyahaktifkan segera oleh admin" (force deactivate).
- **Owner / code / client:** M04 / `reports.ts:275` (fn `update` :230) / `updateQuestionReport` (`api/reports.ts:138`).
- **Card:** BE-10 (card note: "resolving as wrong calls deactivate"; the mock does it only via the flags). **Contract:** missing.

### M04-13 `GET /api/question-submissions`

- **Purpose:** teacher-uploaded question papers queue (S10). Admin only because it exposes teacher name, e-mail, school (SEC-M04-07).
- **Auth:** `G-ADMIN`. Matrix BS-03 (Sumber Kertas) is the nearest entry.
- **Request (query):** `status` `pending|processing|done|rejected` (absent/empty = all; unknown = empty list).
- **Response:** 200 `{ data: QuestionSubmission[], meta }`, not paged (`unpaged`), id descending; `meta.counts = { all, pending, processing, done, rejected }` over all papers.
  `QuestionSubmission` = `{ id, teacherId, subjectText:string, levelCode:'T1'..'T5'|null, year:number, paperType:string, authorCredit:string, note:string|null, files:{index,name,size,mime}[], status, adminNotes:string|null, createdAt, teacher:{id,name:string|null,email:string|null,school:string|null} }` (TS `api/submissions.ts:19`). `paperType` is free text from 7 labels: Soalan Umum, Trial Paper, Soalan DSKP, Buku Teks, Buku Latihan, Soalan Peperiksaan, Lain-lain.
- **Errors:** `E-ADMIN`.
- **Side effects:** none. (Creation of a submission is on the M10 side, not in M04.)
- **Owner / code / client:** M04 / `submissions.ts:57` / `fetchQuestionSubmissions` (`api/submissions.ts:62`).
- **Card:** BE-10. **Contract:** missing.

### M04-14 `PATCH /api/question-submissions/:id/status`

- **Purpose:** admin updates the status/note of a submitted paper.
- **Auth:** `G-ADMIN`. **Params:** `id`.
- **Request body:** `{ status:'pending'|'processing'|'done'|'rejected' (required), adminNotes?:string|null (<= 1000; absent keeps; blank/null clears) }`.
- **Response:** 200 `{ data: QuestionSubmission, status:'Status kertas soalan berjaya dikemaskini.' }`.
- **Errors:** `E-ADMIN`; 404 unknown id (checked first); 422 `fields.status` "Status tidak sah."; `fields.adminNotes` "Nota admin tidak boleh melebihi 1000 aksara.".
- **Side effects:** update row.
- **Owner / code / client:** M04 / `submissions.ts:64` / `updateSubmissionStatus` (`api/submissions.ts:72`).
- **Card:** **UNCOVERED** (BE-10 lists only `GET /api/question-submissions`; OQ-API-B2-5). **Contract:** missing.

### M04-15 `GET /api/question-submissions/:id/files/:index`

- **Purpose:** download one uploaded file of a submission.
- **Auth:** `G-ADMIN`. **Params:** `id` digits, `index` digits (0-based position in `files`).
- **Response:** 200 file body with `Content-Disposition: attachment; filename="<name>"; filename*=UTF-8''<enc>` (mock returns a placeholder text "Fail contoh (mock) untuk kertas soalan #<id>\nNama fail: <name>\n", `text/plain`; the real backend streams the stored file via FileStorage with the stored mime).
- **Errors:** `E-ADMIN`; 404 unknown submission or index.
- **Side effects:** none.
- **Owner / code / client:** M04 / `submissions.ts:96` / `downloadSubmissionFile` (`api/submissions.ts:83`).
- **Card:** **UNCOVERED** (BE-04 provides file storage; no card lists this path). **Contract:** missing.

### M04-16 `POST /api/question-imports`

- **Purpose:** CSV bulk import of objective MCQs (S5). Whole import is one transaction; rows that fail are counted, not fatal.
- **Auth:** `G-ADMIN`. Matrix BS-02.
- **Request body** (multipart, or JSON where `csvFile` is the file text): `csvFile` file `.csv|.txt`, declared MIME in `''|text/csv|text/plain|text/x-csv|application/csv|application/vnd.ms-excel`, max 5 MB; `defaultSubjectId` int?; `defaultEducationLevelId` int?; `defaultDifficultyLevel` int? (1..5; > 5 rejected).
  CSV: UTF-8, first row header (case-insensitive), comma separator, `"` quoting with `""`, quoted fields may span lines, blank lines ignored. Template header: `question_text,option_a,option_b,option_c,option_d,correct_answer,subject_id,education_level_id,difficulty_level,marks,explanation`. Required columns: `question_text, option_a, option_b, correct_answer`. `correct_answer` letter A-D (any case); `option_c`/`option_d` may be empty; `subject_id`/`education_level_id`/`difficulty_level` per row or the form default; `marks` default 1.
- **Response:** 201 `{ data: ImportRun, status:'Import selesai: <x> soalan diimport, <y> gagal.' }`. `ImportRun` = `{ id, fileName, importedCount, failedCount, failures:{row:number,message:string}[] (row = 1-based file line, header = line 1), defaults:{subjectId,educationLevelId,difficultyLevel} (nulls), createdBy, createdAt, createdMonth:'YYYY-MM' }`.
- **Errors (422 `fields`):** `csvFile` "Sila pilih fail CSV." (missing) / "Fail mesti jenis CSV atau TXT dan tidak melebihi 5MB." / "Fail CSV mesti mempunyai kolum question_text, option_a, option_b, correct_answer." / "Fail CSV tiada baris data."; `defaultSubjectId` "Sila pilih subjek."; `defaultEducationLevelId` "Sila pilih tahap pendidikan."; `defaultDifficultyLevel` "Sila pilih tahap kesukaran.". Row failure messages: "Baris tidak lengkap.", "Jawapan betul mesti A, B, C atau D.", "Jawapan betul merujuk pilihan yang kosong.", "Subjek tidak sah.", "Tahap pendidikan tidak sah.", "Tahap kesukaran mesti 1 hingga 5.", plus the marks message (`MSG_MARKS`, `import/csv.ts:58`). Plus `E-ADMIN`.
- **Side effects:** each valid row creates a question with `status='draft'`, `createdBy` = admin; one `question_imports` run row. Target note: BE-10 keeps this CSV path; PDF/AI imports are BE-38.
- **Owner / code / client:** M04 / `imports.ts:147` (fn :91; csv logic `import/csv.ts`) / `importQuestions` (`api/imports.ts:62`).
- **Card:** BE-10. **Contract:** missing.

### M04-17 `GET /api/question-imports/template`

- **Purpose:** download the CSV template.
- **Auth:** `G-ADMIN`.
- **Response:** 200 `text/csv`, `Content-Disposition` filename `template-import-soalan.csv`; body = header line plus 2 sample rows, CRLF (`IMPORT_TEMPLATE_CSV`, `import/csv.ts:45`). Static route, beats `/api/question-imports/:x`.
- **Errors:** `E-ADMIN`.
- **Side effects:** none.
- **Owner / code / client:** M04 / `imports.ts:148` / `downloadImportTemplate` (`api/imports.ts:80`).
- **Card:** BE-10. **Contract:** missing.

### M04-18 `GET /api/question-imports`

- **Purpose:** import history (S5h).
- **Auth:** `G-ADMIN`.
- **Request (query):** `page` (invalid = 1); page size fixed 20 (no `pageSize` override).
- **Response:** 200 `{ data: ImportRun[], meta: ListMeta }` newest first.
- **Errors:** `E-ADMIN`.
- **Side effects:** none.
- **Owner / code / client:** M04 / `imports.ts:151` / `fetchQuestionImports` (`api/imports.ts:70`).
- **Card:** BE-10. **Contract:** missing.

### M04-19 `GET /api/question-quality`

- **Purpose:** quality dashboard (S6): every figure computed from the store.
- **Auth:** `G-ADMIN`. Matrix BS-04.
- **Response:** 200 `{ data: QualitySummary }` = `{ total, average (1 dp, 0 if none scored), scoredCount, excellentCount, activeActionCount, buckets:{ baik, lemahKritikal, legacyGeneric }, distribution:{ cemerlang, baik, lemah, kritikal } (percent of scored, 1 dp), bySubject:{subjectId,name,count,average,excellentPct}[] (subjects with scored rows, average desc then id), byLevel:{levelId,name,count,average}[] (every level, zeros if none), actionList:{id,questionText,subject:{id,name}|null,level:{id,name}|null,sourceSet:string|null,qualityScore}[] (non-legacy rows with score <= 50, id desc), lastAuditAt:string|null }` (TS `api/quality.ts:23`). Buckets: cemerlang 76-100, baik 51-75, lemah 26-50, kritikal 0-25 (`repository/quality-rules.ts:30`); `legacyGeneric` = scored rows with `sourceType='ai_generated'`.
- **Errors:** `E-ADMIN`.
- **Side effects:** none.
- **Owner / code / client:** M04 / `quality.ts:117` (fn `buildSummary` :28) / `fetchQualitySummary` (`api/quality.ts:71`).
- **Card:** BE-10 (`quality_audits`). **Contract:** missing.

### M04-20 `POST /api/question-quality/audit`

- **Purpose:** "Jalankan Audit Semula": rescore the runtime-created rows and stamp the time.
- **Auth:** `G-ADMIN`. **Request:** no body.
- **Response:** 200 `{ data:{ lastAuditAt:string }, status:'Audit kualiti selesai.' }`.
- **Errors:** `E-ADMIN`.
- **Side effects:** `questionsRepo.auditRuntimeRows()` scores the questions created at runtime; the `lastAuditAt` timestamp is stored (`quality_audits`). Score formula (`repository/quality-rules.ts:12`): `100 - 15*[explanation empty] - 10*[dskpSpId null] - 10*[sourceType null] - 15*[complianceStatus quarantined|rejected] - 10*[questionText shorter than 20 chars]`, clamped 0..100; buckets cemerlang 76-100, baik 51-75, lemah 26-50, kritikal 0-25 (stored as cemerlang/baik/le50). Seeded rows already carry scores.
- **Owner / code / client:** M04 / `quality.ts:118` (fn `runAudit` :108) / `runQualityAudit` (`api/quality.ts:81`).
- **Card:** BE-10. **Contract:** missing.

### M04-21 `GET /api/diagram-audit`

- **Purpose:** list questions flagged `needsDiagram` (S11): two lists with separate pagers.
- **Auth:** `G-ADMIN`.
- **Request (query):** `subjectId` (both lists), `schoolId` (MCQ list only; matches creators who are teachers, school admins or admins of that school), `mcqPage`, `strPage` (invalid = 1). A non-numeric/zero filter matches nothing. Page size fixed 20.
- **Response:** 200 (raw envelope with both `data` and `meta`): `{ data:{ mcq:{ items: DiagramMcqItem[], meta: PageMeta }, structured:{ items: DiagramStructuredItem[], meta: PageMeta } }, meta:{ stats:{ mcq, structured, total } (filtered counts), bySubject:{name,count}[] (top 10 subjects by unfiltered flagged MCQ count, ties by id), unfilteredMcq:number } }`. `DiagramMcqItem` = `{ id, questionText, subject:{id,name}|null, createdBy:{id,name:string|null}, sourceFile, sourcePage }`; `DiagramStructuredItem` = same with `stimulusExcerpt` (cut at 400 chars + "..."). `PageMeta` = `{ page, pageSize, totalItems, totalPages, from, to }`. Ordering: id desc.
- **Errors:** `E-ADMIN`.
- **Side effects:** none.
- **Owner / code / client:** M04 / `diagram-audit.ts:234` (fn :113) / `fetchDiagramAudit` (`api/diagram-audit.ts:80`).
- **Card:** BE-10. **Contract:** missing.

### M04-22 `POST /api/diagram-audit/:kind/:id/image`

- **Purpose:** attach a diagram image to a flagged question and clear the flag.
- **Auth:** `G-ADMIN`. **Params:** `kind` `mcq|structured` (other = 404), `id` digits.
- **Request body (multipart):** `image` file: JPG, PNG, WebP or GIF (SVG refused), max 2 MB.
- **Response:** 200 `{ data:{ id, needsDiagram:false }, status:'Gambar rajah berjaya dimuat naik.' }`.
- **Errors:** `E-ADMIN`; 404 unknown kind/question (a PKSK MCQ row is also 404); 422 `fields.image` "Sila pilih fail gambar." (missing or not an image) / "Gambar mesti jenis JPG, PNG, WebP atau GIF dan tidak melebihi 2MB.".
- **Side effects:** `needsDiagram=false`, `questionImage` = stored reference.
- **Owner / code / client:** M04 / `diagram-audit.ts:235` (fn `upload` :205) / `uploadDiagramImage` (`api/diagram-audit.ts:94`).
- **Card:** BE-10. **Contract:** missing.

### M04-23 `POST /api/diagram-audit/:kind/:id/dismiss`

- **Purpose:** remove a question from the audit list without an image.
- **Auth:** `G-ADMIN`. **Params:** `kind`, `id`. **Request:** no body.
- **Response:** 200 `{ data:{ id, needsDiagram:false }, status:'Soalan telah dikeluarkan daripada senarai audit.' }`.
- **Errors:** `E-ADMIN`; 404.
- **Side effects:** `needsDiagram=false`.
- **Owner / code / client:** M04 / `diagram-audit.ts:238` (fn :226) / `dismissDiagram` (`api/diagram-audit.ts:108`).
- **Card:** **UNCOVERED** (BE-10 lists GET and POST image only). **Contract:** missing.

### M04-24 `GET /api/master-notes`

- **Purpose:** admin review of AI master notes (S12).
- **Auth:** `G-ADMIN`.
- **Request (query):** `tab` `flagged|approved|all` (default and fallback `flagged`), `page`; page size fixed 15; `id desc`.
- **Response:** 200 `{ data: MasterNoteRow[], meta: ListMeta + { activeTab, summary:{ flagged, teacherApproved, total } } }`. `MasterNoteRow` = `{ id, questionId, subjectName ('—' when unknown), chapter:string|null, model:string, tokens:number, confidence:number, questionText, noteText, trapText, flagged:boolean, teacherApproved:boolean, createdAt }` (TS `api/master-notes.ts:17`).
- **Errors:** `E-ADMIN`.
- **Side effects:** none.
- **Owner / code / client:** M04 / `master-notes.ts:69` / `fetchMasterNotes` (`api/master-notes.ts:41`).
- **Card:** BE-10 (`GET /api/master-notes` "notes lookup"). **Contract:** missing.

### M04-25 `POST /api/master-notes/:id/:action`

- **Purpose:** approve / regenerate / unflag a master note.
- **Auth:** `G-ADMIN`. **Params:** `id` digits, `action` `approve|regen|unflag`.
- **Response (raw):** 200 `{ ok:true }`. Failure is judged by status only.
- **Errors:** `E-ADMIN`; 404 unknown id or unknown action.
- **Side effects:** `approve` => `teacherApproved=true, flagged=false`; `unflag` => `flagged=false`; `regen` => next canned note (`noteText`, `trapText`, `tokens`, `regenCount+1`), flags kept (the real backend would call the AI provider; BE-36 owns that, OD-7 says stub in B1).
- **Owner / code / client:** M04 / `master-notes.ts:81` / `actOnMasterNote` (`api/master-notes.ts:54`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M04-26 `GET /api/structured-questions`

- **Purpose:** admin list of structured (subjective) questions (S8).
- **Auth:** `G-ADMIN`.
- **Request (query):** `subjectId`, `educationLevelId`, `kbatLevel` (non-numeric/zero = matches nothing), `page`; page size fixed 25.
- **Response:** 200 `{ data: StructuredRow[], meta: ListMeta + { stats:{ total, published, bySubject:{name,count}[] (alphabetical `ms` locale, subjects with >= 1) } } }`; `stats` is over the whole store, not the filter. `StructuredRow` = `{ id, stimulusExcerpt (100 chars + "..."), subject:{id,name}|null, level:{id,name}|null, kbatLevel:number, totalMarks:number, subCount:number }`.
- **Errors:** `E-ADMIN`.
- **Side effects:** none.
- **Owner / code / client:** M04 / `structured.ts:60` / `fetchStructuredQuestions` (`api/structured.ts:98`).
- **Card:** BE-09 (`GET /api/structured-questions`). **Contract:** missing.

### M04-27 `GET /api/structured-questions/:id`

- **Purpose:** admin detail of one structured question with sub-questions (S9).
- **Auth:** `G-ADMIN`. **Params:** `id`.
- **Response:** 200 `{ data: StructuredDetail }` = `{ id, subjectId, educationLevelId, subject, level, kbatLevel, status:'published'|'draft', isActive, needsDiagram, estimatedMinutes, isTrial, topic:string|null, questionNumber:number|null, stimulus, stimulusImage:string|null, totalMarks, visibility:'public', complianceStatus, sourceFile, sourcePage, sourceSet, curriculumChapterId, curriculumTopicId, dskpSpId, scriptType, textDirection, questionTemplate:'eksperimen'|null, subQuestions: StructuredSubQuestion[] (order asc), createdBy:{id,name:string|null}, createdAt, updatedAt }`; `StructuredSubQuestion` = `{ id, structuredQuestionId, partLabel, questionText, marks, answerType:'text'|'numeric', expectedNumeric:number|null, numericTolerance:number|null, rubrics:{konstruk,keyword,marks}[], modelAnswer, parentSubId:number|null, order }` (TS `api/structured.ts:36-86`).
- **Errors:** `E-ADMIN`; 404.
- **Side effects:** none.
- **Owner / code / client:** M04 / `structured.ts:82` / `fetchStructuredQuestion` (`api/structured.ts:113`).
- **Card:** **UNCOVERED** (BE-09 lists the list only; target model is the v2 part tree, OQ-API-B2-2). **Contract:** missing.

### M04-28 `GET /api/guru/dskp/bidang`

- **Purpose:** DSKP cascade, step 1 (S2/S4 tag selector). Owned by M10's `dskp` store; registered in M04's handlers.
- **Auth:** `requireRole('admin','teacher')` (401 / 403 otherwise). 
- **Request (query):** `subjectId` int, `educationLevelId` int (both required; if either is missing or not an integer the answer is `[]`).
- **Response (raw, bare array, no envelope):** 200 `{id:number, code:string|null, name:string}[]`.
- **Errors:** 401/403 only.
- **Side effects:** none.
- **Owner / code / client:** M10 data, M04 handler / `dskp.ts:22` / `fetchDskpBidang` (`api/lookups.ts:71`).
- **Card:** BE-10. **Contract:** missing.

### M04-29 `GET /api/guru/dskp/sk`

- **Purpose:** DSKP cascade, step 2.
- **Auth:** `admin|teacher`. **Query:** `bidangId` int (missing/invalid = `[]`).
- **Response (raw array):** 200 `{id, code:string, description:string}[]`.
- **Errors:** 401/403 only. **Side effects:** none.
- **Owner / code / client:** M10 data / `dskp.ts:36` / `fetchDskpSk` (`api/lookups.ts:83`).
- **Card:** BE-10. **Contract:** missing.

### M04-30 `GET /api/guru/dskp/sp`

- **Purpose:** DSKP cascade, step 3.
- **Auth:** `admin|teacher`. **Query:** `skId` int (missing/invalid = `[]`).
- **Response (raw array):** 200 `{id, code:string, description:string}[]`.
- **Errors:** 401/403 only. **Side effects:** none.
- **Owner / code / client:** M10 data / `dskp.ts:45` / `fetchDskpSp` (`api/lookups.ts:92`).
- **Card:** BE-10. **Contract:** missing.

## 5. M05 Practice (23 routes)

Mock source: `src/modules/m05-practice/mock/handlers/*.ts` (domain rules in `mock/repository/{start,rules,practice,reads,structured-rules}.ts`). Client: `src/modules/m05-practice/api/practice.ts`, types `api/types.ts`. SRS: `docs/requirements/srs/M05-practice.md` (`#n` = SRS §7 numbers in the handler headers).

Module-wide facts:

- Every route uses `requireAuth()` only: **any signed-in role** may call it (no role check in the mock; the handler header says "Any session (A)"). All figures are the caller's own (`req.session.userId`). Matrix menu items served: Murid rows Latih Tubi, Soalan by Chapter, Soalan Berstruktur, Remedial, Dashboard; there is no role guard to port, only the session. See OQ-API-B2-6.
- Ids: session ids are strings (`SessionRow.id`); question, subject-level, chapter ids are numbers in the mock (opaque strings in the target).
- Time windows are Malaysia time (`+08:00`), week = Monday-Sunday (`weekStartOf`, `handlers/common.ts`).
- Trial rule (BR-07): `TrialStatus = { active, used, limit:50, remaining }`. `active` = no unexpired subscription (`subscriptionExpiresAt` set and after now). A user with `active && remaining == 0` cannot start a session (402). Each **first** check-answer while not subscribed increments `trialQuestionsUsed` by 1.
- The wire shape of the mock differs from the BE-12 card text in places (body key names, `clientUuid` not read, `/attempts` vs `/attempt`); this catalogue documents the mock; differences are listed in OQ-API-B2-7.

### M05-01 `POST /api/practice/sessions`

- **Purpose:** start a practice session (all modes) and receive the questions without keys, or resume an in-progress mission session.
- **Auth:** `G-AUTH`.
- **Request body:** `{ mode: 'random'|'chapter'|'revision'|'past_year'|'latih_tubi'|'ramalan'|'mission'|'remedial'|'question_set', subjectCode?:string, levelId?:int|null, difficulty?:int|null, count?:int, chapterId?:int, year?:int, setNo?:int, targetQuestionId?:int|null, missionId?:int, remedialTestId?:int, questionSetId?:int }`. For `levelId`, `difficulty`, `chapterId`, `year`, `setNo`, `targetQuestionId`, `missionId`, `remedialTestId`, `questionSetId` a non-integer value is dropped by the handler (treated as absent); `count` is passed through and validated by the mode rules. `mode:'pksk'` is not startable here (422); PKSK sessions are created by M07 (M07-07 `POST /api/pksk/levels/:level/domains/:code/practice-sessions`, direct completion BR-34).
  Per-mode rules (`repository/start.ts`):
  - `random`: `subjectCode` required (active subject, else 404), `count` in {5,10,15,20}, `levelId` optional and must be one of the subject's Darjah 1-4 levels, `difficulty` optional 1..5; draws `count` eligible MCQs (status approved, active) seeded by the session seed; fewer than `count` available -> 422 `NOT_ENOUGH_QUESTIONS`.
  - `chapter`: `chapterId` (active chapter with a level), `count` in {5,10,15,20}; chapter must have questions; unlock rule BR-16: chapter 1 open, chapter k open only if chapter k-1 is complete with score >= 70 (else 409); question choice BR-17: unanswered first (id order), then answered by oldest last answer.
  - `revision`: `subjectCode`, `count` absent or 20; takes the first 20 of the caller's wrong-answer queue for that subject (eligible questions only); empty queue -> 422 `NO_WRONG_QUESTIONS`; response includes `revisionMeta`.
  - `past_year`: `subjectCode`, `count` in {5,10,20}; samples the SPM pool (T4/T5 questions of the SPM subjects).
  - `latih_tubi`: `subjectCode`; `levelId` optional in {10,11}; `difficulty` optional 2..5; `count` must equal the subject's target (34 BM, 36 BI, 40 for MATH/SCI/SEJ/GEO/BIO/CHEM/PHY and others, 20 ADDMATH; table `LATIH_TUBI_TARGETS`, `rules.ts:38`) or, for subjects without a target, one of {5,10,20,30,40,50,60}. "Buka Soalan Sama": `targetQuestionId` with `count:1` serves exactly that eligible SPM-pool question of the subject.
  - `ramalan`: `subjectCode`, `year`, `setNo` required; set not found -> 404; set empty -> 422 `SET_NOT_READY`.
  - `mission`: `missionId` must be a mission visible to the student today (M10), else 404; completed -> 409 `ALREADY_COMPLETED`; an `in_progress` session for the mission is **resumed** (same session id returned, not a new row) .
  - `remedial`: `remedialTestId` must belong to the caller and not be cancelled (else 404); completed -> 409 `ALREADY_COMPLETED`.
  - `question_set`: `questionSetId` visible to the caller (else 404); completed attempts >= `maxAttempts` (when > 0) -> 409 `NO_ATTEMPTS_LEFT`; carries `timeLimitSec` (minutes * 60) when set.
- **Response:** 201 `{ data: StartSessionResponse }` = `{ sessionId:string, mode, subject:{code,name,color}|null, chapter?:{id,number:number|null,name:string|null}, questions: QuizQuestion[], revisionMeta?:{selected,totalWrong}, timeLimitSec?:number|null (question_set only) }`; `QuizQuestion` = `{ id, questionText, textDirection:'ltr'|'rtl', scriptType:'rumi'|'arab'|'jawi'|'mixed', wrongTimes:number (from the caller's queue), hasDskp:boolean (chapter linked), contributor:{name,profileUrl:null}|null (teacher creator), options:{id:0..3,label:'A'..'D',text}[] }` (TS `api/types.ts`). **No correct answer, no explanation.** A resumed mission session also answers 201 with the same body shape.
- **Errors:** `E-AUTH`; 402 `TRIAL_EXHAUSTED` "Baki percubaan percuma anda telah habis."; 404 `NOT_FOUND` "Rekod tidak dijumpai."; 409 `CHAPTER_LOCKED` "Bab ini masih dikunci."; 409 `ALREADY_COMPLETED` "Misi ini sudah diselesaikan." (mission) / "Ujian ini sudah selesai." (remedial); 409 `NO_ATTEMPTS_LEFT` "Tiada percubaan lagi untuk set ini."; 422 `NOT_ENOUGH_QUESTIONS` "Soalan tidak mencukupi."; 422 `NO_WRONG_QUESTIONS` "Maaf, terdapat masalah memuatkan kuiz ulang kaji."; 422 `SET_NOT_READY` "Soalan tidak mencukupi."; 422 `VALIDATION_ERROR` message "Nilai tidak sah." with `fields.<name>` for `mode`, `levelId`, `difficulty`, `count`, `targetQuestionId`. (Codes/messages: `repository/rules.ts:69`, `repository/start.ts:71`.)
- **Side effects:** insert `practice_sessions` (`status='in_progress'`, `questionIds`, `startedAt`, link ids, `timeLimitSec`); no wallet or trial change at start. Selection uses a seeded PRNG stream (`practice:start:<userId>`), the target must keep a seed for deterministic tests.
- **Owner / code / client:** M05 / `sessions.ts:78` / `startSession` (`api/practice.ts:70`).
- **Card:** BE-12. **Contract:** missing.

### M05-02 `POST /api/practice/sessions/:id/check-answer`

- **Purpose:** check one answer; at most one check per question per session (a second call returns the stored result).
- **Auth:** `G-AUTH`, session owner only. **Params:** `id` string (session id).
- **Request body:** `{ questionId:int, selectedOptionId:int (0..3) }` (both integers; mock key is `selectedOptionId`, the BE-12 card text says `optionId`: OQ-API-B2-7).
- **Response:** 200 `{ data: { isCorrect:boolean, correctOptionId:int, feedback:string, explanation:string|null } }`. `feedback`: revision mode "Betul! Kali ini berjaya!" / "Masih belum tepat"; other modes "Betul!" / "Salah".
- **Errors:** `E-AUTH`; 404 `NOT_FOUND` "Rekod tidak dijumpai." (unknown session); 403 `FORBIDDEN` "Akses ditolak." (someone else's session); 409 `ALREADY_SUBMITTED` "Sesi ini sudah dihantar." (status not in_progress); 422 `VALIDATION_ERROR` "Jawapan tidak sah." (missing/non-integer ids; also with `fields.questionId` when the question is not in the session, `fields.selectedOptionId` when out of range).
- **Side effects:** insert a `practice_checks` row (`selectedOptionId, isCorrect, seq`); +1 trial counter when the caller is not subscribed (only on a first check). The answer log, queue, mastery and wallet change at submit, not here.
- **Owner / code / client:** M05 / `sessions.ts:136` / `checkAnswer` (`api/practice.ts:75`).
- **Card:** BE-12. **Contract:** missing.

### M05-03 `POST /api/practice/sessions/:id/submit`

- **Purpose:** complete the session: grade the stored checks, write the answer log, queue, mastery, session totals and credit the wallet/streak, all in one transaction.
- **Auth:** `G-AUTH`, session owner. **Params:** `id`.
- **Request body:** `{ timeSpent?:number }` seconds (default 0; stored value is `round(timeSpent)` clamped to `[0, 180 * questionCount]`). Answers are NOT sent: the server uses its stored checks.
- **Response:** 200 `{ data: { results: { score:number, total:number, gamification: { coinsEarned:number, streakCount:number, pointsEarned:number, totalBalance:number } } } }`. `score` = correct checks; `total` = `questionCount`.
- **Errors:** `E-AUTH`; 404 / 403 as M05-02; 409 `ALREADY_SUBMITTED` "Sesi ini sudah dihantar." on a second submit.
- **Side effects (BR-31, one transaction; a failure in the wallet call rolls everything back):** (1) session -> `completed`, `correctCount`, `timeSpent`, `pointsEarned = 10 * correct`, `coinsEarned = correct` (x3 for `mission`), `completedAt`; (2) one `practice_answers` row per checked question (with subject/level/chapter dimensions copied from the question); (3) revision queue: wrong answer inserts/increments `wrongTimes` + `lastWrongAt`, a correct answer removes the entry; (4) mastery counters per subject (`answered+1`, `correct+1`, `lastAnsweredAt`); (5) checks deleted; (6) wallet/streak/quests/achievements via M14 `onSessionCompleted` (order BR-M14-03: session credit, streak activity, challenge rewards, achievement rewards); the wallet credit may differ from the session's own `coinsEarned` and is the value returned in `gamification.coinsEarned`; (7) `remedial` mode completes the M10 remedial test with `afterAccuracy = round(correct/total*100, 1)` and `completedAt`. No trial change at submit.
- **Owner / code / client:** M05 / `sessions.ts:158` / `submitSession` (`api/practice.ts:86`).
- **Card:** BE-12 (card AC adds `clientUuid` idempotency and 409 on second submit; the mock has no `clientUuid`). **Contract:** missing.

### M05-04 `GET /api/practice/sessions`

- **Purpose:** the caller's completed-session list used by the SPM pages (M06 history) and practice history.
- **Auth:** `G-AUTH`.
- **Request (query):** `modes` comma list of practice modes (required; empty or any unknown mode -> 422), `type` one mode inside `modes` (narrows rows; otherwise ignored), `page`, `pageSize` (both positive ints; if **neither** is given the list is returned unpaged).
- **Response:** 200 `{ data: SessionListItem[], meta }`, newest first. `SessionListItem` = `{ id:string, mode, subjectId:number|null, subjectCode:string|null ('UMUM' for mixed free practice with no subject), questionCount, correctCount, percent (rounded int), coinsEarned, timeSpent, completedAt:string|null }`. `meta` = list meta (`unpaged` when no page params, else `paginate` with default `pageSize` 15) plus `activeType: mode|null` and `stats: { sessions, avgAccuracyPct (1 dp, mean of per-session accuracy), coins, answered }` computed over **all** rows of `modes`, independent of `type`.
- **Errors:** `E-AUTH`; 422 `VALIDATION_ERROR` "Mod tidak sah." with `fields.modes` "Mod tidak sah.".
- **Side effects:** none.
- **Owner / code / client:** M05 / `sessions.ts:184` / `fetchSessions` (`api/practice.ts:168`).
- **Card:** BE-12 ("paginated history of own sessions (mode filter)"). **Contract:** missing.

### M05-05 `GET /api/dashboard`

- **Purpose:** the student dashboard read model (S1), assembled from M14, M09, M01, M04 and M05.
- **Auth:** `G-AUTH` (all roles may open it). **Request:** none.
- **Response:** 200 `{ data: Dashboard }` (TS `api/types.ts`, interface `Dashboard`): `user{id,name,role}`, `greetingPeriod` 'Pagi' (<12h) | 'Tengah Hari' (<15h) | 'Petang' (<19h) | 'Malam' (MYT hour), `trial: TrialStatus`, `streak{count,practisedToday}`, `wallet{coins,points,level,levelProgressPct}`, `week{sessions,accuracyPct}` (current Mon-Sun, integer %), `banners[{type,title,body}]` (active banners for the role), `quests[{key,emoji,title,difficulty:'easy'|'medium'|'hard',description,target,reward,progress,completed}]` + `questsCompleted`, `badges[{id,name,icon,rarityLabel,awardedAt}]`, `revisionTotal` (eligible queued questions), `articles[{slug,title,category,publishedAt}]` (latest 5), `subjects: PracticeSubject[]`, `stats{totalQuestions,activeSubjects,activeLevels,approvedQuestions}` (totals include PKSK), `levelPills[{code,name,stage,count}]`, `recentQuestions` (5 newest approved, text cut at 100 chars + "...": `{id,subjectName,difficulty,text,createdAt,levelCode}`), `difficultyChart[{level 1..5,count}]`, `subjectStats[{id,name,icon,color,bankCount,avgDifficulty (2 dp),usedCount}]` sorted by `bankCount` desc then id. `PracticeSubject` = `{ id, code, name, nameEn, icon:string|null, color, isCore, approvedCount (eligible), bankCount (active) }`.
- **Errors:** `E-AUTH`.
- **Side effects:** none.
- **Owner / code / client:** M05 (reads M14/M09/M01/M04) / `dashboard.ts:173` / `fetchDashboard` (`api/practice.ts:52`).
- **Card:** BE-13. **Contract:** missing.

### M05-06 `GET /api/practice/subjects`

- **Purpose:** subject cards for the practice entry (S2).
- **Auth:** `G-AUTH`.
- **Response:** 200 `{ data: PracticeSubject[], meta }` unpaged, in the M03 subject order (active subjects only).
- **Errors:** `E-AUTH`. **Side effects:** none.
- **Owner / code / client:** M05 / `subjects.ts:65` / `fetchPracticeSubjects` (`api/practice.ts:57`).
- **Card:** BE-13. **Contract:** missing.

### M05-07 `GET /api/practice/subjects/:code`

- **Purpose:** subject practice configuration (S3).
- **Auth:** `G-AUTH`. **Params:** `code` (subject code, case-insensitive; unknown or inactive -> 404).
- **Response:** 200 `{ data: SubjectConfig }` = `{ subject: PracticeSubject, total:number, levels:{id,code,name,count}[] (only Darjah 1-4 levels linked to the subject; count = practice-eligible MCQs), difficultyStats:{'1'..'5':number}, difficultyByLevel:Record<levelId, {'1'..'5':number}>, subjectiveCounts:Record<string,number>, trial: TrialStatus }`.
- **Errors:** `E-AUTH`; 404 `NOT_FOUND` "Not Found.". **Side effects:** none.
- **Owner / code / client:** M05 / `subjects.ts:69` / `fetchSubjectConfig` (`api/practice.ts:62`).
- **Card:** BE-13. **Contract:** missing.

### M05-08 `GET /api/practice/chapter-subjects`

- **Purpose:** subjects that have chapter practice (S4).
- **Auth:** `G-AUTH` (teachers may open it too).
- **Response:** 200 `{ data: ChapterSubject[], meta }` unpaged; item `{ code, name, icon:string|null, color, chapterCount, questionCount }`; only subjects with >= 1 chapter (with questions) at an offered level (Darjah 1-4).
- **Errors:** `E-AUTH`. **Side effects:** none.
- **Owner / code / client:** M05 / `chapters.ts:25` / `fetchChapterSubjects` (`api/practice.ts:100`).
- **Card:** BE-13. **Contract:** missing.

### M05-09 `GET /api/practice/chapter-subjects/:code`

- **Purpose:** chapters of a subject at a level with the caller's progress and lock state (S5).
- **Auth:** `G-AUTH`. **Params:** `code`. **Query:** `levelId` int (unknown or not an offered level falls back to the first offered level).
- **Response:** 200 `{ data: ChapterSubjectDetail }` = `{ subject:{code,name,color}, levels:{id,name,count}[], levelId:number|null, chapters: ChapterCard[] }`; `ChapterCard` = `{ id, number:number|null, name, total, answered, correct, scorePct (1 dp), remaining, state:'open'|'locked', complete }`. Locking is BR-16 (chapter k open iff k-1 complete and `scorePct >= 70`); a locked chapter is refused at session start, not here.
- **Errors:** `E-AUTH`; 404 unknown/inactive subject. **Side effects:** none.
- **Owner / code / client:** M05 / `chapters.ts:45` / `fetchChapterSubject` (`api/practice.ts:105`).
- **Card:** BE-13. **Contract:** missing.

### M05-10 `GET /api/practice/revision`

- **Purpose:** revision overview (S6): the caller's wrong-answer queue counted per subject.
- **Auth:** `G-AUTH`.
- **Response:** 200 `{ data: { total:number, subjects: { code, name, nameEn, icon, color, count }[] } }`; only subjects with queued eligible questions, in subject order. Counts are distinct eligible questions (deactivated ones stay queued but are not counted).
- **Errors:** `E-AUTH`. **Side effects:** none.
- **Owner / code / client:** M05 / `revision.ts:14` / `fetchRevisionOverview` (`api/practice.ts:117`).
- **Card:** BE-13. **Contract:** missing.

### M05-11 `GET /api/practice/revision/:code`

- **Purpose:** guard for the revision quiz (S7): the queue size for one subject.
- **Auth:** `G-AUTH`. **Params:** `code`.
- **Response:** 200 `{ data: { subject:{id,code,name,color}, count:number } }` (count 0 is still 200).
- **Errors:** `E-AUTH`; 404 unknown/inactive subject. **Side effects:** none.
- **Owner / code / client:** M05 / `revision.ts:31` / `fetchRevisionSubject` (`api/practice.ts:122`).
- **Card:** BE-13. **Contract:** missing.

### M05-12 `GET /api/practice/progress`

- **Purpose:** progress analytics (S8).
- **Auth:** `G-AUTH`. **Query:** `period` `7|30|90|all` (absent = `30`; any other value returns zeros with `period:null`).
- **Response:** 200 `{ data: Progress }` = `{ period, answered, accuracyPct:number|null (1 dp), sessions, minutes (floor of summed session seconds / 60), chart:{ labels:'DD/MM'[], accuracy:number[], counts:number[] } (one point per MYT day with answers), weakSubjects:{code,name,color,answered,accuracyPct}[] (accuracy < 50%), subjects:{code,name,color,answered,correct,wrong,accuracyPct,trend:number[]}[] }` sorted by answered desc then subject order. `answered`/accuracy count **all** answers (with or without a session); sessions/minutes count completed sessions; windows are inclusive of today (`[today-(N-1) days, end of today]`).
- **Errors:** `E-AUTH`. **Side effects:** none.
- **Owner / code / client:** M05 / `learner.ts:344` / `fetchProgress` (`api/practice.ts:130`).
- **Card:** BE-13. **Contract:** missing.

### M05-13 `GET /api/practice/history`

- **Purpose:** session history (S9).
- **Auth:** `G-AUTH`. **Query:** `period` `week|month|year` (other = all), `page` (page size fixed 15).
- **Response:** 200 `{ data: HistoryItem[], meta: ListMeta + { totals:{ sessions, answered, avgAccuracyPct (1 dp), coins } } }`; `totals` are all-time and never filtered. `HistoryItem` = `{ id:string, mode, badge:{label,icon,color}, completedAt, questionCount, correctCount, wrongCount, accuracyPct (2 dp), timeSpent, coinsEarned }`; badges: `chapter` {Bab, fa-layer-group, #0D9488}, `revision` {Ulang Kaji, fa-redo-alt, #EA580C}, `ramalan` {Tracking A, fa-book, #6B7280}, `pksk` {PKSK, fa-book, #6B7280}, others {Latihan, fa-book, #6B7280}. Newest first.
- **Errors:** `E-AUTH`. **Side effects:** none.
- **Owner / code / client:** M05 / `learner.ts:351` / `fetchHistory` (`api/practice.ts:141`).
- **Card:** BE-13. **Contract:** missing.

### M05-14 `GET /api/practice/corrections`

- **Purpose:** "before/after" correction report per month (S11): questions first answered in the month, whether the first attempt was right and whether a later attempt was right. SPM `past_year` answers are excluded.
- **Auth:** `G-AUTH`. **Query:** `month` `YYYY-MM` (malformed or absent = current MYT month).
- **Response:** 200 `{ data: Corrections }` = `{ month, prevMonth, nextMonth:string|null (null when month is the current one), summary:{before,after,delta,questions}|null (percentages, 1 dp), subjects:{name,color,questions,before,after,delta}[] }` sorted by questions desc then subject order.
- **Errors:** `E-AUTH`. **Side effects:** none.
- **Owner / code / client:** M05 / `learner.ts:381` / `fetchCorrections` (`api/practice.ts:152`).
- **Card:** BE-13. **Contract:** missing.

### M05-15 `GET /api/practice/mastery`

- **Purpose:** mastery levels per subject (S12) from stored counters.
- **Auth:** `G-AUTH`.
- **Response:** 200 `{ data: Mastery }` = `{ scale:{level:0..10,label}[], subjects: MasteryCard[] }`; `MasteryCard` = `{ code, name, icon, color, level, label, correct, answered, accuracyPct (1 dp), nextLevel:number|null, nextThreshold:number|null, barPct, xpMultiplier:number|null, lastAnsweredAt:string|null }`. Thresholds of correct answers for L0..L10: `[0,10,25,50,100,200,350,550,800,1100,1500]` (L4+ INFERRED); labels Pemula, Mula Belajar, Aktif, Tekun, Mahir, Pakar Muda, Cemerlang, Master, Grandmaster, Legend, Mythical; `xpMultiplier = 1 + 0.05*(L-1)` from L2 else null. Active subjects only, M03 order.
- **Errors:** `E-AUTH`. **Side effects:** none.
- **Owner / code / client:** M05 / `learner.ts:389` / `fetchMastery` (`api/practice.ts:163`).
- **Card:** BE-13. **Contract:** missing.

### M05-16 `GET /api/practice/structured`

- **Purpose:** structured-question cards for students (S10), plain list or SPM "Subjektif" variants.
- **Auth:** `G-AUTH`.
- **Request (query):** `subjectId`, `kbatLevel` (1..6; empty = no filter; non-numeric or out of set matches nothing), `page` (size 20), `scope=spm` (15 Subjektif SPM subjects, newest first across subjects), `track=bahasa` (only with `scope=spm`: BM then BI). Unknown `scope`, or `track` without `scope=spm`, is ignored. Only published, active, Tingkatan 4/5 questions are visible.
- **Response:** 200 `{ data: StructuredCard[], meta: ListMeta + { scope:'spm'|null, track:'bahasa'|null, subjectOptions:{id,name}[] } }`; card `{ id, subjectId, subjectName, kbatLevel, estimatedMinutes, isTrial, preview (200 chars + "..."), topic:string|null, author ('Guru Pakar' when the creator is not a teacher), school:string|null, subQuestionCount, levelName, parts, marks }`.
- **Errors:** `E-AUTH`. **Side effects:** none.
- **Owner / code / client:** M05 reads M04 structured store / `structured.ts:322` / `fetchStructured` (`api/practice.ts:198`).
- **Card:** BE-13. **Contract:** missing.

### M05-17 `GET /api/practice/structured/:id`

- **Purpose:** question detail for answering (S-Q3). No model answers.
- **Auth:** `G-AUTH`. **Params:** `id`. **Query:** `scope`, `track` (only change `backUrl`).
- **Response:** 200 `{ data: { id, subjectId, subjectName, levelName, stimulus, stimulusImage:string|null, subQuestions:{id,label,text,marks}[] (order asc), backUrl:string } }`; `backUrl` = `/latihan-berstruktur` or `/latihan-berstruktur?subject_id=<id>&scope=spm[&track=bahasa]`.
- **Errors:** `E-AUTH`; 404 `NOT_FOUND` "Not Found." (not visible). **Side effects:** none.
- **Owner / code / client:** M05 / `structured.ts:324` / `fetchStructuredDetail` (`api/practice.ts:221`).
- **Card:** BE-13 (card writes `.../attempt`; see M05-18). **Contract:** missing.

### M05-18 `POST /api/practice/structured/:id/attempts`

- **Purpose:** submit answers to a structured question; placeholder auto-marking.
- **Auth:** `G-AUTH`. **Params:** `id`.
- **Request body:** `{ answers: { subQuestionId:int, text:string (<= 5000 chars) }[] (required, each id must belong to the question, no duplicates), scope?:'spm'|null, track?:'bahasa'|null (track needs scope 'spm') }`.
- **Response:** 201 `{ data: StructuredAttemptResult }` = `{ id:string, userId, structuredQuestionId, scope, track, answers:[{subQuestionId,text}], marks:[{subQuestionId,awarded,max}], totalAwarded, totalMax, submittedAt, modelAnswers:[{subQuestionId,text}] }`. Marking (LS-7 placeholder, `structured-rules.ts:60`): a sub-question gets its full marks when the trimmed answer has >= 20 characters, else 0. Model answers are returned only after submit.
- **Errors:** `E-AUTH`; 404 not visible; 422 `VALIDATION_ERROR` with `fields.scope` / `fields.track` "Skop tidak sah."; `fields.answers` "Jawapan tidak sah."; `fields.answers.<i>` "Jawapan tidak sah." or "Jawapan tidak boleh melebihi 5000 aksara.".
- **Side effects:** insert `structured_attempts` row (scores only, no wallet/streak/queue/mastery change).
- **Owner / code / client:** M05 / `structured.ts:337` / `submitStructuredAttempt` (`api/practice.ts:233`).
- **Card:** BE-13 (path in card is `/attempt`; the mock and client use `/attempts`: OQ-API-B2-7). **Contract:** missing.

### M05-19 `GET /api/spm-targets`

- **Purpose:** the caller's target grades for the 20 SPM subjects (S15) with optional progress.
- **Auth:** `G-AUTH`. Own data only.
- **Response:** 200 `{ data: { subjects: SpmTargetRow[] } }`; `SpmTargetRow` = `{ id, name, target:'A+'|'A'|'A-'|'B+'|'B'|'C+'|'C'|'D'|'E'|null, answered:number, accuracyPct:number|null (1 dp), band:'green'|'amber'|'red'|null, predictedGrade:string|null }`. Subject ids in display order: `18,2,1,11,22,9,12,10,3,8,24,6,7,13,27,23,21,4,5,25` (`structured-rules.ts:26`). In the mock, `answered/accuracy/band/predictedGrade` are non-empty **only** when the test fixture `mock.setSpmProgress` set progress (BR-27, source UNVERIFIED); otherwise `0/null/null/null` ("Belum mula"). Band: >= 70 green, 50-69 amber, < 50 red. Predicted grade floors: 90 A+, 80 A, 70 A-, 65 B+, 60 B, 55 C+, 50 C, 45 D, 40 E, below 40 "G" (INFERRED). See OQ-API-B2-8.
- **Errors:** `E-AUTH`. **Side effects:** none.
- **Owner / code / client:** M05 / `targets.ts:35` / `fetchSpmTargets` (`api/practice.ts:243`).
- **Card:** BE-13. **Contract:** missing.

### M05-20 `PUT /api/spm-targets`

- **Purpose:** replace all 20 targets of the caller.
- **Auth:** `G-AUTH`.
- **Request body:** `{ targets: Record<subjectId(string digits, canonical), grade|''> }`; allowed grades `A+, A, A-, B+, B, C+, C, D, E`; a missing subject or `''` clears its target; subject ids outside the 20 or non-canonical keys ("01") are invalid.
- **Response:** 200 `{ data:{ saved:20 }, status:'Target berjaya disimpan.' }`.
- **Errors:** `E-AUTH`; 422 `VALIDATION_ERROR` message "Gred target tidak sah." with `fields.targets` (when `targets` is not an object) or `fields["targets.<key>"]` = "Gred target tidak sah."; nothing is saved on error.
- **Side effects:** replaces the caller's `spm_targets` rows (20 values) with `updatedAt`.
- **Owner / code / client:** M05 / `targets.ts:58` / `saveSpmTargets` (`api/practice.ts:248`).
- **Card:** BE-13. **Contract:** missing.

### M05-21 `GET /api/remedial-tests/mine`

- **Purpose:** remedial tests assigned to the caller (S13). Records are owned by M10; M05 reads them through a seam.
- **Auth:** `G-AUTH`.
- **Response:** 200 `{ data: RemedialTestItem[], meta }` unpaged; status `active` or `completed` only (cancelled hidden); newest first. Item `{ id, subjectName, totalQuestions, status:'active'|'completed', createdAt, teacherName }`.
- **Errors:** `E-AUTH`. **Side effects:** none.
- **Owner / code / client:** M05 (data M10) / `assigned.ts:37` / `fetchRemedialTests` (`api/practice.ts:255`).
- **Card:** BE-13 (read side; creation BE-18). **Contract:** missing.

### M05-22 `GET /api/missions/today`

- **Purpose:** missions visible to the caller today (S14), with the caller's session status per mission.
- **Auth:** `G-AUTH`.
- **Response:** 200 `{ data: MissionItem[], meta }` unpaged, oldest first. Item `{ id, title, typeLabel ('Latih Tubi SPM'|'Tracking A'|'Soalan & Rujukan'|''), subjectName, questionCount, coinsPerCorrect, resourceTitle, resourceUrl, resourceNote (nullable), status:'new'|'in_progress'|'completed' }` (completed beats in_progress).
- **Errors:** `E-AUTH`. **Side effects:** none.
- **Owner / code / client:** M05 (data M10) / `assigned.ts:57` / `fetchTodayMissions` (`api/practice.ts:260`).
- **Card:** BE-13 (read side; creation BE-18). **Contract:** missing.

### M05-23 `GET /api/remedial-tests/:id`

- **Purpose:** read-only preview of a remedial test with the correct options marked, for the test's teacher or an admin (PROPOSED, provisional in the SRS).
- **Auth:** `G-AUTH` + object rule inside the seam: only the owning teacher or an admin; any other viewer (including the assigned student) and unknown ids get 404.
- **Response:** 200 `{ data: RemedialPreview }` = `{ id, subjectName, status:'active'|'completed'|'cancelled', totalQuestions, createdAt, teacherName, studentName, questions: { id, questionText, textDirection, scriptType, options:{id,label,text}[], correctOptionId:number|null }[] }`.
- **Errors:** `E-AUTH`; 404 `NOT_FOUND` "Not Found.". **Side effects:** none.
- **Owner / code / client:** M05 (data M10) / `assigned.ts:100` / `fetchRemedialPreview` (`api/practice.ts:265`).
- **Card:** **UNCOVERED** (BE-13 lists `/mine` only). **Contract:** missing.

## 6. M06 SPM classic (14 routes)

Mock source: `src/modules/m06-spm/mock/handlers/{spm,mocks,duta}.ts`; rules in `mock/repository/{spm,rules}.ts`, config in `mock/data/config.ts`. Client: `src/modules/m06-spm/api/spm.ts`, types `api/types.ts`. SRS: `docs/requirements/srs/M06-spm.md` (`#n` = SRS §7 numbers).

Module-wide facts:

- All routes use `requireAuth()` only ("Any session (A)"); the only role-dependent behaviour is `readiness` in M06-05 (admin only). Matrix: student menu "SPM" (Murid row 13); Admin Pusat items KS-01..KS-12 (Kertas & SPM group) are F for `admin` only.
- None of these 14 routes has a backend card. `docs/plan/backend-tasks/README.md` "Wave 4+ backlog" lists "M06 SPM classic (databank, latih tubi, tracking, mocks) | 11 | Bijak SPM replaces most of it; confirm with the lead (OD-11)". The route count in the mock is 14, not 11 (OQ-API-B2-9). The practice start for the SPM modes (`past_year`, `latih_tubi`, `ramalan`) is covered by BE-12 (M05-01).
- Many hub figures are documented **display constants** (DV-M06-01): `HUB_TOTAL_QUESTIONS`, `HUB_POOL_CHIP` (`mock/constants/display.ts`). The backend must either compute them or keep them as configuration.
- Ids: mock exam ids are numbers; subject `code`s are the M03 codes.

### M06-01 `GET /api/spm/overview`

- **Purpose:** SPM hub (S1): totals, module chips, the caller's SPM practice stats.
- **Auth:** `G-AUTH`. **Request:** none.
- **Response:** 200 `{ data: SpmOverview }` = `{ stats:{ totalQuestions (display constant), subjectCount (distinct active subjects at levels 10 and 11), yearsAvailable (always 0: questions carry no year), trackingAQuestions (sum of ready counts over all Tracking A sets) }, modules:{ databank (pool chip constant), latihTubi (same constant), trackingA, subjektifSets (visible structured sets across the Subjektif subjects) }, me:{ sessions, avgAccuracy, coins, answered } }`. `me` = M05 `historyPage` stats over the SPM modes `past_year, latih_tubi, ramalan` (see M05-04).
- **Errors:** `E-AUTH`. **Side effects:** none.
- **Owner / code / client:** M06 (reads M03, M04, M05) / `spm.ts:314` / `fetchSpmOverview` (`api/spm.ts:34`).
- **Card:** **UNCOVERED** (backlog, OD-11). **Contract:** missing.

### M06-02 `GET /api/spm/databank`

- **Purpose:** databank subject list (S2): 18 subjects in BR-M06-06 order.
- **Auth:** `G-AUTH`.
- **Response:** 200 `{ data: DatabankSubject[] }` bare array in `data`: `{ code, name, nameEn, icon:string|null, color, databankCount }`; `databankCount` = size of the SPM pool of the subject (approved + active T4/T5 MCQs flagged `spmPool`).
- **Errors:** `E-AUTH`. **Side effects:** none.
- **Owner / code / client:** M06 / `spm.ts:315` / `fetchDatabank` (`api/spm.ts:38`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M06-03 `GET /api/spm/latih-tubi`

- **Purpose:** Latih Tubi subject cards (S3), grouped.
- **Auth:** `G-AUTH`.
- **Response:** 200 `{ data:{ teras: LatihTubiCard[], elektif: LatihTubiCard[] } }`; card `{ code, name, nameEn, icon, color, total (pool size), targetType:'spm'|'custom'|'latihan'|null, targetSize:number|null, locked:boolean (targetSize set and total < targetSize) }`; each group by `displayOrder`.
- **Errors:** `E-AUTH`. **Side effects:** none.
- **Owner / code / client:** M06 / `spm.ts:316` / `fetchLatihTubiList` (`api/spm.ts:42`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M06-04 `GET /api/spm/latih-tubi/:code`

- **Purpose:** Latih Tubi setup (S4) for one subject.
- **Auth:** `G-AUTH`. **Params:** `code` subject code.
- **Response:** 200 `{ data: LatihTubiConfig }` = `{ code, name, icon, color, total, targetType, targetSize, levelCounts:{'10':n,'11':n}, difficultyStats:{'1'..'5':n}, difficultyByLevel:{'10':{...},'11':{...}}, countOptions:{value,label,isTarget}[], defaultCount }`. With a target: one option `{ value: target, label: '<target> (Target <label>)', isTarget:true }` and `defaultCount = target`; without: `[5,10,20,30,40,50,60]`-style options (`COUNT_OPTIONS`, `data/config.ts`) and `defaultCount 10`. `<label>` from `TARGET_TYPE_LABEL`.
- **Errors:** `E-AUTH`; 404 `NOT_FOUND` "Not Found." (unknown code). **Side effects:** none.
- **Owner / code / client:** M06 / `spm.ts:317` / `fetchLatihTubiConfig` (`api/spm.ts:46`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M06-05 `GET /api/spm/tracking-a`

- **Purpose:** Tracking A hub (S5): objective lane, bahasa lane, open subjects, admin readiness board.
- **Auth:** `G-AUTH`; `readiness` is non-null **only when `req.session.role === 'admin'`** (BR-M06-30), else `null`.
- **Response:** 200 `{ data: TrackingAHub }` = `{ objectiveLane:{ subjects, sets, questions }, bahasaLane:{ subjects:2, sets }, readiness: Readiness|null, bahasa:{ subjectId, code, name, nameEn, sets }[] (subject ids 1 and 2), openSubjects: OpenSubjectCard[] }`. `OpenSubjectCard` = `{ subjectId, code, name, nameEn, icon, color, readyQuestions (sum of ready counts of startable sets), bankBesarSets, bersihSets, targetType, targetSize, bankSource:number|null, startableSets }`; only subjects with >= 1 startable set; teras before elektif. `Readiness` = `{ summary:{bersih,bankBesar,locked}, tiles:{ code, name, targetSize, bersih, bankBesar, locked, total, readiness (round((bersih+bankBesar)/total*100)), lockedSets:{setNo,readyCount,target}[] (first 6), hasBankBesar }[] }`.
  Set status rule (BR-M06-08, `repository/rules.ts:8`): `readyCount < size` -> `belum_cukup`; else `bankSource != null && bankSource > size` -> `bank_besar`; else `bersih`. Startable = not `belum_cukup`.
- **Errors:** `E-AUTH`. **Side effects:** none.
- **Owner / code / client:** M06 / `spm.ts:321` / `fetchTrackingAHub` (`api/spm.ts:50`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M06-06 `GET /api/spm/tracking-a/:code`

- **Purpose:** the sets of one subject for the year `TRACKING_YEAR` (2026) (S6). BM and BI answer a redirect to the bahasa structured track.
- **Auth:** `G-AUTH`. **Params:** `code`.
- **Response:** 200 `{ data: TrackingASubject | { redirect:string } }`. Redirect (subject id 1 or 2): `{ redirect: '/latihan-berstruktur?subject_id=<1|2>&scope=spm&track=bahasa' }`. Otherwise `{ code, name, icon, color, targetType, targetSize, summary:{ bersih, bankBesar, readyQuestions (sum over ALL sets, unlike the S5 card), belumCukup }, sets:{ setNo, status:'bersih'|'bank_besar'|'belum_cukup', readyCount, bankSource:number|null, dskpTagged, dskpTotal }[] }` (startable sets first, then locked, each by set number).
- **Errors:** `E-AUTH`; 404 unknown code. **Side effects:** none.
- **Owner / code / client:** M06 / `spm.ts:322` / `fetchTrackingASubject` (`api/spm.ts:54`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M06-07 `GET /api/spm/subjektif`

- **Purpose:** Subjektif SPM overview (S8) with the caller's structured-attempt stats.
- **Auth:** `G-AUTH`.
- **Response:** 200 `{ data: SubjektifOverview }` = `{ stats:{ setsAnswered (count of the caller's structured attempts with scope 'spm'), subjectsTried, bestScore:number|null (best attempt %, rounded), bestSetsSaved (distinct questions attempted) }, subjects:{ subjectId, name, nameEn, group:'teras'|'elektif', icon, color, sets (visible structured questions of the subject) }[] }` for the 15 Subjektif subject ids (same list as M05-16), teras first then by name (`ms` locale).
- **Errors:** `E-AUTH`. **Side effects:** none.
- **Owner / code / client:** M06 (reads M05 structured attempts, M04 structured) / `spm.ts:326` / `fetchSubjektif` (`api/spm.ts:61`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M06-08 `GET /api/spm-mocks`

- **Purpose:** the caller's mock exams (S11), newest first.
- **Auth:** `G-AUTH`.
- **Response:** 200 `{ data: MockListItem[] }` (not enveloped with meta): `{ id, subject:string, paperNumber:1|2, status:'in_progress'|'submitted', createdAt, score:number|null, maxScore, percent:number|null, grade:'A+'|'A'|'B+'|'B'|'C'|'D'|'E'|'G'|null }`.
- **Errors:** `E-AUTH`. **Side effects:** none.
- **Owner / code / client:** M06 / `mocks.ts:99` / `fetchMocks` (`api/spm.ts:65`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M06-09 `POST /api/spm-mocks`

- **Purpose:** generate a mock exam ("Jana Mock SPM").
- **Auth:** `G-AUTH`.
- **Request body:** `{ subject:string (one of: Bahasa Melayu, English, Matematik, Matematik Tambahan, Fizik, Kimia, Biologi, Sains, Sejarah, Pendidikan Islam), paperNumber?:1|2 (default 1) }`.
- **Response:** 201 `{ data:{ id:number } }`.
- **Errors:** `E-AUTH`; 422 `fields.subject` "Sila pilih subjek."; 422 `fields.paperNumber` "Paper mesti 1 atau 2.".
- **Side effects:** insert mock row. Paper 1: 30 objective items sampled (seeded stream `m06.mock`) from the SPM pool of the subject (1 mark each); Paper 2: 6 structured items of 10 marks drawn from visible structured questions of the subject (shuffled). `maxScore` = sum of item marks. Answers/keys are stored on the items only; **no M05 session, answer, queue, mastery or wallet write** (§6.5).
- **Owner / code / client:** M06 / `mocks.ts:101` / `createMock` (`api/spm.ts:69`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M06-10 `GET /api/spm-mocks/:id`

- **Purpose:** the exam paper to sit (Q4, provisional shape): no answer keys.
- **Auth:** `G-AUTH` + owner (not owner = 404). **Params:** `id`.
- **Response:** 200 `{ data: MockExamView }` = `{ id, subject, paperNumber, status, createdAt, items:{ no, text, options?:string[], maxMarks }[] }`.
- **Errors:** `E-AUTH`; 404 `NOT_FOUND` "Not Found." (unknown id or someone else's mock, BR-M06-26). **Side effects:** none.
- **Owner / code / client:** M06 / `mocks.ts:119` / `fetchMock` (`api/spm.ts:73`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M06-11 `POST /api/spm-mocks/:id/submit`

- **Purpose:** submit answers and grade the mock.
- **Auth:** `G-AUTH` + owner. **Params:** `id`.
- **Request body:** `{ answers: { no:int (1..item count), answer?:string|null (truncated to 5000 chars) }[] }`.
- **Response:** 200 `{ data: MockResult }` = `{ id, subject, paperNumber, score, maxScore, percent (2 dp), grade, heroClass:'good'|'mid'|'bad', weakTopics:{topic,wrongCount}[], items: MockItem[] }`; `MockItem` = `{ no, questionId, text, options?, modelAnswer, studentAnswer:string|null, marks:number|null, maxMarks, feedback:string|null, topic }`. Marking: Paper 1 correct iff the trimmed answer upper-cased equals the model letter (1 or 0 marks), feedback "Tahniah, jawapan anda betul." / "Jawapan yang betul ialah <X>."; Paper 2 (placeholder, D4): 0 for an empty answer else `round(max * min(1, words/60))`, feedback "Jawapan anda merangkumi <m> daripada <max> markah. Rujuk skema.". Grade bands (INFERRED): >= 90 A+, 80 A, 70 B+, 60 B, 50 C, 45 D, 40 E, else G. `heroClass`: G bad; C/D/E mid; else good. `weakTopics`: topics with items below max marks, count desc then name.
- **Errors:** `E-AUTH`; 404 not owner/unknown; 409 `CONFLICT` "Mock ini sudah dihantar."; 422 `fields.answers` "Jawapan tidak sah.".
- **Side effects:** mock row -> `submitted` with items graded, `score`, `percent`, `grade`, `submittedAt`. No other store written.
- **Owner / code / client:** M06 / `mocks.ts:131` / `submitMock` (`api/spm.ts:77`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M06-12 `GET /api/spm-mocks/:id/result`

- **Purpose:** result page (S12).
- **Auth:** `G-AUTH` + owner. **Params:** `id`.
- **Response:** 200 `{ data: MockResult }` (as M06-11).
- **Errors:** `E-AUTH`; 404 not owner/unknown; 409 code `NOT_SUBMITTED` message "Mock belum dihantar.". **Side effects:** none.
- **Owner / code / client:** M06 / `mocks.ts:146` / `fetchMockResult` (`api/spm.ts:81`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M06-13 `POST /api/spm-walkthrough/solve`

- **Purpose:** simulated AI step-by-step walkthrough of a typed or photographed question (S13). The mock returns canned text after 1500 ms and makes no external call (D4); the target is out of B1 (OD-7).
- **Auth:** `G-AUTH`.
- **Request body (multipart):** `subject` (one of the 14 listed: Bahasa Melayu, English, Matematik, Matematik Tambahan, Fizik, Kimia, Biologi, Sains, Sejarah, Pendidikan Islam, Pendidikan Moral, Geografi, Ekonomi, Perdagangan, Prinsip Akaun), `question_text` (trimmed string), `image` (file, `image/*`, <= 5 MB). Key names are snake_case (`question_text`) as live.
- **Response (raw, live-shaped, HTTP 200 even for business errors):** `{ ok:true, walkthrough:'Soalan: <first 80 chars or (gambar)>\n\n<canned text for the subject>' }` or `{ ok:false, error:'Gambar tidak sah.' }` or `{ ok:false, error:'Sila masukkan soalan atau muat naik gambar soalan.' }`.
- **Errors:** `E-AUTH`; 422 `fields.subject` "Sila pilih subjek." when the subject is not in the list.
- **Side effects:** none.
- **Owner / code / client:** M06 / `mocks.ts:160` / `solveWalkthrough` (`api/spm.ts:85`).
- **Card:** **UNCOVERED** (external AI out of B1: OD-7). **Contract:** missing.

### M06-14 `GET /api/duta/recommendations`

- **Purpose:** one "Duta" (ambassador) card to show; provisional M06 hosting of an M24 endpoint; also the data source of M25 (same path, see M25 section).
- **Auth:** `G-AUTH` (any role).
- **Request (query):** `subject` (string; prefer an ambassador for that subject if one exists), `seed` int (deterministic pick; otherwise the mock sampling stream `m06.duta`).
- **Response:** 200 `{ data: DutaCard | null }`; `DutaCard` = `{ slug, name, initials, tier:'bintang'|'inspirasi'|'tetamu', tagline, subject, state, rating:number, active:boolean }`. Only active `bintang` ambassadors are picked; `null` when none. The seed ambassadors are fictitious (`mock/data/config.ts` `DUTA_SEED`; do not copy them into docs or seeds).
- **Errors:** `E-AUTH`. **Side effects:** none.
- **Owner / code / client:** M24 (not built) hosted by M06 / `duta.ts:20` / `fetchDutaRecommendation` (`api/spm.ts:89`).
- **Card:** **UNCOVERED**. **Contract:** missing.

## 7. M07 PKSK (21 routes)

Mock source: `src/modules/m07-pksk/mock/handlers/{student,admin-questions,admin-access}.ts` (helpers `common.ts`; rules `mock/repository/rules.ts`; data `mock/data/domains.ts`). Client: `src/modules/m07-pksk/api/{pksk,admin,types}.ts`. SRS: `docs/requirements/srs/M07-pksk.md` (`#n` = SRS §7).

Module-wide facts:

- PKSK questions are rows of the **M04 question store** (`pkskDomainId`, `pkskTargetLevel` `T1|T4`, `pkskOptions[{text,isCorrect}]`); M07 reads and writes them only through the M04 public contract. They never appear in M04 admin lists (M04-01 excludes them; M04-05/06 answer 404 for them). In v2 PKSK becomes tags on the single bank (`v2-question-bank` A6, README backlog row "M07 PKSK | 16"); the wire below is the current mock (OQ-API-B2-10).
- Student routes: `requireAuth()` plus the **level gate** (`gateLevel`): the `:level` path param is case-sensitive `T1` or `T4`; an unknown level answers 404 **first**; a level the caller has no access to answers 403 (`FORBIDDEN`, "This action is unauthorized."). Access (BR-M07-07) = an active unexpired grant for the level (package `T1`, `T4` or `ALL`), or the M02 flag `hasPkskSubscription` (both levels), or role `admin` (both levels).
- Admin routes: `requireRole('admin')` (matrix BS-06 "Soalan PKSK", admin F; PKSK access screen S8 under Pengguna/Akses).
- Bahagian: A = "Kecerdasan Insaniah" (30 items in a full exam, weight 20%), B = "Kecerdasan Intelek" (70 items, 70%), C = "Artikulasi Penulisan" (1 essay, 10%). Exam score = `round1(0.2*A + 0.7*B + 0.1*C)`; grade A >= 80, B 65-79, C 50-64, D 40-49, E < 40 (`rules.ts:13`). Practice session size is 10.
- No card covers any of these 21 routes (README backlog; OD-11). Practice completion of a PKSK domain is the one place M07 writes M05 (practice session, mode `pksk`) and M14 (wallet/streak).

### M07-01 `GET /api/pksk/me/access`

- **Purpose:** which PKSK levels the caller can use.
- **Auth:** `G-AUTH`.
- **Response:** 200 `{ data:{ T1:boolean, T4:boolean } }`.
- **Errors:** `E-AUTH`. **Side effects:** none.
- **Owner / code / client:** M07 / `student.ts:83` / `fetchPkskAccess` (`api/pksk.ts:31`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M07-02 `GET /api/pksk-domains`

- **Purpose:** the 15 PKSK domains by `order`.
- **Auth:** `G-AUTH`.
- **Response:** 200 `{ data: PkskDomain[] }` = `{ id, bahagian:'A'|'B'|'C', name, nameEn, code, icon, color, order, isActive, createdAt, updatedAt }[]` (no `meta`).
- **Errors:** `E-AUTH`. **Side effects:** none.
- **Owner / code / client:** M07 / `student.ts:87` / `fetchPkskDomains` (`api/pksk.ts:36`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M07-03 `GET /api/pksk/levels/:level/dashboard`

- **Purpose:** readiness and Bahagian B mastery for a level.
- **Auth:** `G-AUTH` + level gate. **Params:** `level` `T1|T4`.
- **Response:** 200 `{ data:{ level, readiness:{ scorePct: round(mean of the caller's exam attempt scorePct), grade }, examCount, bahagianBAvgPct (1 dp, mean of attempts' B%), domains: { id, code, name, icon, color, masteryPct }[] (Bahagian B domains only) } }`. Mean of no attempts is 0.
- **Errors:** `E-AUTH`; 404 `NOT_FOUND` "Not Found." (bad level); 403 `FORBIDDEN` "This action is unauthorized." (no access). **Side effects:** none.
- **Owner / code / client:** M07 / `student.ts:89` / `fetchPkskDashboard` (`api/pksk.ts:41`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M07-04 `GET /api/pksk/levels/:level/domains`

- **Purpose:** the three Bahagian sections with domain counts and mastery.
- **Auth:** `G-AUTH` + level gate.
- **Response:** 200 `{ data: PkskDomainSection[] }` for `A`, `B`, `C` in that order: `{ bahagian, name, subtitle, domains:{ id, code, name, icon, color, questionCount (approved questions of the domain at this level), masteryPct }[] }`. Section names above; subtitles "Nilai, akhlak & sahsiah", "Kognitif & penaakulan", "Penulisan kreatif".
- **Errors:** as M07-03. **Side effects:** none.
- **Owner / code / client:** M07 / `student.ts:107` / `fetchPkskDomainSections` (`api/pksk.ts:46`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M07-05 `GET /api/pksk/levels/:level/domains/:code`

- **Purpose:** a practice set for one domain: up to 10 random approved questions at the level, **no `isCorrect`** (SEC-M07-07).
- **Auth:** `G-AUTH` + level gate. **Params:** `level`, `code` (domain code; unknown = 404).
- **Response:** 200 `{ data:{ domain:{ id, code, name, bahagian }, questions: { id, questionText, options:{text}[] }[] } }` (shuffled with the stream `m07:practice:<userId>`; a Bahagian C question has `options: []`).
- **Errors:** as M07-03; 404 unknown domain. 
- **Side effects:** records a "practice loaded" timestamp per user+level+domain (`markLoaded`) used as the session `startedAt` on submit.
- **Owner / code / client:** M07 / `student.ts:128` / `fetchPkskPractice` (`api/pksk.ts:54`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M07-06 `GET /api/pksk/levels/:level/exam-attempts`

- **Purpose:** the caller's exam attempts at the level, newest first.
- **Auth:** `G-AUTH` + level gate.
- **Response:** 200 `{ data: { id, completedAt, scorePct, grade }[] }`.
- **Errors:** as M07-03. **Side effects:** none.
- **Owner / code / client:** M07 / `student.ts:143` / `fetchPkskExamAttempts` (`api/pksk.ts:66`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M07-07 `POST /api/pksk/levels/:level/domains/:code/practice-sessions`

- **Purpose:** submit a domain practice set; scores it server-side and records it as one M05 session of mode `pksk`.
- **Auth:** `G-AUTH` + level gate. **Params:** `level`, `code`.
- **Request body:** `{ answers: { questionId:int, optionIndex?:int|null, text?:string|null }[] }` (non-empty, no duplicate `questionId`).
- **Response:** 201 `{ data:{ masteryPct:int (round(correct/answered*100)), sessionId:string, gamification:{ coinsEarned, pointsEarned, streakCount, totalBalance } } }`.
- **Errors:** as M07-03; 404 unknown domain; 422 `VALIDATION_ERROR` message "Jawapan tidak sah." with `fields.answers` (empty/duplicate/mistyped list, or any question that is not an approved PKSK question of this domain and level).
- **Side effects:** (1) `practice.completeSession` direct form (BR-34): completed session `mode='pksk'` with `pkskDomainId`, `pkskTargetLevel`, one answer row per answer (no subject/level/chapter dimensions), `coinsEarned = correct`, `pointsEarned = 10*correct`, `timeSpent` from the loaded timestamp; (2) M14 `onSessionCompleted` credit (wallet, streak, challenges, achievements); (3) per-user domain mastery stored (`setMastery`). Scoring (`handlers/common.ts:100`): A/B question correct iff the chosen option is flagged `isCorrect`; a Bahagian C / essay question is correct iff the trimmed text has >= 50 characters (simulated marker).
- **Owner / code / client:** M07 (writes M05, M14) / `student.ts:156` / `submitPkskPractice` (`api/pksk.ts:74`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M07-08 `GET /api/pksk/levels/:level/exam`

- **Purpose:** a full exam paper: 30 Bahagian A, 70 Bahagian B, 1 Bahagian C question (fewer if the pool is short), no `isCorrect`.
- **Auth:** `G-AUTH` + level gate.
- **Response:** 200 `{ data:{ sections:{ bahagian:'A'|'B'|'C', weightPct:20|70|10, questions:{ id, questionText, options:{text}[] }[] }[] } }`, shuffled with `m07:exam:<userId>`.
- **Errors:** as M07-03. **Side effects:** none (the exam composition is not stored; the submit step revalidates).
- **Owner / code / client:** M07 / `student.ts:204` / `fetchPkskExam` (`api/pksk.ts:86`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M07-09 `POST /api/pksk/levels/:level/exam-attempts`

- **Purpose:** submit an exam; scored and stored.
- **Auth:** `G-AUTH` + level gate.
- **Request body:** `{ answers: { questionId, optionIndex?, text? }[] }` (as M07-07; every question must be an approved PKSK question of this level, any domain; at most 30 A, 70 B, 1 C answers).
- **Response:** 201 `{ data:{ id, completedAt, scorePct, grade } }`. Per-Bahagian % = correct / planned count (30, 70, 1) x 100 (1 dp); `scorePct` = weighted sum (20/70/10).
- **Errors:** as M07-03; 422 "Jawapan tidak sah." (`fields.answers`) for an invalid list, an unknown/unapproved/other-level question, or more answers in a Bahagian than the composition allows.
- **Side effects:** insert exam attempt (`scorePct`, `bahagianAPct`, `bahagianBPct`, `bahagianCPct`, `completedAt`). No M05 session, wallet or streak change.
- **Owner / code / client:** M07 / `student.ts:222` / `submitPkskExam` (`api/pksk.ts:91`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M07-10 `GET /api/admin/pksk-questions`

- **Purpose:** admin PKSK question list (S5).
- **Auth:** `G-ADMIN`. Matrix BS-06.
- **Request (query):** `bahagian` `A|B|C`, `level` `T1|T4`, `status` `pending|approved|rejected` (case-insensitive; an unknown value returns an empty page), `search` (text), `page` (size 20).
- **Response:** 200 `{ data: PkskQuestionListItem[], meta: ListMeta }`; item `{ id, questionText, bahagian, domain:{id,code,name,icon,color}, targetLevel:'T1'|'T4', status }`.
- **Errors:** `E-ADMIN`. **Side effects:** none.
- **Owner / code / client:** M07 over M04 store / `admin-questions.ts:230` / `fetchPkskQuestions` (`api/admin.ts:133`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M07-11 `GET /api/admin/pksk-questions/stats`

- **Purpose:** S5 counters.
- **Auth:** `G-ADMIN`.
- **Response:** 200 `{ data:{ total, approved, pending, t1, t4 } }` over all PKSK questions.
- **Errors:** `E-ADMIN`. **Side effects:** none.
- **Owner / code / client:** M07 / `admin-questions.ts:258` / `fetchPkskQuestionStats` (`api/admin.ts:150`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M07-12 `POST /api/admin/pksk-questions/bulk`

- **Purpose:** approve / reject / delete many PKSK questions.
- **Auth:** `G-ADMIN`.
- **Request body:** `{ action:'approve'|'reject'|'delete', ids:int[] }` (non-empty; every id must be a PKSK question, otherwise nothing changes; duplicates counted once).
- **Response:** 200 `{ data:{ affected:number }, status }` with status "<n> soalan telah diluluskan." / "<n> soalan telah ditolak." / "<n> soalan telah dipadam.".
- **Errors:** `E-ADMIN`; 422 `fields.action` "Tindakan tidak sah."; `fields.ids` "Sila pilih sekurang-kurangnya satu soalan PKSK." (also for any non-PKSK/unknown id).
- **Side effects:** status updates (`approved`/`rejected`) or hard deletes.
- **Owner / code / client:** M07 / `admin-questions.ts:270` / `bulkPkskQuestions` (`api/admin.ts:183`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M07-13 `GET /api/admin/pksk-questions/:id`

- **Purpose:** S7 detail.
- **Auth:** `G-ADMIN`. **Params:** `id` (a non-PKSK id is 404).
- **Response:** 200 `{ data: PkskQuestionDetail }` = `{ id, bahagian, pkskDomainId, pkskTargetLevel, status, questionText, difficultyLevel:number|null, explanation:string|null, options:{text,isCorrect}[] }`.
- **Errors:** `E-ADMIN`; 404 `NOT_FOUND` "Soalan PKSK tidak dijumpai.". **Side effects:** none.
- **Owner / code / client:** M07 / `admin-questions.ts:298` / `fetchPkskQuestion` (`api/admin.ts:155`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M07-14 `POST /api/admin/pksk-questions`

- **Purpose:** create a PKSK question; saved `approved` (BR-M07-03).
- **Auth:** `G-ADMIN`.
- **Request body:** `{ bahagian:'A'|'B'|'C', pkskDomainId:int (domain must belong to the Bahagian), pkskTargetLevel:'T1'|'T4', questionText:string (trimmed, required), difficultyLevel:int 1..5 (required), explanation?:string, options?:{text:string,isCorrect:boolean}[] (A/B: 2 to 6 options with non-empty text; C: ignored) }`.
- **Response:** 201 `{ data: PkskQuestionDetail, status:'Soalan PKSK berjaya ditambah.' }`.
- **Errors:** `E-ADMIN`; 422 `fields`: `bahagian` "Sila pilih bahagian.", `pkskDomainId` "Sila pilih domain.", `pkskTargetLevel` "Sila pilih tingkatan.", `questionText` "Sila masukkan teks soalan.", `difficultyLevel` "Tahap kesukaran tidak sah.", `options` "Sila masukkan 2 hingga 6 pilihan jawapan." / "Sila masukkan teks pilihan jawapan.".
- **Side effects:** insert an M04 question row with the PKSK facets.
- **Owner / code / client:** M07 / `admin-questions.ts:310` / `createPkskQuestion` (`api/admin.ts:160`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M07-15 `PUT /api/admin/pksk-questions/:id`

- **Purpose:** update a PKSK question.
- **Auth:** `G-ADMIN`. **Params:** `id`.
- **Request body:** `{ pkskDomainId, pkskTargetLevel, status:'pending'|'approved'|'rejected' (required), questionText, difficultyLevel?:1..5 (absent/blank keeps), explanation?, options? (absent keeps stored options when they still fit the Bahagian) }`.
- **Response:** 200 `{ data: PkskQuestionDetail, status:'Soalan PKSK berjaya dikemaskini.' }`.
- **Errors:** `E-ADMIN`; 404 "Soalan PKSK tidak dijumpai."; 422 as M07-14 plus `fields.status` "Sila pilih status.".
- **Side effects:** update row.
- **Owner / code / client:** M07 / `admin-questions.ts:318` / `updatePkskQuestion` (`api/admin.ts:167`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M07-16 `DELETE /api/admin/pksk-questions/:id`

- **Purpose:** hard delete (BR-M07-02).
- **Auth:** `G-ADMIN`. **Params:** `id`.
- **Response:** 204 no body (client `api.delete`).
- **Errors:** `E-ADMIN`; 404 "Soalan PKSK tidak dijumpai.". **Side effects:** hard delete.
- **Owner / code / client:** M07 / `admin-questions.ts:336` / `deletePkskQuestion` (`api/admin.ts:178`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M07-17 `GET /api/admin/pksk-access`

- **Purpose:** PKSK access grants list (S8).
- **Auth:** `G-ADMIN`.
- **Request (query):** `search` (case-insensitive contains on user name or e-mail), `page` (size 20). Sort: `grantedAt desc, id desc`.
- **Response:** 200 `{ data: PkskAccessItem[], meta: ListMeta }`; item `{ id, user:{id,name,email}, package:{id,name,level:'T1'|'T4'|'ALL'}, grantedBy:{id,name}|null, grantedAt, expiresAt:'YYYY-MM-DD'|null, status:'active'|'revoked', displayStatus:'active'|'expired'|'revoked' }`. Display status: revoked, else expired when `expiresAt` is before today (MYT date), else active.
- **Errors:** `E-ADMIN`. **Side effects:** none.
- **Owner / code / client:** M07 / `admin-access.ts:60` / `fetchPkskAccessList` (`api/admin.ts:194`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M07-18 `GET /api/admin/pksk-access/stats`

- **Purpose:** counters of active grants.
- **Auth:** `G-ADMIN`.
- **Response:** 200 `{ data:{ activeTotal, t1, t4 } }`; only active (not revoked, not expired) rows; a package `ALL` counts in both `t1` and `t4`.
- **Errors:** `E-ADMIN`. **Side effects:** none.
- **Owner / code / client:** M07 / `admin-access.ts:70` / `fetchPkskAccessStats` (`api/admin.ts:208`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M07-19 `POST /api/admin/pksk-access`

- **Purpose:** grant PKSK access to a user.
- **Auth:** `G-ADMIN`.
- **Request body:** `{ userId:int (existing user), packageId:int (existing package), expiresAt?:'YYYY-MM-DD'|null (a real calendar date; no bounds; a past date creates an already-expired row) }`.
- **Response:** 201 `{ data: PkskAccessItem, status:'Akses PKSK berjaya diberi.' }`.
- **Errors:** `E-ADMIN`; 422 `fields.userId` "Pengguna tidak dijumpai."; `fields.packageId` "Sila pilih pakej."; `fields.expiresAt` "Tarikh tamat tidak sah.".
- **Side effects:** insert grant `status='active'`, `grantedBy` = admin, `grantedAt` = now. Student endpoints see it immediately (BR-M07-07).
- **Owner / code / client:** M07 / `admin-access.ts:75` / `grantPkskAccess` (`api/admin.ts:213`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M07-20 `POST /api/admin/pksk-access/:id/revoke`

- **Purpose:** revoke an active grant.
- **Auth:** `G-ADMIN`. **Params:** `id`.
- **Response:** 200 `{ data: PkskAccessItem, status:'Akses PKSK telah ditarik balik.' }`.
- **Errors:** `E-ADMIN`; 404 `NOT_FOUND` "Rekod akses tidak dijumpai."; 409 `CONFLICT` "Akses ini tidak aktif dan tidak boleh ditarik balik." (already revoked or expired).
- **Side effects:** `status='revoked'`, `revokedAt` = now.
- **Owner / code / client:** M07 / `admin-access.ts:111` / `revokePkskAccess` (`api/admin.ts:220`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M07-21 `GET /api/pksk-packages`

- **Purpose:** the 3 PKSK packages (M19-owned fixture hosted by M07).
- **Auth:** `G-ADMIN`.
- **Response:** 200 `{ data: { id, name, level:'T1'|'T4'|'ALL' }[] }`.
- **Errors:** `E-ADMIN`. **Side effects:** none.
- **Owner / code / client:** M19 (hosted by M07) / `admin-access.ts:127` / `fetchPkskPackages` (`api/admin.ts:227`).
- **Card:** **UNCOVERED** (BE-25 covers school packages, not these). **Contract:** missing.

## 8. M13 Cikgu Alesa (10 routes)

Mock source: `src/modules/m13-cikgu-alesa/mock/handlers/index.ts`; repository `mock/repository/{cikgu,canned}.ts`. Client: `src/modules/m13-cikgu-alesa/api/{cikgu,types,settings}.ts`. SRS: `docs/requirements/srs/M13-cikgu-alesa.md` (`#n` = SRS §7).

Module-wide facts:

- Guard **S** (= `chatSession`): any signed-in user; a guest gets the live-shaped `401 {}` (raw, no error envelope). Guard **T** (= `teacherOnly`): `requireRole('teacher','admin')` (guest 401, student/parent/others 403, standard error envelope). Matrix: student menu "Cikgu Alesa" (Murid row 37); teacher tools have no matrix row of their own.
- The AI is **simulated** (canned replies, canned marks, no network). The backlog row in `README.md` states "M13 Cikgu Alesa, M25 AI centre | 8 + 1 | external AI: out of B1 (OD-7)". The mock has 10 M13 routes (the SRS listed 8 plus the two detail routes). No card exists (OQ-API-B2-11).
- Owner rule: RPH, essay markings and PBD tags are returned to their owner only; a foreign or unknown id is a plain 404 (FR-M13-48).
- Ids are numbers (chat thread ids are strings `thr-<n>`).
- Chat daily quota by role: admin tier `admin` 100 turns, teacher tier `guru` 30, every other role tier `pelajar` 10 (`api/settings.ts`). A turn = one user message of the Malaysia-time day.

### M13-01 `POST /api/cikgu/send`

- **Purpose:** one chat turn with Cikgu Alesa. Returns the **live body untouched** (snake_case, no `{data}` envelope; the client uses `api.raw`).
- **Auth:** `chatSession` (any signed-in user); guest -> HTTP 401 body `{}`.
- **Request body:** `{ message:string (required, trimmed non-empty), thread_id?:string|null }`. A `thread_id` of another user or an unknown one starts a new thread (`thr-<n>`, n from 9,000,001 upwards).
- **Response (raw):** 200 `{ thread_id:string, reply:string, tier:'admin'|'guru'|'pelajar', turns_remaining:number, tool_hops:0|1, tokens:{ in:number, out:number } }`. Tokens: `in = 120 + ceil(codepoints(message)/4)`, `out = ceil(codepoints(reply)/4)`.
  Routing of the canned reply (`canned.ts:63`): message starting (case-insensitive) with "Tolong mark karangan ini menggunakan rubric " -> `mark_essay` (stores an essay marking, tool_hops 1); contains "rph" -> `rph` (parses subject/level/title; if parsed saves an RPH with source `chat`, tool_hops 1, else a follow-up question); contains "latihan" or "soalan" -> `practice` (tool_hops 1); else general reply.
- **Errors (raw bodies):** 422 `{}` for a missing/blank message; 429 `{ quota_exhausted:true }` when the day's turns are used up; 401 `{}`.
- **Side effects:** upserts `chat_threads` (`updatedAt`), inserts a `chat_messages` row for the user message and one for the bot reply (`tool`, `toolHops`, tokens); for `mark_essay` inserts an `essay_markings` row (rubric, subject, level, student, title, essay text, canned marks, comment); for a parsed RPH request inserts an `rphs` row. Mock waits `m13.aiLatencyMs` (default 1500 ms). A real provider call is out of B1.
- **Owner / code / client:** M13 / `handlers/index.ts:59` / `sendChat` (`api/cikgu.ts:41`).
- **Card:** **UNCOVERED** (OD-7). **Contract:** missing.

### M13-02 `GET /api/cikgu/rph`

- **Purpose:** the teacher's lesson plans (RPH), newest lesson date first.
- **Auth:** `teacherOnly` (teacher, admin).
- **Request (query):** `page` (page size fixed 20).
- **Response:** 200 `{ data: RphListItem[], meta: ListMeta }`; item `{ id, lessonDate:'YYYY-MM-DD', subjectName, level:'D1'..'D6'|'T1'..'T5', tajuk, status:'generated' }`. Sort `lessonDate desc, id desc`; own rows only.
- **Errors:** 401, 403 `FORBIDDEN` "This action is unauthorized.". **Side effects:** none.
- **Owner / code / client:** M13 / `handlers/index.ts:73` / `fetchRphList` (`api/cikgu.ts:55`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M13-03 `POST /api/cikgu/rph`

- **Purpose:** generate and save an RPH from the form (canned content).
- **Auth:** `teacherOnly`.
- **Request body:** `{ subjectName:string (required, <= 100), level:'D1'..'D6'|'T1'..'T5' (required), tajuk:string (required, <= 200), className?:string|null (<= 100), lessonDate?:'YYYY-MM-DD' (default today MYT; must be a real date), durationMinutes?:int 15..240 (default 60), timeSlot?:string|null (<= 100), tema?:string|null (<= 100), pengajaranKeperluan?:string|null (<= 500) }`.
- **Response:** 201 `{ data: Rph }` = `{ id, userId, subjectName, level, tajuk, className:string|null, lessonDate, durationMinutes, timeSlot, tema, pengajaranKeperluan, status:'generated', source:'form'|'chat', content:string (canned plan text), threadId:string|null, createdAt }`.
- **Errors:** 422 `VALIDATION_ERROR` with `fields`: "Medan ini diperlukan." (required), "Medan ini tidak sah." (level not in list), "Medan ini tidak boleh melebihi <n> aksara." (max length), `durationMinutes` "Tempoh mesti antara 15 dan 240 minit.", `lessonDate` "Tarikh tidak sah." (`repository/cikgu.ts` `VALIDATION_MSG`). Plus 401/403.
- **Side effects:** insert `rphs` (`source='form'`, `threadId=null`). Waits the AI latency. Content is canned in the mock; a real generator is out of B1.
- **Owner / code / client:** M13 / `handlers/index.ts:88` / `createRph` (`api/cikgu.ts:60`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M13-04 `GET /api/cikgu/rph/:id`

- **Purpose:** RPH detail (owner only).
- **Auth:** `teacherOnly`. **Params:** `id` digits.
- **Response:** 200 `{ data: Rph }` (as M13-03).
- **Errors:** 401/403; 404 `NOT_FOUND` "Not Found." (unknown or someone else's). **Side effects:** none.
- **Owner / code / client:** M13 / `handlers/index.ts:97` / `fetchRph` (`api/cikgu.ts:65`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M13-05 `GET /api/cikgu/essays`

- **Purpose:** the caller's essay markings (created through chat hand-off).
- **Auth:** `teacherOnly`. **Query:** `page` (size 20).
- **Response:** 200 `{ data: EssayListItem[], meta: ListMeta }`; item `{ id, studentName:string|null, subjectName:string|null, rubricKey, essayTitle:string|null, marks, maxMarks, createdAt }`; newest first; own rows. `rubricKey` in `spm_bm_karangan` (50), `spm_bi_continuous_writing` (50), `pt3_bm_karangan` (30), `pt3_bi_essay` (30), `sejarah_essay` (20), `general` (100).
- **Errors:** 401/403. **Side effects:** none.
- **Owner / code / client:** M13 / `handlers/index.ts:109` / `fetchEssayList` (`api/cikgu.ts:70`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M13-06 `GET /api/cikgu/essays/:id`

- **Purpose:** essay marking detail (owner only).
- **Auth:** `teacherOnly`. **Params:** `id`.
- **Response:** 200 `{ data: EssayMarking }` = `{ id, userId, rubricKey, subjectName, level, studentName, essayTitle, essayText, marks, maxMarks, comment, threadId:string, createdAt }`.
- **Errors:** 401/403; 404. **Side effects:** none.
- **Owner / code / client:** M13 / `handlers/index.ts:126` / `fetchEssay` (`api/cikgu.ts:75`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M13-07 `GET /api/cikgu/pbd`

- **Purpose:** pending PBD (school-based assessment) tag queue of the caller.
- **Auth:** `teacherOnly`. **Query:** `page` (size 20).
- **Response:** 200 `{ data: PbdQueueItem[], meta: ListMeta }`; item `{ id, studentId, studentName, classroomId, sp:string, skor:number, tp:1..6 }`. Only `pending` tags of the caller; sort `createdAt desc`, then student name (`ms` collation), then id.
- **Errors:** 401/403. **Side effects:** none.
- **Owner / code / client:** M13 / `handlers/index.ts:138` / `fetchPbdQueue` (`api/cikgu.ts:80`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M13-08 `POST /api/cikgu/pbd/rollup`

- **Purpose:** build/update PBD tags for the students of one of the caller's classes from their practice answers.
- **Auth:** `teacherOnly`.
- **Request body:** `{ classroomId:int|numeric string|null }`.
- **Response:** 200 `{ data: { created:number, updated:number, skipped:number } }`. A null/invalid class id, a class that is not the caller's, or a class without a subject returns zeros (still 200).
- **Side effects:** for each class member with answers in the class subject: `skor = round(correct/answered*1000)/10`, `tp` = `<20:1, <40:2, <60:3, <75:4, <90:5, else 6`, SP label from the subject (`Kimia` 5.1.1, `Sejarah` 1.1.1, default 1.1.1). An existing **pending** tag for (teacher, class, student, sp) is updated (`updated`); if only approved/other tags exist it is `skipped`; else a new `pending` tag is inserted (`created`).
- **Errors:** 401/403. 
- **Owner / code / client:** M13 (reads M05 answers, M10 classes) / `handlers/index.ts:154` / `rollupPbd` (`api/cikgu.ts:85`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M13-09 `POST /api/cikgu/pbd/bulk-approve`

- **Purpose:** approve pending PBD tags.
- **Auth:** `teacherOnly`.
- **Request body:** `{ ids: (int|numeric string)[] }` (other items dropped).
- **Response:** 200 `{ data:{ approved:number } }` = count of the caller's tags that were `pending` (duplicates counted once; foreign or non-pending ids ignored silently).
- **Side effects:** tag `status='approved'`, `approvedAt` = now.
- **Errors:** 401/403.
- **Owner / code / client:** M13 / `handlers/index.ts:167` / `bulkApprovePbd` (`api/cikgu.ts:93`).
- **Card:** **UNCOVERED**. **Contract:** missing.

### M13-10 `GET /api/cikgu/pbd/export.csv`

- **Purpose:** CSV of the caller's approved PBD tags.
- **Auth:** `teacherOnly`.
- **Response:** 200 `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="pbd-approved.csv"`. Header line `pelajar,kelas,sp,skor,tp,tarikh_lulus`; one row per approved tag ordered by approval time, then student name, then id; `skor` with 1 decimal, `tarikh_lulus` = `YYYY-MM-DD`; cells starting with `=`, `+`, `@`, `-` are prefixed with `'` (CSV injection guard) and quoted when they contain `"`, comma or newline. File ends with a newline.
- **Errors:** 401/403. **Side effects:** none.
- **Owner / code / client:** M13 / `handlers/index.ts:179` / `downloadPbdCsv` (`api/cikgu.ts:104`).
- **Card:** **UNCOVERED**. **Contract:** missing.

## 9. M25 AI Centre (1 route)

Mock source: `src/modules/m25-ai-centre/mock/handlers/index.ts`; repository `mock/repository/heatmap.ts`; client `src/modules/m25-ai-centre/api/{heatmap,settings,types}.ts`. SRS: `docs/requirements/srs/M25-ai-centre.md`.

- `GET /api/duta/recommendations` (SRS M25 #2) is declared in `api/settings.ts` (`DUTA_PATH`) but registered by M06 (see M06-14); it is **not** counted here.

### M25-01 `GET /api/buku-nota/heatmap`

- **Purpose:** "Heatmap Topik Lemah": the caller's weak-topic heatmap grouped by subject (Pusat AI).
- **Auth:** `requireRole('student','admin')` (guest 401; teacher, parent, others 403). Matrix: Murid row 14 "Heatmap Topik Lemah" allowed; not allowed for Guru and Admin Sekolah (the mock additionally lets `admin` call it, for the admin's own data).
- **Request:** none; any query value is ignored. Data is always the session user's own.
- **Response:** 200 `{ data:{ subjects:{ subjectId, name, topics:{ chapterId, name, attempts, correct, percent, band:'red'|'amber'|'green' }[] }[] } }`. Rules: a chapter is shown only with >= 5 attempts (`HEATMAP_MIN_ATTEMPTS`, K-M25-01); `percent = round-half-up(100*correct/attempts)`; band red < 50, amber 50-79, green >= 80 (on the rounded percent); topics ordered by accuracy ascending (`a.correct*b.attempts - b.correct*a.attempts`), then name, then chapter id; subjects by M03 subject order. Answers without a chapter dimension are not shown. Source: the caller's M05 answer log (`practice_answers`) joined to M03 chapters; v2 reads the answer-row dimensions (no join to questions).
- **Errors:** `E-AUTH`; 403 `FORBIDDEN` "This action is unauthorized." for other roles.
- **Side effects:** none.
- **Owner / code / client:** M25 (reads M05, M03) / `handlers/index.ts:15` / `getHeatmap` (`api/heatmap.ts`, first export).
- **Card:** **UNCOVERED** (README backlog; BE-13 covers other M05 reads but not this path). **Contract:** missing.

## 10. M28 Bijak SPM (0 HTTP routes; 16 public methods of class `BijakServer`)

Mock source: `src/modules/m28-bijak-spm/server/store.ts` (class `BijakServer`, 813 lines), browser handle `server/client.ts` (`bijakServer()`), types `domain/types.ts`, seeds `data/{registry,mat-k1,mat-k2,sains-k2,sejarah-k2,builders,diagrams}.ts`, grading `domain/{grading,math-expr,blueprint,paper-model}.ts` (moved to `@pp/exam-core` by BE-14). Specs: `docs/requirements/v2-bijak-spm.md`, `v2-exam-schema.md`. Grep proof: `route(` count in `src/modules/m28-bijak-spm` = 0.

Facts that govern every operation:

- The mock is an **in-process class, not HTTP**. Every call takes the caller's numeric `userId` as its first argument (from the session); the class has no role check at all. The target endpoints below are the ones the cards BE-15, BE-16 define (all relative to `/api`, hence the full path `/api/bijak/...`); the cards say "student role unless stated; the attempt owner only". Matrix: Admin Pusat item KS-06 "Bijak SPM (Simulasi)" is `admin` F; the student-facing menu is the Pembelajaran/SPM group (Murid row 13). The role of the endpoint guard is therefore **student (and admin preview, to confirm: OQ-API-B2-12)**.
- Every method is `async` (simulated latency 120 ms outside tests) and rejects with `BijakError(code, message)` where `code` is `not_found | forbidden | not_submitted | offline | bad_request`. Card mapping of the codes (BE-16): `not_found` 404, `forbidden` 403, `not_submitted` 409, `offline` n/a on the server, `bad_request` 400/422. The BM messages are kept verbatim from the mock: "Kertas tidak ditemui", "Percubaan tidak ditemui", "Akses ditolak", "Skema hanya didedahkan selepas Hantar", "Percubaan sudah tamat", "Soalan tidak ditemui", client-side "Luar talian". The target error body is the common `{ error:{ code, message } }`.
- Time values in the mock are **epoch milliseconds** (`startedAt`, `deadline`, `submittedAt`, `savedAt`, `startedAt` in history). The contract rule is ISO 8601 with `+08:00` (`common/time.ts`); OQ-API-B2-13.
- Ids in the mock are strings: papers `mat-...` (registry ids) and generated `jana-<subject lower>-k<kertas>-<seq>`, attempts `pcb-<seq>-<userId>`, parts/questions/stimuli registry strings. The target uses uuid for attempts and opaque strings for others (plan section 5).
- Constants: `GRACE_SECONDS = 300`, `LATE_SYNC_WINDOW_MS = 24h`, `MAX_CHECKS_PER_QUESTION = 3`, `FRESH_SECONDS = 60`.
- **Reveal rule (US-15):** an answer key, mark scheme, accepted equivalents or explanation leaves the server only inside a graded result: after submit (exam), or per question after "Semak" (latihan). `AttemptPaperView` and every save response carry no keys.
- Wallet: the mock result carries display values `coins = score*2` and `points = score*10` but **does not write the wallet**; BE-16 credits the wallet only "if the mock credits" (it does not): OQ-API-B2-14.
- State in the mock: `seq`, `attempts{}`, `generated{}` (generated papers private to the creating user).

Contract status for every operation below: **missing** (no `bijak` schema in `packages/contract/src`, no path in `openapi.ts`). The card BE-15/BE-16 name the contract files `packages/contract/src/bijak/{papers,attempts}.ts`.

### BJ-01 `listPapers(userId)` -> `GET /api/bijak/papers`

- **Purpose:** list the fixed ("Kertas Pilihan") papers with the caller's progress.
- **Maps to endpoint:** BE-15 `GET /bijak/papers` (card adds optional filters `subject?`, `kertas?` which the mock method does not have).
- **Input:** `userId`. **Output:** `PaperSummary[]` = `{ id, title, subject (code), subjectName, kertas:number, year, code, durationMin, questionCount, marks (sum via effective marks of sections), kind:'pilihan'|'jana', status:'belum'|'sedang'|'selesai', lastScore?:{score,max}, attemptId? }`. `status`: `sedang` when the latest attempt is `in_progress` (then `attemptId` is that attempt), else `selesai` when any attempt has a result (`lastScore` of the latest submitted), else `belum`. Only fixed papers are listed (never generated ones).
- **Errors:** `offline` only. **Side effects:** runs `sweep()` first (see BJ-12).
- **Wire (card):** `{ data: PaperSummary[] }`. **Code:** `store.ts:listPapers`. **Card:** BE-15. **Contract:** missing.

### BJ-02 `getCover(userId, paperId)` -> `GET /api/bijak/papers/:id`

- **Purpose:** paper cover (instructions, reference sheet, sections, marks).
- **Maps to endpoint:** BE-15 `GET /bijak/papers/:id` (404 for unpublished or another user's generated paper).
- **Input:** `userId`, `paperId`. A fixed paper resolves for anyone; a generated paper only for its creator.
- **Output:** `PaperCover` = `PaperSummary` plus `instructions:string[]`, `reference:{title,items:string[]}[]` (reference-sheet panels, verbatim), `sections:{ label, marks (effective marks after choose-N), instruction, questionCount, compulsory:boolean, chooseN? }[]`. Default instruction when the section has none: "Jawab semua soalan." (rule `all`) or "Jawab <n> daripada <count> soalan." (rule `choose`).
- **Errors:** `not_found` "Kertas tidak ditemui" (unknown paper, or someone else's generated paper). **Side effects:** none.
- **Card:** BE-15. **Contract:** missing.

### BJ-03 `listContracts()` -> `GET /api/bijak/contracts`

- **Purpose:** blueprint ("Kontrak") list for "Jana Kertas": which (subject, kertas) can be generated.
- **Maps to endpoint:** BE-15 `GET /bijak/contracts`.
- **Input:** none. **Output:** `{ subject, subjectName, kertas, source:'Disahkan'|'Spec'|'Draf', code, durationMin, sections:{label, take}[] }[]` (all blueprints including `Draf`).
- **Errors:** `offline` only. **Side effects:** none.
- **Card:** BE-15. **Contract:** missing.

### BJ-04 `subjects()` -> endpoint not yet defined

- **Purpose:** the subject dictionary (`{ code, name }[]`, open dictionary, exam schema D9) used by the hub filters and Jana Kertas. Synchronous, returns the bundled `SUBJECTS` constant.
- **Maps to endpoint:** none. BE-15 lists `subjects` among the methods to read but its endpoint table defines no subjects endpoint (`GET /bijak/subjects` is not in the card). **Endpoint not yet defined** (OQ-API-B2-15). The card BE-08 curriculum may supply it (`GET /api/subjects`, M03), to be decided by the lead.
- **Input:** none. **Output:** `Subject[]`. **Errors:** none. **Side effects:** none.
- **Card:** none for this method. **Contract:** missing.

### BJ-05 `generatePaper(userId, subject, kertas)` -> `POST /api/bijak/papers/generate`

- **Purpose:** compose a private paper from a blueprint ("Jana Kertas", US-03); returns a shortage list instead of a short paper.
- **Maps to endpoint:** BE-15 `POST /bijak/papers/generate`, body `{ subject, kertas }`; card responses: `201 { data:{ paperId } }`, `422 { error.code:'NO_BLUEPRINT' }`, `422 { error.code:'SHORTAGE', details:{ shortages[] } }`.
- **Input:** `userId`, `subject:string`, `kertas:number`.
- **Output (mock):** `GenerateOutcome` = `{ ok:true, paperId }` | `{ ok:false, reason:'no_blueprint' }` (no blueprint for the pair, or its `source` is `Draf`) | `{ ok:false, reason:'shortage', shortages:{ section:string, need:number, have:number }[] }`. The mock does not throw for these outcomes; the HTTP mapping to 422 is defined by the card.
- **Errors:** `offline` only (HTTP: 401/403 by session).
- **Side effects:** `seq += 1`; composition uses `composeFromBlueprint` + `poolUnits` (stimulus-group questions are taken together; never repeats a question inside one paper; avoids questions the caller has already seen in earlier attempts via the `seen` set) seeded with `now + seq*7919 + userId`; on success stores a private `GeneratedPaper` `jana-<subject lower>-k<kertas>-<seq>` with title "Kertas Jana <Subject name> Kertas <k> (#<seq>)", year = current year, the blueprint's code/duration/instructions/reference, and per-section `markBudget`. The card requires determinism for a fixed seed in tests.
- **Card:** BE-15 (generation), BE-39 (blueprint admin write side). **Contract:** missing.

### BJ-06 `findInProgress(userId, paperId)` -> `GET /api/bijak/papers/:paperId/in-progress`

- **Purpose:** resume prompt: the caller's open attempt on a paper.
- **Maps to endpoint:** BE-16 `GET /bijak/papers/:paperId/in-progress` -> `{ data: InProgressInfo | null }`.
- **Input:** `userId`, `paperId`. **Output:** `{ attemptId, title, mode:'exam'|'latihan', elapsedSeconds, fresh:boolean }` (`fresh` = elapsed <= 60 s: resume silently) or `null` (most recent open attempt only).
- **Errors:** `offline` only. **Side effects:** `sweep()` first.
- **Card:** BE-16. **Contract:** missing.

### BJ-07 `startAttempt(userId, paperId, mode, { restart? })` -> `POST /api/bijak/attempts`

- **Purpose:** start or resume a sitting.
- **Maps to endpoint:** BE-16 `POST /bijak/attempts`, body `{ paperId, mode:'exam'|'latihan', restart? }` -> `201/200 { data:{ attemptId } }`.
- **Input:** `userId`, `paperId`, `mode`, `restart?:boolean`. The paper must resolve for the user (see BJ-02).
- **Output:** `{ attemptId }`. If the caller already has an `in_progress` attempt on the paper and `restart` is not set, that attempt's id is returned (most recent) and nothing is created.
- **Errors:** `not_found` "Kertas tidak ditemui".
- **Side effects:** with `restart`, every open attempt of the user on the paper becomes `abandoned` (AC-12.2). A new attempt is stored: id `pcb-<seq>-<userId>`, `status='in_progress'`, `startedAt` = server now, `deadline = startedAt + durationMin*60000` for `exam` and `null` for `latihan`, frozen snapshot of the paper sections (`rule`, `questionIds`), empty `answers`, `flags`, `picks`, `position 0`, `checked []`. The deadline must come from the server clock (BE-16 AC-2).
- **Card:** BE-16. **Contract:** missing.

### BJ-08 `getAttemptView(userId, attemptId)` -> `GET /api/bijak/attempts/:id`

- **Purpose:** the paper as served to an attempt, with saved answers state; no keys, no schemes.
- **Maps to endpoint:** BE-16 `GET /bijak/attempts/:id` -> `{ data: AttemptPaperView }`; the card also puts `serverNow` into this response (the mock has a separate `serverNow()` method, BJ-16).
- **Input:** `userId`, `attemptId`.
- **Output:** `AttemptPaperView` = `{ attempt: Attempt without result/sections (id, userId, paperId, paperKind, title, subject, kertas, code, mode, status, startedAt, deadline, durationMin, answers: Record<partId,{answer,rev,savedAt}>, flags:string[], picks:Record<string,string[]>, position, checked:string[], checkCounts?, submittedAt?, lateBySeconds?, idempotencyKey?), sections: (snapshot + marks + effectiveMarks)[], questions: QuestionView[] (id, number, sectionId, topic = unit label, formOrigin 'T1-T3'|'T4'|'T5', groupId?, optionBank?, stem, marks, mcq?:{options:{id,text}[]}, parts?: PartView tree {id,label,prompt,marks,answer?:{kind,unit?,wordRange?},children?}), groups: GroupView[] ({id, stimulus:StimulusDef, from, to, questionIds}), checks: QuestionResult[] (latihan, in progress: the per-question results of questions already checked with "Semak", with their scheme revealed) }`. Full TS: `domain/types.ts:380-520`. Question numbers run 1..n across sections in order.
- **Errors:** `not_found` "Percubaan tidak ditemui"; `forbidden` "Akses ditolak" (the card maps another user's attempt to 404 so ids cannot be probed: BE-16 AC-7). **Side effects:** `sweep()`.
- **Card:** BE-16. **Contract:** missing.

### BJ-09 `saveAnswers(userId, attemptId, payload)` -> `PUT /api/bijak/attempts/:id/answers`

- **Purpose:** idempotent autosave (US-11) with per-part revisions.
- **Maps to endpoint:** BE-16 `PUT /bijak/attempts/:id/answers` -> `{ data: SaveResult }`.
- **Input:** `SavePayload` = `{ changes:{ partId, answer: PartAnswer, rev:number, savedAt:number }[], flags?:string[], picks?:Record<string,string[]>, position?:number }`. `PartAnswer` = `{ choice?, steps?:string[], final?, unit?, text?, photos?:{key,name,size}[], plain?:{steps,final} }` (LaTeX is canonical, `plain` is the derived plain form).
- **Output:** `SaveResult` = `{ savedAt:number, closed?:true, regraded?:true }`.
- **Rules:** for an `in_progress` attempt: for each change, ignored when the part is not part of the attempt, or locked (latihan after 3 checks of its question), or the stored `rev >= change.rev`; otherwise stored as `{ answer, rev, savedAt: min(change.savedAt, serverNow) }` (device clock never trusted); then `flags`, `picks`, `position` replaced when present. For a non-open attempt: answers `closed:true`; **late sync**: an `auto_submitted` exam attempt still accepts changes whose `savedAt <= deadline` within 24 h after the deadline; if they change the stored answers the attempt is graded again and `regraded:true` is returned.
- **Errors:** `not_found`, `forbidden` as BJ-08. **Side effects:** persists attempt state; `sweep()` first.
- **Card:** BE-16. **Contract:** missing.

### BJ-10 `submit(userId, attemptId, payload)` -> `POST /api/bijak/attempts/:id/submit`

- **Purpose:** submit and grade; idempotent.
- **Maps to endpoint:** BE-16 `POST /bijak/attempts/:id/submit` -> `{ data: SubmitResult }`.
- **Input:** `SubmitPayload` = `SavePayload` + `{ idempotencyKey:string, answers?:Record<partId,{answer,rev,savedAt}> (the device's full set, merged with `changes`), auto?:boolean }`.
- **Output:** `SubmitResult` = `{ attemptId, late:number (seconds past the deadline, 0 when none; capped at 300 for a sweep close), closed?:true, regraded?:true }`. Repeat submit on an already closed attempt returns the same shape with `closed:true` (and `regraded` if a late sync changed answers); the stored result is not recomputed otherwise.
- **Errors:** `not_found`, `forbidden`. **Side effects:** merge as BJ-09, then `status='submitted'` (or `'auto_submitted'` when `auto`), `submittedAt`, `idempotencyKey`, `lateBySeconds` when past the deadline, and `result = gradeAttempt` (see grading below). Concurrent submits with the same key must create one result row (BE-16 AC-6). No wallet write in the mock (OQ-API-B2-14).
- **Grading (`gradeAttempt`, `@pp/exam-core`):** per question parts graded with `gradePart` (mark points K/N/P/M/F/C/B, accepted equivalents, ECF, "any N of M", manual points left `belum_dimarkah`); a `choose N` section counts the best N attempted questions by marks (ties: lower position); `AttemptResult` = `{ score, max, percent (1 dp), provisional:boolean, pendingReview:number, sections: SectionResult[], questions: QuestionResult[], coins: score*2, points: score*10 }`.
- **Card:** BE-16. **Contract:** missing.

### BJ-11 `abandon(userId, attemptId)` -> `POST /api/bijak/attempts/:id/abandon`

- **Purpose:** discard an open sitting.
- **Maps to endpoint:** BE-16 `POST /bijak/attempts/:id/abandon` -> 204.
- **Input/Output:** `userId`, `attemptId` -> `void`. **Errors:** `not_found`, `forbidden`. **Side effects:** `in_progress` -> `abandoned` (no-op if not in progress).
- **Card:** BE-16. **Contract:** missing.

### BJ-12 `sweep()` -> scheduled job, no endpoint

- **Purpose:** close exam attempts that are past `deadline + 300 s`, grading what was saved, status `auto_submitted`, `lateBySeconds` capped at 300.
- **Maps to endpoint:** none. BE-16 implements it as the scheduled `AttemptSweeper` (`@nestjs/schedule`). The mock also invokes it lazily at the start of list/view/save/submit/result/history calls. **Not an HTTP operation.**
- **Card:** BE-16 (AC-5). **Contract:** n/a.

### BJ-13 `checkQuestion(userId, attemptId, questionId, payload?)` -> `POST /api/bijak/attempts/:id/questions/:questionId/check`

- **Purpose:** latihan "Semak": grade one question and reveal only that question's scheme (AC-15.3).
- **Maps to endpoint:** BE-16 `POST /bijak/attempts/:id/questions/:questionId/check`, optional body `SavePayload` -> `{ data: QuestionResult }`.
- **Input:** `userId`, `attemptId`, `questionId`, `payload?: SavePayload` (merged first when the check cap is not reached).
- **Output:** `QuestionResult` = `{ questionId, number, sectionId, marks, awarded, counted, attempted, parts: PartResult[] }`; `PartResult` = `{ partId, label, prompt, marks, awarded, status:'betul'|'separa'|'salah'|'kosong'|'belum_dimarkah', confidence:'high'|'low', points: PointResult[] ({id,code,tag,manual?,label,marks,awarded,hit,reason}), ecf?, answer, scheme: SchemeReveal ({marks, correctOption?, correctLetter?, acceptedText?, rubric?, explanation?, finalDisplay?, unit?, model?}) }`.
- **Errors:** `forbidden` "Skema hanya didedahkan selepas Hantar" (attempt mode is `exam`); `bad_request` "Percubaan sudah tamat" (attempt not in progress); `not_found` "Soalan tidak ditemui" (question not on the attempt) or attempt not found; `forbidden` "Akses ditolak" for another user. Card: exam mode returns 403 with the mock's BM message.
- **Side effects:** per-question counter `checkCounts[questionId]` incremented while below 3; after 3 checks the answer of that question is locked (later saves of its parts ignored) and further checks return the result without changing anything; question added to `checked`.
- **Card:** BE-16. **Contract:** missing.

### BJ-14 `getResult(userId, attemptId)` -> `GET /api/bijak/attempts/:id/result`

- **Purpose:** the result page with full schemes (after submit only).
- **Maps to endpoint:** BE-16 `GET /bijak/attempts/:id/result` -> `{ data: ResultView }`.
- **Output:** `ResultView` = `{ attempt, result: AttemptResult, paper: AttemptPaperView (with checks = []) }`.
- **Errors:** `not_submitted` "Skema hanya didedahkan selepas Hantar" (the card maps it to 409; also described as 403 `not_submitted` in the card text: OQ-API-B2-16); `not_found`; `forbidden`.
- **Side effects:** `sweep()` first (may close an expired attempt so a result exists).
- **Card:** BE-16. **Contract:** missing.

### BJ-15 `history(userId)` -> `GET /api/bijak/history`

- **Purpose:** the caller's attempts, newest first.
- **Maps to endpoint:** BE-16 `GET /bijak/history` -> `{ data: HistoryRow[] }`.
- **Output:** `HistoryRow` = `{ attemptId, title, subject, subjectName, kertas, kind:'pilihan'|'jana', mode, status:'in_progress'|'submitted'|'auto_submitted'|'abandoned', startedAt, durationSeconds (max(0, round((submittedAt ?? now) - startedAt))), score?, max? }`. No pagination in the mock (unbounded list).
- **Errors:** `offline` only. **Side effects:** `sweep()` first.
- **Card:** BE-16. **Contract:** missing.

### BJ-16 `serverNow()` -> embedded in the attempt view (no own endpoint)

- **Purpose:** the server clock used by the exam timer.
- **Maps to endpoint:** BE-16 returns `serverNow` inside `GET /bijak/attempts/:id` so the UI can sync; the mock's `AttemptPaperView` does **not** contain it. **Endpoint field not yet defined in the mock shape** (OQ-API-B2-13).
- **Card:** BE-16 (AC-2). **Contract:** missing.

### Test and debug hooks (not operations)

`setOffline(bool)`, `reload()`, `debugSaved(attemptId)` exist only for tests; `BijakError('offline')` is a client-side condition and has no server counterpart.

### Card endpoints with no method in `BijakServer` (card-only, shapes not in the mock)

| Card | Method and path (relative to `/api`) | Status vs mock |
|---|---|---|
| BE-16 | `POST /bijak/attempts/:id/photos` (multipart via BE-04, `purpose=bijak_photo`, field `partId`) -> `201 { data: PhotoMeta }` | endpoint not yet defined in the mock: photos are kept on the device (`lib/photo-store.ts`); `PartAnswer.photos` holds `{key,name,size}` metadata only |
| BE-15 | `GET /admin/bijak/papers` (proposed, read-only paper list) | none |
| BE-39 | `GET/POST /admin/papers`, `GET/PUT/DELETE /admin/papers/:id`, `PUT /admin/papers/:id/sections`, `PUT /admin/papers/:id/placements`, `GET /admin/papers/:id/conformance`, `POST /admin/papers/:id/publish`, `POST /admin/papers/:id/withdraw`, `GET/POST /admin/blueprints`, `GET /admin/blueprints/:id`, `POST /admin/blueprints/:id/versions`, `POST /admin/blueprints/:id/retire` (Admin Pusat only, indicative, "final paths from the contract commit") | none in this snapshot (see section 11) |

## 11. Admin SPM question intake (D52)

**Source and status.** This section documents code that is **not in this branch**. The source is local commit `b2e1033` ("feat(v2-question-bank): admin SPM question intake") on branch `feature/student-prototype`, read with `git show b2e1033:<path>` (read-only; nothing was checked out). It is not pushed and not merged into `feature/v2-backend`. The file paths below (`src/modules/m28-bijak-spm/admin/intake/**`, `routes/admin-intake.ts`, the intake methods in `server/store.ts`, `__tests__/intake.test.ts`, `docs/adr/0019-ai-provider-agnostic-extraction.md`) **will exist on `feature/v2-backend` only after the LEAD merges that commit**. Like the rest of M28, the intake has **no HTTP routes**: it is methods of `BijakServer` plus a client-side OCR step and an extractor interface. The frontend routes (vue-router, not API) are `/admin/spm/soalan` (list), `/admin/spm/soalan/muat-naik` (upload) and `/admin/spm/soalan/:batchId` (review), `roles: ['admin']`. Cards: BE-36 (AI service), BE-37 (files, OCR, jobs), BE-38 (batches, review, accept), BE-39 (builder, section 10), BE-40 (dashboard). Their paths are "indicative" (cards re-read on disk 2026-10-19). Contract status of every operation: **missing**.

Shared facts:

- Operations take no role argument; the mock relies on the admin-only frontend route. The cards: Guru for own batches, Admin Pusat for all (BE-37/38), Admin Pusat only for `/ai/*` and the dashboard.
- Errors reuse `BijakError(code, message)` (section 10): `not_found` maps to 404, `bad_request` to 400/422.
- Times are epoch ms (`createdAt`, `updatedAt`, `submittedAt`); ids are `ek-<seq>` (seeded demo `ek-demo-1`); same issue as OQ-API-B2-13.
- Mock status model: `IntakeStatus = 'draf' | 'semakan'` only. Cards: batch status `Dihantar / Sedang diproses / Sedia untuk semakan / Gagal`, item state `generated / needs_review / accepted / rejected / duplicate` (OQ-API-B2-23).
- **Types** (`admin/intake/types.ts`): `PageText {page, text, source:'text-layer'|'ocr', confidence?:0..100}`; `PageImage {page, dataUrl, width, height}` (browser memory only, never sent to the store); `IntakeQuestion {id, label (printed number), type:'mcq'|'structured'|'short'|'essay', stem, options:McqOption[], marks, mode:LeafKind, parts: IntakePart[] ({id,label,prompt,marks,mode,scheme?:SchemeDef}), scheme?:SchemeDef, tag:CurriculumTag, stimulusId?, page, lowFields:string[], confirmed:string[], needsManual?}`; `IntakeStimulus = StimulusDef + page?`; `ExtractedPaper {provider, model, questions, stimuli, unmatched:string[], warnings:string[]}`; `IntakeMeta {subject, kertas:1|2, year, paperType, source, copyright, notes, fileName, fileHash, pageCount}`; `IntakeBatch = IntakeMeta + {id, userId, status, createdAt, updatedAt, submittedAt?, provider, model, questions, stimuli, unmatched, pages}`; `IntakeSummary {id, title ("<Subject> Kertas <k> <year>"), subject, subjectName, kertas, year, status, fileName, questionCount, groupCount, lowCount (low-confidence fields not yet confirmed), marks, updatedAt}`; `IntakeIssue {questionId?, where, message}`; `SaveExtractedPayload {questions, stimuli}`. `SchemeDef`, `LeafKind`, `StimulusDef`, `CurriculumTag` are the Bijak types of `domain/types.ts`. Option lists: `PAPER_TYPES` = Percubaan SPM, Soalan Umum, Peperiksaan Sebenar, Buku Latihan, Lain-lain; `COPYRIGHT_OPTIONS` = `sendiri` "Milik sendiri / sekolah", `rasmi` "Kertas rasmi KPM / LPM", `pihak-ketiga` "Pihak ketiga / komersial".

| ID | Mock operation | Target endpoint (card, indicative) | Card |
|---|---|---|---|
| IN-01 | `listIntakeBatches(filter)` | `GET /api/intake/batches` | BE-37 |
| IN-02 | `getIntakeBatch(id)` | `GET /api/intake/batches/:id` + `GET /api/intake/items` | BE-37, BE-38 |
| IN-03 | `createIntakeBatch(userId, meta, extracted, pages)` | `POST /api/intake/batches` + `POST /api/intake/batches/:id/files` + `POST /api/intake/batches/:id/extract` | BE-37, BE-38 |
| IN-04 | `saveExtracted(id, payload)` | `PATCH /api/intake/items/:id` (per item); whole-batch replace: **endpoint not yet defined** | BE-38 (partial) |
| IN-05 | `submitForReview(id)` | **endpoint not yet defined** (card: "submit-for-review hooks into BE-10") | none |
| IN-06 | `validateBatch(batch)` (quality gate) | rules inside BE-38 accept and BE-10 submit; **no endpoint of its own** | BE-38 AC-4, BE-10 |
| IN-07 | `readPaper(file)` / `checkFile(file)` (browser OCR) | server OCR as jobs: `POST /api/intake/batches/:id/files` | BE-37 |
| IN-08 | `QuestionExtractor.extract(input)` + registry | in-process, **no public endpoint**; `GET /api/ai/status`, `POST /api/ai/test` | BE-36 |
| IN-09 | DSKP units (`unitsFor`, `unitByCode`, `guessUnit`) | **endpoint not yet defined** (curriculum, BE-08) | none |
| IN-10 | `demoBatch(now)` seed | seed only (BE-26 "may seed one finished intake batch") | BE-26 |

### IN-01 `listIntakeBatches(filter)` -> `GET /api/intake/batches`

- **Input:** `{ status?:'draf'|'semakan', subject?:SubjectCode, q?:string }`; `q` is a case-insensitive contains on `fileName`. **Output:** `IntakeSummary[]`, newest `updatedAt` first, unpaged. No role scoping in the mock (all batches).
- **Mapping:** BE-37 `GET /intake/batches` (status model differs, per-file progress is new; BE-38 lists `GET /intake/items` with filters status, batch, subject, uploader, confidence band, duplicate flag). No pagination in the mock (OQ-API-B2-24).
- **Side effects:** the first intake call seeds the demo batch `ek-demo-1` into the store. **Contract:** missing.

### IN-02 `getIntakeBatch(id)` -> `GET /api/intake/batches/:id`

- **Output:** a deep copy of the whole `IntakeBatch` (every question, stimulus, `unmatched` and the extracted page text `pages`). **Errors:** `not_found` "Kumpulan ekstrak tidak ditemui".
- **Mapping:** BE-37 `GET /intake/batches/:id` (status and file progress) plus BE-38 `GET /intake/items` and `GET /intake/items/:id` for the review content. The cards split the batch into items; the mock returns one document (OQ-API-B2-23). Page images: the mock keeps them in the browser; the cards serve them with `GET /intake/files/:id/pages/:n/image` and figures with `GET /intake/figures/:id/image`. **Card:** BE-37, BE-38. **Contract:** missing.

### IN-03 `createIntakeBatch(userId, meta, extracted, pages)` -> batch + files + extract

- **Input:** `IntakeMeta` (the declaration), the `ExtractedPaper` already produced in the browser, and the `PageText[]`. **Output:** the created `IntakeBatch` (`status:'draf'`, `id` = `ek-<seq>`, `provider`/`model` copied from `extracted`, `createdAt = updatedAt = now`). No validation in the store (the upload page validates the file and the meta).
- **Mapping:** BE-37 `POST /intake/batches` takes the declaration (paper type, subject, level, year, source declaration, notes); `POST /intake/batches/:id/files` uploads files (limit `INTAKE_MAX_FILE_MB`, 20 by default); BE-38 `POST /intake/batches/:id/extract` runs extraction server-side (idempotent; a file hash already imported is refused before any cost). In the mock the browser does OCR and extraction and posts the result; in the target the server does both, so the request body of this operation does **not** survive. The mock stores `fileHash` (SHA-256 computed in the browser) and does not check duplicates. **Card:** BE-37, BE-38. **Contract:** missing.

### IN-04 `saveExtracted(id, payload)` -> `PATCH /api/intake/items/:id` (partial)

- **Input:** `SaveExtractedPayload {questions, stimuli}` (the full edited content). **Output:** the updated `IntakeBatch` (`updatedAt = now`).
- **Errors:** `not_found` "Kumpulan ekstrak tidak ditemui"; `bad_request` "Kumpulan sudah dihantar untuk semakan" (batch not `draf`: read-only under review).
- **Mapping:** BE-38 `PATCH /intake/items/:id` edits one item and keeps the previous AI text in `intake_item_events`. The mock replaces all questions and stimuli of the batch in one call (including stimulus grouping, scheme editor and confirmed low-confidence fields). A batch-level replace and stimulus-group endpoints are **endpoint not yet defined** (OQ-API-B2-25). **Card:** BE-38. **Contract:** missing.

### IN-05 `submitForReview(id)` -> endpoint not yet defined

- **Purpose:** batch `draf` to `semakan` after the quality gate; "the quality gate runs here too, so the UI cannot bypass it (E9)".
- **Output:** `{ ok:true, batch }` (status `semakan`, `submittedAt = updatedAt = now`) or `{ ok:false, issues: IntakeIssue[] }` (nothing changes). **Errors:** `not_found` "Kumpulan ekstrak tidak ditemui"; `bad_request` "Kumpulan sudah dihantar untuk semakan".
- **Mapping:** none. BE-38 creates Draf questions through accept (`POST /intake/items/:id/accept`, per item) and states that submit/approve/publish "use the BE-10 endpoints; do not duplicate them here". No card has a batch-level submit (OQ-API-B2-26). **Card:** none. **Contract:** missing.

### IN-06 `validateBatch(batch)` (quality gate, `domain/validation.ts`) -> no own endpoint

Pure function used by the UI (live list) and by IN-05; returns `IntakeIssue[]`. Messages (verbatim; `where` = "Soalan <label>" plus the part label, or "Kertas"):

- Batch: "Tiada soalan. Tambah sekurang-kurangnya satu soalan."; "Pengisytiharan sumber diperlukan."; "Status hak cipta diperlukan."
- Each question: "Teks soalan kosong."; "Soalan ini perlu disemak manual. Tandakan selesai disemak." (`needsManual`); tags: "Subjek dan tingkatan perlu ditetapkan.", "Unit DSKP belum dipilih." (unit null unless `formOrigin` is `T1-T3`), "Standard Pembelajaran (SP) belum dipilih.", "Tahap Penguasaan (TP) mesti antara 1 dan 6."; an unconfirmed low-confidence field: "Medan keyakinan rendah belum disahkan: <name>." (names: `tag.unit` "unit DSKP", `tag.sp` "SP", `marks` "markah", `stem` "teks soalan", `scheme` "skema"); "Rajah / petikan yang dirujuk tidak wujud."
- MCQ: "Soalan objektif perlu sekurang-kurangnya 2 pilihan."; "Ada pilihan jawapan yang kosong."; "Kunci jawapan belum dipilih."; "Markah mesti lebih daripada 0."
- Structured (parts): "Teks bahagian kosong."; "Markah mesti lebih daripada 0."; "Skema pemarkahan tiada."; "Jumlah markah skema (<n>) tidak sama dengan markah bahagian (<m>)."; "Ada mata skema tanpa penerangan."; "Jumlah markah soalan ialah 0."
- Question without parts: "Markah mesti lebih daripada 0."; "Skema pemarkahan tiada."; "Jumlah markah skema (<n>) tidak sama dengan markah soalan (<m>)."
- Groups and stimuli: "Soalan dalam satu kumpulan mesti berturutan." (`where` = stimulus label); "Teks alternatif (alt) bagi rajah diperlukan."

**Mapping:** BE-38 AC-4 enforces "tags valid against the taxonomy, marks total equals sum of part marks, figure references resolve" on accept/submit; BE-10 owns the gates. The rule list above is the behavioural spec to port into the shared rules (OQ-API-B2-27). **Card:** BE-38, BE-10. **Contract:** missing.

### IN-07 `readPaper(file, onProgress)` / `checkFile(file)` (browser OCR, `lib/ocr.ts`) -> server OCR

- **Input:** a `File`. `checkFile` returns a BM message or null: unsupported type (allowed `application/pdf`, `image/png`, `image/jpeg`) "Jenis fail tidak disokong. Gunakan PDF, PNG atau JPG."; larger than 20 MB "Fail melebihi had 20 MB.". **Output:** `{ pages: PageText[], images: PageImage[], fileHash }`.
- **Behaviour to reproduce server-side:** PDF text layer via `pdfjs-dist` (text items grouped into lines by baseline within 2 units, top-down then left-right); a page with fewer than 20 text characters is treated as a scan: rendered (scale 2, else 1.1) to JPEG quality 0.6 and read with `tesseract.js` languages `msa` + `eng`, storing the mean `confidence`; image files go straight to OCR; progress phases `baca`, `imej`, `ocr`; aborting raises "Dibatalkan". Page text is kept; images are not stored.
- **Mapping:** BE-37 does this as durable jobs behind `POST /intake/batches/:id/files` (`OCR_MAX_PAGES`, `OCR_WORKERS`, `OCR_PAGE_TIMEOUT_MS`, `INTAKE_MAX_FILE_MB`), progress through `GET /intake/batches/:id`, cancel `POST /intake/batches/:id/cancel`. BE-37 requires BM rejection messages but does not list them; the two above are the only ones in the mock (OQ-API-B2-28). **Card:** BE-37. **Contract:** missing.

### IN-08 `QuestionExtractor` interface and provider registry (`ai/*`, ADR 0019) -> BE-36 (in-process)

- **Interface:** `QuestionExtractor { readonly id, readonly label, extract(input: ExtractInput): Promise<ExtractedPaper> }` with `ExtractInput {pages: PageText[], images?: PageImage[], subject, kertas:1|2}`. Output `ExtractedPaper` as above (drafts only; per-field confidence is expressed as `lowFields`; `unmatched` lists scheme entries with no question, e.g. "Jawapan <a>-<b>", "Skema <n><part>"; `warnings`, e.g. "Tiada soalan dikesan dalam teks kertas.").
- **Registry:** provider ids `mock`, `anthropic`, `openai`, `gemini`, `openai-compatible`; config from `VITE_AI_PROVIDER` (default `mock`), `VITE_AI_MODEL`, `VITE_AI_BASE_URL` (frontend names only; the server uses `AI_PROVIDER`, `AI_MODEL`, `AI_BASE_URL`, `AI_API_KEY`, plan 15.3). An unknown id throws "Penyedia AI tidak dikenali: <id>" (no fallback). The four real providers are stubs that reject with "Dikonfigurasi di pelayan".
- **Mock extractor** (`provider:'mock'`, `model:'heuristik-1'`): heuristic parsing of question numbers, options, parts, `[n markah]`, Rajah/Jadual/Petikan groups, K/N/P/B/M/F/C scheme lines and "mana-mana N"; sets `needsManual` when there is no stem and no parts; adds `tag.unit` or `tag.sp` to `lowFields` when unsure, and `marks` when a non-MCQ question without parts has no marks. The BE-36 mock adapter must be deterministic and produce this output shape.
- **Mapping:** BE-36: extraction "is invoked in-process by the intake worker (BE-38), not by a public endpoint". Admin endpoints in the card: `GET /ai/status` (provider, model, configured yes/no, month-to-date cost, budget), `GET /ai/usage`, `PUT /ai/settings`, `POST /ai/test`. The mock has none of them (no cost, usage or budget), so their shapes are **not yet defined** (OQ-API-B2-29). The mock also masks no personal data; the card requires redaction before every provider call (ADR 0019 point 3). **Card:** BE-36. **Contract:** missing.

### IN-09 DSKP units (`lib/dskp.ts`) -> endpoint not yet defined

Stand-in for the DSKP list: 12 prototype units `{code, label, subject, form:'T4'|'T5', keywords[]}` (for example `MAT-T4-02` "Asas Nombor"; the codes are not official). Functions: `unitsFor(subject)`, `unitByCode(code)`, `guessUnit(subject, text)` (first unit whose keyword occurs in the lower-cased text), `emptyTag(subject)` (`level 'T4+T5'`, `tp 3`), `tagWithUnit(tag, unit)` (sets `unit`, `unitLabel`, `level`, `formOrigin` from the unit). Free-text units are not accepted (AC-05.2). The target is the M03 curriculum tree (BE-08, `curriculum_nodes`); BE-36 to BE-40 define no lookup endpoint. The existing M04 DSKP cascade (M04-28 to M04-30: bidang, SK, SP) has a different shape (OQ-API-B2-30). **Card:** none. **Contract:** missing.

### IN-10 `demoBatch(now)` -> seed

Builds batch `ek-demo-1` (subject MAT, kertas 2, year 2025, paper type "Percubaan SPM", source "Kertas contoh fiksyen untuk demo", copyright `sendiri`, file `kertas-contoh-mat-k2.pdf`, hash `demo-seed`, status `draf`) from a fictional sample paper, seeded into the store on the first intake call. Target: BE-26 may seed one finished batch produced by the mock provider.

### Card endpoints with no mock counterpart

`POST /intake/batches/:id/cancel`, `GET /intake/files/:id/pages/:n/image` (and `/thumb`), `GET /intake/figures/:id/image`, `GET /intake/items`, `GET /intake/items/:id`, `POST /intake/items/:id/accept|reject|duplicate`, `POST /intake/items/bulk`, `GET /intake/dashboard`, `GET /intake/dashboard/cost`, `GET /ai/usage`, `PUT /ai/settings`: the mock has no accept/reject/duplicate/bulk, no duplicate detection, no figure crops (stimuli are SVG or text, `StimulusDef`), no dashboard, no cost or budget. Their shapes are defined by the cards only. The paper builder and blueprint admin endpoints (BE-39) are listed in section 10; the mock has no builder method either.

## 12. Uncovered endpoints

No backend card defines these routes (checked against cards BE-09, BE-10, BE-12, BE-13, BE-14, BE-15, BE-16, BE-36 to BE-40, the cards' README and a text search of all other cards for the paths). 52 of the 99 HTTP routes are uncovered.

**Uncovered although the module has a card (gaps inside covered areas), 6:**

| ID | Endpoint | Why it matters | Suggested owner |
|---|---|---|---|
| M04-14 | `PATCH /api/question-submissions/:id/status` | BE-10 lists only the GET queue; admins cannot change a paper's status without it | BE-10 |
| M04-15 | `GET /api/question-submissions/:id/files/:index` | file download of an uploaded paper | BE-10 with BE-04 |
| M04-23 | `POST /api/diagram-audit/:kind/:id/dismiss` | BE-10 lists only GET and POST image | BE-10 |
| M04-25 | `POST /api/master-notes/:id/:action` | BE-10 lists only the GET | BE-10 (AI part stays a stub) |
| M04-27 | `GET /api/structured-questions/:id` | BE-09 lists the structured list only | BE-09 |
| M05-23 | `GET /api/remedial-tests/:id` | BE-13 lists `/mine` only; teacher/admin preview | BE-13 or BE-18 |

**Uncovered because the whole module is a Wave 4+ backlog item (README "Wave 4+ backlog"):**

- M06 SPM classic, 14 routes: M06-01 to M06-14 (`/api/spm/*`, `/api/spm-mocks*`, `/api/spm-walkthrough/solve`, `/api/duta/recommendations`). Decision OD-11 (Bijak SPM replaces most of it) is open.
- M07 PKSK, 21 routes: M07-01 to M07-21 (`/api/pksk/*`, `/api/pksk-domains`, `/api/pksk-packages`, `/api/admin/pksk-*`). Direction in v2: PKSK becomes tags on the one bank (`v2-question-bank` A6).
- M13 Cikgu Alesa, 10 routes: M13-01 to M13-10 (`/api/cikgu/*`). External AI is out of B1 (OD-7).
- M25 AI Centre, 1 route: M25-01 `GET /api/buku-nota/heatmap`.

**Bijak SPM and intake (not HTTP routes in the mock):**

- BJ-04 `subjects()`: **endpoint not yet defined** (no card path).
- BJ-16 `serverNow()`: the card embeds `serverNow` in the attempt view; the mock shape has no such field.
- Photo upload (`POST /bijak/attempts/:id/photos`) has a card path but no mock method.
- Intake (section 11, source commit b2e1033): IN-05 submit-for-review and IN-09 DSKP lookup have no card endpoint; the batch-level replace of IN-04 has none; cards BE-37..BE-40 list many endpoints with no mock counterpart (accept/reject/duplicate, dashboard, AI usage, image serving).

## 13. Open questions

Each question names the owner who should answer. IDs are stable.

| ID | Question | Where | Suggested owner |
|---|---|---|---|
| OQ-API-B2-1 | Ids are numbers in the M04/M05/M06/M07/M13/M25 mock (`QuestionRow.id`, `subjectId`, `chapterId`, report/mock/RPH ids, query params such as `?subjectId=3`) but the contract makes ids opaque strings (`IdSchema`, plan 6.1) and the migration realign tasks (V2-T09, V2-T24) say "move to string". Does the frontend types change in the same switch, and are query params also strings? Session ids (M05) and attempt ids (Bijak) are strings already. | all sections | Lead (frontend realign) + card owners |
| OQ-API-B2-2 | The M04 mock is the flat objective model (`options[4]`, `correctAnswer 0..3`, one answer, statuses `draft|pending_review|approved|rejected|archived|pending`), whereas BE-09 builds the part-tree model of `v2-exam-schema.md` and the lifecycle `Draf, Semakan, Lulus, Terbit, Diarkib`. Which wire do `GET/POST/PUT /api/questions*` use after BE-09: the mock shape (mapped onto the new tables) or a new shape with a frontend change? M04-27 structured detail and the M05/M06 reads of structured questions depend on the same answer. | section 4 | Lead + BE-09 owner |
| OQ-API-B2-3 | `POST /api/questions/bulk-action` and `POST /api/questions` accept any status change, and create saves `approved` (admin) or `draft` (CSV import); BE-10 AC-1 requires only the allowed transitions (409 otherwise), "only Admin Pusat approves and publishes" (D40a) and quality gates. Which behaviour is the contract: keep the mock (any admin transition) or enforce BE-10? Also: should `bulk-action` write status events? | M04-03, M04-07 | BE-10 owner |
| OQ-API-B2-4 | The TS type `ReportSource` lists `quiz` and `papan_bijak`, but `POST /api/question-reports` rejects every source except `spm, structured_attempt, latihan, revision, teacher_databank` ("Sumber laporan tidak sah."). Which set is correct? BE-10 AC-3 says a duplicate open report is handled "as the mock does": the mock does nothing special (no duplicate check). Confirm. | M04-10 | BE-10 owner |
| OQ-API-B2-5 | Routes without a card: M04-14, M04-15, M04-23, M04-25, M04-27, M05-23 (section 12). Add them to BE-09/BE-10/BE-13 (or BE-18)? | section 12 | Lead |
| OQ-API-B2-6 | M05 routes are `requireAuth()` only (any role, including parent/sponsor/teacher); the matrix gives practice to Murid, and teachers use only S4 chapter lists and previews. Should the backend add role guards (student for session endpoints, teacher/admin for remedial preview) or keep "any session"? Also the 402 trial rule: `TrialStatus.limit` is the constant 50 (provisional M19 rule); confirm for BE-12 + BE-25 (`isSubscribed`). | section 5 | BE-12 and BE-25 owners |
| OQ-API-B2-7 | Card BE-12/BE-13 and the mock differ: check-answer body `{questionId, optionId}` (card) vs `{questionId, selectedOptionId}` (mock/client); `clientUuid` idempotency and the `409` on a second submit (card; the mock has the 409 `ALREADY_SUBMITTED` but no `clientUuid`); structured attempt path `/api/practice/structured/:id/attempt` (card) vs `/attempts` (mock/client); submit response `{ results:{ score, total, gamification } }` (mock). The card says "keep the mock's path strings"; confirm these four. | M05-01 to M05-03, M05-18 | BE-12 and BE-13 owner |
| OQ-API-B2-8 | `GET /api/spm-targets` returns progress (`answered`, `accuracyPct`, `band`, `predictedGrade`) only when a **test fixture** (`mock.setSpmProgress`) set it; the live source is UNVERIFIED (BR-27). In the real backend what feeds it: the answer log by subject (M05), and with which accuracy window? Grade floors are INFERRED. | M05-19 | Lead (product) |
| OQ-API-B2-9 | Route counts differ from the plan: M04 30 vs 25, M05 23 vs 20, M06 14 vs 11, M07 21 vs 16, M13 10 vs 8. Update plan section 6.3 and the README backlog. For M06: confirm OD-11 (is M06 retired in favour of Bijak SPM?) and how the hub constants `HUB_TOTAL_QUESTIONS`, `HUB_POOL_CHIP` and `TRACKING_YEAR = 2026` are produced. | section 1, 6 | Lead |
| OQ-API-B2-10 | PKSK in v2 becomes tags on the single bank (A6), yet the 21 M07 routes use their own admin question CRUD and an M05 session of mode `pksk`. Keep these routes (served by BE-09 data with PKSK tags) or redesign? Also the PKSK access model (`pksk_access` grants, packages `T1|T4|ALL`) overlaps BE-25 subscriptions; `GET /api/pksk-packages` is "M19-owned". | section 7 | Lead + BE-25 owner |
| OQ-API-B2-11 | M13 Cikgu Alesa (chat, RPH, essay marking, PBD tags) and M25 heatmap are backlog (external AI out of B1, OD-7). Should B1 ship them as stubs with canned replies, or keep the frontend on the mock for these prefixes (hybrid mode)? The chat endpoint also returns a **non-enveloped** snake_case body (`thread_id`, `turns_remaining`, `quota_exhausted`) and `401 {}` / `422 {}`; the contract needs an explicit exception. | sections 8, 9 | Lead |
| OQ-API-B2-12 | Bijak endpoints: which roles may call `/api/bijak/*`? Cards say student; matrix KS-06 "Bijak SPM (Simulasi)" is Admin Pusat F (preview). The `BijakServer` has no role concept (only `userId`). Writes made by an admin in "Mod Pelajar" are stamped `is_test` (BE-16 AC-9). | section 10 | BE-15 and BE-16 owner |
| OQ-API-B2-13 | Bijak times are epoch milliseconds (`startedAt`, `deadline`, `savedAt`, `submittedAt`, history `startedAt`) and `PartAnswer`/`StoredAnswer` carry `savedAt` numbers; the contract serialises instants as `+08:00` strings (X3). Which side changes? Also `serverNow` (BE-16) is not in the mock `AttemptPaperView`; add it to the view or keep `serverNow()` as a separate call? The mock `submit` also returns `late` in seconds. | section 10 | Lead + BE-16 owner |
| OQ-API-B2-14 | The Bijak result carries `coins = score*2` and `points = score*10` but the mock writes no wallet. BE-16 says credit the wallet "only if the mock credits". Confirm no wallet credit in B1 (display values only) or define the rule (idempotent per attempt). | BJ-10, BJ-14 | Lead + BE-11 owner |
| OQ-API-B2-15 | `BijakServer.subjects()` (the subject dictionary, open dictionary D9) has no endpoint. Reuse `GET /api/subjects` (M03/BE-08) with a Bijak flag, or add `GET /api/bijak/subjects`? | BJ-04 | BE-15 and BE-08 owners |
| OQ-API-B2-16 | `getResult` before submit: mock `not_submitted` ("Skema hanya didedahkan selepas Hantar"); card text says both "409/403 `not_submitted`" and error mapping `not_submitted` 409. Pick 409. The same message is used for `forbidden` when "Semak" is called in exam mode (403). | BJ-13, BJ-14 | BE-16 owner |
| OQ-API-B2-17 | Intake code is in commit b2e1033 (feature/student-prototype), not in this branch; after the LEAD merges it, re-check line references in section 11 and re-verify against the merged code. | section 11 | Lead |
| OQ-API-B2-18 | The generic error messages in the mock are English Laravel defaults ("Unauthenticated.", "This action is unauthorized.", "Not Found."), while the contract states `message` is BM for direct display; M04/M05/M06/M07 domain errors are already BM. Provide BM defaults in the API (and confirm that the frontend shows its own SRS copy for 401/403/404)? | all | Lead + contract owner |
| OQ-API-B2-19 | Mutations answer `{ data, status:'<BM flash>' }` (E3). `status` is outside the contract envelope. Add an optional `status` (flash) to the envelope schemas, or return flash text separately? Several clients read it with `raw: true`. | M04, M05, M07 | Lead |
| OQ-API-B2-20 | Several endpoints return bare arrays inside `data` (M07-02, M07-04, M07-06, M07-21; M06-02, M06-08) or RAW bare arrays (M04-28 to M04-30 DSKP cascade, `{ok}`, `{success,message}`). The contract must model these exactly (`listEnvelopeOf` does not cover them). | M04, M06, M07 | contract owner (BE-03/BE-31) |
| OQ-API-B2-21 | BE-09 lists `GET /api/guru/questions`, `POST /api/guru/questions` and BE-10 lists `/api/guru/questions/import` and `/template`: these are **M10** mock routes (`src/modules/m10-teacher-class/mock/handlers/questions.ts`), not M04; they belong to the M10 part of this catalogue. DSKP lookups M04-28 to M04-30 are M10-owned data registered by M04. Confirm ownership to avoid two implementations. | M04 | Lead |
| OQ-API-B2-22 | Simulated uploads: the mock keeps only metadata and a `blob:mock/...` reference (question images, option images, diagram images, CSV). Real endpoints need BE-04 FileStorage (types, 2 MB / 5 MB limits, magic-byte checks) and a decision on whether question create/update stay multipart with the file inline or switch to a two-step upload. | M04-03, M04-05, M04-16, M04-22 | BE-04 and BE-09 owners |

| OQ-API-B2-23 | Intake status model: mock batch `draf`/`semakan` and one document per batch (questions inside); cards BE-37/38 use batch status Dihantar / Sedang diproses / Sedia untuk semakan / Gagal plus per-item states `generated / needs_review / accepted / rejected / duplicate`. Which shape does the frontend get after the switch (frontend change or adapter)? | IN-02, IN-03 | Lead + BE-38 owner |
| OQ-API-B2-24 | `listIntakeBatches` is unpaged and not scoped by owner; BE-37/38 require Guru-own vs Admin Pusat-all scoping and (for items) filters. Define list meta and filters. | IN-01 | BE-37 owner |
| OQ-API-B2-25 | The review UI saves the whole edited batch (questions, stimuli, stimulus groups, scheme edits, confirmed low-confidence fields) in one call; BE-38 offers only item-level `PATCH`. Add a batch-level save or change the UI to per-item saves? Stimulus groups (stimuli stored once on the batch) have no card endpoint. | IN-04 | Lead + BE-38 owner |
| OQ-API-B2-26 | No card defines batch-level "Hantar untuk semakan" (mock `submitForReview`, Draf to Semakan). BE-38 accept creates Draf questions and BE-10 owns submit. Define the endpoint(s) and whether the quality gate (IN-06) runs per question or per batch. | IN-05 | BE-38 and BE-10 owners |
| OQ-API-B2-27 | The quality-gate rule list and BM messages (IN-06) are not in any card; decide where they live (shared rules package vs questions service) so UI and API cannot diverge. | IN-06 | BE-38 owner |
| OQ-API-B2-28 | Server-side file/OCR rejection messages: the mock has "Jenis fail tidak disokong. Gunakan PDF, PNG atau JPG." and "Fail melebihi had 20 MB."; BE-37 needs more (magic bytes, page cap, encrypted/corrupt PDF, timeout). Provide the BM copy. | IN-07 | BE-37 owner |
| OQ-API-B2-29 | `/ai/status`, `/ai/usage`, `/ai/settings`, `/ai/test` and `/intake/dashboard*` have no frontend mock; the response shapes must be authored in the contract first. The extractor interface (`ExtractInput`/`ExtractedPaper`) is the only AI wire known. | IN-08 | BE-36 and BE-40 owners |
| OQ-API-B2-30 | Intake DSKP units (12 prototype units) vs the M04 DSKP cascade vs M03 `curriculum_nodes`: no endpoint is defined for the intake tag selector (unit, SP, TP). | IN-09 | BE-08 owner |
