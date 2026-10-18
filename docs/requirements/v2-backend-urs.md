# v2 Backend: User / System Requirements Specification (slug: v2-backend)

- **Status:** Draft for LEAD review (2026-10-19). Requirements only; no backend code exists yet.
- **Audience:** every PC and Claude Code session that builds the backend. Read the section of the domain you work on plus sections 5 to 8 (NFR, MIG, OPS) before your first card, then [../plan/backend-dev-guide.md](../plan/backend-dev-guide.md).
- **Sources:** [plan](../architecture/v2-backend-plan.md) (the design; sections 3, 6, 9 to 11, 13 to 15), [role-access-matrix](role-access-matrix.md), [v2-portals](v2-portals.md), [v2-question-bank](v2-question-bank.md), [v2-exam-schema](v2-exam-schema.md), [v2-bijak-spm](v2-bijak-spm.md), module URS/SRS in [urs/](urs/README.md) and [srs/](srs/README.md), [v2-data-migration](../architecture/v2-data-migration.md), `@pp/contract` (`packages/contract`).
- **Authority order:** `docs/TRACKER.md` decisions, then this file and the module SRS, then the plan and ADRs, then the card files, then code. The frontend mock is the behavioural spec (the rule of the plan, section 1); this file never restates module detail, it points to it.
- **Rule for unknowns:** a business rule that is not in the SRS, the mock or the contract is not invented. It goes to section 10 (Open questions) or to the PR description.

## 1. Purpose and scope

The backend replaces the in-browser mock behind the frontend `Transport` seam (ADR-0004), endpoint by endpoint, for release **B1** of the plan (section 2): the four prototype roles, the core learning loop, Bijak SPM, class and report flows, the SPM question intake and paper builder (D52), the migration pipeline from prestasiplus.cloud (read-only source), and container deployment (D50).

In scope: everything in plan section 2 "Goals". Out of scope (plan section 2 "Non-goals"): roles `ppd_officer`, `parent`, `sponsor` (schema columns only), marketplace, sponsorship, payments, e-mail/SMS/push delivery, AI features other than question-intake extraction, reloading exam questions from .cloud (D29a), changing UI behaviour, horizontal scaling. The wave 4 backlog (M06, M07, M13, M16, M18, M20, M21, M25, Sistem stores, Kewangan) is not specified here until a card exists.

## 2. Actors

Roles use the contract codes (`RoleCode`), not the older requirement keys (`admin_sekolah`, `pegawai_ppd`); see plan section 12.

| Actor | Contract code | In B1 | What it may do (summary; the matrix is the authority) |
|---|---|---|---|
| Murid (student) | `student` | yes | The 37 Murid rows of [role-access-matrix](role-access-matrix.md) (learning, wallet, Bijak SPM, own performance); own data only; never combines with another role. |
| Guru (teacher) | `teacher` | yes | The 15 Guru rows: own classes, own students, class reports, question contributions, own intake batches. |
| Admin Sekolah | `school_admin` | yes | The 18 Admin Sekolah rows: own school only (staff, students, reports, Command Center, Mod Pelajar). |
| Admin Pusat | `admin` | yes | Everything, including question approval/publication, curriculum, intake dashboard and AI usage; single-role (D48); Mod Pelajar. |
| Pegawai PPD/JPN | `ppd_officer` | no endpoints | Schema columns only (D43/D48). |
| Ibu Bapa, Penaja | `parent`, `sponsor` | no endpoints | Parent invite tokens and links are stored (BE-25); no parent endpoints. |
| Lead | n/a | process | Owns the contract `common/session/auth/access` folders, reviews and merges every PR, produces anonymised dumps (OD-18). |
| Migration operator | n/a | process | Runs the ETL CLI on a staging copy; only the lead touches real (anonymised) dumps. |
| AI provider, OCR engine | n/a | system | External or in-process systems behind adapters (BE-36, BE-37). |

Scope levels derived by the server: `national`, `state`, `district`, `school`, `class`, `self` (contract `ScopeLevel`). A client never sends scope.

## 3. Definitions

| Term | Meaning |
|---|---|
| Contract | `packages/contract` (`@pp/contract`): zod schemas, error codes, access matrix and the generated `openapi.json`. The wire spec. |
| Mock | The in-browser server under `src/mock/**` and `src/modules/*/mock/**`. The behavioural spec. |
| Card | A task file `docs/plan/backend-tasks/BE-nn-*.md`. One card = one branch = one PR. |
| Owner module | The single module that owns a store (ADR-0014); others call its service, never its tables. |
| Envelope | `{ data }`, `{ data, meta }` or `{ error }` as defined by the contract. |
| Scope filter | The request-scoped `ScopeContext` / `ScopeFilter` every repository must use (BE-03). |
| Mod Pelajar | "Pratonton sebagai Pelajar": an admin or school admin acts as a student with all writes stamped `is_test` (D33b, V2-T19). |
| Legacy columns | `legacy_source`, `legacy_id`, optional `legacy_hash` on migratable tables (plan 14.2). |
| BM | Bahasa Melayu. All user-visible messages are BM, copied exactly from the mock. |
| PDPA | Malaysia Personal Data Protection Act 2010. Most users are minors. |
| Verification codes | **UT** unit test; **IT** integration test (supertest + real PostgreSQL); **CT** contract/conformance test (response parsed by the contract schema, BE-31); **SEC** security review by the lead's `security-engineer` role (G4); **CI** a CI pipeline step; **RUN** runbook or rehearsal executed once with evidence; **PILOT** measured on a pilot sample set. |

## 4. Functional requirements (BE-FR)

Each row points to the module requirements; detail is **not** repeated. The cards list the exact endpoints, tables and acceptance criteria. Acceptance checks below are the minimum; a card may add more.

Every endpoint additionally satisfies BE-NFR-01 to BE-NFR-05 and BE-NFR-22 to BE-NFR-25 without being listed per row.

### 4.1 Identity and platform

