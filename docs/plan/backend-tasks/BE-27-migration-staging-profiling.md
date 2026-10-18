# BE-27 .cloud migration: staging schema, loader and profiling report (read-only source)

| Field | Value |
|---|---|
| Size | M |
| Wave | M (migration stream; independent of the API lanes) |
| Depends on | BE-02; **open decision OD-2** (how the collaborator gets .cloud data) |
| Parallel with | every API card |
| Owner module | migration (MIG-01, MIG-08) |
| Security review | required (personal data of minors) |

## Goal

Build the first stage of the ETL: copy the .cloud tables (raw) into a `staging_cloud` Postgres schema from an **anonymised dump or fixtures**, and produce the profiling report that MIG-01 asks for (row counts, distinct enum values, orphan and duplicate reports, hash prefixes), without ever writing to the source.

## Inputs (read these)

- `docs/architecture/v2-data-migration.md` (all of it, especially sections 0, 1, 2, 5, 6.1, 6.2 MIG-01/MIG-08, and 7)
- `docs/requirements/v2-cloud-gap.md`
- `docs/architecture/v2-backend-plan.md` sections 9 (secrets and data protection) and 13 (OD-2, OD-10)
- BE-02 (Prisma, db harness)

## Outputs

- `apps/api/src/migration/` CLI (Nest standalone or plain Node entry): `staging:load`, `staging:profile`
- `apps/api/src/migration/cloud-source.ts`: connection only through `CLOUD_SOURCE_URL`; on connect it **verifies the role is read-only** (no INSERT/UPDATE/DELETE/DDL privilege, or the file/dump input mode) and refuses otherwise
- `apps/api/src/migration/ddl/staging_cloud.sql`: raw table definitions for the tables that are migrated or archived (list from the data-migration doc, final names after the `exam_papers` rename)
- `apps/api/src/migration/profile/**`: report generators writing `./.migration-out/profile-<date>.md/json` (git-ignored, aggregates only, **no row values for personal columns**)
- `apps/api/test/migration/fixtures/` tiny **synthetic** fixtures in the .cloud shape (generated, fictitious)
- `docs/architecture/v2-migration-runbook.md` (how to run each stage, where dumps live, how to delete them)
- Tests under `apps/api/test/migration/staging/**`

## Endpoints

None.

## DB tables touched

Schema `staging_cloud.*` (raw copy) and `archive_cloud.*` (question tables kept read-only). v2 tables are untouched in this card.

## Acceptance criteria

1. The loader runs against the synthetic fixtures end to end in CI; the same code path works against a real anonymised dump supplied by the lead (document the expected dump format in the runbook once OD-2 is answered).
2. Running with a credential that has write privileges aborts with a clear message before reading anything (test with a role that has INSERT).
3. The profile report lists, per table: row count, per enum-like column the distinct values with counts (cap at 50), null ratios, orphan counts for each declared foreign key, duplicate counts for `users.email` and `(school_id, username)`, password hash prefixes histogram (`$2y$` etc.). It never prints names, e-mails, phone, IC.
4. `.migration-out/` and any dump file extensions (`*.sql.gz`, `*.dump`) are in `.gitignore`; a CI check fails if such a file is staged.
5. No connection string or credential appears in logs, docs or tests.
6. The runbook states: dumps are not committed, not attached to PRs, and deleted after the rehearsal.

## Test commands

```
npm run be:test -- apps/api/test/migration/staging
npm run be:verify
```

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-27 (migration-staging-profiling). Work in this repo clone on branch be/BE-27-migration-staging-profiling, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10); docs/plan/backend-tasks/BE-27-migration-staging-profiling.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs.
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-27. You have NO access to the real .cloud database; work only from docs/architecture/v2-data-migration.md and synthetic fixtures you generate. The ETL must treat the source as strictly read-only and refuse to run with write privileges. Produce aggregate-only profiling reports. If OD-2 is unanswered, build against fixtures and note it in the PR. Needs a security review.
```
