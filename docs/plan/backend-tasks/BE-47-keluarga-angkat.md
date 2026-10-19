# BE-47 Mohon Keluarga Angkat: student-side application (M21)

| Field | Value |
|---|---|
| Size | S |
| Lane | PC-1 (proposed: it needs only BE-05's user lookup and sits next to BE-24 support tickets, the other small "send a request" card; no file overlap; folders: sessions.md section 5, to be extended with the rows in "Files touched") |
| Priority | P2 |
| Wave | 3 |
| Depends on | BE-03, BE-05 |
| Parallel with | BE-16, BE-18, BE-19, BE-23, BE-46, BE-48 |
| Owner module | M21 Sponsorship, **student-side slice only** (new module `sponsorship`; owns `foster_applications`) |
| Security review | required (sensitive family data of minors, student-email enumeration) |

## Goal

(D53: every module reachable in the prototype is in B1; matrix row 15 "Mohon Keluarga Angkat", Murid.) Store one foster-family ("keluarga angkat") application submitted from `/mohon-keluarga-angkat`. This is the only M21 route in the mock (verified: `mock/handlers/` holds `foster-application.ts` only; the sponsor, "anak angkat" and admin-review routes of the SRS have no mock route). **Out of scope (D48):** the Penaja (sponsor) role and its screens, the sponsor tables, the anak-angkat records and the admin review of applications. Nothing in B1 moves an application out of `pending`.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/requirements/srs/M21-sponsorship.md` (route #15, BR-M21-13, V-M21-03, FR-M21-49, FR-M21-63, DATA-M21-03 section 6.4, SEC-M21-07, section 8.2 success copy), `docs/requirements/urs/M21-sponsorship.md`
- Mock: `src/modules/m21-sponsorship/mock/handlers/foster-application.ts` (the one route), `mock/repository/foster-applications.ts`, `mock/repository/types.ts` (`FosterApplicationRow`), `mock/tables/tables.ts`; client and messages `src/modules/m21-sponsorship/api/{foster-application,types}.ts`; copy `components/mohon/mohon-copy.ts`; mock test `src/modules/m21-sponsorship/__tests__/mock/foster-application.test.ts`
- `docs/requirements/role-access-matrix.md` (Murid row 15 "Mohon Keluarga Angkat"); `docs/TRACKER.md` D48 (Penaja out of scope), D53
- BE-05 `UsersRepository.findByEmail` (student lookup), BE-03 guards
- Requirements: BE-FR-NEW-47 (wording proposed in the report; number assigned by the integrator of [URS 9.2](../../requirements/v2-backend-urs.md)); BE-NFR-06, BE-NFR-10
- API catalogue part B4 (economy, content, games): [economy-content-games.md, section "M21 Sponsorship and Anak Angkat" (M21-15)](../../architecture/v2-api-catalogue/economy-content-games.md#m21-sponsorship-and-anak-angkat-m21-sponsorship---1-route); OQ-API-B4-19, OQ-API-B4-20
- Data model: [v2-data-model.md](../../architecture/v2-data-model.md) section 3.13 row `m21.*` (only the `foster_applications` part becomes a B1 table; `sponsors` and `foster_sponsorships` stay backlog) and global rules G-01 to G-18
- Migration: [v2-data-migration.md](../../architecture/v2-data-migration.md) section 3 row `foster_applications` (Reshape), section 4.11 and Q7; plan [v2-backend-plan.md](../../architecture/v2-backend-plan.md) sections 5, 6, 14.7

## Outputs

- Contract: `packages/contract/src/sponsorship/**` (new): `FosterApplicationInput`, `FosterApplicationCreated`, the category and income enums with their wire values; registered in `src/openapi.ts`
- `apps/api/prisma/schema/sponsorship.prisma` + migration: `foster_applications`
- `apps/api/src/modules/sponsorship/**`: the controller, `FosterApplicationsRepository` (the only doorway to the table)
- Seed: none (the mock seed holds no application; `§6.11` rows 1 to 3 are not loaded by the mock either)
- Tests under `apps/api/test/sponsorship/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/sponsorship/**`.
- Prisma file(s): `apps/api/prisma/schema/sponsorship.prisma` (new, this card alone; a later Penaja card extends it) and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/sponsorship/**` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: none.
- Tests: `apps/api/test/sponsorship/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/sponsorship/`.
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (`FosterApplication`); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: `sponsorship.prisma` belongs to this card alone; `users` is reached through BE-05's repository (FKs to `users.id` are allowed).

## Endpoints (1 mock route, path from the mock)

| Method and path | Notes |
|---|---|
| `POST /api/mohon-keluarga-angkat` | any signed-in role; the applicant is the session user; 201 `{data: {id}}` |

- Guard: no session 401 `UNAUTHORIZED` "Unauthenticated."; any signed-in role may submit (the screen says students, parents and teachers/counsellors may apply); missing CSRF 403 `CSRF_INVALID`. `applicant_user_id` and `applicant_role` come from the session, never from the body.
- Request: `{studentEmail: string, studentCategory: 'B40'|'Asnaf'|'Yatim'|'OKU'|'Lain-lain', familyIncomeRange?: '< RM1,000'|'RM1,000 - RM2,500'|'RM2,500 - RM4,000'|'> RM4,000' | '' | null, reason: string}`. The wire values are exactly these strings (they are the screen's option values).
- Validation, collected per field then returned together as 422 `VALIDATION_ERROR` with `fields` (insertion order `studentEmail`, `studentCategory`, `familyIncomeRange`, `reason`); top-level `message` = the first field message plus ` (and N more error(s))` when several:
  - `studentEmail`: trimmed; blank or not a string: "Sila isi ruangan ini."; not matching `^[^\s@]+@[^\s@]+\.[^\s@]+$`: "Format e-mel tidak sah."; no existing user with that e-mail and role `student`: "Email pelajar tidak dijumpai dalam PrestasiPlus."
  - `studentCategory`: empty or not a string: "Sila isi ruangan ini."; not one of the five values: "Pilihan tidak sah."
  - `familyIncomeRange`: missing, null, a non-string or `""` means "not given" (stored null, no error); a non-empty string outside the four values: "Pilihan tidak sah."
  - `reason`: blank after trim or not a string: "Sila isi ruangan ini." The stored text is the value as typed (not trimmed), cut to 5,000 characters.
- Success: insert one row with `status = 'pending'`, `created_at = now`; no duplicate check (the same student and applicant may apply again); no notification, no e-mail, nothing else is written. The BM success text "Permohonan anda telah dihantar. Admin akan menyemak permohonan dalam 1-3 hari bekerja." is shown by the client, not returned.

## DB tables touched

New (owner this card): `foster_applications`. Reads `users` only through BE-05's `findByEmail`.

| Column | Type | Notes |
|---|---|---|
| id | bigint identity | wire: decimal string |
| student_id | bigint FK users, not null | the student found by e-mail |
| applicant_user_id | bigint FK users, not null | session user |
| applicant_role | text, not null | role code of the session user at submission, stored raw |
| student_category | text, not null, check in the five values | verbatim wire values (Open questions 2) |
| family_income_range | text, null, check null or the four values | verbatim wire values |
| reason | text, not null | up to 5,000 characters |
| status | text, not null, default `pending`, check `pending`/`approved`/`matched`/`rejected` | only `pending` is ever written in B1 |
| created_at | timestamptz | |
| is_test | boolean default false | G-07: stamped from the session mode |
| legacy_source, legacy_id | text null, `unique (legacy_source, legacy_id)` | G-02 |

Indexes: `(status, created_at desc)`, `(student_id)`, `(applicant_user_id)`. The sponsor and anak-angkat tables (`sponsors`, `foster_sponsorships`) are **not** created. Family category, income and reason are sensitive data of minors: never in logs, never in `audit_events`, never in any response of another route, and there is no read endpoint in B1.

## Acceptance criteria

1. The route returns 201 `{data: {id}}` (id a decimal string) for valid input and parses with its contract schema. Proof: port the cases of `foster-application.test.ts`.
2. Validation: one test per field and message above, several errors at once (top-level `message` has ` (and N more error(s))`), the field order, whitespace-only e-mail and reason, a non-string `studentCategory`, an unknown income range ("Pilihan tidak sah."), and a blank or numeric income value being accepted as "not given".
3. E-mail rules: a valid e-mail of a `teacher`, `parent` or unknown user gives "Email pelajar tidak dijumpai dalam PrestasiPlus." (same text for both, as the mock); a student found with different letter case behaves as BE-05's `findByEmail` does (state which in the PR).
4. The applicant is the session user and the role is the session's role code even when the body carries `applicantUserId` or `applicantRole` (ignored); a stored row has `status = 'pending'`, `created_at` = now, and the typed reason un-trimmed; a 6,000-character reason is stored as its first 5,000 characters.
5. No duplicate check: two identical submissions create two rows with different ids.
6. No side effects: a test asserts no notification, no e-mail/outbox row and no audit row containing the reason is written.
7. Roles: no session 401; missing CSRF 403 `CSRF_INVALID`; student, teacher, parent and admin sessions all succeed (the mock allows any signed-in role).
8. The table has the check constraints and indexes above; `\d foster_applications` output is pasted in the PR.

## Test commands

```
npm run be:test -- apps/api/test/sponsorship
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/sponsorship/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
4. Migration-first checklist of plan section 14.9 (items 1 to 6) is complete for `foster_applications`. Item 6 (insert a `legacy_source = 'cloud'` row twice through the BE-34 upsert helper and assert one row) applies once BE-34 is merged; state in the PR whether it was available.
5. Label `security-review` on the PR; list the security decisions and the tests that prove them (no logging of sensitive fields, enumeration note, session-derived applicant).
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Migration-first (plan sections 14 and 14.9)

- Follow the checklist of plan section 14.9 (items 1 to 6) for every table listed under "DB tables touched".
- `foster_applications` has `legacy_source text null`, `legacy_id text null` and `unique (legacy_source, legacy_id)`, and is listed in `apps/api/prisma/migratable-models.json`. These columns never appear in the contract or in an API response.
- Enums are `text` + `check`; anything the source may lack is nullable or has a documented default; seeds never set `legacy_*` (this card has no seed).
- Add or update this entity's row in the mapping matrix (plan section 14.7) in the same PR: `foster_applications` (.cloud: free-text `applicant_name`, no applicant user, no income range) with the ETL card "none in B1" (data-migration Q7: sensitive records are loaded only if the v2 feature exists and a user can be matched); `sponsors` and `foster_sponsorships` stay "out of B1 (Penaja, D48)".

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. Nothing can move an application out of `pending` in B1 (no admin review route in the mock, OQ-API-B4-19; Penaja is out of scope, D48). Working assumption: store-only; the admin review is a later card and the table already allows the other statuses.
2. G-05 prefers English codes, but the mock's wire values are display strings (`Lain-lain`, `< RM1,000`). Working assumption: the contract and the table keep the mock's strings verbatim (the screen uses them as option values); the lead may instead choose codes plus a mapping in the contract.
3. The 422 "Email pelajar tidak dijumpai dalam PrestasiPlus." lets any signed-in user test whether an e-mail belongs to a student (OQ-API-B4-20). Working assumption: keep the copy for fidelity; rate limiting is added by BE-33; record the decision in the PR.
4. The Murid matrix lists the screen for students; the mock allows any signed-in role (the screen text says parents and teachers/counsellors may apply). Working assumption: replicate the mock (any signed-in role).
5. Whether .cloud `foster_applications` are ever loaded (free-text applicant name; Q7). Working assumption: not loaded in B1.
6. Retention of the sensitive application data (PDPA, SEC-M21-07) is undefined. Working assumption: none enforced in B1; list it for the lead.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-47 (keluarga-angkat). Work in this repo clone on branch be/BE-47-keluarga-angkat, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-47-keluarga-angkat.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/sponsorship/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handler, repository, typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Copy the BM validation messages exactly. Student side only: do not build the Penaja role, sponsor tables, anak-angkat records or an admin review (D48). Never commit secrets or real personal names; never log the reason, income or category. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders. Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-47. One route, one table, the mock's validation order and messages, the applicant taken from the session, status pending, no duplicate check, no side effects.
```
