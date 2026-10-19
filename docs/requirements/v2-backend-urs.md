# v2 Backend: User / System Requirements Specification (slug: v2-backend)

- **Status:** Reference edition, reviewed and completed 2026-10-19 (product-analyst). Requirements only; no backend code exists yet. Changes since the first draft are in section 13.
- **Audience:** every PC and Claude Code session that builds the backend. Read section 0, the domain section you work on, and sections 5 to 7 (NFR, MIG, OPS) before your first card, then [../plan/backend-dev-guide.md](../plan/backend-dev-guide.md).
- **Sources:** [plan](../architecture/v2-backend-plan.md) (sections 2, 3, 5, 6, 10, 14, 15), [role-access-matrix](role-access-matrix.md), [v2-portals](v2-portals.md), [v2-question-bank](v2-question-bank.md), [v2-exam-schema](v2-exam-schema.md), [v2-bijak-spm](v2-bijak-spm.md), module URS/SRS in [urs/](urs/README.md) and [srs/](srs/README.md), [v2-data-migration](../architecture/v2-data-migration.md), the 40 cards in [../plan/backend-tasks/](../plan/backend-tasks/README.md), TRACKER decisions D28 to D52, and `@pp/contract` (`packages/contract`).
- **Authority order:** `docs/TRACKER.md` decisions, then this file and the module SRS, then the plan and ADRs, then the card files, then code. The frontend mock is the behavioural spec (plan section 1); `@pp/contract` is the wire spec and wins over the mock where they disagree (plan section 12). This file never restates module detail: it points to it.
- **Rule for unknowns:** a business rule that is not in the SRS, the mock, the contract or a decision is **not invented**. It is an open question in section 12 (id `OQ-n`) or, for a single card, a line under "Open questions" in the PR.
- **Sibling documents:** endpoint list [../architecture/v2-api-catalogue.md](../architecture/v2-api-catalogue.md); tables and columns [../architecture/v2-data-model.md](../architecture/v2-data-model.md); end-to-end integration [../plan/fullstack-integration-guide.md](../plan/fullstack-integration-guide.md); frontend side [../plan/frontend-dev-guide.md](../plan/frontend-dev-guide.md); onboarding [../plan/onboarding.md](../plan/onboarding.md); test strategy [../qa/v2-test-strategy.md](../qa/v2-test-strategy.md). This file owns the *requirements*; those own the lists.

## 0. How to read this document

- **IDs:** `BE-FR-nn` functional, `BE-NFR-nn` non-functional, `BE-MIG-nn` migration, `BE-OPS-nn` operations. IDs are stable; new requirements get the next free number in their family (numbers inside a table are therefore not always in order).
- **Cards:** each row names the cards (`BE-nn`) that implement it. "Cross-cutting" means every card that adds an endpoint or a table must satisfy the row; it is then not repeated per card in 9.2.
- **Acceptance check:** every row ends with a check that a developer can run or a reviewer can tick. The codes are in section 3. A requirement is satisfied only when its check ran green with real output in the PR (section 8).
- **Priority:** requirements inherit the highest priority (P0 most urgent) of their cards in [backend-tracker](../plan/backend-tracker.md); the value is shown in 9.1.
- **Numbers:** a number in an acceptance check comes from a card, an SRS, the contract or a TRACKER decision, and the row names it. Where no source defines a number the row says "no target" and links an open question; nothing is invented.
- **Every endpoint** additionally satisfies BE-NFR-01 to BE-NFR-05, BE-NFR-22 to BE-NFR-25 and BE-NFR-39 without being listed per row.

### 0.1 User decisions 2026-10-19

| Id | Decision (project owner) | Effect on this document and the cards | TRACKER |
|---|---|---|---|
| UD-1 | Ids and session follow the **contract**, not the mock: ids are decimal strings; authentication is a cookie session with `X-CSRF-Token`, the `Session` shape and the `/api/session*` endpoints; bad credentials are 401 `INVALID_CREDENTIALS`; no Bearer on the real API. The LEAD realigns the mock and `HttpTransport` (V2-T31). | BE-FR-01, BE-NFR-03, BE-NFR-25, section 13.2; BE-03 states that the contract wins for these items. | D53(b) to (g) |
| UD-2 | Impersonate is **dropped**: one mechanism, Mod Pelajar via `POST /api/session/mode` (D31c, the admin acts as their own account). | OQ-17 closed; BE-05 and BE-21 no longer build the impersonate routes (a one-line note records that the mock routes are intentionally not ported). | D53(b) to (g) |
| UD-3 | Parent hadiah approvals (`/api/parent/hadiah-approvals*`, M15-08 to M15-10) are **not built in B1**; the backend does not register them and the frontend hides the entry point (unbuilt screens are hidden, no "coming soon" page). | OQ-20 closed; BE-23 lists the routes under "Not in B1 (UD-3)". | D53(b) to (g) |
| UD-4 | M18 Amaran (4 routes `/api/amaran/*`) is **folded into BE-21**. | BE-FR-37 added; OQ-12 closed; BE-21 endpoint table, inputs, files and ACs 8 to 12; cards README backlog updated. | D53(b) to (g) |

The LEAD recorded the owner decisions of 2026-10-19 as TRACKER D53: UD-1 to UD-4, OWN-1 and OWN-10 are D53(b) to (g) (exact letter per item not cited here), the scope decision is D53(a) and the DSKP decision is D53(h). The UD labels stay as the local names; this document and the cards do not edit the tracker. Further D53 decisions applied below:

| D53 item | Decision | Effect |
|---|---|---|
| OWN-1 (D53(b) to (g)) | One table for the question-paper submission: `intake_batches` (BE-37) IS the Submission; `question_submissions` is dropped from BE-10; `source_papers` stays the paper identity and rights registry that a batch points to. | BE-10 drops the table and the three `/api/question-submissions*` routes (served by intake, see BE-FR-12 and BE-37); BE-FR-22. |
| OWN-10 (D53(b) to (g)) | The teacher economy (teacher wallets, ledger, rewards, redemptions, cash withdrawals, teacher badges and their routes) is backlog, not B1 (D28c). | OQ-16 closed; BE-23 lists the routes under "Not in B1 (D53/OWN-10)"; BE-FR-16. |
| D53(h) | Questions are tagged with `curriculum_node` only (v2-exam-schema D9); BE-18 `dskp_*` is a teacher picking list only. | BE-FR-11, BE-10. |
| D53(a) | Every module reachable in the prototype is B1: M06, M07, M13, M16, M20, M21 (student side only; Penaja out per D48), M25 (= Heatmap Topik Lemah) and the M09 student Audio KBAT play. | Cards BE-41 to BE-48 exist (BE-41 M06 SPM hub, BE-42 M07 PKSK, BE-43 M13 Cikgu Alesa, BE-44 and BE-45 M16, BE-46 M20, BE-47 M21 student side, BE-48 M25) with requirements BE-FR-38 to BE-FR-45; the two audio routes are in BE-24; sections 1, 10, 11 and OQ-11, OQ-13, OQ-14 updated. |

## 1. Purpose and scope

The backend replaces the in-browser mock behind the frontend `Transport` seam (ADR-0004), endpoint by endpoint, for release **B1** of the plan (section 2): the four prototype roles, the core learning loop, Bijak SPM, class and report flows, the SPM question intake and paper builder (D52), the migration pipeline from prestasiplus.cloud (read-only source), and container deployment (D50).

**In scope:** everything in plan section 2 "Goals", which is the 48 cards BE-01 to BE-48.

**Out of scope:** roles `ppd_officer`, `parent`, `sponsor` (schema columns only; Penaja out per D48), the teacher economy (D53/OWN-10), payments gateway, e-mail/SMS/push delivery, AI features other than question-intake extraction and what the cards BE-41 to BE-48 specify for M13 and M25, reloading exam questions from .cloud (D29a), changing UI behaviour, horizontal scaling and performance tuning beyond sane indexes. Since D53(a) the plan's earlier non-goals marketplace (M20) and sponsorship (M21, student side) are in B1.

**Mock domains:** since D53(a) every module reachable in the prototype is B1. M06, M07, M13, M16, M20, M21 (student side) and M25 are served by cards BE-41 to BE-48 (requirements BE-FR-38 to BE-FR-45); sections 10 and 11 list them.

## 2. Actors

Roles use the contract codes (`RoleCode`), not the older requirement keys (`admin_sekolah`, `pegawai_ppd`); see plan section 12.

| Actor | Contract code | In B1 | What it may do (summary; [role-access-matrix](role-access-matrix.md) is the authority) |
|---|---|---|---|
| Murid (student) | `student` | yes | The 37 Murid module rows of the matrix (learning, wallet, Bijak SPM, own performance); own data only; never combines with another role. |
| Guru (teacher) | `teacher` | yes | The 15 Guru rows: own classes, own students, class reports, question contributions, own intake batches. |
| Admin Sekolah | `school_admin` | yes | The 18 Admin Sekolah rows: own school only (staff, students, reports, Command Center); Mod Pelajar. |
| Admin Pusat | `admin` | yes (D48) | Everything, including question approval and publication, curriculum, paper builder, intake dashboard and AI usage; single-role; Mod Pelajar. |
| Pegawai PPD/JPN | `ppd_officer` | no endpoints | Schema columns and migrated scope only (D43/D48); BE-28 derives `user_scopes` for migrated `pegawai_ppd` accounts. |
| Ibu Bapa, Penaja | `parent`, `sponsor` | no endpoints | Parent invite tokens and links are stored (BE-25). The mock parent approval routes are not built (UD-3). |
| Lead | n/a | process | Owns the contract `common/session/auth/access` folders, reviews and merges every PR, produces anonymised dumps (OD-18). |
| Migration operator | n/a | process | Runs the ETL CLI on a staging copy; only the lead touches real (anonymised) dumps. |
| AI provider, OCR engine | n/a | system | External or in-process systems behind adapters (BE-36, BE-37). |

Scope levels are derived by the server: `national`, `state`, `district`, `school`, `class`, `self` (contract `ScopeLevel`). A client never sends scope. Capabilities (`capabilitiesFor(role, scope)` in `@pp/contract/access`) exist only for the Portal Pentadbiran roles `admin`, `school_admin`, `ppd_officer`; `student` and `teacher` routes are guarded by the active role.

## 3. Definitions

| Term | Meaning |
|---|---|
| Contract | `packages/contract` (`@pp/contract`): zod schemas, error codes, access matrix and the generated `openapi.json`. The wire spec. |
| Mock | The in-browser server under `src/mock/**` and `src/modules/*/mock/**`. The behavioural spec. |
| Card | A task file `docs/plan/backend-tasks/BE-nn-*.md`. One card = one branch = one PR. |
| Open list / contract-only | The LEAD's list of cards that may start, in [AGENT-SYNC](../plan/AGENT-SYNC.md); `contract-only` allows only the zod schemas of a card before its dependencies are done. |
| Owner module | The single module that owns a store (ADR-0014); others call its service, never its tables. |
| Envelope | `{ data }`, `{ data, meta }` or `{ error }` as defined by the contract. |
| Scope filter | The request-scoped `ScopeContext` / `ScopeFilter` every repository must use (BE-03). |
| Mod Pelajar | "Pratonton sebagai Pelajar": an admin or school admin acts as a student (as themselves) with all writes stamped `is_test` (D31c, D33b, V2-T19). |
| Legacy columns | `legacy_source`, `legacy_id`, optional `legacy_hash` on migratable tables (plan 14.2). |
| BM | Bahasa Melayu. User-visible messages are BM copied exactly from the mock, SRS or contract. |
| PDPA | Malaysia Personal Data Protection Act 2010. Most users are minors. |
| OQ-n | Open question of this document (section 12). OD-n = open decision of plan section 13. |
| Verification codes | **UT** unit test; **IT** integration test (supertest + real PostgreSQL); **CT** contract/conformance test (response parsed by the contract schema, BE-31); **SEC** security review by the lead's `security-engineer` role (G4); **CI** a CI pipeline step; **REV** a checklist item the lead ticks in review; **RUN** runbook or rehearsal executed once with evidence; **PILOT** measured on a pilot sample set. |

## 4. Functional requirements (BE-FR)

Each row points to the module requirements; detail is **not** repeated. The cards list the exact endpoints, tables and acceptance criteria (AC); the minimum acceptance checks are below, a card may add more. Mock paths are used unchanged (plan 6.1), so rows name an endpoint only where it is the requirement itself.

### 4.1 Identity and platform

