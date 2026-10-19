# BE-34 Migration kit: legacy-column convention, ETL control tables, upsert helper, dry-run runner

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-4 (folders: sessions.md section 5) |
| Priority | P0 |
| Wave | 0/1 (starts right after BE-02, parallel with BE-03) |
| Depends on | BE-02 |
| Parallel with | BE-03, BE-14, BE-04, BE-05 |
| Owner module | migration (new; supports MIG-07) |
| Security review | not required (no personal data handled; tables hold ids and counts only) |

## Goal

Make "migration-first" (plan section 14) enforceable: one shared convention for `legacy_source` / `legacy_id` on migratable tables, the ETL control tables, a generic idempotent upsert helper, and a dry-run-capable runner skeleton that BE-27/28/29/30 build on. No .cloud knowledge is needed here; this card is pure infrastructure.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/architecture/v2-backend-plan.md` section 14 (all of it), section 5, section 3
- `docs/architecture/v2-data-migration.md` sections 5 (risks) and 6
- BE-02 outputs (Prisma setup, test harness, the section 5 conventions helper, the empty `apps/api/prisma/migratable-models.json`)

## Outputs

- `apps/api/prisma/schema/etl.prisma` + migration: `etl_runs`, `etl_checkpoints`, `etl_id_map`, `etl_rejects`, `etl_recon` (columns in plan 14.4). They are control tables: not migratable, no `legacy_*` columns, not listed in `migratable-models.json`.
- `apps/api/prisma/migratable-models.json` (created empty by BE-02): this card documents its format (alphabetical JSON array of model names) and lists any migratable model that already exists (for example `users` if BE-03 has merged); each later table-creating card appends its own models
- `apps/api/scripts/check-migratable.ts` and the npm script `be:lint:migration`, wired into `be:verify`: fails when a listed model lacks `legacy_source`, `legacy_id`, `legacy_hash` (where required) or the unique index `(legacy_source, legacy_id)`; also fails on Postgres enum types in new migrations
- `apps/api/src/migration/kit/**`: `upsertByLegacy()` (temp-table `COPY` + `ON CONFLICT (legacy_source, legacy_id) DO UPDATE`, skip unchanged by `legacy_hash`), `IdMap` (resolve and register ids), `Rejects` (reason codes, no personal values), `RunLedger`, checkpoint helper, batch iterator, and a `Runner` with `--dry-run` (default; everything inside a rolled-back transaction or a scratch schema) and `--apply` (refuses unless a dry-run on the same input hash passed)
- `apps/api/src/migration/cli.ts` command skeleton (`migrate:*` subcommands register themselves; no real entity yet except a tiny demo entity used only in tests)
- `.gitignore` additions: `.migration-out/`, `*.dump`, `*.sql.gz`; a CI check in `.github/workflows/api.yml` that fails when such a file is staged or when a file over 1 MB is added under `apps/api/test/migration/`
- Tests under `apps/api/test/migration/kit/**` (Testcontainers)
- `docs/architecture/v2-backend-deviations.md` entry only if something deviates

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/migration/kit/**`, `apps/api/src/migration/cli.ts`, `apps/api/scripts/check-migratable.ts`, `apps/api/test/migration/kit/**`.
- Prisma file(s): `apps/api/prisma/schema/etl.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: none.
- Seeds: none.
- Tests: `apps/api/test/migration/kit/**`.
- Other files: `apps/api/package.json` (script `be:lint:migration`) and the root `package.json` `be:verify` script (one added step); `.gitignore` and one CI guard step in `.github/workflows/api.yml`.
- Append-only shared files (one line each, never reorder): `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: etl.prisma belongs to this card alone; BE-27 to BE-30 only read and write its tables through the kit.
- **Exception needing the lead's approval in the PR (outside the lane list):** `.gitignore`, the CI guard step in `.github/workflows/api.yml` and the `be:verify` wiring in the root `package.json` belong to PC-1's area; they are named here and approved by the lead in this PR (sessions.md section 5 already assigns `apps/api/scripts/check-migratable.ts` to PC-4).

## Endpoints

None.

## DB tables touched

New: `etl_*` only. No existing table is altered; the lint reports tables that do not comply yet as warnings listed in the PR (owning cards fix them).

## Acceptance criteria

1. Running `upsertByLegacy` twice with the same rows yields one row per `(legacy_source, legacy_id)` and zero updates the second time when `legacy_hash` is unchanged; a changed hash updates only that row (row-level assertions).
2. Rows with `legacy_source IS NULL` (born in v2) are never touched by the helper (test with a mixed table).
3. `--dry-run` leaves no change in any non-`etl_*` table and writes a run row marked `dry-run`; `--apply` without a prior passing dry-run on the same input hash exits non-zero with a clear message (test checks exit code and message).
4. A rejected row is recorded with entity, `legacy_id`, reason code (`UNKNOWN_ENUM`, `ORPHAN_PARENT`, `DUPLICATE_KEY`, `INVALID_VALUE`, `UNSUPPORTED`) and column but never with the row's values (the test inspects every column of `etl_rejects`).
5. `be:lint:migration` fails on a fixture model that lacks the unique index and passes after it is added; it also fails on a migration that creates a Postgres enum; it is part of `be:verify` and of CI. Existing tables that do not comply yet are reported as warnings listed in the PR (owning cards fix them).
6. Self-reference two-pass helper: pass 1 inserts with `NULL`, pass 2 updates through `IdMap`; the FK is `DEFERRABLE INITIALLY DEFERRED` in the test table.
7. Checkpoint resume: killing a run after batch N and re-running continues at batch N+1 with identical final data.
8. The CI guard fails a branch that stages a `*.dump`, a `*.sql.gz` or a file under `.migration-out/` (demonstrated on a throw-away branch, documented in the PR).

## Test commands

```
npm run be:test -- apps/api/test/migration/kit
npm run be:lint:migration
npm run be:verify
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green. Paste the real tail of the output in the PR.
3. This card has no HTTP endpoints, so it adds no conformance scenarios; after BE-31 merges, `npm run be:test -- apps/api/test/conformance` must still pass.
4. This card creates only the `etl_*` control tables, which are not migratable (not in `migratable-models.json`, no `legacy_*` columns); it implements the checklist of plan section 14.9 (lint and upsert helper) for every other card.
5. No security review is required; list any security-relevant decision in the PR anyway.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. Plan 14.9 item 6 (double-upsert test for each migratable table) is generic: working assumption is that this card ships a test that walks `migratable-models.json` and runs the helper twice on a generated row per listed model, so earlier cards do not each need their own.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-34 (migration-kit). Work in this repo clone on branch be/BE-34-migration-kit, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/plan/sessions.md section 5 (folder ownership); docs/architecture/v2-backend-plan.md (sections 3, 5, 9, 10 and the whole of 14); docs/plan/backend-tasks/BE-34-migration-kit.md (this card, all of it).
Rules: contract first does not apply (no endpoints). Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or contract folders. Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md). Do not edit other lanes' prisma schema files; report non-compliant models in the PR instead.
Task: build the migration kit exactly as plan section 14 describes: etl_* tables, migratable-models lint, upsertByLegacy, IdMap, Rejects, RunLedger, checkpoints, dry-run/apply runner, .gitignore and CI guard. Tests use Testcontainers against real Postgres. No .cloud schema knowledge is needed; use a tiny demo entity in tests only.
When finished run npm run be:verify and report: files changed, tables, real test output, deviations, open questions. Update docs/plan/backend-tracker.md (your card row: status, branch, PR) in the same PR.
```
