# BE-25 School subscriptions, packages, parent invites, complimentary students (M02 rest)

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-1 (folders: sessions.md section 5) |
| Priority | P0 |
| Wave | 1 |
| Depends on | BE-05 |
| Parallel with | BE-06, BE-08, BE-11, BE-24 |
| Owner module | M02 |

## Goal

The remaining M02 stores: school subscriptions (create, extend, upgrade, cancel, quota, renewal invoice data), user package assignment, parent invite tokens and parent-student links (L45 "Jemput Ibu Bapa"), and complimentary (free) students. Also `isSubscribed` / trial inputs used by BE-12.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/requirements/srs/M02-users-schools.md`, `docs/requirements/srs/L45-jemput-ibu-bapa.md`, `docs/discovery/L45-jemput-ibu-bapa.md`
- Mock: `src/modules/m02-users-schools/mock/handlers/{subscriptions,users-packages,comp-students,parent-invites,parent-invites-store,parent-links-store,school-admin-packages-store,imports}.ts`, `src/modules/m02-users-schools/mock/{quota.ts,import/*}`, repository `src/modules/m02-users-schools/mock/repository/{subscriptions,billing,complimentary}.ts`; client `src/modules/m02-users-schools/api/*`; mock tests `src/modules/m02-users-schools/__tests__/mock/**`
- Trial rule: `src/modules/m01-authentication/mock/repository/users.ts` (`TRIAL_LIMIT = 50`, `isSubscribed`, `trial`, `incrementTrialUsed`)
- `docs/architecture/v2-data-migration.md` section 4.1, Q6 (how subscription status is derived: latest paid unexpired payment + school subscription + PKSK access; **confirm before the ETL**)
- BE-05 repositories and import service
- Requirements: BE-FR-04, BE-FR-34; BE-NFR-08 ([URS 9.2](../../requirements/v2-backend-urs.md))
- API catalogue part B1 (core, identity, curriculum): [core-identity-curriculum.md](../../architecture/v2-api-catalogue/core-identity-curriculum.md) (endpoint list, wire conventions and open questions for this card's scope)
- Data model: [v2-data-model.md](../../architecture/v2-data-model.md) (tables, keys and indexes of this card; being written 2026-10-19)

## Outputs

- Contract: `packages/contract/src/schools/subscriptions.ts`, `packages/contract/src/schools/parents.ts` (new files in the PC-1 `schools/` contract folder)
- `apps/api/prisma/schema/schools.prisma` additions + migration: `school_subscriptions`, `school_packages`, `user_packages`, `parent_links` (with `relationship`), `parent_invites`, `comp_students`
- `apps/api/src/modules/subscriptions/**` with `SubscriptionService.isSubscribed(userId)`, `trial(userId)` and `incrementTrialUsed(userId)` (the counter column `users.trial_questions_used` is created by BE-05), and `apps/api/src/modules/parents/**` (invites and links)
- Tests under `apps/api/test/subscriptions/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/subscriptions/**`, `apps/api/src/modules/parents/**`.
- Prisma file(s): `apps/api/prisma/schema/schools.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/schools/subscriptions.ts`, `packages/contract/src/schools/parents.ts` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: none.
- Tests: `apps/api/test/subscriptions/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/subscriptions/`.
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (model names, alphabetical); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: schools.prisma was last changed by BE-05 (BE-25 depends on it). BE-06 touches identity.prisma and BE-24 content.prisma, so BE-25 can run in parallel with both.

## Endpoints (24 mock routes, paths from the mock)

Every route below exists in the mock (verified).

| Group | Endpoints |
|---|---|
| School subscriptions | `GET /api/admin/school-packages`, `GET /api/admin/school-subscriptions`, `GET /api/admin/school-subscriptions/:id`, `GET /api/admin/school-subscriptions/:id/students`, `GET /api/admin/school-subscriptions/:id/renewal-invoice`, `POST /api/admin/school-subscriptions`, `POST /api/admin/school-subscriptions/:id/extend`, `POST /api/admin/school-subscriptions/:id/upgrade`, `POST /api/admin/school-subscriptions/:id/cancel`, `PUT /api/admin/school-subscriptions/:id/quota` |
| School quota and student import | `GET /api/admin/schools/:id/quota`, `POST /api/admin/students/import` (needs an active subscription and quota; reuses BE-05's import service) |
| User packages | `GET /api/admin/users/:id/packages`, `POST /api/admin/users/:id/packages` |
| Complimentary students | `GET /api/admin/comp-students`, `GET /api/admin/comp-students/:id`, `POST /api/admin/comp-students`, `POST /api/admin/comp-students/:id/toggle-active`, `POST /api/admin/comp-students/:id/toggle-coins`, `POST /api/admin/comp-students/bulk-action` |
| Parent invites | `GET /api/me/parent-invite`, `POST /api/me/parent-invite/generate`, `GET /api/parent-invites/:token` (public read), `POST /api/parent-invites/:token/accept` (needs a session) |

## DB tables touched

As listed in Outputs; `users`, `schools` (read).

## Acceptance criteria

1. Messages and rules are the mock's: created "Langganan berjaya dicipta.", quota updated "Kuota berjaya dikemaskini.", extended "Tempoh langganan berjaya dilanjutkan.", upgraded "Langganan berjaya dinaik taraf.", cancelled "Langganan berjaya dibatalkan."; upgrading a non-Pemantauan subscription gives "Hanya langganan Pemantauan boleh dinaik taraf."; cancelling a cancelled one gives "Langganan ini sudah dibatalkan."; package assigned "Pakej berjaya ditetapkan."; assigning a package to a non-school-admin gives "Pengguna ini bukan admin sekolah.". Proof: table-driven tests ported from the mock tests (status, code, message, resulting dates and status).
2. Quota (mock `schoolQuota`): quota = `studentQuota` of the latest active (or grace) subscription (latest `startsAt`, then id); `used` = students of the school, active and inactive; `remaining` = max(0, quota - used). `POST /api/admin/students/import` refuses a school with no active subscription with 422 "Sekolah ini tiada langganan aktif. Import pelajar tidak dibenarkan." and an import that exceeds the remaining quota with "Kuota tidak mencukupi." (whole import refused); an empty file gives "Tiada data untuk diimport.".
3. Complimentary students: a pasted line that is not `NAMA, NOKP` gives "Format baris tidak sah. Gunakan NAMA, NOKP."; an IC shorter than 6 digits gives "No. KP mesti sekurang-kurangnya 6 digit."; a bulk action succeeds with "Tindakan berjaya dilaksanakan."; every toggle writes an audit event with the actor.
4. Parent invites: tokens are random, stored hashed, expiring and bound to one student; `GET /api/parent-invites/:token` returns only the minimal child info the mock shows (replay the mock case), `POST .../accept` links parent and student with `relationship`, regenerating gives the message "Link jemputan baru telah dijana!" and invalidates the old token; a used or expired token behaves as the mock.
5. `SubscriptionService.isSubscribed(userId, at)` follows one documented derivation (the mock's: subscription expiry set and after `at`; Q6 default for real data) and is the single place BE-12 calls; `trial(userId, at)` returns `{ active, used, limit: 50, remaining }` with `active = !subscribed`; `incrementTrialUsed` adds exactly 1.
6. School-admin routes see only their own school's subscription (another school's id gives 404); `admin` sees all; all routes under `/api/admin/*` are `admin` only except where the mock guard allows `school_admin`; no session 401; missing CSRF 403 `CSRF_INVALID`.
7. Parent visibility (LEAD decision 2026-10-19, carried from BE-05 USER_ACCESS): a `school_admin` may view/retrieve a parent **only when** the parent has **at least one** linked child **and every** linked child belongs to the admin's school; otherwise **404** (no enumeration). A parent with no linked children is **never** visible to a `school_admin` — **fail-closed**: the vacuous "all children are in my school" reading (which would expose every parent nationwide) is rejected. `admin` sees all. BE-05 already fails this closed because links do not exist until this card; BE-25 enforces the full "≥1 child, all in my school" rule once `parent_links` exists. Proof: a test asserting 404 for a parent with no children, and for a parent whose child is in another school.

## Test commands

```
npm run be:test -- apps/api/test/subscriptions
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/subscriptions/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
4. Migration-first checklist of plan section 14.9 (items 1 to 6) is complete for every table this card creates. Item 6 (insert a `legacy_source = 'cloud'` row twice through the BE-34 upsert helper and assert one row) applies once BE-34 is merged; state in the PR whether it was available.
5. No security review is required; list any security-relevant decision in the PR anyway.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Migration-first (plan sections 14 and 14.9)

- Follow the checklist of plan section 14.9 (items 1 to 6) for every table listed under "DB tables touched".
- Each table that could receive .cloud rows has `legacy_source text null`, `legacy_id text null` and `unique (legacy_source, legacy_id)`, and is listed in `apps/api/prisma/migratable-models.json`. These columns never appear in the contract or in an API response.
- Enums are `text` + `check` with English codes (no Postgres enum types); anything the source may lack is nullable or has a documented default; seeds never set `legacy_*` and are idempotent.
- Add or update this entity's row in the mapping matrix (plan section 14.7) in the same PR.

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. Subscription derivation for real data is Q6 (latest paid unexpired payment + school subscription + PKSK access). Working assumption: the mock's rule (expiry in the future) until Q6 is answered; flag it in the PR.
2. The trial limit of 50 is a provisional M19 rule in the mock. Keep it, configurable through one constant.
3. Money fields use numeric(10,2) RM (X4); the mock stores invoice amounts as numbers: confirm there is no sen-integer variant in the SRS.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-25 (subscriptions-parents). Work in this repo clone on branch be/BE-25-subscriptions-parents, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-25-subscriptions-parents.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-25 from the M02 subscription, comp-student and parent-invite mock handlers. Money fields use numeric(10,2) RM (X4). Parent invite tokens must be random, hashed and single-use. Implement SubscriptionService.isSubscribed with the documented Q6 default and flag it as an open question.
```
