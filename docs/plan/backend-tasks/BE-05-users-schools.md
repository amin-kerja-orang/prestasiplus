# BE-05 Users and schools (M02): admin CRUD, search, import

| Field | Value |
|---|---|
| Size | L |
| Wave | 1 |
| Depends on | BE-03 |
| Parallel with | BE-04, BE-08, BE-11, BE-14 |
| Owner module | M02 (users admin extensions, schools); M01 owns the base users table |
| Security review | required (personal data, bulk import) |

## Goal

Persist and serve the M02 user and school management used by Admin Pusat and Admin Sekolah: user list/filters/detail/create/update/delete/toggle-active, bulk delete and bulk import, school list/options/search/create, impersonation entry used by Mod Pelajar, all scope-filtered.

## Inputs (read these)

- `docs/requirements/srs/M02-users-schools.md`, `docs/requirements/urs/M02-users-schools.md`
- Mock handlers: `src/modules/m02-users-schools/mock/handlers/{users-admin,users-input,users-rules,users-shape,users-packages,schools-admin,schools-public,imports,admin-config}.ts`; tables in `src/modules/m02-users-schools/mock/tables`
- Frontend client and types: `src/modules/m02-users-schools/api/*`
- `docs/architecture/v2-data-migration.md` section 4.1 (M01/M02 realignments), section 5 (IC, faith, roles)
- `docs/architecture/v2-frontend.md` section 6 (M02 row: `roles[]`, `username`, nullable e-mail, two status flags, masked IC, `joinCode`)
- BE-03 outputs (`identity.prisma`, guards, `ScopeFilter`)

## Outputs

- Contract: `packages/contract/src/users/**`, `packages/contract/src/schools/**`
- `apps/api/prisma/schema/{users,schools}.prisma` + migration extending BE-03 tables (profile fields, `is_active`, `is_suspended`, `join_code`, `class_label`, `ic_hash`, `ic_masked`, no plaintext IC, no `faith`)
- `apps/api/src/modules/{users,schools}/**` (repositories are the only doorway to these tables, ADR-0014: `users.get`, `findByEmail`, `search`, `schools.search`, `schools.options` for other cards)
- Import service for CSV (students, bulk users) with a per-row result report
- Seed: `apps/api/prisma/seed/schools.ts` (a small fictitious set of schools across 2 states and 2 districts)
- Tests under `apps/api/test/users/**`, `apps/api/test/schools/**`

## Endpoints (path strings as in the mock; shapes from `m02-users-schools/api`)

| Method and path | Notes |
|---|---|
| `GET /api/admin/users`, `GET /api/admin/users/filters`, `GET /api/admin/users/:id` | list with filters, pagination meta with `counts`; scope-filtered |
| `POST /api/admin/users`, `PUT /api/admin/users/:id`, `DELETE /api/admin/users/:id` | create/update/delete; rules from `users-rules.ts` (role combinations, unique e-mail/username, school required for school roles) |
| `POST /api/admin/users/:id/toggle-active`, `POST /api/admin/users/bulk-delete`, `POST /api/admin/users/bulk-import`, `POST /api/admin/students/import` | bulk operations with result report |
| `POST /api/admin/users/:id/impersonate` | the existing "Mod Pelajar"/act-as entry; align with the session mode of BE-03 and flag conflicts |
| `GET /api/admin/schools`, `GET /api/admin/schools/options`, `POST /api/admin/schools` | admin school management |
| `GET /api/schools`, `GET /api/schools/search`, `GET /api/jpn` | public school picker (used by login/register) |
| `GET /api/students/search`, `GET /api/admin/teachers`, `GET /api/admin/teachers/:id/classrooms`, `GET /api/admin/config/defaults` | lookups |

Subscriptions, packages, parent invites and complimentary students are **BE-25**, not this card.

## DB tables touched

`users`, `user_roles`, `user_scopes`, `schools`, `import_jobs` (new, per-row results).

## Acceptance criteria

1. Every endpoint above returns what the mock returns for the same input (compare against the mock handler tests in `src/modules/m02-users-schools/__tests__/mock`), with ids as opaque strings and timestamps `+08:00`.
2. Admin Sekolah sees and edits only users of own school: other-school ids give 404; a request body cannot set another school.
3. Rules from `users-rules.ts` are enforced (invalid role combination 422 with the BM message; duplicate e-mail 409/422 as the mock does).
4. IC numbers are accepted on input but stored only as hash + masked value; responses return only the masked value; logs contain neither.
5. Bulk import is transactional per row with a report; a malformed row does not abort the whole file; file size and row limits follow the mock.
6. Deleting a user with dependent rows follows the mock rule (block or cascade; note which in the PR).
7. List pagination `meta` (`page`, `pageSize`, `totalItems`, `totalPages`, `counts`) is exact.

## Test commands

```
npm run be:test -- apps/api/test/users apps/api/test/schools
npm run be:verify
```

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-05 (users-schools). Work in this repo clone on branch be/BE-05-users-schools, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10); docs/plan/backend-tasks/BE-05-users-schools.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs.
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-05. Write the users/schools contract from the M02 mock handlers and api types, realigned per docs/architecture/v2-frontend.md section 6 (roles list, username, nullable e-mail, two status flags, masked IC, school joinCode, string ids). Persist with Prisma, scope-filter every query through ScopeFilter from BE-03, expose repositories as the only doorway for other modules, and add the school seed. Do not implement subscriptions/packages/parent invites (BE-25). Needs a security review.
```