| ID | Requirement | Cards | Source | Acceptance check |
|---|---|---|---|---|
| BE-FR-01 | The API shall implement the six session operations of the contract (login, logout, read session, switch role, enter and leave Mod Pelajar) with cookie session auth, CSRF header, role list with one active role, derived scope and capabilities, and the exact error codes of `AUTH_ERROR_CODES`. | BE-03 | M01 SRS; v2-portals US-01, US-05, US-08, US-16; contract `session/`, `auth/` | IT: one supertest per row of the BE-03 endpoint table; CT: every success body parses `SessionSchema`. |
| BE-FR-02 | Every endpoint shall be protected by role and capability guards derived from the contract access matrix, and every repository read or write shall be filtered by the request `ScopeContext`. | BE-03 and every domain card | [role-access-matrix](role-access-matrix.md); v2-portals US-03, US-05, US-06, US-12, US-13 | IT per route group: no session 401, wrong role 403, out-of-scope id 404; UT of guards reading the active role only. |
| BE-FR-03 | The API shall serve the M02 user and school management for Admin Pusat and Admin Sekolah: list and filters, detail, create, update, delete, toggle active, bulk delete, bulk import, school list/options/search/create, impersonation entry. | BE-05 | M02 URS/SRS | IT against the mock's M02 rules; scope tests (school admin sees own school only). |
| BE-FR-04 | The API shall persist school subscriptions and packages, user package assignment, parent invite tokens and parent-student links, complimentary students, and expose `isSubscribed` used by the practice trial rule. | BE-25 | M02 SRS; L45 URS/SRS | IT: subscription create/extend/upgrade/cancel rules; invite token expiry; `isSubscribed` unit test. |
| BE-FR-05 | The API shall provide the M01 account basics: self-registration, password reset (e-mail and IC variants), profile update, password change, picture upload, personal settings. Reset e-mail is logged, not sent (OD-7). | BE-06 | M01 URS/SRS | IT per flow including validation errors; reset token single-use test. |
| BE-FR-06 | The API shall provide the notification inbox (list, read marks) and an internal `pushNotification` service other modules call. | BE-06 | M01 SRS; M22 SRS | IT: inbox scope (own rows only); UT: service writes one row. |
| BE-FR-07 | The API shall provide a `FileStorage` abstraction with a local-volume implementation and an authenticated upload and download pipeline for avatars, Bijak working photos, question images and CMS images, including derived files for intake. | BE-04 | plan 3 "Files"; OD-6 | IT: BE-04 acceptance criteria 1 to 5 (type sniffing, 413, other user's photo 404, key without filename, persistence). |
| BE-FR-08 | The API shall own the curriculum store (levels, subjects, derived subject-levels, chapters, topics, subtopics, DSKP node tree) and serve the learner and admin M03 endpoints. | BE-08 | M03 URS/SRS; v2-exam-schema D9 | IT: seeded counts equal the mock seed counts; duplicate and validation rules match; non-admin POST 403. |
| BE-FR-09 | The API shall serve CMS content (articles, banners, videos, notes, Perutusan, screenshots, audio KBAT set listings) for learners and the admin screens. | BE-24 | M09 URS/SRS | IT per endpoint group; image upload via FileStorage. |
| BE-FR-10 | The API shall serve the support-ticket flow (learner create and list, admin queue, notify admins). | BE-24 | M22 URS/SRS | IT: ticket scope (own tickets only), admin queue, status transitions of the mock. |
| BE-FR-11 | The API shall own the v2 question store (question as ordered tree of parts, answer modes, answer-key kinds, mark-scheme points, stimuli, curriculum tags, lifecycle) and expose the owner repository and the question list, detail and CRUD endpoints. | BE-09 | M04 URS/SRS; v2-exam-schema; v2-question-bank 4.1 | IT: CRUD and eligibility; answer keys absent from learner responses; other modules reach questions only through the owner service (code review check). |
| BE-FR-12 | The API shall implement the question review lifecycle (Draf, Semakan, Lulus, Terbit, Diarkib) with audit, student question reports, teacher submissions, CSV import with templates, quality and diagram audits, DSKP source lookups, and the AI-explanation stub. | BE-10 | M04 SRS; v2-question-bank 4.5 to 4.8, D40a | IT: each transition and its role rule; quality gates reject invalid tags and mark totals. |
| BE-FR-13 | The API shall own wallet, append-only coin ledger with `balance_after`, tokens and the daily streak (Malaysia day), with idempotent credits and the student wallet reads. | BE-11 | M14 URS/SRS; OD-8 | IT: ledger sum equals balance; same idempotency key credits once; day boundary tests with a fixed clock at 23:59 and 00:00 +08:00. |
| BE-FR-14 | The API shall implement the practice write path (start, check answer, submit, history) with trial check, question selection, regrade, answer rows carrying curriculum dimensions, revision queue, mastery, wallet credit, quest rewards and streak in one transaction, idempotent by `clientUuid`. | BE-12 | M05 URS/SRS (BR-04..BR-31); ADR-0014 section 2; v2-data-migration 4.4 | IT: forced failure after step 4 leaves nothing; replay with the same `clientUuid` returns the same session; responses equal the mock on the fields in the mock tests. |
| BE-FR-15 | The API shall serve the M05 learner read models (dashboard, subjects, chapters, history, corrections, mastery, revision views, SPM targets, structured attempts) and topic progress derived on read from the answer log. | BE-13 | M05 SRS; M03 BR-19 | IT on seeded sessions; CT on every list. |
| BE-FR-16 | The API shall serve the gamification economy (challenges, achievements, token conversion, referral, tiers, draws, teacher economy, admin screens) and the rewards shop (rewards, claims, digital shop). | BE-23 | M14, M15 URS/SRS | IT: once-per-day claim rule, stock and balance checks, admin-only mutations. |
| BE-FR-17 | The marking and blueprint logic of Bijak SPM shall live in the shared package `@pp/exam-core` so the server marks exactly as the UI. | BE-14 | v2-bijak-spm; OD-5 | UT: the moved domain tests pass unchanged; frontend `npm run typecheck` and `npm test` stay green. |
| BE-FR-18 | The API shall persist papers, sections, placements and blueprints, and serve the paper list, paper cover, blueprint contracts and "Jana Kertas" generation with shortage reporting. | BE-15 | v2-bijak-spm; v2-exam-schema D5, D7 | IT on the three PoC papers; generation is deterministic for a given seed. |
| BE-FR-19 | The API shall run the Bijak attempt lifecycle server-side: start and resume, answer-key-free attempt view, autosave with revisions, offline late sync, server deadline and grace sweeper, idempotent submit, latihan "Semak" cap, marking with `@pp/exam-core`, results with reveal rules, history, working-photo upload. | BE-16 | v2-bijak-spm; v2-bijak-spm-limitations | IT: the mock server test scenarios re-expressed as supertest cases; recursive key-scan on every attempt response; two concurrent submits give one result. |
| BE-FR-20 | The API shall persist the admin paper builder and blueprint admin: draft papers, blueprint version choice, conformance and shortage report, publish only when every placed question is Terbit and the paper conforms. | BE-39 | v2-question-bank 4.5; v2-exam-schema D5, D7 | IT: publish refused on a non-Terbit placement; blueprint versions immutable once used. |
| BE-FR-21 | The API shall provide a provider-agnostic AI extraction service that returns drafts with per-field confidence and source region, suggests tags, records usage and enforces rate limit and budget, and has no approval right. | BE-36 | v2-question-bank NFR-03, NFR-04, AC-04.8, AC-05.6; plan 15.2 | IT: BE-36 acceptance criteria 1 to 9; contract test suite passes for the mock provider and, with recorded fixtures, for every adapter. |
| BE-FR-22 | The API shall accept paper uploads, store originals, render page images, run server OCR for scans, crop figures and run all of it as durable background jobs. | BE-37 | v2-question-bank 4.2; plan 15.2 "OCR", "Jobs" | IT: BE-37 acceptance criteria 1 to 8 (restart survival, bomb sample rejected, hash dedup). |
| BE-FR-23 | The API shall turn a batch into reviewable items, let reviewers edit, accept (creating a Draf question through the BE-09 service with provenance), reject or mark duplicates, with every transition audited and recoverable provider failures. | BE-38 | v2-question-bank 4.2, US-05, US-06, D40a | IT: end to end with the mock provider; AI cannot reach accept; re-extracting a known file hash refused before any provider call. |
| BE-FR-24 | The API shall serve the Admin Pusat intake dashboard and AI usage and budget data. | BE-40 | v2-question-bank US-29 | IT: counts equal the underlying rows for a seeded batch set; Guru and Murid 403. |
| BE-FR-25 | The API shall serve classrooms and enrolments (create, join by code, student lists, teacher dashboard counters, chapter and topic management) and the shared class lookups other modules read. | BE-17 | M10 URS/SRS | IT: join code rules; a teacher sees only own classes; student sees own enrolments. |
| BE-FR-26 | The API shall serve missions, remedial tests, teacher question sets and teacher DSKP picks that feed the practice assigned modes. | BE-18 | M10 SRS | IT: remedial generation from weak topics; assigned-mode sessions start via BE-12. |
| BE-FR-27 | The API shall serve the M08 performance read models (analytics, class, level and school performance, rankings, item analysis, headcount setup and entry, timeline, weekly report), scope-filtered. | BE-19 | M08 URS/SRS | IT: aggregates equal a hand-computed fixture; scope tests per role. |
| BE-FR-28 | The API shall serve teacher analytics, monitoring and the Kirkpatrick levels with feedback collection, intervention log, filter options and exports. | BE-20 | M11, M12 URS/SRS | IT: report counts equal source rows; export content type and filename. |
| BE-FR-29 | The API shall serve the M27 school-admin dashboards, usage and activity reports, DSKP heatmap, class list and own-school staff and student management. | BE-21 | M27 URS/SRS | IT: school B data invisible to school A admin (404). |
| BE-FR-30 | The API shall serve the Command Center and admin aggregates, answering for teacher (own classes), school admin (own school) and admin (all) from the same endpoints. | BE-22 | M17 URS/SRS; M10 Command Center | IT: same endpoint, three roles, three row sets. |
| BE-FR-31 | The service shall start from a documented skeleton: validated config, error filter, zod pipe, health endpoint reporting database state, transaction helper, clock, seed runner. | BE-01, BE-02 | plan 3, 4, 11 | IT: BE-01 and BE-02 acceptance criteria; `GET /api/health` returns 503 in the error shape when the database is down. |
| BE-FR-32 | The repository shall provide deterministic, idempotent, fictitious seeds: core accounts and population (D45, about 20 students) and a coherent cross-domain PoC profile. | BE-07, BE-26 (and each card's seed module) | `docs/AKAUN-DEMO.md`; D45 | IT: `be:db:seed` twice gives identical row counts; demo accounts log in; seed never sets `legacy_*`. |
| BE-FR-33 | All writes made under Mod Pelajar shall be stamped `is_test` and excluded from every aggregate and history seen by others. | BE-03, BE-12, BE-16, BE-19, BE-22 | v2-portals US-07; V2-T19; D33b | IT: a Mod Pelajar session writes a practice session; class and school aggregates are unchanged. |

## 5. Non-functional requirements (BE-NFR)

### 5.1 Security and authentication

| ID | Requirement | Cards | Source | Acceptance check |
|---|---|---|---|---|
| BE-NFR-01 | Authorisation shall be default-deny: a global `AuthGuard` applies to every route, public routes opt out explicitly, and a missing role or capability decorator on a protected controller fails a CI test. | BE-03, BE-33 | v2-portals NFR Security | IT: a route-inventory test lists all routes and asserts each has an auth rule; SEC. |
| BE-NFR-02 | Sessions shall be server-side in PostgreSQL; cookie `HttpOnly`, `Secure` (production), `SameSite=Lax`; the session id regenerates on login, role switch and mode change; logout invalidates server-side; expired sessions return 401; no token appears in any response body (only `csrf`). | BE-03, BE-33 | contract; plan 3 "Auth"; v2-portals NFR | IT: fixation, expiry and logout tests; cookie flag assertion; SEC. |
| BE-NFR-03 | Every non-GET request with a session shall require a valid `X-CSRF-Token`; a missing or wrong token returns 403 `CSRF_INVALID`. | BE-03, BE-33 | contract `CSRF_INVALID` | IT: one test per mutating route group (BE-33 criterion 1). |
| BE-NFR-04 | Login, registration, password reset, file upload and ticket creation shall be rate limited; limit breaches return 429 `RATE_LIMITED` with `retryAfter`; a success resets the login counter. | BE-03, BE-33 | contract `RATE_LIMITED`; M01 SRS | IT with a fixed clock; the value comes from `THROTTLE_LOGIN_PER_MINUTE`. |
| BE-NFR-05 | Scope shall come only from the account on the server. A request schema containing a scope field is rejected; an id outside the caller's scope returns 404 (never 403); extra body fields are rejected (strict schemas, no mass assignment). | BE-03, all cards | ADR-0017; V2-T20 | IT: sampled cross-user and cross-school read per domain; strict-schema test with an unknown field returns 422. |
| BE-NFR-06 | Passwords shall be stored only as hashes: argon2id for new hashes; legacy bcrypt `$2y$` verifies as `$2b$` and is rehashed on first successful login; accounts on the shared default hash or a non-bcrypt hash are flagged `must_reset`. | BE-03, BE-28 | plan 3; v2-data-migration 5; T-04 | IT: generated bcrypt hash verifies and is rehashed; log-capture test finds no password. |
| BE-NFR-07 | Input handling shall be safe: all SQL parameterised, global body-size and request-timeout limits, `helmet` headers, CORS off (same origin via nginx), no stack trace in 500 responses. | BE-01, BE-33 | plan 3 "Rate limit / security" | IT: SQL-injection strings on search endpoints do not change results; oversized body rejected; header assertions. |
| BE-NFR-08 | An append-only audit trail shall record role switch, mode enter and exit, login failures, user create, delete and toggle, subscription changes, password reset, impersonation, question publish and every intake transition, with actor, role, scope, action, target and request id and never personal content. | BE-03, BE-33, BE-10, BE-38 | v2-portals NFR Security; v2-question-bank NFR-06 | IT: one test per audited action (BE-33 criterion 4); no UPDATE or DELETE path to `audit_events` in code. |
| BE-NFR-09 | Dependencies and images shall be scanned: secret scan on every PR, `npm audit --omit=dev` and an image scan fail the build on high or critical findings, with a documented allow-list. | BE-01, BE-33 | plan 9 "CI expectations" | CI: the pipeline fails on a planted test secret and on a seeded vulnerable dependency (documented in the PR). |

### 5.2 Data protection and PDPA

| ID | Requirement | Cards | Source | Acceptance check |
|---|---|---|---|---|
| BE-NFR-10 | Identity card (IC) numbers shall never be stored or logged in clear; only a hash and a masked tail are stored. | BE-03, BE-05, BE-06, BE-28 | v2-data-migration 5; T-03 | IT: no column holds a plain IC after a create and an import; log-capture test. |
| BE-NFR-11 | Personal data of users, most of them minors, shall be minimised: responses contain only fields the matrix allows for the caller's role and scope; no personal data (names, e-mail, phone, IC, free text) appears in logs, error bodies, audit content, metrics or the `etl_rejects` table. | all cards, BE-33 | SRS NFR-05; v2-portals NFR Privacy; plan 3 "Logging" | IT: log capture across a login, a registration and an import; SEC. |
| BE-NFR-12 | Seeds, fixtures, tests, docs and logs shall contain only fictitious data. The only credential allowed in a seed is the demo password for seeded demo accounts. | all cards | AGENTS.md section 7; plan 9 | CI: secret scan; reviewer checklist item in the PR template. |
| BE-NFR-13 | Real or anonymised dumps, `.migration-out/` and any file over 1 MB under `apps/api/test/migration/` shall never enter git, a PR or CI artifacts. | BE-27, BE-35 | plan 14.8 | CI: a check fails when such a file is staged (BE-27 criterion 4). |
| BE-NFR-14 | Retention shall be configurable and enforced for intake files and page images (default: while the batch is open and 12 months after publish) and for the intake audit trail (default 5 years). Data-subject rights (access, correction, erasure) for users: **no rule yet**, see Open questions. | BE-37, BE-38 | v2-question-bank NFR-12; OD-16 | RUN: retention job tested on a fixed clock (intake files only). The user-data part is blocked on NQ-3. |

### 5.3 Performance and reliability

| ID | Requirement | Cards | Source | Acceptance check |
|---|---|---|---|---|
| BE-NFR-15 | API latency targets **[Proposed; LEAD may change, NQ-1]** on the PoC seed profile (about 20 students) on a developer laptop: p95 at most 300 ms for single-resource reads and writes, at most 800 ms for list and report endpoints. Intake: a 40-question paper extracts in at most 10 minutes (p90) and the review screen data in at most 2 seconds (p90); the review queue pages 5,000 open items. | BE-26, BE-37, BE-38 | SRS NFR-01; v2-question-bank NFR-02 | IT with timing assertions on the seeded profile (loose, to catch regressions); intake timing measured once in the BE-26 or BE-38 PR. |
| BE-NFR-16 | Every list endpoint shall be paginated with a bounded `pageSize` (at most 100); filters and sorts used by the scope filter shall be backed by indexes; aggregates are computed in SQL, not by loading tables into memory. | all list cards | contract `PageQuery`; SRS FR-G-07 | IT: a request with `pageSize=1000` is rejected or clamped as the contract says; migration review of indexes. |
| BE-NFR-17 | A multi-store write shall be atomic. Practice submit, Bijak submit and marking, intake accept, wallet credit with its source, and each ETL batch each run in one database transaction; a forced failure leaves no partial rows. | BE-12, BE-16, BE-38, BE-11, BE-34 | ADR-0014 section 2 | IT: inject a throw after the middle step and assert zero new rows (BE-12 criterion 1 pattern). |
| BE-NFR-18 | Mutations that a client can retry shall be idempotent: practice sessions by `clientUuid`, Bijak submit by `idempotencyKey`, wallet credits by source key, jobs by file hash plus stage, ETL by `(legacy_source, legacy_id)`. | BE-11, BE-12, BE-16, BE-37, BE-34 | contract `ClientUuid`; plan 15.2; 14.1 | IT: replay the same request twice; one row, same response. |
| BE-NFR-19 | Time shall be handled uniformly: stored as UTC `timestamptz`; serialised with `+08:00`; day logic (streaks, daily limits, quests) in `Asia/Kuala_Lumpur`; all code reads time from an injectable `Clock`, never `Date.now()` or `new Date()` in services. | BE-02, BE-11, BE-12, BE-16 | contract `common/time.ts`; OD-8 | UT/IT with a fixed clock at day boundaries; lint rule or review check for `Date.now`. |
| BE-NFR-20 | Selection, generation and seeds shall be deterministic for a given seed (seeded PRNG, no `Math.random`). | BE-02, BE-12, BE-15, BE-26 | ADR-0003 determinism; BE-02 criterion 4 | IT: same seed gives same question list and same seed data. |
| BE-NFR-21 | Background work shall survive restarts and never run twice: jobs live in a table, are claimed with `FOR UPDATE SKIP LOCKED`, have attempts and idempotency keys; the Bijak sweeper closes expired attempts after the grace period; the process finishes in-flight requests on SIGTERM and closes the pool. | BE-37, BE-16, BE-33 | plan 15.2 "Jobs"; BE-16 criterion 5 | IT: kill and restart mid-batch; sweeper test with a fixed clock; RUN: SIGTERM test of the container. |

### 5.4 API conventions, errors and BM messages

| ID | Requirement | Cards | Source | Acceptance check |
|---|---|---|---|---|
| BE-NFR-22 | Errors shall use `{ error: { code, message, fields?, details?, retryAfter?, requestId } }` with the HTTP status of `ERROR_STATUS` / `AUTH_ERROR_STATUS`; unknown routes, validation failures and unhandled errors use the same shape; `requestId` is in every error body and in the `X-Request-Id` response header. | BE-01 | contract `common/error.ts`, `auth/errors.ts` | CT: a negative test per generic code; BE-01 criterion 3. |
| BE-NFR-23 | User-visible `message` text shall be BM and copied **exactly** from the mock handler, SRS or contract (`AUTH_ERROR_MESSAGES`). Messages are never reworded, translated or "improved". Where the mock or SRS has no copy, use the proposed copy in the contract or raise it as an open question (NQ-4 covers validation field messages). | all cards | CLAUDE.md section 6; plan 6.1 | IT asserts the exact string for each error path; a copy-diff table is part of the PR. |
| BE-NFR-24 | Success bodies shall be `{ data }`, `{ data, meta }` (ListMeta: `page`, `pageSize`, `totalItems`, `totalPages`, `from`, `to`, optional `counts`) or, where the mock deliberately returns a live-shaped body, exactly that body. Out-of-range pages return an empty page, not an error; `from` and `to` are `null` on an empty page; a missing or invalid `page` means 1. Extra mock fields next to `data` (for example `status` flash text) are preserved. | all list cards | `src/mock/server/paginate.ts`; contract `ListMeta`; SRS 7.2 | CT: list responses parse `listEnvelopeOf`; IT: out-of-range and empty page cases. |
| BE-NFR-25 | Wire formats shall follow the contract: ids are opaque strings (bigint as decimal string, UUID for sessions and attempts); timestamps `+08:00`; enum codes in English; money `numeric(10,2)` RM (integer sen where the source uses sen); request schemas strict; mock paths (including BM paths such as `/api/kelas-saya`) kept unless a SRS or the lead says otherwise. | all cards | contract `common/`; plan 5, 6.1; OD-9 | CT: every response in tests is parsed by the contract schema (plan 10 item 2). |
| BE-NFR-26 | The contract shall be written first and be the acceptance test: `openapi.json` is generated, never hand-edited; `contract:check` fails when stale; a breaking-change gate fails CI on a removed field, narrowed enum or newly required field; a conformance suite runs the same scenarios against the mock and the API. | BE-31, every card | ADR-0018; plan 6.2 | CI: `contract:check`; BE-31 criteria 1 to 4. |

### 5.5 Observability and logging

| ID | Requirement | Cards | Source | Acceptance check |
|---|---|---|---|---|
| BE-NFR-27 | Logs shall be structured JSON (pino) carrying `requestId`, route, status and duration, with `cookie`, `authorization`, `password`, IC and e-mail redacted; log level from `LOG_LEVEL`. | BE-01, BE-33 | plan 3 "Logging" | IT: log-capture test (BE-03 criterion 9, BE-01 criterion 5). |
| BE-NFR-28 | The service shall expose liveness (`/api/health`) and readiness (`/api/ready`: database reachable and migrations applied) and a metrics or request-duration signal guarded to the internal network or admin. | BE-02, BE-33 | BE-33 outputs | IT: ready returns 503 with a pending migration; metrics route denied to a student. |

### 5.6 File uploads

| ID | Requirement | Cards | Source | Acceptance check |
|---|---|---|---|---|
| BE-NFR-29 | Uploads shall be validated by content (magic bytes) and size per use, rejected with the mock's status and BM copy (422, 413); storage keys never contain the client filename; files are private and served only through authenticated, scope-checked endpoints; no storage path leaks in responses. | BE-04, BE-16, BE-37 | v2-question-bank NFR-06; BE-04 criteria | IT: renamed file rejected, `../` name harmless, other user's file 404; SEC. |
| BE-NFR-30 | Untrusted PDFs shall be processed safely: scripting disabled in pdfjs, no external fetch, page cap (`OCR_MAX_PAGES`), size cap (`INTAKE_MAX_FILE_MB`, default 20), per-page timeout, bomb samples rejected, OCR in worker threads with bounded concurrency (`OCR_WORKERS`). | BE-37 | plan 15.2; OD-15, OD-16 | IT: BE-37 criteria 3, 6, 7. Malware scanning: NQ-5. |

### 5.7 AI provider abstraction, cost and OCR

| ID | Requirement | Cards | Source | Acceptance check |
|---|---|---|---|---|
| BE-NFR-31 | AI access shall go through one `ExtractionProvider` interface with adapters `mock` (default in dev, test and CI), `anthropic`, `openai`, `gemini`, `openai-compatible`; one is selected by configuration; swapping `AI_PROVIDER` changes no caller code; CI makes no network call to a provider. | BE-36 | plan 15.2; D52; OD-14 | IT: the same contract-test suite passes per adapter with recorded fixtures. |
| BE-NFR-32 | AI keys shall exist only in the server environment or deployment secret store: never in the database, the frontend bundle, logs, responses or error messages; an admin status endpoint returns only `configured` yes/no, provider and model id. | BE-36 | v2-question-bank NFR-04 | IT: grep test over captured logs and responses; SEC. |
| BE-NFR-33 | Before every provider call a redaction step shall mask cover-page names, school and contacts; the request carries content and taxonomy only; no user, student, teacher or school identifier is ever sent. | BE-36, BE-38 | v2-question-bank NFR-04, AC-04.8 | IT: canary test planting names and contacts on a cover page (BE-36 criterion 2, BE-38 criterion 8); SEC. |
| BE-NFR-34 | AI calls shall be bounded and costed: concurrency cap, requests per minute, per-run timeout, retry with backoff on 429 and 5xx; one `ai_usage_logs` row per call (provider, model, tokens, `cost_sen`, no content); a monthly budget `AI_MONTHLY_BUDGET_SEN` notifies Admin Pusat at 80% once and refuses new extractions with `AI_BUDGET_EXHAUSTED` at 100% so callers queue; a file hash already imported is refused before any cost. | BE-36, BE-38, BE-40 | v2-question-bank NFR-03, AC-06.4, AC-29.2; plan 15.2 | IT: burst test; budget thresholds with a fixed clock; BE-36 criteria 4 to 6. |
| BE-NFR-35 | `AI_BASE_URL` for the openai-compatible adapter shall be https, on an allow-list, and not a private or loopback address (SSRF). The AI service shall return drafts only and has no approval operation. | BE-36, BE-33 | plan 15.4; AC-05.6 | IT: SSRF cases; type-level test that the output has no status beyond `draft`. SEC. |
| BE-NFR-36 | Extraction quality targets (segmentation, text accuracy, answer-key match, tag accuracy, calibration) are **targets measured on the pilot sample set**, not CI gates; missing a target raises the review threshold, never enables auto-approval. | BE-36, BE-38 | v2-question-bank NFR-01, Q2 | PILOT: measured once the lead supplies sample PDFs (NQ-7). |

## 6. Migration requirements (BE-MIG)

These implement plan section 14 and `v2-data-migration.md`; they do not redesign them. The source is prestasiplus.cloud, read-only; prestasiplus.my is not a source until OD-13 is answered.

| ID | Requirement | Cards | Source | Acceptance check |
|---|---|---|---|---|
| BE-MIG-01 | Every table that can receive migrated rows shall carry `legacy_source` (check in `cloud`, `my`), `legacy_id` (text) and `unique (legacy_source, legacy_id)`, optionally `legacy_hash`; these columns never appear in the contract or any response; the model is listed in `apps/api/prisma/migratable-models.json`. | BE-34, every schema card | plan 14.2, 14.9 item 1 | CI: `be:lint:migration` fails on a fixture model lacking the unique index (BE-34 criterion 5). |
| BE-MIG-02 | ETL control tables `etl_runs`, `etl_checkpoints`, `etl_id_map`, `etl_rejects`, `etl_recon` shall exist and be the only run ledger. | BE-34 | plan 14.4 | IT: BE-34 criteria 4 and 7. |
| BE-MIG-03 | Loading shall be idempotent: a shared `upsertByLegacy` helper makes a second run produce the same database; unchanged `legacy_hash` rows are skipped; rows with `legacy_source IS NULL` are never touched; every card that adds a table tests a double insert through the helper. | BE-34, BE-28, BE-29 | plan 14.1, 14.9 item 6 | IT: BE-34 criteria 1 and 2; one such test per added table. |
| BE-MIG-04 | The runner shall default to `--dry-run` (all writes rolled back or into a throw-away schema); `--apply` requires a passing dry-run on the same input hash and exits non-zero otherwise. | BE-34, BE-30 | plan 14.5 item 3 | IT: BE-34 criterion 3. |
| BE-MIG-05 | The source connection shall verify its role is read-only and abort before reading anything if the credential can write; the only connection to .cloud is a configurable `CLOUD_SOURCE_URL`. | BE-27 | plan 9, 14.1 item 4 | IT: a role with INSERT aborts (BE-27 criterion 2). |
| BE-MIG-06 | A staging schema `staging_cloud` shall mirror the migrated and archived .cloud tables with permissive types, and a profiling report shall list row counts, enum distinct values (cap 50), null ratios, orphan counts, duplicates and password hash prefixes without printing any personal value. | BE-27 | plan 14.3; MIG-01 of v2-data-migration | IT on synthetic fixtures; report content assertion (BE-27 criterion 3). |
| BE-MIG-07 | No guessing: an unknown enum value, orphan, duplicate or invalid value goes to `etl_rejects` with a reason code (`UNKNOWN_ENUM`, `ORPHAN_PARENT`, `DUPLICATE_KEY`, `INVALID_VALUE`, `UNSUPPORTED`) and the offending value or its hash only, and is counted in reconciliation; nothing is silently coerced. | BE-28, BE-29, BE-34 | plan 14.1 item 3 | IT: fixture with nasty rows; reject table inspected (no row values). |
| BE-MIG-08 | The core load (reference data, schools with derived JPN/PPD, users with roles and scopes, parent links, classrooms and rosters, subscriptions) shall follow the load order of v2-data-migration 6.1, resolve parents through `etl_id_map`, and load self-references in two passes with deferrable foreign keys. | BE-28 | plan 14.5, 14.7; OD-10 | IT: orphan query returns 0 after `migrate:validate`; two-pass test (BE-34 criterion 6). |
| BE-MIG-09 | The activity load (practice sessions and answers, exam attempt headers, wallets and ledger, challenges, achievements, shop, feedback, interventions, content, tickets, notifications) shall use the historical snapshot approach: curriculum dimensions and correctness copied onto the row, nullable `question_id`, `historical = true`, soft references `legacy_question_ref`, `legacy_content_hash`, `source_natural_key`; question-dependent working state is dropped. Exam questions are never loaded. | BE-29 | v2-data-migration 3.3; D29a; plan 14.7 | IT: migrated answer rows count in statistics without a question link; no question table receives .cloud rows. |
| BE-MIG-10 | Sensitive source columns that v2 does not keep (plain IC, `faith`, `google_id`, psychometric detail, tokens) shall be dropped at extract time and never reach a v2 table or log; the ledger `balance_after` is kept and reconciled, never corrected. | BE-28, BE-29 | plan 14.2, 14.6; Q7 | IT: schema scan finds no such column; recon reports ledger drift without changing it. |
| BE-MIG-11 | Reconciliation shall report per entity: source count, eligible after documented exclusions, loaded (inserted, updated, unchanged), rejected by reason, `expected_delta`, status, plus the semantic checks (counts, sums, distinct sets, sample parity, accepted drift), as aggregates only in `.migration-out/`. | BE-30 | plan 14.6 | IT: `migrate:verify` green on fixtures (BE-30 criterion 1). |
| BE-MIG-12 | A delta run `--since <timestamp>` shall load only changed source rows and be idempotent; cutover uses a freeze because source deletes are not propagated. | BE-30 | plan 14.5 item 4 | IT: BE-30 criterion 2. |
| BE-MIG-13 | Rollback shall be a tested procedure that restores the pre-migration state by dropping the v2 data schema or tables, and the source shall be provably untouched (checked by privileges). | BE-30 | BE-30 criterion 3 | RUN: rehearsal on a staging copy, evidence in the runbook. |
| BE-MIG-14 | An anonymiser, run only by the lead, shall replace every personal column with a deterministic HMAC pseudonym so relations survive, replace password hashes with the hash of a known dummy, and keep structure, enums, null ratios and counts. | BE-35 | plan 14.8; OD-18 | IT on a fixture: same person maps to the same fake across tables; no source value remains. |
| BE-MIG-15 | A deterministic synthetic fixture generator (sizes `tiny`, `small`, `medium`) shall emit the `staging_cloud` shape with deliberate nasty cases (orphans, duplicate e-mails, unknown enums, non-bcrypt hashes, users without e-mail, date-only edges, cycles), with fictitious names. | BE-35 | plan 14.8 | IT: generated data loads into staging and the profiler reports the planted cases. |
| BE-MIG-16 | The optional post-reload backfill shall only set `question_id` when exactly one candidate matches (natural key plus content hash), list ambiguities, and never change correctness or dimensions. | BE-30 | v2-data-migration MIG-09 | IT: BE-30 criterion 4. |
| BE-MIG-17 | Every card that adds or changes a column or table shall add or update its row in the mapping matrix (plan 14.7) in the same PR; enums are `text` plus `check`; anything the source may lack is nullable or has a documented default; seeds never set `legacy_*`. | every schema card | plan 14.9 | Review: PR checklist item; the lead rejects a PR without the matrix row. |

## 7. Operations requirements (BE-OPS)

| ID | Requirement | Cards | Source | Acceptance check |
|---|---|---|---|---|
| BE-OPS-01 | The `api` image shall be multi-stage, run as a non-root user, work with a read-only root filesystem and a tmpfs, and include a health check. | BE-01, BE-33 | plan 4; BE-01 criterion 6 | CI: image build; RUN: `docker run --read-only` test (BE-33 criterion 5). |
| BE-OPS-02 | The `db` service shall be `postgres:16-alpine` with a named volume, a health check and **no published host port by default**; `api` depends on a healthy `db`; data survives `down` and `up`. | BE-02 | plan 11 | RUN: BE-02 criterion 5. |
| BE-OPS-03 | Configuration shall come from environment variables validated by a zod schema at start-up; a missing key fails fast with a readable message; `.env.api.example` lists every key with placeholders only and `.env.api`, `.env.db` are git-ignored. | BE-01, BE-02, BE-36, BE-37 | plan 11, 15.3 | IT: start with a missing key fails; CI: secret scan. |
| BE-OPS-04 | Migrations shall be applied by `prisma migrate deploy` as a one-off job before the API starts; `be:db:reset` refuses to run when `NODE_ENV=production`; the pipeline applies migrations to an empty database and on top of the previous head. | BE-02, BE-32 | plan 7, 10 item 4 | CI: both migration paths; IT: reset refuses in production mode. |
| BE-OPS-05 | The compose stack shall serve the SPA and proxy `/api` to the API on one origin, with a raised `client_max_body_size` and proxy timeouts for uploads; Vite dev proxies `/api` to port 3000. | BE-32 | plan 7 | RUN: `docker compose up` then an `@api` Playwright run. |
| BE-OPS-06 | CI shall run on every PR touching `apps/api/**`, `packages/**`, `docker/api/**` or `compose.yaml`: `npm ci`, `contract:check`, lint, typecheck, tests with a PostgreSQL 16 service, `be:lint:migration`, image build and secret scan, and shall be green before review. | BE-01, BE-34 | plan 9 | CI: workflow file; demonstrated once on a throw-away branch (BE-01 criterion 7). |
| BE-OPS-07 | A runbook `docs/ops/api-runbook.md` shall document env keys, start and stop, migrations, seed rules, backup and restore of `pgdata` with `pg_dump` (executed once into a fresh database), logs, incident basics and secret rotation. Backup frequency, retention and recovery targets are **not yet defined** (NQ-2). | BE-33, BE-30 | BE-33 outputs | RUN: restore verified (BE-33 criterion 7). |
| BE-OPS-08 | Secrets shall live only in the environment or the deployment secret store (GitHub Actions secrets in CI); production hostnames and cookie domain are configuration (OD-4). | BE-01, BE-03, BE-33 | plan 9, OD-4 | CI: secret scan; IT: cookie domain from env. |
| BE-OPS-09 | The e2e suite shall run against the compose stack for the specs tagged `@api`, and each merged domain shall have a documented "switch to http" checklist the lead applies. | BE-32 | plan 7 | RUN: `npm run test:e2e:module -- mNN` against compose per switched module. |
| BE-OPS-10 | The release gate (G6) shall have a final security pass covering uploads, AI keys, SSRF and migration data handling, and the user's explicit confirmation before deploy. | BE-33 | CLAUDE.md G6; BE-33 | SEC: security-engineer verdict recorded in the PR. |

## 8. Definition of done link

A requirement is satisfied only when its acceptance check ran green with real output in the PR. The per-card checklist is plan section 10 plus 14.9; the developer handbook turns it into a checklist ([backend-dev-guide.md](../plan/backend-dev-guide.md) section 14).

## 9. Traceability

### 9.1 Requirement to cards to verification

| Requirement | Cards | Verification |
|---|---|---|
| BE-FR-01 | BE-03 | IT, CT, SEC |
| BE-FR-02 | BE-03 + every domain card | IT, UT, SEC |
| BE-FR-03 | BE-05 | IT, SEC |
| BE-FR-04 | BE-25 | IT, UT |
| BE-FR-05 | BE-06 | IT, SEC |
| BE-FR-06 | BE-06 | IT, UT |
| BE-FR-07 | BE-04 | IT, SEC |
| BE-FR-08 | BE-08 | IT |
| BE-FR-09, BE-FR-10 | BE-24 | IT |
| BE-FR-11 | BE-09 | IT |
| BE-FR-12 | BE-10 | IT |
| BE-FR-13 | BE-11 | IT |
| BE-FR-14 | BE-12 | IT, CT |
| BE-FR-15 | BE-13 | IT, CT |
| BE-FR-16 | BE-23 | IT |
| BE-FR-17 | BE-14 | UT |
| BE-FR-18 | BE-15 | IT |
| BE-FR-19 | BE-16 | IT, SEC |
| BE-FR-20 | BE-39 | IT, SEC |
| BE-FR-21 | BE-36 | IT, SEC |
| BE-FR-22 | BE-37 | IT, SEC |
| BE-FR-23 | BE-38 | IT, SEC |
| BE-FR-24 | BE-40 | IT |
| BE-FR-25 | BE-17 | IT |
| BE-FR-26 | BE-18 | IT |
| BE-FR-27 | BE-19 | IT |
| BE-FR-28 | BE-20 | IT |
| BE-FR-29 | BE-21 | IT, SEC |
| BE-FR-30 | BE-22 | IT |
| BE-FR-31 | BE-01, BE-02 | IT, CI |
| BE-FR-32 | BE-07, BE-26 | IT |
| BE-FR-33 | BE-03, BE-12, BE-16, BE-19, BE-22 | IT |
| BE-NFR-01 to 05 | BE-03, BE-33 (+ every card for scope) | IT, SEC |
| BE-NFR-06 | BE-03, BE-28 | IT, SEC |
| BE-NFR-07 to 09 | BE-01, BE-33 | IT, CI, SEC |
| BE-NFR-08 | BE-03, BE-10, BE-33, BE-38 | IT |
| BE-NFR-10, 11 | BE-03, BE-05, BE-06, BE-28, BE-33 | IT, SEC |
| BE-NFR-12, 13 | all cards; BE-27, BE-35 | CI |
| BE-NFR-14 | BE-37, BE-38 (intake only) | RUN; user-data part has **no card** |
| BE-NFR-15 | BE-26, BE-37, BE-38 | IT (loose), RUN; **no card owns performance testing** |
| BE-NFR-16 | all list cards | IT |
| BE-NFR-17, 18 | BE-11, BE-12, BE-16, BE-34, BE-37, BE-38 | IT |
| BE-NFR-19, 20 | BE-02, BE-11, BE-12, BE-15, BE-16, BE-26 | UT, IT |
| BE-NFR-21 | BE-16, BE-33, BE-37 | IT, RUN |
| BE-NFR-22 | BE-01 | CT |
| BE-NFR-23, 24, 25 | all cards | IT, CT |
| BE-NFR-26 | BE-31 + every card | CI, CT |
| BE-NFR-27, 28 | BE-01, BE-02, BE-33 | IT |
| BE-NFR-29, 30 | BE-04, BE-16, BE-37 | IT, SEC |
| BE-NFR-31 to 35 | BE-36, BE-33, BE-38, BE-40 | IT, SEC |
| BE-NFR-36 | BE-36, BE-38 (measurement not carded) | PILOT; **no card owns the pilot measurement** |
| BE-MIG-01 to 04 | BE-34 | IT, CI |
| BE-MIG-05, 06 | BE-27 | IT |
| BE-MIG-07, 08 | BE-28, BE-34 | IT |
| BE-MIG-09, 10 | BE-29 (+ BE-28 for 10) | IT |
| BE-MIG-11, 12, 13, 16 | BE-30 | IT, RUN |
| BE-MIG-14, 15 | BE-35 | IT |
| BE-MIG-17 | every schema card | Review |
| BE-OPS-01 | BE-01, BE-33 | CI, RUN |
| BE-OPS-02 | BE-02 | RUN |
| BE-OPS-03 | BE-01, BE-02, BE-36, BE-37 | IT, CI |
| BE-OPS-04 | BE-02, BE-32 | CI, IT |
| BE-OPS-05, 09 | BE-32 | RUN |
| BE-OPS-06 | BE-01, BE-34 | CI |
| BE-OPS-07 | BE-33, BE-30 | RUN |
| BE-OPS-08 | BE-01, BE-03, BE-33 | CI, IT |
| BE-OPS-10 | BE-33 | SEC |

### 9.2 Card to requirements (every card has at least one)

| Card | Requirements | Card | Requirements |
|---|---|---|---|
| BE-01 | FR-31, NFR-07, 09, 22, 27, OPS-01, 03, 06, 08 | BE-21 | FR-29, FR-02 |
| BE-02 | FR-31, NFR-19, 20, 28, OPS-02, 03, 04 | BE-22 | FR-30, FR-33 |
| BE-03 | FR-01, 02, 33, NFR-01 to 06, 08, 10, OPS-08 | BE-23 | FR-16 |
| BE-04 | FR-07, NFR-29 | BE-24 | FR-09, FR-10 |
| BE-05 | FR-03, NFR-10 | BE-25 | FR-04 |
| BE-06 | FR-05, FR-06, NFR-10 | BE-26 | FR-32, NFR-15, 20 |
| BE-07 | FR-32 | BE-27 | MIG-05, 06, NFR-13 |
| BE-08 | FR-08 | BE-28 | MIG-07, 08, 10, NFR-06, 10 |
| BE-09 | FR-11 | BE-29 | MIG-09, 10 |
| BE-10 | FR-12, NFR-08 | BE-30 | MIG-04, 11, 12, 13, 16, OPS-07 |
| BE-11 | FR-13, NFR-17, 18, 19 | BE-31 | NFR-26 |
| BE-12 | FR-14, 33, NFR-17, 18 | BE-32 | OPS-04, 05, 09 |
| BE-13 | FR-15 | BE-33 | NFR-01 to 04, 07 to 09, 11, 21, 28, OPS-01, 07, 08, 10 |
| BE-14 | FR-17 | BE-34 | MIG-01 to 04, 07, OPS-06 |
| BE-15 | FR-18, NFR-20 | BE-35 | MIG-14, 15, NFR-13 |
| BE-16 | FR-19, 33, NFR-17, 18, 21, 29 | BE-36 | FR-21, NFR-31 to 36, OPS-03 |
| BE-17 | FR-25 | BE-37 | FR-22, NFR-14, 21, 29, 30, OPS-03 |
| BE-18 | FR-26 | BE-38 | FR-23, NFR-08, 14, 17, 33, 34, 36 |
| BE-19 | FR-27, FR-33 | BE-39 | FR-20 |
| BE-20 | FR-28 | BE-40 | FR-24, NFR-34 |

### 9.3 Gaps flagged

| Gap | Detail | Proposed handling |
|---|---|---|
| Requirements with no card | BE-NFR-14 (user-data retention and data-subject rights), BE-NFR-15 (no card runs performance checks beyond loose timing in BE-26/37/38), BE-NFR-36 (pilot measurement of extraction quality), malware scanning of uploads (NFR-30 note), backup frequency and recovery targets (BE-OPS-07). | The LEAD decides: add a P2 card, fold into BE-33 or BE-26, or accept. See NQ-1, NQ-2, NQ-3, NQ-5, NQ-7. |
| Cards with no requirement | None. Every card BE-01 to BE-40 appears in 9.2. | n/a |
| Cards with weak coverage | BE-31 and BE-32 are process cards; they map to NFR-26 and OPS-04/05/09 only. | Acceptable. |
| Doc inconsistency | `BE-01-scaffold-ci.md` acceptance 2 says the fallback is "recorded in ADR-0019"; the plan (section 3, OD-19) says the backend stack ADR is 0020. | The LEAD fixes the card; this file follows the plan. |

## 10. Open questions

Existing decisions (OD-n of [plan section 13](../architecture/v2-backend-plan.md)) that affect these requirements, with the plan's default in force until the LEAD says otherwise:

| OD | Affects | Default in force |
|---|---|---|
| OD-2 | BE-MIG-05, 06, 14, 15 (how real data reaches the ETL) | Schema plus synthetic fixtures now; anonymised dump from the lead later. |
| OD-4 | BE-NFR-02, BE-OPS-08 (cookie domain, hostnames) | Session in PostgreSQL; hostnames by env at release. |
| OD-6 | BE-FR-07 | Local volume behind `FileStorage`. |
| OD-7 | BE-FR-05, BE-FR-06 | No e-mail/SMS/push; reset e-mail logged. |
| OD-8 | BE-FR-13, BE-NFR-19 | Malaysia day boundary; teacher wallets as in the mock. |
| OD-9 | BE-NFR-25 | Ids are strings. |
| OD-10 | BE-MIG-08, 09 | Defaults of v2-data-migration section 7. |
| OD-13 | BE-MIG-01 | .cloud only; `my` is an empty extension point. |
| OD-14 | BE-NFR-31 to 35 | Mock provider default; production provider and budget chosen at G6. |
| OD-15, OD-16 | BE-NFR-14, 30 | pdfjs-dist plus tesseract.js; 20 MB, 200 pages, retention 12 months after publish. |
| OD-18 | BE-MIG-14 | The lead runs the anonymiser. |
| OD-20 | BE-FR-21 to 24 | The lead lists the intake wire-shape file paths. |

New questions raised by this document (numbering NQ-n; none is in the plan yet):

| ID | Question | Why it matters | Default until answered |
|---|---|---|---|
| NQ-1 | Are the proposed latency and throughput targets of BE-NFR-15 acceptable, and who measures them? | No document defines API performance targets; the plan says only "sane indexes". | Use the proposed numbers as loose regression guards, not gates. |
| NQ-2 | Backup frequency, retention, and recovery time and point objectives; log retention period. | BE-OPS-07 has no numbers. | Daily `pg_dump`, 7 daily and 4 weekly copies, as a suggestion for the runbook only. |
| NQ-3 | PDPA data-subject rights for users, mostly minors: access, correction, erasure on request, parent consent, retention of inactive accounts, breach contact. | No requirement or card covers them; the plan covers only the migration dump and intake files. | None implemented; do not invent. The LEAD raises it with the user before release. |
| NQ-4 | Validation `fields` messages: the mock uses Laravel-style English defaults (marked UNVERIFIED COPY in the M03 handlers) while the contract describes `message` as BM. Replicate the mock string or translate? | BE-NFR-23 says copy exactly; for these fields exact copy is English. | Copy the mock's English string exactly and list each in the PR copy-diff table. |
| NQ-5 | Malware scanning of uploads (v2-question-bank NFR-06 requires it): which engine, or accept content validation only? | BE-37 tests content and bombs but names no scanner. | Content validation only until decided. |
| NQ-6 | Session lifetime values: `SESSION_TTL_HOURS`, `SESSION_REMEMBER_DAYS`, idle timeout. | The env keys exist, the values are not documented. | Take the values from the M01 SRS if present, else ask in the BE-03 PR. |
| NQ-7 | Sample PDFs for the extraction pilot (v2-question-bank Q2) and who runs the NFR-01 measurement. | BE-NFR-36 cannot be verified without them. | Mock provider only; targets stay as proposed. |
| NQ-8 | Is the `/api/metrics` endpoint exposed on the internal network or to admin only? | BE-NFR-28 allows both. | Internal network only. |
