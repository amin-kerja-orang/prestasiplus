# BE-02 PostgreSQL service, Prisma setup and test harness

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-1 (folders: sessions.md section 5) |
| Priority | P0 |
| Wave | 0 |
| Depends on | BE-01 |
| Parallel with | BE-14, BE-34 (after BE-02 merges) |
| Owner module | platform |

## Goal

Add the `db` service, wire Prisma (schema folder, one `.prisma` file per owner module), the migration workflow, a Postgres-backed integration-test harness, a transaction helper and the seed runner skeleton.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5, `docs/architecture/v2-backend-plan.md` sections 3, 5, 9, 11 and 14.2
- `docs/architecture/v2-data-migration.md` section 4.0 (X1 to X6)
- `docs/adr/0014-store-ownership-and-repositories.md`, `docs/adr/0006-determinism-seeds-clock-ids.md`
- `compose.yaml` (commented `db`), `docs/ops/containers.md`, `src/mock/db/*` (the mock's table and transaction semantics), `src/mock/determinism/*` (seeded PRNG and clock the helpers mirror)
- BE-01 outputs (registries, `.env.api.example`, workflow)

## Outputs

- `compose.yaml`: `db` service active (`postgres:16-alpine`, named volume `pgdata`, healthcheck, **no host port**); `api` `depends_on` db healthy; `.env.db.example`
- `compose.override.example.yaml` documenting the optional host port mapping (`127.0.0.1:${DB_HOST_PORT:-5434}:5432`)
- `apps/api/prisma/schema/base.prisma` (datasource and generator with `prismaSchemaFolder`) **only**: every lane creates its own `<module>.prisma` in its first card, so there are no empty placeholder files that could clash
- `apps/api/prisma/migrations/0001_init` (extensions only, e.g. `pgcrypto`; no business tables)
- `apps/api/prisma/migratable-models.json` created as an empty alphabetical JSON array of model names (each table-creating card appends; BE-34 adds the lint)
- `apps/api/src/db/{prisma.service.ts,transaction.ts,clock.ts,ids.ts}`: `Clock` abstraction (fixed clock in tests, `Asia/Kuala_Lumpur` day helper), id helpers (bigint to decimal string)
- `apps/api/test/support/{db.ts,app.ts}`: Testcontainers (or compose db) start, truncate or schema isolation between tests, `createTestApp()`
- `apps/api/prisma/seed/index.ts` runner (extends the BE-01 registry): executes seed modules in the declared order, deterministic, and accepts `--profile=<name>` (default `poc`; an entry that declares no profile runs in every profile); the registry is empty now. `be:db:migrate`, `be:db:reset`, `be:db:seed` work
- CI: the Postgres service container in `.github/workflows/api.yml`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `compose.yaml`, `.env.db.example`, `compose.override.example.yaml`, `apps/api/src/db/**`, `apps/api/test/support/**`, `apps/api/prisma/seed/index.ts`, `apps/api/prisma/migratable-models.json`, `apps/api/package.json`, `.github/workflows/api.yml`, `.gitignore`.
- Prisma file(s): `apps/api/prisma/schema/base.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: none.
- Seeds: none.
- Tests: `apps/api/test/db/**`.
- Append-only shared files (one line each, never reorder): `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: Only BE-02 edits base.prisma and the seed runner; BE-03 and all table cards depend on it.

## Endpoints

| Method and path | Change |
|---|---|
| `GET /api/health` (from BE-01) | gains `db: 'up'` (`select 1`); with the database down it returns 503 with `SERVER_ERROR` in the standard error shape (message "Server Error") |

No new routes. No mock route exists for health.

## DB tables

None yet (only extensions and Prisma's `_prisma_migrations`). Encode the conventions of plan section 5 as helpers or a lint script: identity `bigint` PKs, `created_at`/`updated_at timestamptz`, `legacy_source text null` + `legacy_id text null` with `unique (legacy_source, legacy_id)` on migratable tables (plan section 14.2; the lint script is BE-34), `is_test boolean default false` where required, English enum codes.

## Acceptance criteria

1. `docker compose up -d db` becomes healthy; `npm run be:db:migrate` applies `0001_init` on an empty database; `npm run be:db:reset` works in dev and exits non-zero without touching the database when `NODE_ENV=production` (test).
2. `npm run be:test` starts a throw-away Postgres 16 and runs an example integration test that inserts and reads through `PrismaService` inside a transaction that is rolled back (the row is gone afterwards).
3. Transaction helper unit tests: it commits on success; it rolls back on throw and rethrows; a nested call reuses the outer transaction (an inner throw rolls back the outer work).
4. Seed runner: running `be:db:seed` twice on a seeded dummy module yields identical row counts and identical row content; it takes randomness only from a seeded PRNG (a test or ESLint rule fails on `Math.random` or `Date.now` under `apps/api/prisma/seed/**`); `--profile=test` skips entries declared for `poc` only.
5. `Clock` tests: with a fixed clock at 2026-10-19T23:59:59+08:00 and 00:00:01 the Malaysia day helper returns two different dates; the id helper maps a bigint to its decimal string and back.
6. `docker compose up db api` starts both; `GET /api/health` reports `db: 'up'`; with `docker compose stop db` it returns 503 `SERVER_ERROR`; the `pgdata` volume survives `down` and `up`.
7. The CI workflow from BE-01 runs the integration tests with a Postgres service container.
8. No credentials in git; `docker compose config` shows credentials only as `${...}` variables read from `.env.db`.

## Test commands

```
docker compose up -d db
npm run be:db:migrate
npm run be:verify
docker compose config        # valid, no inline secrets
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green. Paste the real tail of the output in the PR.
3. This card has no HTTP endpoints, so it adds no conformance scenarios; after BE-31 merges, `npm run be:test -- apps/api/test/conformance` must still pass.
4. This card creates no tables; the migration-first checklist (plan section 14.9) does not apply, but no change may break `npm run be:lint:migration` (once BE-34 is merged).
5. No security review is required; list any security-relevant decision in the PR anyway.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Open questions

None known. If you meet a rule that neither the mock, the SRS nor this card states, do not invent it: write it under "Open questions" in the PR, and open a GitHub issue labelled `question` if it blocks you.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-02 (db-orm). Work in this repo clone on branch be/BE-02-db-orm, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-02-db-orm.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-02. Activate the db service in compose.yaml (no host port), set up Prisma with prismaSchemaFolder, the migration/seed scripts, PrismaService, a transaction helper, a Clock abstraction (Asia/Kuala_Lumpur day helper), and the Postgres test harness (Testcontainers preferred). Make CI use a Postgres service. Do not create business tables.
```
