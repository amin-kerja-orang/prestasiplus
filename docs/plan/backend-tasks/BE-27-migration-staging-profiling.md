# BE-27 .cloud migration: staging schema, loader and profiling report (read-only source)

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-4 (folders: sessions.md section 5) |
| Priority | P1 |
| Wave | M (migration stream; independent of the API lanes) |
| Depends on | BE-02, BE-34; **open decision OD-2** (how the collaborator gets .cloud data) |
| Parallel with | every API card (after BE-34 merges) |
| Owner module | migration (MIG-01, MIG-08) |
| Security review | required (personal data of minors) |

## Goal

Build the first stage of the ETL: copy the .cloud tables (raw) into a `staging_cloud` Postgres schema from an **anonymised dump or fixtures**, and produce the profiling report that MIG-01 asks for (row counts, distinct enum values, orphan and duplicate reports, hash prefixes), without ever writing to the source.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/architecture/v2-data-migration.md` (all of it, especially sections 0, 1 inventory, 2, 5, 6.1, 6.2 MIG-01/MIG-08, and 7)
- `docs/requirements/v2-cloud-gap.md`
- `docs/architecture/v2-backend-plan.md` sections 9 (secrets and data protection), 13 (OD-2, OD-10, OD-13) and 14 (all)
- BE-02 (Prisma, db harness) and BE-34 (`etl_*` tables, runner, `.gitignore` guard) outputs
- Requirements: BE-NFR-13; BE-MIG-05, BE-MIG-06 ([URS 9.2](../../requirements/v2-backend-urs.md))

## Outputs

- `apps/api/src/migration/` CLI (Nest standalone or plain Node entry; npm scripts in `apps/api/package.json`, run from the root as `npm run staging:load -w @pp/api`): `staging:load`, `staging:profile`
- `apps/api/src/migration/cloud-source.ts`: connection only through `CLOUD_SOURCE_URL`; on connect it **verifies the role is read-only** (no INSERT, UPDATE, DELETE or DDL privilege), or uses the file/dump input mode, and refuses otherwise
- `apps/api/src/migration/ddl/staging_cloud.sql`: raw table definitions for the tables that are migrated or archived, taken from the inventory of `v2-data-migration.md` section 1 using the **final table names** (the canonical `exam_papers`, the renamed `teacher_reference_papers`; section 1, note on the rename). It is executed by `staging:load`, not by Prisma, so no Prisma file changes.
- A second source `staging_my` as an empty extension point (OD-13): the loader accepts a source name, only `cloud` is implemented
- `apps/api/src/migration/profile/**`: report generators writing `./.migration-out/profile-<date>.md/json` (git-ignored, aggregates only, **no row values for personal columns**)
- `apps/api/test/migration/fixtures/` tiny **synthetic** fixtures in the .cloud shape (generated, fictitious, each file under 1 MB)
- `docs/architecture/v2-migration-runbook.md` (created here: how to run each stage, where dumps live, how to delete them)
- Tests under `apps/api/test/migration/staging/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/migration/cloud-source.ts`, `apps/api/src/migration/ddl/**`, `apps/api/src/migration/profile/**`, `apps/api/src/migration/staging/**`, `apps/api/test/migration/staging/**`, `apps/api/test/migration/fixtures/**`, `docs/architecture/v2-migration-runbook.md`.
- Prisma file(s): none (no schema change).
- Contract: none.
- Seeds: none.
- Tests: `apps/api/test/migration/staging/**`.
- Other files: `apps/api/package.json` (scripts `staging:*`).
- Append-only shared files (one line each, never reorder): `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: PC-4 owns `apps/api/src/migration/**`. This card creates no Prisma file (staging schemas come from raw DDL), so it cannot clash with any API card; BE-35 later extends the same folder and depends on it.

## Endpoints

None.

## DB tables touched

Schema `staging_cloud.*` (raw copy) and `archive_cloud.*` (question tables kept read-only). v2 tables are untouched in this card.

## Acceptance criteria

1. The loader runs against the synthetic fixtures end to end in CI: a test loads them into `staging_cloud` and asserts each table's row count equals the fixture manifest. The same code path takes a real anonymised dump supplied by the lead; the expected dump format is written in the runbook once OD-2 is answered.
2. Read-only guard: with a credential that has INSERT (or UPDATE, DELETE, DDL) privilege the loader aborts before reading any row, with a clear message (test with a role that has INSERT; a second test with a read-only role passes).
3. The profile report lists, per table: row count, per enum-like column the distinct values with counts (capped at 50), null ratios, orphan counts for each declared foreign key, duplicate counts for `users.email` and `(school_id, username)`, and a histogram of password hash prefixes (`$2y$` etc.). A test greps the report for any e-mail, phone, IC or name from the fixtures and finds none.
4. `.migration-out/` and the dump extensions `*.dump`, `*.sql.gz` are git-ignored (added by BE-34); a test asserts `git check-ignore` returns them, and that the BE-34 CI guard fails when one is staged.
5. No connection string or credential appears in logs, docs or tests (log-capture test with a fake password in `CLOUD_SOURCE_URL`).
6. The runbook states: dumps are not committed, not attached to PRs, and deleted after the rehearsal.
7. `staging:load` is repeatable: running it twice leaves the same row counts (it drops and recreates `staging_cloud`).

## Test commands

```
npm run be:test -- apps/api/test/migration/staging
npm run be:verify
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green. Paste the real tail of the output in the PR.
3. This card has no HTTP endpoints, so it adds no conformance scenarios; after BE-31 merges, `npm run be:test -- apps/api/test/conformance` must still pass.
4. This card creates no tables; the migration-first checklist (plan section 14.9) does not apply, but no change may break `npm run be:lint:migration` (once BE-34 is merged).
5. Label `security-review` on the PR; list the security decisions and the tests that prove them.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. OD-2: how real .cloud data reaches the programme. Until answered, build and test with fixtures only.
2. Which tables go to `archive_cloud` (question tables kept read-only) versus `staging_cloud`? Working assumption: the 23 question-bank tables of section 1 go to `archive_cloud`, everything else migrated goes to `staging_cloud`.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-27 (migration-staging-profiling). Work in this repo clone on branch be/BE-27-migration-staging-profiling, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-27-migration-staging-profiling.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-27. You have NO access to the real .cloud database; work only from docs/architecture/v2-data-migration.md and synthetic fixtures you generate. The ETL must treat the source as strictly read-only and refuse to run with write privileges. Produce aggregate-only profiling reports. If OD-2 is unanswered, build against fixtures and note it in the PR. Needs a security review.
```
