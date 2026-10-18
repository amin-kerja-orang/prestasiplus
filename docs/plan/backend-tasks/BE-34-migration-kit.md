# BE-34 Migration kit: legacy-column convention, ETL control tables, upsert helper, dry-run runner

| Field | Value |
|---|---|
| Size | M |
| Wave | 0/1 (starts right after BE-02, parallel with BE-03) |
| Depends on | BE-02 |
| Parallel with | BE-03, BE-14, BE-04, BE-05 |
| Owner module | migration (new; supports MIG-07) |
| Security review | not required (no personal data handled; tables hold ids and counts only) |

## Goal

Make "migration-first" (plan section 14) enforceable: one shared convention for `legacy_source` / `legacy_id` on migratable tables, the ETL control tables, a generic idempotent upsert helper, and a dry-run-capable runner skeleton that BE-27/28/29/30 build on. No .cloud knowledge is needed here; this card is pure infrastructure.

## Inputs (read these)

- `docs/architecture/v2-backend-plan.md` section 14 (all of it), section 5, section 3
- `docs/architecture/v2-data-migration.md` sections 5 (risks) and 6
- BE-02 outputs (Prisma setup, test harness, the section 5 conventions helper)

## Outputs

- `apps/api/prisma/schema/etl.prisma` + migration: `etl_runs`, `etl_checkpoints`, `etl_id_map`, `etl_rejects`, `etl_recon` (columns in plan 14.4)
- `apps/api/prisma/migratable-models.json` (initially lists the models that already exist, e.g. `users`; each later card appends)
- `apps/api/scripts/check-migratable.ts` and an npm script `be:lint:migration` wired into `be:verify`: fails when a listed model lacks `legacy_source`, `legacy_id`, `legacy_hash` (where required) or the unique index `(legacy_source, legacy_id)`; also fails on Postgres enum types in new migrations
- `apps/api/src/migration/kit/**`: `upsertByLegacy()` (temp-table `COPY` + `ON CONFLICT (legacy_source, legacy_id) DO UPDATE`, skip unchanged by `legacy_hash`), `IdMap` (resolve and register ids), `Rejects` (reason codes, no personal values), `RunLedger`, checkpoint helper, batch iterator, and a `Runner` with `--dry-run` (default; everything inside a rolled-back transaction or a scratch schema) and `--apply` (refuses unless a dry-run on the same input hash passed)
- `apps/api/src/migration/cli.ts` command skeleton (`migrate:*` subcommands register themselves; no real entity yet except a tiny demo entity used only in tests)
- `.gitignore` additions: `.migration-out/`, `*.dump`, `*.sql.gz`; a CI check that fails when such a file is staged or when a file over 1 MB is added under `apps/api/test/migration/`
- Tests under `apps/api/test/migration/kit/**` (Testcontainers)
- `docs/architecture/v2-backend-deviations.md` entry only if something deviates

## Endpoints

None.

## DB tables touched

New: `etl_*` only. No existing table is altered; the lint reports tables that do not comply yet as warnings listed in the PR (owning cards fix them).

## Acceptance criteria

1. Running `upsertByLegacy` twice with the same rows yields one row per `(legacy_source, legacy_id)` and zero updates the second time when `legacy_hash` is unchanged; a changed hash updates only that row.
2. Rows with `legacy_source IS NULL` (born in v2) are never touched by the helper (test with a mixed table).
3. `--dry-run` leaves no change in any non-`etl_*` table and writes a run row marked `dry-run`; `--apply` without a prior passing dry-run on the same input hash exits non-zero with a clear message.
4. A rejected row is recorded with entity, `legacy_id`, reason code and column but never with the row's values (test inspects the table).
5. `be:lint:migration` fails on a fixture model that lacks the unique index and passes after it is added; the lint is part of `be:verify` and of CI.
6. Self-reference two-pass helper: pass 1 inserts with `NULL`, pass 2 updates through `IdMap`; the FK is `DEFERRABLE INITIALLY DEFERRED` in the test table.
7. Checkpoint resume: killing a run after batch N and re-running continues at batch N+1 with identical final data.

## Test commands

```
npm run be:test -- apps/api/test/migration/kit
npm run be:lint:migration
npm run be:verify
```

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-34 (migration-kit). Work in this repo clone on branch be/BE-34-migration-kit, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 5, 9, 10 and the whole of 14); docs/plan/backend-tasks/BE-34-migration-kit.md (this card, all of it).
Rules: contract first does not apply (no endpoints). Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or contract folders. Keep the diff inside the card Outputs. Do not edit other lanes' prisma schema files; report non-compliant models in the PR instead.
Task: build the migration kit exactly as plan section 14 describes: etl_* tables, migratable-models lint, upsertByLegacy, IdMap, Rejects, RunLedger, checkpoints, dry-run/apply runner, .gitignore and CI guard. Tests use Testcontainers against real Postgres. No .cloud schema knowledge is needed; use a tiny demo entity in tests only.
When finished run npm run be:verify and report: files changed, tables, real test output, deviations, open questions. Update docs/plan/backend-tracker.md (your card row: status, branch, PR) in the same PR.
```
