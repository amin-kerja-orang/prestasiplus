# BE-30 .cloud migration: reconciliation, rehearsal and cutover scripts

| Field | Value |
|---|---|
| Size | M |
| Wave | M |
| Depends on | BE-29; a staging environment from the lead/devops (MIG-08) |
| Parallel with | BE-33 |
| Owner module | migration (MIG-07 part 3, MIG-09) |

## Goal

Prove the migration end to end on a staging copy: full-run orchestrator, reconciliation reports, delta (incremental by `updated_at`) run for the freeze window, rollback by dropping the target schema, plus the optional post-reload backfill job that links old attempts to new bank questions by natural key + content hash (MIG-09).

## Inputs (read these)

- `docs/architecture/v2-data-migration.md` sections 3.3 (backfill), 5 (cutover), 6
- `docs/architecture/v2-migration-runbook.md` (from BE-27), BE-28/29 CLIs
- `docs/ops/containers.md`

## Outputs

- `apps/api/src/migration/orchestrate.ts` (`migrate:all`, `migrate:delta`, `migrate:verify`)
- `apps/api/src/migration/verify/**`: row-count reconciliation per table, sample-free statistical checks (distribution of answers per subject, ledger sums, users per role per school), orphan scan on the v2 side
- `apps/api/src/migration/backfill/link-questions.ts` (best-effort link by `source_papers.natural_key` + `content_hash`, run only after the new bank exists; never overwrites a non-null `question_id`)
- Runbook updates: rehearsal checklist, freeze window steps, rollback, post-cutover verification, deletion of dumps
- Tests under `apps/api/test/migration/verify/**`

## Endpoints

None.

## DB tables touched

All migrated v2 tables (read), `migration_*`, `practice_answers.question_id` (backfill only).

## Acceptance criteria

1. `migrate:all` on the synthetic fixtures finishes with a green `migrate:verify`; the report is written to `.migration-out/` (git-ignored).
2. `migrate:delta` applied after changing a fixture row updates only that row and is idempotent.
3. Rollback procedure tested: dropping the v2 data schema/tables restores the pre-migration state; the source is untouched (checked by privileges, not by trust).
4. The backfill never changes answer correctness or dimensions, only sets `question_id` when exactly one candidate matches (ambiguities listed).
5. The rehearsal checklist in the runbook is complete enough for the lead to run it without the collaborator (reviewed by the lead).
6. No secrets in scripts; every secret comes from env or the platform secret store.

## Test commands

```
npm run be:test -- apps/api/test/migration
npm run be:verify
```

## Programme update (2026-10-19)

- Programme update: reconciliation is the per-entity contract of plan section 14.6 (counts, sums, distinct sets, sample parity, accepted drift); also uses the BE-35 fixtures for CI and the anonymised dump for the rehearsal.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-30 (migration-reconcile-rehearsal). Work in this repo clone on branch be/BE-30-migration-reconcile-rehearsal, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10); docs/plan/backend-tasks/BE-30-migration-reconcile-rehearsal.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs.
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-30. Orchestrate the BE-27..29 stages, add reconciliation and delta modes, the rollback procedure and the optional question backfill. Everything is tested on synthetic fixtures; the real rehearsal is run by the lead. Update docs/architecture/v2-migration-runbook.md.
```
