# BE-05 Users and schools (M02): admin CRUD, search, import

| Field | Value |
|---|---|
| Size | L |
| Lane | PC-1 (folders: sessions.md section 5) |
| Priority | P0 |
| Wave | 1 |
| Depends on | BE-03 |
| Parallel with | BE-04, BE-08, BE-11, BE-14 |
| Owner module | M02 (users admin extensions, schools); M01 owns the base users table |
| Security review | required (personal data, bulk import) |

## Goal

Persist and serve the M02 user and school management used by Admin Pusat and Admin Sekolah: user list/filters/detail/create/update/delete/toggle-active, bulk delete and bulk import, school list/options/search/create, all scope-filtered.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/requirements/srs/M02-users-schools.md`, `docs/requirements/urs/M02-users-schools.md`
- Mock handlers: `src/modules/m02-users-schools/mock/handlers/{users-admin,users-input,users-rules,users-shape,users-packages,schools-admin,schools-public,imports,comp-students,admin-config}.ts` (only the routes in the table below; subscriptions, packages and comp students are BE-25); mock stores: `src/modules/m02-users-schools/mock/repository/*`, `src/modules/m02-users-schools/mock/{quota.ts,school-admin-writes.ts,import/*}`, `src/mock/core-data/{users,schools}.ts`
- Frontend client and types: `src/modules/m02-users-schools/api/*`
- Mock tests to port: `src/modules/m02-users-schools/__tests__/mock/**`
- `docs/architecture/v2-data-migration.md` section 4.1 (M01/M02 realignments), section 5 (IC, faith, roles)
- `docs/architecture/v2-frontend.md` section 6 (M02 row: `roles[]`, `username`, nullable e-mail, two status flags, masked IC, `joinCode`)
- BE-03 outputs (`identity.prisma`, `schools.prisma`, guards, `ScopeFilter`, `AuditService`)
- Requirements: BE-FR-03, BE-FR-34; BE-NFR-10 ([URS 9.2](../../requirements/v2-backend-urs.md))
- API catalogue part B1 (core, identity, curriculum): [core-identity-curriculum.md](../../architecture/v2-api-catalogue/core-identity-curriculum.md) (endpoint list, wire conventions and open questions for this card's scope)
- Data model: [v2-data-model.md](../../architecture/v2-data-model.md) (tables, keys and indexes of this card; being written 2026-10-19)

## Outputs

- Contract: `packages/contract/src/users/**`, `packages/contract/src/schools/**` (users and schools files only; BE-25 adds its own files in `schools/`)
- `apps/api/prisma/schema/identity.prisma` (extends `users`: profile fields, `is_active`, `is_suspended`, `join_code`, `class_label`, `ic_hash`, `ic_masked`, `trial_questions_used integer not null default 0` (mock BR-07 trial counter, used by BE-25/BE-12); no plaintext IC, no `faith`; adds `import_jobs` with per-row results) and `apps/api/prisma/schema/schools.prisma` (extends `schools`), one migration **OD-28 (2026-10-19, OWN-4):** `schools.prisma` also creates `jpns` (`code` unique, `name`) and `ppds` (`jpn_id` FK, `code` unique and stored exactly as the school `district` value, `name`), both with the `legacy_*` columns; `schools.jpn_id` and `schools.ppd_id` reference them. The seed derives the rows from the distinct state and district of the seeded schools (plan 14.7 T-09 rule); `GET /api/jpn` reads `jpns` and `ppds`.
- `apps/api/src/modules/{users,schools}/**`: repositories are the only doorway to these tables (ADR-0014): `users.get`, `findByEmail`, `search`, `schools.search`, `schools.options`, for other cards
- Import service for CSV with a per-row result report (used by `bulk-import` here and by the student import in BE-25)
- Seed `apps/api/prisma/seed/core/schools.ts` (a small fictitious set of schools across 2 states and 2 districts)
- Tests under `apps/api/test/users/**`, `apps/api/test/schools/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/users/**`, `apps/api/src/modules/schools/**`.
- Prisma file(s): `apps/api/prisma/schema/identity.prisma`, `apps/api/prisma/schema/schools.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/users/**`, `packages/contract/src/schools/**` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: `apps/api/prisma/seed/core/schools.ts`, plus one line in `apps/api/prisma/seed/index.ts`.
- Tests: `apps/api/test/users/**`, `apps/api/test/schools/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/users/`.
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (model names, alphabetical); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: identity.prisma and schools.prisma were created by BE-03 (BE-05 depends on it); BE-06 (identity.prisma) and BE-25 (schools.prisma) depend on BE-05, so none of them is open at the same time.

## Endpoints (paths and shapes from the mock; client in `m02-users-schools/api`)

Every route below exists in the mock handlers (verified).

| Method and path | Notes |
|---|---|
| `GET /api/admin/users`, `GET /api/admin/users/filters`, `GET /api/admin/users/:id` | list with filters, pagination meta with `counts`; scope-filtered |
| `POST /api/admin/users`, `PUT /api/admin/users/:id`, `DELETE /api/admin/users/:id` | create/update/delete; rules from `users-rules.ts` |
| `POST /api/admin/users/:id/toggle-active`, `POST /api/admin/users/bulk-delete`, `POST /api/admin/users/bulk-import` | bulk operations with a result report; `bulk-import` creates teacher, parent, school_admin and ppd_officer accounts (mock `BULK_IMPORT_ROLES`; school required for teacher and school_admin) |
| ~~`POST /api/admin/users/:id/impersonate`~~ | **Not built: user decision 2026-10-19 (UD-2).** The mock "Login As" route is intentionally not ported; Mod Pelajar is `POST /api/session/mode` (BE-03). |
| `GET /api/admin/schools`, `GET /api/admin/schools/options`, `GET /api/admin/schools/:id`, `POST /api/admin/schools`, `PUT /api/admin/schools/:id`, `POST /api/admin/schools/:id/toggle` | admin school management |
| `GET /api/admin/schools/:id/students` | existing students of a school (`search`, `classLevel` filters; at most 200 rows, name A to Z) used by the import screen |
| `GET /api/schools`, `GET /api/schools/search`, `GET /api/jpn`, `GET /api/jpn/:id/ppd` | public school/JPN/PPD pickers (used by login and register) |
| `GET /api/students/search`, `GET /api/admin/teachers`, `GET /api/admin/teachers/:id/classrooms`, `GET /api/admin/config/defaults` | lookups |

Subscriptions, packages, parent invites, complimentary students, **`POST /api/admin/students/import`** and **`GET /api/admin/schools/:id/quota`** are **BE-25**, not this card (the student import refuses a school without an active subscription and checks the quota, which BE-25 owns; BE-25 reuses this card's import service). `GET/POST /api/admin/users/:id/packages` are BE-25 too. `GET /api/admin/teachers/:id/classrooms` reads classes through `ClassesRepository` once BE-17 exists; until then it returns an empty list (mock shape) and the PR says so.

## DB tables touched

`users`, `user_roles`, `user_scopes`, `schools`, `import_jobs` (new, per-row results).; **OD-28 (2026-10-19, OWN-4):** `jpns`, `ppds` (new, `schools.prisma`).

## Acceptance criteria

1. Each endpoint above returns what the mock returns for the same input. Proof: port the cases of `src/modules/m02-users-schools/__tests__/mock/**` to supertest and assert status, `error.code`, `error.message` (exact) and the body parsed with the contract schema. Ids are opaque strings; timestamps `+08:00`.
2. Exact messages (mock constants): created "Pengguna berjaya didaftarkan.", updated "Pengguna berjaya dikemaskini.", deleted "Pengguna berjaya dipadam.", toggle "Status pengguna berjaya dikemaskini.", own delete "Anda tidak boleh memadam akaun sendiri.", own impersonate "Anda tidak boleh Login As akaun sendiri.", target without a valid role "Pengguna ini tiada peranan yang sah untuk log masuk.".
3. Admin Sekolah sees and edits only users of the own school: another school's id gives 404; a body `schoolId` of another school is rejected (test for create and update).
4. The rules of `users-rules.ts` are enforced (role combinations, unique e-mail and username, school required for school roles): each case of its mock test gives the same status and `fields` key; an invalid role combination is 422 `VALIDATION_ERROR`.
5. IC numbers are accepted on input and stored only as hash + masked value; responses return only the masked value; a log-capture test and a DB-dump test find no clear IC.
6. Bulk user import (`POST /api/admin/users/bulk-import`, mock BR-14): an empty file gives 422 "Tiada data untuk diimport."; the import is atomic in the mock (a failure rolls the whole import back), so a malformed line is reported in the result and valid lines import only as the mock's `planUserImport` decides (replay `src/modules/m02-users-schools/__tests__/mock/**` import cases); the roles are limited to teacher, parent, school_admin, ppd_officer; the file size and row limits equal the constants in `src/modules/m02-users-schools/mock/import/*.ts` (read them, do not guess).
7. Deleting a user with dependent rows follows the mock rule in `users-admin.ts` (block or cascade); the rule you implement is stated in the PR and covered by a test.
8. List pagination `meta` (`page`, `pageSize`, `totalItems`, `totalPages`, `from`, `to`, `counts`) is exact for the seeded data; a test recomputes the counts from the table.
9. ~~`POST /api/admin/users/:id/impersonate`~~ is not built (user decision 2026-10-19, UD-2): there is one mechanism only, Mod Pelajar via `POST /api/session/mode` (D31c). A test asserts that the route does not exist (404).
10. Roles: only `admin` may use `/api/admin/users*`, `/api/admin/schools*`, `/api/admin/teachers*`, `/api/admin/config/defaults` except where the mock allows `school_admin` (per `requireAdmin`/`requireSchoolAdmin` guards in the handlers); everyone else gets 403; no session 401; missing CSRF 403 `CSRF_INVALID`.
11. **OD-28 (2026-10-19, OWN-4):** `jpns` and `ppds` exist and are filled by the seed from the distinct state and district of the seeded schools (one `jpns` row per state, one `ppds` row per district under its JPN, `ppds.code` equal to the school `district` value); every seeded school resolves to one JPN and one PPD; `GET /api/jpn` returns the JPN list with its PPDs in the mock shape; `jpns.code` and `ppds.code` are unique; both tables carry `legacy_source`/`legacy_id` with the unique pair and are listed in `migratable-models.json`.

## Test commands

```
npm run be:test -- apps/api/test/users apps/api/test/schools
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/users/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
4. Migration-first checklist of plan section 14.9 (items 1 to 6) is complete for every table this card creates. Item 6 (insert a `legacy_source = 'cloud'` row twice through the BE-34 upsert helper and assert one row) applies once BE-34 is merged; state in the PR whether it was available.
5. Label `security-review` on the PR; list the security decisions and the tests that prove them.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Migration-first (plan sections 14 and 14.9)

- Follow the checklist of plan section 14.9 (items 1 to 6) for every table listed under "DB tables touched".
- Each table that could receive .cloud rows has `legacy_source text null`, `legacy_id text null` and `unique (legacy_source, legacy_id)`, and is listed in `apps/api/prisma/migratable-models.json`. These columns never appear in the contract or in an API response.
- Enums are `text` + `check` with English codes (no Postgres enum types); anything the source may lack is nullable or has a documented default; seeds never set `legacy_*` and are idempotent.
- Add or update this entity's row in the mapping matrix (plan section 14.7) in the same PR.
- **OD-28 (2026-10-19, OWN-4):** the matrix rows `jpns` and `ppds` (derived from distinct `schools.state` and `schools.district`, T-09) are owned by this card.

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. The mock keeps `faith` in user settings (M01 BR-17) while the data-migration plan drops `faith` from `users` (Q7). This card stores no `faith`; BE-06 asks the question for settings.
2. Deleting a user with dependent rows: the working rule is the mock's (read `users-admin.ts`); confirm cascade versus block for real data.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-05 (users-schools). Work in this repo clone on branch be/BE-05-users-schools, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-05-users-schools.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-05. Write the users/schools contract from the M02 mock handlers and api types, realigned per docs/architecture/v2-frontend.md section 6 (roles list, username, nullable e-mail, two status flags, masked IC, school joinCode, string ids). Persist with Prisma, scope-filter every query through ScopeFilter from BE-03, expose repositories as the only doorway for other modules, and add the school seed. Do not implement subscriptions/packages/parent invites (BE-25). Needs a security review.
```