| ID | Requirement | Cards | Source | Acceptance check |
|---|---|---|---|---|
| BE-FR-01 | The API shall implement the six session operations of the contract (login, logout, read session, switch role, enter and leave Mod Pelajar) with cookie session auth, CSRF header, a role list with one active role, server-derived scope and capabilities, and the exact error codes and BM messages of `AUTH_ERROR_CODES` / `AUTH_ERROR_MESSAGES`. The contract wins over the mock for the login and logout shape, the numeric ids, Bearer and the status of bad credentials (user decision UD-1). | BE-03 | M01 SRS; v2-portals US-01, US-05, US-08, US-16; contract `session/`, `auth/` | IT: one supertest per row of the BE-03 endpoint table and per listed error code; CT: every success body parses `SessionSchema`. IT: wrong password and unknown account give identical 401 `INVALID_CREDENTIALS` bodies (except `requestId`); after 5 failed attempts for one identifier and IP within 60 s the next attempt returns 429 with `retryAfter` and a success resets the counter (limit from `THROTTLE_LOGIN_PER_MINUTE`; the value 5 is M01 BR-02, INFERRED); an inactive or suspended account gets 403 `ACCOUNT_INACTIVE` and a failed attempt on it does not count toward the throttle (M01 BR-23, INFERRED); a username in several schools without `schoolId` gets 422 `AMBIGUOUS_USERNAME` with `details.schools`; the seeded demo accounts log in. |
| BE-FR-02 | Every endpoint shall be protected by role and capability guards derived from the contract access matrix, and every repository read or write shall be filtered by the request `ScopeContext`. Portal Pentadbiran routes use `CapabilityGuard` (`admin`, `school_admin`, `ppd_officer`); `student` and `teacher` routes use `RolesGuard` on the active role only. | BE-03; every domain card | [role-access-matrix](role-access-matrix.md); v2-portals US-03, US-05, US-06, US-12, US-13, section 4.2 | IT per route group: no session 401, wrong role 403, out-of-scope id 404; UT of guards reading the active role only (a dual-role account holds no union of permissions). |
| BE-FR-03 | The API shall serve the M02 user and school management for Admin Pusat and Admin Sekolah: user list with filters, detail, create, update, delete, toggle active, bulk delete, bulk user import and student import, school list/options/create, teachers and class lookups, config defaults. Rules of `users-rules.ts` apply (role combinations, unique e-mail and username, school required for school roles). Student import is refused for a school without an active subscription with the mock's message. IC numbers are accepted on input and only hash plus masked tail are stored and returned. | BE-05 | M02 URS/SRS; v2-portals 4.2; data-migration 4.1 | IT against the mock's M02 rules and the mock tests in `src/modules/m02-users-schools/__tests__/mock`: same status, body and BM text for the same input; school admin sees and edits only own school (other id 404; a body naming another school cannot move a user); invalid role combination 422; duplicate e-mail as the mock; a malformed import row does not abort the file and appears in the per-row report; `meta` (`page`, `pageSize`, `totalItems`, `totalPages`, `counts`) exact. The mock's `impersonate` route is not built (UD-2). Whether school-admin imports start inactive: see OQ-18. |
| BE-FR-04 | The API shall persist school subscriptions and packages (create, extend, upgrade, cancel, quota, renewal invoice data), user package assignment, parent invite tokens and parent-student links, complimentary students, and expose the single `SubscriptionService.isSubscribed` used by the practice trial rule. | BE-25 | M02 SRS; L45 URS/SRS; data-migration Q6 | IT: table-driven tests from the mock subscription tests (enrolling beyond the quota is refused with the mock error; extend, upgrade and cancel change dates and status as the mock); invite token is random, stored hashed, single-use and expiring, and `GET /api/parent-invites/:token` returns only the minimal child info the mock shows; school admin sees only own school's subscription (404 otherwise); complimentary toggles write an audit row; UT of `isSubscribed` for the documented derivation (default of Q6: latest paid unexpired payment, school subscription, PKSK access; see OQ-21 for the PKSK part). |
| BE-FR-05 | The API shall provide the M01 account basics: self-registration, password reset (e-mail and IC variants), profile update, password change, picture upload, personal settings, `GET /api/me`, and the public landing counters. Reset tokens are stored hashed, are single-use and expire; changing a password requires the current password and rehashes with argon2id; a reset invalidates the user's other sessions. The reset e-mail is logged, not sent (OD-7). | BE-06 | M01 URS/SRS; v2-portals | IT per flow including every validation error with the mock's `fields` text; reset token reuse and expiry rejected (token validity 60 min, single use, a second request for the same e-mail within 60 s throttled: M01 BR-10, INFERRED); picture accepts jpeg, png, webp up to 2 MB and rejects other types and larger files (M01 BR-15); duplicate e-mail/username as the mock; registration is rate limited; `GET /api/me` and `GET /api/session` agree on shared user fields; `GET /api/public/stats` is computed from tables. Whether reset reveals that an account exists and how a reset link reaches a user outside development: OQ-10. |
| BE-FR-06 | The API shall provide the notification inbox (paginated list, unread count, read-all, bulk read, bulk delete) and an internal `NotificationsService.push` that other modules call. | BE-06 | M01 SRS; M22 SRS | IT: inbox shows own rows only (another user's id 404); bulk operations ignore foreign ids silently as the mock does; UT: `push` writes one row. |
| BE-FR-07 | The API shall provide a `FileStorage` abstraction with a local-volume implementation and an in-memory test implementation, and an authenticated upload and download pipeline for avatars, Bijak working photos, question images and CMS images, including derived files (intake page images and crops). | BE-04 | plan 3 "Files"; OD-6; BE-04 | IT: BE-04 AC 1 to 5 (valid PNG/JPEG accepted; a renamed file with other content rejected 422; oversize 413 with the mock's BM copy; another user's `bijak_photo` 404; storage key never contains the client file name; files survive a container restart). |
| BE-FR-08 | The API shall own the curriculum store (levels, subjects, derived subject-levels, chapters, topics, subtopics, DSKP node tree of the 13 reference subjects) and serve the learner and admin M03 endpoints including `learning-map`. | BE-08 | M03 URS/SRS; v2-exam-schema D9; data-migration 4.2 | IT: seeded counts equal the mock seed counts (asserted against exported counts, not hard-coded); duplicate and validation rules match with the same codes; non-admin POST and admin GET 403; UT: `subject_levels` derivation rule; the 13 DSKP JSON files load without error. |
| BE-FR-09 | The API shall serve CMS content (articles, banners, videos, notes, Perutusan, screenshots, audio KBAT sets with the student play: set detail without answers and attempt submit) for learners, the public where the mock allows, and the admin screens. Rich-text bodies are sanitised on write (BE-NFR-37). | BE-24 | M09 URS/SRS; v2-portals (public articles/videos) | IT per endpoint group; unpublished content never returned to the public; slugs unique and stable; video visibility by school honours scope; teacher-uploaded videos follow the mock's approval state; image upload goes through `FileStorage`. |
| BE-FR-10 | The API shall serve the support-ticket flow: learner create and list, admin queue (read-only, D27) and open count, notify every active admin. | BE-24 | M22 URS/SRS | IT: `userId` in a body is ignored; subject/body length limits as the mock constants; every active admin gets a notification and a notification failure does not undo the ticket; admin queue 403 for other roles. |
| BE-FR-11 | The API shall own the v2 question store (a question as an ordered tree of parts, eight leaf answer modes, five answer-key kinds, structured mark-scheme points, stimuli and stimulus groups, curriculum tags on `curriculum_node` only (D53(h)), versions, lifecycle status) and expose the owner repository (`get`, `getMany`, `count`, `groupCount`, `eligibleForPractice`, `sample`, `gradeAnswer`, `deactivate`) and the question list, detail and CRUD endpoints, including the Guru contribution routes. | BE-09 | M04 URS/SRS; v2-exam-schema D1 to D12; v2-question-bank 4.1; ADR-0014 | IT: a one-part MCQ and a three-level part tree round-trip; a question accepts `curriculum_node` tags and rejects a `dskp_*` id as a tag; marks on a branch part rejected; invalid mode/key combination 422; a stimulus group keeps its questions together and returns the stimulus once; no `published` without subject, level, unit, SP and TP tags; Guru cannot see another teacher's drafts; students get 404 for non-published ids and never receive an answer key, scheme or explanation before check; list `meta.counts` match the mock; REV: other modules reach questions only through the owner service. |
| BE-FR-12 | The API shall implement the question review lifecycle Draf, Semakan, Lulus, Terbit, Diarkib with the transitions, roles and quality gates of v2-question-bank 4.1 and 4.8, status events with actor and time, versioning ("Sunting" creates version n+1 as Draf; the live version keeps serving until n+1 is Terbit), student question reports and their statuses, CSV import with downloadable templates, quality and diagram audits, DSKP source lookups, source-level takedown, and the AI-explanation stub. The teacher paper Submission is the intake batch (BE-37, D53/OWN-1); there is no `question_submissions` table and no `/api/question-submissions*` route in BE-10. | BE-10 | M04 SRS; v2-question-bank 4.1, 4.5 to 4.8, D40a, D40c; BE-10 | IT: the allowed transitions (Draf to Semakan by Guru own or Admin Pusat; Semakan to Lulus; Lulus to Terbit; Terbit to Diarkib; Diarkib to Draf; back-to-Draf requires a reason) succeed for the listed role and every other pair returns 409 `CONFLICT`; Guru cannot approve (403); Admin Sekolah 403; each gate rejects a violating question (tags outside the taxonomy, marks total different from the sum of parts, no answer key at publish, open duplicate flag, copyright declaration "belum jelas"); a bulk action skips failing questions and reports them; resolving a report as wrong removes the question from `eligibleForPractice`; CSV: header validation, row limit, per-row error list, nothing partial published, template columns equal the mock; takedown archives all questions of a `source_paper`; the AI-explanation endpoint makes no network call. Version n+1 and the report auto-hide rule are not yet in BE-10's AC (card change proposed; rule: OQ-22). |
| BE-FR-13 | The API shall own the wallet, the append-only coin ledger with `balance_after`, tokens and the daily streak (Malaysia day), with idempotent credits keyed by source, and the student wallet reads. | BE-11 | M14 URS/SRS; OD-8 | IT: ledger sum equals balance for seeded data; same source key credits once; no UPDATE or DELETE path to `coin_ledger`; a credit joins the caller's transaction; negative balance rejected with the mock's error code; streak: the same Malaysia day twice does not increment, a missed day resets as the mock, boundary tests at 23:59 and 00:00 +08:00 with a fixed clock; a user sees only own wallet. |
| BE-FR-14 | The API shall implement the practice write path (start, check answer, submit, history) with the trial check (limit 50 for an unsubscribed user: M05 BR-07), question selection through the owner repository, regrade, answer rows carrying the curriculum dimensions, revision queue, mastery, wallet credit (coins = correct answers, points = 10 x correct: BR-09), quest rewards once per quest per day, and streak, in one transaction, idempotent by `clientUuid`. | BE-12 | M05 URS/SRS (BR-04..BR-31); ADR-0014 section 2; data-migration 4.4 | IT: a forced failure after step 4 leaves no answer rows, queue change or wallet credit; replay with the same `clientUuid` returns the same session; a second submit 409; once an unsubscribed user has used the 50 trial answers further checks are refused with the mock's trial error and BM message (the counter rule is INFERRED in M05 BR-07, so compare with the mock handler); questions in a start response never carry the answer or explanation; deactivated and unpublished questions are never served; each answer row stores subject, level, chapter, topic, difficulty, type and correctness with nullable `questionId` and `historical = false`; another student's session 404; responses equal the mock on the fields the mock tests assert. Assigned modes (mission, remedial, question set) and quest rewards depend on BE-18 and BE-23 tables: see card changes. |
| BE-FR-15 | The API shall serve the M05 learner read models (dashboard, subjects, chapter lists, history, progress, corrections, mastery, revision views, SPM targets, structured attempts) and topic progress derived on read from the answer log. | BE-13 | M05 SRS; M03 BR-19; data-migration 4.4 | IT on seeded sessions; CT on every list; mastery, accuracy and topic progress are computed from the answer rows' dimensions (a test sets `question_id` to null and `historical` to true and the figures do not change); the revision queue lists only rows with an active question link; `PUT /api/spm-targets` validates grade ranges as the mock and is idempotent; every list is scoped to the signed-in user. Whether mastery is stored or derived: OQ-19. |
| BE-FR-16 | The API shall serve the gamification economy (dashboard, daily challenges, achievements, token conversion, referral, share cards, leaderboard, tiers, lucky draws, mystery boxes, admin screens) and the rewards shop (rewards, claims, digital shop). The teacher economy is Not in B1 (D53/OWN-10) and its routes are not registered. The parent approval routes are not registered (UD-3). | BE-23 | M14, M15 URS/SRS; D28c | IT: every credit or debit goes through `WalletService` in the caller's transaction; redeem fails with the mock's error when the balance is short and stock decrements are race-safe (concurrent redeem test); challenge completion idempotent per user per Malaysia day; conversion enforces the mock's rate, minimum and daily cap; tier derived from the ledger; admin routes `admin` only, teacher routes `teacher` only; another user's ledger 404; draws deterministic under the seeded PRNG and audited. |
| BE-FR-17 | The marking and blueprint logic of Bijak SPM shall live in the shared package `@pp/exam-core` so the server marks exactly as the UI. | BE-14 | v2-bijak-spm; OD-5 | UT: the moved M28 domain tests pass unchanged from the new location; root `npm run typecheck`, `npm run build` and `npm test` stay green; REV/CI: the package has no import from `src/**`, Vue, DOM or Node-only APIs; server import proven by `apps/api/test/exam-core-import.spec.ts`; no logic edits in the move. |
| BE-FR-18 | The API shall persist papers, sections, placements and blueprints, and serve the paper list, paper cover, blueprint contracts and "Jana Kertas" generation with shortage reporting. | BE-15 | v2-bijak-spm; v2-exam-schema D5, D7; Q-S1, Q-S6 | IT on the three PoC papers: structure, marks totals and section rules equal what the m28 mock serves; `total_marks` derived from placements; draft blueprints cannot generate (`NO_BLUEPRINT`); generation keeps stimulus groups together, never repeats a question, returns `SHORTAGE` with details instead of a short paper, and is deterministic for a fixed seed; another user's generated paper 404; no answer key, scheme or explanation in any response. |
| BE-FR-19 | The API shall run the Bijak attempt lifecycle server-side: start and resume, answer-key-free attempt view, autosave with revisions (last writer wins per part by `rev`), offline late sync, server deadline and grace sweeper, idempotent submit, latihan "Semak" cap, marking with `@pp/exam-core`, results with reveal rules, history, working-photo upload. | BE-16 | v2-bijak-spm; v2-bijak-spm-limitations; `m28-bijak-spm/server/store.ts` | IT: every scenario of the mock `server.test.ts` and `server-late.test.ts` re-expressed as a supertest case; deadline computed from the server clock at start with `serverNow` returned; the sweeper closes an expired exam attempt 300 s (`GRACE_SECONDS`) after the deadline as `auto_submitted` and late changes are accepted for 24 h (`LATE_SYNC_WINDOW_MS`) and regraded; at most 3 checks per question in latihan (`MAX_CHECKS_PER_QUESTION`), exam mode 403; an attempt idle under 60 s resumes silently (`FRESH_SECONDS`); recursive key-scan finds no answer key, scheme, equivalent or explanation in attempt and save responses before submit; two concurrent submits with one `idempotencyKey` give one result row; golden marking tests equal the mock engine on the three PoC papers; another user's attempt 404; photos jpeg or png up to 5 MB and at most 3 per part. |
| BE-FR-20 | The API shall persist the admin paper builder and blueprint admin: draft papers, ordered placements with stimulus groups moved as a unit, blueprint version choice, conformance and shortage report, publish and withdraw, versioned blueprints. Publish is refused unless every placed question is Terbit at the pinned version and the paper conforms to its blueprint. | BE-39 | v2-question-bank 4.5, 4.6, 4.8; v2-exam-schema D5, D7 | IT: publish refused with 422 and BM message on a non-Terbit placement or a non-conforming paper; a stimulus group cannot be split across sections; a published paper appears in the BE-15 list and a withdrawn one disappears while started attempts are unaffected; a blueprint version used by a published paper is immutable and editing creates a new version; Guru, Admin Sekolah, Murid get 403 on all `/admin/papers` and `/admin/blueprints`; every state change writes an audit event; the conformance engine is `@pp/exam-core`. |
| BE-FR-21 | The API shall provide a provider-agnostic AI extraction service that returns drafts with per-field confidence and source region, suggests tags, records usage, enforces a rate limit and monthly budget, exposes admin status/usage/settings/test endpoints, and has no approval right. | BE-36 | v2-question-bank NFR-03, NFR-04, AC-04.8, AC-05.6, AC-06.4, AC-29.2; plan 15.2 | IT: BE-36 AC 1 to 9; the same contract-test suite passes for the mock provider and, with recorded fixtures, for every adapter; Guru and Murid 403 on `/ai/*`. Detail in BE-NFR-31 to BE-NFR-36. |
| BE-FR-22 | The API shall accept paper uploads (PDF and the other formats the lead lists, OD-20), store originals, render page images, run server OCR for scans, crop figures and run all of it as durable background jobs. | BE-37 | v2-question-bank 4.2; plan 15.2 "OCR", "Jobs" | IT: BE-37 AC 1 to 8; the batch is the Submission and the original file downloads through `GET /api/intake/files/:id/original` (digital-born PDF yields text blocks without OCR and a scan triggers tesseract, both with the same output shape; a batch survives an API restart with no job run twice; wrong magic bytes, oversize, over `OCR_MAX_PAGES`, encrypted or corrupt PDF and a bomb sample rejected with BM messages and 4xx without crashing the worker; same sha256 flagged before processing; images served only to the owner Guru and Admin Pusat). |
| BE-FR-23 | The API shall turn a batch into reviewable items, let reviewers edit (keeping the previous AI text), accept (creating a Draf question through the BE-09 service with provenance), reject with a reason or mark duplicates, with every transition audited and provider failures recoverable. | BE-38 | v2-question-bank 4.2, US-04 to US-10, US-16, D40a | IT: BE-38 AC 1 to 8: end to end with the mock provider; the AI cannot reach accept (test through the service API); Guru reviews only own batches, only Admin Pusat approves or bulk-accepts; quality gates of BE-10 enforced on accept; exact and variant duplicates flagged with the matching id; re-extracting a known file hash refused before any provider call; provider failure or exhausted budget leaves the batch recoverable with no duplicate items after retry. |
| BE-FR-24 | The API shall serve the Admin Pusat intake dashboard (submissions by status, queue size and oldest item age, extraction success rate, share of AI tags accepted unchanged per field, duplicate rate) and AI cost this month against the cap. | BE-40 | v2-question-bank US-29, AC-29.1, AC-29.2 | IT: every figure of AC-29.1 equals a hand-computed expectation on seeded fixtures; month boundary tested with rows at 23:59 and 00:01 `Asia/Kuala_Lumpur`; `is_test` rows excluded; Guru, Admin Sekolah, Murid 403. |
| BE-FR-25 | The API shall serve classrooms and enrolments (teacher creates a class with a join code, students join by code, student lists, teacher dashboard counters, teacher chapter and topic helpers) and the shared class lookups other modules read (`forTeacher`, `forStudent`, `roster`, `schoolClasses`). | BE-17 | M10 URS/SRS; data-migration 4.8 | IT: join code is case-insensitive, single-use per student per class, and a wrong or inactive code returns the mock error and BM message; an enrolled student gets the mock's conflict; a teacher sees only own classes (other id 404); dashboard counters equal counts from the tables; enrolment respects the school boundary unless the mock allows otherwise; all responses parse their contract schemas. |
| BE-FR-26 | The API shall serve missions, remedial tests (scan, generate, cancel), teacher question sets and teacher DSKP picks, plus the template downloads (the mock's teacher paper upload `POST /api/guru/question-papers` is served by the intake batch endpoints of BE-37, D53/OWN-1), which feed the practice assigned modes. | BE-18 | M10 SRS; M05 SRS (assigned modes) | IT: a teacher assigns a mission only to an own class and a student outside the class cannot start it; remedial generation picks weak topics from answer-row dimensions, is deterministic with the seeded PRNG, and cancel is idempotent; a deactivated question is skipped at serve time, not deleted from the set; a migrated question set keeps its header and shows the mock's "needs rebuild" state; templates carry correct headers and `Content-Disposition` (BE-NFR-38); non-teacher 403. |
| BE-FR-27 | The API shall serve the M08 performance read models (analytics, class, level and school performance, rankings, leaderboard, item analysis, headcount setup and entry, timeline), scope-filtered, and `GET /api/weekly-report` exactly as the mock (403 for every role until OQ-15 is answered). | BE-19 | M08 URS/SRS (FR-M08-119, FR-M08-120); data-migration 4.6 | IT: aggregates equal a hand-computed fixture (class totals equal the sum of students, ranking order equals score order, ties as the SRS); Guru sees own classes, Admin Sekolah own school, Murid own data and public ranks, out-of-scope id 404; `is_test` rows excluded everywhere; item analysis reads answer-row dimensions, not a live question join; headcount auto-setup idempotent and entry validation with BM messages; weekly report returns the mock's 403. |
| BE-FR-28 | The API shall serve teacher analytics, monitoring and the Kirkpatrick levels (overview, reaction, learning, behaviour, results, chain, own view, filter options) with feedback collection, intervention log and CSV/PDF exports. | BE-20 | M11, M12 URS/SRS; data-migration Q7 | IT: counts equal source rows; Guru and Admin Sekolah only (admin sees all), students may use only `/feedback*` and `/kirkpatrick/me`; scope per role; intervention notes are not logged and are visible to staff in scope only; `faith`, psychometric and wellbeing alert data are not modelled; one feedback submission per period per student as the mock and the status endpoint reflects it; the PDF export starts with `%PDF`; export content type and file name as the mock. |
| BE-FR-29 | The API shall serve the M27 school-admin dashboards, usage and activity reports, monthly report, DSKP heatmap, class list and own-school teacher and student management. | BE-21 | M27 URS/SRS; v2-portals 4.2, US-13 | IT: every route restricted to `school_admin` and `admin` and always filtered to the caller's school (school B data is invisible to school A's admin, 404; a request naming another `schoolId` is rejected); creating a teacher or student attaches the caller's school and a valid role and creating a `school_admin` or `admin` is refused 403; a toggle writes an audit row and cannot disable the caller's own account; the monthly report handles months without data; the mock's impersonate routes are not built (UD-2) and Mod Pelajar is `POST /api/session/mode`. |
| BE-FR-30 | The API shall serve the Command Center and admin aggregates (live data, drill-down school to teacher to class to student, daily activity, evaluate, predictive, achievements, badge holders, server status), answering for teacher (own classes), school admin (own school) and admin (all) from the same endpoints. | BE-22 | M17 URS/SRS; M10 Command Center; v2-portals PM-01 | IT: same endpoint, three roles, three row sets; a teacher cannot drill into a class they do not own and a school admin cannot leave their school (404); counts are consistent across levels (children sum to the parent) and `is_test` data is excluded; conditional GET with `ETag` / `If-None-Match` works and personal data is `Cache-Control: no-store`; `/api/admin/server-status` returns only status flags and versions, never a connection string, admin only. |
| BE-FR-31 | The service shall start from a documented skeleton: validated config, error filter, zod pipe, request-id middleware, response helpers, health endpoint reporting database state, transaction helper, clock, id helpers, seed runner. | BE-01, BE-02 | plan 3, 4, 11 | IT: BE-01 AC 1 to 8 and BE-02 AC 1 to 7; `GET /api/health` returns the envelope with `db: 'up'` and returns 503 in the error shape (`SERVER_ERROR`) when the database is down; the transaction helper commits on success, rolls back on throw and reuses the outer transaction when nested (UT). |
| BE-FR-32 | The repository shall provide deterministic, idempotent, fictitious seeds: core accounts and population (D45, at least 20 students in at least 3 schools in 2 states, at least 4 teachers, one school admin per school, one admin, one dual-role account) and a coherent cross-domain PoC profile. | BE-07, BE-26 (and each domain card's seed module) | `docs/AKAUN-DEMO.md`; D45 | IT: `be:db:seed` twice gives identical row counts and a second run changes nothing; reset then seed gives identical dumps (hash of a data-only dump); every demo account in `AKAUN-DEMO.md` logs in with the expected `landingPath` and scope level and has the data its landing page needs; `verify.ts` passes (wallet equals ledger, no orphans, placements reference published questions); the whole seed runs in under 60 s (BE-26 AC5); seed refuses `NODE_ENV=production` unless `--force-demo`; seeds never set `legacy_*`; a guard test scans seeds for non-fictitious e-mail domains (the card says `example.test`; demo accounts use `demo.test`: card change proposed). |
| BE-FR-33 | All writes made under Mod Pelajar shall be stamped `is_test` and excluded from every aggregate and history seen by others. | BE-03, BE-12, BE-16, BE-19, BE-22 | v2-portals US-07; V2-T19; D31c, D33b | IT: a Mod Pelajar session writes a practice session and a Bijak attempt; class, school, ranking and Command Center aggregates and other users' history are unchanged. |
| BE-FR-34 | The set of routes that need no session shall be exactly the routes the mock registers without `requireAuth` or a role guard, plus health and readiness: public school picker (`/api/schools`, `/api/schools/search`, `/api/jpn`), `/api/public/stats`, login/registration/password-reset routes, public articles, banners and videos where the mock allows, the parent invite token read, `/api/health`, `/api/ready`. | BE-01, BE-05, BE-06, BE-24, BE-25, BE-33 | plan 3 "Authorisation"; v2-portals A4 | CI/IT: the route-inventory test (BE-NFR-01) compares the list of `@Public()` routes with a fixture derived from the mock route table; any difference fails the test. |

### 4.2 Requirements raised by the review and by user decisions

The review found behaviour that the sources require but no card states as an acceptance criterion. These are requirements now; the owning card is asked to add the criterion (section 13.4).

| ID | Requirement | Cards | Source | Acceptance check |
|---|---|---|---|---|
| BE-FR-35 | Question versioning shall follow v2-question-bank 4.6: each question has a stable id and version number; "Sunting" on a Terbit question creates version n+1 as Draf; when n+1 becomes Terbit version n becomes `Diarkib (digantikan)` in the same transaction so there is never a moment with zero live version unless an admin withdraws; practice and Bijak answers record the question id and version served. | BE-09, BE-10 | v2-question-bank 4.6, NFR-08 | IT: publish of n+1 archives n atomically (forced failure leaves n live); answer rows store the version; history is unchanged after an edit. |
| BE-FR-36 | Student question reports shall carry the question and version, use the reasons and statuses of v2-question-bank 4.7 (statuses Menunggu, Disemak, Diperbaiki, Ditolak, Dikeluarkan; comment at most 500 characters), notify the reporter on a status change and become Diperbaiki when the fixing version is Terbit. | BE-10 | v2-question-bank 4.7; M04 URS EP-M04-3 | IT: report create/list/mine/patch per role; comment of 501 characters rejected 422; status moves to Diperbaiki when the linked version is published. The auto-hide threshold is OQ-22. |
| BE-FR-37 | The API shall serve the M18 Amaran Awal routes (school risk page `GET /api/amaran/schools/:id`, executive summary `GET /api/amaran/summary`, own-school effectiveness `GET /api/amaran/effectiveness`, school CSV `GET /api/amaran/export/school/:id`) with the risk model of BR-M18-13/14 computed at request time and never stored. In B1 the roles are `admin`, `school_admin` (own school) and `teacher` (own school or schools of own classes); `ppd_officer` has no endpoints. | BE-21 | M18 SRS section 7 #21, #22, #24, #30; BR-M18-01 to BR-M18-34; matrix row 49; user decision UD-4 | IT: BE-21 AC 8 to 12: access per role (out-of-scope school 403, unknown school 404, teacher export 403); the risk score `0.4A + 0.3E + 0.3M` and the thresholds below 40, below 60 and above, unit-tested; the mock's 422 messages and BM cell texts verbatim; the CSV has a BOM, CRLF, the mock header row, `Cache-Control: no-store`, formula-injection neutralisation, no personal data; every accepted export writes an audit row; `is_test` rows excluded. |
| BE-FR-38 | The API shall serve the 14 M06 routes of the classic SPM hub: overview, databank, Latih Tubi list and setup, Tracking A hub and set list with the set-status rule and the `ramalan` question selection that BE-12 binds to, the Subjektif overview, the SPM mock exam (create, paper without keys, owner-only submit, result) and the simulated walkthrough, plus the Duta recommendation card. Every figure is computed from the owner stores (curriculum, questions, practice); the module owns only the SPM subject configuration, Tracking A sets, mock exams and Duta cards. | BE-41 | M06 URS/SRS; matrix row 13; D53(a) | IT: BE-41 AC 1 to 16: any signed-in role (401 otherwise); `readiness` only for the active role `admin`; set status `belum_cukup`, `bank_besar`, `bersih` by the BR-M06-08 rule; a mock exam paper view never contains `modelAnswer`, `studentAnswer`, `marks` or `feedback` (recursive key scan); a mock of another user is 404; a second submit is 409 "Mock ini sudah dihantar."; a result before submit is 409 `NOT_SUBMITTED`; the Duta pick is deterministic for a given `seed`; the mock's hub constants are computed, not copied. |
| BE-FR-39 | The API shall serve the 21 M07 PKSK routes: the student area (access flags, 15 domains, per-level dashboard, domain sections, a 10-question practice set and its scored submission stored as one M05 session of mode `pksk`, a full exam of 30 + 70 + 1 questions and its scored attempt, attempt history) and the admin area (PKSK question CRUD, stats and bulk action; access grants list, stats, grant and revoke; package list). PKSK questions are tags on the single question bank and are read and written only through the BE-09 service. | BE-42 | M07 URS/SRS; matrix row 19; v2-question-bank A6; D53(a) | IT: BE-42 AC 1 to 19: level `T1` or `T4` only (any other value 404 before the access check); a user without access gets 403 and no question data; no correctness flag in any practice or exam payload (recursive key scan); an invalid answer set gives 422 "Jawapan tidak sah." and writes nothing; PKSK questions never appear in M04 lists or counts; grant, revoke and bulk delete write audit rows without personal data; the access routes are `admin` only; test-mode writes are stamped `is_test`. |
| BE-FR-40 | The API shall serve the 10 M13 Cikgu Alesa routes: the chat turn (any signed-in role, un-enveloped bodies) with a daily quota per role in Malaysia time, and the teacher tools (RPH list, create and detail, essay markings, PBD queue, roll-up, bulk approve, CSV export). Replies, marks and RPH text are produced by the `mock` AI provider by default; a real provider is reached only through the BE-36 adapter. | BE-43, BE-36 | M13 URS/SRS; matrix row 37; D53(a); BE-36 | IT: BE-43 AC 1 to 15: the chat bodies are exactly `{thread_id, reply, tier, turns_remaining, tool_hops, tokens}`, 429 `{"quota_exhausted": true}` and, for a guest, 401 with body `{}`; a teacher has 30 turns a day, a student 10, an admin 100, and 40 parallel teacher turns store exactly 30; the quota resets after 00:00 `Asia/Kuala_Lumpur`; a foreign thread or row is never revealed (404); CSV cells beginning with `=`, `+`, `-` or `@` are neutralised; a provider failure or `AI_BUDGET_EXHAUSTED` stores nothing and uses no quota turn; no essay text or student name reaches the provider outside the redacted payload. Uses the `generateText` method of the BE-36 adapter (BE-36 AC 9; OQ-29 closed). |
| BE-FR-41 | The API shall serve the Battle arena as the prototype does: lobby, quick-match and school-battle queues with deterministic bot opponents, invitations, join-queue requests, forfeit, a keyless ten-question arena with server-side scoring and winner rule, battle history, student and school standings computed from finished and forfeited battles, one school battle page, and the tournament banner, list, detail and admin create. Real-time multiplayer is out of scope. | BE-44 | M16 URS/SRS; matrix rows 21, 23; D53(a) | IT: BE-44 AC 1 to 17: raw routes answer errors as `{"error": "<BM text>"}`; a queue expires after 120 s or 10 s without a poll; a battle, queue or invitation is visible only to its participants (documented not-found answer, never 403 on a resource id); no battle response contains an answer key (recursive scan); the 3-poll match, the expiries and the 24 h invitation expiry are tested with a fixed clock and the seeded PRNG; windows are Monday-based weeks and calendar months in Malaysia time; the two tournament admin routes are `admin` only. |
| BE-FR-42 | The API shall serve the Permainan area as the prototype does: the games hub and lobbies, six room games with deterministic bot players and server clocks, the Papan Bijak quick match, five single-player games with plausibility-checked results, the daily Roda Nasib spin, Jutawan Ilmu with 50:50, the weekly competition board, leagues with invite codes, the Sekolah Bersaing weekly board and the admin game settings. Game coins are credited only through the M14 owner service and only when the setting allows. Real-time multiplayer is out of scope. | BE-45 | M16 URS/SRS; matrix rows 21, 33, Admin Sekolah row 45; D53(a) | IT: BE-45 AC 1 to 21: one Roda Nasib spin per Malaysia day enforced by a unique constraint; room settlement happens once per room; every coin credit goes through the M14 service and is idempotent; implausible solo results are rejected; league invite codes and the Sekolah Bersaing board are scoped as the mock; the admin game settings are `admin` only; time and randomness come from the injected clock and seeded PRNG. |
| BE-FR-43 | The API shall serve the 5 buyer routes of the Marketplace (category list, product search, product page that counts a view, WhatsApp hand-off that counts a click and returns a `wa.me` URL, public shop page). There is no cart, order or payment (D14) and the server never sends a message. | BE-46 | M20 URS/SRS; matrix row 32; D14; D53(a) | IT: BE-46 AC 1 to 9: a draft or rejected product, or one of a non-active seller, is absent from search, related and shop and answers 404 with no counter change; the four sorts and their tie rules equal the mock; a product page call increments `views` by exactly 1 (20 parallel calls give exactly 20); the WhatsApp route returns the exact URL, counts a click only for a seller product and calls no outbound HTTP client; any signed-in role gets 200, no session 401. |
| BE-FR-44 | The API shall store one foster-family application submitted by a signed-in user from the student page "Mohon Keluarga Angkat": validation as the mock, the applicant and role taken from the session, status `pending`, a reason cut at 5,000 characters. The Penaja role, sponsor tables and admin review are out of scope (D48). | BE-47 | M21 URS/SRS; matrix row 15; D48; D53(a) | IT: BE-47 AC 1 to 8: 201 `{data: {id}}` with a decimal-string id; every field message and the several-errors summary as the mock; an unknown student e-mail gives "Email pelajar tidak dijumpai dalam PrestasiPlus."; `applicantUserId` and `applicantRole` in the body are ignored; no duplicate check; no notification, e-mail or audit row containing the reason; no session 401. |
| BE-FR-45 | The API shall serve the Heatmap Topik Lemah of the signed-in learner, grouped by subject and computed on every request from the practice answer log through a BE-13 read method; it creates no table and makes no AI call. | BE-48, BE-13 | M25 URS/SRS; matrix row 14; D12; D53(a) | IT: BE-48 AC 1 to 9: a chapter with 4 attempts is hidden and with 5 is shown; percent and colour band edges (49.5 gives 50, 79.5 gives 80); ties order by name then numeric chapter id; `?userId=` is ignored and a teacher or parent session gets 403; for every shown cell attempts and correct equal the BE-13 aggregate; the response is unchanged when every answer's `question_id` is null and `historical` is true; the grouping query median is under 200 ms on 20 students with a generated 100,000-row answer table (a miss is a finding, not a blocker). |

## 5. Non-functional requirements (BE-NFR)

### 5.1 Security and authentication

| ID | Requirement | Cards | Source | Acceptance check |
|---|---|---|---|---|
| BE-NFR-01 | Authorisation shall be default-deny: a global `AuthGuard` applies to every route, public routes opt out explicitly with `@Public()`, and a protected controller without a role or capability decorator fails a CI test. | BE-03, BE-33 | v2-portals NFR Security, A4 | IT: a route-inventory test lists all routes and asserts each has an auth rule and that the public set equals BE-FR-34; SEC. |
| BE-NFR-02 | Sessions shall be server-side in PostgreSQL; cookie `HttpOnly`, `Secure` (production), `SameSite=Lax`, domain from configuration; the session id regenerates on login, role switch and mode change; logout invalidates server-side; an expired session returns 401; no token appears in any response body (only `csrf`). An idle session expires after 120 minutes without "Ingat saya" (sliding, M01 BR-06 OBSERVED); the "remember" duration and any absolute maximum lifetime are OQ-6. | BE-03, BE-33 | contract; plan 3 "Auth"; v2-portals NFR; M01 BR-06 | IT: fixation, expiry (fixed clock at 119 and 121 minutes) and logout tests; cookie flag assertion per environment; response-body scan for tokens; SEC. |
| BE-NFR-03 | Every non-GET request made with a valid session shall require a matching `X-CSRF-Token`; a missing or wrong token returns 403 `CSRF_INVALID`. Routes that are used without a session (login, registration, password reset) are exempt; logout needs the token when a session exists. No Bearer token is accepted anywhere on the real API. | BE-03, BE-33 | contract `CSRF_INVALID`; plan 7 | IT: one test per mutating route group (BE-33 AC1); a request with `Authorization: Bearer` and no cookie is 401. |
| BE-NFR-04 | Login, registration, password reset, file upload and ticket creation shall be rate limited; a breach returns 429 `RATE_LIMITED` with `retryAfter` in the body and the `Retry-After` header; a login success resets the login counter. Limits: login from `THROTTLE_LOGIN_PER_MINUTE`; password-reset request one per 60 s per e-mail (M01 BR-10); registration, upload and ticket limits have no source (OQ-9). | BE-03, BE-33 | contract `RATE_LIMITED`; M01 SRS BR-02, BR-10; BE-33 AC2 | IT with a fixed clock for login and reset; for the others a test proves a limit exists and returns the shape, with the configured value recorded in the runbook. |
| BE-NFR-05 | Scope shall come only from the account on the server. A request schema containing a scope or school field that the caller must not set is rejected; an id outside the caller's scope returns 404 (never 403); extra body fields are rejected (strict schemas, no mass assignment). | BE-03; every domain card | ADR-0017; V2-T20; BE-33 AC1 | IT: sampled cross-user and cross-school read per domain returns 404; a strict-schema test with an unknown field returns 422 `VALIDATION_ERROR`. |
| BE-NFR-06 | Passwords shall be stored only as hashes: argon2id for new hashes; legacy bcrypt `$2y$` verifies as `$2b$` and is rehashed on the first successful login; accounts on the shared default hash or with a non-bcrypt hash are flagged `must_reset_password` and forced through reset on first login; Sanctum tokens and `remember_token` are not migrated. | BE-03, BE-06, BE-28 | plan 3; data-migration 5; T-04 | IT: a generated `$2y$` hash verifies and is rehashed; a flagged account must reset before it can proceed; log-capture test finds no password or hash. |
| BE-NFR-07 | Input handling shall be safe: all SQL parameterised, global body-size and request-timeout limits, `helmet` headers, CORS off (same origin via nginx), no stack trace or SQL in 500 responses. | BE-01, BE-33 | plan 3 "Rate limit / security" | IT: SQL-injection strings on search endpoints do not change results; an oversized body is rejected; header assertions; a forced 500 has the error shape and no stack. |
| BE-NFR-08 | An append-only audit trail shall record role switch, mode enter and exit, login failures, user create, delete and toggle, subscription changes, complimentary toggles, password reset, question publish, every intake transition, paper publish and withdraw, and lucky-draw results, with actor, role, scope, action, target and request id and never personal content. | BE-03, BE-10, BE-25, BE-33, BE-38, BE-39, BE-23 | v2-portals NFR Security; v2-question-bank NFR-06 | IT: one test per audited action (BE-33 AC4); REV: no UPDATE or DELETE path to `audit_events` in code. |
| BE-NFR-09 | Dependencies and images shall be scanned: a secret scan on every PR, `npm audit --omit=dev` and an image scan fail the build on high or critical findings, with a documented allow-list file. | BE-01, BE-33 | plan 9 "CI expectations"; BE-33 AC6 | CI: the pipeline fails on a planted test secret and on a seeded vulnerable dependency (demonstrated once on a throw-away branch and documented in the PR). |
| BE-NFR-39 | A change to a user's role, scope, school or active flag shall take effect on the next request without re-login: role, scope and capabilities are derived from the account at each request (or the session is invalidated on change), never trusted from a stale session snapshot. | BE-03 | v2-portals NFR Availability; ADR-0017 | IT: change a user's school or deactivate the account through the BE-05 service and the next request with the old cookie shows the new scope or 401. Not yet a BE-03 AC (card change proposed). |

### 5.2 Data protection and PDPA

| ID | Requirement | Cards | Source | Acceptance check |
|---|---|---|---|---|
| BE-NFR-10 | Identity card (IC) numbers shall never be stored or logged in clear; only a hash and a masked tail are stored, and responses return only the masked value. | BE-03, BE-05, BE-06, BE-28 | data-migration 5; T-03; BE-05 AC4 | IT: no column holds a plain IC after a create and an import; a log-capture test finds none. |
| BE-NFR-11 | Personal data of users, most of them minors, shall be minimised: responses contain only fields the matrix allows for the caller's role and scope; no personal data (names, e-mail, phone, IC, free text) appears in logs, error bodies, audit content, metrics or the `etl_rejects` table. | every domain card, BE-33 | SRS NFR-05; v2-portals NFR Privacy; plan 3 "Logging" | IT: log capture across a login, a registration and an import; SEC. |
| BE-NFR-12 | Seeds, fixtures, tests, docs and logs shall contain only fictitious data. The only credential allowed in a seed is the demo password for seeded demo accounts. | every card | AGENTS.md section 7; plan 9 | CI: secret scan; REV: PR checklist item "no secrets, no real names, no personal data". |
| BE-NFR-13 | Real or anonymised dumps, `.migration-out/`, `*.dump`, `*.sql.gz` and any file over 1 MB under `apps/api/test/migration/` shall never enter git, a PR or CI artifacts. | BE-27, BE-34, BE-35 | plan 14.8; BE-27 AC4; BE-34 outputs | CI: a check fails when such a file is staged. |
| BE-NFR-14 | Retention shall be configurable and enforced for intake files and page images (default: while the batch is open and 12 months after publish; `INTAKE_RETENTION_MONTHS`) and for the intake audit trail (default 5 years). Data-subject rights for users (access, correction, erasure), parent consent and inactive-account retention have **no rule yet** (OQ-3). | BE-37, BE-38 | v2-question-bank NFR-12; OD-16 | RUN: the retention job on a fixed clock removes intake files 12 months after publish and keeps open batches. The user-data part is blocked on OQ-3. |

### 5.3 Performance and reliability

| ID | Requirement | Cards | Source | Acceptance check |
|---|---|---|---|---|
| BE-NFR-15 | Performance targets that are defined in the sources shall be met and recorded in the PR (local developer machine, 20 seeded students plus a generated table of 100,000 answer rows where stated): student dashboard query at most 200 ms (BE-13 AC5); class dashboard queries at most 300 ms (BE-19 AC7); Command Center live-data p95 at most 300 ms with `EXPLAIN` recorded (BE-22 AC4); full PoC seed at most 60 s (BE-26 AC5); an intake 40-question paper extracts in at most 10 minutes (p90), the review queue pages 5,000 open items (v2-question-bank NFR-02); ETL throughput for 1,000,000 synthetic answer rows is **measured and recorded**, no threshold (BE-29 AC7). For every other endpoint there is **no target** (OQ-1). | BE-13, BE-19, BE-22, BE-26, BE-29, BE-37, BE-38 | the cards named in each clause; v2-question-bank NFR-02 | IT with timing assertions (loose, to catch regressions) and the figures pasted in the PR; intake timing measured once in the BE-38 PR with the mock provider; the 2 s review-screen figure of NFR-02 is a UI figure on 4G and is not an API target. |
| BE-NFR-16 | Every list endpoint shall be paginated with `pageSize` at most 100 (default 20, contract `PageQuerySchema`); filters and sorts used by the scope filter shall be backed by indexes; aggregates are computed in SQL, not by loading tables into memory; ordering has a deterministic tie-break. | every list card | contract `PageQuery`; SRS FR-G-07 | IT: `pageSize=101` is rejected 422 as the contract says; REV: migration reviewed for the indexes of the scope columns; invalid `page` values: OQ-27. |
| BE-NFR-17 | A multi-store write shall be atomic. Practice submit, Bijak submit and marking, intake accept, wallet credit with its source, reward redemption and each ETL batch each run in one database transaction; a forced failure leaves no partial rows; no network or file I/O runs inside an open transaction. | BE-11, BE-12, BE-16, BE-23, BE-34, BE-38 | ADR-0014 section 2; plan 14.5 | IT: inject a throw after the middle step and assert zero new rows (BE-12 AC1 pattern); REV: no `fetch`/storage call inside `tx.run`. |
| BE-NFR-18 | Mutations that a client can retry shall be idempotent: practice sessions by `clientUuid`, Bijak submit by `idempotencyKey`, wallet credits by source key, challenge completion by user and Malaysia day, intake extraction by file hash, jobs by file hash plus stage, ETL by `(legacy_source, legacy_id)`. Idempotency relies on a unique constraint, not on read-then-write. | BE-11, BE-12, BE-16, BE-23, BE-34, BE-37, BE-38 | contract `ClientUuid`; plan 15.2, 14.1 | IT: replay the same request twice (and two concurrent requests); one row, same response. |
| BE-NFR-19 | Time shall be handled uniformly: stored as UTC `timestamptz`; serialised with `+08:00`; day logic (streaks, daily limits, quests, monthly dashboards) in `Asia/Kuala_Lumpur`; all code reads time from an injectable `Clock`, never `Date.now()` or `new Date()` in services. | BE-02, BE-11, BE-12, BE-16, BE-40 | contract `common/time.ts`; OD-8 | UT/IT with a fixed clock at 23:59 and 00:00 +08:00; REV or lint rule for `Date.now`; CT: every response timestamp matches `TimestampSchema`. |
| BE-NFR-20 | Selection, generation and seeds shall be deterministic for a given seed (seeded PRNG, no `Math.random`). | BE-02, BE-09, BE-12, BE-15, BE-18, BE-23, BE-26 | ADR-0006; BE-02 AC4 | IT: the same seed gives the same question list, generated paper, remedial set, draw and seed data. |
| BE-NFR-21 | Background work shall survive restarts and never run twice: jobs live in a table, are claimed with `FOR UPDATE SKIP LOCKED`, have attempts, backoff and idempotency keys, and a stuck-job sweeper; the Bijak sweeper closes expired attempts after the grace period; the process finishes in-flight requests on SIGTERM and closes the pool. | BE-16, BE-33, BE-37 | plan 15.2 "Jobs"; BE-16 AC5 | IT: kill and restart mid-batch; sweeper test with a fixed clock; RUN: SIGTERM test of the container. |

### 5.4 API conventions, errors and BM messages

| ID | Requirement | Cards | Source | Acceptance check |
|---|---|---|---|---|
| BE-NFR-22 | Errors shall use `{ error: { code, message, fields?, details?, retryAfter?, requestId } }` with the HTTP status of `ERROR_STATUS` / `AUTH_ERROR_STATUS` (422 `VALIDATION_ERROR`, 404 `NOT_FOUND`, 401 `UNAUTHORIZED`, 403 `FORBIDDEN`, 409 `CONFLICT`, 500 `SERVER_ERROR`, 429 `RATE_LIMITED`); unknown routes, validation failures and unhandled errors use the same shape; `requestId` is in every error body and in the `X-Request-Id` response header (taken from the request header when present). | BE-01 | contract `common/error.ts`, `auth/errors.ts` | CT: a negative test per generic code; BE-01 AC3. |
| BE-NFR-23 | User-visible `message` text shall be copied **exactly** from the mock handler, SRS or contract (`AUTH_ERROR_MESSAGES`). Messages are never reworded, translated or "improved". Where the mock or SRS has no copy, use the proposed copy in the contract or raise a question. Generic mock messages and validation `fields` texts are English Laravel defaults in the mock while the contract calls `message` BM: OQ-4. | every card | CLAUDE.md section 6; plan 6.1 | IT asserts the exact string for each error path; a copy-diff table (mock string, API string, identical yes/no) is part of every PR. |
| BE-NFR-24 | Success bodies shall be `{ data }`, `{ data, meta }` (ListMeta: `page`, `pageSize`, `totalItems`, `totalPages`, `from`, `to`, optional `counts`) or, where the mock deliberately returns a live-shaped body (`raw`), exactly that body. Out-of-range pages return an empty page that keeps the requested `page`; `from` and `to` are `null` on an empty page; `totalPages = max(1, ceil(totalItems / pageSize))`. Extra mock keys next to `data` (for example `status` flash text) are preserved. | every list card | `src/mock/server/paginate.ts`; contract `ListMeta`; SRS 7.2 | CT: list responses parse `listEnvelopeOf`; IT: out-of-range, empty and last-page cases. |
| BE-NFR-25 | Wire formats shall follow the contract: ids are opaque strings (bigint as decimal string, UUID for sessions and attempts, never parsed or compared numerically by clients); timestamps `+08:00`; enum codes in English; money `numeric(10,2)` RM (integer sen where the source uses sen); request schemas strict; mock paths (including BM paths such as `/api/kelas-saya`, `/api/tiket`) kept unless an SRS or the lead says otherwise; `legacy_*` keys never appear in any response. | every card | contract `common/`; plan 5, 6.1; OD-9; BE-31 | CT: every response in tests is parsed by the contract schema (plan 10 item 2); the conformance suite fails if any response contains a `legacy_` key. |
| BE-NFR-26 | The contract shall be written first and be the acceptance test: `openapi.json` is generated, never hand-edited; `contract:check` fails when stale; an OpenAPI diff gate fails CI on a removed field, narrowed enum or newly required field unless the PR carries the label `contract-breaking`; a conformance suite runs the same scenarios against the mock and the API, prints the share of operations covered, and is required at 100% for the carded domains once wave 4 is reached. | BE-31; every card | ADR-0018; plan 6.2; BE-31 AC 1 to 5 | CI: `contract:check`; BE-31 AC 1 to 5 (two sample diffs demonstrate the gate; a schema-violating field fails a conformance test). |
| BE-NFR-37 | Rich text written through the API (article bodies, Perutusan) shall be sanitised on write: no script, event-handler attribute or `javascript:` URL survives. | BE-24 | BE-24 AC2; OWASP | IT: a body with `<script>` and an `onerror` payload is stored without them. |
| BE-NFR-38 | Every CSV/XLSX/DOCX export and template shall neutralise formula injection (cells starting with `=`, `+`, `-` or `@`) and send correct `Content-Type` and `Content-Disposition` (file name as the mock). | BE-10, BE-18, BE-20, BE-21 | BE-18 AC5; BE-20 AC5; BE-21 AC6 | IT: a cell value `=1+1` is exported neutralised; header and file name assertions. |
| BE-NFR-40 | HTTP caching and content headers shall be explicit: JSON containing personal data is `Cache-Control: no-store`; file downloads send the stored `Content-Type`, `X-Content-Type-Options: nosniff` and a private cache policy; polled aggregates (Command Center) support `ETag` / `If-None-Match`. | BE-04, BE-22, BE-33 | BE-04 outputs; BE-22 AC3 | IT: header assertions on a personal-data read, a file download and a conditional GET returning 304. |

### 5.5 Observability and logging

| ID | Requirement | Cards | Source | Acceptance check |
|---|---|---|---|---|
| BE-NFR-27 | Logs shall be structured JSON (pino) carrying `requestId`, method, route pattern, status, duration, actor id and role code, with `cookie`, `authorization`, `password`, IC and e-mail redacted; request bodies and AI prompts or responses are never logged; log level from `LOG_LEVEL`. | BE-01, BE-33 | plan 3 "Logging"; BE-01 AC5 | IT: log-capture test (BE-03 AC9, BE-01 AC5). |
| BE-NFR-28 | The service shall expose liveness (`/api/health`) and readiness (`/api/ready`: 200 only when the database is reachable and all migrations are applied, otherwise 503; no auth) and a request-duration signal or `/api/metrics` guarded to the internal network or admin. | BE-02, BE-33 | BE-33 outputs | IT: ready returns 503 with a pending migration; metrics denied to a student (exposure: OQ-8). |

### 5.6 File uploads

| ID | Requirement | Cards | Source | Acceptance check |
|---|---|---|---|---|
| BE-NFR-29 | Uploads shall be validated by content (magic bytes) and size per use and rejected with the mock's status and BM copy (422, 413): avatar jpeg, png, webp up to 2 MB (M01 BR-15); Bijak working photo jpeg or png up to 5 MB and at most 3 per part (m28 `photo-store`); intake files PDF or images up to `INTAKE_MAX_FILE_MB` (20 default); `question_image` and `cms_image` limits have no source (OQ-23, global `MAX_UPLOAD_MB` applies). Storage keys never contain the client file name; files are private and served only through authenticated, scope-checked endpoints; no storage path leaks in responses. | BE-04, BE-06, BE-16, BE-37 | v2-question-bank NFR-06; BE-04 AC; M01 BR-15 | IT: renamed file rejected, `../` name harmless, other user's file 404, per-use limits enforced; SEC. |
| BE-NFR-30 | Untrusted PDFs shall be processed safely: scripting disabled in pdfjs, no external fetch, page cap (`OCR_MAX_PAGES`, default 200), size cap (`INTAKE_MAX_FILE_MB`, default 20), per-page timeout (`OCR_PAGE_TIMEOUT_MS`), bomb and encrypted samples rejected, OCR in worker threads with bounded concurrency (`OCR_WORKERS`) so the HTTP event loop is not blocked, memory under a documented ceiling on a 50-page fixture. | BE-37 | plan 15.2; OD-15, OD-16; BE-37 AC 3, 6, 7 | IT: BE-37 AC 3, 6, 7 with generated PDFs (JavaScript and external-link PDF executes and fetches nothing). Malware scanning: OQ-5. |

### 5.7 AI provider abstraction, cost and OCR

| ID | Requirement | Cards | Source | Acceptance check |
|---|---|---|---|---|
| BE-NFR-31 | AI access shall go through one `ExtractionProvider` interface (`id`, `capabilities`, `extractPaper`, `suggestTags`, `generateText`, `healthCheck`) with adapters `mock` (default in dev, test and CI), `anthropic`, `openai`, `gemini`, `openai-compatible`; one is selected by `AI_PROVIDER`; swapping it changes no caller code; CI makes no network call to a provider. | BE-36 | plan 15.2; D52; OD-14 | IT: the same contract-test suite passes per adapter with recorded fixtures; a network-blocked CI run is green. |
| BE-NFR-32 | AI keys shall exist only in the server environment or deployment secret store: never in the database, the frontend bundle, logs, responses or error messages; the admin status endpoint returns only `configured` yes/no, provider and model id. | BE-36 | v2-question-bank NFR-04 | IT: grep test over captured logs and responses; SEC. |
| BE-NFR-33 | Before every provider call a redaction step shall mask cover-page names, school and contacts; the request carries content and taxonomy only; no user, student, teacher or school identifier is ever sent and none is stored in the extracted payload. | BE-36, BE-38 | v2-question-bank NFR-04, AC-04.8 | IT: canary test planting names and contacts on a cover page (BE-36 AC2, BE-38 AC8); SEC. |
| BE-NFR-34 | AI calls shall be bounded and costed: concurrency cap `AI_MAX_CONCURRENCY`, requests per minute `AI_RATE_LIMIT_PER_MIN`, per-run timeout `AI_TIMEOUT_MS`, retry with backoff on 429 and 5xx; exactly one `ai_usage_logs` row per call (provider, model, tokens, `cost_sen`, no content); `AI_MONTHLY_BUDGET_SEN` notifies Admin Pusat once at 80% and at 100% new extractions are refused with `AI_BUDGET_EXHAUSTED` so callers queue; a file hash already imported is refused before any cost. The per-paper cost ceiling of RM 2.00 for a 40-question paper is a default to be validated (OD-14), not a gate. | BE-36, BE-38, BE-40 | v2-question-bank NFR-03, AC-06.4, AC-29.2; plan 15.2 | IT: burst test; budget thresholds with a fixed clock (one notification at 80%, refusal at 100%); BE-36 AC 4 to 6. |
| BE-NFR-35 | `AI_BASE_URL` for the openai-compatible adapter shall be https, on an allow-list, and not a private, link-local or loopback address (SSRF). The AI service returns drafts only: its output type has no status beyond `draft` and it has no approval operation. | BE-36, BE-33 | plan 15.4; AC-05.6 | IT: SSRF cases (http, private IP, loopback, host not on the list); type-level test of the output; SEC. |
| BE-NFR-36 | Extraction quality targets of v2-question-bank NFR-01 (segmentation, text accuracy, answer-key match, tag accuracy, calibration) are **targets measured on the pilot sample set**, not CI gates; missing a target raises the review threshold, never enables auto-approval. | BE-36, BE-38 | v2-question-bank NFR-01, Q2 | PILOT: measured once the lead supplies sample PDFs (OQ-7). |

## 6. Migration requirements (BE-MIG)

These implement plan section 14 and `v2-data-migration.md`; they do not redesign them. The source is prestasiplus.cloud, read-only; prestasiplus.my is not a source until OD-13 is answered. Where `v2-data-migration.md` or the contract comments say `legacy_cloud_id`, plan 14.2 (`legacy_source` + `legacy_id`) wins (section 13.2).

| ID | Requirement | Cards | Source | Acceptance check |
|---|---|---|---|---|
| BE-MIG-01 | Every table that can receive migrated rows shall carry `legacy_source` (check in `cloud`, `my`), `legacy_id` (text) and `unique (legacy_source, legacy_id)`, optionally `legacy_hash`; these columns never appear in the contract or any response; the model is listed in `apps/api/prisma/migratable-models.json`. | BE-34; every schema card | plan 14.2, 14.9 item 1 | CI: `be:lint:migration` (added by BE-34, then part of `be:verify`) fails on a fixture model lacking the unique index (BE-34 AC5); CT: no response contains a `legacy_` key. |
| BE-MIG-02 | ETL control tables `etl_runs`, `etl_checkpoints`, `etl_id_map`, `etl_rejects`, `etl_recon` shall exist and be the only run ledger (no `migration_*` tables). | BE-34 | plan 14.4 | IT: BE-34 AC 4 and 7 (a reject row holds entity, `legacy_id`, reason and column but no row values; killing a run after batch N and re-running continues at N+1 with identical final data). |
| BE-MIG-03 | Loading shall be idempotent: a shared `upsertByLegacy` helper makes a second run produce the same database; unchanged `legacy_hash` rows are skipped; rows with `legacy_source IS NULL` are never touched; every card that adds a table tests a double insert through the helper. | BE-34, BE-28, BE-29; every schema card | plan 14.1, 14.9 item 6 | IT: BE-34 AC 1 and 2; one such test per added table. |
| BE-MIG-04 | The runner shall default to `--dry-run` (writes rolled back or into a throw-away schema); `--apply` requires a passing dry-run on the same input hash and exits non-zero otherwise. | BE-34, BE-30 | plan 14.5 item 3 | IT: BE-34 AC3 (a dry-run changes no non-`etl_*` table). |
| BE-MIG-05 | The source connection shall verify its role is read-only and abort before reading anything if the credential can write; the only connection to .cloud is a configurable `CLOUD_SOURCE_URL`; developers never receive credentials. | BE-27 | plan 9, 14.1 item 4 | IT: a role with INSERT aborts (BE-27 AC2); no connection string in logs, docs or tests (AC5). |
| BE-MIG-06 | A staging schema `staging_cloud` shall mirror the migrated and archived .cloud tables with permissive types, and a profiling report shall list per table row counts, enum distinct values (cap 50), null ratios, orphan counts per declared foreign key, duplicate counts for `users.email` and `(school_id, username)` and a password-hash prefix histogram, without printing any personal value. `staging_my` exists as an empty extension point (OD-13). | BE-27 | plan 14.3; MIG-01 of v2-data-migration | IT on synthetic fixtures; report content assertion (BE-27 AC3). |
| BE-MIG-07 | No guessing: an unknown enum value, orphan, duplicate or invalid value goes to `etl_rejects` with a reason code (`UNKNOWN_ENUM`, `ORPHAN_PARENT`, `DUPLICATE_KEY`, `INVALID_VALUE`, `UNSUPPORTED`) and the offending value or its hash only, and is counted in reconciliation; nothing is silently coerced; a role code outside the seven .cloud roles is rejected, not defaulted. | BE-28, BE-29, BE-34 | plan 14.1 item 3; BE-28 AC1 | IT: a fixture with nasty rows; the reject table inspected (no row values); loaded + rejected = source per entity. |
| BE-MIG-08 | The core load (reference data, schools with derived JPN/PPD, users with roles and scopes, parent links, classrooms and rosters, subscriptions) shall follow the load order of v2-data-migration 6.1, resolve parents through `etl_id_map`, load self-references in two passes with deferrable foreign keys, derive `user_scopes` for migrated `pegawai_ppd` accounts from the officer's school (D31a; underivable accounts are listed), detect the shared roster default hash at run time from a value supplied by the lead (never stored in the repo), and never read or copy the roster seed JSON files of the old reference repository. | BE-28 | plan 14.5, 14.7; OD-10; BE-28 AC 1 to 8 | IT: orphan query returns 0 after `migrate:validate`; two-pass test (BE-34 AC6); dry-run writes nothing and a second apply changes nothing; migrated and seeded rows coexist without id collisions. |
| BE-MIG-09 | The activity load (practice sessions and answers, exam attempt headers and scores, wallets and ledger, challenges, achievements, shop, feedback, interventions, content, tickets, notifications) shall use the historical snapshot approach: curriculum dimensions and correctness copied onto the row, nullable `question_id`, `historical = true`, soft references `legacy_question_ref`, `legacy_content_hash`, `source_natural_key`; question-dependent working state is dropped. Exam questions are never loaded. Content file paths are rewritten after the files are copied with a checksum to a `FileStorage` key (T-10). | BE-29 | v2-data-migration 3.3; D29a; plan 14.7 (T-07, T-10) | IT: migrated answer rows count in statistics without a question link and mastery from them equals the .cloud answer log for a fixture; no question table receives .cloud rows; per-table checkpoint resume after an injected failure. The T-10 file-copy check is not yet in BE-29's AC (card change proposed). |
| BE-MIG-10 | Sensitive source columns that v2 does not keep (plain IC, `faith`, `google_id`, psychometric detail, wellbeing alerts, tokens) shall be dropped at extract time and never reach a v2 table or log; mood, foster and chatbot data move only after an explicit decision (Q7); the ledger `balance_after` is kept and reconciled, never corrected. | BE-28, BE-29 | plan 14.2, 14.6; v2-data-migration Q7 | IT: a schema scan finds no such column; reconciliation reports wallets whose balance differs from the ledger sum and does not change them. |
| BE-MIG-11 | Reconciliation shall report per entity: source count, eligible after documented exclusions, loaded (inserted, updated, unchanged), rejected by reason, `expected_delta`, status, plus the semantic checks (counts, sums, distinct sets, sample parity, accepted drift) as aggregates only in `.migration-out/`. | BE-30 | plan 14.6 | IT: `migrate:verify` is green on fixtures (BE-30 AC1). |
| BE-MIG-12 | A delta run `--since <timestamp>` shall load only changed source rows and be idempotent; cutover uses a freeze because source deletes are not propagated. | BE-30 | plan 14.5 item 4 | IT: BE-30 AC2 (a changed fixture row updates only that row; a repeat changes nothing). |
| BE-MIG-13 | Rollback shall be a tested procedure that restores the pre-migration state by dropping the v2 data schema or tables, and the source shall be provably untouched (checked by privileges, not by trust). | BE-30 | BE-30 AC3 | RUN: rehearsal on a staging copy with evidence in the runbook. |
| BE-MIG-14 | An anonymiser, run only by the lead, shall be default-deny (a column without a rule aborts and names the column), replace every personal column with a deterministic HMAC pseudonym so relations and duplicates survive, replace password hashes with the hash of a known dummy, keep structure, enums, null ratios and counts, and run a leak scan that fails on any original value. | BE-35 | plan 14.8; OD-18; BE-35 AC 1 to 4 | IT on a fixture: same person maps to the same fake across tables, a different key gives different pseudonyms, a planted real-looking value fails the leak scan, no original hash appears. |
| BE-MIG-15 | A deterministic synthetic fixture generator (sizes `tiny`, `small`, `medium`; `--seed N`) shall emit the `staging_cloud` shape with deliberate nasty cases (orphans, duplicate e-mails, unknown enums, non-bcrypt and shared-default hashes, users without e-mail, date-only edges, cycles, attempts whose legacy question is missing), with fictitious names; the committed sample is under 1 MB. | BE-35 | plan 14.8; BE-35 AC 5, 6 | IT: the `small` set loads into staging and the profiler reports the planted anomalies with counts equal to the generator manifest. |
| BE-MIG-16 | The optional post-reload backfill shall set `question_id` only when exactly one candidate matches (natural key plus content hash), list ambiguities, never overwrite a non-null `question_id` and never change correctness or dimensions. | BE-30 | v2-data-migration MIG-09 | IT: BE-30 AC4. |
| BE-MIG-17 | Every card that adds or changes a column or table shall add or update its row in the mapping matrix (plan 14.7) in the same PR; enums are `text` plus `check`; anything the source may lack is nullable or has a documented default; seeds never set `legacy_*`. | every schema card | plan 14.9 | REV: PR checklist item; the lead rejects a PR without the matrix row. |

## 7. Operations requirements (BE-OPS)

| ID | Requirement | Cards | Source | Acceptance check |
|---|---|---|---|---|
| BE-OPS-01 | The `api` image shall be multi-stage (base `node:22.22.2-alpine`), run as a non-root user, work with a read-only root filesystem and a tmpfs, and include a health check. | BE-01, BE-33 | plan 4; BE-01 AC6 | CI: image build; RUN: `docker run --read-only --tmpfs /tmp` starts and prints the node version (BE-33 AC5). |
| BE-OPS-02 | The `db` service shall be `postgres:16-alpine` with a named volume `pgdata`, a health check and **no published host port by default**; `api` depends on a healthy `db`; data survives `down` and `up`; credentials come from the git-ignored `.env.db`. | BE-02 | plan 11; BE-02 AC 1, 5, 7 | RUN: `docker compose up -d db` becomes healthy; `docker compose config` shows no inline secret; data survives a restart. |
| BE-OPS-03 | Configuration shall come from environment variables validated by a zod schema at start-up; a missing key fails fast with a readable message; `.env.api.example` lists every key of plan sections 11 and 15.3 that exists at that point with placeholders only; `.env.api` and `.env.db` are git-ignored. | BE-01, BE-02, BE-36, BE-37 | plan 11, 15.3 | IT: start with a missing key fails with a readable message; CI: secret scan. |
| BE-OPS-04 | Migrations shall be applied by `prisma migrate deploy` as a one-off job before the API starts; `be:db:reset` refuses to run when `NODE_ENV=production`; the pipeline applies migrations to an empty database and on top of the previous head; a merged migration is never edited. | BE-02, BE-32 | plan 7, 10 item 4; BE-02 AC1 | CI: both migration paths; IT: reset refuses in production mode; the `migrate` job runs once, is idempotent and `api` waits for it (BE-32 AC4). |
| BE-OPS-05 | The compose stack shall serve the SPA and proxy `/api` to the API on one origin (frontend on port 5192), with `client_max_body_size` matching `MAX_UPLOAD_MB` and `INTAKE_MAX_FILE_MB`, proxy read timeouts that fit uploads and polling, no caching of `/api` and a kept `/healthz`; Vite dev proxies `/api` to port 3000 with no CORS configuration. | BE-32 | plan 7; BE-32 AC 1, 2 | RUN: `docker compose up -d --build`, `curl /api/health` through nginx returns the envelope, the login cookie is `HttpOnly; SameSite=Lax`. |
| BE-OPS-06 | CI shall run on every PR touching `apps/api/**`, `packages/**`, `docker/api/**` or `compose.yaml`: `npm ci`, `contract:check`, lint, typecheck, tests with a PostgreSQL 16 service, `be:lint:migration` (after BE-34), the OpenAPI diff gate (after BE-31), image build and secret scan, and shall be green before review. | BE-01, BE-31, BE-34 | plan 9; BE-01 AC7 | CI: workflow file; the secret-scan step demonstrated once on a throw-away branch (BE-01 AC7). |
| BE-OPS-07 | A runbook `docs/ops/api-runbook.md` shall document env keys, start and stop, migrations, seed rules, backup and restore of `pgdata` with `pg_dump` (executed once into a fresh database), logs, incident basics and secret rotation. Backup frequency, retention and recovery targets are **not yet defined** (OQ-2). | BE-33, BE-30 | BE-33 outputs, AC7 | RUN: restore verified into a fresh database (BE-33 AC7). |
| BE-OPS-08 | Secrets shall live only in the environment or the deployment secret store (GitHub Actions secrets in CI); production hostnames and cookie domain are configuration (OD-4). | BE-01, BE-03, BE-33 | plan 9, OD-4 | CI: secret scan; IT: the cookie domain is read from env. |
| BE-OPS-09 | The e2e suite shall run against the compose stack (`npm run test:e2e:http`, added by BE-32) for the specs tagged `@api` on the desktop viewport and the mobile and tablet projects, and each merged domain shall have an entry in `docs/plan/http-switch-checklist.md` that the lead applies. | BE-32 | plan 7; BE-32 AC 3, 6 | RUN: `npm run test:e2e:http -- --grep @api` green for the agreed first specs (login, role switch, a practice session, a Bijak attempt). |
| BE-OPS-10 | The release gate (G6) shall have a final security pass covering uploads, AI keys, SSRF and migration data handling, and the user's explicit confirmation before deploy. | BE-33 | CLAUDE.md G6; BE-33 | SEC: `security-engineer` verdict recorded in the PR. |
| BE-OPS-11 | Every card PR shall follow the programme rules: branch `be/<card-id>-<slug>` from `feature/v2-backend`, draft PR as the claim, the PR template of the cards README filled (contract commit, real `be:verify` output, deviations appended to `docs/architecture/v2-backend-deviations.md`, open questions, mapping-matrix rows), the card's tracker row updated, commit after each green step and push at least hourly and before the session ends. | every card | AGENT-SYNC sections 2 to 4; plan 9; cards README | REV: the lead ticks the PR template; the tracker row matches the PR state. |

## 8. Definition of done link

A requirement is satisfied only when its acceptance check ran green with real output in the PR. The per-card checklist is plan section 10 plus 14.9; the developer handbook turns it into a checklist ([backend-dev-guide.md](../plan/backend-dev-guide.md) section 14). A card is `done` only after the lead squash-merged its PR.

## 9. Traceability

Sections 9.1 and 9.2 are generated from the Cards column of sections 4 to 7 by a script, so the two directions cannot drift apart; "cross-cutting" requirements apply to every card that adds endpoints or tables and are listed once at the end of 9.2. Section 9.3 records the review result. Section 10 maps every mock route group to its card and every role-matrix row to its serving card.

<!-- TRACE:BEGIN -->
<!-- generated by the traceability script from the Cards column; do not edit by hand -->

### 9.1 Requirement to cards to verification

| Requirement | Cards | Verification | Priority |
|---|---|---|---|
| BE-FR-01 | BE-03 | IT, CT | P0 |
| BE-FR-02 | BE-03 and every card that adds endpoints or tables | UT, IT | P0 |
| BE-FR-03 | BE-05 | IT | P0 |
| BE-FR-04 | BE-25 | UT, IT | P0 |
| BE-FR-05 | BE-06 | IT | P1 |
| BE-FR-06 | BE-06 | UT, IT | P1 |
| BE-FR-07 | BE-04 | IT | P0 |
| BE-FR-08 | BE-08 | UT, IT | P0 |
| BE-FR-09 | BE-24 | IT | P1 |
| BE-FR-10 | BE-24 | IT | P1 |
| BE-FR-11 | BE-09 | IT, REV | P0 |
| BE-FR-12 | BE-10 | IT | P1 |
| BE-FR-13 | BE-11 | IT | P0 |
| BE-FR-14 | BE-12 | IT | P0 |
| BE-FR-15 | BE-13 | IT, CT | P1 |
| BE-FR-16 | BE-23 | IT | P2 |
| BE-FR-17 | BE-14 | UT, CI, REV | P1 |
| BE-FR-18 | BE-15 | IT | P1 |
| BE-FR-19 | BE-16 | IT | P1 |
| BE-FR-20 | BE-39 | IT | P1 |
| BE-FR-21 | BE-36 | IT | P1 |
| BE-FR-22 | BE-37 | IT | P1 |
| BE-FR-23 | BE-38 | IT | P1 |
| BE-FR-24 | BE-40 | IT | P2 |
| BE-FR-25 | BE-17 | IT | P1 |
| BE-FR-26 | BE-18 | IT | P1 |
| BE-FR-27 | BE-19 | IT | P1 |
| BE-FR-28 | BE-20 | IT | P2 |
| BE-FR-29 | BE-21 | IT | P1 |
| BE-FR-30 | BE-22 | IT | P1 |
| BE-FR-31 | BE-01, BE-02 | UT, IT | P0 |
| BE-FR-32 | BE-07, BE-26 | IT | P0 |
| BE-FR-33 | BE-03, BE-12, BE-16, BE-19, BE-22 | IT | P0 |
| BE-FR-34 | BE-01, BE-05, BE-06, BE-24, BE-25, BE-33 | IT, CI | P0 |
| BE-FR-35 | BE-09, BE-10 | IT | P0 |
| BE-FR-36 | BE-10 | IT | P1 |
| BE-FR-37 | BE-21 | IT | P1 |
| BE-FR-38 | BE-41 | IT | P1 |
| BE-FR-39 | BE-42 | IT | P2 |
| BE-FR-40 | BE-43, BE-36 | IT | P1 |
| BE-FR-41 | BE-44 | IT | P2 |
| BE-FR-42 | BE-45 | IT | P2 |
| BE-FR-43 | BE-46 | IT | P2 |
| BE-FR-44 | BE-47 | IT | P2 |
| BE-FR-45 | BE-48, BE-13 | IT | P1 |
| BE-NFR-01 | BE-03, BE-33 | IT, SEC | P0 |
| BE-NFR-02 | BE-03, BE-33 | IT, SEC | P0 |
| BE-NFR-03 | BE-03, BE-33 | IT | P0 |
| BE-NFR-04 | BE-03, BE-33 | IT | P0 |
| BE-NFR-05 | BE-03 and every card that adds endpoints or tables | IT | P0 |
| BE-NFR-06 | BE-03, BE-06, BE-28 | IT | P0 |
| BE-NFR-07 | BE-01, BE-33 | IT | P0 |
| BE-NFR-08 | BE-03, BE-10, BE-25, BE-33, BE-38, BE-39, BE-23 | IT, REV | P0 |
| BE-NFR-09 | BE-01, BE-33 | CI | P0 |
| BE-NFR-39 | BE-03 | IT | P0 |
| BE-NFR-10 | BE-03, BE-05, BE-06, BE-28 | IT | P0 |
| BE-NFR-11 | BE-33 and every card that adds endpoints or tables | IT, SEC | P0 |
| BE-NFR-12 | Cross-cutting: every card that adds endpoints or tables | CI, REV | P0 |
| BE-NFR-13 | BE-27, BE-34, BE-35 | CI | P0 |
| BE-NFR-14 | BE-37, BE-38 | RUN | P1 |
| BE-NFR-15 | BE-13, BE-19, BE-22, BE-26, BE-29, BE-37, BE-38 | IT | P1 |
| BE-NFR-16 | Cross-cutting: every card that adds endpoints or tables | IT, REV | P0 |
| BE-NFR-17 | BE-11, BE-12, BE-16, BE-23, BE-34, BE-38 | IT, REV | P0 |
| BE-NFR-18 | BE-11, BE-12, BE-16, BE-23, BE-34, BE-37, BE-38 | IT | P0 |
| BE-NFR-19 | BE-02, BE-11, BE-12, BE-16, BE-40 | UT, IT, CT, REV | P0 |
| BE-NFR-20 | BE-02, BE-09, BE-12, BE-15, BE-18, BE-23, BE-26 | IT | P0 |
| BE-NFR-21 | BE-16, BE-33, BE-37 | IT, RUN | P1 |
| BE-NFR-22 | BE-01 | CT | P0 |
| BE-NFR-23 | Cross-cutting: every card that adds endpoints or tables | IT | P0 |
| BE-NFR-24 | Cross-cutting: every card that adds endpoints or tables | IT, CT | P0 |
| BE-NFR-25 | Cross-cutting: every card that adds endpoints or tables | CT | P0 |
| BE-NFR-26 | BE-31 and every card that adds endpoints or tables | CI | P0 |
| BE-NFR-37 | BE-24 | IT | P1 |
| BE-NFR-38 | BE-10, BE-18, BE-20, BE-21 | IT | P1 |
| BE-NFR-40 | BE-04, BE-22, BE-33 | IT | P0 |
| BE-NFR-27 | BE-01, BE-33 | IT | P0 |
| BE-NFR-28 | BE-02, BE-33 | IT | P0 |
| BE-NFR-29 | BE-04, BE-06, BE-16, BE-37 | IT, SEC | P0 |
| BE-NFR-30 | BE-37 | IT | P1 |
| BE-NFR-31 | BE-36 | IT, CI | P1 |
| BE-NFR-32 | BE-36 | IT, SEC | P1 |
| BE-NFR-33 | BE-36, BE-38 | IT, SEC | P1 |
| BE-NFR-34 | BE-36, BE-38, BE-40 | IT | P1 |
| BE-NFR-35 | BE-36, BE-33 | IT, SEC | P1 |
| BE-NFR-36 | BE-36, BE-38 | PILOT | P1 |
| BE-MIG-01 | BE-34 and every card that adds endpoints or tables | CT, CI | P0 |
| BE-MIG-02 | BE-34 | IT | P0 |
| BE-MIG-03 | BE-34, BE-28, BE-29 and every card that adds endpoints or tables | IT | P0 |
| BE-MIG-04 | BE-34, BE-30 | IT | P0 |
| BE-MIG-05 | BE-27 | IT | P1 |
| BE-MIG-06 | BE-27 | IT | P1 |
| BE-MIG-07 | BE-28, BE-29, BE-34 | IT | P0 |
| BE-MIG-08 | BE-28 | IT | P1 |
| BE-MIG-09 | BE-29 | IT | P2 |
| BE-MIG-10 | BE-28, BE-29 | IT | P1 |
| BE-MIG-11 | BE-30 | IT | P2 |
| BE-MIG-12 | BE-30 | IT | P2 |
| BE-MIG-13 | BE-30 | RUN | P2 |
| BE-MIG-14 | BE-35 | IT | P1 |
| BE-MIG-15 | BE-35 | IT | P1 |
| BE-MIG-16 | BE-30 | IT | P2 |
| BE-MIG-17 | Cross-cutting: every card that adds endpoints or tables | REV | P0 |
| BE-OPS-01 | BE-01, BE-33 | CI, RUN | P0 |
| BE-OPS-02 | BE-02 | RUN | P0 |
| BE-OPS-03 | BE-01, BE-02, BE-36, BE-37 | IT, CI | P0 |
| BE-OPS-04 | BE-02, BE-32 | IT, CI | P0 |
| BE-OPS-05 | BE-32 | RUN | P1 |
| BE-OPS-06 | BE-01, BE-31, BE-34 | CI | P0 |
| BE-OPS-07 | BE-33, BE-30 | RUN | P2 |
| BE-OPS-08 | BE-01, BE-03, BE-33 | IT, CI | P0 |
| BE-OPS-09 | BE-32 | RUN | P1 |
| BE-OPS-10 | BE-33 | SEC | P2 |
| BE-OPS-11 | Cross-cutting: every card that adds endpoints or tables | REV | P0 |

### 9.2 Card to requirements (every card has at least one)

| Card | Requirements it implements (named in the Cards column) | Priority |
|---|---|---|
| BE-01 | FR-31, 34; NFR-07, 09, 22, 27; OPS-01, 03, 06, 08 | P0 |
| BE-02 | FR-31; NFR-19, 20, 28; OPS-02, 03, 04 | P0 |
| BE-03 | FR-01, 02, 33; NFR-01, 02, 03, 04, 05, 06, 08, 10, 39; OPS-08 | P0 |
| BE-04 | FR-07; NFR-29, 40 | P0 |
| BE-05 | FR-03, 34; NFR-10 | P0 |
| BE-06 | FR-05, 06, 34; NFR-06, 10, 29 | P1 |
| BE-07 | FR-32 | P0 |
| BE-08 | FR-08 | P0 |
| BE-09 | FR-11, 35; NFR-20 | P0 |
| BE-10 | FR-12, 35, 36; NFR-08, 38 | P1 |
| BE-11 | FR-13; NFR-17, 18, 19 | P0 |
| BE-12 | FR-14, 33; NFR-17, 18, 19, 20 | P0 |
| BE-13 | FR-15, 45; NFR-15 | P1 |
| BE-14 | FR-17 | P1 |
| BE-15 | FR-18; NFR-20 | P1 |
| BE-16 | FR-19, 33; NFR-17, 18, 19, 21, 29 | P1 |
| BE-17 | FR-25 | P1 |
| BE-18 | FR-26; NFR-20, 38 | P1 |
| BE-19 | FR-27, 33; NFR-15 | P1 |
| BE-20 | FR-28; NFR-38 | P2 |
| BE-21 | FR-29, 37; NFR-38 | P1 |
| BE-22 | FR-30, 33; NFR-15, 40 | P1 |
| BE-23 | FR-16; NFR-08, 17, 18, 20 | P2 |
| BE-24 | FR-09, 10, 34; NFR-37 | P1 |
| BE-25 | FR-04, 34; NFR-08 | P0 |
| BE-26 | FR-32; NFR-15, 20 | P2 |
| BE-27 | NFR-13; MIG-05, 06 | P1 |
| BE-28 | NFR-06, 10; MIG-03, 07, 08, 10 | P1 |
| BE-29 | NFR-15; MIG-03, 07, 09, 10 | P2 |
| BE-30 | MIG-04, 11, 12, 13, 16; OPS-07 | P2 |
| BE-31 | NFR-26; OPS-06 | P0 |
| BE-32 | OPS-04, 05, 09 | P1 |
| BE-33 | FR-34; NFR-01, 02, 03, 04, 07, 08, 09, 11, 21, 27, 28, 35, 40; OPS-01, 07, 08, 10 | P2 |
| BE-34 | NFR-13, 17, 18; MIG-01, 02, 03, 04, 07; OPS-06 | P0 |
| BE-35 | NFR-13; MIG-14, 15 | P1 |
| BE-36 | FR-21, 40; NFR-31, 32, 33, 34, 35, 36; OPS-03 | P1 |
| BE-37 | FR-22; NFR-14, 15, 18, 21, 29, 30; OPS-03 | P1 |
| BE-38 | FR-23; NFR-08, 14, 15, 17, 18, 33, 34, 36 | P1 |
| BE-39 | FR-20; NFR-08 | P1 |
| BE-40 | FR-24; NFR-19, 34 | P2 |
| BE-41 | FR-38 | P1 |
| BE-42 | FR-39 | P2 |
| BE-43 | FR-40 | P2 |
| BE-44 | FR-41 | P2 |
| BE-45 | FR-42 | P2 |
| BE-46 | FR-43 | P2 |
| BE-47 | FR-44 | P2 |
| BE-48 | FR-45 | P1 |

Cross-cutting requirements that apply in addition to every card that adds endpoints or tables: FR-02; NFR-05, 11, 12, 16, 23, 24, 25, 26; MIG-01, 03, 17; OPS-11.

### 9.3 Result of this review

- Requirements: 113 (BE-FR 45, BE-NFR 40, BE-MIG 17, BE-OPS 11). Cards: 48.
- Requirements with no card: 0. Cards with no requirement: 0.
- Requirements whose acceptance is only partly covered by a card (the remainder is an open question, not an invented rule): BE-NFR-14 (user-data rights, OQ-3), BE-NFR-15 (endpoints without a target, OQ-1), BE-NFR-30 (malware scanning, OQ-5), BE-NFR-36 (pilot measurement, OQ-7), BE-OPS-07 (backup targets, OQ-2), BE-NFR-04 (rate-limit values, OQ-9).
- Requirements added or made explicit by this review because a card or source required the behaviour but no row stated it: BE-FR-34, BE-FR-35, BE-FR-36, BE-FR-37 (UD-4), BE-FR-38 to BE-FR-45 (cards BE-41 to BE-48), BE-NFR-37, BE-NFR-38, BE-NFR-39, BE-NFR-40, BE-OPS-11.

<!-- TRACE:END -->

## 10. Mock route groups and role-matrix coverage

### 10.1 Mock route groups (verified counts from [v2-api-catalogue](../architecture/v2-api-catalogue.md) section 3: 491 mock routes plus 4 contract-only session endpoints = 495; M28 has 16 class methods and no routes)

| Mock module | Routes | Card | Status |
|---|---|---|---|
| M01 authentication, notifications | 19 | BE-03, BE-06 | carded |
| M02 users, schools, subscriptions | 49 | BE-05, BE-25 | carded |
| M03 curriculum | 29 | BE-08 | carded |
| M04 question bank | 30 | BE-09, BE-10 | carded |
| M05 practice | 23 | BE-12, BE-13 | carded |
| M06 SPM classic (`/api/spm/*`, `/api/spm-mocks`, `/api/spm-walkthrough/solve`, `/api/duta/recommendations`) | 14 | BE-41 | carded (BE-FR-38) |
| M07 PKSK | 21 | BE-42 | carded (BE-FR-39; OQ-21) |
| M08 student performance | 30 | BE-19 | carded |
| M09 content | 43 | BE-24 | carded, including the student Audio KBAT play (D53(a)) |
| M10 classes, missions, Command Center | 39 | BE-17, BE-18, BE-22 | carded |
| M11 teacher analytics | 7 | BE-20 | carded |
| M12 Kirkpatrick | 14 | BE-20 | carded |
| M13 Cikgu Alesa | 10 | BE-43 | carded (BE-FR-40) |
| M14 gamification | 42 | BE-11, BE-23 | carded |
| M15 rewards shop | 18 | BE-23 | carded; 3 parent approval routes not built (UD-3) |
| M16 battle, games, tournaments, leagues, Sekolah Bersaing | 52 | BE-44, BE-45 | carded (BE-FR-41, BE-FR-42) |
| M17 admin dashboard | 11 | BE-22 | carded |
| M18 PPD/JPN, Amaran Awal | 4 | BE-21 | carded (UD-4) |
| M20 marketplace | 5 | BE-46 | carded (BE-FR-43) |
| M21 sponsorship | 1 | BE-47 | student side only (Penaja out per D48); carded (BE-FR-44) |
| M22 support tickets | 4 | BE-24 | carded |
| M25 AI centre (`/api/buku-nota/heatmap`, Heatmap Topik Lemah) | 1 | BE-48 | carded (BE-FR-45) |
| M27 school admin | 22 | BE-21 | carded; 2 impersonate routes not built (UD-2) |
| M28 Bijak SPM | 0 routes, 16 `BijakServer` methods | BE-15, BE-16, BE-39 | carded; HTTP surface is defined by the contract commit |

Core routes outside any module (`GET /api/me`, gamification summary, server status): 3, served by BE-06, BE-11, BE-22. The catalogue also lists 143 uncovered routes with the reason for each.

### 10.2 Role-matrix rows and the card that serves them

| Matrix rows (role) | Card | Note |
|---|---|---|
| Account basics A: Profil Saya, Tetapan Peribadi | BE-06 | Panduan is static content; Tiket Bantuan BE-24; Log Keluar BE-03 |
| Murid: Dashboard (#2) | BE-13 | gamification widgets BE-23 |
| Murid, Guru, Admin Sekolah: Headcount, Prestasi, Analitik Adaptif, Analisa Item (#3 to #6); Murid Kedudukan (#18), Timeline Saya (#39) | BE-19 | teacher item analysis BE-20 |
| Murid, Guru, Admin Sekolah: Video (#7); Murid Artikel (#20) | BE-24 | |
| Murid, Guru: Kelas Saya (#8) | BE-17 | |
| Murid: Latih Tubi (#16), Soalan by Chapter (#9), Soalan Berstruktur (#17), Remedial (#12) | BE-12, BE-13, BE-18 | Guru "Soalan by Chapter": BE-17 chapter helpers |
| Murid: Topik (#24), Peta Belajar (#25) | BE-08 | |
| Murid: Set Soalan Guru (#26) | BE-18 | |
| Murid: SPM (#13) | BE-15, BE-16, BE-41 | Bijak SPM and the classic SPM hub (D53(a)) |
| Murid: Syiling & Token (#28) | BE-11 | |
| Murid: Tukar Token, Cabaran Harian, Kedai Hadiah (two rows), Papan Pendahulu, Pencapaian, Kotak Misteri, Rujuk Kawan, Cabutan Bertuah (#22, #29 to #31, #33 to #36, #38) | BE-23 | |
| Murid: Jemput Ibu Bapa (#40) | BE-25 | |
| Murid: Audio KBAT (#27) | BE-24 | set list, detail and attempt (D53(a)) |
| Murid: Heatmap Topik Lemah (#14) | BE-48 | D53(a) |
| Murid: Mohon Keluarga Angkat (#15), Marketplace (#32), Cikgu Alesa (#37) | BE-47, BE-46, BE-43 | D53(a) |
| Murid: PKSK (#19), Permainan (#21), Tournament (#23) | BE-42, BE-44, BE-45 | D53(a); BE-44/BE-45 split of M16 as the cards say |
| Guru: Command Center (#1), Admin Sekolah: Command Center | BE-22 | |
| Guru: Dashboard Guru (#2), Pelajar Saya (#41) | BE-17 | |
| Guru, Admin Sekolah: Monitoring (#10), Kirkpatrick (#11); Guru Laporan (#42) | BE-20 | |
| Guru: Laporan Mingguan (#43) | BE-19 | returns 403 as the mock, OQ-15 |
| Guru: Sumbang Soalan (#44) | BE-09, BE-10, BE-37, BE-38 | |
| Admin Sekolah: Dashboard, Statistik Penggunaan, DSKP Heatmap, Laporan Aktiviti, Laporan Bulanan, Senarai Pelajar, Senarai Guru, Kelas Sekolah (#2, #46 to #48, #50 to #53) | BE-21 | |
| Admin Sekolah: Sekolah Bersaing (#45) | BE-44 or BE-45 | M16 (D53(a), D-RAM-2) |
| Admin Sekolah: Amaran Awal (#49) | BE-21 | UD-4 |
| Admin Pusat: users, schools, subscriptions, packages | BE-05, BE-25 | |
| Admin Pusat: curriculum, question bank, review, paper builder, intake, AI usage | BE-08, BE-09, BE-10, BE-36 to BE-40 | |
| Admin Pusat: content, tickets, gamification and reward control, Command Center, server status | BE-24, BE-23, BE-22 | |

## 11. Out of scope / not covered by any card

Since D53(a) (owner decision 2026-10-19) every module reachable in the prototype is B1: M06, M07, M13, M16, M20, M21 (student side only), M25 and the M09 student Audio KBAT play now have a card (BE-41 to BE-48, BE-24); they are in section 10. What remains without a card is below. None is specified as a requirement.

| Item | Evidence | Source of exclusion | Open question |
|---|---|---|---|
| Teacher economy (teacher wallets, ledger, rewards, redemptions, cash withdrawals, teacher badges) | M14 teacher routes (6) and admin guru routes (7) | Owner decision D53/OWN-10; D28c | none (closed) |
| Sistem stores (settings UI, feature flags, audit log UI, AI usage UI beyond BE-36/40) and Kewangan (payments, invoices, dunning, packages) | Portal Pentadbiran groups | Plan 2 backlog; V2-T27/V2-T28; hidden-unbuilt-screens rule | none (backlog) |
| PPD/JPN, Ibu Bapa, Penaja endpoints; Penaja side of M21; parent hadiah approvals; impersonate routes | roles; M15-08 to M15-10; M02/M27 | Plan 2 non-goals; D43/D48; user decisions UD-2, UD-3 | none |
| E-mail, SMS, push delivery; payment gateway | n/a | Plan 2 non-goals; OD-7 | OQ-10 |
| `mood_checkins` and `settings` stores | plan 14.7 rows name BE-22 and BE-28/29, but no card creates them | none: an inconsistency | OQ-24 |

## 12. Open questions

### 12.1 Existing decisions that affect these requirements (plan section 13)

The plan's default is in force until the LEAD says otherwise. Questions closed by a user decision stay in the table so that ids do not move.

| OD | Affects | Default in force |
|---|---|---|
| OD-2 | BE-MIG-05, 06, 14, 15 (how real data reaches the ETL) | Schema plus synthetic fixtures now; anonymised dump from the lead later. |
| OD-4 | BE-NFR-02, BE-OPS-08 (cookie domain, hostnames) | Session in PostgreSQL; hostnames by env at release. |
| OD-5 | BE-FR-17 | Move the pure M28 domain code into `@pp/exam-core`; the lead approves the one coordinated PR. |
| OD-6 | BE-FR-07 | Local volume behind `FileStorage`. |
| OD-7 | BE-FR-05, BE-FR-06 | No e-mail/SMS/push; reset e-mail logged. |
| OD-8 | BE-FR-13, BE-NFR-19 | Malaysia day boundary; teacher wallets as in the mock. |
| OD-9 | BE-NFR-25 | Ids are strings. |
| OD-10 | BE-MIG-08, 09 | Defaults of v2-data-migration section 7. |
| OD-11 | section 11 | Matrix rows beyond the carded domains are not in B1; they stay on the mock via hybrid mode until promoted. |
| OD-13 | BE-MIG-01, 06 | .cloud only; `my` is an empty extension point. |
| OD-14 | BE-NFR-31 to 35 | Mock provider default; production provider and budget chosen at G6. |
| OD-15, OD-16 | BE-NFR-14, 30 | pdfjs-dist plus tesseract.js; 20 MB, 200 pages, retention 12 months after publish. |
| OD-18 | BE-MIG-14 | The lead runs the anonymiser. |
| OD-20 | BE-FR-21 to 24 | The lead lists the intake wire-shape file paths before PC-5 starts BE-37/38. |

### 12.2 Open questions raised by this document

Numbering OQ-n (OQ-1 to OQ-8 were NQ-1 to NQ-8 in the first draft). "Default until answered" is what a developer does meanwhile; it is not a decision.

| ID | Question | Why it matters | Default until answered |
|---|---|---|---|
| OQ-1 | Are there API latency targets beyond those in the cards (BE-13, BE-19, BE-22, BE-26)? Who measures them? | No document defines a general target. | Only the card figures apply; others are measured and reported, not gated. |
| OQ-2 | Backup frequency, retention, recovery time and point objectives; log retention period. | BE-OPS-07 has no numbers. | Daily `pg_dump`, 7 daily and 4 weekly copies, as a suggestion for the runbook only. |
| OQ-3 | PDPA data-subject rights for users, mostly minors: access, correction, erasure on request, parent consent, retention of inactive accounts, breach contact. | No requirement or card covers them; the plan covers only the migration dump and intake files. | None implemented; do not invent. The LEAD raises it with the user before release. |
| OQ-4 | Message language: the mock's generic errors (`Unauthenticated.`, `This action is unauthorized.`, `Not Found.`, `Server Error`, `Too Many Attempts.`, `Conflict.`, `The given data was invalid.`) and validation `fields` texts are English Laravel defaults (UNVERIFIED COPY in the SRS) while the contract calls `message` BM. Replicate the mock string or write BM? | BE-NFR-23 says copy exactly; for these the exact copy is English. | Copy the mock's English string exactly and list each in the PR copy-diff table; `AUTH_ERROR_MESSAGES` (BM) always wins for auth and session codes. |
| OQ-5 | Malware scanning of uploads (v2-question-bank NFR-06 requires it): which engine, or accept content validation only? | BE-37 tests content and bombs but names no scanner. | Content validation only. |
| OQ-6 | Session lifetime: the 120-minute idle expiry is observed (M01 BR-06) but the "Ingat saya" duration (the mock uses 5 years, INFERRED) and any absolute maximum are not decided. Are `SESSION_TTL_HOURS` = 2 and `SESSION_REMEMBER_DAYS` acceptable? | BE-NFR-02 acceptance. | TTL 2 h sliding; remember duration taken from the M01 URS decision when answered, else ask in the BE-03 PR. |
| OQ-7 | Sample PDFs for the extraction pilot (v2-question-bank Q2) and who runs the NFR-01 measurement. | BE-NFR-36 cannot be verified without them. | Mock provider only; targets stay as proposed. |
| OQ-8 | Is `/api/metrics` exposed on the internal network or to admin only? | BE-NFR-28 allows both. | Internal network only. |
| OQ-9 | Rate-limit values for registration, file upload and ticket creation (only login and reset have sources). | BE-NFR-04, BE-33 AC2. | A limit exists and is configurable; the starting values are chosen in the BE-33 PR and listed for the lead. |
| OQ-10 | Password reset: the M01 SRS (BR-10, mock) says an unknown e-mail returns an error, BE-06 AC2 says the response never discloses whether an account exists. Which wins? And since no e-mail is sent (OD-7), how does a user outside development receive a reset link? Logging a token conflicts with BE-NFR-11. | Account enumeration versus mock fidelity; reset unusable in production. | The card (generic response) because it is the safer rule; the reset token is logged only when `NODE_ENV=development`; production delivery undefined. |
| OQ-11 | **Closed by D53(a) (2026-10-19):** every module reachable in the prototype is B1 (M06, M07, M13, M16, M20, M21 student side, M25, M09 Audio KBAT play); cards BE-41 to BE-48 and BE-24 serve them. | n/a | n/a |
| OQ-12 | **Closed by UD-4 (2026-10-19):** Amaran Awal (M18) is folded into BE-21 (BE-FR-37). | n/a | n/a |
| OQ-13 | **Closed by D53(a):** Heatmap Topik Lemah (`/api/buku-nota/heatmap`, M25) is B1 and gets BE-48. | n/a | n/a |
| OQ-14 | **Closed by D53(a):** Sekolah Bersaing is part of M16 (BE-44/BE-45). | n/a | n/a |
| OQ-15 | Laporan Mingguan (Guru row 43): the M08 SRS (FR-M08-119/120, OQ-M08-01) says `GET /api/weekly-report` is 403 for every role until the content is decided. Confirm the backend returns that 403. | BE-19 AC6 says exactly that, the matrix says the screen is allowed. | Return the mock's 403 for every role. |
| OQ-16 | **Closed by D53/OWN-10:** the teacher economy is backlog, not B1 (D28c). | n/a | n/a |
| OQ-17 | **Closed by UD-2 (2026-10-19):** the mock "Login As" routes (`POST /api/admin/users/:id/impersonate`, M27 `impersonate` and `impersonate/leave`) are dropped; Mod Pelajar is `POST /api/session/mode` only (D31c). | n/a | n/a |
| OQ-18 | v2-portals 4.2 (from .cloud `StaffScope`) says school-admin imports start inactive until Admin Pusat approves; the mock imports create active users. | BE-FR-03, BE-FR-29. | Mock behaviour (active). |
| OQ-19 | Mastery: M05 BR-20 stores counters (they differ from the answer log on live) while BE-13 AC2 and v2-data-migration 4.4 derive mastery from the answer rows. Stored counters, derived, or both? | BE-12 owns a `mastery` table, BE-13 forbids a join. | Derived from answer-row dimensions (BE-13 AC2); the BE-12 table holds only what the submit step needs and is explained in the PR. |
| OQ-20 | **Closed by UD-3 (2026-10-19):** the parent hadiah approval routes are not built in B1 and the frontend hides the entry point. Registration with role `parent` (BE-06) and invite accept (BE-25) stay as the cards say. | n/a | n/a |
| OQ-21 | PKSK access and packages (`pksk_accesses`, `pksk_packages`) feed `isSubscribed` (data-migration Q6) and are migrated (4.5). BE-42 (M07, D53(a)) is the natural owner; BE-25 `isSubscribed` and BE-28 must name it once the card exists. | BE-25, BE-28, BE-42. | `isSubscribed` ignores PKSK until BE-42 defines the tables. |
| OQ-22 | Auto-hide rule for reported questions (v2-question-bank Q7). | BE-FR-36. | Hide pending review after 3 reports from different students; Admin Pusat can hide at once. |
| OQ-23 | Size and type limits for `question_image` and `cms_image` uploads. | BE-NFR-29. | Global `MAX_UPLOAD_MB`, jpeg/png/webp. |
| OQ-24 | Plan 14.7 lists `mood_checkins` (BE-22 schema, BE-29 ETL) and BE-28 loads `settings`, but no card creates these tables. | Migration matrix gap. | Not migrated (Q7 default for wellbeing data); `settings` deferred with the Sistem stores. |
| OQ-25 | The question import format: v2-question-bank 4.3 and Q10 say an Excel template, the mock and BE-10 say CSV. | BE-FR-12, BE-NFR-38. | CSV as the mock until answered. |
| OQ-26 | Cross-host session: v2-portals NFR Security says the session is shared across the two portal hosts (`admin.*` and the main host) without exposing the Pembelajaran session to Pentadbiran pages beyond the active role, and OD-4 leaves hostnames to release. Is a cross-host cookie in B1 or one origin? | BE-NFR-02, BE-OPS-05, BE-OPS-08. | One origin in B1 (compose + nginx); cookie domain is configuration. |
| OQ-27 | Invalid pagination input: the mock treats a missing or invalid `page` as 1 while the contract `PageQuerySchema` rejects it (422). | BE-NFR-16, BE-NFR-24. | `page` missing or invalid means 1 (mock); `pageSize` above 100 is 422 (contract). |
| OQ-28 | **Closed (LEAD 2026-10-19):** lanes and priorities of BE-41 to BE-48 approved: BE-41 PC-3 P1; BE-42, BE-46, BE-47 PC-1 P2; BE-43 PC-5 P2; BE-48 PC-2 P1; BE-44 and BE-45 in the new lane PC-7 "Games and competitions" P2. | n/a | n/a |
| OQ-29 | **Closed (LEAD 2026-10-19):** BE-36 adds `generateText({purpose, system, input})` (returns `{text, tokensIn, tokensOut}`) to the provider-agnostic adapter, with the same redaction, `ai_usage_logs` row, rate limit and budget as its extraction methods (BE-36 AC 9); BE-43 depends on it and does not edit `ai-extraction/**`. | n/a | n/a |

## 13. Review record

### 13.1 Traceability result

See 9.3 (generated counts). Every requirement maps to at least one card and every card maps to at least one requirement. The first draft had 96 requirements with no orphan in either direction on paper, but 14 entries of its card table disagreed with the Cards column of the requirement rows (for example BE-NFR-19 named BE-12 and BE-16 while their entries in 9.2 did not list it); 9.1 and 9.2 are now generated, so they cannot disagree.

### 13.2 Source conflicts and how they were resolved

| Conflict | Resolution |
|---|---|
| BE-10 `question_submissions` versus intake `intake_batches` (two tables for one submission). | D53/OWN-1: `intake_batches` is the Submission; `question_submissions` dropped. |
| BE-23 teacher economy versus D28c. | D53/OWN-10: not in B1. |
| Questions tagged by DSKP bidang/SK/SP (BE-18 `dskp_*`) versus `curriculum_node` (v2-exam-schema D9). | D53(h): `curriculum_node` only; `dskp_*` is a picking list. |
| Plan 2 non-goals (marketplace, sponsorship, Cikgu Alesa, AI centre) versus the prototype matrix rows. | D53(a): every prototype-reachable module is B1. |
| Backend stack ADR number: plan 3 and OD-19 say 0020; BE-01 said 0019; BE-14 wrote 0020. | Resolved by the card audit: BE-01 is ADR-0020, BE-14 is ADR-0021. |
| `legacy_cloud_id` (contract `common/ids.ts` comment, v2-data-migration X1 and risks) versus `legacy_source` + `legacy_id` (plan 5 and 14.2, which states it replaces the single column). | Plan 14.2 wins. The contract comment and the migration doc are stale; the LEAD owns the contract file. |
| Mock authenticates with a Bearer token and a `{token, expiresAt, user}` login body, answers bad credentials with 422; contract uses cookie + CSRF, `Session` and 401 `INVALID_CREDENTIALS`. | Contract, by user decision UD-1 (2026-10-19). No Bearer on the real API; the LEAD realigns the mock (V2-T31). |
| Mock ids are numbers for users and schools; contract ids are decimal strings. | Contract, by user decision UD-1 (OD-9 closed). |
| Role keys `admin_sekolah`, `pegawai_ppd` versus `school_admin`, `ppd_officer`. | Contract codes. |
| BE-10 paths differed between its body and its programme update. | Resolved by the card audit (`modules/questions/workflow`; the new contract folder `question-workflow/` needs the lead's approval in the PR). |
| Plan 15.4 says BE-10 keeps "Excel import"; the card and mock say CSV. | OQ-25. |
| `demo.test` e-mails in `docs/AKAUN-DEMO.md` versus the `example.test` rule and guard test in BE-07 and BE-26. | Both reserved domains are fictitious; the guard must allow both (card change proposed). |
| Route counts in plan 6.3 and the cards README were stale. | The verified counts of the API catalogue (section 10.1) apply. |
| `v2-portals` Q4 default (read-only preview) versus D31c and the contract (act fully as themselves, writes stamped `is_test`). | TRACKER D31c and the contract win (BE-FR-33). |

### 13.3 Gaps found and fixed in this edition

1. Performance: the first draft said no document defines API targets; the cards do (BE-13 200 ms, BE-19 300 ms, BE-22 p95 300 ms, BE-26 60 s). BE-NFR-15 now carries them and "no card owns performance testing" was removed.
2. Session and throttle numbers existed in the M01 SRS (120 minutes idle, 5 failed attempts per 60 s, reset token 60 minutes) and are now in BE-FR-01, BE-FR-05, BE-NFR-02, BE-NFR-04.
3. Requirements stated by cards or sources but missing as rows: BE-FR-34 (public routes), BE-FR-35 (versioning), BE-FR-36 (reports), BE-NFR-37 (HTML sanitising), BE-NFR-38 (export formula injection), BE-NFR-39 (permission change on next request), BE-NFR-40 (caching headers), BE-OPS-11 (PR and sync rules).
4. BE-NFR-26 now includes the OpenAPI diff gate with the `contract-breaking` label, the coverage report and the no-`legacy_*` check of BE-31.
5. BE-FR-03 and BE-FR-29 gained the staff write rules (role escalation, own-account toggle, cross-school moves) and the student-import subscription rule.
6. Mock domains and matrix rows with no card are now listed one by one (sections 10 and 11) instead of one sentence.
7. Rows that said "all cards" now name the cards, and 9.1 and 9.2 are generated from the rows.

### 13.4 Card changes (re-checked after the audit, the card edits and the user decisions of 2026-10-19)

Applied in the cards: BE-01 ADR-0020; BE-14 ADR-0021; BE-10 paths and ACs (versioning, report fix loop, 4.8 gates, OQ-22/OQ-25 note); BE-13 reads moved to BE-18; BE-06 reset deviation; BE-03 AC for BE-NFR-39 and, by UD-1, the statement that the contract wins over the mock for ids and session; BE-07/BE-26 guard allows `demo.test`; BE-29 T-10 AC; BE-12 open-question item for BE-18/BE-23 no-op ports; mood/settings; README counts; by UD-2 the impersonate routes struck from BE-05 and BE-21 (and BE-33's audit list); by UD-3 the parent approval routes moved to "Not in B1" in BE-23; by UD-4 the four Amaran routes, inputs, files and ACs 8 to 12 added to BE-21 and the README backlog updated.

Applied by the cards of 2026-10-19 (D53): BE-10 drops `question_submissions` and its three routes; BE-37 gains `GET /api/intake/files/:id/original` and the Submission note; BE-38 adds the `source_paper_id` pointer; BE-23 moves the teacher economy to "Not in B1 (D53/OWN-10)"; BE-24 gains the two Audio KBAT student routes with ACs from the mock.

Still open: (1) BE-18 (not edited by this agent) must drop `POST /api/guru/question-papers` and `creates a pending submission via BE-10` in AC 6, because the upload is now `POST /api/intake/batches` (BE-37); (2) BE-19 and BE-18 `dskp_*` wording should say "teacher picking list only" (D53(h)); (3) BE-21's two working assumptions (its open questions 2 and 3: the intervention store and no officer endpoints in B1); (4) BE-37 open question 3: batch statuses versus the mock's `pending|processing|done|rejected` and `adminNotes`; (5) cards BE-41 to BE-48 are integrated (BE-FR-38 to BE-FR-45, README and tracker rows; the lanes are proposals, OQ-28); the cross-card notes were added to BE-12, BE-13, BE-23 and BE-36 (OQ-29 closed).

