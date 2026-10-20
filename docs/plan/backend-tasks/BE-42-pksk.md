# BE-42 PKSK: domains, practice, exam, access grants and admin questions (M07)

| Field | Value |
|---|---|
| Size | L |
| Lane | PC-1; approved by the LEAD 2026-10-19 (folders: sessions.md section 5; the rows to add are in "Files touched") |
| Priority | P2 |
| Wave | 3 |
| Depends on | BE-03, BE-05, BE-09, BE-10, BE-12, BE-25 |
| Parallel with | BE-16, BE-18, BE-19, BE-23, BE-41 |
| Owner module | M07 (PKSK domains, packages, access grants, exam attempts, mastery, practice loads) |

Lane and priority reason (approved by the LEAD 2026-10-19): the folders `apps/api/src/modules/pksk/**`, `prisma/schema/pksk.prisma` and `packages/contract/src/pksk/**` belong to no lane today, so no file clashes with any PC. PC-1 owns identity, subscriptions and audit (access grants are entitlements) and is free after BE-24 until BE-32 and BE-33, whereas PC-2 is full with P0 cards. P2 because nothing else depends on it; matrix row 19 "PKSK" (Murid) is reachable in the prototype, so it is in B1 by D53.

## Goal

Serve the 21 M07 mock routes: the student PKSK area (access flags, the 15 domains, per-level dashboard, domain sections, a 10-question practice set and its scored submission, a full exam of 30 + 70 + 1 questions and its scored attempt, attempt history) and the admin area (PKSK question list, stats, detail, create, update, delete, bulk action; access grants list, stats, grant, revoke; the package list). PKSK questions are **not** a separate store: in v2 they are tags on the single question bank (v2-question-bank A6), so this card reads and writes them only through the BE-09 `QuestionsService`. A submitted practice set is stored as one M05 practice session with mode `pksk` through the BE-12 `PracticeRepository`, never as an M07 copy (D12, BR-M07-26).

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5, `docs/plan/backend-dev-guide.md`
- `docs/requirements/srs/M07-pksk.md` (sections 4 BR-M07-01 to BR-M07-26, 6 data, 7 mock API, 8 messages, 11 NFR-M07-06 with SEC-M07-01 to -12, 13 open questions and cross-module requests XR-M07-01 to -03) and `docs/requirements/urs/M07-pksk.md`; role matrix: `docs/requirements/role-access-matrix.md` row 19 "PKSK" (Murid) and admin rows BS-06 "Soalan PKSK" and the PKSK access screen S8
- Mock: `src/modules/m07-pksk/mock/handlers/{student,admin-questions,admin-access,common,index}.ts` (21 routes), `mock/repository/{rules,stores,types}.ts`, `mock/tables/tables.ts`, `mock/data/{domains,designed}.ts` (the 15 domains, 3 packages, S3 section copy, exam plan, practice size), `mock/seeds/seed.ts`; client and types `src/modules/m07-pksk/api/{pksk,admin,types}.ts`; mock tests `src/modules/m07-pksk/__tests__/mock/{handlers,admin,seed}.test.ts`
- API catalogue part B2: [learning-exam.md section 7, M07-01 to M07-21](../../architecture/v2-api-catalogue/learning-exam.md#7-m07-pksk-21-routes) (shapes, errors and BM messages are documented there; this card links them and does not repeat them)
- Data model: [v2-data-model.md](../../architecture/v2-data-model.md) global rules G-01 to G-18, [section 3.13](../../architecture/v2-data-model.md#313-mock-stores-without-a-card-backlog-and-mock-only) (the PKSK rows were backlog: `pksk_domains`, `pksk_packages`, `pksk_accesses`, `pksk_exam_attempts`, `pksk_mastery`, `pksk_practice_loads`; D53 promotes them to B1 and this card defines the columns below), `question_tags` (kinds `pksk_domain`, `pksk_level`) and `practice_sessions` (`pksk_domain`, `pksk_target_level`)
- `docs/architecture/v2-backend-plan.md` sections 5, 6, 14 (14.7 mapping matrix, 14.9 checklist); `docs/architecture/v2-data-migration.md` section 4.5 (.cloud has `pksk_packages` and `pksk_accesses` only; no attempts, mastery or loads)
- `docs/requirements/v2-backend-urs.md` (UD-1: ids are decimal strings, the session follows the contract; D53; OQ-21 on PKSK entitlement)
- Services of other owners that this card calls and never bypasses (ADR-0014, D12): BE-09 `QuestionsService` (PKSK-tagged questions: list, get, create, update, set status, delete, count, serve shape), BE-10 lifecycle rules (status codes), BE-12 `PracticeRepository` (completion of a PKSK practice session, which in turn credits wallet and streak through BE-11), BE-25 `SubscriptionService` (the PKSK subscription flag), BE-03 `AuditService`, BE-05 users lookup
- Requirements: BE-FR-39, BE-NFR-05, BE-NFR-20 ([URS 9.2](../../requirements/v2-backend-urs.md))

## Outputs

- Contract: `packages/contract/src/pksk/**` (domain, access flags, dashboard, domain section, served question without correctness flags, answer input, practice result, exam, exam attempt, admin question list item and detail with create and update inputs, bulk action, access item with create input, stats, package)
- `apps/api/prisma/schema/pksk.prisma` + migration: `pksk_domains`, `pksk_packages`, `pksk_accesses`, `pksk_exam_attempts`, `pksk_mastery`, `pksk_practice_loads`
- `apps/api/src/modules/pksk/**`: student controller, admin controllers, `PkskAccessService` (the level gate, exported for other modules), `PkskDomainsRepository`, `PkskProgressRepository`, `PkskQuestionsAdapter` (the only code that talks to `QuestionsService` for PKSK); pure rules file (`gradeOf`, `examScore`, `displayStatusOf`, answer scoring)
- Seed `apps/api/prisma/seed/pksk.ts`: the 15 domains and the 3 packages (reference data, listed below), a few fictitious PKSK questions per domain and level, a few fictitious grants for seeded demo accounts, one exam attempt and some mastery rows for one seeded student (one registry line)
- Tests under `apps/api/test/pksk/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/pksk/**`.
- Prisma file(s): `apps/api/prisma/schema/pksk.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/pksk/**` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: `apps/api/prisma/seed/pksk.ts`, plus one line in `apps/api/prisma/seed/index.ts` (after `questions` and `practice`).
- Tests: `apps/api/test/pksk/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/pksk/`.
- Do not touch: `apps/api/src/modules/{questions,practice,subscriptions,users}/**` (other owners; ask for a service method with a `cross-lane` issue).
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (model names, alphabetical: the packages and accesses models); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: `pksk.prisma` belongs to this card alone. No PKSK question table exists: the questions live in `questions.prisma` (BE-09) and are tagged.

## Endpoints (21 mock routes, paths from the mock; shapes in the catalogue)

Every route below exists in the mock (verified, `route(` registrations in `handlers/{student,admin-questions,admin-access}.ts`).

Student routes (any signed-in role, plus the level gate where `:level` appears: unknown level is 404 first, then no access is 403 `FORBIDDEN` "This action is unauthorized."):

| Catalogue id | Method and path |
|---|---|
| [M07-01](../../architecture/v2-api-catalogue/learning-exam.md#m07-01-get-apipkskmeaccess) | `GET /api/pksk/me/access` |
| M07-02 | `GET /api/pksk-domains` |
| M07-03 | `GET /api/pksk/levels/:level/dashboard` |
| M07-04 | `GET /api/pksk/levels/:level/domains` |
| M07-05 | `GET /api/pksk/levels/:level/domains/:code` |
| M07-06 | `GET /api/pksk/levels/:level/exam-attempts` |
| M07-07 | `POST /api/pksk/levels/:level/domains/:code/practice-sessions` |
| M07-08 | `GET /api/pksk/levels/:level/exam` |
| M07-09 | `POST /api/pksk/levels/:level/exam-attempts` |

Admin routes (`admin` only: 401 without a session, 403 for any other role):

| Catalogue id | Method and path |
|---|---|
| M07-10 | `GET /api/admin/pksk-questions` |
| M07-11 | `GET /api/admin/pksk-questions/stats` |
| M07-12 | `POST /api/admin/pksk-questions/bulk` |
| M07-13 | `GET /api/admin/pksk-questions/:id` |
| M07-14 | `POST /api/admin/pksk-questions` |
| M07-15 | `PUT /api/admin/pksk-questions/:id` |
| M07-16 | `DELETE /api/admin/pksk-questions/:id` |
| M07-17 | `GET /api/admin/pksk-access` |
| M07-18 | `GET /api/admin/pksk-access/stats` |
| M07-19 | `POST /api/admin/pksk-access` |
| M07-20 | `POST /api/admin/pksk-access/:id/revoke` |
| M07-21 | `GET /api/pksk-packages` |

## DB tables touched

Owned (defined here, following v2-data-model global rules: bigint identity ids serialised as decimal strings (G-01, UD-1), `timestamptz`, English enum codes as `text` + `check`, no soft delete, one owner per store (G-12)):

| Table | Columns (all `not null` unless stated) | Keys, checks, indexes |
|---|---|---|
| `pksk_domains` | `id`, `bahagian` text (`A`, `B`, `C`), `name`, `name_en`, `code`, `icon` text, `color` text, `display_order` int, `is_active` boolean default true, `created_at`, `updated_at` | `unique (code)`; check on `bahagian`; index `(bahagian, display_order)`. Reference data, 15 rows (below) |
| `pksk_packages` | `id`, `name`, `level` text (`T1`, `T4`, `ALL`), `created_at`, `updated_at`, `legacy_source`, `legacy_id` | `unique (legacy_source, legacy_id)`; check on `level`. Reference data, 3 rows (below). Provisional owner: the mock hosts it for M19 which has no card |
| `pksk_accesses` | `id`, `user_id` (FK), `package_id` (FK), `granted_by_id` null (FK `users.id`), `granted_at` timestamptz, `expires_at` date null, `status` text (`active`, `revoked`), `revoked_at` timestamptz null, `created_at`, `updated_at`, `legacy_source`, `legacy_id` | `unique (legacy_source, legacy_id)`; check on `status`; index `(user_id)`, `(granted_at desc, id desc)`. Several rows per user are allowed (BR-M07-14). The mock's display status (`active`, `expired`, `revoked`) is computed, never stored |
| `pksk_exam_attempts` | `id`, `user_id` (FK), `level` text (`T1`, `T4`), `completed_at` timestamptz, `score_pct` numeric(5,1), `bahagian_a_pct`, `bahagian_b_pct`, `bahagian_c_pct` numeric(5,1), `grade` text (`A`, `B`, `C`, `D`, `E`), `is_test` boolean default false, `created_at` | index `(user_id, level, completed_at desc)`; only completed attempts are stored. Not an M05 session and credits no syiling (SQ-M07-03) |
| `pksk_mastery` | `id`, `user_id` (FK), `level`, `domain_id` (FK), `mastery_pct` smallint (0 to 100), `is_test`, `created_at`, `updated_at` | `unique (user_id, level, domain_id)`; absent row means 0 |
| `pksk_practice_loads` | `id`, `user_id` (FK), `level`, `domain_id` (FK), `loaded_at` timestamptz | `unique (user_id, level, domain_id)`; upserted when a practice set is served and deleted when it is submitted; it only supplies the session start time (BR-M07-26 (1)) |

Reference rows (from `mock/data/domains.ts`, seeded and idempotent; `display_order` equals the list position; `icon` is the stored class string and `color` the hex string of the mock):

| # | Bahagian | Name | Name (EN) | Code |
|---|---|---|---|---|
| 1 | A | Kecerdasan Insaniah | Soft Skills Intelligence | PKSK_INSANIAH |
| 2 | B | Matematik | Mathematics | PKSK_MATH |
| 3 | B | Sains | Science | PKSK_SCI |
| 4 | B | Bahasa Inggeris | English Language | PKSK_ENG |
| 5 | B | Sejarah Malaysia | Malaysian History | PKSK_SEJ |
| 6 | B | Geografi | Geography | PKSK_GEO |
| 7 | B | Kebudayaan Kaum | Cultural Heritage | PKSK_BUDAYA |
| 8 | B | Sukan & Pencapaian | Sports & Achievements | PKSK_SUKAN |
| 9 | B | Mercu Tanda Malaysia | Malaysian Landmarks | PKSK_MERCU |
| 10 | B | Alam Sekitar | Environment | PKSK_ALAM |
| 11 | B | Teknologi & IT | Technology & IT | PKSK_TECH |
| 12 | B | Ekonomi Malaysia | Malaysian Economy | PKSK_EKON |
| 13 | B | Inovasi & Pencipta | Innovation & Inventors | PKSK_INOV |
| 14 | B | Isu Global | Global Issues | PKSK_GLOBAL |
| 15 | C | Artikulasi Penulisan | Writing Articulation | PKSK_ESSAY |

Packages: "PKSK Tingkatan 1 (SBP/MRSM)" level `T1`; "PKSK Tingkatan 4 (SBP/MRSM)" level `T4`; "PKSK Kombo (T1 + T4)" level `ALL`.

Read or written through services only (never queried directly): `questions`, `question_tags`, `part_options`, `answer_keys` (BE-09); `practice_sessions`, `practice_answers` (BE-12); `wallets`, `coin_ledger`, `streaks` (BE-11, through BE-12 step 6); `users` (BE-05); `audit_events` (BE-03).

PKSK question representation (v2): a question carrying a `pksk_domain` tag (the domain `code`) and a `pksk_level` tag (`T1` or `T4`); the Bahagian is the domain's Bahagian (BR-M07-01). Tag codes are the domain `code` and the level code, so no foreign key exists between `question_tags` and `pksk_domains`.

## Acceptance criteria

Each criterion is a test in `apps/api/test/pksk/**`; the mock tests named in Inputs are the oracle (port them to supertest). Messages are copied from the mock.

1. Level gate (every `/api/pksk/levels/:level/*` route): `level` is case-sensitive `T1` or `T4`; any other value (`T9`, `t1`, `ALL`) answers 404 `NOT_FOUND` "Not Found." **before** the access check; a signed-in user without access to that level answers 403 `FORBIDDEN` "This action is unauthorized." and no question or answer data is returned. A user with a T1-only grant gets 200 on T1 and 403 on T4 (test every level route for this).
2. Access rule (BR-M07-07, shared with M07-01): level L is usable when the user has a row with `status = 'active'`, `expires_at` null or not before today (Asia/Kuala_Lumpur) and a package of level L or `ALL`; or the user has the PKSK subscription flag from `SubscriptionService`; or the active role is `admin` (both levels). `GET /api/pksk/me/access` returns `{ T1, T4 }` booleans. An expiry date is valid through the end of that day; a revoked or expired row grants nothing. The Kombo package grants both levels.
3. M07-02 returns the 15 domains ordered by `display_order` with the camel-case fields `id, bahagian, name, nameEn, code, icon, color, order, isActive, createdAt, updatedAt`, no `meta`.
4. M07-03 dashboard: `readiness.scorePct` is the rounded mean of the caller's `score_pct` at that level (0 with no attempt) and `readiness.grade` is the grade of the unrounded mean; `examCount`; `bahagianBAvgPct` is the mean of `bahagian_b_pct` to one decimal; `domains` are the Bahagian B domains in order with `masteryPct` (0 when absent). Grades: A at 80 or more, B 65 to 79, C 50 to 64, D 40 to 49, E below 40. Another user's attempts never count.
5. M07-04 returns sections `A`, `B`, `C` in that order with names "Kecerdasan Insaniah", "Kecerdasan Intelek", "Artikulasi Penulisan" and subtitles "Nilai, akhlak & sahsiah", "Kognitif & penaakulan", "Penulisan kreatif"; `questionCount` counts only questions that are approved for students (see open question 2) with that domain and that level; `masteryPct` is the caller's.
6. M07-05 practice set: an unknown domain `code` is 404 (level checked first); up to 10 random approved questions of the domain and level (all when fewer), shuffled with the injectable PRNG; each question is `{ id, questionText, options: [{ text }] }` with **no correctness flag** anywhere (recursive key scan for `isCorrect`, `correct`, `answer`, `explanation`), and `options` is `[]` for Bahagian C; the call upserts the `pksk_practice_loads` row.
7. M07-07 practice submit: body `{ answers: [{ questionId, optionIndex?, text? }] }`; an empty list, a duplicate `questionId`, a mistyped field, or any question that is not an approved PKSK question of this domain **and** this level answers 422 `VALIDATION_ERROR` "Jawapan tidak sah." with `fields.answers` "Jawapan tidak sah." and writes nothing. Scoring is server side: for Bahagian A and B the chosen option must be the one flagged correct; for Bahagian C (no options) the simulated marker accepts a trimmed text of at least 50 characters (open question 5). `masteryPct = round(correct / answered * 100)` is upserted into `pksk_mastery` (one row per user, level and domain). The answers are recorded as **one** completed M05 practice session with mode `pksk`, the domain and the level, `coins_earned` and `points_earned` as BE-12 defines for the mode, started at the stored load time (never after now) and completed now; the response is 201 `{ data: { masteryPct, sessionId, gamification: { coinsEarned, pointsEarned, streakCount, totalBalance } } }`. No M05 revision queue, subject mastery or trial counter changes (BR-M07-26). The whole call is one transaction: a forced failure after the session is recorded leaves no mastery row and no wallet credit.
8. M07-08 exam: 200 `{ data: { sections } }` with Bahagian A (weight 20, up to 30 questions from the domain of Bahagian A), B (weight 70, up to 70 from the Bahagian B domains) and C (weight 10, up to 1), approved questions of the level only, shuffled; fewer when the pool is short; no correctness flag. Nothing is stored.
9. M07-09 exam submit: every answered question must be an approved PKSK question of this level (any domain), at most 30 A, 70 B and 1 C answers, else 422 "Jawapan tidak sah." (`fields.answers`) and nothing is written. Bahagian percentage = correct answers / planned count (30, 70, 1) x 100 to one decimal (the planned count, not the served count); `score_pct = round1(0.2 * A + 0.7 * B + 0.1 * C)`; grade as in criterion 4. 201 `{ data: { id, completedAt, scorePct, grade } }` with `completedAt` in `+08:00`. No M05 session, wallet or streak change. M07-06 lists the caller's attempts at the level, newest first, as `{ id, completedAt, scorePct, grade }`.
10. Admin question list (M07-10): filters AND-combined, case-insensitive values (`bahagian=b`, `level=t1`, `status=APPROVED`), an unknown value (`bahagian=Z`, `level=T9`, `status=zzz`) returns an empty page, `search` is a trimmed case-insensitive substring of the question text, order `created_at` descending then id ascending, page size 20, `meta` as in the catalogue; item shape `{ id, questionText, bahagian, domain: { id, code, name, icon, color }, targetLevel, status }`. Stats (M07-11) are `{ total, approved, pending, t1, t4 }` over all PKSK questions (T1 and T4 count every status).
11. PKSK/M04 separation (SEC-M07-12, BR-M07-21): PKSK questions never appear in `GET /api/questions`, `/api/questions/summary` or any M04 count (integration test through the real BE-09 service); M07-13/15/16 and the bulk action accept **only** PKSK question ids: the id of a non-PKSK question answers 404 `NOT_FOUND` "Soalan PKSK tidak dijumpai." and is never changed or deleted; the bulk call with any non-PKSK, unknown or non-numeric id answers 422 `fields.ids` "Sila pilih sekurang-kurangnya satu soalan PKSK." and changes nothing.
12. Create (M07-14): 201 `{ data: detail, status: "Soalan PKSK berjaya ditambah." }`, saved `approved` (BR-M07-03). Field errors (422 `fields`): `bahagian` "Sila pilih bahagian." (not A, B or C); `pkskDomainId` "Sila pilih domain." (unknown domain, or a domain that does not belong to the chosen Bahagian); `pkskTargetLevel` "Sila pilih tingkatan."; `questionText` "Sila masukkan teks soalan." (trimmed, required); `difficultyLevel` "Tahap kesukaran tidak sah." (required integer 1 to 5); `options` (Bahagian A and B only) "Sila masukkan 2 hingga 6 pilihan jawapan." for a count outside 2 to 6 and "Sila masukkan teks pilihan jawapan." for an empty text. Bahagian C stores no options and ignores any sent. Several flags may be correct or none (BR-M07-04). Question text and explanation are plain text, stored sanitised and never rendered as HTML (SEC-M07-09).
13. Update (M07-15): same validation plus `status` required (`pending`, `approved`, `rejected`; `fields.status` "Sila pilih status."); an absent or blank `difficultyLevel` keeps the stored value; absent `options` keeps the stored options when at least 2 exist and the domain is A or B; 200 with status "Soalan PKSK berjaya dikemaskini."; any status may follow any other (BR-M07-02). Unknown id: 404 "Soalan PKSK tidak dijumpai.". Delete (M07-16) is a hard delete answering 204; unknown id 404 with the same message; historical practice answers survive (their question reference is nullable, BE-12).
14. Bulk (M07-12): `action` must be `approve`, `reject` or `delete` else 422 `fields.action` "Tindakan tidak sah."; `ids` non-empty; duplicates count once; 200 `{ data: { affected }, status }` with status "<n> soalan telah diluluskan." / "<n> soalan telah ditolak." / "<n> soalan telah dipadam.".
15. Access admin: list (M07-17) with `search` (case-insensitive substring of user name or e-mail), order `granted_at` descending then id descending, 20 per page, item `{ id, user: { id, name, email }, package: { id, name, level }, grantedBy: { id, name } | null, grantedAt, expiresAt, status, displayStatus }` where `displayStatus` is `revoked`, else `expired` when `expiresAt` is before today (Malaysia date), else `active`. Stats (M07-18) `{ activeTotal, t1, t4 }` count only active rows; a Kombo counts in both T1 and T4; the subscription flag and the admin role are not counted. Packages (M07-21) return the 3 packages, `admin` only.
16. Grant (M07-19): `userId` must be an existing user ("Pengguna tidak dijumpai." in `fields.userId`), `packageId` an existing package ("Sila pilih pakej." in `fields.packageId`), `expiresAt` optional and, when present, a real calendar date `YYYY-MM-DD` ("Tarikh tamat tidak sah." in `fields.expiresAt`); a past date is accepted and gives an already-expired row; all field errors are returned together and nothing is written; success is 201 with the access item and `status` "Akses PKSK berjaya diberi.", `granted_by_id` = the acting admin, `granted_at` = now, status `active`. Revoke (M07-20): unknown id 404 "Rekod akses tidak dijumpai."; a row that is revoked or expired answers 409 `CONFLICT` "Akses ini tidak aktif dan tidak boleh ditarik balik."; success 200 with status "Akses PKSK telah ditarik balik." and `revoked_at` set; the row stays listed. After a grant or revoke, the student routes see the change on the next request.
17. Audit and privacy (SEC-M07-02, -03, -11): a grant, a revoke and a bulk delete write an `audit_events` row through `AuditService` carrying actor id, action, target ids and package id only (no name, e-mail or question text, G-14); the access list is reachable by `admin` only.
18. Test mode (G-07): attempts and mastery written while an admin is in Mod Pelajar are stamped `is_test = true`; none of them is returned by another user's routes. Roles: no session 401; missing CSRF on any POST, PUT or DELETE 403 `CSRF_INVALID`; every student route works for any signed-in role subject to the level gate; every admin route is `admin` only.
19. Contract: every response parses with its zod schema; ids (user, question, domain, package, access, attempt) are decimal strings on the wire (UD-1), `sessionId` is the practice session uuid; `npm run contract:check` passes.

## Test commands

```
npm run be:test -- apps/api/test/pksk
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/pksk/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
4. Migration-first checklist of plan section 14.9 (items 1 to 6) is complete for every table this card creates. Item 6 (insert a `legacy_source = 'cloud'` row twice through the BE-34 upsert helper and assert one row) applies to `pksk_packages` and `pksk_accesses` once BE-34 is merged; state in the PR whether it was available.
5. **Security review is required** (NFR-M07-06 in the SRS: paid-access grants, personal data in the access list, level gate, exam integrity, bulk delete). Request `security-engineer` review before merge and list every security decision in the PR: server-side level gate on every level route, no correctness flag before submit, PKSK-only id guard, audit rows, CSRF on all writes.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Migration-first (plan sections 14 and 14.9)

- Follow the checklist of plan section 14.9 (items 1 to 6) for every table listed under "DB tables touched".
- `pksk_packages` and `pksk_accesses` can receive .cloud rows (`pksk_packages`, `pksk_accesses`): they carry `legacy_source text null`, `legacy_id text null`, `unique (legacy_source, legacy_id)` and are listed in `apps/api/prisma/migratable-models.json`. These columns never appear in the contract or in an API response. Mapping: `granted_by` to `granted_by_id`, `expires_at` stays a date, the .cloud status word `aktif` to `active` (confirm the other words with the profiling report). The other four tables have no .cloud source and are born in v2.
- .cloud `pksk_questions` (body text only, no options or answers) are **not migrated** here; the old bank is reloaded (`v2-data-migration.md` 3 and 4.5).
- Enums are `text` + `check` with English codes (no Postgres enum types); seeds never set `legacy_*` and are idempotent.
- Add or update this entity's rows in the mapping matrix (plan section 14.7) in the same PR.

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. **How PKSK questions are held in BE-09 (blocking).** BE-09 must offer, for questions tagged `pksk_domain` and `pksk_level`: list with filters (domain ids, level, status, search, page), get, create, update, delete (hard), bulk status change, count by tag and status, and a student serve shape without correctness. It must also exclude them from the M04 lists and counts. Working assumption: these are methods of `QuestionsService` that BE-42 calls; if they are missing, open a `cross-lane` issue to PC-2 (label `contract`) and do not query question tables.
2. **PKSK statuses.** The mock uses `pending`, `approved`, `rejected`, any transition allowed, a created question saved `approved` and students served `approved` only. BE-10 has Draf, Semakan, Lulus, Terbit, Diarkib with a transition table, and the data model says a mock `rejected` has no v2 status. Working assumption for the wire: keep the three PKSK codes and map `pending` to Semakan, `approved` to Terbit (the only status that serves students), `rejected` to Draf with a rejected marker; confirm with the LEAD and PC-5 (BE-10) before building, because the admin filter on `rejected` depends on it. D54(a) (2026-10-19) decided the wire lifecycle for M04 questions only (v2 codes, BE-09 open question 1); whether PKSK questions follow it or keep these three codes is not covered by D54(a) and stays open here.
3. **Several or no correct options.** The mock lets Bahagian B have zero or several options flagged correct and stores Bahagian A flags as posted, while BE-09 answer key kind `option` holds one correct label. Working assumption: the PKSK question keeps the mock semantics (correct iff the chosen option is flagged); ask PC-2 how BE-09 stores a PKSK option set (extra key kind or per-option flag).
4. **Direct completion in BE-12.** M07-07 needs a PracticeRepository method that completes a session without the start and check flow (mock `completeSession` direct form, XR-M07-02 (b)): mode `pksk`, no subject, no revision queue, no subject mastery, no trial counter, wallet and streak credited by the tier rate for PKSK (XR-M07-03 asks which of `flat_quiz_reward` and `pksk_reward_correct` wins; BE-23 decides). BE-12's card names only the quiz-flow `completeSession`. Working assumption: BE-12 adds `completeDirect`; if not present when this card starts, open a `cross-lane` issue to PC-2.
5. **Essay marking.** The mock accepts a Bahagian C answer of 50 or more characters as correct (a simulated marker, SRS "Perlu pengesahan"). No real marker exists in B1. Keep the rule and the 50-character constant, and say so in the PR.
6. **Entitlement sources.** The SRS (SEC-M07-05, OQ-M07-01) notes that the M02 PKSK subscription flag and the grants in `pksk_accesses` can disagree, and the data migration Q6 derives subscription from grants too. BE-25 does not name a PKSK flag today. Working assumption: `SubscriptionService` exposes `hasPkskSubscription(userId)`; until it does, only grants and the admin role open a level, and the PR says so. The access screen shows grants only.
7. **Package ownership.** `pksk_packages` has no owner card other than this one (the mock marks M19 as the true owner and provisional here). Confirm that BE-42 owns it and that BE-25's `school_packages` stays separate.
8. **Reference rows in production.** Domains and packages are reference data that production needs on day one. Confirm whether they ship in the migration (insert on conflict do nothing) or in a reference seed run in every environment; working assumption: the idempotent seed file, run on deploy.
9. **Entitlement exposure (SEC-M07-01, -10, -11).** The grant form posts a raw user id with no picker, expiry has no bounds and duplicates are allowed (the mock replicates all three), and the list exposes names and e-mails of paying users. The card replicates the mock and adds the audit rows of criterion 17; whether to log read access to the list or cap the expiry is a lead decision.
10. **Practice-load row.** `pksk_practice_loads` only exists to give the session a start time (the mock behaviour). Confirm that it is wanted rather than taking the start time from the client request; working assumption: keep the table.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-42 (pksk). Work in this repo clone on branch be/BE-42-pksk, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-42-pksk.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-42. Port the 21 routes of src/modules/m07-pksk/mock/handlers/{student,admin-questions,admin-access}.ts. PKSK questions are tags on the one question bank: use only the BE-09 QuestionsService, never query question tables. A submitted practice set is one M05 practice session with mode pksk recorded through the BE-12 PracticeRepository. This card owns only pksk_domains, pksk_packages, pksk_accesses, pksk_exam_attempts, pksk_mastery and pksk_practice_loads. The level gate (404 for a bad level first, then 403 without access) must run on every level route, correctness flags must never reach the client before submit, and a PKSK id guard must stop the admin routes from touching non-PKSK questions. Request the security review before merge.
```
