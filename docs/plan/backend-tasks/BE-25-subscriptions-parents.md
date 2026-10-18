# BE-25 School subscriptions, packages, parent invites, complimentary students (M02 rest)

| Field | Value |
|---|---|
| Size | M |
| Wave | 1 |
| Depends on | BE-05 |
| Parallel with | BE-06, BE-08, BE-11, BE-24 |
| Owner module | M02 |

## Goal

The remaining M02 stores: school subscriptions (create, extend, upgrade, cancel, quota, renewal invoice data), user package assignment, parent invite tokens and parent-student links (L45 "Jemput Ibu Bapa"), and complimentary (free) students. Also `isSubscribed` / trial inputs used by BE-12.

## Inputs (read these)

- `docs/requirements/srs/M02-users-schools.md`, `docs/requirements/srs/L45-jemput-ibu-bapa.md`, `docs/discovery/L45-jemput-ibu-bapa.md`
- Mock: `src/modules/m02-users-schools/mock/handlers/{subscriptions,users-packages,comp-students,parent-invites,parent-invites-store,parent-links-store,school-admin-packages-store}.ts`
- `docs/architecture/v2-data-migration.md` section 4.1, Q6 (how subscription status is derived: latest paid unexpired payment + school subscription + PKSK access; **confirm before the ETL**)
- BE-05 repositories

## Outputs

- Contract: `packages/contract/src/subscriptions/**`, `packages/contract/src/parents/**`
- `apps/api/prisma/schema/subscriptions.prisma` + migration: `school_subscriptions`, `school_packages`, `user_packages`, `parent_links` (with `relationship`), `parent_invites`, `comp_students`
- `apps/api/src/modules/subscriptions/**` with `SubscriptionService.isSubscribed(userId)`
- Tests under `apps/api/test/subscriptions/**`

## Endpoints (paths from the mock)

| Method and path | Notes |
|---|---|
| `GET /api/admin/school-packages`, `GET /api/admin/school-subscriptions`, `GET /api/admin/school-subscriptions/:id`, `GET .../:id/students`, `GET .../:id/renewal-invoice` | reads |
| `POST /api/admin/school-subscriptions`, `POST .../:id/extend`, `POST .../:id/upgrade`, `POST .../:id/cancel`, `PUT .../:id/quota` | writes with the mock's rules |
| `GET /api/admin/users/:id/packages`, `POST /api/admin/users/:id/packages` | per-user packages |
| `GET /api/admin/comp-students`, `GET /api/admin/comp-students/:id`, `POST /api/admin/comp-students`, `POST .../:id/toggle-active`, `POST .../:id/toggle-coins`, `POST .../bulk-action` | complimentary students |
| `GET /api/me/parent-invite`, `POST /api/me/parent-invite/generate`, `GET /api/parent-invites/:token`, `POST /api/parent-invites/:token/accept` | parent invites (token public read, accept needs a session) |

## DB tables touched

As listed in Outputs; `users`, `schools` (read).

## Acceptance criteria

1. Quota rules: enrolling beyond the quota is rejected with the mock's error; extending/upgrading/cancelling update dates and status exactly as the mock handlers do (table-driven tests from the mock tests).
2. Parent invite tokens are random, hashed at rest, single-use, expiring; `GET /api/parent-invites/:token` reveals only the minimal child info the mock shows; accept links parent and student with `relationship`.
3. `SubscriptionService.isSubscribed` follows one documented derivation (state it in the PR; Q6 default) and is the single place BE-12 calls.
4. School-admin-only routes see only their school's subscription (404 otherwise); `admin` sees all.
5. Complimentary toggles audit-log the actor.

## Test commands

```
npm run be:test -- apps/api/test/subscriptions
npm run be:verify
```

## Migration-first (plan section 14)

- Every new table that could receive .cloud rows carries `legacy_source`, `legacy_id` and `unique (legacy_source, legacy_id)`, and is added to `apps/api/prisma/migratable-models.json`. Not in the contract.
- Enums are `text` + `check` (English codes); anything the source may lack is nullable or has a documented default.
- Add or update this entity's row in the mapping matrix (plan section 14.7) in the same PR; seeds must not set `legacy_*` and must be idempotent.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-25 (subscriptions-parents). Work in this repo clone on branch be/BE-25-subscriptions-parents, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10); docs/plan/backend-tasks/BE-25-subscriptions-parents.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs.
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-25 from the M02 subscription, comp-student and parent-invite mock handlers. Money fields use numeric(10,2) RM (X4). Parent invite tokens must be random, hashed and single-use. Implement SubscriptionService.isSubscribed with the documented Q6 default and flag it as an open question.
```
