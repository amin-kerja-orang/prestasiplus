# BE-02 PostgreSQL service, Prisma setup and test harness

| Field | Value |
|---|---|
| Size | M |
| Wave | 0 |
| Depends on | BE-01 |
| Parallel with | BE-14, BE-27 |
| Owner module | platform |

## Goal

Add the `db` service, wire Prisma (schema folder, one `.prisma` file per owner module), the migration workflow, a Postgres-backed integration-test harness, a transaction helper and the seed runner skeleton.

## Inputs (read these)

- `docs/architecture/v2-backend-plan.md` sections 3, 5, 9, 11
- `docs/architecture/v2-data-migration.md` section 4.0 (X1 to X6)
- `docs/adr/0014-store-ownership-and-repositories.md`, `docs/adr/0006-determinism-seeds-clock-ids.md`
- `compose.yaml` (commented `db`), `docs/ops/containers.md`, `src/mock/db/*` (the mock's table and transaction semantics)

## Outputs

- `compose.yaml`: `db` service active (`postgres:16-alpine`, named volume `pgdata`, healthcheck, **no host port**); `api` `depends_on` db healthy; `.env.db.example`
- `apps/api/prisma/schema/base.prisma` (datasource, generator with `prismaSchemaFolder`) and empty module files named after the owner modules (ADR-0014)
- `apps/api/prisma/migrations/0001_init` (extensions only, e.g. `pgcrypto`; no business tables)
- `apps/api/src/db/{prisma.service.ts,transaction.ts,clock.ts,ids.ts}`: `Clock` abstraction (fixed clock in tests, `Asia/Kuala_Lumpur` day helper), id helpers (bigint to decimal string)
- `apps/api/test/support/{db.ts,app.ts}`: Testcontainers (or compose db) start, truncate or schema isolation between tests, `createTestApp()`
- `apps/api/prisma/seed/index.ts`: runner that executes domain seed modules in a declared order (empty list now); the `be:db:*` scripts work
- `compose.override.example.yaml` documenting the optional host port mapping (`127.0.0.1:${DB_HOST_PORT:-5434}:5432`)

## Endpoints

None new. `GET /api/health` gains `db: 'up'` (`select 1`); with the DB down it returns 503 with `SERVER_ERROR` in the error shape.

## DB tables

None yet (only extensions and Prisma's `_prisma_migrations`). Encode the conventions of plan section 5 as helpers or a lint script: identity `bigint` PKs, `created_at`/`updated_at timestamptz`, `legacy_source text null` + `legacy_id text null` with `unique (legacy_source, legacy_id)` on migratable tables (plan section 14.2; the lint script is BE-34), `is_test boolean default false` where required, English enum codes.

## Acceptance criteria

1. `docker compose up -d db` becomes healthy; `npm run be:db:migrate` applies on an empty database; `npm run be:db:reset` (dev only, refuses when `NODE_ENV=production`) works.
2. `npm run be:test` starts a throw-away Postgres 16 and runs an example integration test that inserts and reads through `PrismaService` inside a rolled-back transaction.
3. The transaction helper commits on success and rolls back on throw; nested calls reuse the outer transaction (unit-tested).
4. The seed runner is deterministic and idempotent: running `be:db:seed` twice yields identical row counts and uses a seeded PRNG, never `Math.random` or `Date.now` directly.
5. `docker compose up db api` starts both; health reports `db: 'up'`; the `pgdata` volume survives `down` and `up`.
6. The CI workflow from BE-01 runs integration tests with a Postgres service container.
7. No credentials in git; compose reads them from `.env.db`.

## Test commands

```
docker compose up -d db
npm run be:db:migrate
npm run be:verify
docker compose config        # valid, no inline secrets
```

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-02 (db-orm). Work in this repo clone on branch be/BE-02-db-orm, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10); docs/plan/backend-tasks/BE-02-db-orm.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs.
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-02. Activate the db service in compose.yaml (no host port), set up Prisma with prismaSchemaFolder, the migration/seed scripts, PrismaService, a transaction helper, a Clock abstraction (Asia/Kuala_Lumpur day helper), and the Postgres test harness (Testcontainers preferred). Make CI use a Postgres service. Do not create business tables.
```
